import React, { useEffect, useState } from 'react';
import {
  Bot,
  ExternalLink,
  Plus,
  Trash2,
  Download,
  Globe,
  Table2,
} from 'lucide-react';
import { EditalOption, EditalSelector } from '@/components/EditalSelector';
import { buildOfficialPncpPortalUrl } from '@/utils/pncp';

interface LinhaPlanilha {
  id: string;
  item: string;
  descricao: string;
  quantidade: number;
  valorReferencia: number;
  lanceInicial: number;
  lanceAlvo: number;
  pisoMinimo: number;
}

const PORTAIS_OFICIAIS = [
  { nome: 'Compras.gov.br', url: 'https://www.gov.br/compras/pt-br' },
  { nome: 'PNCP', url: 'https://pncp.gov.br/app/editais' },
  { nome: 'Portal de Compras Publicas', url: 'https://www.portaldecompraspublicas.com.br/' },
  { nome: 'BLL Compras', url: 'https://bll.org.br/' },
  { nome: 'BNC', url: 'https://bnc.org.br/' },
  { nome: 'Licitacoes-e (BB)', url: 'https://www.licitacoes-e.com.br/' },
];

function formatarMoeda(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

export const RoboPage: React.FC = () => {
  const [edital, setEdital] = useState<EditalOption | null>(null);
  const [urlNavegador, setUrlNavegador] = useState('https://pncp.gov.br/app/editais');
  const [urlAtiva, setUrlAtiva] = useState('');
  const [reducaoPadrao, setReducaoPadrao] = useState(8);
  const [margemSeguranca, setMargemSeguranca] = useState(15);
  const [linhas, setLinhas] = useState<LinhaPlanilha[]>([]);

  useEffect(() => {
    if (!edital) return;
    const urlPncp = buildOfficialPncpPortalUrl(edital);
    if (urlPncp) {
      setUrlNavegador(urlPncp);
      setUrlAtiva(urlPncp);
    }

    const itensReais = edital.itens || [];
    if (itensReais.length > 0) {
      setLinhas(
        itensReais.map((it, idx) => {
          const ref = Number(it.valorUnitarioEstimado || 0);
          return {
            id: String(it.id || idx),
            item: String(it.numeroItem ?? idx + 1),
            descricao: it.descricao || 'Item do edital',
            quantidade: Number(it.quantidade || 1),
            valorReferencia: ref,
            lanceInicial: ref,
            lanceAlvo: Number((ref * (1 - reducaoPadrao / 100)).toFixed(2)),
            pisoMinimo: Number((ref * (1 - margemSeguranca / 100)).toFixed(2)),
          };
        })
      );
    } else if (edital.valorEstimado) {
      const ref = Number(edital.valorEstimado);
      setLinhas([
        {
          id: 'lote-unico',
          item: '1',
          descricao: edital.objeto || 'Objeto Global do Edital',
          quantidade: 1,
          valorReferencia: ref,
          lanceInicial: ref,
          lanceAlvo: Number((ref * (1 - reducaoPadrao / 100)).toFixed(2)),
          pisoMinimo: Number((ref * (1 - margemSeguranca / 100)).toFixed(2)),
        },
      ]);
    }
  }, [edital]);

  const adicionarLinha = () => {
    setLinhas((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        item: String(prev.length + 1),
        descricao: '',
        quantidade: 1,
        valorReferencia: 0,
        lanceInicial: 0,
        lanceAlvo: 0,
        pisoMinimo: 0,
      },
    ]);
  };

  const atualizarCelula = (id: string, campo: keyof LinhaPlanilha, valor: string | number) => {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const atualizado = { ...l, [campo]: valor };
        if (campo === 'valorReferencia') {
          const ref = Number(valor || 0);
          atualizado.lanceInicial = ref;
          atualizado.lanceAlvo = Number((ref * (1 - reducaoPadrao / 100)).toFixed(2));
          atualizado.pisoMinimo = Number((ref * (1 - margemSeguranca / 100)).toFixed(2));
        }
        return atualizado;
      })
    );
  };

  const removerLinha = (id: string) => {
    setLinhas((prev) => prev.filter((l) => l.id !== id));
  };

  const exportarCsvExcel = () => {
    if (linhas.length === 0) return;
    const header = 'Item;Descricao;Quantidade;Referencia_PNCP;Lance_Inicial;Lance_Alvo;Piso_Minimo;Total_Alvo\n';
    const body = linhas
      .map(
        (l) =>
          `"${l.item}";"${l.descricao.replace(/"/g, '""')}";${l.quantidade};${l.valorReferencia};${l.lanceInicial};${l.lanceAlvo};${l.pisoMinimo};${(l.quantidade * l.lanceAlvo).toFixed(2)}`
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `planilha-lances-${edital?.numeroEdital || 'disputa'}.csv`;
    link.click();
  };

  const totalAlvo = linhas.reduce((s, l) => s + l.quantidade * l.lanceAlvo, 0);
  const totalPiso = linhas.reduce((s, l) => s + l.quantidade * l.pisoMinimo, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-3 py-4 sm:p-6">
      {/* Cabecalho */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#081C3A] text-[#F97316]">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-[#081C3A]">
              Sala de Disputa & Planilha do Robo de Lances
            </h1>
            <p className="text-xs text-slate-500">
              Acesse o portal da disputa integrado e controle os precos por item em formato planilha
            </p>
          </div>
        </div>
        <div className="w-full md:w-80">
          <EditalSelector onSelectEdital={(e) => setEdital(e)} />
        </div>
      </div>

      {/* Navegador Integrado de Portais de Disputa */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
            <Globe className="h-4 w-4 text-[#0070C0]" /> Navegador de Portais de Disputa
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PORTAIS_OFICIAIS.map((p) => (
              <button
                key={p.nome}
                type="button"
                onClick={() => {
                  setUrlNavegador(p.url);
                  setUrlAtiva(p.url);
                }}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-[#081C3A] hover:border-[#F97316]"
              >
                {p.nome}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={urlNavegador}
            onChange={(e) => setUrlNavegador(e.target.value)}
            placeholder="Cole o link do portal de disputa (Compras.gov.br, BLL, BNC, PNCP)..."
            className="w-full flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#081C3A]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setUrlAtiva(urlNavegador)}
              className="rounded-xl bg-[#081C3A] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              Abrir Aqui
            </button>
            <a
              href={urlAtiva}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-bold text-white hover:bg-orange-600"
            >
              Janela Externa <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {urlAtiva ? (
            <iframe
              src={urlAtiva}
              title="Portal de Disputa Integrado"
              className="h-[360px] w-full bg-white"
            />
          ) : (
            <div className="flex h-44 flex-col items-center justify-center gap-2 p-4 text-center text-xs text-slate-500">
              <span>Clique em um dos portais acima ou em <strong>Abrir Aqui</strong> para carregar a sala de disputa.</span>
            </div>
          )}
        </div>
        <p className="text-[11px] text-slate-500">
          Observacao: alguns portais governamentais bloqueiam exibicao embutida por seguranca do navegador. Caso a tela fique em branco, clique em <strong>Janela Externa</strong> para operar lado a lado com a planilha abaixo.
        </p>
      </div>

      {/* Planilha Estilo Excel de Precos e Lances */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
              <Table2 className="h-4 w-4 text-emerald-600" /> Planilha de Precos e Lances (Estilo Excel)
            </h2>
            <p className="text-xs text-slate-500">
              Edite qualquer celula de preco diretamente; os calculos de total e piso minimo atualizam na hora
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">
              Reducao (%):
              <input
                type="number"
                value={reducaoPadrao}
                onChange={(e) => setReducaoPadrao(Number(e.target.value))}
                className="ml-1.5 w-14 rounded border border-slate-300 px-1.5 py-1 text-xs"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Piso (%):
              <input
                type="number"
                value={margemSeguranca}
                onChange={(e) => setMargemSeguranca(Number(e.target.value))}
                className="ml-1.5 w-14 rounded border border-slate-300 px-1.5 py-1 text-xs"
              />
            </label>
            <button
              type="button"
              onClick={adicionarLinha}
              className="inline-flex items-center gap-1 rounded-xl border border-[#081C3A] px-3 py-1.5 text-xs font-bold text-[#081C3A] hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar Item
            </button>
            <button
              type="button"
              onClick={exportarCsvExcel}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <Download className="h-3.5 w-3.5" /> Exportar Excel (.CSV)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[780px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[#081C3A] text-white">
                <th className="border border-slate-700 px-2.5 py-2 w-14">Item</th>
                <th className="border border-slate-700 px-2.5 py-2">Descricao</th>
                <th className="border border-slate-700 px-2.5 py-2 w-20">Qtd</th>
                <th className="border border-slate-700 px-2.5 py-2 w-28">Ref. PNCP</th>
                <th className="border border-slate-700 px-2.5 py-2 w-28">Lance Inicial</th>
                <th className="border border-slate-700 px-2.5 py-2 w-28">Lance Alvo</th>
                <th className="border border-slate-700 px-2.5 py-2 w-28">Piso Minimo</th>
                <th className="border border-slate-700 px-2.5 py-2 w-28">Total Alvo</th>
                <th className="border border-slate-700 px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-500">
                    Selecione um edital acima para carregar os itens automaticamente ou clique em <strong>+ Adicionar Item</strong>.
                  </td>
                </tr>
              ) : (
                linhas.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="border border-slate-200 p-1">
                      <input
                        type="text"
                        value={l.item}
                        onChange={(e) => atualizarCelula(l.id, 'item', e.target.value)}
                        className="w-full bg-transparent px-1.5 py-1 font-bold text-[#081C3A] outline-none"
                      />
                    </td>
                    <td className="border border-slate-200 p-1">
                      <input
                        type="text"
                        value={l.descricao}
                        onChange={(e) => atualizarCelula(l.id, 'descricao', e.target.value)}
                        placeholder="Descricao do item..."
                        className="w-full bg-transparent px-1.5 py-1 outline-none"
                      />
                    </td>
                    <td className="border border-slate-200 p-1">
                      <input
                        type="number"
                        value={l.quantidade}
                        onChange={(e) => atualizarCelula(l.id, 'quantidade', Number(e.target.value))}
                        className="w-full bg-transparent px-1.5 py-1 text-right outline-none"
                      />
                    </td>
                    <td className="border border-slate-200 p-1">
                      <input
                        type="number"
                        step="0.01"
                        value={l.valorReferencia}
                        onChange={(e) => atualizarCelula(l.id, 'valorReferencia', Number(e.target.value))}
                        className="w-full bg-transparent px-1.5 py-1 text-right outline-none"
                      />
                    </td>
                    <td className="border border-slate-200 p-1">
                      <input
                        type="number"
                        step="0.01"
                        value={l.lanceInicial}
                        onChange={(e) => atualizarCelula(l.id, 'lanceInicial', Number(e.target.value))}
                        className="w-full bg-transparent px-1.5 py-1 text-right outline-none"
                      />
                    </td>
                    <td className="border border-slate-200 bg-emerald-50/40 p-1">
                      <input
                        type="number"
                        step="0.01"
                        value={l.lanceAlvo}
                        onChange={(e) => atualizarCelula(l.id, 'lanceAlvo', Number(e.target.value))}
                        className="w-full bg-transparent px-1.5 py-1 text-right font-bold text-emerald-700 outline-none"
                      />
                    </td>
                    <td className="border border-slate-200 bg-amber-50/40 p-1">
                      <input
                        type="number"
                        step="0.01"
                        value={l.pisoMinimo}
                        onChange={(e) => atualizarCelula(l.id, 'pisoMinimo', Number(e.target.value))}
                        className="w-full bg-transparent px-1.5 py-1 text-right font-bold text-amber-700 outline-none"
                      />
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-bold text-[#081C3A]">
                      {formatarMoeda(l.quantidade * l.lanceAlvo)}
                    </td>
                    <td className="border border-slate-200 p-1 text-center">
                      <button
                        type="button"
                        onClick={() => removerLinha(l.id)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap justify-end gap-6 text-xs font-bold">
          <span className="text-emerald-700">Total Lance Alvo: {formatarMoeda(totalAlvo)}</span>
          <span className="text-amber-700">Total Piso Minimo: {formatarMoeda(totalPiso)}</span>
        </div>
      </div>
    </div>
  );
};

export default RoboPage;
