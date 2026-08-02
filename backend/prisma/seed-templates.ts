import 'dotenv/config';
import { prisma, disconnectPrisma } from '../src/database/prisma';

async function main() {
  console.log('Seeding templates (Minutas, Propostas, Recursos)...');

  const templates = [
    {
      title: 'Proposta Comercial - Lei 14.133/21',
      description: 'Modelo Padrão de Proposta Comercial atendendo aos requisitos da Nova Lei de Licitações.',
      templateType: 'proposta',
      mergeTags: {
        '{{NOME_EMPRESA}}': 'Razão Social da Empresa',
        '{{CNPJ}}': 'CNPJ da Empresa',
        '{{ORGAO_LICITANTE}}': 'Nome do Órgão Licitante',
        '{{NUMERO_EDITAL}}': 'Número do Edital (Ex: 01/2026)',
        '{{VALOR_PROPOSTA}}': 'Valor Total da Proposta',
        '{{PRAZO_VALIDADE}}': 'Prazo de Validade (Dias)',
        '{{DATA_ATUAL}}': 'Data do Documento'
      },
      contentTemplate: `Ao(À) Ilmo(a) Senhor(a) Agente de Contratação / Pregoeiro(a) do {{ORGAO_LICITANTE}}
Ref.: Edital nº {{NUMERO_EDITAL}}

A empresa {{NOME_EMPRESA}}, inscrita no CNPJ nº {{CNPJ}}, sediada em [...], vem, por meio de seu representante legal infra-assinado, apresentar sua PROPOSTA COMERCIAL para prestação dos serviços/fornecimento de bens descritos no Edital em epígrafe, pelo valor total de R$ {{VALOR_PROPOSTA}}.

Declaramos, sob as penas da lei e em cumprimento à Lei nº 14.133/21, que:
1. O prazo de validade desta proposta é de {{PRAZO_VALIDADE}} dias corridos, contados da data de abertura do certame.
2. Estamos de pleno acordo com todas as condições estabelecidas no edital e seus anexos.
3. Inexistem fatos supervenientes impeditivos para a nossa habilitação neste certame.
4. Cumprimos todos os requisitos de reserva de cargos previstos em lei.

Local, {{DATA_ATUAL}}.

_____________________________________________________
{{NOME_EMPRESA}}
Representante Legal`
    },
    {
      title: 'Impugnação ao Edital (Art. 164 - Lei 14.133/21)',
      description: 'Peça formal para apontar irregularidades, falhas ou restrições à competitividade no instrumento convocatório.',
      templateType: 'impugnacao',
      mergeTags: {
        '{{NOME_EMPRESA}}': 'Razão Social do Impugnante',
        '{{CNPJ}}': 'CNPJ do Impugnante',
        '{{ORGAO_LICITANTE}}': 'Nome do Órgão',
        '{{NUMERO_EDITAL}}': 'Número do Edital',
        '{{FUNDAMENTACAO}}': 'Base legal da impugnação',
        '{{DATA_ATUAL}}': 'Data da Impugnação'
      },
      contentTemplate: `AO EXCELENTÍSSIMO SENHOR AGENTE DE CONTRATAÇÃO / PREGOEIRO DO {{ORGAO_LICITANTE}}
Ref.: Processo Licitatório / Edital nº {{NUMERO_EDITAL}}

A empresa {{NOME_EMPRESA}}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {{CNPJ}}, com sede em [...], por seu representante legal, vem, tempestivamente e com fulcro no caput do Art. 164 da Lei nº 14.133/21, apresentar IMPUGNAÇÃO AO EDITAL, pelos motivos de fato e de direito a seguir expostos.

I - DA TEMPESTIVIDADE E DO CABIMENTO
Nos termos do art. 164 da Lei nº 14.133/2021, qualquer pessoa é parte legítima para impugnar edital de licitação por irregularidade na aplicação desta Lei, devendo protocolar o pedido até 3 (três) dias úteis antes da data de abertura do certame. A presente peça, portanto, é tempestiva.

II - DOS FATOS E DO DIREITO
(Inserir aqui as cláusulas restritivas ou irregulares do edital)
A cláusula [...] restringe a competitividade do certame, ferindo o princípio da isonomia e as diretrizes do artigo [...] da Lei nº 14.133/2021.
{{FUNDAMENTACAO}}

III - DOS PEDIDOS
Diante do exposto, requer:
a) O recebimento e processamento da presente impugnação, em virtude de sua tempestividade;
b) O provimento da presente impugnação para alterar o item [...] do Edital {{NUMERO_EDITAL}}, ou, sucessivamente, a suspensão do certame até que a irregularidade seja sanada.

Termos em que, pede deferimento.
Local, {{DATA_ATUAL}}.

_____________________________________________________
{{NOME_EMPRESA}}`
    },
    {
      title: 'Recurso Administrativo (Art. 165 - Lei 14.133/21)',
      description: 'Peça recursal contra decisão do agente de contratação, pregoeiro ou comissão, como inabilitação ou julgamento de propostas.',
      templateType: 'recurso',
      mergeTags: {
        '{{NOME_EMPRESA}}': 'Razão Social do Recorrente',
        '{{CNPJ}}': 'CNPJ do Recorrente',
        '{{ORGAO_LICITANTE}}': 'Nome do Órgão',
        '{{NUMERO_EDITAL}}': 'Número do Edital',
        '{{DATA_ATUAL}}': 'Data do Recurso'
      },
      contentTemplate: `À AUTORIDADE SUPERIOR DO {{ORGAO_LICITANTE}}
(Por intermédio do Agente de Contratação / Pregoeiro)
Ref.: Processo Licitatório / Edital nº {{NUMERO_EDITAL}}

{{NOME_EMPRESA}}, inscrita no CNPJ sob o nº {{CNPJ}}, já qualificada nos autos do processo em epígrafe, vem, inconformada com a decisão que (inabilitou a recorrente / declarou vencedora a empresa XYZ), interpor o presente RECURSO ADMINISTRATIVO, com fulcro no art. 165, inciso I, da Lei nº 14.133/21, consoante as razões de fato e de direito a seguir aduzidas.

I - DA TEMPESTIVIDADE E DO EFEITO SUSPENSIVO
A manifestação de intenção de recorrer foi registrada tempestivamente na sessão, e estas razões são apresentadas no prazo de 3 (três) dias úteis. Requer-se a concessão do efeito suspensivo automático, conforme art. 168, § 1º da Lei 14.133/21.

II - DAS RAZÕES RECURSAIS
A decisão recorrida padece de (ilegalidade / erro de julgamento), uma vez que a empresa [...] não atendeu à exigência do subitem [...] do edital.
(Discorrer detalhadamente sobre o erro na decisão)

III - DO PEDIDO
Ante o exposto, pugna-se pela reconsideração da decisão pelo Sr(a). Agente de Contratação, ou, se mantida, o encaminhamento à Autoridade Superior para o CONHECIMENTO e PROVIMENTO do presente recurso, a fim de que seja (reformada a decisão / inabilitada a licitante adversa), garantindo a escorreita aplicação da Lei de Licitações.

Nestes termos, pede deferimento.
Local, {{DATA_ATUAL}}.

_____________________________________________________
{{NOME_EMPRESA}}`
    },
    {
      title: 'Contrarrazões ao Recurso Administrativo (Art. 165, § 3º - Lei 14.133/21)',
      description: 'Peça para rebater os argumentos apresentados em recurso por licitante adversa e defender a manutenção da decisão.',
      templateType: 'recurso',
      mergeTags: {
        '{{NOME_EMPRESA}}': 'Razão Social da Recorrida',
        '{{CNPJ}}': 'CNPJ da Recorrida',
        '{{ORGAO_LICITANTE}}': 'Nome do Órgão',
        '{{NUMERO_EDITAL}}': 'Número do Edital',
        '{{EMPRESA_RECORRENTE}}': 'Razão Social da Empresa que Recorreu',
        '{{DATA_ATUAL}}': 'Data das Contrarrazões'
      },
      contentTemplate: `À AUTORIDADE SUPERIOR DO {{ORGAO_LICITANTE}}
(Por intermédio do Agente de Contratação / Pregoeiro)
Ref.: Processo Licitatório / Edital nº {{NUMERO_EDITAL}}

{{NOME_EMPRESA}}, inscrita no CNPJ sob o nº {{CNPJ}}, licitante vencedora e interessada nos autos do processo em epígrafe, vem, tempestivamente, apresentar suas CONTRARRAZÕES AO RECURSO interposto pela empresa {{EMPRESA_RECORRENTE}}, com fulcro no art. 165, § 3º, da Lei nº 14.133/21, pelas razões de fato e de direito a seguir expostas.

I - DA TEMPESTIVIDADE
A recorrente apresentou suas razões, abrindo-se o prazo legal de 3 (três) dias úteis para a apresentação de contrarrazões pelos demais licitantes. A presente manifestação é, portanto, plenamente tempestiva.

II - DO MÉRITO E DA MANUTENÇÃO DA DECISÃO
A empresa recorrente alega, sem razão, que a decisão do pregoeiro foi equivocada. Todavia, a decisão que declarou a ora impugnante como vencedora obedeceu estritamente ao Edital e à Lei de Licitações.
(Descrever os motivos pelos quais os argumentos da recorrente não procedem, rebatendo ponto a ponto)

III - DO PEDIDO
Ante o exposto, requer-se o RECEBIMENTO das presentes contrarrazões para, no mérito, NEGAR PROVIMENTO ao recurso interposto pela {{EMPRESA_RECORRENTE}}, mantendo-se incólume a escorreita decisão que declarou a habilitação e vitória da peticionante, por ser medida de inteira Justiça e legalidade.

Nestes termos, pede deferimento.
Local, {{DATA_ATUAL}}.

_____________________________________________________
{{NOME_EMPRESA}}`
    }
  ];

  let count = 0;
  for (const template of templates) {
    // Upsert para não duplicar se rodar duas vezes
    const existing = await prisma.documentTemplate.findFirst({
      where: { templateType: template.templateType, title: template.title }
    });

    if (!existing) {
      await prisma.documentTemplate.create({
        data: template
      });
      count++;
    } else {
      await prisma.documentTemplate.update({
        where: { id: existing.id },
        data: template
      });
      count++;
    }
  }

  console.log(`Successfully seeded ${count} templates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrisma();
  });
