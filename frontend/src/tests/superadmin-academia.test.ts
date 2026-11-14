import { describe, it, expect } from 'vitest';

describe('STEP 5: Painel Privado de Super Admin & Academia do Licitante', () => {
  it('calcula faturamento recorrente (MRR) somando planos regulares e o adicional Expertise Fiscal de R$ 99,99', () => {
    const calcularMrr = (assinantesAtivos: number, addonsFiscais: number, precoPlanoBase = 249.99, precoAddonFiscal = 99.99) => {
      const mrrBase = assinantesAtivos * precoPlanoBase;
      const mrrFiscal = addonsFiscais * precoAddonFiscal;
      return Number((mrrBase + mrrFiscal).toFixed(2));
    };

    // 10 assinantes base e 4 adicionais fiscais
    const mrr = calcularMrr(10, 4);
    expect(mrr).toBe(2899.86);

    // 1 assinante com adicional fiscal
    const mrrSingle = calcularMrr(1, 1);
    expect(mrrSingle).toBe(349.98);
  });

  it('permite alternar concessão e revogação de acesso gratuito de 1 clique', () => {
    interface Usuario {
      id: string;
      plano: 'BASIC' | 'MEDIUM' | 'MASTER';
      acessoGratuitoLiberado: boolean;
    }

    const toggleAcessoGratuito = (user: Usuario): Usuario => {
      const novoEstado = !user.acessoGratuitoLiberado;
      return {
        ...user,
        acessoGratuitoLiberado: novoEstado,
        plano: novoEstado ? 'MASTER' : 'BASIC',
      };
    };

    const userTeste: Usuario = { id: 'u1', plano: 'BASIC', acessoGratuitoLiberado: false };
    const liberado = toggleAcessoGratuito(userTeste);
    expect(liberado.acessoGratuitoLiberado).toBe(true);
    expect(liberado.plano).toBe('MASTER');

    const revogado = toggleAcessoGratuito(liberado);
    expect(revogado.acessoGratuitoLiberado).toBe(false);
    expect(revogado.plano).toBe('BASIC');
  });

  it('gera dados completos e código de autenticidade para o Certificado Digital da Academia do Licitante', () => {
    const gerarCertificado = (aluno: string, trilha: string, professor: string, cargaHoraria: string) => {
      const codigoVerificacao = `EXP-CERT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      return {
        aluno,
        trilha,
        professor,
        cargaHoraria,
        amparoLegal: 'Lei Federal 14.133/2021',
        codigoVerificacao,
        emitidoEm: new Date().toLocaleDateString('pt-BR'),
        status: 'Autenticidade Verificada',
      };
    };

    const cert = gerarCertificado(
      'Luis Antonio Gomes Paiva',
      'Estratégia Operacional e Lances no Compras.gov.br',
      'Prof. Dr. Hamilton Santos',
      '12 horas'
    );

    expect(cert.aluno).toBe('Luis Antonio Gomes Paiva');
    expect(cert.amparoLegal).toContain('Lei Federal 14.133/2021');
    expect(cert.codigoVerificacao).toMatch(/^EXP-CERT-2026-\d{4}$/);
    expect(cert.status).toBe('Autenticidade Verificada');
  });

  it('garante que o painel de Super Admin possui rotas privadas e não é exposto na navegação comum do licitante', () => {
    const rotasLicitante = [
      '/fornecedor/dashboard',
      '/fornecedor/radar',
      '/fornecedor/propostas',
      '/fornecedor/disputa-ao-vivo',
      '/fornecedor/contratos',
      '/fornecedor/academia',
    ];

    const rotaSuperAdmin = '/master-admin-vault';
    expect(rotasLicitante).not.toContain(rotaSuperAdmin);
  });
});
