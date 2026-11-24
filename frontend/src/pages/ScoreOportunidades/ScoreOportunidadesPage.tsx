import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileText,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { certidoesApi, documentosApi, licitacoesApi } from '@/services/api';
import { useCompany } from '@/contexts/CompanyContext';

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
      grp.termos.slice(0, 4).forEach((t) => termosBusca.add(t));
      (grp.negativos || []).forEach((n) => negativos.add(n));
    }
  }

  const palavrasDaEmpresa = textoBase
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !STOPWORDS_CNAE.has(w));

  palavrasDaEmpresa.forEach((w) => {
    termosMatch.add(w);
    if (termosBusca.size < 6) termosBusca.add(w);
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
    termosBusca: Array.from(termosBusca).slice(0, 6),
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

function formatarData(dataStr: string | null): string {
  if (!dataStr) return 'Consultar edital';
  const d = new Date(dataStr);
  if (isNaN(d.getTime())) return 'Consultar edital';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const ScoreOportunidadesPage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [editaisBrutos, setEditaisBrutos] = useState<EditalBruto[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<'TODOS' | NivelViabilidade>('TODOS');
  const [estadoFiltro, setEstadoFiltro] = useState<string>('TODOS');
  const [filtroApenasRemoto, setFiltroApenasRemoto] = useState(false);
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
        // Puxa termos do CNAE sem limitação arbitrária
        for (const termo of perfilEmpresa.termosBusca.slice(0, 8)) {
          consultasEditais.push(
            licitacoesApi.listar({
              apenasAbertos: true,
              q: termo,
              ...(cnaePrincipal ? { cnae: cnaePrincipal } : {}),
              ...(ufParam ? { uf: ufParam } : {}),
              tamanhoPagina: 60,
            }).catch(() => null)
          );
        }
      } else {
        consultasEditais.push(
          licitacoesApi.listar({
            apenasAbertos: true,
            ...(cnaePrincipal ? { cnae: cnaePrincipal } : {}),
            ...(ufParam ? { uf: ufParam } : {}),
            tamanhoPagina: 100,
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
          alertas.push(caiuEmPegadinha ? 'Objeto de manutenção/serviço diferente do seu ramo' : 'Objeto fora das atividades cadastradas da empresa');
        }

        if (!docsStatus.carregado) {
          pontuacao += 10;
        } else if (docsStatus.certidoesPendentes > 0) {
          alertas.push(`${docsStatus.certidoesPendentes} certidão(ões) vencida(s) ou pendente(s)`);
        } else if (docsStatus.documentosCofre === 0 && docsStatus.certidoesValidas === 0) {
          pontuacao += 5;
          alertas.push('Envie suas certidões e documentos no Cofre antes da disputa');
        } else {
          pontuacao += 20;
          motivosPositivos.push('Documentação e certidões em dia');
        }

        if (diasRestantes !== null) {
          if (diasRestantes >= 5) {
            pontuacao += 15;
            motivosPositivos.push(`Prazo confortável (${diasRestantes} dias para preparar)`);
          } else if (diasRestantes >= 2) {
            pontuacao += 8;
            alertas.push(`Prazo curto (encerra em ${diasRestantes} dias)`);
          } else if (diasRestantes >= 0) {
            alertas.push('Sessão muito próxima — confira se há tempo hábil');
          } else {
            pontuacao -= 30;
            alertas.push('Prazo de recebimento já encerrado');
          }
        }

        const ufEdital = String(ed.uf || '').trim().toUpperCase();
        if (ufEmpresa && ufEdital === ufEmpresa) {
          pontuacao += 12;
          motivosPositivos.push(`Mesmo estado (${ufEmpresa}) — frete mais competitivo`);
        } else if (ufEdital) {
          motivosPositivos.push(`Atuação nacional (${ufEdital})`);
        }

        if (valor !== null && valor <= 80000) {
          pontuacao += 8;
          motivosPositivos.push('Faixa exclusiva ME/EPP (até R$ 80 mil)');
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
        };
      })
      .sort((a, b) => b.pontuacao - a.pontuacao);
  }, [editaisBrutos, perfilEmpresa, docsStatus, ufEmpresa]);

  const prontos = avaliacoes.filter((a) => a.nivel === 'PRONTO');
  const atencao = avaliacoes.filter((a) => a.nivel === 'ATENCAO');
  const fora = avaliacoes.filter((a) => a.nivel === 'FORA');

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
        if (specs?.disputaEExecucao?.disputaRemota === true) return true;
        const texto = (it.objetoTexto + ' ' + (it.edital?.modalidade || '')).toLowerCase();
        return texto.includes('eletrônic') || texto.includes('eletronic') || texto.includes('remot');
      });
    }

    return base;
  }, [abaAtiva, prontos, atencao, fora, filtroApenasRemoto]);

  return (
    <div className="space-y-6 pb-24">
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
              Análise de Viabilidade para Sua Empresa
            </h1>
            <p className="text-sm text-slate-600">
              Licitações selecionadas para as atividades da sua empresa, cruzadas com suas certidões, prazos e localização.
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
                Cadastre o CNAE da sua empresa em Minha Empresa para filtrar automaticamente apenas o seu ramo.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Seletor de Estados Completo (Todos / UFs) */}
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
              {filtroApenasRemoto ? '✓ Apenas Disputa Remota' : 'Filtrar Remoto'}
            </button>

            <button
              type="button"
              onClick={() => void carregarAnalise()}
              disabled={carregando}
              className="inline-flex items-center gap-2 rounded-full bg-[#FF6600] hover:bg-[#e55b00] px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar Análise
            </button>
          </div>
        </div>
      </div>

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
                Situação Documental de {nomeEmpresa}:{' '}
                {docsStatus.certidoesPendentes > 0
                  ? `${docsStatus.certidoesPendentes} certidão(ões) pendente(s) ou vencida(s)`
                  : docsStatus.documentosCofre === 0 && docsStatus.certidoesValidas === 0
                    ? 'Nenhum documento enviado no Cofre ainda'
                    : `${docsStatus.certidoesValidas} certidão(ões) regular(es) e ${docsStatus.documentosCofre} documento(s) no Cofre`}
              </p>
              <p className="opacity-85 text-xs mt-0.5">
                A viabilidade abaixo já considera se a sua empresa está pronta para ser habilitada sem risco de desclassificação.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/fornecedor/cofre')}
            className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-[#081C3A] border border-slate-200 hover:border-[#0070C0] cursor-pointer"
          >
            Ver Meus Documentos
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setAbaAtiva(abaAtiva === 'PRONTO' ? 'TODOS' : 'PRONTO')}
          className={`text-left rounded-2xl border p-4 transition cursor-pointer ${abaAtiva === 'PRONTO' ? 'border-emerald-500 bg-emerald-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-emerald-300'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase">Prontos para Disputar</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-[#081C3A] mt-2">{prontos.length}</p>
          <p className="text-xs text-slate-600 mt-1">Seu ramo, prazo bom e documentação favorável</p>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva(abaAtiva === 'ATENCAO' ? 'TODOS' : 'ATENCAO')}
          className={`text-left rounded-2xl border p-4 transition cursor-pointer ${abaAtiva === 'ATENCAO' ? 'border-amber-500 bg-amber-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-amber-300'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase">Ajustar Antes de Entrar</span>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <p className="text-3xl font-black text-[#081C3A] mt-2">{atencao.length}</p>
          <p className="text-xs text-slate-600 mt-1">Seu ramo, mas pede atenção em prazo ou certidão</p>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva(abaAtiva === 'FORA' ? 'TODOS' : 'FORA')}
          className={`text-left rounded-2xl border p-4 transition cursor-pointer ${abaAtiva === 'FORA' ? 'border-rose-500 bg-rose-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-rose-300'
            }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase">Fora do Ramo</span>
            <XCircle className="h-5 w-5 text-rose-500" />
          </div>
          <p className="text-3xl font-black text-[#081C3A] mt-2">{fora.length}</p>
          <p className="text-xs text-slate-600 mt-1">Evita perda de tempo ou risco de inabilitação</p>
        </button>
      </div>

      {erro && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {erro}
        </div>
      )}

      {carregando ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Analisando licitações compatíveis com os CNAEs e documentos de {nomeEmpresa}...
        </div>
      ) : listaVisivel.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3">
          <p className="text-sm font-bold text-[#081C3A]">
            Nenhuma licitação encontrada para este filtro no momento.
          </p>
          <p className="text-xs text-slate-600">
            Experimente mudar para "Todo o Brasil" ou conferir as atividades cadastradas em Minha Empresa.
          </p>
          {estadoFiltro !== 'TODOS' && (
            <button
              type="button"
              onClick={() => setEstadoFiltro('TODOS')}
              className="rounded-full bg-[#081C3A] px-4 py-2 text-xs font-bold text-white cursor-pointer"
            >
              Ver em Todo o Brasil
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {listaVisivel.map((item, idx) => {
            const ed = item.edital;
            const idEdital = encodeURIComponent(String(ed.numeroControlePNCP || ed.id || ''));
            const corBadge =
              item.nivel === 'PRONTO'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : item.nivel === 'ATENCAO'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-rose-100 text-rose-800 border-rose-200';
            const textoBadge =
              item.nivel === 'PRONTO'
                ? 'Pronto para Disputar'
                : item.nivel === 'ATENCAO'
                  ? 'Atenção Antes de Entrar'
                  : 'Fora do Ramo';

            return (
              <div
                key={`${idEdital}-${idx}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-[#0070C0] transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-bold ${corBadge}`}>
                        {textoBadge}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        {ed.modalidadeNome || ed.modalidade || 'Licitação'}
                      </span>
                      {ed.srp && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-[#0070C0]">
                          Registro de Preços
                        </span>
                      )}

                      {/* Selo Verídico Remoto / Presencial */}
                      {ed.metadata?.extractedSpecsJson?.disputaEExecucao?.disputaRemota !== undefined && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ed.metadata.extractedSpecsJson.disputaEExecucao.disputaRemota
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                        >
                          {ed.metadata.extractedSpecsJson.disputaEExecucao.modoDisputaTexto}
                        </span>
                      )}

                      {/* Selo Leitura Profunda */}
                      <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                        {ed.metadata?.deepReadStatus === 'DONE' ? '✓ Edital Completo Lido' : 'Arquivos do Edital em Análise'}
                      </span>
                    </div>

                    <h2 className="text-sm sm:text-base font-bold text-[#081C3A]">{item.orgaoTexto}</h2>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{item.objetoTexto}</p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                      <span className="font-bold text-[#081C3A]">
                        Valor estimado: {formatarMoeda(item.valor)}
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
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {item.motivosPositivos.map((m, mIdx) => (
                        <span
                          key={mIdx}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800"
                        >
                          <CheckCircle2 className="h-3 w-3 shrink-0" /> {m}
                        </span>
                      ))}
                      {item.alertas.map((al, aIdx) => (
                        <span
                          key={aIdx}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800"
                        >
                          <AlertTriangle className="h-3 w-3 shrink-0" /> {al}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-row lg:flex-col flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/fornecedor/propostas?edital=${idEdital}`)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#FF6600] hover:bg-[#e55b00] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Preparar Proposta
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/fornecedor/leitor-editais?edital=${idEdital}`)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[#081C3A] hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#FF6600]" />
                      Analisar Edital
                    </button>
                    <a
                      href={item.linkPortal}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white hover:border-[#0070C0] px-4 py-2 text-xs font-bold text-[#081C3A]"
                    >
                      Portal Oficial <ExternalLink className="h-3.5 w-3.5" />
                    </a>
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