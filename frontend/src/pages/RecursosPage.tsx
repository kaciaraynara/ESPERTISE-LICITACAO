import React, { useRef, useState } from 'react';
import {
  Upload,
  FileText,
  Scale,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Clock,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';
import { lexApi } from '../services/api';

export default function RecursosPage() {
  const { selectedCompany } = useCompany();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [arquivoNome, setArquivoNome] = useState('');
  const [orgao, setOrgao] = useState('');
  const [modalidade, setModalidade] = useState('Pregão Eletrônico');
  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [objeto, setObjeto] = useState('');
  const [motivos, setMotivos] = useState('');
  const [etapaAnalise, setEtapaAnalise] = useState<1 | 2 | 3 | 4>(1);
  const [minutaGerada, setMinutaGerada] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [gerandoIa, setGerandoIa] = useState(false);

  const handleSelecionarArquivo = (file?: File) => {
    if (!file) return;
    setArquivoNome(file.name);
    setEtapaAnalise(2);

    // Se for arquivo de texto, tenta extrair conteúdo para o campo de motivos
    if (file.type.includes('text') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          setMotivos((prev) => (prev ? `${prev}\n\n[Trecho extraído do arquivo]:\n${text.slice(0, 1500)}` : text.slice(0, 1500)));
        }
      };
      reader.readAsText(file);
    }
    setEtapaAnalise(3);
  };

  const handleGerarMinuta = async (e: React.FormEvent) => {
    e.preventDefault();
    setGerandoIa(true);

    const empresa = selectedCompany?.razaoSocial || 'Empresa Licitante Proponente';
    const cnpj = selectedCompany?.cnpj || 'CNPJ não informado';
    const compAny = selectedCompany as any;
    const endereco = compAny?.cidade ? `${compAny.cidade}/${compAny.estado || 'UF'}` : 'Sede da Empresa';
    const representante = compAny?.nome || compAny?.representanteLegal || 'Representante Legal';

    let analiseIaPersonalizada = '';

    try {
      // Chama inteligência jurídica conectada ao backend com jurisprudência da Lei 14.133/2021
      const resp = await lexApi.recurso({
        motivoDesclassificacao: motivos || 'Inabilitação indevida ou desclassificação desproporcional da proposta',
        contextoAdicional: `Órgão: ${orgao || 'Administração Licitante'}, Processo: ${numeroProcesso || 'Edital Oficial'}, Modalidade: ${modalidade}, Objeto: ${objeto}, Documento anexado: ${arquivoNome || 'Nenhum'}`.trim(),
      });

      const data = resp?.data as any;
      if (data?.resposta || data?.content || data?.texto_recurso) {
        analiseIaPersonalizada = String(data?.resposta || data?.content || data?.texto_recurso).trim();
      }
    } catch {
      // Fallback seguro caso backend esteja temporariamente sem conexão com IA
    } finally {
      setGerandoIa(false);
    }

    const fundamentosJuridicos = analiseIaPersonalizada
      ? analiseIaPersonalizada
      : [
          'A decisão combatida diverge da jurisprudência pacífica e consolidada do Tribunal de Contas da União (TCU) e da doutrina administrativista especializada:',
          'a) Atestados de Qualificação Técnica: Conforme estabelece a Súmula nº 275 do TCU e o Artigo 67, § 2º da Lei 14.133/2021, é expressamente vedada a exigência de atestados com quantitativos superiores a 50% da parcela de maior relevância, configurando restrição indevida à ampla concorrência;',
          'b) Demonstrações Contábeis e Índices de Liquidez: Na esteira da Súmula nº 263 do TCU e do Artigo 69 da Lei 14.133/2021, a comprovação da saúde financeira da licitante deve ater-se a índices usuais e razoáveis (Liquidez Geral, Liquidez Corrente e Solvência Geral maiores que 1,0), sendo vedada a fixação de exigências desproporcionais;',
          'c) Princípio da Razoabilidade e Seleção da Proposta Mais Vantajosa: A jurisprudência do TCU (Acórdãos 1.211/2021-Plenário e 2.443/2021-Plenário) condena o formalismo exacerbado em desfavor da proposta mais vantajosa para o erário público.',
        ].join('\n');

    const texto = [
      `ILUSTRÍSSIMO(A) SENHOR(A) PREGOEIRO(A) / AGENTE DE CONTRATAÇÃO DA COMISSÃO DE CONTRATAÇÃO`,
      `ÓRGÃO LICITANTE: ${orgao.toUpperCase() || 'ADMINISTRAÇÃO PÚBLICA LICITANTE'}`,
      `PROCESSO LICITATÓRIO: ${modalidade.toUpperCase()} Nº ${numeroProcesso || 'S/N'}`,
      `OBJETO: ${objeto || 'Conforme especificado no instrumento convocatório'}`,
      '',
      `RECORRENTE: ${empresa.toUpperCase()}, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº ${cnpj}, com sede em ${endereco}, por intermédio de seu representante legal infra-assinado, vem, respeitosamente, à presença de Vossa Senhoria, com fundamento no Artigo 165, inciso I, da Lei Federal nº 14.133/2021 c/c Artigo 5º, inciso LV da Constituição Federal de 1988, interpor o presente`,
      '',
      '                       RECURSO ADMINISTRATIVO',
      '        (COM PEDIDO DE EFEITO SUSPENSIVO - ART. 168 DA LEI 14.133/2021)',
      '',
      'em face da decisão proferida na fase de propostas/habilitação no certame em epígrafe, pelas razões fáticas e jurídicas a seguir expostas:',
      '',
      '1. DA TEMPESTIVIDADE E DO CABIMENTO (ART. 165 E ART. 183 DA LEI 14.133/2021)',
      'O presente recurso é tempestivo, uma vez que interposto estritamente no prazo legal de 3 (três) dias úteis previsto no Artigo 165, inciso I da Lei nº 14.133/2021. Cumpre destacar que, nos termos do Artigo 183 da referida Lei Geral de Licitações, a contagem dos prazos processuais exclui o dia do começo e inclui o do vencimento, considerando-se exclusivamente os dias úteis, estando preenchidos todos os pressupostos de admissibilidade.',
      '',
      '2. DOS FATOS E DA VIOLAÇÃO AOS PRINCÍPIOS DA VINCULAÇÃO E DA ISONOMIA',
      motivos || 'Durante a condução do certame, verificou-se manifesto descompasso entre a decisão proferida e as regras objetivas e cogentes estabelecidas no Edital e no Termo de Referência, resultando em afronta direta ao princípio do julgamento objetivo (Art. 5º da Lei 14.133/2021).',
      '',
      '3. DO DIREITO E DA JURISPRUDÊNCIA DO TRIBUNAL DE CONTAS DA UNIÃO (TCU)',
      fundamentosJuridicos,
      '',
      '4. DOS PEDIDOS',
      'Ante todo o exposto, pugna-se pelo conhecimento e provimento do presente Recurso Administrativo para que:',
      'a) Seja atribuído Efeito Suspensivo ao certame, nos termos do Artigo 168 da Lei Federal nº 14.133/2021, até decisão terminativa;',
      'b) Seja exercido o Juízo de Retratação por este(a) Douto(a) Pregoeiro(a) / Agente de Contratação, reconsiderando-se a decisão recorrida;',
      'c) Caso não seja esse o entendimento de Vossa Senhoria, sejam os presentes autos encaminhados, com as razões recursais e eventuais contrarrazões, à Autoridade Superior competente para que promova a reforma integral da decisão.',
      '',
      `Nestes termos, pede e espera deferimento.`,
      '',
      `Local e Data: ${new Date().toLocaleDateString('pt-BR')}`,
      '',
      `_________________________________________________`,
      `${empresa.toUpperCase()}`,
      `Representante Legal: ${representante}`,
      `CNPJ: ${cnpj}`,
    ].join('\n');

    setMinutaGerada(texto);
    setEtapaAnalise(4);
  };

  const handleCopiar = () => {
    if (!minutaGerada) return;
    navigator.clipboard.writeText(minutaGerada);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#081C3A]">
              Análise e recursos
            </h1>
            <p className="mt-1 text-lg font-bold text-[#081C3A]">
              Revise documentos e acompanhe providências com clareza
            </p>
            <p className="mt-0.5 max-w-2xl text-sm text-slate-500">
              Envie o edital, impugnação ou recurso e organize os principais pontos e prazos da Lei 14.133/2021.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 self-start rounded-full bg-[#FF6600] px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00]"
          >
            Iniciar análise
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Prazos legais em destaque */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Prazo Recursal</p>
              <p className="mt-1 text-xl font-extrabold text-[#081C3A]">3 Dias Úteis</p>
              <p className="text-xs text-slate-500">Art. 165, I — Proposta e Habilitação</p>
            </div>
            <Clock className="h-6 w-6 text-[#0070C0]" />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Contrarrazões</p>
              <p className="mt-1 text-xl font-extrabold text-[#FF6600]">3 Dias Úteis</p>
              <p className="text-xs text-slate-500">Art. 165, § 4º — Da intimação</p>
            </div>
            <Scale className="h-6 w-6 text-[#FF6600]" />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="text-xs font-bold uppercase text-slate-400">Decisão da Autoridade</p>
              <p className="mt-1 text-xl font-extrabold text-[#081C3A]">10 Dias Úteis</p>
              <p className="text-xs text-slate-500">Art. 165, § 2º — Julgamento final</p>
            </div>
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
        </div>

        {/* 3 cards principais do modelo */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Card 1: Upload */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-extrabold text-[#081C3A]">Envie seu documento</h2>
            <p className="mt-1 text-xs text-slate-500">
              Selecione o edital, impugnação ou recurso para iniciar a revisão.
            </p>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-4 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center transition hover:border-[#0070C0] hover:bg-blue-50/30"
            >
              <Upload className="h-8 w-8 text-[#0070C0]" />
              <p className="mt-3 text-xs font-bold text-[#081C3A]">
                {arquivoNome || 'Arraste o arquivo aqui ou clique para selecionar'}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Formatos aceitos: PDF, DOC, DOCX</p>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => handleSelecionarArquivo(e.target.files?.[0])}
            />
          </div>

          {/* Card 2: Identificação do processo */}
          <form
            onSubmit={handleGerarMinuta}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#0070C0]" />
              <h2 className="text-base font-extrabold text-[#081C3A]">Identificação do processo</h2>
            </div>

            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={orgao}
                onChange={(e) => setOrgao(e.target.value)}
                placeholder="Órgão comprador"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-[#0070C0]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={modalidade}
                  onChange={(e) => setModalidade(e.target.value)}
                  placeholder="Modalidade"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0070C0]"
                />
                <input
                  type="text"
                  value={numeroProcesso}
                  onChange={(e) => setNumeroProcesso(e.target.value)}
                  placeholder="Nº do processo"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-[#0070C0]"
                />
              </div>
              <input
                type="text"
                value={objeto}
                onChange={(e) => setObjeto(e.target.value)}
                placeholder="Objeto da licitação"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-[#0070C0]"
              />
              <textarea
                rows={2}
                value={motivos}
                onChange={(e) => setMotivos(e.target.value)}
                placeholder="Descreva os fatos e pontos que precisam de recurso ou impugnação..."
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs outline-none focus:border-[#0070C0]"
              />
              <button
                type="submit"
                disabled={gerandoIa}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0070C0] py-2.5 text-xs font-bold text-white transition hover:bg-[#005ea3] disabled:opacity-60 cursor-pointer"
              >
                {gerandoIa ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Redigindo fundamentação com inteligência jurídica...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Redigir Recurso / Impugnação</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Card 3: Acompanhamento da análise */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-extrabold text-[#081C3A]">Acompanhamento da análise</h2>

            <div className="mt-4 space-y-4">
              {[
                { passo: 1, titulo: 'Upload do documento', desc: 'Envie o edital ou peça processual.' },
                { passo: 2, titulo: 'Análise em andamento', desc: 'Identificando prazos e exigências.' },
                { passo: 3, titulo: 'Síntese pronta', desc: 'Resumo e pontos de atenção disponíveis.' },
                { passo: 4, titulo: 'Acompanhamento', desc: 'Minuta pronta para revisão e protocolo.' },
              ].map((item) => {
                const concluido = etapaAnalise >= item.passo;
                return (
                  <div key={item.passo} className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                        concluido
                          ? 'border-[#FF6600] bg-orange-50 text-[#FF6600]'
                          : 'border-slate-200 text-slate-400'
                      }`}
                    >
                      {item.passo}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#081C3A]">{item.titulo}</p>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Síntese e Pontos de atenção */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#0070C0]" />
                <h3 className="text-base font-extrabold text-[#081C3A]">Síntese e Minuta</h3>
              </div>
              {minutaGerada && (
                <button
                  type="button"
                  onClick={handleCopiar}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-[#081C3A] hover:bg-slate-200"
                >
                  {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiado ? 'Copiado' : 'Copiar texto'}
                </button>
              )}
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 font-sans text-xs leading-relaxed text-slate-700">
              {minutaGerada ||
                'Preencha os dados do processo ao lado e clique em "Organizar minuta jurídica" para gerar o texto pronto para revisão.'}
            </pre>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#FF6600]" />
              <h3 className="text-base font-extrabold text-[#081C3A]">Pontos de atenção</h3>
            </div>
            <ul className="mt-4 space-y-2.5 text-xs text-slate-600">
              <li className="rounded-2xl bg-slate-50 p-3">
                <strong>Tempestividade:</strong> Manifeste a intenção de recorrer imediatamente após a declaração de vencedor no portal da disputa.
              </li>
              <li className="rounded-2xl bg-slate-50 p-3">
                <strong>Documentos comprobatórios:</strong> Anexe os atestados ou certidões citados antes de protocolar as razões finais.
              </li>
              <li className="rounded-2xl bg-slate-50 p-3">
                <strong>Revisão profissional:</strong> Use a minuta organizada como base estratégica e valide com seu responsável jurídico antes do envio.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}