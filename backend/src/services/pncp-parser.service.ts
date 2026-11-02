import axios from 'axios';

/**
 * Faz a extração do texto do PDF do Edital usando a API do PNCP para baixar o anexo principal.
 * Suporta tanto o formato oficial CNPJ-1-SEQUENCIAL/ANO (ex: 00394460000141-1-000001/2025)
 * quanto CNPJ-1-SEQUENCIAL-ANO.
 */
export async function preencherTextoEditalAutomaticamente(edital_id: string): Promise<string> {
  if (!edital_id) return '';
  try {
    const cleanId = edital_id.trim().replace(/^pncp-/i, '');
    const match = cleanId.match(/^(\d{14})-\d+-(\d+)[/-](\d{4})$/);

    let cnpj = '';
    let sequencial = '';
    let ano = '';

    if (match) {
      cnpj = match[1];
      sequencial = String(Number(match[2]));
      ano = match[3];
    } else {
      const normalized = cleanId.replace(/\//g, '-');
      const parts = normalized.split('-');
      if (parts.length < 3) return '';
      cnpj = parts[0];
      ano = parts[parts.length - 1];
      sequencial = String(Number(parts[parts.length - 2]));
    }

    if (!cnpj || !ano || !sequencial || sequencial === 'NaN') return '';

    const PNCP_BASE = process.env.PNCP_FILES_BASE_URL || 'https://pncp.gov.br/api/pncp/v1';

    // 1. Busca lista de arquivos do edital
    const urlArquivos = `${PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`;
    const responseLista = await axios.get(urlArquivos, {
      headers: { Accept: 'application/json' },
      timeout: 15000,
    });

    const arquivos = responseLista.data;
    if (!Array.isArray(arquivos) || arquivos.length === 0) {
      console.warn('[PNCP Parser] Nenhum arquivo encontrado para a licitação:', edital_id);
      return '';
    }

    // 2. Tenta achar o Edital ou o melhor anexo
    const editalArquivo =
      arquivos.find(
        (a) =>
          a.titulo?.toLowerCase().includes('edital') ||
          a.titulo?.toLowerCase().includes('termo de refer') ||
          a.titulo?.toLowerCase().includes('anexo'),
      ) || arquivos[0];

    const seqArquivo = editalArquivo.sequencialArquivo || 1;
    const urlArquivoPDF = `${PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${seqArquivo}`;

    // 3. Faz download dos bytes do PDF
    const docRes = await axios.get(urlArquivoPDF, {
      responseType: 'arraybuffer',
      timeout: 25000,
    });

    // 4. Extração de texto dinâmico
    let pdf: any;
    try {
      pdf = (await import('pdf-parse')).default;
    } catch {
      console.error('[PNCP Parser] A biblioteca pdf-parse não está instalada.');
      return '';
    }

    const pdfData = await pdf(Buffer.from(docRes.data));
    return pdfData.text || '';
  } catch (err: any) {
    console.error('[PNCP Parser] Falha na automação do edital:', err.message);
    return '';
  }
}
