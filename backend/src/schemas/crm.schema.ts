import { z } from 'zod';

export const CRM_STAGES = [
  'OPORTUNIDADE',
  'MAPEADAS',
  'ANALISE',
  'PROPOSTA',
  'DISPUTA',
  'RECURSO',
  'ADJUDICADO',
  'GANHO',
  'PERDIDO',
  'DESCLASSIFICADO',
  'ARQUIVADO',
] as const;

export const addToPipelineSchema = z.object({
  body: z.object({
    noticeId: z
      .string({ required_error: 'O identificador do edital (noticeId) é obrigatório.' })
      .min(1, 'O identificador do edital não pode ser vazio.')
      .max(120, 'O identificador do edital deve ter no máximo 120 caracteres.'),
    stage: z
      .enum(CRM_STAGES, {
        errorMap: () => ({ message: 'Etapa inválida para o pipeline de oportunidades.' }),
      })
      .optional()
      .default('OPORTUNIDADE'),
    notes: z
      .string()
      .max(2000, 'As anotações podem ter no máximo 2000 caracteres.')
      .optional()
      .nullable(),
  }),
});

export const updatePipelineStageSchema = z.object({
  body: z.object({
    stage: z.enum(CRM_STAGES, {
      errorMap: () => ({ message: 'Etapa informada é inválida.' }),
    }),
    position: z
      .number()
      .int('A posição deve ser um número inteiro.')
      .nonnegative('A posição não pode ser negativa.')
      .optional(),
  }),
  params: z.object({
    id: z.string().uuid('ID da oportunidade deve ser um UUID válido.'),
  }),
});

export const removePipelineSchema = z.object({
  params: z.object({
    id: z.string().uuid('ID da oportunidade deve ser um UUID válido.'),
  }),
});

export type AddToPipelineInput = z.infer<typeof addToPipelineSchema>['body'];
export type UpdatePipelineStageInput = z.infer<typeof updatePipelineStageSchema>['body'];
