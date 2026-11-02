/**
 * Serviço de Minimização de Dados e Proteção de Privacidade para o LEX.
 * Garante que dados pessoais (LGPD) e informações excessivas NÃO sejam transmitidos
 * para provedores de LLM externos.
 */
export class LexMinimizationService {
  private static readonly CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
  private static readonly EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  private static readonly PHONE_REGEX = /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}|\d{4})[-.\s]?\d{4}\b/g;
  private static readonly SECRET_REGEX = /(?:bearer\s+[A-Za-z0-9._-]+|(?:api|ai)[_-]?key[:=]\s*[A-Za-z0-9._-]+|password[:=]\s*\S+|secret[:=]\s*\S+)/gi;

  /**
   * Sanitiza e anonimiza o texto antes de enviar para o prompt do modelo.
   */
  static sanitizeForPrompt(text: string): string {
    if (!text || typeof text !== 'string') return '';

    return text
      .replace(this.SECRET_REGEX, '[SEGREDO_REMOVIDO]')
      .replace(this.CPF_REGEX, '[CPF_PROTEGIDO]')
      .replace(this.EMAIL_REGEX, '[EMAIL_PROTEGIDO]')
      .replace(this.PHONE_REGEX, '[TELEFONE_PROTEGIDO]')
      .trim();
  }

  /**
   * Minimiza trechos para conter apenas a extensão estritamente necessária.
   */
  static minimizeExcerpt(text: string, maxCharacters = 700): string {
    const sanitized = this.sanitizeForPrompt(text);
    if (sanitized.length <= maxCharacters) return sanitized;

    return `${sanitized.slice(0, maxCharacters - 3)}...`;
  }
}
