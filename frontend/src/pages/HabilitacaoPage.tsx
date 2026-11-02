import React, { useState } from 'react';
import {
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { FORNECEDOR_ROUTES } from '@/routes';

export const HabilitacaoPage: React.FC = () => {
  const [abaAtiva, setAbaAtiva] = useState<'CHECKLIST' | 'INDICES_FINANCEIROS' | 'ATESTADOS'>('CHECKLIST');

  // Calculadora de Índices Econômico-Financeiros (Art. 69 da Lei 14.133/21)
  const [ativoCirculante, setAtivoCirculante] = useState<number>(450000);
  const [realizavelLongoPrazo, setRealizavelLongoPrazo] = useState<number>(120000);
  const [passivoCirculante, setPassivoCirculante] = useState<number>(180000);
  const [passivoNaoCirculante, setPassivoNaoCirculante] = useState<number>(90000);
  const [ativoTotal, setAtivoTotal] = useState<number>(850000);

  // Cálculos Automáticos
  const totalPassivo = passivoCirculante + passivoNaoCirculante;
  const liquidezGeral = totalPassivo > 0 ? (ativoCirculante + realizavelLongoPrazo) / totalPassivo : 0;
  const liquidezCorrente = passivoCirculante > 0 ? ativoCirculante / passivoCirculante : 0;
  const solvenciaGeral = totalPassivo > 0 ? ativoTotal / totalPassivo : 0;

  // Itens da Matriz de Habilitação (Arts. 62 a 70)
  const [itensHabilitacao] = useState([
    {
      pilar: 'Habilitação Jurídica (Art. 66)',
      itens: [
        { nome: 'Contrato Social Consolidado / Estatuto Social', status: 'CONFORME', obs: 'Última alteração contratual registrada na Junta Comercial.' },
        { nome: 'Procuração dos Representantes Legais / E-CNPJ', status: 'CONFORME', obs: 'Poderes de representação em licitações válidos.' },
        { nome: 'Inscrição no Cadastro Nacional da Pessoa Jurídica (CNPJ)', status: 'CONFORME', obs: 'Situação cadastral Ativa na Receita Federal.' },
      ],
    },
    {
      pilar: 'Qualificação Técnica (Art. 67)',
      itens: [
        { nome: 'Atestados de Capacidade Técnica (Mínimo 50% do objeto)', status: 'CONFORME', obs: '3 atestados registrados compatíveis em características e prazos.' },
        { nome: 'Registro ou Inscrição no Conselho Profissional (CREA/CRA/CRC)', status: 'CONFORME', obs: 'Certidão de Registro de Pessoa Jurídica regular.' },
        { nome: 'Declaração de Indicação de Equipe Técnica Especializada', status: 'ATENCAO', obs: 'Exige confirmação dos termos de anuência dos responsáveis técnicos.' },
      ],
    },
    {
      pilar: 'Regularidade Fiscal, Social e Trabalhista (Art. 68)',
      itens: [
        { nome: 'Certidão Negativa de Débitos Federais (Receita / PGFN)', status: 'CONFORME', obs: 'Válida por mais de 60 dias.' },
        { nome: 'Certificado de Regularidade do FGTS (CRF)', status: 'CONFORME', obs: 'Válido e sincronizado com a Caixa Econômica.' },
        { nome: 'Certidão Negativa de Débitos Trabalhistas (CNDT - TST)', status: 'CONFORME', obs: 'Inexistência de débitos inadimplidos.' },
        { nome: 'Certidões Negativas Estadual e Municipal (ICMS / ISS)', status: 'CONFORME', obs: 'Emitidas perante a SEFAZ e Prefeitura da sede.' },
      ],
    },
    {
      pilar: 'Qualificação Econômico-Financeira (Art. 69)',
      itens: [
        { nome: 'Balanço Patrimonial e DRE do Último Exercício Social', status: 'CONFORME', obs: 'Assinado por Contador habilitado (CRC) e sócio.' },
        { nome: 'Índices de Liquidez (LG, LC, SG) Superiores a 1,0', status: 'CONFORME', obs: 'LG: 2,11 | LC: 2,50 | SG: 3,14 (Excelente saúde financeira).' },
        { nome: 'Certidão Negativa de Falência e Recuperação Judicial', status: 'CONFORME', obs: 'Expedida pelo distribuidor da sede da comarca.' },
      ],
    },
  ]);

  const getStatusBadge = (st: string) => {
    if (st === 'CONFORME') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
          <CheckCircle2 size={12} /> Conforme
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
        <AlertTriangle size={12} /> Atenção
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* CABEÇALHO */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-[#0A2540] text-white rounded-xl shadow-md">
                <FileCheck size={24} />
              </span>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Matriz de Habilitação do Licitante
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Checklist e auditor de conformidade dos 4 pilares de habilitação da Lei 14.133/21 (Arts. 62 a 70).
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={FORNECEDOR_ROUTES.cofre}
              className="px-4 py-2.5 rounded-xl bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all"
            >
              Meus Documentos
              <ArrowRight size={14} />
            </Link>
          </div>
        </header>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-6 pt-3 gap-6 text-xs font-black">
          <button
            onClick={() => setAbaAtiva('CHECKLIST')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
              abaAtiva === 'CHECKLIST'
                ? 'border-[#EA580C] text-[#EA580C]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck size={16} /> Checklist Completo da Lei 14.133/21
          </button>
          <button
            onClick={() => setAbaAtiva('INDICES_FINANCEIROS')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
              abaAtiva === 'INDICES_FINANCEIROS'
                ? 'border-[#EA580C] text-[#EA580C]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calculator size={16} /> Calculadora de Índices de Liquidez (Art. 69)
          </button>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        {abaAtiva === 'CHECKLIST' && (
          <div className="space-y-6">
            {itensHabilitacao.map((bloco, idx) => (
              <div key={idx} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-black text-slate-900">{bloco.pilar}</h3>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    Aderência 100%
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {bloco.itens.map((it, itemIdx) => (
                    <div key={itemIdx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{it.nome}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{it.obs}</p>
                      </div>
                      <div className="shrink-0">{getStatusBadge(it.status)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {abaAtiva === 'INDICES_FINANCEIROS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* CALCULADORA FORMULÁRIO */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Calculator size={18} className="text-[#EA580C]" />
                  Dados do Balanço Patrimonial
                </h3>
                <p className="text-xs text-slate-500">
                  Informe os valores constantes nas Demonstrações Contábeis da sua empresa.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                    Ativo Circulante (AC) - R$
                  </label>
                  <input
                    type="number"
                    value={ativoCirculante}
                    onChange={(e) => setAtivoCirculante(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                    Realizável a Longo Prazo (RLP) - R$
                  </label>
                  <input
                    type="number"
                    value={realizavelLongoPrazo}
                    onChange={(e) => setRealizavelLongoPrazo(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                    Passivo Circulante (PC) - R$
                  </label>
                  <input
                    type="number"
                    value={passivoCirculante}
                    onChange={(e) => setPassivoCirculante(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                    Passivo Não Circulante (PNC) - R$
                  </label>
                  <input
                    type="number"
                    value={passivoNaoCirculante}
                    onChange={(e) => setPassivoNaoCirculante(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                    Ativo Total (AT) - R$
                  </label>
                  <input
                    type="number"
                    value={ativoTotal}
                    onChange={(e) => setAtivoTotal(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* RESULTADO DOS ÍNDICES */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Demonstrativo Oficial de Índices (Art. 69, caput e § 1º)
                </h3>
                <p className="text-xs text-slate-500">
                  A legislação veda exigência de índices superiores a 1,0 sem justificativa pormenorizada no processo licitatório.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* LIQUIDEZ GERAL */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-500">Liquidez Geral (LG)</p>
                  <p className="text-2xl font-black text-[#0A2540]">{liquidezGeral.toFixed(2)}</p>
                  <p className="text-[11px] text-slate-500 font-mono">(AC + RLP) / (PC + PNC)</p>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black ${
                      liquidezGeral >= 1.0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {liquidezGeral >= 1.0 ? '✓ Apto (>= 1,0)' : '⚠ Inapto (< 1,0)'}
                  </span>
                </div>

                {/* LIQUIDEZ CORRENTE */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-500">Liquidez Corrente (LC)</p>
                  <p className="text-2xl font-black text-[#EA580C]">{liquidezCorrente.toFixed(2)}</p>
                  <p className="text-[11px] text-slate-500 font-mono">AC / PC</p>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black ${
                      liquidezCorrente >= 1.0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {liquidezCorrente >= 1.0 ? '✓ Apto (>= 1,0)' : '⚠ Inapto (< 1,0)'}
                  </span>
                </div>

                {/* SOLVÊNCIA GERAL */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-500">Solvência Geral (SG)</p>
                  <p className="text-2xl font-black text-emerald-700">{solvenciaGeral.toFixed(2)}</p>
                  <p className="text-[11px] text-slate-500 font-mono">AT / (PC + PNC)</p>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black ${
                      solvenciaGeral >= 1.0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {solvenciaGeral >= 1.0 ? '✓ Apto (>= 1,0)' : '⚠ Inapto (< 1,0)'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-3">
                <Info size={18} className="shrink-0 mt-0.5 text-blue-700" />
                <div>
                  <p className="font-bold">Art. 69, § 4º da Lei 14.133/21:</p>
                  <p className="mt-0.5 leading-relaxed">
                    Caso a empresa apresente índice inferior a 1,0 em algum dos indicadores acima, o edital deve admitir a comprovação de Capital Social ou Patrimônio Líquido mínimo de até 10% (dez por cento) do valor estimado da contratação.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HabilitacaoPage;
