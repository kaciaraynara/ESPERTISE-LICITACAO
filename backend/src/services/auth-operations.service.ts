import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import axios from 'axios';
import { getJwtSecret } from '../shared/runtime-config';
import { consultarCnpjOficial } from './cnpj.service';
import { isValidPasswordHash, logAuthEvent, normalizeAuthEmail } from './auth.service';
import { prisma } from '../database/prisma';
import { ApiError } from '../shared/errors/ApiError';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

export type AuthUser = {
  id: string;
  tenant_id: string;
  email: string;
  nome: string | null;
  telefone: string | null;
  plano: string;
  email_verificado: boolean;
  ultimo_acesso: string | null;
  created_at: string;
  role?: 'fornecedor';
  oab_numero?: string | null;
  oab_uf?: string | null;
  crc_numero?: string | null;
  crc_uf?: string | null;
};

export type TokenClaims = AuthUser & {
  token_type: 'access' | 'refresh';
};

export class AuthOperationsService {
  public hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  public buildPublicUser(user: any): AuthUser {
    return {
      id: user.id,
      tenant_id: user.tenantId,
      email: normalizeAuthEmail(user.emailNormalized || user.email),
      nome: user.nome,
      telefone: user.telefone,
      plano: user.plano,
      email_verificado: user.emailVerificado,
      ultimo_acesso: user.ultimoAcesso ? user.ultimoAcesso.toISOString() : null,
      created_at: user.createdAt.toISOString(),
      role: user.role,
      oab_numero: user.oabNumero ?? null,
      oab_uf: user.oabUf ?? null,
      crc_numero: user.crcNumero ?? null,
      crc_uf: user.crcUf ?? null,
    };
  }

  public issueTokens(user: AuthUser) {
    const jwtSecret = getJwtSecret();

    const accessPayload: TokenClaims = { ...user, token_type: 'access' };
    const refreshPayload: TokenClaims = { ...user, token_type: 'refresh' };

    const accessToken = jwt.sign(accessPayload, jwtSecret, {
      expiresIn: JWT_EXPIRES_IN as any,
      jwtid: randomUUID(),
    });
    const refreshToken = jwt.sign(refreshPayload, jwtSecret, {
      expiresIn: JWT_REFRESH_EXPIRES_IN as any,
      jwtid: randomUUID(),
    });

    return {
      accessToken,
      refreshToken,
      accessExpiresAt: this.resolveTokenExpiry(accessToken),
      refreshExpiresAt: this.resolveTokenExpiry(refreshToken),
    };
  }

  public resolveTokenExpiry(token: string) {
    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    return decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString();
  }

  async registerUser(validatedData: any) {
    const {
      email,
      nome,
      senha,
      telefone,
      aceite_lgpd,
      cnpj,
    } = validatedData;
    const emailNormalized = normalizeAuthEmail(email);

    const existingUser = await prisma.user.findUnique({
      where: { emailNormalized },
      select: { id: true },
    });
    if (existingUser) {
      throw new ApiError(
        'Já existe uma conta com este email.',
        409,
        'EMAIL_ALREADY_EXISTS',
      );
    }

    let empresaOficial;
    try {
      empresaOficial = await consultarCnpjOficial(cnpj);
    } catch (companyError: any) {
      if (axios.isAxiosError(companyError) && companyError.response?.status === 404) {
        throw new ApiError(
          'CNPJ não encontrado na fonte oficial.',
          422,
          'CNPJ_NOT_FOUND',
        );
      }

      if (
        companyError?.message === 'CNPJ_INVALIDO'
        || (axios.isAxiosError(companyError) && companyError.response?.status === 400)
      ) {
        throw new ApiError(
          'O CNPJ informado é inválido.',
          400,
          'CNPJ_INVALID',
        );
      }

      throw new ApiError(
        'Não foi possível validar o CNPJ na fonte oficial. Tente novamente em instantes.',
        503,
        axios.isAxiosError(companyError) && companyError.response?.status === 429
          ? 'CNPJ_RATE_LIMITED'
          : 'CNPJ_SERVICE_UNAVAILABLE',
      );
    }

    const cleanCnpj = empresaOficial.cnpj.replace(/\D/g, '');
    if (
      cleanCnpj.length !== 14
      || cleanCnpj !== String(cnpj).replace(/\D/g, '')
      || !empresaOficial.razao_social?.trim()
    ) {
      throw new ApiError(
        'A fonte oficial retornou dados incompletos para o CNPJ informado.',
        503,
        'CNPJ_INVALID_RESPONSE',
      );
    }

    const hashedPassword = await bcrypt.hash(senha, BCRYPT_ROUNDS);

    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: empresaOficial.razao_social.trim(),
          slug: `workspace-${randomUUID()}`,
        },
      });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: emailNormalized,
          emailNormalized,
          nome: nome.trim(),
          telefone: telefone?.trim() || null,
          plano: 'free',
          passwordHash: hashedPassword,
          aceiteLgpd: aceite_lgpd,
          ultimoAcesso: new Date(),
          role: 'fornecedor',
          oabNumero: null,
          oabUf: null,
          crcNumero: null,
          crcUf: null,
        },
      });

      await tx.company.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          cnpj: cleanCnpj,
          razaoSocial: empresaOficial.razao_social.trim(),
          nomeFantasia: empresaOficial.nome_fantasia?.trim() || null,
          cnaePrincipal: empresaOficial.cnae_principal,
          municipio: empresaOficial.municipio,
          uf: empresaOficial.uf,
          status: empresaOficial.status,
        },
      });

      await tx.notification.create({
        data: {
          userId: user.id,
          tipo: 'empresa_configurada',
          titulo: 'Empresa vinculada com sucesso',
          mensagem: `${empresaOficial.razao_social.trim()} foi vinculada à conta.`,
          link: '/fornecedor/dashboard',
          status: 'enviada',
          enviadaEm: new Date(),
          lida: false,
        },
      });

      const publicUser = this.buildPublicUser(user);
      const tokens = this.issueTokens(publicUser);

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(tokens.refreshToken),
          expiresAt: new Date(tokens.refreshExpiresAt),
        },
      });

      return { publicUser, tokens };
    });
  }

  async loginUser(email: string, senha: string, auditContext: any) {
    const emailNormalized = normalizeAuthEmail(email);
    const user = await prisma.user.findUnique({ where: { emailNormalized } });
    
    if (!user || user.deletedAt) {
      await logAuthEvent('LOGIN_FAILED', { email: emailNormalized, reason: 'user_not_found', ...auditContext });
      throw new Error('INVALID_CREDENTIALS');
    }

    if (!isValidPasswordHash(user.passwordHash)) {
      await logAuthEvent('LOGIN_FAILED', { email: emailNormalized, userId: user.id, role: user.role, reason: 'invalid_password_hash', ...auditContext });
      throw new Error('INVALID_PASSWORD_HASH');
    }

    const passwordMatches = await bcrypt.compare(senha, user.passwordHash);
    if (!passwordMatches) {
      await logAuthEvent('LOGIN_FAILED', { email: emailNormalized, userId: user.id, role: user.role, reason: 'password_mismatch', ...auditContext });
      throw new Error('INVALID_CREDENTIALS');
    }

    const refreshedUser = await prisma.user.update({ where: { id: user.id }, data: { ultimoAcesso: new Date() } });
    const publicUser = this.buildPublicUser(refreshedUser);
    const tokens = this.issueTokens(publicUser);
    
    await prisma.refreshToken.deleteMany({
      where: { OR: [{ userId: user.id }, { expiresAt: { lte: new Date() } }] }
    });
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: this.hashToken(tokens.refreshToken), expiresAt: new Date(tokens.refreshExpiresAt) }
    });

    await logAuthEvent('LOGIN_SUCCESS', { email: publicUser.email, userId: publicUser.id, role: publicUser.role, ...auditContext });
    return { publicUser, tokens };
  }

  async refreshUser(userId: string, refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    return prisma.$transaction(async (tx) => {
      const session = await tx.refreshToken.findUnique({
        where: {
          userId_tokenHash: {
            userId,
            tokenHash,
          },
        },
      });

      if (!session || session.expiresAt <= new Date()) {
        throw new ApiError(
          'Refresh token inválido ou expirado.',
          401,
          'AUTH_REFRESH_INVALID',
        );
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.deletedAt) {
        throw new ApiError(
          'A conta associada a esta sessão não está disponível.',
          401,
          'AUTH_REFRESH_INVALID',
        );
      }

      const consumed = await tx.refreshToken.deleteMany({
        where: {
          id: session.id,
          userId,
          tokenHash,
        },
      });
      if (consumed.count !== 1) {
        throw new ApiError(
          'A sessão já está sendo renovada por outra requisição.',
          409,
          'AUTH_REFRESH_CONFLICT',
        );
      }

      const refreshedUser = await tx.user.update({
        where: { id: user.id },
        data: { ultimoAcesso: new Date() },
      });
      const publicUser = this.buildPublicUser(refreshedUser);
      const tokens = this.issueTokens(publicUser);

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(tokens.refreshToken),
          expiresAt: new Date(tokens.refreshExpiresAt),
        },
      });

      return { publicUser, tokens };
    });
  }

  // --- LGPD Compliance ---
  
  async exportUserData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: true,
      },
    });

    if (!user) throw new ApiError('Usuário não encontrado.', 404);

    // Strip sensitive fields like passwordHash
    const { passwordHash, ...safeUserData } = user;
    return safeUserData;
  }

  async deleteUserAccount(userId: string) {
    // Soft Delete para manter integridade, auditoria e futura anonimização (LGPD job)
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    // Remove all refresh tokens to force immediate logout
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
}

export const authOperationsService = new AuthOperationsService();
