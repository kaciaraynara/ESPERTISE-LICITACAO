import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
   ShieldCheck,
   CheckCircle,
   MagnifyingGlass,
   FileText,
   LockKey,
   CaretDown,
   CaretRight,
   WarningCircle,
   Clock,
   CurrencyCircleDollar,
   Scales,
   Check,
   X,
   ArrowRight,
   ShieldWarning,
   Calculator,
   Briefcase
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
   const navigate = useNavigate();
   const [activeFaq, setActiveFaq] = useState<number | null>(null);
   const [billingPeriod, setBillingPeriod] = useState<'mensal' | 'anual'>('mensal');

   const faqs = [
      {
         q: "Como o sistema garante que minha empresa não será inabilitada por certidão vencida?",
         a: "O módulo Cofre de Habilitação monitora em tempo real a validade de todas as suas certidões (CND Federal, FGTS, CNDT Trabalhista, CNDs Estaduais e Municipais). O sistema emite alertas preventivos com 30, 15, 7 e 2 dias de antecedência no seu painel e via notificação direta, impedindo que você ingresse em uma sessão pública do PNCP ou Compras.gov com documentação expirada."
      },
      {
         q: "O que a análise de editais identifica exatamente no Termo de Referência?",
         a: "O leitor especializado faz o confronto imediato das cláusulas do edital com os requisitos da Lei 14.133/2021 e jurisprudências do TCU. Ele extrai e destaca: índices contábeis exigidos (como Liquidez Geral e Corrente), prazos fatais para pedidos de esclarecimento e impugnação (3 dias úteis antes da abertura), atestados técnicos solicitados, exigências de vistoria técnica e eventuais cláusulas ilegais que restrinjam a competitividade."
      },
      {
         q: "Como funciona a calculadora de BDI para evitar prejuízos na fase de lances?",
         a: "Antes de ingressar na disputa do pregão eletrônico, você insere seus custos diretos de produto ou mão de obra, alíquota de impostos (Simples, Lucro Presumido ou Real), frete e despesas administrativas. A plataforma calcula o BDI e trava o seu Preço Mínimo Operacional. Durante os lances, você sabe exatamente qual é o limite seguro para não arrematar um lote que cause prejuízo durante a vigência do contrato."
      },
      {
         q: "Minhas propostas, margens e estratégias de preço ficam protegidas contra concorrentes?",
         a: "Sim, de forma absoluta. Cada empresa possui seu próprio ambiente de dados isolado com criptografia em repouso e em trânsito. Nenhum outro participante, analista ou concorrente tem acesso aos seus custos, propostas cadastradas, preços mínimos ou atestados arquivados. Operamos em estrita observância à Lei Geral de Proteção de Dados (LGPD)."
      },
      {
         q: "Posso gerenciar mais de uma empresa ou filial na mesma conta?",
         a: "Sim. A plataforma conta com suporte nativo multi-empresa. Você pode alternar entre matriz e filiais, ou entre diferentes empresas do mesmo grupo econômico, mantendo documentos, certidões, cadastros no SICAF e editais monitorados organizados em ambientes separados."
      },
      {
         q: "Existe fidelidade ou multa rescisória caso eu decida cancelar?",
         a: "Não exigimos qualquer fidelidade ou carência nos planos mensais. Você tem total liberdade para renovar ou interromper a assinatura a qualquer momento com apenas um clique diretamente no seu painel de configurações."
      }
   ];

   const operationalMetrics = [
      {
         value: "R$ 480M+",
         label: "Em disputas monitoradas",
         detail: "Sem nenhuma inabilitação por prazo ou certidão"
      },
      {
         value: "100%",
         label: "Cobertura PNCP e Compras.gov",
         detail: "Mapeamento contínuo das contratações públicas"
      },
      {
         value: "3 Dias Úteis",
         label: "Alerta do prazo de impugnação",
         detail: "Tempo hábil para protocolar peças antes da sessão"
      },
      {
         value: "Zero",
         label: "Lances com margem negativa",
         detail: "Cálculo travado com BDI e tributos validados"
      }
   ];

   const bleedingPains = [
      {
         title: "Inabilitação sumária por certidão vencida 24h antes",
         desc: "Sua equipe passou dias elaborando a proposta de preço. No momento de juntar os documentos fiscais no SICAF ou portal de compras, uma CND Municipal ou Estadual havia expirado no dia anterior. Desclassificação automática sem direito a recurso.",
         solution: "Cofre com contador regressivo de validade e alertas programados antes do vencimento."
      },
      {
         title: "Cláusula ilegal aceita por perda do prazo de impugnação",
         desc: "O edital exige índice de liquidez desproporcional ou marca exclusiva no Termo de Referência. O prazo legal da Lei 14.133/2021 para impugnar é de até 3 dias úteis antes da abertura da sessão. Quando a equipe percebe, o prazo precluiu.",
         solution: "Extração dos pontos críticos e contagem automática do prazo fatal de impugnação."
      },
      {
         title: "Contrato assinado que dá prejuízo mês a mês",
         desc: "Na adrenalina da disputa de lances, o analista reduz o valor para vencer o concorrente, sem ponderar substituição tributária, frete e encargos trabalhistas. O contrato é homologado e a empresa fica amarrada a um fornecimento deficitário.",
         solution: "Calculadora de Preço de Disputa com trava de margem líquida e BDI inegociável."
      },
      {
         title: "Horas gastas lendo 200 páginas de edital para achar um veto",
         desc: "Seus colaboradores leem anexos intermináveis para descobrir, na página 78, uma exigência de qualificação técnica que a sua empresa não atende. Dias de trabalho jogados fora que poderiam ser aplicados em editais viáveis.",
         solution: "Resumo executivo com apontamento imediato das exigências de habilitação técnica."
      }
   ];

   const coreModules = [
      {
         step: "MÓDULO 01",
         icon: <MagnifyingGlass weight="bold" className="w-6 h-6 text-[#10B981]" />,
         title: "Radar Especializado de Compras Governamentais",
         desc: "Filtro direcionado exclusivamente pelo seu CNAE, palavras-chave do seu catálogo e localização geográfica. Conectado ao Portal Nacional de Contratações Públicas (PNCP) e aos principais portais estaduais e municipais.",
         bullets: ["Eliminação de editais fora do seu escopo de fornecimento", "Aviso de novas publicações e retificações no diário oficial", "Separação por modalidade: Pregão Eletrônico, Concorrência e Dispensa"]
      },
      {
         step: "MÓDULO 02",
         icon: <FileText weight="bold" className="w-6 h-6 text-[#10B981]" />,
         title: "Leitor Jurídico de Editais e Termos de Referência",
         desc: "Varredura imediata dos pontos cruciais do documento de contratação. Identifica em instantes se a disputa exige balanço patrimonial com índices específicos, atestado registrado em conselho ou certidões especiais.",
         bullets: ["Extração do prazo fatal de impugnação e pedidos de esclarecimento", "Detecção de cláusulas potencialmente restritivas ou abusivas", "Checklist automático de documentos necessários para o certame"]
      },
      {
         step: "MÓDULO 03",
         icon: <ShieldCheck weight="bold" className="w-6 h-6 text-[#10B981]" />,
         title: "Cofre Central de Habilitação Jurídica e Fiscal",
         desc: "Guarda permanente e auditável dos documentos de qualificação técnica, jurídica, fiscal e trabalhista da sua empresa, organizados por pastas e integrados ao calendário de certidões públicas.",
         bullets: ["Painel com status de cada certidão (Válida, Vencendo, Expirada)", "Repositório seguro de atestados de capacidade técnica e certidões de acervo", "Download em lote para habilitação rápida em qualquer portal"]
      },
      {
         step: "MÓDULO 04",
         icon: <Calculator weight="bold" className="w-6 h-6 text-[#10B981]" />,
         title: "Calculadora de Preço de Disputa e BDI Seguro",
         desc: "Ferramenta de engenharia de preços para pregões e dispensas. Defina o custo unitário da mercadoria ou serviço, custos tributários e margem mínima. O sistema estabelece o piso absoluto para a disputa.",
         bullets: ["Alerta visual quando o lance do pregão atinge o ponto de equilíbrio", "Cálculo automatizado de encargos, frete e BDI por lote", "Histórico de preços arrematados por concorrentes em licitações anteriores"]
      },
      {
         step: "MÓDULO 05",
         icon: <Scales weight="bold" className="w-6 h-6 text-[#10B981]" />,
         title: "Estruturador de Impugnações e Recursos Administrativos",
         desc: "Modelos estruturados de peças administrativas fundamentadas na Lei 14.133/2021 e jurisprudências consolidadas. Defenda o direito da sua empresa contra desclassificações arbitrárias de pregoeiros.",
         bullets: ["Minutas para questionamento de Termos de Referência restritivos", "Peças para recurso contra habilitação indevida de concorrente sem CND", "Contrarrazões e pedidos de esclarecimento com prazos monitorados"]
      }
   ];

   const comparisonRows = [
      {
         criteria: "Controle de Certidões Negativas",
         manual: "Planilha do Excel conferida manualmente. Risco permanente de esquecimento.",
         expertise: "Monitoramento contínuo com alertas visuais e avisos antes de expirar."
      },
      {
         criteria: "Triagem de Editais no PNCP",
         manual: "Buscas demoradas e manuais, acumulando centenas de editais sem aderência.",
         expertise: "Filtro restrito por CNAE, palavras-chave e localização, entregando apenas editais viáveis."
      },
      {
         criteria: "Análise do Termo de Referência",
         manual: "Leitura exaustiva de mais de 100 páginas para checar exigências de atestado e prazos.",
         expertise: "Painel executivo com requisitos de habilitação e prazos de impugnação destacados."
      },
      {
         criteria: "Controle de Margem no Pregão",
         manual: "Cálculos mentais ou em papel durante a disputa, correndo risco de lance com prejuízo.",
         expertise: "Calculadora de BDI com preço de corte estipulado antes da abertura da sessão."
      },
      {
         criteria: "Elaboração de Impugnações",
         manual: "Dificuldade para redigir peças formais no curto prazo legal de 3 dias úteis.",
         expertise: "Estruturação fundamentada nas regras da Lei 14.133/2021 e decisões do TCU."
      }
   ];

   const fadeInUp = {
      hidden: { opacity: 0, y: 24 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
   };

   return (
      <div className="min-h-screen w-full bg-[#F8FAFC] font-sans antialiased text-slate-800 selection:bg-[#10B981] selection:text-white">
         
         {/* BARRA SUPERIOR DE CONFORMIDADE */}
         <div className="w-full bg-[#0F172A] border-b border-slate-800 text-slate-300 py-2 px-4 text-xs font-medium">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
               <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="text-slate-200 font-semibold tracking-wide">Radar PNCP & Compras.gov Ativo</span>
                  <span className="hidden sm:inline text-slate-500">|</span>
                  <span className="hidden sm:inline text-slate-400">Em total conformidade com a Nova Lei de Licitações (Lei 14.133/2021)</span>
               </div>
               <div className="flex items-center gap-4 text-slate-400">
                  <span>Acesso Seguro com Criptografia de Ponta</span>
               </div>
            </div>
         </div>

         {/* NAVEGAÇÃO PRINCIPAL (HEADER FLUTUANTE) */}
         <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-sm transition-all">
            <div className="max-w-7xl mx-auto flex h-20 items-center justify-between px-6 lg:px-12">
               
               {/* Logo Corporativa */}
               <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0F172A] text-[#10B981] shadow-sm border border-slate-700">
                     <Scales weight="bold" className="w-6 h-6" />
                  </div>
                  <div>
                     <span className="font-black text-lg tracking-tight text-[#0F172A] block leading-none">EXPERTISE</span>
                     <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mt-1">Licitatória</span>
                  </div>
               </div>

               {/* Links Rápidos */}
               <nav className="hidden lg:flex items-center gap-8">
                  <a href="#dores" className="text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-[#0F172A] transition-colors">
                     Riscos na Disputa
                  </a>
                  <a href="#modulos" className="text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-[#0F172A] transition-colors">
                     Módulos do Sistema
                  </a>
                  <a href="#comparativo" className="text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-[#0F172A] transition-colors">
                     Comparativo
                  </a>
                  <a href="#planos" className="text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-[#0F172A] transition-colors">
                     Planos e Preços
                  </a>
                  <a href="#faq" className="text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-[#0F172A] transition-colors">
                     Perguntas Frequentes
                  </a>
               </nav>

               {/* Ações de Conversão */}
               <div className="flex items-center gap-4">
                  <button 
                     onClick={() => navigate('/login')} 
                     className="text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-[#0F172A] transition-colors px-3 py-2"
                  >
                     Entrar no Painel
                  </button>
                  <button 
                     onClick={() => navigate('/register')} 
                     className="flex items-center gap-2 rounded-xl bg-[#10B981] hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider px-6 py-3.5 shadow-[0_8px_20px_rgba(16,185,129,0.25)] transition-all hover:-translate-y-0.5"
                  >
                     <span>Começar Agora</span>
                     <CaretRight weight="bold" className="w-4 h-4" />
                  </button>
               </div>
            </div>
         </header>

         {/* 1. HERO SECTION: DOR REAL E CONTROLE DA OPERAÇÃO */}
         <section className="relative w-full bg-white border-b border-[#E2E8F0] pt-14 pb-20 lg:pt-20 lg:pb-28 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 lg:px-12">
               
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
                  
                  {/* Lado Esquerdo: Mensagem de Alto Impacto */}
                  <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="lg:col-span-7 space-y-6">
                     
                     <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-[#F8FAFC] px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                        <Briefcase weight="bold" className="w-4 h-4 text-[#10B981]" />
                        <span>Gestão Completa de Licitações Públicas</span>
                     </div>

                     <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] tracking-tight leading-[1.15]">
                        Pare de perder contratos públicos por <span className="text-[#0F172A] underline decoration-[#10B981] decoration-4 underline-offset-4">certidão vencida</span> ou erro de cálculo no pregão.
                     </h1>

                     <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-2xl">
                        Centralize o monitoramento de editais no PNCP e Compras.gov, aponte exigências ilegais no Termo de Referência antes do fim do prazo de impugnação e nunca mais arremate um lote com margem de prejuízo.
                     </p>

                     {/* Bullets de Confiança Técnica */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                           <CheckCircle weight="fill" className="w-5 h-5 text-[#10B981] shrink-0" />
                           <span>Alerta de CND antes de vencer</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                           <CheckCircle weight="fill" className="w-5 h-5 text-[#10B981] shrink-0" />
                           <span>Prazo de 3 dias para impugnar</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                           <CheckCircle weight="fill" className="w-5 h-5 text-[#10B981] shrink-0" />
                           <span>Cálculo seguro de BDI e tributos</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                           <CheckCircle weight="fill" className="w-5 h-5 text-[#10B981] shrink-0" />
                           <span>Filtro de editais pelo seu CNAE</span>
                        </div>
                     </div>

                     {/* Botão de Ação Primário */}
                     <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
                        <button 
                           onClick={() => navigate('/register')} 
                           className="flex items-center justify-center gap-3 rounded-xl bg-[#10B981] hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-black uppercase tracking-widest px-8 py-5 shadow-[0_12px_28px_rgba(16,185,129,0.28)] transition-all hover:-translate-y-0.5"
                        >
                           <span>Cadastrar Minha Empresa no Sistema</span>
                           <ArrowRight weight="bold" className="w-5 h-5" />
                        </button>

                        <a 
                           href="#modulos" 
                           className="flex items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#0F172A] text-xs font-bold uppercase tracking-wider px-6 py-5 shadow-sm transition-colors text-center"
                        >
                           <span>Conhecer os Módulos</span>
                        </a>
                     </div>

                     <p className="text-xs text-slate-500 font-medium">
                        Ativação imediata com seu CNPJ. Sem taxa de comissão sobre contratos vencidos.
                     </p>

                  </motion.div>

                  {/* Lado Direito: Simulador Visual do ERP Interno */}
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="lg:col-span-5">
                     <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xl overflow-hidden">
                        
                        {/* Barra Superior da Janela do ERP */}
                        <div className="bg-[#0F172A] px-4 py-3 flex items-center justify-between border-b border-slate-800 text-white">
                           <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
                              <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
                              <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
                              <span className="ml-2 text-xs font-mono font-medium text-slate-300">expertise-erp.painel</span>
                           </div>
                           <span className="text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-[#10B981] px-2.5 py-0.5 rounded border border-emerald-500/30">
                              Disputa Monitorada
                           </span>
                        </div>

                        {/* Conteúdo Realista do Painel Interno */}
                        <div className="p-6 space-y-4 bg-[#F8FAFC]">
                           
                           {/* Card de Alerta de Pregão */}
                           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                              <div className="flex items-center justify-between">
                                 <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pregão Eletrônico nº 48/2026</span>
                                 <span className="text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                                    Termo de Referência
                                 </span>
                              </div>
                              <h4 className="text-sm font-bold text-[#0F172A] leading-snug">
                                 Aquisição e Fornecimento Contínuo de Materiais e Serviços Operacionais
                              </h4>
                              <p className="text-xs text-slate-500">Órgão: Tribunal Regional Federal • PNCP ID: 198273/2026</p>
                              
                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                 <span className="text-slate-500">Valor Estimado:</span>
                                 <span className="font-black text-[#0F172A]">R$ 1.450.000,00</span>
                              </div>
                           </div>

                           {/* Checklist de Segurança Operacional */}
                           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                              <div className="text-xs font-black uppercase tracking-wider text-[#0F172A] flex items-center gap-2">
                                 <ShieldCheck weight="bold" className="w-4 h-4 text-[#10B981]" />
                                 <span>Auditoria Prévia de Habilitação</span>
                              </div>

                              <div className="space-y-2 text-xs">
                                 <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/70 border border-emerald-100">
                                    <div className="flex items-center gap-2">
                                       <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981]" />
                                       <span className="font-bold text-slate-800">CND Federal e Trabalhista (CNDT)</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-[#10B981] uppercase">Válidas (42 dias)</span>
                                 </div>

                                 <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/70 border border-amber-200">
                                    <div className="flex items-center gap-2">
                                       <Clock weight="fill" className="w-4 h-4 text-amber-600" />
                                       <span className="font-bold text-slate-800">Prazo de Impugnação do Edital</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-amber-700 uppercase">Restam 28 horas</span>
                                 </div>

                                 <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                                    <div className="flex items-center gap-2">
                                       <CurrencyCircleDollar weight="fill" className="w-4 h-4 text-slate-600" />
                                       <span className="font-bold text-slate-800">Piso Mínimo de Lance (BDI Calculado)</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-900 uppercase">R$ 1.180.200,00</span>
                                 </div>
                              </div>
                           </div>

                           {/* Botão de Análise Imediata */}
                           <div className="p-3 rounded-xl bg-[#0F172A] text-white flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 font-bold">
                                 <WarningCircle weight="bold" className="w-4 h-4 text-amber-400" />
                                 <span>1 Cláusula Restritiva Identificada</span>
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#10B981] underline cursor-pointer">
                                 Gerar Impugnação →
                              </span>
                           </div>

                        </div>
                     </div>
                  </motion.div>

               </div>

            </div>
         </section>

         {/* 2. BARRA DE FATOS E NÚMEROS OPERACIONAIS */}
         <section className="w-full bg-[#0F172A] text-white py-12 px-6 lg:px-12 border-b border-slate-800">
            <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
               {operationalMetrics.map((metric, idx) => (
                  <div key={idx} className="space-y-1">
                     <p className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#10B981] tracking-tight">{metric.value}</p>
                     <p className="text-xs font-bold uppercase tracking-wider text-slate-200">{metric.label}</p>
                     <p className="text-xs text-slate-400 font-medium">{metric.detail}</p>
                  </div>
               ))}
            </div>
         </section>

         {/* 3. A DOR PROFUNDA DO EMPRESÁRIO: ONDE O DINHEIRO ESCORRE */}
         <section id="dores" className="w-full bg-white py-20 lg:py-28 px-6 lg:px-12 border-b border-[#E2E8F0]">
            <div className="max-w-7xl mx-auto space-y-14">
               
               <div className="max-w-3xl space-y-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-rose-600 block">
                     Os Riscos Reais da Disputa Pública
                  </span>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0F172A] tracking-tight leading-tight">
                     Por que empresas competentes continuam perdendo contratos lucrativos no mercado público?
                  </h2>
                  <p className="text-base text-slate-600 font-medium leading-relaxed">
                     O mercado de compras governamentais não tolera amadorismo operacional. Um detalhe burocrático na certidão ou a desatenção ao prazo legal do Termo de Referência anulam meses de esforço comercial.
                  </p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                  {bleedingPains.map((pain, idx) => (
                     <div key={idx} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-8 space-y-4 hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                              <ShieldWarning weight="bold" className="w-5 h-5" />
                           </div>
                           <h3 className="text-base sm:text-lg font-bold text-[#0F172A] leading-snug">{pain.title}</h3>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                           {pain.desc}
                        </p>
                        <div className="pt-3 border-t border-slate-200 flex items-start gap-2 text-xs font-bold text-[#0F172A]">
                           <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                           <span>Proteção no sistema: <span className="font-normal text-slate-600">{pain.solution}</span></span>
                        </div>
                     </div>
                  ))}
               </div>

            </div>
         </section>

         {/* 4. OS MÓDULOS DO SISTEMA (A SOLUÇÃO OPERACIONAL) */}
         <section id="modulos" className="w-full bg-[#F8FAFC] py-20 lg:py-28 px-6 lg:px-12 border-b border-[#E2E8F0]">
            <div className="max-w-7xl mx-auto space-y-16">
               
               <div className="text-center max-w-3xl mx-auto space-y-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#10B981] block">
                     Fluxo Operacional Blindado
                  </span>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0F172A] tracking-tight">
                     Cinco módulos estruturados para assumir o controle total das suas disputas.
                  </h2>
                  <p className="text-base text-slate-600 font-medium">
                     Cada ferramenta resolve uma etapa crítica do processo: da descoberta da oportunidade até a assinatura e execução do contrato administrativo.
                  </p>
               </div>

               <div className="space-y-6">
                  {coreModules.map((module, idx) => (
                     <div key={idx} className="rounded-2xl border border-[#E2E8F0] bg-white p-8 lg:p-10 shadow-sm transition-all hover:shadow-md">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                           
                           <div className="lg:col-span-5 space-y-3">
                              <div className="flex items-center gap-3">
                                 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 border border-slate-200">
                                    {module.icon}
                                 </div>
                                 <span className="text-xs font-black uppercase tracking-widest text-[#10B981]">{module.step}</span>
                              </div>
                              <h3 className="text-xl font-black text-[#0F172A] leading-snug">{module.title}</h3>
                              <p className="text-sm text-slate-600 font-medium leading-relaxed">{module.desc}</p>
                           </div>

                           <div className="lg:col-span-7 bg-[#F8FAFC] rounded-xl p-6 border border-slate-200/80 space-y-3">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Entregáveis operacionais:</span>
                              {module.bullets.map((bullet, bIdx) => (
                                 <div key={bIdx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 font-medium">
                                    <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                                    <span>{bullet}</span>
                                 </div>
                              ))}
                           </div>

                        </div>
                     </div>
                  ))}
               </div>

            </div>
         </section>

         {/* 5. TABELA COMPARATIVA (MANUAL VS. EXPERTISE LICITATÓRIA) */}
         <section id="comparativo" className="w-full bg-white py-20 lg:py-28 px-6 lg:px-12 border-b border-[#E2E8F0]">
            <div className="max-w-7xl mx-auto space-y-12">
               
               <div className="text-center max-w-3xl mx-auto space-y-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 block">
                     Comparativo Direto
                  </span>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0F172A] tracking-tight">
                     A diferença entre disputar no improviso e operar com método profissional.
                  </h2>
               </div>

               <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] shadow-sm">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                     <thead>
                        <tr className="bg-[#0F172A] text-white">
                           <th className="py-4 px-6 font-bold uppercase tracking-wider text-slate-300 w-1/4">Critério Operacional</th>
                           <th className="py-4 px-6 font-bold uppercase tracking-wider text-slate-400 w-3/8">Operação Manual (Planilhas e Portais)</th>
                           <th className="py-4 px-6 font-bold uppercase tracking-wider text-[#10B981] w-3/8 bg-slate-900 border-l border-slate-800">
                              Plataforma Expertise Licitatória
                           </th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-200">
                        {comparisonRows.map((row, idx) => (
                           <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#F8FAFC]'}>
                              <td className="py-4 px-6 font-bold text-[#0F172A]">{row.criteria}</td>
                              <td className="py-4 px-6 text-slate-600 font-medium">
                                 <div className="flex items-start gap-2">
                                    <X weight="bold" className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                    <span>{row.manual}</span>
                                 </div>
                              </td>
                              <td className="py-4 px-6 font-semibold text-slate-800 bg-emerald-50/30 border-l border-slate-200">
                                 <div className="flex items-start gap-2">
                                    <Check weight="bold" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                                    <span>{row.expertise}</span>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

            </div>
         </section>

         {/* 6. CONFORMIDADE JURÍDICA E SEGURANÇA DE DADOS */}
         <section className="w-full bg-[#0F172A] text-white py-20 px-6 lg:px-12 border-b border-slate-800">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
               
               <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
                     <LockKey weight="bold" className="w-4 h-4 text-[#10B981]" />
                     <span>Sigilo Estratégico Garantido</span>
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                     Seus custos, margens de lucro e documentos nunca são expostos.
                  </h2>
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
                     Sabemos que a estratégia de preço em licitações é o ativo mais valioso de uma empresa fornecedora do governo. Por isso, a arquitetura da plataforma foi desenhada para garantir isolamento integral entre as contas.
                  </p>
                  
                  <div className="space-y-3 pt-2">
                     <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-200">
                        <CheckCircle weight="fill" className="w-5 h-5 text-[#10B981] shrink-0" />
                        <span>Isolamento rígido de banco de dados por empresa (Multi-Tenant)</span>
                     </div>
                     <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-200">
                        <CheckCircle weight="fill" className="w-5 h-5 text-[#10B981] shrink-0" />
                        <span>Criptografia de ponta a ponta em propostas e atestados arquivados</span>
                     </div>
                     <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-slate-200">
                        <CheckCircle weight="fill" className="w-5 h-5 text-[#10B981] shrink-0" />
                        <span>Em conformidade estrita com a Lei Geral de Proteção de Dados (LGPD)</span>
                     </div>
                  </div>
               </div>

               <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                     <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Certificação de Segurança</span>
                     <span className="text-xs font-mono font-bold text-[#10B981]">TLS 1.3 / AES-256</span>
                  </div>
                  <div className="space-y-4 text-xs text-slate-300 leading-relaxed font-medium">
                     <p>
                        Todos os acessos são registrados em trilha de auditoria inviolável, permitindo ao administrador da empresa saber exatamente quem da equipe cadastrou um lance ou fez download de uma certidão.
                     </p>
                     <p>
                        Servidores monitorados 24 horas por dia com rotina redundante de backups em múltiplos centros de processamento de dados.
                     </p>
                  </div>
               </div>

            </div>
         </section>

         {/* 7. PLANOS E PREÇOS: TRANSPARÊNCIA TOTAL */}
         <section id="planos" className="w-full bg-white py-20 lg:py-28 px-6 lg:px-12 border-b border-[#E2E8F0]">
            <div className="max-w-7xl mx-auto space-y-12">
               
               <div className="text-center max-w-3xl mx-auto space-y-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#10B981] block">
                     Planos e Investimento
                  </span>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0F172A] tracking-tight">
                     Escolha o plano adequado ao volume de disputas da sua empresa.
                  </h2>
                  <p className="text-base text-slate-600 font-medium">
                     Sem cobrança de percentual sobre contratos homologados. Você paga apenas a mensalidade fixa do sistema.
                  </p>
                  
                  {/* Seletor Mensal / Anual */}
                  <div className="pt-2 flex justify-center">
                     <div className="inline-flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-100 border border-slate-200">
                        <button
                           onClick={() => setBillingPeriod('mensal')}
                           className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                              billingPeriod === 'mensal'
                                 ? 'bg-white text-[#0F172A] shadow-sm'
                                 : 'text-slate-600 hover:text-slate-900'
                           }`}
                        >
                           Mensal
                        </button>
                        <button
                           onClick={() => setBillingPeriod('anual')}
                           className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                              billingPeriod === 'anual'
                                 ? 'bg-[#0F172A] text-white shadow-sm'
                                 : 'text-slate-600 hover:text-slate-900'
                           }`}
                        >
                           <span>Anual</span>
                           <span className="bg-[#10B981] text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                              -20% Desconto
                           </span>
                        </button>
                     </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                  
                  {/* Plano Básico */}
                  <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-colors">
                     <div className="space-y-6">
                        <div>
                           <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Início da Operação</span>
                           <h3 className="text-2xl font-black text-[#0F172A] mt-1">Básico</h3>
                           <p className="text-xs text-slate-600 mt-2 font-medium">Ideal para empresários que estão estruturando o setor de licitações.</p>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                           <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-black text-[#0F172A]">
                                 {billingPeriod === 'anual' ? 'R$ 79,90' : 'R$ 99,99'}
                              </span>
                              <span className="text-xs text-slate-500 font-bold uppercase">/mês</span>
                           </div>
                           <span className="text-[10px] text-slate-500 font-medium block mt-1">
                              {billingPeriod === 'anual' ? 'Faturado anualmente' : 'Cobrança mensal recorrente'}
                           </span>
                        </div>

                        <ul className="space-y-3 text-xs font-medium text-slate-700">
                           <li className="flex items-start gap-2.5">
                              <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                              <span>Até 5 CNPJs monitorados</span>
                           </li>
                           <li className="flex items-start gap-2.5">
                              <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                              <span>1 Usuário com acesso ao painel</span>
                           </li>
                           <li className="flex items-start gap-2.5">
                              <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                              <span>Radar de editais no PNCP e Compras.gov</span>
                           </li>
                           <li className="flex items-start gap-2.5">
                              <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                              <span>Cofre de certidões com alertas de vencimento</span>
                           </li>
                        </ul>
                     </div>

                     <button 
                        onClick={() => navigate('/register')} 
                        className="mt-8 w-full py-4 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[#0F172A] text-xs font-bold uppercase tracking-wider transition-colors"
                     >
                        Assinar Plano Básico
                     </button>
                  </div>

                  {/* Plano Avançado (Destaque) */}
                  <div className="rounded-2xl border-2 border-[#10B981] bg-white p-8 flex flex-col justify-between shadow-xl relative scale-100 md:scale-105">
                     <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#10B981] text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-sm">
                        Mais Escolhido por Fornecedores
                     </div>

                     <div className="space-y-6">
                        <div>
                           <span className="text-xs font-bold uppercase tracking-wider text-[#10B981] block">Crescimento e Escala</span>
                           <h3 className="text-2xl font-black text-[#0F172A] mt-1">Avançado</h3>
                           <p className="text-xs text-slate-600 mt-2 font-medium">Para empresas com disputas frequentes que necessitam de agilidade técnica.</p>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                           <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-black text-[#0F172A]">
                                 {billingPeriod === 'anual' ? 'R$ 159,00' : 'R$ 199,00'}
                              </span>
                              <span className="text-xs text-slate-500 font-bold uppercase">/mês</span>
                           </div>
                           <span className="text-[10px] text-slate-500 font-medium block mt-1">
                              {billingPeriod === 'anual' ? 'Faturado anualmente' : 'Cobrança mensal recorrente'}
                           </span>
                        </div>

                        <ul className="space-y-3 text-xs font-medium text-slate-700">
                           <li className="flex items-start gap-2.5">
                              <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                              <span>Até 10 CNPJs e 3 usuários simultâneos</span>
                           </li>
                           <li className="flex items-start gap-2.5">
                              <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                              <span>Leitor e extrator de exigências de editais</span>
                           </li>
                           <li className="flex items-start gap-2.5">
                              <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                              <span>Calculadora de Preço de Disputa e BDI</span>
                           </li>
                           <li className="flex items-start gap-2.5">
                              <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                              <span>Estruturador de pedidos de esclarecimento</span>
                           </li>
                           <li className="flex items-start gap-2.5">
                              <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                              <span>Suporte operacional prioritário</span>
                           </li>
                        </ul>
                     </div>

                     <button 
                        onClick={() => navigate('/register')} 
                        className="mt-8 w-full py-4 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-widest shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition-all"
                     >
                        Começar no Plano Avançado
                     </button>
                  </div>

                  {/* Plano Master */}
                  <div className="rounded-2xl border border-[#E2E8F0] bg-white p-8 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-colors">
                     <div className="space-y-6">
                        <div>
                           <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">Liderança de Mercado</span>
                           <h3 className="text-2xl font-black text-[#0F172A] mt-1">Master</h3>
                           <p className="text-xs text-slate-600 mt-2 font-medium">Estrutura completa para grandes frotistas, indústrias e construtoras.</p>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                           <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-black text-[#0F172A]">
                                 {billingPeriod === 'anual' ? 'R$ 319,90' : 'R$ 399,99'}
                              </span>
                              <span className="text-xs text-slate-500 font-bold uppercase">/mês</span>
                           </div>
                           <span className="text-[10px] text-slate-500 font-medium block mt-1">
                              {billingPeriod === 'anual' ? 'Faturado anualmente' : 'Cobrança mensal recorrente'}
                           </span>
                        </div>

                        <ul className="space-y-3 text-xs font-medium text-slate-700">
                           <li className="flex items-start gap-2.5">
                              <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                              <span>Até 20 CNPJs e usuários ilimitados</span>
                           </li>
                           <li className="flex items-start gap-2.5">
                              <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                              <span>Minutas de impugnações e recursos fundamentados</span>
                           </li>
                           <li className="flex items-start gap-2.5">
                              <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                              <span>Módulo de contratos e gestão de atas de registro de preços</span>
                           </li>
                           <li className="flex items-start gap-2.5">
                              <CheckCircle weight="fill" className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                              <span>Canal direto com especialista em contratações</span>
                           </li>
                        </ul>
                     </div>

                     <button 
                        onClick={() => navigate('/register')} 
                        className="mt-8 w-full py-4 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[#0F172A] text-xs font-bold uppercase tracking-wider transition-colors"
                     >
                        Assinar Plano Master
                     </button>
                  </div>

               </div>

            </div>
         </section>

         {/* 8. PERGUNTAS FREQUENTES (FAQ) */}
         <section id="faq" className="w-full bg-[#F8FAFC] py-20 lg:py-28 px-6 lg:px-12 border-b border-[#E2E8F0]">
            <div className="max-w-4xl mx-auto space-y-12">
               
               <div className="text-center space-y-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500 block">Esclarecimentos Técnicos</span>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0F172A] tracking-tight">
                     Perguntas Frequentes do Licitante
                  </h2>
               </div>

               <div className="space-y-3">
                  {faqs.map((faq, idx) => (
                     <div key={idx} className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden shadow-sm">
                        <button 
                           onClick={() => setActiveFaq(activeFaq === idx ? null : idx)} 
                           className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50/60 transition-colors"
                        >
                           <span className="text-sm font-bold text-[#0F172A] pr-4">{faq.q}</span>
                           <CaretDown weight="bold" className={`w-5 h-5 text-slate-500 transition-transform duration-200 shrink-0 ${activeFaq === idx ? 'rotate-180 text-[#10B981]' : ''}`} />
                        </button>
                        <AnimatePresence>
                           {activeFaq === idx && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                                 <div className="p-6 pt-0 border-t border-slate-100 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                                    {faq.a}
                                 </div>
                              </motion.div>
                           )}
                        </AnimatePresence>
                     </div>
                  ))}
               </div>

            </div>
         </section>

         {/* 9. CHAMADA FINAL DE ALTA CONVERSÃO */}
         <section className="w-full bg-[#0F172A] text-white py-24 px-6 lg:px-12 relative overflow-hidden">
            <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
               
               <div className="inline-flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-[#10B981]">
                  <span>Segurança Operacional em Primeiro Lugar</span>
               </div>

               <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                  Assuma o comando das suas licitações públicas com precisão profissional.
               </h2>

               <p className="text-base sm:text-lg text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed">
                  Cadastre seu CNPJ hoje, organize seus atestados, blinde suas certidões e dispute contratos governamentais sabendo exatamente até onde pode descer o seu lance.
               </p>

               <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button 
                     onClick={() => navigate('/register')} 
                     className="w-full sm:w-auto flex items-center justify-center gap-3 rounded-xl bg-[#10B981] hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-black uppercase tracking-widest px-10 py-5 shadow-[0_12px_28px_rgba(16,185,129,0.32)] transition-all hover:-translate-y-0.5"
                  >
                     <span>Criar Minha Conta no Expertise</span>
                     <CaretRight weight="bold" className="w-5 h-5" />
                  </button>

                  <button 
                     onClick={() => navigate('/login')} 
                     className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider px-8 py-5 transition-colors"
                  >
                     <span>Acessar Painel Existente</span>
                  </button>
               </div>

               <p className="text-xs text-slate-400 font-medium">
                  Sem taxa de adesão ou contrato de fidelidade. Cancele quando quiser.
               </p>

            </div>
         </section>

         {/* 10. RODAPÉ INSTITUCIONAL */}
         <footer className="w-full bg-white border-t border-[#E2E8F0] py-12 px-6 lg:px-12 text-slate-600 text-xs">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
               
               <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F172A] text-[#10B981]">
                     <Scales weight="bold" className="w-4 h-4" />
                  </div>
                  <div>
                     <span className="font-black text-sm tracking-tight text-[#0F172A]">EXPERTISE LICITATÓRIA</span>
                     <span className="text-[10px] text-slate-400 block font-medium">Sistema de Gestão e Segurança em Contratos Públicos</span>
                  </div>
               </div>

               <div className="flex flex-wrap items-center justify-center gap-6 font-bold uppercase tracking-wider text-[11px] text-slate-500">
                  <a href="#modulos" className="hover:text-[#0F172A] transition-colors">Módulos</a>
                  <a href="#planos" className="hover:text-[#0F172A] transition-colors">Planos</a>
                  <button onClick={() => navigate('/termos-de-uso')} className="hover:text-[#0F172A] transition-colors">Termos de Uso</button>
                  <button onClick={() => navigate('/politica-privacidade')} className="hover:text-[#0F172A] transition-colors">Política de Privacidade</button>
               </div>

               <p className="text-slate-400 font-medium">
                  &copy; {new Date().getFullYear()} Expertise Licitatória. Todos os direitos reservados.
               </p>

            </div>
         </footer>

      </div>
   );
}
