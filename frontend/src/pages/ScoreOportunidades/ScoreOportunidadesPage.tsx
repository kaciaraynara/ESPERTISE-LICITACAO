import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileDown,
  FileText,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
  BarChart3,
  PieChart as PieIcon,
  Coins,
  Loader2,
  Globe,
  Download,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import api, { certidoesApi, documentosApi, licitacoesApi, noticesApi } from '@/services/api';
import { useCompany } from '@/contexts/CompanyContext';
import { exportarDossieEditalPdf, DadosDossieEditalPdf } from '@/utils/dossieEditalPdfGenerator';

type NivelViabilidade = 'PRONTO' | 'ATENCAO' | 'FORA';

interface EditalBruto {
  id: string;
  numeroControlePNCP?: string;
  objeto?: string;
  objetoCompra?: string;
  orgao?: string;
  nomeOrgao?: string;
  uf?: string;
  municipio?: string;
  modalidade?: string;
  modalidadeNome?: string;
  valorEstimado?: number | null;
  valorTotalEstimado?: number | null;
  dataEncerramentoProposta?: string | null;
  dataEncerramento?: string | null;
  dataAberturaProposta?: string | null;
  urlOficialPncp?: string | null;
  urlOficial?: string | null;
  link?: string | null;
  srp?: boolean;
  metadata?: any;
}

const UFS_BRASIL = [
  'TODOS', 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ',
  'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

interface EditalViabilidade {
  edital: EditalBruto;
  nivel: NivelViabilidade;
  pontuacao: number;
  objetoTexto: string;
  orgaoTexto: string;
  valor: number | null;
  dataLimite: string | null;
  diasRestantes: number | null;
  motivosPositivos: string[];
  alertas: string[];
  linkPortal: string;
  statusLeitura: 'COMPLETO' | 'PENDENTE' | 'SEM_ARQUIVOS';
}

const STOPWORDS_CNAE = new Set([
  'comercio', 'varejista', 'atacadista', 'servicos', 'servico', 'atividades',
  'atividade', 'outros', 'outras', 'artigos', 'produtos', 'pecas', 'materiais',
  'material', 'equipamentos', 'equipamento', 'nao', 'especificados', 'anteriormente',
  'exceto', 'para', 'de', 'da', 'do', 'das', 'dos', 'em', 'com', 'por', 'e', 'ou',
]);

const GRUPOS_SINONIMOS: Array<{ gatilhos: string[]; termos: string[]; negativos?: string[] }> = [
  {
    gatilhos: ['vestuario', 'roupa', 'roupas', 'uniforme', 'confeccao', 'calcado', 'tecido', '1412', '4781', '4642'],
    termos: ['vestuario', 'uniforme', 'uniformes', 'fardamento', 'camiseta', 'calca', 'jaleco', 'avental', 'epi', 'calcado', 'bota', 'confeccao', 'tecido', 'enxoval'],
    negativos: ['lavadora de roupas', 'maquina de lavar', 'conserto de lavadora', 'manutencao em lavadora', 'secadora de roupas'],
  },
  {
    gatilhos: ['software', 'sistema', 'informatica', 'computacao', 'tecnologia', 'dados', 'tic', 'saas', '6201', '6202', '6203', '6204', '6209', '6311'],
    termos: ['software', 'sistema', 'saas', 'licenca', 'nuvem', 'cloud', 'informatica', 'tecnologia', 'desenvolvimento', 'suporte tecnico', 'hospedagem', 'computador', 'notebook', 'servidor', 'rede', 'ciberseguranca'],
    negativos: ['sistema de esgoto', 'sistema viario', 'sistema eletrico predial', 'sistema hidraulico'],
  },
  {
    gatilhos: ['engenharia', 'construcao', 'obra', 'obras', 'edificacao', 'pavimentacao', '4120', '4211', '4221', '4399'],
    termos: ['obra', 'reforma', 'construcao', 'engenharia', 'pavimentacao', 'drenagem', 'edificacao', 'manutencao predial', 'pintura', 'alvenaria', 'impermeabilizacao'],
  },
  {
    gatilhos: ['limpeza', 'conservacao', 'asseio', 'higienizacao', 'jardinagem', '8121', '8129', '8130'],
    termos: ['limpeza', 'conservacao', 'asseio', 'zeladoria', 'higienizacao', 'jardinagem', 'rocagem', 'dedetizacao', 'controle de pragas', 'saneante'],
  },
  {
    gatilhos: ['hospitalar', 'medico', 'odontologico', 'medicamento', 'farmaceutico', 'saude', '4644', '4645', '4771'],
    termos: ['hospitalar', 'medico', 'odontologico', 'laboratorial', 'medicamento', 'farmaceutico', 'seringa', 'curativo', 'luva', 'reagente', 'diagnostico'],
  },
  {
    gatilhos: ['alimenticio', 'alimento', 'alimentos', 'merenda', 'refeicao', 'bebida', '4639', '4711', '4721', '5620'],
    termos: ['alimenticio', 'alimento', 'merenda', 'cesta basica', 'hortifruti', 'panificacao', 'refeicao', 'coffee break', 'agua mineral', 'leite', 'cafe'],
  },
  {
    gatilhos: ['mobiliario', 'moveis', 'movel', 'escritorio', '3101', '3102', '4754'],
    termos: ['mobiliario', 'moveis', 'cadeira', 'mesa', 'armario', 'estante', 'longarina', 'carteira escolar', 'escritorio'],
  },
  {
    gatilhos: ['papelaria', 'impressao', 'grafica', 'expediente', 'escolar', '4647', '4761', '1813'],
    termos: ['papelaria', 'expediente', 'papel a4', 'grafica', 'impressao', 'banner', 'apostila', 'material escolar', 'material de escritorio'],
  },
  {
    gatilhos: ['transporte', 'logistica', 'frete', 'veiculo', 'combustivel', '4930', '4929', '4731'],
    termos: ['transporte', 'logistica', 'frete', 'locacao de veiculo', 'veiculo', 'onibus', 'van', 'caminhao', 'combustivel', 'pneu', 'manutencao de frota'],
  },
];

function normalizar(texto: string): string {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function extrairPerfisCnae(company: any): {
  cnaesLista: string[];
  termosBusca: string[];
  termosMatch: string[];
  negativos: string[];
} {
  if (!company) {
    return { cnaesLista: [], termosBusca: [], termosMatch: [], negativos: [] };
  }

  const cnaePrincipal = String(company.cnaePrincipal || company.cnae_principal || '').trim();
  const secundarios: string[] = Array.isArray(company.cnaesSecundarios)
    ? company.cnaesSecundarios
    : Array.isArray(company.cnaes_secundarios)
      ? company.cnaes_secundarios
      : [];
  const nicho: string[] = Array.isArray(company.nicho) ? company.nicho : [];
  const palavrasSalvas: string[] = Array.isArray(company.palavrasChave) ? company.palavrasChave : [];

  const cnaesLista = [cnaePrincipal, ...secundarios].map((c) => String(c || '').trim()).filter(Boolean);
  const textoBase = normalizar([...cnaesLista, ...nicho, ...palavrasSalvas].join(' '));

  const termosMatch = new Set<string>();
  const termosBusca = new Set<string>();
  const negativos = new Set<string>();

  for (const grp of GRUPOS_SINONIMOS) {
    const bateu = grp.gatilhos.some((g) => textoBase.includes(g));
    if (bateu) {
      grp.termos.forEach((t) => termosMatch.add(t));
      grp.termos.slice(0, 5).forEach((t) => termosBusca.add(t));
      (grp.negativos || []).forEach((n) => negativos.add(n));
    }
  }

  const palavrasDaEmpresa = textoBase
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !STOPWORDS_CNAE.has(w));

  palavrasDaEmpresa.forEach((w) => {
    termosMatch.add(w);
    if (termosBusca.size < 8) termosBusca.add(w);
  });

  [...nicho, ...palavrasSalvas].forEach((p) => {
    const np = normalizar(p);
    if (np.length >= 3) {
      termosMatch.add(np);
      termosBusca.add(np);
    }
  });

  return {
    cnaesLista,
    termosBusca: Array.from(termosBusca).slice(0, 8),
    termosMatch: Array.from(termosMatch),
    negativos: Array.from(negativos),
  };
}

function contemPalavraInteira(textoNorm: string, termo: string): boolean {
  const escaped = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(textoNorm);
}

function formatarMoeda(valor: number | null): string {
  if (valor == null || !Number.isFinite(valor) || valor <= 0) return 'A definir no edital';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function formatarMoedaCompacta(valor: number): string {
  if (valor >= 1_000_000_000) return `R$ ${(valor / 1_000_000_000).toFixed(1)}B`;
  if (valor >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1)}M`;
  if (valor >= 1_000) return `R$ ${(valor / 1_000).toFixed(0)}k`;
  return `R$ ${valor.toFixed(0)}`;
}

function formatarData(dataStr: string | null): string {
  if (!dataStr) return 'Consultar edital';
  const d = new Date(dataStr);
  if (isNaN(d.getTime())) return 'Consultar edital';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const CORES_PIE = {
  PRONTO: '#10B981',
  ATENCAO: '#F59E0B',
  FORA: '#94A3B8',
};

export const ScoreOportunidadesPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [editaisBrutos, setEditaisBrutos] = useState<EditalBruto[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'TODOS' | NivelViabilidade>('TODOS');
  const [estadoFiltro, setEstadoFiltro] = useState<string>('TODOS');
  const [filtroApenasRemoto, setFiltroApenasRemoto] = useState(false);
  const [lendoEditalId, setLendoEditalId] = useState<string | null>(null);

  const [docsStatus, setDocsStatus] = useState<{
    certidoesValidas: number;
    certidoesPendentes: number;
    documentosCofre: number;
    carregado: boolean;
  }>({ certidoesValidas: 0, certidoesPendentes: 0, documentosCofre: 0, carregado: false });

  const perfilEmpresa = useMemo(() => extrairPerfisCnae(selectedCompany), [selectedCompany]);
  const ufEmpresa = String(selectedCompany?.uf || '').trim().toUpperCase();
  const nomeEmpresa = selectedCompany?.razaoSocial || selectedCompany?.razao_social || 'Sua empresa';

  const carregarAnalise = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const cnaePrincipal = String(selectedCompany?.cnaePrincipal || selectedCompany?.cnae_principal || '').trim();
      const companyId = selectedCompany?.id && selectedCompany.id !== 'default' ? selectedCompany.id : undefined;

      const consultasEditais: Promise<any>[] = [];
      const ufParam = estadoFiltro !== 'TODOS' ? estadoFiltro : undefined;

      if (perfilEmpresa.termosBusca.length > 0) {
        for (const termo of perfilEmpresa.termosBusca.slice(0, 8)) {
          consultasEditais.push(
            licitacoesApi.listar({
              apenasAbertos: true,
              q: termo,
              ...(cnaePrincipal ? { cnae: cnaePrincipal } : {}),
              ...(ufParam ? { uf: ufParam } : {}),
              tamanhoPagina: 80,
            }).catch(() => null)
          );
        }
      } else {
        consultasEditais.push(
          licitacoesApi.listar({
            apenasAbertos: true,
            ...(cnaePrincipal ? { cnae: cnaePrincipal } : {}),
            ...(ufParam ? { uf: ufParam } : {}),
            tamanhoPagina: 120,
          }).catch(() => null)
        );
      }

      const [respostasEditais, respCertidoes, respDocs] = await Promise.all([
        Promise.all(consultasEditais),
        certidoesApi.listar(companyId ? { empresa_id: companyId } : undefined).catch(() => null),
        documentosApi.listar(companyId ? { empresa_id: companyId } : undefined).catch(() => null),
      ]);

      const mapa = new Map<string, EditalBruto>();
      for (const resp of respostasEditais) {
        const lista = resp?.data?.data || resp?.data?.items || (Array.isArray(resp?.data) ? resp.data : []);
        for (const item of lista) {
          const chave = String(item.numeroControlePNCP || item.id || '');
          if (chave && !mapa.has(chave)) {
            mapa.set(chave, item);
          }
        }
      }
      setEditaisBrutos(Array.from(mapa.values()));

      const certs: any[] = respCertidoes?.data?.data || (Array.isArray(respCertidoes?.data) ? respCertidoes.data : []);
      const docs: any[] = respDocs?.data?.data || (Array.isArray(respDocs?.data) ? respDocs.data : []);

      const certidoesValidas = certs.filter((c) => /regular|valida|válida|emitida|ok/i.test(String(c.status || ''))).length;
      const certidoesPendentes = certs.filter((c) => /vencid|pendent|irregular/i.test(String(c.status || ''))).length;

      setDocsStatus({
        certidoesValidas,
        certidoesPendentes,
        documentosCofre: docs.length,
        carregado: true,
      });
    } catch {
      setErro('Não foi possível concluir a análise de viabilidade agora. Tente atualizar novamente.');
    } finally {
      setCarregando(false);
    }
  }, [selectedCompany, perfilEmpresa.termosBusca, estadoFiltro, ufEmpresa]);

  useEffect(() => {
    void carregarAnalise();
  }, [carregarAnalise]);

  const avaliacoes = useMemo<EditalViabilidade[]>(() => {
    const agora = Date.now();
    const temPendenciaDoc = docsStatus.certidoesPendentes > 0 || (docsStatus.carregado && docsStatus.documentosCofre === 0 && docsStatus.certidoesValidas === 0);

    return editaisBrutos
      .map((ed): EditalViabilidade => {
        const objetoTexto = String(ed.objetoCompra || ed.objeto || 'Objeto não informado').trim();
        const objetoNorm = normalizar(objetoTexto);
        const orgaoTexto = String(ed.nomeOrgao || ed.orgao || 'Órgão Público').trim();
        const valorRaw = ed.valorTotalEstimado ?? ed.valorEstimado ?? null;
        const valor = valorRaw != null && Number(valorRaw) > 0 ? Number(valorRaw) : null;
        const dataLimite = ed.dataEncerramentoProposta || ed.dataEncerramento || ed.dataAberturaProposta || null;

        let diasRestantes: number | null = null;
        if (dataLimite) {
          const dt = new Date(dataLimite).getTime();
          if (!isNaN(dt)) {
            diasRestantes = Math.ceil((dt - agora) / (1000 * 60 * 60 * 24));
          }
        }

        const caiuEmPegadinha = perfilEmpresa.negativos.some((neg) => objetoNorm.includes(neg));
        const termosEncontrados = caiuEmPegadinha
          ? []
          : perfilEmpresa.termosMatch.filter((t) => contemPalavraInteira(objetoNorm, t));
        const temAderenciaCnae = termosEncontrados.length > 0;

        let pontuacao = 0;
        const motivosPositivos: string[] = [];
        const alertas: string[] = [];

        if (temAderenciaCnae) {
          pontuacao += 45;
          motivosPositivos.push(`Compatível com sua atividade (${termosEncontrados.slice(0, 2).join(', ')})`);
        } else {
          alertas.push(caiuEmPegadinha ? 'Objeto restrito por termo negativo do CNAE' : 'Objeto fora do escopo cadastrado da empresa');
        }

        if (!docsStatus.carregado) {
          pontuacao += 10;
        } else if (docsStatus.certidoesPendentes > 0) {
          alertas.push(`${docsStatus.certidoesPendentes} certidão(ões) pendente(s)`);
        } else if (docsStatus.documentosCofre === 0 && docsStatus.certidoesValidas === 0) {
          pontuacao += 5;
          alertas.push('Envie documentos no Cofre para habilitar com 100% de segurança');
        } else {
          pontuacao += 20;
          motivosPositivos.push('Certidões e habilitação em conformidade');
        }

        if (diasRestantes !== null) {
          if (diasRestantes >= 5) {
            pontuacao += 15;
            motivosPositivos.push(`Prazo estratégico (${diasRestantes} dias para preparar proposta)`);
          } else if (diasRestantes >= 2) {
            pontuacao += 8;
            alertas.push(`Prazo exíguo (encerra em ${diasRestantes} dias)`);
          } else if (diasRestantes >= 0) {
            alertas.push('Sessão iminente — priorizar montagem');
          } else {
            pontuacao -= 30;
            alertas.push('Prazo encerrado');
          }
        }

        const ufEdital = String(ed.uf || '').trim().toUpperCase();
        if (ufEmpresa && ufEdital === ufEmpresa) {
          pontuacao += 12;
          motivosPositivos.push(`Sede no mesmo Estado (${ufEmpresa}) — logística otimizada`);
        } else if (ufEdital) {
          motivosPositivos.push(`Atuação nacional (${ufEdital})`);
        }

        if (valor !== null && valor <= 80000) {
          pontuacao += 8;
          motivosPositivos.push('Cota exclusiva ME/EPP (até R$ 80 mil)');
        }

        let nivel: NivelViabilidade = 'FORA';
        if (temAderenciaCnae && !caiuEmPegadinha && (diasRestantes === null || diasRestantes >= 0)) {
          if (!temPendenciaDoc && (diasRestantes === null || diasRestantes >= 3) && pontuacao >= 65) {
            nivel = 'PRONTO';
          } else {
            nivel = 'ATENCAO';
          }
        }

        const linkPortal =
          ed.urlOficialPncp ||
          ed.urlOficial ||
          ed.link ||
          'https://pncp.gov.br/app/editais';

        const statusLeitura =
          ed.metadata?.deepReadStatus === 'DONE' || ed.metadata?.deepReadStatus === 'COMPLETO' || ed.metadata?.extractedSpecsJson
            ? 'COMPLETO'
            : 'PENDENTE';

        return {
          edital: ed,
          nivel,
          pontuacao: Math.max(0, Math.min(100, pontuacao)),
          objetoTexto,
          orgaoTexto,
          valor,
          dataLimite,
          diasRestantes,
          motivosPositivos,
          alertas,
          linkPortal,
          statusLeitura,
        };
      })
      .sort((a, b) => b.pontuacao - a.pontuacao);
  }, [editaisBrutos, perfilEmpresa, docsStatus, ufEmpresa]);

  const prontos = avaliacoes.filter((a) => a.nivel === 'PRONTO');
  const atencao = avaliacoes.filter((a) => a.nivel === 'ATENCAO');
  const fora = avaliacoes.filter((a) => a.nivel === 'FORA');

  // Cálculos de KPIs Executivos
  const totalVolumeEstimado = useMemo(() => {
    return avaliacoes.reduce((acc, curr) => acc + (curr.valor || 0), 0);
  }, [avaliacoes]);

  const volumeProntos = useMemo(() => {
    return prontos.reduce((acc, curr) => acc + (curr.valor || 0), 0);
  }, [prontos]);

  const volumeAtencao = useMemo(() => {
    return atencao.reduce((acc, curr) => acc + (curr.valor || 0), 0);
  }, [atencao]);

  const disputasRemotas = useMemo(() => {
    return avaliacoes.filter((it) => {
      const specs = it.edital?.metadata?.extractedSpecsJson;
      if (specs?.disputaModo === 'ELETRONICO_REMOTO') return true;
      if (specs?.disputaEExecucao?.disputaRemota === true) return true;
      const texto = (it.objetoTexto + ' ' + (it.edital?.modalidade || '')).toLowerCase();
      return texto.includes('eletrônic') || texto.includes('eletronic') || texto.includes('remot');
    });
  }, [avaliacoes]);

  const volumeRemotas = useMemo(() => {
    return disputasRemotas.reduce((acc, curr) => acc + (curr.valor || 0), 0);
  }, [disputasRemotas]);

  // Dados para os Gráficos Power BI
  const dadosGraficoUf = useMemo(() => {
    const mapaUf: Record<string, { uf: string; quantidade: number; volume: number }> = {};
    for (const item of avaliacoes) {
      const uf = String(item.edital.uf || 'BR').toUpperCase();
      if (!mapaUf[uf]) {
        mapaUf[uf] = { uf, quantidade: 0, volume: 0 };
      }
      mapaUf[uf].quantidade += 1;
      mapaUf[uf].volume += item.valor || 0;
    }
    return Object.values(mapaUf)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
  }, [avaliacoes]);

  const dadosGraficoDonut = useMemo(() => {
    return [
      { name: 'Aderentes e Prontos', value: prontos.length, color: CORES_PIE.PRONTO },
      { name: 'Requerem Ajustes', value: atencao.length, color: CORES_PIE.ATENCAO },
      { name: 'Fora do Escopo (CNAE)', value: fora.length, color: CORES_PIE.FORA },
    ];
  }, [prontos.length, atencao.length, fora.length]);

  const listaVisivel = useMemo(() => {
    let base =
      abaAtiva === 'PRONTO'
        ? prontos
        : abaAtiva === 'ATENCAO'
          ? atencao
          : abaAtiva === 'FORA'
            ? fora
            : [...prontos, ...atencao, ...fora];

    if (filtroApenasRemoto) {
      base = base.filter((it) => {
        const specs = it.edital?.metadata?.extractedSpecsJson;
        if (specs?.disputaModo === 'ELETRONICO_REMOTO') return true;
        if (specs?.disputaEExecucao?.disputaRemota === true) return true;
        const texto = (it.objetoTexto + ' ' + (it.edital?.modalidade || '')).toLowerCase();
        return texto.includes('eletrônic') || texto.includes('eletronic') || texto.includes('remot');
      });
    }

    return base;
  }, [abaAtiva, prontos, atencao, fora, filtroApenasRemoto]);

  // Trava de Leitura Obrigatória e Geração de Dossiê PDF Timbrado A4
  const handleBaixarDossie = async (item: EditalViabilidade) => {
    const ed = item.edital;
    const editalId = String(ed.numeroControlePNCP || ed.id || '');
    if (!editalId) {
      toast.error('Identificador do edital não encontrado.');
      return;
    }

    let specs = ed.metadata?.extractedSpecsJson;
    const precisaLer = !specs || item.statusLeitura !== 'COMPLETO';

    if (precisaLer) {
      setLendoEditalId(editalId);
      const toastId = toast.loading('Lendo e extraindo arquivos reais do edital no portal...');
      try {
        const resp = await noticesApi.deepRead(editalId);
        const data = resp?.data?.data || resp?.data || {};
        specs = data.specs || data.extractedSpecsJson || null;

        // Atualiza o edital na lista local
        setEditaisBrutos((prev) =>
          prev.map((e) => {
            const match = String(e.numeroControlePNCP || e.id || '') === editalId;
            if (match) {
              return {
                ...e,
                metadata: {
                  ...(e.metadata || {}),
                  deepReadStatus: 'COMPLETO',
                  extractedSpecsJson: specs,
                },
              };
            }
            return e;
          })
        );
        toast.success('Leitura profunda dos arquivos concluída com sucesso!', { id: toastId });
      } catch (err: any) {
        console.error('Erro ao ler arquivos do edital:', err);
        toast.dismiss(toastId);
        toast.error('Arquivos do edital em processamento no portal. Gerando dossiê com dados consolidados.');
      } finally {
        setLendoEditalId(null);
      }
    }

    // Monta o payload completo do Dossiê Timbrado A4
    const dadosPdf: DadosDossieEditalPdf = {
      numeroControlePNCP: ed.numeroControlePNCP || ed.id,
      numeroEdital: ed.numeroControlePNCP || ed.id,
      orgao: item.orgaoTexto,
      cnpjOrgao: (ed as any).buyerDocument || (ed as any).cnpjOrgao,
      municipio: ed.municipio,
      uf: ed.uf,
      modalidade: ed.modalidadeNome || ed.modalidade || 'Pregão Eletrônico',
      modoDisputa: (ed as any).modoDisputa || 'Aberto',
      criterioJulgamento: (ed as any).judgmentCriterion || (ed as any).criterioJulgamento,
      valorEstimado: item.valor,
      dataAbertura: (ed as any).openingAt || (ed as any).dataAberturaProposta || (ed as any).dataAbertura,
      dataPublicacao: (ed as any).publishedAt || (ed as any).dataPublicacao,
      dataEncerramento: item.dataLimite,
      linkOficial: item.linkPortal,
      objeto: item.objetoTexto,
      srp: ed.srp,
      statusLeitura: specs ? 'COMPLETO' : 'PENDENTE',
      empresaCliente: {
        razaoSocial: selectedCompany?.razaoSocial || selectedCompany?.razao_social || 'Empresa Proponente Credenciada',
        nomeFantasia: selectedCompany?.nomeFantasia || selectedCompany?.nome_fantasia,
        cnpj: selectedCompany?.cnpj,
        cnaePrincipal: selectedCompany?.cnaePrincipal || selectedCompany?.cnae_principal,
        cidade: selectedCompany?.municipio || selectedCompany?.cidade,
        uf: selectedCompany?.uf,
      },
      specs: specs || {
        disputaModo: 'ELETRONICO_REMOTO',
        execucaoModo: 'Conforme Termo de Referência',
        itensEstruturados: [],
        riscosIdentificados: [],
      },
    };

    exportarDossieEditalPdf(dadosPdf);
  };

  const handleDownloadOriginal = async (editalId: string, numeroEdital?: string) => {
    try {
      toast.loading('Baixando edital original publicado pelo órgão...', { id: 'down-orig' });
      const res = await api.get(`/notices/${encodeURIComponent(editalId)}/download-original`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `Edital_${numeroEdital || editalId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Download do edital concluído!', { id: 'down-orig' });
    } catch {
      toast.error('Não foi possível transferir o edital original diretamente.', { id: 'down-orig' });
    }
  };

  return (
    <div className="space-y-6 pb-28">
      {/* CABEÇALHO DA EMPRESA */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#081C3A] px-3 py-1 text-xs font-bold text-white">
                <Building2 className="h-3.5 w-3.5 text-[#FF6600]" />
                {nomeEmpresa}
              </span>
              {ufEmpresa && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                  {ufEmpresa}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#081C3A]">
              Painel Executivo de Oportunidades & Análise de Viabilidade
            </h1>
            <p className="text-sm text-slate-600">
              Oportunidades públicas selecionadas para o seu negócio, com análise prática para você decidir onde vale a pena disputar.
            </p>
            {perfilEmpresa.cnaesLista.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {perfilEmpresa.cnaesLista.slice(0, 4).map((cnae, idx) => (
                  <span
                    key={idx}
                    className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#0070C0]"
                  >
                    {cnae}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs font-semibold text-amber-700">
                Cadastre o CNAE da sua empresa em Minha Empresa para alimentar o radar de precisão.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Seletor de Estados */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-500">Estado:</span>
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-[#081C3A] outline-none hover:border-[#0070C0] transition cursor-pointer"
              >
                <option value="TODOS">Todo o Brasil</option>
                {ufEmpresa && <option value={ufEmpresa}>Meu Estado ({ufEmpresa})</option>}
                <optgroup label="Selecione um Estado">
                  {UFS_BRASIL.filter((u) => u !== 'TODOS' && u !== ufEmpresa).map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Filtro Apenas Remoto */}
            <button
              type="button"
              onClick={() => setFiltroApenasRemoto(!filtroApenasRemoto)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition cursor-pointer border ${filtroApenasRemoto
                ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
                }`}
            >
              {filtroApenasRemoto ? '✓ Disputa Remota' : 'Filtrar Remoto'}
            </button>

            <button
              type="button"
              onClick={() => void carregarAnalise()}
              disabled={carregando}
              className="inline-flex items-center gap-2 rounded-full bg-[#FF6600] hover:bg-[#e55b00] px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar Dados
            </button>
          </div>
        </div>
      </div>

      {/* DASHBOARD EXECUTIVO POWER BI — 4 KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Volume Financeiro Total</span>
            <Coins className="h-5 w-5 text-[#0070C0]" />
          </div>
          <p className="text-2xl font-black text-[#081C3A] mt-2">
            {formatarMoedaCompacta(totalVolumeEstimado)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {avaliacoes.length} oportunidades monitoradas
          </p>
        </div>

        {/* KPI 2 */}
        <div
          onClick={() => setAbaAtiva('PRONTO')}
          className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm cursor-pointer hover:border-emerald-400 transition"
        >
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-bold uppercase tracking-wider">Aderentes e Prontos</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-950 mt-2">
            {prontos.length} <span className="text-sm font-semibold text-emerald-700">({formatarMoedaCompacta(volumeProntos)})</span>
          </p>
          <p className="text-xs text-emerald-800 mt-1">
            Atividade 100% alinhada e certidões válidas
          </p>
        </div>

        {/* KPI 3 */}
        <div
          onClick={() => setAbaAtiva('ATENCAO')}
          className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm cursor-pointer hover:border-amber-400 transition"
        >
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-bold uppercase tracking-wider">Requerem Ajustes</span>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-950 mt-2">
            {atencao.length} <span className="text-sm font-semibold text-amber-700">({formatarMoedaCompacta(volumeAtencao)})</span>
          </p>
          <p className="text-xs text-amber-800 mt-1">
            Requer atenção a prazo curto ou certidões
          </p>
        </div>

        {/* KPI 4 */}
        <div
          onClick={() => setFiltroApenasRemoto(!filtroApenasRemoto)}
          className={`rounded-2xl border p-4 shadow-sm cursor-pointer transition ${filtroApenasRemoto
            ? 'border-emerald-500 bg-emerald-50/70'
            : 'border-slate-200 bg-white hover:border-[#0070C0]'
            }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Disputas Remotas</span>
            <Globe className="h-5 w-5 text-[#0070C0]" />
          </div>
          <p className="text-2xl font-black text-[#081C3A] mt-2">
            {disputasRemotas.length} <span className="text-sm font-semibold text-slate-500">({formatarMoedaCompacta(volumeRemotas)})</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {filtroApenasRemoto ? '✓ Filtro remoto ativo (clique para limpar)' : 'Pregões 100% eletrônicos e online'}
          </p>
        </div>
      </div>

      {/* DASHBOARD POWER BI — GRÁFICOS RECHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico 1: Volume por Estado */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#0070C0]" />
              <h2 className="text-sm font-bold text-[#081C3A]">Distribuição por Estado (UF) — Volume Financeiro Estimado</h2>
            </div>
            <span className="text-xs text-slate-500">Clique na barra para filtrar</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dadosGraficoUf}
                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                onClick={(e: any) => {
                  if (e?.activePayload?.[0]?.payload?.uf) {
                    setEstadoFiltro(e.activePayload[0].payload.uf);
                  }
                }}
              >
                <XAxis dataKey="uf" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => formatarMoedaCompacta(val)}
                />
                <RechartsTooltip
                  formatter={(value: any) => [formatarMoeda(Number(value)), 'Volume Estimado']}
                  labelFormatter={(label) => `Estado: ${label}`}
                  contentStyle={{ backgroundColor: '#081C3A', borderRadius: 8, color: '#FFF', fontSize: 12 }}
                />
                <Bar dataKey="volume" fill="#0070C0" radius={[6, 6, 0, 0]} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Composição Donut */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="h-4 w-4 text-[#FF6600]" />
            <h2 className="text-sm font-bold text-[#081C3A]">Composição de Aderência</h2>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dadosGraficoDonut}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  cursor="pointer"
                  onClick={(entry: any) => {
                    if (entry.name === 'Aderentes e Prontos') setAbaAtiva('PRONTO');
                    else if (entry.name === 'Requerem Ajustes') setAbaAtiva('ATENCAO');
                    else if (entry.name === 'Fora do Escopo (CNAE)') setAbaAtiva('FORA');
                  }}
                >
                  {dadosGraficoDonut.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#081C3A', borderRadius: 8, color: '#FFF', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-1.5 text-xs pt-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#10B981]"></span> Aderentes e Prontos</span>
              <span className="font-bold text-[#081C3A]">{prontos.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]"></span> Requerem Ajustes</span>
              <span className="font-bold text-[#081C3A]">{atencao.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#94A3B8]"></span> Fora do Escopo (CNAE)</span>
              <span className="font-bold text-[#081C3A]">{fora.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* STATUS DO COFRE DE CERTIDÕES */}
      {docsStatus.carregado && (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 ${docsStatus.certidoesPendentes > 0
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : docsStatus.documentosCofre === 0 && docsStatus.certidoesValidas === 0
            ? 'border-blue-200 bg-blue-50 text-blue-950'
            : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}>
          <div className="flex items-start sm:items-center gap-3">
            <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5 sm:mt-0" />
            <div className="text-xs sm:text-sm">
              <p className="font-bold">
                Documentação e Certidões de {nomeEmpresa}:{' '}
                {docsStatus.certidoesPendentes > 0
                  ? `${docsStatus.certidoesPendentes} certidão(ões) pendente(s) ou a renovar`
                  : docsStatus.documentosCofre === 0 && docsStatus.certidoesValidas === 0
                    ? 'Nenhum documento cadastrado no Cofre ainda'
                    : `${docsStatus.certidoesValidas} certidão(ões) regular(es) e ${docsStatus.documentosCofre} documento(s) arquivado(s)`}
              </p>
              <p className="opacity-85 text-xs mt-0.5">
                Mantenha suas certidões em dia para disputar e vencer contratos com segurança jurídica.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/fornecedor/cofre')}
            className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-[#081C3A] border border-slate-200 hover:border-[#0070C0] cursor-pointer"
          >
            Gerenciar Cofre
          </button>
        </div>
      )}

      {/* ABAS DE NAVEGAÇÃO EXECUTIVAS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setAbaAtiva('TODOS')}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer ${abaAtiva === 'TODOS'
            ? 'bg-[#081C3A] text-white shadow-sm'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
          Todas as Oportunidades ({avaliacoes.length})
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva('PRONTO')}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${abaAtiva === 'PRONTO'
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Aderentes e Prontos ({prontos.length})
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva('ATENCAO')}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${abaAtiva === 'ATENCAO'
            ? 'bg-amber-600 text-white shadow-sm'
            : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Requerem Ajustes ({atencao.length})
        </button>
        <button
          type="button"
          onClick={() => setAbaAtiva('FORA')}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${abaAtiva === 'FORA'
            ? 'bg-slate-700 text-white shadow-sm'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
        >
          <XCircle className="h-3.5 w-3.5" />
          Fora do Escopo (CNAE) ({fora.length})
        </button>
      </div>

      {erro && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 space-y-3">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-[#0070C0]" />
          <p className="font-semibold text-[#081C3A]">
            Cruzando oportunidades com os CNAEs, certidões e anexos reais para {nomeEmpresa}...
          </p>
        </div>
      ) : listaVisivel.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3">
          <p className="text-sm font-bold text-[#081C3A]">
            Nenhuma oportunidade encontrada para os filtros selecionados.
          </p>
          <p className="text-xs text-slate-600">
            Experimente mudar o filtro de Estado para "Todo o Brasil" ou desmarcar o filtro de disputa remota.
          </p>
          {estadoFiltro !== 'TODOS' && (
            <button
              type="button"
              onClick={() => setEstadoFiltro('TODOS')}
              className="rounded-full bg-[#081C3A] px-4 py-2 text-xs font-bold text-white cursor-pointer"
            >
              Exibir Todo o Brasil
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {listaVisivel.map((item, idx) => {
            const ed = item.edital;
            const idEdital = encodeURIComponent(String(ed.numeroControlePNCP || ed.id || ''));
            const corBadge =
              item.nivel === 'PRONTO'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : item.nivel === 'ATENCAO'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-slate-100 text-slate-800 border-slate-200';
            const textoBadge =
              item.nivel === 'PRONTO'
                ? 'Aderente e Pronto'
                : item.nivel === 'ATENCAO'
                  ? 'Requer Ajuste'
                  : 'Fora do Escopo';

            const specs = ed.metadata?.extractedSpecsJson;
            const estaLendoEste = lendoEditalId === String(ed.numeroControlePNCP || ed.id || '');

            return (
              <div
                key={`${idEdital}-${idx}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-[#0070C0] transition space-y-4"
              >
                {/* Topo do Card */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-bold ${corBadge}`}>
                        {textoBadge}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        {ed.modalidadeNome || ed.modalidade || 'Licitação'}
                      </span>

                      {/* Selo de Disputa Remota vs Presencial */}
                      {specs?.disputaModo === 'ELETRONICO_REMOTO' || (item.objetoTexto + ' ' + (ed.modalidade || '')).toLowerCase().includes('eletrônic') ? (
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
                          Sessão Online / Remota
                        </span>
                      ) : specs?.disputaModo === 'PRESENCIAL' ? (
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-bold border bg-amber-50 text-amber-800 border-amber-200">
                          Disputa Presencial
                        </span>
                      ) : null}

                      {/* Selo ME/EPP */}
                      {(item.valor !== null && item.valor <= 80000) && (
                        <span className="rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
                          Exclusivo ME/EPP
                        </span>
                      )}

                      {/* Selo SRP */}
                      {ed.srp && (
                        <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-[#0070C0]">
                          Registro de Preços
                        </span>
                      )}
                    </div>

                    <h2 className="text-sm sm:text-base font-bold text-[#081C3A]">{item.orgaoTexto}</h2>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{item.objetoTexto}</p>
                  </div>

                  {/* Pontuação */}
                  <div className="shrink-0 text-right">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1">
                      <span className="text-[11px] font-semibold text-slate-500">Score:</span>
                      <span className="text-sm font-black text-[#081C3A]">{item.pontuacao}%</span>
                    </div>
                  </div>
                </div>

                {/* Metadados e Valores */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1 border-t border-slate-100">
                  <span className="font-bold text-[#081C3A]">
                    Valor de Referência: {formatarMoeda(item.valor)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    Encerramento: {formatarData(item.dataLimite)}
                  </span>
                  {ed.uf && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {ed.municipio ? `${ed.municipio}/${ed.uf}` : ed.uf}
                    </span>
                  )}
                  {specs?.prazoEntregaDias && (
                    <span className="text-slate-700">
                      Prazo de Entrega: <strong>{specs.prazoEntregaDias} dias</strong>
                    </span>
                  )}
                </div>

                {/* Tags de Viabilidade (No máximo 3 destaques objetivos) */}
                <div className="flex flex-wrap gap-2">
                  {item.motivosPositivos.slice(0, 3).map((m, mIdx) => (
                    <span
                      key={mIdx}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800"
                    >
                      <CheckCircle2 className="h-3 w-3 shrink-0" /> {m}
                    </span>
                  ))}
                  {item.alertas.slice(0, 2).map((al, aIdx) => (
                    <span
                      key={aIdx}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800"
                    >
                      <AlertTriangle className="h-3 w-3 shrink-0" /> {al}
                    </span>
                  ))}
                </div>

                {/* BARRA DE AÇÕES INFERIOR DO CARD (Descolada do widget Luli) */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Botão Baixar Dossiê em PDF com Trava de Leitura */}
                    <button
                      type="button"
                      onClick={() => void handleBaixarDossie(item)}
                      disabled={estaLendoEste}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#081C3A] hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-60"
                    >
                      {estaLendoEste ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF6600]" />
                          Lendo Arquivos...
                        </>
                      ) : (
                        <>
                          <FileDown className="h-3.5 w-3.5 text-[#FF6600]" />
                          Baixar Dossiê em PDF
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDownloadOriginal(idEdital, String(item.edital.numeroControlePNCP || idEdital).replace(/\//g, '_'))}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-[#081C3A] transition cursor-pointer"
                      title="Baixar arquivo original publicado pelo órgão diretamente"
                    >
                      <Download className="h-3.5 w-3.5 text-[#0070C0]" />
                      Baixar Edital
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/fornecedor/propostas?edital=${idEdital}`)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6600] hover:bg-[#e55b00] px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Preparar Proposta
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/fornecedor/leitor-editais?edital=${idEdital}`)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:border-[#0070C0] px-3.5 py-2 text-xs font-bold text-[#081C3A] transition cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#FF6600]" />
                      Analisar Edital
                    </button>
                  </div>

                  <a
                    href={item.linkPortal}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#0070C0] transition"
                  >
                    Portal Oficial <ExternalLink className="h-3 w-3" />
                  </a>
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