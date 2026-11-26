import React, { useMemo, useState } from 'react';
import brazilMap from '@svg-maps/brazil';
import { MapPin } from 'lucide-react';

export interface UfMapDatum {
  uf: string;
  quantidade: number;
  volume: number;
}

interface BrazilMapChartProps {
  data: UfMapDatum[];
  selectedUf: string;
  companyUf?: string;
  onSelectUf: (uf: string) => void;
  formatCurrency: (val: number) => string;
}

interface SvgLocation {
  id: string;
  name: string;
  path: string;
}

const UF_LABEL_COORDS: Record<string, [number, number]> = {
  AC: [52, 232],
  AL: [574, 231],
  AP: [324, 62],
  AM: [152, 148],
  BA: [492, 286],
  CE: [544, 178],
  DF: [410, 330],
  ES: [511, 398],
  GO: [380, 342],
  MA: [446, 178],
  MT: [275, 290],
  MS: [298, 412],
  MG: [452, 386],
  PA: [338, 158],
  PB: [584, 198],
  PR: [358, 478],
  PE: [552, 214],
  PI: [484, 206],
  RJ: [480, 444],
  RN: [582, 178],
  RS: [328, 566],
  RO: [164, 256],
  RR: [204, 58],
  SC: [370, 520],
  SP: [404, 446],
  SE: [560, 250],
  TO: [402, 248],
};

function getFillColor(qtd: number, maxQtd: number, isSelected: boolean, isHovered: boolean): string {
  if (isSelected) return '#EA580C';
  if (isHovered) return qtd > 0 ? '#005A9C' : '#CBD5E1';
  if (qtd <= 0) return '#F1F5F9';
  const ratio = maxQtd > 0 ? qtd / maxQtd : 0;
  if (ratio >= 0.65) return '#0B192C';
  if (ratio >= 0.35) return '#0070C0';
  if (ratio >= 0.15) return '#60A5FA';
  return '#BFDBFE';
}

export const BrazilMapChart: React.FC<BrazilMapChartProps> = ({
  data,
  selectedUf,
  companyUf,
  onSelectUf,
  formatCurrency,
}) => {
  const [hoveredUf, setHoveredUf] = useState<string | null>(null);

  const locations = (brazilMap as { viewBox: string; locations: SvgLocation[] }).locations;
  const viewBox = (brazilMap as { viewBox: string }).viewBox;

  const dataByUf = useMemo(() => {
    const map = new Map<string, UfMapDatum>();
    for (const item of data) {
      const uf = String(item.uf || '').trim().toUpperCase();
      if (uf && uf !== 'BR' && uf !== 'TODOS') {
        map.set(uf, item);
      }
    }
    return map;
  }, [data]);

  const maxQtd = useMemo(() => {
    let max = 0;
    for (const item of dataByUf.values()) {
      if (item.quantidade > max) max = item.quantidade;
    }
    return max;
  }, [dataByUf]);

  const topStates = useMemo(() => {
    return Array.from(dataByUf.values())
      .sort((a, b) => b.quantidade - a.quantidade || b.volume - a.volume)
      .slice(0, 7);
  }, [dataByUf]);

  const activeInspectUf = hoveredUf || (selectedUf !== 'TODOS' ? selectedUf : null);
  const activeInspectLoc = activeInspectUf
    ? locations.find((l) => l.id.toUpperCase() === activeInspectUf)
    : null;
  const activeInspectData = activeInspectUf ? dataByUf.get(activeInspectUf) : undefined;

  return (
    <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-[#0070C0]" />
          <h2 className="text-sm font-bold text-[#081C3A]">
            Mapa de Oportunidades por Estado (27 UFs) — Clique para filtrar
          </h2>
        </div>
        {selectedUf !== 'TODOS' ? (
          <button
            type="button"
            onClick={() => onSelectUf('TODOS')}
            className="text-xs font-bold text-[#EA580C] hover:underline cursor-pointer"
          >
            Limpar filtro ({selectedUf}) · Ver Todo o Brasil
          </button>
        ) : (
          <span className="text-xs text-slate-500">Passe o mouse ou clique em um estado</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Mapa SVG interativo do Brasil */}
        <div className="md:col-span-7 relative flex flex-col items-center justify-center">
          <svg
            viewBox={viewBox}
            className="w-full max-w-[360px] h-auto select-none drop-shadow-xs"
            role="img"
            aria-label="Mapa do Brasil com distribuição de oportunidades por estado"
          >
            {locations.map((loc) => {
              const uf = loc.id.toUpperCase();
              const info = dataByUf.get(uf);
              const qtd = info?.quantidade || 0;
              const isSelected = selectedUf === uf;
              const isHovered = hoveredUf === uf;
              const fill = getFillColor(qtd, maxQtd, isSelected, isHovered);

              return (
                <path
                  key={uf}
                  d={loc.path}
                  fill={fill}
                  stroke={isSelected ? '#9A3412' : '#FFFFFF'}
                  strokeWidth={isSelected ? 2 : 1.1}
                  className="transition-colors duration-150 cursor-pointer outline-none"
                  onMouseEnter={() => setHoveredUf(uf)}
                  onMouseLeave={() => setHoveredUf((prev) => (prev === uf ? null : prev))}
                  onClick={() => onSelectUf(isSelected ? 'TODOS' : uf)}
                >
                  <title>
                    {loc.name} ({uf}): {qtd} edital(is)
                    {info?.volume ? ` · ${formatCurrency(info.volume)}` : ''}
                  </title>
                </path>
              );
            })}

            {locations.map((loc) => {
              const uf = loc.id.toUpperCase();
              const coords = UF_LABEL_COORDS[uf];
              if (!coords) return null;
              const info = dataByUf.get(uf);
              const qtd = info?.quantidade || 0;
              const isSelected = selectedUf === uf;
              const darkBg =
                isSelected || (maxQtd > 0 && qtd / maxQtd >= 0.35);

              return (
                <text
                  key={`label-${uf}`}
                  x={coords[0]}
                  y={coords[1]}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none select-none font-bold"
                  fontSize={uf === 'DF' || uf === 'SE' || uf === 'AL' ? 9 : 10}
                  fill={darkBg ? '#FFFFFF' : '#1E293B'}
                >
                  {uf}
                </text>
              );
            })}
          </svg>

          {/* Legenda compacta */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#F1F5F9] border border-slate-300" />
              Sem editais
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#BFDBFE]" />
              Baixo
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#0070C0]" />
              Médio
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#0B192C]" />
              Alto
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#EA580C]" />
              Selecionado
            </span>
          </div>
        </div>

        {/* Painel lateral do mapa: destaque do estado + ranking */}
        <div className="md:col-span-5 flex flex-col gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
            {activeInspectUf ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#0B192C]">
                    {activeInspectLoc?.name || activeInspectUf} ({activeInspectUf})
                  </span>
                  {companyUf === activeInspectUf && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Sede
                    </span>
                  )}
                </div>
                <p className="text-lg font-black text-[#0070C0]">
                  {activeInspectData?.quantidade ?? 0}{' '}
                  <span className="text-xs font-semibold text-slate-500">
                    {(activeInspectData?.quantidade ?? 0) === 1 ? 'edital no recorte' : 'editais no recorte'}
                  </span>
                </p>
                <p className="text-xs font-semibold text-slate-600">
                  Volume: {formatCurrency(activeInspectData?.volume ?? 0)}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#0B192C]">Visão Nacional (Brasil)</p>
                <p className="text-xs text-slate-500">
                  {dataByUf.size} estado(s) com oportunidades abertas no filtro atual. Clique em qualquer UF no mapa para filtrar.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Estados com mais oportunidades
            </p>
            {topStates.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">Nenhum estado encontrado neste recorte.</p>
            ) : (
              <div className="space-y-1.5">
                {topStates.map((item) => {
                  const ativo = selectedUf === item.uf;
                  return (
                    <button
                      key={item.uf}
                      type="button"
                      onClick={() => onSelectUf(ativo ? 'TODOS' : item.uf)}
                      onMouseEnter={() => setHoveredUf(item.uf)}
                      onMouseLeave={() => setHoveredUf((prev) => (prev === item.uf ? null : prev))}
                      className={`w-full flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs transition cursor-pointer ${
                        ativo
                          ? 'bg-[#0B192C] border-[#0B192C] text-white'
                          : 'bg-white border-slate-200 text-[#0B192C] hover:border-[#0070C0] hover:bg-blue-50/40'
                      }`}
                    >
                      <span className="font-bold flex items-center gap-1.5">
                        <span>{item.uf}</span>
                        {companyUf === item.uf && (
                          <span className={`text-[10px] font-semibold ${ativo ? 'text-emerald-300' : 'text-emerald-700'}`}>
                            (Sede)
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-2 font-semibold">
                        <span className={ativo ? 'text-orange-300' : 'text-[#0070C0]'}>
                          {item.quantidade}
                        </span>
                        <span className={`text-[11px] ${ativo ? 'text-slate-300' : 'text-slate-500'}`}>
                          {formatCurrency(item.volume)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
