import axios from 'axios';

export interface QSAInfo {
  cnpj: string;
  razaoSocial: string;
  socios: Array<{ nome: string; qualificacao: string }>;
}

export class QsaService {
  async buscarDadosReceita(cnpj: string): Promise<QSAInfo | null> {
    try {
      const cleanCnpj = cnpj.replace(/\D/g, '');
      const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, { timeout: 10000 });

      return {
        cnpj: cleanCnpj,
        razaoSocial: response.data.razao_social,
        socios: (response.data.qsa || []).map((s: any) => ({
          nome: s.nome_socio,
          qualificacao: s.qualificacao_socio,
        })),
      };
    } catch (error) {
      console.error(`Erro ao buscar CNPJ ${cnpj}:`, error);
      return null;
    }
  }

  async analisarCartel(cnpjs: string[]) {
    const dados = await Promise.all(cnpjs.map((cnpj) => this.buscarDadosReceita(cnpj)));
    const empresasValidas = dados.filter((d): d is QSAInfo => d !== null);

    const alertas: Array<{ tipo: string; severidade: string; mensagem: string }> = [];
    const sociosMap = new Map<string, string[]>();

    empresasValidas.forEach((empresa) => {
      empresa.socios.forEach((socio) => {
        const cnpjsSocio = sociosMap.get(socio.nome) || [];
        cnpjsSocio.push(empresa.razaoSocial);
        sociosMap.set(socio.nome, cnpjsSocio);
      });
    });

    for (const [nome, empresas] of sociosMap.entries()) {
      if (empresas.length > 1) {
        alertas.push({
          tipo: 'RISCO_CARTEL_SOCIETARIO',
          severidade: 'ALTA',
          mensagem: `O sócio ${nome} faz parte de múltiplas empresas nesta disputa: ${empresas.join(', ')}.`,
        });
      }
    }

    return { empresasAnalisadas: empresasValidas.length, riscoIdentificado: alertas.length > 0, alertas };
  }
}

export const qsaService = new QsaService();
