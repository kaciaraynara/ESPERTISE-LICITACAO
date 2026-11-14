import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Download,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { crmApi } from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';
import * as pdfGen from '../../utils/pdfGenerator';

interface ItemProposta {
  id: string;
  numero: number;
  descricao: string;
  unidade: string;
  quantidade: number;
  marcaModelo: string;
  custoUnitario: number;
  valorUnitario: number;
}

const ETAPAS = [
  { id: 1, label: 'Identificação' },
  { id: 2, label: 'Itens' },
  { id: 3, label: 'Valores' },
  { id: 4, label: 'Documentos' },
  { id: 5, label: 'Revisão' },
];

function moeda(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

export function PropostasPage() {
  const { selectedCompany } = useCompany();

  const [etapa, setEtapa] = useState(1);
  const [oportunidades, setOportunidades] = useState<any[]>([]);
  const [editalEscolhidoId, setEditalEscolhidoId] = useState('');

  const [orgao, setOrgao] = useState('');
  const [modalidade, setModalidade] = useState('Pregão Eletrônico');
  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [dataAbertura, setDataAbertura] = useState('');
  const [objeto, setObjeto] = useState('');

  const [itens, setItens] = useState<ItemProposta[]>([
    {
      id: '1',
      numero: 1,
      descricao: '',
      unidade: 'UN',
      quantidade: 1,
      marcaModelo: 'Fabricação Própria / Nacional',
      custoUnitario: 0,
      valorUnitario: 0,
    },
  ]);
  const [margemPercentual, setMargemPercentual] = useState(20);
  const [despesasPercentual, setDespesasPercentual] = useState(12);

  const [validadeDias, setValidadeDias] = useState(60);
  const [prazoEntrega, setPrazoEntrega] = useState('Até 15 dias úteis após o pedido oficial');
  const [garantia, setGarantia] = useState('12 meses contra defeitos de fabricação');
  const [declaracoesAceitas, setDeclaracoesAceitas] = useState(true);
  const [geradoMsg, setGeradoMsg] = useState<string | null>(null);

  useEffect(() => {
    crmApi
      .getOportunidades()
      .then((resp) => {
        const lista = resp?.data?.items || resp?.data?.data || resp?.data || [];
        if (Array.isArray(lista)) setOportunidades(lista);
      })
      .catch(() => {});
  }, []);

  const handleSelecionarOportunidade = (id: string) => {
    setEditalEscolhidoId(id);
    const op = oportunidades.find((o) => String(o.id) === id);
    if (!op) return;
    const notice = op.notice || {};
    setOrgao(notice.orgaoEntidade?.razaoSocial || notice.orgaoNome || '');
    setModalidade(notice.modalidadeNome || notice.modalidade || 'Pregão Eletrônico');
    setNumeroProcesso(notice.numeroCompra ? `${notice.numeroCompra}/${notice.anoCompra || ''}` : '');
    setDataAbertura(
      notice.dataEncerramentoProposta
        ? new Date(notice.dataEncerramentoProposta).toLocaleDateString('pt-BR')
        : ''
    );
    setObjeto(notice.objetoCompra || notice.objeto || op.notes || '');
  };

  const adicionarItem = () => {
    setItens((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        numero: prev.length + 1,
        descricao: '',
        unidade: 'UN',
        quantidade: 1,
        marcaModelo: 'Conforme especificação do edital',
        custoUnitario: 0,
        valorUnitario: 0,
      },
    ]);
  };

  const atualizarItem = (id: string, campo: keyof ItemProposta, valor: any) => {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const atualizado = { ...item, [campo]: valor };
        if (campo === 'custoUnitario') {
          const fator = 1 + (margemPercentual + despesasPercentual) / 100;
          atualizado.valorUnitario = Number((Number(valor || 0) * fator).toFixed(2));
        }
        return atualizado;
      })
    );
  };

  const removerItem = (id: string) => {
    if (itens.length === 1) return;
    setItens((prev) => prev.filter((i) => i.id !== id).map((item, idx) => ({ ...item, numero: idx + 1 })));
  };

  const aplicarMargemEmTodos = () => {
    const fator = 1 + (margemPercentual + despesasPercentual) / 100;
    setItens((prev) =>
      prev.map((item) => ({
        ...item,
        valorUnitario: Number((item.custoUnitario * fator).toFixed(2)),
      }))
    );
  };

  const totalGeral = useMemo(
    () => itens.reduce((acc, item) => acc + item.quantidade * item.valorUnitario, 0),
    [itens]
  );

  const handleGerarPdf = () => {
    const emp = selectedCompany as any;
    const gerarFn =
      (pdfGen as any).gerarPropostaComercialPdf ||
      (pdfGen as any).gerarPropostaPDF ||
      (pdfGen as any).default;

    if (typeof gerarFn === 'function') {
      gerarFn({
        empresa: {
          razaoSocial: emp?.razaoSocial || 'Empresa Licitante',
          cnpj: emp?.cnpj || '',
          endereco: emp?.endereco || '',
          cidadeUf: [emp?.cidade, emp?.uf].filter(Boolean).join(' - '),
          telefone: emp?.telefone || '',
          email: emp?.email || '',
        },
        orgao: orgao || 'Órgão Licitante',
        numeroProcesso: numeroProcesso || '001/2026',
        modalidade,
        objeto: objeto || 'Fornecimento conforme especificações do edital',
        validadeDias,
        prazoEntrega,
        garantia,
        itens: itens.map((i) => ({
          numero: i.numero,
          descricao: i.descricao || 'Item conforme termo de referência',
          unidade: i.unidade,
          quantidade: i.quantidade,
          marca: i.marcaModelo,
          valorUnitario: i.valorUnitario,
          valorTotal: i.quantidade * i.valorUnitario,
        })),
      });
    } else {
      window.print();
    }
    setGeradoMsg('Proposta comercial gerada com sucesso!');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#081C3A]">
              Gerador de propostas
            </h1>
            <p className="mt-1 text-lg font-bold text-[#081C3A]">
              Prepare sua proposta com clareza
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              Do edital selecionado à proposta final, em etapas simples e organizadas para a sua empresa.
            </p>
          </div>

          <div className="inline-flex items-center gap-3 self-start rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <div>
              <p className="text-xs font-bold text-[#081C3A]">Rascunho salvo</p>
              <p className="text-[11px] text-slate-500">Suas alterações estão seguras • Agora</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-8">
            <div className="mb-8 flex items-center justify-between">
              {ETAPAS.map((step, idx) => {
                const ativa = etapa === step.id;
                const concluida = etapa > step.id;
                return (
                  <React.Fragment key={step.id}>
                    <button
                      type="button"
                      onClick={() => setEtapa(step.id)}
                      className="flex flex-col items-center gap-2 text-center"
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition ${
                          ativa
                            ? 'bg-[#FF6600] text-white shadow-sm'
                            : concluida
                            ? 'bg-[#0070C0] text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {step.id}
                      </div>
                      <span className={`text-xs font-bold ${ativa ? 'text-[#081C3A]' : 'text-slate-400'}`}>
                        {step.label}
                      </span>
                    </button>
                    {idx < ETAPAS.length - 1 && (
                      <div className={`mx-2 h-0.5 flex-1 ${etapa > step.id ? 'bg-[#0070C0]' : 'bg-slate-200'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {etapa === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#081C3A]">Identificação do edital</h2>
                  <p className="text-xs text-slate-500">
                    Selecione uma oportunidade salva ou confirme os dados do edital para iniciar sua proposta.
                  </p>
                </div>

                {oportunidades.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#081C3A]">
                      Carregar edital salvo na Gestão de Disputas
                    </label>
                    <select
                      value={editalEscolhidoId}
                      onChange={(e) => handleSelecionarOportunidade(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#081C3A] outline-none focus:border-[#0070C0]"
                    >
                      <option value="">-- Selecione um edital salvo (opcional) --</option>
                      {oportunidades.map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.notice?.orgaoEntidade?.razaoSocial || 'Órgão'} —{' '}
                          {(op.notice?.objetoCompra || op.notes || 'Edital').slice(0, 70)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Órgão</label>
                    <input
                      type="text"
                      value={orgao}
                      onChange={(e) => setOrgao(e.target.value)}
                      placeholder="Ex: Prefeitura Municipal"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Data de abertura</label>
                    <input
                      type="text"
                      value={dataAbertura}
                      onChange={(e) => setDataAbertura(e.target.value)}
                      placeholder="Ex: 20/11/2026 às 09:00"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Modalidade</label>
                    <input
                      type="text"
                      value={modalidade}
                      onChange={(e) => setModalidade(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">Número do processo</label>
                    <input
                      type="text"
                      value={numeroProcesso}
                      onChange={(e) => setNumeroProcesso(e.target.value)}
                      placeholder="Ex: 014/2026"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-bold text-slate-500">Objeto</label>
                    <textarea
                      rows={2}
                      value={objeto}
                      onChange={(e) => setObjeto(e.target.value)}
                      placeholder="Descreva o objeto da licitação"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                    />
                  </div>
                </div>
              </div>
            )}

            {etapa === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold text-[#081C3A]">Itens da proposta</h2>
                    <p className="text-xs text-slate-500">
                      Informe os produtos ou serviços, quantidades e marca ofertada.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={adicionarItem}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#0070C0] px-4 py-2 text-xs font-bold text-white hover:bg-[#005ea3]"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar item
                  </button>
                </div>

                <div className="space-y-3">
                  {itens.map((item) => (
                    <div key={item.id} className="space-y-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-[#0070C0]">Item #{item.numero}</span>
                        {itens.length > 1 && (
                          <button type="button" onClick={() => removerItem(item.id)} className="text-slate-400 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={item.descricao}
                        onChange={(e) => atualizarItem(item.id, 'descricao', e.target.value)}
                        placeholder="Descrição completa do item conforme edital"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none focus:border-[#0070C0]"
                      />
                      <div className="grid grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={item.unidade}
                          onChange={(e) => atualizarItem(item.id, 'unidade', e.target.value)}
                          placeholder="Unidade (UN, CX)"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                        />
                        <input
                          type="number"
                          min={1}
                          value={item.quantidade}
                          onChange={(e) => atualizarItem(item.id, 'quantidade', Number(e.target.value))}
                          placeholder="Quantidade"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                        />
                        <input
                          type="text"
                          value={item.marcaModelo}
                          onChange={(e) => atualizarItem(item.id, 'marcaModelo', e.target.value)}
                          placeholder="Marca / Modelo"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {etapa === 3 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#081C3A]">Formação de preços</h2>
                  <p className="text-xs text-slate-500">
                    Informe seu custo de compra ou produção e defina sua margem segura de lucro.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#081C3A]">Impostos e Frete (%)</label>
                    <input
                      type="number"
                      value={despesasPercentual}
                      onChange={(e) => setDespesasPercentual(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#081C3A]">Margem de Lucro (%)</label>
                    <input
                      type="number"
                      value={margemPercentual}
                      onChange={(e) => setMargemPercentual(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={aplicarMargemEmTodos}
                      className="w-full rounded-xl bg-[#0070C0] py-2.5 text-xs font-bold text-white hover:bg-[#005ea3]"
                    >
                      Calcular preços sugeridos
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {itens.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 items-center gap-3 rounded-2xl border border-slate-200 p-3.5">
                      <div className="col-span-5">
                        <p className="truncate text-xs font-bold text-[#081C3A]">
                          #{item.numero} {item.descricao || 'Item'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {item.quantidade} {item.unidade}
                        </p>
                      </div>
                      <div className="col-span-3">
                        <label className="block text-[10px] font-bold text-slate-400">Seu custo (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.custoUnitario}
                          onChange={(e) => atualizarItem(item.id, 'custoUnitario', Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400">Preço unitário</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.valorUnitario}
                          onChange={(e) => atualizarItem(item.id, 'valorUnitario', Number(e.target.value))}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-[#0070C0]"
                        />
                      </div>
                      <div className="col-span-2 text-right">
                        <p className="text-[10px] font-bold text-slate-400">Subtotal</p>
                        <p className="text-xs font-extrabold text-[#081C3A]">
                          {moeda(item.quantidade * item.valorUnitario)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {etapa === 4 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#081C3A]">Condições e declarações legais</h2>
                  <p className="text-xs text-slate-500">
                    Confirme os prazos comerciais e as declarações obrigatórias da Lei 14.133/2021.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#081C3A]">Validade da proposta (dias)</label>
                    <input
                      type="number"
                      value={validadeDias}
                      onChange={(e) => setValidadeDias(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#081C3A]">Prazo de entrega</label>
                    <input
                      type="text"
                      value={prazoEntrega}
                      onChange={(e) => setPrazoEntrega(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-bold text-[#081C3A]">Garantia e assistência</label>
                    <input
                      type="text"
                      value={garantia}
                      onChange={(e) => setGarantia(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={declaracoesAceitas}
                    onChange={(e) => setDeclaracoesAceitas(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Incluir automaticamente todas as declarações exigidas pela Lei 14.133/2021 (pleno conhecimento do edital, inexistência de fatos impeditivos, cumprimento do art. 7º XXXIII da CF e enquadramento ME/EPP quando aplicável).
                  </span>
                </label>
              </div>
            )}

            {etapa === 5 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-extrabold text-[#081C3A]">Revisão final</h2>
                  <p className="text-xs text-slate-500">
                    Confira os dados abaixo e clique em Gerar Proposta em PDF para baixar o documento pronto.
                  </p>
                </div>

                <div className="space-y-2 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 text-sm">
                  <p><strong>Empresa:</strong> {selectedCompany?.razaoSocial || 'Sua empresa'}</p>
                  <p><strong>Órgão:</strong> {orgao || 'A informar'} • <strong>Processo:</strong> {numeroProcesso || 'A informar'}</p>
                  <p><strong>Itens:</strong> {itens.length} item(ns) • <strong>Valor Global:</strong> <span className="font-extrabold text-[#0070C0]">{moeda(totalGeral)}</span></p>
                  <p><strong>Validade:</strong> {validadeDias} dias • <strong>Entrega:</strong> {prazoEntrega}</p>
                </div>

                {geradoMsg && (
                  <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
                    {geradoMsg}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGerarPdf}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0070C0] py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#005ea3]"
                >
                  <Download className="h-4 w-4" />
                  Gerar Proposta Comercial em PDF
                </button>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setEtapa((e) => Math.max(1, e - 1))}
                disabled={etapa === 1}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Etapa anterior
              </button>

              {etapa < 5 && (
                <button
                  type="button"
                  onClick={() => setEtapa((e) => Math.min(5, e + 1))}
                  className="inline-flex items-center gap-2 rounded-full bg-[#FF6600] px-6 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#e55b00]"
                >
                  Próxima etapa
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-4">
            <h3 className="text-xl font-extrabold leading-snug text-[#081C3A]">
              Uma proposta mais organizada e competitiva
            </h3>

            <div className="mt-6 space-y-5">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#0070C0]" />
                <p className="text-sm font-semibold text-[#081C3A]">
                  Siga as etapas com orientação passo a passo
                </p>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0070C0]" />
                <p className="text-sm font-semibold text-[#081C3A]">
                  Valide preços e exigências em tempo real
                </p>
              </div>
              <div className="flex items-start gap-3">
                <TrendingUp className="mt-0.5 h-5 w-5 shrink-0 text-[#0070C0]" />
                <p className="text-sm font-semibold text-[#081C3A]">
                  Gere um documento pronto para enviar no portal
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-100 bg-[#F8FAFC] p-5 text-center">
              <p className="text-xs font-semibold text-slate-400">Valor total atual da proposta</p>
              <p className="mt-1 text-2xl font-extrabold text-[#0070C0]">{moeda(totalGeral)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PropostasPage;