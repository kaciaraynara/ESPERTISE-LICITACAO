import type { AuthRequest } from './auth.middleware';

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
}

function loadMiddleware(fakeService: any) {
  jest.resetModules();
  jest.doMock('../../services/rbac.service', () => ({
    RBAC_PERMISSIONS: {
      DATA_PLATFORM_ADMIN: 'data_platform:admin',
      AUDIT_READ: 'audit:read',
      AUDIT_ADMIN: 'audit:admin',
      USERS_MANAGE: 'users:manage',
      LEGAL_ADMIN: 'legal:admin',
      LEGAL_REVIEW: 'legal:review',
      LEGAL_PUBLISH: 'legal:publish',
    },
    RbacService: jest.fn(() => fakeService),
  }));

  return require('./data-platform-admin.middleware') as typeof import('./data-platform-admin.middleware');
}

describe('requireDataPlatformAdmin', () => {
  const originalDataPlatformUserIds = process.env.DATA_PLATFORM_ADMIN_USER_IDS;
  const originalDataPlatformEmails = process.env.DATA_PLATFORM_ADMIN_EMAILS;
  const originalRbacUserIds = process.env.RBAC_ADMIN_USER_IDS;
  const originalRbacEmails = process.env.RBAC_ADMIN_EMAILS;
  const originalAuditUserIds = process.env.AUDIT_ADMIN_USER_IDS;
  const originalAuditEmails = process.env.AUDIT_ADMIN_EMAILS;
  const originalFallbackFlag = process.env.RBAC_ALLOW_ENV_FALLBACK;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.DATA_PLATFORM_ADMIN_USER_IDS = originalDataPlatformUserIds;
    process.env.DATA_PLATFORM_ADMIN_EMAILS = originalDataPlatformEmails;
    process.env.RBAC_ADMIN_USER_IDS = originalRbacUserIds;
    process.env.RBAC_ADMIN_EMAILS = originalRbacEmails;
    process.env.AUDIT_ADMIN_USER_IDS = originalAuditUserIds;
    process.env.AUDIT_ADMIN_EMAILS = originalAuditEmails;
    if (originalFallbackFlag === undefined) {
      delete process.env.RBAC_ALLOW_ENV_FALLBACK;
    } else {
      process.env.RBAC_ALLOW_ENV_FALLBACK = originalFallbackFlag;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    jest.dontMock('../../services/rbac.service');
  });

  test('nega acesso sem autenticacao', async () => {
    const { requireDataPlatformAdmin } = loadMiddleware({
      hasPermission: jest.fn(async () => false),
      auditAuthorizationFailure: jest.fn(),
    });
    const req = {} as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireDataPlatformAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('usuario com permissao no banco acessa', async () => {
    const fakeService = {
      hasPermission: jest.fn(async () => true),
      auditAuthorizationFailure: jest.fn(),
    };
    const { requireDataPlatformAdmin } = loadMiddleware(fakeService);
    const req = { user: { id: 'user-1', email: 'u@expertise.test', plano: 'pro', role: 'fornecedor' } } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireDataPlatformAdmin(req, res, next);

    expect(fakeService.hasPermission).toHaveBeenCalledWith('user-1', 'data_platform:admin', null);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('usuario sem permissao e bloqueado com auditoria', async () => {
    const fakeService = {
      hasPermission: jest.fn(async () => false),
      auditAuthorizationFailure: jest.fn(async () => undefined),
    };
    const { requireDataPlatformAdmin } = loadMiddleware(fakeService);
    const req = {
      user: { id: 'user-1', email: 'u@expertise.test', plano: 'pro', role: 'fornecedor' },
      headers: {},
      ip: '127.0.0.1',
    } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireDataPlatformAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(fakeService.auditAuthorizationFailure).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ id: 'user-1' }),
    }), 'data_platform:admin', 'data_platform_admin');
    expect(next).not.toHaveBeenCalled();
  });

  test('fallback por claim administrativa continua funcionando', async () => {
    const fakeService = {
      hasPermission: jest.fn(async () => false),
      auditAuthorizationFailure: jest.fn(),
    };
    const { requireDataPlatformAdmin } = loadMiddleware(fakeService);
    const req = {
      user: {
        id: 'admin-1',
        email: 'admin@expertise.test',
        plano: 'enterprise',
        role: 'fornecedor',
        isAdmin: true,
      },
    } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireDataPlatformAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(fakeService.auditAuthorizationFailure).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('fallback de ambiente fica desativado por padrão em desenvolvimento', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.RBAC_ALLOW_ENV_FALLBACK;
    const fakeService = {
      hasPermission: jest.fn(async () => false),
      auditAuthorizationFailure: jest.fn(async () => undefined),
    };
    const { requireDataPlatformAdmin } = loadMiddleware(fakeService);
    const req = {
      user: {
        id: 'admin-1',
        email: 'admin@expertise.test',
        plano: 'master',
        role: 'fornecedor',
        isAdmin: true,
      },
      headers: {},
      ip: '127.0.0.1',
    } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireDataPlatformAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('fallback de ambiente permanece bloqueado em produção mesmo se solicitado', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RBAC_ALLOW_ENV_FALLBACK = 'true';
    const fakeService = {
      hasPermission: jest.fn(async () => false),
      auditAuthorizationFailure: jest.fn(async () => undefined),
    };
    const { requireDataPlatformAdmin } = loadMiddleware(fakeService);
    const req = {
      user: {
        id: 'admin-1',
        email: 'admin@expertise.test',
        plano: 'master',
        role: 'fornecedor',
        isAdmin: true,
      },
      headers: {},
      ip: '127.0.0.1',
    } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireDataPlatformAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRbacAdmin', () => {
  test('fallback env temporario ainda permite bootstrap administrativo', async () => {
    process.env.RBAC_ADMIN_USER_IDS = 'admin-1';
    const fakeService = {
      hasPermission: jest.fn(async () => false),
      auditAuthorizationFailure: jest.fn(),
    };
    const { requireRbacAdmin } = loadMiddleware(fakeService);
    const req = {
      user: { id: 'admin-1', email: 'admin@expertise.test', plano: 'enterprise', role: 'fornecedor' },
    } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireRbacAdmin(req, res, next);

    expect(fakeService.hasPermission).toHaveBeenCalledWith('admin-1', 'users:manage', null);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireAuditRead', () => {
  test('permite acesso com permissao audit persistente', async () => {
    const fakeService = {
      hasPermission: jest.fn(async () => true),
      auditAuthorizationFailure: jest.fn(),
    };
    const { requireAuditRead } = loadMiddleware(fakeService);
    const req = {
      user: { id: 'audit-1', email: 'audit@expertise.test', plano: 'enterprise', role: 'fornecedor' },
    } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireAuditRead(req, res, next);

    expect(fakeService.hasPermission).toHaveBeenCalledWith('audit-1', 'audit:read', null);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('nega acesso sem permissao audit e registra auditoria', async () => {
    const fakeService = {
      hasPermission: jest.fn(async () => false),
      auditAuthorizationFailure: jest.fn(async () => undefined),
    };
    const { requireAuditRead } = loadMiddleware(fakeService);
    const req = {
      user: { id: 'user-1', email: 'u@expertise.test', plano: 'pro', role: 'fornecedor' },
      headers: {},
      ip: '127.0.0.1',
    } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireAuditRead(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(fakeService.auditAuthorizationFailure).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ id: 'user-1' }),
    }), 'audit:read', 'audit_admin');
    expect(next).not.toHaveBeenCalled();
  });

  test('fallback ativo permite acesso por claim audit temporaria', async () => {
    process.env.RBAC_ALLOW_ENV_FALLBACK = 'true';
    const fakeService = {
      hasPermission: jest.fn(async () => false),
      auditAuthorizationFailure: jest.fn(),
    };
    const { requireAuditRead } = loadMiddleware(fakeService);
    const req = {
      user: {
        id: 'audit-1',
        email: 'audit@expertise.test',
        plano: 'enterprise',
        role: 'fornecedor',
        permissions: ['audit:read'],
      },
    } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireAuditRead(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(fakeService.auditAuthorizationFailure).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('fallback desativado bloqueia claim/env e registra auditoria', async () => {
    process.env.RBAC_ALLOW_ENV_FALLBACK = 'false';
    process.env.AUDIT_ADMIN_USER_IDS = 'audit-1';
    const fakeService = {
      hasPermission: jest.fn(async () => false),
      auditAuthorizationFailure: jest.fn(async () => undefined),
    };
    const { requireAuditRead } = loadMiddleware(fakeService);
    const req = {
      user: {
        id: 'audit-1',
        email: 'audit@expertise.test',
        plano: 'enterprise',
        role: 'fornecedor',
        isAdmin: true,
        permissions: ['audit:read'],
      },
      headers: {},
      ip: '127.0.0.1',
    } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireAuditRead(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(fakeService.auditAuthorizationFailure).toHaveBeenCalledWith(expect.any(Object), 'audit:read', 'audit_admin');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireLegalAdmin', () => {
  test('nega acesso sem legal:admin e registra auditoria especifica', async () => {
    const fakeService = {
      hasPermission: jest.fn(async () => false),
      auditAuthorizationFailure: jest.fn(async () => undefined),
    };
    const { requireLegalAdmin } = loadMiddleware(fakeService);
    const req = {
      user: { id: 'user-1', email: 'u@expertise.test', plano: 'pro', role: 'fornecedor' },
      headers: {},
      ip: '127.0.0.1',
    } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireLegalAdmin(req, res, next);

    expect(fakeService.hasPermission).toHaveBeenCalledWith('user-1', 'legal:admin', null);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(fakeService.auditAuthorizationFailure).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ id: 'user-1' }),
    }), 'legal:admin', 'legal_rules_admin', 'legal_rule_access_denied');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('legal workflow permissions', () => {
  test('permite aprovacao com legal:review persistente', async () => {
    const fakeService = {
      hasPermission: jest.fn(async () => true),
      auditAuthorizationFailure: jest.fn(),
    };
    const { requireLegalReview } = loadMiddleware(fakeService);
    const req = {
      user: { id: 'reviewer-1', email: 'reviewer@expertise.test', plano: 'enterprise', role: 'fornecedor' },
    } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireLegalReview(req, res, next);

    expect(fakeService.hasPermission).toHaveBeenCalledWith('reviewer-1', 'legal:review', null);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('bloqueia aprovacao sem legal:review', async () => {
    const fakeService = {
      hasPermission: jest.fn(async () => false),
      auditAuthorizationFailure: jest.fn(async () => undefined),
    };
    const { requireLegalReview } = loadMiddleware(fakeService);
    const req = {
      user: { id: 'user-1', email: 'u@expertise.test', plano: 'pro', role: 'fornecedor' },
      headers: {},
      ip: '127.0.0.1',
    } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireLegalReview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(fakeService.auditAuthorizationFailure).toHaveBeenCalledWith(expect.any(Object), 'legal:review', 'legal_rules_admin', 'legal_rule_access_denied');
    expect(next).not.toHaveBeenCalled();
  });

  test('permite ativacao com legal:publish persistente', async () => {
    const fakeService = {
      hasPermission: jest.fn(async () => true),
      auditAuthorizationFailure: jest.fn(),
    };
    const { requireLegalPublish } = loadMiddleware(fakeService);
    const req = {
      user: { id: 'publisher-1', email: 'publisher@expertise.test', plano: 'enterprise', role: 'fornecedor' },
    } as AuthRequest;
    const res = response();
    const next = jest.fn();

    await requireLegalPublish(req, res, next);

    expect(fakeService.hasPermission).toHaveBeenCalledWith('publisher-1', 'legal:publish', null);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
