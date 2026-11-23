/**
 * Gerador Oficial de Peças Jurídicas em PDF Timbrado (Lei Federal nº 14.133/2021)
 * Impugnações (Art. 164), Pedidos de Esclarecimento, Recursos e Contrarrazões (Art. 165).
 */

export const PROMPT_PADRAO_IMPUGNACAO_COMPLETA = `Você é a Luli, especialista jurídica sênior em licitações públicas sob a Lei Federal nº 14.133/2021 e jurisprudência do TCU e STF.
Elabore uma peça formal completa de IMPUGNAÇÃO AO EDITAL E PEDIDO DE ESCLARECIMENTO estruturada rigorosamente nas 7 seções abaixo, utilizando linguagem humana, clara, firme e técnica, sem asteriscos soltos (*), sem travessões excessivos e sem nenhum placeholder entre colchetes:
- ENDEREÇAMENTO FORMAL AO(À) PREGOEIRO(A) / AGENTE DE CONTRATAÇÃO E ÓRGÃO PROMOTOR
- I. CONSIDERAÇÕES INICIAIS E QUALIFICAÇÃO DA IMPUGNANTE
- II. DA TEMPESTIVIDADE (Art. 164, caput e parágrafo único, c/c Art. 183 da Lei Federal nº 14.133/2021: protocolo em até 3 dias úteis antes da data de abertura do certame e resposta obrigatória no prazo de até 3 dias úteis)
- III. SÍNTESE DOS FATOS E DAS EXIGÊNCIAS RESTRITIVAS DO EDITAL
- IV. PEDIDOS DE ESCLARECIMENTO TÉCNICO E OPERACIONAL
- V. DO MÉRITO E DA IMPUGNAÇÃO ITEM A ITEM (Fundamentação expressa nos Arts. 5º, 9º, 11, 40, 59, 63, 64, 67 e 69 da Lei 14.133/2021 e Jurisprudência consolidada do TCU: Súmula 247/TCU sobre adjudicação por item, Súmula 262/TCU sobre exequibilidade relativa, Súmula 263/TCU sobre limite de 50% para atestados de capacidade técnica, Súmula 270/TCU sobre vedação de marca específica sem justificativa técnica e Acórdão 1211/2021-TCU-Plenário sobre formalismo moderado e diligência)
- VI. DO PODER-DEVER DE AUTOTUTELA ADMINISTRATIVA (Súmulas 346 e 473 do Supremo Tribunal Federal - STF)
- VII. DOS PEDIDOS, REPUBLICAÇÃO DO EDITAL (Art. 55, § 1º da Lei 14.133/2021) E FECHO COM ASSINATURA`;

export const PROMPT_PADRAO_CONTRARRAZOES_RECURSO = `Você é a Luli, especialista jurídica sênior em licitações públicas sob a Lei Federal nº 14.133/2021 e jurisprudência do TCU.
Elabore uma peça formal completa de RECURSO ADMINISTRATIVO OU CONTRARRAZÕES RECURSAIS (Art. 165 da Lei Federal nº 14.133/2021) estruturada rigorosamente nas 4 seções abaixo, com linguagem humana, direta e técnica, sem asteriscos soltos (*) e sem placeholders vazios:
- 1. SÍNTESE FÁTICA, TEMPESTIVIDADE (3 dias úteis conforme Art. 165, inciso I e § 4º c/c Art. 183 da Lei 14.133/2021) E EFEITO SUSPENSIVO AUTOMÁTICO (Art. 168 da Lei 14.133/2021)
- 2. DO PRINCÍPIO DA VINCULAÇÃO AO INSTRUMENTO CONVOCATÓRIO, JULGAMENTO OBJETIVO E FORMALISMO MODERADO (Art. 5º e Art. 64 da Lei 14.133/2021 e Acórdão 1211/2021-TCU-Plenário)
- 3. DO MÉRITO PONTO A PONTO (Aplicação da Súmula 263/TCU e Art. 67, § 2º para atestados técnicos limitados a 50%; Súmula 289/TCU e Art. 69, § 5º para índices contábeis e liquidez; Súmula 262/TCU e Art. 59, § 2º para diligência de exequibilidade; e Arts. 155 a 168 da Lei 14.133/2021)
- 4. DOS PEDIDOS (Juízo de Retratação em 3 dias úteis pelo Pregoeiro/Agente de Contratação ou remessa à Autoridade Superior para decisão em até 10 dias úteis conforme Art. 165, § 2º da Lei 14.133/2021)`;

