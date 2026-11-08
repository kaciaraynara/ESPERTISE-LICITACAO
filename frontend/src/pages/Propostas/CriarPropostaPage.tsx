import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText,
  Sparkles,
  Edit3,
  Plus,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Building2,
  Loader2,
  ExternalLink,
  Calculator,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { licitacoesApi, propostasApi, crmApi } from '@/services/api';
import { useCompany } from '@/contexts/CompanyContext';
import { buildOfficialPncpPortalUrl } from '@/utils/pncp';

export interface SavedEditalItem {
  id?: string;
  numeroItem: number;
  descricao: string;
  unidadeMedida: string;
  quantidade: number;
  valorUnitarioEstimado: number;
  valorUnitarioProposto: number;
  marcaModelo?: string;
}

export interface SavedEditalRecord {
  id: string;
  numeroControlePNCP: string;
  numeroEdital: string;
  orgao: string;
  cnpjOrgao?: string | null;
  modalidade: string;
  objeto: string;
  valorEstimado?: number | null;
  dataLimite?: string | null;
  urlOficialPncp?: string;
  itens: SavedEditalItem[];
}

export const CriarPropostaPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialEditalId = searchParams.get('edital') || searchParams.get('noticeId') || '';

  const { selectedCompany, companies } = useCompany();

  const [modoPreenchimento, setModoPreenchimento] = useState<'automatico' | 'manual'>('automatico');
  const [editaisSalvos, setEditaisSalvos] = useState<SavedEditalRecord[]>([]);
  const [loadingSalvos, setLoadingSalvos] = useState(true);
  const [loadingItens, setLoadingItens] = useState(false);
  const [selectedEditalId, setSelectedEditalId] = useState<string>(initialEditalId);

  // Campos de Cabeçalho da Proposta
  const [companyId, setCompanyId] = useState<string>(selectedCompany?.id || '');
  const [tituloProposta, setTituloProposta] = useState<string>('Proposta Comercial Oficial');
  const [orgaoLicitante, setOrgaoLicitante] = useState<string>('');
  const [cnpjOrgao, setCnpjOrgao] = useState<string>('');
  const [numeroCertame, setNumeroCertame] = useState<string>('');
  const [modalidade, setModalidade] = useState<string>('Pregão Eletrônico');
  const [objetoContratacao, setObjetoContratacao] = useState<string>('');
  const [urlOficialPncp, setUrlOficialPncp] = useState<string>('');
  const [validadeDias, setValidadeDias] = useState<number>(60);
  const [prazoEntregaDias, setPrazoEntregaDias] = useState<number>(15);
  const [criterioJulgamento] = useState<string>('menor_preco');

  // Tabela Oficial de Itens
  const [itensTabela, setItensTabela] = useState<SavedEditalItem[]>([
    {
      numeroItem: 1,
      descricao: '',
      unidadeMedida: 'UN',
      quantidade: 1,
      valorUnitarioEstimado: 0,
      valorUnitarioProposto: 0,
      marcaModelo: '',
    },
  ]);

  const [salvando, setSalvando] = useState(false);
  const [erroIa, setErroIa] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCompany?.id) {
      setCompanyId(selectedCompany.id);
    } else if (Array.isArray(companies) && companies.length > 0 && !companyId) {
      setCompanyId(companies[0].id);
    }
  }, [selectedCompany, companies, companyId]);

  // Verifica se o usuário veio do Catálogo / Banco de Fornecedores clicando em [Usar na Proposta]
  useEffect(() => {
    try {
      const rawInsumo = sessionStorage.getItem('expertise_insumo_proposta');
      if (rawInsumo) {
        const insumo = JSON.parse(rawInsumo);
        sessionStorage.removeItem('expertise_insumo_proposta');
        if (insumo && insumo.nome) {
          const precoBase = Number(insumo.precoAtacado ?? insumo.precoMinimoLicitacao ?? insumo.custoBase ?? 0);
          setItensTabela((prev) => {
            const filtrados = prev.filter((i) => i.descricao.trim() !== '');
            return [
              ...filtrados,
              {
                numeroItem: filtrados.length + 1,
                descricao: insumo.nome,
                unidadeMedida: insumo.unidadeMedida || 'UN',
                quantidade: 1,
                valorUnitarioEstimado: precoBase > 0 ? Number((precoBase * 1.15).toFixed(2)) : 0,
                valorUnitarioProposto: precoBase,
                marcaModelo: insumo.razaoSocial || insumo.sku || '',
              },
            ];
          });
          toast.success(`Insumo "${insumo.nome}" importado do Catálogo para a proposta!`);
        }
      }
    } catch {
      // ignora erro de parse
    }
  }, []);

  // Ao montar a tela, dispara GET /api/licitacoes/salvos automaticamente
  useEffect(() => {
    let active = true;
    setLoadingSalvos(true);

    const carregarEditaisSalvos = async () => {
      const registros: SavedEditalRecord[] = [];

      // 1. Consulta oficial GET /api/licitacoes/salvos
      try {
        const res = await licitacoesApi.listarSalvos();
        const data = res.data?.data || [];
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item && item.id && !registros.some((r) => r.id === item.id)) {
              const mappedItens: SavedEditalItem[] = Array.isArray(item.itens)
                ? item.itens.map((it: any, idx: number) => {
                    const est = Number(it.valorUnitarioEstimado ?? it.estimatedUnitPrice ?? 0);
                    return {
                      id: it.id,
                      numeroItem: Number(it.numeroItem ?? it.itemNumber ?? idx + 1),
                      descricao: String(it.descricao || it.description || `Item ${idx + 1}`),
                      unidadeMedida: String(it.unidadeMedida || it.unit || 'UN'),
                      quantidade: Number(it.quantidade ?? it.quantity ?? 1),
                      valorUnitarioEstimado: est,
                      valorUnitarioProposto: est > 0 ? Number((est * 0.95).toFixed(2)) : 0,
                      marcaModelo: '',
                    };
                  })
                : [];

              registros.push({
                id: item.id,
                numeroControlePNCP: item.numeroControlePNCP || item.id,
                numeroEdital: item.numeroEdital || item.numeroControlePNCP || `Edital #${String(item.id).slice(0, 8)}`,
                orgao: item.orgao || 'Órgão Licitante',
                cnpjOrgao: item.cnpjOrgao,
                modalidade: item.modalidade || 'Pregão Eletrônico',
                objeto: item.objeto || '',
                valorEstimado: item.valorEstimado != null ? Number(item.valorEstimado) : null,
                dataLimite: item.dataLimite || item.dataAbertura || null,
                urlOficialPncp: item.urlOficialPncp || buildOfficialPncpPortalUrl(item),
                itens: mappedItens,
              });
            }
          }
        }
      } catch {
        // Fallback silencioso para CRM e localStorage
      }

      // 2. Complementa com Pipeline CRM
      try {
        const resCrm = await crmApi.getOportunidades();
        const crmList = resCrm.data?.data || [];
        if (Array.isArray(crmList)) {
          for (const row of crmList) {
            const ed = row.notice || row.edital || row.procurementNotice;
            if (ed && ed.id && !registros.some((r) => r.id === ed.id)) {
              registros.push({
                id: ed.id,
                numeroControlePNCP: ed.externalId || ed.noticeNumber || ed.id,
                numeroEdital: ed.noticeNumber || ed.numeroProcesso || `Edital #${String(ed.id).slice(0, 8)}`,
                orgao: ed.buyerName || ed.orgao || 'Órgão Licitante',
                cnpjOrgao: ed.buyerDocument || ed.cnpjOrgao,
                modalidade: ed.modality || ed.modalidade || 'Pregão Eletrônico',
                objeto: ed.object || ed.objeto || '',
                valorEstimado: ed.estimatedValue != null ? Number(ed.estimatedValue) : null,
                dataLimite: ed.closingAt || ed.openingAt || null,
                urlOficialPncp: buildOfficialPncpPortalUrl(ed),
                itens: [],
              });
            }
          }
        }
      } catch {
        // ignora erro secundário
      }

      // 3. Complementa com cache local imediato (expertise_editais_salvos_detalhes)
      try {
        const cached = JSON.parse(localStorage.getItem('expertise_editais_salvos_detalhes') || '[]');
        if (Array.isArray(cached)) {
          for (const ed of cached) {
            if (ed && ed.id && !registros.some((r) => r.id === ed.id)) {
              registros.push({
                id: ed.id,
                numeroControlePNCP: ed.numeroControlePNCP || ed.id,
                numeroEdital: ed.numeroEdital || `Edital #${String(ed.id).slice(0, 8)}`,
                orgao: ed.orgao || 'Órgão Licitante',
                cnpjOrgao: ed.cnpjOrgao,
                modalidade: ed.modalidade || 'Pregão Eletrônico',
                objeto: ed.objeto || '',
                valorEstimado: ed.valorEstimado != null ? Number(ed.valorEstimado) : null,
                dataLimite: ed.dataCertame || null,
                urlOficialPncp: ed.urlOficialPncp || buildOfficialPncpPortalUrl(ed),
                itens: Array.isArray(ed.itens) ? ed.itens : [],
              });
            }
          }
        }
      } catch {
        // ignora erro de storage
      }

      if (!active) return;
      setEditaisSalvos(registros);
      setLoadingSalvos(false);

      // Seleciona automaticamente o edital da URL ou o primeiro salvo se estiver em Modo Automático
      const targetId = initialEditalId || (registros.length > 0 ? registros[0].id : '');
      if (targetId) {
        const found = registros.find((r) => r.id === targetId || r.numeroControlePNCP === targetId);
        if (found) {
          void aplicarEditalSelecionado(found);
        }
      }
    };

    void carregarEditaisSalvos();

    return () => {
      active = false;
    };
  }, [initialEditalId]);

  const aplicarEditalSelecionado = async (edital: SavedEditalRecord) => {
    setSelectedEditalId(edital.id);
    setOrgaoLicitante(edital.orgao || '');
    setCnpjOrgao(edital.cnpjOrgao || '');
    setNumeroCertame(edital.numeroEdital || edital.numeroControlePNCP || '');
    setModalidade(edital.modalidade || 'Pregão Eletrônico');
    setObjetoContratacao(edital.objeto || '');
    setUrlOficialPncp(edital.urlOficialPncp || buildOfficialPncpPortalUrl(edital));
    setTituloProposta(`Proposta Comercial — ${edital.numeroEdital || edital.orgao}`);
    setErroIa(null);

    if (edital.itens && edital.itens.length > 0) {
      setItensTabela(edital.itens);
      return;
    }

    // Busca itens oficiais do edital no backend/PNCP
    setLoadingItens(true);
    try {
      const resItens = await licitacoesApi.obterItens(edital.id);
      const rawItens = resItens.data?.data || resItens.data?.items || [];
      if (Array.isArray(rawItens) && rawItens.length > 0) {
        const normalizados: SavedEditalItem[] = rawItens.map((it: any, idx: number) => {
          const est = Number(
            it.valorUnitarioEstimado ??
              it.estimatedUnitPrice ??
              it.valorUnitario ??
              0
          );
          return {
            id: it.id,
            numeroItem: Number(it.numeroItem ?? it.itemNumber ?? idx + 1),
            descricao: String(it.descricao || it.description || it.materialOuServicoNome || `Item ${idx + 1}`),
            unidadeMedida: String(it.unidadeMedida || it.unit || 'UN'),
            quantidade: Number(it.quantidade ?? it.quantity ?? 1),
            valorUnitarioEstimado: est,
            valorUnitarioProposto: est > 0 ? Number((est * 0.95).toFixed(2)) : 0,
            marcaModelo: '',
          };
        });
        setItensTabela(normalizados);
      } else {
        const valorRef = Number(edital.valorEstimado || 0);
        setItensTabela([
          {
            numeroItem: 1,
            descricao: edital.objeto || 'Lote Único — Fornecimento conforme Termo de Referência',
            unidadeMedida: 'UN',
            quantidade: 1,
            valorUnitarioEstimado: valorRef,
            valorUnitarioProposto: valorRef > 0 ? Number((valorRef * 0.95).toFixed(2)) : 0,
            marcaModelo: '',
          },
        ]);
      }
    } catch {
      const valorRef = Number(edital.valorEstimado || 0);
      setItensTabela([
        {
          numeroItem: 1,
          descricao: edital.objeto || 'Item 1 — Especificação conforme Termo de Referência',
          unidadeMedida: 'UN',
          quantidade: 1,
          valorUnitarioEstimado: valorRef,
          valorUnitarioProposto: valorRef > 0 ? Number((valorRef * 0.95).toFixed(2)) : 0,
          marcaModelo: '',
        },
      ]);
    } finally {
      setLoadingItens(false);
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedEditalId(id);
    const found = editaisSalvos.find((item) => item.id === id);
    if (found) {
      void aplicarEditalSelecionado(found);
    }
  };

  const handleAtualizarItem = (index: number, field: keyof SavedEditalItem, value: string | number) => {
    setItensTabela((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return {
          ...item,
          [field]: value,
        };
      })
    );
  };

  const handleAdicionarItem = () => {
    setItensTabela((prev) => [
      ...prev,
      {
        numeroItem: prev.length + 1,
        descricao: '',
        unidadeMedida: 'UN',
        quantidade: 1,
        valorUnitarioEstimado: 0,
        valorUnitarioProposto: 0,
        marcaModelo: '',
      },
    ]);
  };

  const handleRemoverItem = (index: number) => {
    if (itensTabela.length <= 1) {
      toast.error('A proposta deve conter pelo menos 1 item.');
      return;
    }
    setItensTabela((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((item, idx) => ({ ...item, numeroItem: idx + 1 }))
    );
  };

  const valorTotalEstimado = useMemo(
    () =>
      itensTabela.reduce(
        (acc, it) => acc + Number(it.quantidade || 0) * Number(it.valorUnitarioEstimado || 0),
        0
      ),
    [itensTabela]
  );

  const valorTotalProposto = useMemo(
    () =>
      itensTabela.reduce(
        (acc, it) => acc + Number(it.quantidade || 0) * Number(it.valorUnitarioProposto || 0),
        0
      ),
    [itensTabela]
  );

  const descontoPercentual = useMemo(() => {
    if (valorTotalEstimado <= 0 || valorTotalProposto <= 0) return 0;
    return Math.max(0, ((valorTotalEstimado - valorTotalProposto) / valorTotalEstimado) * 100);
  }, [valorTotalEstimado, valorTotalProposto]);

  const formatMoeda = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  const handleGerarProposta = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orgaoLicitante.trim() && !selectedEditalId) {
      toast.error('Selecione um edital salvo ou informe o Órgão Licitante.');
      return;
    }

    setSalvando(true);
    setErroIa(null);

    try {
      if (modoPreenchimento === 'automatico' && selectedEditalId) {
        try {
          const resLex = await propostasApi.preencherPropostaViaLex({
            noticeId: selectedEditalId,
            companyId: companyId || undefined,
            autoCreate: true,
          });
          const createdId = resLex.data?.data?.proposalId || resLex.data?.data?.proposal?.id;
          if (createdId) {
            toast.success('Proposta preenchida e gerada automaticamente com sucesso!');
            navigate(`/fornecedor/propostas/${createdId}`);
            return;
          }
        } catch (errIa: any) {
          // Se o serviço de IA falhar, faz fallback transparente ou exibe opção em 1 clique
          console.warn('[CriarPropostaPage] Fallback para criação direta:', errIa);
        }
      }

      if (!companyId) {
        toast.error('Selecione ou cadastre uma empresa ativa para vincular a proposta.');
        setSalvando(false);
        return;
      }

      const resDraft = await propostasApi.criarRascunho({
        companyId,
        procurementNoticeId: selectedEditalId || undefined,
        titulo: tituloProposta.trim() || `Proposta Comercial — ${numeroCertame || orgaoLicitante}`,
        validadeDias: Number(validadeDias) || 60,
        prazoEntregaDias: Number(prazoEntregaDias) || 15,
        criterioJulgamento,
      });

      const newProposalId = resDraft.data?.data?.id;
      toast.success('Proposta criada com sucesso!');
      if (newProposalId) {
        navigate(`/fornecedor/propostas/${newProposalId}`);
      } else {
        navigate('/propostas');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Não foi possível concluir a geração automática agora.';
      setErroIa(msg);
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  };

  const isCampoSomenteLeitura = modoPreenchimento === 'automatico' && Boolean(selectedEditalId);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#334155] p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* TOPO E CHAVE SELETORA DE MODO */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => navigate('/propostas')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0B192C] transition-colors mb-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar para Minhas Propostas
            </button>
            <h1 className="text-2xl font-bold text-[#0B192C] tracking-tight">
              Criar Proposta Comercial Conectada
            </h1>
            <p className="text-sm text-[#334155]">
              Puxe automaticamente os dados e itens dos editais salvos no Radar ou edite livremente no Modo Manual.
            </p>
          </div>

          {/* CHAVE SELETORA: [Modo Automático] vs [Modo Manual] */}
          <div
            role="group"
            aria-label="Modo de preenchimento da proposta"
            className="inline-flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200 self-start lg:self-auto"
          >
            <button
              type="button"
              onClick={() => setModoPreenchimento('automatico')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                modoPreenchimento === 'automatico'
                  ? 'bg-[#0B192C] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#0B192C]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F97316]" />
              Modo Automático
            </button>
            <button
              type="button"
              onClick={() => setModoPreenchimento('manual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                modoPreenchimento === 'manual'
                  ? 'bg-[#0B192C] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#0B192C]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-[#F97316]" />
              Modo Manual
            </button>
          </div>
        </div>

        {/* ALERTA DE FALLBACK EM 1 CLIQUE SE OCORRER FALHA */}
        {erroIa && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-900">{erroIa}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Você pode continuar imediatamente no Modo Manual sem perder nenhum dado preenchido.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setModoPreenchimento('manual');
                setErroIa(null);
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shrink-0 cursor-pointer"
            >
              Alternar para Modo Manual em 1 Clique
            </button>
          </div>
        )}

        <form onSubmit={handleGerarProposta} className="space-y-6">
          {/* SEÇÃO 1: SELETOR DE EDITAL SALVO NO RADAR */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#F97316]" />
                <h2 className="text-base font-bold text-[#0B192C]">
                  1. Selecione o Edital Salvo
                </h2>
              </div>
              {loadingSalvos && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F97316]" />
                  Sincronizando editais salvos...
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
              <div className="lg:col-span-2">
                <label
                  htmlFor="selecione-edital-salvo"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  Selecione o Edital Salvo no Radar
                </label>
                <select
                  id="selecione-edital-salvo"
                  value={selectedEditalId}
                  onChange={handleSelectChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-[#0B192C] focus:bg-white focus:border-[#0B192C] focus:outline-none transition-all cursor-pointer"
                >
                  <option value="">
                    -- Selecione o Edital Salvo para importar Órgão, Certame, Objeto e Itens --
                  </option>
                  {editaisSalvos.map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      ★ {ed.numeroEdital} — {ed.orgao} ({ed.modalidade})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                {urlOficialPncp && (
                  <a
                    href={urlOficialPncp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-link-pncp inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-[#0B192C] border border-blue-200 rounded-xl text-xs font-bold transition-all w-full"
                  >
                    <span>Ver no Portal Oficial do PNCP ↗</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: DADOS DO CERTAME E DA EMPRESA PROPONENTE */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0B192C]" />
                <h2 className="text-base font-bold text-[#0B192C]">
                  2. Dados do Órgão Licitante e Certame
                </h2>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
                {modoPreenchimento === 'automatico'
                  ? 'Preenchimento Automático Ativo'
                  : 'Edição Livre Habilitada'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Órgão Licitante *
                </label>
                <input
                  type="text"
                  required
                  readOnly={isCampoSomenteLeitura}
                  value={orgaoLicitante}
                  onChange={(e) => setOrgaoLicitante(e.target.value)}
                  placeholder="Ex: Prefeitura Municipal / Ministério..."
                  className={`w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-[#0B192C] focus:outline-none focus:border-[#0B192C] ${
                    isCampoSomenteLeitura ? 'bg-slate-100/80' : 'bg-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Número do Certame / Processo *
                </label>
                <input
                  type="text"
                  required
                  readOnly={isCampoSomenteLeitura}
                  value={numeroCertame}
                  onChange={(e) => setNumeroCertame(e.target.value)}
                  placeholder="Ex: PE 90012/2026"
                  className={`w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-[#0B192C] focus:outline-none focus:border-[#0B192C] ${
                    isCampoSomenteLeitura ? 'bg-slate-100/80' : 'bg-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Modalidade da Contratação
                </label>
                <input
                  type="text"
                  readOnly={isCampoSomenteLeitura}
                  value={modalidade}
                  onChange={(e) => setModalidade(e.target.value)}
                  placeholder="Ex: Pregão Eletrônico"
                  className={`w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-[#0B192C] focus:outline-none focus:border-[#0B192C] ${
                    isCampoSomenteLeitura ? 'bg-slate-100/80' : 'bg-white'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Objeto da Contratação *
              </label>
              <textarea
                rows={2}
                required
                readOnly={isCampoSomenteLeitura}
                value={objetoContratacao}
                onChange={(e) => setObjetoContratacao(e.target.value)}
                placeholder="Descrição completa do objeto conforme Termo de Referência..."
                className={`w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-[#334155] focus:outline-none focus:border-[#0B192C] ${
                  isCampoSomenteLeitura ? 'bg-slate-100/80' : 'bg-white'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Título Identificador da Proposta
                </label>
                <input
                  type="text"
                  value={tituloProposta}
                  onChange={(e) => setTituloProposta(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#0B192C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Validade da Proposta (Dias)
                </label>
                <input
                  type="number"
                  min={1}
                  value={validadeDias}
                  onChange={(e) => setValidadeDias(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#0B192C]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Prazo de Entrega (Dias)
                </label>
                <input
                  type="number"
                  min={1}
                  value={prazoEntregaDias}
                  onChange={(e) => setPrazoEntregaDias(Number(e.target.value))}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-[#0B192C]"
                />
              </div>
            </div>

            {cnpjOrgao && (
              <p className="text-[11px] font-mono text-slate-500">
                CNPJ do Órgão: {cnpjOrgao}
              </p>
            )}
          </div>

          {/* SEÇÃO 3: TABELA OFICIAL DE ITENS E FORMAÇÃO DE PREÇOS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#F97316]" />
                <div>
                  <h2 className="text-base font-bold text-[#0B192C]">
                    3. Tabela Oficial de Itens da Proposta
                  </h2>
                  <p className="text-xs text-slate-500">
                    {loadingItens
                      ? 'Extraindo itens oficiais do Termo de Referência...'
                      : 'Revise quantidades, valores unitários estimados e defina seu preço proposto.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAdicionarItem}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-3 w-14">Item</th>
                    <th className="py-3 px-3 min-w-[240px]">Descrição / Especificação</th>
                    <th className="py-3 px-3 w-24">Unid.</th>
                    <th className="py-3 px-3 w-28 text-right">Qtd.</th>
                    <th className="py-3 px-3 w-36 text-right">Vlr. Unit. Ref (R$)</th>
                    <th className="py-3 px-3 w-36 text-right">Vlr. Unit. Proposto (R$)</th>
                    <th className="py-3 px-3 w-36 text-right">Subtotal Proposto</th>
                    <th className="py-3 px-3 w-16 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itensTabela.map((it, idx) => {
                    const subtotal = Number(it.quantidade || 0) * Number(it.valorUnitarioProposto || 0);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3 font-mono font-bold text-[#0B192C]">
                          #{it.numeroItem}
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={it.descricao}
                            onChange={(e) => handleAtualizarItem(idx, 'descricao', e.target.value)}
                            placeholder="Descrição do item ou serviço..."
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-[#0B192C] focus:outline-none focus:border-[#0B192C]"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="text"
                            value={it.unidadeMedida}
                            onChange={(e) => handleAtualizarItem(idx, 'unidadeMedida', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center text-[#0B192C]"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            min={0.01}
                            step="any"
                            value={it.quantidade}
                            onChange={(e) => handleAtualizarItem(idx, 'quantidade', Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-right text-[#0B192C]"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={it.valorUnitarioEstimado}
                            onChange={(e) =>
                              handleAtualizarItem(idx, 'valorUnitarioEstimado', Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-right text-slate-600"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={it.valorUnitarioProposto}
                            onChange={(e) =>
                              handleAtualizarItem(idx, 'valorUnitarioProposto', Number(e.target.value))
                            }
                            className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-right text-emerald-700 focus:outline-none focus:border-emerald-600"
                          />
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[#0B192C]">
                          {formatMoeda(subtotal)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoverItem(idx)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remover item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* RESUMO FINANCEIRO DA PROPOSTA */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <span className="block text-[11px] font-bold uppercase text-slate-500">
                    Valor Total de Referência
                  </span>
                  <span className="text-sm font-bold text-slate-700">
                    {formatMoeda(valorTotalEstimado)}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase text-slate-500">
                    Valor Total da Sua Proposta
                  </span>
                  <span className="text-lg font-bold text-emerald-700">
                    {formatMoeda(valorTotalProposto)}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase text-slate-500">
                    Deságio / Margem Competitiva
                  </span>
                  <span className="text-xs font-bold text-[#0B192C]">
                    {descontoPercentual.toFixed(2)}% abaixo do teto
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/propostas')}
                  className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#F97316] hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando Proposta...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Salvar e Abrir Proposta
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CriarPropostaPage;

