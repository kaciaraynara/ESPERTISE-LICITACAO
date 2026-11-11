import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Scale,
  Sparkles,
  FileText,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { streamAiChat } from '@/services/aiStream.service';
import { EditalSelector, EditalOption } from '@/components/EditalSelector';

export const RecursosPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const urlEditalId =
    searchParams.get('edital') ||
    searchParams.get('editalId') ||
    searchParams.get('noticeId') ||
    searchParams.get('id') ||
    '';

  const [selectedNoticeId, setSelectedNoticeId] = useState<string>(urlEditalId);
  const [tipoRecurso, setTipoRecurso] = useState<
    'JULGAMENTO_PROPOSTA' | 'HABILITACAO_INABILITACAO' | 'CONTRARRAZOES' | 'RECONSIDERACAO'
  >('JULGAMENTO_PROPOSTA');
  const [editalNumero, setEditalNumero] = useState('');
  const [orgao, setOrgao] = useState('');
  const [modalidade, setModalidade] = useState('Pregão Eletrônico');
  const [dataCertame, setDataCertame] = useState('');
  const [licitanteAlvo, setLicitanteAlvo] = useState('');
  const [fundamentacao, setFundamentacao] = useState('');
  const [gerando, setGerando] = useState(false);
  const [textoGerado, setTextoGerado] = useState('');
  const [copiado, setCopiado] = useState(false);

  const handleSelectEdital = (ed: EditalOption) => {
    setSelectedNoticeId(ed.id);
    setEditalNumero(ed.numeroEdital);
    setOrgao(ed.orgao);
    if (ed.modalidade) setModalidade(ed.modalidade);
    if (ed.dataCertame) setDataCertame(ed.dataCertame);
    if (ed.objeto && !fundamentacao) {
      setFundamentacao(
        `Recurso administrativo interposto no âmbito do ${ed.numeroEdital} perante o(a) ${ed.orgao}. Objeto: "${ed.objeto}". A decisão recorrida afronta as disposições da Lei Federal nº 14.133/2021, o instrumento convocatório e precedentes do Tribunal de Contas da União.`
      );
    }
    toast.success(`Edital selecionado: Órgão e Modalidade preenchidos automaticamente!`);
  };

  const carregarExemplo = () => {
    setTipoRecurso('HABILITACAO_INABILITACAO');
    setEditalNumero('Pregão Eletrônico 28/2026 - UASG 200109');
    setOrgao('Tribunal Regional Federal da 1ª Região');
    setLicitanteAlvo('Vencedor Provisório: ABC Serviços e Tecnologia EIRELI');
    setFundamentacao(
      'A empresa vencedora apresentou Balanço Patrimonial sem registro na Junta Comercial e índice de Liquidez Geral (LG) de 0,82, em flagrante descumprimento ao subitem 9.4 do Edital e ao Art. 69, caput da Lei 14.133/2021, que fixou LG mínimo de 1,0. Além disso, a CNDT apresentada encontrava-se vencida na data da sessão.'
    );
    toast.success('Exemplo de caso concreto carregado!');
  };

  const handleGerarPeca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundamentacao.trim()) {
      toast.error('Descreva as irregularidades ou motivos do recurso.');
      return;
    }

    setGerando(true);
    setTextoGerado('');

    const tipoDescricao = {
      JULGAMENTO_PROPOSTA: 'RECURSO ADMINISTRATIVO CONTRA O JULGAMENTO DA PROPOSTA DE PREÇOS (Art. 165, I, "b")',
      HABILITACAO_INABILITACAO: 'RECURSO ADMINISTRATIVO CONTRA A HABILITAÇÃO/INABILITAÇÃO DE LICITANTE (Art. 165, I, "a")',
      CONTRARRAZOES: 'CONTRARRAZÕES DE RECURSO ADMINISTRATIVO (Art. 165, § 1º)',
      RECONSIDERACAO: 'PEDIDO DE RECONSIDERAÇÃO AO AGENTE DE CONTRATAÇÃO / PREGOEIRO',
    }[tipoRecurso];

    const prompt = `Você é um advogado especialista em Direito Administrativo e Licitações Públicas sob a Lei 14.133/2021.
Redija uma peça jurídica completa, formal e contundente de ${tipoDescricao}.

DADOS DO CERTAME:
- Edital / Licitação: ${editalNumero || 'Pregão Eletrônico nº [INDICAR]'}
- Órgão Licitante: ${orgao || 'Ilmo. Sr. Agente de Contratação / Pregoeiro Oficial'}
- Modalidade: ${modalidade || 'Pregão Eletrônico'}
${dataCertame ? `- Data do Certame / Sessão: ${dataCertame}` : ''}
- Licitante Envolvido: ${licitanteAlvo || 'Empresa Recorrida / Terceira'}
- Fatos e Irregularidades: ${fundamentacao}

ESTRUTURA OBRIGATÓRIA DA PEÇA:
1. ENDEREÇAMENTO FORMAL ao Agente de Contratação / Autoridade Superior competente.
2. DA TEMPESTIVIDADE: Demonstre que o recurso é interposto no prazo legal de 3 (três) dias úteis previsto no Art. 165 da Lei 14.133/2021.
3. DA LEGITIMIDADE E DO INTERESSE DE AGIR.
4. DOS FATOS (exposição clara e cronológica da sessão e da decisão impugnada).
5. DO DIREITO E DA FUNDAMENTAÇÃO JURÍDICA:
   - Violação expressa aos princípios da Legalidade, Vinculação ao Instrumento Convocatório e Isonomia (Art. 5º).
   - Enquadramento minucioso nos artigos da Lei 14.133/2021 pertinentes.
   - Citação de jurisprudência pacificada do Tribunal de Contas da União (TCU).
6. DO PEDIDO DE EFEITO SUSPENSIVO (Art. 168 da Lei 14.133/2021).
7. DOS PEDIDOS FINAIS: Conhecimento e provimento total do recurso para anular/reformar a decisão recorrida.
8. FECHAMENTO: Nesses Termos, Pede Deferimento, Data e Assinatura.`;

    try {
      await streamAiChat({
        endpoint: '/lex/recurso',
        noticeId: selectedNoticeId || urlEditalId || undefined,
        pergunta: prompt,
        onChunk: (chunk: string) => {
          setTextoGerado((prev) => prev + chunk);
        },
        onError: () => {
          toast.error('Não foi possível preparar o recurso. Tente novamente.');
        },
      });
      toast.success('Peça jurídica elaborada com sucesso!');
    } catch {
      toast.error('Falha ao processar peça recursal.');
    } finally {
      setGerando(false);
    }
  };

  const copiarTexto = () => {
    if (!textoGerado) return;
    navigator.clipboard.writeText(textoGerado);
    setCopiado(true);
    toast.success('Peça recursal copiada para a área de transferência!');
    setTimeout(() => setCopiado(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* CABEÇALHO */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-[#0A2540] text-white rounded-xl shadow-md">
                <Scale size={24} />
              </span>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Recursos Administrativos & Contrarrazões
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  Organize os argumentos do seu recurso com apoio da Lei 14.133/2021 e de referências do TCU.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={carregarExemplo}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all shadow-sm"
            >
              Carregar Exemplo de Inabilitação
            </button>
          </div>
        </header>

        {/* CARDS DE PRAZOS PROCESSUAIS (LEI 14.133/21) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Prazo Recursal
              </p>
              <p className="text-xl font-black text-[#0A2540]">3 Dias Úteis</p>
              <p className="text-[11px] text-slate-500 font-bold">Art. 165, I — Proposta & Habilitação</p>
            </div>
            <div className="p-3 bg-blue-50 text-[#0A2540] rounded-xl">
              <Clock size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Contrarrazões
              </p>
              <p className="text-xl font-black text-[#EA580C]">3 Dias Úteis</p>
              <p className="text-[11px] text-slate-500 font-bold">Art. 165, § 1º — Da intimação</p>
            </div>
            <div className="p-3 bg-orange-50 text-[#EA580C] rounded-xl">
              <BookOpen size={24} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Decisão da Autoridade
              </p>
              <p className="text-xl font-black text-emerald-700">10 Dias Úteis</p>
              <p className="text-[11px] text-slate-500 font-bold">Art. 165, § 2º — Julgamento final</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={24} />
            </div>
          </div>
        </div>

        {/* WORKSPACE DO RECURSO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* FORMULÁRIO */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
            <form onSubmit={handleGerarPeca} className="space-y-4">
              <div>
                <label className="text-xs font-black uppercase text-slate-700 block mb-1.5">
                  Modalidade da Peça Processual
                </label>
                <select
                  value={tipoRecurso}
                  onChange={(e: any) => setTipoRecurso(e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                >
                  <option value="JULGAMENTO_PROPOSTA">Recurso contra Julgamento de Proposta (Art. 165, I, b)</option>
                  <option value="HABILITACAO_INABILITACAO">Recurso contra Habilitação / Inabilitação (Art. 165, I, a)</option>
                  <option value="CONTRARRAZOES">Contrarrazões ao Recurso de Concorrente (Art. 165, § 1º)</option>
                  <option value="RECONSIDERACAO">Pedido de Reconsideração ao Pregoeiro</option>
                </select>
              </div>

              {/* SELETOR DE EDITAIS MONITORADOS OU PROPOSTAS */}
              <EditalSelector
                label="Edital / Processo Vinculado"
                selectedId={urlEditalId}
                onSelectEdital={handleSelectEdital}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1.5">
                    Número do Edital
                  </label>
                  <input
                    type="text"
                    value={editalNumero}
                    onChange={(e) => setEditalNumero(e.target.value)}
                    placeholder="Auto-preenchido pelo seletor acima..."
                    className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-700 block mb-1.5">
                    Órgão Licitante
                  </label>
                  <input
                    type="text"
                    value={orgao}
                    onChange={(e) => setOrgao(e.target.value)}
                    placeholder="Auto-preenchido pelo seletor acima..."
                    className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-700 block mb-1.5">
                  Licitante Envolvido / Recorrido
                </label>
                <input
                  type="text"
                  value={licitanteAlvo}
                  onChange={(e) => setLicitanteAlvo(e.target.value)}
                  placeholder="Ex: Nome / Razão Social da empresa que deve ser inabilitada/desclassificada"
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C]"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-700 block mb-1.5">
                  Fatos, Irregularidades e Motivos do Recurso
                </label>
                <textarea
                  value={fundamentacao}
                  onChange={(e) => setFundamentacao(e.target.value)}
                  rows={6}
                  placeholder="Descreva claramente o que ocorreu: falta de atestado, balanço irregular, descumprimento de item técnico, certidão vencida, proposta inexequível..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#EA580C] resize-none leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={gerando || !fundamentacao.trim()}
                className="w-full py-3 px-4 rounded-xl bg-[#EA580C] hover:bg-orange-600 disabled:bg-slate-300 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                {gerando ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Elaborando Peça com Jurisprudência do TCU...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Preparar recurso
                  </>
                )}
              </button>
            </form>
          </div>

          {/* VISUALIZADOR DA PEÇA GERADA */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[#0A2540]" />
                <h3 className="font-black text-slate-900 text-sm">
                  Minuta da Peça Jurídica Pronta para Peticionamento
                </h3>
              </div>

              {textoGerado && (
                <button
                  onClick={copiarTexto}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  {copiado ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copiado ? 'Copiado para Área de Transferência' : 'Copiar Texto Completo'}
                </button>
              )}
            </div>

            <div className="flex-1 mt-4 p-6 bg-slate-50 border border-slate-200/60 rounded-xl overflow-y-auto max-h-[580px]">
              {textoGerado ? (
                <div className="prose prose-sm max-w-none text-slate-900 text-xs leading-relaxed whitespace-pre-wrap font-serif">
                  {textoGerado}
                </div>
              ) : (
                <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="p-4 bg-white rounded-full border border-slate-200 shadow-sm text-slate-400">
                    <Scale size={32} className="text-[#0A2540]" />
                  </div>
                  <h4 className="font-black text-slate-800 text-sm">
                    Nenhuma peça elaborada no momento
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Preencha as informações ao lado e clique em "Preparar recurso" para organizar a minuta. Revise o conteúdo antes de protocolar.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecursosPage;
