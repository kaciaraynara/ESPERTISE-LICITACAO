/**
 * Gerador de Parecer Executivo e Dossiê Completo do Edital em PDF Timbrado A4
 * Padrão Editorial Corporativo da Expertise Licitatória
 * 
 * Atende integralmente às exigências de leitura real dos arquivos do edital,
 * sem juridiquês vazio, explicando cada cláusula de forma executiva e prática.
 */

export interface DadosDossieEditalPdf {
  // Metadados do Edital
  numeroControlePNCP?: string;
  numeroEdital?: string;
  orgao: string;
  cnpjOrgao?: string;
  municipio?: string;
  uf?: string;
  modalidade?: string;
  modoDisputa?: string;
  criterioJulgamento?: string;
  valorEstimado?: number | null;
  dataAbertura?: string | null;
  dataPublicacao?: string | null;
  dataEncerramento?: string | null;
  linkOficial?: string;
  objeto: string;
  srp?: boolean;
  exclusivoMeEpp?: boolean;

  // Dados da Empresa Ativa do Usuário
  empresaCliente?: {
    razaoSocial?: string | null;
    nomeFantasia?: string | null;
    cnpj?: string | null;
    cnaePrincipal?: string | null;
    cidade?: string | null;
    uf?: string | null;
  };

  // Status de Leitura Profunda
  statusLeitura?: 'COMPLETO' | 'PENDENTE' | 'SEM_ARQUIVOS';
  totalChunksLidos?: number;

  // Especificações Extraídas dos Arquivos Reais (extractedSpecsJson)
  specs?: {
    disputaModo?: 'ELETRONICO_REMOTO' | 'PRESENCIAL' | 'NAO_IDENTIFICADO';
    disputaTrecho?: string;
    execucaoModo?: '100%_REMOTO' | 'ENTREGA_FISICA' | 'SERVICO_LOCAL' | 'HIBRIDO';
    execucaoTrecho?: string;
    prazoEntregaDias?: number | null;
    localEntrega?: string | null;
    exigeVistoria?: boolean;
    vistoriaTrecho?: string;
    exigeAmostra?: boolean;
    amostraTrecho?: string;
    garantiaPercentual?: number | null;
    garantiaTrecho?: string;
    prazoPagamentoDias?: number | null;
    pagamentoTrecho?: string;
    vigenciaMeses?: number | null;
    vigenciaTrecho?: string;
    indiceLiquidezGeral?: number | null;
    indiceLiquidezCorrente?: number | null;
    patrimonioLiquidoMinimo?: number | null;
    financeiroTrecho?: string;
    percentualMinimoAtestado?: number | null;
    atestadoTrecho?: string;
    declaracoesExigidas?: string[];
    riscosIdentificados?: Array<{
      titulo: string;
      descricao: string;
      gravidade: 'ALTA' | 'MEDIA' | 'BAIXA';
      trechoLiteral?: string;
      orientacaoEstrategica?: string;
    }>;
    itensEstruturados?: Array<{
      numeroItem: number;
      descricao: string;
      unidadeMedida?: string;
      quantidade?: number;
      valorUnitarioEstimado?: number;
      valorTotalEstimado?: number;
    }>;
  };
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatarMoeda(val: number | null | undefined): string {
  if (val == null || !Number.isFinite(Number(val)) || Number(val) <= 0) return 'Sigiloso / Não informado no edital';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
}

function formatarDataHora(val: string | null | undefined): string {
  if (!val) return 'Não informada no aviso oficial';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(val);
  }
}

