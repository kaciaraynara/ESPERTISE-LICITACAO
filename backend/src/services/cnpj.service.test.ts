import axios from 'axios';
import { prisma } from '../database/prisma';
import { consultarCnpjOficial } from './cnpj.service';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('../database/prisma', () => ({
  prisma: {
    publicCompany: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe('consultarCnpjOficial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.publicCompany.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.publicCompany.upsert as jest.Mock).mockResolvedValue({});
    (axios.get as jest.Mock).mockResolvedValue({
      data: {
        razao_social: 'Empresa de Teste Ltda',
        nome_fantasia: 'Empresa de Teste',
        municipio: 'Brasília',
        uf: 'DF',
        cnae_fiscal: 6201500,
        cnae_fiscal_descricao: 'Desenvolvimento de software',
      },
    });
  });

  it('coalesce consultas concorrentes ao mesmo CNPJ na instância', async () => {
    const [first, second] = await Promise.all([
      consultarCnpjOficial('12.345.678/0001-95'),
      consultarCnpjOficial('12345678000195'),
    ]);

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.cnpj).toBe('12345678000195');
  });
});
