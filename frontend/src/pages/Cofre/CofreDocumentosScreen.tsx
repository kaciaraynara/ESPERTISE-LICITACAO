import React, { useState } from 'react';
import {
  ShieldCheck, AlertTriangle, XCircle, FileText, Download,
  Search, RefreshCw, CheckCircle2, Clock,
  Layers, BarChart3, Sparkles, History, Plus
} from 'lucide-react';
import { DocumentoCofre } from '../../types/cofre.types';

export const CofreDocumentosScreen: React.FC = () => {
  const [abaAtiva, setAbaAtiva] = useState<string>('TODOS');
  const [busca, setBusca] = useState('');

  // Dados Simulados do Cofre
  const documentos: DocumentoCofre[] = [
    {
      id: 'doc-01',
      nome: 'Certidão Negativa de Débitos Federais (PGFN)',
      categoria: 'REGULARIDADE_FISCAL',
      orgaoEmissor: 'Receita Federal / PGFN',
      dataEmissao: '2026-03-01',
      dataValidade: '2026-08-28',
      diasParaVencer: 21,
      status: 'ALERTA_VENCIMENTO',
      versao: 'v2026.1',
      tamanhoArquivo: '240 KB',
      tag: 'Certidão Crítica',
      arquivoUrl: '#'
    },
    {
      id: 'doc-02',
      nome: 'CRF - Certificado de Regularidade do FGTS',
      categoria: 'REGULARIDADE_FISCAL',
      orgaoEmissor: 'Caixa Econômica Federal',
      dataEmissao: '2026-07-15',
      dataValidade: '2026-09-15',
      diasParaVencer: 39,
      status: 'VALIDO',
      versao: 'v2026.3',
      tamanhoArquivo: '180 KB',
      tag: 'Regularidade',
      arquivoUrl: '#'
    },
    {
      id: 'doc-03',
      nome: 'Certidão Negativa de Débitos Trabalhistas (CNDT)',
      categoria: 'REGULARIDADE_FISCAL',
      orgaoEmissor: 'Tribunal Superior do Trabalho',
      dataEmissao: '2026-02-10',
      dataValidade: '2026-08-05',
      diasParaVencer: -2,
      status: 'VENCIDO',
      versao: 'v2026.1',
      tamanhoArquivo: '310 KB',
      tag: 'Urgente Renovação',
      arquivoUrl: '#'
    },
    {
      id: 'doc-04',
      nome: 'Atestado de Capacidade Técnica - Redes e Conectividade',
      categoria: 'QUALIFICACAO_TECNICA',
      orgaoEmissor: 'Prodesp / Governo SP',
      dataEmissao: '2024-05-10',
      dataValidade: '2030-12-31',
      diasParaVencer: 1500,
      status: 'VALIDO',
      versao: 'v1.0',
      tamanhoArquivo: '1.4 MB',
      tag: 'Atestado Principal',
      arquivoUrl: '#'
    },
    {
      id: 'doc-05',
      nome: 'Balanço Patrimonial e DRE Demonstrativo (2025)',
      categoria: 'QUALIFICACAO_FINANCEIRA',
      orgaoEmissor: 'Junta Comercial / Contabilidade',
      dataEmissao: '2026-04-30',
      dataValidade: '2027-04-30',
      diasParaVencer: 266,
      status: 'VALIDO',
      versao: 'v2025.Final',
      tamanhoArquivo: '4.2 MB',
      tag: 'Índices Financeiros',
      arquivoUrl: '#'
    }
  ];

  const formatarData = (dataStr: string) => {
    if (!dataStr) return '-';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const getBadgeStatus = (status: string, dias: number) => {
    switch (status) {
      case 'VALIDO':
        return (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 w-fit">
            <CheckCircle2 size={12} /> Válido ({dias}d)
          </span>
        );
      case 'ALERTA_VENCIMENTO':
        return (
          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 w-fit">
            <Clock size={12} /> Vence em {dias} dias
          </span>
        );
      case 'VENCIDO':
        return (
          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 w-fit">
            <XCircle size={12} /> Vencido
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      
      {/* SIDEBAR NAVEGAÇÃO */}
      <aside className="w-60 bg-[#0B1736] text-white flex flex-col justify-between p-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-orange-500 flex items-center justify-center font-bold text-xs">
              EL
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide">EXPERTISE</h1>
              <p className="text-[10px] text-blue-400 font-semibold tracking-wider">LICITATÓRIA</p>
            </div>
          </div>

          <nav className="space-y-1 text-xs">
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <Layers size={16} /> <span>Página Inicial</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <Search size={16} /> <span>Radar de Editais</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <BarChart3 size={16} /> <span>Análise de Viabilidade</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <Sparkles size={16} /> <span>Leitor LEX AI</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-orange-500 text-white font-semibold shadow">
              <ShieldCheck size={16} /> <span>Cofre de Documentos</span>
            </a>
            <a href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-slate-400 hover:bg-slate-800 transition">
              <History size={16} /> <span>Histórico de Disputas</span>
            </a>
          </nav>
        </div>

        <div className="bg-slate-800/80 rounded-lg p-3 text-xs">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Sincronização CND</p>
          <div className="flex items-center gap-2 mt-1 text-emerald-400 font-semibold text-[11px]">
            <RefreshCw size={12} className="animate-spin" /> Emissor Federal Ativo
          </div>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* HEADER */}
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Cofre de Habilitação & Certidões
              <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                Conformidade Jurídica
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Repositório central de CNDs, atestados técnicos e balanços. Emissão e validação de prazos em tempo real.
            </p>
          </div>

          <button className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow transition flex items-center gap-2">
            <Plus size={16} /> Upload de Novo Documento
          </button>
        </header>

        <div className="p-8 space-y-6">
          
          {/* BANNER DE MÉTRICAS */}
          <div className="grid grid-cols-4 gap-4">
            
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total em Cofre</span>
                <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><FileText size={16} /></div>
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">24</p>
              <p className="text-[11px] text-slate-500 mt-1">Documentos cadastrados</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Habilitados / Válidos</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><ShieldCheck size={16} /></div>
              </div>
              <p className="text-2xl font-black text-emerald-600 mt-2">22</p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">100% aptos para edital</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Atenção (A vencer)</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock size={16} /></div>
              </div>
              <p className="text-2xl font-black text-amber-600 mt-2">1</p>
              <p className="text-[11px] text-amber-600 font-semibold mt-1">Vence nos próximos 30 dias</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Inabilitados (Vencidos)</span>
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><AlertTriangle size={16} /></div>
              </div>
              <p className="text-2xl font-black text-rose-600 mt-2">1</p>
              <p className="text-[11px] text-rose-600 font-bold mt-1">Bloqueia habilitação</p>
            </div>

          </div>

          {/* TABs E FILTROS DE PESQUISA */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            
            {/* ABAS CATEGORIAS */}
            <div className="flex gap-2 border-b border-slate-100 pb-3 text-xs">
              {[
                { id: 'TODOS', label: 'Todos os Arquivos' },
                { id: 'REGULARIDADE_FISCAL', label: 'Regularidade Fiscal (CNDs)' },
                { id: 'QUALIFICACAO_TECNICA', label: 'Atestados Técnicos' },
                { id: 'QUALIFICACAO_FINANCEIRA', label: 'Balanço & Financeiro' },
                { id: 'HABILITACAO_JURIDICA', label: 'Habilitação Jurídica' }
              ].map((aba) => (
                <button
                  key={aba.id}
                  onClick={() => setAbaAtiva(aba.id)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${
                    abaAtiva === aba.id 
                      ? 'bg-[#0B1736] text-white shadow' 
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {aba.label}
                </button>
              ))}
            </div>

            {/* BUSCA TEXTUAL */}
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="Filtrar documento por nome, órgão ou tag..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 rounded-lg text-xs font-medium focus:outline-none focus:border-blue-500 transition"
              />
            </div>

          </div>

          {/* TABELA DE DOCUMENTOS */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Documento & Órgão</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4">Emissão</th>
                  <th className="py-3.5 px-4">Validade</th>
                  <th className="py-3.5 px-4">Status Validade</th>
                  <th className="py-3.5 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documentos.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition">
                    
                    {/* NOME E ÓRGÃO */}
                    <td className="py-4 px-4 align-top space-y-1">
                      <span className="font-bold text-slate-900 block">{doc.nome}</span>
                      <p className="text-slate-500 text-[11px]">{doc.orgaoEmissor}</p>
                      <span className="inline-block bg-slate-100 text-slate-600 text-[9px] font-medium px-2 py-0.5 rounded">
                        {doc.tag} • {doc.tamanhoArquivo}
                      </span>
                    </td>

                    {/* CATEGORIA */}
                    <td className="py-4 px-4 align-top font-medium text-slate-700">
                      {doc.categoria.replace('_', ' ')}
                    </td>

                    {/* EMISSÃO */}
                    <td className="py-4 px-4 align-top text-slate-600 whitespace-nowrap">
                      {formatarData(doc.dataEmissao)}
                    </td>

                    {/* VALIDADE */}
                    <td className="py-4 px-4 align-top font-bold text-slate-900 whitespace-nowrap">
                      {formatarData(doc.dataValidade)}
                    </td>

                    {/* BADGE DE STATUS */}
                    <td className="py-4 px-4 align-top">
                      {getBadgeStatus(doc.status, doc.diasParaVencer)}
                    </td>

                    {/* AÇÕES */}
                    <td className="py-4 px-4 align-top text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        
                        <button 
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition"
                          title="Baixar Arquivo PDF"
                        >
                          <Download size={14} />
                        </button>

                        <button 
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold text-[11px] transition flex items-center gap-1"
                        >
                          <RefreshCw size={12} /> Atualizar CND
                        </button>

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

      </div>

    </div>
  );
};