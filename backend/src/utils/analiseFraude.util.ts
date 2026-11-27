import type { ReceitaEmpresaQsa, ReceitaSocioQsa } from '../services/receita.service';

export type NivelRiscoFraude = 'ALTO' | 'MEDIO' | 'BAIXO';

export interface EmpresaMalhaFina {
  cnpj: string;
  razaoSocial: string;
  totalSocios: number;
  socios: ReceitaSocioQsa[];
}

export interface OcorrenciaSocietaria {
  cnpj: string;
  razaoSocial: string;
  qualificacao: string | null;
  dataEntradaSociedade: string | null;
}

export interface VinculoSocietario {
  socio: {
    nome: string;
    documentoMascarado: string | null;
  };
  empresas: OcorrenciaSocietaria[];
  totalEmpresas: number;
  severidade: NivelRiscoFraude;
}

export interface ResumoMalhaFina {
  totalConcorrentes: number;
  empresasComQsa: number;
  empresasSemQsa: number;
  totalSociosAnalisados: number;
  totalVinculosSocietarios: number;
}

export interface IndicioOperacionalMalhaFina {
  tipo: 'MESMO_ENDERECO' | 'MESMO_TELEFONE' | 'PARENTESCO_PROVAVEL';
  descricao: string;
  empresas: Array<{ cnpj: string; razaoSocial: string }>;
  severidade: NivelRiscoFraude;
}

export interface ResultadoAnaliseFraude {
  possuiSociosEmComum: boolean;
  risco: NivelRiscoFraude;
  resumo: ResumoMalhaFina;
  empresas: EmpresaMalhaFina[];
  vinculosSocietarios: VinculoSocietario[];
  indiciosOperacionais?: IndicioOperacionalMalhaFina[];
  recomendacoes: string[];
}

export interface ResultadoInvestigacaoFraude extends ResultadoAnaliseFraude {
  empresasReceita: ReceitaEmpresaQsa[];
}

interface SocioIndexEntry {
  nome: string;
  documentoMascarado: string | null;
  ocorrencias: OcorrenciaSocietaria[];
}

export async function analisarConluioPorCnpjs(
  cnpjs: string[],
  carregarQsa: (cnpjs: string[]) => Promise<ReceitaEmpresaQsa[]>,
): Promise<ResultadoInvestigacaoFraude> {
  const empresasReceita = await carregarQsa(cnpjs);
  const analise = analisarConluioSocietario(empresasReceita);

  return {
    ...analise,
    empresasReceita,
  };
}

export function analisarConluioSocietario(empresas: ReceitaEmpresaQsa[]): ResultadoAnaliseFraude {
  const empresasUnicas = dedupeEmpresas(empresas);
  const sociosPorChave = new Map<string, SocioIndexEntry>();

  for (const empresa of empresasUnicas) {
    for (const socio of empresa.qsa) {
      const chave = buildSocioKey(socio);
      if (!chave) continue;

      const entry = sociosPorChave.get(chave) ?? {
        nome: socio.nome,
        documentoMascarado: socio.documentoMascarado,
        ocorrencias: [],
      };

      const jaRegistrado = entry.ocorrencias.some((ocorrencia) => ocorrencia.cnpj === empresa.cnpj);
      if (!jaRegistrado) {
        entry.ocorrencias.push({
          cnpj: empresa.cnpj,
          razaoSocial: empresa.razaoSocial,
          qualificacao: socio.qualificacao,
          dataEntradaSociedade: socio.dataEntradaSociedade,
        });
      }

      sociosPorChave.set(chave, entry);
    }
  }

  const vinculosSocietarios = Array.from(sociosPorChave.values())
    .filter((entry) => entry.ocorrencias.length > 1)
    .map(mapVinculoSocietario)
    .sort((a, b) => b.totalEmpresas - a.totalEmpresas || a.socio.nome.localeCompare(b.socio.nome));

  const indiciosOperacionais = detectarIndiciosOperacionais(empresasUnicas);
  const resumo = buildResumo(empresasUnicas, vinculosSocietarios.length);
  const temIndicioAlto = indiciosOperacionais.some((i) => i.severidade === 'ALTO');
  const riscoBase = classificarRisco(vinculosSocietarios, resumo);
  const risco: NivelRiscoFraude = temIndicioAlto ? 'ALTO' : (indiciosOperacionais.length > 0 && riscoBase === 'BAIXO' ? 'MEDIO' : riscoBase);
  const recBase = buildRecomendacoes(risco, resumo, vinculosSocietarios);
  const recExtras = indiciosOperacionais.map((i) => i.descricao);

  return {
    possuiSociosEmComum: vinculosSocietarios.length > 0,
    risco,
    resumo,
    empresas: empresasUnicas.map((empresa) => ({
      cnpj: empresa.cnpj,
      razaoSocial: empresa.razaoSocial,
      totalSocios: empresa.qsa.length,
      socios: empresa.qsa,
    })),
    vinculosSocietarios,
    indiciosOperacionais,
    recomendacoes: Array.from(new Set([...recBase, ...recExtras])),
  };
}

