import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ShieldAlert,
  TrendingUp,
  FileSpreadsheet,
  PlugZap,
  Award,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Decimal from 'decimal.js';
import { EditalSelector, EditalOption } from '@/components/EditalSelector';
import { propostasApi, licitacoesApi, certidoesApi, documentosApi } from '@/services/api';
import { buildOfficialPncpPortalUrl } from '@/utils/pncp';
import { useCompany } from '@/contexts/CompanyContext';

export type EstrategiaType = 'LANCE_AUTOMATICO' | 'MODO_ASSISTIDO' | 'MANUAL';
export type StatusItemType = 'VENCENDO' | 'COBERTO' | 'PISO_ATINGIDO' | 'AGUARDANDO';

export interface ItemPlanilhaTerminal {
  id: string;
  itemNumero: number;
  descricao: string;
  quantidade: number;
  unidadeMedida: string;
  valorReferencia: number;
  melhorLanceConcorrente: number;
  seuUltimoLance: number | null;
  lanceAlvo: number;
  pisoMinimo: number;
  estrategia: EstrategiaType;
  decrementoMinimo: number;
  decrementoTipo: 'REAIS' | 'PERCENTUAL';
  lanceAutomatico?: boolean;
  status: StatusItemType;
  ativo: boolean;
  margemEstimadaPct: number;
}

export interface EventoSessao {
  id: string;
  hora: string;
  tipo: 'CONCORRENTE' | 'LANCE_ENVIADO' | 'PROTECAO' | 'ALERTA';
  texto: string;
}

const STORAGE_PISO_KEY = '@Expertise:piso_precificacao';

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

function lerPisoPrecificacaoLocal(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_PISO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const val = Number(parsed?.breakeven);
    return Number.isFinite(val) && val > 0 ? roundDec(val) : null;
  } catch {
    return null;
  }
}

function calcMargem(lanceAlvo: number, pisoMinimo: number): { reais: number; pct: number } {
  const alvo = Number(lanceAlvo) || 0;
  const piso = Number(pisoMinimo) || 0;
  const reais = roundDec(alvo - piso);
  const pct = alvo > 0 ? roundDec(((alvo - piso) / alvo) * 100) : 0;
  return { reais, pct };
}

export const TradingTerminal: React.FC = () => {
  const { selectedCompany } = useCompany();

  // Edital Selecionado e Portal Oficial
  const [edital, setEdital] = useState<EditalOption | null>(null);
  const [portalUrl, setPortalUrl] = useState<string>('https://pncp.gov.br/app/editais');

  // Conexão com o Portal de Compras
  const [conectorExtensaoAtivo, setConectorExtensaoAtivo] = useState<boolean>(false);
  const [nomePortalConectado, setNomePortalConectado] = useState<string>('');
  const [etapaPortal, setEtapaPortal] = useState<string>('');
  const [cronometroPortal, setCronometroPortal] = useState<string>('');
  const [modalExtensaoAberta, setModalExtensaoAberta] = useState<boolean>(false);

  // Áudio de Alertas e Visualização
  const [somHabilitado, setSomHabilitado] = useState<boolean>(true);
  const [modoVisualizacao, setModoVisualizacao] = useState<'TABELA' | 'CARDS'>('TABELA');
  const [abaLateral, setAbaLateral] = useState<'MENSAGENS' | 'ME_EPP' | 'CHECKLIST' | 'HISTORICO'>('MENSAGENS');
  const [historicoSessao, setHistoricoSessao] = useState<EventoSessao[]>([]);

  // Planilha de Itens Reais
  const [itens, setItens] = useState<ItemPlanilhaTerminal[]>([]);
  const [carregandoItens, setCarregandoItens] = useState<boolean>(false);
  const [itemSelecionadoId, setItemSelecionadoId] = useState<string>('');

  // Checklist de Prontidão da Empresa
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

  // Calculadora de Próximo Lance Ótimo
  const [menorPrecoInformado, setMenorPrecoInformado] = useState<string>('');
  const [decrementoInput, setDecrementoInput] = useState<string>('0,01');
  const [decrementoModo, setDecrementoModo] = useState<'REAIS' | 'PERCENTUAL'>('REAIS');
  const [lanceCalculado, setLanceCalculado] = useState<number | null>(null);
  const [folgaCalculada, setFolgaCalculada] = useState<number | null>(null);
  const [alertaPrejuizoAtivo, setAlertaPrejuizoAtivo] = useState<boolean>(false);
  const [alertaMeEppAtivo, setAlertaMeEppAtivo] = useState<boolean>(false);
  const [valorDesempateMeEpp, setValorDesempateMeEpp] = useState<number | null>(null);
  const [alertaInexequivelAtivo, setAlertaInexequivelAtivo] = useState<boolean>(false);
  const [copiadoLance, setCopiadoLance] = useState<boolean>(false);
  const [mensagemCopiadaId, setMensagemCopiadaId] = useState<string | null>(null);

  // Cronômetro Legal ME/EPP (5 Minutos - LC 123/2006)
  const [tempoMeSegundos, setTempoMeSegundos] = useState<number>(300);
  const [cronometroMeAtivo, setCronometroMeAtivo] = useState<boolean>(false);

  const isEmpresaMeEpp = useMemo(() => {
    const porte = String(selectedCompany?.porte || '').toUpperCase();
    return porte === 'MEI' || porte === 'ME' || porte === 'EPP';
  }, [selectedCompany?.porte]);

  const isObraOuEngenharia = useMemo(() => {
    const texto = `${edital?.modalidade || ''} ${edital?.objeto || ''}`.toLowerCase();
    return /obra|engenharia/.test(texto);
  }, [edital]);

  const limiteInexequibilidadePct = isObraOuEngenharia ? 0.75 : 0.5;

  const limiteEmpateMeEppPct = useMemo(() => {
    const mod = String(edital?.modalidade || '').toLowerCase();
    return mod.includes('concorr') ? 10 : 5;
  }, [edital?.modalidade]);

  const registrarEventoSessao = useCallback(
    (tipo: EventoSessao['tipo'], texto: string) => {
      const hora = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setHistoricoSessao((prev) => [
        { id: `${Date.now()}-${Math.random()}`, hora, tipo, texto },
        ...prev.slice(0, 49),
      ]);
    },
    [],
  );

  // Sincroniza regras dos itens com o Conector do Navegador
  useEffect(() => {
    const rules: Record<string, { pisoMinimo: number; decrementoMinimo: number; lanceAutomatico: boolean }> = {};
    itens.forEach((it) => {
      rules[String(it.itemNumero)] = {
        pisoMinimo: it.pisoMinimo,
        decrementoMinimo: it.decrementoMinimo || 0.01,
        lanceAutomatico: Boolean(it.lanceAutomatico && it.pisoMinimo > 0),
      };
    });
    window.postMessage({ source: 'EXPERTISE_WEB_APP', type: 'SYNC_ITEM_RULES', rules }, '*');
  }, [itens]);

  // Comunicação com o Conector do Navegador
  useEffect(() => {
    const handleMensagemExtensao = (event: MessageEvent) => {
      if (event.data?.source !== 'EXPERTISE_CHROME_EXTENSION') return;

      if (event.data?.type === 'HEARTBEAT' || event.data?.type === 'SYNC_PORTAL_STATE') {
        const conectado = Boolean(event.data?.connected);
        setConectorExtensaoAtivo(conectado);
        setNomePortalConectado(conectado ? event.data?.portalName || 'Portal de Compras' : '');
        setEtapaPortal(conectado && event.data?.stage ? String(event.data.stage) : '');
        setCronometroPortal(conectado && event.data?.timer ? String(event.data.timer) : '');

        if (conectado && Array.isArray(event.data?.itens) && event.data.itens.length > 0) {
          setItens((prev) =>
            prev.map((it) => {
              const itemExt = event.data.itens.find((x: any) => Number(x.numero) === it.itemNumero);
              if (!itemExt) return it;
              const novoMelhor = roundDec(Number(itemExt.melhorLance) || it.melhorLanceConcorrente);
              const concorrenteCobriu = novoMelhor > 0 && novoMelhor < it.melhorLanceConcorrente;
              const etapaEncerrada = String(itemExt.etapa || '').toLowerCase() === 'encerrado';

              if (concorrenteCobriu) {
                registrarEventoSessao(
                  'CONCORRENTE',
                  `Concorrente cobriu o Item #${it.itemNumero} para ${formatBRL(novoMelhor)}`,
                );
              }

              let lanceAuto = Boolean(it.lanceAutomatico);
              let novoStatus: StatusItemType =
                novoMelhor <= it.pisoMinimo
                  ? 'PISO_ATINGIDO'
                  : itemExt.posicao === 1
                  ? 'VENCENDO'
                  : 'COBERTO';

              if (lanceAuto && itemExt.posicao !== 1 && !etapaEncerrada && novoMelhor > 0) {
                const dec = Math.max(0.01, it.decrementoMinimo || 0.01);
                const lanceOtimo = roundDec(novoMelhor - dec);
                if (it.pisoMinimo > 0 && lanceOtimo >= it.pisoMinimo) {
                  window.postMessage(
                    {
                      source: 'EXPERTISE_WEB_APP',
                      type: 'AUTHORIZE_AUTO_BID',
                      itemNumero: it.itemNumero,
                      valorLance: lanceOtimo,
                      pisoMinimo: it.pisoMinimo,
                      decrementoMinimo: dec,
                    },
                    '*',
                  );
                } else {
                  lanceAuto = false;
                  novoStatus = 'PISO_ATINGIDO';
                  registrarEventoSessao(
                    'PROTECAO',
                    `Piso mínimo atingido no Item #${it.itemNumero}: disputa pausada para proteger sua margem`,
                  );
                }
              }

              return {
                ...it,
                melhorLanceConcorrente: novoMelhor,
                seuUltimoLance: itemExt.seuLance ? roundDec(Number(itemExt.seuLance)) : it.seuUltimoLance,
                lanceAutomatico: lanceAuto,
                status: novoStatus,
              };
            }),
          );
        }
      } else if (event.data?.type === 'BID_EVENT') {
        const msg = String(event.data?.message || '').trim();
        if (event.data?.eventType === 'BID_SENT') {
          if (msg) registrarEventoSessao('LANCE_ENVIADO', msg);
          toast.success(msg || 'Lance automático enviado no portal.');
        } else if (event.data?.eventType === 'BID_ABORTED' || event.data?.eventType === 'EMERGENCY_STOP') {
          if (msg) registrarEventoSessao('ALERTA', msg);
          toast.error(msg || 'Envio automático interrompido — assuma manualmente.');
          if (event.data?.itemNumero) {
            setItens((prev) =>
              prev.map((it) =>
                it.itemNumero === Number(event.data.itemNumero) ? { ...it, lanceAutomatico: false } : it,
              ),
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
  }, [registrarEventoSessao]);

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
        const propsList: any[] = respProp?.data?.data || (respProp?.data as any)?.items || [];
        const propostaCadastrada = Array.isArray(propsList) && propsList.length > 0;
        const nomeProposta = propostaCadastrada ? propsList[0]?.titulo || propsList[0]?.numeroProposta : undefined;

        setChecklistReal({
          certidoesValidas,
          certidoesVencidas,
          totalCertidoes: certs.length,
          totalDocumentos: docs.length,
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

  const toggleLanceAutomaticoItem = (itemId: string) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const proximo = !it.lanceAutomatico;
        if (proximo && (!it.pisoMinimo || it.pisoMinimo <= 0)) {
          toast.error('Defina um Piso Mínimo maior que zero antes de ativar o Lance Automático.');
          return it;
        }
        registrarEventoSessao(
          proximo ? 'LANCE_ENVIADO' : 'PROTECAO',
          proximo
            ? `Lance Automático ativado no Item #${it.itemNumero} (Piso Mínimo Protegido: ${formatBRL(it.pisoMinimo)})`
            : `Lance Automático pausado no Item #${it.itemNumero}`,
        );
        toast.success(
          proximo
            ? `Lance Automático ativo no Item #${it.itemNumero}.`
            : `Lance Automático desativado no Item #${it.itemNumero}.`,
        );
        return { ...it, lanceAutomatico: proximo };
      }),
    );
  };

  // Edição direta (inline) de Piso Mínimo e Meta de Lucro
  const atualizarCampoItem = (itemId: string, campo: 'pisoMinimo' | 'lanceAlvo', valor: number) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const valSeguro = roundDec(Math.max(0, Number(valor) || 0));
        const atualizado = { ...it, [campo]: valSeguro };
        const margem = calcMargem(atualizado.lanceAlvo, atualizado.pisoMinimo);
        atualizado.margemEstimadaPct = margem.pct;

        if (campo === 'pisoMinimo') {
          if (atualizado.melhorLanceConcorrente > 0 && atualizado.melhorLanceConcorrente <= valSeguro) {
            atualizado.status = 'PISO_ATINGIDO';
            atualizado.ativo = false;
          } else if (atualizado.status === 'PISO_ATINGIDO') {
            atualizado.status = 'COBERTO';
            atualizado.ativo = true;
          }
        }
        return atualizado;
      }),
    );
  };

  // Importar da Precificação (@Expertise:piso_precificacao)
  const importarDaPrecificacao = useCallback(() => {
    const pisoSalvo = lerPisoPrecificacaoLocal();
    if (!pisoSalvo) {
      toast.error('Nenhum piso mínimo salvo na Precificação. Calcule e clique em "Salvar Piso para Disputa" na tela de Precificação.');
      return;
    }

    if (itens.length === 0) {
      const alvo = roundDec(pisoSalvo * 1.15);
      const novoItem: ItemPlanilhaTerminal = {
        id: `precif-${Date.now()}`,
        itemNumero: 1,
        descricao: edital?.objeto || 'Item precificado importado',
        quantidade: 1,
        unidadeMedida: 'UN',
        valorReferencia: roundDec(alvo * 1.05),
        melhorLanceConcorrente: roundDec(alvo * 1.05),
        seuUltimoLance: null,
        lanceAlvo: alvo,
        pisoMinimo: pisoSalvo,
        estrategia: 'MODO_ASSISTIDO',
        decrementoMinimo: 0.01,
        decrementoTipo: 'REAIS',
        status: 'AGUARDANDO',
        ativo: true,
        margemEstimadaPct: calcMargem(alvo, pisoSalvo).pct,
      };
      setItens([novoItem]);
      setItemSelecionadoId(novoItem.id);
      toast.success(`Piso mínimo de ${formatBRL(pisoSalvo)} importado da Precificação.`);
      return;
    }

    const alvoId = itemSelecionadoId || itens[0]?.id;
    setItens((prev) =>
      prev.map((it) => {
        if (prev.length > 1 && it.id !== alvoId) return it;
        const novoAlvo = it.lanceAlvo > pisoSalvo ? it.lanceAlvo : roundDec(pisoSalvo * 1.12);
        return {
          ...it,
          pisoMinimo: pisoSalvo,
          lanceAlvo: novoAlvo,
          margemEstimadaPct: calcMargem(novoAlvo, pisoSalvo).pct,
          status: it.melhorLanceConcorrente <= pisoSalvo ? 'PISO_ATINGIDO' : it.status,
        };
      }),
    );
    toast.success(`Piso mínimo de ${formatBRL(pisoSalvo)} aplicado a partir da Precificação.`);
  }, [edital?.objeto, itemSelecionadoId, itens]);

  // Importar Dados da Proposta Comercial Salva
  const sincronizarPropostaSalva = useCallback(
    async (silencioso = false) => {
      try {
        const res = await propostasApi.listar();
        const list = res?.data?.data || (res?.data as any)?.items || [];
        if (!Array.isArray(list) || list.length === 0) {
          if (!silencioso) {
            toast('Crie ou salve uma proposta comercial para importar os itens automaticamente.');
          }
          return false;
        }

        const prop =
          (edital?.id && list.find((p: any) => p.noticeId === edital.id || p.licitacaoId === edital.id)) || list[0];
        const rawItens = Array.isArray(prop?.items) ? prop.items : [];
        if (rawItens.length === 0) {
          if (!silencioso) {
            toast('A proposta localizada não possui itens detalhados para importação.');
          }
          return false;
        }

        const pisoGlobal = lerPisoPrecificacaoLocal();
        const mapped: ItemPlanilhaTerminal[] = rawItens.map((it: any, idx: number) => {
          const ref = roundDec(Number(it.precoUnitarioProposto || it.valorUnitario || it.custoDireto || 100));
          const custo = roundDec(Number(it.custoDireto || ref * 0.75));
          const piso = roundDec(it.pisoMinimo || (idx === 0 && pisoGlobal ? pisoGlobal : custo * 1.1));
          const lanceAlvo = roundDec(it.precoUnitarioProposto || ref * 0.92);
          const margem = calcMargem(lanceAlvo, piso);

          return {
            id: String(it.id || `prop-item-${idx + 1}`),
            itemNumero: Number(it.numero || idx + 1),
            descricao: String(it.descricao || `Item ${idx + 1}`),
            quantidade: Number(it.quantidade || 1),
            unidadeMedida: String(it.unidadeMedida || 'UN'),
            valorReferencia: ref,
            melhorLanceConcorrente: ref,
            seuUltimoLance: null,
            lanceAlvo,
            pisoMinimo: piso,
            estrategia: 'MODO_ASSISTIDO',
            decrementoMinimo: 0.01,
            decrementoTipo: 'REAIS',
            status: 'AGUARDANDO',
            ativo: true,
            margemEstimadaPct: margem.pct,
          };
        });

        setItens(mapped);
        if (mapped.length > 0) setItemSelecionadoId(mapped[0].id);
        if (!silencioso) {
          toast.success(`${mapped.length} item(ns) importado(s) da proposta "${prop.titulo || 'Ativa'}".`);
        }
        return true;
      } catch {
        if (!silencioso) {
          toast.error('Não foi possível importar os itens da proposta.');
        }
        return false;
      }
    },
    [edital?.id],
  );

  // Seleção de Edital com carga automática de itens reais e integração com Precificação/Proposta
  const handleSelectEdital = async (e: EditalOption) => {
    setEdital(e);
    const url = buildOfficialPncpPortalUrl(e);
    if (url) setPortalUrl(url);
    setCarregandoItens(true);

    const pisoSalvo = lerPisoPrecificacaoLocal();

    try {
      const [respItens, respProps] = await Promise.all([
        licitacoesApi.obterItens(e.id).catch(() => null),
        propostasApi.listar().catch(() => null),
      ]);

      const rawItensApi = respItens?.data?.data || respItens?.data?.items || respItens?.data || [];
      const rawItens =
        Array.isArray(rawItensApi) && rawItensApi.length > 0
          ? rawItensApi
          : Array.isArray(e.itens)
          ? e.itens
          : [];

      const propsList: any[] = respProps?.data?.data || (respProps?.data as any)?.items || [];
      const propVinculada = propsList.find((p: any) => p.noticeId === e.id || p.licitacaoId === e.id);
      const itensProposta: any[] = Array.isArray(propVinculada?.items) ? propVinculada.items : [];

      if (rawItens.length > 0) {
        const mapped: ItemPlanilhaTerminal[] = rawItens.map((it: any, idx: number) => {
          const itemNum = Number(it.numeroItem || it.numero || idx + 1);
          const propCorrespondente = itensProposta.find((pi: any) => Number(pi.numero) === itemNum);
          const ref = roundDec(
            Number(it.valorUnitarioEstimado || it.valorReferencia || it.valorEstimado || propCorrespondente?.precoUnitarioProposto || 0),
          );
          const piso = roundDec(
            propCorrespondente?.custoDireto
              ? Number(propCorrespondente.custoDireto) * 1.1
              : idx === 0 && pisoSalvo
              ? pisoSalvo
              : ref * 0.78,
          );
          const alvo = roundDec(
            propCorrespondente?.precoUnitarioProposto
              ? Number(propCorrespondente.precoUnitarioProposto)
              : ref > 0
              ? ref * 0.92
              : piso * 1.15,
          );

          return {
            id: String(it.id || `item-${e.id}-${idx + 1}`),
            itemNumero: itemNum,
            descricao: String(it.descricao || it.descricaoItem || `Item ${idx + 1}`),
            quantidade: Number(it.quantidade || 1),
            unidadeMedida: String(it.unidadeMedida || 'UN'),
            valorReferencia: ref || alvo,
            melhorLanceConcorrente: ref || alvo,
            seuUltimoLance: null,
            lanceAlvo: alvo,
            pisoMinimo: piso,
            estrategia: 'MODO_ASSISTIDO',
            decrementoMinimo: 0.01,
            decrementoTipo: 'REAIS',
            status: 'AGUARDANDO',
            ativo: true,
            margemEstimadaPct: calcMargem(alvo, piso).pct,
          };
        });

        setItens(mapped);
        setItemSelecionadoId(mapped[0].id);
        toast.success(`${mapped.length} item(ns) reais carregados para a disputa.`);
      } else {
        const refGlobal = roundDec(Number(e.valorEstimado || (pisoSalvo ? pisoSalvo * 1.25 : 0)));
        const piso = roundDec(pisoSalvo || refGlobal * 0.78);
        const alvo = roundDec(refGlobal > 0 ? refGlobal * 0.92 : piso * 1.15);
        const itemUnico: ItemPlanilhaTerminal = {
          id: `item-${e.id}-1`,
          itemNumero: 1,
          descricao: String(e.objeto || 'Lote Único da Disputa'),
          quantidade: 1,
          unidadeMedida: 'Global',
          valorReferencia: refGlobal || alvo,
          melhorLanceConcorrente: refGlobal || alvo,
          seuUltimoLance: null,
          lanceAlvo: alvo,
          pisoMinimo: piso,
          estrategia: 'MODO_ASSISTIDO',
          decrementoMinimo: 0.01,
          decrementoTipo: 'REAIS',
          status: 'AGUARDANDO',
          ativo: true,
          margemEstimadaPct: calcMargem(alvo, piso).pct,
        };
        setItens([itemUnico]);
        setItemSelecionadoId(itemUnico.id);
        toast.success('Edital carregado na Sala de Disputa.');
      }
    } catch {
      toast.error('Não foi possível carregar os itens do edital.');
    } finally {
      setCarregandoItens(false);
    }
  };

  const abrirSalaOficial = () => {
    window.open(portalUrl, '_blank', 'noopener,noreferrer');
  };

  const itemEmFoco = useMemo(() => {
    return itens.find((x) => x.id === itemSelecionadoId) || itens[0] || null;
  }, [itens, itemSelecionadoId]);

  // Cálculo de Próximo Lance Ótimo + Trava de Piso + ME/EPP + Inexequibilidade
  const calcularProximoLance = () => {
    if (!itemEmFoco) {
      toast.error('Selecione um item da disputa primeiro.');
      return;
    }

    const valorDigitado = parseFloat(menorPrecoInformado.replace(/\./g, '').replace(',', '.'));
    if (isNaN(valorDigitado) || valorDigitado <= 0) {
      toast.error('Informe o menor valor atual exibido no portal.');
      return;
    }

    const decRaw = parseFloat(decrementoInput.replace(/\./g, '').replace(',', '.'));
    const decBase = !isNaN(decRaw) && decRaw > 0 ? decRaw : 0.01;
    const decrementoEfetivo =
      decrementoModo === 'PERCENTUAL' ? roundDec(valorDigitado * (decBase / 100)) : roundDec(decBase);

    const sugerido = roundDec(Math.max(0.01, valorDigitado - Math.max(0.01, decrementoEfetivo)));

    // Atualiza melhor oferta do item na tabela para refletir o status real
    const difPctMeEpp = valorDigitado > 0 ? ((itemEmFoco.lanceAlvo - valorDigitado) / valorDigitado) * 100 : 0;
    const direitoMeEpp = isEmpresaMeEpp && difPctMeEpp > 0 && difPctMeEpp <= limiteEmpateMeEppPct;
    const emPrejuizo = sugerido < itemEmFoco.pisoMinimo;
    const inexequivel = itemEmFoco.valorReferencia > 0 && valorDigitado < itemEmFoco.valorReferencia * limiteInexequibilidadePct;

    setItens((prev) =>
      prev.map((it) =>
        it.id === itemEmFoco.id
          ? {
              ...it,
              melhorLanceConcorrente: roundDec(valorDigitado),
              status: emPrejuizo ? 'PISO_ATINGIDO' : 'COBERTO',
            }
          : it,
      ),
    );

    setLanceCalculado(sugerido);
    setCopiadoLance(false);
    setAlertaPrejuizoAtivo(emPrejuizo);
    setFolgaCalculada(emPrejuizo ? 0 : roundDec(sugerido - itemEmFoco.pisoMinimo));
    setAlertaMeEppAtivo(direitoMeEpp);
    setValorDesempateMeEpp(direitoMeEpp ? sugerido : null);
    setAlertaInexequivelAtivo(inexequivel);
  };

  const copiarLanceSugerido = () => {
    if (!lanceCalculado || alertaPrejuizoAtivo) {
      toast.error('Limite de proteção atingido — não cubra ofertas abaixo do Piso Mínimo.');
      return;
    }
    navigator.clipboard.writeText(lanceCalculado.toFixed(2).replace('.', ','));
    setCopiadoLance(true);
    toast.success(`Valor de ${formatBRL(lanceCalculado)} copiado! Cole no portal oficial.`);
    setTimeout(() => setCopiadoLance(false), 3000);
  };

  const copiarPedidoDiligenciaInexequivel = (it: ItemPlanilhaTerminal) => {
    const limiarTexto = isObraOuEngenharia ? '75% (obras e serviços de engenharia)' : '50% (bens e serviços comuns)';
    const texto = `Prezado(a) Pregoeiro(a), referente ao Item #${it.itemNumero} (${it.descricao}), cujo valor estimado é ${formatBRL(
      it.valorReferencia,
    )}, a oferta registrada de ${formatBRL(
      it.melhorLanceConcorrente,
    )} encontra-se abaixo do patamar objetivo de ${limiarTexto} previsto no Art. 59, § 4º da Lei nº 14.133/2021. Requeremos respeitosamente a abertura de diligência para comprovação formal de exequibilidade por meio de planilha de composição de custos e notas fiscais, sob pena de desclassificação nos termos do Art. 59, incisos III e IV da referida Lei.`;
    navigator.clipboard.writeText(texto);
    toast.success(`Pedido de diligência do Item #${it.itemNumero} copiado!`);
  };

  const copiarMensagemPregoeiro = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setMensagemCopiadaId(id);
    toast.success('Mensagem copiada! Cole no chat do pregoeiro no portal.');
    setTimeout(() => setMensagemCopiadaId(null), 3500);
  };

  // Indicadores Reais dos 4 Cards
  const totalAlvo = useMemo(() => itens.reduce((acc, it) => acc + it.quantidade * it.lanceAlvo, 0), [itens]);
  const totalPiso = useMemo(() => itens.reduce((acc, it) => acc + it.quantidade * it.pisoMinimo, 0), [itens]);

  const situacaoAtual = useMemo(() => {
    if (itens.length === 0) {
      return { label: 'Aguardando Início', tone: 'neutral' as const };
    }
    const temEmpateMeEpp =
      isEmpresaMeEpp &&
      itens.some((it) => {
        if (it.status === 'VENCENDO' || it.melhorLanceConcorrente <= 0) return false;
        const dif = ((it.lanceAlvo - it.melhorLanceConcorrente) / it.melhorLanceConcorrente) * 100;
        return dif > 0 && dif <= limiteEmpateMeEppPct;
      });
    if (temEmpateMeEpp) {
      return { label: 'Direito de Empate ME-EPP', tone: 'amber' as const };
    }
    const todosVencendo = itens.every((it) => it.status === 'VENCENDO');
    if (todosVencendo) {
      return { label: 'Vencendo', tone: 'emerald' as const };
    }
    if (itens.some((it) => it.status === 'COBERTO' || it.status === 'PISO_ATINGIDO')) {
      return { label: 'Coberto', tone: 'rose' as const };
    }
    return { label: 'Aguardando Início', tone: 'neutral' as const };
  }, [isEmpresaMeEpp, itens, limiteEmpateMeEppPct]);

  // Modelos formais para copiar em 1 clique
  const mensagensPregoeiroTemplates = [
    {
      id: 'msg-diligencia',
      titulo: '1. Pedido de diligência de exequibilidade (Art. 59, § 4º)',
      quandoUsar: 'Use quando o concorrente ofertar valor abaixo de 50% (bens/serviços) ou 75% (obras) do estimado.',
      texto: `Prezado(a) Pregoeiro(a), com fundamento no Art. 59, incisos III e IV e § 4º da Lei nº 14.133/2021, requeremos a realização de diligência junto à licitante provisoriamente classificada em 1º lugar para que comprove, mediante planilha analítica de custos e documentos fiscais, a plena exequibilidade de sua proposta.`,
    },
    {
      id: 'msg-proposta-readequada',
      titulo: '2. Confirmação de proposta readequada (prazo de 2h)',
      quandoUsar: 'Use após vencer a disputa para confirmar e solicitar o prazo de envio da proposta final ajustada.',
      texto: `Prezado(a) Pregoeiro(a), confirmamos nosso lance vencedor com plena exequibilidade e solicitamos a abertura do prazo regulamentar de 2 (duas) horas para envio da proposta comercial readequada ao valor final arrematado e respectiva planilha de custos.`,
    },
    {
      id: 'msg-recurso',
      titulo: '3. Manifestação imediata de intenção de recurso (Art. 165)',
      quandoUsar: 'Use imediatamente após a declaração do vencedor caso haja irregularidade técnica ou preço inexequível.',
      texto: `Prezado(a) Pregoeiro(a), nos termos do Art. 165, inciso I e § 1º da Lei nº 14.133/2021, manifestamos expressamente nossa intenção de recorrer contra a aceitação da proposta e/ou habilitação da licitante vencedora, pelos motivos que serão formalizados nas razões recursais dentro do prazo legal.`,
    },
    {
      id: 'msg-meepp',
      titulo: '4. Direito de preferência / Empate Ficto ME/EPP (LC 123/2006)',
      quandoUsar: 'Use quando sua empresa for ME/EPP e a diferença para o 1º colocado estiver dentro da margem legal.',
      texto: `Prezado(a) Pregoeiro(a), na qualidade de Microempresa/EPP qualificada no certame, requeremos o exercício do direito de preferência e desempate ficto previsto nos Arts. 44 e 45 da Lei Complementar nº 123/2006 para apresentação de nova proposta inferior ao melhor lance no prazo legal de 5 minutos.`,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 font-sans">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-6 py-4 space-y-4">
        {/* 1. CABEÇALHO ENXUTO E BARRA DE COMANDO */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex items-center gap-3 shrink-0">
              <span className="p-2.5 bg-[#081C3A] text-[#F97316] rounded-xl shadow-xs">
                <Gavel size={20} />
              </span>
              <div>
                <h1 className="text-lg sm:text-xl font-black text-[#081C3A] leading-tight">
                  Sala de Disputa & Lances
                </h1>
                <p className="text-xs text-slate-500">
                  Controle estratégico de lances, Piso Mínimo (Proteção de Lucro) e conformidade na Lei 14.133/2021.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={importarDaPrecificacao}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#081C3A] hover:bg-slate-50 transition"
              >
                <TrendingUp className="h-3.5 w-3.5 text-[#F97316]" />
                Importar da Precificação
              </button>

              <button
                type="button"
                onClick={() => sincronizarPropostaSalva(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#081C3A] hover:bg-slate-50 transition"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#0070C0]" />
                Importar Proposta
              </button>

              <button
                type="button"
                onClick={abrirSalaOficial}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#081C3A] px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
              >
                Abrir Portal Oficial
                <ExternalLink className="h-3.5 w-3.5 text-[#F97316]" />
              </button>

              {conectorExtensaoAtivo ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 border border-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                  Portal Conectado
                  {nomePortalConectado ? ` · ${nomePortalConectado}` : ''}
                  {etapaPortal ? ` (${etapaPortal}${cronometroPortal ? ` · ${cronometroPortal}` : ''})` : ''}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalExtensaoAberta(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
                >
                  <PlugZap className="h-3.5 w-3.5 text-slate-600" />
                  Conectar ao Portal
                </button>
              )}

              <button
                type="button"
                onClick={() => setSomHabilitado(!somHabilitado)}
                title={somHabilitado ? 'Som de alertas ativado' : 'Som silenciado'}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
              >
                {somHabilitado ? <Volume2 className="h-4 w-4 text-emerald-700" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <EditalSelector
              label="Edital da Disputa"
              placeholder="Selecione o edital da disputa"
              onSelectEdital={handleSelectEdital}
            />
          </div>
        </div>

        {/* 2. 4 CARDS COMPACTOS DE RESUMO REAL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Itens na Sessão</span>
            <strong className="mt-1.5 text-2xl font-black text-[#081C3A] block">{itens.length}</strong>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {edital ? `${edital.numeroEdital} · ${edital.orgao}` : 'Selecione um edital acima'}
            </span>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
            <span className="text-[11px] font-bold text-emerald-800 uppercase block">Meta de Faturamento</span>
            <strong className="mt-1.5 text-2xl font-black text-emerald-800 font-mono tracking-tight block">
              {formatBRL(totalAlvo)}
            </strong>
            <span className="text-[11px] text-emerald-700 mt-1 block">
              Soma real das metas de lucro configuradas
            </span>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm">
            <span className="text-[11px] font-bold text-rose-800 uppercase flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-rose-600" /> Piso Mínimo Protegido
            </span>
            <strong className="mt-1.5 text-2xl font-black text-rose-700 font-mono tracking-tight block">
              {formatBRL(totalPiso)}
            </strong>
            <span className="text-[11px] text-rose-800 mt-1 block">
              Limite mínimo sem prejuízo (trava ativa)
            </span>
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-sm ${
              situacaoAtual.tone === 'emerald'
                ? 'border-emerald-300 bg-emerald-50/70'
                : situacaoAtual.tone === 'amber'
                ? 'border-amber-300 bg-amber-50/70'
                : situacaoAtual.tone === 'rose'
                ? 'border-rose-300 bg-rose-50/70'
                : 'border-slate-200 bg-white'
            }`}
          >
            <span className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1">
              <Award className="h-3.5 w-3.5 text-[#F97316]" /> Situação Atual
            </span>
            <strong className="mt-1.5 text-xl font-black text-[#081C3A] block">
              {situacaoAtual.label}
            </strong>
            <span className="text-[11px] text-slate-600 mt-1 block">
              {isEmpresaMeEpp ? `Porte ${selectedCompany?.porte} · Regra LC 123/2006 ativa` : 'Modo Assistido em sessão'}
            </span>
          </div>
        </div>

        {/* 3. ÁREA PRINCIPAL: PLANILHA DE ITENS (ESQUERDA) + CALCULADORA & APOIO (DIREITA) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* COLUNA ESQUERDA (8 Colunas): CONTROLE DE LANCES POR ITEM */}
          <div className="xl:col-span-8 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black text-[#081C3A]">Itens da Sessão & Proteção de Margem</h2>
                  <p className="text-xs text-slate-500">
                    Edite a Meta de Lucro e o Piso Mínimo diretamente na tabela para recalcular sua margem na hora.
                  </p>
                </div>

                <div className="flex items-center gap-2">
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
                </div>
              </div>

              {modoVisualizacao === 'CARDS' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {itens.map((it) => {
                    const margem = calcMargem(it.lanceAlvo, it.pisoMinimo);
                    const inexequivelItem =
                      it.valorReferencia > 0 && it.melhorLanceConcorrente < it.valorReferencia * limiteInexequibilidadePct;
                    return (
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
                        <p className="text-xs text-slate-800 font-medium my-1.5 line-clamp-2">{it.descricao}</p>
                        <div className="grid grid-cols-3 gap-2 text-xs pt-1.5 border-t border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Menor Oferta</span>
                            <strong className="text-slate-800 font-mono text-xs">{formatBRL(it.melhorLanceConcorrente)}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-rose-600 block">Piso Mínimo</span>
                            <strong className="text-rose-700 font-mono text-xs">{formatBRL(it.pisoMinimo)}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-emerald-700 block">Margem</span>
                            <strong className="text-emerald-700 font-mono text-xs">{margem.pct.toFixed(1)}%</strong>
                          </div>
                        </div>
                        {inexequivelItem && (
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              copiarPedidoDiligenciaInexequivel(it);
                            }}
                            className="mt-2 w-full inline-flex items-center justify-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-200"
                          >
                            <AlertTriangle className="h-3 w-3" /> Inexequível — Copiar Diligência
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                    <thead className="bg-[#081C3A] text-white text-[11px] font-bold">
                      <tr>
                        <th className="py-2.5 px-3 w-14 text-center">Item</th>
                        <th className="py-2.5 px-3">Descrição e Referência</th>
                        <th className="py-2.5 px-3 w-32 text-right">Menor Oferta</th>
                        <th className="py-2.5 px-3 w-36 text-right">Meta de Lucro (R$)</th>
                        <th className="py-2.5 px-3 w-36 text-right">Piso Mínimo (R$)</th>
                        <th className="py-2.5 px-3 w-32 text-right">Margem Projetada</th>
                        <th className="py-2.5 px-3 w-32 text-center">Lance Automático</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {carregandoItens ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-xs font-semibold text-slate-500">
                            <RefreshCw className="mx-auto h-5 w-5 animate-spin text-[#F97316] mb-2" />
                            Carregando itens oficiais do edital...
                          </td>
                        </tr>
                      ) : itens.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-xs text-slate-500">
                            Selecione um edital acima ou clique em &quot;Importar da Precificação&quot; / &quot;Importar Proposta&quot;.
                          </td>
                        </tr>
                      ) : (
                        itens.map((it) => {
                          const selecionado = it.id === itemSelecionadoId;
                          const pisoAtingido = it.melhorLanceConcorrente > 0 && it.melhorLanceConcorrente <= it.pisoMinimo;
                          const margem = calcMargem(it.lanceAlvo, it.pisoMinimo);
                          const inexequivelItem =
                            it.valorReferencia > 0 &&
                            it.melhorLanceConcorrente < it.valorReferencia * limiteInexequibilidadePct;

                          return (
                            <tr
                              key={it.id}
                              onClick={() => setItemSelecionadoId(it.id)}
                              className={`cursor-pointer transition-colors ${
                                selecionado
                                  ? 'bg-blue-50/70 ring-1 ring-inset ring-blue-300'
                                  : pisoAtingido
                                  ? 'bg-rose-50/40 hover:bg-rose-50/60'
                                  : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center font-black text-[#081C3A]">#{it.itemNumero}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-800 block line-clamp-2" title={it.descricao}>
                                  {it.descricao}
                                </span>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                  <span>
                                    Estimado: {formatBRL(it.valorReferencia)} · Qtd: {it.quantidade} {it.unidadeMedida}
                                  </span>
                                  {inexequivelItem && (
                                    <button
                                      type="button"
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        copiarPedidoDiligenciaInexequivel(it);
                                      }}
                                      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 hover:bg-amber-200"
                                    >
                                      <AlertTriangle className="h-3 w-3" /> Inexequível (Art. 59 §4º) · Copiar Diligência
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                                {formatBRL(it.melhorLanceConcorrente)}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.lanceAlvo}
                                  onChange={(e) =>
                                    atualizarCampoItem(it.id, 'lanceAlvo', parseFloat(e.target.value) || 0)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-right font-mono text-xs font-bold text-slate-900 focus:border-[#081C3A] focus:outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.pisoMinimo}
                                  onChange={(e) =>
                                    atualizarCampoItem(it.id, 'pisoMinimo', parseFloat(e.target.value) || 0)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full rounded-lg border border-rose-200 bg-rose-50/60 px-2 py-1 text-right font-mono text-xs font-bold text-rose-700 focus:border-rose-500 focus:outline-none"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                <strong className={`block text-xs ${margem.reais >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {formatBRL(margem.reais)}
                                </strong>
                                <span className={`text-[10px] font-bold ${margem.pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {margem.pct.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    toggleLanceAutomaticoItem(it.id);
                                  }}
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black transition ${
                                    it.lanceAutomatico
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  {it.lanceAutomatico ? 'ON' : 'OFF'}
                                </button>
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

          {/* COLUNA DIREITA (4 Colunas): CALCULADORA ÓTIMA + MENSAGENS + ME/EPP + CHECKLIST */}
          <div className="xl:col-span-4 space-y-3">
            {/* BOX 1: CALCULADORA DE PRÓXIMO LANCE ÓTIMO */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5 text-[#081C3A]">
                  <Calculator className="h-4 w-4 text-[#F97316]" />
                  <h3 className="text-xs font-black uppercase">Cálculo de Próximo Lance Ótimo</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  {itemEmFoco ? `Item #${itemEmFoco.itemNumero}` : 'Sem item'}
                </span>
              </div>

              {itemEmFoco ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Menor valor atual no portal de compras
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
                        className="px-3.5 py-2 bg-[#081C3A] hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shrink-0"
                      >
                        Calcular Lance
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-600 shrink-0">Decremento mínimo:</span>
                    <input
                      type="text"
                      value={decrementoInput}
                      onChange={(e) => setDecrementoInput(e.target.value)}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs font-mono font-bold text-slate-900 text-right"
                    />
                    <select
                      value={decrementoModo}
                      onChange={(e) => setDecrementoModo(e.target.value as 'REAIS' | 'PERCENTUAL')}
                      className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700"
                    >
                      <option value="REAIS">R$</option>
                      <option value="PERCENTUAL">%</option>
                    </select>
                  </div>

                  {lanceCalculado !== null && (
                    <div className="space-y-2 pt-1">
                      {!alertaPrejuizoAtivo ? (
                        <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-300 text-slate-900 space-y-2">
                          <div>
                            <strong className="text-xs font-black block text-emerald-900">
                              Lance ótimo calculado — margem preservada
                            </strong>
                            <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                              Lance sugerido: <strong>{formatBRL(lanceCalculado)}</strong>.
                              {folgaCalculada !== null && folgaCalculada > 0 && (
                                <>
                                  {' '}
                                  Folga de <strong>{formatBRL(folgaCalculada)}</strong> acima do seu Piso Mínimo.
                                </>
                              )}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={copiarLanceSugerido}
                            className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                          >
                            {copiadoLance ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiadoLance ? 'Valor copiado!' : 'Copiar lance ótimo'}
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 space-y-1.5">
                          <div className="flex items-start gap-2">
                            <ShieldAlert className="h-4 w-4 text-rose-700 shrink-0 mt-0.5" />
                            <div>
                              <strong className="text-xs font-black block text-rose-900">
                                Limite de proteção atingido — não cobrir para evitar prejuízo
                              </strong>
                              <p className="text-xs text-rose-800 mt-0.5 leading-relaxed">
                                O valor necessário ({formatBRL(lanceCalculado)}) ficaria abaixo do seu Piso Mínimo (
                                {formatBRL(itemEmFoco.pisoMinimo)}). Envio bloqueado para proteger seu lucro.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {alertaMeEppAtivo && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 space-y-1.5">
                          <strong className="text-xs font-black block text-amber-900">
                            Empate Ficto ME/EPP detectado (LC 123/2006)
                          </strong>
                          <p className="text-xs text-amber-800 leading-relaxed">
                            Diferença dentro do limite legal de {limiteEmpateMeEppPct}%. Valor exato para desempate:{' '}
                            <strong>{formatBRL(valorDesempateMeEpp || lanceCalculado)}</strong>.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setAbaLateral('ME_EPP');
                              setCronometroMeAtivo(true);
                            }}
                            className="text-xs font-bold text-amber-900 underline"
                          >
                            Abrir cronômetro oficial de 5 minutos
                          </button>
                        </div>
                      )}

                      {alertaInexequivelAtivo && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-amber-300 text-slate-800 text-xs space-y-2">
                          <p className="leading-relaxed">
                            <strong>Lance Inexequível do Concorrente (Art. 59, § 4º):</strong> A oferta caiu abaixo de{' '}
                            {isObraOuEngenharia ? '75%' : '50%'} do valor estimado ({formatBRL(itemEmFoco.valorReferencia)}).
                          </p>
                          <button
                            type="button"
                            onClick={() => copiarPedidoDiligenciaInexequivel(itemEmFoco)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#081C3A] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800"
                          >
                            <Copy className="h-3 w-3 text-[#F97316]" />
                            Copiar pedido formal de diligência ao pregoeiro
                          </button>
                        </div>
                      )}

                      <p className="text-[11px] text-slate-500 pt-1 flex items-center gap-1">
                        <Info className="h-3.5 w-3.5 text-[#0070C0] shrink-0" />
                        Modo Assistido: valide o valor acima e registre no portal oficial.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-3 text-center">
                  Selecione um edital e um item na tabela ao lado para calcular o próximo lance.
                </p>
              )}
            </div>

            {/* BOX 2: ABAS DE APOIO */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 text-xs">
                <button
                  type="button"
                  onClick={() => setAbaLateral('MENSAGENS')}
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
                  Empate ME/EPP
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
                <button
                  type="button"
                  onClick={() => setAbaLateral('HISTORICO')}
                  className={`flex-1 py-1.5 font-bold rounded-lg transition ${
                    abaLateral === 'HISTORICO' ? 'bg-[#081C3A] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Histórico
                </button>
              </div>

              {abaLateral === 'MENSAGENS' && (
                <div className="space-y-2 text-xs">
                  {mensagensPregoeiroTemplates.map((msg) => (
                    <div key={msg.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <strong className="text-xs font-black text-[#081C3A] block">{msg.titulo}</strong>
                          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">{msg.quandoUsar}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copiarMensagemPregoeiro(msg.id, msg.texto)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                            mensagemCopiadaId === msg.id
                              ? 'bg-emerald-800 text-white'
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

              {abaLateral === 'ME_EPP' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2">
                    <strong className="text-xs font-black text-amber-900 block">
                      Empate Ficto ME/EPP (LC nº 123/2006)
                    </strong>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Para MEI, ME ou EPP, quando a melhor oferta estiver até {limiteEmpateMeEppPct}% acima da sua meta/referência, você tem 5 minutos oficiais para cobrir o lance.
                    </p>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-amber-300">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-bold">Cronômetro Oficial</span>
                        <strong className="text-lg font-black font-mono text-[#081C3A]">
                          {formatTempoMe(tempoMeSegundos)}
                        </strong>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setCronometroMeAtivo(!cronometroMeAtivo)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition ${
                            cronometroMeAtivo ? 'bg-amber-600' : 'bg-emerald-800'
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

              {abaLateral === 'CHECKLIST' && (
                <div className="space-y-2 text-xs">
                  {carregandoChecklist && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 py-1">
                      <RefreshCw className="h-3 w-3 animate-spin text-[#0070C0]" />
                      Verificando certidões e documentos da empresa ativa...
                    </div>
                  )}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <strong className="text-xs text-slate-800 block">Certidões Fiscais (CNDs)</strong>
                      <span className="text-[10px] text-slate-500">
                        {checklistReal.totalCertidoes > 0
                          ? `${checklistReal.certidoesValidas} válidas de ${checklistReal.totalCertidoes}`
                          : 'Nenhuma certidão cadastrada'}
                      </span>
                    </div>
                    {checklistReal.certidoesVencidas > 0 ? (
                      <Link
                        to="/fornecedor/certidoes"
                        className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[10px]"
                      >
                        {checklistReal.certidoesVencidas} pendente(s)
                      </Link>
                    ) : (
                      <span className="font-bold text-emerald-700 text-[11px]">Em dia</span>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <strong className="text-xs text-slate-800 block">Documentos no Cofre</strong>
                      <span className="text-[10px] text-slate-500">
                        {checklistReal.totalDocumentos} arquivo(s) de habilitação pronto(s)
                      </span>
                    </div>
                    <Link to="/fornecedor/cofre" className="font-bold text-[#0070C0] text-[11px] hover:underline">
                      Ver Cofre
                    </Link>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <strong className="text-xs text-slate-800 block">Proposta Comercial</strong>
                      <span className="text-[10px] text-slate-500">
                        {checklistReal.propostaCadastrada
                          ? checklistReal.nomeProposta || 'Pronta para importação'
                          : 'Nenhuma proposta vinculada'}
                      </span>
                    </div>
                    <span className={`font-bold text-[11px] ${checklistReal.propostaCadastrada ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {checklistReal.propostaCadastrada ? 'Vinculada' : 'Pendente'}
                    </span>
                  </div>
                </div>
              )}

              {abaLateral === 'HISTORICO' && (
                <div className="space-y-2 text-xs max-h-72 overflow-y-auto">
                  {historicoSessao.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-4 text-center">
                      Nenhum evento registrado ainda. Conecte ao portal oficial ou ative o acompanhamento dos itens.
                    </p>
                  ) : (
                    historicoSessao.map((ev) => (
                      <div
                        key={ev.id}
                        className={`p-2.5 rounded-xl border text-[11px] ${
                          ev.tipo === 'PROTECAO' || ev.tipo === 'ALERTA'
                            ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                            : ev.tipo === 'LANCE_ENVIADO'
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <span className="font-mono text-[10px] text-slate-500 block">{ev.hora}</span>
                        <span className="font-semibold">{ev.texto}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE CONEXÃO COM O PORTAL DE COMPRAS */}
      {modalExtensaoAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-[#081C3A]">Conexão com o Portal de Compras</h3>
              <button
                type="button"
                onClick={() => setModalExtensaoAberta(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Com o conector oficial instalado no navegador Chrome, esta sala acompanha os melhores lances diretamente da sessão pública no portal do governo e habilita o Lance Automático dentro do seu Piso Mínimo.
            </p>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 space-y-1 text-[11px]">
              <strong>Como ativar no navegador:</strong>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>
                  Acesse <code className="bg-white px-1 rounded">chrome://extensions</code> no Google Chrome.
                </li>
                <li>
                  Ative a opção <strong>Modo do desenvolvedor</strong> no canto superior direito.
                </li>
                <li>
                  Clique em <strong>Carregar sem compactação</strong> e selecione a pasta{' '}
                  <code className="bg-white px-1 rounded">EXPERTISE/chrome-extension</code>.
                </li>
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
