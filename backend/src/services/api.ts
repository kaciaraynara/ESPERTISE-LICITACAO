import axios from 'axios';

// Criamos uma instância única apontando para o seu backend
export const api = axios.create({
  baseURL: 'https://pncp.gov.br/api/consulta/v1',
  timeout: 15000, // Dá 15 segundos para o servidor responder antes de dar erro
  headers: {
    'Content-Type': 'application/json',
  }
});

// Interceptor: Se a internet cair ou o backend estiver desligado, ele avisa no console
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(' Erro de Conexão com o Backend:', error.message);
    return Promise.reject(error);
  }
);