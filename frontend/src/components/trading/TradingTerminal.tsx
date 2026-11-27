import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ExternalLink,
  RefreshCw,
  Volume2,
  VolumeX,
  Gavel,
  Lock,
  Copy,
  Check,
  Calculator,
  X,
  RotateCcw,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Decimal from 'decimal.js';
import { EditalSelector, EditalOption } from '@/components/EditalSelector';
import { propostasApi, licitacoesApi, certidoesApi, documentosApi } from '@/services/api';
import { buildOfficialPncpPortalUrl } from '@/utils/pncp';
import { useCompany } from '@/contexts/CompanyContext';

export type EstrategiaType = 'SNIPER' | 'COBERTURA' | 'MANUAL';
export type StatusItemType = 'VENCENDO' | 'COBERTO' | 'PISO_ATINGIDO' | 'PAUSADO';

export interface ItemPlanilhaTerminal {
  id: string;
  itemNumero: number;
  descricao: string;
  quantidade: number;
  unidadeMedida: string;
  valorReferencia: number;
  melhorLanceConcorrente: number;
  seuUltimoLance: number | null;
  lanceAlvo: number; // Meta de Lance
  pisoMinimo: number; // Limite Mínimo (Sem Prejuízo)
  estrategia: EstrategiaType;
  decrementoMinimo: number;
  status: StatusItemType;
  ativo: boolean;
  margemEstimadaPct: number;
}

export interface MensagemDisputa {
  id: string;
  hora: string;
  autor: 'PREGOEIRO' | 'SISTEMA' | 'LANCE' | 'ALERTA';
  texto: string;
  itemNumero?: number;
  valor?: number;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v || 0);
}

function roundDec(val: number): number {
  return new Decimal(val || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export const TradingTerminal: React.FC = () => {
  const { selectedCompany } = useCompany();

  // Passo Ativo do Guia Superior (1, 2 ou 3)
  const [passoAtivo, setPassoAtivo] = useState<1 | 2 | 3>(1);

  // Edital Selecionado e Portal
  const [edital, setEdital] = useState<EditalOption | null>(null);
  const [portalUrl, setPortalUrl] = useState<string>('https://pncp.gov.br/app/editais');

  // Conexão Honesta e Extensão Chrome
  const [conectorExtensaoAtivo, setConectorExtensaoAtivo] = useState<boolean>(false);
  const [nomePortalConectado, setNomePortalConectado] = useState<string>('');
  const [modalExtensaoAberta, setModalExtensaoAberta] = useState<boolean>(false);

  // Áudio de Alertas
  const [somHabilitado, setSomHabilitado] = useState<boolean>(true);

  // Modo de Exibição (Tabela vs Cards)
  const [modoVisualizacao, setModoVisualizacao] = useState<'TABELA' | 'CARDS'>('TABELA');

  // Aba Lateral (Calculadora, Mensagens Pregoeiro, Benefício ME/EPP, Checklist)
  const [abaLateral, setAbaLateral] = useState<'CALCULADORA' | 'MENSAGENS' | 'ME_EPP' | 'CHECKLIST'>('CALCULADORA');

  // Planilha de Itens Reais
  const [itens, setItens] = useState<ItemPlanilhaTerminal[]>([]);
  const [carregandoItens, setCarregandoItens] = useState<boolean>(false);
  const [itemSelecionadoId, setItemSelecionadoId] = useState<string>('');

  // Checklist de Prontidão da Empresa (100% Real do Banco)
  const [carregandoChecklist, setCarregandoChecklist] = useState<boolean>(true);
  const [checklistReal, setChecklistReal] = useState<{
    certidoesValidas: number;
    certidoesVencidas: number;
    totalCertidoes: number;
    totalDocumentos: number;
    propostaCadastrada: boolean;
    nomeProposta?: string;
  }>({
    certidoesValidas: 0,
    certidoesVencidas: 0,
    totalCertidoes: 0,
    totalDocumentos: 0,
    propostaCadastrada: false,
  });

  // Calculadora Instantânea Humanizada
  const [menorPrecoInformado, setMenorPrecoInformado] = useState<string>('');
  const [lanceCalculado, setLanceCalculado] = useState<number | null>(null);
  const [folgaCalculada, setFolgaCalculada] = useState<number | null>(null);
  const [alertaPrejuizoAtivo, setAlertaPrejuizoAtivo] = useState<boolean>(false);
  const [alertaMeEppAtivo, setAlertaMeEppAtivo] = useState<boolean>(false);
  const [alertaInexequivelAtivo, setAlertaInexequivelAtivo] = useState<boolean>(false);
  const [copiadoLance, setCopiadoLance] = useState<boolean>(false);

  // Benefício ME/EPP - Cronômetro Legal de 5 Minutos (Empate Ficto LC 123/2006)
  const [tempoMeSegundos, setTempoMeSegundos] = useState<number>(300);
  const [cronometroMeAtivo, setCronometroMeAtivo] = useState<boolean>(false);

  // Mensagens Prontas para o Pregoeiro
  const [mensagemCopiadaId, setMensagemCopiadaId] = useState<string | null>(null);

  // Mensagens do Sistema
  const [mensagens, setMensagens] = useState<MensagemDisputa[]>([
    {
      id: 'msg-1',
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      autor: 'SISTEMA',
      texto: 'Sala de Disputa & Lances pronta. Selecione o edital no Passo 1 para carregar os lotes e calcular os lances de segurança.',
    },
  ]);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Rolagem automática nas mensagens
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Handshake com a Extensão Oficial
  useEffect(() => {
    const handleMensagemExtensao = (event: MessageEvent) => {
      if (event.data?.source === 'EXPERTISE_CHROME_EXTENSION') {
        if (event.data?.type === 'HEARTBEAT' || event.data?.type === 'SYNC_PORTAL_STATE') {
          setConectorExtensaoAtivo(true);
          setNomePortalConectado(event.data?.portalName || 'Portal de Compras');

          if (Array.isArray(event.data?.itens) && event.data.itens.length > 0) {
            setItens((prev) =>
              prev.map((it) => {
                const itemExt = event.data.itens.find((x: any) => x.numero === it.itemNumero);
                if (!itemExt) return it;
                const novoMelhor = roundDec(Number(itemExt.melhorLance) || it.melhorLanceConcorrente);
                const novoStatus: StatusItemType =
                  novoMelhor <= it.pisoMinimo
                    ? 'PISO_ATINGIDO'
                    : itemExt.posicao === 1
                    ? 'VENCENDO'
                    : 'COBERTO';

                return {
                  ...it,
                  melhorLanceConcorrente: novoMelhor,
                  seuUltimoLance: itemExt.seuLance ? roundDec(Number(itemExt.seuLance)) : it.seuUltimoLance,
                  status: novoStatus,
                };
              })
            );
          }
        }
      }
    };

    window.addEventListener('message', handleMensagemExtensao);
    window.postMessage({ source: 'EXPERTISE_WEB_APP', type: 'PING' }, '*');

    return () => {
      window.removeEventListener('message', handleMensagemExtensao);
    };
  }, []);

  // Cronômetro do Benefício ME/EPP (5 minutos)
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (cronometroMeAtivo && tempoMeSegundos > 0) {
      timer = setInterval(() => {
        setTempoMeSegundos((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (tempoMeSegundos === 0 && cronometroMeAtivo) {
      setCronometroMeAtivo(false);
      toast.error('Prazo legal de 5 minutos da Lei Complementar 123/2006 expirado!', { duration: 6000 });
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cronometroMeAtivo, tempoMeSegundos]);

  const formatTempoMe = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  };

  const adicionarMensagem = useCallback(
    (autor: 'PREGOEIRO' | 'SISTEMA' | 'LANCE' | 'ALERTA', texto: string, itemNumero?: number, valor?: number) => {
      const now = new Date();
      const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setMensagens((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          hora,
          autor,
          texto,
          itemNumero,
          valor,
        },
      ]);
    },
    []
  );

  // Consulta do Checklist Real da Empresa Ativa
  useEffect(() => {
    let active = true;
    const consultarChecklistReal = async () => {
      setCarregandoChecklist(true);
      try {
        const empresaId = selectedCompany?.id;
        const [respCert, respProp, respDocs] = await Promise.all([
          certidoesApi.listar(empresaId ? { empresa_id: empresaId } : undefined).catch(() => null),
          propostasApi.listar().catch(() => null),
          documentosApi.listar(empresaId ? { empresa_id: empresaId } : undefined).catch(() => null),
        ]);

        if (!active) return;

        const certs: any[] = respCert?.data?.data || (Array.isArray(respCert?.data) ? respCert.data : []);
        const certidoesValidas = certs.filter((c) => /regular|valida|válida|emitida|ok/i.test(String(c.status || ''))).length;
        const certidoesVencidas = certs.filter((c) => /vencid|pendent|irregular/i.test(String(c.status || ''))).length;

        const docs: any[] = respDocs?.data?.data || (Array.isArray(respDocs?.data) ? respDocs.data : []);
        const totalDocsCofre = docs.length;

        const propsList: any[] = respProp?.data?.data || (respProp?.data as any)?.items || [];
        const propostaCadastrada = Array.isArray(propsList) && propsList.length > 0;
        const nomeProposta = propostaCadastrada ? propsList[0]?.titulo || propsList[0]?.numeroProposta : undefined;

        setChecklistReal({
          certidoesValidas,
          certidoesVencidas,
          totalCertidoes: certs.length,
          totalDocumentos: totalDocsCofre,
          propostaCadastrada,
          nomeProposta,
        });
      } catch (err) {
        console.warn('Falha ao carregar checklist real:', err);
      } finally {
        if (active) setCarregandoChecklist(false);
      }
    };

    consultarChecklistReal();
    return () => {
      active = false;
    };
  }, [selectedCompany?.id]);

  // Sincronização inicial com certames do CNAE da empresa ativa
  useEffect(() => {
    let active = true;
    const inicializarDisputa = async () => {
      try {
        setCarregandoItens(true);
        const licList: any[] = [];
        if (false && Array.isArray(licList) && licList.length > 0 && active) {
          const primeiroEdital = licList[0];
          setEdital(primeiroEdital);
          const portalUrlOficial = buildOfficialPncpPortalUrl(primeiroEdital);
          if (portalUrlOficial) setPortalUrl(portalUrlOficial);

          const resItens = await licitacoesApi.obterItens(primeiroEdital.id);
          const rawItens = resItens.data?.data || resItens.data?.items || resItens.data || [];
          if (Array.isArray(rawItens) && rawItens.length > 0 && active) {
            const mapped = rawItens.map((it: any, idx: number) => {
              const ref = roundDec(Number(it.valorUnitarioEstimado || it.valorReferencia || it.valorEstimado || 100));
              const piso = roundDec(ref * 0.78);
              const alvo = roundDec(ref * 0.92);
              return {
                id: String(it.id || idx + 1),
                itemNumero: Number(it.numeroItem || it.numero || idx + 1),
                descricao: String(it.descricao || it.descricaoItem || `Item ${idx + 1}`),
                quantidade: Number(it.quantidade || 1),
                unidadeMedida: String(it.unidadeMedida || 'UN'),
                valorReferencia: ref,
                melhorLanceConcorrente: ref,
                seuUltimoLance: null,
                lanceAlvo: alvo,
                pisoMinimo: piso,
                estrategia: 'COBERTURA' as EstrategiaType,
                decrementoMinimo: roundDec(Math.max(1, ref * 0.005)),
                status: 'COBERTO' as StatusItemType,
                ativo: true,
                margemEstimadaPct: 22.0,
              };
            });
            setItens(mapped);
            if (mapped.length > 0) setItemSelecionadoId(mapped[0].id);
            setPassoAtivo(2); // Avança para o Passo 2 ao vincular edital
            adicionarMensagem('SISTEMA', `Certame ${primeiroEdital.numeroEdital || primeiroEdital.id} vinculado à Mesa.`);
          }
        }
      } catch {
        // Silencioso
      } finally {
        if (active) setCarregandoItens(false);
      }
    };

    inicializarDisputa();
    return () => {
      active = false;
    };
  }, [selectedCompany?.id, adicionarMensagem]);

  // Atualização Direta de Campos
  const atualizarCampoItem = (
    itemId: string,
    campo: 'pisoMinimo' | 'lanceAlvo',
    valor: number
  ) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const atualizado = { ...it, [campo]: valor };
        if (campo === 'pisoMinimo') {
          const novoPiso = roundDec(Number(valor) || 0);
          atualizado.pisoMinimo = novoPiso;
          if (it.melhorLanceConcorrente <= novoPiso) {
            atualizado.status = 'PISO_ATINGIDO';
            atualizado.ativo = false;
          }
        }
        return atualizado;
      })
    );
  };

  // Importar Dados da Proposta Comercial Salva
  const sincronizarPropostaSalva = async () => {
    try {
      const res = await propostasApi.listar();
      const list = res?.data?.data || (res?.data as any)?.items || [];
      if (!Array.isArray(list) || list.length === 0) {
        toast('Crie ou salve uma proposta comercial para importar os itens automaticamente.');
        return;
      }
      const prop = list[0];
      const rawItens = Array.isArray(prop?.items) ? prop.items : [];
      if (rawItens.length > 0) {
        const mapped = rawItens.map((it: any, idx: number) => {
          const ref = roundDec(Number(it.precoUnitarioProposto || it.valorUnitario || it.custoDireto || 100));
          const custo = roundDec(Number(it.custoDireto || ref * 0.75));
          const piso = roundDec(custo * 1.10);
          const lanceAlvo = roundDec(ref * 0.92);

          return {
            id: String(it.id || idx + 1),
            itemNumero: Number(it.numero || idx + 1),
            descricao: String(it.descricao || `Item ${idx + 1}`),
            quantidade: Number(it.quantidade || 1),
            unidadeMedida: String(it.unidadeMedida || 'UN'),
            valorReferencia: ref,
            melhorLanceConcorrente: ref,
            seuUltimoLance: null,
            lanceAlvo,
            pisoMinimo: piso,
            estrategia: 'COBERTURA' as EstrategiaType,
            decrementoMinimo: roundDec(Math.max(1, ref * 0.005)),
            status: 'COBERTO' as StatusItemType,
            ativo: true,
            margemEstimadaPct: roundDec(((ref - custo) / ref) * 100),
          };
        });
        setItens(mapped);
        if (mapped.length > 0) setItemSelecionadoId(mapped[0].id);
        setPassoAtivo(2);
        toast.success(`Itens carregados da proposta "${prop.titulo || 'Ativa'}"!`);
      }
    } catch {
      toast.error('Não foi possível sincronizar os itens da proposta.');
    }
  };

  // Seleção de Edital
  const handleSelectEdital = async (e: EditalOption) => {
    setEdital(e);
    const url = buildOfficialPncpPortalUrl(e);
    if (url) {
      setPortalUrl(url);
    }
    setPassoAtivo(2);

    try {
      const resp = await licitacoesApi.obterItens(e.id);
      const rawItens = resp.data?.data || resp.data?.items || resp.data || [];
      if (Array.isArray(rawItens) && rawItens.length > 0) {
        const mapped = rawItens.map((it: any, idx: number) => {
          const ref = roundDec(Number(it.valorUnitarioEstimado || it.valorReferencia || it.valorEstimado || 100));
          const piso = roundDec(ref * 0.78);
          const alvo = roundDec(ref * 0.92);
          return {
            id: String(it.id || idx + 1),
            itemNumero: Number(it.numeroItem || it.numero || idx + 1),
            descricao: String(it.descricao || it.descricaoItem || `Item ${idx + 1}`),
            quantidade: Number(it.quantidade || 1),
            unidadeMedida: String(it.unidadeMedida || 'UN'),
            valorReferencia: ref,
            melhorLanceConcorrente: ref,
            seuUltimoLance: null,
            lanceAlvo: alvo,
            pisoMinimo: piso,
            estrategia: 'COBERTURA' as EstrategiaType,
            decrementoMinimo: roundDec(Math.max(1, ref * 0.005)),
            status: 'COBERTO' as StatusItemType,
            ativo: true,
            margemEstimadaPct: 22.0,
          };
        });
        setItens(mapped);
        if (mapped.length > 0) setItemSelecionadoId(mapped[0].id);
        toast.success(`${rawItens.length} itens carregados do edital.`);
      } else {
        const refGlobal = roundDec(Number(e.valorEstimado || 1000));
        const itemUnico: ItemPlanilhaTerminal = {
          id: `item-${e.id}-1`,
          itemNumero: 1,
          descricao: String(e.objeto || 'Lote Único da Disputa'),
          quantidade: 1,
          unidadeMedida: 'Global',
          valorReferencia: refGlobal,
          melhorLanceConcorrente: refGlobal,
          seuUltimoLance: null,
          lanceAlvo: roundDec(refGlobal * 0.92),
          pisoMinimo: roundDec(refGlobal * 0.78),
          estrategia: 'COBERTURA',
          decrementoMinimo: roundDec(Math.max(10, refGlobal * 0.005)),
          status: 'COBERTO',
          ativo: true,
          margemEstimadaPct: 22.0,
        };
        setItens([itemUnico]);
        setItemSelecionadoId(itemUnico.id);
      }
    } catch {
      // Silencioso
    }
  };

  // Abrir Portal Oficial do Governo
  const abrirSalaOficial = () => {
    window.open(portalUrl, '_blank', 'noopener,noreferrer');
    adicionarMensagem('SISTEMA', `Portal aberto em nova aba: ${portalUrl}`);
  };

  // Item atualmente em foco para cálculo
  const itemEmFoco = useMemo(() => {
    return itens.find((x) => x.id === itemSelecionadoId) || itens[0] || null;
  }, [itens, itemSelecionadoId]);

  // Cálculo Instantâneo Humanizado de Próximo Lance
  const calcularProximoLance = () => {
    if (!itemEmFoco) {
      toast.error('Selecione um item da disputa primeiro.');
      return;
    }

    const valorDigitado = parseFloat(menorPrecoInformado.replace(/\./g, '').replace(',', '.'));
    if (isNaN(valorDigitado) || valorDigitado <= 0) {
      toast.error('Informe o menor valor que você está vendo agora no portal.');
      return;
    }

    const decremento = itemEmFoco.decrementoMinimo || Math.max(1, valorDigitado * 0.005);
    const sugerido = roundDec(valorDigitado - decremento);

    setLanceCalculado(sugerido);
    setCopiadoLance(false);

    // Validação 1: Risco de Prejuízo (abaixo do limite mínimo)
    const emPrejuizo = sugerido < itemEmFoco.pisoMinimo;
    setAlertaPrejuizoAtivo(emPrejuizo);

    const folga = roundDec(sugerido - itemEmFoco.pisoMinimo);
    setFolgaCalculada(folga > 0 ? folga : 0);

    // Validação 2: Diferença ME/EPP <= 5%
    const isMeEpp = selectedCompany?.porte === 'ME' || selectedCompany?.porte === 'EPP';
    const percentualDiferenca = valorDigitado > 0 ? ((itemEmFoco.lanceAlvo - valorDigitado) / valorDigitado) * 100 : 0;
    const direitoMeEpp = isMeEpp && percentualDiferenca > 0 && percentualDiferenca <= 5.0;
    setAlertaMeEppAtivo(direitoMeEpp);

    // Validação 3: Inexequibilidade Art. 59 da Lei 14.133/2021 (< 50% da referência)
    const inexequivel = valorDigitado < itemEmFoco.valorReferencia * 0.50;
    setAlertaInexequivelAtivo(inexequivel);
  };

  const copiarLanceSugerido = () => {
    if (!lanceCalculado) return;
    navigator.clipboard.writeText(lanceCalculado.toFixed(2).replace('.', ','));
    setCopiadoLance(true);
    toast.success(`Valor de ${formatBRL(lanceCalculado)} copiado! Cole no portal.`);
    setTimeout(() => setCopiadoLance(false), 3000);
  };

  // Copiar Mensagens Prontas para o Pregoeiro
  const copiarMensagemPregoeiro = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setMensagemCopiadaId(id);
    toast.success('Mensagem copiada! Cole no chat do pregoeiro no portal.');
    setTimeout(() => setMensagemCopiadaId(null), 3500);
  };

  // Indicadores de Resumo Operacional
  const totalAlvo = useMemo(() => itens.reduce((acc, it) => acc + it.quantidade * it.lanceAlvo, 0), [itens]);
  const totalPiso = useMemo(() => itens.reduce((acc, it) => acc + it.quantidade * it.pisoMinimo, 0), [itens]);

  // Mensagens Prontas para Pregoeiro (Humanizadas e com Contexto de Uso)
  const mensagensPregoeiroTemplates = [
    {
      id: 'msg-negociacao',
      titulo: '1. Responder pedido de desconto do pregoeiro',
      quandoUsar: 'Use quando o pregoeiro solicitar desconto no chat para homologar o lote.',
      texto: `Prezado(a) Pregoeiro(a), informamos que nossa proposta já reflete o melhor valor competitivo com garantia de execução e custos operacionais rigorosamente apurados. Em espírito de colaboração com a Administração, confirmamos a manutenção do valor com plena exequibilidade contratual conforme Art. 61 da Lei nº 14.133/2021.`,
    },
    {
      id: 'msg-prazo-2h',
      titulo: '2. Pedir 2 horas para enviar proposta ajustada',
      quandoUsar: 'Use após vencer a disputa para solicitar o prazo legal de readequação da proposta.',
      texto: `Prezado(a) Pregoeiro(a), com fulcro no princípio da razoabilidade e nas disposições do edital, solicitamos a concessão do prazo regulamentar de 2 (duas) horas para envio da proposta comercial devidamente readequada ao lance vencedor e suas planilhas de custos anexas.`,
    },
    {
      id: 'msg-recurso',
      titulo: '3. Avisar que vai entrar com recurso contra concorrente',
      quandoUsar: 'Use caso o concorrente vencedor tenha preço inexequível ou descumpra o edital.',
      texto: `Prezado(a) Pregoeiro(a), manifestamos expressamente nossa intenção de recorrer contra a aceitação da proposta da empresa classificada em 1º lugar, em razão do descumprimento de requisitos técnicos e indício de preço manifestamente inexequível conforme Art. 59, III e Art. 165 da Lei nº 14.133/2021.`,
    },
    {
      id: 'msg-meepp',
      titulo: '4. Pedir preferência de desempate para ME/EPP',
      quandoUsar: 'Use se você for ME/EPP e a diferença para o 1º colocado for de até 5%.',
      texto: `Prezado(a) Pregoeiro(a), na qualidade de Microempresa/EPP qualificada no certame, requeremos o exercício do direito de preferência e empate ficto previsto nos Arts. 44 e 45 da Lei Complementar nº 123/2006 para envio de proposta final de desempate no prazo de 5 minutos.`,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 space-y-4">

        {/* =========================================================================
            1. TOPO LIMPO: TÍTULO HUMANIZADO & GUIA DE 3 PASSOS
            ========================================================================= */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-[#081C3A] text-[#EA580C] rounded-xl shadow-xs">
                  <Gavel size={20} />
                </span>
                <h1 className="text-lg sm:text-xl font-black text-[#081C3A]">
                  Sala de Disputa & Lances
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Acompanhe os valores da sessão, proteja seu lucro mínimo e responda ao pregoeiro com segurança.
              </p>
            </div>

            {/* AÇÕES DISCRETAS (SEM POLUIÇÃO E SEM BOTÕES FALSOS) */}
            <div className="flex items-center gap-2">
              {conectorExtensaoAtivo ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#14532D]/10 px-3 py-1 text-xs font-bold text-[#14532D] border border-[#166534]/30">
                  <span className="h-2 w-2 rounded-full bg-[#166534] animate-ping" />
                  Conector Ativo no {nomePortalConectado}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalExtensaoAberta(true)}
                  className="text-xs text-[#0070C0] hover:text-[#081C3A] font-bold underline transition"
                >
                  Usar extensão automática no navegador ↗
                </button>
              )}

              <button
                type="button"
                onClick={() => setSomHabilitado(!somHabilitado)}
                title={somHabilitado ? 'Som ativado' : 'Som silenciado'}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
              >
                {somHabilitado ? <Volume2 className="h-4 w-4 text-[#14532D]" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
              </button>
            </div>
          </div>

          {/* BARRA DE PROGRESSO GUIADA (PASSO 1, 2 E 3) */}
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[10px] font-black uppercase text-slate-400 block mb-2">
              O que fazer agora — Passo a Passo Guiado:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {/* Passo 1 */}
              <div
                onClick={() => setPassoAtivo(1)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  passoAtivo === 1
                    ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                    passoAtivo === 1 ? 'bg-[#081C3A] text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    1
                  </span>
                  <strong className="text-xs text-slate-900">Defina seu Limite</strong>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Selecione o edital que você vai disputar hoje e confira o menor preço que sua empresa pode chegar sem ter prejuízo.
                </p>
              </div>

              {/* Passo 2 */}
              <div
                onClick={() => setPassoAtivo(2)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  passoAtivo === 2
                    ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                    passoAtivo === 2 ? 'bg-[#081C3A] text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    2
                  </span>
                  <strong className="text-xs text-slate-900">Acompanhe no Portal</strong>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Abra a aba do portal do governo. Sempre que o concorrente baixar o preço lá, digite aqui que eu te digo na hora se vale cobrir.
                </p>
              </div>

              {/* Passo 3 */}
              <div
                onClick={() => {
                  setPassoAtivo(3);
                  setAbaLateral('MENSAGENS');
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  passoAtivo === 3
                    ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-slate-50/60 border-slate-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${
                    passoAtivo === 3 ? 'bg-[#081C3A] text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    3
                  </span>
                  <strong className="text-xs text-slate-900">Negocie e Vença</strong>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">
                  Encerrou a disputa? Use as respostas prontas para responder ao pregoeiro com fundamentação em segundos.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            2. OS 3 CARTÕES PRINCIPAIS (FORMATO R$ LEGÍVEL, SEM CORTAR DÍGITOS)
            ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Cartão 1: Edital Selecionado */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                1. Edital Selecionado
              </span>
              <div className="mb-2">
                <EditalSelector onSelectEdital={handleSelectEdital} />
              </div>
              <p className="text-xs text-slate-600 truncate" title={edital?.orgao || 'Órgão Promotor'}>
                {edital?.orgao || 'Nenhum edital selecionado'}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Disputa Oficial:</span>
              <button
                type="button"
                onClick={abrirSalaOficial}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#0070C0] hover:text-blue-800 transition"
              >
                Abrir Portal do Governo <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Cartão 2: Sua Meta de Valor */}
          <div className="rounded-2xl border border-[#166534]/30 bg-[#14532D]/5 p-4 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#14532D] uppercase block">
                2. Sua Meta de Valor (Faturamento Alvo)
              </span>
              <div className="mt-2">
                <strong className="text-xl sm:text-2xl font-black text-[#14532D] font-mono tracking-tight block">
                  {formatBRL(totalAlvo)}
                </strong>
              </div>
            </div>
            <p className="text-[11px] text-[#14532D] pt-2 border-t border-[#166534]/20 mt-2">
              Preço ideal com lucro pleno projetado para todos os itens da disputa.
            </p>
          </div>

          {/* Cartão 3: Seu Limite Mínimo (Sem Prejuízo) */}
          <div className="rounded-2xl border border-red-200 bg-red-50/30 p-4 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-red-800 uppercase block flex items-center gap-1">
                <Lock className="h-3.5 w-3.5 text-red-600" /> 3. Seu Limite Mínimo (Sem Prejuízo)
              </span>
              <div className="mt-2">
                <strong className="text-xl sm:text-2xl font-black text-red-600 font-mono tracking-tight block">
                  {formatBRL(totalPiso)}
                </strong>
              </div>
            </div>
            <p className="text-[11px] text-red-900 pt-2 border-t border-red-100/60 mt-2 font-medium">
              Travamento absoluto: nunca cubra ofertas abaixo deste valor para não ter prejuízo.
            </p>
          </div>
        </div>

        {/* =========================================================================
            3. ÁREA PRINCIPAL: TABELA DE 5 COLUNAS (ESQUERDA) + CALCULADORA E APOIO (DIREITA)
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* COLUNA ESQUERDA (7 Colunas no Desktop): TABELA SIMPLIFICADA (5 COLUNAS SEM CORTE) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black text-[#081C3A]">
                    Controle de Lances por Item
                  </h2>
                  <p className="text-xs text-slate-500">
                    Clique em um item para carregar na calculadora ao lado.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setModoVisualizacao('TABELA')}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                        modoVisualizacao === 'TABELA' ? 'bg-white shadow-xs text-[#081C3A]' : 'text-slate-500'
                      }`}
                    >
                      Tabela
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoVisualizacao('CARDS')}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded ${
                        modoVisualizacao === 'CARDS' ? 'bg-white shadow-xs text-[#081C3A]' : 'text-slate-500'
                      }`}
                    >
                      Cards
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={sincronizarPropostaSalva}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-[#081C3A] hover:bg-slate-100 transition"
                  >
                    <RefreshCw className="h-3 w-3 text-[#0070C0]" />
                    Puxar Proposta
                  </button>
                </div>
              </div>

              {/* MODO CARDS (PARA CELULAR/TABLET) */}
              {modoVisualizacao === 'CARDS' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {itens.map((it) => (
                    <div
                      key={it.id}
                      onClick={() => setItemSelecionadoId(it.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        it.id === itemSelecionadoId
                          ? 'border-[#081C3A] ring-2 ring-[#081C3A]/20 bg-blue-50/30'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className="text-xs font-black text-[#081C3A]">Item #{it.itemNumero}</span>
                        <span className="text-[10px] font-bold text-slate-500">
                          Qtd: {it.quantidade} {it.unidadeMedida}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 font-medium my-1.5 line-clamp-2">
                        {it.descricao}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Menor Concorrente</span>
                          <strong className="text-slate-800 font-mono text-xs">{formatBRL(it.melhorLanceConcorrente)}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-red-600 block">Limite Sem Prejuízo</span>
                          <strong className="text-red-600 font-mono text-xs">{formatBRL(it.pisoMinimo)}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* TABELA DEFINITIVA DE 5 COLUNAS (SEM CORTE NO DESKTOP) */
                <div className="w-full overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-xs table-fixed">
                    <thead className="bg-[#081C3A] text-white text-[11px] font-bold">
                      <tr>
                        <th className="py-2.5 px-3 w-16 text-center">Item</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-3 w-40 text-right">Menor Oferta</th>
                        <th className="py-2.5 px-3 w-36 text-right">Meta de Lance</th>
                        <th className="py-2.5 px-3 w-44 text-right">Limite Sem Prejuízo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {carregandoItens ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-xs font-semibold text-slate-500">
                            <RefreshCw className="mx-auto h-5 w-5 animate-spin text-[#EA580C] mb-2" />
                            Carregando itens...
                          </td>
                        </tr>
                      ) : itens.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-xs text-slate-500">
                            Nenhum item carregado. Selecione um edital acima ou puxe de uma proposta.
                          </td>
                        </tr>
                      ) : (
                        itens.map((it) => {
                          const selecionado = it.id === itemSelecionadoId;
                          const pisoAtingido = it.melhorLanceConcorrente <= it.pisoMinimo;

                          return (
                            <tr
                              key={it.id}
                              onClick={() => setItemSelecionadoId(it.id)}
                              className={`cursor-pointer transition-colors ${
                                selecionado
                                  ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-300'
                                  : pisoAtingido
                                  ? 'bg-red-50/30 hover:bg-red-50/50'
                                  : 'hover:bg-slate-50/80'
                              }`}
                            >
                              {/* 1. Item */}
                              <td className="py-2.5 px-3 text-center font-black text-[#081C3A]">
                                #{it.itemNumero}
                              </td>

                              {/* 2. Descrição */}
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-800 block truncate" title={it.descricao}>
                                  {it.descricao}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                  Ref: {formatBRL(it.valorReferencia)} • Qtd: {it.quantidade}
                                </span>
                              </td>

                              {/* 3. Menor Oferta Atual */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                                {formatBRL(it.melhorLanceConcorrente)}
                              </td>

                              {/* 4. Meta de Lance (Editável) */}
                              <td className="py-2 px-2 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.lanceAlvo}
                                  onChange={(e) =>
                                    atualizarCampoItem(it.id, 'lanceAlvo', parseFloat(e.target.value) || 0)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-right font-mono text-xs font-bold text-slate-900 focus:border-[#081C3A] focus:outline-none"
                                />
                              </td>

                              {/* 5. Limite Mínimo Sem Prejuízo (Editável) */}
                              <td className="py-2 px-2 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.pisoMinimo}
                                  onChange={(e) =>
                                    atualizarCampoItem(it.id, 'pisoMinimo', parseFloat(e.target.value) || 0)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full rounded border border-red-200 bg-red-50/60 px-2 py-1 text-right font-mono text-xs font-bold text-red-700 focus:border-red-500 focus:outline-none"
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* COLUNA DIREITA (5 Colunas no Desktop): CALCULADORA HUMANA & ABAS DE APOIO */}
          <div className="lg:col-span-5 space-y-3">

            {/* BOX 1: CALCULADORA QUE FALA E ENSINA O USUÁRIO */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-[#081C3A]">
                  <Calculator className="h-4 w-4 text-[#EA580C]" />
                  <h3 className="text-xs font-black uppercase">
                    Calculadora de Lance em Tempo Real
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  {itemEmFoco ? `Item #${itemEmFoco.itemNumero}` : 'Selecione um item'}
                </span>
              </div>

              {itemEmFoco ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Qual é o menor preço agora no portal do governo?
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">R$</span>
                        <input
                          type="text"
                          placeholder="Ex: 14.500,00"
                          value={menorPrecoInformado}
                          onChange={(e) => setMenorPrecoInformado(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && calcularProximoLance()}
                          className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#081C3A] focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={calcularProximoLance}
                        className="px-4 py-2 bg-[#081C3A] hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
                      >
                        Ver se vale cobrir
                      </button>
                    </div>
                  </div>

                  {/* CAIXA DE ORIENTAÇÃO HUMANA REAL */}
                  {lanceCalculado !== null && (
                    <div className="space-y-2 pt-1">
                      {/* Cenário A: Pode cobrir com segurança (Acima do Limite) */}
                      {!alertaPrejuizoAtivo && (
                        <div className="p-3 rounded-xl bg-[#14532D]/5 border border-[#166534]/30 text-slate-900 space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="text-base">✅</span>
                            <div>
                              <strong className="text-xs font-black block text-[#14532D]">
                                Pode cobrir com segurança!
                              </strong>
                              <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                                Lance sugerido no portal: <strong>{formatBRL(lanceCalculado)}</strong>.
                                {folgaCalculada !== null && folgaCalculada > 0 && (
                                  <> Você ainda fica <strong>{formatBRL(folgaCalculada)}</strong> acima do seu limite mínimo de lucro.</>
                                )}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={copiarLanceSugerido}
                            className="w-full py-2 bg-[#14532D] hover:bg-[#0f3d21] text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                          >
                            {copiadoLance ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiadoLance ? 'Copiado para a área de transferência!' : 'Copiar este valor de lance'}
                          </button>
                        </div>
                      )}

                      {/* Cenário B: Não cobrir (Abaixo do Limite Seguro) */}
                      {alertaPrejuizoAtivo && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-950 space-y-1.5">
                          <div className="flex items-start gap-2">
                            <span className="text-base">⛔</span>
                            <div>
                              <strong className="text-xs font-black block text-red-900">
                                Atenção: não cubra este valor!
                              </strong>
                              <p className="text-xs text-red-800 mt-0.5 leading-relaxed">
                                O concorrente já baixou do seu limite seguro ({formatBRL(itemEmFoco.pisoMinimo)}). Entrar abaixo disso vai gerar prejuízo financeiro para sua empresa.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Cenário C: Benefício ME/EPP (Empate Ficto <= 5%) */}
                      {alertaMeEppAtivo && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1.5">
                          <div className="flex items-start gap-2">
                            <span className="text-base">⭐</span>
                            <div>
                              <strong className="text-xs font-black block text-amber-900">
                                Vantagem ME/EPP liberada!
                              </strong>
                              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                                Como a diferença está em até 5%, você tem direito legal de cobrir esse lance em até 5 minutos após o encerramento da disputa.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAbaLateral('ME_EPP');
                              setCronometroMeAtivo(true);
                            }}
                            className="text-xs font-bold text-amber-900 underline"
                          >
                            Iniciar cronômetro dos 5 minutos ↗
                          </button>
                        </div>
                      )}

                      {/* Cenário D: Inexequibilidade Art. 59 */}
                      {alertaInexequivelAtivo && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-[11px] leading-relaxed">
                          <strong>Indício de Inexequibilidade:</strong> O concorrente caiu mais de 50% abaixo do valor do edital. O pregoeiro tem obrigação legal de pedir a planilha dele. Se ele não comprovar, você pode desclassificá-lo!
                        </div>
                      )}

                      {/* Mini-guia de 1 linha sempre visível */}
                      <p className="text-[11px] text-slate-500 pt-1 flex items-center gap-1">
                        <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        Copie o valor sugerido acima e lance diretamente na aba do portal do governo.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-3 text-center">
                  Selecione um item na tabela à esquerda para calcular o próximo lance.
                </p>
              )}
            </div>

            {/* BOX 2: ABAS ORGANIZADAS (MENSAGENS PREGOEIRO, ME/EPP, CHECKLIST) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              {/* Seletor de Abas */}
              <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAbaLateral('MENSAGENS');
                    setPassoAtivo(3);
                  }}
                  className={`flex-1 py-1.5 font-bold rounded-lg transition ${
                    abaLateral === 'MENSAGENS' ? 'bg-[#081C3A] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mensagens Pregoeiro
                </button>
                <button
                  type="button"
                  onClick={() => setAbaLateral('ME_EPP')}
                  className={`flex-1 py-1.5 font-bold rounded-lg transition ${
                    abaLateral === 'ME_EPP' ? 'bg-[#081C3A] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Direito ME/EPP
                </button>
                <button
                  type="button"
                  onClick={() => setAbaLateral('CHECKLIST')}
                  className={`flex-1 py-1.5 font-bold rounded-lg transition ${
                    abaLateral === 'CHECKLIST' ? 'bg-[#081C3A] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Checklist
                </button>
              </div>

              {/* CONTEÚDO DA ABA 1: MENSAGENS PARA O PREGOEIRO */}
              {abaLateral === 'MENSAGENS' && (
                <div className="space-y-2 text-xs">
                  {mensagensPregoeiroTemplates.map((msg) => (
                    <div key={msg.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <strong className="text-xs font-black text-[#081C3A] block">
                            {msg.titulo}
                          </strong>
                          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                            {msg.quandoUsar}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copiarMensagemPregoeiro(msg.id, msg.texto)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                            mensagemCopiadaId === msg.id
                              ? 'bg-[#14532D] text-white'
                              : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          {mensagemCopiadaId === msg.id ? (
                            <>
                              <Check className="h-3.5 w-3.5" /> Copiado!
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" /> Copiar
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed pt-1 border-t border-slate-200/60">
                        {msg.texto}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* CONTEÚDO DA ABA 2: BENEFÍCIO ME/EPP */}
              {abaLateral === 'ME_EPP' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2">
                    <strong className="text-xs font-black text-amber-900 block">
                      Direito de Desempate Ficto (LC nº 123/2006)
                    </strong>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Se você for ME/EPP e a melhor oferta for de empresa de grande porte com até 5% de diferença, você tem prioridade legal para cobrir o lance em 5 minutos!
                    </p>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-amber-300">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Prazo de Envio</span>
                        <strong className="text-lg font-black font-mono text-[#081C3A]">
                          {formatTempoMe(tempoMeSegundos)}
                        </strong>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setCronometroMeAtivo(!cronometroMeAtivo)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition ${
                            cronometroMeAtivo ? 'bg-amber-600' : 'bg-[#14532D]'
                          }`}
                        >
                          {cronometroMeAtivo ? 'Pausar' : 'Iniciar 5 min'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCronometroMeAtivo(false);
                            setTempoMeSegundos(300);
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTEÚDO DA ABA 3: CHECKLIST DA EMPRESA */}
              {abaLateral === 'CHECKLIST' && (
                <div className="space-y-2 text-xs">
                  {carregandoChecklist && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 py-1">
                      <RefreshCw className="h-3 w-3 animate-spin text-[#0070C0]" />
                      Atualizando certidões com a base oficial...
                    </div>
                  )}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <strong className="text-xs text-slate-800 block">Certidões Fiscais (CNDs)</strong>
                      <span className="text-[10px] text-slate-500">
                        {checklistReal.totalCertidoes > 0
                          ? `${checklistReal.certidoesValidas} válidas de ${checklistReal.totalCertidoes}`
                          : 'Nenhuma cadastrada'}
                      </span>
                    </div>
                    {checklistReal.certidoesVencidas > 0 ? (
                      <Link
                        to="/fornecedor/certidoes"
                        className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[10px]"
                      >
                        {checklistReal.certidoesVencidas} pendentes
                      </Link>
                    ) : (
                      <span className="font-bold text-[#14532D] text-[11px]">100% em dia</span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <strong className="text-xs text-slate-800 block">Proposta Comercial</strong>
                      <span className="text-[10px] text-slate-500">
                        {checklistReal.propostaCadastrada ? 'Pronta para importação' : 'Nenhuma proposta vinculada'}
                      </span>
                    </div>
                    <span className="font-bold text-[#14532D] text-[11px]">
                      {checklistReal.propostaCadastrada ? 'Vinculada' : 'Pendente'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DISCRETO DA EXTENSÃO */}
      {modalExtensaoAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-[#081C3A]">Extensão de Disputa Expertise</h3>
              <button
                type="button"
                onClick={() => setModalExtensaoAberta(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Com a extensão carregada no Chrome, esta tela sincroniza os lances automaticamente direto da aba do portal do governo.
            </p>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-1 text-[11px]">
              <strong>Como ativar:</strong>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Abra <code className="bg-white px-1 rounded">chrome://extensions</code></li>
                <li>Ative o <strong>Modo do desenvolvedor</strong>.</li>
                <li>Clique em <strong>Carregar sem compactação</strong> e selecione a pasta <code className="bg-white px-1 rounded">EXPERTISE/chrome-extension</code>.</li>
              </ol>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalExtensaoAberta(false)}
                className="px-4 py-1.5 bg-[#081C3A] text-white font-bold rounded-lg text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingTerminal;
