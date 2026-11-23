const mockGenerateContentStream = jest.fn();
const mockGetGenerativeModel = jest.fn((_options: { model: string }) => ({
  generateContentStream: mockGenerateContentStream,
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

import {
  FALLBACK_MODELS,
  MissingApiKeyError,
  ProviderUnavailableError,
  AiTimeoutError,
  streamChatWithProvider,
} from './ai.service';

describe('streamChatWithProvider', () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
    delete process.env.GEMINI_MODEL;
  });

  afterAll(() => {
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
  });

  it('streams provider output to the supplied callback using official fallback models', async () => {
    expect(FALLBACK_MODELS).toEqual([
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-flash-latest',
    ]);

    mockGenerateContentStream.mockResolvedValue({
      stream: (async function* () {
        yield { text: () => 'Resposta grounded.' };
      })(),
    });
    const receivedChunks: string[] = [];

    const result = await streamChatWithProvider(
      [{ role: 'user', content: 'Analise este trecho.' }],
      (chunk) => {
        receivedChunks.push(chunk);
      },
      { modelName: 'gemini-2.5-flash' },
    );

    expect(result).toMatchObject({
      content: 'Resposta grounded.',
      provider: 'gemini (gemini-2.5-flash)',
    });
    expect(receivedChunks).toEqual(['Resposta grounded.']);
  });

  it('ignora GEMINI_MODEL inválido (gemini-3.8, 3.6, 3.5, 3.1) e usa gemini-2.5-flash', async () => {
    process.env.GEMINI_MODEL = 'gemini-3.8-flash';
    mockGenerateContentStream.mockResolvedValue({
      stream: (async function* () {
        yield { text: () => 'Resposta oficial.' };
      })(),
    });

    const result = await streamChatWithProvider(
      [{ role: 'user', content: 'Pergunta.' }],
      () => {},
    );

    expect(result.provider).toBe('gemini (gemini-2.5-flash)');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-2.5-flash' });
  });

  it('usa o próximo modelo estável quando o modelo configurado retorna 404', async () => {
    process.env.GEMINI_MODEL = 'legacy-model-name';
    mockGenerateContentStream
      .mockRejectedValueOnce({ status: 404, message: 'Model not found' })
      .mockResolvedValueOnce({
        stream: (async function* () {
          yield { text: () => 'Resposta.' };
        })(),
      });

    const result = await streamChatWithProvider(
      [{ role: 'user', content: 'Pergunta.' }],
      () => {},
    );

    expect(result.provider).toBe('gemini (gemini-2.5-flash)');
    expect(mockGetGenerativeModel.mock.calls.map(([options]) => options.model)).toEqual([
      'legacy-model-name',
      'gemini-2.5-flash',
    ]);
  });

  it('lança MissingApiKeyError quando GEMINI_API_KEY está ausente ou não configurada', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(
      streamChatWithProvider([{ role: 'user', content: 'Audite este edital.' }], () => {}),
    ).rejects.toThrow(MissingApiKeyError);

    process.env.GEMINI_API_KEY = 'unconfigured';
    await expect(
      streamChatWithProvider([{ role: 'user', content: 'Audite este edital.' }], () => {}),
    ).rejects.toThrow(MissingApiKeyError);
  });

  it('lança ProviderUnavailableError (sem fallback genérico falso) quando todos os modelos falham', async () => {
    mockGenerateContentStream.mockRejectedValue({
      status: 429,
      message: 'Rate limit exceeded',
    });

    const chunks: string[] = [];
    await expect(
      streamChatWithProvider(
        [{ role: 'user', content: 'Analise este edital.' }],
        (c) => {
          chunks.push(c);
        },
      ),
    ).rejects.toThrow(ProviderUnavailableError);

    expect(chunks).toHaveLength(0);
  });

  it('propaga AiTimeoutError quando a última tentativa falha por timeout', async () => {
    mockGenerateContentStream.mockRejectedValue(new AiTimeoutError(45000));

    await expect(
      streamChatWithProvider([{ role: 'user', content: 'Pergunta.' }], () => {}),
    ).rejects.toThrow(AiTimeoutError);
  });
});
