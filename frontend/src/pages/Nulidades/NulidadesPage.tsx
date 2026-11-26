import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Plus,
  Trash2,
  Search,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  Download,
  Network,
  Scale,
  Database,
  Gavel,
  UploadCloud,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { noticesApi } from '@services/api';
import { formatCnpjMask, isValidCnpj, sanitizeCnpj } from '@/utils/cnpj';
import { EditalSelector, EditalOption } from '@/components/EditalSelector';
import { useCompany } from '@/contexts/CompanyContext';

interface VicioApontamento {
  id?: string;
  titulo: string;
  gravidade: 'ALTO' | 'MEDIO' | 'BAIXO';
  arquivoOrigem?: string;
  pagina?: number | string;
  clausula?: string | null;
  trechoLiteral: string;
  fundamentoLegal: string;
  explicacaoSimples?: string;
  acaoRecomendada?: string;
}

interface AuditoriaEdital {
  status: 'IRREGULARIDADE_DETECTADA' | 'CONFORME';
  mensagem: string;
  totalVicios: number;
  viciosAltos: number;
  viciosMedios: number;
  viciosBaixos: number;
  apontamentos: VicioApontamento[];
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatarGravidade(gravidade: string): { label: string; badgeClass: string } {
  if (gravidade === 'ALTO') {
    return { label: 'Gravidade Alta', badgeClass: 'bg-red-100 text-red-800 border border-red-200' };
  }
  if (gravidade === 'MEDIO') {
    return { label: 'Gravidade Média', badgeClass: 'bg-amber-100 text-amber-900 border border-amber-200' };
  }
  return { label: 'Gravidade Baixa', badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200' };
}

export const NulidadesPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlEditalId = searchParams.get('edital') || '';

  const [modoAtivo, setModoAtivo] = useState<'edital' | 'integridade'>('edital');

  // Estado Auditoria de Cláusulas & Vícios do Edital
  const [selectedEditalId, setSelectedEditalId] = useState<string>(urlEditalId);
  const [editalInfo, setEditalInfo] = useState<any>(null);
  const [auditoria, setAuditoria] = useState<AuditoriaEdital | null>(null);
  const [sourceMode, setSourceMode] = useState<'PDF_ANEXO_REAL' | 'PDF_ESCANEADO_SEM_TEXTO' | 'APENAS_METADADOS_PNCP' | null>(null);
  const [carregandoEdital, setCarregandoEdital] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado Cruzamento de Integridade de Concorrentes
  const [cnpjs, setCnpjs] = useState<string[]>(['', '']);
  const [processoRef, setProcessoRef] = useState('');
  const [abaIntegridade, setAbaIntegridade] = useState<'geral' | 'cruzamento' | 'indicios' | 'defesa'>('geral');
  const [carregandoIntegridade, setCarregandoIntegridade] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);

  useEffect(() => {
    if (urlEditalId && urlEditalId !== selectedEditalId) {
      setSelectedEditalId(urlEditalId);
      setModoAtivo('edital');
    }
  }, [urlEditalId]);

