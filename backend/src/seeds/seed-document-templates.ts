/**
 * Seed: Modelos de Documentos Oficiais (DocumentTemplate)
 *
 * Popula o banco com modelos reais de propostas, atestados, declarações e
 * recursos que o LEX pode usar para gerar documentos para o usuário.
 */

import { prisma } from '../database/prisma';

interface TemplateSeed {
  title: string;
  description: string;
  templateType: string;
  contentTemplate: string;
  mergeTags: Record<string, string>;
}

const TEMPLATES: TemplateSeed[] = [
  {
    title: 'Modelo de Proposta Comercial Padrão',
    description: 'Proposta comercial estruturada conforme exigências gerais de editais de pregão e concorrência.',
    templateType: 'proposta',
    contentTemplate: `À
Comissão de Contratação / Pregoeiro
{{orgao_nome}}
Ref.: Edital nº {{edital_numero}}

A empresa {{empresa_razao_social}}, inscrita no CNPJ sob o nº {{empresa_cnpj}}, sediada na {{empresa_endereco}}, por intermédio de seu representante legal, apresenta a presente PROPOSTA COMERCIAL para fornecimento do(s) objeto(s) do edital em epígrafe.

1. CONDIÇÕES GERAIS
O prazo de validade da proposta é de {{prazo_validade_proposta}} dias, contados da data de abertura do certame.
Declaramos que os preços ofertados incluem todos os custos diretos e indiretos, tributos, taxas e demais despesas necessárias ao cumprimento integral do objeto.

2. ESPECIFICAÇÕES E VALORES
Item: {{item_numero}}
Descrição: {{item_descricao}}
Quantidade: {{item_quantidade}}
Valor Unitário: R$ {{valor_unitario}}
Valor Total: R$ {{valor_total}}

Valor Global da Proposta: R$ {{valor_global}} ({{valor_global_extenso}}).

3. DADOS BANCÁRIOS E CONTATO
Banco: {{banco_nome}}
Agência: {{banco_agencia}}
Conta Corrente: {{banco_conta}}
E-mail para notificações: {{empresa_email}}
Telefone: {{empresa_telefone}}

Local e Data: {{cidade}}, {{data_atual}}

______________________________________________________
{{representante_nome}}
CPF: {{representante_cpf}}
Cargo: {{representante_cargo}}
`,
    mergeTags: {
      orgao_nome: 'Nome do órgão promotor da licitação',
      edital_numero: 'Número do edital (ex: 01/2026)',
      empresa_razao_social: 'Razão Social da empresa',
      empresa_cnpj: 'CNPJ da empresa',
      empresa_endereco: 'Endereço completo',
      prazo_validade_proposta: 'Prazo em dias (mínimo exigido é comum 60 dias)',
      item_numero: 'Número do item',
      item_descricao: 'Descrição do objeto do item',
      item_quantidade: 'Quantidade ofertada',
      valor_unitario: 'Valor unitário em R$',
      valor_total: 'Valor total do item em R$',
      valor_global: 'Valor global da proposta em R$',
      valor_global_extenso: 'Valor global por extenso',
      banco_nome: 'Nome do banco para pagamento',
      banco_agencia: 'Número da agência',
      banco_conta: 'Número da conta',
      empresa_email: 'E-mail corporativo',
      empresa_telefone: 'Telefone comercial',
      cidade: 'Cidade de assinatura',
      data_atual: 'Data da emissão',
      representante_nome: 'Nome do representante legal',
      representante_cpf: 'CPF do representante',
      representante_cargo: 'Cargo do representante',
    },
  },
  {
    title: 'Declaração Unificada (Habilitação Lei 14.133)',
    description: 'Declaração conjunta abrangendo inexistência de fatos impeditivos, menores, trabalho escravo, etc.',
    templateType: 'declaracao',
    contentTemplate: `DECLARAÇÃO UNIFICADA DE HABILITAÇÃO
Ref.: Edital nº {{edital_numero}} - {{orgao_nome}}

A empresa {{empresa_razao_social}}, inscrita no CNPJ nº {{empresa_cnpj}}, por intermédio de seu representante legal o(a) Sr(a). {{representante_nome}}, portador(a) do RG nº {{representante_rg}} e do CPF nº {{representante_cpf}}, DECLARA, sob as penas da lei, em cumprimento às exigências do Edital e da Lei nº 14.133/2021, que:

I – INEXISTÊNCIA DE FATO IMPEDITIVO: até a presente data inexistem fatos impeditivos para sua habilitação no presente certame, estando ciente da obrigatoriedade de declarar ocorrências posteriores.
II – TRABALHO DE MENORES (Art. 7º, XXXIII, CF): não emprega menor de 18 (dezoito) anos em trabalho noturno, perigoso ou insalubre e não emprega menor de 16 (dezesseis) anos, salvo na condição de aprendiz, a partir de 14 (quatorze) anos.
III – CUMPRIMENTO DAS EXIGÊNCIAS DE RESERVA DE CARGOS PARA PESSOA COM DEFICIÊNCIA (Art. 63, IV da Lei nº 14.133/2021): cumpre as exigências de reserva de cargos para pessoa com deficiência e para reabilitado da Previdência Social, previstas em lei e em outras normas específicas.
IV – TRABALHO DEGRADANTE OU FORÇADO: não submete trabalhadores a formas degradantes de trabalho ou a condições análogas às de escravo.
V – INDEPENDÊNCIA DA PROPOSTA: elaborou sua proposta de forma independente, nos termos e sob as penas da lei.

{{texto_meepp}}

Local e Data: {{cidade}}, {{data_atual}}

______________________________________________________
{{representante_nome}}
Cargo: {{representante_cargo}}
`,
    mergeTags: {
      edital_numero: 'Número do edital',
      orgao_nome: 'Nome do órgão',
      empresa_razao_social: 'Razão Social da empresa',
      empresa_cnpj: 'CNPJ da empresa',
      representante_nome: 'Nome do representante legal',
      representante_rg: 'RG do representante',
      representante_cpf: 'CPF do representante',
      cidade: 'Cidade',
      data_atual: 'Data',
      representante_cargo: 'Cargo do representante',
      texto_meepp: 'Opcional: Declaração de enquadramento ME/EPP (se aplicável)',
    },
  },
  {
    title: 'Recurso Administrativo Padrão',
    description: 'Estrutura base para recurso contra inabilitação, desclassificação ou adjudicação.',
    templateType: 'recurso',
    contentTemplate: `EXCELENTÍSSIMO(A) SENHOR(A) AGENTE DE CONTRATAÇÃO / PREGOEIRO(A)
{{orgao_nome}}
Ref.: Licitação nº {{edital_numero}}

A empresa {{empresa_razao_social}}, CNPJ nº {{empresa_cnpj}}, por seu representante legal, não se conformando com a r. decisão que {{motivo_recurso}} no certame em epígrafe, vem, tempestivamente e com fundamento no Art. 165 da Lei 14.133/2021, interpor o presente

RECURSO ADMINISTRATIVO

expondo e requerendo o que segue:

1. TEMPESTIVIDADE E CABIMENTO
O presente recurso é interposto dentro do prazo legal de 3 (três) dias úteis, contados da intimação do ato, sendo, portanto, tempestivo.

2. DOS FATOS E FUNDAMENTOS
{{fatos_e_fundamentos_gerados_pela_ia}}

3. DOS PEDIDOS
Diante de todo o exposto, REQUER-SE a V. Sa.:
a) O recebimento e conhecimento do presente Recurso Administrativo;
b) O exercício do juízo de retratação;
c) Caso não haja reconsideração, o encaminhamento dos autos à autoridade superior para julgamento e provimento do recurso, reformando a decisão para {{pedido_final}}.

Nestes termos,
Pede deferimento.

{{cidade}}, {{data_atual}}

______________________________________________________
{{representante_nome}}
`,
    mergeTags: {
      orgao_nome: 'Órgão licitante',
      edital_numero: 'Número do Edital',
      empresa_razao_social: 'Razão Social da empresa',
      empresa_cnpj: 'CNPJ',
      motivo_recurso: 'Ex: "a inabilitou", "desclassificou sua proposta"',
      fatos_e_fundamentos_gerados_pela_ia: 'Espaço onde a IA inserirá os argumentos jurídicos (RAG)',
      pedido_final: 'Ex: "habilitar a recorrente", "desclassificar a empresa concorrente"',
      cidade: 'Cidade',
      data_atual: 'Data',
      representante_nome: 'Nome do Representante',
    },
  },
];

async function seedDocumentTemplates() {
  console.log('🔄 Iniciando seed de templates de documentos oficiais...');

  let created = 0;
  let skipped = 0;

  for (const template of TEMPLATES) {
    const existing = await prisma.documentTemplate.findFirst({
      where: { title: template.title, tenantId: null },
    });

    if (existing) {
      console.log(`  ⏭  ${template.title} (já existe)`);
      skipped++;
      continue;
    }

    await prisma.documentTemplate.create({
      data: {
        title: template.title,
        description: template.description,
        templateType: template.templateType,
        contentTemplate: template.contentTemplate,
        mergeTags: template.mergeTags,
        active: true,
      },
    });

    console.log(`  ✅ ${template.title}`);
    created++;
  }

  console.log(`\n📊 Resultado: ${created} templates criados, ${skipped} já existentes.`);
  console.log('✅ Seed de templates de documentos concluído com sucesso!\n');
}

seedDocumentTemplates()
  .catch((err) => {
    console.error('❌ Erro no seed de templates:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
