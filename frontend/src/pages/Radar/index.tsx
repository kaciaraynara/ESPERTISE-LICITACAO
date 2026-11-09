import { useState } from 'react';
import { Target, Search, RefreshCw, Loader2, MapPin, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { licitacoesApi } from '@services/api';
import { useNavigate } from 'react-router-dom';
import { buildOfficialPncpPortalUrl } from '@/utils/pncp';

const BRAZIL_UFS = [
  { sigla: 'TODOS', nome: 'Todas as UFs (Brasil)' },
  { sigla: 'AC', nome: 'Acre (AC)' },
  { sigla: 'AL', nome: 'Alagoas (AL)' },
  { sigla: 'AP', nome: 'Amapá (AP)' },
  { sigla: 'AM', nome: 'Amazonas (AM)' },
  { sigla: 'BA', nome: 'Bahia (BA)' },
  { sigla: 'CE', nome: 'Ceará (CE)' },
  { sigla: 'DF', nome: 'Distrito Federal (DF)' },
  { sigla: 'ES', nome: 'Espírito Santo (ES)' },
  { sigla: 'GO', nome: 'Goiás (GO)' },
  { sigla: 'MA', nome: 'Maranhão (MA)' },
  { sigla: 'MT', nome: 'Mato Grosso (MT)' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul (MS)' },
  { sigla: 'MG', nome: 'Minas Gerais (MG)' },
  { sigla: 'PA', nome: 'Pará (PA)' },
  { sigla: 'PB', nome: 'Paraíba (PB)' },
  { sigla: 'PR', nome: 'Paraná (PR)' },
  { sigla: 'PE', nome: 'Pernambuco (PE)' },
  { sigla: 'PI', nome: 'Piauí (PI)' },
  { sigla: 'RJ', nome: 'Rio de Janeiro (RJ)' },
  { sigla: 'RN', nome: 'Rio Grande do Norte (RN)' },
  { sigla: 'RS', nome: 'Rio Grande do Sul (RS)' },
  { sigla: 'RO', nome: 'Rondônia (RO)' },
  { sigla: 'RR', nome: 'Roraima (RR)' },
  { sigla: 'SC', nome: 'Santa Catarina (SC)' },
  { sigla: 'SP', nome: 'São Paulo (SP)' },
  { sigla: 'SE', nome: 'Sergipe (SE)' },
  { sigla: 'TO', nome: 'Tocantins (TO)' },
];

export default function RadarPage() {
  const [activeTab, setActiveTab] = useState<'pncp' | 'score'>('pncp');
  const [uf, setUf] = useState<string>('CE');
  const [busca, setBusca] = useState<string>('');
  const [modalidade, setModalidade] = useState<string>('TODAS');
  const navigate = useNavigate();

  // Calcular dataFinal como 60 dias à frente a partir de hoje no formato estrito 'YYYYMMDD'
  const futureDate = new Date(Date.now() + 60 * 86_400_000);
  const dataFinalYYYYMMDD = [
    futureDate.getFullYear(),
    String(futureDate.getMonth() + 1).padStart(2, '0'),
    String(futureDate.getDate()).padStart(2, '0'),
  ].join('');

  const { data: resp, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['licitacoes_radar_pncp', uf, modalidade, busca, activeTab],
    queryFn: async () => {
      const params: Record<string, any> = {
        pagina: 1,
        tamanhoPagina: 20,
        dataFinal: dataFinalYYYYMMDD,
        endpoint: 'proposta',
        tempoReal: true,
      };

      if (uf && uf !== 'TODOS') {
        params.uf = uf;
      }

      if (modalidade && modalidade !== 'TODAS') {
        params.codigoModalidadeContratacao = Number(modalidade);
      }

      if (busca.trim()) {
        params.busca = busca.trim();
        params.palavraChave = busca.trim();
      }

      const res = await licitacoesApi.listar(params);
      return res.data;
    },
    staleTime: 60_000,
  });

  const licitacoes = resp?.data || [];

  const formatarMoeda = (val: number | null | undefined) => {
    if (val == null || Number.isNaN(Number(val))) return 'Sigiloso / Não informado';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));
  };

  const formatarData = (data: string | null | undefined) => {
    if (!data) return '—';
    const d = new Date(data);
    return Number.isNaN(d.getTime()) ? String(data) : d.toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-[#0A2540] tracking-tight">Radar de Oportunidades PNCP</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Consulta em tempo real ao Portal Nacional de Contratações Públicas com todas as 27 UFs e prefeituras do Brasil.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void refetch()}
            disabled={isLoading || isFetching}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-[#EA580C] hover:bg-orange-600 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || isFetching ? 'animate-spin' : ''}`} />
            Consultar PNCP
          </button>
        </div>
      </div>

      {/* Barra de Filtros em Tempo Real */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Seletor Completo das 27 UFs */}
          <div>
            <label htmlFor="radar-uf-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Estado (UF) - 27 Unidades Federativas
            </label>
            <div className="relative">
              <select
                id="radar-uf-select"
                aria-label="Filtrar por UF"
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 transition-all cursor-pointer"
              >
                {BRAZIL_UFS.map((item) => (
                  <option key={item.sigla} value={item.sigla}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Modalidade de Contratação */}
          <div>
            <label htmlFor="radar-modalidade-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Modalidade
            </label>
            <select
              id="radar-modalidade-select"
              aria-label="Filtrar por Modalidade"
              value={modalidade}
              onChange={(e) => setModalidade(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 transition-all cursor-pointer"
            >
              <option value="TODAS">Todas as Contratações</option>
              <option value="6">Pregão Eletrônico (6)</option>
              <option value="4">Concorrência (4)</option>
              <option value="8">Dispensa de Licitação (8)</option>
              <option value="9">Inexigibilidade (9)</option>
              <option value="1">Leilão (1)</option>
              <option value="3">Concurso (3)</option>
              <option value="2">Diálogo Competitivo (2)</option>
              <option value="12">Credenciamento (12)</option>
            </select>
          </div>

          {/* Busca por Palavra-Chave */}
          <div className="lg:col-span-2">
            <label htmlFor="radar-busca-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Palavra-chave / Objeto
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="radar-busca-input"
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Ex: uniforme, software, pavimentação, merenda..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/10 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Navegação por Abas (Tabs) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/50 p-2 gap-2">
          <button
            onClick={() => setActiveTab('pncp')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'pncp'
                ? 'bg-white text-[#0A2540] shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Search className={`w-4 h-4 ${activeTab === 'pncp' ? 'text-[#EA580C]' : ''}`} />
            Busca Geral PNCP ({uf === 'TODOS' ? 'Brasil' : uf})
          </button>

          <button
            onClick={() => setActiveTab('score')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'score'
                ? 'bg-white text-[#0A2540] shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
            }`}
          >
            <Target className={`w-4 h-4 ${activeTab === 'score' ? 'text-[#EA580C]' : ''}`} />
            Recomendados por Score
          </button>
        </div>

        {/* Conteúdo Dinâmico da Aba Selecionada */}
        <div className="p-6">
          <div className="space-y-4 min-h-[300px]">
            {activeTab === 'pncp' && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs font-medium flex items-center justify-between">
                <span>
                  Consultando oportunidades abertas na fonte oficial do PNCP para <strong>{uf === 'TODOS' ? 'todas as UFs' : `o estado de ${uf}`}</strong>.
                </span>
                <span className="font-bold text-brand-blue">
                  {licitacoes.length} certames exibidos
                </span>
              </div>
            )}
            {activeTab === 'score' && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-900 text-xs font-medium">
                Exibindo licitações com ordenação de viabilidade para o seu negócio no estado selecionado.
              </div>
            )}

            {isLoading || isFetching ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-[#EA580C] w-9 h-9" />
                <p className="text-xs font-bold text-slate-700">Carregando contratações públicas do PNCP...</p>
              </div>
            ) : licitacoes.length === 0 ? (
              <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-sm font-bold text-slate-700">
                  Nenhuma contratação encontrada diretamente no PNCP para estes filtros.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Experimente selecionar outra UF ou alterar os termos da busca.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {licitacoes.map((licitacao: any) => {
                  const portalUrl = buildOfficialPncpPortalUrl(licitacao);
                  const nomeOrgao = licitacao.nomeOrgao || licitacao.orgao || 'Órgão Público';
                  const objetoCompra = licitacao.objetoCompra || licitacao.objeto || 'Objeto não especificado';
                  const modalidadeNome = licitacao.nomeModalidade || licitacao.modalidadeNome || licitacao.modalidade || 'Contratação';
                  const dataRef = licitacao.dataEncerramentoProposta || licitacao.dataEncerramento || licitacao.dataAbertura;
                  const valor = licitacao.valorTotalEstimado ?? licitacao.valorEstimado;

                  return (
                    <div
                      key={licitacao.id || licitacao.numeroControlePNCP}
                      className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase bg-blue-100 text-blue-800">
                            {modalidadeNome}
                          </span>
                          {licitacao.uf && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-700 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {licitacao.municipio ? `${licitacao.municipio} / ${licitacao.uf}` : licitacao.uf}
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm mb-1 line-clamp-2" title={nomeOrgao}>
                          {nomeOrgao}
                        </h3>
                        <p className="text-xs text-slate-600 line-clamp-3 mb-4" title={objetoCompra}>
                          {objetoCompra}
                        </p>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" /> Encerramento:
                          </span>
                          <span className="font-bold text-slate-900">{formatarData(dataRef)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">Valor Estimado:</span>
                          <span className="font-black text-[#0A2540]">{formatarMoeda(valor)}</span>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/fornecedor/licitacao/${encodeURIComponent(licitacao.id || licitacao.numeroControlePNCP)}`)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            <Search size={14} /> Analisar
                          </button>
                          <a
                            href={portalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-auditoria-pncp btn-download-edital px-3 py-2 bg-white border border-slate-200 hover:border-slate-400 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center"
                            title="Ver no Portal Oficial do PNCP"
                          >
                            PNCP ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}