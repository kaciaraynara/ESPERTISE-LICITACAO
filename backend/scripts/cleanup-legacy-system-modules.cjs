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

const legacyModulesToHide = [
  "resumo-editais",
  "prazos",
  "assistente-juridico",
  "juridico",
  "contabilidade-habilitacao",
  "cofre-documental",
  "estrategia-lances",
  "robo-lance",
  "notificacoes",
];

async function main() {
  await prisma.systemModule.updateMany({
    where: {
      key: {
        in: legacyModulesToHide,
      },
    },
    data: {
      isVisible: false,
      status: "HIDDEN",
    },
  });

  const visible = await prisma.systemModule.findMany({
    where: {
      isVisible: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
    select: {
      key: true,
      name: true,
      status: true,
      route: true,
      sortOrder: true,
      isVisible: true,
    },
  });

  console.log("=== MODULOS VISIVEIS NO MENU FINAL ===");
  console.table(visible);
  console.log(`Total visivel: ${visible.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });