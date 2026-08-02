'use client';

export type FaseKanbanRecursal =
  | 'Análise de Edital'
  | 'Impugnação Protocolada'
  | 'Aguardando Resposta'
  | 'Recurso'
  | 'Contrarrazão';

export interface KanbanRecursalItem {
  id: string;
  fase: FaseKanbanRecursal;
  titulo: string;
  orgao: string;
  certame: string;
  prazo: string;
  responsavel?: string;
  risco?: 'baixo' | 'medio' | 'alto';
}

interface KanbanRecursalProps {
  items?: KanbanRecursalItem[];
  onSelectItem?: (item: KanbanRecursalItem) => void;
}

const fases: FaseKanbanRecursal[] = [
  'Análise de Edital',
  'Impugnação Protocolada',
  'Aguardando Resposta',
  'Recurso',
  'Contrarrazão',
];

const itensPadrao: KanbanRecursalItem[] = [
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

const riscoClasses: Record<NonNullable<KanbanRecursalItem['risco']>, string> = {
  baixo: 'border-brand-blue text-brand-blue',
  medio: 'border-[#4B1FA6] text-[#4B1FA6]',
  alto: 'border-[#4B1FA6] bg-[#4B1FA6] text-white',
};

export default function KanbanRecursal({ items = itensPadrao, onSelectItem }: KanbanRecursalProps) {
  const total = items.length;

  return (
    <section className="min-h-full bg-white text-brand-blue">
      <div className="border-b border-brand-blue/15 bg-white px-5 py-5 md:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4B1FA6]">
              Módulo de Impugnação
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-brand-blue">
              Kanban Recursal
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="border border-brand-blue/20 bg-white px-3 py-1.5 text-xs font-semibold text-brand-blue">
              {total} procedimento{total === 1 ? '' : 's'}
            </span>
            <span className="border border-[#4B1FA6]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#4B1FA6]">
              Lei 14.133
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white px-5 py-6 md:px-8">
        <div className="grid min-w-[1120px] grid-cols-5 gap-3">
          {fases.map((fase, index) => {
            const itensDaFase = items.filter((item) => item.fase === fase);

            return (
              <div
                key={fase}
                className="flex min-h-[520px] flex-col border border-brand-blue/15 bg-white"
              >
                <header className="border-b border-brand-blue/15 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-semibold text-[#4B1FA6]">
                        0{index + 1}
                      </span>
                      <h2 className="mt-1 text-sm font-semibold leading-snug text-brand-blue">
                        {fase}
                      </h2>
                    </div>
                    <span className="min-w-8 border border-brand-blue/20 bg-white px-2 py-1 text-center text-xs font-semibold text-brand-blue">
                      {itensDaFase.length}
                    </span>
                  </div>
                </header>

                <div className="flex flex-1 flex-col gap-3 p-3">
                  {itensDaFase.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectItem?.(item)}
                      className="w-full border border-brand-blue/15 bg-white p-4 text-left transition hover:border-[#4B1FA6] focus:border-[#4B1FA6]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold leading-snug text-brand-blue">
                          {item.titulo}
                        </h3>
                        {item.risco && (
                          <span className={`shrink-0 border px-2 py-1 text-[10px] font-semibold uppercase ${riscoClasses[item.risco]}`}>
                            {item.risco}
                          </span>
                        )}
                      </div>

                      <dl className="mt-4 space-y-3 text-xs">
                        <div>
                          <dt className="font-semibold uppercase tracking-[0.12em] text-[#4B1FA6]">Órgão</dt>
                          <dd className="mt-1 leading-snug text-brand-blue">{item.orgao}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold uppercase tracking-[0.12em] text-[#4B1FA6]">Certame</dt>
                          <dd className="mt-1 leading-snug text-brand-blue">{item.certame}</dd>
                        </div>
                        <div>
                          <dt className="font-semibold uppercase tracking-[0.12em] text-[#4B1FA6]">Prazo</dt>
                          <dd className="mt-1 leading-snug text-brand-blue">{item.prazo}</dd>
                        </div>
                        {item.responsavel && (
                          <div>
                            <dt className="font-semibold uppercase tracking-[0.12em] text-[#4B1FA6]">Responsável</dt>
                            <dd className="mt-1 leading-snug text-brand-blue">{item.responsavel}</dd>
                          </div>
                        )}
                      </dl>
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
