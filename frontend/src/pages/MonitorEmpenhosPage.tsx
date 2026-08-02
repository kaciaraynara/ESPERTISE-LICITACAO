import { FileCheck2, Clock } from '@components/icons/phosphor-compat';

export default function MonitorEmpenhosPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-blue flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg">
              <FileCheck2 className="w-6 h-6 text-brand-blue" />
            </div>
            Monitor de Empenhos
          </h1>
          <p className="text-brand-blue/70 mt-1">Acompanhamento automático do Diário Oficial. Não perca prazos de entrega.</p>
        </div>
      </div>

      <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden min-h-[400px] flex flex-col items-center justify-center p-10 text-center">
        <div className="w-16 h-16 bg-white border border-gray-100 rounded-lg flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-brand-blue/70" />
        </div>
        <h3 className="text-xl font-bold text-brand-blue mb-2">Sem empenhos aguardando ação</h3>
        <p className="text-brand-blue/70 max-w-md">
          O monitor está varrendo o Diário Oficial neste exato momento para alertá-lo quando as notas de empenho dos seus contratos ativos forem publicadas.
        </p>
      </div>
    </div>
  );
}

