import { prisma } from '../database/prisma';
import { ExtractedSpecsFicha } from './edital-deep-analyzer.service';
import { evaluateCnaeCompatibility, extractNoticeSearchableText } from './cnae-compatibility.service';

export interface ItemChecklistEmpresa {
  requisito: string;
  categoria: 'JURIDICA' | 'FISCAL' | 'ECONOMICA' | 'TECNICA';
  status: 'PRONTO' | 'VENCIDO' | 'FALTANDO';
  documentoEmpresa?: string;
  validade?: string | null;
}

export interface CruzamentoEmpresaResultado {
  empresaId: string;
  razaoSocial: string;
  porte: string;
  cnaeCompativel: boolean;
  mensagemCnae: string;
  beneficioMeEppAplicavel: boolean;
  mensagemMeEpp: string;
  checklistDocumentos: ItemChecklistEmpresa[];
  totalProntos: number;
  totalPendentes: number;
  veredito3Linhas: string[];
}

export async function cruzarEditalComEmpresa(
  notice: any,
  ficha: ExtractedSpecsFicha | null,
  companyId?: string | null,
  userId?: string | null,
  sourceMode?: string | null,
): Promise<CruzamentoEmpresaResultado | null> {
  if (!companyId && !userId) return null;

  const company = await prisma.company.findFirst({
    where: companyId ? { id: companyId } : { userId: userId! },
    select: {
      id: true,
      razaoSocial: true,
      porte: true,
      cnaePrincipal: true,
      palavrasChave: true,
      nicho: true,
      uf: true,
    },
  });

  if (!company) return null;

  const now = new Date();
  const docs = await prisma.document.findMany({
    where: { companyId: company.id },
    select: {
      nome: true,
      tipo: true,
      status: true,
      validade: true,
    },
  });

  // 1. Compatibilidade rigorosa de CNAE (Principal + Secundários + Objeto + Itens do Edital)
  const searchableTextNorm = extractNoticeSearchableText({
    object: notice?.object,
    items: notice?.items,
    extractedItems: ficha?.secoes?.objetoContratacao?.itensDetalhados || ficha?.itensDetalhados,
  });
  const cnaeResult = evaluateCnaeCompatibility(company, searchableTextNorm);
  const cnaeCompativel = cnaeResult.cnaeCompativel;
  const mensagemCnae = cnaeResult.mensagemCnae;

  // 2. Porte e ME/EPP
  const porteStr = String(company.porte || 'ME/EPP').toUpperCase();
  const ehMeEpp = porteStr.includes('ME') || porteStr.includes('EPP') || porteStr.includes('MICRO') || porteStr.includes('PEQUENO');
  const editalTemExclusividadeMeEpp = Boolean(ficha?.secoes?.beneficioMeEpp?.exclusivoOuCotaMeEpp);

  let beneficioMeEppAplicavel = true;
  let mensagemMeEpp = 'Ampla concorrência — sua empresa pode participar normalmente.';
  if (editalTemExclusividadeMeEpp) {
    if (ehMeEpp) {
      beneficioMeEppAplicavel = true;
      mensagemMeEpp = `Benefício aplicável: edital com exclusividade/cota para ME/EPP e sua empresa está enquadrada como ${company.porte || 'ME/EPP'}.`;
    } else {
      beneficioMeEppAplicavel = false;
      mensagemMeEpp = `Atenção: o edital prevê cota ou exclusividade para ME/EPP e o porte da empresa é ${company.porte || 'Geral'}.`;
    }
  }

  // 3. Checklist Real de Documentos da Empresa vs Exigências do Edital
  const checkDoc = (matchTerms: string[]): { status: 'PRONTO' | 'VENCIDO' | 'FALTANDO'; nome?: string; validade?: string | null } => {
    const found = docs.find((d) => {
      const txt = `${d.nome} ${d.tipo}`.toLowerCase();
      return matchTerms.some((t) => txt.includes(t));
    });
    if (!found) return { status: 'FALTANDO' };
    const vencidoPorData = found.validade ? new Date(found.validade) < now : false;
    if (found.status !== 'valido' || vencidoPorData) {
      return {
        status: 'VENCIDO',
        nome: found.nome,
        validade: found.validade ? new Date(found.validade).toLocaleDateString('pt-BR') : null,
      };
    }
    return {
      status: 'PRONTO',
      nome: found.nome,
      validade: found.validade ? new Date(found.validade).toLocaleDateString('pt-BR') : null,
    };
  };

  const checklist: ItemChecklistEmpresa[] = [];

  // Jurídica e CNPJ
  const resCnpj = checkDoc(['cnpj', 'contrato social', 'estatuto', 'ato constitutivo']);
  checklist.push({
    requisito: 'Habilitação Jurídica (CNPJ / Contrato Social)',
    categoria: 'JURIDICA',
    status: resCnpj.status,
    documentoEmpresa: resCnpj.nome,
    validade: resCnpj.validade,
  });

  // Fiscal Federal, FGTS e Trabalhista
  const resFed = checkDoc(['federal', 'pgfn', 'receita', 'conjunta']);
  checklist.push({
    requisito: 'Certidão Conjunta Federal (RFB/PGFN)',
    categoria: 'FISCAL',
    status: resFed.status,
    documentoEmpresa: resFed.nome,
    validade: resFed.validade,
  });

  const resFgts = checkDoc(['fgts', 'crf']);
  checklist.push({
    requisito: 'Regularidade do FGTS (CRF)',
    categoria: 'FISCAL',
    status: resFgts.status,
    documentoEmpresa: resFgts.nome,
    validade: resFgts.validade,
  });

  const resCndt = checkDoc(['cndt', 'trabalhista']);
  checklist.push({
    requisito: 'Certidão Negativa de Débitos Trabalhistas (CNDT)',
    categoria: 'FISCAL',
    status: resCndt.status,
    documentoEmpresa: resCndt.nome,
    validade: resCndt.validade,
  });

  const resEst = checkDoc(['estadual', 'sefaz', 'fazenda estadual']);
  checklist.push({
    requisito: 'Regularidade Fiscal Estadual',
    categoria: 'FISCAL',
    status: resEst.status,
    documentoEmpresa: resEst.nome,
    validade: resEst.validade,
  });

  const resMun = checkDoc(['municipal', 'prefeitura', 'fazenda municipal']);
  checklist.push({
    requisito: 'Regularidade Fiscal Municipal',
    categoria: 'FISCAL',
    status: resMun.status,
    documentoEmpresa: resMun.nome,
    validade: resMun.validade,
  });

  // Balanço Patrimonial (somente se não for explicitamente dispensado)
  const balancoText = ficha?.secoes?.documentosExigidosHabilitacao?.balancoPatrimonial || '';
  const balancoDispensado = /dispensad|não exigido/i.test(balancoText);
  if (!balancoDispensado) {
    const resBal = checkDoc(['balanço', 'balanco', 'dre', 'contábil', 'contabil']);
    checklist.push({
      requisito: 'Balanço Patrimonial e Demonstrações Contábeis',
      categoria: 'ECONOMICA',
      status: resBal.status,
      documentoEmpresa: resBal.nome,
      validade: resBal.validade,
    });
  }

  // Atestado Técnico (se citado no edital)
  const atestadoText = ficha?.secoes?.documentosExigidosHabilitacao?.atestadoTecnico || '';
  if (!/não exigido/i.test(atestadoText)) {
    const resAt = checkDoc(['atestado', 'capacidade técnica', 'capacidade tecnica', 'cat']);
    checklist.push({
      requisito: 'Atestado de Capacidade Técnica compatível',
      categoria: 'TECNICA',
      status: resAt.status,
      documentoEmpresa: resAt.nome,
      validade: resAt.validade,
    });
  }

  const totalProntos = checklist.filter((i) => i.status === 'PRONTO').length;
  const totalPendentes = checklist.length - totalProntos;

  // 4. Veredito Prático de Decisão (3 linhas simples)
  const linha1 = cnaeCompativel && beneficioMeEppAplicavel
    ? `✅ Aderência positiva: objeto compatível com a empresa (${company.razaoSocial}) e enquadramento regular.`
    : `⚠️ Atenção à aderência: ${!cnaeCompativel ? 'verifique a compatibilidade do CNAE com o objeto.' : mensagemMeEpp}`;

  const pendenciasNomes = checklist.filter((i) => i.status !== 'PRONTO').map((i) => i.requisito.split(' (')[0]);
  const linha2 = totalPendentes === 0
    ? `✅ Documentação em dia: todos os ${totalProntos} documentos principais estão válidos e prontos no seu cofre.`
    : `⚠️ Documentação: ${totalProntos} de ${checklist.length} prontos. Pendente/vencido: ${pendenciasNomes.slice(0, 3).join(', ')}${pendenciasNomes.length > 3 ? '...' : ''}.`;

  const temPdfReal = sourceMode === 'PDF_ANEXO_REAL';
  const totalVicios = ficha?.auditoria?.totalVicios || 0;
  const linha3 = !temPdfReal
    ? 'Auditoria de cláusulas pendente: apenas os dados básicos do portal foram publicados. Anexe o PDF do edital para checar exigências e riscos antes de disputar.'
    : totalVicios > 0
      ? `Alerta Jurídico: foram detectadas ${totalVicios} cláusula(s) restritiva(s) passíveis de impugnação antes da disputa.`
      : 'Segurança Jurídica: nenhuma cláusula restritiva encontrada nos arquivos analisados — cenário seguro para precificar e disputar.';

  return {
    empresaId: company.id,
    razaoSocial: company.razaoSocial,
    porte: company.porte || 'ME/EPP',
    cnaeCompativel,
    mensagemCnae,
    beneficioMeEppAplicavel,
    mensagemMeEpp,
    checklistDocumentos: checklist,
    totalProntos,
    totalPendentes,
    veredito3Linhas: [linha1, linha2, linha3],
  };
}
