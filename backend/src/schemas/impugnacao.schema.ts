import { z } from 'zod';

export const gerarPecaImpugnacaoSchema = z.object({
  body: z.object({
    numeroEdital: z.string().optional(),
    numero_edital: z.string().optional(),
    orgao: z.string().optional(),
    objeto: z.string().optional(),
    dataCertame: z.string().optional(),
    data_certame: z.string().optional(),
    pontos_impugnacao: z.union([z.string(), z.array(z.any())]).optional(),
    irregularidadesIdentificadas: z.array(
      z.object({
        clausulaEdital: z.string().optional(),
        descricao: z.string().optional(),
        fundamentacaoLegal: z.string().optional(),
      }).passthrough()
    ).optional(),
    solicitacaoDireta: z.enum(['ANULACAO_EDITAL', 'RETIFICACAO_CLAUSULA', 'SUSPENSAO_CERTAME']).optional(),
  }).passthrough(),
}).passthrough();

export const calcularPrazoImpugnacaoSchema = z.object({
  body: z.object({
    dataCertame: z.string().optional(),
    data_certame: z.string().optional(),
    dataAbertura: z.string().optional(),
    modalidade: z.string().optional(),
  }).passthrough().optional(),
  query: z.object({
    dataCertame: z.string().optional(),
    data_certame: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

export const gerarImpugnacaoSchema = gerarPecaImpugnacaoSchema;
