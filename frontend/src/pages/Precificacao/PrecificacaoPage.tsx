import React, { useState } from 'react';
import { Calculator, Zap, Percent, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { precificacaoApi } from '@services/api';

export const PrecificacaoPage: React.FC = () => {
  const [custos, setCustos] = useState({
    custoProdutoServico: 150000.00,
    impostosPercentual: 8.5,
    custoOperacionalPercentual: 5.0,
    margemDesejadaPercentual: 18.0
  });

  const [valorMaximoEdital, setValorMaximoEdital] = useState<number>(250000.00);

  const { data: resp, isLoading } = useQuery({
    queryKey: ['precificacao', custos],
    queryFn: async () => {
      const res = await precificacaoApi.calcularViabilidade(custos);
      return res.data;
    }
  });

  const calculo = resp?.data || {
    precoSugerido: 0,
    precoBreakeven: 0,
    lucroProjetado: 0,
    impostoProjetado: 0
  };

  const custoOperacionalVal = custos.custoProdutoServico * (custos.custoOperacionalPercentual / 100);
  const descontoFrenteEdital = valorMaximoEdital > 0 ? ((valorMaximoEdital - calculo.precoSugerido) / valorMaximoEdital) * 100 : 0;

  const formatarMoeda = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 p-8">
      
      {/* CABEÇALHO DA PÁGINA */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-orange-500 text-white rounded-lg shadow-md">
              <Calculator size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Precificação Estratégica & Formação de Lances
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Simulador de margem de lucro, teto de disputa e formação de preço tático para pregão eletrônico.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm text-right">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Limite de Segurança (Breakeven)</span>
            <span className="text-sm font-black text-rose-600">
              {isLoading ? <Loader2 size={16} className="animate-spin inline text-rose-600" /> : formatarMoeda(calculo.precoBreakeven)}
            </span>
          </div>
        </div>
      </header>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUNA ESQUERDA: ENTRADA DE PARÂMETROS */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
            <Percent size={16} className="text-orange-500" />
            Composição da Planilha de Custos
          </h3>

          {/* Custo Direto */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Custo Direto de Aquisição / Produção (R$)
            </label>
            <input 
              type="number"
              value={custos.custoProdutoServico}
              onChange={(e) => setCustos({ ...custos, custoProdutoServico: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Custos Operacionais % */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Custos Indiretos / Logística / Frete (%)
            </label>
            <input 
              type="number"
              value={custos.custoOperacionalPercentual}
              onChange={(e) => setCustos({ ...custos, custoOperacionalPercentual: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Impostos % */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Alíquota Efetiva de Impostos (%)
            </label>
            <input 
              type="number"
              value={custos.impostosPercentual}
              onChange={(e) => setCustos({ ...custos, impostosPercentual: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Margem Desejada % */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Margem de Lucro Alvo (%)
            </label>
            <input 
              type="number"
              value={custos.margemDesejadaPercentual}
              onChange={(e) => setCustos({ ...custos, margemDesejadaPercentual: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Valor Máximo Estimado pelo Órgão */}
          <div className="pt-3 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Valor Máximo / Referência do Edital (R$)
            </label>
            <input 
              type="number"
              value={valorMaximoEdital}
              onChange={(e) => setValorMaximoEdital(parseFloat(e.target.value) || 0)}
              className="w-full bg-blue-50 border border-blue-200 text-blue-900 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* COLUNA DIREITA: DRE SINTÉTICO E SIMULAÇÃO DE LANCE */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* CARD PREÇO SUGERIDO */}
          <div className="bg-gradient-to-br from-[#0B1736] to-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-10">
                <Loader2 size={32} className="animate-spin text-orange-500" />
              </div>
            )}
            
            <div>
              <span className="text-xs text-orange-400 font-bold uppercase tracking-wider block">
                Preço Ideal da Proposta Inicial
              </span>
              <h2 className="text-3xl font-black mt-1 text-white">
                {formatarMoeda(calculo.precoSugerido)}
              </h2>
              <p className="text-xs text-slate-400 mt-2">
                Garante <strong className="text-emerald-400">{custos.margemDesejadaPercentual}%</strong> de lucro líquido após todos os tributos e fretes.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10 text-center relative z-20">
              <span className="text-[10px] text-slate-300 font-bold uppercase block">Desconto Fixo vs Edital</span>
              <span className="text-xl font-extrabold text-emerald-400">
                {descontoFrenteEdital.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* BREAKDOWN DE CUSTOS (DRE) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 relative overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10" />
            )}
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
              Demonstrativo de Resultado do Lance (DRE Projeção)
            </h3>

            <div className="space-y-2 text-xs relative z-20">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600 font-medium">Receita Bruta (Preço da Proposta)</span>
                <span className="font-bold text-slate-900">{formatarMoeda(calculo.precoSugerido)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 text-rose-600">
                <span>(-) Impostos ({custos.impostosPercentual}%)</span>
                <span className="font-bold">-{formatarMoeda(calculo.impostoProjetado)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 text-slate-600">
                <span>(-) Custo Direto (Aquisição)</span>
                <span className="font-bold">-{formatarMoeda(custos.custoProdutoServico)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50 text-slate-600">
                <span>(-) Frete e Logística ({custos.custoOperacionalPercentual}%)</span>
                <span className="font-bold">-{formatarMoeda(custoOperacionalVal)}</span>
              </div>
              <div className="flex justify-between py-2 pt-3 font-extrabold text-sm text-emerald-600 bg-emerald-50/50 px-2 rounded-lg">
                <span>(=) Lucro Líquido Projetado</span>
                <span>{formatarMoeda(calculo.lucroProjetado)}</span>
              </div>
            </div>
          </div>

          {/* REGRAS PARA O ROBÔ DE LANCES */}
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-start gap-4">
            <Zap className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-xs">
              <h4 className="font-bold text-amber-900">Parâmetro de Disputa Autônoma (Robô de Lances)</h4>
              <p className="text-amber-700 mt-1">
                Ao exportar esta estratégia para o **Módulo do Robô**, o preço teto de parada será configurado em **{formatarMoeda(calculo.precoBreakeven)}**. O sistema desativará automaticamente os lances caso a disputa atinja esse limiar.
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};