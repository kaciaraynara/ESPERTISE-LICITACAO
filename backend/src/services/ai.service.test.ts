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
  ProviderUnavailableError,
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

  it('streams provider output to the supplied callback', async () => {
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
      { modelName: 'gemini-3.8-flash' },
    );

    expect(result).toMatchObject({
      content: 'Resposta grounded.',
      provider: 'gemini (gemini-3.8-flash)',
    });
    expect(receivedChunks).toEqual(['Resposta grounded.']);
  });

  it('usa o próximo modelo estável apenas quando o modelo configurado não existe', async () => {
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

    expect(result.provider).toBe('gemini (gemini-3.8-flash)');
    expect(mockGetGenerativeModel.mock.calls.map(([options]) => options.model)).toEqual([
      'legacy-model-name',
      'gemini-3.8-flash',
    ]);
  });

  it('não percorre modelos alternativos para falhas de autenticação ou quota', async () => {
    mockGenerateContentStream.mockRejectedValue({
      status: 429,
      message: 'Rate limit exceeded',
    });

    await expect(
      streamChatWithProvider([{ role: 'user', content: 'Pergunta.' }], () => {}),
    ).rejects.toBeInstanceOf(ProviderUnavailableError);

    expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
  });
});
