import crypto from 'crypto';
import { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { loginSchema, registerSchema } from '../shared/validations';
import { getJwtSecret } from '../shared/runtime-config';
import { logAuthEvent, normalizeAuthEmail } from '../services/auth.service';
import { prisma } from '../database/prisma';
import { authOperationsService, TokenClaims } from '../services/auth-operations.service';
import { ApiError } from '../shared/errors/ApiError';

export const ACCESS_COOKIE_NAME = 'expertise_access_token';
export const REFRESH_COOKIE_NAME = 'expertise_refresh_token';

function getRequestId(req: Request) {
  return req.headers['x-request-id'] || req.headers['x-correlation-id'];
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) return forwardedFor.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

function getAuditContext(req: Request) {
  return { requestId: getRequestId(req), ip: getClientIp(req), userAgent: req.headers['user-agent'] };
}

function getCookieOptions(expiresAt?: string): CookieOptions {
  const options: CookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
  if (process.env.COOKIE_DOMAIN?.trim()) options.domain = process.env.COOKIE_DOMAIN.trim();
  if (expiresAt) options.expires = new Date(expiresAt);
  return options;
}

function setAuthCookies(res: Response, tokens: any) {
  res.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, getCookieOptions(tokens.accessExpiresAt));
  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, getCookieOptions(tokens.refreshExpiresAt));
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE_NAME, getCookieOptions());
  res.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions());
}

function readCookie(req: Request, name: string) {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  return raw.split(';').map(part => part.trim()).map(part => {
    const separator = part.indexOf('=');
    return separator >= 0 ? [part.slice(0, separator), part.slice(separator + 1)] : [part, ''];
  }).find(([key]) => key === name)?.[1];
}

function sendAuthServiceUnavailable(res: Response) {
  return res.status(503).json({
    success: false,
    code: 'AUTH_SERVICE_UNAVAILABLE',
    message: 'O serviço de autenticação está temporariamente indisponível.',
  });
}

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const validatedData = registerSchema.parse(req.body);
      const { publicUser, tokens } = await authOperationsService.registerUser(validatedData);
      
      setAuthCookies(res, tokens);
      await logAuthEvent('REGISTER_SUCCESS', {
        email: publicUser.email, userId: publicUser.id, role: publicUser.role, ...getAuditContext(req),
      });
      await logAuthEvent('LGPD_TERMS_ACCEPTED', {
        email: publicUser.email, userId: publicUser.id, role: publicUser.role, ...getAuditContext(req),
      });

      return res.status(201).json({
        success: true,
        data: {
          user: publicUser,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken, // Necessário para sessão cross-site (Vercel ≠ EC2)
        },
      });
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ success: false, message: 'Dados inválidos', errors: err.errors });
      
      if (
        err.message === 'EMAIL_ALREADY_EXISTS'
        || err.code === 'EMAIL_ALREADY_EXISTS'
        || (
          err.code === 'P2002'
          && String(err.meta?.target ?? '').toLowerCase().includes('email')
        )
      ) {
        const attemptedEmail = typeof req.body?.email === 'string' ? normalizeAuthEmail(req.body.email) : null;
        await logAuthEvent('REGISTER_DUPLICATED_EMAIL', { email: attemptedEmail, reason: 'email_already_exists', ...getAuditContext(req) });
        return res.status(409).json({ success: false, message: 'Já existe uma conta com este email.' });
      }

      if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
          success: false,
          ...(err.code ? { code: err.code } : {}),
          message: err.message,
        });
      }

      console.error('[AUTH] Erro ao registrar usuário:', err?.message || err);
      return sendAuthServiceUnavailable(res);
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, senha } = loginSchema.parse(req.body);
      const { publicUser, tokens } = await authOperationsService.loginUser(email, senha, getAuditContext(req));
      
      setAuthCookies(res, tokens);
      return res.json({
        success: true,
        data: {
          user: publicUser,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken, // Necessário para sessão cross-site (Vercel ≠ EC2)
        },
      });
    } catch (err: any) {
      if (err.name === 'ZodError') return res.status(400).json({ success: false, message: 'Dados inválidos', errors: err.errors });
      
      if (err.message === 'INVALID_CREDENTIALS' || err.message === 'INVALID_PASSWORD_HASH') {
        return res.status(401).json({ success: false, message: err.message === 'INVALID_PASSWORD_HASH' ? 'Não foi possível validar a senha desta conta. Use recuperar senha.' : 'Email ou senha incorretos.' });
      }

      console.error('[AUTH] Erro ao autenticar:', err?.message || err);
      await logAuthEvent('LOGIN_FAILED', { email: typeof req.body?.email === 'string' ? normalizeAuthEmail(req.body.email) : null, reason: 'unexpected_error', ...getAuditContext(req) });
      return sendAuthServiceUnavailable(res);
    }
  }

  async me(req: any, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Usuário não autenticado' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuário não encontrado' });

    return res.json({ success: true, data: authOperationsService.buildPublicUser(user) });
  }

  async updateProfile(req: any, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Não autenticado' });

    try {
      const { nome, telefone, senha } = req.body;
      const dataToUpdate: any = {};
      
      if (typeof nome === 'string' && nome.trim().length >= 2) dataToUpdate.nome = nome.trim();
      if (typeof telefone === 'string') dataToUpdate.telefone = telefone.trim();
      
      if (typeof senha === 'string' && senha.trim().length >= 8) {
        const bcrypt = require('bcryptjs');
        dataToUpdate.passwordHash = await bcrypt.hash(senha, 12);
      }

      if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json({ success: false, message: 'Nenhum dado válido fornecido para atualização' });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: dataToUpdate,
      });

      return res.json({ success: true, data: authOperationsService.buildPublicUser(updatedUser), message: 'Perfil atualizado com sucesso' });
    } catch (err) {
      console.error('[AUTH] updateProfile error:', err);
      return res.status(500).json({ success: false, message: 'Erro ao atualizar perfil' });
    }
  }

  async refresh(req: Request, res: Response) {
    const refreshToken = req.body?.refreshToken || readCookie(req, REFRESH_COOKIE_NAME);
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REFRESH_REQUIRED',
        message: 'Sessão de renovação não informada.',
      });
    }

    let decoded: jwt.JwtPayload & TokenClaims;
    try {
      decoded = jwt.verify(refreshToken, getJwtSecret()) as jwt.JwtPayload & TokenClaims;
      if (decoded.token_type !== 'refresh' || !decoded.id) {
        throw new Error('WRONG_TOKEN_TYPE');
      }
    } catch {
      clearAuthCookies(res);
      await logAuthEvent('TOKEN_INVALID', {
        reason: 'refresh_token_invalid',
        ...getAuditContext(req),
      });
      return res.status(401).json({
        success: false,
        code: 'AUTH_REFRESH_INVALID',
        message: 'Refresh token inválido ou expirado.',
      });
    }

    try {
      const { publicUser, tokens } = await authOperationsService.refreshUser(
        decoded.id,
        refreshToken,
      );

      setAuthCookies(res, tokens);
      await logAuthEvent('TOKEN_REFRESH', {
        email: publicUser.email,
        userId: publicUser.id,
        role: publicUser.role,
        ...getAuditContext(req),
      });

      return res.json({
        success: true,
        data: {
          user: publicUser,
          accessToken: tokens.accessToken,
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        /*
         * Não apagamos cookies quando a sessão já foi consumida: uma renovação
         * concorrente pode ter acabado de gravar o novo cookie no navegador.
         */
        return res.status(err.statusCode).json({
          success: false,
          code: err.code ?? 'AUTH_REFRESH_INVALID',
          message: err.message,
        });
      }

      console.error('[AUTH] Falha de infraestrutura ao renovar sessão.');
      return sendAuthServiceUnavailable(res);
    }
  }

  async logout(req: Request, res: Response) {
    const refreshToken = req.body?.refreshToken || readCookie(req, REFRESH_COOKIE_NAME);
    if (refreshToken) {
      let decoded: (jwt.JwtPayload & TokenClaims) | null = null;
      try {
        decoded = jwt.verify(refreshToken, getJwtSecret()) as jwt.JwtPayload & TokenClaims;
      } catch {
        clearAuthCookies(res);
        return res.json({ success: true });
      }

      if (decoded.token_type === 'refresh' && decoded.id) {
        try {
          await prisma.refreshToken.deleteMany({ where: { userId: decoded.id, tokenHash: authOperationsService.hashToken(refreshToken) } });
          await logAuthEvent('LOGOUT', { userId: decoded.id, ...getAuditContext(req) });
        } catch {
          return sendAuthServiceUnavailable(res);
        }
      }
    }
    clearAuthCookies(res);
    return res.json({ success: true });
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ success: false, message: 'Email inválido' });
      }

      const emailNormalized = email.toLowerCase().trim();
      const user = await prisma.user.findUnique({ where: { emailNormalized } });
      
      if (!user) {
        // Return success anyway for security reasons (don't leak registered emails)
        return res.json({ success: true, message: 'Instruções enviadas' });
      }

      const resetToken = crypto.randomUUID();
      const resetTokenExp = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExp },
      });

      // Enviar email via Resend
      const { enviarRecuperacaoSenha } = require('../services/resend.service');
      await enviarRecuperacaoSenha({
        email: user.email,
        nome: user.nome || 'Usuário',
        token: resetToken,
      }).catch((e: any) => console.error('[AUTH] Falha ao enviar e-mail de recuperação:', e));

      console.log(`[AUTH] Password reset token generated for ${user.email}: ${resetToken}`);

      return res.json({
        success: true,
        message: 'Instruções enviadas',
        // devToken omitido em produção por segurança
        ...(process.env.NODE_ENV !== 'production' ? { devToken: resetToken } : {}),
      });
    } catch (err) {
      console.error('[AUTH] forgotPassword error:', err);
      return res.status(500).json({ success: false, message: 'Erro interno' });
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, senha } = req.body;
      if (!token || typeof token !== 'string' || !senha || typeof senha !== 'string') {
        return res.status(400).json({ success: false, message: 'Dados inválidos' });
      }

      if (senha.length < 8) {
        return res.status(400).json({ success: false, message: 'Senha muito curta' });
      }

      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExp: { gt: new Date() },
        },
      });

      if (!user) {
        return res.status(400).json({ success: false, message: 'Token inválido ou expirado' });
      }

      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(senha, 12);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetToken: null,
          resetTokenExp: null,
        },
      });

      return res.json({ success: true, message: 'Senha alterada com sucesso' });
    } catch (err) {
      console.error('[AUTH] resetPassword error:', err);
      return res.status(500).json({ success: false, message: 'Erro interno' });
    }
  }

  // --- LGPD Endpoints ---
  async exportData(req: any, res: Response) {
    try {
      const data = await authOperationsService.exportUserData(req.user.id);
      return res.json({ success: true, data });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }

  async deleteAccount(req: any, res: Response) {
    try {
      await authOperationsService.deleteUserAccount(req.user.id);
      clearAuthCookies(res);
      await logAuthEvent('LGPD_ACCOUNT_DELETED', {
        userId: req.user.id, ...getAuditContext(req as Request)
      });
      return res.json({ success: true, message: 'Conta excluída com sucesso e dados marcados para anonimização.' });
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }
  }
}
