// jest.setup.ts

// 1. Evita o aviso de falta da chave do Gemini nos testes
process.env.GEMINI_API_KEY = 'test-dummy-key';

// 2. Silencia logs de erro/aviso esperados (como 'postgres offline' e locks)
beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});