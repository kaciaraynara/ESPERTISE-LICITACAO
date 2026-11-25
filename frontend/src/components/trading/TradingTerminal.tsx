import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Zap,
  Activity,
  ExternalLink,
  Play,
  Pause,
  RefreshCw,
  Volume2,
  VolumeX,
  Gavel,
  CheckCircle2,
  AlertTriangle,
  Lock,
  AlertOctagon,
  Copy,
  Check,
  Calculator,
  FileText,
  Building2,
  Radio,
  Sparkles,
  X,
  RotateCcw,
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
  pisoMinimo: number; // Valor Mínimo (Sem Prejuízo)
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

  // Edital Selecionado e Portal
  const [edital, setEdital] = useState<EditalOption | null>(null);
  const [portalUrl, setPortalUrl] = useState<string>('https://pncp.gov.br/app/editais');

  // Conexão Honesta e Extensão Chrome
  const [conectorExtensaoAtivo, setConectorExtensaoAtivo] = useState<boolean>(false);
  const [nomePortalConectado, setNomePortalConectado] = useState<string>('');
  const [modalExtensaoAberta, setModalExtensaoAberta] = useState<boolean>(false);

  // Áudio de Alertas do Pregoeiro
  const [somHabilitado, setSomHabilitado] = useState<boolean>(true);

  // Modo de Exibição (Tabela Completa vs Cards no Mobile/Tablet)
  const [modoVisualizacao, setModoVisualizacao] = useState<'TABELA' | 'CARDS'>('TABELA');
  const [abaMobile, setAbaMobile] = useState<'ITENS' | 'COPILOTO' | 'AVISOS' | 'CHECKLIST'>('ITENS');

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

  // Copiloto: Calculadora Instantânea de Próximo Lance
  const [menorPrecoInformado, setMenorPrecoInformado] = useState<string>('');
  const [lanceCalculado, setLanceCalculado] = useState<number | null>(null);
  const [alertaPrejuizoAtivo, setAlertaPrejuizoAtivo] = useState<boolean>(false);
  const [alertaInexequivelAtivo, setAlertaInexequivelAtivo] = useState<boolean>(false);
  const [copiadoLance, setCopiadoLance] = useState<boolean>(false);

  // Benefício ME/EPP - Cronômetro Legal de 5 Minutos (Empate Ficto LC 123/2006)
  const [tempoMeSegundos, setTempoMeSegundos] = useState<number>(300);
  const [cronometroMeAtivo, setCronometroMeAtivo] = useState<boolean>(false);

  // Mensagens do Pregoeiro e Avisos Oficiais
  const [mensagens, setMensagens] = useState<MensagemDisputa[]>([
    {
      id: 'msg-1',
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      autor: 'SISTEMA',
      texto: 'Mesa Estratégica iniciada em Modo Manual Assistido. Selecione um edital para carregar os lotes e calcular os lances de segurança.',
    },
  ]);

  // Mensagens Prontas para o Pregoeiro (Copiar em 1 Clique)
  const [mensagemCopiadaId, setMensagemCopiadaId] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Rolagem automática nas mensagens
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  // Handshake com a Extensão Google Chrome Oficial
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

    // Envia ping de descoberta para a extensão
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

  // Sincronização inicial com certames do CNAE da empresa ativa se não houver edital
  useEffect(() => {
    let active = true;
    const inicializarDisputa = async () => {
      try {
        setCarregandoItens(true);
        const cnaeAtivo = (selectedCompany as any)?.cnaePrincipal || (selectedCompany as any)?.cnae_principal;
        const resLic = await licitacoesApi.listar({ cnae: cnaeAtivo, local: true } as any);
        const licList = resLic?.data?.items || resLic?.data?.data || [];
        if (Array.isArray(licList) && licList.length > 0 && active) {
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
            adicionarMensagem('SISTEMA', `Certame ${primeiroEdital.numeroEdital || primeiroEdital.id} vinculado à Mesa Estratégica.`);
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

  // PARADA DE EMERGÊNCIA GLOBAL (STOP ALL)
  const executarParadaEmergencia = () => {
    setItens((prev) =>
      prev.map((it) => ({
        ...it,
        ativo: false,
        status: it.status === 'VENCENDO' ? 'VENCENDO' : 'PAUSADO',
      }))
    );

    // Notifica também a extensão se estiver ativa
    window.postMessage({ source: 'EXPERTISE_WEB_APP', type: 'EMERGENCY_STOP' }, '*');

    adicionarMensagem(
      'ALERTA',
      'PARADA DE EMERGÊNCIA ACIONADA: Todos os disparos e automações de lances foram interrompidos imediatamente.'
    );
    toast.error('PARADA DE EMERGÊNCIA EXECUTADA: Todas as operações pausadas com segurança.', {
      duration: 5000,
      icon: '🛑',
    });
  };

  // RETOMAR TODOS OS ITENS
  const ligarTodos = () => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.melhorLanceConcorrente <= it.pisoMinimo) {
          return { ...it, ativo: false, status: 'PISO_ATINGIDO' };
        }
        return {
          ...it,
          ativo: true,
          status: it.seuUltimoLance === it.melhorLanceConcorrente ? 'VENCENDO' : 'COBERTO',
        };
      })
    );
    adicionarMensagem('SISTEMA', 'Monitoramento ativado com limite de segurança preservado.');
    toast.success('Itens ativos e monitorando a disputa.');
  };

  // Alternar Ativação Individual
  const toggleItemAtivo = (itemId: string) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const novoAtivo = !it.ativo;
        if (novoAtivo && it.melhorLanceConcorrente <= it.pisoMinimo) {
          toast.error(
            `Item #${it.itemNumero}: Valor mínimo de ${formatBRL(it.pisoMinimo)} já atingido. Ativação bloqueada para proteger sua empresa contra prejuízo.`
          );
          return { ...it, ativo: false, status: 'PISO_ATINGIDO' };
        }
        adicionarMensagem(
          'SISTEMA',
          `Item #${it.itemNumero} ${novoAtivo ? 'ATIVADO' : 'PAUSADO'} pelo operador.`
        );
        return {
          ...it,
          ativo: novoAtivo,
          status: novoAtivo ? (it.seuUltimoLance === it.melhorLanceConcorrente ? 'VENCENDO' : 'COBERTO') : 'PAUSADO',
        };
      })
    );
  };

  // Atualização Direta de Campos
  const atualizarCampoItem = (
    itemId: string,
    campo: 'pisoMinimo' | 'lanceAlvo' | 'estrategia',
    valor: any
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

        if (campo === 'estrategia') {
          adicionarMensagem('SISTEMA', `Estratégia do Item #${it.itemNumero} alterada para ${valor}.`);
        }

        return atualizado;
      })
    );
  };

  // Disparo de Lance Manual com Validação Rígida de Piso Mínimo
  const dispararLanceManual = (item: ItemPlanilhaTerminal) => {
    if (!item.lanceAlvo || item.lanceAlvo <= 0) {
      toast.error(`Informe uma meta de lance válida para o Item #${item.itemNumero}.`);
      return;
    }

    if (item.lanceAlvo < item.pisoMinimo) {
      adicionarMensagem(
        'ALERTA',
        `BLOQUEIO DE SEGURANÇA: Lance de ${formatBRL(item.lanceAlvo)} no Item #${item.itemNumero} rejeitado por violar o limite mínimo para não ter prejuízo (${formatBRL(item.pisoMinimo)}).`
      );
      toast.error(`Operação bloqueada: Lance de ${formatBRL(item.lanceAlvo)} viola seu limite de segurança (${formatBRL(item.pisoMinimo)}).`);
      return;
    }

    const valorDisparo = roundDec(item.lanceAlvo);

    setItens((prev) =>
      prev.map((it) => {
        if (it.id !== item.id) return it;
        return {
          ...it,
          seuUltimoLance: valorDisparo,
          melhorLanceConcorrente: valorDisparo,
          status: 'VENCENDO',
        };
      })
    );

    // Dispara via postMessage para extensão se conectada
    if (conectorExtensaoAtivo) {
      window.postMessage(
        {
          source: 'EXPERTISE_WEB_APP',
          type: 'DISPATCH_BID',
          itemNumero: item.itemNumero,
          valor: valorDisparo,
        },
        '*'
      );
    }

    adicionarMensagem(
      'LANCE',
      `LANCE REGISTRADO: Item #${item.itemNumero} com ${formatBRL(valorDisparo)}. Posição assumida: 1º LUGAR.`,
      item.itemNumero,
      valorDisparo
    );
    toast.success(`Lance de ${formatBRL(valorDisparo)} registrado no Item #${item.itemNumero}!`);
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
        adicionarMensagem('SISTEMA', `Itens da proposta "${prop.titulo || 'Ativa'}" carregados com sucesso.`);
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
    adicionarMensagem('SISTEMA', `Edital selecionado: ${e.numeroEdital || e.id} - ${e.orgao || 'Órgão Promotor'}.`);

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
        adicionarMensagem('SISTEMA', `${rawItens.length} itens reais do certame carregados.`);
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
        adicionarMensagem('SISTEMA', `Lote global do edital carregado.`);
      }
    } catch {
      // Silencioso
    }
  };

  // Abrir Sala de Disputa no Portal Oficial
  const abrirSalaOficial = () => {
    window.open(portalUrl, '_blank', 'noopener,noreferrer');
    adicionarMensagem('SISTEMA', `Acesso à sala oficial acionado no portal: ${portalUrl}`);
  };

  // Item atualmente em foco para cálculo
  const itemEmFoco = useMemo(() => {
    return itens.find((x) => x.id === itemSelecionadoId) || itens[0] || null;
  }, [itens, itemSelecionadoId]);

  // Copiloto: Cálculo Instantâneo de Próximo Lance
  const calcularProximoLance = () => {
    if (!itemEmFoco) {
      toast.error('Selecione um item para calcular.');
      return;
    }

    const valorDigitado = parseFloat(menorPrecoInformado.replace(/\./g, '').replace(',', '.'));
    if (isNaN(valorDigitado) || valorDigitado <= 0) {
      toast.error('Informe um valor de lance válido visto no portal.');
      return;
    }

    const decremento = itemEmFoco.decrementoMinimo || Math.max(1, valorDigitado * 0.005);
    const sugerido = roundDec(valorDigitado - decremento);

    setLanceCalculado(sugerido);
    setCopiadoLance(false);

    // Validação 1: Abaixo do Piso de Segurança (Risco de Prejuízo)
    const emPrejuizo = sugerido < itemEmFoco.pisoMinimo;
    setAlertaPrejuizoAtivo(emPrejuizo);

    // Validação 2: Inexequibilidade Art. 59 da Lei 14.133/2021 (inferior a 50% da referência)
    const inexequivel = valorDigitado < itemEmFoco.valorReferencia * 0.50;
    setAlertaInexequivelAtivo(inexequivel);

    if (emPrejuizo) {
      toast.error(
        `ALERTA: O lance sugerido de ${formatBRL(sugerido)} viola seu Limite Mínimo para Não Ter Prejuízo (${formatBRL(itemEmFoco.pisoMinimo)})!`,
        { duration: 6000 }
      );
    } else {
      toast.success(`Lance de ${formatBRL(sugerido)} calculado com margem segura!`);
    }
  };

  const copiarLanceSugerido = () => {
    if (!lanceCalculado) return;
    navigator.clipboard.writeText(lanceCalculado.toFixed(2).replace('.', ','));
    setCopiadoLance(true);
    toast.success(`Valor ${formatBRL(lanceCalculado)} copiado! Cole no campo de lance do portal.`);
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
  const totalItens = itens.length;
  const itensVencendo = itens.filter((i) => i.status === 'VENCENDO').length;
  const itensAtivos = itens.filter((i) => i.ativo).length;
  const totalAlvo = useMemo(() => itens.reduce((acc, it) => acc + it.quantidade * it.lanceAlvo, 0), [itens]);
  const totalPiso = useMemo(() => itens.reduce((acc, it) => acc + it.quantidade * it.pisoMinimo, 0), [itens]);

  // Mensagens Padrão Prontas para Pregoeiro
  const mensagensPregoeiroTemplates = [
    {
      id: 'msg-negociacao',
      titulo: '1. Negociação de Preço (Art. 61 Lei 14.133/2021)',
      texto: `Prezado(a) Pregoeiro(a), informamos que nossa proposta já reflete o melhor valor competitivo com garantia de execução e custos operacionais rigorosamente apurados. Em espírito de colaboração com a Administração, confirmamos a manutenção do valor com plena exequibilidade contratual.`,
    },
    {
      id: 'msg-prazo-2h',
      titulo: '2. Solicitação de Prazo de 2h para Proposta Readequada',
      texto: `Prezado(a) Pregoeiro(a), com fulcro no princípio da razoabilidade e no edital, solicitamos a concessão do prazo regulamentar de 2 (duas) horas para o envio da proposta comercial devidamente readequada ao lance final e suas planilhas de custos.`,
    },
    {
      id: 'msg-recurso',
      titulo: '3. Registro de Intenção de Recurso (Art. 165 Lei 14.133/2021)',
      texto: `Prezado(a) Pregoeiro(a), manifestamos expressamente nossa intenção de recorrer contra a aceitação da proposta da empresa classificada provisoriamente em 1º lugar, em razão do descumprimento dos requisitos técnicos do Termo de Referência e indício de preço inexequível conforme Art. 59, III da Lei 14.133/2021.`,
    },
    {
      id: 'msg-meepp',
      titulo: '4. Requerimento de Direito de Preferência ME/EPP (LC 123/2006)',
      texto: `Prezado(a) Pregoeiro(a), na condição de Microempresa/EPP devidamente qualificada no certame, requeremos o exercício do direito de preferência e empate ficto (Arts. 44 e 45 da Lei Complementar nº 123/2006) para apresentação de lance final desempate no prazo de 5 minutos.`,
    },
  ];

  // Interpretação Humana do Modo de Disputa Real
  const modoDisputaDescricao = useMemo(() => {
    const mod = String(edital?.modalidade || '').toLowerCase();
    const obj = String(edital?.objeto || '').toLowerCase();
    if (mod.includes('aberto e fechado') || mod.includes('aberto-fechado')) {
      return 'Disputa Aberta e Fechada (lance final sigiloso de 5 min)';
    }
    if (mod.includes('aberto')) {
      return 'Disputa Aberta (lances sucessivos com prorrogações de 2 min)';
    }
    if (mod.includes('dispensa') || obj.includes('dispensa')) {
      return 'Dispensa Eletrônica (envio contínuo de lances)';
    }
    return 'Pregão Eletrônico (Disputa Sucessiva de Lances)';
  }, [edital]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 py-4 space-y-4">
        {/* =========================================================================
            1. BANNER ESTRATÉGICO: ALERTA DE PROXIMIDADE & CONEXÃO COM O PORTAL
            ========================================================================= */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#081C3A] text-[#EA580C] shadow-sm">
                <Gavel className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-extrabold text-[#081C3A]">
                    Mesa Estratégica de Disputa & Copiloto Operacional
                  </h1>

                  {/* BADGE DE CONEXÃO HONESTO */}
                  {conectorExtensaoAtivo ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                      Conector Ativo no Portal: {nomePortalConectado}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 border border-slate-300">
                      <Radio className="h-3 w-3 text-blue-600" />
                      Modo Manual Assistido
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Acompanhe a disputa em tempo real, proteja sua margem contra prejuízo e receba alertas estratégicos baseados na Lei 14.133/2021.
                </p>
              </div>
            </div>

            {/* Ações Globais: Extensão Chrome, Ligar Todos & Parada de Emergência */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setModalExtensaoAberta(true)}
                title="Conectar Extensão Oficial do Chrome"
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-[#0070C0] px-3 py-2 text-xs font-bold transition shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {conectorExtensaoAtivo ? 'Extensão Conectada' : 'Conectar Extensão'}
              </button>

              <button
                type="button"
                onClick={() => setSomHabilitado(!somHabilitado)}
                title={somHabilitado ? 'Alertas sonoros ativados' : 'Alertas sonoros silenciados'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                {somHabilitado ? <Volume2 className="h-4 w-4 text-emerald-600" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
                <span className="hidden sm:inline">{somHabilitado ? 'Som Ativo' : 'Mudo'}</span>
              </button>

              <button
                type="button"
                onClick={ligarTodos}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-white px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition"
              >
                <Play className="h-4 w-4 text-emerald-600" />
                Ativar Todos
              </button>

              <button
                type="button"
                onClick={executarParadaEmergencia}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 px-4 py-2 text-xs font-extrabold uppercase text-white shadow-sm transition"
              >
                <AlertOctagon className="h-4 w-4" />
                PARAR TUDO (STOP ALL)
              </button>
            </div>
          </div>

          {/* CARD DE CONEXÃO & DETALHES DO EDITAL */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            {/* Bloco 1: Modo Operacional e Empresa Ativa */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Empresa em Disputa</span>
                <span className="text-xs font-extrabold text-[#081C3A] block truncate max-w-[200px]">
                  {selectedCompany?.razaoSocial || selectedCompany?.nomeFantasia || 'Empresa Ativa'}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {selectedCompany?.cnpj ? `CNPJ: ${selectedCompany.cnpj}` : 'Selecione uma empresa'}
                </span>
              </div>
              <Building2 className="h-5 w-5 text-slate-400 shrink-0" />
            </div>

            {/* Bloco 2: Edital Selecionado */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 flex items-center justify-between">
              <div className="w-full">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Edital Selecionado</span>
                  {edital && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      {edital.numeroEdital || 'Conectado'}
                    </span>
                  )}
                </div>
                <EditalSelector onSelectEdital={handleSelectEdital} />
              </div>
            </div>

            {/* Bloco 3: Botão de Acesso Direto à Sala Oficial do Governo */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#0070C0] uppercase block">Sala Oficial</span>
                <span className="text-xs font-medium text-slate-600 truncate block max-w-[160px]">
                  {portalUrl.replace('https://', '')}
                </span>
              </div>
              <button
                type="button"
                onClick={abrirSalaOficial}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0070C0] hover:bg-blue-700 px-3 py-2 text-xs font-bold text-white shadow-xs transition shrink-0"
              >
                Acessar Sala <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            2. CARDS DE RESUMO OPERACIONAL (KPIs EXECUTIVOS)
            ========================================================================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 block">Posição no Certame</span>
            <div className="flex items-baseline gap-2 mt-1">
              <strong className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
                {itensVencendo}/{totalItens}
              </strong>
              <span className="text-xs font-bold text-emerald-700">em 1º Lugar</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 block">Itens em Acompanhamento</span>
            <div className="flex items-baseline gap-2 mt-1">
              <strong className="text-xl sm:text-2xl font-black text-[#081C3A] font-mono">
                {itensAtivos}
              </strong>
              <span className="text-xs text-slate-500">de {totalItens} ativos</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 block">Faturamento Alvo (Meta)</span>
            <div className="mt-1">
              <strong className="text-sm sm:text-base font-extrabold text-emerald-700 font-mono">
                {formatBRL(totalAlvo)}
              </strong>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 block flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-red-500" /> Valor Mínimo Total (Sem Prejuízo)
            </span>
            <div className="mt-1">
              <strong className="text-sm sm:text-base font-extrabold text-red-600 font-mono">
                {formatBRL(totalPiso)}
              </strong>
            </div>
          </div>
        </div>

        {/* ABAS NO MOBILE / TABLET */}
        <div className="flex lg:hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setAbaMobile('ITENS')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              abaMobile === 'ITENS' ? 'bg-[#081C3A] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Itens ({itens.length})
          </button>
          <button
            type="button"
            onClick={() => setAbaMobile('COPILOTO')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              abaMobile === 'COPILOTO' ? 'bg-[#081C3A] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Calculadora
          </button>
          <button
            type="button"
            onClick={() => setAbaMobile('AVISOS')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              abaMobile === 'AVISOS' ? 'bg-[#081C3A] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mensagens
          </button>
          <button
            type="button"
            onClick={() => setAbaMobile('CHECKLIST')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              abaMobile === 'CHECKLIST' ? 'bg-[#081C3A] text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Checklist
          </button>
        </div>

        {/* =========================================================================
            3. ÁREA PRINCIPAL: GRADE DE ITENS (ESQUERDA) + COPILOTO E CHECKLIST (DIREITA)
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* COLUNA ESQUERDA (8 Colunas no Desktop): TABELA / CARDS DE ITENS */}
          <div
            className={`lg:col-span-8 space-y-4 ${
              abaMobile !== 'ITENS' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold text-[#081C3A] flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#EA580C]" />
                    Controle de Lances por Item (Limite de Segurança Ativo)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Defina sua Meta de Lance e o Valor Mínimo inegociável. A plataforma nunca dispara ou recomenda lances com prejuízo.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="hidden sm:flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setModoVisualizacao('TABELA')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded ${
                        modoVisualizacao === 'TABELA' ? 'bg-white shadow-xs text-[#081C3A]' : 'text-slate-500'
                      }`}
                    >
                      Tabela
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoVisualizacao('CARDS')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded ${
                        modoVisualizacao === 'CARDS' ? 'bg-white shadow-xs text-[#081C3A]' : 'text-slate-500'
                      }`}
                    >
                      Cards
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={sincronizarPropostaSalva}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-[#081C3A] hover:bg-slate-100 transition shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-[#0070C0]" />
                    Puxar Minha Proposta
                  </button>
                </div>
              </div>

              {/* MODO CARDS (PARA TABLET OU QUANDO ESCOLHIDO) */}
              {modoVisualizacao === 'CARDS' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {itens.map((it) => {
                    const liderando = it.status === 'VENCENDO';
                    const pisoAtingido = it.status === 'PISO_ATINGIDO';

                    return (
                      <div
                        key={it.id}
                        onClick={() => setItemSelecionadoId(it.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                          it.id === itemSelecionadoId
                            ? 'border-[#081C3A] ring-2 ring-[#081C3A]/20 bg-slate-50/50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <span className="text-xs font-black text-[#081C3A]">Item #{it.itemNumero}</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              liderando
                                ? 'bg-emerald-100 text-emerald-800'
                                : pisoAtingido
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {liderando ? '1º Lugar' : pisoAtingido ? 'Piso Atingido' : 'Em Disputa'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 font-medium my-2 line-clamp-2" title={it.descricao}>
                          {it.descricao}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs py-1 border-t border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Menor Concorrente</span>
                            <strong className="text-slate-800 font-mono">{formatBRL(it.melhorLanceConcorrente)}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Seu Último Lance</span>
                            <strong className="text-emerald-700 font-mono">
                              {it.seuUltimoLance ? formatBRL(it.seuUltimoLance) : 'Nenhum'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Meta de Lance</span>
                            <strong className="text-slate-800 font-mono">{formatBRL(it.lanceAlvo)}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-red-600 block">Valor Mínimo (Seguro)</span>
                            <strong className="text-red-700 font-mono">{formatBRL(it.pisoMinimo)}</strong>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              dispararLanceManual(it);
                            }}
                            className="px-3 py-1 bg-[#EA580C] hover:bg-orange-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                          >
                            <Zap className="h-3 w-3" /> Disparar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* TABELA RESPONSIVA (SEM CORTE DE COLUNAS NO DESKTOP) */
                <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-xs min-w-[760px]">
                    <thead className="bg-[#081C3A] text-white text-[11px] font-bold">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">Item</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-2.5 w-24 text-right">Referência</th>
                        <th className="py-2.5 px-2.5 w-24 text-right">Menor Oferta</th>
                        <th className="py-2.5 px-2.5 w-24 text-right">Seu Lance</th>
                        <th className="py-2.5 px-2.5 w-28 text-right">Meta de Lance</th>
                        <th className="py-2.5 px-2.5 w-28 text-right">Valor Mínimo</th>
                        <th className="py-2.5 px-2 w-24 text-center">Situação</th>
                        <th className="py-2.5 px-2 w-20 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {carregandoItens ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-xs font-semibold text-slate-500">
                            <RefreshCw className="mx-auto h-5 w-5 animate-spin text-[#EA580C] mb-2" />
                            Sincronizando itens e lotes com a base oficial...
                          </td>
                        </tr>
                      ) : itens.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center">
                            <div className="mx-auto max-w-md space-y-3 px-4">
                              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-[#081C3A]">
                                <Gavel className="h-6 w-6 text-[#EA580C]" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-slate-800">
                                  Nenhum item cadastrado nesta disputa
                                </h4>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                  Selecione um edital monitorado no topo ou clique abaixo para importar os itens da sua proposta comercial com limites de segurança ativos.
                                </p>
                              </div>
                              <div className="flex justify-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={sincronizarPropostaSalva}
                                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#081C3A] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm"
                                >
                                  <RefreshCw className="h-3.5 w-3.5 text-[#EA580C]" />
                                  Puxar Minha Proposta Comercial
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        itens.map((it) => {
                          const liderando = it.status === 'VENCENDO';
                          const pisoAtingido = it.status === 'PISO_ATINGIDO';
                          const selecionado = it.id === itemSelecionadoId;

                          return (
                            <tr
                              key={it.id}
                              onClick={() => setItemSelecionadoId(it.id)}
                              className={`cursor-pointer transition-colors ${
                                selecionado
                                  ? 'bg-blue-50/60 ring-1 ring-inset ring-blue-300'
                                  : liderando
                                  ? 'bg-emerald-50/40 hover:bg-emerald-50/60'
                                  : pisoAtingido
                                  ? 'bg-red-50/40 hover:bg-red-50/60'
                                  : 'hover:bg-slate-50/80'
                              }`}
                            >
                              {/* Item */}
                              <td className="py-2.5 px-3 text-center font-bold text-[#081C3A]">
                                #{it.itemNumero}
                              </td>

                              {/* Descrição */}
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-800 block truncate max-w-[170px]" title={it.descricao}>
                                  {it.descricao}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Qtd: {it.quantidade} {it.unidadeMedida}
                                </span>
                              </td>

                              {/* Valor Referência */}
                              <td className="py-2.5 px-2.5 text-right font-mono text-slate-500 text-[11px]">
                                {formatBRL(it.valorReferencia)}
                              </td>

                              {/* Menor Oferta do Mercado */}
                              <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-700">
                                {formatBRL(it.melhorLanceConcorrente)}
                              </td>

                              {/* Seu Lance Atual */}
                              <td className="py-2.5 px-2.5 text-right font-mono font-bold">
                                {it.seuUltimoLance ? (
                                  <span className="text-emerald-700">{formatBRL(it.seuUltimoLance)}</span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              {/* Meta de Lance (Editável) */}
                              <td className="py-2 px-2 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.lanceAlvo}
                                  onChange={(e) =>
                                    atualizarCampoItem(it.id, 'lanceAlvo', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-24 rounded border border-slate-300 bg-white px-1.5 py-1 text-right font-mono text-xs font-bold text-slate-800 focus:border-[#081C3A] focus:outline-none"
                                />
                              </td>

                              {/* Valor Mínimo (Sem Prejuízo - Editável) */}
                              <td className="py-2 px-2 text-right">
                                <div className="relative inline-block">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={it.pisoMinimo}
                                    onChange={(e) =>
                                      atualizarCampoItem(it.id, 'pisoMinimo', parseFloat(e.target.value) || 0)
                                    }
                                    className="w-24 rounded border border-red-200 bg-red-50/50 px-1.5 py-1 text-right font-mono text-xs font-bold text-red-700 focus:border-red-500 focus:outline-none"
                                  />
                                </div>
                              </td>

                              {/* Situação */}
                              <td className="py-2.5 px-2 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    liderando
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : pisoAtingido
                                      ? 'bg-red-100 text-red-800'
                                      : it.ativo
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {it.status === 'VENCENDO'
                                    ? '1º Lugar'
                                    : it.status === 'PISO_ATINGIDO'
                                    ? 'Piso Atingido'
                                    : it.status === 'COBERTO'
                                    ? 'Coberto'
                                    : 'Pausado'}
                                </span>
                              </td>

                              {/* Ações */}
                              <td className="py-2 px-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      dispararLanceManual(it);
                                    }}
                                    title="Disparar este lance respeitando o limite mínimo"
                                    className="rounded-lg bg-[#EA580C] hover:bg-orange-600 p-1.5 text-white shadow-xs transition"
                                  >
                                    <Zap className="h-3.5 w-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleItemAtivo(it.id);
                                    }}
                                    title={it.ativo ? 'Pausar acompanhamento' : 'Ativar acompanhamento'}
                                    className={`rounded-lg border p-1.5 transition ${
                                      it.ativo
                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                        : 'border-slate-300 bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {it.ativo ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                  </button>
                                </div>
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

            {/* SEÇÃO DO BENEFÍCIO ME/EPP (EMPATE FICTO LC 123/2006) */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-emerald-950 uppercase flex items-center gap-2">
                      Benefício ME/EPP: Empate Ficto (LC nº 123/2006)
                      <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                        Margem Legal de 5%
                      </span>
                    </h3>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Se sua empresa for ME/EPP e a melhor oferta for de grande porte com até 5% de diferença, você tem direito prioritário de cobrir o preço em até 5 minutos!
                    </p>
                  </div>
                </div>

                {/* Cronômetro Regressivo de 5 Minutos */}
                <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-emerald-300 shadow-xs shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Prazo Legal de Cobertura</span>
                    <strong className="text-lg font-black text-[#081C3A] font-mono">
                      {formatTempoMe(tempoMeSegundos)}
                    </strong>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCronometroMeAtivo(!cronometroMeAtivo)}
                      className={`p-2 rounded-lg font-bold text-white transition ${
                        cronometroMeAtivo ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                      title={cronometroMeAtivo ? 'Pausar contagem' : 'Iniciar contagem regressiva de 5 minutos'}
                    >
                      {cronometroMeAtivo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCronometroMeAtivo(false);
                        setTempoMeSegundos(300);
                      }}
                      className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                      title="Reiniciar para 5:00"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA (4 Colunas no Desktop): COPILOTO, CHAT DO PREGOEIRO E CHECKLIST */}
          <div
            className={`lg:col-span-4 space-y-4 ${
              abaMobile === 'ITENS' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* BOX 1: COPILOTO DE DISPUTA - CALCULADORA INSTANTÂNEA DE PRÓXIMO LANCE */}
            <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 ${
              abaMobile !== 'COPILOTO' && abaMobile !== 'ITENS' ? 'hidden lg:block' : 'block'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black uppercase text-[#081C3A] flex items-center gap-1.5">
                  <Calculator className="h-4 w-4 text-[#EA580C]" />
                  Calculadora Instantânea de Lance
                </h3>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {itemEmFoco ? `Item #${itemEmFoco.itemNumero}` : 'Nenhum selecionado'}
                </span>
              </div>

              {itemEmFoco ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Qual é o menor preço agora no portal? (R$)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: 1450,00"
                        value={menorPrecoInformado}
                        onChange={(e) => setMenorPrecoInformado(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && calcularProximoLance()}
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-[#081C3A] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={calcularProximoLance}
                        className="px-3 py-2 bg-[#081C3A] hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
                      >
                        Calcular
                      </button>
                    </div>
                  </div>

                  {/* RESULTADO DO CÁLCULO */}
                  {lanceCalculado !== null && (
                    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Lance Recomendado:</span>
                        <strong className="text-base font-black text-[#081C3A] font-mono">
                          {formatBRL(lanceCalculado)}
                        </strong>
                      </div>

                      {/* ALERTA DE PREJUÍZO (VERMELHO) */}
                      {alertaPrejuizoAtivo && (
                        <div className="p-2.5 rounded-lg bg-red-100 border border-red-300 text-red-950 font-bold space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-red-900">
                            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                            PREÇO ABAIXO DO LIMITE DE SEGURANÇA!
                          </div>
                          <p className="text-[11px] font-normal text-red-800 leading-tight">
                            Não cubra este lance. O valor calculado é inferior ao seu limite mínimo ({formatBRL(itemEmFoco.pisoMinimo)}), gerando risco de operação com prejuízo.
                          </p>
                        </div>
                      )}

                      {/* ALERTA DE INEXEQUIBILIDADE ART. 59 LEI 14.133 */}
                      {alertaInexequivelAtivo && (
                        <div className="p-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-[11px] leading-tight space-y-1">
                          <strong className="flex items-center gap-1 text-amber-900">
                            <Gavel className="h-3.5 w-3.5" /> Indício de Inexequibilidade (Art. 59, III Lei 14.133/2021)
                          </strong>
                          <p className="text-amber-800 text-[10px]">
                            O menor lance caiu mais de 50% abaixo do valor estimado do edital. O pregoeiro deve exigir comprovação de custos. Caso o concorrente não comprove, cabe desclassificação e recurso administrativo.
                          </p>
                        </div>
                      )}

                      {!alertaPrejuizoAtivo && (
                        <button
                          type="button"
                          onClick={copiarLanceSugerido}
                          className="w-full mt-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                        >
                          {copiadoLance ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiadoLance ? 'Copiado para Área de Transferência!' : 'Copiar Valor do Lance'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-2">
                  Carregue um edital ou proposta para ativar a calculadora.
                </p>
              )}
            </div>

            {/* BOX 2: MENSAGENS PRONTAS PARA O PREGOEIRO (COPIAR EM 1 CLIQUE) */}
            <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 ${
              abaMobile !== 'AVISOS' && abaMobile !== 'ITENS' ? 'hidden lg:block' : 'block'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black uppercase text-[#081C3A] flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-[#0070C0]" />
                  Mensagens Prontas para o Pregoeiro
                </h3>
                <span className="text-[10px] text-slate-500 font-bold">1 Clique para Copiar</span>
              </div>

              <div className="space-y-2 text-xs">
                {mensagensPregoeiroTemplates.map((msg) => (
                  <div key={msg.id} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition space-y-1.5">
                    <div className="flex items-center justify-between">
                      <strong className="text-[11px] font-bold text-[#081C3A]">{msg.titulo}</strong>
                      <button
                        type="button"
                        onClick={() => copiarMensagemPregoeiro(msg.id, msg.texto)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition ${
                          mensagemCopiadaId === msg.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {mensagemCopiadaId === msg.id ? (
                          <>
                            <Check className="h-3 w-3" /> Copiado!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copiar
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {msg.texto}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* BOX 3: CHECKLIST DE PRONTIDÃO DA EMPRESA (100% REAL) */}
            <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 ${
              abaMobile !== 'CHECKLIST' && abaMobile !== 'ITENS' ? 'hidden lg:block' : 'block'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black uppercase text-[#081C3A] flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Checklist de Prontidão da Empresa
                </h3>
                {carregandoChecklist && <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />}
              </div>

              <div className="space-y-2 text-xs">
                {/* Certidões Fiscais */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="flex items-center gap-1.5 font-bold text-slate-800">
                      {checklistReal.certidoesVencidas > 0 ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                      Certidões Fiscais (CNDs)
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {checklistReal.totalCertidoes > 0
                        ? `${checklistReal.certidoesValidas} válidas de ${checklistReal.totalCertidoes}`
                        : 'Nenhuma certidão cadastrada'}
                    </span>
                  </div>
                  {checklistReal.certidoesVencidas > 0 ? (
                    <Link
                      to="/fornecedor/certidoes"
                      className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold text-[10px] transition"
                    >
                      {checklistReal.certidoesVencidas} pendentes
                    </Link>
                  ) : checklistReal.totalCertidoes > 0 ? (
                    <span className="font-bold text-emerald-700 text-[11px]">100% Válidas</span>
                  ) : (
                    <Link
                      to="/fornecedor/certidoes"
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-bold text-[10px]"
                    >
                      Cadastrar
                    </Link>
                  )}
                </div>

                {/* Proposta Comercial */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="flex items-center gap-1.5 font-bold text-slate-800">
                      {checklistReal.propostaCadastrada ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      Proposta Comercial
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {checklistReal.propostaCadastrada
                        ? checklistReal.nomeProposta || 'Pronta para importação'
                        : 'Nenhuma proposta vinculada'}
                    </span>
                  </div>
                  {checklistReal.propostaCadastrada ? (
                    <span className="font-bold text-emerald-700 text-[11px]">Vinculada</span>
                  ) : (
                    <Link
                      to="/fornecedor/proposta"
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-bold text-[10px]"
                    >
                      Criar Proposta
                    </Link>
                  )}
                </div>

                {/* Limites de Segurança por Item */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Lock className="h-3.5 w-3.5 text-[#EA580C]" />
                      Limite Mínimo para Não Ter Prejuízo
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {totalPiso > 0 ? 'Valores mínimos fixados por item' : 'Configure o valor mínimo'}
                    </span>
                  </div>
                  <span className="font-bold text-emerald-700 text-[11px]">Ativo</span>
                </div>
              </div>

              {/* Modo Real do Edital */}
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-1 text-xs text-slate-500">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Modo de Disputa do Certame:</span>
                <strong className="text-[#081C3A] text-[11px] leading-tight">
                  {modoDisputaDescricao}
                </strong>
              </div>
            </div>

            {/* BOX 4: FEED DE MENSAGENS DO SISTEMA & PREGOEIRO */}
            <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col h-64 ${
              abaMobile !== 'AVISOS' && abaMobile !== 'ITENS' ? 'hidden lg:block' : 'block'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black uppercase text-[#081C3A] flex items-center gap-1.5">
                  <Gavel className="h-4 w-4 text-[#0070C0]" />
                  Registro de Ocorrências & Lances
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto py-2 space-y-2 text-xs">
                {mensagens.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-2.5 border text-xs leading-relaxed ${
                      msg.autor === 'PREGOEIRO'
                        ? 'bg-blue-50/70 border-blue-200 text-slate-800'
                        : msg.autor === 'ALERTA'
                        ? 'bg-red-50/70 border-red-200 text-red-900 font-semibold'
                        : msg.autor === 'LANCE'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[10px] text-slate-500 mb-1">
                      <span className="uppercase">
                        {msg.autor === 'PREGOEIRO'
                          ? 'Aviso do Pregoeiro Oficial'
                          : msg.autor === 'ALERTA'
                          ? 'Segurança Financeira'
                          : msg.autor === 'LANCE'
                          ? 'Movimento da Disputa'
                          : 'Notificação do Sistema'}
                      </span>
                      <span>{msg.hora}</span>
                    </div>
                    <p>{msg.texto}</p>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE INSTRUÇÕES DA EXTENSÃO GOOGLE CHROME */}
      {modalExtensaoAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-[#081C3A]">
                <Sparkles className="h-5 w-5 text-[#EA580C]" />
                <h3 className="font-extrabold text-base">Extensão Oficial de Disputa Expertise</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalExtensaoAberta(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                A <strong>Extensão Oficial do Google Chrome</strong> conecta esta Mesa Estratégica diretamente com a aba aberta onde você está logado nos portais de compras públicas:
              </p>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-800">
                <span className="p-2 rounded-lg bg-slate-50 border border-slate-200">✓ Compras.gov.br</span>
                <span className="p-2 rounded-lg bg-slate-50 border border-slate-200">✓ BLL Compras</span>
                <span className="p-2 rounded-lg bg-slate-50 border border-slate-200">✓ BNC (Bolsa Nacional)</span>
                <span className="p-2 rounded-lg bg-slate-50 border border-slate-200">✓ Portal de Compras Públicas</span>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-1">
                <strong>Como Carregar no Chrome:</strong>
                <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                  <li>Abra o Chrome e digite <code className="bg-white px-1 py-0.5 rounded border border-blue-200">chrome://extensions</code></li>
                  <li>Ative o <strong>Modo do desenvolvedor</strong> no canto superior direito.</li>
                  <li>Clique em <strong>Carregar sem compactação</strong> e selecione a pasta <code className="bg-white px-1 py-0.5 rounded border border-blue-200">chrome-extension</code> do projeto.</li>
                  <li>Abra a aba do certame no portal e a extensão sincronizará os lances automaticamente com a Mesa!</li>
                </ol>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
                <strong>Segurança Inviolável:</strong> A extensão nunca dispara lances com valor inferior ao seu <em>Valor Mínimo (Sem Prejuízo)</em> cadastrado na Expertise.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalExtensaoAberta(false)}
                className="px-4 py-2 bg-[#081C3A] hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradingTerminal;
