
function extractTransparenciaToken(raw?: string): string {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (t.startsWith('[') || t.startsWith('{')) {
    const m = t.match(/"value"\s*:\s*"([^"]+)"/i);
    if (m && m[1]) return m[1].trim();
  }
  return t;
}
export interface EmpresaReceitaResumo {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: string;
  dataAbertura: string | null;
  porte: string;
  capitalSocial: number | null;
  cnaePrincipal: string;
  uf: string;
  municipio: string;
  cep: string;
  endereco: string;
  enderecoChave: string;
  socios: Array<{ nome: string; qualificacao: string }>;
}

export async function consultarComprasGovContratos(cnpj: string): Promise<Array<{
  id: string;
  orgao: string;
  objeto: string;
  valor: number;
  dataAssinatura: string | null;
  modalidade: string;
}>> {
  const limpo = cnpj.replace(/\D/g, '');
  if (limpo.length !== 14) return [];
  try {
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const fim = hoje.toISOString().slice(0, 10);
    const url = `https://dadosabertos.compras.gov.br/modulo-contratacoes/3_consultarResultadoItensContratacoes_PNCP_14133?pagina=1&tamanhoPagina=20&dataResultadoPncpInicial=${inicio}&dataResultadoPncpFinal=${fim}&niFornecedor=${limpo}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const json: any = await r.json();
    const lista = Array.isArray(json?.resultado) ? json.resultado : [];
    return lista.map((c: any, idx: number) => ({
      id: String(c.idCompra || c.numeroControlePNCPCompra || `comprasgov-${idx}`),
      orgao: String(c.orgaoEntidadeRazaoSocial || c.unidadeOrgaoNomeUnidade || (c.orgaoEntidadeCnpj ? `Ã“rgÃ£o CNPJ ${c.orgaoEntidadeCnpj}` : 'Ã“rgÃ£o PÃºblico')),
      objeto: String(c.descricaoItem || c.nomeMaterialOuServico || c.numeroControlePNCPCompra || 'Item homologado PNCP/Compras.gov'),
      valor: Number(c.valorTotalHomologado || c.valorUnitarioHomologado || 0),
      dataAssinatura: c.dataResultado || c.dataResultadoPncp || null,
      modalidade: String(c.porteFornecedorNome || 'PregÃ£o / PNCP 14.133'),
    }));
  } catch {
    return [];
  }
}

export async function consultarCguCeisCnep(cnpj: string): Promise<{
  status: string;
  alerta: boolean;
  registros: number;
}> {
  const token = extractTransparenciaToken(process.env.TRANSPARENCIA_API_TOKEN || process.env.PORTAL_TRANSPARENCIA_TOKEN);
  if (!token) {
    return { status: 'Token Portal da Transparencia pendente', alerta: false, registros: 0 };
  }
  const limpo = cnpj.replace(/\D/g, '');
  try {
    const [rCeis, rCnep] = await Promise.all([
      fetch(`https://api.portaldatransparencia.gov.br/api-de-dados/ceis?codigoSancionado=${limpo}&pagina=1`, {
        headers: { 'chave-api-dados': token },
        signal: AbortSignal.timeout(5000),
      }),
      fetch(`https://api.portaldatransparencia.gov.br/api-de-dados/cnep?codigoSancionado=${limpo}&pagina=1`, {
        headers: { 'chave-api-dados': token },
        signal: AbortSignal.timeout(5000),
      }),
    ]);
    const ceis = rCeis.ok ? await rCeis.json() : [];
    const cnep = rCnep.ok ? await rCnep.json() : [];
    const total = (Array.isArray(ceis) ? ceis.length : 0) + (Array.isArray(cnep) ? cnep.length : 0);
    return {
      status: total > 0 ? `${total} registro(s) no CEIS/CNEP` : 'Nada consta no CEIS/CNEP',
      alerta: total > 0,
      registros: total,
    };
  } catch {
    return { status: 'Falha temporaria na consulta CGU', alerta: false, registros: 0 };
  }
}

