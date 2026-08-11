import * as dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../database/prisma';

async function run() {
  console.log('Iniciando carga de conhecimento do LEX...');

  // 1. Templates Universais
  const templates = [
    {
      title: 'Impugnação Padrão NLLC (Lei 14.133)',
      templateType: 'impugnacao',
      description: 'Modelo universal para ataque de exigências abusivas e direcionamento.',
      contentTemplate: `AO PREGOEIRO E EQUIPE DE APOIO DO ÓRGÃO {{ORGAO_LICITANTE}}
REF: Edital nº {{NUMERO_EDITAL}}

A empresa {{RAZAO_SOCIAL}}, inscrita no CNPJ sob o nº {{CNPJ}}, com sede em {{ENDERECO_COMPLETO}}, por seu representante legal, vem, tempestivamente, apresentar IMPUGNAÇÃO AO EDITAL em epígrafe, com fulcro no art. 164 da Lei nº 14.133/2021, pelos fatos e fundamentos jurídicos a seguir aduzidos.

1. DOS FATOS
O edital da licitação supracitada estabelece em seu item {{ITEM_IMPUGNADO}} a exigência de: "{{TEXTO_EXIGENCIA_EDITAL}}".

2. DO DIREITO
Tal exigência afronta diretamente os princípios da competitividade, da razoabilidade e da proporcionalidade, esculpidos no art. 5º da Lei 14.133/2021. Conforme remansosa jurisprudência do TCU (Acórdão 2.449/2013-Plenário e Súmula 272), é vedada a imposição de cláusulas que restrinjam o caráter competitivo da licitação.
{{TESES_ADICIONAIS_LEX}}

3. DOS PEDIDOS
Diante do exposto, requer-se:
a) O recebimento e provimento da presente impugnação;
b) A retificação do edital para exclusão da exigência ilegal.

Termos em que pede deferimento.
{{CIDADE}}, {{DATA_ATUAL}}
{{REPRESENTANTE_LEGAL}}`,
      mergeTags: ['ORGAO_LICITANTE', 'NUMERO_EDITAL', 'RAZAO_SOCIAL', 'CNPJ', 'ENDERECO_COMPLETO', 'ITEM_IMPUGNADO', 'TEXTO_EXIGENCIA_EDITAL', 'TESES_ADICIONAIS_LEX', 'CIDADE', 'DATA_ATUAL', 'REPRESENTANTE_LEGAL']
    },
    {
      title: 'Proposta Comercial - Padrão Licitação',
      templateType: 'proposta',
      description: 'Modelo estratégico de proposta comercial com validade e detalhamento.',
      contentTemplate: `PROPOSTA COMERCIAL

À {{ORGAO_LICITANTE}}
Ref.: Licitação nº {{NUMERO_EDITAL}}

A empresa {{RAZAO_SOCIAL}}, CNPJ nº {{CNPJ}}, estabelecida à {{ENDERECO_COMPLETO}}, propõe fornecer os itens objeto deste certame, conforme especificações abaixo:

{{TABELA_ITENS_PROPOSTA}}

VALOR TOTAL GLOBAL: R$ {{VALOR_TOTAL_GLOBAL}} ({{VALOR_GLOBAL_EXTENSO}})

Declaramos que:
1. O prazo de validade desta proposta é de {{PRAZO_VALIDADE_DIAS}} dias.
2. Nos preços ofertados estão inclusos todos os tributos, fretes e demais despesas diretas e indiretas.
3. Atendemos a todas as especificações e condições do edital.

{{CIDADE}}, {{DATA_ATUAL}}
{{REPRESENTANTE_LEGAL}}`,
      mergeTags: ['ORGAO_LICITANTE', 'NUMERO_EDITAL', 'RAZAO_SOCIAL', 'CNPJ', 'ENDERECO_COMPLETO', 'TABELA_ITENS_PROPOSTA', 'VALOR_TOTAL_GLOBAL', 'VALOR_GLOBAL_EXTENSO', 'PRAZO_VALIDADE_DIAS', 'CIDADE', 'DATA_ATUAL', 'REPRESENTANTE_LEGAL']
    }
  ];

  for (const t of templates) {
    await prisma.documentTemplate.create({
      data: {
        title: t.title,
        templateType: t.templateType,
        description: t.description,
        contentTemplate: t.contentTemplate,
        mergeTags: t.mergeTags,
        active: true
      }
    });
  }
  console.log('✅ Templates Universais inseridos.');

  // 2. Legal Rules (Contabilidade, TCU, CADE)
  const rules = [
    {
      code: 'CONTAB_01',
      name: 'Qualificação Econômico-Financeira (Liquidez)',
      description: 'Índices usuais exigidos: Liquidez Geral, Solvência Geral e Liquidez Corrente > 1,0.',
      severity: 'high',
      category: 'Contabilidade',
      version: '1.0',
      legalBasis: ['Art. 69, Lei 14.133/21', 'IN 73/2022'],
      criteria: {},
      alertMessage: 'Verifique se os índices de liquidez da empresa atendem ao mínimo exigido no edital.',
      recommendation: 'Calcular a liquidez usando a fórmula do edital e anexar o balanço contábil.'
    },
    {
      code: 'TCU_COMPET_01',
      name: 'Restrição Ilegal de Competitividade',
      description: 'Exigência de atestado de capacitação técnica com limitação de tempo ou de local específico é irregular.',
      severity: 'critical',
      category: 'Jurisprudência',
      version: '1.0',
      legalBasis: ['Súmula 272 do TCU'],
      criteria: {},
      alertMessage: 'Possível restrição ilegal à competitividade detectada nas exigências técnicas.',
      recommendation: 'Sugerir impugnação imediata fundamentada na Súmula 272 do TCU.'
    },
    {
      code: 'CADE_01',
      name: 'Indícios de Cartel (Conluio)',
      description: 'Propostas com formatação idêntica, erros ortográficos comuns, rodízio de vencedores ou valores muito próximos ao limite indicam cartel.',
      severity: 'critical',
      category: 'Análise de Risco',
      version: '1.0',
      legalBasis: ['Guia CADE - Combate a Cartéis em Licitações'],
      criteria: {},
      alertMessage: 'Risco de fraude ou conluio detectado com base no padrão de lances.',
      recommendation: 'Analisar o histórico das empresas e reportar ao órgão se necessário.'
    }
  ];

  for (const r of rules) {
    const existing = await prisma.legalRule.findFirst({ where: { code: r.code } });
    if (!existing) {
      await prisma.legalRule.create({
        data: {
          code: r.code,
          name: r.name,
          description: r.description,
          severity: r.severity,
          category: r.category,
          version: r.version,
          legalBasis: r.legalBasis,
          criteria: r.criteria,
          alertMessage: r.alertMessage,
          recommendation: r.recommendation,
          active: true,
          workflowStatus: 'active'
        }
      });
    }
  }
  console.log('✅ Regras de Contabilidade e TCU inseridas.');

  console.log('🎉 Carga Finalizada com Sucesso!');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect();
});
