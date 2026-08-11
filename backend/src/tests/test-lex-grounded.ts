import { config } from 'dotenv';
config();
import { AiGroundingService } from '../services/ai-grounding.service';
import { chatWithProvider } from '../services/ai.service';
import { prisma } from '../database/prisma';
config();

async function testLex() {
  console.log('--- Configurando ambiente de teste para LEX ---');
  
  // 1. Inserir Edital Falso
  const notice = await prisma.procurementNotice.create({
    data: {
      noticeNumber: 'TESTE-999/2026',
      buyerName: 'Prefeitura de Teste',
      object: 'Contratação de desenvolvedores sênior para sistema web.',
      publishedAt: new Date(),
      status: 'active',
      source: 'test-source',
      dedupeKey: 'dedupe-999-2026',
      contentHash: 'hash123'
    }
  });

  // 2. Inserir Chunk Falso
  const chunk = await prisma.documentChunk.create({
    data: {
      sourceType: 'procurement_notice',
      sourceId: notice.id,
      chunkIndex: 1,
      content: 'O objeto da presente licitação é a contratação de 2 (dois) desenvolvedores sênior, com experiência em Node.js e React. O valor estimado é de R$ 300.000,00.',
      contentHash: 'hash456'
    }
  });

  // 3. Inserir Regra Falsa
  const rule = await prisma.legalRule.create({
    data: {
      code: 'REG-TESTE-1',
      name: 'Exigência de Profissionais',
      description: 'Regra de teste',
      severity: 'low',
      category: 'qualificacao_tecnica',
      version: '1.0',
      active: true,
      workflowStatus: 'active',
      legalBasis: 'Lei de Teste art 1',
      criteria: 'Deve pedir 2 devs',
      alertMessage: 'Falta devs',
      recommendation: 'Pedir devs'
    }
  });

  console.log('--- Iniciando Teste do Robô LEX com Grounding ---');
  const groundingService = new AiGroundingService(undefined, chatWithProvider);

  try {
    const result = await groundingService.runLex({
      pergunta: 'Com base no edital TESTE-999/2026, liste os insumos necessários e o valor estimado para a proposta.',
      noticeId: notice.id,
      purpose: 'lex_proposta_insumos_grounded',
      metadata: { endpoint: '/test' }
    }, {
      tenantId: null,
      user: { id: 'test-user', email: 'test@example.com', role: 'admin', isAdmin: true, permissions: [] },
      requestId: 'test-request',
      ip: '127.0.0.1',
      userAgent: 'test-agent'
    });

    console.log('\n✅ LEX respondeu com sucesso:');
    console.log('Provider:', result.provider);
    console.log('Confiança:', result.confidence);
    console.log('Fontes Encontradas:', result.sourceIds.length);
    console.log('Chunks Encontrados:', result.chunkIds.length);
    console.log('\nConteúdo:\n', result.content);
  } catch (err: any) {
    console.error('\n❌ Erro ao testar o LEX:');
    console.error(err.message);
  } finally {
    // Limpar o banco
    await prisma.documentChunk.delete({ where: { id: chunk.id } });
    await prisma.procurementNotice.delete({ where: { id: notice.id } });
    await prisma.legalRule.delete({ where: { id: rule.id } });
  }
}

testLex();
