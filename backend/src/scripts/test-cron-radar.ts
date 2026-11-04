import dotenv from 'dotenv';
import path from 'path';

// Carrega as variáveis do .env do backend
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import {
    SYSTEM_PROMPT_AGENTE_EDITAIS_CNAE,
    analisarAderenciaEditalCnae,
    analisarEditalParaCnae,
} from '../services/agente-editais-cnae.service';

async function main() {
    console.log('========================================================');
    console.log('  TESTE DO AGENTE ESPECIALISTA EM EDITAIS E CNAE');
    console.log('  (Lei 14.133/2021 — Zero Alucinação / Determinístico)');
    console.log('========================================================\n');

    console.log('System Prompt carregado com sucesso:\n');
    console.log(SYSTEM_PROMPT_AGENTE_EDITAIS_CNAE.slice(0, 260) + '...\n');

    // Cenário 1: Edital com alta aderência ao CNAE de Tecnologia / Software
    const editalTeste1 = {
        cnae: '62.01-5-01',
        ramoAtividade: 'Desenvolvimento de programas de computador sob encomenda',
        numeroEdital: 'PE nº 104/2026',
        orgao: 'Tribunal Regional Federal da 5ª Região',
        municipioUf: 'Recife/PE',
        valorEstimado: 850000.0,
        objetoEdital:
            'Contratação de empresa especializada em serviços de tecnologia da informação para sustentação, suporte técnico e desenvolvimento evolutivo de sistemas web em arquitetura de microsserviços, com entrega continuada de pontos de função.',
    };

    console.log('--------------------------------------------------------');
    console.log(`[CENÁRIO 1] Testando aderência para CNAE ${editalTeste1.cnae}:`);
    console.log(`Objeto: "${editalTeste1.objetoEdital}"`);
    console.log('Executando análise do Agente Especialista...');

    try {
        const resultado1 = await analisarAderenciaEditalCnae(editalTeste1);
        console.log('\n[RESULTADO 1 - JSON RETORNADO]:');
        console.log(JSON.stringify(resultado1, null, 2));
    } catch (err) {
        console.error('Erro na análise 1:', err);
    }

    // Cenário 2: Edital sem aderência (CNAE de Software x Objeto de Pavimentação/Asfalto)
    const editalTeste2 = {
        cnae: '62.01-5-01',
        ramoAtividade: 'Desenvolvimento de programas de computador sob encomenda',
        numeroEdital: 'Concorrência nº 012/2026',
        orgao: 'Prefeitura Municipal de Sobral',
        municipioUf: 'Sobral/CE',
        valorEstimado: null, // Testando regra de valor não informado
        objetoEdital:
            'Execução de obras de engenharia civil para drenagem urbana, pavimentação asfáltica em CBUQ e sinalização viária no bairro Centro.',
    };

    console.log('\n--------------------------------------------------------');
    console.log(`[CENÁRIO 2] Testando NÃO aderência (Engenharia Civil x CNAE Software):`);
    console.log(`Objeto: "${editalTeste2.objetoEdital}"`);
    console.log('Executando análise do Agente Especialista...');

    try {
        const resultado2 = await analisarAderenciaEditalCnae(editalTeste2);
        console.log('\n[RESULTADO 2 - JSON RETORNADO]:');
        console.log(JSON.stringify(resultado2, null, 2));
    } catch (err) {
        console.error('Erro na análise 2:', err);
    }

    // Cenário 3: Testando a função direta analisarEditalParaCnae
    console.log('\n--------------------------------------------------------');
    console.log('[CENÁRIO 3] Testando analisarEditalParaCnae (Input Direto):');
    try {
        const resultado3 = await analisarEditalParaCnae({
            objetoEdital: 'Aquisição de licenças de software para gestão pública e serviços de suporte técnico.',
            cnaeCodigo: '62.01-5-01',
            cnaeDescricao: 'Desenvolvimento de programas de computador sob encomenda',
        });
        console.log('\n[RESULTADO 3 - JSON RETORNADO]:');
        console.log(JSON.stringify(resultado3, null, 2));
    } catch (err) {
        console.error('Erro na análise 3:', err);
    }

    console.log('\n========================================================');
    console.log('  TESTES CONCLUÍDOS COM SUCESSO');
    console.log('========================================================');
}

main().catch((err) => {
    console.error('Falha na execução do script de teste:', err);
    process.exit(1);
});