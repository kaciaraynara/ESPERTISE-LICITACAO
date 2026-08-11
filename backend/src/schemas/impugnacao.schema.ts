import { z } from 'zod';

export const gerarPecaImpugnacaoSchema = z.object({
  body: z.object({
    noticeId: z.string().uuid({ message: 'ID do edital/notice inválido' }),
    fundamentacaoLegal: z.array(z.string().min(3)).min(1, {
      message: 'Informe ao menos uma fundamentação legal para a impugnação',
    }),
    irregularidadesIdentificadas: z.array(
      z.object({
        clausulaEdital: z.string().min(1, { message: 'Cláusula do edital é obrigatória' }),
        descricaoErro: z.string().min(10, { message: 'Descreva a irregularidade com detalhes' }),
        tipoIrregularidade: z.enum([
          'RESTRIÇÃO_COMPETITIVIDADE',
          'EXIGENCIA_EXCESSIVA',
          'ERRO_ORCAMENTARIO',
          'PRAZO_INSUFICIENTE',
          'OUTROS',
        ]),
      })
    ).min(1, { message: 'Adicione pelo menos uma irregularidade identificada' }),
    solicitacaoDireta: z.enum(['ANULACAO_EDITAL', 'RETIFICACAO_CLAUSULA', 'SUSPENSAO_CERTAME']),
  }),
});

export const calcularPrazoImpugnacaoSchema = z.object({
  body: z.object({
    dataAberturaSessao: z.string().datetime({ message: 'Data de abertura deve estar em formato ISO 8601 UTC' }),
    tipoPerfil: z.enum(['CIDADAO', 'LICITANTE']),
    regimeLicitatorio: z.enum(['LEI_14133', 'LEI_8666', 'LEI_10520', 'ESTATAL_13303']),
  }),
});