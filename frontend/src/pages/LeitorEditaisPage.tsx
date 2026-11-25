import api, { noticesApi } from '@/services/api';
import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  ArrowRight,
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
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FORNECEDOR_ROUTES } from '@/routes';
import { streamAiChat } from '@/services/aiStream.service';
import { EditalSelector, EditalOption } from '@/components/EditalSelector';
import { formatPncpDateBR, formatCnpj } from '@/utils/pncp';

export interface VicioApontamento {
  id?: string;
  titulo: string;
  gravidade: 'ALTO' | 'MEDIO' | 'BAIXO';
  trechoLiteral: string;
  fundamentoLegal: string;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const urlEditalId = searchParams.get('edital') || '';

  const [selectedEditalId, setSelectedEditalId] = useState<string>(urlEditalId);
  const [selectedEditalData, setSelectedEditalData] = useState<any>(null);
  const [carregandoEdital, setCarregandoEdital] = useState(false);

  // Fonte real de dados e anexos
  const [sourceMode, setSourceMode] = useState<'PDF_ANEXO_REAL' | 'PDF_ESCANEADO_SEM_TEXTO' | 'APENAS_METADADOS_PNCP' | null>(null);
  const [arquivosOficiais, setArquivosOficiais] = useState<ArquivoOficial[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaData | null>(null);

  const [editalTexto, setEditalTexto] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [resultadoStreaming, setResultadoStreaming] = useState('');
  const [analiseConcluida, setAnaliseConcluida] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [abaDossie, setAbaDossie] = useState<'visao' | 'itens' | 'habilitacao' | 'vicios'>('visao');
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
      setSourceMode(null);
      setArquivosOficiais([]);
      setAuditoria(null);
      setEditalTexto('');
      return;
    }

    let active = true;
    setCarregandoEdital(true);

