import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('[AI Service] GEMINI_API_KEY não configurada no .env');
}

const genAI = new GoogleGenerativeAI(apiKey || 'unconfigured');

type GroundingAIMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export async function chatWithProvider(
  messages: GroundingAIMessage[]
): Promise<{ content: string; provider: string }> {
  if (!apiKey || apiKey === 'unconfigured') {
    throw new Error('GEMINI_API_KEY não configurada. Serviço AI indisponível.');
  }

  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-3.5-flash' });

    let systemInstruction = '';
    const geminiHistory: any[] = [];
    let lastUserMessage = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction += (systemInstruction ? '\n' : '') + msg.content;
      } else if (msg.role === 'user') {
        lastUserMessage = msg.content;
        // In this simple implementation, we can just send everything to generateContent
        // if we are using it as a one-off completion, which is typical for grounded RAG.
      } else if (msg.role === 'assistant') {
        // Not commonly used in single-shot RAG but implemented for completeness
        geminiHistory.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }

    // Usually grounding sends one big prompt at the end
    const fullPrompt = systemInstruction 
      ? `INSTRUÇÕES DO SISTEMA:\n${systemInstruction}\n\nPERGUNTA/PROMPT DO USUÁRIO:\n${lastUserMessage}`
      : lastUserMessage;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    return {
      content: text,
      provider: 'gemini',
    };
  } catch (error: any) {
    console.error('[AI Service] Erro ao chamar provedor Gemini:', error);
    throw error;
  }
}
