import axios, { AxiosInstance } from 'axios';

/**
 * @author Raynara Kácia
 * @description Provider especializado para o Portal Nacional de Contratações Públicas.
 */
class PncpProvider {
  private static instance: AxiosInstance;

  public static getInstance(): AxiosInstance {
    if (!this.instance) {
      this.instance = axios.create({
        baseURL: process.env.PNCP_URL || process.env.PNCP_BASE_URL || 'https://pncp.gov.br/api/consulta/v1',
        timeout: Number(process.env.PNCP_TIMEOUT) || 20000,
        headers: {
          'User-Agent': 'Expertise-SaaS/2.0 (Enterprise)',
          'Accept': 'application/json',
        }
      });

      this.instance.interceptors.response.use(
        (response) => response,
        async (error) => {
          const config = error.config as any;
          const retries = Math.max(0, Number(process.env.PNCP_RETRIES ?? 2));
          const status = Number(error.response?.status ?? 0);
          const retryableStatus = status === 0 || status === 408 || status === 429 || status >= 500;

          if (config && retryableStatus && (config.__retryCount ?? 0) < retries) {
            config.__retryCount = (config.__retryCount ?? 0) + 1;
            const delayMs = Math.min(1000 * 2 ** (config.__retryCount - 1), 5000);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            return this.instance(config);
          }

          console.error(`[PNCP_INFRA_ERROR]: ${error.response?.status} - ${error.message}`);
          return Promise.reject(error);
        }
      );
    }
    return this.instance;
  }
}

export const pncpApi = PncpProvider.getInstance();
export const pncpProvider = pncpApi;
