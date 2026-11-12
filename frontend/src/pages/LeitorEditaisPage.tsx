import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
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
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FORNECEDOR_ROUTES } from '@/routes';
import { streamAiChat } from '@/services/aiStream.service';
import { EditalSelector, EditalOption } from '@/components/EditalSelector';
import { noticesApi } from '@/services/api';
import { formatPncpDateBR, formatCnpj } from '@/utils/pncp';

function formatBRL(valor?: number | null): string {
  if (valor === undefined || valor === null || !Number.isFinite(Number(valor)) || Number(valor) <= 0) {
    return 'Sigiloso / Ver TR';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor));
}

export const LeitorEditaisPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlEditalId = searchParams.get('edital') || '';

  const [selectedEditalId, setSelectedEditalId] = useState<string>(urlEditalId);
  const [selectedEditalData, setSelectedEditalData] = useState<any>(null);
  const [carregandoEdital, setCarregandoEdital] = useState(false);

  const [editalTexto, setEditalTexto] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [resultadoStreaming, setResultadoStreaming] = useState('');
  const [analiseConcluida, setAnaliseConcluida] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [abaDossie, setAbaDossie] = useState<'visao' | 'itens' | 'habilitacao' | 'roteiro'>('visao');

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
      return;
    }

    let active = true;
    setCarregandoEdital(true);

    Promise.allSettled([
      noticesApi.getBasicSummary(selectedEditalId),
      noticesApi.getById(selectedEditalId),
    ])
      .then(([basicRes, detailRes]) => {
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

        if (mergedData) {
          setSelectedEditalData(mergedData);

          // Se a caixa de texto estiver vazia, preenche automaticamente com o objeto e dados reais
          if (!editalTexto.trim()) {
            const numEd = mergedData.dossier?.fichaTecnica?.numeroEdital || mergedData.noticeNumber || mergedData.externalId || selectedEditalId;
            const org = mergedData.dossier?.fichaTecnica?.razaoSocial || mergedData.buyerName || 'Órgão Licitante';
            const mod = mergedData.dossier?.fichaTecnica?.modalidade || mergedData.modality || 'Pregão Eletrônico';
            const obj = mergedData.dossier?.descricaoExplicativaObjeto?.objetoIntegral || mergedData.object || '';
            const val = formatBRL(mergedData.dossier?.fichaTecnica?.valorGlobalEstimado || mergedData.estimatedValue);
            const pub = mergedData.dossier?.cronogramaPrazosFatais?.publicacao ? formatPncpDateBR(mergedData.dossier.cronogramaPrazosFatais.publicacao, false) : 'Não informada';
            const aber = mergedData.dossier?.cronogramaPrazosFatais?.aberturaSessaoPublica ? formatPncpDateBR(mergedData.dossier.cronogramaPrazosFatais.aberturaSessaoPublica, true) : 'Não informada';
            const imp = mergedData.dossier?.cronogramaPrazosFatais?.prazoLimiteImpugnacao ? formatPncpDateBR(mergedData.dossier.cronogramaPrazosFatais.prazoLimiteImpugnacao, true) : 'Até 3 dias úteis antes da abertura (Art. 164 da Lei 14.133/21)';

            const itensPreview = Array.isArray(mergedData.dossier?.quadroItensDetalhado) && mergedData.dossier.quadroItensDetalhado.length > 0
              ? '\nITENS DA CONTRATAÇÃO:\n' + mergedData.dossier.quadroItensDetalhado.slice(0, 10).map((it: any) => `- Item ${it.numeroItem}: ${it.descricaoCompleta} | Qtd: ${it.quantidade} ${it.unidadeMedida} | Valor Est.: ${formatBRL(it.valorTotalEstimado)}`).join('\n')
              : '';

            const textoAuto = `EDITAL Nº ${numEd}
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
- Qualificação Econômico-Financeira: Balanço patrimonial, índices contábeis (LG, SG, LC >= 1,0) e Certidão de Falência.
- Qualificação Técnica: Atestados de Capacidade Técnica (CAT) compatíveis com o objeto.`;

            setEditalTexto(textoAuto);
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
    setSearchParams({ edital: edital.id });
    toast.success(`Edital nº ${edital.numeroEdital || edital.id} selecionado para leitura!`);
  };

  // Exemplo pré-carregável para teste imediato de demonstração real
  const carregarExemploEdital = () => {
    setEditalTexto(`PREGÃO ELETRÔNICO Nº 45/2026 - UASG 153052
ÓRGÃO: UNIVERSIDADE FEDERAL DE MINAS GERAIS - UFMG
OBJETO: Contratação de serviços de tecnologia da informação, sustentação de infraestrutura em nuvem e suporte técnico especializado sob demanda.
REGIME LEGAL: Lei Federal nº 14.133/2021 e Decreto nº 11.462/2023.
CRITÉRIO DE JULGAMENTO: Menor Preço Global.
VALOR ESTIMADO TOTAL: R$ 4.850.000,00.
DATA DA SESSÃO PÚBLICA: 18 de Novembro de 2026, às 10h00 (horário de Brasília).
PRAZO LIMITE PARA IMPUGNAÇÃO: Até 3 (três) dias úteis anteriores à abertura da sessão (Art. 164 da Lei 14.133/21).

DA HABILITAÇÃO TÉCNICA:
1. Comprovação de aptidão para desempenho de atividade pertinente e compatível em características, quantidades e prazos com o objeto da licitação, mediante atestados de capacidade técnica emitidos por pessoas jurídicas de direito público ou privado.
2. Certificação ISO 27001 e CMMI nível 3 obrigatória no momento da entrega das propostas. (ALERTA: Cláusula restritiva segundo jurisprudência consolidada do TCU - Acórdão 1214/2013-Plenário).

DA QUALIFICAÇÃO ECONÔMICO-FINANCEIRA:
1. Balanço patrimonial e demonstrações contábeis do último exercício social.
2. Índices de Liquidez Geral (LG), Solvência Geral (SG) e Liquidez Corrente (LC) superiores a 1,0.
3. Certidão Negativa de Falência e Recuperação Judicial expedida pelo distribuidor da sede da pessoa jurídica.`);
    toast.success('Edital de demonstração carregado com sucesso!');
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
      const prompt = `Você é o LEX, assistente especialista e consultor jurídico sênior em licitações públicas sob a Lei 14.133/2021.
Analise criteriosamente o seguinte edital e estruture um relatório de auditoria e conformidade completo:

1. DADOS FUNDAMENTAIS & ENQUADRAMENTO: Órgão, Modalidade, Modo de Disputa, Critério de Julgamento, Regime Legal.
2. CRONOGRAMA & PRAZOS FATAIS: Data da Sessão, Prazo Limite para Impugnação e Pedido de Esclarecimento (Art. 164 da Lei 14.133/21 - 3 dias úteis anteriores).
3. AUDITORIA DE CLÁUSULAS RESTRITIVAS / ABUSIVAS: Aponte com precisão exigências que podem violar o princípio da ampla competitividade (ex: exigência de certidões além do Art. 68, certificações dispensáveis antes da assinatura do contrato, atestados restritivos segundo Súmulas e Acórdãos do TCU).
4. REQUISITOS DE HABILITAÇÃO: Jurídica, Fiscal/Trabalhista, Econômico-Financeira e Técnica.
5. CHECKLIST DE CONFORMIDADE PARA O LICITANTE: Relação dos documentos obrigatórios indispensáveis para não sofrer inabilitação.
6. DIRETRIZES PARA A PROPOSTA & PRECIFICAÇÃO: Recomendações estratégicas de preço, prazos de validade e stop-loss.

TEXTO DO EDITAL / DOCUMENTO:
${editalTexto.slice(0, 12000)}`;

      await streamAiChat({
        pergunta: prompt,
        noticeId: selectedEditalId || undefined,
        providedDocumentText: editalTexto,
        onChunk: (chunk: string) => {
          setResultadoStreaming((prev) => prev + chunk);
        },
        onError: () => {
          toast.error('Não foi possível analisar o edital. Tente novamente.');
        },
      });

      setAnaliseConcluida(true);
      toast.success('Auditoria do edital concluída com sucesso!');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao conectar com o motor de inteligência artificial.');
    } finally {
      setAnalisando(false);
    }
  };

  const copiarRelatorio = () => {
    if (!resultadoStreaming) return;
    navigator.clipboard.writeText(resultadoStreaming);
    setCopiado(true);
    toast.success('Dossiê do edital copiado para a área de transferência!');
    setTimeout(() => setCopiado(false), 3000);
  };

  const dossier = selectedEditalData?.dossier;
  const ficha = dossier?.fichaTecnica;
  const crono = dossier?.cronogramaPrazosFatais;
  const itens = dossier?.quadroItensDetalhado || selectedEditalData?.items || [];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* CABEÇALHO DA PÁGINA */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-[#0A2540] text-white rounded-xl shadow-md">
                <FileText size={24} />
              </span>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Leitor Inteligente de Editais
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Lei 14.133/21
                  </span>
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Selecione um edital cadastrado ou cole o texto para auditar cláusulas, prazos e gerar o dossiê executivo.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={carregarExemploEdital}
              className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all shadow-2xs"
            >
              Carregar Exemplo Real
            </button>
            <Link
              to={FORNECEDOR_ROUTES.radar}
              className="px-4 py-2 rounded-xl bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all"
            >
              Buscar no Radar de Editais
              <ArrowRight size={14} />
            </Link>
          </div>
        </header>

        {/* SELETOR DE EDITAL CADASTRADO NO TOPO */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                Etapa 1: Carregamento do Certame
              </span>
              <h2 className="text-sm font-bold text-slate-900">
                Selecione um edital para sincronizar os dados oficiais e o Dossiê Executivo
              </h2>
            </div>
            {carregandoEdital && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-blue">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Sincronizando dados oficiais do PNCP…
              </span>
            )}
          </div>

          <EditalSelector
            selectedId={selectedEditalId}
            onSelectEdital={handleSelectEdital}
            label="Escolha um edital monitorado ou salvo para disputar:"
          />
        </div>

        {/* DOSSIÊ ESTRUTURADO COMPLETO (SUBSTITUI OS 4 CARDS DECORATIVOS ESTÁTICOS) */}
        {selectedEditalData && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
            {/* CABEÇALHO DO DOSSIÊ ESTRUTURADO */}
            <div className="p-5 bg-gradient-to-r from-slate-50 via-white to-blue-50/20 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-brand-blue border border-brand-blue/20 flex items-center gap-1">
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
                  <span>Valor Estimado: <strong className="text-brand-blue font-bold">{ficha?.valorGlobalFormatado || formatBRL(selectedEditalData.estimatedValue)}</strong></span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href={`/precificacao?edital=${selectedEditalId}`}
                  className="px-3 py-1.5 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
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
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
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
                    ? 'border-brand-blue text-brand-blue bg-white font-black'
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
                    ? 'border-brand-blue text-brand-blue bg-white font-black'
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
                    ? 'border-brand-blue text-brand-blue bg-white font-black'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Habilitação Lei 14.133</span>
              </button>

              <button
                type="button"
                onClick={() => setAbaDossie('roteiro')}
                className={`py-2.5 px-3 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${abaDossie === 'roteiro'
                    ? 'border-brand-blue text-brand-blue bg-white font-black'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Roteiro de Disputa (7 Etapas)</span>
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
                        {crono?.prazoLimiteImpugnacao ? formatPncpDateBR(crono.prazoLimiteImpugnacao, true) : '3 dias úteis antes da abertura'}
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
                              <td className="py-2 px-3 text-right font-bold text-brand-blue">{formatBRL(it.valorTotalEstimado ?? it.estimatedTotalValue)}</td>
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
                      Contrato Social em vigor, registro comercial, prova de inscrição no CNPJ e procuração do representante.
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                      Regularidade Fiscal & Trabalhista (Art. 68)
                    </span>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      CND Federal (Receita/PGFN), Certidão do FGTS (CRF), CNDT (Justiça do Trabalho), CND Estadual e Municipal.
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                      Qualificação Econômico-Financeira (Art. 69)
                    </span>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Balanço Patrimonial do último exercício, Índices contábeis (LG, SG, LC &gt;= 1,0) e Certidão de Falência.
                    </p>
                  </div>
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-black text-slate-900 uppercase tracking-wider text-[11px] block">
                      Qualificação Técnica (Art. 67)
                    </span>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Atestado(s) de Capacidade Técnica (CAT) compatíveis com o objeto e registro em conselho profissional (quando exigido).
                    </p>
                  </div>
                </div>
              )}

              {abaDossie === 'roteiro' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { tit: '1. Diagnóstico', desc: 'Auditar cláusulas e restrições.', link: `/leitor-editais?edital=${selectedEditalId}` },
                    { tit: '2. Documentos', desc: 'Conferir 5 certidões no cofre.', link: '/cofre' },
                    { tit: '3. Impugnação', desc: 'Protocolar até 3 dias antes.', link: `/impugnacao?edital=${selectedEditalId}` },
                    { tit: '4. Precificação', desc: 'Simular Stop-Loss e custos.', link: `/precificacao?edital=${selectedEditalId}` },
                    { tit: '5. Proposta', desc: 'Gerar PDF com declarações.', link: `/propostas/criar?edital=${selectedEditalId}` },
                    { tit: '6. Envio', desc: 'Cadastrar no portal oficial.', link: ficha?.linkOficialPncp || '#' },
                    { tit: '7. Disputa', desc: 'Monitorar lances e recursos.', link: `/disputa?edital=${selectedEditalId}` },
                  ].map((passo, idx) => (
                    <a
                      key={idx}
                      href={passo.link}
                      className="p-3 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-brand-blue rounded-xl transition-all block group"
                    >
                      <span className="font-bold text-slate-900 block group-hover:text-brand-blue">{passo.tit}</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">{passo.desc}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ÁREA DE AUDITORIA DE CLÁUSULAS (STREAMING AI + INPUT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* PAINEL ESQUERDO: INPUT */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <form onSubmit={handleAnalisar} className="space-y-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <label className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <UploadCloud size={18} className="text-[#EA580C]" />
                  Texto ou Cláusulas do Edital
                </label>
                <span className="text-xs font-bold text-slate-400">
                  {editalTexto.length} caracteres
                </span>
              </div>

              <textarea
                value={editalTexto}
                onChange={(e) => setEditalTexto(e.target.value)}
                placeholder="Cole aqui o texto completo ou trechos do edital, termo de referência ou exigências de habilitação..."
                className="w-full flex-1 min-h-[380px] p-4 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C] text-slate-800 leading-relaxed resize-none"
              />

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={analisando || !editalTexto.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-[#EA580C] hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  {analisando ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Analisando Cláusulas do Edital...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      Auditar Cláusulas com IA
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* PAINEL DIREITO: RESULTADO STREAMING */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${analisando ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                <h3 className="font-black text-slate-900 text-sm">
                  Relatório de Auditoria e Conformidade Legal
                </h3>
              </div>

              {resultadoStreaming && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copiarRelatorio}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1.5 transition-all"
                    title="Copiar relatório completo"
                  >
                    {copiado ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    {copiado ? 'Copiado' : 'Copiar'}
                  </button>
                  <Link
                    to={selectedEditalId ? `/propostas/criar?edital=${selectedEditalId}` : FORNECEDOR_ROUTES.propostas}
                    className="px-3 py-1.5 rounded-lg bg-[#0A2540] hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    Gerar Proposta
                    <ArrowRight size={13} />
                  </Link>
                </div>
              )}
            </div>

            <div className="flex-1 mt-4 p-5 bg-slate-50 border border-slate-200/70 rounded-xl overflow-y-auto max-h-[500px]">
              {resultadoStreaming ? (
                <div className="prose prose-sm max-w-none text-slate-800 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                  {resultadoStreaming}
                </div>
              ) : (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="p-4 bg-white rounded-full border border-slate-200 shadow-sm text-slate-400">
                    <FileText size={32} className="text-[#EA580C]" />
                  </div>
                  <h4 className="font-black text-slate-800 text-sm">
                    Aguardando análise de cláusulas
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Clique em &quot;Auditar Cláusulas com IA&quot; para executar a checagem detalhada de conformidade sob a Lei 14.133/2021.
                  </p>
                </div>
              )}
            </div>

            {analiseConcluida && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={16} /> Auditoria concluída sob a Lei 14.133/2021
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    to={selectedEditalId ? `/impugnacao?edital=${selectedEditalId}` : FORNECEDOR_ROUTES.impugnacao}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold transition-all"
                  >
                    Montar Peça de Impugnação
                  </Link>
                  <Link
                    to={selectedEditalId ? `/precificacao?edital=${selectedEditalId}` : FORNECEDOR_ROUTES.precificacao_estrategica}
                    className="px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-orange-600 text-white font-bold transition-all"
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
