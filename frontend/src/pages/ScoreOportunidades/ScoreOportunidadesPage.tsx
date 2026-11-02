import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Target, ShieldAlert, Zap, BarChart3, 
  AlertTriangle, AlertCircle, Building2, Loader2, Info,
  CheckCircle2, ArrowRight
} from 'lucide-react';
import { crmApi, noticesApi } from '../../services/api';

interface OportunidadeScore {
  id: string;
  edital: string;
  orgao: string;
  valorEstimado: number | null;
  scoreGeral: number | null; // 0 a 100 ou null se dados insuficientes
  classificacao: 'ALTA_VIABILIDADE' | 'MEDIA_VIABILIDADE' | 'ALTO_RISCO' | 'DADOS_INSUFICIENTES';
  breakdown: {
    tecnico: number; // máx 25
    comercial: number; // máx 20
    juridico: number; // máx 25
    prazo: number; // máx 20
  };
  principalRisco: string;
  motivos: string[];
}

export const ScoreOportunidadesPage: React.FC = () => {
  const navigate = useNavigate();
  const [oportunidades, setOportunidades] = useState<OportunidadeScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchOportunidades = async () => {
      setLoading(true);
      setError(null);
      try {
        const crmRes = await crmApi.getOportunidades();
        const pipelines = crmRes.data?.data || [];
        
        // Avalia oportunidades adicionadas ao funil
        const topPipelines = pipelines.slice(0, 15);
        const noticeIds = topPipelines
          .map((p: any) => p.notice?.id)
          .filter((id: any): id is string => typeof id === 'string' && id.length > 0);

        // Dispara uma única requisição em lote (Fim do gargalo N+1)
        const scoreMap = new Map<string, any>();
        if (noticeIds.length > 0) {
          try {
            const batchRes = await noticesApi.getBatchOpportunityScore(noticeIds);
            const batchItems = Array.isArray(batchRes.data?.data) ? batchRes.data.data : [];
            batchItems.forEach((item: any) => {
              if (item?.noticeId && item?.data) {
                scoreMap.set(item.noticeId, item.data);
              }
            });
          } catch (batchErr) {
            console.warn('[ScoreOportunidades] Falha ao consultar scores em lote:', batchErr);
          }
        }

        const mapped: OportunidadeScore[] = [];

        for (const p of topPipelines) {
          if (!p.notice || !p.notice.id) continue;
          const scoreData = scoreMap.get(p.notice.id);

          if (scoreData) {
            const baseScore = typeof scoreData.score === 'number' ? scoreData.score : null;
            
            let classif: OportunidadeScore['classificacao'] = 'MEDIA_VIABILIDADE';
            if (baseScore === null || isNaN(baseScore)) {
              classif = 'DADOS_INSUFICIENTES';
            } else if (baseScore >= 75) {
              classif = 'ALTA_VIABILIDADE';
            } else if (baseScore < 50) {
              classif = 'ALTO_RISCO';
            }

            mapped.push({
              id: p.notice.id,
              edital: (p.notice.modality ? `${p.notice.modality} ` : '') + (p.notice.noticeNumber || 'Edital S/N'),
              orgao: p.notice.buyerName || 'Órgão não especificado',
              valorEstimado: p.notice.estimatedValue ? Number(p.notice.estimatedValue) : null,
              scoreGeral: baseScore,
              classificacao: classif,
              breakdown: { 
                tecnico: scoreData.detalhes?.compatibilidadeNicho ?? 0,
                comercial: scoreData.detalhes?.compatibilidadeValor ?? 0,
                juridico: scoreData.detalhes?.riscoEdital ?? 0,
                prazo: scoreData.detalhes?.prazo ?? 0,
              },
              principalRisco: scoreData.riscos?.[0] || scoreData.recomendacao || 'Sem risco crítico identificado',
              motivos: scoreData.motivos || [],
            });
          } else {
            mapped.push({
              id: p.notice.id,
              edital: (p.notice.modality ? `${p.notice.modality} ` : '') + (p.notice.noticeNumber || 'Edital S/N'),
              orgao: p.notice.buyerName || 'Órgão não especificado',
              valorEstimado: p.notice.estimatedValue ? Number(p.notice.estimatedValue) : null,
              scoreGeral: null,
              classificacao: 'DADOS_INSUFICIENTES',
              breakdown: { tecnico: 0, comercial: 0, juridico: 0, prazo: 0 },
              principalRisco: 'Dados públicos insuficientes para estimativa de score.',
              motivos: [],
            });
          }
        }

        // Ordena por score decrescente (nulos ao final)
        mapped.sort((a, b) => (b.scoreGeral ?? -1) - (a.scoreGeral ?? -1));

        if (isMounted) {
          setOportunidades(mapped);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.response?.data?.message || 'Não foi possível carregar o Painel de Oportunidades.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOportunidades();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatarMoeda = (val: number | null) => {
    if (val === null || val === undefined || isNaN(val)) return 'Valor não informado';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  const getCorScore = (classificacao: OportunidadeScore['classificacao'], score: number | null) => {
    if (score === null || classificacao === 'DADOS_INSUFICIENTES') {
      return 'text-slate-600 bg-slate-100 border-slate-300';
    }
    if (score >= 75) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (score >= 50) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  // Métricas de resumo calculadas DINAMICAMENTE (zero números estáticos ou arbitrários)
  const totalValidos = oportunidades.filter((o) => o.scoreGeral !== null);
  const scoreMedio = totalValidos.length > 0 
    ? (totalValidos.reduce((acc, curr) => acc + (curr.scoreGeral ?? 0), 0) / totalValidos.length).toFixed(1)
    : null;

  const totalQuentes = oportunidades.filter((o) => o.classificacao === 'ALTA_VIABILIDADE').length;
  const totalAltoRisco = oportunidades.filter((o) => o.classificacao === 'ALTO_RISCO').length;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 bg-slate-50 min-h-screen">
      
      {/* CABEÇALHO */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-8 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3 pl-3 border-l-4 border-[#0A2540]">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Termômetro de Oportunidade
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Veja como cada oportunidade se relaciona com o perfil da sua empresa e confira os principais fatores de atenção.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 bg-slate-200/70 px-3 py-1 rounded-full flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-blue-600" />
            Análise baseada no perfil da empresa
          </span>
        </div>
      </header>

      {/* ERRO GERAL */}
      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-rose-800">{error}</p>
        </div>
      )}

      {/* MÉTRICAS DE RESUMO DINÂMICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Score Médio do Portfólio
            </span>
            <span className="text-2xl font-black text-slate-900">
              {loading ? (
                <Loader2 size={20} className="animate-spin text-slate-300" />
              ) : scoreMedio !== null ? (
                `${scoreMedio} / 100`
              ) : (
                <span className="text-slate-400 font-bold text-lg">Não calculado</span>
              )}
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-[#0A2540] rounded-xl">
            <BarChart3 size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Alta Viabilidade (≥ 75)
            </span>
            <span className="text-2xl font-black text-emerald-700">
              {loading ? (
                <Loader2 size={20} className="animate-spin text-slate-300" />
              ) : (
                `${totalQuentes} ${totalQuentes === 1 ? 'Edital' : 'Editais'}`
              )}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Zap size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Alertas de Alto Risco (&lt; 50)
            </span>
            <span className="text-2xl font-black text-rose-700">
              {loading ? (
                <Loader2 size={20} className="animate-spin text-slate-300" />
              ) : (
                `${totalAltoRisco} ${totalAltoRisco === 1 ? 'Edital' : 'Editais'}`
              )}
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* LISTAGEM DE OPORTUNIDADES */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <Loader2 className="animate-spin text-[#0A2540] w-8 h-8 mb-3" />
            <p className="text-xs font-bold text-slate-600">Calculando matriz de score a partir das bases do PNCP...</p>
          </div>
        ) : oportunidades.length === 0 ? (
          /* ESTADO VAZIO EXPLICATIVO COMPROVADO */
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-10 text-center">
            <div className="bg-slate-100 p-4 rounded-full inline-flex mb-4">
              <Target size={32} className="text-slate-400" />
            </div>
            <h3 className="text-base font-black text-slate-900 mb-2">
              Nenhuma oportunidade processada pelo motor de Score
            </h3>
            <div className="max-w-xl mx-auto space-y-2 text-xs text-slate-500 leading-relaxed mb-6">
              <p>
                <strong>Quais dados serão exibidos:</strong> Oportunidades da sua esteira avaliadas por nicho de atuação (CNAE), compatibilidade financeira, região geográfica e riscos de edital.
              </p>
              <p>
                <strong>Por que não estão disponíveis:</strong> Sua Esteira de Disputas ainda não possui editais vinculados à conta da sua empresa.
              </p>
              <p>
                <strong>Ação recomendada:</strong> Acesse o Radar de Oportunidades e selecione certames do seu interesse para que o motor estratégico gere a pontuação de viabilidade.
              </p>
            </div>
            <button
              onClick={() => navigate('/fornecedor/radar')}
              className="inline-flex items-center gap-2 bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-sm"
            >
              Explorar Radar de Editais
              <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          oportunidades.map((item) => (
            <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              
              {/* INFORMAÇÕES BÁSICAS */}
              <div className="lg:col-span-5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-slate-900">{item.edital}</span>
                </div>
                <p className="text-xs text-slate-500 font-bold flex items-center gap-1">
                  <Building2 size={14} className="text-slate-400" /> {item.orgao}
                </p>
                <div className="text-xs text-slate-700">
                  Valor Estimado: <strong className="font-black text-slate-900">{formatarMoeda(item.valorEstimado)}</strong>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 mt-2">
                  <strong className="text-rose-700 block mb-0.5 font-bold flex items-center gap-1">
                    <ShieldAlert size={13} /> Fator Principal de Atenção / Risco:
                  </strong>
                  {item.principalRisco}
                </div>
              </div>

              {/* BARRA DE SCORE / BREAKDOWN PROPORCIONAL COM PESOS REAIS */}
              <div className="lg:col-span-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                    Fatores Auditáveis de Composição
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Escala Heurística (0-100)
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between font-bold text-[11px] mb-1">
                      <span className="text-slate-600">Aderência de Nicho / CNAE:</span>
                      <span className="text-slate-900">{item.breakdown.tecnico} / 25 pts</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#0A2540] h-full transition-all" 
                        style={{ width: `${Math.min(100, (item.breakdown.tecnico / 25) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-[11px] mb-1">
                      <span className="text-slate-600">Faixa de Valor Estimado:</span>
                      <span className="text-slate-900">{item.breakdown.comercial} / 20 pts</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#EA580C] h-full transition-all" 
                        style={{ width: `${Math.min(100, (item.breakdown.comercial / 20) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-[11px] mb-1">
                      <span className="text-slate-600">Mitigação de Riscos de Edital:</span>
                      <span className="text-slate-900">{25 - Math.min(25, item.breakdown.juridico)} / 25 pts</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-600 h-full transition-all" 
                        style={{ width: `${Math.max(0, 100 - (item.breakdown.juridico / 25) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD DE SCORE FINAL */}
              <div className="lg:col-span-2 flex flex-col items-center justify-center p-4 rounded-xl border text-center space-y-1 bg-slate-50">
                <span className="text-[10px] font-black uppercase text-slate-400">Termômetro de Oportunidade</span>
                {item.scoreGeral !== null ? (
                  <span className={`text-3xl font-black px-3 py-1 rounded-xl border ${getCorScore(item.classificacao, item.scoreGeral)}`}>
                    {item.scoreGeral}
                  </span>
                ) : (
                  <span className="text-xs font-black px-2.5 py-1.5 rounded-lg border text-slate-600 bg-slate-200/80 border-slate-300">
                    Dados Insuficientes
                  </span>
                )}
                <span className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-wider">
                  {item.classificacao === 'DADOS_INSUFICIENTES' 
                    ? 'Não calculado' 
                    : item.classificacao.replace('_', ' ')}
                </span>
              </div>

            </div>
          ))
        )}
      </div>

      {/* NOTA DE RASTREABILIDADE */}
      <footer className="mt-8 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
        <Info size={14} />
        O cálculo utiliza pesos fixos versionados sobre dados abertos do PNCP e cadastros da empresa. Nenhuma análise utiliza aleatoriedade.
      </footer>

    </div>
  );
};