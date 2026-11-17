import React, { useState } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@services/api';
import { formatCnpjMask, isValidCnpj, sanitizeCnpj } from '@/utils/cnpj';

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const NulidadesPage: React.FC = () => {
  const [cnpjs, setCnpjs] = useState<string[]>(['', '']);
  const [processoRef, setProcessoRef] = useState('');
  const [aba, setAba] = useState<'geral' | 'cruzamento' | 'indicios' | 'defesa'>('geral');
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);

  const atualizarCnpj = (idx: number, val: string) => {
    const copia = [...cnpjs];
    copia[idx] = formatCnpjMask(val);
    setCnpjs(copia);
  };

  const adicionarCnpj = () => {
    if (cnpjs.length >= 6) {
      toast.error('Maximo de 6 empresas por analise.');
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
      toast.error('Informe pelo menos um CNPJ valido para iniciar o cruzamento.');
      return;
    }

    setCarregando(true);
    try {
      const resp = await api.post('/concorrentes/integridade', { cnpjs: validos }, { timeout: 60000 });
      setResultado(resp.data?.data || null);
      toast.success('Cruzamento de integridade concluido.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erro ao executar cruzamento de dados.');
    } finally {
      setCarregando(false);
    }
  };

  const baixarRelatorioPdf = () => {
    if (!resultado) return;
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatorio de Integridade Licitatoria</title>
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
    <img src="${window.location.origin}/assets/logo-expertise.png" alt="Expertise Licitatoria" />
    <div style="text-align:right;font-size:11px;color:#475569;">
      <strong>Radar de Inteligencia e Integridade</strong><br/>
      ${new Date().toLocaleString('pt-BR')}
    </div>
  </div>
  <h1>Analise de Possiveis Irregularidades</h1>
  ${processoRef ? `<p style="font-size:12px;"><strong>Processo / Edital:</strong> ${escapeHtml(processoRef)}</p>` : ''}
  <p style="font-size:13px;"><strong>Indice de Risco:</strong> ${escapeHtml(resultado.nivelRisco)} (${resultado.indiceRisco}%)</p>
  <div class="aviso">${escapeHtml(resultado.avisoLegal)}</div>
  <h2>Empresas Analisadas</h2>
  <ul>${(resultado.empresas || []).map((e: any) => `<li><strong>${escapeHtml(e.razaoSocial)}</strong> (${escapeHtml(e.cnpj)}) — ${escapeHtml(e.situacaoCadastral)} | ${escapeHtml(e.endereco)}</li>`).join('')}</ul>
  <h2>Indicios Identificados</h2>
  <ul>${(resultado.indicios || []).length ? resultado.indicios.map((i: any) => `<li>[${escapeHtml(i.severidade)}] <strong>${escapeHtml(i.titulo)}:</strong> ${escapeHtml(i.detalhe)}</li>`).join('') : '<li>Nenhum indicio critico detectado automaticamente.</li>'}</ul>
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Cabecalho */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#081C3A] text-[#F97316]">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#081C3A]">
              Analise de Possiveis Irregularidades
            </h1>
            <p className="text-xs text-slate-500">
              Radar de Inteligencia e Integridade Licitatoria — cruzamento de dados publicos e linhas de defesa
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={adicionarCnpj}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#081C3A] px-3 py-2 text-xs font-bold text-[#081C3A] hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            Adicionar CNPJ
          </button>
          {resultado && (
            <button
              type="button"
              onClick={baixarRelatorioPdf}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#081C3A] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4 text-[#F97316]" />
              Relatorio PDF
            </button>
          )}
        </div>
      </div>

      {/* Entrada */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <input
          type="text"
          value={processoRef}
          onChange={(e) => setProcessoRef(e.target.value)}
          placeholder="Processo / Edital e Orgao (opcional, ex: PE 014/2026 - Prefeitura Municipal)"
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
                  className="rounded-xl border border-slate-200 p-2.5 text-slate-400 hover:text-rose-600"
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
            disabled={carregando}
            onClick={executarCruzamento}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Executar Cruzamento Oficial
          </button>
        </div>
      </div>

      {resultado && (
        <>
          {/* Abas */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'geral', label: 'Visao Geral' },
              { id: 'cruzamento', label: 'Cruzamento de Dados' },
              { id: 'indicios', label: 'Indicios' },
              { id: 'defesa', label: 'Linhas de Defesa' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setAba(t.id as any)}
                className={`rounded-xl px-4 py-2 text-xs font-bold ${
                  aba === t.id
                    ? 'bg-[#081C3A] text-white'
                    : 'border border-slate-200 bg-white text-[#081C3A] hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Gauge + 4 KPIs */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-bold text-slate-500">Indice de Risco</div>
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
              <div className="text-xs font-semibold text-slate-500">Indicios Identificados</div>
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
              <div className="text-xs font-semibold text-slate-500">Conexoes Detectadas</div>
              <div className="mt-3 text-3xl font-extrabold text-[#F97316]">
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

          {/* 4 Paineis Principais */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {(aba === 'geral' || aba === 'cruzamento') && (
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

            {(aba === 'geral' || aba === 'indicios') && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
                  <AlertTriangle className="h-4 w-4 text-rose-600" /> Principais Indicios
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
                    Nenhum indicio de vinculo societario, endereco em comum ou restricao cadastral encontrado entre os CNPJs informados.
                  </p>
                )}
              </div>
            )}

            {(aba === 'geral' || aba === 'defesa') && (
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

            {aba === 'geral' && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
                  <Network className="h-4 w-4 text-[#F97316]" /> Cenario Investigativo (Conexoes)
                </h2>
                <div className="space-y-3">
                  {(resultado.empresas || []).map((emp: any, i: number) => (
                    <div key={emp.cnpj} className="rounded-xl border border-slate-200 p-3 text-xs">
                      <div className="font-bold text-[#081C3A]">
                        Empresa {String.fromCharCode(65 + i)}: {emp.razaoSocial} ({formatCnpjMask(emp.cnpj)})
                      </div>
                      <div className="mt-1 text-slate-500">
                        QSA: {emp.socios?.length ? emp.socios.map((s: any) => s.nome).join(', ') : 'Nao informado'}
                      </div>
                      <div className="text-slate-500">TCU: {emp.tcuStatus} | CGU: {emp.cguStatus}</div>
                    </div>
                  ))}
                  {(resultado.conexoes || []).length > 0 && (
                    <div className="rounded-xl bg-orange-50 p-3 text-xs text-orange-900">
                      <strong>Conexoes mapeadas:</strong>
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
  );
};

export default NulidadesPage;
