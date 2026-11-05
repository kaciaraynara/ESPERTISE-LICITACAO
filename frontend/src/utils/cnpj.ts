/**
 * Utilitário para o novo padrão de CNPJ Alfanumérico da Receita Federal (IN RFB nº 2.229/2024).
 * Aceita letras (A-Z) e números (0-9) livremente e formata em tempo real para XX.XXX.XXX/XXXX-XX.
 */

export function sanitizeCnpj(value: string | null | undefined): string {
  if (!value) return '';
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 14);
}

export function formatCnpjMask(value: string | null | undefined): string {
  const clean = sanitizeCnpj(value);
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return `${clean.slice(0, 2)}.${clean.slice(2)}`;
  if (clean.length <= 8) return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5)}`;
  if (clean.length <= 12) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8)}`;
  }
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12, 14)}`;
}

/**
 * Valida um CNPJ (numérico tradicional ou alfanumérico).
 * Se vazio e opcional, retorna true para não bloquear a exploração do usuário.
 */
export function isValidCnpj(value: string | null | undefined, options: { optional?: boolean } = { optional: true }): boolean {
  const clean = sanitizeCnpj(value);
  if (!clean) {
    return options.optional !== false;
  }
  if (clean.length !== 14) {
    return false;
  }
  // Bloqueia sequências repetidas óbvias (ex: 00000000000000 ou AAAAAAAAAAAAAA)
  if (/^([A-Z0-9])\1{13}$/.test(clean)) {
    return false;
  }
  return /^[A-Z0-9]{14}$/.test(clean);
}

