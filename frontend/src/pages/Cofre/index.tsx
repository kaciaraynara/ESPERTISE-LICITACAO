
export default function CofrePage() {
  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-blue mb-2">Cofre de CertidÃµes</h1>
          <p className="text-slate-500">Mantenha seus documentos em dia. Nosso robÃ´ avisa quando algo estiver perto de vencer.</p>
        </div>
        <button className="bg-brand-orange hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors shadow-[0_4px_14px_rgba(255,90,0,0.3)]">
          + Novo Documento
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-[0_4px_20px_rgba(0,39,135,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500 tracking-wider">
                <th className="p-4">Documento</th>
                <th className="p-4">Data EmissÃ£o</th>
                <th className="p-4">Data Validade</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">AÃ§Ãµes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/50 transition-colors group">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-brand-blue">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256"><path fill="currentColor" d="M213.66 82.34l-56-56A8 8 0 0 0 152 24H56a16 16 0 0 0-16 16v176a16 16 0 0 0 16 16h144a16 16 0 0 0 16-16V88a8 8 0 0 0-2.34-5.66M160 51.31L188.69 80H160ZM200 216H56V40h88v48a8 8 0 0 0 8 8h48v120z"></path></svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700">CertidÃ£o Receita Federal</h4>
                      <p className="text-xs text-slate-400">Regularidade Fiscal</p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-sm text-slate-600">10/01/2026</td>
                <td className="p-4 text-sm font-semibold text-slate-700">10/07/2026</td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> VÃ¡lido
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button className="text-brand-blue hover:text-brand-orange font-medium text-sm transition-colors">Ver PDF</button>
                </td>
              </tr>
              
              <tr className="hover:bg-slate-50/50 transition-colors group">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-brand-orange">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256"><path fill="currentColor" d="M213.66 82.34l-56-56A8 8 0 0 0 152 24H56a16 16 0 0 0-16 16v176a16 16 0 0 0 16 16h144a16 16 0 0 0 16-16V88a8 8 0 0 0-2.34-5.66M160 51.31L188.69 80H160ZM200 216H56V40h88v48a8 8 0 0 0 8 8h48v120z"></path></svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-700">CertidÃ£o FGTS</h4>
                      <p className="text-xs text-slate-400">Caixa EconÃ´mica</p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-sm text-slate-600">05/06/2026</td>
                <td className="p-4 text-sm font-semibold text-slate-700">05/07/2026</td>
                <td className="p-4">
                  <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs font-bold bg-orange-50 text-brand-orange border border-orange-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse"></span> Vence em 5 dias
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button className="text-brand-blue hover:text-brand-orange font-medium text-sm transition-colors">Substituir</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