export async function consultarCadeCondutas(cnpj: string): Promise<{
  status: string;
  alerta: boolean;
}> {
  const cadeToken = process.env.CADE_API_TOKEN || process.env.CONECTA_GOV_TOKEN;
  if (!cadeToken) {
    return { status: 'Credenciamento Conecta Gov.br / CADE pendente', alerta: false };
  }
  const limpo = cnpj.replace(/\D/g, '');
  try {
    const r = await fetch(
      `https://apis.cade.gov.br/conduta-anticompetitiva/v1/conduta-anticompetitiva/findByDocumento/${limpo}`,
      {
        headers: { Authorization: `Bearer ${cadeToken}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!r.ok) return { status: 'Consultar portal CADE', alerta: false };
    const data: any = await r.json();
    const possui = Boolean(data?.possuiProcesso || data?.resultado === true);
    return {
      status: possui ? 'Consta processo publico no CADE' : 'Sem ocorrencia de conduta anticompetitiva',
      alerta: possui,
    };
  } catch {
    return { status: 'Indisponivel no momento', alerta: false };
  }
}

export async function consultarCguCompleto(cnpj: string): Promise<{
  ceis: number;
  cnep: number;
  cepim: number;
  leniencia: number;
  alerta: boolean;
  resumo: string;
}> {
  const token = extractTransparenciaToken(
    process.env.TRANSPARENCIA_API_TOKEN || process.env.PORTAL_TRANSPARENCIA_TOKEN
  );
  if (!token) {
    return { ceis: 0, cnep: 0, cepim: 0, leniencia: 0, alerta: false, resumo: 'Token CGU pendente' };
  }
  const limpo = cnpj.replace(/\D/g, '');
  const headers = { 'chave-api-dados': token };
  const opts = { headers, signal: AbortSignal.timeout(5000) };

  let consultasOk = 0;
  const getCount = async (url: string) => {
    try {
      const r = await fetch(url, opts);
      if (!r.ok) return 0;
      consultasOk += 1;
      const j = await r.json();
      return Array.isArray(j) ? j.length : 0;
    } catch {
      return 0;
    }
  };

  const [ceis, cnep, cepim, leniencia] = await Promise.all([
    getCount(`https://api.portaldatransparencia.gov.br/api-de-dados/ceis?codigoSancionado=${limpo}&pagina=1`),
    getCount(`https://api.portaldatransparencia.gov.br/api-de-dados/cnep?codigoSancionado=${limpo}&pagina=1`),
    getCount(`https://api.portaldatransparencia.gov.br/api-de-dados/cepim?codigoSancionado=${limpo}&pagina=1`),
    getCount(`https://api.portaldatransparencia.gov.br/api-de-dados/acordos-leniencia?cnpjSancionado=${limpo}&pagina=1`),
  ]);

  if (consultasOk === 0) {
    return {
      ceis: 0,
      cnep: 0,
      cepim: 0,
      leniencia: 0,
      alerta: false,
      resumo: 'Falha temporÃ¡ria na consulta CGU',
    };
  }

  const total = ceis + cnep + cepim + leniencia;
  return {
    ceis,
    cnep,
    cepim,
    leniencia,
    alerta: total > 0,
    resumo:
      total > 0
        ? `Constam registros: CEIS(${ceis}), CNEP(${cnep}), CEPIM(${cepim}), Leniencia(${leniencia})`
        : 'Nada consta em CEIS, CNEP, CEPIM e Acordos de Leniencia (CGU)',
  };
}

export async function consultarComprasGovPrecoCatmat(codigoItem?: string): Promise<{
  consultado: boolean;
  amostras: number;
  precoMedio: number | null;
  menorPreco: number | null;
  maiorPreco: number | null;
}> {
  const cod = String(codigoItem || '').replace(/\D/g, '');
  if (!cod) return { consultado: false, amostras: 0, precoMedio: null, menorPreco: null, maiorPreco: null };
  try {
    let lista: any[] = [];
    const r = await fetch(
      `https://dadosabertos.compras.gov.br/modulo-pesquisa-preco/1_consultarMaterial?tipo=ITEM&codigo=${cod}&pagina=1&tamanhoPagina=20`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (r.ok) {
      const json: any = await r.json();
      lista = Array.isArray(json?.resultado) ? json.resultado : [];
    }
    if (lista.length === 0) {
      const fallback = await fetch(
        `https://dadosabertos.compras.gov.br/modulo-pesquisa-preco/2_consultarMaterialDetalhe?codigoItemCatalogo=${cod}&pagina=1&tamanhoPagina=20`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (fallback.ok) {
        const fallbackJson: any = await fallback.json();
        lista = Array.isArray(fallbackJson?.resultado) ? fallbackJson.resultado : [];
      }
    }
    const precos = lista
      .map((x: any) => Number(x.precoUnitario ?? x.valorUnitario ?? 0))
      .filter((v: number) => Number.isFinite(v) && v > 0);
    if (precos.length === 0) return { consultado: true, amostras: 0, precoMedio: null, menorPreco: null, maiorPreco: null };
    const soma = precos.reduce((a: number, b: number) => a + b, 0);
    return {
      consultado: true,
      amostras: precos.length,
      precoMedio: Number((soma / precos.length).toFixed(2)),
      menorPreco: Math.min(...precos),
      maiorPreco: Math.max(...precos),
    };
  } catch {
    return { consultado: false, amostras: 0, precoMedio: null, menorPreco: null, maiorPreco: null };
  }
}


export async function descobrirConcorrentesPorCnae(cnae: string, uf?: string) {
  const codigoCnae = String(cnae || '').replace(/\D/g, '').slice(0, 7);
  if (!codigoCnae) return [];

  const buscarFornecedores = async (pagina: number, filtroUf?: string) => {
    try {
      const url = `https://dadosabertos.compras.gov.br/modulo-fornecedor/1_consultarFornecedor?pagina=${pagina}&tamanhoPagina=25&codigoCnae=${codigoCnae}&ativo=true${filtroUf ? '&uf=' + encodeURIComponent(filtroUf) : ''}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (!r.ok) return [];
      const json: any = await r.json();
      return Array.isArray(json?.resultado) ? json.resultado : [];
    } catch {
      return [];
    }
  };

  try {
    const [pag1Uf, pag2Uf] = await Promise.all([
      buscarFornecedores(1, uf),
      buscarFornecedores(2, uf),
    ]);
    let bruto = [...pag1Uf, ...pag2Uf];
    if (bruto.length < 8 && uf) {
      const pag1Nac = await buscarFornecedores(1);
      bruto = [...bruto, ...pag1Nac];
    }

    const mapa = new Map<string, any>();
    for (const f of bruto) {
      const cnpj = String(f.cnpj || f.niFornecedor || '').replace(/\D/g, '');
      if (cnpj.length !== 14 || mapa.has(cnpj)) continue;
      mapa.set(cnpj, {
        cnpj,
        razaoSocial: String(f.nomeRazaoSocialFornecedor || f.nome || f.razaoSocial || f.nomeFantasia || 'Fornecedor Habilitado').trim(),
        uf: f.ufSigla || f.uf || f.siglaUf || uf || null,
        municipio: f.nomeMunicipio || f.municipio || null,
        porte: f.porteEmpresaNome || f.porteEmpresa || f.porte || null,
        cnae: codigoCnae,
        totalVitorias: 0,
        valorTotal: 0,
      });
    }

    const candidatos = Array.from(mapa.values()).slice(0, 15);
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - 365 * 24 * 60 * 60 * 1000);
    const fmtPncp = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

    await Promise.allSettled(
      candidatos.map(async (cand) => {
        const [cg, pncp] = await Promise.allSettled([
          consultarComprasGovContratos(cand.cnpj),
          fetch(
            `https://pncp.gov.br/api/consulta/v1/contratos?dataInicial=${fmtPncp(inicio)}&dataFinal=${fmtPncp(hoje)}&pagina=1&tamanhoPagina=10&niFornecedor=${cand.cnpj}`,
            { headers: { Accept: 'application/json', 'User-Agent': 'Expertise-SaaS/2.0' }, signal: AbortSignal.timeout(4500) }
          ).then((r) => (r.ok ? r.json() : null)),
        ]);

        const listaCg = cg.status === 'fulfilled' && Array.isArray(cg.value) ? cg.value : [];
        const rawPncp: any = pncp.status === 'fulfilled' ? pncp.value : null;
        const listaPncp = Array.isArray(rawPncp?.data) ? rawPncp.data : Array.isArray(rawPncp) ? rawPncp : [];

        const valCg = listaCg.reduce((s: number, x: any) => s + Number(x.valor || 0), 0);
        const valPncp = listaPncp.reduce((s: number, x: any) => s + Number(x.valorGlobal || x.valorInicial || 0), 0);

        cand.totalVitorias = listaCg.length + listaPncp.length;
        cand.valorTotal = Math.round((valCg + valPncp) * 100) / 100;
      })
    );

    return candidatos.sort((a, b) => (b.totalVitorias - a.totalVitorias) || (b.valorTotal - a.valorTotal));
  } catch {
    return [];
  }
}

