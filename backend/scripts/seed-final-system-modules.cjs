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

const visibleModules = [
  {
    key: "pagina-inicial",
    name: "Página Inicial",
    description: "Painel central do licitante com oportunidades, riscos, prazos, documentos e próximas ações.",
    route: "/app",
    icon: "layout-dashboard",
    status: "AVAILABLE",
    sortOrder: 1,
  },
  {
    key: "academia-licitante",
    name: "Academia do Licitante",
    description: "Conteúdos práticos para ensinar licitação, etapas, regras, documentos, proposta, prazos e disputa.",
    route: "/app/academia-licitante",
    icon: "graduation-cap",
    status: "IN_IMPLANTATION",
    sortOrder: 2,
  },
  {
    key: "radar-editais",
    name: "Radar de Editais",
    description: "Busca de oportunidades reais em fontes oficiais, com filtros por objeto, UF, modalidade, data e valor.",
    route: "/app/radar",
    icon: "search",
    status: "AVAILABLE",
    sortOrder: 3,
  },
  {
    key: "score-oportunidades",
    name: "Score de Oportunidades",
    description: "Classificação dos melhores editais para o perfil do licitante, considerando aderência, prazo, valor e risco.",
    route: "/app/score-oportunidades",
    icon: "chart-line",
    status: "IN_IMPLANTATION",
    sortOrder: 4,
  },
  {
    key: "radar-nulidades",
    name: "Radar de Nulidades",
    description: "Análise de possíveis falhas, restrições, inconsistências e riscos no edital com base no documento real.",
    route: "/app/radar-nulidades",
    icon: "radar",
    status: "IN_IMPLANTATION",
    sortOrder: 5,
  },
  {
    key: "srp-carona",
    name: "SRP e Carona",
    description: "Análise estratégica de atas de registro de preços, adesões, vantajosidade, saldos e riscos de carona.",
    route: "/app/srp-carona",
    icon: "network",
    status: "IN_IMPLANTATION",
    sortOrder: 6,
  },
  {
    key: "editais-monitorados",
    name: "Editais Monitorados",
    description: "Editais salvos pelo licitante para acompanhamento, análise, prazos e decisão de participação.",
    route: "/app/editais-monitorados",
    icon: "bookmark",
    status: "IN_IMPLANTATION",
    sortOrder: 7,
  },
  {
    key: "analise-oportunidade",
    name: "Análise de Oportunidade",
    description: "Avaliação prática para decidir se vale a pena disputar com base em aderência, documentos, prazo e risco.",
    route: "/app/analise-oportunidade",
    icon: "target",
    status: "IN_IMPLANTATION",
    sortOrder: 8,
  },
  {
    key: "estrategia-disputa",
    name: "Estratégia de Disputa",
    description: "Planejamento de preço, limite de lance, margem mínima, riscos e próxima ação para disputar melhor.",
    route: "/app/estrategia-disputa",
    icon: "crosshair",
    status: "IN_IMPLANTATION",
    sortOrder: 9,
  },
  {
    key: "precificacao-estrategica",
    name: "Precificação Estratégica",
    description: "Cálculo de preço seguro, agressivo e de risco com custos, impostos, logística, taxas e margem.",
    route: "/app/precificacao-estrategica",
    icon: "calculator",
    status: "IN_IMPLANTATION",
    sortOrder: 10,
  },
  {
    key: "propostas",
    name: "Propostas",
    description: "Criação e validação de propostas comerciais vinculadas ao edital, itens, valores e documentos.",
    route: "/app/propostas",
    icon: "file-check",
    status: "IN_IMPLANTATION",
    sortOrder: 11,
  },
  {
    key: "catalogo-produtos-servicos",
    name: "Catálogo de Produtos e Serviços",
    description: "Catálogo padrão do licitante com itens, serviços, descrições, margens, documentos e palavras-chave.",
    route: "/app/catalogo-produtos-servicos",
    icon: "boxes",
    status: "IN_IMPLANTATION",
    sortOrder: 12,
  },
  {
    key: "documentos-licitante",
    name: "Documentos do Licitante",
    description: "Controle de certidões, documentos, atestados, validade, vencimentos e checklist de habilitação.",
    route: "/app/documentos-licitante",
    icon: "folder-lock",
    status: "IN_IMPLANTATION",
    sortOrder: 13,
  },
  {
    key: "prazos-alertas",
    name: "Prazos e Alertas",
    description: "Controle de prazos de proposta, esclarecimento, impugnação, sessão, recurso e documentos vencendo.",
    route: "/app/prazos-alertas",
    icon: "calendar-clock",
    status: "IN_IMPLANTATION",
    sortOrder: 14,
  },
  {
    key: "lex-inteligencia",
    name: "LEX Inteligência Licitatória",
    description: "Assistente da EXPERTISE com respostas baseadas em documentos, regras, normas e fontes verificadas.",
    route: "/app/lex-inteligencia",
    icon: "brain",
    status: "IN_IMPLANTATION",
    sortOrder: 15,
  },
  {
    key: "investigacao-concorrencial",
    name: "Investigação Concorrencial",
    description: "Módulo Master para identificar indícios, padrões incomuns, riscos de cartel, fraude e baixa competitividade.",
    route: "/app/investigacao-concorrencial",
    icon: "fingerprint",
    status: "IN_IMPLANTATION",
    sortOrder: 16,
  },
  {
    key: "relatorios-estrategicos",
    name: "Relatórios Estratégicos",
    description: "Relatórios de nulidades, SRP, carona, oportunidade, investigação, proposta e decisão de disputa.",
    route: "/app/relatorios-estrategicos",
    icon: "file-bar-chart",
    status: "IN_IMPLANTATION",
    sortOrder: 17,
  },
  {
    key: "planos",
    name: "Planos",
    description: "Gestão dos planos Básico, Pro e Master, limites de uso, assinatura e acesso aos recursos.",
    route: "/app/planos",
    icon: "credit-card",
    status: "IN_IMPLANTATION",
    sortOrder: 18,
  },
  {
    key: "configuracoes",
    name: "Configurações",
    description: "Configurações da conta, empresa, usuários, segurança e preferências da plataforma.",
    route: "/app/configuracoes",
    icon: "settings",
    status: "AVAILABLE",
    sortOrder: 19,
  },
];

const hiddenModules = [
  "assistente-juridico",
  "juridico",
  "contabilidade-habilitacao",
  "cofre-documental",
  "estrategia-lances",
  "robo-lance",
  "notificacoes",
];

async function main() {
  for (const module of visibleModules) {
    await prisma.systemModule.upsert({
      where: { key: module.key },
      update: {
        name: module.name,
        description: module.description,
        route: module.route,
        icon: module.icon,
        status: module.status,
        sortOrder: module.sortOrder,
        isVisible: true,
      },
      create: {
        ...module,
        isVisible: true,
      },
    });
  }

  await prisma.systemModule.updateMany({
    where: {
      key: {
        in: hiddenModules,
      },
    },
    data: {
      isVisible: false,
      status: "HIDDEN",
    },
  });

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
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });