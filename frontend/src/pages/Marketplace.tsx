import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  Calculator,
  Filter,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Star,
} from '@components/icons/phosphor-compat';
import { marketplaceApi } from '@services/api';
import type { FornecedorMarketplace, FornecedorMarketplaceListResponse } from '@/types';

const EMPTY_FILTERS = {
  busca: '',
  cnae: '',
  regiao: '',
  uf: '',
};

export default function MarketplacePage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const queryParams = useMemo(() => ({
    busca: filters.busca || undefined,
    cnae: filters.cnae || undefined,
    regiao: filters.regiao || undefined,
    uf: filters.uf || undefined,
    limit: 40,
  }), [filters]);

  const fornecedoresQuery = useQuery({
    queryKey: ['fornecedores-marketplace', queryParams],
    queryFn: async () => {
      const response = await marketplaceApi.listarFornecedores(queryParams);
      return response.data as FornecedorMarketplaceListResponse;
    },
  });

  const fornecedores = fornecedoresQuery.data?.data ?? [];

  function updateFilter(field: keyof typeof EMPTY_FILTERS, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function importarCusto(fornecedor: FornecedorMarketplace) {
    if (!fornecedor.custoReferencia) {
      toast.error('Fornecedor sem custo de referência registrado.');
      return;
    }

    const params = new URLSearchParams({
      fornecedorId: fornecedor.id,
      custoFornecedor: String(fornecedor.custoReferencia),
      fornecedor: fornecedor.razaoSocial,
      fornecedorCnpj: fornecedor.cnpj,
    });

    if (fornecedor.unidadeCusto) {
      params.set('unidade', fornecedor.unidadeCusto);
    }

    navigate(`/licitante/calculadora?${params.toString()}`, {
      state: {
        fornecedorCustoImportado: {
          fornecedorId: fornecedor.id,
          razaoSocial: fornecedor.razaoSocial,
          cnpj: fornecedor.cnpj,
          custoReferencia: fornecedor.custoReferencia,
          unidadeCusto: fornecedor.unidadeCusto,
        },
      },
    });
  }

  return (
    <section className="min-h-full bg-[#F8FAFC] px-5 py-6 text-[#334155] md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="border border-[#E2E8F0] bg-white px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                Rede de Parcerias B2B
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-normal text-[#334155]">
                Diretório corporativo de fornecedores
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#46525A]">
                Fornecedores homologáveis, custos de referência e evidências de conformidade para composição de propostas públicas.
              </p>
            </div>

            <div className="border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Base ativa</p>
              <p className="mt-1 text-2xl font-semibold text-brand-blue">{fornecedores.length}</p>
            </div>
          </div>
        </header>

        <div className="border border-[#E2E8F0] bg-white p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">
            <Filter className="h-4 w-4" />
            Filtros de diretório
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_120px]">
            <FilterField
              icon={<Search className="h-4 w-4" />}
              placeholder="Buscar por razão social, CNPJ ou ramo"
              value={filters.busca}
              onChange={(value) => updateFilter('busca', value)}
            />
            <FilterField
              placeholder="CNAE"
              value={filters.cnae}
              onChange={(value) => updateFilter('cnae', value)}
            />
            <FilterField
              placeholder="Região de atendimento"
              value={filters.regiao}
              onChange={(value) => updateFilter('regiao', value)}
            />
            <FilterField
              placeholder="UF"
              value={filters.uf}
              onChange={(value) => updateFilter('uf', value.toUpperCase().slice(0, 2))}
            />
          </div>
        </div>

        <div className="space-y-3">
          {fornecedoresQuery.isLoading ? (
            <div className="flex min-h-[240px] items-center justify-center border border-[#E2E8F0] bg-white">
              <Loader2 className="h-5 w-5 animate-spin text-brand-blue" />
            </div>
          ) : null}

          {!fornecedoresQuery.isLoading && fornecedores.length === 0 ? (
            <div className="border border-dashed border-[#BFC8D0] bg-white p-6 text-sm font-semibold text-[#46525A]">
              Nenhum fornecedor localizado para os filtros atuais.
            </div>
          ) : null}

          {fornecedores.map((fornecedor) => (
            <FornecedorCard
              key={fornecedor.id}
              fornecedor={fornecedor}
              onSolicitarCotacao={() => importarCusto(fornecedor)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FornecedorCard({
  fornecedor,
  onSolicitarCotacao,
}: {
  fornecedor: FornecedorMarketplace;
  onSolicitarCotacao: () => void;
}) {
  return (
    <article className="grid gap-4 border border-[#E2E8F0] bg-white p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)_220px] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-brand-blue/15 bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-blue">
            {formatCnpj(fornecedor.cnpj)}
          </span>
          <span className="inline-flex items-center gap-1 border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
            <Star className="h-3.5 w-3.5" />
            {fornecedor.notaReputacao.toFixed(2)}
          </span>
        </div>

        <h2 className="mt-3 text-lg font-semibold tracking-normal text-[#334155]">
          {fornecedor.razaoSocial}
        </h2>
        <p className="mt-1 text-sm leading-6 text-[#46525A]">
          {fornecedor.ramoAtividade}
        </p>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#64748B]">
          CNAE principal {fornecedor.cnaePrincipal}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#334155]">
          <MapPin className="h-4 w-4 text-brand-blue" />
          {[fornecedor.municipio, fornecedor.uf].filter(Boolean).join(' / ') || 'Região não informada'}
        </div>

        <div className="flex flex-wrap gap-2">
          {fornecedor.selosConformidade.length > 0 ? fornecedor.selosConformidade.map((selo) => (
            <span
              key={selo}
              className="inline-flex items-center gap-1 border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-[#46525A]"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-brand-blue" />
              {selo}
            </span>
          )) : (
            <span className="border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-semibold text-[#64748B]">
              Sem selo registrado
            </span>
          )}
        </div>

        <p className="text-xs leading-5 text-[#64748B]">
          Atendimento: {fornecedor.regiaoAtendimento.join(', ') || 'não informado'}
        </p>
      </div>

      <div className="border-t border-[#E2E8F0] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
          Custo de referência
        </p>
        <p className="mt-1 text-xl font-semibold text-brand-blue">
          {fornecedor.custoReferencia ? formatMoney(fornecedor.custoReferencia) : 'Sob cotação'}
        </p>
        {fornecedor.unidadeCusto ? (
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#64748B]">
            por {fornecedor.unidadeCusto}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onSolicitarCotacao}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 bg-brand-blue px-4 text-sm font-semibold text-white transition hover:bg-[#172554]"
        >
          <Calculator className="h-4 w-4" />
          Solicitar Cotação
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function FilterField({
  value,
  onChange,
  placeholder,
  icon,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: ReactNode;
}) {
  return (
    <div className="relative">
      {icon ? <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]">{icon}</span> : null}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`h-11 w-full border border-[#E2E8F0] bg-white text-sm text-[#334155] outline-none transition placeholder:text-[#9AA6AE] focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 ${icon ? 'pl-9 pr-3' : 'px-3'}`}
      />
    </div>
  );
}

function formatCnpj(cnpj: string) {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}
