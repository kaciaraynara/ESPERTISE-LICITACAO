import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Gavel,
  MapPin,
  MessageSquare,
  Phone,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Star,
  UserRound,
} from '@components/icons/phosphor-compat';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { useJuridicoWorkspace } from '../features/juridico/useJuridicoWorkspace';
import {
  formatDateTime,
  getCaseStatusLabel,
  getCaseStatusTone,
  getPrioridadeTone,
  getTriagemFilaLabel,
} from '../features/juridico/utils';

function JuridicoSwitch() {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-[#C8DCF9] bg-white p-1 shadow-sm">
      <Link
        to="/juridico"
        className="rounded-lg bg-brand-blue px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white"
      >
        Painel do Licitante
      </Link>
      <Link
        to="/juridico/advogado"
        className="rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-blue/70 transition hover:bg-white hover:text-brand-blue"
      >
        Painel do Advogado
      </Link>
    </div>
  );
}

export default function JuridicoPage() {
  const user = useAuthStore((state) => state.user);
  const [searchParams] = useSearchParams();
  const [buscaAdvogado, setBuscaAdvogado] = useState('');
  const [selectedLawyerId, setSelectedLawyerId] = useState('');
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [notaAvaliacao, setNotaAvaliacao] = useState(5);
  const [comentarioAvaliacao, setComentarioAvaliacao] = useState('');

  const prefilledEdital = searchParams.get('edital') ?? '';
  const prefilledObjeto = searchParams.get('objeto') ?? '';

  const [assunto, setAssunto] = useState(
    prefilledObjeto ? `Apoio jurÃ­dico para ${prefilledObjeto}` : 'Preciso de apoio jurÃ­dico em licitaÃ§Ã£o',
  );
  const [descricaoCaso, setDescricaoCaso] = useState(prefilledObjeto || '');
  const [telefoneCliente, setTelefoneCliente] = useState(user?.telefone ?? '');

  const {
    advogados,
    casos,
    perfil,
    abrirCaso,
    atualizarStatus,
    enviarMensagem,
    avaliarCaso,
  } = useJuridicoWorkspace(buscaAdvogado);

  const meusCasos = casos.filter((caseItem) => caseItem.client.id === user?.id);
  const selectedCase = meusCasos.find((caseItem) => caseItem.id === selectedCaseId) ?? meusCasos[0] ?? null;
  const selectedLawyer = advogados.find((lawyer) => lawyer.user_id === selectedLawyerId) ?? advogados[0] ?? null;
  const selectedCaseLawyer =
    advogados.find((lawyer) => lawyer.user_id === selectedCase?.lawyer?.id) ?? null;
  const casosNovos = meusCasos.filter((caseItem) => caseItem.status === 'novo').length;

  useEffect(() => {
    const draft = window.sessionStorage.getItem('expertise:lex:sos-draft');
    if (!draft) return;

    setAssunto('RevisÃ£o jurÃ­dica da resposta do LEX');
    setDescricaoCaso((current) => {
      const prefix = current.trim() ? `${current.trim()}\n\n` : '';
      return `${prefix}[Resposta do LEX para revisÃ£o humana]\n${draft}`;
    });
    window.sessionStorage.removeItem('expertise:lex:sos-draft');
    toast.success('Resposta do LEX adicionada ao atendimento jurÃ­dico.');
  }, []);

  useEffect(() => {
    if (!selectedLawyerId && advogados.length > 0) {
      setSelectedLawyerId(advogados[0].user_id);
    }
  }, [advogados, selectedLawyerId]);

  useEffect(() => {
    if (!selectedCaseId && meusCasos.length > 0) {
      setSelectedCaseId(meusCasos[0].id);
    }
  }, [meusCasos, selectedCaseId]);

  const handleOpenCase = () => {
    if (!selectedLawyerId || !assunto.trim() || !descricaoCaso.trim()) {
      toast.error('Escolha um advogado e detalhe a demanda jurÃ­dica.');
      return;
    }

    abrirCaso.mutate(
      {
        lawyer_user_id: selectedLawyerId,
        assunto,
        edital_id: prefilledEdital || undefined,
        edital_objeto: prefilledObjeto || undefined,
        descricao: descricaoCaso,
        telefone_cliente: telefoneCliente || undefined,
      },
      {
        onSuccess: (data) => {
          setDescricaoCaso('');
          setMensagem('');
          setSelectedCaseId(data.id);
        },
      },
    );
  };

  const handleSendMessage = () => {
    if (!selectedCase || !mensagem.trim()) {
      toast.error('Digite uma mensagem para continuar o atendimento.');
      return;
    }

    enviarMensagem.mutate(
      { caseId: selectedCase.id, conteudo: mensagem },
      {
        onSuccess: () => setMensagem(''),
      },
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8 lg:p-12">
      <section className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-3xl border-2 border-slate-100 bg-white shadow-xl overflow-hidden p-8 lg:p-12">
          <JuridicoSwitch />

          <div className="mt-8 inline-flex items-center gap-3 rounded-full border-2 border-brand-orange/30 bg-orange-50/50 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-brand-orange">
            <ShieldCheck className="h-4 w-4" weight="bold" />
            Atendimento jurÃ­dico para licitantes
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
            Escolha o advogado certo e acompanhe a estratÃ©gia jurÃ­dica.
          </h1>
          <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-slate-500">
            Este painel foi organizado para o licitante acionar apoio jurÃ­dico com agilidade, comparar parceiros e centralizar as conversas de impugnaÃ§Ã£o, recurso, habilitaÃ§Ã£o e defesa.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-6 transition-all hover:border-brand-blue/30 hover:bg-white hover:shadow-lg">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Advogados Ativos</p>
              <p className="mt-3 text-4xl font-black text-brand-blue">{advogados.length}</p>
              <p className="mt-2 text-sm font-semibold text-slate-500">Parceiros jurÃ­dicos prontos para assumir seu caso.</p>
            </div>
            <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-6 transition-all hover:border-brand-orange/30 hover:bg-orange-50/30 hover:shadow-lg">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Casos no Painel</p>
              <p className="mt-3 text-4xl font-black text-brand-orange">{meusCasos.length}</p>
              <p className="mt-2 text-sm font-semibold text-slate-500">Atendimentos jurÃ­dicos organizados por edital.</p>
            </div>
            <div className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-6 transition-all hover:border-brand-blue/30 hover:bg-blue-50/30 hover:shadow-lg">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Demandas Novas</p>
              <p className="mt-3 text-4xl font-black text-brand-blue">{casosNovos}</p>
              <p className="mt-2 text-sm font-semibold text-slate-500">Casos aguardando resposta inicial.</p>
            </div>
          </div>
        </div>

        <div className="bg-brand-blue rounded-3xl p-8 lg:p-12 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Scale className="w-64 h-64 text-white" />
          </div>
          <div className="relative z-10">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-orange">Fluxo do Licitante</p>
            <h2 className="mt-4 text-3xl font-black text-white leading-tight">JurÃ­dico organizado para agir rÃ¡pido</h2>
            <div className="mt-6 space-y-4 text-lg font-medium leading-relaxed text-blue-100/80">
              <p>1. Compare advogados parceiros por especialidade, OAB, localizaÃ§Ã£o e carga atual.</p>
              <p>2. Abra a solicitaÃ§Ã£o com edital, resumo do vÃ­cio, urgÃªncia e telefone.</p>
              <p>3. Centralize as mensagens e o andamento em uma Ãºnica sala.</p>
            </div>

            <div className="mt-10 rounded-2xl border-2 border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-orange">Ãrea do Advogado</p>
              <p className="mt-3 text-xl font-black text-white">
                {perfil ? 'VocÃª tambÃ©m tem acesso ao painel do advogado.' : 'Quer atender clientes na plataforma?'}
              </p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-blue-100/80">
                O painel do advogado tem cadastro profissional, plano mensal, carteira de casos e chat.
              </p>
              <Link to="/juridico/advogado" className="mt-6 inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-xl bg-white px-6 py-4 text-xs font-black uppercase tracking-widest text-brand-blue transition hover:bg-slate-100 shadow-lg">
                <Scale className="h-4 w-4" weight="bold" />
                Ir para Painel do Advogado
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.48fr_0.52fr]">
        <section className="bg-slate-50/50 rounded-3xl border-2 border-slate-100 p-8 lg:p-12">
          <div className="flex items-center gap-3">
            <Search className="h-6 w-6 text-brand-orange" weight="bold" />
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-900">DiretÃ³rio de Advogados</h2>
          </div>

          <div className="mt-8">
            <input
              value={buscaAdvogado}
              onChange={(event) => setBuscaAdvogado(event.target.value)}
              placeholder="Buscar por nome, OAB, cidade ou especialidade"
              className="w-full rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-base font-bold text-slate-900 outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 placeholder:text-slate-400"
            />
          </div>

          <div className="mt-8 space-y-4">
            {advogados.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
                <p className="text-lg font-black text-slate-900">Nenhum advogado ativo no diretÃ³rio agora.</p>
                <p className="mt-4 text-base font-medium leading-relaxed text-slate-500">
                  Assim que um parceiro jurÃ­dico concluir o cadastro profissional, ele aparece aqui para escolha.
                </p>
              </div>
            ) : null}

            {advogados.map((lawyer) => {
              const isSelected = selectedLawyerId === lawyer.user_id;

              return (
                <button
                  key={lawyer.id}
                  type="button"
                  onClick={() => setSelectedLawyerId(lawyer.user_id)}
                  className={`w-full rounded-3xl border-2 p-6 text-left transition-all hover:-translate-y-1 hover:shadow-lg ${
                    isSelected
                      ? 'border-brand-blue bg-blue-50/30 shadow-md'
                      : 'border-slate-100 bg-white hover:border-brand-blue/30'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-black text-slate-900">{lawyer.nome_exibicao}</p>
                      <p className="mt-2 text-sm font-bold text-slate-500">OAB {lawyer.oab_numero}/{lawyer.oab_uf}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-brand-orange/30 bg-orange-50/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand-orange">
                      <Star className="h-4 w-4" weight="bold" />
                      {lawyer.avaliacao_media ? `${lawyer.avaliacao_media.toFixed(1)} de mÃ©dia` : `${lawyer.casos_ativos} ativo(s)`}
                    </span>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {lawyer.especialidades.slice(0, 3).map((item) => (
                      <span key={item} className="rounded-lg border-2 border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-500">
                    {lawyer.avaliacoes_total ? (
                      <span className="inline-flex items-center gap-2">
                        <Star className="h-4 w-4 text-brand-orange" weight="bold" />
                        {lawyer.avaliacoes_total} avaliaÃ§Ã£o(Ãµes)
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4" weight="bold" />
                      {[lawyer.cidade, lawyer.uf].filter(Boolean).join(' / ') || 'Local nÃ£o informado'}
                    </span>
                    {lawyer.contato_publico ? (
                      <span className="inline-flex items-center gap-2">
                        <Phone className="h-4 w-4" weight="bold" />
                        {lawyer.contato_publico}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-3xl border-2 border-slate-100 p-8 lg:p-12 shadow-sm">
          <div className="flex items-center gap-3">
            <Gavel className="h-6 w-6 text-brand-blue" weight="bold" />
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-900">Abrir Atendimento JurÃ­dico</h2>
          </div>

          <p className="mt-4 text-base font-medium leading-relaxed text-slate-500">
            Registre o contexto da licitaÃ§Ã£o, do risco ou do vÃ­cio e encaminhe a demanda jÃ¡ para o advogado escolhido.
          </p>

          {selectedLawyer ? (
            <div className="mt-8 rounded-3xl border-2 border-blue-100 bg-blue-50/50 p-8">
              <p className="text-[11px] font-black uppercase tracking-widest text-brand-blue">Advogado Selecionado</p>
              <p className="mt-3 text-2xl font-black text-slate-900">{selectedLawyer.nome_exibicao}</p>
              <p className="mt-2 text-sm font-bold text-slate-500">OAB {selectedLawyer.oab_numero}/{selectedLawyer.oab_uf}</p>
              {selectedLawyer.avaliacao_media ? (
                <p className="mt-2 text-sm font-black text-brand-blue">
                  Nota {selectedLawyer.avaliacao_media.toFixed(1)} em {selectedLawyer.avaliacoes_total ?? 0} avaliaÃ§Ã£o(Ãµes)
                </p>
              ) : null}
              <p className="mt-4 text-base font-medium leading-relaxed text-slate-600">
                {selectedLawyer.bio || 'Perfil jurÃ­dico pronto para atuar em impugnaÃ§Ã£o, recurso e estratÃ©gia de habilitaÃ§Ã£o.'}
              </p>
            </div>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleOpenCase();
            }}
            className="mt-8 space-y-6"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Telefone para Retorno</label>
                <input
                  value={telefoneCliente}
                  onChange={(event) => setTelefoneCliente(event.target.value)}
                  placeholder="(11) 99999-9999"
                  className="mt-3 w-full rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-base font-bold text-slate-900 outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
                />
              </div>
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Edital Vinculado</label>
                <input
                  value={prefilledEdital}
                  readOnly
                  placeholder="Sem edital prÃ©-vinculado"
                  className="mt-3 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-6 py-4 text-base font-bold text-slate-500 outline-none cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Assunto JurÃ­dico</label>
              <input
                value={assunto}
                onChange={(event) => setAssunto(event.target.value)}
                placeholder="Ex.: Pedido de impugnaÃ§Ã£o por clÃ¡usula restritiva"
                className="mt-3 w-full rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-base font-bold text-slate-900 outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10"
              />
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Resumo do Caso</label>
              <textarea
                value={descricaoCaso}
                onChange={(event) => setDescricaoCaso(event.target.value)}
                rows={8}
                placeholder="Explique o vÃ­cio, o prazo, o risco da disputa e o que vocÃª precisa do jurÃ­dico."
                className="mt-3 w-full rounded-3xl border-2 border-slate-200 bg-white px-6 py-6 text-base font-bold text-slate-900 outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4">
              <button
                type="submit"
                disabled={abrirCaso.isPending || !selectedLawyer}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-xl bg-brand-orange hover:bg-orange-500 px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
              >
                <ArrowRight className="h-5 w-5" weight="bold" />
                {abrirCaso.isPending ? 'Abrindo...' : 'Acionar Advogado'}
              </button>

              {prefilledObjeto ? (
                <span className="rounded-xl border-2 border-brand-orange/30 bg-orange-50/50 px-4 py-3 text-xs font-black uppercase tracking-widest text-brand-orange">
                  Caso prÃ©-preenchido
                </span>
              ) : null}
            </div>
          </form>
        </section>
      </section>

      <section className="bg-white rounded-3xl border-2 border-slate-100 p-8 lg:p-12 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-brand-blue" weight="bold" />
            <h2 className="text-xl font-black uppercase tracking-widest text-slate-900">Meu JurÃ­dico e Chat</h2>
          </div>

          {selectedCase ? (
            <div className="flex flex-wrap gap-2">
              {(['novo', 'em_andamento', 'concluido'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => atualizarStatus.mutate({ caseId: selectedCase.id, status })}
                  className={`rounded-xl border-2 px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                    selectedCase.status === status
                      ? 'border-brand-blue bg-brand-blue text-white shadow-md'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-brand-blue/50 hover:text-brand-blue'
                  }`}
                >
                  {getCaseStatusLabel(status)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {meusCasos.length === 0 ? (
          <div className="mt-8 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
            <p className="text-xl font-black text-slate-900">Nenhum caso jurÃ­dico aberto ainda.</p>
            <p className="mt-4 text-base font-medium leading-relaxed text-slate-500">
              Escolha um advogado parceiro, descreva a necessidade e o caso aparecerÃ¡ aqui com o chat centralizado.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 xl:grid-cols-[0.35fr_0.65fr]">
            <div className="space-y-4 pr-2">
              {meusCasos.map((caseItem) => (
                <button
                  key={caseItem.id}
                  type="button"
                  onClick={() => setSelectedCaseId(caseItem.id)}
                  className={`w-full rounded-2xl border-2 p-6 text-left transition-all hover:-translate-y-1 hover:shadow-lg ${
                    selectedCase?.id === caseItem.id
                      ? 'border-brand-blue bg-blue-50/30 shadow-md'
                      : 'border-slate-100 bg-white hover:border-brand-blue/30'
                  }`}
                >
                  <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-black text-slate-900 leading-snug line-clamp-2">{caseItem.assunto}</p>
                      <p className="mt-2 text-sm font-bold text-slate-500">
                        {caseItem.lawyer?.nome_exibicao || 'Advogado nÃ£o localizado'}
                      </p>
                    </div>
                    <span className={`inline-flex items-center whitespace-nowrap rounded-lg border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${getCaseStatusTone(caseItem.status)}`}>
                      {getCaseStatusLabel(caseItem.status)}
                    </span>
                  </div>
                  <p className="mt-4 line-clamp-2 text-sm font-medium leading-relaxed text-slate-500">{caseItem.descricao}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-lg border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${getPrioridadeTone(caseItem.triagem.prioridade)}`}>
                      {caseItem.triagem.prioridade}
                    </span>
                    <span className="rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {getTriagemFilaLabel(caseItem.triagem.fila)}
                    </span>
                  </div>
                  <p className="mt-4 text-xs font-bold text-slate-400">{formatDateTime(caseItem.updated_at)}</p>
                </button>
              ))}
            </div>

            {selectedCase ? (
              <div className="rounded-3xl border-2 border-slate-100 bg-slate-50 p-6 lg:p-8 flex flex-col h-[800px]">
                <div className="grid gap-6 lg:grid-cols-[0.6fr_0.4fr]">
                  <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <p className="text-xl font-black text-slate-900 leading-snug">{selectedCase.assunto}</p>
                        <p className="mt-2 text-sm font-bold text-slate-500">
                          Atendimento com {selectedCase.lawyer?.nome_exibicao || 'advogado parceiro'}
                        </p>
                      </div>
                      <span className={`inline-flex items-center rounded-lg border-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${getCaseStatusTone(selectedCase.status)}`}>
                        {getCaseStatusLabel(selectedCase.status)}
                      </span>
                    </div>

                    <div className="mt-6 rounded-xl border-2 border-blue-100 bg-blue-50/50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-brand-blue">Resumo Enviado</p>
                      <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">{selectedCase.descricao}</p>
                    </div>

                    <div className="mt-4 rounded-xl border-2 border-slate-100 bg-white p-4">
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className={`rounded-lg border-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getPrioridadeTone(selectedCase.triagem.prioridade)}`}>
                          Prioridade {selectedCase.triagem.prioridade}
                        </span>
                        <span className="rounded-lg border-2 border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {getTriagemFilaLabel(selectedCase.triagem.fila)}
                        </span>
                        <span className="rounded-lg border-2 border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          Score {selectedCase.triagem.score}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-slate-600">{selectedCase.triagem.resumo}</p>
                    </div>

                    {selectedCase.edital_objeto ? (
                      <div className="mt-4 rounded-xl border-2 border-slate-100 bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Edital Vinculado</p>
                        <p className="mt-2 text-sm font-bold text-slate-700">{selectedCase.edital_objeto}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Advogado ResponsÃ¡vel</p>
                    <p className="mt-3 text-xl font-black text-slate-900">
                      {selectedCase.lawyer?.nome_exibicao || 'NÃ£o localizado'}
                    </p>
                    <p className="mt-2 text-sm font-bold text-slate-500">{selectedCase.lawyer?.oab || 'OAB nÃ£o informada'}</p>
                    {selectedCaseLawyer?.avaliacao_media ? (
                      <p className="mt-2 text-sm font-black text-brand-blue">
                        Nota {selectedCaseLawyer.avaliacao_media.toFixed(1)} em {selectedCaseLawyer.avaliacoes_total ?? 0} avaliaÃ§Ã£o(Ãµes)
                      </p>
                    ) : null}

                    <div className="mt-6 flex flex-wrap gap-2">
                      {(selectedCase.lawyer?.especialidades || []).map((item) => (
                        <span key={item} className="rounded-lg border-2 border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          {item}
                        </span>
                      ))}
                    </div>

                    <div className="mt-6 space-y-4 text-sm font-bold text-slate-500">
                      {selectedCaseLawyer?.contato_publico ? (
                        <div className="inline-flex items-center gap-3">
                          <Phone className="h-5 w-5 text-slate-400" weight="bold" />
                          {selectedCaseLawyer.contato_publico}
                        </div>
                      ) : null}
                      <div className="inline-flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-slate-400" weight="bold" />
                        {[selectedCaseLawyer?.cidade, selectedCaseLawyer?.uf].filter(Boolean).join(' / ') || 'Local nÃ£o informado'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                  {selectedCase.messages.map((messageItem) => {
                    const mine = messageItem.sender_user_id === user?.id;

                    return (
                      <div key={messageItem.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-6 py-4 shadow-sm ${mine ? 'bg-brand-blue text-white rounded-br-sm' : 'border-2 border-slate-200 bg-white text-slate-800 rounded-bl-sm'}`}>
                          <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-80">
                            {messageItem.sender_tipo === 'advogado' ? <Scale className="h-4 w-4" weight="bold" /> : <UserRound className="h-4 w-4" weight="bold" />}
                            {messageItem.sender_nome}
                          </div>
                          <p className="text-base font-medium leading-relaxed">{messageItem.conteudo}</p>
                          <p className={`mt-3 text-xs font-bold ${mine ? 'text-blue-200' : 'text-slate-400'}`}>
                            {formatDateTime(messageItem.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSendMessage();
                  }}
                  className="mt-6 shrink-0"
                >
                  <div className="flex flex-col sm:flex-row gap-4">
                    <textarea
                      value={mensagem}
                      onChange={(event) => setMensagem(event.target.value)}
                      rows={2}
                      placeholder="Envie documentos, dÃºvidas ou complemento de estratÃ©gia..."
                      className="flex-1 rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-base font-medium text-slate-900 outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 resize-none custom-scrollbar"
                    />
                    <button type="submit" disabled={enviarMensagem.isPending} className="inline-flex items-center justify-center gap-3 rounded-xl bg-brand-blue hover:bg-[#172554] px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0 sm:self-end">
                      <Send className="h-5 w-5" weight="bold" />
                      Enviar
                    </button>
                  </div>
                </form>

                {selectedCase.review ? (
                  <div className="mt-6 rounded-2xl border-2 border-brand-orange/30 bg-orange-50/50 p-6 shrink-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-orange">AvaliaÃ§Ã£o Registrada</p>
                    <p className="mt-3 text-xl font-black text-slate-900">Nota {selectedCase.review.nota}/5</p>
                    {selectedCase.review.comentario ? (
                      <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{selectedCase.review.comentario}</p>
                    ) : null}
                  </div>
                ) : null}

                {selectedCase.pode_avaliar ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      avaliarCaso.mutate(
                        {
                          caseId: selectedCase.id,
                          nota: notaAvaliacao,
                          comentario: comentarioAvaliacao || undefined,
                        },
                        {
                          onSuccess: () => {
                            setNotaAvaliacao(5);
                            setComentarioAvaliacao('');
                          },
                        },
                      );
                    }}
                    className="mt-6 rounded-2xl border-2 border-slate-200 bg-white p-6 shrink-0 shadow-sm"
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avaliar Advogado</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((nota) => (
                        <button
                          key={nota}
                          type="button"
                          onClick={() => setNotaAvaliacao(nota)}
                          className={`rounded-xl border-2 px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                            notaAvaliacao === nota
                              ? 'border-brand-orange bg-brand-orange text-white shadow-md'
                              : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-brand-orange/50 hover:bg-orange-50/50 hover:text-brand-orange'
                          }`}
                        >
                          {nota} Estrela{nota > 1 ? 's' : ''}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={comentarioAvaliacao}
                      onChange={(event) => setComentarioAvaliacao(event.target.value)}
                      rows={3}
                      placeholder="Conte como foi a clareza, a velocidade e a qualidade da conduÃ§Ã£o jurÃ­dica."
                      className="mt-4 w-full rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-base font-medium text-slate-900 outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 resize-none custom-scrollbar"
                    />
                    <button type="submit" disabled={avaliarCaso.isPending} className="mt-4 inline-flex w-full sm:w-auto items-center justify-center gap-3 rounded-xl bg-brand-orange hover:bg-orange-500 px-8 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0">
                      <Star className="h-5 w-5" weight="bold" />
                      {avaliarCaso.isPending ? 'Enviando AvaliaÃ§Ã£o...' : 'Enviar AvaliaÃ§Ã£o'}
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

