import { useEffect, useState } from 'react';
import {
  CheckCircle, Radar, AlertCircle, User, Shield,
  Building2, MapPin, Tag, Activity
} from '@components/icons/phosphor-compat';
import { GovBrConfiabilidade } from '@components/ui/GovBrConfiabilidade';
import api from '@services/api';
import toast from 'react-hot-toast';
import { formatCnpjMask, isValidCnpj, sanitizeCnpj } from '@/utils/cnpj';
import { useBrasilApiCnpj } from '@/hooks/useBrasilApiCnpj';

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
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [mostrarGovBr, setMostrarGovBr] = useState(false);

  const [formFields, setFormFields] = useState({
    razao_social: '',
    nome_fantasia: '',
    cep: '',
    logradouro: '',
    bairro: '',
    municipio: '',
    uf: '',
    cnae_principal: '',
    status: 'ATIVA',
  });

  useEffect(() => {
    let cancelled = false;

    api.get('/empresas')
      .then((response) => {
        const primeiraEmpresa = response.data?.data?.[0];
        if (!cancelled && primeiraEmpresa) {
          setEmpresa(primeiraEmpresa);
          setCnpj(formatCnpjMask(primeiraEmpresa.cnpj));
          setFormFields({
            razao_social: primeiraEmpresa.razao_social || primeiraEmpresa.razaoSocial || '',
            nome_fantasia: primeiraEmpresa.nome_fantasia || primeiraEmpresa.nomeFantasia || '',
            cep: primeiraEmpresa.cep || '',
            logradouro: primeiraEmpresa.logradouro || '',
            bairro: primeiraEmpresa.bairro || '',
            municipio: primeiraEmpresa.municipio || '',
            uf: primeiraEmpresa.uf || '',
            cnae_principal: primeiraEmpresa.cnae_principal || primeiraEmpresa.cnaePrincipal || '',
            status: primeiraEmpresa.status || 'ATIVA',
          });
        }
      })
      .catch(() => {
        // A página continua funcional mesmo sem empresa previamente salva.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const {
    isLoading: loading,
    error: brasilApiError,
  } = useBrasilApiCnpj(cnpj, {
    onSuccess: (dados) => {
      setErro('');
      const updated = {
        cnpj: dados.cnpj,
        razao_social: dados.razaoSocial,
        nome_fantasia: dados.nomeFantasia,
        cep: dados.cep,
        logradouro: dados.logradouro,
        bairro: dados.bairro,
        municipio: dados.cidade,
        uf: dados.uf,
        cnae_principal: dados.cnaePrincipal,
        status: dados.status || 'ATIVA',
      };
      setFormFields(updated);
      setEmpresa((prev: any) => ({ ...(prev || {}), ...updated }));
    },
    onError: (msg) => {
      setErro(msg);
    },
  });

  const salvarEmpresa = async () => {
    const cnpjLimpo = sanitizeCnpj(cnpj);
    if (cnpjLimpo.length > 0 && !isValidCnpj(cnpjLimpo, { optional: false })) {
      toast.error('Consulte ou preencha um CNPJ válido antes de ativar a análise.');
      return;
    }
    if (!formFields.razao_social.trim()) {
      toast.error('Preencha a Razão Social da empresa antes de salvar.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        cnpj: cnpjLimpo,
        razao_social: formFields.razao_social.trim(),
        nome_fantasia: formFields.nome_fantasia.trim() || formFields.razao_social.trim(),
        cep: formFields.cep.trim(),
        logradouro: formFields.logradouro.trim(),
        bairro: formFields.bairro.trim(),
        cnae_principal: formFields.cnae_principal.trim(),
        municipio: formFields.municipio.trim(),
        uf: formFields.uf.trim().toUpperCase().slice(0, 2),
        status: formFields.status || 'ATIVA',
        palavras_chave: String(formFields.cnae_principal || formFields.razao_social || '')
          .split(/[-,\s/]+/)
          .map((item) => item.trim().toLowerCase())
          .filter((item) => item.length >= 4),
        regioes: formFields.uf ? [formFields.uf.trim().toUpperCase().slice(0, 2)] : [],
      };

      const response = await api.post('/empresas', payload);
      setEmpresa(response.data?.data ?? payload);
      toast.success('Empresa vinculada ao radar com sucesso.');
    } catch {
      toast.error('Não foi possível salvar a empresa agora.');
    } finally {
      setSaving(false);
    }
  };

  const cpfLimpo = cpfSocio.replace(/\D/g, '');
  const radarPreview = deriveRadarPreview({ ...empresa, ...formFields });

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
                  maxLength={18}
                  placeholder="XX.XXX.XXX/XXXX-XX (letras e números)"
                  className="w-full pl-5 pr-12 py-3.5 bg-white border-2 border-gray-100 rounded-lg text-lg font-bold text-brand-blue outline-none focus:border-brand-blue/20 transition-all"
                  value={cnpj}
                  onChange={(e) => {
                    const masked = formatCnpjMask(e.target.value);
                    setCnpj(masked);
                    if (sanitizeCnpj(masked).length === 0) {
                      setErro('');
                    }
                  }}
                />
                {loading && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin h-5 w-5 border-4 border-brand-blue/20 border-t-transparent rounded-full" />
                )}
              </div>
              {(erro || brasilApiError) && (
                <p role="status" className="text-amber-700 text-xs font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {erro || brasilApiError}
                </p>
              )}
            </div>

            {/* Campos da Empresa (Preenchimento automático via BrasilAPI ou manual) */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-5">
              <div>
                <label className="block text-[11px] font-bold uppercase text-brand-blue/70 mb-1">Razão Social</label>
                <input
                  type="text"
                  placeholder="Razão Social"
                  value={formFields.razao_social}
                  onChange={(e) => setFormFields((p) => ({ ...p, razao_social: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-brand-blue outline-none focus:border-brand-blue/40"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-brand-blue/70 mb-1">Nome Fantasia</label>
                <input
                  type="text"
                  placeholder="Nome Fantasia"
                  value={formFields.nome_fantasia}
                  onChange={(e) => setFormFields((p) => ({ ...p, nome_fantasia: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-brand-blue outline-none focus:border-brand-blue/40"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-brand-blue/70 mb-1">CEP</label>
                <input
                  type="text"
                  maxLength={9}
                  placeholder="00000-000"
                  value={formFields.cep}
                  onChange={(e) => setFormFields((p) => ({ ...p, cep: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-brand-blue outline-none focus:border-brand-blue/40"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-brand-blue/70 mb-1">Logradouro</label>
                <input
                  type="text"
                  placeholder="Rua, Avenida, número"
                  value={formFields.logradouro}
                  onChange={(e) => setFormFields((p) => ({ ...p, logradouro: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-brand-blue outline-none focus:border-brand-blue/40"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-brand-blue/70 mb-1">Bairro</label>
                <input
                  type="text"
                  placeholder="Bairro"
                  value={formFields.bairro}
                  onChange={(e) => setFormFields((p) => ({ ...p, bairro: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-brand-blue outline-none focus:border-brand-blue/40"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-brand-blue/70 mb-1">Cidade</label>
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={formFields.municipio}
                    onChange={(e) => setFormFields((p) => ({ ...p, municipio: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-brand-blue outline-none focus:border-brand-blue/40"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-brand-blue/70 mb-1">UF</label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="UF"
                    value={formFields.uf}
                    onChange={(e) => setFormFields((p) => ({ ...p, uf: e.target.value.toUpperCase() }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-brand-blue uppercase outline-none focus:border-brand-blue/40"
                  />
                </div>
              </div>
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
                  <p className="text-xs text-brand-blue/70 mt-1">Consulta feita pelo serviço oficial do Serpro (ConectaGov)</p>
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

