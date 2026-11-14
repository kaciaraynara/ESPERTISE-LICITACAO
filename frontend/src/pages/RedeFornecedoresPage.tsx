import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Building2,
  MapPin,
  Users,
  FileText,
  ChevronRight,
  Pencil,
  X,
  Tag,
  QrCode,
  Upload,
  Camera,
  CheckCircle2,
  ShieldCheck,
  Trash2,
  Eye,
  StopCircle,
  ExternalLink,
} from 'lucide-react';
import { useCompany } from '../contexts/CompanyContext';

interface NotaFiscalAnexo {
  id: string;
  numeroNota: string;
  chaveAcesso?: string;
  urlQrCode?: string;
  origem: 'galeria' | 'pdf' | 'qrcode';
  nomeArquivo?: string;
  dataEmissao: string;
  valorTotal?: string;
  arquivoDataUrl?: string;
  tipoMime?: string;
  statusMonitoramento: 'Monitorada pela Luli';
}

interface Fornecedor {
  id: string;
  cnpj: string;
  nome: string;
  nomeFantasia?: string;
  especialidade: string;
  regiao: string;
  cidadeUf?: string;
  contatoPrincipal: string;
  telefone?: string;
  email?: string;
  observacoes: string;
  categorias: string[];
  anotacoes: string;
  notasFiscais: NotaFiscalAnexo[];
}

const CATEGORIAS = [
  'Equipamentos',
  'Tecnologia',
  'Obras e serviços',
  'Consultoria',
  'Materiais',
  'Logística',
  'Serviços especializados',
  'Vestuário e Têxtil',
  'Outros',
];

const REGIOES = ['Nordeste', 'Sudeste', 'Sul', 'Centro-Oeste', 'Norte', 'Nacional'];

function ufParaRegiao(uf?: string): string {
  const u = (uf || '').toUpperCase();
  if (['CE', 'PE', 'BA', 'MA', 'PI', 'RN', 'PB', 'AL', 'SE'].includes(u)) return 'Nordeste';
  if (['SP', 'RJ', 'MG', 'ES'].includes(u)) return 'Sudeste';
  if (['PR', 'SC', 'RS'].includes(u)) return 'Sul';
  if (['GO', 'MT', 'MS', 'DF'].includes(u)) return 'Centro-Oeste';
  if (['AM', 'PA', 'AC', 'RO', 'RR', 'AP', 'TO'].includes(u)) return 'Norte';
  return 'Nacional';
}

function formatarCnpj(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 14);
  return digitos
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function extrairDadosQrCodeNfe(entrada: string): {
  chave: string;
  numero: string;
  url?: string;
  cnpjEmitente?: string;
} {
  const limpa = entrada.trim();
  const ehUrl = /^https?:\/\//i.test(limpa);
  const matchChave = limpa.match(/\d{44}/);
  const chave = matchChave ? matchChave[0] : '';
  const numero = chave ? String(Number(chave.slice(25, 34))) : limpa.slice(0, 20);
  const cnpjEmitente = chave ? formatarCnpj(chave.slice(6, 20)) : undefined;

  return {
    chave,
    numero,
    url: ehUrl ? limpa : undefined,
    cnpjEmitente,
  };
}

export default function RedeFornecedoresPage() {
  const { selectedCompany } = useCompany();
  const storageKey = `expertise_fornecedores_v2_${selectedCompany?.id || 'default'}`;

  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'visao' | 'notas' | 'categorias' | 'anotacoes'>('visao');

  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [regiaoFiltro, setRegiaoFiltro] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [avisoCnpj, setAvisoCnpj] = useState<string | null>(null);

  const [form, setForm] = useState({
    cnpj: '',
    nome: '',
    nomeFantasia: '',
    especialidade: 'Materiais',
    regiao: 'Nordeste',
    cidadeUf: '',
    contatoPrincipal: '',
    telefone: '',
    email: '',
    observacoes: '',
    anotacoes: '',
  });

  // Anexo de Nota Fiscal e Leitor de Câmera
  const [modalNotaAberto, setModalNotaAberto] = useState(false);
  const [notaNumero, setNotaNumero] = useState('');
  const [notaChaveQr, setNotaChaveQr] = useState('');
  const [notaUrlQr, setNotaUrlQr] = useState('');
  const [notaValor, setNotaValor] = useState('');
  const [notaData, setNotaData] = useState(() => new Date().toISOString().slice(0, 10));
  const [notaOrigem, setNotaOrigem] = useState<'galeria' | 'pdf' | 'qrcode'>('qrcode');
  const [notaArquivoNome, setNotaArquivoNome] = useState('');
  const [notaArquivoDataUrl, setNotaArquivoDataUrl] = useState('');
  const [notaTipoMime, setNotaTipoMime] = useState('');
  const [notaPreview, setNotaPreview] = useState<NotaFiscalAnexo | null>(null);

  // Estados da câmera de QR Code
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [statusCamera, setStatusCamera] = useState<string | null>(null);

  const inputGaleriaRef = useRef<HTMLInputElement | null>(null);
  const inputCameraFotoRef = useRef<HTMLInputElement | null>(null);
  const inputPdfRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(storageKey);
      if (salvo) {
        const lista = JSON.parse(salvo);
        if (Array.isArray(lista)) {
          setFornecedores(lista);
          setSelecionadoId(lista[0]?.id || null);
          return;
        }
      }
      setFornecedores([]);
      setSelecionadoId(null);
    } catch {
      setFornecedores([]);
    }
  }, [storageKey]);

  const pararCamera = () => {
    if (loopTimerRef.current) {
      window.clearInterval(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraAtiva(false);
  };

  useEffect(() => {
    return () => {
      pararCamera();
    };
  }, []);

  const salvarLista = (novaLista: Fornecedor[]) => {
    setFornecedores(novaLista);
    localStorage.setItem(storageKey, JSON.stringify(novaLista));
  };

  const handleBuscarCnpj = async () => {
    const digitos = form.cnpj.replace(/\D/g, '');
    if (digitos.length !== 14) {
      setAvisoCnpj('Informe os 14 números do CNPJ para buscar os dados da empresa.');
      return;
    }

    setBuscandoCnpj(true);
    setAvisoCnpj(null);
    try {
      const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digitos}`);
      if (!resp.ok) throw new Error('Não encontrado');
      const dados = await resp.json();
      const cidadeUf = [dados.municipio, dados.uf].filter(Boolean).join(' - ');
      const cnaeDesc = dados.cnae_fiscal_descricao || '';

      setForm((prev) => ({
        ...prev,
        nome: dados.razao_social || prev.nome,
        nomeFantasia: dados.nome_fantasia || prev.nomeFantasia,
        cidadeUf,
        regiao: ufParaRegiao(dados.uf),
        telefone: dados.ddd_telefone_1 || prev.telefone,
        email: dados.email || prev.email,
        observacoes: cnaeDesc
          ? `Atividade principal: ${cnaeDesc}${dados.situacao_cadastral ? ` • Situação: ${dados.descricao_situacao_cadastral}` : ''}`
          : prev.observacoes,
      }));
      setAvisoCnpj('Dados da empresa carregados com sucesso! Revise e clique em Salvar.');
    } catch {
      setAvisoCnpj('Não foi possível consultar este CNPJ agora. Você pode preencher os dados manualmente.');
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const aplicarLeituraQr = (valorBruto: string, snapshotDataUrl?: string) => {
    const { chave, numero, url, cnpjEmitente } = extrairDadosQrCodeNfe(valorBruto);
    setNotaOrigem('qrcode');
    setNotaChaveQr(chave || valorBruto);
    if (url) setNotaUrlQr(url);
    if (numero) setNotaNumero(numero);
    if (snapshotDataUrl) {
      setNotaArquivoDataUrl(snapshotDataUrl);
      setNotaArquivoNome(`qrcode-nf-${numero || 'comprovante'}.jpg`);
      setNotaTipoMime('image/jpeg');
    }
    setStatusCamera(
      `QR Code lido com sucesso!${numero ? ` Nota nº ${numero}` : ''}${cnpjEmitente ? ` • CNPJ emitente: ${cnpjEmitente}` : ''}`
    );
  };

  const iniciarCameraQr = async () => {
    pararCamera();
    setStatusCamera('Abrindo câmera...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraAtiva(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);

      const DetectorClass = (window as any).BarcodeDetector;
      if (DetectorClass) {
        const detector = new DetectorClass({ formats: ['qr_code'] });
        setStatusCamera('Aponte a câmera para o QR Code da Nota Fiscal...');
        loopTimerRef.current = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const codigos = await detector.detect(videoRef.current);
            if (codigos && codigos.length > 0 && codigos[0].rawValue) {
              // Tira foto automática do momento da leitura
              let snapshot = '';
              try {
                const canvas = document.createElement('canvas');
                canvas.width = videoRef.current.videoWidth || 640;
                canvas.height = videoRef.current.videoHeight || 480;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                  snapshot = canvas.toDataURL('image/jpeg', 0.85);
                }
              } catch {
                // ignora se falhar captura de imagem
              }
              aplicarLeituraQr(codigos[0].rawValue, snapshot);
              pararCamera();
            }
          } catch {
            // continua tentando nos próximos frames
          }
        }, 350);
      } else {
        setStatusCamera(
          'Câmera aberta! Para leitura automática do QR Code use Chrome ou Edge, ou clique em "Capturar Foto" abaixo.'
        );
      }
    } catch {
      setStatusCamera(
        'Não foi possível abrir a câmera diretamente. Você pode tirar a foto pelo botão "Tirar Foto da Nota" ou enviar da galeria.'
      );
      setCameraAtiva(false);
    }
  };

  const capturarFotoDaCamera = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 800;
    canvas.height = videoRef.current.videoHeight || 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setNotaArquivoDataUrl(dataUrl);
      setNotaArquivoNome(`foto-nota-${Date.now()}.jpg`);
      setNotaTipoMime('image/jpeg');
      setStatusCamera('Foto da nota fiscal capturada com sucesso!');
    }
    pararCamera();
  };

  const filtrados = useMemo(() => {
    return fornecedores.filter((f) => {
      const texto = busca.trim().toLowerCase();
      const bateBusca =
        !texto ||
        f.nome.toLowerCase().includes(texto) ||
        (f.cnpj || '').includes(texto) ||
        f.especialidade.toLowerCase().includes(texto) ||
        f.contatoPrincipal.toLowerCase().includes(texto);
      const bateCategoria = !categoriaFiltro || f.especialidade === categoriaFiltro;
      const bateRegiao = !regiaoFiltro || f.regiao === regiaoFiltro;
      return bateBusca && bateCategoria && bateRegiao;
    });
  }, [fornecedores, busca, categoriaFiltro, regiaoFiltro]);

  const selecionado = useMemo(
    () => fornecedores.find((f) => f.id === selecionadoId) || filtrados[0] || null,
    [fornecedores, selecionadoId, filtrados]
  );

  const abrirNovo = () => {
    setEditandoId(null);
    setAvisoCnpj(null);
    setForm({
      cnpj: '',
      nome: '',
      nomeFantasia: '',
      especialidade: 'Materiais',
      regiao: 'Nordeste',
      cidadeUf: '',
      contatoPrincipal: '',
      telefone: '',
      email: '',
      observacoes: '',
      anotacoes: '',
    });
    setModalAberto(true);
  };

  const abrirEdicao = (f: Fornecedor) => {
    setEditandoId(f.id);
    setAvisoCnpj(null);
    setForm({
      cnpj: f.cnpj || '',
      nome: f.nome,
      nomeFantasia: f.nomeFantasia || '',
      especialidade: f.especialidade,
      regiao: f.regiao,
      cidadeUf: f.cidadeUf || '',
      contatoPrincipal: f.contatoPrincipal,
      telefone: f.telefone || '',
      email: f.email || '',
      observacoes: f.observacoes,
      anotacoes: f.anotacoes,
    });
    setModalAberto(true);
  };

  const handleSalvarForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return;

    if (editandoId) {
      const atualizada = fornecedores.map((f) =>
        f.id === editandoId ? { ...f, ...form, categorias: [form.especialidade] } : f
      );
      salvarLista(atualizada);
      setSelecionadoId(editandoId);
    } else {
      const novo: Fornecedor = {
        id: String(Date.now()),
        ...form,
        categorias: [form.especialidade],
        notasFiscais: [],
      };
      const atualizada = [novo, ...fornecedores];
      salvarLista(atualizada);
      setSelecionadoId(novo.id);
    }
    setModalAberto(false);
  };

  const handleArquivoNota = (file: File | undefined, origem: 'galeria' | 'pdf') => {
    if (!file) return;
    setNotaOrigem(origem);
    setNotaArquivoNome(file.name);
    setNotaTipoMime(file.type);
    if (!notaNumero) {
      setNotaNumero(file.name.replace(/\.[^/.]+$/, '').slice(0, 24));
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNotaArquivoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSalvarNota = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selecionado) return;

    const novaNota: NotaFiscalAnexo = {
      id: String(Date.now()),
      numeroNota: notaNumero.trim() || 'NF-e Anexada',
      chaveAcesso: notaChaveQr.trim() || undefined,
      urlQrCode: notaUrlQr.trim() || undefined,
      origem: notaOrigem,
      nomeArquivo: notaArquivoNome || undefined,
      dataEmissao: notaData,
      valorTotal: notaValor.trim() || undefined,
      arquivoDataUrl: notaArquivoDataUrl || undefined,
      tipoMime: notaTipoMime || undefined,
      statusMonitoramento: 'Monitorada pela Luli',
    };

    const atualizada = fornecedores.map((f) =>
      f.id === selecionado.id
        ? { ...f, notasFiscais: [novaNota, ...(f.notasFiscais || [])] }
        : f
    );
    salvarLista(atualizada);
    pararCamera();
    setModalNotaAberto(false);
    setNotaNumero('');
    setNotaChaveQr('');
    setNotaUrlQr('');
    setNotaValor('');
    setNotaArquivoNome('');
    setNotaArquivoDataUrl('');
    setStatusCamera(null);
    setAbaAtiva('notas');
  };

  const handleExcluirNota = (notaId: string) => {
    if (!selecionado) return;
    const atualizada = fornecedores.map((f) =>
      f.id === selecionado.id
        ? { ...f, notasFiscais: (f.notasFiscais || []).filter((n) => n.id !== notaId) }
        : f
    );
    salvarLista(atualizada);
  };

  const totalNotasMonitoradas = useMemo(
    () => fornecedores.reduce((acc, f) => acc + (f.notasFiscais?.length || 0), 0),
    [fornecedores]
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#081C3A]">
              Rede de fornecedores
            </h1>
            <p className="mt-1 text-lg font-bold text-[#081C3A]">
              Sua agenda de fornecedores com busca por CNPJ e leitura de notas por câmera
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              Cadastre fornecedores pelo CNPJ, leia o QR Code das notas pela câmera ou anexe via galeria/PDF para a Luli monitorar tudo.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-[#0070C0]">
            <ShieldCheck className="h-4 w-4" />
            {totalNotasMonitoradas} nota(s) monitorada(s) pela Luli
          </div>
        </div>

        {/* Busca + botão novo */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar fornecedor por nome, CNPJ ou especialidade"
              className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-[#081C3A] outline-none focus:border-[#0070C0]"
            />
          </div>

          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FF6600] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#e55b00]"
          >
            Cadastrar fornecedor
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#0070C0]"
          >
            <option value="">Todas as categorias</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={regiaoFiltro}
            onChange={(e) => setRegiaoFiltro(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-[#0070C0]"
          >
            <option value="">Todas as regiões</option>
            {REGIOES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {(busca || categoriaFiltro || regiaoFiltro) && (
            <button
              type="button"
              onClick={() => {
                setBusca('');
                setCategoriaFiltro('');
                setRegiaoFiltro('');
              }}
              className="text-xs font-semibold text-[#FF6600] hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Grade principal */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:col-span-7">
            <div className="grid grid-cols-12 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-xs font-bold text-slate-500">
              <div className="col-span-5">Empresa / CNPJ</div>
              <div className="col-span-3">Especialidade</div>
              <div className="col-span-2">Região</div>
              <div className="col-span-2 text-right">Notas</div>
            </div>

            {filtrados.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3 text-sm font-bold text-[#081C3A]">
                  Nenhum fornecedor na sua agenda ainda
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Clique em "Cadastrar fornecedor", informe o CNPJ e o sistema puxa os dados automaticamente.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtrados.map((f) => {
                  const ativo = selecionado?.id === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelecionadoId(f.id)}
                      className={`grid w-full grid-cols-12 items-center px-5 py-4 text-left text-sm transition ${
                        ativo
                          ? 'bg-blue-50/50 ring-1 ring-inset ring-[#0070C0]/40'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="col-span-5 flex items-center gap-3 pr-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#081C3A]">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={`truncate font-bold ${ativo ? 'text-[#0070C0]' : 'text-[#081C3A]'}`}>
                            {f.nomeFantasia || f.nome}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {f.cnpj || 'CNPJ não informado'}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-3 truncate text-xs font-medium text-slate-600">
                        {f.especialidade}
                      </div>
                      <div className="col-span-2 truncate text-xs font-semibold text-[#081C3A]">
                        {f.regiao}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1.5 text-xs font-bold text-[#0070C0]">
                        <span>{f.notasFiscais?.length || 0}</span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Painel lateral de detalhes e notas */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
            {selecionado ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0070C0]">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-extrabold text-[#081C3A]">
                        {selecionado.nomeFantasia || selecionado.nome}
                      </h2>
                      <p className="truncate text-xs text-slate-500">
                        {selecionado.cnpj || 'Fornecedor cadastrado'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => abrirEdicao(selecionado)}
                    title="Editar dados"
                    className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-[#0070C0] hover:text-[#0070C0]"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>

                {/* Abas */}
                <div className="mt-5 flex gap-4 border-b border-slate-100 text-xs font-bold">
                  {[
                    { id: 'visao', label: 'Visão geral' },
                    { id: 'notas', label: `Notas Fiscais (${selecionado.notasFiscais?.length || 0})` },
                    { id: 'categorias', label: 'Categorias' },
                    { id: 'anotacoes', label: 'Anotações' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAbaAtiva(tab.id as any)}
                      className={`border-b-2 pb-2.5 transition ${
                        abaAtiva === tab.id
                          ? 'border-[#0070C0] text-[#0070C0]'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {abaAtiva === 'visao' && (
                  <div className="mt-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <Building2 className="mt-0.5 h-4 w-4 text-[#0070C0]" />
                      <div>
                        <p className="text-xs font-medium text-slate-400">Razão Social & Especialidade</p>
                        <p className="text-sm font-bold text-[#081C3A]">{selecionado.nome}</p>
                        <p className="text-xs text-slate-500">{selecionado.especialidade}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-4 w-4 text-[#0070C0]" />
                      <div>
                        <p className="text-xs font-medium text-slate-400">Localização</p>
                        <p className="text-sm font-bold text-[#081C3A]">
                          {selecionado.cidadeUf ? `${selecionado.cidadeUf} (${selecionado.regiao})` : selecionado.regiao}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Users className="mt-0.5 h-4 w-4 text-[#0070C0]" />
                      <div>
                        <p className="text-xs font-medium text-slate-400">Contato principal</p>
                        <p className="text-sm font-bold text-[#081C3A]">
                          {selecionado.contatoPrincipal || 'Não informado'}
                        </p>
                        {(selecionado.telefone || selecionado.email) && (
                          <p className="text-xs text-slate-500">
                            {[selecionado.telefone, selecionado.email].filter(Boolean).join(' • ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-4 w-4 text-[#0070C0]" />
                      <div>
                        <p className="text-xs font-medium text-slate-400">Observações</p>
                        <p className="text-sm text-slate-600">
                          {selecionado.observacoes || 'Sem observações registradas.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {abaAtiva === 'notas' && (
                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-[#081C3A]">
                      Capture o <strong>QR Code pela câmera</strong> ou anexe via <strong>Galeria / PDF</strong>. A Luli acompanha todas as notas.
                    </div>

                    {(selecionado.notasFiscais || []).length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                        Nenhuma nota fiscal anexada para este fornecedor.
                      </div>
                    ) : (
                      <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
                        {selecionado.notasFiscais.map((nota) => (
                          <div
                            key={nota.id}
                            className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#081C3A]">
                                  NF {nota.numeroNota}
                                </span>
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  {nota.statusMonitoramento}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {nota.dataEmissao} {nota.valorTotal ? `• R$ ${nota.valorTotal}` : ''} • Via {nota.origem.toUpperCase()}
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              {nota.urlQrCode && (
                                <a
                                  href={nota.urlQrCode}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Abrir consulta na SEFAZ"
                                  className="rounded-full p-1.5 text-[#0070C0] hover:bg-blue-100"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                              {nota.arquivoDataUrl && (
                                <button
                                  type="button"
                                  onClick={() => setNotaPreview(nota)}
                                  title="Visualizar comprovante"
                                  className="rounded-full p-1.5 text-[#0070C0] hover:bg-blue-100"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleExcluirNota(nota.id)}
                                title="Remover nota"
                                className="rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {abaAtiva === 'categorias' && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {selecionado.categorias.map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#0070C0]"
                      >
                        <Tag className="h-3.5 w-3.5" />
                        {cat}
                      </span>
                    ))}
                  </div>
                )}

                {abaAtiva === 'anotacoes' && (
                  <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    {selecionado.anotacoes || 'Nenhuma anotação registrada para este fornecedor.'}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setModalNotaAberto(true)}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#0070C0] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#005ea3]"
                >
                  <QrCode className="h-4 w-4" />
                  Ler QR Code ou Anexar Nota Fiscal
                </button>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-slate-400">
                Selecione um fornecedor na lista para ver os detalhes e notas fiscais.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Cadastro/Edição com Busca Automática por CNPJ */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-extrabold text-[#081C3A]">
                {editandoId ? 'Editar fornecedor' : 'Cadastrar fornecedor pelo CNPJ'}
              </h3>
              <button type="button" onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarForm} className="mt-4 space-y-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <label className="mb-1.5 block text-xs font-bold text-[#081C3A]">
                  CNPJ do Fornecedor
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: formatarCnpj(e.target.value) })}
                    placeholder="00.000.000/0001-00"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                  />
                  <button
                    type="button"
                    onClick={handleBuscarCnpj}
                    disabled={buscandoCnpj}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0070C0] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#005ea3] disabled:opacity-60"
                  >
                    <Search className="h-4 w-4" />
                    {buscandoCnpj ? 'Buscando...' : 'Buscar dados do CNPJ'}
                  </button>
                </div>
                {avisoCnpj && (
                  <p className="mt-2 text-xs font-medium text-[#081C3A]">{avisoCnpj}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#081C3A]">Razão Social</label>
                  <input
                    required
                    type="text"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#081C3A]">Nome Fantasia</label>
                  <input
                    type="text"
                    value={form.nomeFantasia}
                    onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#081C3A]">Especialidade</label>
                  <select
                    value={form.especialidade}
                    onChange={(e) => setForm({ ...form, especialidade: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#081C3A]">Região</label>
                  <select
                    value={form.regiao}
                    onChange={(e) => setForm({ ...form, regiao: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                  >
                    {REGIOES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#081C3A]">Contato / Vendedor</label>
                  <input
                    type="text"
                    value={form.contatoPrincipal}
                    onChange={(e) => setForm({ ...form, contatoPrincipal: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#081C3A]">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#081C3A]">Cidade - UF</label>
                  <input
                    type="text"
                    value={form.cidadeUf}
                    onChange={(e) => setForm({ ...form, cidadeUf: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#081C3A]">Observações e CNAE</label>
                <textarea
                  rows={2}
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-[#0070C0]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="rounded-full border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#FF6600] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#e55b00]"
                >
                  Salvar na agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Anexo de Nota Fiscal com Câmera Ao Vivo para QR Code */}
      {modalNotaAberto && selecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-[#081C3A]">
                  Anexar Nota Fiscal
                </h3>
                <p className="text-xs text-slate-500">
                  Fornecedor: {selecionado.nomeFantasia || selecionado.nome}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  pararCamera();
                  setModalNotaAberto(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSalvarNota} className="mt-4 space-y-4">
              {/* 4 botões de captura rápida */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={cameraAtiva ? pararCamera : iniciarCameraQr}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center text-[11px] font-bold transition ${
                    cameraAtiva || notaOrigem === 'qrcode'
                      ? 'border-[#FF6600] bg-orange-50 text-[#FF6600]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {cameraAtiva ? <StopCircle className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
                  {cameraAtiva ? 'Fechar Câmera' : 'Ler QR Code'}
                </button>

                <button
                  type="button"
                  onClick={() => inputCameraFotoRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-200 p-3 text-center text-[11px] font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  <Camera className="h-5 w-5 text-[#0070C0]" />
                  Tirar Foto
                </button>

                <button
                  type="button"
                  onClick={() => inputGaleriaRef.current?.click()}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center text-[11px] font-bold transition ${
                    notaOrigem === 'galeria'
                      ? 'border-[#0070C0] bg-blue-50 text-[#0070C0]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Upload className="h-5 w-5" />
                  Galeria
                </button>

                <button
                  type="button"
                  onClick={() => inputPdfRef.current?.click()}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center text-[11px] font-bold transition ${
                    notaOrigem === 'pdf'
                      ? 'border-[#0070C0] bg-blue-50 text-[#0070C0]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <FileText className="h-5 w-5" />
                  PDF
                </button>
              </div>

              {/* Inputs ocultos */}
              <input
                ref={inputCameraFotoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleArquivoNota(e.target.files?.[0], 'galeria')}
              />
              <input
                ref={inputGaleriaRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleArquivoNota(e.target.files?.[0], 'galeria')}
              />
              <input
                ref={inputPdfRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => handleArquivoNota(e.target.files?.[0], 'pdf')}
              />

              {/* Visualizador da Câmera Ao Vivo */}
              {cameraAtiva && (
                <div className="space-y-2 rounded-2xl border border-[#0070C0]/30 bg-slate-950 p-3">
                  <div className="relative overflow-hidden rounded-xl">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="h-52 w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-dashed border-[#FF6600]/80" />
                  </div>
                  <div className="flex justify-between gap-2">
                    <button
                      type="button"
                      onClick={capturarFotoDaCamera}
                      className="flex-1 rounded-full bg-[#0070C0] py-2 text-xs font-bold text-white"
                    >
                      Capturar Foto Agora
                    </button>
                    <button
                      type="button"
                      onClick={pararCamera}
                      className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white"
                    >
                      Parar
                    </button>
                  </div>
                </div>
              )}

              {statusCamera && (
                <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-[#081C3A]">
                  {statusCamera}
                </div>
              )}

              {notaArquivoNome && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Comprovante anexado: {notaArquivoNome}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-bold text-[#081C3A]">
                  Chave de Acesso (44 dígitos) ou Link do QR Code
                </label>
                <input
                  type="text"
                  value={notaChaveQr}
                  onChange={(e) => aplicarLeituraQr(e.target.value)}
                  placeholder="Preenchido automaticamente pela câmera ou cole aqui"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#0070C0]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#081C3A]">Número da Nota</label>
                  <input
                    required
                    type="text"
                    value={notaNumero}
                    onChange={(e) => setNotaNumero(e.target.value)}
                    placeholder="Ex: 10452"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0070C0]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#081C3A]">Valor (R$)</label>
                  <input
                    type="text"
                    value={notaValor}
                    onChange={(e) => setNotaValor(e.target.value)}
                    placeholder="Ex: 1.450,00"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0070C0]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#081C3A]">Data</label>
                  <input
                    type="date"
                    value={notaData}
                    onChange={(e) => setNotaData(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0070C0]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    pararCamera();
                    setModalNotaAberto(false);
                  }}
                  className="rounded-full border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#0070C0] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#005ea3]"
                >
                  Salvar e monitorar com a Luli
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de visualização de comprovante */}
      {notaPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3">
              <h4 className="text-base font-extrabold text-[#081C3A]">
                Comprovante NF {notaPreview.numeroNota}
              </h4>
              <button type="button" onClick={() => setNotaPreview(null)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            {notaPreview.tipoMime?.includes('pdf') ? (
              <iframe
                src={notaPreview.arquivoDataUrl}
                title="Nota Fiscal PDF"
                className="h-[65vh] w-full rounded-2xl border border-slate-200"
              />
            ) : (
              <img
                src={notaPreview.arquivoDataUrl}
                alt="Comprovante Nota Fiscal"
                className="mx-auto max-h-[65vh] rounded-2xl object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}