import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import api, { crmApi, licitacoesApi } from '../services/api';
import { useCompany } from '../contexts/CompanyContext';
import { useAuthStore } from '../store/auth.store';

export interface EditalOption {
  id: string;
  numeroEdital: string;
  numeroControlePNCP?: string;
  orgao: string;
  cnpjOrgao?: string;
  modalidade: string;
  dataCertame?: string;
  objeto?: string;
  valorEstimado?: number;
  urlOficialPncp?: string;
  itens?: Array<{
    id?: string;
    numeroItem?: number;
    descricao: string;
    quantidade: number;
    unidadeMedida?: string;
    valorUnitarioEstimado?: number | null;
    valorTotalEstimado?: number | null;
  }>;
  fonte: 'salvo' | 'monitorado' | 'proposta' | 'padrao';
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

      // 0. Busca Editais Salvos para Disputar via rota dedicada GET /api/licitacoes/salvos
      try {
        const resSalvos = await licitacoesApi.listarSalvos().catch(() => ({ data: null }));
        const rawSalvos = resSalvos.data?.data || [];
        if (Array.isArray(rawSalvos)) {
          for (const ed of rawSalvos) {
            if (ed && ed.id && !listaFinal.some((x) => x.id === ed.id)) {
              listaFinal.push({
                id: ed.id,
                numeroEdital: ed.numeroEdital || ed.numeroControlePNCP || `Edital #${String(ed.id).slice(0, 8)}`,
                numeroControlePNCP: ed.numeroControlePNCP,
                orgao: ed.orgao || 'Órgão Licitante',
                cnpjOrgao: ed.cnpjOrgao,
                modalidade: ed.modalidade || 'Pregão Eletrônico',
                dataCertame: ed.dataLimite ? String(ed.dataLimite).slice(0, 10) : ed.dataAbertura ? String(ed.dataAbertura).slice(0, 10) : undefined,
                objeto: ed.objeto,
                valorEstimado: ed.valorEstimado != null ? Number(ed.valorEstimado) : undefined,
                urlOficialPncp: ed.urlOficialPncp,
                itens: Array.isArray(ed.itens) ? ed.itens : [],
                fonte: 'salvo',
              });
            }
          }
        }
      } catch (salvosErr) {
        console.warn('[EditalSelector] Aviso ao carregar /licitacoes/salvos:', salvosErr);
      }

      // 1. Busca Editais Salvos para Disputar (Pipeline de Oportunidades do CRM)
      try {
        const resCrm = await crmApi.getOportunidades().catch((error) => {
          console.warn('[EditalSelector] Aviso ao carregar oportunidades do CRM:', error);
          return { data: null };
        });

        const rawCrm = resCrm.data?.data || [];
        if (Array.isArray(rawCrm)) {
          for (const item of rawCrm) {
            const ed = item.notice || item.edital || item.procurementNotice;
            if (ed && ed.id) {
              const num = ed.noticeNumber || ed.numeroProcesso || `Edital #${ed.id.slice(0, 8)}`;
              const org = ed.buyerName || ed.orgao || 'Órgão Licitante Não Informado';
              if (!listaFinal.some((x) => x.id === ed.id)) {
                listaFinal.push({
                  id: ed.id,
                  numeroEdital: num,
                  orgao: org,
                  cnpjOrgao: ed.buyerDocument || ed.cnpjOrgao,
                  modalidade: ed.modality || ed.modalidade || 'Pregão Eletrônico',
                  dataCertame: ed.openingAt ? ed.openingAt.slice(0, 10) : ed.dataAbertura ? ed.dataAbertura.slice(0, 10) : undefined,
                  objeto: ed.object || ed.objeto,
                  valorEstimado: ed.estimatedValue ? Number(ed.estimatedValue) : undefined,
                  fonte: 'salvo',
                });
              }
            }
          }
        }
      } catch (crmErr) {
        console.warn('[EditalSelector] Falha ao processar oportunidades do CRM:', crmErr);
      }

      // 2. Busca Editais Salvos em cache local (persistência imediata do botão "Salvar para Disputar")
      try {
        const cachedDetails = JSON.parse(localStorage.getItem('expertise_editais_salvos_detalhes') || '[]');
        if (Array.isArray(cachedDetails)) {
          for (const ed of cachedDetails) {
            if (ed && ed.id && !listaFinal.some((x) => x.id === ed.id)) {
              listaFinal.push({
                id: ed.id,
                numeroEdital: ed.numeroEdital || `Edital #${ed.id.slice(0, 8)}`,
                orgao: ed.orgao || 'Órgão Licitante Não Informado',
                cnpjOrgao: ed.cnpjOrgao,
                modalidade: ed.modalidade || 'Pregão Eletrônico',
                dataCertame: ed.dataCertame,
                objeto: ed.objeto,
                valorEstimado: ed.valorEstimado ? Number(ed.valorEstimado) : undefined,
                fonte: 'salvo',
              });
            }
          }
        }
      } catch (cacheErr) {
        console.warn('[EditalSelector] Erro ao ler cache de editais salvos:', cacheErr);
      }

