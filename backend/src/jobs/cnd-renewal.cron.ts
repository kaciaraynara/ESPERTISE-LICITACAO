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
 * Inicializa o Cron Job de Varredura de CNDs e Certidões
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
      console.info('[CND Cron] ⏰ Executando varredura diária de validade das certidões (CNDs)...');
      try {
        await runCndRenewalScan();
      } catch (err) {
        console.error('[CND Cron] Erro durante a varredura de CNDs:', err);
      }
    },
    { timezone }
  );

  console.info(`[CND Cron] Worker agendado com sucesso: ${cronExpression} (${timezone})`);
}

/**
 * Executa a varredura de CNDs que expiram em menos de 15 dias, atualiza flags no banco e dispara e-mail Resend
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
    // 1. Busca certificados na tabela `CompanyCertificate` (se disponível no schema/mock)
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
        const expDate = new Date(cert.expirationDate);
        const diffMs = expDate.getTime() - currentDate.getTime();
        const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const isExpired = diasRestantes <= 0;
        const novoStatus = isExpired ? 'EXPIRED' : 'WARNING';

        // Atualiza a flag de alerta no banco de dados se houver alteração
        if (cert.status !== novoStatus && typeof prisma.companyCertificate.update === 'function') {
          await prisma.companyCertificate.update({
            where: { id: cert.id },
            data: { status: novoStatus },
          });
        }

        const emailDestinatario = cert.company?.user?.email;
        const empresaNome = cert.company?.razaoSocial || cert.company?.nomeFantasia || 'Sua Empresa';
        const dataFormatada = new Intl.DateTimeFormat('pt-BR').format(expDate);

        // Dispara e-mail transacional via Resend
        if (emailDestinatario) {
          try {
            await enviarAlertaCertidaoVencendo({
              email: emailDestinatario,
              empresaNome,
              certidaoTipo: cert.type || 'Certidão Negativa de Débitos (CND)',
              diasRestantes,
              dataValidade: dataFormatada,
            });
            console.info(`[CND Cron] ✉️ E-mail de alerta enviado para ${emailDestinatario} (CND ${cert.type} - ${diasRestantes} dias)`);
          } catch (mailErr) {
            console.error(`[CND Cron] Falha no envio de e-mail para ${emailDestinatario}:`, mailErr);
          }
        }

        alertsFound.push({
          id: cert.id,
          companyId: cert.companyId,
          empresaNome,
          userEmail: emailDestinatario || '',
          tipo: cert.type,
          dataValidade: dataFormatada,
          diasRestantes,
          status: novoStatus,
        });
      }
    }

    // 2. Busca também documentos de tipo CND na tabela `Document`
    const docs = await prisma.document.findMany({
      where: {
        tipo: { in: ['CND', 'CERTIDAO', 'certidao', 'cnd'] },
        validade: { lte: thresholdDate },
      },
      include: {
        company: {
          select: { razaoSocial: true, nomeFantasia: true },
        },
        user: { select: { email: true, nome: true } },
      },
    });

    if (typeof prisma?.companyCertificate?.findMany !== 'function') {
      return docs.reduce<any[]>((result, doc) => {
        if (!doc.validade) return result;
        result.push({
          userId: doc.userId,
          documentId: doc.id,
          companyId: doc.companyId || null,
          nome: doc.nome,
          tipo: doc.tipo,
          validade: doc.validade instanceof Date ? doc.validade.toISOString() : new Date(doc.validade).toISOString(),
        });
        return result;
      }, []);
    }

    for (const doc of docs) {
      if (!doc.validade) continue;

      const expDate = new Date(doc.validade);
      const diffMs = expDate.getTime() - currentDate.getTime();
      const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const isExpired = diasRestantes <= 0;
      const novoStatus = isExpired ? 'vencido' : 'vencendo';

      if (doc.status !== novoStatus) {
        await prisma.document.update({
          where: { id: doc.id },
          data: { status: novoStatus as any },
        });
      }

      const emailDestinatario = doc.user?.email;
      const empresaNome = doc.company?.razaoSocial || doc.company?.nomeFantasia || 'Sua Empresa';
      const dataFormatada = new Intl.DateTimeFormat('pt-BR').format(expDate);

      if (emailDestinatario) {
        try {
          await enviarAlertaCertidaoVencendo({
            email: emailDestinatario,
            empresaNome,
            certidaoTipo: doc.nome || 'Certidão de Regularidade Fiscal',
            diasRestantes,
            dataValidade: dataFormatada,
          });
        } catch (mailErr) {
          console.error(`[CND Cron] Falha no envio para ${emailDestinatario}:`, mailErr);
        }
      }

      alertsFound.push({
        id: doc.id,
        companyId: doc.companyId || '',
        empresaNome,
        userEmail: emailDestinatario || '',
        tipo: doc.nome,
        dataValidade: dataFormatada,
        diasRestantes,
        status: novoStatus,
      });
    }

    console.info(`[CND Cron] ✅ Varredura finalizada. Total de alertas processados: ${alertsFound.length} em ${Date.now() - startedAt.getTime()}ms`);
    return alertsFound;
  } catch (error) {
    console.error('[CND Cron] Falha na execução da varredura:', error);
    throw error;
  }
}
