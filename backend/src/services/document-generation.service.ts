import PDFDocument from 'pdfkit';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import { prisma } from '../database/prisma';

export type OutputFormat = 'pdf' | 'docx';

export interface DocumentGenerationOptions {
  templateId: string;
  format: OutputFormat;
  mergeData: Record<string, string>;
  tenantId?: string;
}

export class DocumentGenerationService {
  /**
   * Pega o template do banco, substitui as variáveis e gera o binário (Buffer) no formato escolhido.
   */
  async generateDocument(options: DocumentGenerationOptions): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const template = await prisma.documentTemplate.findFirst({
      where: {
        id: options.templateId,
        active: true,
        OR: [{ tenantId: null }, { tenantId: options.tenantId }],
      },
    });

    if (!template) {
      throw new Error('Template não encontrado ou inativo.');
    }

    let content = template.contentTemplate;

    // Replace all mergeTags (e.g. {{nome_empresa}}) with actual data
    if (template.mergeTags && typeof template.mergeTags === 'object') {
      const tags = Object.keys(template.mergeTags);
      for (const tag of tags) {
        const regex = new RegExp(`{{\\s*${tag}\\s*}}`, 'g');
        const value = options.mergeData[tag] || '';
        content = content.replace(regex, value);
      }
    }
    
    // Also try to replace anything else that might be in options.mergeData but not officially in mergeTags JSON
    for (const [key, value] of Object.entries(options.mergeData)) {
       const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
       content = content.replace(regex, value);
    }

    if (options.format === 'pdf') {
      const buffer = await this.generatePDF(content);
      return {
        buffer,
        mimeType: 'application/pdf',
        filename: `${template.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
      };
    } else {
      const buffer = await this.generateDOCX(content);
      return {
        buffer,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        filename: `${template.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`,
      };
    }
  }

  private generatePDF(text: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });

        // Basic formatting
        const lines = text.split('\n');
        for (const line of lines) {
          doc.font('Helvetica').fontSize(12).text(line, { align: 'justify' });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private async generateDOCX(text: string): Promise<Buffer> {
    const lines = text.split('\n');
    const paragraphs = lines.map(line => {
      return new Paragraph({
        children: [
          new TextRun({
            text: line,
            size: 24, // 24 half-points = 12pt
          }),
        ],
      });
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return buffer as Buffer;
  }
}

export const documentGenerationService = new DocumentGenerationService();
