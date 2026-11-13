import { useMemo, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Scale,
} from '@components/icons/phosphor-compat';
import { concorrentesApi, impugnacaoApi } from '@services/api';
import type { DadosFraudePeca, MalhaFinaLicitacao } from '@/types';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuthStore } from '@/store/auth.store';
import { formatCnpjMask } from '@/utils/cnpj';
import PainelRiscoCartel from './PainelRiscoCartel';
import { EditalSelector, EditalOption } from '@components/EditalSelector';

type WizardStep = 'concorrentes' | 'risco' | 'dadosPeca' | 'peca';

type PecaGerada = {
  conteudo: string;
  formato: 'markdown' | 'html';
};

const stepOrder: Array<{ id: WizardStep; label: string }> = [
  { id: 'concorrentes', label: 'Concorrentes' },
  { id: 'risco', label: 'Risco' },
  { id: 'dadosPeca', label: 'Dados' },
  { id: 'peca', label: 'Peça' },
];

interface RecursoFraudeWizardProps {
  initialEditalId?: string;
}

export default function RecursoFraudeWizard({ initialEditalId }: RecursoFraudeWizardProps = {}) {
  const { selectedCompany } = useCompany();
  const user = useAuthStore((state) => state.user);

  const [step, setStep] = useState<WizardStep>(initialEditalId ? 'dadosPeca' : 'concorrentes');

  useEffect(() => {
    if (initialEditalId) {
      setStep('dadosPeca');
    }
  }, [initialEditalId]);

  const [cnpjsText, setCnpjsText] = useState('');
  const [dataCertame, setDataCertame] = useState('');
  const [orgao, setOrgao] = useState('');
  const [modalidade, setModalidade] = useState('');
  const [numeroEdital, setNumeroEdital] = useState('');
  const [objeto, setObjeto] = useState('');
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [cnpjEmpresa, setCnpjEmpresa] = useState('');
  const [representanteLegal, setRepresentanteLegal] = useState('');
  const [malhaFina, setMalhaFina] = useState<MalhaFinaLicitacao | null>(null);
  const [peca, setPeca] = useState<PecaGerada | null>(null);

  // Pré-preenchimento automático com os dados da empresa ativa e do representante logado
  useEffect(() => {
    if (selectedCompany?.razaoSocial && !nomeEmpresa) {
      setNomeEmpresa(selectedCompany.razaoSocial);
    }
    if (selectedCompany?.cnpj && !cnpjEmpresa) {
      setCnpjEmpresa(formatCnpjMask(selectedCompany.cnpj));
    }
  }, [selectedCompany, nomeEmpresa, cnpjEmpresa]);

  useEffect(() => {
    if (user?.nome && !representanteLegal) {
      setRepresentanteLegal(user.nome);
    }
  }, [user?.nome, representanteLegal]);

  const handleSelectEdital = (ed: EditalOption) => {
    setNumeroEdital(ed.numeroEdital);
    setOrgao(ed.orgao);
    if (ed.modalidade) setModalidade(ed.modalidade);
    if (ed.dataCertame) setDataCertame(String(ed.dataCertame).slice(0, 10));
    if (ed.objeto) setObjeto(ed.objeto);
    toast.success('Edital selecionado: Órgão, Modalidade e Data preenchidos automaticamente!');
  };

  const cnpjs = useMemo(() => splitCnpjs(cnpjsText), [cnpjsText]);
  const currentStepIndex = stepOrder.findIndex((item) => item.id === step);

  const investigarMutation = useMutation({
    mutationFn: async () => {
      if (cnpjs.length < 2) {
        throw new Error('Informe ao menos dois CNPJs concorrentes.');
      }

      const response = await concorrentesApi.malhaFina({ cnpjs });
      return response.data?.data as MalhaFinaLicitacao;
    },
    onSuccess: (data) => {
      setMalhaFina(data);
      setPeca(null);
      setStep('risco');
      toast.success('Checagem de vínculos concluída.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível processar a checagem de vínculos.');
    },
  });

  const gerarPecaMutation = useMutation({
    mutationFn: async () => {
      if (!dataCertame) {
        throw new Error('Informe a data do certame para calcular o prazo da peça.');
      }

      let malhaAtual = malhaFina;
      if (!malhaAtual && cnpjs.length >= 2) {
        try {
          const malhaResp = await concorrentesApi.malhaFina({ cnpjs });
          malhaAtual = malhaResp.data?.data as MalhaFinaLicitacao;
          setMalhaFina(malhaAtual);
        } catch {
          // Segue com a elaboração da peça mesmo se a checagem de vínculos estiver indisponível
        }
      }

      const pontos = malhaAtual
        ? [
            'Apuração de indícios societários entre concorrentes',
            'Preservação da competitividade e da isonomia do procedimento',
          ]
        : [
            'Revisão de cláusulas restritivas e preservação da competitividade (Art. 5º e Art. 9º da Lei 14.133/2021)',
            'Garantia de isonomia e vinculação objetiva ao instrumento convocatório',
          ];

      const response = await impugnacaoApi.gerarPeca({
        orgao,
        modalidade,
        numero_edital: numeroEdital,
        objeto,
        data_certame: dataCertame,
        nome_empresa: nomeEmpresa || selectedCompany?.razaoSocial || '',
        cnpj_empresa: cnpjEmpresa || (selectedCompany?.cnpj ? formatCnpjMask(selectedCompany.cnpj) : ''),
        representante_legal: representanteLegal || user?.nome || '',
        pontos_impugnacao: pontos,
        dadosFraude: malhaAtual ? toDadosFraudePeca(malhaAtual) : undefined,
        formato: 'markdown',
      });

      return response.data?.data as PecaGerada;
    },
    onSuccess: (data) => {
      setPeca(data);
      setStep('peca');
      toast.success('Peça jurídica elaborada com sucesso!');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível elaborar a peça jurídica.');
    },
  });

  return (
    <section className="rounded-3xl border-2 border-slate-100 bg-white shadow-xl overflow-hidden">
      <div className="border-b-2 border-slate-100 px-8 py-8 md:px-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-brand-orange">
              Checagem de Sócios e Concorrentes
            </p>
            <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight text-slate-900">
              Impugnação & Recurso com Prova Societária
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            {stepOrder.map((item, index) => {
              const active = item.id === step;
              const completed = index < currentStepIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'peca' && !peca) return;
                    setStep(item.id);
                  }}
                  className={`inline-flex h-10 items-center justify-center rounded-xl border-2 px-4 text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${active
                      ? 'border-brand-blue bg-blue-50/50 text-brand-blue shadow-sm'
                      : completed
                        ? 'border-brand-orange/30 bg-orange-50/50 text-brand-orange'
                        : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'
                    }`}
                >
                  <span className="mr-2 opacity-50">{index + 1}</span>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-8 md:p-12">
        {initialEditalId && (
          <div className="mb-6 p-4 bg-orange-50/80 border border-orange-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-bold text-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-pulse" />
              <span>Edital vinculado: <strong className="text-[#0A2540]">{numeroEdital || initialEditalId}</strong> {orgao ? `(${orgao})` : ''}</span>
            </div>
            {step === 'concorrentes' && (
              <button
                type="button"
                onClick={() => setStep('dadosPeca')}
                className="px-3.5 py-1.5 bg-[#0A2540] hover:bg-slate-800 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Dados da Peça &rarr;
              </button>
            )}
          </div>
        )}

        {step === 'concorrentes' ? (
          <div className="grid gap-8 xl:grid-cols-[0.46fr_0.54fr]">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                CNPJs Concorrentes (Opcional)
              </label>
              <textarea
                value={cnpjsText}
                onChange={(event) => setCnpjsText(event.target.value)}
                rows={7}
                className="mt-3 w-full rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 resize-none custom-scrollbar"
                placeholder="Um CNPJ por linha"
              />
              <p className="mt-3 text-xs font-bold text-slate-500">
                {cnpjs.length} CNPJ{cnpjs.length === 1 ? '' : 's'} válido{cnpjs.length === 1 ? '' : 's'} identificado{cnpjs.length === 1 ? '' : 's'}.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => investigarMutation.mutate()}
                  disabled={investigarMutation.isPending}
                  className="inline-flex w-full sm:w-auto h-14 items-center justify-center gap-3 rounded-xl bg-brand-blue hover:bg-[#172554] px-8 text-sm font-black uppercase tracking-widest text-white shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
                >
                  {investigarMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" weight="bold" /> : <Scale className="h-5 w-5" weight="bold" />}
                  Checar Vínculos
                </button>
                <button
                  type="button"
                  onClick={() => setStep('dadosPeca')}
                  className="inline-flex w-full sm:w-auto h-14 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 px-6 text-xs font-black uppercase tracking-widest text-slate-700 transition-all cursor-pointer"
                >
                  Ir Direto para Peça &rarr;
                </button>
              </div>
            </div>

            <StepSurface>
              <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-8 flex flex-col items-center justify-center text-center h-full">
                <FileText className="h-12 w-12 text-brand-orange mb-4" weight="bold" />
                <p className="text-xl font-black text-slate-900">Análise de Sócios e Vínculos</p>
                <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-slate-500">
                  Cruza os dados públicos dos concorrentes para identificar sócios em comum ou ir direto para a elaboração da impugnação.
                </p>
              </div>
            </StepSurface>
          </div>
        ) : null}

        {step === 'risco' ? (
          <div className="space-y-6">
            <PainelRiscoCartel
              dados={malhaFina}
              loading={gerarPecaMutation.isPending}
              onElaborarRecurso={() => setStep('dadosPeca')}
            />

            {malhaFina?.risco !== 'ALTO' ? (
              <button
                type="button"
                onClick={() => setStep('dadosPeca')}
                className="inline-flex h-14 w-full sm:w-auto items-center justify-center gap-3 rounded-xl border-2 border-brand-blue bg-white px-8 text-sm font-black uppercase tracking-widest text-brand-blue transition-all hover:bg-brand-blue hover:text-white cursor-pointer"
              >
                Prosseguir com Peça de Registro
                <ArrowRight className="h-5 w-5" weight="bold" />
              </button>
            ) : null}
          </div>
        ) : null}

        {step === 'dadosPeca' ? (
          <div className="space-y-6">
            <EditalSelector
              label="Localizar Edital Monitorado ou Proposta"
              selectedId={initialEditalId}
              onSelectEdital={handleSelectEdital}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Data do Certame" value={dataCertame} onChange={setDataCertame} type="date" />
              <Field label="Número do Edital" value={numeroEdital} onChange={setNumeroEdital} placeholder="Pregão 041/2026" />
              <Field label="Órgão Licitante" value={orgao} onChange={setOrgao} placeholder="Secretaria Municipal" />
              <Field label="Modalidade" value={modalidade} onChange={setModalidade} placeholder="Pregão Eletrônico" />
            </div>

            <Field label="Objeto Resumido" value={objeto} onChange={setObjeto} placeholder="Objeto principal do certame" />

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Empresa Recorrente" value={nomeEmpresa} onChange={setNomeEmpresa} placeholder="Razão social" />
              <Field label="CNPJ Recorrente" value={cnpjEmpresa} onChange={setCnpjEmpresa} placeholder="00.000.000/0000-00" />
              <Field label="Representante" value={representanteLegal} onChange={setRepresentanteLegal} placeholder="Nome completo" />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="button"
                onClick={() => setStep(malhaFina ? 'risco' : 'concorrentes')}
                className="inline-flex h-14 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-8 text-sm font-black uppercase tracking-widest text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                {malhaFina ? 'Revisar Risco' : 'Checar Concorrentes'}
              </button>
              <button
                type="button"
                onClick={() => gerarPecaMutation.mutate()}
                disabled={gerarPecaMutation.isPending}
                className="inline-flex h-14 items-center justify-center gap-3 rounded-xl bg-brand-orange px-8 text-sm font-black uppercase tracking-widest text-white transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 hover:bg-orange-500 disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
              >
                {gerarPecaMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" weight="bold" /> : <ArrowRight className="h-5 w-5" weight="bold" />}
                {malhaFina ? 'Gerar Peça com Checagem de Vínculos' : 'Elaborar Peça Jurídica'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 'peca' && peca ? (
          <div className="rounded-2xl border-2 border-slate-100 bg-white overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-100 px-6 py-5 bg-slate-50">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-brand-blue" weight="bold" />
                <p className="text-base font-black text-slate-900">Peça Estruturada</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(peca.conteudo)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-blue/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-brand-blue transition hover:bg-brand-blue hover:text-white cursor-pointer"
              >
                <Copy className="h-4 w-4" weight="bold" />
                Copiar
              </button>
            </div>
            <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap p-6 lg:p-8 text-sm font-medium leading-relaxed text-slate-700 bg-white custom-scrollbar">
              {peca.conteudo}
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StepSurface({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-full items-center justify-center">
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-3 h-14 w-full rounded-2xl border-2 border-slate-200 bg-white px-6 text-base font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
      />
    </label>
  );
}

function splitCnpjs(value: string): string[] {
  return Array.from(new Set(
    value
      .split(/[\s,;]+/)
      .map((item) => item.replace(/\D/g, ''))
      .filter((item) => item.length === 14),
  ));
}

function toDadosFraudePeca(malha: MalhaFinaLicitacao): DadosFraudePeca {
  return {
    risco: malha.risco,
    possuiSociosEmComum: malha.possuiSociosEmComum,
    resumo: {
      totalConcorrentes: malha.resumo.totalConcorrentes,
      totalVinculosSocietarios: malha.resumo.totalVinculosSocietarios,
    },
    vinculosSocietarios: malha.vinculosSocietarios.map((vinculo) => ({
      socio: vinculo.socio,
      empresas: vinculo.empresas,
      totalEmpresas: vinculo.totalEmpresas,
    })),
  };
}

function copyToClipboard(value: string) {
  navigator.clipboard.writeText(value);
  toast.success('Texto copiado.');
}