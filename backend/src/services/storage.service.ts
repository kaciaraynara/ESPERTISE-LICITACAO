import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { prisma } from '../database/prisma';

export interface UploadResult {
  storageKey: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export class StorageService {
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly isConfigured: boolean;
  private readonly localFallbackDir: string;
  private blobTableReady = false;

  private async ensureBlobTable(): Promise<boolean> {
    if (this.blobTableReady) return true;
    if (!process.env.DATABASE_URL) return false;
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS storage_blobs (
          storage_key TEXT PRIMARY KEY,
          mime_type TEXT,
          data BYTEA NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      this.blobTableReady = true;
      return true;
    } catch {
      return false;
    }
  }

  constructor() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    const region = process.env.AWS_REGION || 'auto'; // Cloudflare R2 usa 'auto'
    const endpoint = process.env.S3_ENDPOINT_URL || process.env.AWS_ENDPOINT || process.env.S3_ENDPOINT;
    this.bucketName = process.env.AWS_S3_BUCKET?.trim() || process.env.S3_BUCKET_NAME?.trim() || 'expertise-licitatoria-storage';

    this.localFallbackDir = path.resolve(process.cwd(), 'uploads', 'documents');

    if (accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'auto', // Cloudflare R2 usa 'auto'
        endpoint: process.env.S3_ENDPOINT_URL || endpoint, // Fundamental para não ir para a AWS
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.isConfigured = true;
      console.info(`[StorageService] Armazenamento Cloudflare R2 / S3-Compatible configurado (${endpoint ? 'endpoint customizado' : 'padrão'}).`);
    } else {
      this.isConfigured = false;
      // Garante diretório local para desenvolvimento seguro sem travar ambiente local
      if (!fs.existsSync(this.localFallbackDir)) {
        fs.mkdirSync(this.localFallbackDir, { recursive: true });
      }
      console.warn('[StorageService] AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY não configurados. Usando armazenamento local isolado (dev/fallback).');
    }
  }

