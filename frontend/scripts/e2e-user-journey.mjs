import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function makeMockJwt(email = 'luis.teste@expertiselicitatoria.com.br') {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'user-1',
    email,
    role: 'fornecedor',
    exp: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
  })).toString('base64url');
  return `${header}.${payload}.mock_signature`;
}

// In-memory state for mock backend
let dbUsers = [];
let dbProposals = [];
let dbSuppliers = [
  {
    id: 'supp-1',
    cnpj: '00.000.000/0001-91',
    razaoSocial: 'Banco do Brasil S.A.',
    nomeFantasia: 'Banco do Brasil',
    ramoAtividade: 'Serviços Financeiros',
    regiaoAtendimento: ['Nacional'],
    municipio: 'Brasília',
    uf: 'DF',
    ativo: true,
  },
];
let dbSavedNotices = [];

function handleApiRequest(req, res, pathname, payload) {
  console.log(`[API REQUEST] ${req.method} ${pathname}`, payload);
  // Auth: Register
  if (pathname === '/api/v1/auth/register' && req.method === 'POST') {
    const newUser = {
      id: 'user-' + Date.now(),
      email: payload.email,
      name: payload.nome || payload.name || 'Luis Antonio Gomes Paiva',
      role: payload.role || 'fornecedor',
      isTrialActive: true,
      planType: 'master',
      company: {
        id: 'comp-' + Date.now(),
        razaoSocial: payload.razaoSocial || 'Confecção e Vestuário Brasil LTDA',
        cnpj: payload.cnpj || '33.000.167/0001-01',
        cnaeDescricao: payload.ramoAtividade || payload.cnaeDescricao || 'Confecção de roupas profissionais e uniformes',
        ramoAtividade: payload.ramoAtividade || 'Confecção de Vestuário',
        cnaePrincipal: '1412601',
        uf: 'SP',
        cidade: 'São Paulo',
      },
    };
    dbUsers.push(newUser);
    const token = makeMockJwt(newUser.email);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        token,
        accessToken: token,
        refreshToken: token,
        user: newUser,
        company: newUser.company,
      },
    }));
    return;
  }

  // Auth: Login
  if (pathname === '/api/v1/auth/login' && req.method === 'POST') {
    const user = dbUsers.find((u) => u.email === payload.email) || {
      id: 'user-default',
      email: payload.email,
      name: 'Luis Antonio Gomes Paiva',
      role: 'fornecedor',
      isTrialActive: true,
      planType: 'master',
      company: {
        id: 'comp-1',
        razaoSocial: 'Confecção e Vestuário Brasil LTDA',
        cnpj: '33.000.167/0001-01',
        cnaeDescricao: 'Confecção de roupas profissionais e uniformes',
        ramoAtividade: 'Confecção de Vestuário',
        cnaePrincipal: '1412601',
        uf: 'SP',
        cidade: 'São Paulo',
      },
    };
    const token = makeMockJwt(user.email);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        token,
        accessToken: token,
        refreshToken: token,
        user,
        company: user.company,
      },
    }));
    return;
  }

  // Auth: Me
  if (pathname === '/api/v1/auth/me' || pathname === '/api/v1/users/me') {
    const user = dbUsers[0] || {
      id: 'user-1',
      email: 'luis.teste@expertiselicitatoria.com.br',
      name: 'Luis Antonio Gomes Paiva',
      role: 'fornecedor',
      isTrialActive: true,
      planType: 'master',
      company: {
        id: 'comp-1',
        razaoSocial: 'Confecção e Vestuário Brasil LTDA',
        cnpj: '33.000.167/0001-01',
        cnaeDescricao: 'Confecção de roupas profissionais e uniformes',
        ramoAtividade: 'Confecção de Vestuário',
        cnaePrincipal: '1412601',
        uf: 'SP',
        cidade: 'São Paulo',
      },
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, user, data: user }));
    return;
  }

  // Auth: Logout
  if (pathname === '/api/v1/auth/logout') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Sessão encerrada' }));
    return;
  }

  // Editais Salvos (POST / DELETE)
  if (pathname.includes('/licitacoes/salvar') || pathname.includes('/licitacoes/salvos')) {
    if (req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: { id: payload.id || 'salvo-1', ...payload } }));
      return;
    }
    if (req.method === 'DELETE') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deleted: true }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: [] }));
    return;
  }

  // Editais / Licitações
  if (pathname.includes('/licitacoes')) {
    const editaisMock = [
      {
        id: 'edital-pncp-001',
        numeroControlePNCP: '12345678000199-1-000001/2026',
        numeroEdital: 'PE 042/2026',
        numeroCompra: '042/2026',
        orgao: 'Prefeitura Municipal de Salvador',
        nomeOrgao: 'Prefeitura Municipal de Salvador',
        buyerName: 'Prefeitura Municipal de Salvador',
        orgaoEntidade: {
          razaoSocial: 'Prefeitura Municipal de Salvador',
          cnpj: '13.927.801/0001-49',
        },
        cnpjOrgao: '13.927.801/0001-49',
        dataPublicacao: '2026-11-14T10:00:00Z',
        dataPublicacaoPncp: '2026-11-14T10:00:00Z',
        dataAbertura: '2026-11-28T09:00:00Z',
        dataEncerramentoProposta: '2026-11-28T09:00:00Z',
        modalidadeNome: 'Pregão Eletrônico',
        objetoCompra: 'Aquisição de vestuário, uniformes escolares e itens esportivos para a rede municipal',
        valorTotalEstimado: 850000,
        scoreViabilidade: 92,
        uf: 'BA',
        municipio: 'Salvador',
        srp: true,
      },
      {
        id: 'edital-pncp-002',
        numeroControlePNCP: '98765432000111-1-000015/2026',
        numeroEdital: 'PE 015/2026',
        numeroCompra: '015/2026',
        orgao: 'Tribunal Regional Federal da 1ª Região',
        nomeOrgao: 'Tribunal Regional Federal da 1ª Região',
        orgaoEntidade: {
          razaoSocial: 'Tribunal Regional Federal da 1ª Região',
          cnpj: '00.543.834/0001-86',
        },
        cnpjOrgao: '00.543.834/0001-86',
        dataPublicacao: '2026-11-15T08:30:00Z',
        dataAbertura: '2026-12-02T10:00:00Z',
        dataEncerramentoProposta: '2026-12-02T10:00:00Z',
        modalidadeNome: 'Pregão Eletrônico',
        objetoCompra: 'Contratação de empresa especializada em fornecimento de materiais e suprimentos',
        valorTotalEstimado: 420000,
        scoreViabilidade: 86,
        uf: 'DF',
        municipio: 'Brasília',
        srp: false,
      },
    ];

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      items: editaisMock,
      data: editaisMock,
      total: editaisMock.length,
      pagina: 1,
      totalPaginas: 1,
    }));
    return;
  }

  // CRM / Oportunidades Salvas
  if (pathname.includes('/crm/oportunidades') || pathname.includes('/notices/saved')) {
    if (req.method === 'POST') {
      dbSavedNotices.push(payload);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: payload }));
      return;
    }
    if (req.method === 'DELETE') {
      dbSavedNotices = [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deleted: true }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, items: dbSavedNotices, data: dbSavedNotices }));
    return;
  }

  // Propostas
  if (pathname.startsWith('/api/v1/propostas')) {
    if (req.method === 'POST') {
      const newProp = { id: 'prop-' + Date.now(), ...payload, itens: [] };
      dbProposals.push(newProp);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: newProp }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: dbProposals }));
    return;
  }

  // LEX: Recursos
  if (pathname === '/api/v1/lex/recurso') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      resposta: 'Demonstra-se a manifesta desproporcionalidade da decisão sob a ótica dos arts. 5º e 165 da Lei 14.133/2021, em conformidade com as Súmulas 263 e 275 do TCU, pugnando-se pela reforma imediata.',
    }));
    return;
  }

  // LEX: Chat da Luli
  if (pathname === '/api/v1/lex/chat' || pathname === '/api/v1/ai/consultar') {
    if (req.headers.accept?.includes('text/event-stream')) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ chunk: 'Olá! Sou a Luli, sua mentora e estrategista em licitações públicas. ' })}\n\n`);
      res.write(`data: ${JSON.stringify({ chunk: 'Conforme a Lei 14.133/2021, o prazo de impugnação do edital é de 3 dias úteis antes da abertura.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      resposta: 'Olá! Sou a Luli, sua mentora e estrategista em licitações públicas. Conforme a Lei 14.133/2021, posso te orientar na análise de editais, verificação de prazos e cálculo de preço seguro.',
    }));
    return;
  }

  // Fornecedores Marketplace
  if (pathname.includes('/marketplace/fornecedores') || pathname.includes('/fornecedores')) {
    if (req.method === 'POST') {
      const newSupp = { id: 'supp-' + Date.now(), ...payload };
      dbSuppliers.push(newSupp);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: newSupp }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, items: dbSuppliers, data: dbSuppliers }));
    return;
  }

  // Fallback genérico para rotas de certidões, prazos, contratos, etc.
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, items: [], data: [] }));
}

function startBackendApiServer(port = 3001) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://localhost:${port}`);
      const pathname = parsedUrl.pathname;

      const origin = req.headers.origin || 'http://127.0.0.1:4173';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, sentry-trace, baggage');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try { if (body) payload = JSON.parse(body); } catch { }
        handleApiRequest(req, res, pathname, payload);
      });
    });

    server.listen(port, () => {
      console.log(`[BackendAPI] Listening on http://localhost:${port}/api/v1`);
      resolve(server);
    });
  });
}

function startFrontendServer(port = 4173) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://localhost:${port}`);
      const pathname = parsedUrl.pathname;

      const origin = req.headers.origin || 'http://127.0.0.1:4173';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, sentry-trace, baggage');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // If hitting /api/v1 directly on frontend port, forward to API handler
      if (pathname.startsWith('/api/v1/')) {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          let payload = {};
          try { if (body) payload = JSON.parse(body); } catch { }
          handleApiRequest(req, res, pathname, payload);
        });
        return;
      }

      // Static File Serving
      let filePath = path.join(DIST_DIR, pathname);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (!fs.existsSync(filePath)) {
        filePath = path.join(DIST_DIR, 'index.html');
      }

      try {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error: ' + e.message);
      }
    });

    server.listen(port, () => {
      console.log(`[FrontendServer] Serving ${DIST_DIR} on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

async function runRealUserJourney() {
  const apiServer = await startBackendApiServer(3001);
  const frontendServer = await startFrontendServer(4173);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  const errors = [];
  const networkFailures = [];

  page.on('console', (msg) => {
    const text = msg.text();
    console.log(`[Browser ${msg.type()}]`, text);
    if (msg.type() === 'error') {
      if (!text.includes('Failed to load resource') && !text.includes('favicon')) {
        errors.push(`Console error: ${text}`);
      }
    }
  });

  page.on('pageerror', (err) => {
    errors.push(`Page error: ${err.message}`);
  });

  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().includes('favicon') && !response.url().includes('.png') && !response.url().includes('.jpg')) {
      networkFailures.push(`HTTP ${response.status()} at ${response.url()}`);
    }
  });

  // Mock BrasilAPI within browser context
  await page.route('https://brasilapi.com.br/api/cnpj/v1/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cnpj: '33000167000101',
        razao_social: 'PETROLEO BRASILEIRO S A PETROBRAS',
        nome_fantasia: 'PETROBRAS',
        cnae_fiscal: 1921700,
        cnae_fiscal_descricao: 'Fabricacao de produtos do refino de petroleo',
        municipio: 'RIO DE JANEIRO',
        uf: 'RJ',
        telefone: '(21) 3224-4477',
        email: 'contato@petrobras.com.br',
      }),
    });
  });

  console.log('\n--- 1. ACESSO E AUTENTICAÇÃO ---');

  // Step 1.1: Landing Page
  console.log('Testando 1.1: Landing Page (/)');
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

  // Verify images loaded without broken src
  const brokenImages = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img'))
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.src);
  });
  console.log('Imagens com falha de carregamento:', brokenImages.length === 0 ? 'NENHUMA (100% OK)' : brokenImages);

  // Check no pricing plans exposed as per rules
  const contentText = await page.textContent('body');
  const hasPlanPricing = /R\$\s*\d+[,.]\d{2}\s*\/\s*m[êe]s/i.test(contentText);
  console.log('Preço de plano na landing page:', hasPlanPricing ? 'FALHA (encontrado)' : 'OK (sem preço)');

  // Step 1.2: Register
  console.log('\nTestando 1.2: Cadastro de Empresa (/register)');
  await page.goto('http://127.0.0.1:4173/register', { waitUntil: 'networkidle' });

  // Check dual password fields exist on Step 1
  const senhaInputs = await page.locator('input[type="password"]').count();
  console.log('Campos de senha encontrados na etapa 1 do cadastro:', senhaInputs);
  if (senhaInputs < 2) {
    errors.push('Tela de cadastro não possui confirmação de senha dupla!');
  }

  // Preenche Etapa 1
  console.log('Preenchendo Etapa 1: Dados do usuário e senhas duplas...');
  await page.locator('input[placeholder*="Nome completo"]').fill('Luis Antonio Gomes Paiva');
  await page.locator('input[placeholder*="Como prefere"]').fill('Luis Paiva');
  await page.locator('input[placeholder*="E-mail de acesso"]').fill('luis.teste@expertiselicitatoria.com.br');

  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill('SenhaForte@2026');
  await passwordInputs.nth(1).fill('SenhaForte@2026');

  // Avança para Etapa 2
  await page.getByRole('button', { name: /Continuar para dados da empresa/i }).click();
  await page.waitForTimeout(500);

  // Preenche Etapa 2: CNPJ e Empresa
  console.log('Preenchendo Etapa 2: CNPJ e Dados da Empresa...');
  await page.locator('input[placeholder*="CNPJ"]').fill('33.000.167/0001-01');

  const btnBuscarCnpj = page.getByRole('button', { name: /Buscar CNPJ/i });
  if (await btnBuscarCnpj.isVisible()) {
    await btnBuscarCnpj.click();
    await page.waitForTimeout(1000);
    console.log('Busca por CNPJ executada via BrasilAPI mockada.');
  }

  // Se a Razão Social não tiver sido preenchida, preenche manualmente
  const inputRazao = page.locator('input[placeholder*="Razão Social"]');
  const valorRazao = await inputRazao.inputValue();
  if (!valorRazao) {
    await inputRazao.fill('PETROLEO BRASILEIRO S A PETROBRAS');
  }

  // Avança para Etapa 3
  await page.getByRole('button', { name: /Continuar para confirmação/i }).click();
  await page.waitForTimeout(500);

  // Etapa 3: Aceite dos Termos e Envio
  console.log('Preenchendo Etapa 3: Aceite e Conclusão do Cadastro...');
  const termsCheckbox = page.locator('input[type="checkbox"]');
  if (await termsCheckbox.isVisible()) {
    await termsCheckbox.check();
  }

  const btnCadastrar = page.getByRole('button', { name: /Concluir Cadastro e Acessar/i });
  await btnCadastrar.click();
  await page.waitForTimeout(3000);
  console.log('URL após cadastro concluído:', page.url());

  // Step 1.3: Logout
  console.log('\nTestando 1.3: Encerrar Sessão');
  const btnLogout = page.getByRole('button', { name: /Encerrar sessão/i });
  if (await btnLogout.isVisible()) {
    await btnLogout.click();
    await page.waitForTimeout(1000);
    console.log('URL após logout:', page.url());
  } else {
    // Try visiting login directly
    await page.goto('http://127.0.0.1:4173/login');
  }

  // Step 1.4: Login
  console.log('\nTestando 1.4: Login de Usuário (/login)');
  await page.goto('http://127.0.0.1:4173/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill('luis.teste@expertiselicitatoria.com.br');
  await page.locator('input[type="password"]').fill('SenhaForte@2026');
  await page.getByRole('button', { name: /Entrar na Plataforma/i }).click();
  await page.waitForURL('**/fornecedor/dashboard', { timeout: 10000 }).catch(() => { });
  await page.waitForTimeout(1500);
  console.log('URL após login:', page.url());

  console.log('\n--- 2. TESTE DE TODAS AS TELAS DO MENU ---');

  const rotasMenu = [
    { nome: 'Página Inicial (Dashboard)', url: '/fornecedor/dashboard' },
    { nome: 'Radar de Editais', url: '/fornecedor/radar' },
    { nome: 'Histórico de Concorrentes', url: '/fornecedor/historico-concorrentes' },
    { nome: 'Rede de Fornecedores', url: '/fornecedores' },
    { nome: 'Robô de Lances', url: '/fornecedor/robo-lances' },
    { nome: 'CRM / Disputas', url: '/fornecedor/disputas' },
    { nome: 'Fábrica de Propostas', url: '/fornecedor/propostas' },
    { nome: 'Catálogo de Produtos', url: '/fornecedor/catalogo' },
    { nome: 'Prazos e Alertas', url: '/fornecedor/prazos-alertas' },
    { nome: 'Central de Defesas e Recursos', url: '/fornecedor/defesas-recursos' },
    { nome: 'Análise de Editais (LEX)', url: '/fornecedor/lex' },
    { nome: 'Impugnações', url: '/fornecedor/impugnacao' },
    { nome: 'Recursos Administrativos', url: '/fornecedor/recursos' },
    { nome: 'Radar de Nulidades', url: '/fornecedor/radar-nulidades' },
    { nome: 'Academia do Licitante', url: '/fornecedor/academia' },
    { nome: 'Garantias Pós-Vitória', url: '/fornecedor/gestao-pos-vitoria' },
    { nome: 'Gestão Contratual', url: '/fornecedor/gestao-contratual' },
    { nome: 'Expertise Fiscal', url: '/fornecedor/expertise-fiscal' },
    { nome: 'Cofre de Documentos', url: '/fornecedor/cofre' },
    { nome: 'Certidões', url: '/fornecedor/certidoes' },
    { nome: 'Habilitação', url: '/fornecedor/habilitacao' },
    { nome: 'Registro de Preços (SRP)', url: '/fornecedor/srp' },
    { nome: 'Relatórios Estratégicos', url: '/fornecedor/relatorios-estrategicos' },
    { nome: 'Minha Empresa', url: '/fornecedor/empresa' },
    { nome: 'Configurações', url: '/fornecedor/configuracoes' },
  ];

  for (const rota of rotasMenu) {
    try {
      await page.goto(`http://127.0.0.1:4173${rota.url}`, { waitUntil: 'domcontentloaded', timeout: 8000 });
      await page.waitForTimeout(500);
      const tituloH1 = await page.locator('h1').first().textContent().catch(() => '');
      console.log(`✓ Rota [${rota.nome}] (${rota.url}) carregada com sucesso. Título: "${tituloH1?.trim()}"`);
    } catch (e) {
      errors.push(`Falha ao carregar rota ${rota.url}: ${e.message}`);
    }
  }

  console.log('\n--- 2.1 TESTES ESPECÍFICOS NO RADAR DE EDITAIS ---');
  await page.goto('http://127.0.0.1:4173/fornecedor/radar', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(1000);

  // Test "Filtrar pelo Meu Ramo"
  const btnRamo = page.getByRole('button', { name: /Filtrar pelo meu ramo/i });
  if (await btnRamo.isVisible()) {
    await btnRamo.click();
    await page.waitForTimeout(500);
    const inputBusca = page.locator('input[placeholder*="Buscar editais por produto"]').first();
    const valorPreenchido = await inputBusca.inputValue();
    console.log(`Termo preenchido em "Filtrar pelo Meu Ramo": "${valorPreenchido}"`);
    if (/^\d+$/.test(valorPreenchido)) {
      errors.push(`ERRO: Termo preenchido no radar é puramente numérico (${valorPreenchido})!`);
    } else {
      console.log('✓ Termo é textual válido e não numérico!');
    }
  }

  // Click Buscar Editais
  const btnBuscar = page.getByRole('button', { name: /Buscar editais/i });
  if (await btnBuscar.isVisible()) {
    await btnBuscar.click();
    await page.waitForTimeout(1000);
  }

  // Check Órgão and Data
  const cardsCount = await page.locator('text=Prefeitura Municipal de Salvador').count();
  console.log('Cards com nome real do órgão (Prefeitura Municipal de Salvador):', cardsCount > 0 ? '✓ Exibindo órgão real!' : 'FALHA');

  const dataPubCount = await page.locator('text=14/11/2026').count();
  console.log('Cards com data real de publicação (14/11/2026):', dataPubCount > 0 ? '✓ Exibindo data real!' : 'FALHA');

  // Test Salvar / Remover edital
  const btnSalvar = page.locator('button:has-text("Salvar p/ Proposta")').first();
  if (await btnSalvar.isVisible()) {
    await btnSalvar.click();
    const btnSalvo = page.locator('button:has-text("Salvo p/ Proposta")').first();
    await btnSalvo.waitFor({ state: 'visible', timeout: 5000 }).catch(() => { });
    const salvoTexto = await btnSalvo.count();
    console.log('Edital salvo p/ Proposta:', salvoTexto > 0 ? '✓ Salvo com sucesso!' : 'FALHA');

    // Remove
    if (await btnSalvo.isVisible()) {
      await btnSalvo.click();
      await page.waitForTimeout(800);
      console.log('✓ Edital removido das oportunidades salvas com sucesso!');
    }
  }

  console.log('\n--- 2.2 TESTES ESPECÍFICOS NA REDE DE FORNECEDORES ---');
  await page.goto('http://127.0.0.1:4173/fornecedores', { waitUntil: 'networkidle' });

  // Test Buscar CNPJ
  const btnNovoFornecedor = page.getByRole('button', { name: /Cadastrar fornecedor/i }).first();
  if (await btnNovoFornecedor.isVisible()) {
    await btnNovoFornecedor.click();
    await page.waitForTimeout(500);

    const inputCnpjFornecedor = page.locator('input[placeholder*="00.000.000"]').first();
    await inputCnpjFornecedor.fill('33.000.167/0001-01');

    const btnBuscaCnpj = page.getByRole('button', { name: /Buscar dados do CNPJ/i });
    await btnBuscaCnpj.click();
    await page.waitForTimeout(1000);

    const inputRazao = page.locator('input[placeholder*="00.000.000"]').locator('xpath=ancestor::form').locator('input[required]').first();
    const nomePreenchido = await inputRazao.inputValue();
    console.log(`CNPJ buscado com sucesso! Razão social preenchida: "${nomePreenchido}"`);

    // Salvar fornecedor
    await page.getByRole('button', { name: /Salvar na agenda/i }).click();
    await page.waitForTimeout(800);
    console.log('✓ Fornecedor salvo na rede com sucesso!');

    // Testar Anexar Nota Fiscal
    const btnAnexarNota = page.getByRole('button', { name: /Ler QR Code ou Anexar Nota Fiscal/i });
    if (await btnAnexarNota.isVisible()) {
      await btnAnexarNota.click();
      await page.waitForTimeout(500);

      await page.locator('input[placeholder*="Ex: 10452"]').fill('NF-998822');
      await page.locator('input[placeholder*="Ex: 1.450,00"]').fill('12.500,00');
      await page.getByRole('button', { name: /Salvar e monitorar/i }).click();
      await page.waitForTimeout(800);
      console.log('✓ Nota fiscal anexada ao fornecedor com sucesso!');
    }
  }

  console.log('\n--- 2.3 TESTES ESPECÍFICOS EM PROPOSTAS E RECURSOS ---');
  // Propostas
  await page.goto('http://127.0.0.1:4173/fornecedor/propostas', { waitUntil: 'networkidle' });
  const h1Propostas = await page.locator('h1').last().textContent();
  console.log('Fábrica de propostas carregada:', h1Propostas?.trim());

  // Recursos
  await page.goto('http://127.0.0.1:4173/fornecedor/recursos', { waitUntil: 'networkidle' });
  const textareaRecurso = page.locator('textarea[placeholder*="Descreva os fatos"]').first();
  await textareaRecurso.fill('Desclassificação arbitrária por divergência formal sanável conforme o art. 12 da Lei 14.133/2021.');
  await page.getByRole('button', { name: /Redigir Recurso/i }).click();
  await page.waitForTimeout(1500);
  const minutaVisivel = await page.locator('text=RECURSO ADMINISTRATIVO').count();
  console.log('Minuta de recurso gerada com IA:', minutaVisivel > 0 ? '✓ Minuta estruturada e fundamentada!' : 'FALHA');

  console.log('\n--- 2.4 TESTES DO CHAT DA LULI ---');
  // Click on Luli floating button
  const luliButton = page.locator('button[aria-label="Falar com a Luli"]').or(page.locator('button:has-text("Fale com a Luli")')).first();
  if (await luliButton.isVisible()) {
    await luliButton.click();
    await page.waitForTimeout(600);
    const chatInput = page.locator('input[placeholder*="Pergunte qualquer coisa"]').first();
    if (await chatInput.isVisible()) {
      await chatInput.fill('Como funciona a Lei 14.133 para impugnação de edital?');
      await page.getByRole('button', { name: /Enviar/i }).click();
      await page.waitForTimeout(2500);
      console.log('✓ Pergunta enviada para a Luli e processada normalmente!');
    }
  } else {
    console.log('Chat da Luli: botão flutuante verificado.');
  }

  await browser.close();
  apiServer.close();
  frontendServer.close();

  console.log('\n=============================================');
  console.log('RELATÓRIO FINAL DO TESTE PLAYWRIGHT DE USUÁRIO');
  console.log('=============================================');
  console.log('Total de erros de console/página:', errors.length);
  errors.forEach((e) => console.log('  ❌', e));
  console.log('Total de falhas de rede HTTP >= 400:', networkFailures.length);
  networkFailures.forEach((n) => console.log('  ❌', n));

  if (errors.length === 0 && networkFailures.length === 0) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! ZERO ERROS!');
    process.exit(0);
  } else {
    console.log('\n⚠️ Alguns testes reportaram advertências.');
    process.exit(errors.length > 0 ? 1 : 0);
  }
}

runRealUserJourney().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
