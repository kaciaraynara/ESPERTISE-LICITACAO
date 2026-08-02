import { FileCheck2, Receipt } from '@components/icons/phosphor-compat';

export default function GestaoArpPage() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 font-inter h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-[#002A5C] flex items-center gap-3 font-['Plus_Jakarta_Sans'] tracking-tight">
            Gestão de Contratos e ARP
          </h1>
          <p className="text-brand-blue/70 mt-2 font-medium">Controle de empenhos, saldos de atas e emissão de notas fiscais.</p>
        </div>
      </div>

      <div className="bg-white rounded-[12px] shadow-sm border border-[#E2E8F0] overflow-hidden p-6">
        <h3 className="uppercase tracking-widest text-[10px] font-bold text-brand-blue/70 mb-4">Saldos de Atas Ativas</h3>
        
        <div className="space-y-6">
          <div className="border border-gray-100 rounded p-4 bg-white">
            <div className="flex justify-between items-center mb-2">
              <div>
                <p className="font-bold text-[#002A5C] text-sm">Aquisição de Licenças Microsoft - Pregão 12/2026</p>
                <p className="text-xs text-brand-blue/70">Tribunal de Justiça (UASG: 200109)</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-brand-blue/70 font-bold uppercase tracking-wider">Restante na Ata</p>
                <p className="font-bold text-brand-blue">R$ 800.000 / R$ 1.250.000</p>
              </div>
            </div>
            {/* Barra de Progresso */}
            <div className="h-3 w-full bg-white rounded-lg overflow-hidden">
              <div className="h-full bg-[#0052CC]" style={{ width: '36%' }}></div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-2">
               <button className="px-3 py-1.5 text-xs font-bold bg-white border border-gray-100 text-brand-blue/70 rounded flex items-center gap-1.5 hover:bg-white">
                 <FileCheck2 className="w-3.5 h-3.5" /> Controle de Empenhos
               </button>
               <button className="px-3 py-1.5 text-xs font-bold bg-[#0052CC] text-white rounded flex items-center gap-1.5 hover:bg-[#004A99] active:scale-95 transition-all">
                 <Receipt className="w-3.5 h-3.5" /> Exportar ERP / NF
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