export interface DadosPecaJuridicaPdf {
  tipoPeca: 'IMPUGNAÇÃO AO EDITAL' | 'RECURSO ADMINISTRATIVO' | 'CONTRARRAZÕES DE RECURSO' | 'PARECER JURÍDICO';
  orgao?: string;
  modalidade?: string;
  numeroEdital?: string;
  objeto?: string;
  empresaNome?: string;
  empresaCnpj?: string;
  empresaEndereco?: string;
  representanteLegal?: string;
  conteudo: string;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatarCorpoJuridicoHtml(texto: string): string {
  const limpo = String(texto || '')
    .replace(/\r\n/g, '\n')
    .replace(/\*{3,}/g, '**')
    .trim();

  return limpo
    .split('\n')
    .map((rawLine) => {
      const line = rawLine.trim();
      if (!line) return '<div style="height:8px;"></div>';

      if (/^#{1,3}\s+/.test(line) || /^(?:[IVX]+\.|[1-7]\.)\s+[A-ZÀ-Ú\s]{4,}/.test(line)) {
        const heading = line.replace(/^#{1,3}\s+/, '').replace(/\*\*/g, '');
        return `<h2 style="font-family:Arial,sans-serif;font-size:10.5pt;font-weight:bold;color:#081C3A;text-transform:uppercase;border-left:3.5px solid #EA580C;padding-left:8px;margin:14px 0 6px 0;page-break-after:avoid;">${escapeHtml(heading)}</h2>`;
      }

      const formattedInline = escapeHtml(line)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/^\*\s+/, '• ');

      return `<p style="margin:0 0 6px 0;text-align:justify;line-height:1.55;">${formattedInline}</p>`;
    })
    .join('\n');
}

export function construirHtmlPecaJuridicaPdf(dados: DadosPecaJuridicaPdf): string {
  const empresa = dados.empresaNome || 'Empresa Licitante Proponente';
  const cnpj = dados.empresaCnpj || 'Conforme cadastro oficial';
  const endereco = dados.empresaEndereco || 'Sede Administrativa da Empresa';
  const representante = dados.representanteLegal || 'Representante Legal Constituído';
  const orgao = dados.orgao || 'Administração Pública Licitante';
  const numeroEdital = dados.numeroEdital || 'Edital Oficial';
  const modalidade = dados.modalidade || 'Pregão Eletrônico (Lei nº 14.133/2021)';
  const objeto = dados.objeto || 'Conforme especificado no instrumento convocatório';
  const dataExtenso = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(dados.tipoPeca)} - ${escapeHtml(numeroEdital)}</title>
  <style>
    @page { size: A4 portrait; margin: 18mm; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 10.5pt;
      color: #0F172A;
      margin: 0;
      padding: 0;
      line-height: 1.55;
    }
    .header-timbrado {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #081C3A;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .empresa-titulo {
      font-family: Arial, sans-serif;
      font-size: 12.5pt;
      font-weight: 800;
      color: #081C3A;
      text-transform: uppercase;
    }
    .empresa-sub {
      font-family: Arial, sans-serif;
      font-size: 8.5pt;
      color: #475569;
      margin-top: 2px;
    }
    .badge-peca {
      background: #081C3A;
      color: #FFFFFF;
      font-family: Arial, sans-serif;
      font-size: 8.5pt;
      font-weight: bold;
      padding: 6px 12px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .quadro-processo {
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
      font-family: Arial, sans-serif;
      font-size: 9pt;
    }
    .assinatura-box {
      margin-top: 32px;
      text-align: center;
      page-break-inside: avoid;
      font-family: Arial, sans-serif;
      font-size: 9.5pt;
    }
    .linha-assinatura {
      width: 300px;
      border-top: 1px solid #0F172A;
      margin: 0 auto 6px auto;
    }
  </style>
</head>
<body>
  <div class="header-timbrado">
    <div>
      <div class="empresa-titulo">${escapeHtml(empresa)}</div>
      <div class="empresa-sub">CNPJ: ${escapeHtml(cnpj)} | Endereço: ${escapeHtml(endereco)}</div>
      <div class="empresa-sub">Departamento Jurídico & Licitações Públicas — Lei Federal nº 14.133/2021</div>
    </div>
    <div class="badge-peca">${escapeHtml(dados.tipoPeca)}</div>
  </div>

  <div class="quadro-processo">
    <div><strong>ÓRGÃO / ENTIDADE LICITANTE:</strong> ${escapeHtml(orgao)}</div>
    <div style="margin-top:3px;"><strong>CERTAME / PROCESSO:</strong> ${escapeHtml(modalidade)} — ${escapeHtml(numeroEdital)}</div>
    <div style="margin-top:3px;"><strong>OBJETO:</strong> ${escapeHtml(objeto)}</div>
    <div style="margin-top:3px;"><strong>REQUERENTE / LICITANTE:</strong> ${escapeHtml(empresa)} (CNPJ: ${escapeHtml(cnpj)})</div>
  </div>

  <div>
    ${formatarCorpoJuridicoHtml(dados.conteudo)}
  </div>

  <div class="assinatura-box">
    <p style="margin-bottom:24px;">Emitido em ${escapeHtml(dataExtenso)}.</p>
    <div class="linha-assinatura"></div>
    <strong>${escapeHtml(empresa)}</strong><br/>
    <span>CNPJ: ${escapeHtml(cnpj)}</span><br/>
    <span style="font-size:8.5pt;color:#334155;">${escapeHtml(representante)} — Assinatura Digital ICP-Brasil / Gov.br</span>
  </div>
</body>
</html>`;
}

export function exportarPecaJuridicaPdf(dados: DadosPecaJuridicaPdf): boolean {
  try {
    const html = construirHtmlPecaJuridicaPdf(dados);
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
      setTimeout(() => win.print(), 300);
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
      }, 1500);
    }, 300);

    return true;
  } catch {
    window.print();
    return true;
  }
}

export default exportarPecaJuridicaPdf;
