import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  Clock,
  Download,
  Building2,
  MapPin,
  RefreshCw,
  Package,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Gavel,
  DollarSign,
  CheckSquare,
  Square,
  ListOrdered,
  Send,
  UploadCloud,
  Timer,
  Target,
  Lightbulb,
  TrendingUp,
} from 'lucide-react';
import { lexApi, licitacoesApi, noticesApi } from '../services/api';
import {
  buildOfficialPncpPortalUrl,
  extractPncpParams,
  formatCnpj,
  formatPncpDateTime,
} from '../utils/pncp';

export interface DossieItem {
  numeroItem?: number | string;
  itemNumber?: number | string;
  numero?: number | string;
  descricao?: string;
  description?: string;
  quantidade?: number | string;
  quantity?: number | string;
  unidadeMedida?: string;
  siglaUnidadeMedida?: string;
  unidade?: string;
  valorUnitarioEstimado?: number | string;
  valorReferencia?: number | string;
  precoUnitario?: number | string;
  valorTotal?: number | string;
  situacaoCompraItemNome?: string;
}

export interface DossieEditalData {
  id: string;
  objeto: string;
  objetoCompra?: string;
  informacaoComplementar?: string | null;
  orgao: string;
  nomeOrgao?: string;
  cnpjOrgao?: string | null;
  cnpj?: string | null;
  uf?: string | null;
  municipio?: string | null;
  valorEstimado?: number | null;
  valor_estimado?: number | null;
  valorTotalEstimado?: number | null;
  dataAbertura?: string | null;
  data_abertura?: string | null;
  dataEncerramento?: string | null;
  data_encerramento?: string | null;
  dataEncerramentoProposta?: string | null;
  dataLimiteProposta?: string | null;
  dataSessaoDisputa?: string | null;
  dataPublicacao?: string | null;
  data_publicacao?: string | null;
  modalidade?: string | null;
  nomeModalidade?: string | null;
  modalidadeNome?: string | null;
  modoDisputa?: string | null;
  criterioJulgamento?: string | null;
  numeroEdital?: string | null;
  numeroCompra?: string | null;
  processo?: string | null;
  numeroControlePNCP?: string | null;
  linkSistemaOrigem?: string | null;
  downloadUrl?: string | null;
  link?: string | null;
  urlOficialPncp?: string | null;
  urlOficial?: string | null;
  itens?: DossieItem[];
  items?: DossieItem[];
  anoCompra?: number | string;
  sequencialCompra?: number | string;
  srp?: boolean | null;
  dataInicioRecebimento?: string | null;
  dataFimRecebimento?: string | null;
  exigenciasHabilitacao?: {
    balanco?: string | null;
    atestados?: string | null;
    certidoes?: string | null;
  };
}

interface DossieEditalModalProps {
  isOpen: boolean;
  onClose: () => void;
  edital: DossieEditalData | null;
  isSalvo?: boolean;
  isSalvando?: boolean;
  onSalvar?: (edital: DossieEditalData) => void;
  titulo?: string;
}

const CHECKLIST_HABILITACAO_PADRAO = [
  {
    id: 'juridica',
    titulo: 'Habilitação Jurídica',
    detalhe: 'Contrato Social consolidado, última alteração contratual ou Registro Comercial.',
  },
  {
    id: 'fiscal',
    titulo: 'Regularidade Fiscal',
    detalhe: 'CND Federal/INSS, CND Estadual, CND Municipal e Certidão de Regularidade do FGTS (CRF).',
  },
  {
    id: 'trabalhista',
    titulo: 'Regularidade Trabalhista',
    detalhe: 'Certidão Negativa de Débitos Trabalhistas (CNDT) emitida pelo TST.',
  },
  {
    id: 'economico',
    titulo: 'Qualificação Econômico-Financeira',
    detalhe: 'Certidão Negativa de Falência e Recuperação Judicial e Balanço Patrimonial (se exigido).',
  },
  {
    id: 'tecnica',
    titulo: 'Atestados de Capacidade Técnica',
    detalhe: 'Atestados emitidos por pessoas jurídicas comprovando fornecimento similar ao objeto.',
  },
  {
    id: 'declaracoes',
    titulo: 'Declarações da Lei 14.133/2021',
    detalhe: 'Cumprimento do art. 7º, XXXIII da CF (menor aprendiz) e inexistência de impedimentos.',
  },
] as const;

