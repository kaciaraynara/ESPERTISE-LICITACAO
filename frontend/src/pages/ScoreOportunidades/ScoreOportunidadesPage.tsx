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
  Search,
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
  if (!texto || !termo) return false;
  const esc = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[^a-z0-9à-ú])${esc}(?:$|[^a-z0-9à-ú])`, 'i');
  return re.test(texto);
}

interface GrupoSegmentoCnae {
  id: string;
  prefixos: string[];
  termosChave: string[];
  rotulo: string;
}

const GRUPOS_SEGMENTOS_MERCADO: GrupoSegmentoCnae[] = [
  {
    id: 'vestuario_uniformes',
    prefixos: ['13', '14', '15', '4641', '4642', '4781', '4782'],
    termosChave: [
      'vestuario', 'vestuário', 'roupa', 'roupas', 'uniforme', 'uniformes', 'fardamento', 'fardamentos',
      'calcado', 'calçado', 'calcados', 'calçados', 'tenis', 'tênis', 'confeccao', 'confecção', 'epi',
      'textil', 'têxtil', 'camisa', 'camisas', 'camiseta', 'camisetas', 'jaleco', 'jalecos', 'agasalho',
      'agasalhos', 'calca', 'calça', 'calcas', 'calças', 'avental', 'aventais', 'bota', 'botas', 'coturno',
      'lençol', 'cobertor', 'tecido', 'bone', 'boné', 'costura', 'malharia'
    ],
    rotulo: 'Vestuário, Fardamento e Calçados',
  },
  {
    id: 'software_tecnologia',
    prefixos: ['62', '63', '582', '262', '4651', '4751', '9511'],
    termosChave: [
      'software', 'sistema', 'sistemas', 'informatica', 'informática', 'tecnologia', 'dados', 'nuvem',
      'computador', 'computadores', 'notebook', 'notebooks', 'servidor', 'servidores', 'licenca', 'licença',
      'licenciamento', 'desenvolvimento', 'suporte tecnico', 'suporte técnico', 'ti', 'tic', 'saas', 'hardware',
      'portal', 'aplicativo', 'cloud', 'backup'
    ],
    rotulo: 'Tecnologia da Informação e Software',
  },
  {
    id: 'alimentos_merenda',
    prefixos: ['10', '11', '463', '471', '472', '56'],
    termosChave: [
      'alimento', 'alimentos', 'alimentacao', 'alimentação', 'merenda', 'refeicao', 'refeição', 'refeicoes',
      'refeições', 'hortifruti', 'carne', 'carnes', 'leite', 'generos alimenticios', 'gêneros alimentícios',
      'cesta basica', 'cesta básica', 'panificacao', 'panificação', 'pao', 'pão', 'buffet', 'catering',
      'lanche', 'pereciveis', 'estocaveis'
    ],
    rotulo: 'Alimentação, Merenda e Gêneros',
  },
  {
    id: 'saude_hospitalar',
    prefixos: ['21', '325', '4644', '4645', '4664', '4771', '4773', '86'],
    termosChave: [
      'medicamento', 'medicamentos', 'saude', 'saúde', 'hospitalar', 'medico', 'médico', 'medicos', 'médicos',
      'odontologico', 'odontológico', 'enfermagem', 'laboratorial', 'insumo', 'insumos', 'cirurgico', 'cirúrgico',
      'farmacia', 'farmácia', 'curativo', 'seringa', 'reagente', 'hospitalares', 'ambulatorial'
    ],
    rotulo: 'Saúde, Medicamentos e Hospitalar',
  },
  {
    id: 'obras_engenharia',
    prefixos: ['41', '42', '43', '71'],
    termosChave: [
      'obra', 'obras', 'engenharia', 'reforma', 'reformas', 'construcao', 'construção', 'manutencao predial',
      'manutenção predial', 'pavimentacao', 'pavimentação', 'asfalto', 'drenagem', 'edificacao', 'edificação',
      'alvenaria', 'infraestrutura', 'terraplenagem'
    ],
    rotulo: 'Engenharia, Obras e Manutenção Predial',
  },
  {
    id: 'eletrica_climatizacao',
    prefixos: ['432', '271', '273', '274', '351'],
    termosChave: [
      'eletrica', 'elétrica', 'instalacao eletrica', 'instalação elétrica', 'iluminacao', 'iluminação',
      'climatizacao', 'climatização', 'ar condicionado', 'refrigeracao', 'refrigeração', 'energia solar',
      'fotovoltaico', 'fotovoltaica', 'subestacao', 'cabeamento'
    ],
    rotulo: 'Elétrica, Energia e Climatização',
  },
  {
    id: 'moveis_mobiliario',
    prefixos: ['310', '4649', '4754'],
    termosChave: [
      'mobiliario', 'mobiliário', 'movel', 'móvel', 'moveis', 'móveis', 'cadeira', 'cadeiras', 'mesa', 'mesas',
      'armario', 'armário', 'armarios', 'armários', 'estacao de trabalho', 'estação de trabalho', 'poltrona',
      'longarina', 'gaveteiro'
    ],
    rotulo: 'Mobiliário e Móveis de Escritório',
  },
  {
    id: 'papelaria_grafica',
    prefixos: ['17', '18', '4647', '4761', '4789'],
    termosChave: [
      'papelaria', 'material de escritorio', 'material de escritório', 'material escolar', 'suprimentos',
      'impressao', 'impressão', 'grafica', 'gráfica', 'toner', 'cartucho', 'papel', 'envelopes', 'pasta'
    ],
    rotulo: 'Papelaria, Gráfica e Suprimentos',
  },
  {
    id: 'limpeza_conservacao',
    prefixos: ['812', '813', '206', '78'],
    termosChave: [
      'limpeza', 'conservacao', 'conservação', 'higiene', 'asseio', 'zeladoria', 'desinfetante', 'facilities',
      'jardinagem', 'desinfeccao', 'desinfecção', 'higienizacao', 'higienização', 'portaria', 'saco de lixo'
    ],
    rotulo: 'Limpeza, Asseio e Conservação',
  },
  {
    id: 'seguranca_vigilancia',
    prefixos: ['801', '802', '803'],
    termosChave: [
      'seguranca', 'segurança', 'vigilancia', 'vigilância', 'cftv', 'camera', 'câmera', 'alarme',
      'monitoramento', 'controle de acesso', 'portaria', 'ronda'
    ],
    rotulo: 'Segurança, Vigilância e CFTV',
  },
  {
    id: 'transporte_veiculos',
    prefixos: ['49', '52', '53', '771'],
    termosChave: [
      'transporte', 'veiculo', 'veículo', 'veiculos', 'veículos', 'locacao de veiculo', 'locação de veículos',
      'frete', 'van', 'onibus', 'ônibus', 'combustivel', 'combustível', 'pneu', 'pneus', 'passageiros'
    ],
    rotulo: 'Transporte, Locação e Frotas',
  },
  {
    id: 'consultoria_servicos',
    prefixos: ['69', '70', '73', '74', '82', '85'],
    termosChave: [
      'consultoria', 'assessoria', 'treinamento', 'capacitacao', 'capacitação', 'auditoria', 'evento', 'eventos',
      'sonorizacao', 'sonorização', 'comunicacao', 'comunicação', 'juridica', 'contabil'
    ],
    rotulo: 'Consultoria, Treinamento e Serviços',
  },
];

function extrairPerfilSemanticoEmpresa(empresa: any): {
  termos: string[];
  gruposIdentificados: string[];
  cnaeCodigo: string;
} {
  const cnaesCandidatos = [
    empresa?.cnaePrincipal,
    empresa?.cnae_principal,
    ...(Array.isArray(empresa?.cnaeSecundarios) ? empresa.cnaeSecundarios : []),
    ...(Array.isArray(empresa?.cnaes_secundarios) ? empresa.cnaes_secundarios : []),
  ]
    .filter(Boolean)
    .map((c) => String(c).replace(/\D/g, ''));

  const cnaeCodigo = cnaesCandidatos[0] || '';
  const termosSet = new Set<string>();
  const gruposSet = new Set<string>();

  cnaesCandidatos.forEach((cnaeDigits) => {
    GRUPOS_SEGMENTOS_MERCADO.forEach((grupo) => {
      const match = grupo.prefixos.some((pref) => cnaeDigits.startsWith(pref));
      if (match) {
        gruposSet.add(grupo.rotulo);
        grupo.termosChave.forEach((t) => termosSet.add(t));
      }
    });
  });

  const descricao = String(empresa?.cnaeDescricao || empresa?.ramoAtividade || '').toLowerCase();
  if (descricao) {
    const palavrasDesc = descricao
      .split(/[^a-z0-9à-ú]+/i)
      .filter((w) => w.length >= 4 && !['comercio', 'comércio', 'varejista', 'atacadista', 'servicos', 'serviços'].includes(w));
    palavrasDesc.forEach((p) => termosSet.add(p));
  }

  if (Array.isArray(empresa?.palavrasChave)) {
    empresa.palavrasChave.forEach((p: string) => {
      if (p && typeof p === 'string' && p.trim().length >= 3) {
        termosSet.add(p.trim().toLowerCase());
      }
    });
  }

  return {
    termos: Array.from(termosSet),
    gruposIdentificados: Array.from(gruposSet),
    cnaeCodigo,
  };
}

function avaliarViabilidade(
  edital: any,
  empresa: any,
  perfil: ReturnType<typeof extrairPerfilSemanticoEmpresa>
): {
  faixa: 'ALTA' | 'MODERADA' | 'BAIXA';
  scorePercentual: number;
  rotulo: string;
  resumo: string;
  motivos: string[];
} {
  let pontos = 0;
  const motivos: string[] = [];
  const objeto = String(edital.objeto || edital.objetoCompra || '').toLowerCase();
  const ufEmpresa = String(empresa?.uf || '').toUpperCase();
  const ufEdital = String(edital.uf || edital.unidadeOrgao?.ufSigla || '').toUpperCase();

  // 1. Verificação Semântica com o CNAE / Palavras-chave da Empresa
  const termosCorrespondentes = perfil.termos.filter((t) => matchesWordBoundaryPt(objeto, t));
  const temCnaeCadastrado = perfil.termos.length > 0 || Boolean(perfil.cnaeCodigo);

  if (termosCorrespondentes.length >= 2) {
    pontos += 6;
    motivos.push(`Objeto diretamente compatível com o CNAE (${termosCorrespondentes.slice(0, 2).join(', ')})`);
  } else if (termosCorrespondentes.length === 1) {
    pontos += 5;
    motivos.push(`Termo do seu segmento identificado: "${termosCorrespondentes[0]}"`);
  } else if (!temCnaeCadastrado) {
    pontos += 3;
    motivos.push('Avaliação setorial ampla (sem restrição estrita de CNAE)');
  } else {
    // Objeto não correlato ao CNAE cadastrado
    motivos.push('Objeto licitado de segmento distinto das atividades cadastradas');
  }

  // 2. Proximidade Geográfica
  if (ufEmpresa && ufEdital && ufEmpresa === ufEdital) {
    pontos += 2;
    motivos.push(`Órgão no mesmo estado da sua empresa (${ufEmpresa})`);
  }

  // 3. Orçamento Estimado Divulgado
  const valor = Number(edital.valorTotalEstimado ?? edital.valorEstimado ?? 0);
  if (valor > 0) {
    pontos += 1;
    motivos.push(`Valor de referência orçado (${formatarMoeda(valor)})`);
  }

  // 4. Prazo Hábil
  const dataAbertura = edital.dataAberturaProposta || edital.dataEncerramentoProposta;
  if (dataAbertura) {
    const dias = (new Date(dataAbertura).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (dias >= 3) {
      pontos += 1;
      motivos.push(`Prazo hábil para preparação da proposta (${Math.ceil(dias)} dias restantes)`);
    } else if (dias >= 0) {
      motivos.push('Prazo curto: priorize conferência imediata dos documentos');
    }
  }

  // Classificação semafórica
  if (pontos >= 5) {
    const scorePct = Math.min(95, 75 + pontos * 2);
    return {
      faixa: 'ALTA',
      scorePercentual: scorePct,
      rotulo: 'Alta Viabilidade · Edital Recomendado',
      resumo: 'Objeto diretamente alinhado às atividades e CNAE da sua empresa. Ampla viabilidade técnica.',
      motivos,
    };
  }

  if (pontos >= 3) {
    const scorePct = 60 + pontos * 2;
    return {
      faixa: 'MODERADA',
      scorePercentual: scorePct,
      rotulo: 'Aderência Moderada · Avaliar Edital',
      resumo: 'Aderência parcial ou fornecimento correlato; confirme as exigências de habilitação e atestados.',
      motivos,
    };
  }

  return {
    faixa: 'BAIXA',
    scorePercentual: 35,
    rotulo: 'Fora do Perfil · Outro Segmento',
    resumo: 'Objeto licitado não corresponde às atividades ou CNAE cadastrados na sua empresa.',
    motivos,
  };
}

export const ScoreOportunidadesPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const [editais, setEditais] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizandoPncp, setAtualizandoPncp] = useState(false);
  const [filtro, setFiltro] = useState<'TODOS' | 'ALTA' | 'MODERADA' | 'BAIXA'>('TODOS');
  const [buscaTexto, setBuscaTexto] = useState('');

  const perfilEmpresa = useMemo(() => {
    return extrairPerfilSemanticoEmpresa(selectedCompany);
  }, [selectedCompany]);

  const carregarEditais = async (tempoReal = false) => {
    if (tempoReal) setAtualizandoPncp(true);
    else setCarregando(true);

    try {
      const cnaeAtivo = (selectedCompany as any)?.cnaePrincipal || (selectedCompany as any)?.cnae_principal || undefined;
      const palavrasAtivas = (selectedCompany as any)?.palavrasChave || perfilEmpresa.termos.slice(0, 5);

      const resp = await licitacoesApi.listar({
        local: !tempoReal,
        cnae: cnaeAtivo,
        palavras: palavrasAtivas,
        tamanhoPagina: 100,
        ordenarPor: 'relevancia',
      } as any);

      const lista = resp.data?.items || resp.data?.data || [];
      const listaArray = Array.isArray(lista) ? lista : [];
      setEditais(listaArray);

      // Auto-recuperação: se a consulta local inicial retornar vazia ou sem certames para este CNAE,
      // busca automaticamente no PNCP em tempo real para alimentar a grade com certames oficiais.
      if (!tempoReal && listaArray.length === 0) {
        carregarEditais(true);
      }
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

  const analisados = useMemo(() => {
    const todosAvaliados = editais.map((ed) => ({
      ...ed,
      _analise: avaliarViabilidade(ed, selectedCompany, perfilEmpresa),
    }));

    // Ordenação técnica: Alta Viabilidade SEMPRE no topo absoluto, ordenados por pontuação e valor
    return todosAvaliados.sort((a, b) => {
      const peso: Record<string, number> = { ALTA: 3, MODERADA: 2, BAIXA: 1 };
      const diffPeso = peso[b._analise.faixa] - peso[a._analise.faixa];
      if (diffPeso !== 0) return diffPeso;
      return (b._analise.scorePercentual || 0) - (a._analise.scorePercentual || 0);
    });
  }, [editais, selectedCompany, perfilEmpresa]);

  const altas = analisados.filter((e) => e._analise.faixa === 'ALTA').length;
  const moderadas = analisados.filter((e) => e._analise.faixa === 'MODERADA').length;
  const baixas = analisados.filter((e) => e._analise.faixa === 'BAIXA').length;

  const filtrados = useMemo(() => {
    let lista = analisados;
    if (filtro !== 'TODOS') {
      lista = lista.filter((e) => e._analise.faixa === filtro);
    }
    if (buscaTexto.trim()) {
      const termo = buscaTexto.trim().toLowerCase();
      lista = lista.filter((e) => {
        const obj = String(e.objeto || e.objetoCompra || '').toLowerCase();
        const org = String(e.orgao || e.orgaoEntidade?.razaoSocial || '').toLowerCase();
        return obj.includes(termo) || org.includes(termo);
      });
    }
    return lista;
  }, [analisados, filtro, buscaTexto]);

  const dadosGrafico = [
    { nome: 'Alta Viabilidade', qtd: altas, cor: '#059669' },
    { nome: 'Avaliar Exigências', qtd: moderadas, cor: '#D97706' },
    { nome: 'Fora do Perfil', qtd: baixas, cor: '#94A3B8' },
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
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6 bg-[#FFFFFF]">
      {/* Cabeçalho da Mesa de Viabilidade */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B192C] text-emerald-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-[#0F172A]">Análise de Viabilidade por CNAE</h1>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                Lei 14.133/2021
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Classifica e ordena os certames pelo grau de viabilidade técnica e compatibilidade direta com a sua empresa.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
            <Building2 className="h-4 w-4 text-[#0B192C]" />
            <span className="font-bold">{selectedCompany?.razaoSocial || 'Empresa Ativa'}</span>
            {selectedCompany?.cnaePrincipal && (
              <span className="rounded bg-white border border-slate-200 px-2 py-0.5 font-bold text-slate-600">
                CNAE: {selectedCompany.cnaePrincipal}
              </span>
            )}
            {selectedCompany?.uf && (
              <span className="rounded bg-white border border-slate-200 px-2 py-0.5 font-bold text-[#0B192C]">
                {selectedCompany.uf}
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={atualizandoPncp}
            onClick={() => carregarEditais(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B192C] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${atualizandoPncp ? 'animate-spin' : ''}`} />
            {atualizandoPncp ? 'Consultando PNCP...' : 'Atualizar Editais em Tempo Real'}
          </button>
        </div>
      </div>

      {/* Segmentos Identificados */}
      {perfilEmpresa.gruposIdentificados.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 text-xs text-slate-700">
          <span className="font-bold text-[#0B192C]">Segmentos Reconhecidos da Empresa:</span>
          {perfilEmpresa.gruposIdentificados.map((g) => (
            <span key={g} className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 font-semibold text-[#0B192C] shadow-2xs">
              {g}
            </span>
          ))}
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Editais Analisados</div>
          <div className="mt-2 text-2xl font-extrabold text-[#0F172A]">{analisados.length}</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Alta Viabilidade (Recomendados)
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700">{altas}</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Avaliar Exigências
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-700">{moderadas}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <XCircle className="h-4 w-4 text-slate-400" /> Fora do Perfil
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-600">{baixas}</div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-extrabold text-[#0F172A]">Distribuição de Viabilidade dos Certames</h2>
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
          <h2 className="mb-4 text-sm font-extrabold text-[#0F172A]">Oportunidades por Estado (UF)</h2>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosUf}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="uf" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qtd" fill="#0B192C" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Barra de Filtro e Busca */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'TODOS', label: `Todos (${analisados.length})` },
            { id: 'ALTA', label: `Alta Viabilidade (${altas})` },
            { id: 'MODERADA', label: `Avaliar Exigências (${moderadas})` },
            { id: 'BAIXA', label: `Fora do Perfil (${baixas})` },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id as any)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${filtro === f.id
                ? 'bg-[#0B192C] text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={buscaTexto}
            onChange={(e) => setBuscaTexto(e.target.value)}
            placeholder="Filtrar por objeto ou órgão..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-800 focus:border-[#0B192C] focus:outline-hidden"
          />
        </div>
      </div>

      {/* Lista de Editais */}
      {carregando ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-sm font-semibold text-[#0B192C]">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          Analisando viabilidade dos editais para sua empresa...
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Nenhum edital localizado para este critério</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Clique no botão &ldquo;Atualizar Editais em Tempo Real&rdquo; acima para consultar certames recém-publicados no PNCP e ampliar a busca pelo seu CNAE ({selectedCompany?.razaoSocial || 'Empresa Ativa'}).
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtrados.slice(0, 40).map((ed, idx) => {
            const { faixa, scorePercentual, rotulo, resumo, motivos } = ed._analise;
            const badge =
              faixa === 'ALTA'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : faixa === 'MODERADA'
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-100 text-slate-600 border-slate-200';
            const portalUrl = buildOfficialPncpPortalUrl(ed);

            return (
              <div
                key={ed.id || idx}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${faixa === 'ALTA' ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-200'
                  }`}
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-bold ${badge}`}>
                        {faixa === 'ALTA' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                        {rotulo} ({scorePercentual}%)
                      </span>
                      <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-0.5 text-xs font-semibold text-slate-700">
                        {ed.modalidadeNome || ed.modalidade || 'Pregão Eletrônico'}
                      </span>
                      {ed.uf && (
                        <span className="rounded-full bg-[#0B192C]/5 border border-[#0B192C]/10 px-2.5 py-0.5 text-xs font-bold text-[#0B192C]">
                          UF: {ed.uf}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-extrabold text-[#0F172A]">
                      {ed.orgao || ed.orgaoEntidade?.razaoSocial || 'Órgão Licitante Oficial'}
                    </h3>

                    <p className="text-xs font-medium text-slate-700">{resumo}</p>

                    <p className="text-xs leading-relaxed text-slate-600 line-clamp-3">
                      {ed.objeto || ed.objetoCompra || 'Objeto do certame conforme termo de referência'}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                      <span>
                        Valor Estimado: <strong className="text-emerald-700 font-bold">{formatarMoeda(ed.valorTotalEstimado ?? ed.valorEstimado)}</strong>
                      </span>
                      <span>
                        Abertura da Sessão: <strong>{formatPncpDateTime(ed.dataAberturaProposta || ed.dataPublicacaoPncp)}</strong>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {motivos.map((m: string) => (
                        <span
                          key={m}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                        >
                          <FileCheck2 className="h-3 w-3 text-emerald-600" /> {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 md:flex-col items-end">
                    <button
                      type="button"
                      onClick={() => navigate(`${FORNECEDOR_ROUTES.analise_viabilidade}/${encodeURIComponent(ed.id || '')}`)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B192C] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm w-full justify-center"
                    >
                      <Scale className="h-4 w-4 text-emerald-400" />
                      Análise Técnica de Viabilidade
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`${FORNECEDOR_ROUTES.lex}?edital=${encodeURIComponent(ed.id || '')}`)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition w-full justify-center"
                    >
                      Ler Edital Completo
                    </button>
                    {portalUrl && (
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-[#0B192C] hover:bg-slate-50 w-full justify-center"
                      >
                        Portal PNCP <ExternalLink className="h-3.5 w-3.5" />
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
