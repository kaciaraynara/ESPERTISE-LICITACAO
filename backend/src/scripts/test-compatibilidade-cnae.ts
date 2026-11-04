import dotenv from 'dotenv';
import path from 'path';

// Carrega as variáveis do .env do backend
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import {
  avaliarCompatibilidadeCnae,
  SYSTEM_PROMPT_COMPATIBILIDADE_CNAE,
} from '../services/cnae-to-keywords.service';

async function main() {
  console.log('========================================================');
  console.log('  TESTE DE INTELIGÊNCIA SEMÂNTICA (CNAE x EDITAIS)');
  console.log('  (Diretriz Zero Alucinação / Temperature: 0.1)');
  console.log('========================================================\n');

  console.log('System Prompt:\n' + SYSTEM_PROMPT_COMPATIBILIDADE_CNAE + '\n');

  // Teste 1: Aderente (Software x Software)
  console.log('--------------------------------------------------------');
  console.log('[TESTE 1] Software x Software:');
  const res1 = await avaliarCompatibilidadeCnae({
    objetoEdital: 'Contratação de empresa para sustentação de sistemas web em nuvem e desenvolvimento sob demanda.',
    cnaeCodigo: '62.01-5-01',
    razaoSocial: 'Tech Soluções em Software LTDA',
    valorEstimado: 350000.0,
  });
  console.log(JSON.stringify(res1, null, 2));

  // Teste 2: Incompatível (Construção Civil x Software)
  console.log('\n--------------------------------------------------------');
  console.log('[TESTE 2] Pavimentação/Obras x Software:');
  const res2 = await avaliarCompatibilidadeCnae({
    objetoEdital: 'Contratação de serviços de recapeamento asfáltico em CBUQ e drenagem pluvial.',
    cnaeCodigo: '62.01-5-01',
    razaoSocial: 'Tech Soluções em Software LTDA',
    valorEstimado: null,
  });
  console.log(JSON.stringify(res2, null, 2));

  // Teste 3: Parâmetros vazios
  console.log('\n--------------------------------------------------------');
  console.log('[TESTE 3] Parâmetros Vazios (Fallback Seguro):');
  const res3 = await avaliarCompatibilidadeCnae({
    objetoEdital: '',
    cnaeCodigo: '',
  });
  console.log(JSON.stringify(res3, null, 2));

  console.log('\n========================================================');
  console.log('  TESTES FINALIZADOS');
  console.log('========================================================');
}

main().catch(console.error);

