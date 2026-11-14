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
} from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';

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

  const handleSelecionarArquivo = (file?: File) => {
    if (!file) return;
    setArquivoNome(file.name);
    setEtapaAnalise(2);
    setTimeout(() => setEtapaAnalise(3), 500);
  };

  const handleGerarMinuta = (e: React.FormEvent) => {
    e.preventDefault();
    const empresa = selectedCompany?.razaoSocial || 'Empresa Licitante';
    const cnpj = selectedCompany?.cnpj || 'CNPJ cadastrado';

    const texto = [
      `AO PREGOEIRO / AGENTE DE CONTRATAÇÃO DO ${orgao.toUpperCase() || 'ÓRGÃO LICITANTE'}`,
      `Referência: ${modalidade} nº ${numeroProcesso || 'A informar'}`,
      `Objeto: ${objeto || 'Conforme edital'}`,
      '',
      `${empresa}, inscrita no CNPJ sob o nº ${cnpj}, vem, tempestivamente, com fundamento no art. 165 da Lei nº 14.133/2021, apresentar as razões de seu pedido:`,
      '',
      '1. DOS FATOS E FUNDAMENTOS',
      motivos || 'Conforme análise detalhada dos documentos do processo licitatório.',
      '',
      '2. DO PEDIDO',
      'Diante do exposto, requer o recebimento e acolhimento da presente manifestação para que seja revista a decisão apontada, garantindo a observância aos princípios da legalidade, isonomia e seleção da proposta mais vantajosa.',
      '',
      `Termos em que pede deferimento.`,
      `${empresa}`,
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
                className="w-full rounded-full bg-[#0070C0] py-2.5 text-xs font-bold text-white transition hover:bg-[#005ea3]"
              >
                Organizar minuta jurídica
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