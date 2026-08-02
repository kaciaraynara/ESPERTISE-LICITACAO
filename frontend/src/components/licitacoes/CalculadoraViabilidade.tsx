import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { useLocation } from 'react-router-dom';
import { precificacaoApi } from '@services/api';
import type { FornecedorCustoImportado } from '@/types';

interface EtapaViabilidade {
  ordem: number;
  descricao: string;
  valorSubtraido: number;
  saldo: number;
}

interface ResultadoViabilidade {
  baseCalculo: number;
  precoLance: number;
  custoProduto: number;
  impostosValor: number;
  custoLogistico: number;
  taxasAdministrativas: number;
  margemLucroRealValor: number;
  margemLucroRealPercentual: number;
  margemSaudavel: boolean;
  etapas: EtapaViabilidade[];
}

interface ViabilidadeResponse {
  success: boolean;
  data: ResultadoViabilidade;
}

type CampoNumerico =
  | 'precoLance'
  | 'custoProduto'
  | 'percentualImpostos'
  | 'custoLogistico'
  | 'taxasAdministrativas';

const campos: Array<{
  id: CampoNumerico;
  label: string;
  prefix?: string;
  suffix?: string;
}> = [
  { id: 'precoLance', label: 'Preço do Lance', prefix: 'R$' },
  { id: 'custoProduto', label: 'Custo do Produto', prefix: 'R$' },
  { id: 'percentualImpostos', label: 'Impostos', suffix: '%' },
  { id: 'custoLogistico', label: 'Custo Logístico', prefix: 'R$' },
  { id: 'taxasAdministrativas', label: 'Taxas Administrativas', prefix: 'R$' },
];

const initialValues: Record<CampoNumerico, string> = {
  precoLance: '',
  custoProduto: '',
  percentualImpostos: '',
  custoLogistico: '',
  taxasAdministrativas: '',
};