  /**
   * Sanitiza o nome do arquivo para padrão seguro de storage
   */
  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  /**
   * Realiza o upload do arquivo para o S3 (ou fallback local em dev)
   * e retorna metadados + chave de armazenamento segura.
   */
  async uploadFile(options: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    userId: string;
    folder?: string;
  }): Promise<UploadResult> {
    const { buffer, originalName, mimeType, userId, folder = 'documents' } = options;
    const sanitizedName = this.sanitizeFileName(originalName);
    const timestamp = Date.now();
    const storageKey = `${folder}/${userId}/${timestamp}-${sanitizedName}`;
    const fileSize = buffer.length;

    if (this.isConfigured && this.s3Client) {
      // 1. Upload Oficial AWS S3 / Cloud Object Storage
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
        Metadata: {
          originalName: encodeURIComponent(originalName),
          uploadedBy: userId,
          timestamp: String(timestamp),
        },
      });

      await this.s3Client.send(command);

      // Gera a URL pré-assinada ou endpoint seguro
      const url = await this.getPresignedDownloadUrl(storageKey, 86400); // 24h

      return {
        storageKey,
        url,
        fileName: originalName,
        fileSize,
        mimeType,
      };
    }

    // 2. Fallback de Desenvolvimento Local (quando sem credenciais AWS)
    const exactLocalPath = path.join(this.localFallbackDir, ...storageKey.split('/'));
    const exactDir = path.dirname(exactLocalPath);
    if (!fs.existsSync(exactDir)) {
      fs.mkdirSync(exactDir, { recursive: true });
    }
    fs.writeFileSync(exactLocalPath, buffer);

    // Também grava no caminho por usuário para compatibilidade histórica
    const userDir = path.join(this.localFallbackDir, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    const legacyPath = path.join(userDir, `${timestamp}-${sanitizedName}`);
    try {
      if (legacyPath !== exactLocalPath) {
        fs.writeFileSync(legacyPath, buffer);
      }
    } catch {}

    // Persistência segura no PostgreSQL quando S3/R2 não estiver configurado (proteção contra disco efêmero)
    if (buffer.length <= 8 * 1024 * 1024) {
      try {
        const ready = await this.ensureBlobTable();
        if (ready) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO storage_blobs (storage_key, mime_type, data)
             VALUES ($1, $2, $3)
             ON CONFLICT (storage_key) DO UPDATE SET mime_type = EXCLUDED.mime_type, data = EXCLUDED.data`,
            storageKey,
            mimeType || 'application/octet-stream',
            buffer,
          );
        }
      } catch (dbErr: any) {
        console.warn('[StorageService] Aviso ao persistir blob no banco:', dbErr?.message);
      }
    }

    const url = `/api/v1/documentos/download-local/${encodeURIComponent(storageKey)}`;

    return {
      storageKey,
      url,
      fileName: originalName,
      fileSize,
      mimeType,
    };
  }

  /**
   * Obtém URL assinada temporária para download seguro do S3
   */
  async getPresignedDownloadUrl(storageKey: string, expiresInSeconds = 3600): Promise<string> {
    if (this.isConfigured && this.s3Client) {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      });

      return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    }

    return `/api/v1/documentos/download-local/${encodeURIComponent(storageKey)}`;
  }

  /**
   * Obtém o stream ou buffer do arquivo (usado no endpoint de download direto)
   */
  async getFileBuffer(storageKey: string): Promise<{ buffer: Buffer; mimeType?: string }> {
    if (this.isConfigured && this.s3Client) {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      });

      const response = await this.s3Client.send(command);
      const byteArray = await response.Body?.transformToByteArray();
      if (!byteArray) {
        throw new Error('STORAGE_FILE_EMPTY:Arquivo vazio no S3.');
      }

      return {
        buffer: Buffer.from(byteArray),
        mimeType: response.ContentType,
      };
    }

    // Leitura local em modo fallback - busca em múltiplos caminhos candidatos
    const candidatePaths = [
      path.join(this.localFallbackDir, ...storageKey.split('/')),
      path.join(this.localFallbackDir, ...storageKey.split('/').slice(1)),
      path.join(this.localFallbackDir, path.basename(storageKey)),
    ];

    let foundPath: string | null = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (!foundPath) {
      const fileName = path.basename(storageKey);
      const findRecursive = (dir: string): string | null => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              const res = findRecursive(full);
              if (res) return res;
            } else if (entry.name === fileName) {
              return full;
            }
          }
        } catch {}
        return null;
      };

      foundPath = findRecursive(this.localFallbackDir);
    }

    if (!foundPath || !fs.existsSync(foundPath)) {
      // Tenta recuperar do banco de dados (proteção contra reinicialização/disco efêmero)
      try {
        const ready = await this.ensureBlobTable();
        if (ready) {
          const rows = await prisma.$queryRawUnsafe<Array<{ mime_type: string | null; data: Buffer | Uint8Array }>>(
            `SELECT mime_type, data FROM storage_blobs WHERE storage_key = $1 LIMIT 1`,
            storageKey,
          );
          if (rows && rows.length > 0 && rows[0]?.data) {
            return {
              buffer: Buffer.from(rows[0].data),
              mimeType: rows[0].mime_type || undefined,
            };
          }
        }
      } catch {}

      throw new Error('STORAGE_FILE_NOT_FOUND:Arquivo não encontrado no armazenamento.');
    }

    return {
      buffer: fs.readFileSync(foundPath),
    };
  }

  /**
   * Remove arquivo do bucket S3 ou do storage local
   */
  async deleteFile(storageKey: string): Promise<void> {
    if (this.isConfigured && this.s3Client) {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      });

      await this.s3Client.send(command);
      return;
    }

    const parts = storageKey.split('/');
    const relativePath = parts.slice(1).join(path.sep);
    const localFilePath = path.join(this.localFallbackDir, relativePath);

    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    try {
      const ready = await this.ensureBlobTable();
      if (ready) {
        await prisma.$executeRawUnsafe(`DELETE FROM storage_blobs WHERE storage_key = $1`, storageKey);
      }
    } catch {}
  }
}

export const storageService = new StorageService();