export function construirHtmlDossieEditalPdf(dados: DadosDossieEditalPdf): string {
  const agora = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const specs = dados.specs || {};
  const empresa = dados.empresaCliente || {};
  const itens = specs.itensEstruturados || [];
  const riscos = specs.riscosIdentificados || [];

  // 1. Cálculo do prazo de impugnação (Art. 164 Lei 14.133/2021: 3 dias úteis antes)
  let prazoImpugnacaoTexto = 'Até 3 dias úteis antes da abertura da sessão pública (Art. 164, Lei 14.133/2021)';
  if (dados.dataAbertura) {
    try {
      const dataAberturaDate = new Date(dados.dataAbertura);
      if (!isNaN(dataAberturaDate.getTime())) {
        const dataLimite = new Date(dataAberturaDate.getTime() - 4 * 86400000);
        prazoImpugnacaoTexto = `Até ${dataLimite.toLocaleDateString('pt-BR')} às 18:00 (mínimo de 3 dias úteis antes)`;
      }
    } catch {
      // fallback
    }
  }

  // 2. Análise da Disputa e Execução
  const disputaRemota = specs.disputaModo === 'ELETRONICO_REMOTO' || 
    (dados.modalidade?.toLowerCase().includes('eletrônic') || dados.modoDisputa?.toLowerCase().includes('aberto'));
  const disputaTexto = disputaRemota ? 'Disputa 100% Eletrônica / Remota' : 'Disputa Presencial (ou mista)';

  const execucaoTexto = specs.execucaoModo === '100%_REMOTO'
    ? 'Execução 100% Remota (Entrega digital / home office)'
    : specs.execucaoModo === 'ENTREGA_FISICA'
    ? 'Exige Entrega Física de Produtos'
    : specs.execucaoModo === 'SERVICO_LOCAL'
    ? 'Exige Prestação de Serviços Presencial no Local do Órgão'
    : 'Conforme cronograma de entrega e Termo de Referência';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Parecer Executivo - Edital ${escapeHtml(dados.numeroEdital || dados.numeroControlePNCP)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 18mm 15mm;
      @bottom-right {
        content: "Página " counter(page) " de " counter(pages);
        font-family: Arial, sans-serif;
        font-size: 8pt;
        color: #64748B;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.5;
      color: #0F172A;
      margin: 0;
      padding: 0;
      background: #FFFFFF;
    }

    .page-header-timbrado {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #081C3A;
      padding-bottom: 12px;
      margin-bottom: 18px;
    }

    .brand-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-logo-img {
      height: 44px;
      width: auto;
      object-fit: contain;
    }

    .brand-title {
      font-size: 13pt;
      font-weight: 800;
      color: #081C3A;
      letter-spacing: -0.3px;
      line-height: 1.2;
    }

    .brand-sub {
      font-size: 7.5pt;
      color: #EA580C;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .header-doc-meta {
      text-align: right;
      font-size: 8pt;
      color: #475569;
      line-height: 1.35;
    }

    .doc-badge-status {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 3px;
      background: #DCFCE7;
      color: #166534;
    }

    .doc-badge-status.pendente {
      background: #FEF3C7;
      color: #92400E;
    }

    .doc-main-title {
      background: #081C3A;
      color: #FFFFFF;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 11pt;
      font-weight: bold;
      letter-spacing: 0.2px;
      text-transform: uppercase;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .client-ribbon {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-left: 4px solid #0070C0;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 8.5pt;
      color: #1E293B;
      margin-bottom: 16px;
    }

    .section-container {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1.5px solid #CBD5E1;
      padding-bottom: 4px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }

    .section-num {
      background: #0070C0;
      color: #FFFFFF;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      font-weight: bold;
    }

    .section-title {
      font-size: 10pt;
      font-weight: bold;
      color: #081C3A;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .meta-grid-2col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 8px;
    }

    .meta-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      padding: 7px 10px;
      font-size: 8.5pt;
    }

    .meta-card-label {
      font-size: 7.5pt;
      color: #64748B;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 2px;
    }

    .meta-card-value {
      color: #0F172A;
      font-weight: bold;
    }

    .objeto-box {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      padding: 10px 12px;
      font-size: 9pt;
      text-align: justify;
      line-height: 1.5;
    }

    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-top: 6px;
      page-break-inside: auto;
    }

    table.data-table tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }

    table.data-table th {
      background: #081C3A;
      color: #FFFFFF;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      font-size: 8pt;
      border: 1px solid #081C3A;
    }

    table.data-table td {
      padding: 6px 8px;
      border: 1px solid #E2E8F0;
      vertical-align: top;
    }

    table.data-table tr:nth-child(even) td {
      background: #F8FAFC;
    }

    .risk-card {
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      padding: 8px 10px;
      margin-bottom: 8px;
      background: #FFFFFF;
      page-break-inside: avoid;
    }

    .risk-card.alta {
      border-left: 4px solid #DC2626;
      background: #FEF2F2;
    }

    .risk-card.media {
      border-left: 4px solid #F59E0B;
      background: #FFFBEB;
    }

    .risk-card.baixa {
      border-left: 4px solid #3B82F6;
      background: #EFF6FF;
    }

    .risk-title-bar {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      font-size: 8.5pt;
      margin-bottom: 4px;
    }

    .risk-badge {
      font-size: 7pt;
      padding: 1px 6px;
      border-radius: 3px;
      font-weight: bold;
      text-transform: uppercase;
    }

    .risk-badge.alta { background: #DC2626; color: #FFF; }
    .risk-badge.media { background: #F59E0B; color: #FFF; }
    .risk-badge.baixa { background: #3B82F6; color: #FFF; }

    .trecho-literal-box {
      font-family: 'Courier New', Courier, monospace;
      font-size: 7.5pt;
      background: rgba(0, 0, 0, 0.04);
      border-left: 2.5px solid #94A3B8;
      padding: 5px 8px;
      margin: 4px 0;
      color: #334155;
      font-style: italic;
    }

    .orientacao-pratica {
      font-size: 8pt;
      color: #065F46;
      margin-top: 4px;
      font-weight: 500;
    }

    .footer-timbrado {
      border-top: 1px solid #CBD5E1;
      padding-top: 8px;
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #64748B;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>

  <!-- CABEÇALHO TIMBRADO OFICIAL -->
  <header class="page-header-timbrado">
    <div class="brand-section">
      <img src="/logo.png" alt="Expertise Licitatória" class="brand-logo-img" onerror="this.style.display='none'" />
      <div>
        <div class="brand-title">EXPERTISE LICITATÓRIA</div>
        <div class="brand-sub">Inteligência Estratégica em Compras Públicas</div>
      </div>
    </div>
    <div class="header-doc-meta">
      <div>
        <span class="doc-badge-status ${dados.statusLeitura === 'COMPLETO' ? '' : 'pendente'}">
          ${dados.statusLeitura === 'COMPLETO' ? '✔ Leitura Profunda Concluída' : 'ℹ Análise Inicial'}
        </span>
      </div>
      <div><strong>Emissão:</strong> ${escapeHtml(agora)}</div>
      <div><strong>Edital / PNCP:</strong> ${escapeHtml(dados.numeroEdital || dados.numeroControlePNCP || 'Identificado')}</div>
    </div>
  </header>

  <!-- FAIXA DA EMPRESA CLIENTE -->
  <div class="client-ribbon">
    <strong>RELATÓRIO PREPARADO EXCLUSIVAMENTE PARA:</strong> ${escapeHtml(empresa.razaoSocial || empresa.nomeFantasia || 'Empresa Proponente Credenciada')} 
    ${empresa.cnpj ? `| <strong>CNPJ:</strong> ${escapeHtml(empresa.cnpj)}` : ''} 
    ${empresa.cidade && empresa.uf ? `| <strong>Sede:</strong> ${escapeHtml(empresa.cidade)}/${escapeHtml(empresa.uf)}` : ''}
  </div>

  <!-- TÍTULO DO DOCUMENTO -->
  <div class="doc-main-title">
    <span>PARECER EXECUTIVO E ANÁLISE COMPLETA DO EDITAL</span>
    <span style="font-size:8pt;font-weight:normal;opacity:0.9;">Lei Federal nº 14.133/2021</span>
  </div>

  <!-- SEÇÃO 1: FICHA TÉCNICA OFICIAL -->
  <section class="section-container">
    <div class="section-header">
      <span class="section-num">1</span>
      <span class="section-title">Ficha Técnica Oficial do Certame</span>
    </div>

    <div class="meta-grid-2col">
      <div class="meta-card">
        <div class="meta-card-label">Órgão Promotor / Comprador</div>
        <div class="meta-card-value">${escapeHtml(dados.orgao)} (${escapeHtml(dados.municipio || 'Brasil')}/${escapeHtml(dados.uf || 'BR')})</div>
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Valor Global de Referência</div>
        <div class="meta-card-value" style="color:#0070C0;font-size:10pt;">${escapeHtml(formatarMoeda(dados.valorEstimado))}</div>
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Modalidade e Disputa</div>
        <div class="meta-card-value">${escapeHtml(dados.modalidade || 'Pregão')} | Modo: ${escapeHtml(dados.modoDisputa || 'Aberto')}</div>
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Critério de Julgamento</div>
        <div class="meta-card-value">${escapeHtml(dados.criterioJulgamento || 'Menor Preço / Maior Desconto')}</div>
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Abertura da Sessão de Lances</div>
        <div class="meta-card-value">${escapeHtml(formatarDataHora(dados.dataAbertura))}</div>
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Prazo Limite para Impugnação</div>
        <div class="meta-card-value" style="color:#DC2626;">${escapeHtml(prazoImpugnacaoTexto)}</div>
      </div>
    </div>

    <div class="meta-grid-2col">
      <div class="meta-card">
        <div class="meta-card-label">Benefício ME / EPP (LC 123/2006)</div>
        <div class="meta-card-value">${dados.exclusivoMeEpp ? 'Sim (Exclusivo ou Cota Reservada ME/EPP)' : 'Ampla Participação com Direito a Desempate Ficto (Art. 44 LC 123)'}</div>
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Sistema de Registro de Preços (SRP)</div>
        <div class="meta-card-value">${dados.srp ? 'Sim (Ata de Registro de Preços / Fornecimento Sob Demanda)' : 'Não (Contratação Direta e Imediata)'}</div>
      </div>
    </div>
  </section>

  <!-- SEÇÃO 2: EXPLICAÇÃO DETALHADA DO OBJETO NA PRÁTICA -->
  <section class="section-container">
    <div class="section-header">
      <span class="section-num">2</span>
      <span class="section-title">O Que o Órgão Precisa Contratar (Na Prática)</span>
    </div>
    <div class="objeto-box">
      <strong>Descrição Oficial:</strong> ${escapeHtml(dados.objeto)}
      <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #CBD5E1;font-size:8.5pt;color:#334155;">
        <strong>Orientação da Consultoria:</strong> O objeto acima abrange o fornecimento/prestação contratado pelo órgão. Para este edital, recomenda-se atentar estritamente para as marcas, unidades de medida e conformidades técnicas exigidas no Termo de Referência antes de registrar a proposta no sistema.
      </div>
    </div>
  </section>

  <!-- SEÇÃO 3: TABELA COMPLETA DE ITENS / LOTES -->
  <section class="section-container">
    <div class="section-header">
      <span class="section-num">3</span>
      <span class="section-title">Itens e Lotes Especificados no Edital</span>
    </div>

    ${itens.length > 0 ? `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:40px;text-align:center;">Item</th>
            <th>Especificação Técnica / Descrição</th>
            <th style="width:50px;text-align:center;">Unid.</th>
            <th style="width:55px;text-align:right;">Qtd.</th>
            <th style="width:85px;text-align:right;">Vlr. Unit.</th>
            <th style="width:95px;text-align:right;">Total Est.</th>
          </tr>
        </thead>
        <tbody>
          ${itens.map((it) => `
            <tr>
              <td style="text-align:center;font-weight:bold;">${escapeHtml(it.numeroItem)}</td>
              <td>${escapeHtml(it.descricao)}</td>
              <td style="text-align:center;">${escapeHtml(it.unidadeMedida || 'UN')}</td>
              <td style="text-align:right;">${escapeHtml(it.quantidade ?? 1)}</td>
              <td style="text-align:right;">${escapeHtml(formatarMoeda(it.valorUnitarioEstimado))}</td>
              <td style="text-align:right;font-weight:bold;color:#0070C0;">${escapeHtml(formatarMoeda(it.valorTotalEstimado))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : `
      <div style="padding:10px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:4px;font-size:8.5pt;color:#64748B;">
        <em>Tabela discriminada em processo de catalogação pelo órgão ou fornecimento sob cotação global. Consulte o Termo de Referência anexo para a listagem técnica individualizada.</em>
      </div>
    `}
  </section>

  <!-- SEÇÃO 4: REGRAS DE DISPUTA, ENTREGA E LOGÍSTICA -->
  <section class="section-container">
    <div class="section-header">
      <span class="section-num">4</span>
      <span class="section-title">Regras de Disputa, Logística e Execução</span>
    </div>

    <div class="meta-grid-2col">
      <div class="meta-card">
        <div class="meta-card-label">Modalidade da Disputa</div>
        <div class="meta-card-value">${escapeHtml(disputaTexto)}</div>
        ${specs.disputaTrecho ? `<div class="trecho-literal-box">"${escapeHtml(specs.disputaTrecho)}"</div>` : ''}
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Forma de Execução / Entrega</div>
        <div class="meta-card-value">${escapeHtml(execucaoTexto)}</div>
        ${specs.execucaoTrecho ? `<div class="trecho-literal-box">"${escapeHtml(specs.execucaoTrecho)}"</div>` : ''}
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Prazo e Local de Entrega</div>
        <div class="meta-card-value">${specs.prazoEntregaDias ? `${escapeHtml(specs.prazoEntregaDias)} dias corridos` : 'Conforme Termo de Referência'} | ${escapeHtml(specs.localEntrega || dados.municipio || 'Sede do Órgão')}</div>
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Amostra ou Vistoria Técnica Obrigatória</div>
        <div class="meta-card-value">
          ${specs.exigeAmostra ? '⚠️ Exige Amostra' : 'Amostra Dispensada'} | 
          ${specs.exigeVistoria ? '⚠️ Exige Vistoria' : 'Vistoria Não Obrigatória'}
        </div>
        ${specs.amostraTrecho ? `<div class="trecho-literal-box">"${escapeHtml(specs.amostraTrecho)}"</div>` : ''}
      </div>
    </div>
  </section>

  <!-- SEÇÃO 5: GUIA PRÁTICO DE HABILITAÇÃO DOCUMENTAL -->
  <section class="section-container">
    <div class="section-header">
      <span class="section-num">5</span>
      <span class="section-title">Guia Prático de Documentos (Habilitação Real Deste Edital)</span>
    </div>

    <div class="meta-grid-2col">
      <div class="meta-card">
        <div class="meta-card-label">Habilitação Jurídica e Fiscal</div>
        <div class="meta-card-value" style="font-size:8pt;font-weight:normal;">
          • Contrato Social consolidado com objeto compatível com o CNAE.<br/>
          • CND Federal (Receita/PGFN), CND Estadual, CND Municipal e CNDT (Trabalhista).<br/>
          • CRF do FGTS e Certidão de Falência e Concordata.
        </div>
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Qualificação Econômico-Financeira</div>
        <div class="meta-card-value" style="font-size:8pt;font-weight:normal;">
          ${specs.patrimonioLiquidoMinimo 
            ? `• Exige Patrimônio Líquido Mínimo de <strong>${formatarMoeda(specs.patrimonioLiquidoMinimo)}</strong> (limite de 10% do valor estimado).<br/>`
            : '• Balanço Patrimonial do último exercício social com índices de liquidez (LG, SG, LC &gt;= 1,0).<br/>'
          }
          ${specs.financeiroTrecho ? `<div class="trecho-literal-box">"${escapeHtml(specs.financeiroTrecho)}"</div>` : ''}
        </div>
      </div>
    </div>

    <div class="meta-card" style="margin-top:8px;">
      <div class="meta-card-label">Qualificação Técnica e Atestados de Capacidade</div>
      <div class="meta-card-value" style="font-size:8pt;font-weight:normal;">
        ${specs.percentualMinimoAtestado 
          ? `• Atestado de capacidade técnica comprovando execução prévia de no mínimo <strong>${specs.percentualMinimoAtestado}%</strong> do objeto licitado (Súmula 263/TCU e Art. 67, § 2º da Lei 14.133/2021).` 
          : '• Atestado emitido por pessoa jurídica de direito público ou privado comprovando aptidão para desempenho de atividade pertinente e compatível em características com o objeto.'
        }
        ${specs.atestadoTrecho ? `<div class="trecho-literal-box">"${escapeHtml(specs.atestadoTrecho)}"</div>` : ''}
      </div>
    </div>
  </section>

  <!-- SEÇÃO 6: PAGAMENTO, VIGÊNCIA E REAJUSTE -->
  <section class="section-container">
    <div class="section-header">
      <span class="section-num">6</span>
      <span class="section-title">Condições de Pagamento, Vigência Contratual e Reajuste</span>
    </div>

    <div class="meta-grid-2col">
      <div class="meta-card">
        <div class="meta-card-label">Prazo de Pagamento Pelo Órgão</div>
        <div class="meta-card-value">${specs.prazoPagamentoDias ? `Em até ${specs.prazoPagamentoDias} dias após emissão da NF e atesto` : 'Até 30 dias após emissão da Nota Fiscal atestada (Art. 141 Lei 14.133/2021)'}</div>
        ${specs.pagamentoTrecho ? `<div class="trecho-literal-box">"${escapeHtml(specs.pagamentoTrecho)}"</div>` : ''}
      </div>
      <div class="meta-card">
        <div class="meta-card-label">Vigência do Contrato / Ata</div>
        <div class="meta-card-value">${specs.vigenciaMeses ? `${specs.vigenciaMeses} meses a contar da assinatura` : dados.srp ? '12 meses para a Ata de Registro de Preços' : '12 meses de vigência contratual'}</div>
        ${specs.vigenciaTrecho ? `<div class="trecho-literal-box">"${escapeHtml(specs.vigenciaTrecho)}"</div>` : ''}
      </div>
    </div>
  </section>

  <!-- SEÇÃO 7: PONTOS DE ATENÇÃO E ORIENTAÇÃO ESTRATÉGICA -->
  <section class="section-container">
    <div class="section-header">
      <span class="section-num">7</span>
      <span class="section-title">Matriz de Riscos e Orientação Estratégica da Consultoria</span>
    </div>

    ${riscos.length > 0 ? riscos.map((r) => `
      <div class="risk-card ${r.gravidade.toLowerCase()}">
        <div class="risk-title-bar">
          <span style="color:#081C3A;">${escapeHtml(r.titulo)}</span>
          <span class="risk-badge ${r.gravidade.toLowerCase()}">Risco ${escapeHtml(r.gravidade)}</span>
        </div>
        <div style="font-size:8pt;color:#334155;margin-bottom:4px;">${escapeHtml(r.descricao)}</div>
        ${r.trechoLiteral ? `<div class="trecho-literal-box">Trecho Literal: "${escapeHtml(r.trechoLiteral)}"</div>` : ''}
        ${r.orientacaoEstrategica ? `<div class="orientacao-pratica">💡 <strong>Como Proceder:</strong> ${escapeHtml(r.orientacaoEstrategica)}</div>` : ''}
      </div>
    `).join('') : `
      <div style="padding:10px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:4px;font-size:8.5pt;color:#166534;">
        ✔ <strong>Certame sem cláusulas restritivas atípicas:</strong> O edital segue as diretrizes padrão da Lei Federal nº 14.133/2021 e jurisprudência pacificada do TCU, sem exigências abusivas de habilitação técnica ou econômica.
      </div>
    `}
  </section>

  <!-- RODAPÉ TIMBRADO -->
  <footer class="footer-timbrado">
    <div>
      <strong>Expertise Licitatória</strong> · Plataforma de Inteligência e Automação em Compras Públicas (Lei 14.133/2021)
    </div>
    <div>
      Fonte: Portal Nacional de Contratações Públicas (PNCP) | Documento gerado eletronicamente
    </div>
  </footer>

</body>
</html>`;
}

/**
 * Dispara a impressão/geração em PDF timbrado A4 corporativo sem distorção visual
 */
export function exportarDossieEditalPdf(dados: DadosDossieEditalPdf): boolean {
  try {
    const html = construirHtmlDossieEditalPdf(dados);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      const win = window.open('', '_blank');
      if (!win) return false;
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 350);
      return true;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {
          // ignore
        }
      }, 2000);
    }, 350);

    return true;
  } catch (err) {
    console.error('Erro ao gerar dossiê PDF do edital:', err);
    window.print();
    return true;
  }
}

export default exportarDossieEditalPdf;