export async function descobrirVencedoresPorOrgao(orgaoCnpj: string) {
  const limpo = String(orgaoCnpj || '').replace(/\D/g, '');
  if (limpo.length !== 14) return [];
  try {
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const fim = hoje.toISOString().slice(0, 10);
    const url = `https://dadosabertos.compras.gov.br/modulo-contratacoes/3_consultarResultadoItensContratacoes_PNCP_14133?pagina=1&tamanhoPagina=20&dataResultadoPncpInicial=${inicio}&dataResultadoPncpFinal=${fim}&orgaoEntidadeCnpj=${limpo}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const json: any = await r.json();
    const lista = Array.isArray(json?.resultado) ? json.resultado : [];
    return lista.map((c: any) => ({
      cnpj: String(c.niFornecedor || '').replace(/\D/g, ''),
      razaoSocial: String(c.nomeRazaoSocialFornecedor || 'Empresa Vencedora'),
      porte: c.porteFornecedorNome || null,
      valorHomologado: Number(c.valorTotalHomologado || c.valorUnitarioHomologado || 0),
      objeto: String(c.descricaoItem || c.nomeMaterialOuServico || ''),
      dataResultado: c.dataResultado || c.dataResultadoPncp || null,
    })).filter((x: any) => x.cnpj.length === 14);
  } catch {
    return [];
  }
}
