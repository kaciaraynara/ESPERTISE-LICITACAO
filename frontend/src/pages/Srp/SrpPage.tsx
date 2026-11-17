import React, { useEffect, useState } from 'react';
import {
  Layers,
  Search,
  FileSpreadsheet,
  Building2,
  DollarSign,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { licitacoesApi } from '@/services/api';
import { buildOfficialPncpPortalUrl } from '@/utils/pncp';

function formatarMoeda(v: number | null | undefined): string {
  if (!v) return 'A definir';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(v));
}

export const SrpPage: React.FC = () => {
  const [aba, setAba] = useState<'geral' | 'buscador' | 'vigentes' | 'carona'>('buscador');
  const [termo, setTermo] = useState('');
  const [uf, setUf] = useState('');
  const [apenasVigentes, setApenasVigentes] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [registros, setRegistros] = useState<any[]>([]);

  const buscarAtas = async () => {
    setCarregando(true);
    try {
      const resp = await licitacoesApi.listar({
        local: true,
        q: termo.trim() || undefined,
        uf: uf.trim().toUpperCase() || undefined,
      } as any);
      const lista = resp.data?.items || resp.data?.data || [];
      setRegistros(Array.isArray(lista) ? lista : []);
    } catch {
      setRegistros([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    buscarAtas();
  }, []);

  const filtrados = registros.filter((r) => {
    if (!apenasVigentes) return true;
    const fim = r.dataEncerramentoProposta || r.dataAberturaProposta;
    if (!fim) return true;
    return new Date(fim).getTime() >= Date.now() - 86400000 * 30;
  });

  const valorTotal = filtrados.reduce(
    (s, r) => s + Number(r.valorTotalEstimado ?? r.valorEstimado ?? 0),
    0
  );
  const orgaosUnicos = new Set(filtrados.map((r) => r.orgao || r.orgaoEntidade?.razaoSocial)).size;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#081C3A] text-[#F97316]">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#081C3A]">SRP e Gestao de Atas</h1>
            <p className="text-xs text-slate-500">
              Sistema para adesoes, controle de vigencia e busca de registros de precos reais
            </p>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'geral', label: 'Visao Geral' },
          { id: 'buscador', label: 'Buscador de SRP' },
          { id: 'vigentes', label: 'Atas Vigentes' },
          { id: 'carona', label: 'Adesoes (Carona)' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAba(t.id as any)}
            className={`rounded-xl px-4 py-2 text-xs font-bold ${
              aba === t.id
                ? 'bg-[#0070C0] text-white'
                : 'border border-slate-200 bg-white text-[#081C3A] hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Objeto ou item (ex: software, material escolar)..."
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#081C3A] md:col-span-2"
          />
          <input
            type="text"
            maxLength={2}
            value={uf}
            onChange={(e) => setUf(e.target.value.toUpperCase())}
            placeholder="UF (ex: CE, SP)"
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#081C3A]"
          />
          <button
            type="button"
            disabled={carregando}
            onClick={buscarAtas}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0070C0] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </button>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={apenasVigentes}
            onChange={(e) => setApenasVigentes(e.target.checked)}
            className="rounded accent-[#0070C0]"
          />
          Priorizar processos e atas vigentes
        </label>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <FileSpreadsheet className="h-4 w-4 text-[#0070C0]" /> Registros Encontrados
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{filtrados.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Building2 className="h-4 w-4 text-emerald-600" /> Orgaos Participantes
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{orgaosUnicos}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <DollarSign className="h-4 w-4 text-[#F97316]" /> Valor Total Mapeado
          </div>
          <div className="mt-2 text-lg font-extrabold text-[#081C3A]">{formatarMoeda(valorTotal)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Modalidade SRP</div>
          <div className="mt-2 text-base font-extrabold text-emerald-700">Lei 14.133/2021</div>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-extrabold text-[#081C3A]">
          Resultados ({filtrados.length} registros)
        </h2>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-3">Processo / PNCP</th>
              <th className="py-2 pr-3">Orgao / Entidade</th>
              <th className="py-2 pr-3">Objeto</th>
              <th className="py-2 pr-3">Valor (R$)</th>
              <th className="py-2 text-right">Portal</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.slice(0, 20).map((item, idx) => {
              const url = buildOfficialPncpPortalUrl(item);
              return (
                <tr key={item.id || idx} className="border-b border-slate-100">
                  <td className="py-3 pr-3 font-bold text-[#081C3A]">
                    {item.numeroCompra || item.numeroEdital || item.numeroControlePNCP || 'PNCP'}
                  </td>
                  <td className="py-3 pr-3 font-medium text-slate-700">
                    {item.orgao || item.orgaoEntidade?.razaoSocial || 'Orgao Publico'}
                  </td>
                  <td className="max-w-md truncate py-3 pr-3 text-slate-600">
                    {item.objeto || item.objetoCompra || 'Objeto nao informado'}
                  </td>
                  <td className="py-3 pr-3 font-bold text-emerald-700">
                    {formatarMoeda(item.valorTotalEstimado ?? item.valorEstimado)}
                  </td>
                  <td className="py-3 text-right">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-[#0070C0] hover:underline"
                      >
                        Abrir <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SrpPage;
