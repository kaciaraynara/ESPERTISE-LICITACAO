import { z } from 'zod';

export const proposalStatusSchema = z.enum([
  'RASCUNHO',
  'EM_PREENCHIMENTO',
  'PENDENTE_DE_DADOS',
  'PENDENTE_DE_REVISAO',
  'EM_REVISAO',
  'AJUSTES_SOLICITADOS',
  'APROVADA',
  'EXPORTADA',
  'SUBMETIDA',
  'CANCELADA',
  'ARQUIVADA',
]);

const optionalText = (maxLength: number, message: string) =>
  z
    .union([
      z.string().trim().max(maxLength, message),
      z.null(),
    ])
    .optional()
    .transform((value) => value === '' ? null : value);

export const createProposalDraftSchema = z.object({
  companyId: z.string().uuid('Empresa invalida'),

  procurementNoticeId: z
    .string()
    .uuid('Edital invalido')
    .nullable()
    .optional(),

  titulo: z
    .string()
    .trim()
    .min(3, 'O titulo deve ter pelo menos 3 caracteres')
    .max(200, 'O titulo deve ter no maximo 200 caracteres'),

  moeda: z
    .string()
    .trim()
    .length(3, 'A moeda deve possuir 3 caracteres')
    .transform((value) => value.toUpperCase())
    .default('BRL'),

  validadeDias: z
    .number()
    .int('A validade deve ser informada em dias inteiros')
    .positive('A validade deve ser maior que zero')
    .nullable()
    .optional(),

  validadeAte: z
    .string()
    .datetime({ offset: true, message: 'Data de validade invalida' })
    .nullable()
    .optional(),

  prazoEntregaDias: z
    .number()
    .int('O prazo de entrega deve ser informado em dias inteiros')
    .positive('O prazo de entrega deve ser maior que zero')
    .nullable()
    .optional(),

  condicoesPagamento: optionalText(
    1000,
    'As condicoes de pagamento devem ter no maximo 1000 caracteres',
  ),

  garantia: optionalText(
    1000,
    'A garantia deve ter no maximo 1000 caracteres',
  ),

  observacoes: optionalText(
    5000,
    'As observacoes devem ter no maximo 5000 caracteres',
  ),

  responsibleUserId: z
    .string()
    .uuid('Usuario responsavel invalido')
    .nullable()
    .optional(),
}).strict();

export const listProposalDraftsQuerySchema = z.object({
  companyId: z
    .string()
    .uuid('Empresa invalida')
    .optional(),

  busca: z
    .string()
    .trim()
    .max(200, 'A busca deve ter no maximo 200 caracteres')
    .optional(),

  pagina: z.coerce
    .number()
    .int()
    .positive()
    .default(1),

  limite: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
}).strict();

export const proposalIdParamSchema = z.object({
  id: z.string().uuid('Identificador da proposta invalido'),
}).strict();

export type CreateProposalDraftInput = z.infer<
  typeof createProposalDraftSchema
>;

export type ListProposalDraftsQuery = z.infer<
  typeof listProposalDraftsQuerySchema
>;

export type ProposalIdParam = z.infer<
  typeof proposalIdParamSchema
>;
