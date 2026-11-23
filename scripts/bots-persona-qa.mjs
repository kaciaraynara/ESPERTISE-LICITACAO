import fs from 'node:fs';

const BASE_URL = (process.env.API_URL || 'https://www.expertiselicitatoria.com.br/api/v1').replace(/\/+$/, '');
const TOTAL_BOTS = Number(process.env.TOTAL_BOTS || 30);
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);

const PERSONAS_CNAE = [
  { ramo: 'Vestuário e Uniformes', cnae: '1412601', termo: 'uniforme', uf: 'CE' },
  { ramo: 'Software e TI', cnae: '6201501', termo: 'software', uf: 'SP' },
  { ramo: 'Obras e Engenharia', cnae: '4120400', termo: 'obra', uf: 'MG' },
  { ramo: 'Limpeza Predial', cnae: '8121400', termo: 'limpeza', uf: 'RJ' },
  { ramo: 'Material Hospitalar', cnae: '4645101', termo: 'hospitalar', uf: 'BA' },
  { ramo: 'Gêneros Alimentícios', cnae: '4639701', termo: 'alimenticio', uf: 'PR' },
  { ramo: 'Móveis e Escritório', cnae: '4649404', termo: 'mobiliario', uf: 'RS' },
  { ramo: 'Papelaria e Suprimentos', cnae: '4647801', termo: 'papelaria', uf: 'PE' },
  { ramo: 'Instalações Elétricas', cnae: '4321500', termo: 'eletrica', uf: 'GO' },
  { ramo: 'Transporte e Logística', cnae: '4930202', termo: 'transporte', uf: 'SC' },
];

function gerarCnpjValido(seed) {
  const base = String(10000000 + (seed % 89999999)).padStart(8, '0') + '0001';
  const calc = (str, pesos) => {
    let soma = 0;
    for (let i = 0; i < pesos.length; i++) soma += Number(str[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calc(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(base + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base + String(d1) + String(d2);
}

async function req(path, { method = 'GET', token = '', companyId = '', body = null } = {}) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(companyId ? { 'x-company-id': companyId } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(25000),
    });
    const ms = Math.round(performance.now() - t0);
    let json = null;
    try { json = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, ms, json };
  } catch (err) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - t0), error: err?.message || 'Erro de rede' };
  }
}

async function rodarBot(idx) {
  const perfil = PERSONAS_CNAE[idx % PERSONAS_CNAE.length];
  const uid = `${Date.now()}_${idx}`;
  const email = `botqa.${idx}.${Date.now()}@gmail.com`;
  const cnpj = gerarCnpjValido(10000 + idx * 17 + (Date.now() % 5000));
  const empresaNome = `BotQA ${perfil.ramo} #${idx + 1} Ltda`;

  const rel = {
    bot: idx + 1,
    empresa: empresaNome,
    ramo: perfil.ramo,
    cnae: perfil.cnae,
    uf: perfil.uf,
    etapas: {},
    falhas: [],
  };

  // 1. Cadastro
  const reg = await req('/auth/register', {
    method: 'POST',
    body: {
      nome: `Gestor Bot ${idx + 1}`,
      email,
      senha: 'BotQa@2026!Strong',
      aceite_lgpd: true,
      razao_social: empresaNome,
      cnpj,
      cnaePrincipal: perfil.cnae,
      uf: perfil.uf,
      nicho: [perfil.termo],
    },
  });
  rel.etapas.cadastro = { status: reg.status, ms: reg.ms };
  if (!reg.ok) {
    rel.falhas.push(`Cadastro falhou: HTTP ${reg.status} (${reg.json?.message || reg.error || ''})`);
    return rel;
  }

  let token = reg.json?.data?.accessToken || reg.json?.data?.tokens?.accessToken || reg.json?.accessToken || '';
  let companyId = reg.json?.data?.user?.company_id || reg.json?.data?.user?.companies?.[0]?.id || reg.json?.data?.company?.id || '';
  if (!token) {
    const log = await req('/auth/login', { method: 'POST', body: { email, senha: 'BotQa@2026!Strong' } });
    token = log.json?.data?.tokens?.accessToken || log.json?.data?.token || log.json?.tokens?.accessToken || log.json?.accessToken || log.json?.token || '';
    companyId = companyId || log.json?.data?.company?.id || log.json?.data?.empresa?.id || log.json?.company?.id || '';
  }
  if (!token) {
    rel.falhas.push('Cadastro/Login sem token: ' + JSON.stringify(reg.json || {}).slice(0, 120));
    return rel;
  }

  // 2. Bateria paralela de ferramentas reais usadas pela empresa
  const [radarCnae, radarMenorPorte, pca, concorrentes, academia, certidoes, cofre, prazos, planos] = await Promise.all([
    req(`/licitacoes?local=true&apenasAbertos=true&q=${encodeURIComponent(perfil.termo)}&uf=${perfil.uf}&tamanhoPagina=20`, { token, companyId }),
    req(`/licitacoes?local=true&apenasAbertos=true&baixaProcura=true&uf=${perfil.uf}&tamanhoPagina=20`, { token, companyId }),
    req(`/licitacoes/pca?anoPca=2026&cnae=${perfil.cnae}&pagina=1&tamanhoPagina=10`, { token, companyId }),
    req(`/concorrentes/descoberta?cnae=${perfil.cnae}&uf=${perfil.uf}`, { token, companyId }),
    req(`/academia/catalogo`, { token, companyId }),
    req(`/certidoes`, { token, companyId }),
    req(`/documentos`, { token, companyId }),
    req(`/prazos`, { token, companyId }),
    req(`/pagamentos/planos`, { token, companyId }),
  ]);

  const registrar = (nome, r, extrairQtd) => {
    const qtd = r.ok ? extrairQtd(r.json) : 0;
    rel.etapas[nome] = { status: r.status, ms: r.ms, qtd };
    if (!r.ok) rel.falhas.push(`${nome}: HTTP ${r.status} (${r.json?.message || r.error || ''})`);
  };

  registrar('radar_cnae_uf', radarCnae, (j) => j?.meta?.totalRegistros ?? j?.data?.length ?? 0);
  registrar('radar_menor_porte', radarMenorPorte, (j) => j?.meta?.totalRegistros ?? j?.data?.length ?? 0);
  registrar('pca_2026', pca, (j) => j?.total ?? j?.data?.length ?? 0);
  registrar('concorrentes_cnae', concorrentes, (j) => (j?.data?.concorrentesCnae?.length ?? 0) + (j?.data?.vencedoresOrgao?.length ?? 0));
  registrar('academia_netflix', academia, (j) => j?.data?.length ?? 0);
  registrar('certidoes', certidoes, (j) => j?.data?.length ?? 0);
  registrar('cofre', cofre, (j) => j?.data?.length ?? 0);
  registrar('prazos', prazos, (j) => j?.data?.length ?? 0);
  registrar('planos', planos, (j) => j?.data?.length ?? 0);

  // Limpa a conta temporária de QA para não acumular usuários fictícios em produção
  await req('/auth/account', { method: 'DELETE', token, companyId });

  return rel;
}

