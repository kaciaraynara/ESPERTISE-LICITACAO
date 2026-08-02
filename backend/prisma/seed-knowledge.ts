import { getPrismaClient } from '../src/database/prisma';
import crypto from 'crypto';

const prisma = getPrismaClient();

async function main() {
  console.log('Iniciando Seeding da Base de Conhecimento (Expertise Licitum)...');

  // ==========================================
  // 1. Jurisprudence (TCU, CGU, CADE)
  // ==========================================
  console.log('Inserindo Jurisprudência e Súmulas TCU...');
  await prisma.jurisprudence.upsert({
    where: { dedupeKey: 'TCU-SUMULA-222' },
    update: {},
    create: {
      source: 'TCU',
      externalId: 'SUMULA-222',
      dedupeKey: 'TCU-SUMULA-222',
      contentHash: crypto.createHash('md5').update('As decisões do TCU relativas à aplicação...').digest('hex'),
      court: 'Tribunal de Contas da União',
      title: 'Súmula 222 - Efeitos da Decisão',
      summary: 'As Decisões do TCU aplicam-se a todos os entes da Administração Pública.',
      decisionText: 'As decisões do Tribunal de Contas da União, relativas à aplicação de normas gerais de licitação, sobre as quais cabe privativamente à União legislar, devem ser acatadas pelos administradores dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios.',
      decisionDate: new Date('2021-01-01T00:00:00Z'),
    },
  });

  await prisma.jurisprudence.upsert({
    where: { dedupeKey: 'TCU-ACORDAO-1214-2013' },
    update: {},
    create: {
      source: 'TCU',
      externalId: 'ACORDAO-1214-2013-PLENARIO',
      dedupeKey: 'TCU-ACORDAO-1214-2013',
      contentHash: crypto.createHash('md5').update('É irregular a exigência de atestados de capacidade...').digest('hex'),
      court: 'Tribunal de Contas da União - Plenário',
      title: 'Atestados de Capacidade Técnica Restritivos',
      summary: 'Vedação à exigência de quantitativos mínimos ou prazos máximos desarrazoados em atestados de capacidade técnica.',
      decisionText: 'É irregular a exigência, para fins de qualificação técnico-operacional, de atestados que comprovem a execução de quantitativos mínimos em prazos máximos, salvo quando a dimensão e a complexidade do objeto assim o exigirem, devendo haver, em qualquer caso, motivação prévia e fundamentada no processo licitatório.',
      decisionDate: new Date('2013-05-22T00:00:00Z'),
    },
  });

  await prisma.jurisprudence.upsert({
    where: { dedupeKey: 'CADE-GUIA-CONLUIO' },
    update: {},
    create: {
      source: 'CADE',
      externalId: 'GUIA-COMBATE-CARTEIS',
      dedupeKey: 'CADE-GUIA-CONLUIO',
      contentHash: crypto.createHash('md5').update('Combate a cartéis em licitações...').digest('hex'),
      court: 'Conselho Administrativo de Defesa Econômica',
      title: 'Combate a Cartéis em Licitações (Conluio)',
      summary: 'O CADE orienta pregoeiros e gestores a identificar propostas de fachada e lances coordenados.',
      decisionText: 'A apresentação de propostas com erros ortográficos idênticos, formatação espelhada, ou lances sequenciais que indicam revezamento configuram fortes indícios de cartel em licitações públicas, sendo passíveis de sanção sob a Lei de Defesa da Concorrência.',
      decisionDate: new Date('2022-01-01T00:00:00Z'),
    },
  });

  // ==========================================
  // 2. GovernmentCatalog (CATMAT / CATSER)
  // ==========================================
  console.log('Inserindo Catálogo do Governo (CATMAT/CATSER)...');
  await prisma.governmentCatalog.upsert({
    where: { code: 'CATSER-8395' },
    update: {},
    create: {
      code: 'CATSER-8395',
      catalogType: 'catser',
      description: 'PRESTAÇÃO DE SERVIÇOS DE LIMPEZA E CONSERVAÇÃO - ÁREAS INTERNAS E EXTERNAS',
      unit: 'M2',
      referencePrice: 12.50,
      metadata: { risk: 'low', frequent: true },
    },
  });

  await prisma.governmentCatalog.upsert({
    where: { code: 'CATMAT-43211500' },
    update: {},
    create: {
      code: 'CATMAT-43211500',
      catalogType: 'catmat',
      description: 'COMPUTADOR PESSOAL (DESKTOP) CORE I7, 16GB RAM, 512GB SSD',
      unit: 'UNIDADE',
      referencePrice: 4500.00,
      metadata: { risk: 'medium', category: 'TI' },
    },
  });

  // ==========================================
  // 3. DocumentTemplate (Minutas, Propostas, Guias 14.133)
  // ==========================================
  console.log('Inserindo Minutas e Guias (DocumentTemplates)...');
  
  await prisma.documentTemplate.createMany({
    skipDuplicates: true,
    data: [
      {
        title: 'Guia do Licitante: Etapas do Pregão Eletrônico (Lei 14.133/21)',
        description: 'Passo a passo completo sobre como participar de um pregão na nova lei.',
        templateType: 'conteudo_educativo',
        contentTemplate: `
# 🏆 Guia do Licitante Vencedor: Pregão Eletrônico

De acordo com a Lei 14.133/2021, o pregão é a modalidade obrigatória para bens e serviços comuns.

## Etapa 1: Fase Preparatória e Publicação
- O edital é publicado. Você tem até 3 dias úteis antes da abertura para apresentar **Pedidos de Esclarecimento** ou **Impugnações**.
- Leia a seção de Qualificação Econômico-Financeira e Qualificação Técnica.

## Etapa 2: Apresentação da Proposta
- Envie sua proposta e os documentos de habilitação no sistema (PNCP/Compras.gov.br) antes do horário limite.
- A proposta deve refletir seu Preço Mínimo Viável (Bottom-line).

## Etapa 3: Etapa Competitiva (Lances)
Existem dois modos principais:
- **Aberto:** Lances sucessivos por tempo estipulado.
- **Aberto e Fechado:** Fica aberto, encerra aleatoriamente e quem está na margem de 10% vai para um lance final fechado (cego).

## Etapa 4: Julgamento e Habilitação
- O Pregoeiro analisa quem deu o menor preço. Se aceito, abre a documentação.
- Se houver falha, ele desclassifica e chama o segundo colocado.

## Etapa 5: Recursos
- Você tem 3 dias úteis para manifestar intenção de recurso, e 3 dias para apresentar as razões. 

> Dica Expertise: Use nosso Radar de Nulidades e o Motor LEX para embasar seus recursos rapidamente!
        `,
      },
      {
        title: 'Modelo Padrão de Impugnação ao Edital (Restrição de Marca)',
        description: 'Minuta para atacar editais que exigem marca específica sem justificativa técnica.',
        templateType: 'minuta_impugnacao',
        mergeTags: { empresa: '{{NOME_EMPRESA}}', edital: '{{NUMERO_EDITAL}}', orgao: '{{ORGAO}}' },
        contentTemplate: `
**À CPL/Pregoeiro do(a) {{ORGAO}}**
Ref.: Edital do Pregão Eletrônico nº {{NUMERO_EDITAL}}

A empresa **{{NOME_EMPRESA}}**, devidamente qualificada, vem, tempestivamente, apresentar **IMPUGNAÇÃO AO EDITAL**, pelos fundamentos de fato e de direito a seguir aduzidos:

**1. DA TEMPESTIVIDADE E DO CABIMENTO**
A presente impugnação é tempestiva, visto que apresentada até 3 (três) dias úteis antes da data fixada para abertura do certame, conforme o art. 164 da Lei nº 14.133/2021.

**2. DA IRREGULARIDADE: INDICAÇÃO DE MARCA ESPECÍFICA SEM JUSTIFICATIVA TÉCNICA**
O item X do edital estabelece a obrigatoriedade de fornecimento de equipamento da marca "Y", sem, contudo, demonstrar a inviabilidade de outros equipamentos similares ou a padronização formal do órgão.

O art. 41, inciso I da Lei 14.133/2021 veda expressamente o direcionamento de marca, salvo estritamente justificado. O Tribunal de Contas da União (TCU) possui entendimento pacífico de que a especificação não pode frustrar o caráter competitivo da licitação.

**3. DOS PEDIDOS**
Ante o exposto, requer-se:
a) O recebimento desta impugnação;
b) A alteração do edital para suprimir a exigência de marca exclusiva, permitindo o fornecimento de bens similares de qualidade equivalente;
c) A republicação do edital e reabertura de prazo.

Nestes termos, pede deferimento.
        `,
      },
      {
        title: 'Modelo Padrão de Proposta Comercial (Lei 14.133)',
        description: 'Estrutura básica de proposta de preços alinhada à nova lei de licitações.',
        templateType: 'modelo_proposta',
        mergeTags: { razao: '{{RAZAO_SOCIAL}}', cnpj: '{{CNPJ}}', valor_total: '{{VALOR_TOTAL}}' },
        contentTemplate: `
**PROPOSTA COMERCIAL**

**Ao(a) Pregoeiro(a) do Órgão Promotor**
Referência: Edital nº {{NUMERO_EDITAL}}

A empresa **{{RAZAO_SOCIAL}}**, inscrita no CNPJ sob o nº **{{CNPJ}}**, vem apresentar proposta de preços para fornecimento dos itens constantes no edital supra:

| Item | Descrição | Und. | Qtd. | Preço Unit. | Preço Total |
|---|---|---|---|---|---|
| 01 | {{DESCRICAO_ITEM_1}} | {{UND}} | {{QTD}} | R$ {{PRECO_UNIT}} | R$ {{PRECO_TOTAL}} |

**VALOR TOTAL GERAL:** R$ {{VALOR_TOTAL}}

**Condições Gerais:**
1. Validade da Proposta: 60 dias (conforme art. 90 da Lei 14.133/21).
2. Declaramos que nos preços propostos estão inclusos todos os tributos, encargos, fretes e despesas diretas e indiretas necessárias ao cumprimento da obrigação.
3. Declaramos pleno cumprimento aos requisitos de habilitação.

Local e Data.
_________________________________
Assinatura do Representante Legal
        `,
      }
    ]
  });

  console.log('Seeding concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no Seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
