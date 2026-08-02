import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck, ShieldAlert, Shield, RefreshCw,
  User, Mail, Phone, CheckCircle, XCircle, ChevronDown, ChevronUp, ExternalLink
} from '@components/icons/phosphor-compat';
import api from '@services/api';

interface GovBrPerfil {
  cpf: string;
  conta: {
    nome: string;
    email: string;
    emailVerificado: boolean;
    telefone: string;
    status: string;
  } | null;
  confiabilidade: {
    nivel: 'bronze' | 'prata' | 'ouro' | 'desconhecido';
    descricao: string;
    pontos: number;
    itens: Array<{ categoria: string; titulo: string; descricao: string }>;
  };
  habilitado_licitar: boolean;
  aviso?: string;
}

type GovBrNivel = GovBrPerfil['confiabilidade']['nivel'];
type NivelIcon = typeof Shield;

interface NivelConfig {
  label: string;
  cor: string;
  bg: string;
  border: string;
  iconBg: string;
  descricao: string;
  icon: NivelIcon;
}

const NIVEL_CONFIG: Record<GovBrNivel, NivelConfig> = {
  ouro: {
    label: 'Nível Ouro',
    cor: 'text-brand-blue',
    bg: 'bg-brand-orange/10',
    border: 'border-brand-orange/50',
    iconBg: 'bg-brand-orange/10',
    descricao: 'Verificação por biometria facial ou certificado digital A3',
    icon: ShieldCheck,
  },
  prata: {
    label: 'Nível Prata',
    cor: 'text-brand-blue/70',
    bg: 'bg-white',
    border: 'border-gray-100',
    iconBg: 'bg-white',
    descricao: 'Verificação via Internet Banking ou validação presencial',
    icon: ShieldCheck,
  },
  bronze: {
    label: 'Nível Bronze',
    cor: 'text-brand-blue',
    bg: 'bg-brand-orange/10',
    border: 'border-brand-orange/50',
    iconBg: 'bg-brand-orange/10',
    descricao: 'Conta Gov.br criada com validação básica de e-mail',
    icon: ShieldAlert,
  },
  desconhecido: {
    label: 'Não Verificado',
    cor: 'text-brand-blue/70',
    bg: 'bg-white',
    border: 'border-gray-100',
    iconBg: 'bg-white',
    descricao: 'Sem dados de confiabilidade disponíveis',
    icon: Shield,
  },
};

interface Props {
  cpf: string;
  cpfOperador?: string;
  compact?: boolean;
}

export function GovBrConfiabilidade({ cpf, cpfOperador, compact = false }: Props) {
  const [expandido, setExpandido] = useState(false);
  const cpfLimpo = cpf.replace(/\D/g, '');

  const { data, isLoading, isError, refetch, isFetching } = useQuery<GovBrPerfil>({
    queryKey: ['govbr-perfil', cpfLimpo],
    queryFn: async () => {
      const endpoint = `/govbr/perfil/${cpfLimpo}`;

      const headers: Record<string, string> = {};
      if (cpfOperador) {
        headers['x-cpf-operador'] = cpfOperador.replace(/\D/g, '');
      }

      const resp = await api.get(endpoint, { headers });
      return resp.data.data as GovBrPerfil;
    },
    enabled: cpfLimpo.length === 11,
    staleTime: 10 * 60 * 1000, // 10 minutos
    retry: 1,
  });

  if (cpfLimpo.length !== 11) return null;

  const cfg = data ? NIVEL_CONFIG[data.confiabilidade.nivel] : null;
  const Icon = cfg?.icon || Shield;

  // Versão compacta — badge inline
  if (compact) {
    if (isLoading || isFetching) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-blue/70 bg-white px-2.5 py-1 rounded-lg animate-pulse">
          <RefreshCw className="w-3 h-3 animate-spin" /> Gov.br...
        </span>
      );
    }
    if (!data || isError) return null;

    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border ${cfg?.bg} ${cfg?.cor} ${cfg?.border}`}
        title={data.confiabilidade.descricao}
      >
        {cfg?.label}
        {data.habilitado_licitar && <CheckCircle className="w-3 h-3 text-brand-blue" />}
      </span>
    );
  }

  // Versão completa — card
  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${
      data ? `${cfg?.border} ${cfg?.bg}` : 'border-gray-100 bg-white'
    } shadow-sm`}>

      {/* HEADER */}
      <div className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg?.iconBg || 'bg-white'}`}>
          {isLoading || isFetching
            ? <RefreshCw className="w-5 h-5 text-brand-blue/70 animate-spin" />
            : <Icon className={`w-5 h-5 ${cfg?.cor || 'text-brand-blue/70'}`} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-blue/70">Gov.br</span>
          </div>
          {isLoading || isFetching ? (
            <p className="text-sm text-brand-blue/70 animate-pulse">Consultando Serpro...</p>
          ) : isError ? (
            <p className="text-sm text-brand-blue font-semibold">Erro ao consultar Gov.br</p>
          ) : data ? (
            <p className={`text-sm font-bold ${cfg?.cor}`}>
              {cfg?.label}
            </p>
          ) : null}
        </div>
        {data && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {data.habilitado_licitar ? (
              <span className="text-xs font-bold bg-white text-brand-blue border border-brand-blue/20 px-2 py-1 rounded-lg flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Habilitado
              </span>
            ) : (
              <span className="text-xs font-bold bg-brand-orange/10 text-brand-blue border border-brand-orange/50 px-2 py-1 rounded-lg flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Não habilitado
              </span>
            )}
            <button
              onClick={() => setExpandido(v => !v)}
              className="text-brand-blue/70 hover:text-brand-blue/70 p-1 rounded-lg hover:bg-white transition-colors"
            >
              {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        )}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          title="Atualizar consulta Gov.br"
          className="text-brand-blue/70 hover:text-brand-blue/70 p-1 rounded-lg hover:bg-white transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* DETALHES EXPANDIDOS */}
      {expandido && data && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">

          {/* Dados da Conta */}
          {data.conta && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/70">Dados da Conta</p>
              <div className="bg-white rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-brand-blue">
                  <User className="w-3.5 h-3.5 text-brand-blue/70 flex-shrink-0" />
                  <span className="font-bold">{data.conta.nome}</span>
                </div>
                <div className="flex items-center gap-2 text-brand-blue/70">
                  <Mail className="w-3.5 h-3.5 text-brand-blue/70 flex-shrink-0" />
                  <span>{data.conta.email}</span>
                  {data.conta.emailVerificado && (
                    <CheckCircle className="w-3 h-3 text-brand-blue" />
                  )}
                </div>
                {data.conta.telefone && (
                  <div className="flex items-center gap-2 text-brand-blue/70">
                    <Phone className="w-3.5 h-3.5 text-brand-blue/70 flex-shrink-0" />
                    <span>{data.conta.telefone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Confiabilidades */}
          {data.confiabilidade.itens.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue/70">Fatores de Confiabilidade</p>
              <div className="space-y-1.5">
                {data.confiabilidade.itens.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-2.5 text-xs">
                    <p className="font-bold text-brand-blue">{item.titulo || item.categoria}</p>
                    <p className="text-brand-blue/70 mt-0.5 leading-snug">{item.descricao}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerta de não habilitado */}
          {!data.habilitado_licitar && (
            <div className="bg-brand-orange/10 border border-brand-orange/50 rounded-lg p-3 text-xs">
              <p className="font-bold text-brand-blue mb-1">Nível insuficiente para licitações</p>
              <p className="text-brand-blue">É necessário atingir pelo menos o Nível Prata no Gov.br. Atualize sua conta via Internet Banking ou validação presencial.</p>
              <a
                href="https://acesso.gov.br"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-brand-blue hover:text-brand-blue font-bold"
              >
                Atualizar no Gov.br <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
