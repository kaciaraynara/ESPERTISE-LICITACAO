import { Resend } from 'resend';
import nodemailer from 'nodemailer';

const FROM_NAME = 'Expertise Licitatoria';
const DEFAULT_FROM_EMAIL = 'contato@expertiselicitatoria.com.br';
const DEFAULT_APP_URL = 'https://expertiselicitatoria.com.br';

function getAppUrl(): string {
  return (process.env.FRONTEND_URL || DEFAULT_APP_URL).replace(/\/+$/, '');
}

function getFromHeader(): string {
  const envFrom = process.env.EMAIL_FROM?.trim();
  if (envFrom) {
    if (envFrom.includes('<') && envFrom.includes('>')) {
      return envFrom;
    }
    return `${FROM_NAME} <${envFrom}>`;
  }
  return `${FROM_NAME} <${DEFAULT_FROM_EMAIL}>`;
}

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; id?: string; error?: string }> {
  const fromHeader = getFromHeader();

  // 1. Provedor SMTP (se configurado)
  const smtpHost = process.env.SMTP_HOST?.trim();
  if (smtpHost) {
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production' && process.env.SMTP_IGNORE_TLS !== 'true',
        },
      });

      const info = await transporter.sendMail({
        from: fromHeader,
        to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
        subject: payload.subject,
        html: payload.html,
        replyTo: payload.replyTo,
      });

      console.log(`[Email-SMTP] Enviado para ${payload.to}. MessageId: ${info.messageId}`);
      return { success: true, id: info.messageId };
    } catch (err: any) {
      console.error('[Email-SMTP] Erro:', err?.message);
      throw new Error(`SMTP_DELIVERY_FAILED: ${err?.message || 'Falha SMTP'}`);
    }
  }

  // 2. Provedor Resend SDK oficial
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (resendApiKey) {
    const resend = new Resend(resendApiKey);
    const toAddresses = Array.isArray(payload.to) ? payload.to : [payload.to];

    try {
      const { data, error } = await resend.emails.send({
        from: fromHeader,
        to: toAddresses,
        subject: payload.subject,
        html: payload.html,
        ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
      });

      if (error) {
        // Fallback automatico se o dominio customizado ainda nao estiver verificado no Resend
        if (
          String(error.message || '').toLowerCase().includes('domain') ||
          String(error.message || '').toLowerCase().includes('verify')
        ) {
          console.warn('[Email-Resend] Dominio ainda nao verificado, tentando fallback onboarding@resend.dev...');
          const retry = await resend.emails.send({
            from: `${FROM_NAME} <onboarding@resend.dev>`,
            to: toAddresses,
            subject: payload.subject,
            html: payload.html,
            ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
          });
          if (!retry.error) {
            return { success: true, id: retry.data?.id };
          }
        }
        throw new Error(`RESEND_DELIVERY_FAILED: ${error.message}`);
      }

      console.log(`[Email-Resend] Enviado para ${toAddresses.join(', ')}. ID: ${data?.id}`);
      return { success: true, id: data?.id };
    } catch (err: any) {
      console.error('[Email-Resend] Erro:', err?.message);
      throw new Error(`RESEND_DELIVERY_FAILED: ${err?.message || 'Falha no envio via Resend'}`);
    }
  }

  console.warn('[Email] Nenhum provedor configurado (RESEND_API_KEY ou SMTP_HOST).');
  if (process.env.NODE_ENV === 'production') {
    throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  }
  return { success: false, error: 'EMAIL_PROVIDER_NOT_CONFIGURED' };
}

