import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { buscarContextoJuridico } from '../services/base-juridica.service';
import { disconnectPrisma } from '../database/prisma';

async function main() {
  const pergunta = 'erro de digitação em proposta';
  console.log(`\n==============================================================================`);
  console.log(`BUSCA SEMÂNTICA PGVECTOR (<=>) — TESTE DE CONTEXTO JURÍDICO`);
  console.log(`Pergunta do cliente: "${pergunta}"`);
  console.log(`==============================================================================\n`);

  const resultados = await buscarContextoJuridico(pergunta, { limite: 3 });

  console.log(`Total de resultados retornados: ${resultados.length}\n`);

  resultados.forEach((res, index) => {
    console.log(`[RESULTADO ${index + 1}]`);
    console.log(`  • Título:       ${res.titulo}`);
    console.log(`  • Autoridade:   ${res.autoridade}`);
    console.log(`  • Referência:   ${res.referencia || res.artigo_referencia}`);
    console.log(`  • Tema:         ${res.tema}`);
    console.log(`  • Similaridade: ${(res.similaridade * 100).toFixed(2)}% (Distância: ${res.distancia_cosseno})`);
    console.log(`  • Trecho do Conteúdo:`);
    console.log(`    "${res.conteudo.slice(0, 240).replace(/\n/g, ' ')}..."\n`);
  });

  const textoConcatenado = resultados.map((r) => `${r.titulo} ${r.conteudo}`).join(' ').toLowerCase();
  const temFormalismoOuErro =
    textoConcatenado.includes('vício sanável') ||
    textoConcatenado.includes('erro') ||
    textoConcatenado.includes('formal') ||
    textoConcatenado.includes('desclassificação') ||
    textoConcatenado.includes('proposta') ||
    textoConcatenado.includes('diligência');

  console.log(`==============================================================================`);
  console.log(`VALIDAÇÃO DO CRITÉRIO:`);
  console.log(`  • Contém teses sobre vício sanável, desclassificação ou formalismo moderado: ${temFormalismoOuErro ? 'SIM (Aprovado)' : 'NÃO (Falha)'}`);
  console.log(`==============================================================================\n`);
}

main()
  .catch((err) => {
    console.error('Erro no teste de busca jurídica:', err);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });

