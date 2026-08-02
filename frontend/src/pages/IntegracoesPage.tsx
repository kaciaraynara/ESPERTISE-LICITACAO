import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { integracoesApi } from '@services/api';
import toast from 'react-hot-toast';
import {
  ExternalLink,
  Activity,
  Database,
  RefreshCw,
  ServerCrash,
  DownloadCloud,
  Crosshair
} from '@components/icons/phosphor-compat';

type Fonte = {
  id: string;
  nome: string;
  orgao: string;
  tipo: string;
  descricao: string;
  documentacaoUrl: string;
  integradoNoApp: boolean;
};

type HealthItem = { id: string; ok: boolean; ms: number; mensagem?: string };

function normalizeHealthPayload(payload: any): HealthItem[] {
  if (Array.isArray(payload?.data)) {
    return payload.data as HealthItem[];
  }

  if (payload?.integrations) {
    return Object.entries(payload.integrations).map(([key, value]) => ({
      id: key.toUpperCase(),
      ok: value === 'connected',
      ms: 35,
      mensagem: value === 'connected' ? 'Operante' : 'Falha',
    })) as HealthItem[];
  }

  return [];
}

export default function IntegracoesPage() {
  const [sincronizando, setSincronizando] = useState(false);

  // 1. Busca do Catálogo
  const catalog = useQuery({
    queryKey: ['integracoes', 'catalogo'],
    queryFn: async () => {
      try {
        const r = await integracoesApi.catalogo();
        return (r.data.data as Fonte[]) ?? [];
      } catch (error) {
        return null;
      }
    },
  });

  // 2. Busca do Health Check
  const health = useQuery({
    queryKey: ['integracoes', 'health'],
    queryFn: async () => {
      try {
        const r = await integracoesApi.health();
        return normalizeHealthPayload(r.data);
      } catch (error) {
        return null;
      }
    },
    refetchInterval: 60_000,
  });

  // 3. Ação do Motor de Busca (Aciona o PNCP Corrigido)
  const handleSincronizarPNCP = async () => {
    setSincronizando(true);
    const toastId = toast.loading('Conectando ao Governo Federal...', {
      style: { background: '#ffffff', color: '#1e293b', border: '1px solid #e2e8f0' }
    });

    try {
      const response = await integracoesApi.sincronizarPncp();

      if (response.data.success) {
        toast.success(`${response.data.inseridos ?? response.data.total ?? 0} editais capturados com sucesso!`, { id: toastId });
      } else {
        toast.error('Ocorreu um erro no servidor ao processar.', { id: toastId });
      }
    } catch (error: any) {
      toast.error('Falha de comunicação com o servidor. Tente novamente.', { id: toastId });
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8 bg-white min-h-screen text-brand-blue">

      {/* CABEÇALHO CORPORATIVO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue tracking-tight">Central de Comando Expertise</h1>
          <p className="text-brand-blue/70 mt-1 text-sm">
            Gerencie o fluxo de dados, automações e a automação operacional da sua conta.
          </p>
        </div>

        <button
          onClick={handleSincronizarPNCP}
          disabled={sincronizando}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue active:scale-95 disabled:bg-white disabled:text-brand-blue/70 text-white px-6 py-3 rounded-lg text-sm font-semibold transition-all shadow-md"
        >
          {sincronizando ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <DownloadCloud className="w-4 h-4" />
          )}
          {sincronizando ? 'Baixando Editais...' : 'Sincronizar PNCP Agora'}
        </button>
      </div>

      {/* PAINEL DE MÓDULOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white rounded-lg text-brand-blue">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-brand-blue">Análise LEX</h3>
          </div>
          <p className="text-sm text-brand-blue/70 mb-4">Análise jurídica de editais, resumo automático e scoring de risco.</p>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold px-2.5 py-1 bg-white text-brand-blue rounded-lg">Motor Operante</span>
            <button className="text-brand-blue text-sm font-medium hover:underline">Ver Análises</button>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white rounded-lg text-brand-blue">
              <Crosshair className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-brand-blue">Radar de Mercado</h3>
          </div>
          <p className="text-sm text-brand-blue/70 mb-4">Espionagem estratégica: veja quem mais ganha e o deságio médio.</p>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold px-2.5 py-1 bg-white text-brand-blue/70 rounded-lg">Aguardando Filtro</span>
            <button className="text-brand-blue text-sm font-medium hover:underline">Pesquisar CNPJ</button>
          </div>
        </div>
      </div>

      {/* STATUS DAS APIS DO GOVERNO */}
      <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-brand-blue" />
            <h2 className="font-bold text-brand-blue text-lg">Saúde das Conexões com o Governo</h2>
          </div>
          <button
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
            className="flex items-center gap-2 text-sm text-brand-blue/70 bg-white hover:bg-white px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${health.isFetching ? 'animate-spin text-brand-blue' : ''}`} />
            Testar Conexão
          </button>
        </div>

        {health.isLoading && <p className="text-sm text-brand-blue/70 flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin"/> Testando rotas...</p>}

        {health.data === null && !health.isLoading && (
          <div className="flex items-center gap-3 text-sm text-brand-blue bg-brand-orange/10 p-4 rounded-lg border border-brand-orange/50">
            <ServerCrash className="w-5 h-5" />
            <div>
              <p className="font-bold">Backend Desconectado</p>
              <p>O painel não conseguiu acessar a API. O servidor Node.js está rodando?</p>
            </div>
          </div>
        )}

        {health.data && health.data !== null && (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(health.data as HealthItem[]).map((h) => (
              <li key={h.id} className="flex items-center justify-between border border-gray-100 bg-white rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-lg ${h.ok ? 'bg-brand-blue shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-brand-orange/10'}`}></span>
                  <span className="text-brand-blue font-bold tracking-wide">{h.id}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-brand-blue/70 font-mono text-xs bg-white px-2 py-1 rounded border border-gray-100">{h.ms} ms</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-md ${h.ok ? 'bg-white text-brand-blue' : 'bg-brand-orange/10 text-brand-blue'}`}>
                    {h.ok ? 'CONECTADO' : 'FALHA'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* CATÁLOGO DE BASES */}
      <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-brand-blue flex items-center gap-2 mb-6">
          <Database className="w-5 h-5 text-brand-blue" />
          Bases de Dados Disponíveis
        </h2>

        <div className="space-y-4">
          {catalog.isLoading && <p className="text-brand-blue/70 text-sm">Carregando catálogo...</p>}
          {catalog.data && catalog.data !== null && (catalog.data as Fonte[]).map((f) => (
            <div key={f.id} className="p-4 border border-gray-100 rounded-lg hover:border-brand-blue/20 transition-colors bg-white">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-bold text-brand-blue text-base">{f.nome}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-brand-blue/70 px-2 py-0.5 rounded-lg">{f.tipo}</span>
                    {f.integradoNoApp ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-brand-blue px-2 py-0.5 rounded-lg">Integrado</span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-brand-blue/70 px-2 py-0.5 rounded-lg">Planejado</span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-brand-blue mb-2">{f.orgao}</p>
                  <p className="text-sm text-brand-blue/70 max-w-3xl leading-relaxed">{f.descricao}</p>
                </div>
                <a
                  href={f.documentacaoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-brand-blue hover:text-brand-blue font-medium bg-white hover:bg-white px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
                >
                  Manual Técnico <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
