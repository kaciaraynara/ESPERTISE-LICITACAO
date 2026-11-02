const mockCompanyFindFirst = jest.fn();
const mockDocumentFindMany = jest.fn();
const mockDocumentFindFirst = jest.fn();
const mockCompanyCertificateFindMany = jest.fn();

jest.mock('../database/prisma', () => ({
  prisma: {
    company: { findFirst: mockCompanyFindFirst },
    document: {
      findMany: mockDocumentFindMany,
      findFirst: mockDocumentFindFirst,
    },
    companyCertificate: { findMany: mockCompanyCertificateFindMany },
  },
}));

const mockGetPresignedDownloadUrl = jest.fn();
const mockGetFileBuffer = jest.fn();

jest.mock('./storage.service', () => ({
  storageService: {
    getPresignedDownloadUrl: mockGetPresignedDownloadUrl,
    getFileBuffer: mockGetFileBuffer,
  },
}));

import {
  CertidaoArquivoIndisponivelError,
  CertidoesService,
} from './certidoes.service';

describe('CertidoesService', () => {
  let service: CertidoesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CertidoesService();
    mockCompanyFindFirst.mockResolvedValue({
      id: 'company-1',
      userId: 'user-1',
      uf: 'RJ',
      createdAt: new Date(),
    });
    mockDocumentFindMany.mockResolvedValue([]);
    mockDocumentFindFirst.mockResolvedValue(null);
    mockCompanyCertificateFindMany.mockResolvedValue([]);
  });

  it('não presume validade quando não há data/documento registrado', async () => {
    const result = await service.listarCertidoes('user-1', 'company-1');

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.status === 'SEM_VALIDADE')).toBe(true);
    expect(result.every((item) => item.validade === null && item.diasParaVencer === null)).toBe(true);
  });

  it('usa a validade registrada e não aponta portais de SP para empresas de outra UF', async () => {
    const expirationDate = new Date();
    expirationDate.setUTCDate(expirationDate.getUTCDate() + 20);
    mockCompanyCertificateFindMany.mockResolvedValue([
      { type: 'RECEITA', expirationDate, documentUrl: null },
    ]);

    const result = await service.listarCertidoes('user-1', 'company-1');
    const federal = result.find((item) => item.id === 'cnd-federal');
    const estadual = result.find((item) => item.id === 'cnd-estadual');

    expect(federal?.status).toBe('VALIDA');
    expect(federal?.diasParaVencer).toBe(20);
    expect(estadual?.urlEmissao).toBeNull();
    expect(estadual?.urlValidacao).toBeNull();
    expect(mockCompanyFindFirst).toHaveBeenCalledWith({
      where: { id: 'company-1', userId: 'user-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(mockDocumentFindMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', companyId: 'company-1' },
    });
    expect(mockCompanyCertificateFindMany).toHaveBeenCalledWith({
      where: { companyId: 'company-1' },
    });
  });

  it('recusa gerar um PDF apresentado como certidão oficial quando não há arquivo salvo', async () => {
    await expect(
      service.obterArquivoCertidao('cnd-federal', 'user-1', 'company-1'),
    ).rejects.toBeInstanceOf(CertidaoArquivoIndisponivelError);
  });
});