  useEffect(() => {
    if (!selectedEditalId) {
      setEditalInfo(null);
      setAuditoria(null);
      setSourceMode(null);
      return;
    }

    let active = true;
    setCarregandoEdital(true);

    Promise.allSettled([
      noticesApi.getBasicSummary(selectedEditalId),
      api.get(`/notices/${encodeURIComponent(selectedEditalId)}/chunks?limit=80`),
    ])
      .then(([basicRes, chunksRes]) => {
        if (!active) return;

        if (basicRes.status === 'fulfilled' && basicRes.value?.data) {
          setEditalInfo(basicRes.value.data.data || basicRes.value.data);
        }

        if (chunksRes.status === 'fulfilled' && chunksRes.value?.data) {
          const cd = chunksRes.value.data;
          setSourceMode(cd.sourceMode || 'APENAS_METADADOS_PNCP');
          setAuditoria(cd.auditoriaDeterministica || cd.fichaSpecs?.auditoria || null);
        }
      })
      .catch(() => {
        if (active) toast.error('Não foi possível carregar a auditoria deste edital.');
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
    setSearchParams({ edital: edital.id });
    setAuditoria(null);
    setSourceMode(null);
  };

  const handleUploadPdfManual = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEditalId) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Selecione um arquivo PDF válido.');
      return;
    }

    setUploadingPdf(true);
    const loadingToast = toast.loading('Lendo o arquivo PDF linha por linha e auditando cláusulas...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedCompany?.id) formData.append('companyId', selectedCompany.id);

      const res = await api.post(`/notices/${encodeURIComponent(selectedEditalId)}/analisar-pdf`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success) {
        setAuditoria(res.data.auditoriaDeterministica || res.data.fichaSpecs?.auditoria || null);
        setSourceMode('PDF_ANEXO_REAL');
        toast.success('Auditoria completa do PDF concluída!', { id: loadingToast });
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

  const atualizarCnpj = (idx: number, val: string) => {
    const copia = [...cnpjs];
    copia[idx] = formatCnpjMask(val);
    setCnpjs(copia);
  };

  const adicionarCnpj = () => {
    if (cnpjs.length >= 6) {
      toast.error('Máximo de 6 empresas por análise.');
      return;
    }
    setCnpjs([...cnpjs, '']);
  };

  const removerCnpj = (idx: number) => {
    if (cnpjs.length <= 1) return;
    setCnpjs(cnpjs.filter((_, i) => i !== idx));
  };

  const executarCruzamento = async () => {
    const validos = cnpjs
      .map((c) => sanitizeCnpj(c))
      .filter((c) => isValidCnpj(c, { optional: false }));

    if (validos.length === 0) {
      toast.error('Informe pelo menos um CNPJ válido para iniciar o cruzamento.');
      return;
    }

    setCarregandoIntegridade(true);
    try {
      const resp = await api.post('/concorrentes/integridade', { cnpjs: validos }, { timeout: 60000 });
      setResultado(resp.data?.data || null);
      toast.success('Cruzamento de integridade concluído.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao executar cruzamento de dados.');
    } finally {
      setCarregandoIntegridade(false);
    }
  };

  const baixarRelatórioPdf = () => {
    if (!resultado) return;
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório de Integridade Licitatória</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; }
    .top { display: flex; justify-content: space-between; border-bottom: 3px solid #F97316; padding-bottom: 10px; margin-bottom: 18px; }
    .top img { height: 44px; }
    h1 { font-size: 18px; color: #081C3A; }
    h2 { font-size: 14px; color: #081C3A; margin-top: 16px; }
    li { font-size: 12px; margin-bottom: 6px; }
    .aviso { font-size: 11px; background: #fff7ed; border: 1px solid #fed7aa; padding: 10px; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="top">
    <img src="${window.location.origin}/assets/logo-expertise.png" alt="Expertise Licitatória" />
    <div style="text-align:right;font-size:11px;color:#475569;">
      <strong>Radar de Inteligência e Integridade</strong><br/>
      ${new Date().toLocaleString('pt-BR')}
    </div>
  </div>
  <h1>Análise de Possíveis Irregularidades</h1>
  ${processoRef ? `<p style="font-size:12px;"><strong>Processo / Edital:</strong> ${escapeHtml(processoRef)}</p>` : ''}
  <p style="font-size:13px;"><strong>Índice de Risco:</strong> ${escapeHtml(resultado.nivelRisco)} (${resultado.indiceRisco}%)</p>
  <div class="aviso">${escapeHtml(resultado.avisoLegal)}</div>
  <h2>Empresas Analisadas</h2>
  <ul>${(resultado.empresas || []).map((e: any) => `<li><strong>${escapeHtml(e.razaoSocial)}</strong> (${escapeHtml(e.cnpj)}) — ${escapeHtml(e.situacaoCadastral)} | ${escapeHtml(e.endereco)}</li>`).join('')}</ul>
  <h2>Indícios Identificados</h2>
  <ul>${(resultado.indicios || []).length ? resultado.indicios.map((i: any) => `<li>[${escapeHtml(i.severidade)}] <strong>${escapeHtml(i.titulo)}:</strong> ${escapeHtml(i.detalhe)}</li>`).join('') : '<li>Nenhum indício crítico detectado automaticamente.</li>'}</ul>
  <h2>Linhas de Defesa Sugeridas</h2>
  <ul>${(resultado.linhasDefesa || []).map((l: string) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const indice = resultado?.indiceRisco ?? 0;
  const corRisco =
    resultado?.nivelRisco === 'Elevado'
      ? '#dc2626'
      : resultado?.nivelRisco === 'Moderado'
      ? '#f59e0b'
      : '#16a34a';

  const temPdfReal = sourceMode === 'PDF_ANEXO_REAL';

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <input
        type="file"
        accept=".pdf"
        ref={fileInputRef}
        onChange={handleUploadPdfManual}
        className="hidden"
      />

      {/* Cabeçalho e Seletor de Modo */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0B192C] text-[#EA580C]">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#0B192C]">
              Radar de Nulidades & Auditoria de Cláusulas
            </h1>
            <p className="text-xs text-slate-500">
              Auditoria linha por linha de cláusulas restritivas, vícios formais e irregularidades com prova literal do documento oficial.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setModoAtivo('edital')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              modoAtivo === 'edital'
                ? 'bg-[#0B192C] text-white'
                : 'border border-slate-200 bg-white text-[#0B192C] hover:bg-slate-50'
            }`}
          >
            Auditoria de Cláusulas do Edital
          </button>
          <button
            type="button"
            onClick={() => setModoAtivo('integridade')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              modoAtivo === 'integridade'
                ? 'bg-[#0B192C] text-white'
                : 'border border-slate-200 bg-white text-[#0B192C] hover:bg-slate-50'
            }`}
          >
            Integridade de Concorrentes (CNPJ)
          </button>
        </div>
      </div>

      {/* MODO 1: AUDITORIA COMPLETA DE CLÁUSULAS E VÍCIOS DO EDITAL */}
      {modoAtivo === 'edital' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="flex-1 min-w-0">
              <EditalSelector
                value={selectedEditalId}
                selectedId={selectedEditalId}
                onSelectEdital={handleSelectEdital}
                label="Selecione o edital para auditar cláusulas e nulidades:"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={!selectedEditalId || uploadingPdf}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-[#0B192C] hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                <UploadCloud className="h-4 w-4 text-[#EA580C]" />
                {uploadingPdf ? 'Auditando PDF...' : 'Anexar PDF para Auditar'}
              </button>

              {selectedEditalId && (
                <Link
                  to={`/fornecedor/leitor-editais?edital=${encodeURIComponent(selectedEditalId)}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2.5 text-xs font-bold text-[#0B192C] transition"
                >
                  <FileText className="h-4 w-4" />
                  Abrir no Leitor de Editais
                </Link>
              )}
            </div>
          </div>

          {!selectedEditalId ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-2">
              <Scale className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-[#0B192C]">
                Selecione um edital acima para iniciar a auditoria de cláusulas
              </p>
              <p className="text-xs text-slate-500">
                Cada irregularidade detectada exibirá o arquivo, página, cláusula/subitem, trecho literal exato e botão direto para impugnação.
              </p>
            </div>
          ) : carregandoEdital ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-[#0B192C] mx-auto" />
              <p className="text-sm font-bold text-[#0B192C]">
                Lendo o texto integral do edital linha por linha...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {editalInfo && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      Edital nº {editalInfo.noticeNumber || selectedEditalId} · {editalInfo.municipality || 'Âmbito Nacional'}{editalInfo.uf ? `/${editalInfo.uf}` : ''}
                    </p>
                    <h2 className="text-base font-extrabold text-[#0B192C]">
                      {editalInfo.buyerName || 'Órgão Licitante'}
                    </h2>
                  </div>

                  {auditoria && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                          auditoria.totalVicios > 0
                            ? 'bg-red-100 text-red-800'
                            : temPdfReal
                              ? 'bg-[#14532D]/10 text-[#14532D]'
                              : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {auditoria.totalVicios > 0
                          ? `${auditoria.totalVicios} irregularidade(s) detectada(s)`
                          : temPdfReal
                            ? 'Edital Conforme'
                            : 'Aguardando PDF Oficial'}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {auditoria?.apontamentos && auditoria.apontamentos.length > 0 ? (
                <div className="space-y-4">
                  {auditoria.apontamentos.map((vicio, idx) => {
                    const grav = formatarGravidade(vicio.gravidade);
                    const queryImpug = new URLSearchParams({
                      edital: selectedEditalId,
                      vicio: vicio.titulo,
                      trecho: vicio.trechoLiteral,
                      fundamento: vicio.fundamentoLegal,
                      arquivo: vicio.arquivoOrigem || '',
                      pagina: String(vicio.pagina || ''),
                      ...(vicio.clausula ? { clausula: vicio.clausula } : {}),
                    }).toString();

                    return (
                      <div
                        key={vicio.id || idx}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                          <div className="space-y-1">
                            <h3 className="text-base font-extrabold text-[#0B192C]">
                              {vicio.titulo}
                            </h3>
                            <p className="text-xs font-bold text-slate-600">
                              Localização exata: {vicio.arquivoOrigem || 'Edital Oficial'} · Página {vicio.pagina || 'conforme documento'}
                              {vicio.clausula ? ` · ${vicio.clausula}` : ''}
                            </p>
                          </div>
                          <span className={`self-start rounded-full px-3 py-1 text-[11px] font-bold ${grav.badgeClass}`}>
                            {grav.label}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            Trecho literal extraído do documento oficial
                          </span>
                          <blockquote className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-mono text-xs text-slate-800 leading-relaxed">
                            &quot;{vicio.trechoLiteral}&quot;
                          </blockquote>
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                          <p>
                            <strong className="text-[#0B192C]">Por que é irregular:</strong>{' '}
                            {vicio.explicacaoSimples || 'A cláusula restringe indevidamente a competitividade do certame.'}
                          </p>
                          <p>
                            <strong className="text-[#0B192C]">Base legal:</strong> {vicio.fundamentoLegal}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                          <span className="text-xs text-slate-500">
                            {vicio.acaoRecomendada || 'Avaliar protocolo de impugnação antes do prazo limite.'}
                          </span>
                          <Link
                            to={`/fornecedor/impugnacao?${queryImpug}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#EA580C] hover:bg-orange-600 px-4 py-2 text-xs font-bold text-white transition shadow-xs"
                          >
                            <Gavel className="h-4 w-4" />
                            Gerar Impugnação desta Cláusula
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !temPdfReal ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-slate-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="text-sm font-bold text-[#0B192C]">
                      Auditoria profunda aguarda o arquivo PDF oficial do edital.
                    </p>
                    <p className="text-slate-600">
                      Este registro possui apenas os dados resumidos do portal. Anexe o PDF oficial acima para auditar todas as cláusulas linha por linha.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#14532D]/30 bg-[#14532D]/5 p-6 flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-[#14532D] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-extrabold text-[#14532D]">
                      Edital auditado por completo: nenhuma cláusula restritiva ou irregularidade identificada nos arquivos analisados.
                    </p>
                    <p className="text-xs text-[#14532D]/80">
                      Todas as páginas extraídas foram conferidas quanto a restrições geográficas, exigências de atestado acima de 50%, direcionamento de marca, certificações privadas ilegais e prazos exíguos.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODO 2: CRUZAMENTO DE INTEGRIDADE DE CONCORRENTES (CNPJ) */}
      {modoAtivo === 'integridade' && (
        <div className="space-y-6">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={adicionarCnpj}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#081C3A] bg-white px-3 py-2 text-xs font-bold text-[#081C3A] hover:bg-slate-50 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Adicionar CNPJ
            </button>
            {resultado && (
              <button
                type="button"
                onClick={baixarRelatórioPdf}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#081C3A] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
              >
                <Download className="h-4 w-4 text-[#F97316]" />
                Relatório PDF
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <input
              type="text"
              value={processoRef}
              onChange={(e) => setProcessoRef(e.target.value)}
              placeholder="Processo / Edital e Órgão (opcional, ex: PE 014/2026 - Prefeitura Municipal)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#081C3A]"
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {cnpjs.map((val, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => atualizarCnpj(idx, e.target.value)}
                    placeholder={`CNPJ Empresa ${String.fromCharCode(65 + idx)}`}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#081C3A]"
                  />
                  {cnpjs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerCnpj(idx)}
                      className="rounded-xl border border-slate-200 p-2.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={carregandoIntegridade}
                onClick={executarCruzamento}
                className="inline-flex items-center gap-2 rounded-xl bg-[#EA580C] px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50 cursor-pointer"
              >
                {carregandoIntegridade ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Executar Cruzamento Oficial
              </button>
            </div>
          </div>

          {resultado && (
            <>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'geral', label: 'Visão Geral' },
                  { id: 'cruzamento', label: 'Cruzamento de Dados' },
                  { id: 'indicios', label: 'Indícios' },
                  { id: 'defesa', label: 'Linhas de Defesa' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAbaIntegridade(t.id as any)}
                    className={`rounded-xl px-4 py-2 text-xs font-bold cursor-pointer ${
                      abaIntegridade === t.id
                        ? 'bg-[#081C3A] text-white'
                        : 'border border-slate-200 bg-white text-[#081C3A] hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-bold text-slate-500">Índice de Risco</div>
                  <svg viewBox="0 0 120 70" className="mt-2 h-20 w-32">
                    <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
                    <path
                      d="M 10 60 A 50 50 0 0 1 110 60"
                      fill="none"
                      stroke={corRisco}
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${(indice / 100) * 157} 157`}
                    />
                  </svg>
                  <div className="-mt-2 text-lg font-extrabold" style={{ color: corRisco }}>
                    {resultado.nivelRisco} ({indice}%)
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">Indícios Identificados</div>
                  <div className="mt-3 text-3xl font-extrabold text-[#081C3A]">
                    {resultado.indicios?.length || 0}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">Empresas Relacionadas</div>
                  <div className="mt-3 text-3xl font-extrabold text-[#081C3A]">
                    {resultado.empresas?.length || 0}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">Conexões Detectadas</div>
                  <div className="mt-3 text-3xl font-extrabold text-[#EA580C]">
                    {resultado.conexoes?.length || 0}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">Alertas Elevados</div>
                  <div className="mt-3 text-3xl font-extrabold text-rose-600">
                    {(resultado.indicios || []).filter((i: any) => i.severidade === 'ELEVADO').length}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
                {resultado.avisoLegal}
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {(abaIntegridade === 'geral' || abaIntegridade === 'cruzamento') && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
                      <Database className="h-4 w-4 text-[#0070C0]" /> Cruzamento de Dados Oficiais
                    </h2>
                    <div className="space-y-2.5">
                      {(resultado.fontesConsultadas || []).map((f: any) => (
                        <div key={f.orgao} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                          <div>
                            <div className="font-bold text-[#081C3A]">{f.orgao}</div>
                            <div className="text-slate-500">{f.escopo}</div>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-bold text-emerald-700">
                            {f.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(abaIntegridade === 'geral' || abaIntegridade === 'indicios') && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
                      <AlertTriangle className="h-4 w-4 text-rose-600" /> Principais Indícios
                    </h2>
                    {(resultado.indicios || []).length > 0 ? (
                      <ul className="space-y-2.5 text-xs">
                        {resultado.indicios.map((ind: any, i: number) => (
                          <li key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#081C3A]">{ind.titulo}</span>
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                {ind.severidade}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-600">{ind.detalhe}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Nenhum indício de vínculo societário, endereço em comum ou restrição cadastral encontrado entre os CNPJs informados.
                      </p>
                    )}
                  </div>
                )}

                {(abaIntegridade === 'geral' || abaIntegridade === 'defesa') && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
                      <Scale className="h-4 w-4 text-emerald-600" /> Linhas de Defesa (Sugeridas)
                    </h2>
                    <ul className="space-y-2 text-xs text-slate-700">
                      {(resultado.linhasDefesa || []).map((linha: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{linha}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {abaIntegridade === 'geral' && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
                      <Network className="h-4 w-4 text-[#F97316]" /> Cenário Investigativo (Conexões)
                    </h2>
                    <div className="space-y-3">
                      {(resultado.empresas || []).map((emp: any, i: number) => (
                        <div key={emp.cnpj} className="rounded-xl border border-slate-200 p-3 text-xs">
                          <div className="font-bold text-[#081C3A]">
                            Empresa {String.fromCharCode(65 + i)}: {emp.razaoSocial} ({formatCnpjMask(emp.cnpj)})
                          </div>
                          <div className="mt-1 text-slate-500">
                            QSA: {emp.sócios?.length ? emp.sócios.map((s: any) => s.nome).join(', ') : 'Não informado'}
                          </div>
                          <div className="text-slate-500">TCU: {emp.tcuStatus} | CGU: {emp.cguStatus}</div>
                        </div>
                      ))}
                      {(resultado.conexoes || []).length > 0 && (
                        <div className="rounded-xl bg-orange-50 p-3 text-xs text-orange-900">
                          <strong>Conexões mapeadas:</strong>
                          {resultado.conexoes.map((c: any, idx: number) => (
                            <div key={idx} className="mt-1">
                              {formatCnpjMask(c.origem)} &harr; {formatCnpjMask(c.destino)}: <strong>{c.tipo}</strong> ({c.detalhe})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default NulidadesPage;
