import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const pages = [
  {
    route: '/',
    title: 'EXPERTISE Licitatória | Radar PNCP e documentos',
    description:
      'Consulte editais no PNCP sob demanda e organize os documentos reais da sua empresa.',
  },
  {
    route: '/login',
    title: 'Entrar | EXPERTISE Licitatória',
    description: 'Acesse o ambiente autenticado da EXPERTISE Licitatória.',
  },
  {
    route: '/register',
    title: 'Criar conta | EXPERTISE Licitatória',
    description: 'Cadastre o responsável e a empresa para acessar os módulos operacionais ativos.',
  },
];

const distDir = path.resolve('dist');
const ssrDir = path.resolve('dist-ssr');
const template = await readFile(path.join(distDir, 'index.html'), 'utf8');

// Salva o template vazio original para ser usado como fallback SPA (para que a hidratação não quebre)
await writeFile(path.join(distDir, 'app.html'), template, 'utf8');

const { render } = await import(pathToFileURL(path.join(ssrDir, 'entry-server.js')).href);

for (const page of pages) {
  const html = render(page.route);
  const canonicalPath = page.route === '/' ? '/' : `${page.route}/`;
  const document = template
    .replace(/<title>.*?<\/title>/, `<title>${page.title}</title>`)
    .replace(/<meta name="description" content=".*?"\s*\/?>/, `<meta name="description" content="${page.description}" />`)
    .replace('</head>', `    <meta name="robots" content="index,follow" />\n    <link rel="canonical" href="${canonicalPath}" />\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  const targetDir = page.route === '/' ? distDir : path.join(distDir, page.route.slice(1));
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, 'index.html'), document, 'utf8');
}

await rm(ssrDir, { recursive: true, force: true });
console.log(`SSG concluido: ${pages.map((page) => page.route).join(', ')}`);