async function main() {
  console.log(`Iniciando enxame de ${TOTAL_BOTS} bots persona multi-CNAE (concorrencia: ${CONCURRENCY}) em ${BASE_URL}...`);
  const resultados = [];
  for (let i = 0; i < TOTAL_BOTS; i += CONCURRENCY) {
    const lote = Array.from({ length: Math.min(CONCURRENCY, TOTAL_BOTS - i) }, (_, k) => rodarBot(i + k));
    const resLote = await Promise.all(lote);
    resultados.push(...resLote);
    console.log(`Concluidos ${resultados.length}/${TOTAL_BOTS} bots...`);
  }

  const totalFalhas = resultados.reduce((acc, r) => acc + r.falhas.length, 0);
  const aprovados100 = resultados.filter((r) => r.falhas.length === 0).length;

  const linhas = [
    `# Relatório Real de Experiência — Enxame de ${TOTAL_BOTS} Bots Persona Multi-CNAE`,
    `- **Alvo:** ${BASE_URL}`,
    `- **Data:** ${new Date().toISOString()}`,
    `- **Bots 100% sem falhas:** ${aprovados100}/${TOTAL_BOTS}`,
    `- **Total de falhas detectadas:** ${totalFalhas}`,
    '',
    '## Resumo por Empresa Persona',
    '| # | Ramo / CNAE | UF | Cadastro | Radar CNAE+UF | Menor Porte | PCA | Concorrentes | Academia | Falhas |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];

  for (const r of resultados) {
    const e = r.etapas;
    const fmt = (k) => (e[k] ? `${e[k].status} (${e[k].ms}ms${e[k].qtd !== undefined ? ` / ${e[k].qtd} itens` : ''})` : '-');
    linhas.push(`| ${r.bot} | ${r.ramo} (${r.cnae}) | ${r.uf} | ${fmt('cadastro')} | ${fmt('radar_cnae_uf')} | ${fmt('radar_menor_porte')} | ${fmt('pca_2026')} | ${fmt('concorrentes_cnae')} | ${fmt('academia_netflix')} | ${r.falhas.length ? r.falhas.join('; ') : 'OK'} |`);
  }

  fs.writeFileSync('relatorio-bots-qa.md', linhas.join('\n'), 'utf8');
  console.log(`\nRelatorio salvo em relatorio-bots-qa.md | Sem falhas: ${aprovados100}/${TOTAL_BOTS} | Falhas totais: ${totalFalhas}`);
}

main();