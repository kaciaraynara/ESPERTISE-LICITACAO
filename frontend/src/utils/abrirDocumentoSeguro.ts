import api, { BASE_URL } from '@/services/api';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';

export interface AbrirDocumentoOptions {
  nomeArquivo?: string;
  modo?: 'abrir' | 'baixar';
}

/**
 * Utilitário universal para visualização e download seguro de documentos.
 * Previne falhas de autenticação (erro 401 / tela preta) injetando o Bearer token
 * oficial e gerando Blob ObjectURL no navegador.
 */
export async function abrirDocumentoSeguro(
  endpointOuUrl: string | null | undefined,
  nomeArquivoOuOptions?: string | AbrirDocumentoOptions,
  modoPadrao: 'abrir' | 'baixar' = 'abrir'
): Promise<void> {
  if (!endpointOuUrl || endpointOuUrl === '#') {
    toast.error('O endereço do arquivo não está disponível.');
    return;
  }

  const options: AbrirDocumentoOptions =
    typeof nomeArquivoOuOptions === 'string'
      ? { nomeArquivo: nomeArquivoOuOptions, modo: modoPadrao }
      : { modo: modoPadrao, ...nomeArquivoOuOptions };

  const modo = options.modo || 'abrir';
  let nomeArquivo = options.nomeArquivo?.trim() || 'documento.pdf';
  if (!nomeArquivo.toLowerCase().endsWith('.pdf') && !nomeArquivo.includes('.')) {
    nomeArquivo += '.pdf';
  }

  // Verifica se é uma URL externa absoluta que NÃO seja a nossa própria API
  const ehHttp = /^https?:\/\//i.test(endpointOuUrl);
  const ehNossaApi =
    endpointOuUrl.includes('/api/v1/') ||
    endpointOuUrl.includes('/api/') ||
    (typeof window !== 'undefined' && endpointOuUrl.includes(window.location.host));

  if (ehHttp && !ehNossaApi) {
    window.open(endpointOuUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // Prepara o endpoint relativo para a instância do Axios
  let endpoint = endpointOuUrl;
  if (endpoint.startsWith(BASE_URL)) {
    endpoint = endpoint.slice(BASE_URL.length);
  }
  if (endpoint.startsWith('/api/v1')) {
    endpoint = endpoint.replace('/api/v1', '');
  } else if (endpoint.startsWith('/api')) {
    endpoint = endpoint.replace('/api', '');
  }
  if (!endpoint.startsWith('/')) {
    endpoint = `/${endpoint}`;
  }

  const toastId = toast.loading(
    modo === 'baixar' ? 'Baixando documento com segurança...' : 'Abrindo documento...'
  );

  try {
    const response = await api.get(endpoint, {
      responseType: 'blob',
    });

    const contentType =
      (response.headers?.['content-type'] as string) || 'application/pdf';
    const blob = new Blob([response.data], { type: contentType });
    const objectUrl = URL.createObjectURL(blob);

    toast.dismiss(toastId);

    if (modo === 'baixar') {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      toast.success('Documento baixado com sucesso!');
    } else {
      const novaAba = window.open(objectUrl, '_blank', 'noopener,noreferrer');
      if (!novaAba) {
        // Bloqueador de pop-up do navegador acionado: faz download automático
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = nomeArquivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success('Documento baixado (pop-up bloqueado pelo navegador).');
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 180000);
    }
  } catch (error: any) {
    toast.dismiss(toastId);
    console.error('[abrirDocumentoSeguro] Erro ao carregar arquivo:', error);

    // Fallback de contingência: anexa o token na URL em nova aba
    const authState = useAuthStore.getState();
    const token =
      authState.accessToken ||
      (typeof window !== 'undefined'
        ? window.sessionStorage.getItem('token') || window.localStorage.getItem('token')
        : null);

    if (token) {
      const sep = endpointOuUrl.includes('?') ? '&' : '?';
      const fallbackUrl = `${endpointOuUrl}${sep}token=${encodeURIComponent(token)}`;
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    toast.error('Não foi possível abrir o documento. Tente novamente em instantes.');
  }
}

export default abrirDocumentoSeguro;