function templateBase(content: string): string {
  const appUrl = getAppUrl();
  const logoUrl = `${appUrl}/assets/logo-expertise.png`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F1F5F9; color: #0F172A; }
    .container { max-width: 600px; margin: 28px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2E8F0; }
    .header { background: #081C3A; padding: 24px 32px; text-align: center; border-bottom: 4px solid #F97316; }
    .header img { max-height: 48px; width: auto; }
    .header p { color: #CBD5E1; font-size: 12px; margin-top: 8px; }
    .body { padding: 32px; }
    .btn { display: inline-block; background: #F97316; color: #FFFFFF !important; text-decoration: none; padding: 13px 26px; border-radius: 10px; font-weight: 700; font-size: 14px; margin-top: 18px; }
    .btn-blue { background: #081C3A; }
    .alert-box { background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 10px; padding: 16px; margin: 16px 0; }
    .alert-box.danger { background: #FEF2F2; border-color: #FECACA; }
    .alert-box.success { background: #ECFDF5; border-color: #A7F3D0; }
    .footer { background: #F8FAFC; padding: 20px 32px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; }
    .tag { display: inline-block; background: #EFF6FF; color: #081C3A; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 20px; border: 1px solid #BFDBFE; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="Expertise Licitatoria" />
      <p>Precisao em Dados, Eficiencia em Licitacoes</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      Expertise Licitatoria · <a href="${appUrl}" style="color:#0070C0;font-weight:700;">Acessar plataforma</a><br/>
      Voce esta recebendo este e-mail por possuir cadastro ativo na plataforma.
    </div>
  </div>
</body>
</html>`;
}

export async function enviarBoasVindas(params: { nome: string; email: string; plano: string }) {
  const appUrl = getAppUrl();
  const html = templateBase(`
    <h2 style="font-size:22px;font-weight:800;margin-bottom:8px;color:#081C3A;">Bem-vindo a Expertise Licitatoria, ${params.nome}!</h2>
    <p style="color:#475569;line-height:1.6;margin-bottom:16px;">Sua conta foi criada com sucesso. Voce ja pode acessar o Radar de Licitacoes e a Luli Central Investigativa.</p>
    <div class="alert-box success">
      <strong>Plano ${params.plano} ativado</strong><br/>
      <span style="font-size:13px;color:#334155;">Configure sua empresa e CNAEs para receber oportunidades diarias automaticamente.</span>
    </div>
    <a href="${appUrl}/dashboard" class="btn">Acessar minha plataforma</a>
  `);

  return sendEmail({ to: params.email, subject: `Bem-vindo a Expertise Licitatoria, ${params.nome}`, html });
}

export async function enviarAlertaCertidao(params: {
  email: string;
  nome: string;
  certidao: string;
  diasRestantes: number;
  validade: string;
  linkRenovacao: string;
}) {
  const appUrl = getAppUrl();
  const { diasRestantes } = params;
  const isCritico = diasRestantes <= 7;

  const html = templateBase(`
    <h2 style="font-size:20px;font-weight:800;margin-bottom:8px;color:#081C3A;">Atencao: certidao proxima do vencimento</h2>
    <p style="color:#475569;margin-bottom:16px;">Ola, <strong>${params.nome}</strong>! Uma certidao da sua empresa precisa de renovacao.</p>
    <div class="alert-box ${isCritico ? 'danger' : ''}">
      <strong>${params.certidao}</strong><br/>
      <span style="font-size:13px;">Validade: <strong>${new Date(params.validade).toLocaleDateString('pt-BR')}</strong> | <strong>${diasRestantes} dia(s) restante(s)</strong></span>
    </div>
    <a href="${params.linkRenovacao}" class="btn">Renovar certidao</a>
    <a href="${appUrl}/documentos" class="btn btn-blue" style="margin-left:8px;">Ver no Cofre</a>
  `);

  return sendEmail({
    to: params.email,
    subject: `[Alerta] ${params.certidao} vence em ${diasRestantes} dias - Expertise Licitatoria`,
    html,
  });
}

export async function enviarAlertaEdital(params: {
  email: string;
  nome: string;
  edital: { objeto: string; orgao: string; valor?: number; prazo: string; link?: string };
  score: number;
}) {
  const appUrl = getAppUrl();
  const { edital, score } = params;
  const valor = edital.valor ? `R$ ${edital.valor.toLocaleString('pt-BR')}` : 'Sob consulta';
  const cor = score >= 80 ? '#16A34A' : score >= 60 ? '#0070C0' : '#D97706';

  const html = templateBase(`
    <h2 style="font-size:20px;font-weight:800;margin-bottom:8px;color:#081C3A;">Novo edital compativel encontrado</h2>
    <p style="color:#475569;margin-bottom:12px;">Ola, <strong>${params.nome}</strong>! O Radar identificou uma oportunidade aderente a sua empresa.</p>
    <div style="border:2px solid ${cor};border-radius:12px;padding:16px;margin:16px 0;">
      <span class="tag">Viabilidade ${score}/100</span>
      <h3 style="font-size:15px;font-weight:700;color:#081C3A;margin:10px 0 6px;">${edital.objeto}</h3>
      <p style="font-size:13px;color:#475569;">${edital.orgao}</p>
      <p style="font-size:16px;font-weight:800;color:${cor};margin-top:8px;">${valor}</p>
    </div>
    <a href="${edital.link || `${appUrl}/licitacoes`}" class="btn">Analisar edital com a Luli</a>
  `);

  return sendEmail({
    to: params.email,
    subject: `Novo edital compativel: ${edital.objeto.substring(0, 50)} - Expertise Licitatoria`,
    html,
  });
}

export async function enviarConfirmacaoPagamento(params: {
  email: string;
  nome: string;
  plano: string;
  valor: number;
  proximaCobranca: string;
}) {
  const appUrl = getAppUrl();
  const html = templateBase(`
    <h2 style="font-size:20px;font-weight:800;margin-bottom:8px;color:#081C3A;">Pagamento confirmado</h2>
    <p style="color:#475569;margin-bottom:16px;">Obrigado, <strong>${params.nome}</strong>! Sua assinatura esta ativa.</p>
    <div class="alert-box success">
      <strong>Plano ${params.plano}</strong><br/>
      <span style="font-size:14px;">R$ ${params.valor}/mes · Proxima cobranca: ${new Date(params.proximaCobranca).toLocaleDateString('pt-BR')}</span>
    </div>
    <a href="${appUrl}/planos" class="btn">Gerenciar assinatura</a>
  `);

  return sendEmail({
    to: params.email,
    subject: `Pagamento confirmado - Plano ${params.plano} ativo`,
    html,
  });
}

export async function enviarRecuperacaoSenha(params: {
  email: string;
  nome: string;
  token: string;
}) {
  const appUrl = getAppUrl();
  const resetLink = `${appUrl}/reset-password?token=${params.token}`;
  console.log(`[AUTH-PASSWORD-RECOVERY] Link para ${params.email}: ${resetLink}`);

  const html = templateBase(`
    <h2 style="font-size:20px;font-weight:800;margin-bottom:8px;color:#081C3A;">Recuperacao de Senha</h2>
    <p style="color:#475569;margin-bottom:14px;line-height:1.6;">
      Ola, <strong>${params.nome}</strong>. Recebemos uma solicitacao para redefinir a senha da sua conta na Expertise Licitatoria.
    </p>
    <p style="color:#475569;margin-bottom:18px;line-height:1.6;">
      Clique no botao abaixo para cadastrar uma nova senha. Este link e valido por <strong>1 hora</strong>.
    </p>
    <a href="${resetLink}" class="btn">Redefinir Minha Senha</a>
    <p style="color:#64748B;font-size:12px;margin-top:22px;line-height:1.5;">
      Se o botao nao funcionar, copie e cole este link no navegador:<br/>
      <span style="color:#0070C0;word-break:break-all;">${resetLink}</span>
    </p>
    <p style="color:#94A3B8;font-size:12px;margin-top:16px;">
      Se voce nao solicitou esta alteracao, ignore este e-mail.
    </p>
  `);

  const result = await sendEmail({
    to: params.email,
    subject: 'Redefinicao de senha - Expertise Licitatoria',
    html,
  });

  if (!result.success && process.env.NODE_ENV === 'production') {
    throw new Error(result.error || 'EMAIL_DELIVERY_FAILED');
  }

  return result;
}

export async function enviarAlertaPrazo(params: {
  email: string;
  nome: string;
  prazoTitulo: string;
  tipo: string;
  dataLimite: Date | string;
  horasRestantes: number;
  editalNumero?: string | null;
  orgao?: string | null;
  link?: string | null;
}) {
  const appUrl = getAppUrl();
  const { horasRestantes } = params;
  const is24h = horasRestantes <= 24;
  const urgenciaCor = is24h ? '#DC2626' : '#D97706';
  const prazoFormatado = new Date(params.dataLimite).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const html = templateBase(`
    <span class="tag" style="background:#FEE2E2;color:#991B1B;border-color:#FECACA;">VENCE EM ${horasRestantes}H</span>
    <h2 style="font-size:20px;font-weight:800;margin:12px 0 8px;color:#081C3A;">Atencao com seu prazo: ${params.prazoTitulo}</h2>
    <p style="color:#475569;margin-bottom:16px;">Ola, <strong>${params.nome}</strong>! Voce possui um prazo licitatorio proximo do vencimento.</p>
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-left:4px solid ${urgenciaCor};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:6px;">${params.prazoTitulo}</p>
      <p style="font-size:13px;color:#475569;"><strong>Tipo:</strong> ${params.tipo}</p>
      <p style="font-size:13px;color:#475569;"><strong>Limite:</strong> <span style="color:${urgenciaCor};font-weight:700;">${prazoFormatado}</span></p>
      ${params.editalNumero ? `<p style="font-size:13px;color:#475569;"><strong>Edital:</strong> ${params.editalNumero}</p>` : ''}
      ${params.orgao ? `<p style="font-size:13px;color:#475569;"><strong>Orgao:</strong> ${params.orgao}</p>` : ''}
    </div>
    <a href="${params.link || `${appUrl}/prazos`}" class="btn" style="background:${urgenciaCor};">Ver detalhes agora</a>
  `);

  return sendEmail({
    to: params.email,
    subject: `[Alerta ${horasRestantes}h] ${params.prazoTitulo} - Expertise Licitatoria`,
    html,
  });
}

export async function enviarAlertaEditaisCnae(params: {
  email: string;
  empresaNome: string;
  cnae: string;
  editais: Array<{
    titulo: string;
    orgao: string;
    valorEstimado?: string | number;
    link: string;
    resumoExecutivo?: string;
    pontosDeAtencao?: string[];
  }>;
}) {
  const appUrl = getAppUrl();
  const editaisHtml = params.editais
    .map(
      (item) => `
    <li style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px solid #E2E8F0;">
      <strong style="color:#081C3A;font-size:14px;display:block;margin-bottom:4px;">${item.titulo}</strong>
      <span style="color:#475569;font-size:13px;display:block;margin-bottom:4px;">Orgao: <strong>${item.orgao}</strong></span>
      ${item.valorEstimado ? `<span style="color:#16A34A;font-size:13px;font-weight:700;display:block;margin-bottom:4px;">Valor Estimado: ${item.valorEstimado}</span>` : ''}
      <a href="${item.link}" style="color:#0070C0;font-size:13px;font-weight:700;text-decoration:underline;">Abrir no Radar</a>
    </li>`
    )
    .join('');

  const html = templateBase(`
    <span class="tag">Resumo Diario · CNAE ${params.cnae}</span>
    <h2 style="font-size:20px;font-weight:800;margin:12px 0 8px;color:#081C3A;">Oportunidades Compativeis com Sua Empresa</h2>
    <p style="color:#475569;line-height:1.6;margin-bottom:16px;">
      Ola, equipe da <strong>${params.empresaNome}</strong>! Separamos <strong>${params.editais.length}</strong> licitacao(oes) aberta(s) no PNCP compativel(is) com o seu perfil:
    </p>
    <ul style="list-style:none;padding-left:0;">${editaisHtml}</ul>
    <a href="${appUrl}/fornecedor/licitacoes" class="btn">Ver Radar Completo</a>
  `);

  return sendEmail({
    to: params.email,
    subject: `Resumo Diario: ${params.editais.length} licitacao(oes) compativel(is) - Expertise Licitatoria`,
    html,
  });
}

export async function enviarAlertaCertidaoVencendo(params: {
  email: string;
  empresaNome: string;
  certidaoTipo: string;
  diasRestantes: number;
  dataValidade: string;
  link?: string;
}) {
  const appUrl = getAppUrl();
  const isVencida = params.diasRestantes <= 0;
  const corAlerta = isVencida ? '#DC2626' : '#D97706';

  const html = templateBase(`
    <span class="tag" style="background:#FEE2E2;color:${corAlerta};border-color:#FECACA;">
      ${isVencida ? 'CERTIDAO VENCIDA' : `EXPIRA EM ${params.diasRestantes} DIAS`}
    </span>
    <h2 style="font-size:20px;font-weight:800;margin:12px 0 8px;color:#081C3A;">Alerta de Habilitacao: ${params.certidaoTipo}</h2>
    <p style="color:#475569;line-height:1.6;margin-bottom:16px;">Prezada equipe da <strong>${params.empresaNome}</strong>,</p>
    <div style="background:#F8FAFC;border-left:4px solid ${corAlerta};padding:12px 16px;border-radius:6px;margin:16px 0;">
      <p style="margin:0 0 6px;font-size:13px;"><strong>Certidao:</strong> ${params.certidaoTipo}</p>
      <p style="margin:0 0 6px;font-size:13px;"><strong>Vencimento:</strong> ${params.dataValidade}</p>
      <p style="margin:0;font-size:13px;color:${corAlerta};font-weight:700;">
        ${isVencida ? 'Documento Expirado' : `Restam ${params.diasRestantes} dia(s)`}
      </p>
    </div>
    <a href="${params.link || `${appUrl}/fornecedor/certidoes`}" class="btn" style="background:${corAlerta};">Renovar Certidao</a>
  `);

  return sendEmail({
    to: params.email,
    subject: `[Alerta CND] ${params.certidaoTipo} - ${params.empresaNome}`,
    html,
  });
}
