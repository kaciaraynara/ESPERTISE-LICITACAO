import React, { useState } from 'react';
import {
  ShieldCheck,
  XCircle,
  FileText,
  Search,
  CheckCircle2,
  Clock,
  Plus,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { documentosApi } from '../../services/api';
import { DocumentoCofre } from '../../types/cofre.types';
import { Link } from 'react-router-dom';
import { FORNECEDOR_ROUTES } from '@/routes';

export const CofreDocumentosScreen: React.FC = () => {
  const [abaAtiva, setAbaAtiva] = useState<string>('TODOS');
  const [busca, setBusca] = useState('');

  const { data: resp, isLoading } = useQuery({
    queryKey: ['cofre_documentos_screen'],
    queryFn: async () => {
      const res = await documentosApi.listar();
      return res.data;
    },
  });

  const rawDocs = Array.isArray(resp?.data) ? resp.data : [];

  const documentos: DocumentoCofre[] = rawDocs.map((doc: any) => {
    const validade = doc.validade || doc.dataValidade || null;
    let diasRestantes = 0;
    let statusCalculado: DocumentoCofre['status'] = 'VALIDO';

    if (validade) {
      diasRestantes = Math.ceil((new Date(validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (diasRestantes < 0) {
        statusCalculado = 'VENCIDO';
      } else if (diasRestantes <= 30) {
        statusCalculado = 'ALERTA_VENCIMENTO';
      }
    }

    return {
      id: doc.id,
      nome: doc.nome || doc.tipo || 'Documento Habilitatório',
      categoria: doc.categoria || 'REGULARIDADE_FISCAL',
      orgaoEmissor: doc.orgaoEmissor || 'Órgão Competente',
      dataEmissao: doc.dataEmissao || doc.criado_em || '',
      dataValidade: validade || '',
      diasParaVencer: diasRestantes,
      status: statusCalculado,
      versao: doc.versao || 'v1.0',
      tamanhoArquivo: doc.tamanho ? `${Math.round(doc.tamanho / 1024)} KB` : 'PDF',
      tag: doc.tipo || 'Habilitação',
      arquivoUrl: doc.url || '#',
    };
  });

  const formatarData = (dataStr: string) => {
    if (!dataStr) return '—';
    try {
      const d = new Date(dataStr);
      return d.toLocaleDateString('pt-BR');
    } catch {
      return dataStr;
    }
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

  const docsFiltrados = documentos.filter((d) => {
    const matchBusca =
      d.nome.toLowerCase().includes(busca.toLowerCase()) ||
      d.orgaoEmissor.toLowerCase().includes(busca.toLowerCase());
    const matchAba = abaAtiva === 'TODOS' || d.categoria === abaAtiva;
    return matchBusca && matchAba;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-6 md:p-8 max-w-7xl mx-auto">
      {/* HEADER */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0A2540] text-white rounded-xl shadow-sm">
              <ShieldCheck size={20} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Cofre de Documentos & Habilitação
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Gestão centralizada de certidões, balanços e atestados para habilitação em licitações (Lei 14.133/2021).
          </p>
        </div>

        <Link
          to={FORNECEDOR_ROUTES.cofre}
          className="px-4 py-2.5 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-2 transition"
        >
          <Plus size={16} /> Enviar Novo Documento
        </Link>
      </header>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por certidão, atestado ou órgão emissor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0A2540]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={abaAtiva}
            onChange={(e) => setAbaAtiva(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none"
          >
            <option value="TODOS">Todas Categorias</option>
            <option value="REGULARIDADE_FISCAL">Regularidade Fiscal</option>
            <option value="QUALIFICACAO_TECNICA">Qualificação Técnica</option>
            <option value="QUALIFICACAO_FINANCEIRA">Qualificação Financeira</option>
          </select>
        </div>
      </div>

      {/* TABELA DE DOCUMENTOS OU EMPTY STATE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[320px] gap-3">
            <Loader2 className="animate-spin text-[#EA580C] w-8 h-8" />
            <p className="text-xs font-bold text-slate-500">Consultando cofre de documentos...</p>
          </div>
        ) : docsFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="p-4 rounded-2xl bg-blue-50 text-[#0A2540] mb-3">
              <FileText size={36} />
            </div>
            <h3 className="text-base font-black text-slate-900">
              Nenhum documento encontrado no cofre
            </h3>
            <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
              Faça upload das suas CNDs, contratos sociais e atestados de capacidade para mantê-los auditados e prontos para disputas.
            </p>
            <Link
              to={FORNECEDOR_ROUTES.cofre}
              className="px-4 py-2 bg-[#EA580C] hover:bg-orange-600 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-2 transition"
            >
              <Plus size={14} /> Fazer Upload de Documento
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase font-black tracking-wider text-[10px] bg-slate-50">
                  <th className="p-4">Documento / Tag</th>
                  <th className="p-4">Órgão Emissor</th>
                  <th className="p-4">Validade</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Arquivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {docsFiltrados.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{doc.nome}</div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{doc.tag}</span>
                    </td>
                    <td className="p-4 font-bold text-slate-700">{doc.orgaoEmissor}</td>
                    <td className="p-4 font-bold text-slate-700">{formatarData(doc.dataValidade)}</td>
                    <td className="p-4">{getBadgeStatus(doc.status, doc.diasParaVencer)}</td>
                    <td className="p-4 text-center">
                      {doc.arquivoUrl && doc.arquivoUrl !== '#' ? (
                        <a
                          href={doc.arquivoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-blue-600 hover:underline"
                        >
                          Visualizar
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
