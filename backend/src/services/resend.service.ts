import axios from 'axios';

/**
 * Resend — Serviço de e-mail transacional
 * Documentação: https://resend.com/docs
 * Gratuito até 3.000 e-mails/mês
 */

const FROM_NAME = 'Expertise Platform';

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

/**
 * Envia um e-mail via Resend
 */
async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !fromEmail) {
    throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  }

  try {
    const response = await axios.post(
      'https://api.resend.com/emails',
      {
        from: `${FROM_NAME} <${fromEmail}>`,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        reply_to: payload.replyTo,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    return { success: true, id: response.data.id };
  } catch (err) {
    const msg = (err as any)?.response?.data?.message || (err as Error).message;
    console.error('[Email] Erro ao enviar:', msg);
    throw new Error('EMAIL_DELIVERY_FAILED');
  }
}

// ─── Templates HTML ──────────────────────────────────────────────────────────

function templateBase(content: string): string {
  const appUrl = (process.env.FRONTEND_URL || 'https://espertise-licitacao-53xf.vercel.app').replace(/\/+$/, '');
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F0F7FF; color: #1A1A2E; }
    .container { max-width: 600px; margin: 32px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,102,204,0.08); }
    .header { background: linear-gradient(135deg, #0052A3, #0066CC 50%, #00A651); padding: 32px; text-align: center; }
    .header-logo { display: inline-flex; align-items: center; gap: 10px; }
    .header h1 { color: white; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 4px; }
    .body { padding: 32px; }
    .btn { display: inline-block; background: #0066CC; color: white; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; margin-top: 20px; }
    .btn-green { background: #00A651; }
    .alert-box { background: #FFF3CD; border: 1px solid #F59E0B; border-radius: 10px; padding: 16px; margin: 16px 0; }
    .alert-box.danger { background: #FEE2E2; border-color: #EF4444; }
    .alert-box.success { background: #ECFDF5; border-color: #00A651; }
    .footer { background: #F8FAFC; padding: 20px 32px; text-align: center; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2EAF4; }
    .tag { display: inline-block; background: #EBF5FF; color: #0066CC; font-weight: 700; font-size: 11px; padding: 3px 10px; border-radius: 20px; border: 1px solid #BFE0FF; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-logo">
        <span style="background:rgba(255,255,255,0.2);width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">⚡</span>
        <div style="text-align:left">
          <h1>Expertise</h1>
          <p>Plataforma Profissional de Licitações</p>
        </div>
      </div>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      Expertise Plataforma · <a href="${appUrl}" style="color:#0066CC">Acessar plataforma</a><br>
      Você receberá e-mails de alertas porque cadastrou sua conta.
      <a href="#" style="color:#94A3B8">Cancelar alertas</a>
    </div>
  </div>
</body>
</html>`;
}

// ─── E-mails específicos ──────────────────────────────────────────────────────

/**
 * E-mail de boas-vindas após cadastro
 */
export async function enviarBoasVindas(params: { nome: string; email: string; plano: string }) {
  const appUrl = (process.env.FRONTEND_URL || 'https://espertise-licitacao-53xf.vercel.app').replace(/\/+$/, '');
  const html = templateBase(`
    <h2 style="font-size:24px;font-weight:900;margin-bottom:8px;">Bem-vindo ao Expertise, ${params.nome}! 🎉</h2>
    <p style="color:#475569;line-height:1.6;margin-bottom:16px;">Sua conta foi criada com sucesso. Você agora tem acesso a toda a plataforma profissional de licitações.</p>

    <div class="alert-box success">
      <strong>✅ Plano ${params.plano} ativado</strong><br>
      <span style="font-size:13px;color:#555">Acesse a plataforma para consultar os recursos disponíveis no seu plano.</span>
    </div>

    <h3 style="margin:20px 0 12px;font-size:16px;">O que fazer primeiro:</h3>
    <ol style="line-height:2;color:#475569;padding-left:20px;">
      <li>Configure sua empresa com o CNPJ</li>
      <li>Ative o Radar de Editais com suas palavras-chave</li>
      <li>Suba seus documentos de habilitação no Cofre</li>
    </ol>

    <a href="${appUrl}/dashboard" class="btn">Acessar minha plataforma →</a>
  `);

  return sendEmail({ to: params.email, subject: `Bem-vindo ao Expertise, ${params.nome}! Sua conta está pronta 🚀`, html });
}

/**
 * Alerta de certidão próxima do vencimento
 */
export async function enviarAlertaCertidao(params: {
  email: string;
  nome: string;
  certidao: string;
  diasRestantes: number;
  validade: string;
  linkRenovacao: string;
}) {
  const appUrl = (process.env.FRONTEND_URL || 'https://espertise-licitacao-53xf.vercel.app').replace(/\/+$/, '');
  const { diasRestantes } = params;
  const urgencia = diasRestantes <= 7 ? 'danger' : diasRestantes <= 15 ? 'alert' : 'warning';
  const emoji = diasRestantes <= 7 ? '🚨' : diasRestantes <= 15 ? '⚠️' : '📅';

  const html = templateBase(`
    <h2 style="font-size:20px;font-weight:900;margin-bottom:8px;">${emoji} Atenção: certidão vencendo em breve</h2>
    <p style="color:#475569;margin-bottom:16px;">
      Olá, <strong>${params.nome}</strong>! Uma certidão importante da sua empresa está próxima do vencimento.
    </p>

    <div class="alert-box ${urgencia === 'danger' ? 'danger' : ''}">
      <strong>${params.certidao}</strong><br>
      <span style="font-size:13px;">Validade: <strong>${new Date(params.validade).toLocaleDateString('pt-BR')}</strong> |
      <span style="color:${diasRestantes <= 7 ? '#EF4444' : '#F59E0B'}"><strong>${diasRestantes} dias restantes</strong></span></span>
    </div>

    <p style="color:#475569;font-size:14px;line-height:1.6;">
      A validade informada pode afetar a habilitação conforme as regras do edital. Confirme a situação diretamente no órgão emissor
      e verifique os requisitos aplicáveis ao seu processo antes de renovar o documento.
    </p>

    <a href="${params.linkRenovacao}" class="btn btn-green">Renovar certidão agora →</a>
    <a href="${appUrl}/documentos" class="btn" style="margin-left:10px;background:#0052A3;">Ver no Cofre</a>
  `);

  return sendEmail({
    to: params.email,
    subject: `${emoji} ${params.certidao} vence em ${diasRestantes} dias — Renove agora`,
    html,
  });
}

/**
 * Alerta de novo edital compatível com o perfil
 */
export async function enviarAlertaEdital(params: {
  email: string;
  nome: string;
  edital: { objeto: string; orgao: string; valor?: number; prazo: string; link?: string };
  score: number;
}) {
  const appUrl = (process.env.FRONTEND_URL || 'https://espertise-licitacao-53xf.vercel.app').replace(/\/+$/, '');
  const { edital, score } = params;
  const valor = edital.valor ? `R$ ${edital.valor.toLocaleString('pt-BR')}` : 'Sob consulta';
  const cor = score >= 80 ? '#00A651' : score >= 60 ? '#0066CC' : '#F59E0B';

  const html = templateBase(`
    <h2 style="font-size:20px;font-weight:900;margin-bottom:8px;">🎯 Novo edital compatível encontrado!</h2>
    <p style="color:#475569;margin-bottom:12px;">Olá, <strong>${params.nome}</strong>! O Radar encontrou um edital com alta compatibilidade com o perfil da sua empresa.</p>

    <div style="border:2px solid ${cor};border-radius:12px;padding:16px;margin:16px 0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span class="tag" style="background:${cor}15;color:${cor};border-color:${cor}40;">Score ${score}/100</span>
        <span style="font-size:12px;color:#94A3B8;">Abertura: ${new Date(edital.prazo).toLocaleDateString('pt-BR')}</span>
      </div>
      <h3 style="font-size:15px;font-weight:700;color:#1A1A2E;line-height:1.4;margin-bottom:6px;">${edital.objeto}</h3>
      <p style="font-size:13px;color:#475569;">${edital.orgao}</p>
      <p style="font-size:16px;font-weight:900;color:${cor};margin-top:8px;">${valor}</p>
    </div>

    <a href="${edital.link || `${appUrl}/licitacoes`}" class="btn">Analisar edital com LEX →</a>
  `);

  return sendEmail({
    to: params.email,
    subject: `🎯 Novo edital: ${edital.objeto.substring(0, 50)}... — Score ${score}/100`,
    html,
  });
}

/**
 * E-mail de confirmação de pagamento
 */
export async function enviarConfirmacaoPagamento(params: {
  email: string;
  nome: string;
  plano: string;
  valor: number;
  proximaCobranca: string;
}) {
  const appUrl = (process.env.FRONTEND_URL || 'https://espertise-licitacao-53xf.vercel.app').replace(/\/+$/, '');
  const html = templateBase(`
    <h2 style="font-size:20px;font-weight:900;margin-bottom:8px;">✅ Pagamento confirmado!</h2>
    <p style="color:#475569;margin-bottom:16px;">Obrigado, <strong>${params.nome}</strong>! Seu plano foi renovado com sucesso.</p>

    <div class="alert-box success">
      <strong>Plano ${params.plano}</strong><br>
      <span style="font-size:14px;">R$ ${params.valor}/mês · Próxima cobrança: ${new Date(params.proximaCobranca).toLocaleDateString('pt-BR')}</span>
    </div>

    <a href="${appUrl}/planos" class="btn">Gerenciar assinatura →</a>
  `);

  return sendEmail({
    to: params.email,
    subject: `✅ Pagamento confirmado — Plano ${params.plano} ativo`,
    html,
  });
}

/**
 * E-mail de recuperação de senha
 *
 * IMPORTANTE: No servidor AWS, configure:
 *   FRONTEND_URL=https://espertise-licitacao-53xf.vercel.app
 * para que o link do e-mail aponte para o destino correto.
 */
export async function enviarRecuperacaoSenha(params: {
  email: string;
  nome: string;
  token: string;
}) {
  const frontendUrl = (process.env.FRONTEND_URL || 'https://espertise-licitacao-53xf.vercel.app').replace(/\/+$/, '');
  const resetLink = `${frontendUrl}/reset-password?token=${params.token}`;

  const html = templateBase(`
    <h2 style="font-size:20px;font-weight:900;margin-bottom:8px;">Recuperação de Senha Segura</h2>
    <p style="color:#475569;margin-bottom:16px;">Olá, <strong>${params.nome}</strong>. Recebemos uma solicitação para redefinir a senha da sua conta.</p>

    <p style="color:#475569;margin-bottom:16px;">
      Clique no botão abaixo para criar uma nova credencial. Este link é válido por apenas <strong>1 hora</strong>.
    </p>

    <a href="${resetLink}" class="btn">Redefinir Minha Senha →</a>

    <p style="color:#94A3B8;font-size:12px;margin-top:24px;">
      Se você não solicitou esta alteração, por favor, ignore este e-mail. Sua senha permanece a mesma.
    </p>
  `);

  return sendEmail({
    to: params.email,
    subject: `🔐 Instruções para redefinição de senha`,
    html,
  });
}

/**
 * Alerta de prazo crítico de licitação (24h ou 48h para o vencimento)
 */
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
  const appUrl = (process.env.FRONTEND_URL || 'https://espertise-licitacao-53xf.vercel.app').replace(/\/+$/, '');
  const { horasRestantes } = params;
  const is24h = horasRestantes <= 24;
  const urgenciaCor = is24h ? '#DC2626' : '#D97706';
  const tagBg = is24h ? '#FEE2E2' : '#FEF3C7';
  const tagText = is24h ? '#991B1B' : '#92400E';
  const emoji = is24h ? '🚨' : '⏰';
  const prazoFormatado = new Date(params.dataLimite).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const html = templateBase(`
    <div style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${tagBg};color:${tagText};margin-bottom:12px;">
      ${emoji} VENCE EM ${horasRestantes}H
    </div>
    <h2 style="font-size:20px;font-weight:900;margin-bottom:8px;color:#1A1A2E;">
      ${emoji} Atenção com seu prazo: ${params.prazoTitulo}
    </h2>
    <p style="color:#475569;margin-bottom:16px;line-height:1.5;">
      Olá, <strong>${params.nome}</strong>! Você possui um prazo licitatório crítico que expira em aproximadamente <strong>${horasRestantes} horas</strong>.
    </p>

    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-left:4px solid ${urgenciaCor};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="font-size:15px;font-weight:700;color:#0F172A;margin-bottom:6px;">${params.prazoTitulo}</p>
      <p style="font-size:13px;color:#475569;margin-bottom:4px;"><strong>Tipo de Prazo:</strong> ${params.tipo}</p>
      <p style="font-size:13px;color:#475569;margin-bottom:4px;"><strong>Data e Hora Limite:</strong> <span style="color:${urgenciaCor};font-weight:700;">${prazoFormatado}</span></p>
      ${params.editalNumero ? `<p style="font-size:13px;color:#475569;margin-bottom:4px;"><strong>Edital:</strong> ${params.editalNumero}</p>` : ''}
      ${params.orgao ? `<p style="font-size:13px;color:#475569;"><strong>Órgão:</strong> ${params.orgao}</p>` : ''}
    </div>

    <p style="color:#475569;font-size:13px;line-height:1.5;margin-bottom:20px;">
      Não perder prazos é indispensável para evitar a preclusão administrativa, desclassificação de propostas ou aplicação de penalidades (Lei 14.133/2021).
    </p>

    <a href="${params.link || `${appUrl}/prazos`}" class="btn" style="background:${urgenciaCor};">
      Ver detalhes e agir agora →
    </a>
  `);

  return sendEmail({
    to: params.email,
    subject: `${emoji} [ALERTA ${horasRestantes}H] ${params.prazoTitulo} vence ${is24h ? 'amanhã' : 'em breve'}`,
    html,
  });
}