      // 3. Busca Editais Monitorados pela empresa ativa
      try {
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
              if (!listaFinal.some((x) => x.id === (ed.id || item.id))) {
                listaFinal.push({
                  id: ed.id || item.id,
                  numeroEdital: num,
                  orgao: org,
                  cnpjOrgao: ed.cnpjOrgao || ed.buyerDocument,
                  modalidade: ed.modalidade || 'Pregão Eletrônico',
                  dataCertame: ed.dataAbertura ? ed.dataAbertura.slice(0, 10) : undefined,
                  objeto: ed.objeto || ed.object,
                  valorEstimado: ed.estimatedValue ? Number(ed.estimatedValue) : undefined,
                  fonte: 'monitorado',
                });
              }
            }
          }
        }
      } catch (monErr) {
        failedRequests += 1;
        console.error('[EditalSelector] Falha ao carregar monitorados.', monErr);
      }

      // 4. Busca Propostas vinculadas à empresa ativa
      try {
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
            if (notice?.id) {
              const num = notice.noticeNumber || prop.titulo || `Proposta #${prop.id?.slice(0, 8)}`;
              const org = notice.buyerName || 'Órgão Licitante da Proposta';

              if (!listaFinal.some((e) => e.id === notice.id || e.numeroEdital === num)) {
                listaFinal.push({
                  id: notice.id,
                  numeroEdital: num,
                  orgao: org,
                  modalidade: notice.modality || 'Pregão Eletrônico',
                  objeto: notice.object,
                  valorEstimado: notice.estimatedValue ? Number(notice.estimatedValue) : undefined,
                  fonte: 'proposta',
                });
              }
            }
          }
        }
      } catch (propErr) {
        failedRequests += 1;
        console.error('[EditalSelector] Falha ao carregar propostas.', propErr);
      }

      if (isMounted) {
        // Ordena para que os editais salvos para disputar apareçam primeiro
        listaFinal.sort((a, b) => {
          if (a.fonte === 'salvo' && b.fonte !== 'salvo') return -1;
          if (a.fonte !== 'salvo' && b.fonte === 'salvo') return 1;
          return 0;
        });

        setEditais(listaFinal);
        setLoadError(failedRequests > 2);
        setLoading(false);

        // Se já houver um ID pré-selecionado, busca ele
        if (selected) {
          const match = listaFinal.find((ed) => ed.id === selected || ed.numeroEdital === selected);
          if (match) {
            setSelectedItem(match);
            onSelectEdital(match);
          }
        } else if (autoSelectFirst && listaFinal.length > 0) {
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

  useEffect(() => {
    if (selectedId && selectedId !== selected) {
      setSelected(selectedId);
      const match = editais.find((ed) => ed.id === selectedId || ed.numeroEdital === selectedId);
      if (match) {
        setSelectedItem(match);
      }
    }
  }, [selectedId, editais]);

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
            Carregando editais salvos...
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
            -- Selecione um edital salvo para preenchimento automático --
          </option>

          {editais.map((ed) => (
            <option key={ed.id} value={ed.id} className="text-slate-900 font-medium">
              {ed.fonte === 'salvo' ? '★ [Salvo no Radar] ' : ed.fonte === 'monitorado' ? '👁 [Monitorado] ' : ''}
              {ed.numeroEdital} — {ed.orgao} ({ed.modalidade})
            </option>
          ))}
        </select>
      </div>

      {!loading && editais.length === 0 && (
        <p role="status" className="text-xs text-slate-500">
          Nenhum edital salvo no Radar ou monitorado foi encontrado. Salve editais no Radar clicando em &quot;Salvar para Disputar&quot;.
        </p>
      )}

      {selectedItem && (
        <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-3 text-xs space-y-1.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="font-black text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-600" />
              {selectedItem.fonte === 'salvo' ? 'Edital salvo para disputar' : 'Edital real selecionado'}
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
              {selectedItem.fonte === 'salvo' && <Sparkles size={11} className="text-brand-orange" />}
              {selectedItem.modalidade}
            </span>
          </div>
          <div className="text-[11px] text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1 border-t border-emerald-100">
            <p className="truncate">
              <strong className="text-slate-800">Órgão:</strong> {selectedItem.orgao}
            </p>
            {selectedItem.dataCertame && (
              <p>
                <strong className="text-slate-800">Data da Sessão:</strong> {selectedItem.dataCertame}
              </p>
            )}
            {selectedItem.objeto && (
              <p className="sm:col-span-2 line-clamp-2">
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
