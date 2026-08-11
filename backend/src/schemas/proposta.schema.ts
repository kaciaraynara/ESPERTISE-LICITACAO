import { z } from 'zod';

export const createPropostaSchema = z.object({
  body: z.object({
    licitacaoId: z.string().uuid({ message: 'ID da licitação inválido' }),
    numeroItem: z.number().int().positive({ message: 'O número do item deve ser um inteiro positivo' }),
    valorUnitario: z.number().positive({ message: 'O valor unitário deve ser maior que zero' }),
    quantidade: z.number().positive({ message: 'A quantidade deve ser maior que zero' }),
    descricaoDetalhada: z.string().min(10, { message: 'A descrição detalhada deve ter no mínimo 10 caracteres' }),
    marca: z.string().min(1, { message: 'A marca é obrigatória' }).optional(),
    modelo: z.string().min(1, { message: 'O modelo é obrigatório' }).optional(),
    validadePropostaDias: z.number().int().min(30, { message: 'A validade mínima da proposta é de 30 dias' }).default(60),
    declaracoesAceitas: z.object({
      meEpp: z.boolean(),
      inexistenciaFatosImpeditivos: z.boolean(),
      elaboracaoIndependente: z.boolean(),
    }).refine((data) => data.inexistenciaFatosImpeditivos && data.elaboracaoIndependente, {
      message: 'As declarações obrigatórias de integridade devem ser aceitas',
    }),
  }),
});

export type CreatePropostaInput = z.infer<typeof createPropostaSchema>;