function parseDecimal(value: string) {
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

function formatPercent(value: number) {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatInputMoney(value: number) {
  return value.toFixed(2).replace('.', ',');
}

function resolveFornecedorImportado(location: ReturnType<typeof useLocation>): FornecedorCustoImportado | null {
  const state = location.state as { fornecedorCustoImportado?: FornecedorCustoImportado } | null;

  if (state?.fornecedorCustoImportado) {
    return state.fornecedorCustoImportado;
  }

  const params = new URLSearchParams(location.search);
  const custoReferencia = Number(params.get('custoFornecedor'));
  const razaoSocial = params.get('fornecedor');
  const cnpj = params.get('fornecedorCnpj');

  if (!Number.isFinite(custoReferencia) || custoReferencia <= 0 || !razaoSocial || !cnpj) {
    return null;
  }

  return {
    fornecedorId: params.get('fornecedorId') ?? cnpj,
    razaoSocial,
    cnpj,
    custoReferencia,
    unidadeCusto: params.get('unidade'),
  };
}

export default function CalculadoraViabilidade() {
  const location = useLocation();
  const fornecedorImportado = useMemo(() => resolveFornecedorImportado(location), [location]);
  const fornecedorImportadoKey = fornecedorImportado
    ? `${fornecedorImportado.fornecedorId}-${fornecedorImportado.custoReferencia}`
    : '';
  const [values, setValues] = useState<Record<CampoNumerico, string>>(() => ({
    ...initialValues,
    custoProduto: fornecedorImportado ? formatInputMoney(fornecedorImportado.custoReferencia) : '',
  }));

  const payload = useMemo(() => ({
    preco_lance: parseDecimal(values.precoLance),
    custo_produto: parseDecimal(values.custoProduto),
    percentual_impostos: parseDecimal(values.percentualImpostos),
    custo_logistico: parseDecimal(values.custoLogistico),
    taxas_administrativas: parseDecimal(values.taxasAdministrativas),
  }), [values]);

  const mutation = useMutation<AxiosResponse<ViabilidadeResponse>, Error>({
    mutationFn: () => precificacaoApi.calcularViabilidade(payload),
  });

  const resultado = mutation.data?.data.data;
  const margemCritica = resultado ? resultado.margemLucroRealPercentual < 10 : false;
  const indicadorClasse = margemCritica
    ? 'border-[#DC2626] bg-[#DC2626]/5 text-[#DC2626]'
    : 'border-[#16A34A] bg-[#16A34A]/5 text-[#16A34A]';

  function updateField(field: CampoNumerico, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function aplicarCustoFornecedor() {
    if (!fornecedorImportado) return;
    updateField('custoProduto', formatInputMoney(fornecedorImportado.custoReferencia));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
  }

  useEffect(() => {
    aplicarCustoFornecedor();
  }, [fornecedorImportadoKey]);

  return (
    <section className="mx-auto max-w-6xl bg-white p-5 text-[#2563EB] md:p-8">
      <div className="mb-6 flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-orange">
          Precificação
        </p>
        <h1 className="text-2xl font-semibold tracking-normal text-[#2563EB]">
          Calculadora de Viabilidade
        </h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="border border-[#2563EB]/15 bg-white p-5">
          {fornecedorImportado ? (
            <div className="mb-5 border border-brand-blue/15 bg-[#F8FAFC] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
                Custo importado da Rede B2B
              </p>
              <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#334155]">{fornecedorImportado.razaoSocial}</p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    {fornecedorImportado.cnpj} · {formatMoney(fornecedorImportado.custoReferencia)}
                    {fornecedorImportado.unidadeCusto ? ` por ${fornecedorImportado.unidadeCusto}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={aplicarCustoFornecedor}
                  className="inline-flex h-9 items-center justify-center border border-brand-blue/20 bg-white px-3 text-xs font-semibold text-brand-blue transition hover:border-brand-blue"
                >
                  Aplicar custo
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {campos.map((campo) => (
              <label key={campo.id} className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#2563EB]">
                  {campo.label}
                </span>
                <div className="relative">
                  {campo.prefix && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#2563EB]/70">
                      {campo.prefix}
                    </span>
                  )}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={values[campo.id]}
                    onChange={(event) => updateField(campo.id, event.target.value)}
                    className={`h-11 w-full border border-[#2563EB]/20 bg-white text-sm font-semibold text-[#2563EB] outline-none transition focus:border-brand-orange ${campo.prefix ? 'pl-10' : 'pl-3'} ${campo.suffix ? 'pr-10' : 'pr-3'}`}
                    placeholder="0,00"
                  />
                  {campo.suffix && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#2563EB]/70">
                      {campo.suffix}
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-brand-orange px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mutation.isPending ? 'Calculando...' : 'Calcular margem real'}
            </button>
            <button
              type="button"
              onClick={() => {
                setValues(initialValues);
                mutation.reset();
              }}
              className="border border-[#2563EB]/20 bg-white px-5 py-3 text-sm font-semibold text-[#2563EB] transition hover:border-brand-orange hover:text-brand-orange"
            >
              Limpar
            </button>
          </div>
        </form>

        <aside className="border border-[#2563EB]/15 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-orange">
            Resultado
          </p>

          {resultado ? (
            <div className="mt-4 space-y-4">
              <div className={`border p-4 ${indicadorClasse}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                  Margem de Lucro Real
                </p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatPercent(resultado.margemLucroRealPercentual)}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {formatMoney(resultado.margemLucroRealValor)}
                </p>
              </div>

              <p className={`border px-3 py-2 text-sm font-semibold ${indicadorClasse}`}>
                {margemCritica
                  ? 'Margem inferior a 10%. Revise custos antes de disputar.'
                  : 'Margem igual ou superior a 10%. Lance financeiramente viável.'}
              </p>

              <div className="border-t border-[#2563EB]/10 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#2563EB]">
                  Subtração sequencial
                </p>
                <div className="space-y-2">
                  {resultado.etapas.map((etapa) => (
                    <div key={etapa.ordem} className="border border-[#2563EB]/15 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-semibold leading-5 text-[#2563EB]">
                          {etapa.ordem}. {etapa.descricao}
                        </p>
                        <span className="shrink-0 text-xs font-semibold text-brand-orange">
                          - {formatMoney(etapa.valorSubtraido)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#2563EB]">
                        Saldo: {formatMoney(etapa.saldo)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 border border-dashed border-[#2563EB]/20 p-5">
              <p className="text-sm font-semibold text-[#2563EB]">
                Informe os valores para calcular a margem real.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
