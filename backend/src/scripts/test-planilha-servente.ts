import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { buscarContextoJuridico } from '../services/base-juridica.service';
import { streamChatWithProvider, GroundingAIMessage } from '../services/ai.service';

async function testarPerguntaPlanilha() {
  const pergunta = 'Como devo montar a planilha de custos de um servente de limpeza?';
  console.log(`\n========================================================================`);
  console.log(`PERGUNTA DO USUÁRIO: "${pergunta}"`);
  console.log(`========================================================================\n`);

  // 1. Busca Semântica no pgvector
  const precedentes = await buscarContextoJuridico(pergunta, { limite: 3 });

  console.log('--- PRECEDENTES ENCONTRADOS PELO PGVECTOR ---');
  precedentes.forEach((p, i) => {
    console.log(`Fonte ${i + 1}: [${p.autoridade}] ${p.titulo}`);
    console.log(`Similaridade: ${(p.similaridade * 100).toFixed(2)}% | Ref: ${p.referencia || p.artigo_referencia}`);
  });
  console.log('--------------------------------------------\n');

  // Formata o contexto
  const contextoJuridicoFormatado = precedentes
    .map((p, idx) => `[FONTE ${idx + 1}: ${p.autoridade} — ${p.titulo} | Referência: ${p.referencia || p.artigo_referencia || 'N/A'} | Fonte: ${p.fonte}]\n${p.conteudo}`)
    .join('\n\n---\n\n');

  // System Prompt oficial do LEX (Consultor Sênior Big4)
  const systemPrompt = `Você é o LEX, Consultor Jurídico Sênior e Especialista em Licitações da plataforma EXPERTISE. Seu tom deve ser sempre acolhedor, profissional, didático e altamente persuasivo (estilo consultoria Big4). Evite usar formatação excessiva (muitos asteriscos ou listas desnecessárias) para parecer mais natural e humano.
Sua especialidade é analisar editais, redigir impugnações, avaliar habilitações e calcular reajustes usando a Lei 14.133/21, contabilidade pública e manuais do TCU/CGU.

REGRA DE ENCAMINHAMENTO: Você não busca editais no mercado. Se o usuário pedir para 'encontrar os melhores editais', 'buscar licitações' ou tarefas de prospecção, responda de forma cordial que sua especialidade é a análise técnica e jurídica, e oriente o usuário a acessar o módulo Radar de Licitações no menu lateral esquerdo da nossa plataforma para encontrar oportunidades filtradas.

REGRA ANTI-ALUCINAÇÃO: Baseie-se no contexto jurídico fornecido, mas integre-o à sua fala de forma natural (ex: 'Com base no Acórdão X do TCU, recomendo que...'). Se a consulta envolver um tema sem respaldo no contexto, oriente o cliente com clareza e transparência com postura de consultor sênior, nunca inventando leis, artigos ou números de precedentes inexistentes.

[CONTEXTO JURÍDICO DA BASE DE DADOS EXPERTISE]:
${contextoJuridicoFormatado}`.trim();

  const aiMessages: GroundingAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: pergunta },
  ];

  console.log('--- RESPOSTA EM STREAMING DO CONSULTOR LEX ---');
  let respostaCompleta = '';
  await streamChatWithProvider(aiMessages, (chunk) => {
    process.stdout.write(chunk);
    respostaCompleta += chunk;
  });

  console.log('\n\n========================================================================');
  console.log('TESTE CONCLUÍDO COM SUCESSO!');
  console.log('========================================================================\n');
}

testarPerguntaPlanilha()
  .catch((err) => {
    console.error('Erro no teste:', err);
    process.exit(1);
  });

