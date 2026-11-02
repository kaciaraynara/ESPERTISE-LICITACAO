import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useCompany } from '../contexts/CompanyContext';
import { useAuthStore } from '../store/auth.store';

export interface EditalOption {
  id: string;
  numeroEdital: string;
  orgao: string;
  cnpjOrgao?: string;
  modalidade: string;
  dataCertame?: string;
  objeto?: string;
  fonte: 'monitorado' | 'proposta' | 'padrao';
}

interface EditalSelectorProps {
  label?: string;
  selectedId?: string;
  onSelectEdital: (edital: EditalOption) => void;
  className?: string;
  autoSelectFirst?: boolean;
}

export const EditalSelector: React.FC<EditalSelectorProps> = ({
  label = 'Selecionar Edital Cadastrado / Monitorado',
  selectedId,
  onSelectEdital,
  className = '',
  autoSelectFirst = false,
}) => {
  const [editais, setEditais] = useState<EditalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<string>(selectedId || '');
  const [selectedItem, setSelectedItem] = useState<EditalOption | null>(null);

  const { selectedCompany } = useCompany();
  const authUser = useAuthStore((s) => s.user);
  const companyId = selectedCompany?.id || authUser?.company?.id || (authUser as any)?.company_id;

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setLoadError(false);

    const carregarEditais = async () => {
      const listaFinal: EditalOption[] = [];
      let failedRequests = 0;

      try {
        // 1. Busca Editais Monitorados pela empresa ativa
        const resMonitored = await api
          .get('/monitored-notices', {
            params: { limite: 50, companyId },
          })
          .catch((error) => {
            failedRequests += 1;
            console.error('[EditalSelector] Falha ao carregar editais monitorados.', error);
            return { data: null };
          });

        const rawMonitored = resMonitored.data?.data || [];
        if (Array.isArray(rawMonitored)) {
          for (const item of rawMonitored) {
            const ed = item.edital || item.procurementNotice;
            if (ed) {
              const num = ed.numeroProcesso || ed.noticeNumber || `Edital #${ed.id?.slice(0, 8)}`;
              const org = ed.orgao || ed.buyerName || 'Órgão Licitante Não Informado';
              listaFinal.push({
                id: ed.id || item.id,
                numeroEdital: num,
                orgao: org,
                cnpjOrgao: ed.cnpjOrgao || ed.buyerDocument,
                modalidade: ed.modalidade || 'Pregão Eletrônico',
                dataCertame: ed.dataAbertura ? ed.dataAbertura.slice(0, 10) : undefined,
                objeto: ed.objeto || ed.object,
                fonte: 'monitorado',
              });
            }
          }
        }

        // 2. Busca Propostas vinculadas à empresa ativa
        const resPropostas = await api
          .get('/propostas', {
            params: { companyId },
          })
          .catch((error) => {
            failedRequests += 1;
            console.error('[EditalSelector] Falha ao carregar editais das propostas.', error);
            return { data: null };
          });

        const rawPropostas = resPropostas.data?.data || [];
        if (Array.isArray(rawPropostas)) {
          for (const prop of rawPropostas) {
            const notice = prop.procurementNotice;
            const num = notice?.noticeNumber || prop.titulo || `Proposta #${prop.id?.slice(0, 8)}`;
            const org = notice?.buyerName || 'Órgão Licitante da Proposta';

            // Evita duplicatas se já veio dos monitorados
            if (notice?.id && !listaFinal.some((e) => e.numeroEdital === num)) {
              listaFinal.push({
                id: notice.id,
                numeroEdital: num,
                orgao: org,
                modalidade: notice?.modality || 'Pregão Eletrônico',
                objeto: notice?.object,
                fonte: 'proposta',
              });
            }
          }
        }
      } catch (e) {
        failedRequests += 1;
        console.error('[EditalSelector] Falha ao carregar editais da API.', e);
      }

      if (isMounted) {
        setEditais(listaFinal);
        setLoadError(failedRequests > 0);
        setLoading(false);

        if (autoSelectFirst && listaFinal.length > 0 && !selected) {
          const primeiro = listaFinal[0];
          setSelected(primeiro.id);
          setSelectedItem(primeiro);
          onSelectEdital(primeiro);
        }
      }
    };

    carregarEditais();

    return () => {
      isMounted = false;
    };
  }, [companyId]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelected(val);

    if (!val) {
      setSelectedItem(null);
      return;
    }

    const item = editais.find((ed) => ed.id === val);
    if (item) {
      setSelectedItem(item);
      onSelectEdital(item);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
          <FileText size={14} className="text-[#EA580C]" />
          {label}
        </label>
        {loading && (
          <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
            <Loader2 size={10} className="animate-spin text-[#EA580C]" />
            Sincronizando editais...
          </span>
        )}
      </div>

      {!loading && loadError && (
        <p role="status" className="text-xs text-amber-700">
          Não foi possível consultar todas as fontes de editais. Os resultados exibidos podem estar incompletos.
        </p>
      )}

      <div className="relative">
        <select
          value={selected}
          onChange={handleChange}
          disabled={loading}
          className="w-full py-2.5 pl-3 pr-10 bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C] focus:border-transparent transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          <option value="" className="text-slate-500 font-normal">
            -- Selecione um edital na lista para preenchimento automático --
          </option>

          {editais.map((ed) => (
            <option key={ed.id} value={ed.id} className="text-slate-900 font-medium">
              {ed.numeroEdital} — {ed.orgao} ({ed.modalidade})
            </option>
          ))}
        </select>
      </div>

      {!loading && editais.length === 0 && (
        <p role="status" className="text-xs text-slate-500">
          {loadError
            ? 'Não foi possível carregar editais reais. Tente novamente mais tarde.'
            : 'Nenhum edital monitorado ou vinculado a uma proposta foi encontrado.'}
        </p>
      )}

      {selectedItem && (
        <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-3 text-xs space-y-1.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="font-black text-emerald-800 flex items-center gap-1">
              <CheckCircle2 size={13} className="text-emerald-600" /> Edital real selecionado
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {selectedItem.modalidade}
            </span>
          </div>
          <div className="text-[11px] text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 border-t border-emerald-100">
            <p className="truncate">
              <strong className="text-slate-800">Órgão:</strong> {selectedItem.orgao}
            </p>
            {selectedItem.dataCertame && (
              <p>
                <strong className="text-slate-800">Data do Certame:</strong> {selectedItem.dataCertame}
              </p>
            )}
            {selectedItem.objeto && (
              <p className="sm:col-span-2 line-clamp-1">
                <strong className="text-slate-800">Objeto:</strong> {selectedItem.objeto}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EditalSelector;
