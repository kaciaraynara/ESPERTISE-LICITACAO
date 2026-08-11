import { AiGroundingService } from '../services/ai-grounding.service';
import { chatWithProvider } from '../services/ai.service';
import { config } from 'dotenv';
config();

async function testLex() {
  console.log('--- Iniciando Teste do Robô LEX ---');
  const groundingService = new AiGroundingService(undefined, chatWithProvider);

  try {
    const result = await groundingService.runLex({
      pergunta: 'Liste insumos para proposta comercial de empresa de TI (desenvolvimento de software) com base num edital fictício onde pede-se 2 desenvolvedores sênior.',
      purpose: 'lex_proposta_insumos_grounded',
      metadata: { endpoint: '/test' }
    }, {
      tenantId: 'test-tenant',
      user: { id: 'test-user', email: 'test@example.com', role: 'admin', isAdmin: true, permissions: [] },
      requestId: 'test-request',
      ip: '127.0.0.1',
      userAgent: 'test-agent'
    });

    console.log('\n✅ LEX respondeu com sucesso:');
    console.log('Provider:', result.provider);
    console.log('Confiança:', result.confidence);
    console.log('\nConteúdo:\n', result.content);
  } catch (err: any) {
    console.error('\n❌ Erro ao testar o LEX:');
    console.error(err.message);
  }
}

testLex();
