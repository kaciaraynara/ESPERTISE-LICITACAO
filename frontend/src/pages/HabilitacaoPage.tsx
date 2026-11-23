import React, { useState, useEffect, useCallback } from 'react';
import {
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Paperclip,
  Check,
  Sparkles,
  Building2,
  MapPin,
  RefreshCw,
  FolderDown,
  X,
  FileText,
  Eye,
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { habilitacaoApi } from '@/services/api';

export interface ItemDocumento {
  codigo: number;
  etapaNumero: 1 | 2 | 3 | 4;
  etapaNome: string;
  nome: string;
  descricao: string;
  orgaoEmissor: string;
  automatico: boolean;
  linkOficial?: string;
  exigePortalGoverno: boolean;
  situacao: 'PRONTO' | 'VENCE_EM_BREVE' | 'VENCIDO' | 'PENDENTE';
  situacaoTexto: string;
  dataValidade?: string | null;
  diasParaVencer?: number | null;
  arquivoUrl?: string | null;
  arquivoNome?: string | null;
  documentoId?: string | null;
}

export interface DadosHabilitacao {
  empresa: {
    id: string;
    razaoSocial: string;
    cnpj: string;
    cnpjFormatado: string;
    municipio: string;
    uf: string;
  };
  totalDocumentos: number;
  documentosProntos: number;
  documentosVencendo: number;
  documentosVencidos: number;
  documentosPendentes: number;
  percentualConcluido: number;
  itens: ItemDocumento[];
}

export const HabilitacaoPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [dados, setDados] = useState<DadosHabilitacao | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [emitindo, setEmitindo] = useState<boolean>(false);
  const [baixando, setBaixando] = useState<boolean>(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [mensagemAviso, setMensagemAviso] = useState<string | null>(null);

  // Modal para anexar arquivo
  const [itemParaAnexar, setItemParaAnexar] = useState<ItemDocumento | null>(null);
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [dataVencimento, setDataVencimento] = useState<string>('');
  const [salvandoArquivo, setSalvandoArquivo] = useState<boolean>(false);

  // Carrega a situação dos documentos da empresa
  const carregarDocumentos = useCallback(async () => {
    try {
      setCarregando(true);
      const res = await habilitacaoApi.obterStatus(selectedCompany?.id);
      if (res.data?.success && res.data?.data) {
        setDados(res.data.data);
      }
    } catch {
      setMensagemAviso('O portal do governo está instável no momento. Você pode abrir o site oficial pelo botão ao lado e anexar o arquivo manualmente.');
    } finally {
      setCarregando(false);
    }
  }, [selectedCompany?.id]);

  useEffect(() => {
    carregarDocumentos();
  }, [carregarDocumentos]);

  // Limpa mensagens após alguns segundos
  useEffect(() => {
    if (mensagemSucesso) {
      const timer = setTimeout(() => setMensagemSucesso(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [mensagemSucesso]);

  useEffect(() => {
    if (mensagemAviso) {
      const timer = setTimeout(() => setMensagemAviso(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [mensagemAviso]);

  // Botão 1 do topo: "Emitir documentos gratuitos agora"
  const handleEmitirGratuitos = async () => {
    try {
      setEmitindo(true);
      setMensagemSucesso(null);
      setMensagemAviso(null);
      const res = await habilitacaoApi.emitirGratuitos(selectedCompany?.id);
      if (res.data?.success && res.data?.data) {
        setDados(res.data.data);
        setMensagemSucesso('Comprovante do CNPJ e Declarações Obrigatórias foram emitidos e salvos na pasta da sua empresa!');
      }
    } catch {
      setMensagemAviso('O portal do governo está instável no momento. Você pode abrir o site oficial pelo botão ao lado e anexar o arquivo manualmente.');
    } finally {
      setEmitindo(false);
    }
  };

  // Botão 2 do topo: "Baixar pasta completa organizada"
  const handleBaixarPastaCompleta = async () => {
    const prontos = dados?.documentosProntos || 0;
    if (prontos === 0) {
      setMensagemAviso('Anexe ou emita pelo menos um documento antes de baixar a pasta completa.');
      return;
    }

    try {
      setBaixando(true);
      const url = habilitacaoApi.baixarPastaCompletaUrl(selectedCompany?.id);
      window.open(url, '_blank');
      setMensagemSucesso('A pasta completa organizada com seus documentos está sendo transferida para o seu aparelho.');
    } catch {
      setMensagemAviso('Não foi possível gerar a pasta completa no momento. Verifique seus arquivos salvos e tente novamente.');
    } finally {
      setBaixando(false);
    }
  };

  // Botão 1 do cartão: "1. Abrir site oficial" com cópia de CNPJ
  const handleAbrirSiteOficial = (link?: string) => {
    if (!link) return;
    const cnpj = dados?.empresa?.cnpjFormatado || dados?.empresa?.cnpj || selectedCompany?.cnpj || '';
    if (cnpj && navigator.clipboard) {
      navigator.clipboard.writeText(cnpj);
    }
    setMensagemSucesso('Número do CNPJ copiado! Cole no site oficial que abriu, baixe o documento e anexe aqui ao lado.');
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  // Abre janela para anexar documento
  const handleIniciarAnexar = (item: ItemDocumento) => {
    setItemParaAnexar(item);
    setArquivoSelecionado(null);

    // Sugestão de data padrão conforme o tipo de documento
    const hoje = new Date();
    if (item.codigo === 4 || item.codigo === 6 || item.codigo === 7 || item.codigo === 8 || item.codigo === 9) {
      hoje.setDate(hoje.getDate() + 180); // 180 dias para certidões estaduais, federais, etc.
    } else if (item.codigo === 5) {
      hoje.setDate(hoje.getDate() + 30); // 30 dias para FGTS
    } else if (item.codigo === 10) {
      hoje.setFullYear(hoje.getFullYear() + 1); // 1 ano para balanço
    } else {
      hoje.setDate(hoje.getDate() + 90);
    }
    setDataVencimento(hoje.toISOString().split('T')[0]);
  };

  // Salva o documento anexado
  const handleConfirmarAnexo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemParaAnexar || !arquivoSelecionado) {
      setMensagemAviso('Escolha um arquivo do seu aparelho antes de confirmar.');
      return;
    }

    try {
      setSalvandoArquivo(true);
      const res = await habilitacaoApi.anexarDocumento(
        itemParaAnexar.codigo,
        arquivoSelecionado,
        dataVencimento || undefined,
        selectedCompany?.id
      );
      if (res.data?.success && res.data?.data) {
        setDados(res.data.data);
        setMensagemSucesso(`O documento "${itemParaAnexar.nome}" foi anexado com sucesso e está pronto.`);
        setItemParaAnexar(null);
        setArquivoSelecionado(null);
      }
    } catch {
      setMensagemAviso('Não foi possível salvar o arquivo agora. Verifique se é um arquivo PDF e tente novamente.');
    } finally {
      setSalvandoArquivo(false);
    }
  };

  // Agrupamento dos 13 itens nas 4 Etapas da Lei
  const etapas = [
    {
      numero: 1,
      titulo: 'Etapa 1 — Documentos da Empresa (Habilitação Jurídica)',
      descricao: 'Ato constitutivo da empresa, comprovação de inscrição cadastral e identificação dos sócios.',
      itens: (dados?.itens || []).filter((i) => i.etapaNumero === 1),
    },
    {
      numero: 2,
      titulo: 'Etapa 2 — Certidões Negativas (Regularidade Fiscal e Trabalhista)',
      descricao: 'Comprovação de regularidade perante a Fazenda Nacional, Estadual, Municipal, FGTS e Justiça do Trabalho.',
      itens: (dados?.itens || []).filter((i) => i.etapaNumero === 2),
    },
    {
      numero: 3,
      titulo: 'Etapa 3 — Documentos Financeiros (Qualificação Econômico-Financeira)',
      descricao: 'Comprovação de boa situação financeira e inexistência de processos de falência ou recuperação judicial.',
      itens: (dados?.itens || []).filter((i) => i.etapaNumero === 3),
    },
    {
      numero: 4,
      titulo: 'Etapa 4 — Declarações e Atestados (Qualificação Técnica)',
      descricao: 'Declarações obrigatórias da Lei 14.133/2021, idoneidade e capacidade de fornecimento.',
      itens: (dados?.itens || []).filter((i) => i.etapaNumero === 4),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans text-[#0F172A]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">

        {/* =========================================================================
            1. TOPO SIMPLES E DIRETO COM IDENTIFICAÇÃO E AÇÕES PRINCIPAIS
            ========================================================================= */}
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                <FileCheck className="h-4 w-4 text-emerald-600" />
                Conformidade Total com a Lei 14.133/2021
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#0B192C] tracking-tight">
                Documentos de Habilitação (Lei 14.133/2021)
              </h1>
              <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                Deixe todos os documentos da sua empresa prontos e organizados para enviar assim que vencer a licitação.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-slate-700">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 border border-slate-200">
                  <Building2 className="h-4 w-4 text-[#0B192C]" />
                  Empresa: <strong className="text-[#0B192C]">{dados?.empresa?.razaoSocial || selectedCompany?.razaoSocial || 'Empresa Ativa'}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 border border-slate-200">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  Cidade/Estado: <strong className="text-[#0B192C]">{dados?.empresa?.municipio || selectedCompany?.municipio || 'São Paulo'} - {dados?.empresa?.uf || selectedCompany?.uf || 'SP'}</strong>
                </span>
                {dados?.empresa?.cnpjFormatado && (
                  <span className="rounded-lg bg-slate-100 px-3 py-1.5 border border-slate-200 font-mono text-slate-600">
                    CNPJ: {dados.empresa.cnpjFormatado}
                  </span>
                )}
              </div>
            </div>

            {/* DOIS BOTÕES GRANDES E CLAROS */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
              <button
                type="button"
                disabled={emitindo}
                onClick={handleEmitirGratuitos}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0B192C] hover:bg-slate-800 active:scale-98 px-6 py-3.5 text-sm font-extrabold text-white shadow-md transition disabled:opacity-50"
              >
                {emitindo ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
                    <span>Emitindo documentos...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <span>Emitir documentos gratuitos agora</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={baixando}
                onClick={handleBaixarPastaCompleta}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#059669] hover:bg-emerald-700 active:scale-98 px-6 py-3.5 text-sm font-extrabold text-white shadow-md transition disabled:opacity-50"
              >
                {baixando ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Organizando pasta...</span>
                  </>
                ) : (
                  <>
                    <FolderDown className="h-5 w-5" />
                    <span>Baixar pasta completa organizada</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* BARRA DE PROGRESSO VISUAL */}
          <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between text-xs sm:text-sm font-extrabold text-[#0B192C]">
              <span>
                Você já tem <strong className="text-emerald-700">{dados?.documentosProntos || 0} de 13</strong> documentos prontos
              </span>
              <span className="font-mono text-emerald-700">{dados?.percentualConcluido || 0}% pronto</span>
            </div>
            <div className="h-3.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#059669] transition-all duration-700 ease-out"
                style={{ width: `${dados?.percentualConcluido || 0}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                {dados?.documentosProntos || 0} Prontos
              </span>
              {(dados?.documentosVencendo || 0) > 0 && (
                <span className="inline-flex items-center gap-1.5 text-amber-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                  {dados?.documentosVencendo} Vencendo em breve
                </span>
              )}
              {(dados?.documentosVencidos || 0) > 0 && (
                <span className="inline-flex items-center gap-1.5 text-red-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  {dados?.documentosVencidos} Vencidos
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                {dados?.documentosPendentes || 0} Pendentes
              </span>
            </div>
          </div>
        </header>

        {/* MENSAGENS AMIGÁVEIS E EDUCATIVAS */}
        {mensagemSucesso && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-bold text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Check className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{mensagemSucesso}</span>
            </div>
            <button type="button" onClick={() => setMensagemSucesso(null)} className="text-emerald-700 hover:text-emerald-900 p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {mensagemAviso && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900 flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <span>{mensagemAviso}</span>
            </div>
            <button type="button" onClick={() => setMensagemAviso(null)} className="text-amber-700 hover:text-amber-900 p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* CARREGAMENTO INICIAL */}
        {carregando && !dados && (
          <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center shadow-sm space-y-3">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
            <h3 className="text-base font-extrabold text-[#0B192C]">Organizando os documentos da sua empresa...</h3>
            <p className="text-xs text-slate-500">Verificando certidões e comprovantes obrigatórios</p>
          </div>
        )}

        {/* =========================================================================
            2. LISTA ORGANIZADA NA ORDEM DA LEI (4 ETAPAS CLARAS COM 13 DOCUMENTOS)
            ========================================================================= */}
        {dados && (
          <main className="space-y-8">
            {etapas.map((etapa) => (
              <section key={etapa.numero} className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-slate-200 pb-2">
                  <h2 className="text-base sm:text-lg font-black text-[#0B192C]">
                    {etapa.titulo}
                  </h2>
                  <span className="text-xs text-slate-500 font-medium">
                    {etapa.descricao}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {etapa.itens.map((item) => {
                    const isPronto = item.situacao === 'PRONTO';
                    const isVencendo = item.situacao === 'VENCE_EM_BREVE';
                    const isVencido = item.situacao === 'VENCIDO';

                    return (
                      <article
                        key={item.codigo}
                        className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition shadow-xs hover:shadow-md ${
                          isPronto
                            ? 'bg-white border-emerald-200'
                            : isVencendo
                            ? 'bg-amber-50/40 border-amber-300'
                            : isVencido
                            ? 'bg-red-50/40 border-red-300'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Topo do Cartão: Número e Situação */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#0B192C] text-xs font-black text-white">
                              {item.codigo}
                            </span>

                            {/* Situação em Português Claro */}
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                                isPronto
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isVencendo
                                  ? 'bg-amber-100 text-amber-800'
                                  : isVencido
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isPronto && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                              {isVencendo && <Clock className="h-3.5 w-3.5 text-amber-600" />}
                              {isVencido && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
                              {item.situacaoTexto}
                            </span>
                          </div>

                          {/* Nome e Descrição */}
                          <div>
                            <h3 className="text-sm font-black text-[#0B192C] leading-snug">
                              {item.nome}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                              {item.descricao}
                            </p>
                          </div>

                          <div className="text-[11px] font-semibold text-slate-500 pt-1 border-t border-slate-100">
                            Órgão: <span className="text-slate-700">{item.orgaoEmissor}</span>
                          </div>
                        </div>

                        {/* =========================================================
                            AÇÕES DO CARTÃO (PASSO A PASSO EM 2 CLIQUES)
                            ========================================================= */}
                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                          {/* Se for certidão ou documento que exige o portal do governo */}
                          {item.exigePortalGoverno && item.linkOficial && (
                            <div className="grid grid-cols-2 gap-2">
                              {/* Botão 1: "1. Abrir site oficial" */}
                              <button
                                type="button"
                                onClick={() => handleAbrirSiteOficial(item.linkOficial)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-2.5 py-2 text-xs font-bold text-[#0B192C] transition shadow-2xs"
                                title="Copia o CNPJ da empresa e abre o site do órgão público"
                              >
                                <span>1. Abrir site oficial</span>
                                <ExternalLink className="h-3 w-3 text-slate-400" />
                              </button>

                              {/* Botão 2: "2. Anexar documento" */}
                              <button
                                type="button"
                                onClick={() => handleIniciarAnexar(item)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0B192C] hover:bg-slate-800 text-white px-2.5 py-2 text-xs font-bold transition shadow-xs"
                              >
                                <Paperclip className="h-3.5 w-3.5 text-amber-400" />
                                <span>2. Anexar documento</span>
                              </button>
                            </div>
                          )}

                          {/* Se for documento de envio direto (Contrato Social, Identidade, Balanço, Atestados) */}
                          {!item.exigePortalGoverno && !item.automatico && (
                            <button
                              type="button"
                              onClick={() => handleIniciarAnexar(item)}
                              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0B192C] hover:bg-slate-800 text-white px-3 py-2 text-xs font-bold transition shadow-xs"
                            >
                              <Paperclip className="h-3.5 w-3.5 text-amber-400" />
                              <span>{isPronto ? 'Substituir arquivo' : 'Anexar documento'}</span>
                            </button>
                          )}

                          {/* Se for documento automático emitido pelo sistema (CNPJ e Declarações) */}
                          {item.automatico && (
                            <div className="flex gap-2">
                              {item.arquivoUrl ? (
                                <a
                                  href={item.arquivoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-xs font-bold transition shadow-xs"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>Visualizar documento</span>
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleEmitirGratuitos}
                                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0B192C] hover:bg-slate-800 text-white px-3 py-2 text-xs font-bold transition shadow-xs"
                                >
                                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                  <span>Emitir agora pelo sistema</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Botão extra de visualização caso já tenha arquivo salvo */}
                          {item.arquivoUrl && !item.automatico && (
                            <div className="flex items-center justify-between text-[11px] pt-1">
                              <span className="text-slate-500 truncate max-w-[150px]">
                                {item.arquivoNome || 'Arquivo salvo'}
                              </span>
                              <a
                                href={item.arquivoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                              >
                                Visualizar
                              </a>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </main>
        )}

        {/* =========================================================================
            MODAL LIMPO PARA ANEXAR ARQUIVO (SEM TERMOS TÉCNICOS)
            ========================================================================= */}
        {itemParaAnexar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[11px] font-bold text-emerald-700 uppercase">
                    Item #{itemParaAnexar.codigo} • {itemParaAnexar.etapaNome.split('—')[0].trim()}
                  </span>
                  <h3 className="text-lg font-black text-[#0B192C]">
                    Anexar {itemParaAnexar.nome}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setItemParaAnexar(null)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmarAnexo} className="space-y-4">
                {/* Seletor de Arquivo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0B192C] block">
                    Escolha o arquivo no seu aparelho (PDF):
                  </label>
                  <div className="relative rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-emerald-500 transition bg-slate-50">
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      required
                      onChange={(e) => setArquivoSelecionado(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-1">
                      <FileText className="mx-auto h-8 w-8 text-slate-400" />
                      <p className="text-xs font-bold text-[#0B192C]">
                        {arquivoSelecionado ? arquivoSelecionado.name : 'Clique aqui para escolher o arquivo'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {arquivoSelecionado ? `${(arquivoSelecionado.size / 1024).toFixed(0)} KB` : 'Formato PDF (tamanho máximo de 10 MB)'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pergunta clara sobre data de vencimento */}
                <div className="space-y-1.5">
                  <label htmlFor="data-vencimento-input" className="text-xs font-bold text-[#0B192C] block">
                    Qual a data de vencimento que está escrita no documento?
                  </label>
                  <input
                    id="data-vencimento-input"
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-[#0B192C] outline-none focus:border-emerald-600"
                  />
                  <p className="text-[11px] text-slate-500">
                    Já sugerimos uma data padrão com base na validade comum deste tipo de certidão. Você pode ajustar se necessário.
                  </p>
                </div>

                {/* Botões do Formulário */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setItemParaAnexar(null)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoArquivo || !arquivoSelecionado}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#059669] hover:bg-emerald-700 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition disabled:opacity-50"
                  >
                    {salvandoArquivo ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Salvando documento...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Salvar documento na pasta</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HabilitacaoPage;
