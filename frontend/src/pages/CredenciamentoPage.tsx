import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  ExternalLink,
  FileCheck,
  Search,
  Building2,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { integracoesApi } from '@/services/api';

interface NivelSicaf {
  nivel: string;
  titulo: string;
  descricao: string;
  status: 'REGULAR' | 'ATENCAO' | 'IRREGULAR' | 'VERIFICAR_PORTAL';
  fonteVerificada: string;
  detalhe: string;
  linkOficial: string;
}

interface CertidaoTcuApf {
  emissor: string;
  tipo: string;
  descricao: string;
  situacao: string;
  constaOcorrencia: boolean;
  dataHoraEmissao: string | null;
  linkConsultaManual: string;
}

interface PortalOficial {
  id: string;
  nome: string;
  sigla: string;
  url: string;
  tipoAcesso: string;
  status: 'ATIVO' | 'REQUER_CREDENCIAL_PORTAL';
  observacao: string;
}

interface SicafDiagnostico {
  cnpj: string;
  cadastradoSicaf: boolean;
  dadosSicaf: {
    razaoSocial: string | null;
    porte: string | null;
    naturezaJuridica: string | null;
    municipio: string | null;
    uf: string | null;
    cnaePrincipal: string | null;
    ativo: boolean | null;
  } | null;
  dadosReceita: {
    razaoSocial: string;
    nomeFantasia: string;
    situacaoCadastral: string;
    dataAbertura: string | null;
    cnaePrincipal: string;
    cnaeDescricao: string;
    porte: string;
    capitalSocial: number | null;
    uf: string;
    municipio: string;
  } | null;
  certidoesTcuApf: CertidaoTcuApf[];
  integridadeCgu: {
    ceis: number;
    cnep: number;
    cepim: number;
    leniencia: number;
    alerta: boolean;
    resumo: string;
  };
  niveisSicaf: NivelSicaf[];
  portaisOficiais: PortalOficial[];
  avaliacaoRisco: {
    nivel: 'baixo' | 'medio' | 'alto';
    motivos: string[];
  };
  fontesConsultadas: Array<{
    id: string;
    nome: string;
    ok: boolean;
    ms: number;
    mensagem: string;
  }>;
  linkPortalSicaf: string;
  consultadoEm: string;
}

function formatCnpjDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 14) return raw || 'Não informado';
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export const CredenciamentoPage: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [cnpjInput, setCnpjInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [diagnostico, setDiagnostico] = useState<SicafDiagnostico | null>(null);

  const consultarFontes = async (cnpjAlvo: string) => {
    const digits = cnpjAlvo.replace(/\D/g, '');
    if (digits.length !== 14) {
      toast.error('Informe um CNPJ válido com 14 dígitos para consultar SICAF, TCU e Receita.');
      return;
    }

    setCarregando(true);
    setErro(null);
    try {
      const resp = await integracoesApi.consultarSicaf(digits);
      setDiagnostico(resp.data?.data ?? null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Não foi possível consultar os órgãos oficiais no momento.';
      setErro(msg);
      toast.error(msg);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    const cnpjEmpresa = String(selectedCompany?.cnpj || '').replace(/\D/g, '');
    if (cnpjEmpresa.length === 14) {
      setCnpjInput(formatCnpjDisplay(cnpjEmpresa));
      void consultarFontes(cnpjEmpresa);
    }
  }, [selectedCompany?.cnpj]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ATIVO':
      case 'REGULAR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} /> Regular / Ativo
          </span>
        );
      case 'ATENCAO':
      case 'REQUER_CREDENCIAL_PORTAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} /> Conferir Portal
          </span>
        );
      case 'IRREGULAR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert size={12} /> Atenção / Restrição
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 border border-slate-200">
            <Clock size={12} /> Verificar Emissor
          </span>
        );
    }
  };

  const razaoSocialExibida =
    diagnostico?.dadosReceita?.razaoSocial ||
    diagnostico?.dadosSicaf?.razaoSocial ||
    selectedCompany?.razaoSocial ||
    'Informe um CNPJ para consultar';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <span className="p-2.5 bg-[#0A2540] text-white rounded-xl shadow-md shrink-0">
              <ShieldCheck size={24} />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Credenciamento SICAF & Idoneidade Pública
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Consulta ao vivo no Compras.gov.br (SICAF Aberto), Receita Federal, TCU APF (Inidôneos / CNJ) e CGU (CEIS / CNEP).
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void consultarFontes(cnpjInput);
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto"
          >
            <div className="relative flex-1 sm:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={cnpjInput}
                onChange={(e) => setCnpjInput(e.target.value)}
                placeholder="Digite o CNPJ (14 dígitos)"
                aria-label="CNPJ para consulta SICAF"
                className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-xs font-bold text-slate-900 focus:border-[#0A2540] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={carregando}
              className="px-4 py-2.5 rounded-xl bg-[#0A2540] hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer whitespace-nowrap"
            >
              {carregando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {carregando ? 'Consultando...' : 'Consultar Fontes Oficiais'}
            </button>
          </form>
        </header>

        {erro && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* CARTÃO RESUMO OFICIAL */}
        <div className="bg-gradient-to-r from-[#0A2540] to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {diagnostico ? (
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                      diagnostico.cadastradoSicaf
                        ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200'
                        : 'bg-amber-500/20 border-amber-400/30 text-amber-200'
                    }`}
                  >
                    {diagnostico.cadastradoSicaf ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                    {diagnostico.cadastradoSicaf
                      ? 'Fornecedor localizado no SICAF Aberto (Compras.gov.br)'
                      : 'Não localizado na listagem aberta SICAF — conferir portal Gov.br'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-slate-200 text-xs font-bold">
                    <Building2 size={13} /> Pronto para consulta ao vivo
                  </span>
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-black tracking-tight">{razaoSocialExibida}</h2>
              <p className="text-xs text-slate-300 font-mono">
                CNPJ: {diagnostico ? formatCnpjDisplay(diagnostico.cnpj) : cnpjInput || 'Não informado'}
                {diagnostico?.dadosReceita?.situacaoCadastral
                  ? ` · RFB: ${diagnostico.dadosReceita.situacaoCadastral}`
                  : ''}
                {diagnostico?.dadosReceita?.municipio
                  ? ` · ${diagnostico.dadosReceita.municipio}/${diagnostico.dadosReceita.uf}`
                  : ''}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {diagnostico && (
                <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-xs">
                  <p className="text-slate-300 font-semibold">Integridade CGU / TCU</p>
                  <p className="font-black text-sm mt-0.5 text-white">
                    {diagnostico.avaliacaoRisco.nivel === 'baixo'
                      ? 'Regular (Sem apontamentos)'
                      : diagnostico.avaliacaoRisco.nivel === 'medio'
                        ? 'Atenção Operacional'
                        : 'Restrição Identificada'}
                  </p>
                </div>
              )}
              <a
                href={diagnostico?.linkPortalSicaf || 'https://www3.comprasnet.gov.br/sicaf-web/index.jsf'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#EA580C] hover:bg-orange-600 px-4 py-3 text-xs font-bold text-white transition"
              >
                Abrir SICAF Oficial <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>

        {/* TELEMETRIA DAS FONTES CONSULTADAS */}
        {diagnostico && diagnostico.fontesConsultadas.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {diagnostico.fontesConsultadas.map((f) => (
              <div
                key={f.id}
                className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-900 truncate">{f.nome}</span>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      f.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {f.ok ? `${f.ms}ms` : 'Indisponível'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">{f.mensagem}</p>
              </div>
            ))}
          </div>
        )}

        {/* CERTIDÕES CONSOLIDADAS TCU / CNJ / CGU */}
        {diagnostico && diagnostico.certidoesTcuApf.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Certidão Consolidada de Pessoa Jurídica (TCU / CNJ / CGU)
                </h3>
                <p className="text-xs text-slate-500">
                  Verificação em tempo real na API pública oficial do Tribunal de Contas da União.
                </p>
              </div>
              <a
                href="https://certidoes-apf.apps.tcu.gov.br/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-[#0A2540] hover:underline flex items-center gap-1"
              >
                Emitir PDF no TCU <ExternalLink size={12} />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {diagnostico.certidoesTcuApf.map((cert, idx) => (
                <div
                  key={`${cert.emissor}-${cert.tipo}-${idx}`}
                  className={`p-4 rounded-xl border ${
                    cert.constaOcorrencia
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-emerald-50/40 border-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-black text-slate-800">{cert.emissor}</span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        cert.constaOcorrencia
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {cert.situacao}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900">{cert.descricao}</p>
                  <a
                    href={cert.linkConsultaManual}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#0070C0] hover:underline"
                  >
                    Conferir órgão <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NÍVEIS DO SICAF (LEI 14.133/2021) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileCheck size={18} className="text-[#EA580C]" />
                SICAF Digital — Níveis I a VI (Art. 62 a 70 da Lei 14.133/2021)
              </h3>
              <p className="text-xs text-slate-500">
                Sistema de Cadastramento Unificado de Fornecedores do Governo Federal.
              </p>
            </div>
            <a
              href="https://www.gov.br/compras/pt-br/sicaf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-[#EA580C] hover:underline flex items-center gap-1"
            >
              Portal Gov.br SICAF <ExternalLink size={12} />
            </a>
          </div>

          {!diagnostico && !carregando && (
            <p className="text-sm text-slate-500">
              Informe um CNPJ acima e clique em <strong>Consultar Fontes Oficiais</strong> para verificar os Níveis I–VI.
            </p>
          )}

          {diagnostico && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {diagnostico.niveisSicaf.map((item) => (
                <div
                  key={item.nivel}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-[#EA580C]/40 transition-all shadow-xs flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-black text-[#0A2540] uppercase tracking-wider">
                        Nível {item.nivel}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                    <h4 className="text-sm font-black text-slate-900">{item.titulo}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.descricao}</p>
                    <p className="text-[11px] font-semibold text-slate-700 mt-2">{item.detalhe}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-bold truncate">{item.fonteVerificada}</span>
                    <a
                      href={item.linkOficial}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#0070C0] hover:underline shrink-0 inline-flex items-center gap-1"
                    >
                      Validar <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PORTAIS DE COMPRAS PÚBLICAS */}
        {diagnostico && diagnostico.portaisOficiais.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Globe size={18} className="text-[#0A2540]" />
                Portais de Compras & APIs Oficiais ({diagnostico.portaisOficiais.length} mapeados)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Visão consolidada do que está integrado em tempo real via API pública vs portais que exigem certificado A1/A3.
              </p>
            </div>

            {/* Cards no Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {diagnostico.portaisOficiais.map((portal) => (
                <div key={portal.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black text-xs text-slate-900">{portal.nome}</span>
                    {getStatusBadge(portal.status)}
                  </div>
                  <p className="text-[11px] text-slate-600">{portal.observacao}</p>
                  <a
                    href={portal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0070C0]"
                  >
                    Acessar Portal <ExternalLink size={12} />
                  </a>
                </div>
              ))}
            </div>

            {/* Tabela no Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px] bg-slate-50/70">
                    <th className="py-3 px-5">Portal / Órgão</th>
                    <th className="py-3 px-4">Acesso</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Observação Operacional</th>
                    <th className="py-3 px-5 text-right">Portal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {diagnostico.portaisOficiais.map((portal) => (
                    <tr key={portal.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-slate-100 text-[#0A2540] rounded-lg font-black text-xs">
                            {portal.sigla}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{portal.nome}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{portal.url}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-600">
                        {portal.tipoAcesso === 'CERTIFICADO_DIGITAL'
                          ? 'Certificado A1/A3'
                          : portal.tipoAcesso === 'GOV_BR'
                            ? 'Login Único Gov.br + API'
                            : 'API Pública Aberta'}
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(portal.status)}</td>
                      <td className="py-4 px-4 text-slate-600 max-w-sm font-medium">{portal.observacao}</td>
                      <td className="py-4 px-5 text-right">
                        <a
                          href={portal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition-all"
                        >
                          Acessar <ExternalLink size={12} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CredenciamentoPage;
