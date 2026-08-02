import axios from 'axios';

/**
 * Faz a extração do texto do PDF do Edital usando a API do PNCP para baixar o anexo principal.
 */
export async function preencherTextoEditalAutomaticamente(edital_id: string): Promise<string> {
    if (!edital_id) return '';
    try {
        const parts = edital_id.split('-');
        if (parts.length < 3) return '';
        
        // Estrutura do ID PNCP: CNPJ-1-SEQUENCIAL-ANO
        const cnpj = parts[0];
        const ano = parts[parts.length - 1]; // "2026"
        const sequencial = parts[parts.length - 2];

        if (!cnpj || !ano || !sequencial) return '';

        const PNCP_BASE = process.env.PNCP_BASE_URL || 'https://pncp.gov.br/api/pncp/v1';
        
        // 1. Busca lista de arquivos do edital
        const urlArquivos = `${PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`;
        const responseLista = await axios.get(urlArquivos, {
            headers: { 'Accept': 'application/json' }
        });
        
        const arquivos = responseLista.data;
        if (!Array.isArray(arquivos) || arquivos.length === 0) {
            console.error('[PNCP Parser] Nenhum arquivo encontrado para a licitação:', edital_id);
            return '';
        }

        // 2. Tenta achar o Edital ou o melhor anexo
        const editalArquivo = arquivos.find(a => 
            a.titulo?.toLowerCase().includes('edital') || 
            a.titulo?.toLowerCase().includes('termo de refer') ||
            a.titulo?.toLowerCase().includes('anexo')
        ) || arquivos[0]; // Fallback para o primeiro anexo

        const seqArquivo = editalArquivo.sequencialArquivo || 1;
        const urlArquivoPDF = `${PNCP_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos/${seqArquivo}`;

        // 3. Faz download dos bytes do PDF
        const docRes = await axios.get(urlArquivoPDF, { 
            responseType: 'arraybuffer' 
        });

        // 4. Extração de texto dinâmico (carrega pdf-parse em tempo de execução para evitar crash se não instalado)
        let pdf: any;
        try {
            pdf = (await import('pdf-parse')).default;
        } catch (e) {
            console.error('[PNCP Parser] A biblioteca pdf-parse não está instalada! Rode: npm install pdf-parse');
            return 'TEXTO INDISPONÍVEL: É necessário rodar "npm install pdf-parse" no backend.';
        }

        const pdfData = await pdf(Buffer.from(docRes.data));
        
        return pdfData.text || ''; 
    } catch (err: any) {
        console.error('[PNCP Parser] Falha na automação do edital:', err.message);
        return '';
    }
}
