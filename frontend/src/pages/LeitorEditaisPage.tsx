import api, { noticesApi } from '@/services/api';
import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  Scale,
  Package,
  Calculator,
  FileCheck,
  ExternalLink,
  RefreshCw,
  Download,
  Calendar,
  Truck,
  CreditCard,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
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

type SecaoId =
  | 'visao'
  | 'disputa'
  | 'itens'
  | 'entrega'
  | 'habilitacao'
  | 'contrato'
  | 'arquivos';

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

  const [sourceMode, setSourceMode] = useState<'PDF_ANEXO_REAL' | 'PDF_ESCANEADO_SEM_TEXTO' | 'APENAS_METADADOS_PNCP' | null>(null);
  const [arquivosOficiais, setArquivosOficiais] = useState<ArquivoOficial[]>([]);
  const [auditoria, setAuditoria] = useState<AuditoriaData | null>(null);

  const [editalTexto, setEditalTexto] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [baixandoArquivo, setBaixandoArquivo] = useState(false);
  const [mostrarTextoBruto, setMostrarTextoBruto] = useState(false);

  const [abaDossie, setAbaDossie] = useState<SecaoId>('visao');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (urlEditalId && urlEditalId !== selectedEditalId) {
      setSelectedEditalId(urlEditalId);
    }
  }, [urlEditalId]);

  useEffect(() => {
    if (!selectedEditalId) {
      setSelectedEditalData(null);
      setFichaSpecs(null);
      setCruzamentoEmpresa(null);
      setSourceMode(null);
      setArquivosOficiais([]);
      setAuditoria(null);
      setEditalTexto('');
      setMostrarTextoBruto(false);
      return;
    }

    let active = true;
    setCarregandoEdital(true);
    setMostrarTextoBruto(false);

    const companyQuery = selectedCompany?.id ? `&companyId=${encodeURIComponent(selectedCompany.id)}` : '';

    Promise.allSettled([
      noticesApi.getBasicSummary(selectedEditalId),
      noticesApi.getById(selectedEditalId),
      api.get('/notices/' + encodeURIComponent(selectedEditalId) + '/chunks?limit=500' + companyQuery).catch(() => null),
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
        setAuditoria(fetchedAuditoria);

        if (mergedData) {
          setSelectedEditalData(mergedData);
        }

        if (fetchedSourceMode === 'PDF_ANEXO_REAL' && textoRealExtraido.trim().length >= 50) {
          setEditalTexto(textoRealExtraido);
        } else {
          setEditalTexto('');
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
  }, [selectedEditalId, selectedCompany?.id]);

  const handleSelectEdital = (edital: EditalOption) => {
    setSelectedEditalId(edital.id);
    setSearchParams({ edital: edital.id });
    setAuditoria(null);
    setFichaSpecs(null);
    setCruzamentoEmpresa(null);
  };

  const handleDownloadArquivo = async (url: string, nomeArquivo: string) => {
    if (!url || baixandoArquivo) return;
    setBaixandoArquivo(true);
    const loadingToast = toast.loading(`Baixando ${nomeArquivo}...`);
    try {
      const normalizedUrl = url.replace(/^\/api\/v1\//, '/');
      const response = await api.get(normalizedUrl, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', nomeArquivo || 'edital.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Download concluído!', { id: loadingToast });
    } catch (err) {
      console.error('Erro no download:', err);
      toast.error('Arquivo indisponível diretamente no portal oficial para este registro.', { id: loadingToast });
    } finally {
      setBaixandoArquivo(false);
    }
  };

  const handleUploadPdfManual = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Selecione um arquivo PDF válido.');
      return;
    }
    setUploadingPdf(true);
    const loadingToast = toast.loading('Lendo o arquivo PDF e auditando cláusulas...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedCompany?.id) {
        formData.append('companyId', selectedCompany.id);
      }
      const res = await api.post(`/notices/${encodeURIComponent(selectedEditalId || 'manual')}/analisar-pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        toast.success('PDF lido e auditado com sucesso!', { id: loadingToast });
        if (res.data.textoExtraido) {
          setEditalTexto(res.data.textoExtraido);
        }
        if (res.data.auditoriaDeterministica) {
          setAuditoria(res.data.auditoriaDeterministica);
        }
        if (res.data.fichaSpecs) {
          setFichaSpecs(res.data.fichaSpecs);
        }
        if (res.data.cruzamentoEmpresa) {
          setCruzamentoEmpresa(res.data.cruzamentoEmpresa);
        }
        setSourceMode('PDF_ANEXO_REAL');
      } else {
        toast.error(res.data?.message || 'Não foi possível extrair texto do PDF.', { id: loadingToast });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Falha ao enviar o PDF.', { id: loadingToast });
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const dossier = selectedEditalData?.dossier;
  const ficha = dossier?.fichaTecnica;
  const crono = dossier?.cronogramaPrazosFatais;
  const itens =
    Array.isArray(fichaSpecs?.secoes?.objetoContratacao?.itensDetalhados) &&
      fichaSpecs.secoes.objetoContratacao.itensDetalhados.length > 0
      ? fichaSpecs.secoes.objetoContratacao.itensDetalhados
      : Array.isArray(dossier?.quadroItensDetalhado)
        ? dossier.quadroItensDetalhado
        : Array.isArray(selectedEditalData?.items)
          ? selectedEditalData.items
          : [];

  const secoes = fichaSpecs?.secoes;
  const temPdfReal = sourceMode === 'PDF_ANEXO_REAL';

  const menuSecoes: Array<{ id: SecaoId; label: string; icon: React.ReactNode }> = [
    { id: 'visao', label: 'Visão Geral e Objeto', icon: <FileText className="w-4 h-4 shrink-0" /> },
    { id: 'disputa', label: 'Disputa e Prazos', icon: <Calendar className="w-4 h-4 shrink-0" /> },
    { id: 'itens', label: `Itens e Quantidades (${itens.length})`, icon: <Package className="w-4 h-4 shrink-0" /> },
    { id: 'entrega', label: 'Entrega e Execução', icon: <Truck className="w-4 h-4 shrink-0" /> },
    { id: 'habilitacao', label: 'Habilitação Exigida', icon: <FileCheck className="w-4 h-4 shrink-0" /> },
    { id: 'contrato', label: 'Pagamento e Contrato', icon: <CreditCard className="w-4 h-4 shrink-0" /> },
    {
      id: 'arquivos',
      label: arquivosOficiais.length ? `Anexos Oficiais (${arquivosOficiais.length})` : 'Anexos Oficiais',
      icon: <Download className="w-4 h-4 shrink-0" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0B192C] pb-16 font-sans">
      <input
        type="file"
        accept=".pdf"
        ref={fileInputRef}
        onChange={handleUploadPdfManual}
        className="hidden"
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* TOPO ÚNICO E COMPACTO: SELETOR À ESQUERDA + AÇÕES À DIREITA */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3.5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <EditalSelector
              value={selectedEditalId}
              selectedId={selectedEditalId}
              onSelectEdital={handleSelectEdital}
              label="Edital selecionado para leitura:"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!selectedEditalId || baixandoArquivo}
              onClick={() =>
                handleDownloadArquivo(
                  `/notices/${encodeURIComponent(selectedEditalId)}/download-original`,
                  `Edital_${ficha?.numeroEdital || selectedEditalId}.pdf`,
                )
              }
              className="px-3.5 py-2 bg-[#0B192C] hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Edital</span>
            </button>

            <button
              type="button"
              disabled={uploadingPdf}
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-[#0B192C] rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>{uploadingPdf ? 'Processando...' : 'Anexar PDF'}</span>
            </button>

            <a
              href={selectedEditalId ? `/fornecedor/precificacao?edital=${encodeURIComponent(selectedEditalId)}` : '#'}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${selectedEditalId
                ? 'bg-[#EA580C] hover:bg-orange-600 text-white'
                : 'bg-slate-200 text-slate-400 pointer-events-none'
                }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Precificar</span>
            </a>

            <a
              href={selectedEditalId ? `/fornecedor/propostas/criar?edital=${encodeURIComponent(selectedEditalId)}` : '#'}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${selectedEditalId
                ? 'bg-slate-800 hover:bg-slate-900 text-white'
                : 'bg-slate-200 text-slate-400 pointer-events-none'
                }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Proposta</span>
            </a>

            <a
              href={selectedEditalId ? `/impugnacao?edital=${encodeURIComponent(selectedEditalId)}` : '#'}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${selectedEditalId
                ? 'bg-white border border-slate-300 hover:bg-slate-50 text-[#0B192C]'
                : 'bg-slate-100 text-slate-400 pointer-events-none'
                }`}
            >
              <Scale className="w-3.5 h-3.5 text-slate-700" />
              <span>Impugnar</span>
            </a>
          </div>
        </div>

        {/* AVISO DISCRETO DE 1 LINHA QUANDO NÃO HOUVER PDF REAL */}
        {selectedEditalId && !carregandoEdital && sourceMode && !temPdfReal && (
          <div className="px-4 py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-600 shrink-0" />
            <span>
              {sourceMode === 'PDF_ESCANEADO_SEM_TEXTO'
                ? 'O documento publicado pelo órgão está em formato de imagem sem texto selecionável. Use o botão "Anexar PDF" acima caso possua a versão pesquisável.'
                : 'O portal oficial publicou apenas os dados resumidos deste certame, sem arquivo PDF legível. Use o botão "Anexar PDF" acima para leitura completa e auditoria de cláusulas.'}
            </span>
          </div>
        )}

        {/* AVISO DISCRETO DE PONTOS DE ATENÇÃO -> RADAR DE NULIDADES */}
        {selectedEditalId && !carregandoEdital && auditoria && auditoria.totalVicios > 0 && (
          <div className="px-4 py-2.5 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#EA580C] shrink-0" />
              {auditoria.totalVicios} ponto(s) de atenção encontrados neste edital.
            </span>
            <Link
              to={`/fornecedor/radar-nulidades?edital=${encodeURIComponent(selectedEditalId)}`}
              className="px-3 py-1.5 rounded-lg bg-[#0B192C] hover:bg-slate-800 text-white font-bold text-xs transition shrink-0"
            >
              Ver Cláusulas no Radar de Nulidades
            </Link>
          </div>
        )}

        {/* ESTADO DE CARREGAMENTO OU SEM EDITAL SELECIONADO */}
        {!selectedEditalId ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-[#0B192C]">Selecione um edital acima para iniciar a leitura</p>
            <p className="text-xs text-slate-500">
              Você pode buscar um edital monitorado pelo seletor acima ou abrir diretamente a partir do Radar de Oportunidades.
            </p>
          </div>
        ) : carregandoEdital && !selectedEditalData ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
            <RefreshCw className="w-6 h-6 text-[#0B192C] animate-spin mx-auto" />
            <p className="text-sm font-bold text-[#0B192C]">Carregando informações e documentos oficiais...</p>
          </div>
        ) : (
          /* LAYOUT CORPORATIVO EM 2 COLUNAS LADO A LADO */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLUNA ESQUERDA (~28%): MENU DE SEÇÕES + DOCUMENTOS DA EMPRESA */}
            <aside className="lg:col-span-4 xl:col-span-3 space-y-5">
              {/* Menu de Seções */}
              <nav
                aria-label="Seções do Edital"
                className="bg-white rounded-xl border border-slate-200 p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible shadow-2xs"
              >
                {menuSecoes.map((sec) => {
                  const ativo = abaDossie === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setAbaDossie(sec.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold transition whitespace-nowrap lg:whitespace-normal text-left cursor-pointer shrink-0 lg:shrink ${ativo
                        ? 'bg-[#0B192C] text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-[#0B192C]'
                        }`}
                    >
                      {sec.icon}
                      <span>{sec.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Documentos da Empresa para este Edital */}
              {cruzamentoEmpresa && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#0B192C]">
                      Documentos da Empresa para este Edital
                    </h3>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {(cruzamentoEmpresa.checklistDocumentos || []).map((docItem: any, idx: number) => {
                      const emDia = docItem.status === 'PRONTO';
                      const vencido = docItem.status === 'VENCIDO';
                      return (
                        <div
                          key={idx}
                          className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-xs"
                        >
                          <span className="font-medium text-slate-800 leading-snug">
                            {docItem.requisito}
                          </span>
                          <span
                            className={`shrink-0 font-bold text-[11px] ${emDia
                              ? 'text-[#14532D]'
                              : vencido
                                ? 'text-red-700'
                                : 'text-slate-600'
                              }`}
                          >
                            {emDia ? 'Em dia' : vencido ? 'Vencido' : 'Falta anexar'}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {cruzamentoEmpresa.totalPendentes > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <Link
                        to="/fornecedor/documentos"
                        className="text-xs font-bold text-[#EA580C] hover:underline inline-block"
                      >
                        Regularizar documentos no cofre →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </aside>

            {/* COLUNA DIREITA (~72%): FOLHA CORPORATIVA DE LEITURA */}
            <main className="lg:col-span-8 xl:col-span-9 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              {/* CABEÇALHO LIMPO DO EDITAL + VEREDITO PRÁTICO */}
              <div className="p-6 border-b border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-semibold">
                      <span>Edital nº {ficha?.numeroEdital || selectedEditalData?.noticeNumber || selectedEditalId}</span>
                      <span>·</span>
                      <span>{ficha?.municipioUf || selectedEditalData?.municipality || 'Âmbito Nacional'}</span>
                      <span>·</span>
                      <span className="font-mono">
                        CNPJ {ficha?.cnpjFormatado || formatCnpj(selectedEditalData?.buyerDocument)}
                      </span>
                    </div>
                    <h1 className="text-lg sm:text-xl font-black text-[#0B192C] leading-snug">
                      {ficha?.razaoSocial || selectedEditalData?.buyerName || 'Órgão Licitante'}
                    </h1>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Valor Estimado
                    </span>
                    <span className="text-base sm:text-lg font-black text-[#0B192C]">
                      {ficha?.valorGlobalFormatado || formatBRL(selectedEditalData?.estimatedValue)}
                    </span>
                  </div>
                </div>

                {/* VEREDITO PRÁTICO OBJETIVO EM 3 LINHAS */}
                {cruzamentoEmpresa && Array.isArray(cruzamentoEmpresa.veredito3Linhas) && (
                  <div className="pt-3 border-t border-slate-100 space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Veredito Prático — {cruzamentoEmpresa.razaoSocial} ({cruzamentoEmpresa.porte})
                    </p>
                    <div className="space-y-1 text-xs text-slate-700 leading-relaxed">
                      {cruzamentoEmpresa.veredito3Linhas.map((linha: string, idx: number) => (
                        <p key={idx} className="font-medium">
                          {linha}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CONTEÚDO DA SEÇÃO SELECIONADA */}
              <div className="p-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
                {/* 1. VISÃO GERAL E OBJETO */}
                {abaDossie === 'visao' && (
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Objeto da Contratação
                      </h2>
                      <p className="text-sm text-[#0B192C] font-medium whitespace-pre-line leading-relaxed">
                        {secoes?.objetoContratacao?.oQueOrgaoQuer ||
                          dossier?.descricaoExplicativaObjeto?.objetoIntegral ||
                          selectedEditalData?.object ||
                          'Objeto oficial conforme registro do certame.'}
                      </p>
                      {fichaSpecs?.explicacaoProfessor ? (
                        <div className="mt-5 pt-5 border-t border-slate-200 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <h3 className="text-sm font-black uppercase tracking-wider text-[#0B192C]">
                                Explicação Completa do Edital (Aula Prática do Certame)
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Tradução didática de todas as regras do certame baseada exclusivamente nos documentos oficiais lidos.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            {[
                              fichaSpecs.explicacaoProfessor.bloco1ObjetoPratico,
                              fichaSpecs.explicacaoProfessor.bloco2DisputaEPrazos,
                              fichaSpecs.explicacaoProfessor.bloco3HabilitacaoCompleta,
                              fichaSpecs.explicacaoProfessor.bloco4GarantiasECustosOcultos,
                              fichaSpecs.explicacaoProfessor.bloco5EntregaPagamentoVigenciaPenalidades,
                              fichaSpecs.explicacaoProfessor.bloco6BeneficiosMeEppEstrategia,
                              fichaSpecs.explicacaoProfessor.bloco7PontosCriticosEFormalismo,
                            ]
                              .filter(Boolean)
                              .map((bloco: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="text-xs sm:text-sm font-extrabold text-[#0B192C]">
                                      {bloco.titulo}
                                    </h4>
                                    {bloco.referenciaFonte && (
                                      <span className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
                                        {bloco.referenciaFonte}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                                    {bloco.resumoDidatico}
                                  </p>
                                </div>
                              ))}
                          </div>
                        </div>
                      ) : fichaSpecs?.resumoExplicado ? (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Parecer Executivo & Leitura Prática do Edital
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-4">
                            {fichaSpecs.resumoExplicado}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Modalidade
                        </span>
                        <span className="text-xs font-bold text-[#0B192C]">
                          {ficha?.modalidade || selectedEditalData?.modality || 'Não informada'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Modo de Disputa
                        </span>
                        <span className="text-xs font-bold text-[#0B192C]">
                          {ficha?.modoDisputa || selectedEditalData?.modoDisputa || 'Não informado'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Critério de Julgamento
                        </span>
                        <span className="text-xs font-bold text-[#0B192C]">
                          {ficha?.criterioJulgamento || selectedEditalData?.judgmentCriterion || 'Menor Preço'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Regime Jurídico
                        </span>
                        <span className="text-xs font-bold text-[#14532D]">Lei Federal nº 14.133/2021</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. DISPUTA E PRAZOS */}
                {abaDossie === 'disputa' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Portal da Disputa
                        </span>
                        <p className="text-sm font-bold text-[#0B192C]">
                          {secoes?.disputaEPrazos?.portalDisputa || selectedEditalData?.source || 'Portal Oficial de Compras'}
                        </p>
                        <span className="text-xs text-slate-500 block">
                          {fichaSpecs?.disputaEExecucao?.modoDisputaTexto || 'Disputa Eletrônica'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Abertura da Sessão Pública
                        </span>
                        <p className="text-sm font-bold text-[#0B192C]">
                          {(() => {
                            const aber =
                              crono?.aberturaSessaoPublica ||
                              selectedEditalData?.openingAt ||
                              selectedEditalData?.closingAt;
                            return aber ? formatPncpDateBR(aber, true) : 'Não informada no registro';
                          })()}
                        </p>
                        <span className="text-xs text-slate-500 block">Horário oficial de Brasília</span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Prazo Limite para Impugnação
                        </span>
                        <p className="text-sm font-bold text-[#0B192C]">
                          {(() => {
                            const rawImp =
                              crono?.prazoLimiteImpugnacao ||
                              calcularPrazoImpugnacaoArt164(
                                crono?.aberturaSessaoPublica ||
                                selectedEditalData?.openingAt ||
                                selectedEditalData?.closingAt,
                              );
                            return rawImp ? formatPncpDateBR(rawImp, true) : 'Até 3 dias úteis antes da abertura';
                          })()}
                        </p>
                        <span className="text-xs text-slate-500 block">Art. 164 da Lei nº 14.133/2021</span>
                      </div>
                    </div>

                    {(fichaSpecs?.trechosLiterais?.disputaEPrazos || fichaSpecs?.disputaEExecucao?.trechoComprovante) && (
                      <div className="pt-4 border-t border-slate-100 space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Trecho comprobatório no documento oficial
                        </span>
                        <blockquote className="text-xs font-mono text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200 leading-relaxed">
                          {fichaSpecs?.trechosLiterais?.disputaEPrazos || fichaSpecs?.disputaEExecucao?.trechoComprovante}
                        </blockquote>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. ITENS E QUANTIDADES */}
                {abaDossie === 'itens' && (
                  <div className="space-y-3">
                    {itens.length > 0 ? (
                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                              <th className="py-2.5 px-3 text-center">Item</th>
                              <th className="py-2.5 px-3 min-w-[220px]">Descrição Oficial</th>
                              <th className="py-2.5 px-3 text-center">Quantidade</th>
                              <th className="py-2.5 px-3 text-right">Valor Unitário Ref.</th>
                              <th className="py-2.5 px-3 text-right">Valor Total Estimado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {itens.map((it: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-3 font-mono font-bold text-center text-[#0B192C]">
                                  {it.itemNumero ?? it.numeroItem ?? it.itemNumber ?? idx + 1}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800">
                                  {it.descricao ?? it.descricaoCompleta ?? it.description}
                                </td>
                                <td className="py-2.5 px-3 text-center font-semibold">
                                  {it.quantidade ?? it.quantity ?? 1} {it.unidade ?? it.unidadeMedida ?? 'UN'}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {formatBRL(it.valorUnitarioEstimado ?? it.estimatedUnitValue)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-[#0B192C]">
                                  {formatBRL(it.valorTotalEstimado ?? it.estimatedTotalValue)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 py-4">
                        Nenhum item detalhado foi disponibilizado nos registros atuais deste edital.
                      </p>
                    )}
                  </div>
                )}

                {/* 4. ENTREGA E EXECUÇÃO */}
                {abaDossie === 'entrega' && (
                  <div className="divide-y divide-slate-100 text-xs space-y-4">
                    <div className="pb-4 space-y-1">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Prazo de Entrega / Início da Execução
                      </h3>
                      <p className="text-slate-800">
                        {secoes?.condicoesEntregaExecucao?.prazoEntrega || 'Não especificado nos arquivos analisados.'}
                      </p>
                    </div>

                    <div className="pb-4 space-y-1">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Local de Entrega ou Execução
                      </h3>
                      <p className="text-slate-800">
                        {secoes?.condicoesEntregaExecucao?.localEntrega || 'Não especificado nos arquivos analisados.'}
                      </p>
                    </div>

                    <div className="pb-4 space-y-1">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Vistoria Técnica
                      </h3>
                      <p className="text-slate-800">
                        {secoes?.condicoesEntregaExecucao?.detalhesVistoria || 'Não exigido nos arquivos analisados.'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Amostras, Catálogo ou Prova de Conceito
                      </h3>
                      <p className="text-slate-800">
                        <strong>Amostra:</strong>{' '}
                        {secoes?.condicoesEntregaExecucao?.detalhesAmostra || 'Não exigido nos arquivos analisados.'}
                      </p>
                      <p className="text-slate-800">
                        <strong>Catálogo / Ficha Técnica:</strong>{' '}
                        {secoes?.condicoesEntregaExecucao?.detalhesCatalogo || 'Não exigido nos arquivos analisados.'}
                      </p>
                    </div>

                    {fichaSpecs?.trechosLiterais?.entregaEExecucao && (
                      <div className="pt-4 space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Trecho Literal Extraído do Capítulo Oficial
                        </span>
                        <blockquote className="text-xs font-mono text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-line">
                          {fichaSpecs.trechosLiterais.entregaEExecucao}
                        </blockquote>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. HABILITAÇÃO EXIGIDA */}
                {abaDossie === 'habilitacao' && (
                  <div className="divide-y divide-slate-100 text-xs space-y-4">
                    <div className="pb-4 space-y-1.5">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Habilitação Jurídica (Art. 66)
                      </h3>
                      <ul className="list-disc list-inside text-slate-800 space-y-1">
                        {(secoes?.documentosExigidosHabilitacao?.juridica || [
                          'Não especificado nos arquivos analisados',
                        ]).map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pb-4 space-y-1.5">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Regularidade Fiscal, Social e Trabalhista (Art. 68)
                      </h3>
                      <ul className="list-disc list-inside text-slate-800 space-y-1">
                        {(secoes?.documentosExigidosHabilitacao?.fiscalTrabalhista || [
                          'Não especificado nos arquivos analisados',
                        ]).map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="pb-4 space-y-1">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Qualificação Econômico-Financeira (Art. 69)
                      </h3>
                      <p className="text-slate-800">
                        <strong>Balanço Patrimonial:</strong>{' '}
                        {secoes?.documentosExigidosHabilitacao?.balancoPatrimonial || 'Não especificado nos arquivos analisados'}
                      </p>
                      <p className="text-slate-800">
                        <strong>Índices Contábeis:</strong>{' '}
                        {secoes?.documentosExigidosHabilitacao?.exigenciaIndicesContabeis || 'Não especificado nos arquivos analisados'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Qualificação Técnica (Art. 67)
                      </h3>
                      <p className="text-slate-800">
                        <strong>Atestado de Capacidade Técnica:</strong>{' '}
                        {secoes?.documentosExigidosHabilitacao?.atestadoTecnico || 'Não exigido nos arquivos analisados'}
                      </p>
                      <p className="text-slate-800">
                        <strong>Percentual Mínimo:</strong>{' '}
                        {secoes?.documentosExigidosHabilitacao?.limiteAtestadoPercentual || 'Não especificado'}
                      </p>
                      <p className="text-slate-800">
                        <strong>Tempo Mínimo de Experiência:</strong>{' '}
                        {secoes?.documentosExigidosHabilitacao?.tempoMinimoExperiencia || 'Não exige tempo mínimo de experiência'}
                      </p>
                      <p className="text-slate-800">
                        <strong>Registro em Conselho / Alvará:</strong>{' '}
                        {secoes?.documentosExigidosHabilitacao?.registroConselhoOuAlvara || 'Não exigido nos arquivos analisados'}
                      </p>
                    </div>

                    {(fichaSpecs?.trechosLiterais?.habilitacaoJuridica ||
                      fichaSpecs?.trechosLiterais?.regularidadeFiscal ||
                      fichaSpecs?.trechosLiterais?.qualificacaoEconomica ||
                      fichaSpecs?.trechosLiterais?.qualificacaoTecnica) && (
                        <div className="pt-4 space-y-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            Trechos Literais Extraídos dos Capítulos de Habilitação
                          </span>
                          <div className="space-y-2">
                            {[
                              { label: 'Habilitação Jurídica', txt: fichaSpecs?.trechosLiterais?.habilitacaoJuridica },
                              { label: 'Regularidade Fiscal', txt: fichaSpecs?.trechosLiterais?.regularidadeFiscal },
                              { label: 'Econômico-Financeira', txt: fichaSpecs?.trechosLiterais?.qualificacaoEconomica },
                              { label: 'Qualificação Técnica', txt: fichaSpecs?.trechosLiterais?.qualificacaoTecnica },
                            ]
                              .filter((x) => Boolean(x.txt))
                              .map((item, idx) => (
                                <blockquote key={idx} className="text-xs font-mono text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                                  <strong className="font-sans text-[#0B192C] block mb-1">{item.label}:</strong>
                                  {item.txt}
                                </blockquote>
                              ))}
                          </div>
                        </div>
                      )}

                    {(selectedEditalData?.metadata?.faltamAnexosTecnicos ||
                      /remetido ao termo|não especificado|verificar cláusula/i.test(
                        `${secoes?.documentosExigidosHabilitacao?.atestadoTecnico || ''} ${secoes?.documentosExigidosHabilitacao?.balancoPatrimonial || ''}`,
                      )) && (
                        <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                          <p className="font-bold">Lacuna detectada nos arquivos publicados pelo órgão</p>
                          <p>
                            {selectedEditalData?.metadata?.faltamAnexosTecnicos
                              ? 'O Edital principal foi publicado sem o Termo de Referência / Projeto Básico completo no portal de origem.'
                              : 'Alguma exigência de habilitação remete a anexo técnico não detalhado no corpo principal publicado.'}{' '}
                            Recomendamos protocolar pedido de esclarecimento antes da disputa.
                          </p>
                          <Link
                            to={`/fornecedor/impugnacao?edital=${encodeURIComponent(selectedEditalId)}`}
                            className="inline-block font-bold text-[#EA580C] hover:underline mt-1"
                          >
                            Gerar Pedido de Esclarecimento →
                          </Link>
                        </div>
                      )}
                  </div>
                )}

                {/* 6. PAGAMENTO E CONTRATO */}
                {abaDossie === 'contrato' && (
                  <div className="divide-y divide-slate-100 text-xs space-y-4">
                    <div className="pb-4 space-y-1">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Prazo e Condições de Pagamento
                      </h3>
                      <p className="text-slate-800">
                        {secoes?.financeiroEContrato?.condicoesPagamento || 'Não especificado nos arquivos analisados.'}
                      </p>
                    </div>

                    <div className="pb-4 space-y-1">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Vigência do Contrato / Ata de Registro
                      </h3>
                      <p className="text-slate-800">
                        {secoes?.financeiroEContrato?.vigenciaContrato || 'Não especificado nos arquivos analisados.'}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Reajuste, Garantia e Penalidades
                      </h3>
                      <p className="text-slate-800">
                        <strong>Reajuste:</strong>{' '}
                        {secoes?.financeiroEContrato?.criterioReajuste || 'Não especificado nos arquivos analisados.'}
                      </p>
                      <p className="text-slate-800">
                        <strong>Garantia Contratual:</strong>{' '}
                        {secoes?.financeiroEContrato?.garantiaContratual || 'Não exigido nos arquivos analisados.'}
                      </p>
                      <p className="text-slate-800">
                        <strong>Multas e Penalidades:</strong>{' '}
                        {secoes?.financeiroEContrato?.multasEPenalidades || 'Não especificado nos arquivos analisados.'}
                      </p>
                    </div>

                    {fichaSpecs?.trechosLiterais?.pagamentoEContrato && (
                      <div className="pt-4 space-y-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Trechos Literais de Pagamento, Vigência e Sanções
                        </span>
                        <blockquote className="text-xs font-mono text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200 leading-relaxed whitespace-pre-line">
                          {fichaSpecs.trechosLiterais.pagamentoEContrato}
                        </blockquote>
                      </div>
                    )}

                    {(selectedEditalData?.metadata?.faltamAnexosTecnicos ||
                      /não especificado/i.test(
                        `${secoes?.financeiroEContrato?.condicoesPagamento || ''} ${secoes?.financeiroEContrato?.vigenciaContrato || ''}`,
                      )) && (
                        <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                          <p className="font-bold">Minuta Contratual / Pagamento ausente ou parcial no portal</p>
                          <p>
                            Os termos completos de pagamento ou vigência não constam nos anexos disponíveis. Solicite esclarecimento oficial ao órgão antes de precificar.
                          </p>
                          <Link
                            to={`/fornecedor/impugnacao?edital=${encodeURIComponent(selectedEditalId)}`}
                            className="inline-block font-bold text-[#EA580C] hover:underline mt-1"
                          >
                            Gerar Pedido de Esclarecimento →
                          </Link>
                        </div>
                      )}
                  </div>
                )}

                {/* 7. ANEXOS OFICIAIS */}
                {abaDossie === 'arquivos' && (
                  <div className="space-y-5 text-xs">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Documentos Oficiais Publicados
                      </h2>
                      <p className="text-slate-500 mt-0.5">
                        Baixe os arquivos oficiais diretamente pela plataforma ou consulte o registro no portal de origem.
                      </p>
                    </div>

                    {arquivosOficiais.length > 0 ? (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                        {arquivosOficiais.map((arq, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                              <div className="min-w-0">
                                <span className="font-bold text-[#0B192C] block truncate" title={arq.titulo}>
                                  {arq.titulo}
                                </span>
                                <span className="text-[11px] text-slate-500 block">
                                  {arq.tipoDocumento} {arq.tamanhoBytes ? `· ${formatBytes(arq.tamanhoBytes)}` : ''}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleDownloadArquivo(
                                    arq.urlDownloadInterno ||
                                    `/notices/${encodeURIComponent(selectedEditalId)}/download-arquivo/${arq.sequencial || 1}`,
                                    arq.titulo || 'documento.pdf',
                                  )
                                }
                                disabled={baixandoArquivo}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#0B192C] rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Baixar</span>
                              </button>
                              <a
                                href={arq.urlDownloadOficial}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-slate-400 hover:text-[#0B192C] rounded-lg hover:bg-slate-100 transition"
                                title="Abrir no portal oficial"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 py-3">
                        Nenhum anexo individual foi listado pelo portal oficial para este edital.
                      </p>
                    )}

                    {/* BOTÃO DISCRETO PARA CONFERÊNCIA DO TEXTO BRUTO EXTRAÍDO */}
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <button
                        type="button"
                        onClick={() => setMostrarTextoBruto((prev) => !prev)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#0B192C] cursor-pointer"
                      >
                        {mostrarTextoBruto ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{mostrarTextoBruto ? 'Ocultar texto bruto extraído' : 'Ver texto bruto extraído'}</span>
                      </button>

                      {mostrarTextoBruto && (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg max-h-[420px] overflow-y-auto font-mono text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {editalTexto.trim()
                            ? editalTexto
                            : 'Nenhum texto completo de PDF disponível para este registro. Anexe o PDF oficial pelo botão "Anexar PDF" no topo.'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeitorEditaisPage;
