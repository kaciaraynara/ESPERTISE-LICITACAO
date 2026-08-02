import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail invalido'),
  senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
});

export const registerSchema = z.object({
  nome: z.string().min(2, 'Nome muito curto'),
  cnpj: z.string()
    .transform((value) => value.replace(/\D/g, ''))
    .refine((value) => value.length === 14, 'CNPJ invalido'),
  razao_social: z.string().min(3, 'Razao social obrigatoria'),
  nome_fantasia: z.string().optional(),
  cnae_principal: z.string().optional(),
  municipio: z.string().optional(),
  uf: z.string().min(2).max(2).optional(),
  status: z.string().optional(),
  email: z.string().trim().toLowerCase().email('E-mail invalido'),
  telefone: z.string().min(10, 'Telefone invalido').optional(),
  senha: z.string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Za-z]/, 'A senha deve conter pelo menos uma letra')
    .regex(/\d/, 'A senha deve conter pelo menos um numero'),
  aceite_lgpd: z.literal(true, {
    errorMap: () => ({ message: 'E necessario aceitar os termos e a politica de privacidade' }),
  }),
  // O cadastro público cria exclusivamente contas de fornecedor. Perfis
  // privilegiados exigem um fluxo administrativo com validação profissional.
  role: z.literal('fornecedor').optional(),
});

export const documentoSchema = z.object({
  tipo: z.string().trim().min(1, 'Tipo e obrigatorio').max(120),
  nome: z.string().trim().min(1, 'Nome e obrigatorio').max(255),
  validade: z.string().date('Data de validade invalida').optional(),
  empresa_id: z.string().uuid('Empresa invalida'),
});