function dedupeEmpresas(empresas: ReceitaEmpresaQsa[]): ReceitaEmpresaQsa[] {
  const map = new Map<string, ReceitaEmpresaQsa>();

  for (const empresa of empresas) {
    if (!map.has(empresa.cnpj)) {
      map.set(empresa.cnpj, empresa);
    }
  }

  return Array.from(map.values());
}

function buildSocioKey(socio: ReceitaSocioQsa): string | null {
  const nome = normalizeText(socio.nome);
  const documento = normalizeDocumentoMascarado(socio.documentoMascarado);

  if (!nome && !documento) return null;
  if (documento) return `${nome}|${documento}`;
  return nome;
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeDocumentoMascarado(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').replace(/\s+/g, '').trim();
  const digits = normalized.replace(/\D/g, '');
  return digits.length >= 3 ? normalized.toUpperCase() : null;
}

function mapVinculoSocietario(entry: SocioIndexEntry): VinculoSocietario {
  const totalEmpresas = entry.ocorrencias.length;

  return {
    socio: {
      nome: entry.nome,
      documentoMascarado: entry.documentoMascarado,
    },
    empresas: entry.ocorrencias.sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial)),
    totalEmpresas,
    severidade: totalEmpresas >= 2 ? 'ALTO' : 'BAIXO',
  };
}

function buildResumo(empresas: ReceitaEmpresaQsa[], totalVinculosSocietarios: number): ResumoMalhaFina {
  return {
    totalConcorrentes: empresas.length,
    empresasComQsa: empresas.filter((empresa) => empresa.qsa.length > 0).length,
    empresasSemQsa: empresas.filter((empresa) => empresa.qsa.length === 0).length,
    totalSociosAnalisados: empresas.reduce((acc, empresa) => acc + empresa.qsa.length, 0),
    totalVinculosSocietarios,
  };
}

function classificarRisco(vinculos: VinculoSocietario[], resumo: ResumoMalhaFina): NivelRiscoFraude {
  if (vinculos.length > 0) return 'ALTO';
  if (resumo.empresasSemQsa > 0) return 'MEDIO';
  return 'BAIXO';
}

function buildRecomendacoes(
  risco: NivelRiscoFraude,
  resumo: ResumoMalhaFina,
  vinculos: VinculoSocietario[],
): string[] {
  if (risco === 'ALTO') {
    return [
      'Priorizar revisão documental e jurídica antes da adjudicação.',
      `Validar vínculo societário comum em ${vinculos.length} ocorrência(s) da malha societária.`,
    ];
  }

  if (risco === 'MEDIO') {
    return [
      `Complementar diligência: ${resumo.empresasSemQsa} empresa(s) não retornaram QSA público.`,
      'Registrar análise manual antes de concluir inexistência de vínculo societário.',
    ];
  }

  return [
    'Não foram encontrados sócios em comum nas empresas analisadas.',
    'Manter evidência da consulta no dossiê da licitação.',
  ];
}

