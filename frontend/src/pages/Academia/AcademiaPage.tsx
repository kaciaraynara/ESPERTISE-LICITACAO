import React, { useState } from 'react';
import {
  GraduationCap,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Calculator,
  Gavel,
  ShieldAlert,
  ExternalLink,
  CheckCircle,
  HelpCircle,
  BookOpen,
  Search,
} from 'lucide-react';

interface GuiaPratico {
  id: string;
  numero: number;
  titulo: string;
  subtitulo: string;
  icone: React.ElementType;
  tags: string[];
  conteudo: {
    introducao: string;
    topicos: {
      titulo: string;
      descricao: string;
      detalhes?: string[];
      links?: { rotulo: string; url: string }[];
    }[];
    dicaOuro: string;
  };
}

export const AcademiaPage: React.FC = () => {
  const [busca, setBusca] = useState('');
  const [guiaAberto, setGuiaAberto] = useState<string | null>('1'); // Primeiro aberto por padrão

  const guias: GuiaPratico[] = [
    {
      id: '1',
      numero: 1,
      titulo: 'Como tirar todas as Certidões Grátis',
      subtitulo: 'Emita CND Federal, CNDT Trabalhista, FGTS, Estadual e Municipal em poucos minutos sem gastar nada.',
      icone: FileCheck2,
      tags: ['Habilitação Fiscal', 'Documentação', 'Art. 68'],
      conteudo: {
        introducao:
          'A habilitação fiscal e trabalhista é o primeiro crivo eliminatório em licitações (Art. 68 da Lei 14.133/2021). Todas as certidões federais e trabalhistas são gratuitas e emitidas imediatamente pela internet.',
        topicos: [
          {
            titulo: '1. CND Federal / PGFN (Débitos Relativos a Créditos Tributários Federais)',
            descricao:
              'Comprova a regularidade perante a Receita Federal do Brasil e a Procuradoria-Geral da Fazenda Nacional (inclui contribuições previdenciárias do INSS). Validade de 180 dias.',
            detalhes: [
              'Emitida diretamente no portal da Receita Federal ou e-CAC.',
              'Se houver pendência de parcelamento em dia, é emitida a "Certidão Positiva com Efeitos de Negativa" (tem o mesmo valor jurídico).',
            ],
            links: [
              {
                rotulo: 'Emitir CND Federal (Receita/PGFN)',
                url: 'https://servicos.receita.fazenda.gov.br/servicos/certidaointernet/pj/consultar',
              },
            ],
          },
          {
            titulo: '2. CNDT - Certidão Negativa de Débitos Trabalhistas (TST)',
            descricao:
              'Obrigatória para verificar se a empresa possui condenações trabalhistas transitadas em julgado no Banco Nacional de Devedores Trabalhistas (BNDT). Validade de 180 dias.',
            detalhes: [
              'Emitida gratuitamente no portal do Tribunal Superior do Trabalho (TST).',
              'Emissão instantânea digitando apenas os 14 dígitos do CNPJ.',
            ],
            links: [
              {
                rotulo: 'Emitir CNDT no TST',
                url: 'https://cndt-certidao.tst.jus.br/gerarCertidao.faces',
              },
            ],
          },
          {
            titulo: '3. CRF - Certificado de Regularidade do FGTS (Caixa)',
            descricao:
              'Atesta que a empresa está recolhendo regularmente o Fundo de Garantia do Tempo de Serviço de seus colaboradores. Validade de 30 dias.',
            detalhes: [
              'Emitido pelo portal da Caixa Econômica Federal.',
              'Requer que as guias mensais de FGTS (via Conectividade Social / FGTS Digital) estejam recolhidas pontualmente.',
            ],
            links: [
              {
                rotulo: 'Emitir CRF do FGTS (Caixa)',
                url: 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf',
              },
            ],
          },
          {
            titulo: '4. CND Estadual e Municipal',
            descricao:
              'Atestam a ausência de dívidas de ICMS/IPVA perante a Secretaria da Fazenda Estadual (SEFAZ) e de ISS/Taxas com a Prefeitura da comarca sede da empresa.',
            detalhes: [
              'SEFAZ Estadual: Pesquise no Google por "CND SEFAZ [Sigla do seu Estado]". Na maioria dos estados é gratuita e sai na hora.',
              'Prefeitura Municipal: Acesse a Secretaria de Finanças/Tributação da cidade onde seu CNPJ está registrado.',
            ],
          },
          {
            titulo: '5. Certidão Negativa de Falência e Recuperação Judicial',
            descricao:
              'Emitida pelos distribuidores cíveis do Tribunal de Justiça do estado da sede da empresa. Se sua comarca for digital (e-SAJ ou PJe), a certidão é gerada online.',
            detalhes: [
              'Sob a Lei 14.133/2021 (Art. 69, II), empresas em recuperação judicial podem licitar se apresentarem plano de recuperação acolhido judicialmente.',
            ],
          },
        ],
        dicaOuro:
          'Dica de Ouro: Programe um alarme para renovar suas certidões a cada 25 dias. O CRF do FGTS vence em 30 dias e a inabilitação por certidão vencida é a causa número 1 de perda de contratos públicos!',
      },
    },
    {
      id: '2',
      numero: 2,
      titulo: 'Como precificar sem tomar prejuízo',
      subtitulo: 'Entenda custos diretos, frete, impostos e defina seu Stop-Loss antes de abrir a Sala de Disputas.',
      icone: Calculator,
      tags: ['Precificação', 'Stop-Loss', 'BDI', 'Gestão Financeira'],
      conteudo: {
        introducao:
          'Ganhar licitação com preço inexequível é garantia de multa, suspensão cadastral e falência. Precificar para o setor público exige considerar impostos na fonte, prazos de pagamento e retenções.',
        topicos: [
          {
            titulo: '1. A Fórmula do Preço Mínimo (Stop-Loss)',
            descricao:
              'Nunca entre em uma disputa sem saber o seu menor lance matematicamente seguro:',
            detalhes: [
              'Preço Mínimo = (Custo de Aquisição/Insumos + Frete + Embalagem) ÷ (1 - % Impostos - % Despesas Fixas - % Lucro Mínimo).',
              'Exemplo: Produto custa R$ 100 + R$ 10 de frete. Seus tributos são 10%, custos fixos 5% e margem mínima 10%. Divide-se 110 por (1 - 0,25 = 0,75) = R$ 146,67. Este é seu limite absoluto.',
            ],
          },
          {
            titulo: '2. Custo Financeiro do Fluxo de Caixa Público',
            descricao:
              'A Administração Pública costuma pagar entre 30 e 60 dias após o ateste da Nota Fiscal.',
            detalhes: [
              'Se você precisa pagar o fornecedor à vista ou em 28 dias, embute ao menos 2% a 3% ao mês de custo financeiro de capital de giro.',
              'Verifique no Termo de Referência se há cláusula de liquidação em 5 ou 10 dias (especialmente em compras diretas / dispensas).',
            ],
          },
          {
            titulo: '3. Armadilhas de Frete e Entrega Fragmentada',
            descricao:
              'Muitos editais de Registro de Preços (SRP) exigem entregas fracionadas em diversos pontos do município ou do estado.',
            detalhes: [
              'Se você cotar um único frete de carga fechada e o órgão pedir 20 entregas de 5 caixas cada, o custo de logística comerá todo o seu lucro.',
              'Leia sempre o item "Condições e Locais de Entrega" no Termo de Referência antes de enviar o valor inicial.',
            ],
          },
          {
            titulo: '4. Regime Tributário e Retenções Federais',
            descricao:
              'Empresas do Simples Nacional não sofrem retenção na fonte de IRPJ/CSLL/PIS/COFINS por órgãos federais, mas empresas de Lucro Presumido ou Real têm 5,85% a 9,45% retidos no pagamento.',
            detalhes: [
              'Certifique-se de que a alíquota utilizada na proposta corresponde exatamente ao seu anexo do Simples ou enquadramento fiscal.',
            ],
          },
        ],
        dicaOuro:
          'Dica de Ouro: Na Sala de Disputas, o concorrente que derruba o preço 50% abaixo do mercado quase sempre será inabilitado por proposta inexequível ou abandonará o contrato. Mantenha a disciplina no seu Stop-Loss e aguarde o chamamento do segundo lugar!',
      },
    },
    {
      id: '3',
      numero: 3,
      titulo: 'Como funciona o Pregão e a Dispensa na prática',
      subtitulo: 'Domine a dinâmica dos modos Aberto e Aberto-Fechado e as oportunidades rápidas da Dispensa Eletrônica.',
      icone: Gavel,
      tags: ['Pregão Eletrônico', 'Dispensa Eletrônica', 'Lei 14.133/2021'],
      conteudo: {
        introducao:
          'O Pregão Eletrônico e a Dispensa Eletrônica são responsáveis por mais de 85% de todas as compras governamentais no Brasil sob a Lei 14.133/2021.',
        topicos: [
          {
            titulo: '1. Dispensa Eletrônica (Art. 75 da Lei 14.133/2021)',
            descricao:
              'Procedimento simplificado e rápido para compras de valor reduzido (obras e engenharia até R$ 119 mil; bens e serviços até R$ 59 mil - valores atualizados por decreto anual).',
            detalhes: [
              'Prazo de envio de propostas e disputa: mínimo de 3 dias úteis.',
              'A sessão pública é 100% eletrônica e tem duração pré-fixada (ex: 6 horas de lances).',
              'Ideal para quem está começando: burocracia documental mínima e contratação imediata.',
            ],
          },
          {
            titulo: '2. Pregão Eletrônico - Modo de Disputa ABERTO',
            descricao:
              'Utilizado para bens e serviços comuns. A disputa dura 10 minutos iniciais corridos.',
            detalhes: [
              'Se houver algum lance nos últimos 2 minutos, o sistema prorroga automaticamente por mais 2 minutos sucessivos.',
              'A etapa só encerra quando passarem 2 minutos completos sem nenhum novo lance de nenhum licitante.',
              'Estratégia: monitore o relógio e oferte lances moderados para forçar a prorrogação sem queimar sua margem cedo demais.',
            ],
          },
          {
            titulo: '3. Pregão Eletrônico - Modo ABERTO E FECHADO',
            descricao:
              'Etapa aberta de 15 minutos livres seguida de uma rodada fechada e sigilosa.',
            detalhes: [
              'Etapa Aberta: 15 minutos sem prorrogação.',
              'Etapa Fechada: os licitantes que ofertaram as melhores propostas (até 10% de diferença do primeiro) recebem 5 minutos para dar um lance final e sigiloso.',
              'Estratégia: durante os 15 minutos abertos, garanta que você fique entre os 3 primeiros colocados para entrar na etapa fechada com chance de vitória.',
            ],
          },
          {
            titulo: '4. Desempate ME/EPP (Lei Complementar 123/2006)',
            descricao:
              'Microempresas e Empresas de Pequeno Porte têm direito de preferência legal.',
            detalhes: [
              'Se a melhor proposta for de grande empresa e a sua ME estiver até 5% acima (no Pregão) ou 10% acima (em outras modalidades), você é convocado para dar o lance final de desempate e vencer.',
            ],
          },
        ],
        dicaOuro:
          'Dica de Ouro: Sempre declare o enquadramento de ME/EPP na plataforma de compras antes de iniciar o certame. Perder o desempate ficto de 5% por esquecer de marcar a opção na proposta inicial é um erro imperdoável.',
      },
    },
    {
      id: '4',
      numero: 4,
      titulo: 'Quando e como recorrer',
      subtitulo: 'Prazos fatais de intenção de recurso, fundamentação jurídica e as teses com maior taxa de vitória no TCU.',
      icone: ShieldAlert,
      tags: ['Recursos', 'Jurisprudência TCU', 'Art. 165', 'Impugnação'],
      conteudo: {
        introducao:
          'O recurso administrativo é um direito legal garantido pelo Art. 165 da Lei 14.133/2021. Saber a hora certa de manifestar a intenção e redigir a peça pode transformar uma segunda colocação em vitória do contrato.',
        topicos: [
          {
            titulo: '1. O Momento Fatal: Intenção Imediata e Motivada',
            descricao:
              'Logo após o pregoeiro julgar a habilitação ou proposta do vencedor, ele abre o prazo de intenção de recurso no chat oficial (geralmente entre 10 e 30 minutos).',
            detalhes: [
              'ATENÇÃO: Se você não registrar a intenção nesse intervalo, ocorre a PRECLUSÃO e você perde o direito de recorrer.',
              'A motivação deve ser sucinta e apontar a ilegalidade (Exemplo: "Manifestamos intenção de recorrer contra a habilitação da empresa X, pois o atestado apresentado não atende à capacidade técnica exigida no item 9.2 do Edital").',
            ],
          },
          {
            titulo: '2. Prazo para Envio das Razões e Contrarrazões',
            descricao:
              'Uma vez aceita a intenção pelo pregoeiro, iniciam-se os prazos formais de sustentação.',
            detalhes: [
              '3 dias úteis para a recorrente juntar a petição com as Razões de Recurso (Art. 165, § 1º).',
              '3 dias úteis subsequentes para os demais licitantes apresentarem Contrarrazões de Recurso.',
              'A Administração tem 10 dias úteis para julgar.',
            ],
          },
          {
            titulo: '3. As 3 Melhores Teses Aceitas pelo TCU',
            descricao:
              'Utilize precedentes consolidados do Tribunal de Contas da União para embasar seu recurso:',
            detalhes: [
              'Tese 1 - Princípio do Formalismo Moderado (Súmula TCU 263): Erros materiais sanáveis (como datas ou assinaturas digitais válidas) não podem desclassificar a proposta mais vantajosa.',
              'Tese 2 - Diligência Obrigatória (Art. 64 da Lei 14.133/2021): O pregoeiro tem o dever de realizar diligência para sanar dúvidas sobre atestados e catálogos antes de inabilitar.',
              'Tese 3 - Proposta Inexequível Real: Se o concorrente ofertou valor abaixo do custo de fábrica e não demonstrou a viabilidade quando intimado, deve ser desclassificado.',
            ],
          },
        ],
        dicaOuro:
          'Dica de Ouro: Seja estritamente técnico e respeitoso nas razões. Ataques pessoais ao agente de contratação irritam o julgador e diminuem a probabilidade de provimento do seu recurso. Cite sempre artigos da Lei 14.133 e Acórdãos do TCU!',
      },
    },
  ];

  const guiasFiltrados = guias.filter((g) => {
    const texto = `${g.titulo} ${g.subtitulo} ${g.tags.join(' ')} ${g.conteudo.introducao}`.toLowerCase();
    return texto.includes(busca.toLowerCase());
  });

  const toggleGuia = (id: string) => {
    setGuiaAberto((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-[#334155] p-6 md:p-8 max-w-6xl mx-auto">
      {/* CABEÇALHO */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-[#0B192C] text-white rounded-xl shadow-xs">
              <GraduationCap size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[#0B192C] tracking-tight">
                Academia do Licitante & Guias Práticos
              </h1>
              <p className="text-xs text-[#334155] mt-0.5 font-medium flex items-center gap-1.5">
                <BookOpen size={14} className="text-[#F97316]" />
                Manuais operacionais diretos ao ponto baseados na Lei 14.133/2021 e jurisprudência do TCU.
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 self-start md:self-auto">
          4 Guias Práticos Completos
        </div>
      </header>

      {/* BARRA DE PESQUISA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 flex items-center gap-3">
        <Search size={18} className="text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Pesquisar nos guias: certidões grátis, stop-loss, pregão aberto, recurso TCU..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B192C] focus:outline-none focus:ring-2 focus:ring-[#0B192C]"
        />
      </div>

      {/* LISTA DE 4 CARDS EXPANSÍVEIS (ACCORDION) */}
      <div className="space-y-4">
        {guiasFiltrados.map((guia) => {
          const isOpen = guiaAberto === guia.id;
          const Icone = guia.icone;

          return (
            <div
              key={guia.id}
              className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
                isOpen ? 'border-[#0B192C] ring-1 ring-[#0B192C]/10' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* TOPO DO CARD (CLICÁVEL PARA EXPANDIR) */}
              <button
                type="button"
                onClick={() => toggleGuia(guia.id)}
                className="w-full p-5 text-left flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl shrink-0 transition-colors ${
                    isOpen ? 'bg-[#0B192C] text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    <Icone size={24} />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-800 uppercase tracking-wide">
                        Guia #{guia.numero}
                      </span>
                      {guia.tags.map((tag) => (
                        <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <h3 className="text-base font-bold text-[#0B192C] leading-snug">
                      {guia.titulo}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {guia.subtitulo}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pt-1 text-slate-400">
                  {isOpen ? <ChevronUp size={20} className="text-[#0B192C]" /> : <ChevronDown size={20} />}
                </div>
              </button>

              {/* CORPO EXPANSÍVEL DO GUIA */}
              {isOpen && (
                <div className="px-5 pb-6 pt-2 border-t border-slate-100 space-y-5 animate-in fade-in duration-150">
                  {/* INTRODUÇÃO */}
                  <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-700 leading-relaxed font-medium border border-slate-200/60">
                    {guia.conteudo.introducao}
                  </div>

                  {/* TÓPICOS ESTRUTURADOS */}
                  <div className="space-y-4">
                    {guia.conteudo.topicos.map((topico, idx) => (
                      <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-white shadow-2xs space-y-2">
                        <h4 className="text-xs font-bold text-[#0B192C] flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          {topico.titulo}
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed pl-7">
                          {topico.descricao}
                        </p>

                        {topico.detalhes && topico.detalhes.length > 0 && (
                          <ul className="pl-7 space-y-1.5 mt-2">
                            {topico.detalhes.map((det, dIdx) => (
                              <li key={dIdx} className="text-[11px] text-slate-600 flex items-start gap-2">
                                <CheckCircle size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                                <span>{det}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {topico.links && topico.links.length > 0 && (
                          <div className="pl-7 pt-2 flex flex-wrap gap-2">
                            {topico.links.map((link, lIdx) => (
                              <a
                                key={lIdx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors"
                              >
                                {link.rotulo} <ExternalLink size={12} />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* DICA DE OURO */}
                  <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-950 font-medium flex items-start gap-3">
                    <div className="p-1.5 bg-orange-200 text-[#F97316] rounded-lg shrink-0">
                      <HelpCircle size={18} />
                    </div>
                    <div className="leading-relaxed">
                      {guia.conteudo.dicaOuro}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
