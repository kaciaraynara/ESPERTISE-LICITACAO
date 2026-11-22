import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  ShieldCheck,
  ArrowRight,
  Info,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { FORNECEDOR_ROUTES } from '@/routes';
import { useCompany } from '@/contexts/CompanyContext';
import { certidoesApi, documentosApi } from '@/services/api';

type StatusEvidencia = 'REGULAR' | 'ENVIADO' | 'CADASTRADO' | 'ATENCAO' | 'PENDENTE';

interface DocumentoEvidencia {
  tipo?: string | null;
  nome?: string | null;
  status?: string | null;
  validade?: string | null;
}

interface CertidaoEvidencia {
  id: string;
  status: string;
  validade?: string | null;
  temArquivo?: boolean;
}

interface ItemHabilitacao {
  nome: string;
  status: StatusEvidencia;
  obs: string;
  rota: string;
}

interface BlocoHabilitacao {
  pilar: string;
  itens: ItemHabilitacao[];
}

function normalizarTexto(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function statusCertidao(certidao?: CertidaoEvidencia): StatusEvidencia {
  if (!certidao) return 'PENDENTE';
  if (certidao.status === 'VALIDA') return 'REGULAR';
  if (certidao.status === 'VENCENDO') return 'ATENCAO';
  return 'PENDENTE';
}

function observacaoCertidao(certidao?: CertidaoEvidencia): string {
  if (!certidao) return 'Certidão não localizada no monitoramento.';
  if (certidao.status === 'VALIDA') {
    return certidao.validade
      ? `Certidão válida até ${new Date(certidao.validade).toLocaleDateString('pt-BR')}.`
      : 'Certidão marcada como válida no monitoramento.';
  }
  if (certidao.status === 'VENCENDO') return 'Certidão próxima do vencimento. Renove antes de enviar a proposta.';
  if (certidao.status === 'VENCIDA') return 'Certidão vencida. Renove antes de participar.';
  return 'Sem validade registrada. Envie a certidão no Cofre ou atualize o monitoramento.';
}

export const HabilitacaoPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id || 'default';
  const storageKey = `balancete_indices_${companyId}`;

  const [abaAtiva, setAbaAtiva] = useState<'CHECKLIST' | 'INDICES_FINANCEIROS' | 'ATESTADOS'>('CHECKLIST');

  // Calculadora de Índices Econômico-Financeiros (Art. 69 da Lei 14.133/21)
  // Iniciam estritamente como strings vazias ("") para novas empresas
  const [ativoCirculante, setAtivoCirculante] = useState<string>('');
  const [realizavelLongoPrazo, setRealizavelLongoPrazo] = useState<string>('');
  const [passivoCirculante, setPassivoCirculante] = useState<string>('');
  const [passivoNaoCirculante, setPassivoNaoCirculante] = useState<string>('');
  const [ativoTotal, setAtivoTotal] = useState<string>('');
  const [documentos, setDocumentos] = useState<DocumentoEvidencia[]>([]);
  const [certidoes, setCertidoes] = useState<CertidaoEvidencia[]>([]);
  const [carregandoEvidencias, setCarregandoEvidencias] = useState(true);
  const [erroEvidencias, setErroEvidencias] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregandoEvidencias(true);
      setErroEvidencias(null);
      const empresaId = selectedCompany?.id && selectedCompany.id !== 'default' ? selectedCompany.id : undefined;
      try {
        const [docsResp, certsResp] = await Promise.all([
          documentosApi.listar(empresaId ? { empresa_id: empresaId } : undefined),
          certidoesApi.listar(empresaId ? { empresa_id: empresaId } : undefined),
        ]);
        if (!ativo) return;
        const docs = docsResp?.data?.data;
        const certs = certsResp?.data?.data;
        setDocumentos(Array.isArray(docs) ? docs : []);
        setCertidoes(Array.isArray(certs) ? certs : []);
      } catch {
        if (!ativo) return;
        setDocumentos([]);
        setCertidoes([]);
        setErroEvidencias('Não foi possível consultar o Cofre e as Certidões agora. Os itens aparecem como pendentes.');
      } finally {
        if (ativo) setCarregandoEvidencias(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [selectedCompany?.id, recarregar]);

  // Busca do armazenamento os valores preenchidos anteriormente pela empresa logada
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setAtivoCirculante(parsed.ativoCirculante != null ? String(parsed.ativoCirculante) : '');
        setRealizavelLongoPrazo(parsed.realizavelLongoPrazo != null ? String(parsed.realizavelLongoPrazo) : '');
        setPassivoCirculante(parsed.passivoCirculante != null ? String(parsed.passivoCirculante) : '');
        setPassivoNaoCirculante(parsed.passivoNaoCirculante != null ? String(parsed.passivoNaoCirculante) : '');
        setAtivoTotal(parsed.ativoTotal != null ? String(parsed.ativoTotal) : '');
      } else {
        setAtivoCirculante('');
        setRealizavelLongoPrazo('');
        setPassivoCirculante('');
        setPassivoNaoCirculante('');
        setAtivoTotal('');
      }
    } catch {
      setAtivoCirculante('');
      setRealizavelLongoPrazo('');
      setPassivoCirculante('');
      setPassivoNaoCirculante('');
      setAtivoTotal('');
    }
  }, [companyId, storageKey]);

  const persistirValor = (campo: string, valor: string) => {
    try {
      const payload = {
        ativoCirculante,
        realizavelLongoPrazo,
        passivoCirculante,
        passivoNaoCirculante,
        ativoTotal,
        [campo]: valor,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // LocalStorage fallback seguro
    }
  };

  // Cálculos Automáticos com conversão segura
  const numAC = parseFloat(ativoCirculante) || 0;
  const numRLP = parseFloat(realizavelLongoPrazo) || 0;
  const numPC = parseFloat(passivoCirculante) || 0;
  const numPNC = parseFloat(passivoNaoCirculante) || 0;
  const numAT = parseFloat(ativoTotal) || 0;

  const hasValues = Boolean(
    ativoCirculante.trim() !== '' ||
    realizavelLongoPrazo.trim() !== '' ||
    passivoCirculante.trim() !== '' ||
    passivoNaoCirculante.trim() !== '' ||
    ativoTotal.trim() !== ''
  );

  const totalPassivo = numPC + numPNC;
  const liquidezGeral = totalPassivo > 0 ? (numAC + numRLP) / totalPassivo : 0;
  const liquidezCorrente = numPC > 0 ? numAC / numPC : 0;
  const solvenciaGeral = totalPassivo > 0 ? numAT / totalPassivo : 0;

  // Evidências reais: Cofre de Documentos + monitoramento de Certidões.
  // Nenhum item é marcado como "conforme" sem documento/validade correspondente.
  const encontrarDocumento = (termos: string[]) =>
    documentos.find((doc) => {
      const texto = normalizarTexto(`${doc.tipo || ''} ${doc.nome || ''}`);
      return termos.some((termo) => texto.includes(normalizarTexto(termo)));
    });

  const statusDocumento = (doc?: DocumentoEvidencia): StatusEvidencia => {
    if (!doc) return 'PENDENTE';
    return doc.status === 'vencido' ? 'ATENCAO' : 'ENVIADO';
  };

  const observacaoDocumento = (doc: DocumentoEvidencia | undefined, instrucao: string): string => {
    if (!doc) return instrucao;
    if (doc.status === 'vencido') return 'Documento localizado no Cofre, mas consta como vencido.';
    return 'Documento localizado no Cofre. A plataforma verifica a presença, não o conteúdo jurídico.';
  };

  const certidaoPorId = (id: string) => certidoes.find((c) => c.id === id);

  const cndFederal = certidaoPorId('cnd-federal');
  const crfFgts = certidaoPorId('crf-fgts');
  const cndt = certidaoPorId('cndt-tst');
  const cndEstadual = certidaoPorId('cnd-estadual');
  const cndMunicipal = certidaoPorId('cnd-municipal');
  const cndFalencia = certidaoPorId('cnd-falencia');

  const statusFiscalEstadualMunicipal: StatusEvidencia = (() => {
    const statuses = [statusCertidao(cndEstadual), statusCertidao(cndMunicipal)];
    if (statuses.every((s) => s === 'REGULAR')) return 'REGULAR';
    if (statuses.some((s) => s === 'ATENCAO' || s === 'REGULAR')) return 'ATENCAO';
    return 'PENDENTE';
  })();

  const documentoContrato = encontrarDocumento(['contrato social', 'estatuto social', 'alteracao contratual']);
  const documentoProcuracao = encontrarDocumento(['procuracao', 'e-cnpj', 'certificado digital']);
  const documentoAtestado = encontrarDocumento(['atestado de capacidade', 'atestado tecnico']);
  const documentoConselho = encontrarDocumento(['conselho', 'crea', 'cra', 'crc', 'registro profissional']);
  const documentoEquipe = encontrarDocumento(['equipe tecnica', 'responsavel tecnico', 'anuencia']);
  const documentoBalanco = encontrarDocumento(['balanco patrimonial', 'dre', 'demonstracoes contabeis']);

  // Itens da Matriz de Habilitação (Arts. 62 a 70)
  const itensHabilitacao = useMemo<BlocoHabilitacao[]>(
    () => [
      {
        pilar: 'Habilitação Jurídica (Art. 66)',
        itens: [
          {
            nome: 'Contrato Social Consolidado / Estatuto Social',
            status: statusDocumento(documentoContrato),
            obs: observacaoDocumento(documentoContrato, 'Envie o contrato social no Cofre de Documentos.'),
            rota: FORNECEDOR_ROUTES.cofre,
          },
          {
            nome: 'Procuração dos Representantes Legais / E-CNPJ',
            status: statusDocumento(documentoProcuracao),
            obs: observacaoDocumento(documentoProcuracao, 'Envie a procuração ou o certificado digital no Cofre.'),
            rota: FORNECEDOR_ROUTES.cofre,
          },
          {
            nome: 'Inscrição no Cadastro Nacional da Pessoa Jurídica (CNPJ)',
            status: selectedCompany?.cnpj ? 'CADASTRADO' : 'PENDENTE',
            obs: selectedCompany?.cnpj
              ? 'CNPJ cadastrado na plataforma. A situação cadastral não é validada nesta tela.'
              : 'Cadastre o CNPJ da empresa em Minha Empresa.',
            rota: FORNECEDOR_ROUTES.empresa,
          },
        ],
      },
      {
        pilar: 'Qualificação Técnica (Art. 67)',
        itens: [
          {
            nome: 'Atestados de Capacidade Técnica (Mínimo 50% do objeto)',
            status: statusDocumento(documentoAtestado),
            obs: observacaoDocumento(
              documentoAtestado,
              'Envie os atestados no Cofre. A plataforma não calcula o percentual exigido pelo edital.',
            ),
            rota: FORNECEDOR_ROUTES.cofre,
          },
          {
            nome: 'Registro ou Inscrição no Conselho Profissional (CREA/CRA/CRC)',
            status: statusDocumento(documentoConselho),
            obs: observacaoDocumento(documentoConselho, 'Envie o registro profissional no Cofre.'),
            rota: FORNECEDOR_ROUTES.cofre,
          },
          {
            nome: 'Declaração de Indicação de Equipe Técnica Especializada',
            status: statusDocumento(documentoEquipe),
            obs: observacaoDocumento(documentoEquipe, 'Envie a declaração e as anuências dos responsáveis técnicos.'),
            rota: FORNECEDOR_ROUTES.cofre,
          },
        ],
      },
      {
        pilar: 'Regularidade Fiscal, Social e Trabalhista (Art. 68)',
        itens: [
          {
            nome: 'Certidão Negativa de Débitos Federais (Receita / PGFN)',
            status: statusCertidao(cndFederal),
            obs: observacaoCertidao(cndFederal),
            rota: FORNECEDOR_ROUTES.certidoes,
          },
          {
            nome: 'Certificado de Regularidade do FGTS (CRF)',
            status: statusCertidao(crfFgts),
            obs: observacaoCertidao(crfFgts),
            rota: FORNECEDOR_ROUTES.certidoes,
          },
          {
            nome: 'Certidão Negativa de Débitos Trabalhistas (CNDT - TST)',
            status: statusCertidao(cndt),
            obs: observacaoCertidao(cndt),
            rota: FORNECEDOR_ROUTES.certidoes,
          },
          {
            nome: 'Certidões Negativas Estadual e Municipal (ICMS / ISS)',
            status: statusFiscalEstadualMunicipal,
            obs: `Estadual: ${observacaoCertidao(cndEstadual)} Municipal: ${observacaoCertidao(cndMunicipal)}`,
            rota: FORNECEDOR_ROUTES.certidoes,
          },
        ],
      },
      {
        pilar: 'Qualificação Econômico-Financeira (Art. 69)',
        itens: [
          {
            nome: 'Balanço Patrimonial e DRE do Último Exercício Social',
            status: documentoBalanco ? 'ENVIADO' : hasValues ? 'ATENCAO' : 'PENDENTE',
            obs: documentoBalanco
              ? observacaoDocumento(documentoBalanco, '')
              : hasValues
              ? 'Índices informados manualmente. Envie o balanço assinado para gerar evidência documental.'
              : 'Aguardando envio do balanço ou preenchimento dos dados contábeis.',
            rota: FORNECEDOR_ROUTES.cofre,
          },
          {
            nome: 'Índices de Liquidez (LG, LC, SG) Superiores a 1,0',
            status: hasValues
              ? liquidezGeral >= 1.0 && liquidezCorrente >= 1.0 && solvenciaGeral >= 1.0
                ? 'CADASTRADO'
                : 'ATENCAO'
              : 'PENDENTE',
            obs: hasValues
              ? `Calculado com dados informados pelo usuário: LG ${liquidezGeral.toFixed(2)} | LC ${liquidezCorrente.toFixed(2)} | SG ${solvenciaGeral.toFixed(2)}.`
              : 'Preencha o balanço na aba de índices para calcular.',
            rota: FORNECEDOR_ROUTES.habilitacao,
          },
          {
            nome: 'Certidão Negativa de Falência e Recuperação Judicial',
            status: statusCertidao(cndFalencia),
            obs: observacaoCertidao(cndFalencia),
            rota: FORNECEDOR_ROUTES.certidoes,
          },
        ],
      },
    ],
    [
      documentoContrato,
      documentoProcuracao,
      documentoAtestado,
      documentoConselho,
      documentoEquipe,
      documentoBalanco,
      selectedCompany?.cnpj,
      cndFederal,
      crfFgts,
      cndt,
      cndEstadual,
      cndMunicipal,
      cndFalencia,
      statusFiscalEstadualMunicipal,
      hasValues,
      liquidezGeral,
      liquidezCorrente,
      solvenciaGeral,
    ],
  );

  const totalItens = itensHabilitacao.reduce((acc, bloco) => acc + bloco.itens.length, 0);
  const itensComEvidencia = itensHabilitacao.reduce(
    (acc, bloco) =>
      acc +
      bloco.itens.filter((item) =>
        ['REGULAR', 'ENVIADO', 'CADASTRADO'].includes(item.status),
      ).length,
    0,
  );
  const percentualEvidencias = totalItens > 0 ? Math.round((itensComEvidencia / totalItens) * 100) : 0;

  const getStatusBadge = (st: StatusEvidencia) => {
    if (st === 'REGULAR') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
          <CheckCircle2 size={12} /> Regular
        </span>
      );
    }
    if (st === 'ENVIADO') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
          <FileCheck size={12} /> Enviado
        </span>
      );
    }
    if (st === 'CADASTRADO') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
          <Info size={12} /> Cadastrado
        </span>
      );
    }
    if (st === 'ATENCAO') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
          <AlertTriangle size={12} /> Atenção
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
        <XCircle size={12} /> Pendente
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* CABEÇALHO */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-[#0A2540] text-white rounded-xl shadow-md">
                <FileCheck size={24} />
              </span>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Matriz de Habilitação do Licitante
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Checklist e auditor de conformidade dos 4 pilares de habilitação da Lei 14.133/21 (Arts. 62 a 70).
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRecarregar((v) => v + 1)}
              disabled={carregandoEvidencias}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-60"
            >
              <RefreshCw size={14} className={carregandoEvidencias ? 'animate-spin' : ''} />
              Atualizar evidências
            </button>
            <Link
              to={FORNECEDOR_ROUTES.cofre}
              className="px-4 py-2.5 rounded-xl bg-[#0A2540] hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all"
            >
              Meus Documentos
              <ArrowRight size={14} />
            </Link>
          </div>
        </header>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-6 pt-3 gap-6 text-xs font-black">
          <button
            onClick={() => setAbaAtiva('CHECKLIST')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
              abaAtiva === 'CHECKLIST'
                ? 'border-[#EA580C] text-[#EA580C]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck size={16} /> Checklist Completo da Lei 14.133/21
          </button>
          <button
            onClick={() => setAbaAtiva('INDICES_FINANCEIROS')}
            className={`pb-3 border-b-2 transition-all flex items-center gap-2 ${
              abaAtiva === 'INDICES_FINANCEIROS'
                ? 'border-[#EA580C] text-[#EA580C]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calculator size={16} /> Calculadora de Índices de Liquidez (Art. 69)
          </button>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        {abaAtiva === 'CHECKLIST' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <Info size={18} className="text-[#0070C0] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-black text-[#081C3A]">
                    {carregandoEvidencias
                      ? 'Consultando Cofre e Certidões...'
                      : `${itensComEvidencia} de ${totalItens} itens com evidência (${percentualEvidencias}%)`}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    A plataforma verifica presença de documentos e validade das certidões. Ela não valida o conteúdo jurídico nem garante conformidade com o edital. Confira sempre o instrumento convocatório.
                  </p>
                  {erroEvidencias && (
                    <p className="text-xs font-semibold text-amber-700 mt-1">{erroEvidencias}</p>
                  )}
                </div>
              </div>
              {carregandoEvidencias && <Loader2 size={18} className="animate-spin text-[#0070C0]" />}
            </div>

            {itensHabilitacao.map((bloco, idx) => {
              const comEvidencia = bloco.itens.filter((item) =>
                ['REGULAR', 'ENVIADO', 'CADASTRADO'].includes(item.status),
              ).length;
              return (
                <div key={idx} className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-base font-black text-slate-900">{bloco.pilar}</h3>
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                      Evidências {comEvidencia}/{bloco.itens.length}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {bloco.itens.map((it, itemIdx) => (
                      <div key={itemIdx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-800">{it.nome}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{it.obs}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {getStatusBadge(it.status)}
                          {it.status !== 'REGULAR' && it.status !== 'ENVIADO' && (
                            <Link
                              to={it.rota}
                              className="text-[11px] font-bold text-[#0070C0] hover:underline"
                            >
                              Resolver
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {abaAtiva === 'INDICES_FINANCEIROS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* CALCULADORA FORMULÁRIO */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Calculator size={18} className="text-[#EA580C]" />
                  Dados do Balanço Patrimonial
                </h3>
                <p className="text-xs text-slate-500">
                  Informe os valores constantes nas Demonstrações Contábeis da sua empresa.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                    Ativo Circulante (AC) - R$
                  </label>
                  <input
                    type="number"
                    placeholder="0,00"
                    value={ativoCirculante}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAtivoCirculante(val);
                      persistirValor('ativoCirculante', val);
                    }}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                    Realizável a Longo Prazo (RLP) - R$
                  </label>
                  <input
                    type="number"
                    placeholder="0,00"
                    value={realizavelLongoPrazo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRealizavelLongoPrazo(val);
                      persistirValor('realizavelLongoPrazo', val);
                    }}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                    Passivo Circulante (PC) - R$
                  </label>
                  <input
                    type="number"
                    placeholder="0,00"
                    value={passivoCirculante}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPassivoCirculante(val);
                      persistirValor('passivoCirculante', val);
                    }}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                    Passivo Não Circulante (PNC) - R$
                  </label>
                  <input
                    type="number"
                    placeholder="0,00"
                    value={passivoNaoCirculante}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPassivoNaoCirculante(val);
                      persistirValor('passivoNaoCirculante', val);
                    }}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1">
                    Ativo Total (AT) - R$
                  </label>
                  <input
                    type="number"
                    placeholder="0,00"
                    value={ativoTotal}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAtivoTotal(val);
                      persistirValor('ativoTotal', val);
                    }}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
                  />
                </div>
              </div>
            </div>

            {/* RESULTADO DOS ÍNDICES */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Demonstrativo Oficial de Índices (Art. 69, caput e § 1º)
                </h3>
                <p className="text-xs text-slate-500">
                  A legislação veda exigência de índices superiores a 1,0 sem justificativa pormenorizada no processo licitatório.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* LIQUIDEZ GERAL */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-500">Liquidez Geral (LG)</p>
                  <p className="text-2xl font-black text-[#0A2540]">
                    {hasValues && totalPassivo > 0 ? liquidezGeral.toFixed(2) : '—'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">(AC + RLP) / (PC + PNC)</p>
                  {!hasValues ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500">
                      Pendente (Preencha o balanço)
                    </span>
                  ) : (
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black ${
                        liquidezGeral >= 1.0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {liquidezGeral >= 1.0 ? '✓ Apto (>= 1,0)' : '⚠ Inapto (< 1,0)'}
                    </span>
                  )}
                </div>

                {/* LIQUIDEZ CORRENTE */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-500">Liquidez Corrente (LC)</p>
                  <p className="text-2xl font-black text-[#EA580C]">
                    {hasValues && numPC > 0 ? liquidezCorrente.toFixed(2) : '—'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">AC / PC</p>
                  {!hasValues ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500">
                      Pendente (Preencha o balanço)
                    </span>
                  ) : (
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black ${
                        liquidezCorrente >= 1.0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {liquidezCorrente >= 1.0 ? '✓ Apto (>= 1,0)' : '⚠ Inapto (< 1,0)'}
                    </span>
                  )}
                </div>

                {/* SOLVÊNCIA GERAL */}
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-500">Solvência Geral (SG)</p>
                  <p className="text-2xl font-black text-emerald-700">
                    {hasValues && totalPassivo > 0 ? solvenciaGeral.toFixed(2) : '—'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">AT / (PC + PNC)</p>
                  {!hasValues ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500">
                      Pendente (Preencha o balanço)
                    </span>
                  ) : (
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black ${
                        solvenciaGeral >= 1.0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {solvenciaGeral >= 1.0 ? '✓ Apto (>= 1,0)' : '⚠ Inapto (< 1,0)'}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-3">
                <Info size={18} className="shrink-0 mt-0.5 text-blue-700" />
                <div>
                  <p className="font-bold">Art. 69, § 4º da Lei 14.133/21:</p>
                  <p className="mt-0.5 leading-relaxed">
                    Caso a empresa apresente índice inferior a 1,0 em algum dos indicadores acima, o edital deve admitir a comprovação de Capital Social ou Patrimônio Líquido mínimo de até 10% (dez por cento) do valor estimado da contratação.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HabilitacaoPage;
