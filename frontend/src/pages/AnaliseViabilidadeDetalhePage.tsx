import { useEffect, useState } from 'react';
import { FORNECEDOR_ROUTES } from '@/routes';
import { Link, useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Building2,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Scale,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { fetchAnaliseViabilidade } from '../services/analiseViabilidadeService';
import { crmApi, lexApi } from '../services/api';
import { AnaliseViabilidadeData } from '../types/analise-viabilidade.types';
import toast from 'react-hot-toast';

export function AnaliseViabilidadeDetalhePage() {
  const { id: routeId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editalParam = searchParams.get('id') || searchParams.get('edital') || routeId || undefined;

  const [data, setData] = useState<AnaliseViabilidadeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvandoCrm, setSalvandoCrm] = useState(false);
  const [salvoNoCrm, setSalvoNoCrm] = useState(false);
  const [analisandoLex, setAnalisandoLex] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErro(null);

    fetchAnaliseViabilidade(editalParam)
      .then((res) => {
        if (!active) return;
        setData(res);
      })
      .catch((err) => {
        if (!active) return;
        setErro(err?.message || 'Não foi possível carregar a análise de viabilidade deste edital.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [editalParam]);

  const handleSalvarCrm = async () => {
    const targetId = data?.editalId || editalParam;
    if (!targetId) return;
    try {
      setSalvandoCrm(true);
      await crmApi.createOportunidade({ noticeId: targetId });
      setSalvoNoCrm(true);
      toast.success('Oportunidade salva na sua esteira. Prazo da sessão agendado.');
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setSalvoNoCrm(true);
        toast('Oportunidade já está na sua esteira de disputas.');
      } else {
        toast.error(err?.response?.data?.message || 'Erro ao adicionar edital às disputas.');
      }
    } finally {
      setSalvandoCrm(false);
    }
  };

  const handleExecutarAnaliseLex = async () => {
    const targetId = data?.editalId || editalParam;
    if (!targetId) {
      toast.error('Identificador do edital não informado.');
      return;
    }

    try {
      setAnalisandoLex(true);
      const res = await lexApi.analise({ noticeId: targetId });
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        toast.success('Análise de viabilidade concluída.');
      } else {
        toast.error(res.data?.message || 'Não foi possível concluir a análise.');
      }
    } catch (err: any) {
      console.error('[AnaliseViabilidade] Erro LEX:', err);
      toast.error(err?.response?.data?.message || 'Não foi possível concluir a análise. Tente novamente.');
    } finally {
      setAnalisandoLex(false);
    }
  };

  const formatCurrency = (val?: number) =>
    val != null
      ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : 'R$ 0,00';

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 bg-slate-50 min-h-screen flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-700">Calculando viabilidade com dados oficiais do edital...</p>
        <p className="text-xs text-slate-400 mt-1">Cruzando custos, alíquota de impostos e teto orçamentário</p>
      </div>
    );
  }

  if (erro || !data) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 bg-slate-50 min-h-screen flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 border border-slate-200 shadow-sm">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">Edital não localizado para análise</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
          {erro || 'Não encontramos registros de editais salvos na base local para gerar a viabilidade. Sincronize o Radar com o PNCP.'}
        </p>
        <div className="flex gap-3">
          <Link
            to={FORNECEDOR_ROUTES.radar}
            className="h-10 px-6 rounded-md bg-brand-blue hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4 text-white shrink-0" />
            <span>Abrir Radar de Editais</span>
          </Link>
          <Link
            to={FORNECEDOR_ROUTES.dashboard}
            className="h-10 px-6 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center"
          >
            Ir ao Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const scoreColor =
    data.score.percentual >= 80
      ? '#10B981'
      : data.score.percentual >= 50
      ? '#F59E0B'
      : '#EF4444';

  const scoreData = [
    { name: 'Compatibilidade', value: data.score.percentual },
    { name: 'Outros fatores', value: Math.max(0, 100 - data.score.percentual) },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 sm:py-9 bg-slate-50 min-h-screen">
      {/* Header */}
      <header className="flex flex-col gap-4 pb-6 border-b border-slate-200 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          {/* Modalidade e Localização */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
              {data.modalidade || 'Edital Oficial'}
            </span>
            {data.uf && (
              <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-700">
                {data.municipio ? `${data.municipio} · ${data.uf}` : data.uf}
              </span>
            )}
          </div>

          {/* Container Pai: Alinhamento do Botão Voltar com o Título da Página (flex items-center gap-2) */}
          <div className="flex items-center gap-2">
            <Link
              to={FORNECEDOR_ROUTES.radar}
              title="Voltar ao radar de editais"
              className="h-10 px-3 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-xs flex items-center gap-2 shrink-0 group"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500 group-hover:text-slate-800 shrink-0" />
              <span className="text-xs font-bold text-slate-700 hidden sm:inline">Voltar</span>
            </Link>
            <h1 className="text-2xl font-black tracking-tight text-[#0A2540]">
              Análise de Rentabilidade
            </h1>
          </div>
        </div>

        {/* Botões de Ação Padronizados (h-10, px-4, rounded-md) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Botão de análise da oportunidade */}
          <button
            onClick={handleExecutarAnaliseLex}
            disabled={analisandoLex}
            className="h-10 px-4 rounded-md font-bold text-xs uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50"
          >
            {analisandoLex ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <img src="/assets/mascote-3d.png" alt="Assistente de Análise" className="w-4 h-4 object-contain shrink-0" />
            )}
            <span>
              {analisandoLex
                ? 'Analisando...'
                : (data.lexAnalysis || data.lex)
                ? 'Reanalisar com LEX'
                : 'Analisar oportunidade'}
            </span>
          </button>

          {/* Botão Gerar Proposta Estratégica */}
          <button
            onClick={() =>
              navigate(
                `/fornecedor/propostas?edital=${encodeURIComponent(data.editalId || editalParam || '')}`,
              )
            }
            className="h-10 px-4 rounded-md font-bold text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 transition shadow-sm"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Gerar Proposta Estratégica</span>
          </button>

          {/* Botão Salvar / Participar */}
          {salvoNoCrm ? (
            <Link
              to={FORNECEDOR_ROUTES.disputas}
              className="h-10 px-4 rounded-md font-bold text-xs uppercase tracking-wider bg-emerald-50 border border-emerald-300 text-emerald-700 flex items-center justify-center gap-2 transition"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Salvo nas Disputas</span>
            </Link>
          ) : (
            <button
              onClick={handleSalvarCrm}
              disabled={salvandoCrm}
              className="h-10 px-4 rounded-md font-bold text-xs uppercase tracking-wider bg-brand-blue hover:bg-slate-800 text-white flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-sm"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{salvandoCrm ? 'Salvando...' : 'Salvar / Participar'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Card Informativo do Edital Real */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
          Identificação Oficial do Certame
        </p>
        <h2 className="text-lg font-bold text-slate-900 mb-2 leading-snug">
          {data.editalNumero} — {data.orgao}
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          {data.objeto}
        </p>
        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 font-semibold border-t border-slate-100 pt-4">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            {data.orgao}
          </span>
          {(data.municipio || data.uf) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              {[data.municipio, data.uf].filter(Boolean).join(' · ')}
            </span>
          )}
          {data.dataAbertura && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              Sessão: {new Date(data.dataAbertura).toLocaleDateString('pt-BR')}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-slate-400 shrink-0" />
            Valor Estimado: <strong className="text-slate-900">{formatCurrency(data.precos.estimativaEdital)}</strong>
          </span>
        </div>
      </section>

      {/* Banner de Ação Primária: Se a análise não existir ainda ou valor estimado for 0 */}
      {(!data.lexAnalysis && !data.lex && (data.precos.estimativaEdital === 0 || data.score.percentual <= 40)) && (
        <section className="bg-gradient-to-r from-[#0A2540] via-slate-900 to-indigo-950 text-white rounded-2xl p-8 mb-6 shadow-md border border-indigo-900/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Sparkles className="w-64 h-64 text-indigo-400" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold mb-3 border border-indigo-400/30">
              <img src="/assets/mascote-3d.png" alt="Assistente de Análise" className="w-4 h-4 object-contain shrink-0" />
              Análise da oportunidade
            </div>
            <h3 className="text-xl font-black text-white mb-2 tracking-tight">
              Análise Preliminar Pendente para este Edital
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              O edital não possui valor estimado explícito ou parâmetros orçamentários calculados. 
              Inicie a análise para consultar referências de custo e avaliar se o preço estimado permite uma proposta sustentável.
            </p>
            <button
              onClick={handleExecutarAnaliseLex}
              disabled={analisandoLex}
              className="h-11 px-6 rounded-md font-bold text-xs uppercase tracking-wider bg-brand-orange hover:bg-orange-600 text-white flex items-center justify-center gap-2.5 shadow-lg transition disabled:opacity-50"
            >
              {analisandoLex ? (
                <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              ) : (
                <img src="/assets/mascote-3d.png" alt="Assistente de Análise" className="w-5 h-5 object-contain shrink-0" />
              )}
              <span>{analisandoLex ? 'Analisando informações...' : 'Iniciar análise'}</span>
            </button>
          </div>
        </section>
      )}

      {/* Painel com análise de rentabilidade, riscos e recomendação comercial */}
      {(data.lexAnalysis || data.lex) && (
        <section className="bg-white border border-indigo-100 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/assets/mascote-3d.png" alt="Assistente de Análise" className="w-8 h-8 object-contain" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Resultado da análise
                </h3>
                <p className="text-xs text-slate-500">
                  Referências de custo, margem e pontos de atenção para apoiar sua decisão.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 self-start sm:self-center">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              Análise concluída
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Parecer de Exequibilidade */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2 text-slate-800">
                <Scale className="w-4 h-4 text-indigo-600 shrink-0" />
                <h4 className="font-bold text-xs uppercase tracking-wider">Viabilidade do preço</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                {data.lex?.parecerExequibilidade || data.lexAnalysis?.parecerExequibilidade || 'Não há informações suficientes para avaliar a viabilidade financeira.'}
              </p>
            </div>

            {/* Alertas e Riscos */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <h4 className="font-bold text-xs uppercase tracking-wider">Alertas & Riscos</h4>
              </div>
              <div className="space-y-2">
                {((data.lex?.alertas || data.lexAnalysis?.alertasRiscos || []) as any[]).map((alerta: any, idx: number) => {
                  const isObj = typeof alerta === 'object' && alerta !== null;
                  const risco = isObj
                    ? (alerta.risco || 'Médio')
                    : (String(alerta).toLowerCase().includes('alto') || String(alerta).toLowerCase().includes('crític') ? 'Alto' : 'Médio');
                  const isAlto = String(risco).toLowerCase().includes('alto') || String(risco).toLowerCase().includes('crític');
                  const titulo = isObj ? alerta.titulo : null;
                  const texto = isObj ? (alerta.mensagem || alerta.texto || alerta.descricao || '') : String(alerta);

                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                        isAlto
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-900 border-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold">{titulo || (isAlto ? 'Ponto Crítico Identificado' : 'Alerta de Conformidade')}</span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                            isAlto ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {risco}
                        </span>
                      </div>
                      <p className={isAlto ? 'text-red-900/90' : 'text-amber-900/90'}>{texto}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recomendação Estratégica */}
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2 text-emerald-900">
                <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                <h4 className="font-bold text-xs uppercase tracking-wider">Recomendação Comercial</h4>
              </div>
              <p className="text-xs text-emerald-900/90 leading-relaxed">
                {data.lex?.recomendacaoEstrategica || data.lexAnalysis?.recomendacaoEstrategica || 'Edital altamente viável para disputa eletrônica com boa margem competitiva.'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Grid Layout: Score + Resumo da Análise */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Indicador de compatibilidade */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col justify-center items-center relative">
          <h2 className="absolute top-6 left-6 text-base font-black text-slate-900">
            Índice de Viabilidade
          </h2>

          <div className="w-56 h-56 relative mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scoreData}
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={95}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill={scoreColor} />
                  <Cell fill="#F1F5F9" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-black" style={{ color: scoreColor }}>
                {data.score.percentual}%
              </span>
              <span
                className="text-[10px] font-black uppercase tracking-widest mt-1 text-center px-2"
                style={{ color: scoreColor }}
              >
                {data.score.classificacao}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-4 text-center max-w-sm leading-relaxed">
            {data.score.descricao}
          </p>
        </div>

        {/* Resumo dos Pilares */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <h2 className="text-base font-black text-slate-900 mb-6">
            Resumo dos Indicadores Estratégicos
          </h2>

          <div className="space-y-5">
            {data.resumo.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between pb-4 border-b border-slate-100 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-sm text-slate-800">{item.titulo}</span>
                    {item.detalhe && (
                      <p className="text-xs text-slate-400 mt-0.5">{item.detalhe}</p>
                    )}
                  </div>
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-slate-100 text-slate-700 shrink-0">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Análise de Preços */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-brand-blue shrink-0" />
            <h2 className="text-base font-black text-slate-900">
              Formação de Preço Sustentável
            </h2>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            Cálculo determinístico considerando custos diretos, impostos e margem mínima.
          </p>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-bold text-slate-700 text-sm">Preço Mínimo Saudável</span>
                <span className="font-black text-brand-orange text-sm">
                  {formatCurrency(data.precos.precoMinimoSustentavel)}
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-orange rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      data.precos.estimativaEdital > 0
                        ? ((data.precos.precoMinimoSustentavel || 0) / data.precos.estimativaEdital) * 100
                        : 0
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="font-bold text-slate-700 text-sm">Preço Sugerido de Disputa</span>
                <span className="font-black text-emerald-600 text-sm">
                  {formatCurrency(data.precos.nossoPreco)}
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      data.precos.estimativaEdital > 0
                        ? (data.precos.nossoPreco / data.precos.estimativaEdital) * 100
                        : 0
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="font-bold text-slate-700 text-sm">Valor Estimado do Edital (Teto)</span>
                <span className="font-black text-[#0A2540] text-sm">
                  {formatCurrency(data.precos.estimativaEdital)}
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#0A2540] rounded-full w-full" />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex justify-between items-center">
            <div>
              <p className="font-bold text-slate-700 text-sm">Margem Líquida Estimada</p>
              <p className="text-xs text-slate-400">Após dedução de produto, frete e tributos</p>
            </div>
            <div className="text-right">
              <span className="font-black text-xl text-slate-900">
                {data.precos.margemEstimadaPercent.toFixed(1)}%
              </span>
              {data.precos.margemEstimadaValor != null && (
                <p className="text-xs font-bold text-emerald-600">
                  {formatCurrency(data.precos.margemEstimadaValor)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Detalhamento de Exigências Oficiais */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
          <h2 className="text-base font-black text-slate-900 mb-2">
            Exigências e Requisitos Documentais
          </h2>
          <p className="text-xs text-slate-500 mb-6">
            Conformidade obrigatória conforme Lei 14.133/2021
          </p>

          <div className="space-y-3">
            {data.exigencias.map((ex) => (
              <div
                key={ex.id}
                className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-bold text-xs text-slate-700">{ex.categoria}</span>
                </div>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded shrink-0">
                  {ex.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
