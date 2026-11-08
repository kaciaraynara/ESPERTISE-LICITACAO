import { describe, it, expect, vi } from 'vitest';
import {
  buildOfficialPncpPortalUrl,
  extractPncpParams,
  handleDownloadEdital,
} from '../utils/pncp';
import modalContent from '../components/ResumoEstrategicoModal.tsx?raw';
import radarContent from '../pages/LicitacoesPage.tsx?raw';

describe('PNCP Resiliência — URL Auditável, Fallback 503 e Qualidade de Resumo', () => {
  const editalExemplo = {
    id: 'edital-123',
    objeto: 'Aquisição de computadores e equipamentos de tecnologia para a rede escolar',
    orgao: 'Ministério da Educação - MEC',
    cnpjOrgao: '00394452000103',
    numeroControlePNCP: '00394452000103-1-000274/2026',
    anoCompra: 2026,
    sequencialCompra: 274,
    valorEstimado: 850000.0,
    modalidade: 'Pregão Eletrônico',
    modoDisputa: 'Aberto',
  };

  it('1. A URL gerada para o portal oficial bate exatamente com o padrão https://pncp.gov.br/app/editais/{cnpj}/{ano}/{sequencial}', () => {
    const url1 = buildOfficialPncpPortalUrl(editalExemplo);
    expect(url1).toBe('https://pncp.gov.br/app/editais/00394452000103/2026/274');

    // Teste com objeto extraindo diretamente de numeroControlePNCP
    const editalPorControle = {
      id: 'pncp-uuid-999',
      numeroControlePNCP: '77123456000188-1-000150/2026',
    };
    const url2 = buildOfficialPncpPortalUrl(editalPorControle);
    expect(url2).toBe('https://pncp.gov.br/app/editais/77123456000188/2026/150');

    // Regex estrita do padrão oficial exigido
    const regexOficial = /^https:\/\/pncp\.gov\.br\/app\/editais\/\d{14}\/\d{4}\/\d+$/;
    expect(url1).toMatch(regexOficial);
    expect(url2).toMatch(regexOficial);

    const params = extractPncpParams(editalExemplo);
    expect(params).toEqual({
      cnpj: '00394452000103',
      anoCompra: 2026,
      sequencialCompra: 274,
    });
  });

  it('2. Elimina erro 503 no download: abre direto a URL pública oficial do PNCP em nova aba com noopener,noreferrer', async () => {
    const mockOpen = vi.fn();

    // Caso de teste obrigatório da especificação:
    // CNPJ: 06742480000142, Ano: 2026, Sequencial: 115
    const editalTesteObrigatorio = {
      id: 'edital-teste-503',
      cnpjOrgao: '06.742.480/0001-42', // Com pontuação para validar regex de limpeza
      anoCompra: 2026,
      sequencialCompra: 115,
      objeto: 'Aquisição de equipamentos de TI e infraestrutura',
    };

    const urlRetornada = await handleDownloadEdital(editalTesteObrigatorio, {
      openFn: mockOpen,
    });

    // 1. O clique DEVE abrir https://pncp.gov.br/app/editais/06742480000142/2026/115
    expect(urlRetornada).toBe('https://pncp.gov.br/app/editais/06742480000142/2026/115');
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen).toHaveBeenCalledWith(
      'https://pncp.gov.br/app/editais/06742480000142/2026/115',
      '_blank',
      'noopener,noreferrer',
    );

    // 2. Garante que NUNCA redireciona para o endpoint /arquivos/1 da API governamental que causa 503
    expect(urlRetornada).not.toContain('/arquivos/1');
    expect(urlRetornada).not.toContain('/api/pncp/');
    expect(urlRetornada).not.toContain('undefined');
  });

  it('3. Garante 0 ocorrências de "Não informado no edital" replicadas consecutivamente no modal de resumo', () => {
    // 1. Garante que os 3 blocos cinzas repetitivos foram excluídos
    expect(modalContent).not.toContain('Balanço Patrimonial');
    expect(modalContent).not.toContain('Atestados de Capacidade');
    expect(modalContent).not.toContain('Certidões Específicas');

    // 2. Garante que o texto de auditoria oficial exigido está presente no rodapé
    expect(modalContent).toContain(
      'Dados verificados e sincronizados via PNCP / Governo Federal. Acesse a fonte oficial para auditoria completa dos autos.',
    );

    // 3. Garante que o botão oficial com classe btn-link-pncp está presente
    expect(modalContent).toContain('btn-link-pncp');
    expect(modalContent).toContain('Ver no Portal Oficial do PNCP ↗');

    // 4. Garante que a mensagem de itens ausentes é profissional e corporativa
    expect(modalContent).toContain(
      'Valores globais consolidados no Termo de Referência oficial',
    );

    // 5. Garante zero repetições consecutivas de "Não informado no edital"
    const repeticoesConsecutivas = (modalContent.match(/Não informado no edital[\s\S]{0,100}Não informado no edital/g) || []);
    expect(repeticoesConsecutivas.length).toBe(0);
  });

  it('4. Garante que o Radar de Editais exibe o link verídico de auditoria direta no PNCP', () => {
    expect(radarContent).toContain('btn-link-pncp');
    expect(radarContent).toContain('Ver no Portal Oficial do PNCP ↗');
  });

  it('5. Garante que os botões com classe btn-download-edital estão presentes na tabela e modal com a ação de acessar o edital oficial no PNCP sem erro 503', () => {
    // Tabela do Radar
    expect(radarContent).toContain('btn-download-edital');
    expect(radarContent).toContain('Acessar Edital Oficial no PNCP ↗');

    // Modal de Resumo Estratégico
    expect(modalContent).toContain('btn-download-edital');
    expect(modalContent).toContain('Acessar Edital Oficial no PNCP ↗');

    // NUNCA conter links diretos para o endpoint de anexo da API governamental que dispara 503
    expect(radarContent).not.toContain('/arquivos/1');
    expect(modalContent).not.toContain('/arquivos/1');
  });
});