function formatCurrency(value?: number | string | null): string {
  if (value === undefined || value === null || value === '') return 'Sigiloso / Ver Itens no TR';
  const num = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num) || num <= 0) return 'Sigiloso / Ver Itens no TR';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

function formatDataHora(isoString?: string | null): string {
  if (!isoString) return 'Conforme cronograma';
  const formatted = formatPncpDateTime(isoString);
  if (formatted === '—') return 'Conforme cronograma';
  return formatted.includes(':') ? formatted.replace(' ', ' às ') : formatted;
}

function escapeHtml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function DossieEditalModal({
  isOpen,
  onClose,
  edital,
  isSalvo = false,
  isSalvando = false,
  onSalvar,
  titulo,
}: DossieEditalModalProps) {
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [itens, setItens] = useState<DossieItem[]>([]);
  const [analiseLuli, setAnaliseLuli] = useState<string | null>(null);
  const [carregandoLuli, setCarregandoLuli] = useState(false);

  const ed: any = edital || {};

  const baixarResumoTimbradoPdf = async () => {
    if (!edital) return;
        let parecerTexto = analiseLuli;
    if (!parecerTexto) {
      parecerTexto = (await gerarAnaliseLuli()) || null;
    }

    const numeroCompra = ed.numeroCompra || ed.numeroEdital || ed.numeroControlePNCP || 'S/N';
    const orgaoNome = ed.orgao || ed.orgaoEntidade?.razaoSocial || 'Orgao Publico';
    const modalidadeNome = ed.modalidadeNome || ed.modalidade || 'Licitacao Publica';
    const nomeCompletoEdital = `${modalidadeNome} ${numeroCompra} - ${orgaoNome}`;
    const urlOficial = buildOfficialPncpPortalUrl(ed);

    const itensRows = itens.slice(0, 50).map((it: any, idx: number) => {
      const unit = Number(it.valorUnitarioEstimado || 0);
      const comp8 = unit > 0 ? formatCurrency(unit * 0.92) : '-';
      return `
      <tr>
        <td style="padding:7px;border-bottom:1px solid #e2e8f0;font-size:11px;">${it.numeroItem ?? idx + 1}</td>
        <td style="padding:7px;border-bottom:1px solid #e2e8f0;font-size:11px;">${escapeHtml(it.descricao || it.materialOuServicoNome || 'Item')}</td>
        <td style="padding:7px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;">${it.quantidade ?? '-'} ${escapeHtml(it.unidadeMedida || '')}</td>
        <td style="padding:7px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;">${unit > 0 ? formatCurrency(unit) : 'Ver TR'}</td>
        <td style="padding:7px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;font-weight:700;color:#15803d;">${comp8}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(nomeCompletoEdital)} - Expertise Licitatoria</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #F97316; padding-bottom: 12px; margin-bottom: 16px; }
    .header img { height: 46px; }
    .badge { background: #081C3A; color: #ffffff; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; max-width: 320px; text-align: right; }
    h2 { font-size: 13px; color: #081C3A; border-left: 4px solid #F97316; padding-left: 8px; margin: 18px 0 8px; text-transform: uppercase; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; white-space: pre-wrap; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #081C3A; color: #ffffff; text-align: left; padding: 7px; font-size: 11px; }
    ul { margin: 6px 0 0 18px; padding: 0; font-size: 12px; }
    li { margin-bottom: 6px; }
    .footer { margin-top: 24px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="${window.location.origin}/assets/logo-expertise.png" alt="Expertise Licitatoria" />
      <div>
        <div style="font-size:15px;font-weight:800;color:#081C3A;">EXPERTISE LICITATORIA</div>
        <div style="font-size:11px;color:#64748b;">Parecer Tecnico e Resumo Executivo do Edital</div>
      </div>
    </div>
    <div class="badge">${escapeHtml(nomeCompletoEdital)}</div>
  </div>

  <h2>1. Identificacao Completa do Certame</h2>
  <div class="box grid">
    <div><strong>Edital / Processo:</strong><br/>${escapeHtml(nomeCompletoEdital)}</div>
    <div><strong>Valor Total Estimado:</strong><br/>${escapeHtml(formatCurrency(ed.valorTotalEstimado ?? ed.valorEstimado))}</div>
    <div><strong>Modalidade / Julgamento:</strong><br/>${escapeHtml(modalidadeNome)} (${escapeHtml(criterioJulgamento || modoDisputa || 'Conforme Edital')})</div>
    <div><strong>Abertura / Prazo:</strong><br/>${escapeHtml(formatPncpDateTime(ed.dataAberturaProposta || ed.dataEncerramentoProposta))}</div>
    ${urlOficial ? `<div style="grid-column:span 2;"><strong>Portal Oficial PNCP:</strong><br/>${escapeHtml(urlOficial)}</div>` : ''}
  </div>

  <h2>2. Objeto Integral da Contratacao</h2>
  <div class="box">${escapeHtml(ed.objeto || ed.objetoCompra || 'Objeto nao informado no PNCP.')}</div>

  <h2>3. Parecer Tecnico-Juridico da Luli (Leitura Real)</h2>
  <div class="box">${escapeHtml(parecerTexto || 'Analise baseada exclusivamente nos metadados e itens oficiais retornados pelo PNCP. Consulte o arquivo integral do Termo de Referencia no portal oficial antes do envio da proposta.')}</div>

  ${itens.length > 0 ? `<h2>4. Itens Oficiais do PNCP e Referencia Competitiva (-8%)</h2>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Descricao</th>
        <th style="text-align:right;">Qtd / Unid.</th>
        <th style="text-align:right;">Ref. PNCP</th>
        <th style="text-align:right;">Sugestao (-8%)</th>
      </tr>
    </thead>
    <tbody>${itensRows}</tbody>
  </table>` : ''}

  <h2>${itens.length > 0 ? '5' : '4'}. Passo a Passo do Que Precisa para Participar (Lei 14.133/2021)</h2>
  <div class="box">
    <ul>
      <li><strong>Passo 1 - Conferencia do CNAE e Edital Oficial:</strong> Verifique se o CNAE da empresa e compativel com o objeto e leia na integra os anexos do edital no portal oficial do PNCP.</li>
      <li><strong>Passo 2 - Documentacao de Habilitacao (Art. 62 a 70):</strong> Separe Contrato Social, Cartao CNPJ, CND Federal/PGFN, CRF/FGTS, CNDT Trabalhista, CNDs Estadual/Municipal, Balanco Patrimonial e Atestados de Capacidade Tecnica (quando exigidos no TR).</li>
      <li><strong>Passo 3 - Prazo de Impugnacao ou Esclarecimento (Art. 164):</strong> Caso identifique clausula restritiva ou duvida tecnica, protocole ate <strong>3 dias uteis antes</strong> da data de abertura da sessao.</li>
      <li><strong>Passo 4 - Cadastro da Proposta e Margem de Disputa:</strong> Envie a proposta inicial no portal oficial antes do horario limite e defina seu piso minimo seguro na Sala de Disputa antes do inicio dos lances.</li>
    </ul>
  </div>

  <div class="footer">
    <span>Documento emitido pela plataforma Expertise Licitatoria com base em dados oficiais do PNCP</span>
    <span>Gerado em ${new Date().toLocaleString('pt-BR')}</span>
  </div>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const gerarAnaliseLuli = async () => {
    if (!edital) return;
    setCarregandoLuli(true);
    try {
      const listaItens = itens
        .slice(0, 8)
        .map((it: any, idx: number) => `${idx + 1}. ${it.descricao || it.description || 'Item'} (Qtd: ${it.quantidade || it.quantity || '-'}, Valor ref.: ${it.valorUnitarioEstimado || it.precoUnitario || '-'})`)
        .join('\n');
      const prompt = `Faça uma análise estratégica cirúrgica deste edital para decisão de participação (sem texto genérico):
Órgão: ${ed.orgao || edital.nomeOrgao || 'Não informado'}
Edital/PNCP: ${ed.numeroEdital || ed.numeroCompra || ed.numeroControlePNCP || edital.id}
Modalidade: ${ed.modalidadeNome || ed.modalidade || 'Pregão'} | Modo de disputa: ${edital.modoDisputa || 'Consultar edital'}
Objeto: ${ed.objetoCompra || ed.objeto}
Valor estimado: ${ed.valorTotalEstimado ?? ed.valorEstimado ?? 'Não informado'}
Abertura/Encerramento: ${edital.dataAbertura || '-'} / ${ed.dataEncerramentoProposta || edital.dataEncerramento || '-'}
${listaItens ? 'Principais itens:\n' + listaItens : ''}
Entregue: 1) Vale a pena disputar e por quê; 2) Tática de lances recomendada para este modo de disputa; 3) Documentos e riscos críticos para checar antes da proposta.`;

      const resp = await lexApi.chat({
        stream: false,
        noticeId: ed.numeroControlePNCP || edital.id,
        messages: [{ role: 'user', content: prompt }],
      } as any);
      const texto = resp?.data?.data?.answer || resp?.data?.answer || resp?.data?.data?.resposta || resp?.data?.resposta || '';
      setAnaliseLuli(texto || 'Não foi possível gerar a análise agora.');
      return texto || null;
    } catch {
      setAnaliseLuli('Não consegui conectar com a Luli agora. Tente novamente em instantes.');
    } finally {
      setCarregandoLuli(false);
    }
  };
  const [criterioJulgamento, setCriterioJulgamento] = useState<string | null>(null);
  const [modoDisputa, setModoDisputa] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!edital?.id) {
      setChecklist({});
      return;
    }
    try {
      const storageKey = `expertise_dossie_chk_${edital.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setChecklist(JSON.parse(saved));
      } else {
        setChecklist({});
      }
    } catch {
      setChecklist({});
    }
  }, [edital?.id]);

  const toggleChecklistItem = useCallback(
    (id: string) => {
      if (!edital?.id) return;
      setChecklist((prev) => {
        const updated = { ...prev, [id]: !prev[id] };
        try {
          localStorage.setItem(`expertise_dossie_chk_${edital.id}`, JSON.stringify(updated));
        } catch {
          // Ignora erros de localStorage
        }
        return updated;
      });
    },
    [edital?.id],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !edital?.id) {
      setItens([]);
      setCriterioJulgamento(null);
      setModoDisputa(null);
      return;
    }

    let active = true;
    setCarregandoItens(true);

    const itensIniciais = edital.itens || edital.items || [];
    if (itensIniciais.length > 0) {
      setItens(itensIniciais);
    }
    setAnaliseLuli(null);

    const fetchItens = async () => {
      try {
        const encodedNoticeId = encodeURIComponent(ed.numeroControlePNCP || edital.id);

        try {
          const res = await licitacoesApi.obterItens(encodedNoticeId);
          const data = res.data?.data || res.data;
          if (Array.isArray(data) && data.length > 0 && active) {
            setItens(data);
            setCarregandoItens(false);
            return;
          }
        } catch {
          // Continua
        }

        try {
          const res = await noticesApi.getItens(encodedNoticeId);
          const data = res.data?.data || res.data;
          if (Array.isArray(data) && data.length > 0 && active) {
            setItens(data);
            setCarregandoItens(false);
            return;
          }
        } catch {
          // Continua
        }

        const pncpParams = extractPncpParams(edital);
        if (pncpParams?.cnpj && pncpParams.anoCompra && pncpParams.sequencialCompra) {
          const { cnpj, anoCompra, sequencialCompra } = pncpParams;

          try {
            const urlPncpV1 = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${Number(anoCompra)}/${Number(sequencialCompra)}/itens`;
            const resp = await fetch(urlPncpV1, { headers: { Accept: 'application/json' } });
            if (resp.ok) {
              const itemsPncp = await resp.json();
              if (Array.isArray(itemsPncp) && itemsPncp.length > 0 && active) {
                setItens(itemsPncp);
                setCarregandoItens(false);
                return;
              }
            }
          } catch {
            // Continua
          }

          try {
            const urlConsultaV1 = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${Number(anoCompra)}/${Number(sequencialCompra)}/itens`;
            const resp = await fetch(urlConsultaV1, { headers: { Accept: 'application/json' } });
            if (resp.ok) {
              const itemsConsulta = await resp.json();
              const arrayFinal = Array.isArray(itemsConsulta) ? itemsConsulta : itemsConsulta?.data;
              if (Array.isArray(arrayFinal) && arrayFinal.length > 0 && active) {
                setItens(arrayFinal);
                setCarregandoItens(false);
                return;
              }
            }
          } catch {
            // Continua
          }
        }

        try {
          const resDetalhe = await noticesApi.getById(encodedNoticeId);
          const detalhe = resDetalhe.data?.data || resDetalhe.data;
          if (detalhe && active) {
            if (detalhe.judgmentCriterion || detalhe.criterioJulgamento) {
              setCriterioJulgamento(detalhe.judgmentCriterion || detalhe.criterioJulgamento);
            }
            if (detalhe.modoDisputa || detalhe.disputeMode) {
              setModoDisputa(detalhe.modoDisputa || detalhe.disputeMode);
            }
            if (Array.isArray(detalhe.items) && detalhe.items.length > 0) {
              setItens((prev) => (prev.length > 0 ? prev : detalhe.items));
            }
          }
        } catch {
          // Metadados opcionais
        }
      } finally {
        if (active) setCarregandoItens(false);
      }
    };

    void fetchItens();

    return () => {
      active = false;
    };
  }, [isOpen, edital]);

  const checklistTotal = CHECKLIST_HABILITACAO_PADRAO.length;
  const checklistCheckedCount = useMemo(() => {
    return CHECKLIST_HABILITACAO_PADRAO.filter((item) => checklist[item.id]).length;
  }, [checklist]);

  const checklistPorcentagem = Math.round((checklistCheckedCount / checklistTotal) * 100);

  const prazoLimiteEnvio =
    edital?.dataLimiteProposta ||
    edital?.dataEncerramentoProposta ||
    edital?.dataEncerramento ||
    edital?.data_encerramento;

  const valorTotalExibido =
    edital?.valorTotalEstimado ??
    edital?.valorEstimado ??
    edital?.valor_estimado;

  const somaRealItens = useMemo(() => {
    if (!itens || itens.length === 0) return null;
    let soma = 0;
    let hasValidItemValue = false;
    for (const it of itens) {
      const v =
        it.valorTotal ??
        Number(it.quantidade || 0) * Number(it.valorUnitarioEstimado || it.valorReferencia || it.precoUnitario || 0);
      const numV = Number(v);
      if (Number.isFinite(numV) && numV > 0) {
        soma += numV;
        hasValidItemValue = true;
      }
    }
    return hasValidItemValue && soma > 0 ? soma : null;
  }, [itens]);

  const valorFinal =
    valorTotalExibido != null && Number(valorTotalExibido) > 0
      ? Number(valorTotalExibido)
      : somaRealItens;

  const resumoEstrategico = useMemo(() => {
    const agora = Date.now();
    const dataLimite = prazoLimiteEnvio ? new Date(prazoLimiteEnvio).getTime() : null;
    const diasAteLimite = dataLimite ? Math.ceil((dataLimite - agora) / 86400000) : null;

    let urgencia = 'Prazo Confortável';
    let urgenciaCor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (diasAteLimite !== null) {
      if (diasAteLimite <= 1) {
        urgencia = 'Crítica (Encerra em menos de 24h)';
        urgenciaCor = 'text-rose-700 bg-rose-50 border-rose-200';
      } else if (diasAteLimite <= 4) {
        urgencia = 'Alta (Últimos dias de envio)';
        urgenciaCor = 'text-amber-700 bg-amber-50 border-amber-200';
      }
    }

    const valor = Number(valorFinal || 0);
    let porteOportunidade = 'Médio Porte';
    if (valor >= 1_000_000) {
      porteOportunidade = 'Grande Porte (Acima de R$ 1 Mi)';
    } else if (valor > 0 && valor < 100_000) {
      porteOportunidade = 'Pequeno Porte';
    } else if (valor === 0) {
      porteOportunidade = 'Sigiloso / Ver Itens no TR';
    }

    return {
      diasAteLimite,
      urgencia,
      urgenciaCor,
      porteOportunidade,
    };
  }, [prazoLimiteEnvio, valorFinal]);

  if (!isOpen || !edital) return null;

  const urlOficialPncp = buildOfficialPncpPortalUrl(ed);
  const cnpjFormatado = formatCnpj(edital.cnpjOrgao || edital.cnpj);
  const numeroPncp =
    ed.numeroControlePNCP ||
    ed.numeroEdital ||
    ed.numeroCompra ||
    edital.processo ||
    edital.id;

  const modalidadeExibida =
    edital.nomeModalidade ||
    ed.modalidadeNome ||
    ed.modalidade ||
    'Pregão Eletrônico';

  const modoDisputaExibido =
    modoDisputa ||
    edital.modoDisputa ||
    criterioJulgamento ||
    edital.criterioJulgamento ||
    'Aberto / Fechado';

  const prazoSessaoDisputa =
    edital.dataSessaoDisputa ||
    edital.dataAbertura ||
    edital.data_abertura ||
    prazoLimiteEnvio;

  const localizacaoExibida =
    [edital.municipio, edital.uf].filter(Boolean).join(' - ') || 'Âmbito Nacional';

  const objetoCompleto =
    ed.objeto ||
    ed.objetoCompra ||
    edital.informacaoComplementar ||
    'Consulte a íntegra do Termo de Referência no edital.';

  

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs print:p-0 print:bg-white print:static">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-4 max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:my-0 print:w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* CABEÇALHO DO RESUMO */}
          <header className="px-6 py-5 bg-gradient-to-r from-slate-50 via-white to-blue-50/30 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:border-b-2 print:border-slate-800 print:bg-white">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-50 text-brand-blue border border-brand-blue/20 print:border-slate-400 print:text-slate-900">
                  <FileText className="w-3.5 h-3.5" />
                  {titulo || 'Resumo Estratégico do Edital'}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  Lei 14.133/2021
                </span>
                {Boolean(edital.srp) && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                    Registro de Preços (SRP)
                  </span>
                )}
                {carregandoItens && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 print:hidden">
                    <RefreshCw className="w-3 h-3 animate-spin text-brand-blue" />
                    Carregando itens oficiais...
                  </span>
                )}
              </div>
              <h1 className="text-xl font-black text-[#0B192C] leading-snug tracking-tight">
                {ed.orgao || edital.nomeOrgao || 'Órgão Licitante'}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs font-semibold text-slate-500">
                <span className="font-mono text-slate-700">Registro: {numeroPncp}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {localizacaoExibida}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end print:hidden">
              <button
                type="button"
                onClick={baixarResumoTimbradoPdf}
                className="btn-baixar-dossie-pdf inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold rounded-full shadow-2xs transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-brand-blue" />
                <span>Baixar Resumo em PDF</span>
              </button>

              <a
                href={urlOficialPncp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-link-pncp inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-bold rounded-full shadow-2xs transition-all cursor-pointer"
              >
                <span>Ver no Portal Oficial do PNCP ↗</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href={urlOficialPncp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-download-edital sr-only"
              >
                Acessar Edital Oficial no PNCP ↗
              </a>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                title="Fechar janela"
                aria-label="Fechar resumo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* CORPO DO RESUMO */}
          <div className="p-6 overflow-y-auto space-y-6 text-sm print:overflow-visible print:p-2 print:space-y-4">
            <div className="bg-gradient-to-br from-blue-50/70 via-white to-slate-50 border border-blue-100/90 rounded-2xl p-5 shadow-xs space-y-3.5 print:bg-white print:border-slate-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100/80 rounded-lg text-brand-blue">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-[#0B192C]">
                      Entenda este Edital em Linguagem Simples
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Visão humana do que o órgão está comprando, porte da compra e como se preparar
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${resumoEstrategico.urgenciaCor}`}>
                    <Clock className="w-3 h-3" />
                    {resumoEstrategico.urgencia}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    <TrendingUp className="w-3 h-3 text-brand-blue" />
                    {resumoEstrategico.porteOportunidade}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-3 border border-slate-200/80 md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    O que o órgão está comprando
                  </span>
                  <p className="text-xs sm:text-[13px] text-slate-800 leading-relaxed font-normal">
                    {objetoCompleto}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-3 border border-slate-200/80 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      Prazos que você não pode perder
                    </span>
                    <p className="text-xs text-slate-700">
                      <strong>Envio de Proposta:</strong><br />
                      <span className="text-orange-600 font-bold">{formatDataHora(prazoLimiteEnvio)}</span>
                    </p>
                    <p className="text-xs text-slate-700 mt-2">
                      <strong>Disputa de Lances:</strong><br />
                      <span className="text-[#0070C0] font-bold">{formatDataHora(prazoSessaoDisputa)}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/95 rounded-xl p-4 border border-blue-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                    <strong className="text-xs font-bold text-slate-900">Análise Estratégica da Luli sobre este Edital</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={gerarAnaliseLuli}
                      disabled={carregandoLuli}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#081C3A] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#0070C0] disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3 h-3 ${carregandoLuli ? 'animate-spin' : ''}`} />
                      {carregandoLuli ? 'Analisando edital...' : analiseLuli ? 'Atualizar análise' : 'Gerar análise com a Luli'}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent('luli:analisar-edital', { detail: { ...edital, itens } }))}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#0070C0]/40 bg-[#0070C0]/10 px-3 py-1.5 text-[11px] font-bold text-[#0070C0] hover:bg-[#0070C0] hover:text-white"
                    >
                      Perguntar no chat
                    </button>
                  </div>
                </div>
                {analiseLuli ? (
                  <div className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-200">
                    {analiseLuli}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Clique em <strong>Gerar análise com a Luli</strong> para ler os itens, o modo de disputa e os prazos reais deste certame e receber a estratégia recomendada.
                  </p>
                )}
              </div>
            </div>

            {/* SEÇÃO 1: IDENTIFICAÇÃO DO CERTAME */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <Building2 className="w-4 h-4 text-brand-blue" />
                <h2 className="text-xs font-black uppercase tracking-wider text-[#0B192C]">
                  Seção 1: Identificação do Certame
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                    Órgão Comprador
                  </span>
                  <p className="font-bold text-slate-900 leading-snug">
                    {ed.orgao || edital.nomeOrgao || 'Administração Pública'}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">{localizacaoExibida}</p>
                </div>

                <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                    CNPJ Oficial & Registro
                  </span>
                  <p className="font-mono font-bold text-slate-900">{cnpjFormatado}</p>
                  <p className="text-xs font-mono text-slate-500 truncate" title={numeroPncp}>
                    Código Oficial: {numeroPncp}
                  </p>
                </div>

                <div className="bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                    Amparo Legal & Modalidade
                  </span>
                  <p className="font-bold text-slate-900">{modalidadeExibida}</p>
                  <p className="text-xs font-semibold text-brand-blue flex items-center gap-1">
                    <Gavel className="w-3.5 h-3.5 shrink-0" />
                    Lei 14.133/2021 ({modoDisputaExibido})
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="p-2 bg-orange-50 text-brand-orange rounded-lg shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                      Prazo Limite para Envio
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {formatDataHora(prazoLimiteEnvio)}
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-brand-blue rounded-lg shrink-0">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                      Sessão de Disputa / Lances
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {formatDataHora(prazoSessaoDisputa)}
                    </span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50/80 to-slate-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
                      Valor Total Estimado
                    </span>
                    <span className="text-base font-black text-brand-blue">
                      {formatCurrency(valorFinal)}
                    </span>
                  </div>
                  <DollarSign className="w-5 h-5 text-brand-blue" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-[#0B192C] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-brand-blue" />
                    Objeto Integral da Contratação
                  </span>
                </div>
                <div className="p-3.5 bg-slate-50/70 rounded-lg border border-slate-100 text-xs sm:text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
                  {objetoCompleto}
                </div>
              </div>
            </section>

            {/* SEÇÃO 2: TABELA OFICIAL DE ITENS E VALORES */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-brand-blue" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#0B192C]">
                    Seção 2: Tabela Oficial de Itens e Valores
                  </h2>
                </div>
                {itens.length > 0 && (
                  <span className="text-[11px] font-bold text-slate-500">
                    {itens.length} {itens.length === 1 ? 'item oficial' : 'itens oficiais'}
                  </span>
                )}
              </div>

              {itens.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                        <th className="py-2.5 px-3 whitespace-nowrap text-center w-16">Item #</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Descrição Detalhada</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-center">Quantidade</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-center">Unidade</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-right">Valor Unitário Estimado</th>
                        <th className="py-2.5 px-3 whitespace-nowrap text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {itens.map((it, idx) => {
                        const itemNum = it.numeroItem ?? it.itemNumber ?? it.numero ?? idx + 1;
                        const descricao = it.descricao ?? it.description ?? 'Item do edital';
                        const qtd = it.quantidade ?? it.quantity ?? 1;
                        const unidade = it.unidadeMedida ?? it.siglaUnidadeMedida ?? it.unidade ?? 'UN';
                        const unitario = it.valorUnitarioEstimado ?? it.valorReferencia ?? it.precoUnitario ?? 0;
                        const total = it.valorTotal ?? (Number(qtd) || 1) * (Number(unitario) || 0);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-slate-900 text-center">
                              {itemNum}
                            </td>
                            <td className="py-3 px-3 leading-relaxed text-slate-800">{descricao}</td>
                            <td className="py-3 px-3 text-center whitespace-nowrap font-semibold">
                              {typeof qtd === 'number' ? qtd.toLocaleString('pt-BR') : qtd}
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-[11px] text-slate-600 uppercase">
                              {unidade}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-semibold text-slate-700">
                              {formatCurrency(unitario)}
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-bold text-brand-blue">
                              {formatCurrency(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : carregandoItens ? (
                <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-brand-blue mx-auto" />
                  <p className="text-xs font-semibold text-slate-600">
                    Carregando tabela oficial de itens e valores da contratação...
                  </p>
                </div>
              ) : (
                <div className="p-5 bg-slate-50/80 rounded-xl border border-dashed border-slate-200 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-700">
                    Valores globais consolidados no Termo de Referência oficial
                  </p>
                  <p className="text-[11px] text-slate-500">
                    O órgão licitante não desmembrou itens avulsos no catálogo do PNCP. Consulte os anexos do certame.
                  </p>
                </div>
              )}
            </section>

            {/* SEÇÃO 3: CHECKLIST DE HABILITAÇÃO DOCUMENTAL */}
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#0B192C]">
                    Seção 3: Checklist de Habilitação Documental
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">
                    {checklistCheckedCount} de {checklistTotal} conferidos ({checklistPorcentagem}%)
                  </span>
                </div>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden print:hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    checklistPorcentagem === 100
                      ? 'bg-emerald-500'
                      : checklistPorcentagem > 50
                        ? 'bg-blue-600'
                        : 'bg-brand-orange'
                  }`}
                  style={{ width: `${checklistPorcentagem}%` }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {CHECKLIST_HABILITACAO_PADRAO.map((item) => {
                  const isChecked = Boolean(checklist[item.id]);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleChecklistItem(item.id)}
                      className={`text-left p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer select-none ${
                        isChecked
                          ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className={`text-xs font-bold leading-snug ${isChecked ? 'text-emerald-900 line-through' : 'text-slate-900'}`}>
                          {item.titulo}
                        </p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{item.detalhe}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* SEÇÃO 4: PASSO A PASSO OPERACIONAL */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <ListOrdered className="w-4 h-4 text-brand-blue" />
                <h2 className="text-xs font-black uppercase tracking-wider text-[#0B192C]">
                  Seção 4: Passo a Passo Operacional para Disputar
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-brand-blue flex items-center justify-center font-black text-xs">
                      1
                    </span>
                    <Send className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-xs font-black text-[#0B192C] leading-snug">
                    Cadastrar proposta de preços
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Acesse o sistema eletrônico indicado no edital e cadastre sua proposta inicial de preços e marcas/modelos.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-brand-blue flex items-center justify-center font-black text-xs">
                      2
                    </span>
                    <UploadCloud className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-xs font-black text-[#0B192C] leading-snug">
                    Inserir declarações e documentos
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Faça o upload dos documentos de habilitação e marque as declarações legais obrigatórias antes do encerramento do prazo.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="w-6 h-6 rounded-full bg-orange-100 text-brand-orange flex items-center justify-center font-black text-xs">
                      3
                    </span>
                    <Timer className="w-4 h-4 text-slate-400" />
                  </div>
                  <h3 className="text-xs font-black text-[#0B192C] leading-snug">
                    Acessar sala de lances com antecedência
                  </h3>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Conecte-se com pelo menos 15 a 30 minutos de antecedência ao horário da sessão para acompanhar os lances sem imprevistos.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* RODAPÉ DO MODAL */}
          <footer className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-2.5 print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={baixarResumoTimbradoPdf}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold rounded-full shadow-2xs transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-brand-blue" />
                  <span>Baixar Resumo em PDF</span>
                </button>
                <a
                  href={urlOficialPncp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-link-pncp inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-bold rounded-full shadow-2xs transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver no PNCP</span>
                </a>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-300 text-xs font-bold text-slate-600 hover:bg-white rounded-full transition-colors cursor-pointer"
                >
                  Fechar
                </button>

                {onSalvar && (
                  <button
                    type="button"
                    onClick={() => onSalvar(edital)}
                    disabled={isSalvo || isSalvando}
                    className={`inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-bold rounded-full transition-all border ${
                      isSalvo
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700 cursor-default'
                        : 'bg-brand-orange text-white hover:bg-orange-600 border-transparent shadow-xs cursor-pointer'
                    }`}
                  >
                    {isSalvando ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : isSalvo ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Salvo</span>
                      </>
                    ) : (
                      <span>Salvar p/ Proposta</span>
                    )}
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 font-medium text-center border-t border-slate-200/60 pt-2">
              Resumo gerado com base em dados sincronizados do PNCP e Lei nº 14.133/2021. Verifique sempre o instrumento convocatório original.
            </p>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}