function detectarIndiciosOperacionais(empresas: ReceitaEmpresaQsa[]): IndicioOperacionalMalhaFina[] {
  const indicios: IndicioOperacionalMalhaFina[] = [];

  const porEndereco = new Map<string, ReceitaEmpresaQsa[]>();
  for (const emp of empresas) {
    const cep = String(emp.cep || '').replace(/\D/g, '');
    const num = normalizeText(emp.numero);
    if (cep.length === 8 && num) {
      const chave = `${cep}|${num}`;
      const lista = porEndereco.get(chave) || [];
      lista.push(emp);
      porEndereco.set(chave, lista);
    }
  }
  for (const [, grupo] of porEndereco) {
    if (grupo.length > 1) {
      indicios.push({
        tipo: 'MESMO_ENDERECO',
        severidade: 'ALTO',
        descricao: `Concorrentes compartilham exatamente o mesmo endere\u00e7o/CEP (${grupo[0].cep}, n\u00ba ${grupo[0].numero}) - forte ind\u00edcio de grupo econ\u00f4mico ou sede compartilhada (Ac\u00f3rd\u00e3o 1.793/2011-Plen\u00e1rio TCU).`,
        empresas: grupo.map((g) => ({ cnpj: g.cnpj, razaoSocial: g.razaoSocial })),
      });
    }
  }

  const porTelefone = new Map<string, ReceitaEmpresaQsa[]>();
  for (const emp of empresas) {
    const tel = String(emp.telefone || '').replace(/\D/g, '');
    if (tel.length >= 8) {
      const lista = porTelefone.get(tel) || [];
      lista.push(emp);
      porTelefone.set(tel, lista);
    }
  }
  for (const [tel, grupo] of porTelefone) {
    if (grupo.length > 1) {
      indicios.push({
        tipo: 'MESMO_TELEFONE',
        severidade: 'ALTO',
        descricao: `Concorrentes possuem o mesmo telefone cadastrado na Receita Federal (${tel}), indicando poss\u00edvel atua\u00e7\u00e3o coordenada.`,
        empresas: grupo.map((g) => ({ cnpj: g.cnpj, razaoSocial: g.razaoSocial })),
      });
    }
  }

  const sobrenomesComuns = new Set(['SILVA', 'SANTOS', 'OLIVEIRA', 'SOUZA', 'RODRIGUES', 'FERREIRA', 'ALVES', 'PEREIRA', 'LIMA', 'GOMES', 'COSTA', 'RIBEIRO', 'MARTINS', 'CARVALHO', 'ALMEIDA', 'LOPES', 'SOARES', 'FERNANDES', 'VIEIRA', 'BARBOSA', 'ROCHA', 'DIAS', 'NASCIMENTO', 'ANDRADE', 'MOREIRA', 'NUNES', 'MARQUES', 'MACHADO', 'MENDES', 'FREITAS', 'CARDOSO', 'RAMOS', 'JUNIOR', 'FILHO', 'NETO']);
  const porSobrenomeLocal = new Map<string, Array<{ emp: ReceitaEmpresaQsa; socio: string }>>();
  for (const emp of empresas) {
    const mun = normalizeText(emp.municipio);
    if (!mun) continue;
    for (const socio of emp.qsa) {
      const partes = normalizeText(socio.nome).split(' ').filter((p) => p.length >= 4 && !sobrenomesComuns.has(p));
      if (partes.length < 2) continue;
      const ultimoSobrenome = partes[partes.length - 1];
      const chave = `${ultimoSobrenome}|${mun}`;
      const lista = porSobrenomeLocal.get(chave) || [];
      if (!lista.some((x) => x.emp.cnpj === emp.cnpj)) {
        lista.push({ emp, socio: socio.nome });
      }
      porSobrenomeLocal.set(chave, lista);
    }
  }
  for (const [chave, grupo] of porSobrenomeLocal) {
    if (grupo.length > 1) {
      const sobrenome = chave.split('|')[0];
      indicios.push({
        tipo: 'PARENTESCO_PROVAVEL',
        severidade: 'MEDIO',
        descricao: `Poss\u00edvel v\u00ednculo familiar entre s\u00f3cios de concorrentes no mesmo munic\u00edpio (sobrenome "${sobrenome}"). Validar se h\u00e1 veda\u00e7\u00e3o ou conluio na disputa.`,
        empresas: grupo.map((g) => ({ cnpj: g.emp.cnpj, razaoSocial: g.emp.razaoSocial })),
      });
    }
  }

  return indicios;
}
