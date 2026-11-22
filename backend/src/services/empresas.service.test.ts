const mockUserFindUnique = jest.fn();
const mockCompanyFindFirst = jest.fn();
const mockCompanyUpdate = jest.fn();
const mockPublicCompanyFindFirst = jest.fn();
const mockConsultarCnpjOficial = jest.fn();
const mockSincronizarEmpresaComDadosReceita = jest.fn();

jest.mock('../database/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
    company: {
      findFirst: mockCompanyFindFirst,
      update: mockCompanyUpdate,
    },
    publicCompany: {
      findFirst: mockPublicCompanyFindFirst,
    },
  },
}));

jest.mock('./plans/plan-guard.service', () => ({
  planGuardService: {
    assertWithinCompanyLimit: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('./cnpj.service', () => ({
  consultarCnpjOficial: mockConsultarCnpjOficial,
  sincronizarEmpresaComDadosReceita: mockSincronizarEmpresaComDadosReceita,
}));

import { EmpresasService } from './empresas.service';

describe('empresas.service', () => {
  const service = new EmpresasService();
  const userId = 'user-1';
  const tenantId = 'tenant-1';
  const companyId = 'company-1';

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({ tenantId, deletedAt: null });
  });

  test('atualizar persiste campos editados manualmente sem sobrescrever via RFB quando CNPJ não muda', async () => {
    const existingRow = {
      id: companyId,
      tenantId,
      userId,
      cnpj: '12345678000195',
      razaoSocial: 'EMPRESA ORIGINAL LTDA',
      nomeFantasia: 'ORIGINAL',
      cnaePrincipal: '4781400 - Comércio varejista de artigos do vestuário',
      municipio: 'FORTALEZA',
      uf: 'CE',
      cep: null,
      logradouro: null,
      bairro: null,
      telefone: null,
      email: null,
      porte: null,
      status: 'ATIVA',
      nicho: [],
      palavrasChave: ['vestuario'],
      valorMin: null,
      valorMax: null,
      regioes: ['CE'],
      orgaosPreferidos: [],
      orgaosBloqueados: [],
      createdAt: new Date('2026-11-01T10:00:00.000Z'),
      updatedAt: new Date('2026-11-01T10:00:00.000Z'),
    };

    mockCompanyFindFirst
      .mockResolvedValueOnce(existingRow)
      .mockResolvedValueOnce(null);

    mockCompanyUpdate.mockImplementation(async ({ data }: any) => ({
      ...existingRow,
      ...data,
      updatedAt: new Date('2026-11-22T12:00:00.000Z'),
    }));

    const result = await service.atualizar(userId, companyId, {
      cnpj: '12.345.678/0001-95',
      razaoSocial: 'NORTE SUL UNIFORMES E SUPRIMENTOS LTDA',
      nomeFantasia: 'NORTE SUL UNIFORMES',
      municipio: 'Caucaia',
      uf: 'ce',
      cep: '61600-000',
      logradouro: 'Av. Edson da Mota Correia, 500',
      bairro: 'Centro',
      telefone: '(85) 99999-0001',
      email: 'carlos@nortesul.com.br',
      porte: 'EPP',
      cnaePrincipal: '1412-6/01 - Confecção de peças do vestuário',
      palavrasChave: ['uniformes', 'fardamento', 'jalecos'],
    });

    expect(mockConsultarCnpjOficial).not.toHaveBeenCalled();
    expect(mockCompanyUpdate).toHaveBeenCalledWith({
      where: { id: companyId },
      data: expect.objectContaining({
        cnpj: '12345678000195',
        razaoSocial: 'NORTE SUL UNIFORMES E SUPRIMENTOS LTDA',
        nomeFantasia: 'NORTE SUL UNIFORMES',
        municipio: 'Caucaia',
        uf: 'CE',
        cep: '61600-000',
        logradouro: 'Av. Edson da Mota Correia, 500',
        bairro: 'Centro',
        telefone: '(85) 99999-0001',
        email: 'carlos@nortesul.com.br',
        porte: 'EPP',
        cnaePrincipal: '1412-6/01 - Confecção de peças do vestuário',
        palavrasChave: ['uniformes', 'fardamento', 'jalecos'],
      }),
    });
    expect(result).toMatchObject({
      razaoSocial: 'NORTE SUL UNIFORMES E SUPRIMENTOS LTDA',
      municipio: 'Caucaia',
      uf: 'CE',
      cep: '61600-000',
      logradouro: 'Av. Edson da Mota Correia, 500',
      bairro: 'Centro',
      telefone: '(85) 99999-0001',
      email: 'carlos@nortesul.com.br',
      porte: 'EPP',
      endereco: 'Av. Edson da Mota Correia, 500, Centro, Caucaia, CE, 61600-000',
      palavras_chave: ['uniformes', 'fardamento', 'jalecos'],
    });
  });

  test('atualizar lança ApiError 404 quando a empresa não pertence ao usuário', async () => {
    mockCompanyFindFirst.mockResolvedValueOnce(null);

    await expect(
      service.atualizar(userId, 'missing-id', { razaoSocial: 'Teste' }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Empresa não encontrada',
    });
  });
});
