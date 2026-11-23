import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Scale,
  ExternalLink,
  Building2,
  FileCheck2,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { licitacoesApi } from '@/services/api';
import { useCompany } from '@/contexts/CompanyContext';
import { FORNECEDOR_ROUTES } from '@/routes';
import { buildOfficialPncpPortalUrl, formatPncpDateTime } from '@/utils/pncp';

function formatarMoeda(v: number | null | undefined): string {
  if (!v || Number.isNaN(Number(v))) return 'Sob consulta';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(v));
}

function matchesWordBoundaryPt(texto: string, termo: string): boolean {
  const esc = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[^a-z0-9à-ú])${esc}(?:$|[^a-z0-9à-ú])`, 'i');
  return re.test(texto);
}

function avaliarViabilidade(edital: any, empresa: any): {
  faixa: 'ALTA' | 'MODERADA' | 'BAIXA';
  rotulo: string;
  resumo: string;
  motivos: string[];
} {
  let pontos = 0;
  const motivos: string[] = [];
  const objeto = String(edital.objeto || edital.objetoCompra || '').toLowerCase();
  const ufEmpresa = String(empresa?.uf || '').toUpperCase();
  const ufEdital = String(edital.uf || edital.unidadeOrgao?.ufSigla || '').toUpperCase();

  if (ufEmpresa && ufEdital && ufEmpresa === ufEdital) {
    pontos += 2;
    motivos.push(`Localizado no mesmo estado da empresa (${ufEmpresa})`);
  }

  const stopWordsCnae = new Set(['comercio', 'comércio', 'varejista', 'atacadista', 'servicos', 'serviços', 'artigos', 'outros', 'produtos', 'geral', 'manutencao', 'manutenção', 'equipamentos']);
  const cnaeDesc = String(empresa?.cnaeDescricao || empresa?.cnaePrincipal || empresa?.cnae_principal || '').toLowerCase();
  const palavrasCnae = cnaeDesc
    .split(/[^a-z0-9à-ú]+/i)
    .filter((w) => w.length >= 4 && !stopWordsCnae.has(w));

  const sinonimosVestuario = [
    'vestuario', 'vestuário', 'roupa', 'uniforme', 'fardamento', 'calcado', 'calçado',
    'tenis', 'tênis', 'confeccao', 'confecção', 'epi', 'textil', 'têxtil', 'camisa',
    'camiseta', 'jaleco', 'agasalho', 'calca', 'calça', 'meia', 'avental', 'lençol',
    'cobertor', 'tecido', 'bone', 'boné', 'agasalhos', 'fardas', 'camisas'
  ];
  const ehVestuario =
    palavrasCnae.some((p) => p.includes('vestu') || p.includes('roup') || p.includes('confe') || p.includes('calc') || p.includes('text') || p.includes('têxt')) ||
    /^1[345]|^478[12]|^464[12]/.test(cnaeDesc.replace(/\D/g, ''));
  const ehFalsoPositivoVestuario =
    ehVestuario &&
    /lavadora|lavanderia|eletrodom[eé]stico|refrigera[cç][aã]o|esclerosante|varizes|cir[uú]rgic|hospitalar|asfalto|pavimenta/.test(objeto) &&
    !sinonimosVestuario.some((s) => matchesWordBoundaryPt(objeto, s));

  const bateuCnae =
    !ehFalsoPositivoVestuario &&
    (palavrasCnae.some((p) => matchesWordBoundaryPt(objeto, p)) ||
      (ehVestuario && sinonimosVestuario.some((s) => matchesWordBoundaryPt(objeto, s))));

  const temCnaeCadastrado = Boolean(empresa?.cnaePrincipal || empresa?.cnae_principal || cnaeDesc.trim());

  // REGRA DE SEGURANÇA ESTRITA: Se a empresa possui CNAE, editais sem aderência ao CNAE são estritamente FORA DO PERFIL
  if (temCnaeCadastrado && !bateuCnae) {
    return {
      faixa: 'BAIXA',
      rotulo: 'Fora do Perfil · Segmento Diferente',
      resumo: 'Objeto licitado não corresponde às atividades ou CNAE cadastrados na sua empresa.',
      motivos: ['Atividade fora do CNAE da empresa'],
    };
  }

  if (bateuCnae) {
    pontos += 4;
    motivos.push('Objeto compatível com o CNAE da empresa');
  }

  const valor = Number(edital.valorTotalEstimado ?? edital.valorEstimado ?? 0);
  if (valor > 0) {
    pontos += 1;
    motivos.push('Valor estimado divulgado no PNCP');
  }

  const dataAbertura = edital.dataAberturaProposta || edital.dataEncerramentoProposta;
  if (dataAbertura) {
    const dias = (new Date(dataAbertura).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (dias >= 3) {
      pontos += 1;
      motivos.push('Prazo habil para analise e envio de proposta');
    } else if (dias >= 0) {
      motivos.push('Prazo curto: priorize conferencia imediata dos documentos');
    }
  }

  if (pontos >= 4) {
    return {
      faixa: 'ALTA',
      rotulo: 'Alta Aderência · Avaliar participação',
      resumo: 'Alta aderência ao perfil cadastrado. Ainda é necessário conferir edital, custos e prazos.',
      motivos,
    };
  }
  if (pontos >= 2) {
    return {
      faixa: 'MODERADA',
      rotulo: 'Aderência Moderada · Verificar exigências',
      resumo: 'Aderência parcial; revise o edital completo e os requisitos de habilitação.',
      motivos: motivos.length ? motivos : ['Requer leitura do edital para confirmar especificacoes'],
    };
  }
  return {
    faixa: 'BAIXA',
    rotulo: 'Baixa Aderência · Fora do perfil',
    resumo: 'Baixa aderência ao CNAE ou estado cadastrado. Não indica baixa concorrência.',
    motivos: motivos.length ? motivos : ['Objeto distante da atividade principal cadastrada'],
  };
}

export const ScoreOportunidadesPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const [editais, setEditais] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizandoPncp, setAtualizandoPncp] = useState(false);
  const [filtro, setFiltro] = useState<'TODOS' | 'ALTA' | 'MODERADA' | 'BAIXA'>('TODOS');

  const carregarEditais = async (tempoReal = false) => {
    if (tempoReal) setAtualizandoPncp(true);
    else setCarregando(true);

    try {
      const cnaeAtivo = (selectedCompany as any)?.cnaePrincipal || (selectedCompany as any)?.cnae_principal || undefined;
      const resp = await licitacoesApi.listar({ local: !tempoReal, cnae: cnaeAtivo } as any);
      const lista = resp.data?.items || resp.data?.data || [];
      setEditais(Array.isArray(lista) ? lista : []);
    } catch {
      if (!tempoReal) setEditais([]);
    } finally {
      setCarregando(false);
      setAtualizandoPncp(false);
    }
  };

  useEffect(() => {
    carregarEditais(false);
  }, [selectedCompany?.id]);

  const cnaeAtivo = (selectedCompany as any)?.cnaePrincipal || (selectedCompany as any)?.cnae_principal || undefined;

  const analisados = useMemo(() => {
    const todosAvaliados = editais.map((ed) => ({ ...ed, _analise: avaliarViabilidade(ed, selectedCompany) }));
    // Filtro estrito por CNAE: cada empresa só visualiza oportunidades aderentes ao seu segmento
    const apenasCompativeis = cnaeAtivo
      ? todosAvaliados.filter((ed) => ed._analise.faixa === 'ALTA' || ed._analise.faixa === 'MODERADA')
      : todosAvaliados;

    return apenasCompativeis.sort((a, b) => {
      const peso: Record<string, number> = { ALTA: 3, MODERADA: 2, BAIXA: 1 };
      return peso[b._analise.faixa] - peso[a._analise.faixa];
    });
  }, [editais, selectedCompany, cnaeAtivo]);

  const altas = analisados.filter((e) => e._analise.faixa === 'ALTA').length;
  const moderadas = analisados.filter((e) => e._analise.faixa === 'MODERADA').length;
  const baixas = analisados.filter((e) => e._analise.faixa === 'BAIXA').length;

  const filtrados =
    filtro === 'TODOS' ? analisados : analisados.filter((e) => e._analise.faixa === filtro);

  const dadosGrafico = [
    { nome: 'Recomendados', qtd: altas, cor: '#16A34A' },
    { nome: 'Avaliar', qtd: moderadas, cor: '#F59E0B' },
    { nome: 'Fora do Perfil', qtd: baixas, cor: '#DC2626' },
  ];

  const mapaUf: Record<string, number> = {};
  analisados.forEach((e) => {
    const u = String(e.uf || e.unidadeOrgao?.ufSigla || 'BR').toUpperCase();
    mapaUf[u] = (mapaUf[u] || 0) + 1;
  });
  const dadosUf = Object.entries(mapaUf)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([uf, qtd]) => ({ uf, qtd }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#081C3A] text-[#F97316]">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#081C3A]">Análise de Aderência de Oportunidades</h1>
            <p className="text-xs text-slate-500">
              Ordena editais pela aderência ao perfil cadastrado (CNAE, UF, valor e prazo).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <Building2 className="h-4 w-4 text-[#0070C0]" />
            <span className="font-bold">{selectedCompany?.razaoSocial || 'Empresa Ativa'}</span>
            {selectedCompany?.uf && (
              <span className="rounded bg-white px-2 py-0.5 font-bold">{selectedCompany.uf}</span>
            )}
          </div>
          <button
            type="button"
            disabled={atualizandoPncp}
            onClick={() => carregarEditais(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#081C3A] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${atualizandoPncp ? 'animate-spin' : ''}`} />
            {atualizandoPncp ? 'Consultando PNCP...' : 'Atualizar do PNCP em Tempo Real'}
          </button>
        </div>
      </div>

      <div role="note" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-xs leading-relaxed">
          <strong>Este score mede aderência ao seu perfil, não concorrência.</strong> Ele não usa dados de
          lances, participantes ou quantidade de propostas. Portanto, &ldquo;baixa aderência&rdquo;{' '}
          <strong>não</strong> significa &ldquo;licitação com baixa procura&rdquo;. Antes de participar,
          confirme o edital, os requisitos e a viabilidade financeira.
        </p>
      </div>

      {/* KPIs simples sem numeracao tecnica */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Editais Analisados</div>
          <div className="mt-2 text-2xl font-extrabold text-[#081C3A]">{analisados.length}</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Alta Aderência
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700">{altas}</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <AlertTriangle className="h-4 w-4" /> Avaliar Exigencias
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-700">{moderadas}</div>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
            <XCircle className="h-4 w-4" /> Fora do Perfil
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-700">{baixas}</div>
        </div>
      </div>

      {/* Graficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-extrabold text-[#081C3A]">Resumo das Oportunidades</h2>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                  {dadosGrafico.map((entry, idx) => (
                    <Cell key={idx} fill={entry.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-extrabold text-[#081C3A]">Estados com Mais Editais</h2>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosUf}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="uf" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qtd" fill="#081C3A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'TODOS', label: `Todos (${analisados.length})` },
          { id: 'ALTA', label: `Recomendados (${altas})` },
          { id: 'MODERADA', label: `Avaliar (${moderadas})` },
          { id: 'BAIXA', label: `Fora do Perfil (${baixas})` },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id as any)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${filtro === f.id
              ? 'bg-[#081C3A] text-white'
              : 'border border-slate-200 bg-white text-[#081C3A] hover:bg-slate-50'
              }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-sm font-semibold text-[#081C3A]">
          <Loader2 className="h-5 w-5 animate-spin text-[#F97316]" />
          Carregando editais disponíveis para sua empresa...
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Nenhum edital localizado para este filtro</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Os editais são sincronizados e filtrados estritamente pelo CNAE da sua empresa ({selectedCompany?.razaoSocial || 'Empresa Ativa'}). Clique no botão &ldquo;Atualizar do PNCP em Tempo Real&rdquo; acima para buscar certames adicionais abertos na base nacional.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtrados.slice(0, 40).map((ed, idx) => {
            const { faixa, rotulo, resumo, motivos } = ed._analise;
            const badge =
              faixa === 'ALTA'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : faixa === 'MODERADA'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200';
            const portalUrl = buildOfficialPncpPortalUrl(ed);

            return (
              <div key={ed.id || idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-0.5 text-xs font-bold ${badge}`}>
                        {rotulo}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold text-slate-700">
                        {ed.modalidadeNome || ed.modalidade || 'Pregao'}
                      </span>
                    </div>
                    <h3 className="text-sm font-extrabold text-[#081C3A]">
                      {ed.orgao || ed.orgaoEntidade?.razaoSocial || 'Orgao Publico'}
                    </h3>
                    <p className="text-xs font-medium text-slate-600">{resumo}</p>
                    <p className="text-xs leading-relaxed text-slate-700">
                      {ed.objeto || ed.objetoCompra || 'Objeto nao informado'}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span>
                        Valor: <strong className="text-emerald-700">{formatarMoeda(ed.valorTotalEstimado ?? ed.valorEstimado)}</strong>
                      </span>
                      <span>
                        Abertura: <strong>{formatPncpDateTime(ed.dataAberturaProposta || ed.dataPublicacaoPncp)}</strong>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {motivos.map((m: string) => (
                        <span key={m} className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          <FileCheck2 className="h-3 w-3 text-[#F97316]" /> {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`${FORNECEDOR_ROUTES.analise_viabilidade}/${encodeURIComponent(ed.id || '')}`)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#081C3A] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm"
                    >
                      <Scale className="h-4 w-4 text-emerald-400" />
                      Análise Técnica de Viabilidade
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`${FORNECEDOR_ROUTES.lex}?edital=${encodeURIComponent(ed.id || '')}`)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Ler Edital Completo
                    </button>
                    {portalUrl && (
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-[#0070C0] hover:bg-slate-50"
                      >
                        PNCP <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScoreOportunidadesPage;
