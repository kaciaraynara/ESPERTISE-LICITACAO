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

export interface ResultadoAnaliseFraude {
  possuiSociosEmComum: boolean;
  risco: NivelRiscoFraude;
  resumo: ResumoMalhaFina;
  empresas: EmpresaMalhaFina[];
  vinculosSocietarios: VinculoSocietario[];
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

  const resumo = buildResumo(empresasUnicas, vinculosSocietarios.length);
  const risco = classificarRisco(vinculosSocietarios, resumo);

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
    recomendacoes: buildRecomendacoes(risco, resumo, vinculosSocietarios),
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
