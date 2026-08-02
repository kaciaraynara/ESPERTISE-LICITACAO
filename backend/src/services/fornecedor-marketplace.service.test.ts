const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

jest.mock('../config/env', () => ({
  isDatabaseConfigured: jest.fn(() => true),
  isJsonFallbackEnabled: jest.fn(() => false),
  isProduction: jest.fn(() => false),
}));

jest.mock('../database/prisma', () => ({
  prisma: {
    fornecedorMarketplace: {
      findMany: jest.fn(),
      findUnique: mockFindUnique,
      create: jest.fn(),
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

import { FornecedorMarketplaceService } from './fornecedor-marketplace.service';

const ownerUserId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';

function fornecedor(overrides: Record<string, unknown> = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    ownerUserId,
    cnpj: '11222333000181',
    razaoSocial: 'Fornecedor do Proprietário Ltda.',
    nomeFantasia: 'Fornecedor Proprietário',
    cnaePrincipal: '4651-6/01',
    ramoAtividade: 'Equipamentos de informática',
    regiaoAtendimento: ['CE'],
    municipio: 'Fortaleza',
    uf: 'CE',
    notaReputacao: 4.5,
    selosConformidade: ['SICAF'],
    custoReferencia: 100,
    unidadeCusto: 'UN',
    ativo: true,
    createdAt: new Date('2026-06-01T12:00:00.000Z'),
    updatedAt: new Date('2026-06-01T12:00:00.000Z'),
    ...overrides,
  };
}

describe('FornecedorMarketplaceService - autorização por proprietário', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('permite que o proprietário atualize o próprio fornecedor', async () => {
    const existing = fornecedor();
    const updated = fornecedor({
      razaoSocial: 'Fornecedor Atualizado Ltda.',
      updatedAt: new Date('2026-06-15T12:00:00.000Z'),
    });

    mockFindUnique.mockResolvedValue(existing);
    mockUpdate.mockResolvedValue(updated);

    const service = new FornecedorMarketplaceService();
    const result = await service.atualizar(
      existing.id,
      ownerUserId,
      { razaoSocial: 'Fornecedor Atualizado Ltda.' },
    );

    expect(result).toMatchObject({
      id: existing.id,
      ownerUserId,
      razaoSocial: 'Fornecedor Atualizado Ltda.',
    });

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: existing.id },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: expect.objectContaining({
        razaoSocial: 'Fornecedor Atualizado Ltda.',
      }),
    });
  });

  test('bloqueia atualização feita por outro usuário', async () => {
    const existing = fornecedor();
    mockFindUnique.mockResolvedValue(existing);

    const service = new FornecedorMarketplaceService();

    await expect(
      service.atualizar(
        existing.id,
        otherUserId,
        { razaoSocial: 'Alteração indevida' },
      ),
    ).rejects.toThrow('FORNECEDOR_MARKETPLACE_FORBIDDEN');

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('bloqueia atualização de fornecedor institucional sem proprietário', async () => {
    const institutional = fornecedor({ ownerUserId: null });
    mockFindUnique.mockResolvedValue(institutional);

    const service = new FornecedorMarketplaceService();

    await expect(
      service.atualizar(
        institutional.id,
        ownerUserId,
        { razaoSocial: 'Alteração não autorizada' },
      ),
    ).rejects.toThrow('FORNECEDOR_MARKETPLACE_FORBIDDEN');

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('retorna null ao atualizar fornecedor inexistente', async () => {
    mockFindUnique.mockResolvedValue(null);

    const service = new FornecedorMarketplaceService();
    const result = await service.atualizar(
      '44444444-4444-4444-8444-444444444444',
      ownerUserId,
      { razaoSocial: 'Fornecedor inexistente' },
    );

    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('permite que o proprietário remova o próprio fornecedor', async () => {
    const existing = fornecedor();
    mockFindUnique.mockResolvedValue(existing);
    mockDelete.mockResolvedValue(existing);

    const service = new FornecedorMarketplaceService();
    const result = await service.remover(existing.id, ownerUserId);

    expect(result).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({
      where: { id: existing.id },
    });
  });

  test('bloqueia exclusão feita por outro usuário', async () => {
    const existing = fornecedor();
    mockFindUnique.mockResolvedValue(existing);

    const service = new FornecedorMarketplaceService();

    await expect(
      service.remover(existing.id, otherUserId),
    ).rejects.toThrow('FORNECEDOR_MARKETPLACE_FORBIDDEN');

    expect(mockDelete).not.toHaveBeenCalled();
  });

  test('bloqueia exclusão de fornecedor institucional', async () => {
    const institutional = fornecedor({ ownerUserId: null });
    mockFindUnique.mockResolvedValue(institutional);

    const service = new FornecedorMarketplaceService();

    await expect(
      service.remover(institutional.id, ownerUserId),
    ).rejects.toThrow('FORNECEDOR_MARKETPLACE_FORBIDDEN');

    expect(mockDelete).not.toHaveBeenCalled();
  });

  test('retorna false ao remover fornecedor inexistente', async () => {
    mockFindUnique.mockResolvedValue(null);

    const service = new FornecedorMarketplaceService();
    const result = await service.remover(
      '55555555-5555-4555-8555-555555555555',
      ownerUserId,
    );

    expect(result).toBe(false);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
