import { prisma } from '../database/prisma';
// Sem Supabase - Arquivos no banco Neon
import { ApiError } from '../shared/errors/ApiError';

export type DocumentoWithUrl = {
  id: string;
  user_id: string;
  url?: string | null;
};

export class DocumentosService {
  private async getTenantId(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      throw new ApiError('Conta não encontrada ou inativa.', 401, 'ACCOUNT_UNAVAILABLE');
    }

    return user.tenantId;
  }

  private async assertCompanyInTenant(tenantId: string, companyId?: string | null) {
    if (!companyId) {
      throw new ApiError('Selecione uma empresa para vincular o documento.', 400);
    }

    const company = await prisma.company.findFirst({
      where: { id: companyId, tenantId },
      select: { id: true },
    });

    if (!company) {
      throw new ApiError('Empresa não encontrada neste workspace.', 404);
    }
  }

  private resolveStatus(validade?: Date | null) {
    if (!validade) return 'sem_validade';

    const daysRemaining = Math.ceil(
      (validade.getTime() - Date.now()) / 86_400_000,
    );

    if (daysRemaining < 0) return 'vencido';
    if (daysRemaining <= 30) return 'atencao';
    return 'valido';
  }

  private stripKnownExtension(fileName: string) {
    return fileName.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
  }

  private mapDocumento(doc: any) {
    return {
      id: doc.id,
      user_id: doc.userId,
      empresa_id: doc.companyId,
      tipo: doc.tipo,
      nome: doc.nome,
      validade: doc.validade ? doc.validade.toISOString() : null,
      status: this.resolveStatus(doc.validade),
      url: `/api/v1/documentos/${doc.id}/download`,
      arquivo_nome: doc.arquivoNome,
      criado_em: doc.criadoEm.toISOString(),
      atualizado_em: doc.atualizadoEm.toISOString(),
    };
  }



  async listar(userId: string, empresaId?: string) {
    const tenantId = await this.getTenantId(userId);
    if (empresaId) {
      await this.assertCompanyInTenant(tenantId, empresaId);
    }

    const dbDocs = await prisma.document.findMany({
      where: {
        company: { tenantId },
        ...(empresaId ? { companyId: empresaId } : {})
      },
      orderBy: { atualizadoEm: 'desc' }
    });

    return dbDocs.map(doc => this.mapDocumento(doc));
  }

  async criar(userId: string, data: any, file?: Express.Multer.File) {
    const tenantId = await this.getTenantId(userId);
    await this.assertCompanyInTenant(tenantId, data.empresa_id);

    if (!file) {
      throw new ApiError('Selecione um arquivo para cadastrar o documento.', 400);
    }



    const nome = data.nome || this.stripKnownExtension(file.originalname);
    const arquivoNome = file.originalname;

    const dbDoc = await prisma.document.create({
      data: {
        userId,
        companyId: data.empresa_id || null,
        tipo: data.tipo,
        nome,
        validade: data.validade ? new Date(data.validade) : null,
        status: 'valido',
        arquivoNome,
        fileData: file.buffer as any,
        fileMimeType: file.mimetype,
      },
    });

    return this.mapDocumento(dbDoc);
  }

  async remover(userId: string, docId: string) {
    const tenantId = await this.getTenantId(userId);
    const doc = await prisma.document.findFirst({
      where: {
        id: docId,
        company: { tenantId },
      },
    });
    if (!doc) {
      throw new ApiError('Documento não encontrado', 404);
    }
    await prisma.document.delete({ where: { id: doc.id } });
  }
}

export const documentosService = new DocumentosService();





