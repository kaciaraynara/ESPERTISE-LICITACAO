import { Request, Response } from 'express';
import axios from 'axios';
import * as crypto from 'crypto';

/**
 * Gov.br OAuth2 — Autenticação via PKCE
 * Documentação oficial: https://manual-roteiro-integracao-login-unico.servicos.gov.br/
 *
 *   Configure no .env:
 *   GOVBR_CLIENT_ID       → Obtido em: https://www.governodigital.gov.br/transformacao/servicos/login-unico
 *   GOVBR_CLIENT_SECRET   → Obtido junto ao client_id
 *   GOVBR_BASE_URL        → https://sso.acesso.gov.br
 *   GOVBR_REDIRECT_URI    → http://localhost:3001/api/govbr/callback (ou URL de prod)
 */

interface GovBrTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token?: string;
  refresh_token?: string;
}

interface GovBrUserInfo {
  sub: string;          // CPF
  name: string;
  email?: string;
  phone_number?: string;
  email_verified?: boolean;
  picture?: string;
  amr?: string[];       // Nível de autenticação
}

// Mapa temporário para armazenar code_verifier por state (em prod use Redis)
const stateMap = new Map<string, { codeVerifier: string; redirectFrontend: string }>();

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generatePKCE() {
  const codeVerifier = base64urlEncode(crypto.randomBytes(32));
  const codeChallenge = base64urlEncode(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );
  return { codeVerifier, codeChallenge };
}

export class GovBrOAuthController {

  /**
   * GET /api/govbr/autorizar
   * Inicia o fluxo OAuth2 PKCE — redireciona para Gov.br
   * Query: ?redirect_to=/dashboard (URL do frontend após login)
   */
  iniciarLogin(req: Request, res: Response) {
    const clientId = process.env.GOVBR_CLIENT_ID;
    const baseUrl  = process.env.GOVBR_BASE_URL || 'https://sso.acesso.gov.br';
    const redirectUri = process.env.GOVBR_REDIRECT_URI || `http://localhost:3001/api/govbr/callback`;
    const redirectFrontend = (req.query.redirect_to as string) || '/dashboard';

    if (!clientId) {
      return res.status(503).json({
        success: false,
        message: 'Gov.br OAuth não configurado. Adicione GOVBR_CLIENT_ID no .env',
        setup_url: 'https://www.governodigital.gov.br/transformacao/servicos/login-unico',
      });
    }

    const state = crypto.randomBytes(16).toString('hex');
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Salva para verificação no callback
    stateMap.set(state, { codeVerifier, redirectFrontend });
    setTimeout(() => stateMap.delete(state), 10 * 60 * 1000); // TTL 10min

    const params = new URLSearchParams({
      response_type: 'code',
      client_id:       clientId,
      scope:           'openid email phone profile govbr_confiabilidades',
      redirect_uri:    redirectUri,
      nonce:           crypto.randomBytes(8).toString('hex'),
      state,
      code_challenge:        codeChallenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${baseUrl}/authorize?${params.toString()}`;
    return res.redirect(authUrl);
  }

  /**
   * GET /api/govbr/callback
   * Recebe o código de autorização e troca por token
   */
  async callback(req: Request, res: Response) {
    const { code, state, error } = req.query as Record<string, string>;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';

    if (error) {
      return res.redirect(`${frontendUrl}/login?erro=${encodeURIComponent(error)}`);
    }

    const stateData = stateMap.get(state);
    if (!stateData) {
      return res.redirect(`${frontendUrl}/login?erro=state_invalido`);
    }
    stateMap.delete(state);

    try {
      const clientId     = process.env.GOVBR_CLIENT_ID!;
      const clientSecret = process.env.GOVBR_CLIENT_SECRET!;
      const baseUrl      = process.env.GOVBR_BASE_URL || 'https://sso.acesso.gov.br';
      const redirectUri  = process.env.GOVBR_REDIRECT_URI || `http://localhost:3001/api/govbr/callback`;

      // 1. Troca code por token
      const tokenResp = await axios.post<GovBrTokenResponse>(
        `${baseUrl}/token`,
        new URLSearchParams({
          grant_type:    'authorization_code',
          code,
          redirect_uri:  redirectUri,
          code_verifier: stateData.codeVerifier,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          },
        }
      );

      const { access_token } = tokenResp.data;

      // 2. Busca dados do usuário
      const userResp = await axios.get<GovBrUserInfo>(`${baseUrl}/userinfo`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const user = userResp.data;

      // A identidade Gov.br foi validada, mas o sistema ainda precisa vinculá-la
      // transacionalmente a um User/Tenant existente. Não emitimos sessão local
      // até que esse vínculo persistente esteja implementado.
      void user;
      return res.redirect(`${frontendUrl}/login?erro=govbr_vinculo_indisponivel`);

    } catch (err: any) {
      console.error('[Gov.br OAuth] Erro no callback:', err?.response?.data || err.message);
      return res.redirect(`${frontendUrl}/login?erro=govbr_falha`);
    }
  }

  /**
   * POST /api/govbr/token-check
   * Valida um token Gov.br e retorna os dados do usuário
   */
  async verificarToken(req: Request, res: Response) {
    void req;
    return res.status(503).json({
      success: false,
      code: 'GOVBR_ACCOUNT_LINK_UNAVAILABLE',
      message: 'O vínculo de conta Gov.br ainda não está disponível.',
    });
  }

  /**
   * GET /api/govbr/url-login
   * Retorna apenas a URL de login Gov.br (para o frontend redirecionar)
   */
  getLoginUrl(req: Request, res: Response) {
    const clientId = process.env.GOVBR_CLIENT_ID;
    const baseUrl  = process.env.GOVBR_BASE_URL || 'https://sso.acesso.gov.br';
    const redirectUri = process.env.GOVBR_REDIRECT_URI || `http://localhost:3001/api/govbr/callback`;

    if (!clientId) {
      return res.json({
        success: false,
        configured: false,
        setup_url: 'https://www.governodigital.gov.br/transformacao/servicos/login-unico',
        message: 'Gov.br não configurado',
      });
    }

    const state = crypto.randomBytes(16).toString('hex');
    const { codeVerifier, codeChallenge } = generatePKCE();
    stateMap.set(state, { codeVerifier, redirectFrontend: '/dashboard' });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'openid email phone profile govbr_confiabilidades',
      redirect_uri: redirectUri,
      nonce: crypto.randomBytes(8).toString('hex'),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return res.json({
      success: true,
      configured: true,
      url: `${baseUrl}/authorize?${params.toString()}`,
    });
  }
}
