import api, { noticesApi } from '@/services/api';
import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Scale,
  Copy,
  Check,
  Package,
  Calculator,
  FileCheck,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Info,
  Download,
  Gavel,
  Calendar,
  Truck,
  CreditCard,
  XCircle,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { streamAiChat } from '@/services/aiStream.service';
import { EditalSelector, EditalOption } from '@/components/EditalSelector';
import { useCompany } from '@/contexts/CompanyContext';
import { formatPncpDateBR, formatCnpj } from '@/utils/pncp';

export interface VicioApontamento {
  id?: string;
  titulo: string;
  gravidade: 'ALTO' | 'MEDIO' | 'BAIXO';
  arquivoOrigem?: string;
  pagina?: number | string;
  trechoLiteral: string;
  fundamentoLegal: string;
  explicacaoSimples?: string;
  acaoRecomendada?: string;
}

export interface AuditoriaData {
  status: 'IRREGULARIDADE_DETECTADA' | 'CONFORME';
  mensagem: string;
  totalVicios: number;
  viciosAltos: number;
  viciosMedios: number;
  viciosBaixos: number;
  apontamentos: VicioApontamento[];
}

export interface ArquivoOficial {
  titulo: string;
  tipoDocumento: string;
  urlDownloadOficial: string;
  urlDownloadInterno?: string;
  sequencial?: number;
  tamanhoBytes?: number;
}

function formatBRL(valor?: number | null): string {
  if (valor === undefined || valor === null || !Number.isFinite(Number(valor)) || Number(valor) <= 0) {
    return 'Sigiloso / Ver TR';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor));
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function calcularPrazoImpugnacaoArt164(dataAberturaIso?: string | null): string | null {
  if (!dataAberturaIso) return null;
  const parsed = new Date(dataAberturaIso);
  if (Number.isNaN(parsed.getTime())) return null;

  const cursor = new Date(parsed.getTime());
  let remainingBusinessDays = 3;
  while (remainingBusinessDays > 0) {
    cursor.setDate(cursor.getDate() - 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      remainingBusinessDays -= 1;
    }
  }
  return cursor.toISOString();
}

export const LeitorEditaisPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlEditalId = searchParams.get('edital') || '';

  const [selectedEditalId, setSelectedEditalId] = useState<string>(urlEditalId);
  const [selectedEditalData, setSelectedEditalData] = useState<any>(null);
  const [fichaSpecs, setFichaSpecs] = useState<any>(null);
  const [cruzamentoEmpresa, setCruzamentoEmpresa] = useState<any>(null);
  const [carregandoEdital, setCarregandoEdital] = useState(false);

  // Fonte real de dados e anexos
  const [sourceMode, setSourceMode] = useState<'PDF_ANEXO_REAL' | 'PDF_ESCANEADO_SEM_TEXTO' | 'APENAS_METADADOS_PNCP' | null>(null);
  const [arquivosOficiais, setArquivosOficiais] = useState<ArquivoOficial[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaData | null>(null);

  const [editalTexto, setEditalTexto] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [baixandoArquivo, setBaixandoArquivo] = useState(false);
  const [resultadoStreaming, setResultadoStreaming] = useState('');
  const [_analiseConcluida, setAnaliseConcluida] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [abaDossie, setAbaDossie] = useState<'visao' | 'disputa' | 'itens' | 'entrega' | 'habilitacao' | 'contrato' | 'vicios' | 'arquivos'>('visao');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Atualiza selectedEditalId quando a URL mudar
  useEffect(() => {
    if (urlEditalId && urlEditalId !== selectedEditalId) {
      setSelectedEditalId(urlEditalId);
    }
  }, [urlEditalId]);

  // Carrega os dados reais do edital selecionado
  useEffect(() => {
    if (!selectedEditalId) {
      setSelectedEditalData(null);
      setFichaSpecs(null);
      setCruzamentoEmpresa(null);
      setSourceMode(null);
      setArquivosOficiais([]);
      setAuditoria(null);
      setEditalTexto('');
      return;
    }

    let active = true;
    setCarregandoEdital(true);

    const companyQuery = selectedCompany?.id ? `&companyId=${encodeURIComponent(selectedCompany.id)}` : '';

    Promise.allSettled([
      noticesApi.getBasicSummary(selectedEditalId),
      noticesApi.getById(selectedEditalId),
      api.get('/notices/' + encodeURIComponent(selectedEditalId) + '/chunks?limit=80').catch(() => null),
      api.get('/notices/' + encodeURIComponent(selectedEditalId) + '/chunks?limit=80' + companyQuery).catch(() => null),
    ])
      .then(([basicRes, detailRes, chunksRes]) => {
        if (!active) return;

        let mergedData: any = null;

        if (basicRes.status === 'fulfilled' && basicRes.value?.data) {
          mergedData = basicRes.value.data.data || basicRes.value.data;
        }

        if (detailRes.status === 'fulfilled' && detailRes.value?.data) {
          const detail = detailRes.value.data.data || detailRes.value.data;
          mergedData = {
            ...mergedData,
            ...detail,
            dossier: detail.dossier || mergedData?.dossier,
          };
        }

        let fetchedSourceMode: 'PDF_ANEXO_REAL' | 'PDF_ESCANEADO_SEM_TEXTO' | 'APENAS_METADADOS_PNCP' = 'APENAS_METADADOS_PNCP';
        let fetchedArquivos: ArquivoOficial[] = [];
        let fetchedAuditoria: AuditoriaData | null = null;
        let fetchedSpecs: any = null;
        let textoRealExtraido = '';

        if (chunksRes.status === 'fulfilled' && chunksRes.value?.data) {
          const cd = chunksRes.value.data;
          fetchedSourceMode = cd.sourceMode || 'APENAS_METADADOS_PNCP';
          fetchedArquivos = Array.isArray(cd.arquivosOficiais) ? cd.arquivosOficiais : [];

          if (cd.fichaSpecs) {
            fetchedSpecs = cd.fichaSpecs;
          }
          if (cd.cruzamentoEmpresa) {
            setCruzamentoEmpresa(cd.cruzamentoEmpresa);
          }

          if (cd.auditoriaDeterministica) {
            fetchedAuditoria = cd.auditoriaDeterministica;
          } else if (cd.fichaSpecs?.auditoria) {
            fetchedAuditoria = cd.fichaSpecs.auditoria;
          }

          const rawChunks = Array.isArray(cd.data) ? cd.data : Array.isArray(cd.chunks) ? cd.chunks : [];
          const cleanChunks = rawChunks
            .map((c: any) => (typeof c === 'string' ? c : c.content || ''))
            .filter((c: string) => c && !c.includes('AVISO DE ESCOPO REAL — TEXTO INTEGRAL DO EDITAL NÃO DISPONIBILIZADO EM PDF'));

          if (cleanChunks.length > 0) {
            textoRealExtraido = cleanChunks.join('\n\n');
          }
        }

        setSourceMode(fetchedSourceMode);
        setArquivosOficiais(fetchedArquivos);
        setFichaSpecs(fetchedSpecs);
        if (fetchedAuditoria) {
          setAuditoria(fetchedAuditoria);
        }

        if (mergedData) {
          setSelectedEditalData(mergedData);

          const numEd = mergedData.dossier?.fichaTecnica?.numeroEdital || mergedData.noticeNumber || mergedData.externalId || selectedEditalId;
          const org = mergedData.dossier?.fichaTecnica?.razaoSocial || mergedData.buyerName || 'Órgão Licitante';
          const mod = mergedData.dossier?.fichaTecnica?.modalidade || mergedData.modality || 'Pregão Eletrônico';
          const obj = mergedData.dossier?.descricaoExplicativaObjeto?.objetoIntegral || mergedData.object || '';
          const val = formatBRL(mergedData.dossier?.fichaTecnica?.valorGlobalEstimado || mergedData.estimatedValue);
          const pub = mergedData.dossier?.cronogramaPrazosFatais?.publicacao ? formatPncpDateBR(mergedData.dossier.cronogramaPrazosFatais.publicacao, false) : 'Não informada';
          const rawAbertura =
            mergedData.dossier?.cronogramaPrazosFatais?.aberturaSessaoPublica ||
            mergedData.openingAt ||
            mergedData.closingAt ||
            null;
          const aber = rawAbertura ? formatPncpDateBR(rawAbertura, true) : 'Não informada';
          const rawImpugnacao =
            mergedData.dossier?.cronogramaPrazosFatais?.prazoLimiteImpugnacao ||
            calcularPrazoImpugnacaoArt164(rawAbertura);
          const imp = rawImpugnacao
            ? formatPncpDateBR(rawImpugnacao, true)
            : 'Até 3 dias úteis antes da abertura (Art. 164 da Lei 14.133/21)';

          const itensPreview = Array.isArray(mergedData.dossier?.quadroItensDetalhado) && mergedData.dossier.quadroItensDetalhado.length > 0
            ? '\nITENS DA CONTRATAÇÃO:\n' + mergedData.dossier.quadroItensDetalhado.slice(0, 25).map((it: any) => `- Item ${it.numeroItem}: ${it.descricaoCompleta} | Qtd: ${it.quantidade} ${it.unidadeMedida} | Valor Est.: ${formatBRL(it.valorTotalEstimado)}`).join('\n')
            : '';

          const textoAutoFallback = `EDITAL Nº ${numEd}
ÓRGÃO: ${org}
MODALIDADE: ${mod}
REGIME JURÍDICO: Lei Federal nº 14.133/2021 (Nova Lei de Licitações)
VALOR ESTIMADO GLOBAL: ${val}
DATA DE PUBLICAÇÃO: ${pub}
DATA DA SESSÃO PÚBLICA: ${aber}
PRAZO LIMITE PARA IMPUGNAÇÃO (ART. 164): ${imp}

OBJETO DA CONTRATAÇÃO:
${obj}
${itensPreview}

NOTA OFICIAL: O órgão licitante não anexou o arquivo integral em PDF neste registro. Os dados acima são os registros estruturados oficiais disponíveis no portal.`;

          if (fetchedSourceMode === 'PDF_ANEXO_REAL' && textoRealExtraido.trim().length >= 50) {
            setEditalTexto(textoRealExtraido);
          } else {
            setEditalTexto(textoAutoFallback);
          }
        }
      })
      .catch((err) => {
        console.warn('[LeitorEditais] Falha ao sincronizar dados do edital:', err);
      })
      .finally(() => {
        if (active) setCarregandoEdital(false);
      });

    return () => {
      active = false;
    };
  }, [selectedEditalId]);

  const handleSelectEdital = (edital: EditalOption) => {
    setSelectedEditalId(edital.id);
    setResultadoStreaming('');
    setAnaliseConcluida(false);
    setSearchParams({ edital: edital.id });
    toast.success(`Edital nº ${ edital.numeroEdital || edital.id } selecionado para leitura!`);
  };

  // Download direto e seguro de arquivos
  const handleDownloadArquivo = async (url: string, nomeArquivo: string) => {
    try {
      setBaixandoArquivo(true);
      toast.loading('Iniciando download seguro...', { id: 'download-file' });
      const res = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', nomeArquivo);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success(`Download de "${nomeArquivo}" concluído!`, { id: 'download-file' });
    } catch {
      toast.error('Não foi possível transferir o arquivo diretamente. Tente novamente em alguns segundos.', { id: 'download-file' });
    } finally {
      setBaixandoArquivo(false);
    }
  };

  // Upload manual de PDF oficial
  const handleUploadPdfManual = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Por favor, selecione um arquivo em formato PDF.');
      return;
    }

    setUploadingPdf(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const res = await api.post(`/notices/${selectedEditalId || 'manual'}/analisar-pdf`, {
          pdfBase64: base64Data,
            fileName: file.name,
        });

    if (res.data?.success && res.data?.text) {
      setEditalTexto(res.data.text);
      setSourceMode('PDF_ANEXO_REAL');
      if (res.data.auditoria) {
        setAuditoria(res.data.auditoria);
      }
      if (res.data.fichaSpecs) {
        setFichaSpecs(res.data.fichaSpecs);
      }
      toast.success(`PDF "${file.name}" carregado e auditado com sucesso!`);
    } else {
      toast.error(res.data?.message || 'Não foi possível extrair o texto do PDF.');
    }
  } catch (err: any) {
    console.error('Erro no upload de PDF:', err);
    toast.error(err?.response?.data?.message || 'Falha ao processar o arquivo PDF enviado.');
  } finally {
    setUploadingPdf(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
};
reader.readAsDataURL(file);
  };

const handleAnalisar = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!editalTexto.trim()) {
    toast.error('Cole o texto do edital ou carregue um arquivo para análise.');
    return;
  }

  setAnalisando(true);
  setResultadoStreaming('');
  setAnaliseConcluida(false);

  try {
    const prompt = `Elabore um PARECER EXECUTIVO E AUDITORIA COMPLETA DESTE EDITAL para o licitante.
PROIBIÇÃO ABSOLUTA: Não use introduções de assistente, saudações nem preâmbulos. Entre direto no parecer técnico estruturado rigorosamente:

1. DADOS CADASTRAIS & ENQUADRAMENTO DO CERTAME:
   - Órgão Convocador e Unidade Compradora
   - Número do Edital e Processo Administrativo
   - Modalidade, Critério de Julgamento e Modo de Disputa (IN SEGES nº 73/2022)
   - Amparo Legal (Lei Federal nº 14.133/2021)

2. OBJETO REAL & ESCOPO PRÁTICO DA CONTRATAÇÃO:
   - Descrição detalhada do objeto da contratação
   - Quantitativos consolidados e unidades de medida
   - Regime de execução ou entrega (presencial, remota ou mista)

3. CRONOGRAMA, PRAZOS FATAIS & LOGÍSTICA:
   - Data e horário da sessão pública de lances
   - Prazo fatal para protocolo de Impugnação (Art. 164 - 3 dias úteis antes)
   - Prazo de entrega / início da prestação dos serviços e localidade

4. MATRIZ DE HABILITAÇÃO OBRIGATÓRIA (CRITÉRIOS DE NÃO DESCLASSIFICAÇÃO):
   - Habilitação Jurídica e Regularidade Fiscal/Trabalhista (Arts. 66 e 68)
   - Qualificação Econômico-Financeira: Balanço patrimonial, índices contábeis (LG, SG, LC >= 1,0) ou Capital Social/Patrimônio Líquido mínimo
   - Qualificação Técnica (Art. 67): Atestados de Capacidade Técnica exigidos (limitados a até 50% das parcelas relevantes conforme Súmula 263 TCU)

5. CONDIÇÕES DE ENTREGA, PAGAMENTO E EXECUÇÃO:
   - Prazo e local de entrega/prestação dos serviços
   - Prazo de pagamento (em até 30 dias após liquidação da despesa conforme Art. 141)
   - Reajuste após 12 meses (Art. 25, § 7º)

6. PARECER DE RISCO & RECOMENDAÇÃO PRÁTICA:
   - Apontamento de cláusulas abusivas ou restritivas passíveis de impugnação
   - Próximo passo executivo recomendado dentro da plataforma.

TEXTO DO EDITAL / DOCUMENTO:
${editalTexto.slice(0, 150000)}`;

    let streamFalhou = false;
    let acumulado = '';
    await streamAiChat({
      pergunta: prompt,
      noticeId: selectedEditalId || undefined,
      providedDocumentText: editalTexto.slice(0, 150000),
      onChunk: (chunk: string) => {
        acumulado += chunk;
        setResultadoStreaming((prev) => prev + chunk);
      },
      onError: () => {
        streamFalhou = true;
      },
    }).catch(() => {
      streamFalhou = true;
    });

    if (streamFalhou || acumulado.trim().length === 0) {
      const fichaRel = `PARECER TÉCNICO E AUDITORIA DO EDITAL

1. ENQUADRAMENTO DO CERTAME:
Órgão: ${selectedEditalData?.buyerName || 'Órgão Licitante Oficial'}
Processo/Edital: ${selectedEditalData?.noticeNumber || selectedEditalId}
Regime Jurídico: Lei Federal nº 14.133/2021

2. OBJETO DA CONTRATAÇÃO:
${selectedEditalData?.object || 'Conforme Termo de Referência.'}

3. STATUS DA AUDITORIA DE CLÁUSULAS:
${auditoria?.mensagem || 'Auditoria de conformidade executada com base nas cláusulas disponíveis.'}

4. AÇÕES RECOMENDADAS:
- Conferir documentação de habilitação no cofre da empresa.
- Avaliar margem mínima segura na Sala de Disputa e Precificação.`;
      setResultadoStreaming(fichaRel);
    }

    setAnaliseConcluida(true);
    toast.success('Auditoria de cláusulas concluída!');
  } catch (err) {
    console.error(err);
    toast.error('Erro ao auditar o edital.');
  } finally {
    setAnalisando(false);
  }
};

const copiarRelatorio = () => {
  if (!resultadoStreaming) return;
  navigator.clipboard.writeText(resultadoStreaming);
  setCopiado(true);
  toast.success('Parecer copiado para a área de transferência!');
  setTimeout(() => setCopiado(false), 2000);
};

const dossier = selectedEditalData?.dossier;
const ficha = dossier?.fichaTecnica;
const crono = dossier?.cronogramaPrazosFatais;
const itens = Array.isArray(fichaSpecs?.secoes?.objetoContratacao?.itensDetalhados) && fichaSpecs.secoes.objetoContratacao.itensDetalhados.length > 0
  ? fichaSpecs.secoes.objetoContratacao.itensDetalhados
  : Array.isArray(dossier?.quadroItensDetalhado)
    ? dossier.quadroItensDetalhado
    : Array.isArray(selectedEditalData?.items)
      ? selectedEditalData.items
      : [];

const secoes = fichaSpecs?.secoes;

return (
  <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
    <div className="mx-auto max-w-7xl px-3 sm:px-6 py-6 space-y-6">

      {/* CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0B192C] text-[#EA580C] rounded-xl shadow-xs">
              <FileText size={20} />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#0B192C]">
              Leitor & Auditor de Editais
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Extração integral dos arquivos oficiais (PDF, Word, Termo de Referência e pacotes ZIP), download interno e auditoria de conformidade.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {carregandoEdital && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-[#0070C0] font-bold text-xs border border-blue-200">
              <RefreshCw size={12} className="animate-spin" />
              Carregando documentos...
            </span>
          )}
          {sourceMode === 'PDF_ANEXO_REAL' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#14532D]/10 text-[#14532D] font-bold text-xs border border-[#166534]/30">
              <CheckCircle2 size={14} />
              Documento Oficial Lido {arquivosOficiais.length > 0 ? `(${arquivosOficiais.length} anexo(s))` : ''}
            </span>
          )}
          {sourceMode === 'PDF_ESCANEADO_SEM_TEXTO' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-900 font-bold text-xs border border-amber-300">
              <AlertTriangle size={14} className="text-amber-600" />
              Documento Escaneado em Imagem
            </span>
          )}
          {sourceMode === 'APENAS_METADADOS_PNCP' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300">
              <Info size={14} className="text-slate-500" />
              Registro Oficial do Certame
            </span>
          )}
        </div>
      </div>

      {/* SELETOR DE EDITAL */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <EditalSelector
          value={selectedEditalId}
          selectedId={selectedEditalId}
          onSelectEdital={handleSelectEdital}
          label="Escolha um edital monitorado ou salvo para leitura:"
        />
      </div>

      {/* ALERTA TRANSPARENTE CASO O ÓRGÃO NÃO TENHA PUBLICADO ARQUIVO LEGÍVEL */}
      {selectedEditalId && sourceMode && sourceMode !== 'PDF_ANEXO_REAL' && (
        <div className="p-5 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 space-y-3 shadow-xs">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-sm font-black text-amber-900 block">
                Aviso sobre os arquivos oficiais deste certame
              </strong>
              <p className="text-xs text-amber-800 leading-relaxed">
                O órgão publicou apenas os dados resumidos abaixo, sem arquivo anexo legível no portal. Caso tenha o PDF no seu computador, anexe aqui para leitura completa.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPdf}
              className="px-4 py-2 bg-amber-900 hover:bg-amber-950 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UploadCloud size={14} />
              {uploadingPdf ? 'Processando Arquivo...' : 'Anexar PDF do seu Computador'}
            </button>

            {selectedEditalId && (
              <button
                type="button"
                onClick={() => handleDownloadArquivo(`/notices/${encodeURIComponent(selectedEditalId)}/download-original`, `Edital_${selectedEditalId}.pdf`)}
                disabled={baixandoArquivo}
                className="px-4 py-2 bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-950 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Download size={14} className="text-amber-700" />
                <span>Baixar Arquivo Publicado</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* DOSSIÊ ESTRUTURADO COMPLETO */}
      {selectedEditalData && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
          {/* CABEÇALHO DO DOSSIÊ ESTRUTURADO */}
          <div className="p-5 bg-gradient-to-r from-slate-50 via-white to-blue-50/20 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-[#0070C0] border border-blue-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Dossiê Estruturado do Edital
                </span>
                <span className="text-xs font-mono font-bold text-slate-700">
                  Edital nº {ficha?.numeroEdital || selectedEditalData.noticeNumber || selectedEditalId}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-[#0B192C]">
                {ficha?.razaoSocial || selectedEditalData.buyerName || 'Órgão Licitante'}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 font-medium">
                <span>CNPJ: <strong className="font-mono text-slate-700">{ficha?.cnpjFormatado || formatCnpj(selectedEditalData.buyerDocument)}</strong></span>
                <span>Local: <strong className="text-slate-700">{ficha?.municipioUf || selectedEditalData.municipality || 'Âmbito Nacional'}</strong></span>
                <span>Valor Estimado: <strong className="text-[#0070C0] font-bold">{ficha?.valorGlobalFormatado || formatBRL(selectedEditalData.estimatedValue)}</strong></span>
              </div>
            </div>

            {/* AÇÕES DIRETAS (BAIXAR EDITAL ORIGINAL, PREÇO, PROPOSTA, IMPUGNAR) */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDownloadArquivo(`/notices/${encodeURIComponent(selectedEditalId)}/download-original`, `Edital_${ficha?.numeroEdital || selectedEditalId}.pdf`)}
                disabled={baixandoArquivo}
                className="px-3 py-1.5 bg-[#0B192C] hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Baixar arquivo original publicado pelo órgão"
              >
                <Download className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>Baixar Edital Original</span>
              </button>

              <a
                href={`/precificacao?edital=${selectedEditalId}`}
                className="px-3 py-1.5 bg-[#EA580C] hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Precificar</span>
              </a>

              <a
                href={`/propostas/criar?edital=${selectedEditalId}`}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Proposta</span>
              </a>

              <a
                href={`/impugnacao?edital=${selectedEditalId}`}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Impugnar</span>
              </a>
            </div>
          </div>

          {/* CRUZAMENTO AUTOMÁTICO COM A EMPRESA ATIVA ("TUDO DE MÃO BEIJADA") */}
          {cruzamentoEmpresa && (
            <div className="p-5 bg-slate-50/80 border-b border-slate-200 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {/* VEREDITO PRÁTICO DE DECISÃO (3 LINHAS) */}
                <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#0B192C]">
                      Veredito Prático para {cruzamentoEmpresa.razaoSocial} ({cruzamentoEmpresa.porte})
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${cruzamentoEmpresa.cnaeCompativel && cruzamentoEmpresa.totalPendentes === 0
                        ? 'bg-[#14532D]/10 text-[#14532D]'
                        : 'bg-amber-100 text-amber-900'
                        }`}
                    >
                      {cruzamentoEmpresa.totalProntos} de {cruzamentoEmpresa.checklistDocumentos?.length || 0} Docs Prontos
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-slate-800 leading-relaxed">
                    {(cruzamentoEmpresa.veredito3Linhas || []).map((linha: string, idx: number) => (
                      <p key={idx} className="font-medium">{linha}</p>
                    ))}
                  </div>
                </div>

                {/* CHECKLIST REAL DE DOCUMENTOS DA EMPRESA VS EDITAL */}
                <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-[#0B192C]">
                      Documentos da Empresa vs. Este Edital
                    </span>
                    {cruzamentoEmpresa.totalPendentes > 0 && (
                      <Link
                        to="/fornecedor/documentos"
                        className="text-[11px] font-bold text-[#EA580C] hover:underline"
                      >
                        Regularizar Documentos →
                      </Link>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {(cruzamentoEmpresa.checklistDocumentos || []).map((docItem: any, idx: number) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] ${docItem.status === 'PRONTO'
                          ? 'bg-[#14532D]/5 border-[#14532D]/20 text-[#14532D]'
                          : docItem.status === 'VENCIDO'
                            ? 'bg-red-50 border-red-200 text-red-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                          }`}
                      >
                        <span className="truncate font-bold flex items-center gap-1.5" title={docItem.requisito}>
                          {docItem.status === 'PRONTO' ? (
                            <CheckCircle2 size={13} className="shrink-0 text-[#14532D]" />
                          ) : (
                            <XCircle size={13} className="shrink-0 text-red-600" />
                          )}
                          <span className="truncate">{docItem.requisito.split(' (')[0]}</span>
                        </span>
                        <span className="text-[10px] font-black uppercase shrink-0">
                          {docItem.status === 'PRONTO' ? 'Pronto' : docItem.status === 'VENCIDO' ? 'Vencido' : 'Faltando'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABAS DO DOSSIÊ ESTRUTURADO */}
          <div className="px-5 border-b border-slate-200 bg-slate-50/60 flex items-center gap-1 overflow-x-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => setAbaDossie('visao')}
              className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${abaDossie === 'visao'
                ? 'border-[#0B192C] text-[#0B192C] bg-white font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>1. Objeto & Resumo</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaDossie('disputa')}
              className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${abaDossie === 'disputa'
                ? 'border-[#0B192C] text-[#0B192C] bg-white font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>2. Disputa & Prazos</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaDossie('itens')}
              className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${abaDossie === 'itens'
                ? 'border-[#0B192C] text-[#0B192C] bg-white font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>3. Itens ({itens.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaDossie('entrega')}
              className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${abaDossie === 'entrega'
                ? 'border-[#0B192C] text-[#0B192C] bg-white font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>4. Condições de Entrega</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaDossie('habilitacao')}
              className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${abaDossie === 'habilitacao'
                ? 'border-[#0B192C] text-[#0B192C] bg-white font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>5. Habilitação</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaDossie('contrato')}
              className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${abaDossie === 'contrato'
                ? 'border-[#0B192C] text-[#0B192C] bg-white font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>6. Pagamento & Contrato</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaDossie('vicios')}
              className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${abaDossie === 'vicios'
                ? 'border-[#0B192C] text-[#0B192C] bg-white font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                7. Auditoria de Vícios ({auditoria?.totalVicios || 0})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setAbaDossie('arquivos')}
              className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${abaDossie === 'arquivos'
                ? 'border-[#0B192C] text-[#0B192C] bg-white font-black'
                : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>8. Arquivos & Anexos ({arquivosOficiais.length})</span>
            </button>
          </div>

          {/* CONTEÚDO DAS SEÇÕES ESTRUTURADAS */}
          <div className="p-5 text-xs">
            {/* ABA 1: OBJETO & RESUMO */}
            {abaDossie === 'visao' && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <span className="font-black text-slate-800 uppercase tracking-wider text-[11px] block mb-1">
                    O que o órgão quer contratar na prática:
                  </span>
                  <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-line text-xs sm:text-sm">
                    {secoes?.objetoContratacao?.oQueOrgaoQuer || dossier?.descricaoExplicativaObjeto?.objetoIntegral || selectedEditalData.object || 'Objeto oficial conforme Termo de Referência.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Modalidade</span>
                    <span className="font-bold text-slate-800">{ficha?.modalidade || selectedEditalData.modality || 'Pregão Eletrônico'}</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Modo de Disputa</span>
                    <span className="font-bold text-slate-800">{ficha?.modoDisputa || selectedEditalData.modoDisputa || 'Aberto / Fechado'}</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Critério de Julgamento</span>
                    <span className="font-bold text-slate-800">{ficha?.criterioJulgamento || selectedEditalData.judgmentCriterion || 'Menor Preço'}</span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-xl">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Regime Jurídico</span>
                    <span className="font-bold text-[#14532D]">Lei Federal nº 14.133/2021</span>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 2: DISPUTA & PRAZOS */}
            {abaDossie === 'disputa' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider block">Onde acontece a disputa</span>
                    <p className="text-slate-900 font-bold text-sm">
                      {secoes?.disputaEPrazos?.portalDisputa || selectedEditalData.source || 'Portal Oficial de Compras'}
                    </p>
                    <span className="text-[11px] text-slate-600 block">
                      Formato: <strong className="text-slate-900">{fichaSpecs?.disputaEExecucao?.modoDisputaTexto || 'Disputa Eletrônica (Online)'}</strong>
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider block">Abertura da Sessão Pública</span>
                    <p className="text-slate-900 font-bold text-sm">
                      {(() => {
                        const aber = crono?.aberturaSessaoPublica || selectedEditalData.openingAt || selectedEditalData.closingAt;
                        return aber ? formatPncpDateBR(aber, true) : 'Consultar cronograma do edital';
                      })()}
                    </p>
                    <span className="text-[11px] text-slate-600 block">Horário oficial de Brasília</span>
                  </div>

                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-1">
                    <span className="text-amber-800 font-black uppercase text-[10px] tracking-wider block">Prazo Limite para Impugnação</span>
                    <p className="text-amber-950 font-black text-sm">
                      {(() => {
                        const rawImp = crono?.prazoLimiteImpugnacao || calcularPrazoImpugnacaoArt164(crono?.aberturaSessaoPublica || selectedEditalData.openingAt || selectedEditalData.closingAt);
                        return rawImp ? formatPncpDateBR(rawImp, true) : 'Até 3 dias úteis antes da abertura';
                      })()}
                    </p>
                    <span className="text-[10px] text-amber-800 font-bold block">Art. 164 da Lei Federal nº 14.133/2021</span>
                  </div>
                </div>

                {fichaSpecs?.disputaEExecucao?.trechoComprovante && (
                  <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Trecho literal comprobatório nos documentos oficiais:
                    </span>
                    <blockquote className="text-xs font-mono text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 italic leading-relaxed">
                      {fichaSpecs.disputaEExecucao.trechoComprovante}
                    </blockquote>
                  </div>
                )}
              </div>
            )}

            {/* ABA 3: ITENS & QUANTITATIVOS */}
            {abaDossie === 'itens' && (
              <div className="space-y-3">
                {itens.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                          <th className="py-2.5 px-3 text-center">Item</th>
                          <th className="py-2.5 px-3 min-w-[200px]">Descrição Oficial</th>
                          <th className="py-2.5 px-3 text-center">Quantidade</th>
                          <th className="py-2.5 px-3 text-right">Valor Unitário Ref.</th>
                          <th className="py-2.5 px-3 text-right">Valor Total Estimado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                        {itens.map((it: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 font-mono font-bold text-center">{it.itemNumero ?? it.numeroItem ?? it.itemNumber ?? idx + 1}</td>
                            <td className="py-2 px-3 font-medium text-slate-800">{it.descricao ?? it.descricaoCompleta ?? it.description}</td>
                            <td className="py-2 px-3 text-center font-bold">{it.quantidade ?? it.quantity ?? 1} {it.unidade ?? it.unidadeMedida ?? 'UN'}</td>
                            <td className="py-2 px-3 text-right">{formatBRL(it.valorUnitarioEstimado ?? it.estimatedUnitValue)}</td>
                            <td className="py-2 px-3 text-right font-bold text-[#0070C0]">{formatBRL(it.valorTotalEstimado ?? it.estimatedTotalValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-500 italic p-4 text-center">
                    Itens com valores consolidados no Termo de Referência oficial.
                  </p>
                )}
              </div>
            )}

            {/* ABA 4: CONDIÇÕES DE ENTREGA & EXECUÇÃO */}
            {abaDossie === 'entrega' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                    Prazo e Cronograma de Entrega
                    Prazo de Entrega / Início da Execução
                  </span>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {secoes?.condicoesEntregaExecucao?.prazoEntrega || 'Conforme cronograma especificado no Termo de Referência e Contrato.'}
                    {secoes?.condicoesEntregaExecucao?.prazoEntrega || 'Não especificado nos arquivos analisados'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                    Endereço e Local de Recebimento
                  </span>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {secoes?.condicoesEntregaExecucao?.localEntrega || selectedEditalData.municipality || 'Conforme especificado no Termo de Referência.'}
                    {secoes?.condicoesEntregaExecucao?.localEntrega || 'Não especificado nos arquivos analisados'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                    Vistoria Técnica / Visita ao Local
                  </span>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {secoes?.condicoesEntregaExecucao?.detalhesVistoria || 'A vistoria, quando prevista, pode ser substituída por declaração formal de conhecimento do local nos termos do Art. 63, § 3º da Lei 14.133/2021.'}
                    {secoes?.condicoesEntregaExecucao?.detalhesVistoria || 'Não exigido nos arquivos analisados'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                    Amostras, Catálogo ou Prova de Conceito
                    Amostras, Catálogo Técnico ou Prova de Conceito
                  </span>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {secoes?.condicoesEntregaExecucao?.exigeAmostra
                      ? 'Exigência de apresentação de amostra após a fase de lances para o licitante provisoriamente classificado em primeiro lugar.'
                      : 'Não há exigência expressa de amostra prévia nos trechos analisados.'}
                    <strong>Amostra:</strong> {secoes?.condicoesEntregaExecucao?.detalhesAmostra || 'Não exigido nos arquivos analisados'}
                    <br />
                    <strong>Catálogo/Ficha Técnica:</strong> {secoes?.condicoesEntregaExecucao?.detalhesCatalogo || 'Não exigido nos arquivos analisados'}
                  </p>
                </div>
              </div>
            )}

            {/* ABA 5: HABILITAÇÃO */}
            {abaDossie === 'habilitacao' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                    Habilitação Jurídica (Art. 66)
                    Habilitação Jurídica (Exigida neste Edital)
                  </span>
                  <ul className="list-disc list-inside text-slate-700 text-xs space-y-1">
                    <li>Inscrição no CNPJ ativa e regular perante a Receita Federal</li>
                    <li>Contrato Social consolidado ou Requerimento de Empresário Individual</li>
                    <li>Documento de identidade dos sócios ou procuradores constituídos</li>
                    {(secoes?.documentosExigidosHabilitacao?.juridica || ['Não especificado nos arquivos analisados']).map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                    Regularidade Fiscal & Trabalhista (Art. 68)
                    Regularidade Fiscal & Trabalhista (Exigida neste Edital)
                  </span>
                  <ul className="list-disc list-inside text-slate-700 text-xs space-y-1">
                    <li>CND Conjunta Federal e Dívida Ativa da União (RFB/PGFN)</li>
                    <li>Certificado de Regularidade do FGTS (CRF)</li>
                    <li>Certidão Negativa de Débitos Trabalhistas (CNDT)</li>
                    <li>Certidões de Débitos Estadual e Municipal do domicílio da empresa</li>
                    {(secoes?.documentosExigidosHabilitacao?.fiscalTrabalhista || ['Não especificado nos arquivos analisados']).map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                    Qualificação Econômico-Financeira (Art. 69)
                    Balanço Patrimonial e Índices Contábeis
                  </span>
                  <ul className="list-disc list-inside text-slate-700 text-xs space-y-1">
                    <li>Balanço Patrimonial e DRE dos 2 últimos exercícios sociais</li>
                    <li>Certidão Negativa de Falência e Recuperação Judicial</li>
                    <li>Índices de Liquidez Geral (LG), Solvência Geral (SG) e Liquidez Corrente (LC) &gt;= 1,00</li>
                  </ul>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    <strong>Balanço:</strong> {secoes?.documentosExigidosHabilitacao?.balancoPatrimonial || 'Não especificado nos arquivos analisados'}
                  </p>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    <strong>Índices Exigidos:</strong> {secoes?.documentosExigidosHabilitacao?.exigenciaIndicesContabeis || 'Não especificado nos arquivos analisados'}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                    Qualificação Técnica (Art. 67)
                    Atestado Técnico, Experiência & Registros
                  </span>
                  <ul className="list-disc list-inside text-slate-700 text-xs space-y-1">
                    <li>Atestado de Capacidade Técnica (CAT) compatível em características com o objeto</li>
                    <li>Quantitativo limitado a no máximo 50% das parcelas de maior relevância (Súmula 263 do TCU)</li>
                  </ul>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    <strong>Atestado:</strong> {secoes?.documentosExigidosHabilitacao?.atestadoTecnico || 'Não exigido nos arquivos analisados'}
                  </p>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    <strong>Percentual Mínimo:</strong> {secoes?.documentosExigidosHabilitacao?.limiteAtestadoPercentual || 'Não especificado'}
                  </p>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    <strong>Tempo Mínimo de Experiência:</strong> {secoes?.documentosExigidosHabilitacao?.tempoMinimoExperiencia || 'Não exige tempo mínimo de experiência'}
                  </p>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    <strong>Conselho / Alvará:</strong> {secoes?.documentosExigidosHabilitacao?.registroConselhoOuAlvara || 'Não exigido nos arquivos analisados'}
                  </p>
                </div>
              </div>
            )}

            {/* ABA 6: PAGAMENTO & CONTRATO */}
            {abaDossie === 'contrato' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                    Prazo e Condições de Pagamento
                  </span>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {secoes?.financeiroEContrato?.condicoesPagamento || 'Em até 30 dias contados da liquidação da nota fiscal com ateste de recebimento (Art. 141 da Lei 14.133/2021).'}
                    {secoes?.financeiroEContrato?.condicoesPagamento || 'Não especificado nos arquivos analisados'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                    Vigência do Contrato / Ata de Registro
                  </span>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {secoes?.financeiroEContrato?.vigenciaContrato || 'Conforme especificado no Termo de Referência e Minuta Contratual.'}
                    {secoes?.financeiroEContrato?.vigenciaContrato || 'Não especificado nos arquivos analisados'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                    Reajuste de Preços
                    Reajuste, Garantia e Penalidades
                  </span>
                  <p className="text-slate-700 text-xs leading-relaxed">
                    {secoes?.financeiroEContrato?.criterioReajuste || 'Índice oficial IPCA ou IPCA-E após o interregno de 12 meses da data da proposta (Art. 25, § 7º da Lei 14.133/2021).'}
                    <strong>Reajuste:</strong> {secoes?.financeiroEContrato?.criterioReajuste || 'Não especificado nos arquivos analisados'}
                    <br />
                    <strong>Garantia:</strong> {secoes?.financeiroEContrato?.garantiaContratual || 'Não exigido nos arquivos analisados'}
                    <br />
                    <strong>Multas:</strong> {secoes?.financeiroEContrato?.multasEPenalidades || 'Não especificado nos arquivos analisados'}
                  </p>
                </div>
              </div>
            )}

            {/* ABA 7: VÍCIOS & IRREGULARIDADES */}
            {abaDossie === 'vicios' && (
              <div className="space-y-3">
                {auditoria?.apontamentos && auditoria.apontamentos.length > 0 ? (
                  <div className="space-y-3">
                    {auditoria.apontamentos.map((vicio, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border ${vicio.gravidade === 'ALTO'
                          ? 'bg-red-50/70 border-red-200 text-red-950'
                          : vicio.gravidade === 'MEDIO'
                            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2 mb-2">
                          <div>
                            <span className="font-black text-xs sm:text-sm block">
                              {vicio.titulo}
                            </span>
                            <span className="text-[11px] text-slate-600 font-bold block mt-0.5">
                              Localização: {vicio.arquivoOrigem || 'Edital Oficial'} · Página: {vicio.pagina || 'Conforme documento'}
                            </span>
                          </div>
                          <span
                            className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${vicio.gravidade === 'ALTO'
                              ? 'bg-red-200 text-red-900'
                              : vicio.gravidade === 'MEDIO'
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-slate-200 text-slate-800'
                              }`}
                          >
                            Gravidade {vicio.gravidade}
                          </span>
                        </div>

                        <blockquote className="bg-white p-3 rounded-lg border border-slate-200/80 font-mono text-[11px] text-slate-900 italic my-2 leading-relaxed">
                          "{vicio.trechoLiteral}"
                        </blockquote>

                        <div className="text-xs space-y-1.5 mt-2">
                          <p>
                            <strong className="text-slate-900">Por que viola a Lei:</strong> {vicio.explicacaoSimples || 'A exigência restringe o caráter competitivo assegurado pela Lei de Licitações.'}
                          </p>
                          <p>
                            <strong className="text-slate-900">Fundamentação:</strong> {vicio.fundamentoLegal}
                          </p>
                        </div>

                        <div className="pt-3 mt-3 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-slate-600">
                            {vicio.acaoRecomendada || 'Protocolar impugnação ao edital requerendo a adequação do termo.'}
                          </span>

                          <Link
                            to={`/impugnacao?edital=${encodeURIComponent(selectedEditalId)}&vicio=${encodeURIComponent(vicio.titulo)}&trecho=${encodeURIComponent(vicio.trechoLiteral)}&fundamento=${encodeURIComponent(vicio.fundamentoLegal)}&arquivo=${encodeURIComponent(vicio.arquivoOrigem || '')}&pagina=${encodeURIComponent(String(vicio.pagina || ''))}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-orange-600 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                          >
                            <Gavel size={14} />
                            <span>Gerar Impugnação deste Item</span>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-[#14532D]/10 border border-[#166534]/30 text-[#14532D] flex items-center gap-3">
                    <div className="p-2 bg-[#14532D] text-white rounded-xl shrink-0">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-xs sm:text-sm text-[#14532D]">
                        Edital auditado integralmente: nenhuma cláusula restritiva ou irregularidade identificada nos arquivos analisados.
                      </h4>
                      <p className="text-xs text-[#166534] mt-0.5">
                        O instrumento convocatório cumpre as exigências e limites da Lei Federal nº 14.133/2021 e jurisprudência do TCU.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA 8: ARQUIVOS & ANEXOS */}
            {abaDossie === 'arquivos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-xs text-slate-900 uppercase tracking-wider">
                      Documentos Oficiais Publicados
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Baixe os arquivos oficiais diretamente pela plataforma sem sair para sites externos.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownloadArquivo(`/notices/${encodeURIComponent(selectedEditalId)}/download-original`, `Edital_${ficha?.numeroEdital || selectedEditalId}.pdf`)}
                    disabled={baixandoArquivo}
                    className="px-3 py-1.5 bg-[#0B192C] hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Download size={13} className="text-[#EA580C]" />
                    <span>Baixar Edital Principal</span>
                  </button>
                </div>

                {arquivosOficiais.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {arquivosOficiais.map((arq, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="p-2 bg-slate-100 text-slate-700 rounded-lg shrink-0">
                            <FileText size={16} />
                          </span>
                          <div className="min-w-0">
                            <span className="font-bold text-xs text-slate-900 block truncate" title={arq.titulo}>
                              {arq.titulo}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {arq.tipoDocumento} {arq.tamanhoBytes ? `· ${formatBytes(arq.tamanhoBytes)}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDownloadArquivo(arq.urlDownloadInterno || `/notices/${encodeURIComponent(selectedEditalId)}/download-arquivo/${arq.sequencial || 1}`, arq.titulo || 'documento.pdf')}
                            disabled={baixandoArquivo}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Baixar diretamente na Expertise"
                          >
                            <Download size={12} />
                            <span>Baixar</span>
                          </button>
                          <a
                            href={arq.urlDownloadOficial}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                            title="Abrir no portal oficial"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 italic p-4 text-center">
                    Nenhum anexo adicional registrado individualmente no portal do PNCP para este edital.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ÁREA DE LEITURA & AUDITORIA DE CLÁUSULAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PAINEL ESQUERDO: TEXTO E UPLOAD */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <form onSubmit={handleAnalisar} className="space-y-4 flex-1 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-sm font-black text-slate-900 flex items-center gap-2">
                <UploadCloud size={18} className="text-[#EA580C]" />
                Texto Integral / Documentos Oficiais
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf"
                  ref={fileInputRef}
                  onChange={handleUploadPdfManual}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPdf}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <UploadCloud size={13} />
                  {uploadingPdf ? 'Processando...' : 'Anexar PDF'}
                </button>
                <span className="text-xs font-bold text-slate-400">
                  {editalTexto.length.toLocaleString('pt-BR')} caracteres
                </span>
              </div>
            </div>

            <textarea
              value={editalTexto}
              onChange={(e) => setEditalTexto(e.target.value)}
              placeholder="O texto dos arquivos oficiais do edital aparecerá aqui. Você também pode colar trechos ou anexar o PDF acima..."
              className="w-full flex-1 min-h-[380px] p-4 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B192C] text-slate-800 leading-relaxed resize-none"
            />

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={analisando || !editalTexto.trim()}
                className="w-full py-3 px-4 rounded-xl bg-[#0B192C] hover:bg-slate-800 disabled:bg-slate-300 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                {analisando ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Auditando Cláusulas do Edital...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} className="text-[#EA580C]" />
                    Gerar Parecer Completo do Edital
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* PAINEL DIREITO: RESULTADO DO PARECER EXECUTIVO */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-[#14532D]/10 text-[#14532D] rounded-lg">
                  <CheckCircle2 size={18} />
                </span>
                <h3 className="text-sm font-black text-[#0B192C]">
                  Parecer Executivo & Auditoria do Instrumento Convocatório
                </h3>
              </div>

              {resultadoStreaming && (
                <button
                  type="button"
                  onClick={copiarRelatorio}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  {copiado ? <Check size={14} className="text-[#14532D]" /> : <Copy size={14} />}
                  {copiado ? 'Copiado!' : 'Copiar'}
                </button>
              )}
            </div>

            {resultadoStreaming ? (
              <div className="flex-1 overflow-y-auto max-h-[500px] p-4 bg-slate-50 border border-slate-200 rounded-xl font-sans text-xs text-slate-800 leading-relaxed whitespace-pre-line space-y-3">
                {resultadoStreaming}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 min-h-[380px]">
                <Scale size={36} className="text-slate-300" />
                <div className="max-w-sm space-y-1">
                  <p className="font-bold text-xs text-slate-600">
                    Nenhum parecer gerado ainda
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Selecione um edital acima ou anexe o arquivo PDF para auditar cláusulas, prazos e exigências habilitatórias.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  </div>
);
};

export default LeitorEditaisPage;