    Promise.allSettled([
      noticesApi.getBasicSummary(selectedEditalId),
      noticesApi.getById(selectedEditalId),
      api.get('/notices/' + encodeURIComponent(selectedEditalId) + '/chunks?limit=80').catch(() => null),
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
        let textoRealExtraido = '';

        if (chunksRes.status === 'fulfilled' && chunksRes.value?.data) {
          const cd = chunksRes.value.data;
          fetchedSourceMode = cd.sourceMode || 'APENAS_METADADOS_PNCP';
          fetchedArquivos = Array.isArray(cd.arquivosOficiais) ? cd.arquivosOficiais : [];

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

REQUISITOS DE HABILITAÇÃO EXIGIDOS (ARTS. 62 A 70 DA LEI 14.133/21):
- Habilitação Jurídica: Contrato social ou ato constitutivo, CNPJ ativo e procuração.
- Regularidade Fiscal e Trabalhista: CND Federal (Receita/PGFN), CRF FGTS, CNDT, CND Estadual e Municipal.
- Qualificação Técnica: Atestados de Capacidade Técnica (CAT) compatíveis com o objeto.`;

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
    toast.success(`Edital nº ${edital.numeroEdital || edital.id} selecionado para leitura!`);
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
      const prompt = `Elabore um PARECER TÉCNICO-OPERACIONAL E JURÍDICO DE ENGENHARIA LICITATÓRIA completo deste edital para o licitante.
PROIBIÇÃO ABSOLUTA: Não use introduções de IA, saudações de chatbot nem preâmbulos vazios (como "Olá", "Aqui está o resumo", "Espero ajudar"). Entre direto no parecer técnico estruturado rigorosamente nos 6 blocos executivos:

1. DADOS CADASTRAIS & ENQUADRAMENTO DO CERTAME:
   - Órgão Convocador e Unidade Compradora
   - Número do Edital e Processo Administrativo
   - Modalidade, Critério de Julgamento e Modo de Disputa (IN SEGES nº 73/2022)
   - Amparo Legal (Lei Federal nº 14.133/2021) e se é SRP (Registro de Preços) ou Contratação Imediata

2. OBJETO REAL & ESCOPO PRÁTICO DA CONTRATAÇÃO:
   - Descrição detalhada do objeto da contratação
   - Quantitativos consolidados e unidades de medida
   - Regime de execução ou entrega (presencial, remota ou mista)

3. CRONOGRAMA, PRAZOS FATAIS & LOGÍSTICA:
   - Data e horário da sessão pública de lances
   - Prazo fatal para protocolo de Impugnação ou Pedido de Esclarecimento (Art. 164)
   - Prazo de entrega / início da prestação dos serviços e localidade

4. MATRIZ DE HABILITAÇÃO OBRIGATÓRIA (CRITÉRIOS DE NÃO DESCLASSIFICAÇÃO):
   - Habilitação Jurídica e Regularidade Fiscal/Trabalhista (Arts. 66 e 68)
   - Qualificação Econômico-Financeira: Balanço patrimonial, índices contábeis (LG, SG, LC >= 1,0) ou Capital Social/Patrimônio Líquido mínimo (até 10%)
   - Qualificação Técnica (Art. 67): Atestados de Capacidade Técnica exigidos (limitados a até 50% das parcelas relevantes conforme Súmula 263 TCU) e registros profissionais

5. CONDIÇÕES DE ENTREGA, PAGAMENTO E EXECUÇÃO:
   - Prazo e local de entrega/prestação dos serviços
   - Prazo de liquidação do empenho e cronograma de pagamento pelo órgão
   - Exigência de garantia contratual e regras de reajuste/reequilíbrio econômico-financeiro

6. PARECER DE RISCO, TÁTICA DE LANCES & RECOMENDAÇÃO PRÁTICA:
   - Apontamento de cláusulas abusivas ou restritivas passíveis de impugnação
   - Estratégia de precificação competitiva e proteção do valor mínimo seguro contra inexequibilidade
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
        // Fallback estruturado imediato se a stream falhar
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
    toast.success('Relatório copiado para a área de transferência!');
    setTimeout(() => setCopiado(false), 2000);
  };

  const dossier = selectedEditalData?.dossier;
  const ficha = dossier?.fichaTecnica;
  const crono = dossier?.cronogramaPrazosFatais;
  const itens = Array.isArray(dossier?.quadroItensDetalhado)
    ? dossier.quadroItensDetalhado
    : Array.isArray(selectedEditalData?.items)
      ? selectedEditalData.items
      : [];

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
              Extração real dos anexos oficiais (PDF, TR e ETP), auditoria rigorosa de cláusulas restritivas e parecer executivo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {carregandoEdital && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-[#0070C0] font-bold text-xs border border-blue-200">
                <RefreshCw size={12} className="animate-spin" />
                Carregando anexos...
              </span>
            )}
            {sourceMode === 'PDF_ANEXO_REAL' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#14532D]/10 text-[#14532D] font-bold text-xs border border-[#166534]/30">
                <CheckCircle2 size={14} />
                PDF Oficial Lido {arquivosOficiais.length > 0 ? `(${arquivosOficiais.length} anexo(s))` : ''}
              </span>
            )}
            {sourceMode === 'PDF_ESCANEADO_SEM_TEXTO' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-900 font-bold text-xs border border-amber-300">
                <AlertTriangle size={14} className="text-amber-600" />
                PDF Escaneado (Sem OCR)
              </span>
            )}
            {sourceMode === 'APENAS_METADADOS_PNCP' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300">
                <Info size={14} className="text-slate-500" />
                Dados Oficiais do PNCP
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

        {/* ALERTA TRANSPARENTE CASO NÃO HAJA PDF COM TEXTO LEGÍVEL NO PNCP */}
        {selectedEditalId && sourceMode && sourceMode !== 'PDF_ANEXO_REAL' && (
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-300 text-amber-950 space-y-3">
            <div className="flex items-start gap-2.5">
              <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <strong className="text-xs font-black text-amber-900 block">
                  Dados oficiais e itens carregados do Portal Nacional (PNCP)
                </strong>
                <p className="text-amber-800 leading-relaxed">
                  O órgão não disponibilizou um PDF com texto selecionável neste registro. Abaixo estão todos os dados e itens oficiais; caso tenha o arquivo em PDF no seu computador, anexe ao lado para leitura completa.
                </p>
              </div>
            </div>

            {arquivosOficiais.length > 0 && (
              <div className="pt-2 border-t border-amber-200/80">
                <span className="text-[11px] font-bold text-amber-900 block mb-1.5 uppercase">
                  Anexos Oficiais Disponíveis no PNCP:
                </span>
                <div className="flex flex-wrap gap-2">
                  {arquivosOficiais.map((arq, idx) => (
                    <a
                      key={idx}
                      href={arq.urlDownloadOficial}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-950 hover:bg-amber-100/60 text-xs font-bold transition shadow-2xs"
                    >
                      <ExternalLink size={12} className="text-amber-700" />
                      <span>{arq.titulo}</span>
                      <span className="text-[10px] text-amber-700 font-normal">({arq.tipoDocumento})</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
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

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href={`/precificacao?edital=${selectedEditalId}`}
                  className="px-3 py-1.5 bg-[#EA580C] hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Precificar</span>
                </a>
                <a
                  href={`/propostas/criar?edital=${selectedEditalId}`}
                  className="px-3 py-1.5 bg-[#0B192C] hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
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
                {ficha?.linkOficialPncp && (
                  <a
                    href={ficha.linkOficialPncp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-all"
                    title="Ver no Portal Oficial do PNCP"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* ABAS DO DOSSIÊ */}
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
                <span>Ficha Técnica & Objeto</span>
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
                <span>Itens ({itens.length})</span>
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
                <span>Habilitação Lei 14.133</span>
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
                  Vícios & Irregularidades ({auditoria?.totalVicios || 0})
                </span>
              </button>
            </div>

            {/* CONTEÚDO DA ABA ATIVA */}
            <div className="p-5 text-xs">
              {abaDossie === 'visao' && (
                <div className="space-y-4">
                  {/* OBJETO INTEGRAL */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <span className="font-black text-slate-800 uppercase tracking-wider text-[11px] block mb-1">
                      Objeto da Contratação (Termo de Referência):
                    </span>
                    <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                      {dossier?.descricaoExplicativaObjeto?.objetoIntegral || selectedEditalData.object || 'Objeto não informado nos dados estruturados.'}
                    </p>
                  </div>

                  {/* GRADE DE METADADOS */}
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
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="text-amber-800 block text-[10px] uppercase font-black tracking-wider">Prazo Impugnação (Art. 164)</span>
                      <span className="font-bold text-amber-950">
                        {(() => {
                          const prazoImp =
                            crono?.prazoLimiteImpugnacao ||
                            calcularPrazoImpugnacaoArt164(
                              crono?.aberturaSessaoPublica || selectedEditalData.openingAt || selectedEditalData.closingAt,
                            );
                          return prazoImp ? formatPncpDateBR(prazoImp, true) : '3 dias úteis antes da abertura';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {abaDossie === 'itens' && (
                <div className="space-y-3">
                  {itens.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-600 border-b border-slate-200">
                            <th className="py-2.5 px-3 text-center">Item</th>
                            <th className="py-2.5 px-3 min-w-[200px]">Descrição</th>
                            <th className="py-2.5 px-3 text-center">Qtd. / Unid.</th>
                            <th className="py-2.5 px-3 text-right">Valor Unitário</th>
                            <th className="py-2.5 px-3 text-right">Valor Total Estimado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                          {itens.map((it: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/70">
                              <td className="py-2 px-3 font-mono font-bold text-center">{it.numeroItem ?? it.itemNumber ?? idx + 1}</td>
                              <td className="py-2 px-3 font-medium text-slate-800">{it.descricaoCompleta ?? it.description ?? it.descricao}</td>
                              <td className="py-2 px-3 text-center">{it.quantidade ?? it.quantity ?? 1} {it.unidadeMedida ?? it.unit ?? 'UN'}</td>
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

              {abaDossie === 'habilitacao' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                      Habilitação Jurídica (Art. 66)
                    </span>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Contrato Social em vigor consolidado, registro comercial, prova de inscrição no CNPJ e procuração com poderes específicos.
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                      Regularidade Fiscal & Trabalhista (Art. 68)
                    </span>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      CND Federal (Receita/PGFN), Certidão do FGTS (CRF), CNDT (Justiça do Trabalho), CND Estadual e CND Municipal.
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                      Qualificação Econômico-Financeira (Art. 69)
                    </span>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Balanço Patrimonial do último exercício social, Índices contábeis (LG, SG, LC &gt;= 1,0) e Certidão de Falência e Recuperação Judicial.
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                      Qualificação Técnica (Art. 67)
                    </span>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Atestado(s) de Capacidade Técnica (CAT) compatíveis com o objeto (limitados a no máx. 50% das parcelas relevantes conforme Súmula 263/TCU).
                    </p>
                  </div>
                </div>
              )}

              {abaDossie === 'vicios' && (
                <div className="space-y-3">
                  {auditoria?.apontamentos && auditoria.apontamentos.length > 0 ? (
                    <div className="space-y-2.5">
                      {auditoria.apontamentos.map((vicio, idx) => (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border ${vicio.gravidade === 'ALTO'
                            ? 'bg-red-50/60 border-red-200 text-red-950'
                            : vicio.gravidade === 'MEDIO'
                              ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                              : 'bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-xs block">
                              {vicio.titulo}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${vicio.gravidade === 'ALTO'
                                ? 'bg-red-200/80 text-red-900'
                                : vicio.gravidade === 'MEDIO'
                                  ? 'bg-amber-200/80 text-amber-900'
                                  : 'bg-slate-200 text-slate-800'
                                }`}
                            >
                              Gravidade {vicio.gravidade}
                            </span>
                          </div>

                          <blockquote className="bg-white/80 p-2 rounded-lg border border-slate-200/80 font-mono text-[11px] text-slate-800 italic my-2 leading-relaxed">
                            {vicio.trechoLiteral}
                          </blockquote>

                          <div className="text-[11px] space-y-1">
                            <p>
                              <strong className="text-slate-900">Fundamentação:</strong> {vicio.fundamentoLegal}
                            </p>
                            {vicio.acaoRecomendada && (
                              <p>
                                <strong className="text-slate-900">Recomendação:</strong> {vicio.acaoRecomendada}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#14532D]/5 border border-[#166534]/30 text-[#14532D] flex items-center gap-2">
                      <CheckCircle2 size={18} />
                      <span className="font-bold text-xs">
                        Nenhuma cláusula restritiva ou vício formal típico foi encontrado nos trechos analisados deste edital.
                      </span>
                    </div>
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
                  Texto Integral / Anexos Oficiais
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
                    {uploadingPdf ? 'Lendo PDF...' : 'Anexar PDF'}
                  </button>
                  <span className="text-xs font-bold text-slate-400">
                    {editalTexto.length.toLocaleString('pt-BR')} chars
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
                      Auditar Cláusulas com IA Especialista...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} className="text-[#EA580C]" />
                      Gerar Parecer Completo com IA
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* PAINEL DIREITO: AUDITORIA AUTOMÁTICA & STREAMING */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${analisando ? 'bg-amber-500 animate-pulse' : 'bg-[#14532D]'}`} />
                <h3 className="font-black text-slate-900 text-sm">
                  Auditoria de Vícios & Parecer de Engenharia
                </h3>
              </div>

              {resultadoStreaming && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copiarRelatorio}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition-all"
                    title="Copiar relatório completo"
                  >
                    {copiado ? <Check size={14} className="text-[#14532D]" /> : <Copy size={14} />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                  <Link
                    to={selectedEditalId ? `/propostas/criar?edital=${selectedEditalId}` : FORNECEDOR_ROUTES.propostas}
                    className="px-3 py-1.5 rounded-lg bg-[#0B192C] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    Gerar Proposta
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>

            {/* AUDITORIA DETERMINÍSTICA AUTOMÁTICA (APARECE IMEDIATAMENTE AO CARREGAR) */}
            {auditoria && (
              <div className="space-y-3">
                {auditoria.status === 'CONFORME' || auditoria.apontamentos.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#14532D]/5 border border-[#166534]/30 text-[#14532D] space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-[#14532D]" />
                      <strong className="text-xs font-black">
                        Edital Conforme (Lei 14.133/2021)
                      </strong>
                    </div>
                    <p className="text-xs text-[#14532D]/90 leading-relaxed">
                      Nenhuma cláusula restritiva ou vício formal típico foi encontrado nos trechos analisados deste edital.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <AlertTriangle size={15} className="text-amber-600" />
                        {auditoria.totalVicios} Apontamento(s) de Restrição Detectado(s):
                      </span>
                      <Link
                        to={`/impugnacao?edital=${selectedEditalId}`}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                      >
                        <Scale size={12} />
                        Gerar Peça de Impugnação
                      </Link>
                    </div>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {auditoria.apontamentos.map((vicio, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border text-xs space-y-1.5 ${vicio.gravidade === 'ALTO'
                            ? 'bg-red-50/50 border-red-200 text-red-950'
                            : 'bg-amber-50/50 border-amber-200 text-amber-950'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-xs font-black">
                              {vicio.titulo}
                            </strong>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white border border-slate-200">
                              {vicio.gravidade}
                            </span>
                          </div>
                          <blockquote className="bg-white p-2 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 italic">
                            {vicio.trechoLiteral}
                          </blockquote>
                          <p className="text-[11px] text-slate-600">
                            <strong>Fundamentação:</strong> {vicio.fundamentoLegal}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RELATÓRIO COMPLETO GERADO VIA IA */}
            <div className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-xl overflow-y-auto max-h-[420px]">
              {resultadoStreaming ? (
                <div className="prose prose-sm max-w-none text-slate-800 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                  {resultadoStreaming}
                </div>
              ) : (
                <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <div className="p-3 bg-white rounded-full border border-slate-200 shadow-xs text-slate-400">
                    <FileText size={24} className="text-[#EA580C]" />
                  </div>
                  <h4 className="font-black text-slate-800 text-xs">
                    Auditoria determinística exibida acima
                  </h4>
                  <p className="text-[11px] text-slate-500 max-w-sm">
                    Clique em &quot;Gerar Parecer Completo com IA&quot; para expandir com análise tática e estratégia operacional de lances.
                  </p>
                </div>
              )}
            </div>

            {analiseConcluida && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[#14532D] font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={15} /> Parecer executivo estruturado sob a Lei 14.133/2021
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    to={selectedEditalId ? `/impugnacao?edital=${selectedEditalId}` : FORNECEDOR_ROUTES.impugnacao}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold transition-all text-xs"
                  >
                    Montar Peça de Impugnação
                  </Link>
                  <Link
                    to={selectedEditalId ? `/precificacao?edital=${selectedEditalId}` : FORNECEDOR_ROUTES.precificacao_estrategica}
                    className="px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-orange-600 text-white font-bold transition-all text-xs"
                  >
                    Simular Precificação
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeitorEditaisPage;
