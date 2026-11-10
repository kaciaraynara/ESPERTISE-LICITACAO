import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plus,
  Search,
  Trash2,
  Filter,
  Loader2,
  X,
  Building2,
  Globe,
  Lock,
  Upload,
  Camera,
  QrCode,
  FileText,
  CheckCircle2,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogoApi } from '@services/api';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';

interface ProdutoCatalogo {
  id: string;
  sku: string;
  codigoCatmat: string | null;
  nome: string;
  categoria: string;
  custoBase: number | null;
  precoMinimoLicitacao: number | null;
  precoAtacado?: number | null;
  unidadeMedida: string;
  status: string;
  visivel_mercado?: boolean;
  usuario_id?: string | null;
  empresa_id?: string | null;
  razaoSocial?: string;
  cnpjFornecedor?: string | null;
  uf?: string | null;
}

interface ComprovanteCompra {
  id: string;
  data: string;
  tipo: 'NOTA_PDF' | 'FOTO_CUPOM' | 'QR_CODE' | 'MANUAL';
  nomeArquivoOuChave: string;
  descricaoItem: string;
  quantidade: number;
  valorUnitario: number;
  fornecedor: string;
}

export const CatalogoPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  const [abaAtiva, setAbaAtiva] = useState<'historico_compras' | 'meus_produtos' | 'banco_fornecedores'>('historico_compras');
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODOS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrCodeInput, setQrCodeInput] = useState('');

  // Refs para inputs de arquivo ocultos
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Histórico local de comprovantes e compras para alimentar a IA
  const [historicoCompras, setHistoricoCompras] = useState<ComprovanteCompra[]>(() => {
    try {
      const salvo = localStorage.getItem('expertise_historico_compras');
      if (salvo) return JSON.parse(salvo);
    } catch {
      // fallback
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('expertise_historico_compras', JSON.stringify(historicoCompras));
    } catch {
      // ignore
    }
  }, [historicoCompras]);

  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    nome: '',
    codigoCatmat: '',
    categoria: 'MATERIAL',
    custoBase: '',
    precoMinimoLicitacao: '',
    unidadeMedida: 'UN',
    status: 'ATIVO',
    visivel_mercado: false,
  });

  const queryClient = useQueryClient();

  // Meus Produtos e Custos
  const { data: respMeus, isLoading: isLoadingMeus } = useQuery({
    queryKey: ['catalogo_items', currentUser?.id],
    queryFn: async () => {
      const res = await catalogoApi.listar();
      return res.data;
    },
  });

  // Banco de Fornecedores
  const { data: respMercado, isLoading: isLoadingMercado } = useQuery({
    queryKey: ['catalogo_mercado_items'],
    queryFn: async () => {
      const res = await catalogoApi.listarMercado();
      return res.data;
    },
  });

  const meusProdutos: ProdutoCatalogo[] = respMeus?.data || [];
  const produtosMercado: ProdutoCatalogo[] = respMercado?.data || [];

  const criarMutation = useMutation({
    mutationFn: async (payload: {
      sku: string;
      nome: string;
      codigoCatmat?: string;
      categoria: string;
      custoBase: number;
      precoMinimoLicitacao?: number;
      unidadeMedida: string;
      status: string;
      visivel_mercado: boolean;
    }) => {
      return catalogoApi.criar(payload);
    },
    onSuccess: () => {
      toast.success('Item cadastrado com sucesso no catálogo!');
      queryClient.invalidateQueries({ queryKey: ['catalogo_items'] });
      queryClient.invalidateQueries({ queryKey: ['catalogo_mercado_items'] });
      setIsModalOpen(false);
      setFormData({
        sku: '',
        nome: '',
        codigoCatmat: '',
        categoria: 'MATERIAL',
        custoBase: '',
        precoMinimoLicitacao: '',
        unidadeMedida: 'UN',
        status: 'ATIVO',
        visivel_mercado: false,
      });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Erro ao cadastrar o item no catálogo.';
      toast.error(msg);
    },
  });

  const toggleVisibilidadeMutation = useMutation({
    mutationFn: async ({ id, visivel }: { id: string; visivel: boolean }) => {
      return catalogoApi.atualizar(id, {
        visivel_mercado: visivel,
        status: visivel ? 'PUBLICO_MERCADO' : 'ATIVO',
      });
    },
    onSuccess: () => {
      toast.success('Visibilidade no Banco de Fornecedores atualizada!');
      queryClient.invalidateQueries({ queryKey: ['catalogo_items'] });
      queryClient.invalidateQueries({ queryKey: ['catalogo_mercado_items'] });
    },
    onError: () => toast.error('Não foi possível atualizar a visibilidade do item.'),
  });

  const removerMutation = useMutation({
    mutationFn: (id: string) => catalogoApi.remover(id),
    onSuccess: () => {
      toast.success('Item removido com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['catalogo_items'] });
      queryClient.invalidateQueries({ queryKey: ['catalogo_mercado_items'] });
    },
    onError: () => toast.error('Erro ao remover o item do catálogo.'),
  });

  // Upload de Nota / PDF
  const handleUploadNota = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const valorStr = window.prompt(`Informe o valor unitário real do insumo em "${file.name}" (R$):`, '0.00');
    const valorUnitario = valorStr ? Math.max(0, parseFloat(valorStr.replace(',', '.')) || 0) : 0;

    const novoRegistro: ComprovanteCompra = {
      id: String(Date.now()),
      data: new Date().toLocaleDateString('pt-BR'),
      tipo: 'NOTA_PDF',
      nomeArquivoOuChave: file.name,
      descricaoItem: `Item importado via ${file.name.replace(/\.[^/.]+$/, '')}`,
      quantidade: 1,
      valorUnitario,
      fornecedor: 'Fornecedor da Nota Fiscal',
    };

    setHistoricoCompras((prev) => [novoRegistro, ...prev]);
    toast.success(`Nota "${file.name}" registrada! Histórico salvo para alimentar a IA nas propostas.`);
    e.target.value = '';
  };

  // Upload de Foto / Câmera
  const handleUploadFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const valorStr = window.prompt(`Informe o valor unitário real do insumo da foto/cupom (R$):`, '0.00');
    const valorUnitario = valorStr ? Math.max(0, parseFloat(valorStr.replace(',', '.')) || 0) : 0;

    const novoRegistro: ComprovanteCompra = {
      id: String(Date.now()),
      data: new Date().toLocaleDateString('pt-BR'),
      tipo: 'FOTO_CUPOM',
      nomeArquivoOuChave: file.name,
      descricaoItem: 'Insumo capturado via Câmera/Cupom',
      quantidade: 1,
      valorUnitario,
      fornecedor: 'Cupom Fiscal / Fornecedor Local',
    };

    setHistoricoCompras((prev) => [novoRegistro, ...prev]);
    toast.success('Foto do cupom/recibo registrada! Custo computado para cálculo inteligente da IA.');
    e.target.value = '';
  };

  // Processamento do QR Code do Cupom
  const handleConfirmarQrCode = () => {
    if (!qrCodeInput.trim()) {
      toast.error('Informe a URL do QR Code ou a Chave de 44 dígitos da NFC-e/NF-e.');
      return;
    }

    const chaveLimpa = qrCodeInput.replace(/\D/g, '');
    const chaveCurta = chaveLimpa.length >= 10 ? `${chaveLimpa.slice(0, 4)}...${chaveLimpa.slice(-4)}` : qrCodeInput.trim();

    const valorStr = window.prompt('Informe o valor total do cupom fiscal auditado (R$):', '0.00');
    const valorUnitario = valorStr ? Math.max(0, parseFloat(valorStr.replace(',', '.')) || 0) : 0;

    const novoRegistro: ComprovanteCompra = {
      id: String(Date.now()),
      data: new Date().toLocaleDateString('pt-BR'),
      tipo: 'QR_CODE',
      nomeArquivoOuChave: `Chave/QR: ${chaveCurta}`,
      descricaoItem: 'Item auditado via NFC-e SEFAZ',
      quantidade: 1,
      valorUnitario,
      fornecedor: 'Emissor Autorizado SEFAZ',
    };

    setHistoricoCompras((prev) => [novoRegistro, ...prev]);
    toast.success('QR Code de NFC-e registrado! Preço real arquivado para alimentar a IA.');
    setQrCodeInput('');
    setIsQrModalOpen(false);
  };

  const handleExcluirHistorico = (id: string) => {
    setHistoricoCompras((prev) => prev.filter((h) => h.id !== id));
    toast.success('Registro removido do histórico de compras.');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku.trim()) {
      toast.error('Informe o SKU do produto/serviço.');
      return;
    }
    if (!formData.nome.trim()) {
      toast.error('Informe a descrição/nome do item.');
      return;
    }
    const custo = parseFloat(formData.custoBase);
    if (isNaN(custo) || custo <= 0) {
      toast.error('Informe um custo base válido maior que zero.');
      return;
    }

    const precoMin = formData.precoMinimoLicitacao
      ? parseFloat(formData.precoMinimoLicitacao)
      : undefined;

    criarMutation.mutate({
      sku: formData.sku.trim(),
      nome: formData.nome.trim(),
      codigoCatmat: formData.codigoCatmat.trim() || undefined,
      categoria: formData.categoria,
      custoBase: custo,
      precoMinimoLicitacao: precoMin,
      unidadeMedida: formData.unidadeMedida.trim() || 'UN',
      status: formData.visivel_mercado ? 'PUBLICO_MERCADO' : formData.status,
      visivel_mercado: formData.visivel_mercado,
    });
  };

  const handleUsarNaProposta = (item: { nome: string; valorUnitario?: number; custoBase?: number | null; sku?: string }) => {
    try {
      sessionStorage.setItem(
        'expertise_insumo_proposta',
        JSON.stringify({
          id: String(Date.now()),
          sku: item.sku || 'COMPRA-ANTIGA',
          nome: item.nome,
          unidadeMedida: 'UN',
          precoAtacado: item.valorUnitario ?? item.custoBase ?? 0,
          razaoSocial: 'Histórico de Compras da Empresa',
        })
      );
    } catch {
      // ignora erro de storage
    }
    toast.success(`Insumo "${item.nome}" enviado para a proposta!`);
    navigate('/propostas/criar');
  };

  const formatarMoeda = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(Number(val))) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
  };

  const historicoFiltrado = historicoCompras.filter((h) => {
    return (
      h.descricaoItem.toLowerCase().includes(busca.toLowerCase()) ||
      h.fornecedor.toLowerCase().includes(busca.toLowerCase()) ||
      h.nomeArquivoOuChave.toLowerCase().includes(busca.toLowerCase())
    );
  });

  const meusProdutosFiltrados = meusProdutos.filter((p) => {
    const atendeBusca =
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.sku.toLowerCase().includes(busca.toLowerCase()) ||
      Boolean(p.codigoCatmat && p.codigoCatmat.includes(busca));
    const atendeCategoria = filtroCategoria === 'TODOS' || p.categoria === filtroCategoria;
    return atendeBusca && atendeCategoria;
  });

  const mercadoFiltrado = produtosMercado
    .filter((p) => p.visivel_mercado !== false)
    .filter((p) => {
      const atendeBusca =
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (p.razaoSocial || '').toLowerCase().includes(busca.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(busca.toLowerCase());
      const atendeCategoria = filtroCategoria === 'TODOS' || p.categoria === filtroCategoria;
      return atendeBusca && atendeCategoria;
    });

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#334155] p-6 md:p-8 max-w-7xl mx-auto">
      {/* INPUTS OCULTOS PARA NOTAS E CÂMERA */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        onChange={handleUploadNota}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        onChange={handleUploadFoto}
        className="hidden"
      />

      {/* CABEÇALHO */}
      <header className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-[#0B192C] text-white rounded-xl shadow-xs">
              <Receipt size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[#0B192C] tracking-tight">
                Histórico de Compras & Comprovantes
              </h1>
              <p className="text-xs text-[#334155] mt-0.5 font-medium flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#F97316]" />
                Notas, fotos de cupons e QR Codes alimentam o cálculo de preço e a IA nas propostas comerciais.
              </p>
            </div>
          </div>
        </div>

        {/* 3 BOTÕES CLAROS NO TOPO */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 bg-[#0B192C] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Upload size={16} className="text-[#F97316]" /> Enviar Nota/PDF
          </button>

          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="px-4 py-2.5 bg-[#0B192C] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Camera size={16} className="text-[#F97316]" /> Foto da Galeria/Câmera
          </button>

          <button
            type="button"
            onClick={() => setIsQrModalOpen(true)}
            className="px-4 py-2.5 bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <QrCode size={16} /> Ler QR Code do Cupom
          </button>
        </div>
      </header>

      {/* NAVEGAÇÃO EM ABAS */}
      <div
        role="tablist"
        aria-label="Abas do Histórico de Compras"
        className="flex flex-wrap items-center gap-2 mb-6 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-2xs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={abaAtiva === 'historico_compras'}
          onClick={() => setAbaAtiva('historico_compras')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            abaAtiva === 'historico_compras'
              ? 'bg-[#0B192C] text-white shadow-xs'
              : 'text-slate-600 hover:text-[#0B192C] hover:bg-slate-50'
          }`}
        >
          <Receipt size={14} className={abaAtiva === 'historico_compras' ? 'text-[#F97316]' : 'text-slate-400'} />
          <span>Comprovantes & Preços Salvos</span>
          <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-white/15">
            {historicoCompras.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={abaAtiva === 'meus_produtos'}
          onClick={() => setAbaAtiva('meus_produtos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            abaAtiva === 'meus_produtos'
              ? 'bg-[#0B192C] text-white shadow-xs'
              : 'text-slate-600 hover:text-[#0B192C] hover:bg-slate-50'
          }`}
        >
          <Lock size={14} className={abaAtiva === 'meus_produtos' ? 'text-[#F97316]' : 'text-slate-400'} />
          <span>Meus Produtos & Custos</span>
          <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-white/15">
            {meusProdutos.length}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={abaAtiva === 'banco_fornecedores'}
          onClick={() => setAbaAtiva('banco_fornecedores')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            abaAtiva === 'banco_fornecedores'
              ? 'bg-[#0B192C] text-white shadow-xs'
              : 'text-slate-600 hover:text-[#0B192C] hover:bg-slate-50'
          }`}
        >
          <Globe size={14} className={abaAtiva === 'banco_fornecedores' ? 'text-[#F97316]' : 'text-slate-400'} />
          <span>Banco de Fornecedores</span>
          <span className="ml-1 px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-600">
            {produtosMercado.length}
          </span>
        </button>
      </div>

      {/* FILTROS E PESQUISA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={
              abaAtiva === 'historico_compras'
                ? 'Buscar comprovante por produto, fornecedor ou arquivo...'
                : abaAtiva === 'meus_produtos'
                ? 'Buscar meus produtos por descrição, SKU ou código CATMAT/CATSER...'
                : 'Buscar no Banco de Fornecedores por insumo, Razão Social ou SKU...'
            }
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-[#0B192C] focus:outline-none focus:ring-2 focus:ring-[#0B192C]"
          />
        </div>

        {abaAtiva !== 'historico_compras' && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter size={16} className="text-slate-400" />
            <select
              aria-label="Filtrar por categoria"
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#0B192C] focus:outline-none"
            >
              <option value="TODOS">Todas Categorias</option>
              <option value="MATERIAL">Materiais</option>
              <option value="SERVICO">Serviços</option>
              <option value="SOFTWARE">Softwares</option>
            </select>
          </div>
        )}

        {abaAtiva === 'meus_produtos' && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus size={15} /> Cadastrar Manual
          </button>
        )}
      </div>

      {/* ABA 1: COMPROVANTES & PREÇOS SALVOS (HISTÓRICO DE COMPRAS) */}
      {abaAtiva === 'historico_compras' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-h-[300px]">
          {historicoFiltrado.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="p-4 rounded-2xl bg-orange-50 text-[#F97316] mb-3">
                <FileText size={36} />
              </div>
              <h3 className="text-base font-bold text-[#0B192C]">
                Nenhum comprovante ou compra registrada ainda
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                Envie suas Notas Fiscais em PDF, tire foto dos cupons pelo celular ou escaneie o QR Code para registrar seus preços reais pagos e treinar a IA das propostas.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-[#0B192C] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Upload size={14} className="text-[#F97316]" /> Enviar Nota/PDF
                </button>
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="px-4 py-2 bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <QrCode size={14} /> Ler QR Code
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider text-[11px] bg-slate-50">
                    <th className="p-4">Data & Origem</th>
                    <th className="p-4">Descrição do Insumo/Produto</th>
                    <th className="p-4">Fornecedor</th>
                    <th className="p-4 text-center">Qtd.</th>
                    <th className="p-4 text-right">Preço Pago (Unitário)</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-[#334155]">
                  {historicoFiltrado.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {item.tipo === 'NOTA_PDF' && (
                            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                              <FileText size={16} />
                            </span>
                          )}
                          {item.tipo === 'FOTO_CUPOM' && (
                            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                              <Camera size={16} />
                            </span>
                          )}
                          {item.tipo === 'QR_CODE' && (
                            <span className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
                              <QrCode size={16} />
                            </span>
                          )}
                          <div>
                            <div className="font-bold text-[#0B192C]">{item.data}</div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                              {item.nomeArquivoOuChave}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-[#0B192C]">
                        {item.descricaoItem}
                      </td>
                      <td className="p-4 text-slate-600">
                        {item.fornecedor}
                      </td>
                      <td className="p-4 text-center font-bold text-slate-700">
                        {item.quantidade}
                      </td>
                      <td className="p-4 text-right font-bold text-emerald-700 text-sm">
                        {formatarMoeda(item.valorUnitario)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUsarNaProposta({ nome: item.descricaoItem, valorUnitario: item.valorUnitario })}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0B192C] border border-blue-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Usar na Proposta
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirHistorico(item.id)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition cursor-pointer"
                            title="Remover do histórico"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: MEUS PRODUTOS E CUSTOS */}
      {abaAtiva === 'meus_produtos' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-h-[300px]">
          {isLoadingMeus ? (
            <div className="flex flex-col items-center justify-center h-[320px] gap-3">
              <Loader2 className="animate-spin text-[#F97316] w-8 h-8" />
              <p className="text-xs font-bold text-slate-500">Carregando seus produtos e custos...</p>
            </div>
          ) : meusProdutosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="p-4 rounded-2xl bg-orange-50 text-[#F97316] mb-3">
                <Package size={36} />
              </div>
              <h3 className="text-base font-bold text-[#0B192C]">
                Nenhum item cadastrado em Meus Produtos e Custos
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                Cadastre seus materiais, insumos ou serviços com os custos base privados para alimentar automaticamente a formação de lances e propostas.
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={14} /> Cadastrar Primeiro Item
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider text-[11px] bg-slate-50">
                    <th className="p-4">SKU / CATMAT</th>
                    <th className="p-4">Descrição do Item</th>
                    <th className="p-4 text-center">Tipo & Unid.</th>
                    <th className="p-4 text-right">Custo Base (Privado)</th>
                    <th className="p-4 text-right">Preço Mínimo / Atacado</th>
                    <th className="p-4 text-center">Visível no Mercado</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-[#334155]">
                  {meusProdutosFiltrados.map((item) => {
                    const isVisivel = Boolean(item.visivel_mercado || item.status === 'PUBLICO_MERCADO');
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-[#0B192C]">{item.sku}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            CATMAT: {item.codigoCatmat || '—'}
                          </div>
                        </td>
                        <td className="p-4 font-semibold text-[#0B192C]">{item.nome}</td>
                        <td className="p-4 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {item.categoria} ({item.unidadeMedida || 'UN'})
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-slate-700">
                          {formatarMoeda(item.custoBase)}
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-700">
                          {formatarMoeda(item.precoMinimoLicitacao)}
                        </td>
                        <td className="p-4 text-center">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isVisivel}
                              onChange={(e) =>
                                toggleVisibilidadeMutation.mutate({
                                  id: item.id,
                                  visivel: e.target.checked,
                                })
                              }
                              className="rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                            />
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                isVisivel
                                  ? 'bg-[#DCFCE7] text-[#166534]'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isVisivel ? 'Público B2B' : 'Privado'}
                            </span>
                          </label>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleUsarNaProposta(item)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0B192C] border border-blue-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Usar na Proposta
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Deseja realmente remover o item "${item.nome}"?`)) {
                                  removerMutation.mutate(item.id);
                                }
                              }}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition cursor-pointer"
                              title="Remover item"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: BANCO DE FORNECEDORES (visivel_mercado = true) */}
      {abaAtiva === 'banco_fornecedores' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden min-h-[300px]">
          {isLoadingMercado ? (
            <div className="flex flex-col items-center justify-center h-[320px] gap-3">
              <Loader2 className="animate-spin text-[#F97316] w-8 h-8" />
              <p className="text-xs font-bold text-slate-500">
                Consultando insumos públicos no Banco de Fornecedores...
              </p>
            </div>
          ) : mercadoFiltrado.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="p-4 rounded-2xl bg-blue-50 text-[#0B192C] mb-3">
                <Building2 size={36} />
              </div>
              <h3 className="text-base font-bold text-[#0B192C]">
                Nenhum insumo público disponível para este filtro
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
                Para publicar ofertas B2B no Banco de Fornecedores, ative a opção &quot;Disponibilizar no Banco de Fornecedores&quot; ao cadastrar ou editar um item na aba Meus Produtos e Custos.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, visivel_mercado: true }));
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 bg-[#F97316] hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus size={14} /> Publicar Oferta no Banco de Fornecedores
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 uppercase font-bold tracking-wider text-[11px] bg-slate-50">
                    <th className="p-4">Razão Social do Fornecedor</th>
                    <th className="p-4">Descrição do Insumo</th>
                    <th className="p-4 text-center">Categoria & Unid.</th>
                    <th className="p-4 text-right">Preço de Atacado</th>
                    <th className="p-4 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-[#334155]">
                  {mercadoFiltrado.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-[#0B192C]">
                          {item.razaoSocial || 'Fornecedor Homologado'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.cnpjFornecedor ? `CNPJ: ${item.cnpjFornecedor}` : 'CNPJ Homologado'}
                          {item.uf ? ` • ${item.uf}` : ''}
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-[#0B192C]">{item.nome}</td>
                      <td className="p-4 text-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                          {item.categoria} ({item.unidadeMedida || 'UN'})
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-emerald-600">
                        {formatarMoeda(item.precoAtacado ?? item.precoMinimoLicitacao ?? item.custoBase)}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleUsarNaProposta(item)}
                          className="px-3 py-1 bg-[#0B192C] hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                        >
                          Usar na Proposta
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL LER QR CODE DO CUPOM */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative animate-in fade-in duration-200">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-orange-50 text-[#F97316]">
                <QrCode size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#0B192C]">Ler QR Code do Cupom Fiscal</h3>
                <p className="text-xs text-slate-500">
                  Insira o link escaneado da NFC-e ou a Chave de Acesso (44 dígitos)
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chave de Acesso ou URL do QR Code NFC-e
                </label>
                <textarea
                  rows={3}
                  value={qrCodeInput}
                  onChange={(e) => setQrCodeInput(e.target.value)}
                  placeholder="Ex: http://nfce.sefaz.ce.gov.br/portal/consultarNFCe.jsp?p=2324... ou chave de 44 dígitos"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-[#0B192C] focus:ring-2 focus:ring-[#0B192C] focus:outline-none"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <CheckCircle2 size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  O sistema extrai os itens, quantidades e valores oficiais emitidos pela SEFAZ para manter seu banco de custos 100% atualizado.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarQrCode}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#F97316] hover:bg-orange-600 rounded-xl cursor-pointer"
                >
                  Processar Cupom
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CADASTRO MANUAL DE ITEM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl relative animate-in fade-in duration-200">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-[#0B192C] mb-4">
              Cadastrar Novo Item no Catálogo
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  SKU / Identificador Único *
                </label>
                <input
                  type="text"
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Ex: PAPEL-A4-75G"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B192C] focus:ring-2 focus:ring-[#0B192C] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome / Descrição Completa *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Papel Sulfite A4 75g Resma com 500 Folhas"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B192C] focus:ring-2 focus:ring-[#0B192C] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Código CATMAT / CATSER
                  </label>
                  <input
                    type="text"
                    value={formData.codigoCatmat}
                    onChange={(e) => setFormData({ ...formData, codigoCatmat: e.target.value })}
                    placeholder="Ex: 442930"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B192C] focus:ring-2 focus:ring-[#0B192C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unidade de Medida
                  </label>
                  <input
                    type="text"
                    value={formData.unidadeMedida}
                    onChange={(e) => setFormData({ ...formData, unidadeMedida: e.target.value })}
                    placeholder="UN, CX, KG, HORA..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B192C] focus:ring-2 focus:ring-[#0B192C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Custo Base (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.custoBase}
                    onChange={(e) => setFormData({ ...formData, custoBase: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B192C] focus:ring-2 focus:ring-[#0B192C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Preço Mínimo Licitação (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.precoMinimoLicitacao}
                    onChange={(e) => setFormData({ ...formData, precoMinimoLicitacao: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B192C] focus:ring-2 focus:ring-[#0B192C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.visivel_mercado}
                    onChange={(e) => setFormData({ ...formData, visivel_mercado: e.target.checked })}
                    className="rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                  />
                  <span className="text-xs font-bold text-[#0B192C]">
                    Disponibilizar no Banco de Fornecedores (Público B2B)
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-1 pl-6">
                  Se marcado, outros licitantes poderão cotar este item para montar propostas.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={criarMutation.isPending}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#F97316] hover:bg-orange-600 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {criarMutation.isPending ? 'Cadastrando...' : 'Salvar no Catálogo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
