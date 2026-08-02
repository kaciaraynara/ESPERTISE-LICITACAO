require("dotenv/config");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL nao configurada.");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const modules = [
  {
    key: "pagina-inicial",
    name: "Página Inicial",
    description: "Visão geral da operação da empresa dentro da plataforma.",
    route: "/app",
    icon: "home",
    status: "AVAILABLE",
    sortOrder: 1,
    isVisible: true,
  },
  {
    key: "radar-editais",
    name: "Radar de Editais",
    description: "Busca e acompanhamento de oportunidades vindas de fontes oficiais.",
    route: "/app/radar",
    icon: "search",
    status: "AVAILABLE",
    sortOrder: 2,
    isVisible: true,
  },
  {
    key: "editais-monitorados",
    name: "Editais Monitorados",
    description: "Editais salvos pela empresa para acompanhamento, análise e decisão.",
    route: "/app/editais-monitorados",
    icon: "bookmark",
    status: "IN_IMPLANTATION",
    sortOrder: 3,
    isVisible: true,
  },
  {
    key: "resumo-editais",
    name: "Resumo de Editais",
    description: "Resumo técnico e jurídico de editais com base em documentos reais.",
    route: "/app/resumo-editais",
    icon: "file-text",
    status: "IN_IMPLANTATION",
    sortOrder: 4,
    isVisible: true,
  },
  {
    key: "assistente-juridico",
    name: "Assistente Jurídico",
    description: "Assistente para análise jurídica com respostas fundamentadas.",
    route: "/app/assistente-juridico",
    icon: "scale",
    status: "IN_IMPLANTATION",
    sortOrder: 5,
    isVisible: true,
  },
  {
    key: "juridico",
    name: "Jurídico",
    description: "Gestão de análises, peças, impugnações, recursos e revisões.",
    route: "/app/juridico",
    icon: "gavel",
    status: "IN_IMPLANTATION",
    sortOrder: 6,
    isVisible: true,
  },
  {
    key: "contabilidade-habilitacao",
    name: "Contabilidade e Habilitação",
    description: "Controle de regularidade fiscal, certidões e documentação habilitatória.",
    route: "/app/contabilidade-habilitacao",
    icon: "calculator",
    status: "IN_IMPLANTATION",
    sortOrder: 7,
    isVisible: true,
  },
  {
    key: "cofre-documental",
    name: "Cofre Documental",
    description: "Organização segura de documentos e certidões da empresa.",
    route: "/app/cofre-documental",
    icon: "folder-lock",
    status: "INTEGRATION_PENDING",
    sortOrder: 8,
    isVisible: true,
  },
  {
    key: "propostas",
    name: "Propostas",
    description: "Criação, organização e acompanhamento de propostas comerciais.",
    route: "/app/propostas",
    icon: "clipboard-list",
    status: "AVAILABLE",
    sortOrder: 9,
    isVisible: true,
  },
  {
    key: "precificacao-estrategica",
    name: "Precificação Estratégica",
    description: "Simulação de custos, margem, referência e preço final para disputa.",
    route: "/app/precificacao-estrategica",
    icon: "coins",
    status: "IN_IMPLANTATION",
    sortOrder: 10,
    isVisible: true,
  },
  {
    key: "estrategia-lances",
    name: "Estratégia de Lances",
    description: "Planejamento estratégico de disputa com limites e cenários.",
    route: "/app/estrategia-lances",
    icon: "target",
    status: "IN_IMPLANTATION",
    sortOrder: 11,
    isVisible: true,
  },
  {
    key: "robo-lance",
    name: "Robô de Lance",
    description: "Integração futura para automação de lances quando houver fonte oficial disponível.",
    route: "/app/robo-lance",
    icon: "bot",
    status: "INTEGRATION_PENDING",
    sortOrder: 12,
    isVisible: true,
  },
  {
    key: "prazos",
    name: "Prazos",
    description: "Controle de prazos de esclarecimento, impugnação, proposta, disputa e recursos.",
    route: "/app/prazos",
    icon: "calendar-clock",
    status: "IN_IMPLANTATION",
    sortOrder: 13,
    isVisible: true,
  },
  {
    key: "notificacoes",
    name: "Notificações",
    description: "Alertas internos sobre editais, documentos, vencimentos e movimentações.",
    route: "/app/notificacoes",
    icon: "bell",
    status: "IN_IMPLANTATION",
    sortOrder: 14,
    isVisible: true,
  },
  {
    key: "planos",
    name: "Planos",
    description: "Gestão de assinatura, plano contratado e acesso aos recursos.",
    route: "/app/planos",
    icon: "credit-card",
    status: "IN_IMPLANTATION",
    sortOrder: 15,
    isVisible: true,
  },
  {
    key: "configuracoes",
    name: "Configurações",
    description: "Configurações da conta, empresa e preferências do sistema.",
    route: "/app/configuracoes",
    icon: "settings",
    status: "AVAILABLE",
    sortOrder: 16,
    isVisible: true,
  }
];

async function main() {
  for (const module of modules) {
    await prisma.systemModule.upsert({
      where: { key: module.key },
      update: {
        name: module.name,
        description: module.description,
        route: module.route,
        icon: module.icon,
        status: module.status,
        sortOrder: module.sortOrder,
        isVisible: module.isVisible,
      },
      create: module,
    });
  }

  const saved = await prisma.systemModule.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      key: true,
      name: true,
      status: true,
      route: true,
      sortOrder: true,
      isVisible: true,
    },
  });

  console.table(saved);
  console.log(`Total de módulos cadastrados: ${saved.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });