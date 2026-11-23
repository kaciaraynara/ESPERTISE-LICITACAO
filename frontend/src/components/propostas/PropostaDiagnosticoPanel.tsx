import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Landmark,
  UserCheck,
  Clock,
  FileSpreadsheet,
  Sliders,
} from 'lucide-react';

export interface PropostaDiagnosticoAnswers {
  momentoEnvio: 'INICIAL_DESIDENTIFICADA' | 'INICIAL_IDENTIFICADA' | 'READEQUADA_VENCEDORA';
  criterioJulgamento: 'MENOR_PRECO_ITEM' | 'MENOR_PRECO_LOTE' | 'MAIOR_DESCONTO';
  exigeProspectoTecnico: boolean;
  declararMeEpp: boolean;
  validadeDias: number;
  prazoEntrega: string;
  garantia: string;
  banco: string;
  agencia: string;
  contaCorrente: string;
  inscricaoEstadual: string;
  encarregadoNome: string;
  encarregadoCpf: string;
  encarregadoRg: string;
  encarregadoEstadoCivil: string;
  encarregadoProfissao: string;
  encarregadoTelefone: string;
  encarregadoEndereco: string;
  valorLanceVencedorReadequar?: string;
}

interface PropostaDiagnosticoPanelProps {
  answers: PropostaDiagnosticoAnswers;
  onChange: (patch: Partial<PropostaDiagnosticoAnswers>) => void;
  itensSemMarcaCount: number;
  onReadequarLanceVencedor?: (valorAlvo: number) => void;
  onExportarExcel?: () => void;
}

export const PropostaDiagnosticoPanel: React.FC<PropostaDiagnosticoPanelProps> = ({
  answers,
  onChange,
  itensSemMarcaCount,
  onReadequarLanceVencedor,
  onExportarExcel,
}) => {
  const isDesidentificada = answers.momentoEnvio === 'INICIAL_DESIDENTIFICADA';
  const faltamDadosBancarios = !isDesidentificada && (!answers.banco.trim() || !answers.agencia.trim() || !answers.contaCorrente.trim());
  const faltamDadosEncarregado = !isDesidentificada && (!answers.encarregadoNome.trim() || !answers.encarregadoCpf.trim());

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#081C3A] text-[#F97316]">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-[#081C3A]">
              Questionário Estratégico da Proposta (Lei 14.133/2021)
            </h2>
            <p className="text-xs text-slate-500">
              Responda às perguntas abaixo para personalizar a Carta-Proposta e o Anexo de Ficha Técnica da sua empresa sem nenhum dado genérico.
            </p>
          </div>
        </div>

        {onExportarExcel && (
          <button
            type="button"
            onClick={onExportarExcel}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Baixar Planilha Excel (.CSV)
          </button>
        )}
      </div>

      {/* Alertas Inteligentes de Conformidade */}
      <div className="space-y-2">
        {itensSemMarcaCount > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Atenção à Marca e Modelo:</strong> Existem <strong>{itensSemMarcaCount} item(ns)</strong> sem Marca/Modelo específico preenchido. Em pregões de aquisição de bens, deixar marca genérica pode causar desclassificação.
            </div>
          </div>
        )}
        {isDesidentificada && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-blue-200 bg-blue-50 p-3.5 text-xs text-blue-950">
            <ShieldCheck className="h-4 w-4 text-[#0070C0] shrink-0 mt-0.5" />
            <div>
              <strong>Modo Ficha Técnica Desidentificada Ativo:</strong> O PDF ocultará Razão Social, CNPJ, timbre e assinatura na proposta inicial, incluindo a observação legal: <em>&ldquo;Por força da legislação vigente, é vedada a identificação do licitante antes da fase de lances.&rdquo;</em>
            </div>
          </div>
        )}
      </div>

      {/* 1, 2, 3 e 4: Momento do Envio, Critério de Julgamento, Prospecto e ME/EPP */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3.5">
          <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-[#081C3A]">
            1. Momento do Envio
          </label>
          <select
            value={answers.momentoEnvio}
            onChange={(e) => onChange({ momentoEnvio: e.target.value as PropostaDiagnosticoAnswers['momentoEnvio'] })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#081C3A] outline-none focus:border-[#0070C0]"
          >
            <option value="READEQUADA_VENCEDORA">Proposta Readequada (Pós-Lance Vencedor)</option>
            <option value="INICIAL_IDENTIFICADA">Proposta Inicial Identificada (Carta + Ficha)</option>
            <option value="INICIAL_DESIDENTIFICADA">Proposta Inicial Sem Identificação (Pregão)</option>
          </select>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3.5">
          <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-[#081C3A]">
            2. Critério de Julgamento
          </label>
          <select
            value={answers.criterioJulgamento}
            onChange={(e) => onChange({ criterioJulgamento: e.target.value as PropostaDiagnosticoAnswers['criterioJulgamento'] })}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#081C3A] outline-none focus:border-[#0070C0]"
          >
            <option value="MENOR_PRECO_ITEM">Menor Preço por Item</option>
            <option value="MENOR_PRECO_LOTE">Menor Preço por Lote / Grupo</option>
            <option value="MAIOR_DESCONTO">Maior Desconto (%)</option>
          </select>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3.5 flex flex-col justify-between">
          <span className="block text-[11px] font-extrabold uppercase tracking-wide text-[#081C3A]">
            3. Catálogo / Prospecto Técnico
          </span>
          <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={answers.exigeProspectoTecnico}
              onChange={(e) => onChange({ exigeProspectoTecnico: e.target.checked })}
              className="rounded border-slate-300"
            />
            <span>Edital exige ficha técnica detalhada e marca/modelo por lote</span>
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3.5 flex flex-col justify-between">
          <span className="block text-[11px] font-extrabold uppercase tracking-wide text-[#081C3A]">
            4. Benefício ME / EPP (LC 123/2006)
          </span>
          <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={answers.declararMeEpp}
              onChange={(e) => onChange({ declararMeEpp: e.target.checked })}
              className="rounded border-slate-300"
            />
            <span>Declarar enquadramento ME/EPP (Art. 3º LC 123/06 e Art. 4º Lei 14.133)</span>
          </label>
        </div>
      </div>

      {/* 5. Condições da Proposta + Readequação ao Lance Vencedor */}
      <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#081C3A]">
          <Clock className="h-4 w-4 text-[#0070C0]" />
          5. Condições da Proposta (Validade, Entrega, Garantia e Readequação ao Lance)
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">Validade da Proposta (dias)</label>
            <input
              type="number"
              min={1}
              value={answers.validadeDias}
              onChange={(e) => onChange({ validadeDias: Number(e.target.value) || 60 })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#081C3A]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">Prazo de Entrega</label>
            <input
              type="text"
              value={answers.prazoEntrega}
              onChange={(e) => onChange({ prazoEntrega: e.target.value })}
              placeholder="Ex: 10 (dez) dias úteis após a Nota de Empenho"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#081C3A]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold text-slate-600">Prazo de Garantia</label>
            <input
              type="text"
              value={answers.garantia}
              onChange={(e) => onChange({ garantia: e.target.value })}
              placeholder="Ex: 12 (doze) meses a contar do recebimento definitivo"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#081C3A]"
            />
          </div>
          {onReadequarLanceVencedor && (
            <div>
              <label className="mb-1 block text-[11px] font-bold text-emerald-800">
                Readequar Total ao Lance Vencedor (R$)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  value={answers.valorLanceVencedorReadequar || ''}
                  onChange={(e) => onChange({ valorLanceVencedorReadequar: e.target.value })}
                  placeholder="Valor final fechado"
                  className="w-full rounded-xl border border-emerald-300 bg-white px-2.5 py-2 text-xs font-bold text-emerald-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = Number(answers.valorLanceVencedorReadequar);
                    if (v > 0) onReadequarLanceVencedor(v);
                  }}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white shrink-0 cursor-pointer"
                >
                  Readequar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6 e 7. Dados Bancários e Encarregado para Assinatura da Ata e do Contrato */}
      {!isDesidentificada && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* 6. Dados Bancários e Inscrição Estadual */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#081C3A]">
                <Landmark className="h-4 w-4 text-[#0070C0]" />
                6. Dados Bancários & Inscrição Estadual
              </div>
              {faltamDadosBancarios ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  Preencher p/ Carta-Proposta
                </span>
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Estabelecimento Bancário</label>
                <input
                  type="text"
                  value={answers.banco}
                  onChange={(e) => onChange({ banco: e.target.value })}
                  placeholder="Ex: Banco do Brasil (001) / Caixa / Itaú"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#081C3A]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Agência</label>
                <input
                  type="text"
                  value={answers.agencia}
                  onChange={(e) => onChange({ agencia: e.target.value })}
                  placeholder="Ex: 1234-5"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#081C3A]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Conta Corrente</label>
                <input
                  type="text"
                  value={answers.contaCorrente}
                  onChange={(e) => onChange({ contaCorrente: e.target.value })}
                  placeholder="Ex: 98765-0"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#081C3A]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Inscrição Estadual (opcional)</label>
                <input
                  type="text"
                  value={answers.inscricaoEstadual}
                  onChange={(e) => onChange({ inscricaoEstadual: e.target.value })}
                  placeholder="Ex: 908.11122-33 ou Isento"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#081C3A]"
                />
              </div>
            </div>
          </div>

          {/* 7. Identificação do Encarregado para Assinatura da Ata e do Contrato */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#081C3A]">
                <UserCheck className="h-4 w-4 text-[#0070C0]" />
                7. Encarregado para Assinatura da Ata e do Contrato
              </div>
              {faltamDadosEncarregado ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  Qualificação do Signatário
                </span>
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Nome Completo do Representante / Procurador</label>
                <input
                  type="text"
                  value={answers.encarregadoNome}
                  onChange={(e) => onChange({ encarregadoNome: e.target.value })}
                  placeholder="Nome completo de quem assina a Ata/Contrato"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#081C3A]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">CPF / MF</label>
                <input
                  type="text"
                  value={answers.encarregadoCpf}
                  onChange={(e) => onChange({ encarregadoCpf: e.target.value })}
                  placeholder="000.000.000-00"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#081C3A]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Cédula de Identidade (RG / Órgão)</label>
                <input
                  type="text"
                  value={answers.encarregadoRg}
                  onChange={(e) => onChange({ encarregadoRg: e.target.value })}
                  placeholder="Ex: 12.345.678-9 SSP/UF"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#081C3A]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Estado Civil</label>
                <input
                  type="text"
                  value={answers.encarregadoEstadoCivil}
                  onChange={(e) => onChange({ encarregadoEstadoCivil: e.target.value })}
                  placeholder="Ex: Casado(a) / Solteiro(a)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#081C3A]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Profissão / Cargo</label>
                <input
                  type="text"
                  value={answers.encarregadoProfissao}
                  onChange={(e) => onChange({ encarregadoProfissao: e.target.value })}
                  placeholder="Ex: Empresário / Sócio-Administrador"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#081C3A]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Endereço Residencial do Encarregado</label>
                <input
                  type="text"
                  value={answers.encarregadoEndereco}
                  onChange={(e) => onChange({ encarregadoEndereco: e.target.value })}
                  placeholder="Rua, número, bairro, cidade/UF e CEP"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#081C3A]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600">Telefone do Encarregado</label>
                <input
                  type="text"
                  value={answers.encarregadoTelefone}
                  onChange={(e) => onChange({ encarregadoTelefone: e.target.value })}
                  placeholder="(00) 90000-0000"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-[#081C3A]"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropostaDiagnosticoPanel;
