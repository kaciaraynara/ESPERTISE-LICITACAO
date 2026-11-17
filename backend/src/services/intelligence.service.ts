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
    const url = `https://dadosabertos.compras.gov.br/modulo-contratos/1_consultarContratos?pagina=1&tamanhoPagina=20&cnpjFornecedor=${limpo}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return [];
    const json: any = await r.json();
    const lista = Array.isArray(json?.resultado) ? json.resultado : [];
    return lista.map((c: any, idx: number) => ({
      id: String(c.id || c.numeroContrato || `comprasgov-${idx}`),
      orgao: String(c.nomeOrgao || c.nomeUnidadeGestora || 'Orgao Federal'),
      objeto: String(c.objeto || c.processo || 'Contrato Compras.gov.br'),
      valor: Number(c.valorGlobal || c.valorInicial || 0),
      dataAssinatura: c.dataAssinatura || c.dataPublicacao || null,
      modalidade: String(c.modalidadeCompra || 'Compras.gov.br'),
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
  const token = process.env.TRANSPARENCIA_API_TOKEN || process.env.PORTAL_TRANSPARENCIA_TOKEN;
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
