import { RbacService } from './rbac.service';

function serviceWith(clientOverrides: any = {}) {
  const client = {
    ...clientOverrides,
    auditEvent: {
      create: jest.fn(),
      ...(clientOverrides.auditEvent ?? {}),
    }
  };
  return {
    service: new RbacService(client),
    client
  };
}

const context = {
  user: { id: 'admin-1', email: 'admin@expertise.test', role: 'fornecedor' },
  requestId: 'req-1',
  ip: '127.0.0.1',
  userAgent: 'jest',
};

const role = {
  id: 'role-1',
  key: 'data_platform_admin',
  name: 'Data Platform Admin',
  description: null,
  scope: 'module',
  tenantId: null,
  module: 'data_platform',
  system: true,
  active: true,
  metadata: null,
  createdAt: new Date('2026-06-04T12:00:00Z'),
  updatedAt: new Date('2026-06-04T12:00:00Z'),
  permissions: [],
};

describe('RbacService', () => {
  test('usuario com permissao persistente no banco acessa', async () => {
    const findFirst = jest.fn(async () => ({ id: 'assignment-1' }));
    const { service } = serviceWith({ userRole: { findFirst } });

    await expect(service.hasPermission('user-1', 'data_platform:admin')).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 'user-1' }),
      select: { id: true },
    }));
  });

  test('usuario sem permissao persistente e bloqueado', async () => {
    const { service } = serviceWith({ userRole: { findFirst: jest.fn(async () => null) } });

    await expect(service.hasPermission('user-1', 'data_platform:admin')).resolves.toBe(false);
  });

  test('listUserPermissions respeita filtro de tenant', async () => {
    const findMany = jest.fn(async () => [{
      id: 'assignment-1',
      tenantId: 'tenant-a',
      module: null,
      expiresAt: null,
      role: {
        ...role,
        tenantId: 'tenant-a',
        permissions: [{
          permission: {
            id: 'permission-1',
            key: 'users:manage',
            module: 'users',
            action: 'manage',
            scope: 'module',
            description: null,
            system: true,
            metadata: null,
          },
        }],
      },
    }]);
    const { service } = serviceWith({ userRole: { findMany } });

    const result = await service.listUserPermissions('user-1', 'tenant-a');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'user-1',
        AND: expect.arrayContaining([
          expect.objectContaining({ OR: [{ tenantId: null }, { tenantId: 'tenant-a' }] }),
        ]),
      }),
    }));
    expect(result).toMatchObject({
      userId: 'user-1',
      tenantId: 'tenant-a',
      permissions: [{ key: 'users:manage' }],
    });
  });

  test('createRole registra auditoria de criacao', async () => {
    const { service, client } = serviceWith({
      role: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => ({
          ...role,
          id: 'role-custom',
          key: 'custom_admin',
          name: 'Custom Admin',
          system: false,
          module: 'users',
        })),
      },
      permission: {
        findMany: jest.fn(async () => [{ id: 'permission-1', key: 'users:manage' }]),
      },
      rolePermission: {
        createMany: jest.fn(async () => ({ count: 1 })),
      },
    });

    await service.createRole({
      key: 'custom_admin',
      name: 'Custom Admin',
      scope: 'module',
      module: 'users',
      permissionKeys: ['users:manage'],
    }, context);

    expect(client.role.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ key: 'custom_admin', module: 'users' }),
    }));
    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        scope: 'rbac_admin',
        action: 'RBAC_CREATE_ROLE',
        outcome: 'success',
        userId: 'admin-1',
      })
    }));
  });

  test('assignRole registra AuditEvent', async () => {
    const { service, client } = serviceWith({
      role: { findFirst: jest.fn(async () => role) },
      userRole: {
        findFirst: jest.fn(async () => null),
        create: jest.fn(async () => ({
          id: 'assignment-1',
          userId: 'user-1',
          roleId: 'role-1',
          tenantId: 'tenant-a',
          module: null,
          expiresAt: null,
        })),
      },
    });

    const result = await service.assignRole({
      userId: 'user-1',
      roleKey: 'data_platform_admin',
      tenantId: 'tenant-a',
    }, context);

    expect(result).toMatchObject({ id: 'assignment-1', userId: 'user-1', tenantId: 'tenant-a' });
    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        scope: 'rbac_admin',
        action: 'RBAC_ASSIGN_ROLE',
        outcome: 'success',
        userId: 'admin-1',
        entityType: 'user_role',
      })
    }));
  });

  test('revokeRole registra AuditEvent', async () => {
    const { service, client } = serviceWith({
      role: { findFirst: jest.fn(async () => role) },
      userRole: {
        findMany: jest.fn(async () => [{ id: 'assignment-1' }]),
        deleteMany: jest.fn(async () => ({ count: 1 })),
      },
    });

    const result = await service.revokeRole({
      userId: 'user-1',
      roleKey: 'data_platform_admin',
      tenantId: 'tenant-a',
    }, context);

    expect(result).toMatchObject({ userId: 'user-1', revoked: 1 });
    expect(client.userRole.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['assignment-1'] } },
    });
    expect(client.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        scope: 'rbac_admin',
        action: 'RBAC_REVOKE_ROLE',
        outcome: 'success',
        userId: 'admin-1',
      })
    }));
  });
});
