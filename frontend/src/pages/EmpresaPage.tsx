import { useEffect, useState } from 'react';
import {
  CheckCircle, Radar, AlertCircle, User, Shield,
  Building2, MapPin, Tag, Activity
} from '@components/icons/phosphor-compat';
import { GovBrConfiabilidade } from '@components/ui/GovBrConfiabilidade';
import api from '@services/api';
import toast from 'react-hot-toast';

function deriveRadarPreview(empresa: any) {
  const raw = [
    ...(empresa?.palavras_chave || []),
    String(empresa?.cnae_principal || ''),
    String(empresa?.razao_social || ''),
  ]
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((item: string) => item.trim())
    .filter((item: string) => item.length >= 4);

  return [...new Set(raw)].slice(0, 8);
}

export default function EmpresaPage() {
  const [cnpj, setCnpj] = useState('');
  const [cpfSocio, setCpfSocio] = useState('');
  const [empresa, setEmpresa] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarGovBr, setMostrarGovBr] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api.get('/empresas')
      .then((response) => {
        const primeiraEmpresa = response.data?.data?.[0];
        if (!cancelled && primeiraEmpresa) {
          setEmpresa(primeiraEmpresa);
          setCnpj(primeiraEmpresa.cnpj);
        }
      })
      .catch(() => {
        // A página continua funcional mesmo sem empresa previamente salva.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const buscarCnpj = async (valorCnpj: string) => {
    const limpo = valorCnpj.replace(/\D/g, '');
    if (limpo.length !== 14) return;

    setLoading(true);
    setErro('');

    try {
      const result = await api.get(`/integracoes/cnpj/${limpo}`);
      if (result.data.success) {
        setEmpresa(result.data.data);
      } else {
        setErro('CNPJ não encontrado na base do Governo.');
      }
    } catch {
      setErro('Nao foi possivel consultar os dados agora. Tente novamente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  const salvarEmpresa = async () => {
    if (!empresa) {
      toast.error('Consulte um CNPJ válido antes de ativar a análise.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        cnpj: empresa.cnpj,
        razao_social: empresa.razao_social,
        nome_fantasia: empresa.nome_fantasia,
        cnae_principal: empresa.cnae_principal,
        municipio: empresa.municipio,
        uf: empresa.uf,
        status: empresa.status,
        palavras_chave: String(empresa.cnae_principal || '')
          .split(/[-,\s/]+/)
          .map((item) => item.trim().toLowerCase())
          .filter((item) => item.length >= 4),
        regioes: empresa.uf ? [empresa.uf] : [],
      };

      const response = await api.post('/empresas', payload);
      setEmpresa(response.data?.data ?? empresa);
      toast.success('Empresa vinculada ao radar com sucesso.');
    } catch {
      toast.error('Não foi possível salvar a empresa agora.');
    } finally {
      setSaving(false);
    }
  };

  const cpfLimpo = cpfSocio.replace(/\D/g, '');
  const radarPreview = deriveRadarPreview(empresa);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-brand-blue flex items-center gap-3">
          <div className="bg-white p-2 rounded-lg">
            <Building2 className="w-6 h-6 text-brand-blue" />
          </div>
          Minha Empresa
        </h1>
        <p className="text-brand-blue/70 text-sm mt-1">Configure sua empresa e valide o nível de acesso Gov.br para licitações</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COLUNA PRINCIPAL */}
        <div className="lg:col-span-2 space-y-5">

          {/* BUSCA POR CNPJ */}
          <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
            <h2 className="font-bold text-brand-blue text-base mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4 text-brand-blue" />
              Identificação da Empresa
            </h2>

            <div className="space-y-3">
              <label className="text-xs font-bold text-brand-blue/70 uppercase tracking-wide block">CNPJ</label>
              <div className="relative">
                <input
                  id="input-cnpj"
                  type="text"
                  placeholder="00.000.000/0000-00"
                  className="w-full pl-5 pr-12 py-3.5 bg-white border-2 border-gray-100 rounded-lg text-lg font-bold text-brand-blue outline-none focus:border-brand-blue/20 transition-all"
                  value={cnpj}
                  onChange={(e) => {
                    setCnpj(e.target.value);
                    if (e.target.value.replace(/\D/g, '').length === 14) {
                      buscarCnpj(e.target.value);
                    }
                  }}
                />
                {loading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin h-5 w-5 border-4 border-brand-blue/20 border-t-transparent rounded-lg" />
                )}
              </div>
              {erro && (
                <p className="text-brand-blue text-sm font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {erro}
                </p>
              )}
            </div>

            {/* Resultado do CNPJ */}
            {empresa && (
              <div className="mt-5 p-4 bg-white rounded-lg border border-brand-blue/20">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-brand-blue" />
                  <p className="font-bold text-brand-blue text-sm">Empresa localizada na Receita Federal</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Razão Social', value: empresa.razao_social, icon: Building2 },
                    { label: 'CNAE Principal', value: empresa.cnae_principal, icon: Tag },
                    { label: 'Localização', value: `${empresa.municipio || '—'} - ${empresa.uf || '—'}`, icon: MapPin },
                    { label: 'Status', value: empresa.status, icon: Activity },
                  ].map(({ label, value, icon: Ic }) => (
                    <div key={label} className="bg-white p-3.5 rounded-lg border border-brand-blue/20 shadow-sm">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Ic className="w-3 h-3 text-brand-blue/70" />
                        <p className="text-[10px] uppercase font-bold text-brand-blue/70 tracking-wide">{label}</p>
                      </div>
                      <p className="text-brand-blue font-bold text-sm">{value || '—'}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-brand-blue/20 pt-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-blue mb-2">
                    Radar automatico vinculado ao CNAE
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {radarPreview.map((tag) => (
                      <span key={tag} className="rounded-lg border border-brand-blue/20 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-blue">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO GOV.BR */}
          <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
            <h2 className="font-bold text-brand-blue text-base mb-1 flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-blue" />
              Validação Gov.br — Sócio / Representante Legal
            </h2>
            <p className="text-xs text-brand-blue/70 mb-4">
              Consulte o nível de confiabilidade do CPF do sócio responsável pelas licitações.
              Prata ou Ouro é necessário para órgãos que exigem validação digital.
            </p>

            <div className="space-y-3">
              <label className="text-xs font-bold text-brand-blue/70 uppercase tracking-wide block">
                CPF do Sócio / Responsável
              </label>
              <div className="flex gap-2">
                <input
                  id="input-cpf-socio"
                  type="text"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="flex-1 px-4 py-3 bg-white border-2 border-gray-100 rounded-lg text-base font-bold text-brand-blue outline-none focus:border-brand-blue/20 transition-all"
                  value={cpfSocio}
                  onChange={(e) => setCpfSocio(e.target.value)}
                />
                <button
                  id="btn-verificar-govbr"
                  onClick={() => cpfLimpo.length === 11 && setMostrarGovBr(true)}
                  disabled={cpfLimpo.length !== 11}
                  className="px-4 py-3 bg-brand-blue hover:bg-brand-blue disabled:bg-white disabled:text-brand-blue/70 text-white text-sm font-bold rounded-lg transition-all active:scale-95"
                >
                  Verificar
                </button>
              </div>

              {mostrarGovBr && cpfLimpo.length === 11 && (
                <div className="mt-3">
                  <GovBrConfiabilidade
                    cpf={cpfLimpo}
                  />
                </div>
              )}

              {!mostrarGovBr && (
                <div className="bg-white border border-dashed border-gray-100 rounded-lg p-4 text-center">
                  <User className="w-8 h-8 text-brand-blue/70 mx-auto mb-2" />
                  <p className="text-sm text-brand-blue/70">Digite o CPF e clique em Verificar para consultar o Gov.br</p>
                  <p className="text-xs text-brand-blue/70 mt-1">A consulta usa a API oficial do Serpro (ConectaGov)</p>
                </div>
              )}
            </div>
          </div>

          {/* BOTÃO ATIVAR */}
          {empresa && (
            <button
              id="btn-ativar-expertise"
              onClick={() => void salvarEmpresa()}
              disabled={saving}
              className="w-full py-4 bg-brand-blue hover:bg-[#172554] text-white font-bold rounded-lg shadow-lg shadow-[0_4px_20px_rgba(30,58,138,0.05)] transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              <Radar className="w-5 h-5" /> {saving ? 'Salvando Empresa...' : 'Ativar Análise Expertise'}
            </button>
          )}
        </div>

        {/* PAINEL LATERAL — GUIA GOV.BR */}
        <div className="space-y-4">
          <div className="bg-white border border-brand-blue/20 rounded-lg p-4">
            <h3 className="font-bold text-brand-blue text-sm mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Níveis Gov.br
            </h3>
            <div className="space-y-2.5 text-xs">
              {[
                {
                  nivel: '🥇 Ouro', cor: 'text-brand-blue', bg: 'bg-brand-orange/10 border-brand-orange/50',
                  desc: 'Verificação biométrica facial ou via certificado digital A3'
                },
                {
                  nivel: '🥈 Prata', cor: 'text-brand-blue/70', bg: 'bg-white border-gray-100',
                  desc: 'Validação via Internet Banking (BB, CEF) ou balcão presencial'
                },
                {
                  nivel: '🥉 Bronze', cor: 'text-brand-blue', bg: 'bg-brand-orange/10 border-brand-orange/50',
                  desc: 'Conta criada apenas com validação de e-mail — acesso limitado'
                },
              ].map(({ nivel, cor, bg, desc }) => (
                <div key={nivel} className={`p-2.5 rounded-lg border ${bg}`}>
                  <p className={`font-bold ${cor} mb-0.5`}>{nivel}</p>
                  <p className="text-brand-blue/70 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
            <h3 className="font-bold text-brand-blue text-sm mb-2">ℹ️ Por que validar?</h3>
            <p className="text-xs text-brand-blue/70 leading-relaxed">
              Órgãos federais, estaduais e municípios cada vez mais exigem representantes com conta Gov.br nível Prata ou Ouro para assinar contratos digitalmente e participar de certames eletrônicos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


