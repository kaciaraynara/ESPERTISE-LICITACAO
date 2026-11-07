import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import {
  FilePdf,
  UploadSimple,
  Scales,
  Brain,
  Check,
  Copy,
  DownloadSimple,
  ArrowCounterClockwise,
  WarningCircle,
  FileText,
  BookOpen,
  SpinnerGap,
} from '@phosphor-icons/react';

import { useAuthStore } from '@/store/auth.store';
import { useCompany } from '@/contexts/CompanyContext';
import { contenciosoService } from '@/services/contencioso.service';
import { AnalyzeRivalResult } from '@/types/lex-contencioso.types';

export default function ContenciosoHubPage() {
  const { user } = useAuthStore();
  const { selectedCompany } = useCompany();

  // Estados do Formulário de Upload
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pregaoNumero, setPregaoNumero] = useState('Pregão Eletrônico nº 142/2026');
  const [nomeEmpresa, setNomeEmpresa] = useState(
    selectedCompany?.razaoSocial || user?.nome || 'Nossa Empresa Licitante'
  );
  const [objetoLicitacao, setObjetoLicitacao] = useState('');

  // Estados de Execução e Loading
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Resultado da IA
  const [result, setResult] = useState<AnalyzeRivalResult | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Manipulação de Arquivo (Drag and Drop / Input)
  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.endsWith('.pdf')) {
      toast.error('Formato inválido. Por favor, envie exclusivamente arquivos PDF.');
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      toast.error('Arquivo muito grande. O limite máximo permitido é 15MB.');
      return;
    }

    setFile(selectedFile);
    setErrorMsg(null);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Submissão do Arquivo para a IA
  const handleSubmit = async () => {
    if (!file) {
      toast.error('Selecione ou arraste o arquivo PDF do recurso.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setLoadingStep(1);

    // Efeito visual de passos de processamento
    const stepTimer1 = setTimeout(() => setLoadingStep(2), 2500);
    const stepTimer2 = setTimeout(() => setLoadingStep(3), 6000);

    try {
      const data = await contenciosoService.analyzeRival({
        file,
        pregaoNumero: pregaoNumero.trim() || undefined,
        nomeNossaEmpresa: nomeEmpresa.trim() || undefined,
        objetoLicitacao: objetoLicitacao.trim() || undefined,
      });

      setResult(data);
      toast.success('Contrarrazões recursais geradas com sucesso pelo Lex!');
    } catch (err: any) {
      console.error('[ContenciosoHub] Erro:', err);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Não foi possível analisar o recurso concorrente no momento.';
      setErrorMsg(message);
      toast.error(message);
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setIsLoading(false);
    }
  };

  // Ações no Resultado
  const handleCopy = () => {
    if (!result) return;
    void navigator.clipboard.writeText(result.contrarazaoMarkdown);
    setHasCopied(true);
    toast.success('Contrarrazões copiadas para a área de transferência!');
    setTimeout(() => setHasCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result.contrarazaoMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Contrarrazoes_${pregaoNumero.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo baixado com sucesso!');
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-8 sm:py-8 bg-slate-50 min-h-screen font-sans">
      {/* Header Executivo */}
      <header className="mb-8 border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-100 text-[#0A2540] border border-blue-200">
                <Scales className="h-3.5 w-3.5 text-[#EA580C]" weight="bold" />
                Central de Defesas e Recursos
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0A2540]">
              Analisador de Recursos Concorrentes & Contrarrazões
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5">
              Envie a peça recursal do concorrente para extração, confronto com a jurisprudência do TCU e redação de defesa combativa sob a Lei 14.133/2021.
            </p>
          </div>

          {result && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
            >
              <ArrowCounterClockwise className="h-4 w-4" weight="bold" />
              Analisar Outro Recurso
            </button>
          )}
        </div>
      </header>

      {/* Alerta de Erro */}
      {errorMsg && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3 shadow-xs">
          <WarningCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" weight="fill" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-rose-900 uppercase">Falha na Análise</h4>
            <p className="text-xs text-rose-700 font-medium mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* ESTADO 1: FORMULÁRIO DE UPLOAD E DROPZONE (QUANDO NÃO HÁ RESULTADO) */}
      {!result && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Coluna da Esquerda: Dropzone e Configurações (7 colunas) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-wider text-[#0A2540] mb-4 flex items-center gap-2">
                <FilePdf className="h-5 w-5 text-red-600" weight="fill" />
                Upload do Recurso Concorrente (PDF)
              </h2>

              {/* Área Dropzone */}
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-[#EA580C] bg-orange-50/50 scale-[1.01]'
                    : file
                    ? 'border-emerald-400 bg-emerald-50/20'
                    : 'border-slate-300 bg-slate-50/60 hover:border-[#EA580C] hover:bg-orange-50/10'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={onFileInputChange}
                  className="hidden"
                />

                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-inner">
                      <FilePdf className="h-8 w-8" weight="fill" />
                    </div>
                    <span className="text-sm font-black text-slate-800 mt-2 max-w-md truncate">
                      {file.name}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB · Arquivo pronto para análise
                    </span>
                    <span className="text-[11px] font-bold text-[#EA580C] underline mt-1">
                      Clique para trocar de arquivo
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 border border-slate-200 shadow-xs group-hover:scale-105 group-hover:text-[#EA580C] group-hover:border-orange-200 transition">
                      <UploadSimple className="h-7 w-7" weight="bold" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 mt-2">
                      Arraste e solte o PDF do recurso aqui, ou{' '}
                      <span className="text-[#EA580C] underline">procure no seu dispositivo</span>
                    </p>
                    <p className="text-xs text-slate-400 font-medium">
                      Suporte a peças recursais em PDF pesquisável de até 15MB
                    </p>
                  </div>
                )}
              </div>

              {/* Metadados da Disputa */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número do Processo / Pregão
                  </label>
                  <input
                    type="text"
                    value={pregaoNumero}
                    onChange={(e) => setPregaoNumero(e.target.value)}
                    placeholder="Ex: Pregão Eletrônico nº 142/2026"
                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome da Nossa Empresa (Recorrida)
                  </label>
                  <input
                    type="text"
                    value={nomeEmpresa}
                    onChange={(e) => setNomeEmpresa(e.target.value)}
                    placeholder="Razão Social ou Nome Fantasia"
                    className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540]"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Objeto da Licitação (Opcional)
                </label>
                <input
                  type="text"
                  value={objetoLicitacao}
                  onChange={(e) => setObjetoLicitacao(e.target.value)}
                  placeholder="Ex: Aquisição de equipamentos hospitalares e correlatos..."
                  className="w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#0A2540] focus:ring-1 focus:ring-[#0A2540]"
                />
              </div>

              {/* Botão de Disparo */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!file || isLoading}
                className="mt-6 w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#EA580C] to-orange-600 py-3.5 px-6 text-xs font-black uppercase tracking-wider text-white shadow-md hover:from-orange-600 hover:to-orange-700 transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <SpinnerGap className="h-4 w-4 animate-spin" />
                    Processando com Lex AI...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" weight="fill" />
                    Analisar Recurso & Gerar Contrarrazões
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Coluna da Direita: Orientações e Guardrails Jurídicos (5 colunas) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0A2540] mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#EA580C]" weight="bold" />
                Como opera a Inteligência Jurídica
              </h3>

              <div className="space-y-4 text-xs font-medium text-slate-600 leading-relaxed">
                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-black text-[#EA580C]">
                    1
                  </div>
                  <p>
                    <strong className="text-slate-800">Parser Nativo:</strong> O arquivo PDF é desconstruído em texto estruturado com extração de preliminares e mérito.
                  </p>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-black text-blue-800">
                    2
                  </div>
                  <p>
                    <strong className="text-slate-800">RAG Vetorial com pgvector:</strong> O motor consulta artigos da Lei 14.133/2021 e jurisprudências do TCU mais aderentes às teses do concorrente.
                  </p>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-black text-emerald-800">
                    3
                  </div>
                  <p>
                    <strong className="text-slate-800">Redação Combate (GPT-4o):</strong> Elabora a minuta oficial de Contrarrazões pronta para protocolo perante o Agente de Contratação.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 block mb-1">
                  Prazo Legal de Contrarrazões
                </span>
                <p className="text-xs font-semibold text-blue-800">
                  Sob o Art. 165, § 1º, alínea "b" da Lei 14.133/2021, o prazo para apresentação de contrarrazões é de <strong>3 (três) dias úteis</strong> após a intimação.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ESTADO 2: SKELETON LOADER ANIMADO DURANTE O PROCESSAMENTO */}
      {isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-[#EA580C] shadow-inner mb-6">
            <SpinnerGap className="h-8 w-8 animate-spin" />
          </div>

          <h3 className="text-lg font-black text-[#0A2540]">
            Analisando Recurso do Concorrente com o Lex
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1 max-w-md mx-auto">
            Por favor, aguarde alguns instantes enquanto a inteligência jurídica processa a peça e consulta o acervo do TCU.
          </p>

          {/* Stepper Visual de Loading */}
          <div className="mt-8 max-w-xl mx-auto space-y-3 text-left">
            <div
              className={`flex items-center gap-3 rounded-xl p-3 border transition ${
                loadingStep >= 1
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-400'
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                  loadingStep >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                {loadingStep > 1 ? '✓' : '1'}
              </div>
              <span className="text-xs">Extraindo texto e teses do arquivo PDF...</span>
            </div>

            <div
              className={`flex items-center gap-3 rounded-xl p-3 border transition ${
                loadingStep >= 2
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-400'
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                  loadingStep >= 2 ? (loadingStep > 2 ? '✓' : '2') : '2'
                }`}
              >
                {loadingStep > 2 ? '✓' : '2'}
              </div>
              <span className="text-xs">
                Buscando jurisprudência no pgvector (BaseJuridicaKnowledge / TCU)...
              </span>
            </div>

            <div
              className={`flex items-center gap-3 rounded-xl p-3 border transition ${
                loadingStep >= 3
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 font-bold'
                  : 'border-slate-200 bg-slate-50 text-slate-400'
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                  loadingStep >= 3 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                3
              </div>
              <span className="text-xs">Redigindo Contrarrazões com o GPT-4o...</span>
            </div>
          </div>
        </div>
      )}

      {/* ESTADO 3: RENDERIZAÇÃO DO RESULTADO COM MARKDOWN E CITAÇÕES MAPEADAS */}
      {result && !isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Coluna Principal: Peça das Contrarrazões em Markdown (8 colunas) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#EA580C]">
                    Minuta Jurídica Oficial
                  </span>
                  <h2 className="text-lg font-black text-[#0A2540]">
                    Contrarrazões ao Recurso Administrativo
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-xs"
                  >
                    {hasCopied ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-600" weight="bold" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" weight="bold" />
                        Copiar Peça
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0A2540] px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
                  >
                    <DownloadSimple className="h-4 w-4" weight="bold" />
                    Baixar (.md)
                  </button>
                </div>
              </div>

              {/* Renderização em Markdown da Peça */}
              <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-800 leading-relaxed font-sans">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => (
                      <h2 className="text-base sm:text-lg font-black text-[#0A2540] mt-6 mb-3 border-b border-slate-100 pb-1">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-sm sm:text-base font-black text-[#0A2540] mt-4 mb-2">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-[#EA580C] bg-orange-50/40 p-3 italic my-3 text-slate-700 rounded-r-lg">
                        {children}
                      </blockquote>
                    ),
                    ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-5 my-2 space-y-1 font-bold">{children}</ol>
                    ),
                    strong: ({ children }) => <strong className="font-black text-slate-900">{children}</strong>,
                  }}
                >
                  {result.contrarazaoMarkdown}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          {/* Coluna Lateral: Citações Mapeadas do pgvector & Teses (4 colunas) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Box de Citações da Base Jurídica */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0A2540] mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#EA580C]" weight="bold" />
                Fundamentações Legais Mapeadas (pgvector)
              </h3>

              <div className="space-y-3.5">
                {result.citacoesMapeadas.map((citacao, idx) => (
                  <div
                    key={citacao.id || idx}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 hover:border-orange-200 transition"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="rounded bg-orange-100 px-2 py-0.5 text-[9px] font-black uppercase text-[#EA580C]">
                        {citacao.autoridade}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {citacao.artigoOuNorma}
                      </span>
                    </div>

                    <p className="text-[11px] font-bold text-slate-800 leading-snug">
                      "{citacao.ementaOuTeor}"
                    </p>

                    <p className="mt-2 text-[10px] text-slate-500 italic border-t border-slate-200/60 pt-1.5">
                      🎯 <strong className="text-slate-700 not-italic">Aplicação:</strong>{' '}
                      {citacao.aplicabilidadeContrarrazao}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pontos-Chave de Refutação */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#0A2540] mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" weight="bold" />
                Refutação Sintética das Alegações
              </h3>

              <div className="space-y-3">
                {result.pontosChaveRefutados.map((ponto, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <span className="text-[10px] font-bold text-red-600 block mb-0.5">
                      ❌ Alegação Concorrente:
                    </span>
                    <p className="text-xs font-bold text-slate-800">{ponto.alegacaoAdversaria}</p>

                    <span className="text-[10px] font-bold text-emerald-700 block mt-2 mb-0.5">
                      🛡️ Defesa Legal:
                    </span>
                    <p className="text-[11px] font-medium text-slate-600">{ponto.fundamentoDefesa}</p>
                    <span className="mt-1 inline-block text-[9px] font-bold text-slate-400">
                      Dispositivo: {ponto.dispositivoLegal}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Metadados da Geração */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-[11px] text-slate-500 space-y-1.5">
              <div className="flex justify-between">
                <span>Modelo de IA:</span>
                <strong className="text-slate-800">{result.metadadosProcessamento.modeloUtilizado}</strong>
              </div>
              <div className="flex justify-between">
                <span>Páginas Analisadas:</span>
                <strong className="text-slate-800">{result.metadadosProcessamento.totalPaginas}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tempo de Processamento:</span>
                <strong className="text-slate-800">{result.metadadosProcessamento.tempoProcessamentoSegundos}s</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

