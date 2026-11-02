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

  criterioJulgamento: z
    .enum([
      'menor_preco',
      'maior_desconto',
      'melhor_tecnica',
      'tecnica_e_preco',
      'maior_lance',
      'maior_retorno_economico',
    ])
    .nullable()
    .optional(),

  bdiGeral: z
    .number()
    .min(0, 'O BDI deve ser positivo')
    .max(100, 'O BDI deve ser no maximo 100%')
    .nullable()
    .optional(),

  encargosSociais: z
    .number()
    .min(0)
    .max(200)
    .nullable()
    .optional(),

  margemMinimaSustentavel: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .optional(),

  declaracaoIndependente: z.boolean().default(false),
  declaracaoHabilitacao: z.boolean().default(false),
  declaracaoMenor: z.boolean().default(false),
  declaracaoMeEpp: z.boolean().default(false),
  declaracaoInidoneidade: z.boolean().default(false),
  declaracaoAcessibilidade: z.boolean().default(false),
}).strict();

export const updateProposalSchema = z.object({
  titulo: z.string().trim().min(3).max(200).optional(),
  validadeDias: z.number().int().positive().nullable().optional(),
  prazoEntregaDias: z.number().int().positive().nullable().optional(),
  garantia: optionalText(1000, 'A garantia deve ter no maximo 1000 caracteres'),
  condicoesPagamento: optionalText(
    1000,
    'As condicoes de pagamento devem ter no maximo 1000 caracteres',
  ),
  declaracaoIndependente: z.boolean().optional(),
  declaracaoHabilitacao: z.boolean().optional(),
  declaracaoMenor: z.boolean().optional(),
  declaracaoMeEpp: z.boolean().optional(),
  declaracaoInidoneidade: z.boolean().optional(),
  declaracaoAcessibilidade: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'Informe ao menos um campo para atualizar.',
});

export const createProposalItemSchema = z.object({
  descricao: z.string().trim().min(3, 'Descricao obrigatoria'),
  unidade: z.string().trim().default('UN'),
  quantidade: z.number().positive('Quantidade deve ser maior que zero'),
  codigo: z.string().trim().optional().nullable(),
  numero: z.coerce.string().trim().optional().nullable(),
  numeroItem: z.number().optional().nullable(),
  marca: z.string().trim().optional().nullable(),
  modelo: z.string().trim().optional().nullable(),
  custoUnitario: z.number().min(0).optional().nullable(),
  custoDireto: z.number().min(0).optional().nullable(),
  custoIndireto: z.number().min(0).optional().nullable(),
  tributosPercentual: z.number().min(0).max(100).optional().nullable(),
  encargosPercentual: z.number().min(0).max(200).optional().nullable(),
  bdiPercentual: z.number().min(0).max(100).optional().nullable(),
  margemLucroPercentual: z.number().min(0).max(100).optional().nullable(),
  descontoPercentual: z.number().min(0).max(100).optional().nullable(),
  precoUnitarioProposto: z.number().min(0).optional().nullable(),
  valorUnitario: z.number().min(0).optional().nullable(),
  precoTotalProposto: z.number().min(0).optional().nullable(),
  prazoGarantiaMeses: z.number().int().min(0).optional().nullable(),
  observacoes: optionalText(2000, 'Observacoes devem ter no maximo 2000 caracteres'),
});

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

export type CreateProposalDraftInput = z.input<
  typeof createProposalDraftSchema
>;

export type CreateProposalItemInput = z.input<
  typeof createProposalItemSchema
>;

export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;

export type ListProposalDraftsQuery = z.infer<
  typeof listProposalDraftsQuerySchema
>;

export type ProposalIdParam = z.infer<
  typeof proposalIdParamSchema
>;
