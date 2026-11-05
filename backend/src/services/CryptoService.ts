import crypto from 'crypto';

/**
 * Serviço de Criptografia Simétrica Autenticada (AES-256-GCM).
 *
 * Requisitos de Segurança:
 * - Algoritmo: `aes-256-gcm` (Autenticação + Confidencialidade AEAD).
 * - Chave estrita de 256 bits (32 bytes) lida exclusivamente de `process.env.APP_ENCRYPTION_KEY`.
 * - Nenhuma chave "chumbada" (hardcoded) no código-fonte.
 * - Vetor de Inicialização (IV) de 12 bytes (96 bits - recomendação NIST SP 800-38D) gerado
 *   aleatoriamente via CSPRNG (`crypto.randomBytes`) a cada operação de encriptação.
 * - Auth Tag de 16 bytes (128 bits) validada na decriptação contra adulteração (tampering).
 * - Formato de saída padronizado: `iv:authTag:encryptedText` (codificados em hexadecimal).
 */
export class CryptoService {
  private static readonly ALGORITHM = 'aes-256-gcm' as const;
  private static readonly KEY_BYTES = 32; // 256 bits
  private static readonly IV_BYTES = 12; // 96 bits (padrão GCM)
  private static readonly AUTH_TAG_BYTES = 16; // 128 bits

  /**
   * Obtém e valida a chave de 256 bits a partir de `process.env.APP_ENCRYPTION_KEY`.
   * Aceita representação em Hexadecimal (64 chars), Base64 (44 chars) ou string UTF-8 de exatos 32 bytes.
   */
  private static getEncryptionKey(): Buffer {
    const rawKey = process.env.APP_ENCRYPTION_KEY?.trim();

    if (!rawKey) {
      throw new Error(
        '[CRYPTO_SECURITY_ERROR] A variável de ambiente APP_ENCRYPTION_KEY não está definida.',
      );
    }

    let keyBuffer: Buffer;

    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      keyBuffer = Buffer.from(rawKey, 'hex');
    } else if (Buffer.byteLength(rawKey, 'utf8') === CryptoService.KEY_BYTES) {
      keyBuffer = Buffer.from(rawKey, 'utf8');
    } else {
      const base64Candidate = Buffer.from(rawKey, 'base64');
      if (base64Candidate.length === CryptoService.KEY_BYTES) {
        keyBuffer = base64Candidate;
      } else {
        throw new Error(
          `[CRYPTO_SECURITY_ERROR] APP_ENCRYPTION_KEY inválida: esperado exatos 256 bits (32 bytes ou 64 caracteres hexadecimais).`,
        );
      }
    }

    if (keyBuffer.length !== CryptoService.KEY_BYTES) {
      throw new Error(
        `[CRYPTO_SECURITY_ERROR] Tamanho de chave inválido (${keyBuffer.length * 8} bits). O algoritmo AES-256-GCM exige chave estrita de 256 bits.`,
      );
    }

    return keyBuffer;
  }

  /**
   * Encripta um texto plano utilizando AES-256-GCM com IV aleatório único.
   * @param plainText Texto em claro a ser protegido.
   * @returns String no formato `iv:authTag:encryptedText` (hex).
   */
  public static encrypt(plainText: string): string {
    if (typeof plainText !== 'string') {
      throw new Error('[CRYPTO_ENCRYPT_ERROR] O conteúdo a ser encriptado deve ser uma string.');
    }

    const key = CryptoService.getEncryptionKey();
    const iv = crypto.randomBytes(CryptoService.IV_BYTES);

    const cipher = crypto.createCipheriv(CryptoService.ALGORITHM, key, iv, {
      authTagLength: CryptoService.AUTH_TAG_BYTES,
    });

    const encryptedBuffer = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      iv.toString('hex'),
      authTag.toString('hex'),
      encryptedBuffer.toString('hex'),
    ].join(':');
  }

  /**
   * Decripta e autentica um payload no formato `iv:authTag:encryptedText`.
   * @param encryptedPayload Payload cifrado no formato `iv:authTag:encryptedText`.
   * @returns Texto original decriptado em UTF-8.
   */
  public static decrypt(encryptedPayload: string): string {
    if (typeof encryptedPayload !== 'string' || !encryptedPayload.trim()) {
      throw new Error('[CRYPTO_DECRYPT_ERROR] Payload criptografado ausente ou inválido.');
    }

    const segments = encryptedPayload.trim().split(':');
    if (segments.length !== 3) {
      throw new Error(
        '[CRYPTO_DECRYPT_ERROR] Formato inválido. Esperado o padrão "iv:authTag:encryptedText".',
      );
    }

    const [ivHex, authTagHex, encryptedHex] = segments;

    if (!ivHex || !authTagHex || encryptedHex === undefined) {
      throw new Error(
        '[CRYPTO_DECRYPT_ERROR] Segmentos de IV, AuthTag ou Ciphertext corrompidos.',
      );
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');

    if (iv.length !== CryptoService.IV_BYTES) {
      throw new Error(
        `[CRYPTO_DECRYPT_ERROR] Tamanho de IV inválido (${iv.length} bytes). Esperado ${CryptoService.IV_BYTES} bytes.`,
      );
    }

    if (authTag.length !== CryptoService.AUTH_TAG_BYTES) {
      throw new Error(
        `[CRYPTO_DECRYPT_ERROR] Tamanho de AuthTag inválido (${authTag.length} bytes). Esperado ${CryptoService.AUTH_TAG_BYTES} bytes.`,
      );
    }

    const key = CryptoService.getEncryptionKey();

    const decipher = crypto.createDecipheriv(CryptoService.ALGORITHM, key, iv, {
      authTagLength: CryptoService.AUTH_TAG_BYTES,
    });

    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final(),
    ]);

    return decryptedBuffer.toString('utf8');
  }

  /**
   * Métodos de instância delegando para os métodos estáticos para suportar
   * tanto uso via injeção de dependência (`new CryptoService().encrypt(...)`)
   * quanto chamada estática (`CryptoService.encrypt(...)`).
   */
  public encrypt(plainText: string): string {
    return CryptoService.encrypt(plainText);
  }

  public decrypt(encryptedPayload: string): string {
    return CryptoService.decrypt(encryptedPayload);
  }
}

export const cryptoService = new CryptoService();

