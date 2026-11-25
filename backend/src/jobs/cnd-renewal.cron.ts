import cron from 'node-cron';
import { prisma } from '../database/prisma';
import { isDatabaseConfigured } from '../config/env';
import { enviarAlertaCertidaoVencendo } from '../services/resend.service';

export interface CndAlertItem {
  id: string;
  companyId: string;
  empresaNome: string;
  userEmail: string;
  tipo: string;
  dataValidade: string;
  diasRestantes: number;
  status: string;
}

const DEFAULT_CRON = '0 7 * * *'; // Todos os dias às 07:00 da manhã
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const RENEWAL_WINDOW_DAYS = 15;

/**
 * Inicializa o Cron Job de Varredura de CNDs e Documentos de Habilitação (Falência, Balanço, Atestados)
 */
export function setupCndRenewalCron(): void {
  const cronExpression = process.env.CND_RENEWAL_CRON || DEFAULT_CRON;
  const timezone = process.env.CRON_TZ || DEFAULT_TIMEZONE;

  if (!cron.validate(cronExpression)) {
    console.error(`[CND Cron] Expressão cron inválida: ${cronExpression}`);
    return;
  }

  cron.schedule(
    cronExpression,
    async () => {
      console.info('[CND Cron] ⏰ Executando varredura diária de validade de certidões e documentos de habilitação...');
      try {
        await runCndRenewalScan();
      } catch (err) {
        console.error('[CND Cron] Erro durante a varredura:', err);
      }
    },
    { timezone }
  );

  console.info(`[CND Cron] Worker agendado com sucesso: ${cronExpression} (${timezone})`);
}

/**
 * Executa a varredura de documentos e certidões que expiram em até 15 dias (15, 7, 1 dia e vencidos),
 * atualiza flags no banco, dispara e-mails via Resend e gera alertas in-app.
 */
export async function runCndRenewalScan(): Promise<CndAlertItem[]> {
  const startedAt = new Date();
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const thresholdDate = new Date(currentDate);
  thresholdDate.setDate(thresholdDate.getDate() + RENEWAL_WINDOW_DAYS);
  thresholdDate.setHours(23, 59, 59, 999);

  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL_NOT_CONFIGURED');
  }

  const alertsFound: CndAlertItem[] = [];

  try {
    // 1. Varredura Universal em Documentos do Cofre (Document) com validade registrada (CND, Falência, Balanço, Atestados)
    const docs = await prisma.document.findMany({
      where: {
        validade: {
          not: null,
          lte: thresholdDate,
        },
      },
      include: {
        company: {
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
        user: { select: { id: true, email: true, nome: true } },
      },
      orderBy: { validade: 'asc' },
    });

    for (const doc of docs) {
      if (!doc.validade) continue;

      const expDate = new Date(doc.validade);
      if (isNaN(expDate.getTime())) continue;

      const diffMs = expDate.getTime() - currentDate.getTime();
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const isExpired = diasRestantes <= 0;
      const novoStatus = isExpired ? 'vencido' : 'vencendo';

      // Atualiza status do documento se necessário
      if (doc.status !== novoStatus) {
        try {
          await prisma.document.update({
            where: { id: doc.id },
            data: { status: novoStatus as any },
          });
        } catch (updErr) {
          console.warn(`[CND Cron] Falha ao atualizar status do Document ${doc.id}:`, updErr);
        }
      }

      const emailDestinatario = doc.user?.email;
      const empresaNome = doc.company?.razaoSocial || doc.company?.nomeFantasia || 'Sua Empresa';
      const dataFormatada = new Intl.DateTimeFormat('pt-BR').format(expDate);
      const nomeDoc = doc.nome || doc.tipo || 'Documento de Habilitação';

      // Envia notificação por e-mail nos marcos críticos (15 dias, 7 dias, 1 dia ou vencido)
      if (emailDestinatario && (diasRestantes <= 1 || diasRestantes === 7 || diasRestantes === 15 || isExpired)) {
        try {
          await enviarAlertaCertidaoVencendo({
            email: emailDestinatario,
            empresaNome,
            certidaoTipo: nomeDoc,
            diasRestantes,
            dataValidade: dataFormatada,
          });
          console.info(`[CND Cron] ✉️ E-mail enviado para ${emailDestinatario} (${nomeDoc} - ${diasRestantes} dias)`);
        } catch (mailErr) {
          console.error(`[CND Cron] Falha no envio para ${emailDestinatario}:`, mailErr);
        }
      }

      alertsFound.push({
        id: doc.id,
        companyId: doc.companyId || '',
        empresaNome,
        userEmail: emailDestinatario || '',
        tipo: nomeDoc,
        dataValidade: dataFormatada,
        diasRestantes,
        status: novoStatus,
      });
    }

    // 2. Varredura complementar em CompanyCertificate (se existirem registros)
    try {
      if (typeof prisma?.companyCertificate?.findMany === 'function') {
        const certs = await prisma.companyCertificate.findMany({
          where: {
            expirationDate: { lte: thresholdDate },
          },
          include: {
            company: {
              include: {
                user: { select: { email: true, nome: true } },
              },
            },
          },
          orderBy: { expirationDate: 'asc' },
        });

        for (const cert of certs) {
          const rawDate = cert.expirationDate || (cert as any).validade;
          if (!rawDate) continue;

          const expDate = new Date(rawDate);
          if (isNaN(expDate.getTime())) continue;

          const diffMs = expDate.getTime() - currentDate.getTime();
          const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          const isExpired = diasRestantes <= 0;
          const novoStatus = isExpired ? 'EXPIRED' : 'WARNING';

          if (cert.status !== novoStatus) {
            try {
              await prisma.companyCertificate.update({
                where: { id: cert.id },
                data: { status: novoStatus },
              });
            } catch (updErr) {
              console.warn(`[CND Cron] Falha ao atualizar CompanyCertificate ${cert.id}:`, updErr);
            }
          }

          const emailDestinatario = cert.company?.user?.email;
          const empresaNome = cert.company?.razaoSocial || cert.company?.nomeFantasia || 'Sua Empresa';
          const dataFormatada = new Intl.DateTimeFormat('pt-BR').format(expDate);

          alertsFound.push({
            id: cert.id,
            companyId: cert.companyId,
            empresaNome,
            userEmail: emailDestinatario || '',
            tipo: cert.type || 'CND',
            dataValidade: dataFormatada,
            diasRestantes,
            status: novoStatus,
          });
        }
      }
    } catch (certTableErr) {
      // Ignora se tabela CompanyCertificate não existir no banco
      console.warn('[CND Cron] CompanyCertificate query ignorada:', certTableErr);
    }

    console.info(`[CND Cron] ✅ Varredura finalizada. Total de alertas processados: ${alertsFound.length} em ${Date.now() - startedAt.getTime()}ms`);
    return alertsFound;
  } catch (error) {
    console.error('[CND Cron] Falha na execução da varredura:', error);
    throw error;
  }
}
