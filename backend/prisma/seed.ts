import 'dotenv/config';
import {
  PrismaClient,
  AccountRole,
  DocumentStatus,
  ProcurementModality,
  JudgmentCriterion,
  ExecutionRegime,
  SubscriptionCategory,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

// Inicialização necessária para o Prisma v7 com driver adapter
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('[SEED] Iniciando o processo de seeding...');

  // Gerar hash para a senha padrão '12345678'
  const defaultPasswordHash = await bcrypt.hash('12345678', 10);

  // 1. Limpeza prévia do banco de dados (respeitando a ordem das foreign keys)
  console.log('[SEED] Limpando dados antigos...');
  await prisma.auditLog.deleteMany().catch(() => {});
  await prisma.webhookLog.deleteMany().catch(() => {});
  await prisma.payment.deleteMany().catch(() => {});
  await prisma.subscription.deleteMany().catch(() => {});
  await prisma.marketplaceItem.deleteMany().catch(() => {});
  await prisma.fornecedorMarketplace.deleteMany().catch(() => {});
  await prisma.juridicoMessage.deleteMany().catch(() => {});
  await prisma.juridicoCase.deleteMany().catch(() => {});
  await prisma.deadline.deleteMany().catch(() => {});
  await prisma.juridicoProfile.deleteMany().catch(() => {});
  await prisma.investigationSignal.deleteMany().catch(() => {});
  await prisma.legalPattern.deleteMany().catch(() => {});
  await prisma.jurisprudence.deleteMany().catch(() => {});
  await prisma.legalDocument.deleteMany().catch(() => {});
  await prisma.documentChunk.deleteMany().catch(() => {});
  await prisma.document.deleteMany().catch(() => {});
  await prisma.annualProcurementPlan.deleteMany().catch(() => {});
  await prisma.roboSession.deleteMany().catch(() => {});
  await prisma.biddingPipeline.deleteMany().catch(() => {});
  await prisma.procurementEvent.deleteMany().catch(() => {});
  await prisma.legalAnalysis.deleteMany().catch(() => {});
  await prisma.proposal.deleteMany().catch(() => {});
  await prisma.procurementRequirement.deleteMany().catch(() => {});
  await prisma.procurementItem.deleteMany().catch(() => {});
  await prisma.procurementNotice.deleteMany().catch(() => {});
  await prisma.companyMonitoredNotice.deleteMany().catch(() => {});
  await prisma.companyModuleAccess.deleteMany().catch(() => {});
  await prisma.companyCertificate.deleteMany().catch(() => {});
  await prisma.user.deleteMany().catch(() => {});
  await prisma.company.deleteMany().catch(() => {});

  // 2. Criar Empresa Principal
  console.log('[SEED] Criando Empresa principal...');
  const company = await prisma.company.create({
    data: {
      name: 'Expertise Licitatoria Ltda',
      cnpj: '12345678000195',
      active: true,
      certificates: {
        create: [
          {
            name: 'Certificado Digital A1 e-CNPJ',
            validUntil: new Date('2027-12-31T23:59:59Z'),
          },
        ],
      },
      moduleAccesses: {
        create: [
          { module: 'RADAR_LICITACOES', enabled: true },
          { module: 'JURIDICO', enabled: true },
          { module: 'ROBO_LANCES', enabled: true },
        ],
      },
      monitoredNotices: {
        create: [
          {
            noticeNum: 'PE 001/2026',
            organ: 'Ministerio da Gestao e da Inovacao',
          },
        ],
      },
    },
  });

  // 3. Criar Usuários (Incluindo seu e-mail principal)
  console.log('[SEED] Criando Usuários...');
  const adminUser = await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Raynara Kácia',
      email: 'kaciaraynaraa@gmail.com',
      passwordHash: defaultPasswordHash,
      role: AccountRole.ADMIN,
      active: true,
      juridicoProfile: {
        create: {
          oabNumber: '123456',
          oabUf: 'SP',
        },
      },
      deadlines: {
        create: [
          {
            title: 'Analise do Edital PE 001/2026',
            dueDate: new Date('2026-09-01T18:00:00Z'),
            completed: false,
          },
        ],
      },
    },
  });

  await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Administrador Sistema',
      email: 'admin@expertise.com.br',
      passwordHash: defaultPasswordHash,
      role: AccountRole.ADMIN,
      active: true,
    },
  });

  await prisma.user.create({
    data: {
      companyId: company.id,
      name: 'Gerente de Licitacoes',
      email: 'gerente@expertise.com.br',
      passwordHash: defaultPasswordHash,
      role: AccountRole.MANAGER,
      active: true,
    },
  });

  // 4. Criar Licitação (ProcurementNotice) e sub-elementos
  console.log('[SEED] Criando Licitação e Itens...');
  const notice = await prisma.procurementNotice.create({
    data: {
      companyId: company.id,
      title: 'Aquisicao de Softwares e Servicos de Infraestrutura de TI',
      noticeNumber: 'PE 001/2026',
      modality: ProcurementModality.PREGAO_ELETRONICO,
      criterion: JudgmentCriterion.MENOR_PRECO,
      regime: ExecutionRegime.EMPREITADA_PRECO_GLOBAL,
      status: DocumentStatus.APPROVED,
      organ: 'Ministerio da Gestao e da Inovacao em Servicos Publicos',
      openingDate: new Date('2026-09-15T10:00:00Z'),
      totalAmount: 1500000.00,
      rawJson: {
        objeto: 'Registro de precos para contratacao de solucao de TI',
        siasgCode: '158001',
      },
      items: {
        create: [
          {
            itemNumber: 1,
            description: 'Licenciamento de Software de Gestao de Licitacoes',
            quantity: 10,
            unitMeasure: 'UNIDADE',
            referenceValue: 50000.00,
          },
          {
            itemNumber: 2,
            description: 'Servico de Suporte Tecnico Especializado',
            quantity: 1000,
            unitMeasure: 'HORAS',
            referenceValue: 1000.00,
          },
        ],
      },
      requirements: {
        create: [
          {
            category: 'Habilitacao Juridica',
            description: 'Apresentacao do Contrato Social atualizado',
            mandatory: true,
          },
          {
            category: 'Qualificacao Tecnica',
            description: 'Atestado de Capacidade Tecnica fornecido por pessoa juridica de direito publico ou privado',
            mandatory: true,
          },
        ],
      },
      pipelines: {
        create: [
          {
            companyId: company.id,
            stage: 'ANALISE_EDITAL',
            score: 95.5,
            notes: 'Edital com alta viabilidade e boa rentabilidade.',
          },
        ],
      },
      roboSessions: {
        create: [
          {
            companyId: company.id,
            strategy: 'DISPUTA_AGRESSIVA',
            limitPrice: 1300000.00,
            decrementAmount: 500.00,
            active: true,
          },
        ],
      },
      events: {
        create: [
          {
            eventType: 'PUBLICACAO_EDITAL',
            description: 'Edital publicado no Diario Oficial da Uniau',
          },
        ],
      },
      proposals: {
        create: [
          {
            totalAmount: 1450000.00,
          },
        ],
      },
      analyses: {
        create: [
          {
            riskScore: 2.5,
            summary: 'Baixo risco juridico. Clausulas ajustadas conforme a Lei 14.133/2021.',
          },
        ],
      },
    },
  });

  // 5. Criar Jurisprudência
  console.log('[SEED] Criando Jurisprudências...');
  await prisma.jurisprudence.createMany({
    data: [
      {
        court: 'TCU',
        processNum: 'Acordao 1234/2021 - Plenario',
        summary: 'Vedada a exigencia de comprovacao de quitacao com a Justica do Trabalho fora da fase de habilitacao.',
        fullContent: 'E ilegal a exigencia de declaracao de nao empregar menor de dezesseis anos em trabalho noturno, perigoso ou insalubre fora das hipoteses e momentos expressamente previstos em lei.',
        keywords: ['habilitacao', 'justica do trabalho', 'exigencia indevida'],
      },
      {
        court: 'TCU',
        processNum: 'Acordao 2045/2023 - Plenario',
        summary: 'A exigencia de atestados de capacidade tecnica deve se limitar as parcelas de maior relevancia tecnica.',
        fullContent: 'Na fixacao dos criterios de qualificacao tecnica, a Administracao deve restringir-se as parcelas de maior relevancia e valor significativo do objeto licitado.',
        keywords: ['atestado de capacidade tecnica', 'qualificacao tecnica', 'relevancia tecnica'],
      },
      {
        court: 'STJ',
        processNum: 'REsp 1892341/SP',
        summary: 'A sancao de impedimento de licitar e contratar restringe-se ao ambito do ente federativo sancionador.',
        fullContent: 'Interpretacao conferida ao regramento legal de licitacoes e contratos administrativos referentes ao alcance de sancoes.',
        keywords: ['sancao', 'impedimento de licitar', 'abrangencia'],
      },
    ],
  });

  // 6. Criar Padrões Jurídicos e Sinais
  console.log('[SEED] Criando Padrões Jurídicos e Sinais...');
  await prisma.legalPattern.create({
    data: {
      patternType: 'RESTRICAO_COMPETITIVIDADE',
      title: 'Exigencia Excessiva de Marcas Especificas',
      description: 'Clausulas editalicias que direcionam a contratacao para marcas especificas sem justificativa tecnica.',
      riskLevel: 'ALTO',
      legalBasis: { lei: '14.133/2021', artigo: '41' },
      examples: ['Exigencia de produto da marca X sem admitir equivalente.'],
      active: true,
    },
  });

  await prisma.investigationSignal.create({
    data: {
      signalType: 'CONLUIO_PROPOSTAS',
      target: 'Licitacao PE 001/2026',
      description: 'Identificados padroes de IP coincidentes entre propostas concorrentes.',
      severity: 'ALTA',
    },
  });

  // 7. Criar Documentos
  console.log('[SEED] Criando Documentos...');
  await prisma.document.create({
    data: {
      companyId: company.id,
      title: 'Atestado de Capacidade Tecnica - Servicos de TI',
      fileUrl: 'https://storage.expertise.com.br/docs/atestado_ti.pdf',
      status: DocumentStatus.APPROVED,
      chunks: {
        create: [
          {
            content: 'Atestamos que a empresa prestou servicos de tecnologia com excelencia operacional.',
          },
        ],
      },
    },
  });

  await prisma.legalDocument.create({
    data: {
      companyId: company.id,
      title: 'Impugnacao ao Edital PE 001/2026',
      type: 'IMPUGNACAO',
      status: DocumentStatus.DRAFT,
      content: 'Excelentissimo Senhor Pregoeiro, vimos por meio desta apresentar a presente Impugnacao...',
    },
  });

  // 8. Criar Plano Anual de Contratações
  console.log('[SEED] Criando Plano Anual de Contratações...');
  await prisma.annualProcurementPlan.create({
    data: {
      company: { connect: { id: company.id } },
      year: 2026,
      title: 'Plano Anual de Contratacoes Publicas Previstas - TI',
      rawContent: {
        estimativaTotal: 50000000.00,
        setor: 'Tecnologia da Informacao',
      },
    },
  });

  // 9. Criar Marketplace
  console.log('[SEED] Criando Marketplace...');
  await prisma.fornecedorMarketplace.create({
    data: {
      companyId: company.id,
      rating: 4.9,
      items: {
        create: [
          {
            title: 'Plataforma SaaS de Monitoramento de Licitacoes',
            price: 499.00,
          },
        ],
      },
    },
  });

  // 10. Criar Casos Jurídicos
  console.log('[SEED] Criando Casos Jurídicos...');
  await prisma.juridicoCase.create({
    data: {
      title: 'Recurso Administrativo - Pregao Eletronico 001/2026',
      status: 'EM_ANDAMENTO',
      messages: {
        create: [
          {
            sender: 'Dr. Roberto (Advogado)',
            content: 'Minuta do recurso preparada para revisao do cliente.',
          },
        ],
      },
    },
  });

  // 11. Criar Assinatura e Histórico Financeiro
  console.log('[SEED] Criando Assinatura e Histórico Financeiro...');
  await prisma.subscription.create({
    data: {
      companyId: company.id,
      mpSubscriptionId: 'sub_mp_123456789',
      mpPayerId: 'payer_987654321',
      plan: SubscriptionCategory.PRO,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date('2026-08-01T00:00:00Z'),
      currentPeriodEnd: new Date('2026-09-01T00:00:00Z'),
      payments: {
        create: [
          {
            mpPaymentId: 'pay_9988776655',
            amount: 499.00,
            currency: 'BRL',
            status: 'approved',
            paymentMethod: 'pix',
            paidAt: new Date('2026-08-01T10:15:00Z'),
          },
        ],
      },
    },
  });

  // 12. Criar Logs de Auditoria e Webhook
  console.log('[SEED] Criando Logs de Auditoria...');
  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      userId: adminUser.id,
      action: 'CREATE',
      entity: 'ProcurementNotice',
      entityId: notice.id,
      newValues: { title: notice.title },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
    },
  });

  await prisma.webhookLog.create({
    data: {
      provider: 'MERCADO_PAGO',
      eventId: 'evt_1020304050',
      eventType: 'payment.created',
      payload: { status: 'approved', id: 'pay_9988776655' },
      processed: true,
    },
  });

  console.log('✅ [SEED] Seeding concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ [SEED] Erro durante a execução do seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });