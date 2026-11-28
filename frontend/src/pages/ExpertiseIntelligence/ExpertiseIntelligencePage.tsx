import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Plus,
  Trash2,
  Search,
  Loader2,
  Download,
  Network,
  Scale,
  Database,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Upload,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { concorrentesApi } from '@/services/api';
import { useCompany } from '@/contexts/CompanyContext';
import { formatCnpjMask, isValidCnpj, sanitizeCnpj } from '@/utils/cnpj';

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const ExpertiseIntelligencePage: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const ataInputRef = useRef<HTMLInputElement | null>(null);
  const [cnpjs, setCnpjs] = useState<string[]>(['', '']);
  const [processoRef, setProcessoRef] = useState('');
  const [codigoCatmat, setCodigoCatmat] = useState('');
  const [aba, setAba] = useState<'geral' | 'motores' | 'grafo' | 'cruzamento' | 'defesa'>('geral');
  const [carregando, setCarregando] = useState(false);
  const [extraindoAta, setExtraindoAta] = useState(false);
  const [resultado, setResultado] = useState<any | null>(null);

  const atualizarCnpj = (idx: number, val: string) => {
    const copia = [...cnpjs];
    copia[idx] = formatCnpjMask(val);
    setCnpjs(copia);
  };

  const adicionarCnpj = () => {
    if (cnpjs.length >= 6) {
      toast.error('Limite de 6 empresas por matriz investigativa.');
      return;
    }
    setCnpjs([...cnpjs, '']);
  };

  const removerCnpj = (idx: number) => {
    if (cnpjs.length <= 1) return;
    setCnpjs(cnpjs.filter((_, i) => i !== idx));
  };

  const executarInteligencia = async (cnpjsOverride?: string[] | React.MouseEvent) => {
    const listaBase = Array.isArray(cnpjsOverride) ? cnpjsOverride : cnpjs;
    const validos = listaBase
      .map((c) => sanitizeCnpj(c))
      .filter((c) => isValidCnpj(c, { optional: false }));

    if (validos.length === 0) {
      toast.error('Informe ao menos um CNPJ valido para iniciar o cruzamento probatorio.');
      return;
    }

    setCarregando(true);
    try {
      const resp = await api.post(
        '/concorrentes/integridade',
        {
          cnpjs: validos,
          processoRef: processoRef.trim() || undefined,
          codigoCatmat: codigoCatmat.trim() || undefined,
        },
        { timeout: 60000 }
      );
      setResultado(resp.data?.data || null);
      toast.success('Cruzamento de inteligencia concluido.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Falha ao executar o cruzamento investigativo.');
    } finally {
      setCarregando(false);
    }
  };

  const handleImportarAtaPdf = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      toast.error('Selecione um arquivo PDF válido da Ata da Sessão ou Termo de Julgamento.');
      return;
    }

    setExtraindoAta(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Falha ao ler arquivo PDF'));
        reader.readAsDataURL(file);
      });

      const resp = await concorrentesApi.extrairAta({
        fileBase64: base64,
        fileName: file.name,
        ownCnpj: selectedCompany?.cnpj,
      });

      const extraidos: string[] = (resp.data?.data?.cnpjs || []).slice(0, 12);
      if (extraidos.length === 0) {
        toast.error('Nenhum CNPJ de concorrente válido foi encontrado neste PDF.');
        return;
      }

      setCnpjs(extraidos);
      toast.success(`${extraidos.length} CNPJ(s) extraído(s) da Ata. Iniciando auditoria automática...`);
      await executarInteligencia(extraidos);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao processar o PDF da Ata.');
    } finally {
      setExtraindoAta(false);
      if (ataInputRef.current) ataInputRef.current.value = '';
    }
  };

  const temAchadosRelevantes = Boolean(
    resultado &&
      ((Array.isArray(resultado.indiciosOperacionais) && resultado.indiciosOperacionais.length > 0) ||
        (Array.isArray(resultado.indicios) && resultado.indicios.length > 0) ||
        (Array.isArray(resultado.conexoes) && resultado.conexoes.length > 0)),
  );

  const handleGerarRecursoComProvas = () => {
    if (!resultado) return;
    const linhasFatos: string[] = [];

    if (Array.isArray(resultado.empresas) && resultado.empresas.length > 0) {
      linhasFatos.push(
        'EMPRESAS AUDITADAS:',
        ...resultado.empresas.map(
          (e: any) =>
            `- ${e.razaoSocial} (CNPJ ${formatCnpjMask(e.cnpj)}) | Endereço RFB: ${e.endereco || 'Não informado'} | Sócios: ${(e.socios || []).join(', ') || 'Não informados'} | TCU: ${e.tcuStatus} | CGU: ${e.cguStatus}`,
        ),
      );
    }

    if (Array.isArray(resultado.indiciosOperacionais) && resultado.indiciosOperacionais.length > 0) {
      linhasFatos.push(
        '',
        'INDÍCIOS OPERACIONAIS DETECTADOS (RECEITA FEDERAL / QSA):',
        ...resultado.indiciosOperacionais.map(
          (op: any) => `- [${op.severidade}] ${op.titulo}: ${op.descricao} (${op.baseLegal})`,
        ),
      );
    }

    if (Array.isArray(resultado.indicios) && resultado.indicios.length > 0) {
      linhasFatos.push(
        '',
        'ACHADOS DE INTEGRIDADE E CONEXÕES SOCIETÁRIAS:',
        ...resultado.indicios.map((ind: any) => `- [${ind.severidade}] ${ind.titulo}: ${ind.detalhe}`),
      );
    }

    if (Array.isArray(resultado.conexoes) && resultado.conexoes.length > 0) {
      linhasFatos.push(
        '',
        'CONEXÕES MAPEADAS:',
        ...resultado.conexoes.map((c: any) => `- ${c.tipo}: ${c.origem} <-> ${c.destino} (${c.detalhe})`),
      );
    }

    linhasFatos.push(
      '',
      'FUNDAMENTAÇÃO JURÍDICA SUGERIDA:',
      '- Art. 14, Art. 155 e Art. 165 da Lei nº 14.133/2021; Art. 36 da Lei nº 12.529/2011; Acórdão nº 1.793/2011-Plenário TCU (indícios múltiplos de conluio, identidade de endereço, telefone, sócios ou parentesco).',
    );

    const payload = {
      orgao: '',
      numeroProcesso: processoRef.trim() || '',
      objeto: 'Apuração de indícios objetivos de vínculo societário/operacional entre licitantes',
      motivos: linhasFatos.join('\n'),
    };

    sessionStorage.setItem('expertise_recurso_provas_auditoria', JSON.stringify(payload));
    navigate('/fornecedor/recursos', { state: { provasAuditoria: payload } });
  };

  const baixarRelatorioPdf = () => {
    if (!resultado) return;
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Expertise Intelligence - Relatorio Tecnico-Juridico</title>
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5; }
    .top { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #F97316; padding-bottom: 10px; margin-bottom: 16px; }
    .top img { height: 44px; }
    h1 { font-size: 17px; color: #081C3A; margin: 0 0 6px; }
    h2 { font-size: 13px; color: #081C3A; border-left: 4px solid #F97316; padding-left: 8px; margin-top: 16px; text-transform: uppercase; }
    .aviso { font-size: 11px; background: #fff7ed; border: 1px solid #fed7aa; padding: 10px; border-radius: 6px; margin: 10px 0; }
    li { font-size: 12px; margin-bottom: 5px; }
  </style>
</head>
<body>
  <div class="top">
    <img src="${window.location.origin}/assets/logo-expertise.png" alt="Expertise Licitatoria" />
    <div style="text-align:right;font-size:11px;color:#475569;">
      <strong>EXPERTISE INTELLIGENCE</strong><br/>
      Inteligencia Investigativa e Integridade Licitatoria<br/>
      ${new Date().toLocaleString('pt-BR')}
    </div>
  </div>
  <h1>Dossie de Cruzamento Probatorio e Integridade</h1>
  ${processoRef ? `<p style="font-size:12px;"><strong>Certame / Processo:</strong> ${escapeHtml(processoRef)}</p>` : ''}
  <p style="font-size:13px;"><strong>Grau de Atencao:</strong> ${escapeHtml(resultado.nivelRisco)} (${resultado.indiceRisco}%)</p>
  <div class="aviso">${escapeHtml(resultado.avisoLegal)}</div>
  <h2>1. Motores de Inteligencia Acionados</h2>
  <ul>${(resultado.motores || []).map((m: any) => `<li><strong>${escapeHtml(m.motor)}:</strong> ${escapeHtml(m.status)} (<em>${escapeHtml(m.baseLegal)}</em>)</li>`).join('')}</ul>
  <h2>2. Entidades Economicas Analisadas (QSA / TCU / CGU)</h2>
  <ul>${(resultado.empresas || []).map((e: any) => `<li><strong>${escapeHtml(e.razaoSocial)}</strong> (${escapeHtml(e.cnpj)}) — ${escapeHtml(e.situacaoCadastral)} | TCU: ${escapeHtml(e.tcuStatus)} | CGU: ${escapeHtml(e.cguStatus)}</li>`).join('')}</ul>
  <h2>3. Indicios Objetivos Identificados</h2>
  <ul>${(resultado.indicios || []).length ? resultado.indicios.map((i: any) => `<li>[${escapeHtml(i.severidade)}] <strong>${escapeHtml(i.titulo)}:</strong> ${escapeHtml(i.detalhe)}</li>`).join('') : '<li>Nenhum indicio critico identificado entre os CNPJs consultados.</li>'}</ul>
  <h2>4. Linhas de Defesa e Contraditorio (Lei 14.133/2021)</h2>
  <ul>${(resultado.linhasDefesa || []).map((l: string) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const indice = resultado?.indiceRisco ?? 0;
  const corRisco =
    resultado?.nivelRisco === 'Elevado'
      ? '#dc2626'
      : resultado?.nivelRisco === 'Moderado'
      ? '#f59e0b'
      : '#16a34a';

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      {/* Cabecalho */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#081C3A] text-[#F97316]">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#081C3A]">
              Auditoria de Concorrentes
            </h1>
            <p className="text-xs text-slate-500">
              Investigue concorrentes da sessão (sócios em comum, mesmo endereço, parentesco e sanções no TCU/CGU) para embasar inabilitação ou recurso (Art. 165).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={ataInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => handleImportarAtaPdf(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => ataInputRef.current?.click()}
            disabled={extraindoAta || carregando}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#F97316] px-3.5 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {extraindoAta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar Ata da Sessão (PDF)
          </button>
          <button
            type="button"
            onClick={adicionarCnpj}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#081C3A] px-3 py-2 text-xs font-bold text-[#081C3A] hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            Adicionar CNPJ
          </button>
          {temAchadosRelevantes && (
            <button
              type="button"
              onClick={handleGerarRecursoComProvas}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-600 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              <FileText className="h-4 w-4" />
              Gerar Recurso com Estas Provas (Art. 165)
            </button>
          )}
          {resultado && (
            <button
              type="button"
              onClick={baixarRelatorioPdf}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#081C3A] px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Download className="h-4 w-4 text-[#F97316]" />
              Dossie Tecnico PDF
            </button>
          )}
        </div>
      </div>

      {/* Entradas */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            type="text"
            value={processoRef}
            onChange={(e) => setProcessoRef(e.target.value)}
            placeholder="Certame / Edital (ex: PE 014/2026 - Orgao)"
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#081C3A] md:col-span-2"
          />
          <input
            type="text"
            value={codigoCatmat}
            onChange={(e) => setCodigoCatmat(e.target.value)}
            placeholder="Codigo CATMAT p/ preco medio (opcional)"
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#081C3A]"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {cnpjs.map((val, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={val}
                onChange={(e) => atualizarCnpj(idx, e.target.value)}
                placeholder={`CNPJ Empresa ${String.fromCharCode(65 + idx)}`}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#081C3A]"
              />
              {cnpjs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removerCnpj(idx)}
                  className="rounded-xl border border-slate-200 p-2.5 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={carregando}
            onClick={executarInteligencia}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Executar Cruzamento Probatorio
          </button>
        </div>
      </div>

      {resultado && (
        <>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'geral', label: 'Visao Geral' },
              { id: 'motores', label: '6 Motores de Inteligencia' },
              { id: 'grafo', label: 'Grafo de Conexoes' },
              { id: 'cruzamento', label: 'Fontes Oficiais' },
              { id: 'defesa', label: 'Linhas de Defesa' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setAba(t.id as any)}
                className={`rounded-xl px-4 py-2 text-xs font-bold ${
                  aba === t.id
                    ? 'bg-[#081C3A] text-white'
                    : 'border border-slate-200 bg-white text-[#081C3A] hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-bold text-slate-500">Grau de Atencao</div>
              <svg viewBox="0 0 120 70" className="mt-2 h-20 w-32">
                <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
                <path
                  d="M 10 60 A 50 50 0 0 1 110 60"
                  fill="none"
                  stroke={corRisco}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(indice / 100) * 157} 157`}
                />
              </svg>
              <div className="-mt-2 text-lg font-extrabold" style={{ color: corRisco }}>
                {resultado.nivelRisco} ({indice}%)
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-500">Indicios Objetivos</div>
              <div className="mt-3 text-3xl font-extrabold text-[#081C3A]">{resultado.indicios?.length || 0}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-500">CNPJs Cruzados</div>
              <div className="mt-3 text-3xl font-extrabold text-[#081C3A]">{resultado.empresas?.length || 0}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-500">Vinculos Societarios / End.</div>
              <div className="mt-3 text-3xl font-extrabold text-[#F97316]">{resultado.conexoes?.length || 0}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-500">Alertas Elevados</div>
              <div className="mt-3 text-3xl font-extrabold text-rose-600">
                {(resultado.indicios || []).filter((i: any) => i.severidade === 'ELEVADO').length}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
            {resultado.avisoLegal}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {(aba === 'geral' || aba === 'motores') && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
                  <Cpu className="h-4 w-4 text-[#F97316]" /> 6 Motores de Inteligencia Investigativa
                </h2>
                <div className="space-y-2.5">
                  {(resultado.motores || []).map((m: any) => (
                    <div key={m.motor} className="rounded-xl bg-slate-50 p-3 text-xs">
                      <div className="font-bold text-[#081C3A]">{m.motor}</div>
                      <div className="mt-0.5 text-slate-700">{m.status}</div>
                      <div className="mt-0.5 text-[11px] font-semibold text-[#0070C0]">{m.baseLegal}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(aba === 'geral' || aba === 'cruzamento') && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
                  <Database className="h-4 w-4 text-[#0070C0]" /> Cruzamento em Bases Oficiais
                </h2>
                <div className="space-y-2.5">
                  {(resultado.fontesConsultadas || []).map((f: any) => (
                    <div key={f.orgao} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                      <div>
                        <div className="font-bold text-[#081C3A]">{f.orgao}</div>
                        <div className="text-slate-500">{f.escopo}</div>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-bold text-emerald-700">
                        {f.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(aba === 'geral' || aba === 'grafo') && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
                  <Network className="h-4 w-4 text-[#F97316]" /> Grafo de Vinculos e Entidades
                </h2>
                <div className="space-y-2.5">
                  {(resultado.empresas || []).map((emp: any, i: number) => (
                    <div key={emp.cnpj} className="rounded-xl border border-slate-200 p-3 text-xs">
                      <div className="font-bold text-[#081C3A]">
                        Empresa {String.fromCharCode(65 + i)}: {emp.razaoSocial} ({formatCnpjMask(emp.cnpj)})
                      </div>
                      <div className="mt-1 text-slate-600">
                        QSA: {emp.socios?.length ? emp.socios.map((s: any) => s.nome).join(', ') : 'Nao informado'}
                      </div>
                      <div className="text-slate-500">TCU: {emp.tcuStatus} | CGU: {emp.cguStatus}</div>
                    </div>
                  ))}
                  {(resultado.conexoes || []).length > 0 && (
                    <div className="rounded-xl bg-orange-50 p-3 text-xs text-orange-900">
                      <strong>Arestas de Relacionamento Detectadas:</strong>
                      {resultado.conexoes.map((c: any, idx: number) => (
                        <div key={idx} className="mt-1">
                          {formatCnpjMask(c.origem)} &harr; {formatCnpjMask(c.destino)}: <strong>{c.tipo}</strong> ({c.detalhe})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {(aba === 'geral' || aba === 'defesa') && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                {Array.isArray(resultado.indiciosOperacionais) && resultado.indiciosOperacionais.length > 0 && (
                  <div>
                    <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
                      <ShieldAlert className="h-4 w-4 text-[#F97316]" /> Auditoria de Concorrentes — Indícios Operacionais
                    </h2>
                    <div className="space-y-2 text-xs">
                      {resultado.indiciosOperacionais.map((op: any, i: number) => {
                        const sev = String(op.severidade || op.nivel || 'MEDIO').toUpperCase();
                        const isAlto = sev.includes('ALT') || sev.includes('ELEV');
                        return (
                          <div key={i} className={`rounded-xl border p-3 ${isAlto ? 'border-rose-200 bg-rose-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <strong className="text-[#081C3A]">{op.titulo || op.tipo || 'Indício Operacional'}</strong>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isAlto ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                                {sev}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-700">{op.descricaoJuridica || op.descricao || op.detalhe}</p>
                            {Array.isArray(op.empresas) && op.empresas.length > 0 && (
                              <p className="mt-1 text-[11px] font-semibold text-slate-600">
                                Empresas envolvidas: {op.empresas.join(' · ')}
                              </p>
                            )}
                            <p className="mt-1 text-[11px] text-[#0070C0] font-semibold">
                              {op.baseLegal || 'Acórdão nº 1.793/2011-Plenário TCU (conluio / compartilhamento operacional)'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {resultado.precoReferencia && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <strong className="text-[#081C3A]">Benchmark de Preços CATMAT (Compras.gov.br)</strong>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#0070C0] border border-blue-200">
                        {resultado.precoReferencia.consultado ? `${resultado.precoReferencia.amostras || 0} amostra(s)` : 'Não consultado'}
                      </span>
                    </div>
                    {resultado.precoReferencia.consultado ? (
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="rounded-lg bg-white p-2 border border-blue-100">
                          <span className="text-[10px] text-slate-500 block">Menor Preço</span>
                          <strong className="text-emerald-700">
                            {resultado.precoReferencia.menorPreco != null ? `R$ ${Number(resultado.precoReferencia.menorPreco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                          </strong>
                        </div>
                        <div className="rounded-lg bg-white p-2 border border-blue-100">
                          <span className="text-[10px] text-slate-500 block">Preço Médio / Mediana</span>
                          <strong className="text-[#081C3A]">
                            {resultado.precoReferencia.precoMedio != null ? `R$ ${Number(resultado.precoReferencia.precoMedio).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                          </strong>
                        </div>
                        <div className="rounded-lg bg-white p-2 border border-blue-100">
                          <span className="text-[10px] text-slate-500 block">Maior Preço</span>
                          <strong className="text-rose-700">
                            {resultado.precoReferencia.maiorPreco != null ? `R$ ${Number(resultado.precoReferencia.maiorPreco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-600">Informe o código CATMAT no campo acima para confrontar preços praticados em compras públicas.</p>
                    )}
                  </div>
                )}

                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
                    <AlertTriangle className="h-4 w-4 text-rose-600" /> Indicios Objetivos
                  </h2>
                  {(resultado.indicios || []).length > 0 ? (
                    <ul className="space-y-2 text-xs">
                      {resultado.indicios.map((ind: any, i: number) => (
                        <li key={i} className="rounded-xl bg-slate-50 p-2.5">
                          <strong>[{ind.severidade}] {ind.titulo}:</strong> {ind.detalhe}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">Nenhum indicio critico detectado entre os CNPJs.</p>
                  )}
                </div>

                <div>
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#081C3A]">
                    <Scale className="h-4 w-4 text-emerald-600" /> Linhas de Defesa e Contraditorio
                  </h2>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {(resultado.linhasDefesa || []).map((l: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ExpertiseIntelligencePage;
