'use client';

export type FaseImpugnacao =
  | 'Análise de Edital'
  | 'Impugnação Protocolada'
  | 'Aguardando Resposta'
  | 'Recurso Administrativo'
  | 'Contrarrazão';

export type RiscoImpugnacao = 'baixo' | 'medio' | 'alto';

export interface KanbanImpugnacaoItem {
  id: string;
  fase: FaseImpugnacao;
  titulo: string;
  orgao: string;
  certame: string;
  prazo: string;
  responsavel?: string;
  risco?: RiscoImpugnacao;
}

interface KanbanImpugnacaoProps {
  items?: KanbanImpugnacaoItem[];
  onSelectItem?: (item: KanbanImpugnacaoItem) => void;
}

const fases: FaseImpugnacao[] = [
  'Análise de Edital',
  'Impugnação Protocolada',
  'Aguardando Resposta',
  'Recurso Administrativo',
  'Contrarrazão',
];

const itensPadrao: KanbanImpugnacaoItem[] = [
  {
    id: 'pe-041-2026',
    fase: 'Análise de Edital',
    titulo: 'Pregão Eletrônico 041/2026',
    orgao: 'Secretaria Municipal de Administração',
    certame: 'Abertura em 03/06/2026',
    prazo: 'Impugnação até 29/05/2026',
    responsavel: 'Jurídico interno',
    risco: 'alto',
  },
  {
    id: 'pe-018-2026',
    fase: 'Impugnação Protocolada',
    titulo: 'Pregão Eletrônico 018/2026',
    orgao: 'Tribunal Regional',
    certame: 'Protocolo registrado',
    prazo: 'Resposta pendente',
    responsavel: 'Contencioso',
    risco: 'medio',
  },
  {
    id: 'cc-006-2026',
    fase: 'Aguardando Resposta',
    titulo: 'Concorrência 006/2026',
    orgao: 'Companhia Estadual de Tecnologia',
    certame: 'Último dia útil anterior ao certame',
    prazo: 'Acompanhar publicação oficial',
    responsavel: 'Coordenação jurídica',
    risco: 'baixo',
  },
];

const riscoClasses: Record<RiscoImpugnacao, string> = {
  baixo: 'border-brand-blue text-brand-blue',
  medio: 'border-[#4B1FA6] text-[#4B1FA6]',
  alto: 'border-[#4B1FA6] bg-[#4B1FA6] text-white',
};

export default function KanbanImpugnacao({
  items = itensPadrao,
  onSelectItem,
}: KanbanImpugnacaoProps) {
  const total = items.length;

  return (
    <section className="rounded-3xl border-2 border-slate-100 bg-white shadow-xl overflow-hidden mt-8">
      <div className="border-b-2 border-slate-100 px-8 py-8 md:px-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-brand-orange">
              Módulo de Impugnação
            </p>
            <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
              Kanban de Impugnações
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-xl border-2 border-brand-blue/30 bg-blue-50/50 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-brand-blue">
              {total} procedimento{total === 1 ? '' : 's'}
            </span>
            <span className="rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500">
              Lei 14.133/2021
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-slate-50 p-6 md:p-8 custom-scrollbar">
        <div className="flex min-w-[1120px] gap-6">
          {fases.map((fase, index) => {
            const itensDaFase = items.filter((item) => item.fase === fase);

            return (
              <div
                key={fase}
                className="flex w-[320px] min-h-[520px] flex-col rounded-2xl border-2 border-slate-200 bg-slate-100 shadow-sm"
              >
                <header className="border-b-2 border-slate-200 px-6 py-5 bg-white rounded-t-2xl">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-black tracking-widest text-brand-orange uppercase">
                        Etapa 0{index + 1}
                      </span>
                      <h2 className="mt-2 text-base font-black leading-snug text-slate-900">
                        {fase}
                      </h2>
                    </div>
                    <span className="inline-flex min-w-8 items-center justify-center rounded-lg border-2 border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-black text-slate-600">
                      {itensDaFase.length}
                    </span>
                  </div>
                </header>

                <div className="flex flex-1 flex-col gap-4 p-4">
                  {itensDaFase.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectItem?.(item)}
                      className="group w-full rounded-2xl border-2 border-slate-200 bg-white p-5 text-left transition-all hover:-translate-y-1 hover:border-brand-blue hover:shadow-lg focus:outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="text-sm font-black leading-snug text-slate-900 group-hover:text-brand-blue transition-colors line-clamp-2">
                          {item.titulo}
                        </h3>
                        {item.risco && (
                          <span
                            className={`shrink-0 rounded-lg border-2 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${riscoClasses[item.risco]}`}
                          >
                            {item.risco}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs font-semibold text-slate-500 line-clamp-1">
                        {item.orgao}
                      </p>

                      <div className="mt-4 space-y-2">
                        <div className="rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                          {item.certame}
                        </div>
                        <div className="rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                          {item.prazo}
                        </div>
                      </div>

                      <div className="mt-5 border-t-2 border-slate-100 pt-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {item.responsavel || 'Sem responsável'}
                        </span>
                      </div>
                    </button>
                  ))}

                  {itensDaFase.length === 0 && (
                    <div className="flex min-h-32 items-center justify-center border border-dashed border-brand-blue/20 bg-white px-4 text-center">
                      <p className="text-xs font-semibold leading-relaxed text-brand-blue">
                        Nenhum procedimento nesta fase.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
