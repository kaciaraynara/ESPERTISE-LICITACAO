
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
      orgao: String(c.orgaoEntidadeRazaoSocial || c.unidadeOrgaoNomeUnidade || 'Órgão Público'),
      objeto: String(c.descricaoItem || c.nomeMaterialOuServico || c.numeroControlePNCPCompra || 'Item homologado PNCP/Compras.gov'),
      valor: Number(c.valorTotalHomologado || c.valorUnitarioHomologado || 0),
      dataAssinatura: c.dataResultado || c.dataResultadoPncp || null,
      modalidade: String(c.porteFornecedorNome || 'Pregão / PNCP 14.133'),
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

  const getCount = async (url: string) => {
    try {
      const r = await fetch(url, opts);
      if (!r.ok) return 0;
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
    const r = await fetch(
      `https://dadosabertos.compras.gov.br/modulo-pesquisa-preco/1_consultarMaterial?codigoItemCatalogo=${cod}&pagina=1&tamanhoPagina=20`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return { consultado: false, amostras: 0, precoMedio: null, menorPreco: null, maiorPreco: null };
    const json: any = await r.json();
    const precos = (Array.isArray(json?.resultado) ? json.resultado : [])
      .map((x: any) => Number(x.precoUnitario || 0))
      .filter((v: number) => v > 0);
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
  try {
    const url = `https://dadosabertos.compras.gov.br/modulo-fornecedor/1_consultarFornecedor?pagina=1&tamanhoPagina=20&codigoCnae=${codigoCnae}&ativo=true${uf ? '&uf=' + encodeURIComponent(uf) : ''}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const json: any = await r.json();
    const lista = Array.isArray(json?.resultado) ? json.resultado : [];
    return lista.map((f: any) => ({
      cnpj: String(f.cnpj || f.niFornecedor || '').replace(/\D/g, ''),
      razaoSocial: String(f.nome || f.razaoSocial || 'Fornecedor Habilitado'),
      uf: f.uf || uf || null,
      municipio: f.municipio || null,
      porte: f.porteEmpresa || f.porte || null,
      cnae: codigoCnae,
    })).filter((f: any) => f.cnpj.length === 14);
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
