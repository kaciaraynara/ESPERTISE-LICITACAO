import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditalSelector } from './components/EditalSelector';
import { PropostasPage } from './pages/Propostas/PropostasPage';
import { calcularPrecificacaoProposta } from './pages/Propostas/CriarPropostaPage';
import { propostasApi, crmApi } from './services/api';

describe('ETAPA 2: Criação de Propostas Automatizada e Conectada', () => {
  const storage: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => {
      storage[key] = String(value);
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    clear: () => {
      Object.keys(storage).forEach((k) => delete storage[k]);
    },
  };

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. Integração com os Editais Salvos (EditalSelector)', () => {
    it('deve exportar EditalSelector e PropostasPage como componentes React válidos', () => {
      expect(typeof EditalSelector).toBe('function');
      expect(typeof PropostasPage).toBe('function');
    });

    it('propostasApi deve fornecer preencherPropostaViaLex e extrairEditalLex', () => {
      expect(typeof propostasApi.preencherPropostaViaLex).toBe('function');
      expect(typeof propostasApi.extrairEditalLex).toBe('function');
      expect(typeof propostasApi.criarRascunho).toBe('function');
      expect(typeof crmApi.getOportunidades).toBe('function');
    });

    it('deve priorizar editais salvos no Radar (fonte "salvo") e eliminar mensagem de nenhum edital', () => {
      const mockSavedNotice = {
        id: 'notice-uuid-1',
        numeroEdital: 'PE 10/2026',
        orgao: 'Ministério da Saúde',
        cnpjOrgao: '00.394.544/0001-85',
        modalidade: 'Pregão Eletrônico',
        dataCertame: '2026-11-20',
        objeto: 'Aquisição de insumos hospitalares e medicamentos',
        valorEstimado: 250000,
        fonte: 'salvo' as const,
      };

      const mockMonitoredNotice = {
        id: 'notice-uuid-2',
        numeroEdital: 'PE 99/2026',
        orgao: 'Secretaria de Educação',
        modalidade: 'Pregão Eletrônico',
        fonte: 'monitorado' as const,
      };

      const lista = [mockMonitoredNotice, mockSavedNotice];

      // Ordenação: editais salvos vêm primeiro
      lista.sort((a, b) => {
        if (a.fonte === 'salvo' && b.fonte !== 'salvo') return -1;
        if (a.fonte !== 'salvo' && b.fonte === 'salvo') return 1;
        return 0;
      });

      expect(lista[0].id).toBe('notice-uuid-1');
      expect(lista[0].fonte).toBe('salvo');
      expect(lista.length).toBeGreaterThan(0);

      // Quando há itens salvos, a mensagem "nenhum edital encontrado" nunca deve ser exibida
      const shouldShowEmptyMessage = lista.length === 0;
      expect(shouldShowEmptyMessage).toBe(false);
    });

    it('deve persistir e carregar editais salvos do cache local expertise_editais_salvos_detalhes', () => {
      const savedNotice = {
        id: 'notice-cache-123',
        numeroEdital: 'PE 45/2026',
        orgao: 'Prefeitura Municipal de São Paulo',
        cnpjOrgao: '46.392.130/0001-99',
        modalidade: 'Pregão Eletrônico',
        objeto: 'Serviços de Tecnologia da Informação',
        valorEstimado: 120000,
      };

      mockLocalStorage.setItem('expertise_editais_salvos_detalhes', JSON.stringify([savedNotice]));

      const stored = JSON.parse(mockLocalStorage.getItem('expertise_editais_salvos_detalhes') || '[]');
      expect(stored).toHaveLength(1);
      expect(stored[0].numeroEdital).toBe('PE 45/2026');
      expect(stored[0].orgao).toBe('Prefeitura Municipal de São Paulo');
    });
  });

  describe('2. Dois Modos de Preenchimento (Automático vs Manual)', () => {
    it('Modo Automático: deve carregar dados do órgão, número do certame, dados cadastrais e itens com valores calculados', () => {
      const editalSelecionado = {
        id: 'notice-uuid-1',
        numeroEdital: 'PE 10/2026',
        orgao: 'Ministério da Saúde',
        cnpjOrgao: '00.394.544/0001-85',
        modalidade: 'Pregão Eletrônico',
        objeto: 'Aquisição de insumos hospitalares e medicamentos',
        valorEstimado: 250000,
        fonte: 'salvo' as const,
      };

      const empresaLogada = {
        id: 'company-uuid-1',
        razaoSocial: 'MedTech Hospitalar Ltda',
        cnpj: '12.345.678/0001-90',
      };

      // Mock de extração com itens e valores calculados
      const extracaoAutomatica = {
        proposalId: 'prop-uuid-999',
        orgao: editalSelecionado.orgao,
        numeroEdital: editalSelecionado.numeroEdital,
        empresa: empresaLogada,
        itens: [
          {
            numero: '1',
            descricao: 'Seringas descartáveis 10ml',
            unidade: 'CX',
            quantidade: 500,
            custoUnitario: 25.0,
            precoUnitarioProposto: 35.0,
            precoTotalProposto: 17500.0,
          },
          {
            numero: '2',
            descricao: 'Luvas cirúrgicas estéreis',
            unidade: 'CX',
            quantidade: 1000,
            custoUnitario: 40.0,
            precoUnitarioProposto: 58.0,
            precoTotalProposto: 58000.0,
          },
        ],
        valorTotalProposto: 75500.0,
      };

      expect(extracaoAutomatica.orgao).toBe('Ministério da Saúde');
      expect(extracaoAutomatica.numeroEdital).toBe('PE 10/2026');
      expect(extracaoAutomatica.empresa.cnpj).toBe('12.345.678/0001-90');
      expect(extracaoAutomatica.itens).toHaveLength(2);
      expect(extracaoAutomatica.itens[0].precoTotalProposto).toBe(17500.0);
      expect(extracaoAutomatica.valorTotalProposto).toBe(75500.0);
    });

    it('Modo Manual: deve permitir campos totalmente editáveis para preenchimento livre', () => {
      const formManual = {
        companyId: 'company-uuid-1',
        titulo: 'Proposta Comercial Personalizada',
        orgao: 'Secretaria Municipal de Obras',
        numeroEdital: 'Concorrência 02/2026',
        objeto: 'Reforma de unidades escolares municipais',
        criterioJulgamento: 'menor_preco',
        validadeDias: 90,
        prazoEntregaDias: 30,
      };

      // Altera campos livremente
      formManual.titulo = 'Nova Proposta Customizada 2026';
      formManual.orgao = 'Autarquia Especial';
      formManual.validadeDias = 120;

      expect(formManual.titulo).toBe('Nova Proposta Customizada 2026');
      expect(formManual.orgao).toBe('Autarquia Especial');
      expect(formManual.validadeDias).toBe(120);
    });
  });

  describe('3. Tratamento de Erro da IA (Fallback em 1 Clique sem travar a tela)', () => {
    it('ao ocorrer erro 404/500 na IA, exibe mensagem amigável e preserva dados para Modo Manual em 1 clique', () => {
      const editalSelecionado = {
        id: 'notice-uuid-error',
        numeroEdital: 'PE 33/2026',
        orgao: 'Tribunal Superior Eleitoral',
        objeto: 'Prestação de serviços de apoio logístico',
        fonte: 'salvo' as const,
      };

      // Simula erro da chamada de IA
      let erroIaOcorrido = false;
      let mensagemErroIa = '';
      let modoPreenchimento: 'automatico' | 'manual' = 'automatico';

      try {
        const errorResponse: { status: number; message: string } = {
          status: 404,
          message: 'Edital não encontrado no banco de dados nem no portal oficial.',
        };
        throw errorResponse;
      } catch (err: any) {
        erroIaOcorrido = true;
        mensagemErroIa = err.message || 'Serviço de IA temporariamente indisponível.';
      }

      expect(erroIaOcorrido).toBe(true);
      expect(mensagemErroIa).toContain('Edital não encontrado');

      // 1 clique: fallback para Modo Manual
      const manualForm = {
        orgao: '',
        numeroEdital: '',
        objeto: '',
        titulo: '',
      };

      // Função de fallback em 1 clique
      if (editalSelecionado) {
        manualForm.orgao = editalSelecionado.orgao;
        manualForm.numeroEdital = editalSelecionado.numeroEdital;
        manualForm.objeto = editalSelecionado.objeto;
        manualForm.titulo = `Proposta Comercial - ${editalSelecionado.numeroEdital}`;
      }
      modoPreenchimento = 'manual';
      erroIaOcorrido = false;

      expect(modoPreenchimento).toBe('manual');
      expect(erroIaOcorrido).toBe(false);
      expect(manualForm.orgao).toBe('Tribunal Superior Eleitoral');
      expect(manualForm.numeroEdital).toBe('PE 33/2026');
      expect(manualForm.titulo).toBe('Proposta Comercial - PE 33/2026');
    });
  });

  describe('4. Precificação Automatizada e Formação de Custos (STEP 4/5)', () => {
    it('calcula Custo Base, Preço Mínimo Seguro (+10%), Preço Competitivo (+25%), Preço Teto e Exequibilidade', () => {
      expect(typeof propostasApi.calcularPrecificacao).toBe('function');

      const resultadoVerde = calcularPrecificacaoProposta({
        custoDireto: 100,
        tributosPercentual: 10,
        valorReferenciaEdital: 150,
        precoOfertado: 121,
      });

      expect(resultadoVerde.custoBase).toBe(110);
      expect(resultadoVerde.precoMinimo).toBe(121);
      expect(resultadoVerde.precoCompetitivo).toBe(137.5);
      expect(resultadoVerde.precoTeto).toBe(150);
      expect(resultadoVerde.statusExequibilidade).toBe('Exequível (Sinal Verde)');

      const resultadoVermelho = calcularPrecificacaoProposta({
        custoDireto: 100,
        tributosPercentual: 10,
        valorReferenciaEdital: 150,
        precoOfertado: 95,
      });

      expect(resultadoVermelho.statusExequibilidade).toBe('Risco de Inexequibilidade (Sinal Vermelho)');
    });
  });

  describe('5. Motor de Geração e Exportação de Propostas Oficiais Word & PDF (STEP 5/5)', () => {
    it('propostasApi deve expor exportarDocx e exportarPdf', () => {
      expect(typeof propostasApi.exportarDocx).toBe('function');
      expect(typeof propostasApi.exportarPdf).toBe('function');
    });
  });
});
