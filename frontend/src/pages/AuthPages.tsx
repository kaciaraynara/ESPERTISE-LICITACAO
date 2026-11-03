import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
   CircleNotch, CheckCircle, WarningCircle, InstagramLogo, 
   ArrowRight, Eye, EyeSlash, Check
} from '@phosphor-icons/react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi, integracoesApi } from '@services/api';
import { useAuthStore } from '@store/auth.store';
import { FORNECEDOR_ROUTES } from '@/routes';

// Zod Schemas sincronizados com o Backend
const loginSchema = z.object({
   email: z.string().email('E-mail corporativo inválido'),
   password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres')
});

const forgotSchema = z.object({
   email: z.string().email('E-mail corporativo inválido')
});

const resetSchema = z.object({
   password: z.string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Za-z]/, 'A senha deve conter pelo menos uma letra')
      .regex(/\d/, 'A senha deve conter pelo menos um número'),
   confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
   message: 'As senhas não coincidem',
   path: ['confirmPassword']
});

const registerSchema = z.object({
   email: z.string().email('E-mail corporativo inválido'),
   cnpj: z.string().min(14, 'CNPJ inválido'),
   razoesocial: z.string().optional(),
   aceite_lgpd: z.boolean().refine((accepted) => accepted, 'Aceite os termos para continuar.'),
   password: z.string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Za-z]/, 'A senha deve conter pelo menos uma letra')
      .regex(/\d/, 'A senha deve conter pelo menos um número')
});

type LoginFormValues = z.infer<typeof loginSchema>;
type ForgotFormValues = z.infer<typeof forgotSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

// Demonstrativos visuais da plataforma para a lateral
const PLATFORM_DEMONSTRATORS = [
   {
      tag: 'Radar de Editais',
      tagColor: 'bg-orange-50 text-[#EA580C] border-orange-200',
      title: 'Pregão Eletrônico nº 048/2026',
      orgao: 'Tribunal Regional Federal • Compras.gov',
      objeto: 'Fornecimento continuado de equipamentos e serviços de suporte com entrega parcelada.',
      highlightLabel: 'Valor Estimado',
      highlightValue: 'R$ 1.840.000,00',
      prazo: 'Abertura das propostas em 4 dias',
      status: 'Edital em Análise',
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
   },
   {
      tag: 'Controle de Certidões',
      tagColor: 'bg-blue-50 text-[#0A2540] border-blue-200',
      title: 'Painel de Validade de Habilitação',
      orgao: 'Acompanhamento preventivo de documentos',
      certidoes: [
         { nome: 'CND Federal e Previdenciária', prazo: 'Vence em 52 dias' },
         { nome: 'Regularidade FGTS (CRF)', prazo: 'Vence em 21 dias' },
         { nome: 'CNDT Trabalhista', prazo: 'Vence em 88 dias' }
      ],
      highlightLabel: 'Situação Cadastral',
      highlightValue: 'Empresa Regular e Habilitada',
      prazo: 'Avisos emitidos antes de qualquer vencimento',
      status: 'Documentação em Dia',
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
   },
   {
      tag: 'Cálculo de Preço Seguro',
      tagColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      title: 'Composição de Custos e Margem',
      orgao: 'Pregão Eletrônico • Lote 02',
      metricas: [
         { label: 'Custos Diretos', valor: 'R$ 380.000,00' },
         { label: 'Tributos e BDI', valor: '22,5%' },
         { label: 'Margem Líquida', valor: '14,0%' }
      ],
      highlightLabel: 'Lance Mínimo Seguro (Piso)',
      highlightValue: 'R$ 498.200,00',
      prazo: 'Trava ativa para evitar propostas com prejuízo',
      status: 'Margem Garantida',
      statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
   }
];

export default function AuthPages() {
   const navigate = useNavigate();
   const location = useLocation();
   const setAuth = useAuthStore(state => state.setAuth);

   const [activeView, setActiveView] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
   const [activeDemo, setActiveDemo] = useState(0);
   
   // Alterna automaticamente os demonstrativos da plataforma
   useEffect(() => {
      const interval = setInterval(() => {
         setActiveDemo((prev) => (prev + 1) % PLATFORM_DEMONSTRATORS.length);
      }, 5000);
      return () => clearInterval(interval);
   }, []);

   // Estados para visibilidade de senhas
   const [showLoginPassword, setShowLoginPassword] = useState(false);
   const [showRegPassword, setShowRegPassword] = useState(false);
   const [showResetPassword, setShowResetPassword] = useState(false);
   const [showResetConfirm, setShowResetConfirm] = useState(false);

   useEffect(() => {
      if (location.pathname === '/register') setActiveView('register');
      else if (location.pathname === '/login') setActiveView('login');
      else if (location.pathname === '/forgot-password') setActiveView('forgot');
      else if (location.pathname === '/reset-password') setActiveView('reset');
   }, [location.pathname]);

   // -----------------------------
   // LOGIN FORM LOGIC
   // -----------------------------
   const { register: loginForm, handleSubmit: handleLoginSubmit, formState: { errors: loginErrors, isSubmitting: loginSubmitting } } = useForm<LoginFormValues>({
      resolver: zodResolver(loginSchema)
   });

   const onLogin = async (data: LoginFormValues) => {
      try {
         const response = await authApi.login({
            email: data.email.trim().toLowerCase(),
            senha: data.password
         });
         const { user, accessToken, refreshToken } = response.data.data;

         localStorage.setItem('token', accessToken);
         setAuth(user, accessToken, refreshToken ?? undefined);

         toast.success('Login realizado com sucesso!');
         navigate(FORNECEDOR_ROUTES.dashboard, { replace: true });
      } catch (error: any) {
         toast.error(error.response?.data?.message || 'E-mail ou senha incorretos. Verifique suas credenciais.');
      }
   };

   // -----------------------------
   // REGISTRO
   // -----------------------------
   const { register: regForm, handleSubmit: handleRegSubmit, watch: regWatch, setValue: regSetValue, formState: { errors: regErrors, isSubmitting: regSubmitting } } = useForm<RegisterFormValues>({
      resolver: zodResolver(registerSchema),
      defaultValues: {
         email: location.state?.email || '',
         cnpj: location.state?.cnpj || '',
         razoesocial: location.state?.razaoSocial || '',
         aceite_lgpd: false,
         password: '',
      }
   });

   const cnpjValue = regWatch('cnpj');
   const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
   const [cnpjLookupError, setCnpjLookupError] = useState<string | null>(null);

   useEffect(() => {
      const sanitized = cnpjValue.replace(/\D/g, '').slice(0, 14);
      if (sanitized !== cnpjValue) {
         regSetValue('cnpj', sanitized, { shouldValidate: true });
      }
      if (sanitized.length !== 14) {
         setIsLoadingCnpj(false);
         setCnpjLookupError(null);
         return;
      }

      let isCurrentLookup = true;
      setIsLoadingCnpj(true);
      setCnpjLookupError(null);
      const timeout = window.setTimeout(() => {
         integracoesApi.cnpjPublico(sanitized)
            .then((response) => {
               if (!isCurrentLookup) return;
               const razaoSocial = response.data?.data?.razao_social;
               if (typeof razaoSocial !== 'string' || !razaoSocial.trim()) {
                  throw new Error('A consulta não retornou a razão social.');
               }
               regSetValue('razoesocial', razaoSocial.trim(), { shouldValidate: true });
            })
            .catch(() => {
               if (isCurrentLookup) {
                  setCnpjLookupError('Não foi possível consultar este CNPJ automaticamente. Digite a Razão Social no campo abaixo.');
               }
            })
            .finally(() => {
               if (isCurrentLookup) setIsLoadingCnpj(false);
            });
      }, 400);

      return () => {
         isCurrentLookup = false;
         window.clearTimeout(timeout);
      };
   }, [cnpjValue, regSetValue]);

   const onRegister = async (data: RegisterFormValues) => {
      try {
         const cleanCnpj = data.cnpj.replace(/\D/g, '');
         const razaoSocialInformada = (data.razoesocial || '').trim();

         const response = await authApi.register({
            nome: 'Administrador da conta',
            email: data.email.trim().toLowerCase(),
            senha: data.password,
            cnpj: cleanCnpj,
            razao_social: razaoSocialInformada,
            aceite_lgpd: data.aceite_lgpd,
            role: 'fornecedor'
         });

         const { user, accessToken, refreshToken } = response.data?.data || {};
         
         if (accessToken) {
            localStorage.setItem('token', accessToken);
            setAuth(user, accessToken, refreshToken ?? undefined);
            toast.success('Conta criada com sucesso!');
            navigate(FORNECEDOR_ROUTES.dashboard, { replace: true });
         } else {
            toast.success('Empresa validada! Faça o login para acessar o ambiente.');
            setActiveView('login');
         }
      } catch (error: any) {
         const serverMessage = error.response?.data?.message || error.response?.data?.error;
         toast.error(serverMessage || 'Falha ao registrar empresa. Verifique os dados.');
      }
   };

   // -----------------------------
   // FORGOT FORM LOGIC
   // -----------------------------
   const { register: forgotForm, handleSubmit: handleForgotSubmit, formState: { errors: forgotErrors, isSubmitting: forgotSubmitting } } = useForm<ForgotFormValues>({
      resolver: zodResolver(forgotSchema)
   });

   const [devResetLink, setDevResetLink] = useState<string | null>(null);

   const onForgot = async (data: ForgotFormValues) => {
      try {
         const res = await authApi.forgotPassword({ email: data.email.trim().toLowerCase() });
         toast.success('Se o e-mail estiver cadastrado, você receberá as instruções em instantes.');
         
         if (res.data?.devToken) {
            const link = `/reset-password?token=${res.data.devToken}`;
            setDevResetLink(link);
            toast.success('Modo Teste: Link de recuperação gerado logo abaixo!', { duration: 6000 });
         } else {
            setActiveView('login');
         }
      } catch (error: any) {
         toast.error(error.response?.data?.message || 'Falha ao processar solicitação de recuperação.');
      }
   };

   // -----------------------------
   // RESET PASSWORD LOGIC
   // -----------------------------
   const { register: resetForm, handleSubmit: handleResetSubmit, formState: { errors: resetErrors, isSubmitting: resetSubmitting } } = useForm<ResetFormValues>({
      resolver: zodResolver(resetSchema)
   });

   const onReset = async (data: ResetFormValues) => {
      try {
         const searchParams = new URLSearchParams(location.search);
         const token = searchParams.get('token');
         if (!token) {
            toast.error('Token de recuperação inválido ou ausente.');
            return;
         }

         await authApi.resetPassword({ token, senha: data.password });
         toast.success('Senha atualizada com sucesso! Faça login com a nova senha.');
         navigate('/login', { replace: true });
      } catch (error: any) {
         toast.error(error.response?.data?.message || 'Falha ao redefinir a senha. O link pode estar expirado.');
      }
   };

   const currentDemo = PLATFORM_DEMONSTRATORS[activeDemo];

   return (
      <main className="flex min-h-screen w-full bg-[#F8FAFC] font-sans text-slate-800 relative">
         {/* Botão de Retorno */}
         <button
            onClick={() => window.location.href = '/'}
            title="Voltar para a página inicial"
            className="absolute left-6 top-6 z-50 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0A2540] shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300"
         >
            <svg xmlns="http://w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
               <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
         </button>

         {/* LEFT PANEL: Logo Marcante e Demonstrativos da Plataforma */}
         <div className="hidden lg:flex w-1/2 bg-[#0A2540] text-white flex-col justify-between p-12 xl:p-16 relative overflow-hidden">
            {/* Efeito de fundo sutil */}
            <div 
               className="absolute inset-0 opacity-[0.05] pointer-events-none"
               style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, #FFFFFF 1px, transparent 0)',
                  backgroundSize: '32px 32px'
               }}
            />

            {/* Cabeçalho com Logo em destaque real */}
            <div className="relative z-10 flex items-center justify-between">
               <div className="bg-white/95 backdrop-blur-sm p-4 rounded-2xl border border-white/20 shadow-lg inline-flex items-center">
                  <img 
                     src="/logo.png" 
                     alt="Expertise Licitatória" 
                     className="h-16 xl:h-20 w-auto object-contain" 
                  />
               </div>
            </div>

            {/* Centro: Título e Demonstrativo Visual Animado */}
            <div className="relative z-10 my-auto py-8">
               <div className="mb-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#EA580C] bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                     Visão Geral do Sistema
                  </span>
                  <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight text-white mt-3 leading-snug">
                     {activeView === 'login' && 'Acompanhe editais, certidões e preços em um só lugar.'}
                     {activeView === 'register' && 'Cadastre sua empresa e dispute licitações com segurança.'}
                     {activeView === 'forgot' && 'Recuperação de acesso simples e direta.'}
                     {activeView === 'reset' && 'Defina sua nova senha com praticidade.'}
                  </h2>
               </div>

               {/* Cartão Demonstrativo com Transição Suave */}
               <div className="relative min-h-[290px]">
                  <AnimatePresence mode="wait">
                     <motion.div
                        key={activeDemo}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -14 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="rounded-2xl border border-slate-700/60 bg-[#0E3154] p-6 shadow-xl"
                     >
                        {/* Header do Demonstrativo */}
                        <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-4">
                           <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${currentDemo.tagColor}`}>
                              {currentDemo.tag}
                           </span>
                           <span className="text-xs text-slate-300 font-medium">
                              {currentDemo.status}
                           </span>
                        </div>

                        {/* Conteúdo específico de cada demonstrativo */}
                        <div>
                           <h3 className="text-base font-bold text-white mb-1">
                              {currentDemo.title}
                           </h3>
                           <p className="text-xs text-slate-300 mb-4">
                              {currentDemo.orgao}
                           </p>

                           {/* Renderização do Edital */}
                           {currentDemo.objeto && (
                              <p className="text-xs text-slate-200 bg-slate-800/60 p-3 rounded-lg border border-slate-700/50 mb-4 leading-relaxed">
                                 {currentDemo.objeto}
                              </p>
                           )}

                           {/* Renderização das Certidões */}
                           {currentDemo.certidoes && (
                              <div className="space-y-2 mb-4">
                                 {currentDemo.certidoes.map((c, i) => (
                                    <div key={i} className="flex items-center justify-between bg-slate-800/60 px-3 py-2 rounded-lg border border-slate-700/50 text-xs">
                                       <span className="text-white font-medium flex items-center gap-2">
                                          <Check className="w-3.5 h-3.5 text-emerald-400" weight="bold" />
                                          {c.nome}
                                       </span>
                                       <span className="text-emerald-400 font-semibold">{c.prazo}</span>
                                    </div>
                                 ))}
                              </div>
                           )}

                           {/* Renderização das Métricas de Preço */}
                           {currentDemo.metricas && (
                              <div className="grid grid-cols-3 gap-2 mb-4">
                                 {currentDemo.metricas.map((m, i) => (
                                    <div key={i} className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/50 text-center">
                                       <span className="block text-[10px] text-slate-400">{m.label}</span>
                                       <span className="text-xs font-bold text-white mt-0.5 block">{m.valor}</span>
                                    </div>
                                 ))}
                              </div>
                           )}

                           {/* Rodapé com Destaque Financeiro ou Prazo */}
                           <div className="flex items-center justify-between pt-3 border-t border-slate-700/60 text-xs">
                              <div>
                                 <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                    {currentDemo.highlightLabel}
                                 </span>
                                 <span className="text-base font-extrabold text-[#EA580C]">
                                    {currentDemo.highlightValue}
                                 </span>
                              </div>
                              <div className="text-right text-[11px] text-slate-300">
                                 {currentDemo.prazo}
                              </div>
                           </div>
                        </div>
                     </motion.div>
                  </AnimatePresence>
               </div>

               {/* Indicadores / Paginação do Demonstrativo */}
               <div className="flex items-center gap-2 mt-4">
                  {PLATFORM_DEMONSTRATORS.map((_, idx) => (
                     <button
                        key={idx}
                        onClick={() => setActiveDemo(idx)}
                        aria-label={`Ver demonstrativo ${idx + 1}`}
                        className={`h-2 rounded-full transition-all duration-300 ${
                           activeDemo === idx ? 'w-8 bg-[#EA580C]' : 'w-2 bg-slate-600 hover:bg-slate-400'
                        }`}
                     />
                  ))}
               </div>
            </div>

            {/* Rodapé Institucional Limpo */}
            <div className="relative z-10 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
               <span>Ambiente para gestão de licitações públicas</span>
               <span className="font-semibold text-slate-300">Expertise Licitatória</span>
            </div>
         </div>

         {/* RIGHT PANEL: Formulários */}
         <div className="w-full lg:w-1/2 flex flex-col justify-between items-center p-6 sm:p-12 min-h-screen lg:h-screen overflow-y-auto bg-white relative">
            {/* Header Mobile com Logo em tamanho notável */}
            <div className="w-full flex lg:hidden items-center justify-center mb-6 mt-8">
               <img src="/logo.png" alt="Expertise Licitatória" className="h-14 sm:h-16 w-auto object-contain" />
            </div>

            <div className="w-full max-w-md flex-1 flex flex-col justify-center relative">
               <AnimatePresence mode="wait">
                  {/* --- LOGIN VIEW --- */}
                  {activeView === 'login' && (
                     <motion.div key="login" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                        <div className="mb-8">
                           <h1 className="font-sans font-extrabold tracking-tight text-[#0A2540] text-3xl mb-2">
                              Acesse sua conta
                           </h1>
                           <p className="text-sm text-slate-500">
                              Insira suas credenciais para gerenciar suas licitações.
                           </p>
                        </div>

                        <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-5">
                           <div className="space-y-1.5">
                              <label htmlFor="login_email" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                                 E-mail corporativo
                              </label>
                              <input
                                 {...loginForm('email')}
                                 id="login_email"
                                 placeholder="exemplo@empresa.com.br"
                                 type="email"
                                 autoCapitalize="none"
                                 autoCorrect="off"
                                 spellCheck={false}
                                 className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all focus:bg-white focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100"
                              />
                              {loginErrors.email && (
                                 <p className="text-red-500 text-xs font-medium mt-1 flex items-center gap-1">
                                    <WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {loginErrors.email.message}
                                 </p>
                              )}
                           </div>

                           <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                 <label htmlFor="login_password" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                                    Senha
                                 </label>
                                 <button
                                    type="button"
                                    onClick={() => setActiveView('forgot')}
                                    className="text-xs font-semibold text-[#EA580C] hover:underline"
                                 >
                                    Esqueceu a senha?
                                 </button>
                              </div>
                              <div className="relative">
                                 <input
                                    {...loginForm('password')}
                                    id="login_password"
                                    placeholder="Digite sua senha"
                                    type={showLoginPassword ? 'text' : 'password'}
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-4 pr-12 py-3.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all focus:bg-white focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100"
                                 />
                                 <button 
                                    type="button" 
                                    aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'} 
                                    onClick={() => setShowLoginPassword(!showLoginPassword)} 
                                    className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-700 transition-colors"
                                 >
                                    {showLoginPassword ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                 </button>
                              </div>
                              {loginErrors.password && (
                                 <p className="text-red-500 text-xs font-medium mt-1 flex items-center gap-1">
                                    <WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {loginErrors.password.message}
                                 </p>
                              )}
                           </div>

                           <motion.button 
                              disabled={loginSubmitting} 
                              type="submit" 
                              whileHover={{ scale: 1.01 }} 
                              whileTap={{ scale: 0.98 }} 
                              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#EA580C] py-4 text-sm font-bold uppercase tracking-wider text-white shadow-md hover:bg-orange-600 transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                           >
                              {loginSubmitting ? (
                                 <>
                                    <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                                    <span>Acessando...</span>
                                 </>
                              ) : (
                                 <>
                                    <span>Acessar Painel</span>
                                    <ArrowRight weight="bold" className="h-4 w-4" />
                                 </>
                              )}
                           </motion.button>
                        </form>

                        <div className="mt-8 text-center border-t border-slate-100 pt-6">
                           <p className="text-sm text-slate-600">
                              Sua empresa ainda não tem cadastro?{' '}
                              <button 
                                 onClick={() => setActiveView('register')} 
                                 className="font-bold text-[#EA580C] hover:underline"
                              >
                                 Cadastrar CNPJ
                              </button>
                           </p>
                        </div>
                     </motion.div>
                  )}

                  {/* --- REGISTER VIEW --- */}
                  {activeView === 'register' && (
                     <motion.div key="register" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="my-auto py-4">
                        <div className="mb-6">
                           <h1 className="font-sans font-extrabold tracking-tight text-[#0A2540] text-3xl mb-2">
                              Criar conta da empresa
                           </h1>
                           <p className="text-sm text-slate-500">
                              Cadastre o CNPJ para acessar o radar e organizar seus editais.
                           </p>
                        </div>

                        <form onSubmit={handleRegSubmit(onRegister)} className="space-y-4">
                           <div className="space-y-1.5">
                              <label htmlFor="reg_email" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                                 E-mail corporativo
                              </label>
                              <input
                                 {...regForm('email')}
                                 id="reg_email"
                                 placeholder="exemplo@empresa.com.br"
                                 type="email"
                                 autoCapitalize="none"
                                 autoCorrect="off"
                                 spellCheck={false}
                                 autoComplete="email"
                                 required
                                 className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all focus:bg-white focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100"
                              />
                              {regErrors.email && (
                                 <p className="text-red-500 text-xs font-medium mt-1 flex items-center gap-1">
                                    <WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {regErrors.email.message}
                                 </p>
                              )}
                           </div>

                           <div className="space-y-1.5">
                              <label htmlFor="reg_cnpj" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                                 CNPJ da empresa
                              </label>
                              <div className="relative">
                                 <input
                                    {...regForm('cnpj')}
                                    id="reg_cnpj"
                                    placeholder="00.000.000/0000-00"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    maxLength={18}
                                    required
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all focus:bg-white focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100"
                                 />
                                 {isLoadingCnpj && <CircleNotch className="absolute right-3.5 top-3.5 h-5 w-5 text-[#EA580C] animate-spin" />}
                              </div>
                              {regErrors.cnpj && (
                                 <p className="text-red-500 text-xs font-medium mt-1 flex items-center gap-1">
                                    <WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {regErrors.cnpj.message}
                                 </p>
                              )}
                           </div>

                           <div className="space-y-1.5">
                              <label htmlFor="reg_razao" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                                 Razão Social
                              </label>
                              <div className="relative">
                                 <input
                                    {...regForm('razoesocial')}
                                    id="reg_razao"
                                    placeholder="Razão social da empresa"
                                    type="text"
                                    disabled={isLoadingCnpj}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-4 pr-10 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all focus:bg-white focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100 disabled:bg-slate-100"
                                 />
                                 {regWatch('razoesocial') && <CheckCircle className="absolute right-3.5 top-3.5 h-5 w-5 text-emerald-500" weight="fill" />}
                              </div>
                              {cnpjLookupError && <p className="mt-1 text-xs text-amber-700">{cnpjLookupError}</p>}
                           </div>

                           <div className="space-y-1.5">
                              <label htmlFor="reg_pass" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                                 Senha de acesso
                              </label>
                              <div className="relative">
                                 <input
                                    {...regForm('password')}
                                    id="reg_pass"
                                    placeholder="Mínimo de 8 caracteres"
                                    type={showRegPassword ? 'text' : 'password'}
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    required
                                    autoComplete="new-password"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-4 pr-12 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all focus:bg-white focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100"
                                 />
                                 <button 
                                    type="button" 
                                    aria-label={showRegPassword ? 'Ocultar senha' : 'Mostrar senha'} 
                                    onClick={() => setShowRegPassword(!showRegPassword)} 
                                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-700 transition-colors"
                                 >
                                    {showRegPassword ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                 </button>
                              </div>
                              {regErrors.password && (
                                 <p className="text-red-500 text-xs font-medium mt-1 flex items-center gap-1">
                                    <WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {regErrors.password.message}
                                 </p>
                              )}
                           </div>

                           <label className="flex items-start gap-2.5 text-xs text-slate-600 pt-1">
                              <input
                                 {...regForm('aceite_lgpd')}
                                 type="checkbox"
                                 className="mt-0.5 h-4 w-4 shrink-0 accent-[#EA580C]"
                              />
                              <span>
                                 Li e concordo com os <a href="/termos" target="_blank" rel="noreferrer" className="font-semibold text-[#0A2540] underline">Termos de Uso</a> e a <a href="/privacidade" target="_blank" rel="noreferrer" className="font-semibold text-[#0A2540] underline">Política de Privacidade</a>.
                                 {regErrors.aceite_lgpd && <span className="mt-1 block text-red-600">{regErrors.aceite_lgpd.message}</span>}
                              </span>
                           </label>

                           <motion.button 
                              disabled={regSubmitting} 
                              type="submit" 
                              whileHover={{ scale: 1.01 }} 
                              whileTap={{ scale: 0.98 }} 
                              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#EA580C] py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md hover:bg-orange-600 transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                           >
                              {regSubmitting ? (
                                 <>
                                    <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                                    <span>Criando conta...</span>
                                 </>
                              ) : (
                                 <>
                                    <span>Criar Conta da Empresa</span>
                                    <ArrowRight weight="bold" className="h-4 w-4" />
                                 </>
                              )}
                           </motion.button>
                        </form>

                        <div className="mt-6 text-center border-t border-slate-100 pt-4">
                           <p className="text-sm text-slate-600">
                              Já possui cadastro?{' '}
                              <button 
                                 onClick={() => setActiveView('login')} 
                                 className="font-bold text-[#EA580C] hover:underline"
                              >
                                 Entrar na Conta
                              </button>
                           </p>
                        </div>
                     </motion.div>
                  )}

                  {/* --- FORGOT PASSWORD VIEW --- */}
                  {activeView === 'forgot' && (
                     <motion.div key="forgot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
                        <div className="mb-6">
                           <h1 className="font-sans font-extrabold tracking-tight text-[#0A2540] text-3xl mb-2">
                              Recuperar senha
                           </h1>
                           <p className="text-sm text-slate-500">
                              Informe o e-mail cadastrado para receber o link de redefinição.
                           </p>
                        </div>

                        <form onSubmit={handleForgotSubmit(onForgot)} className="space-y-5">
                           <div className="space-y-1.5">
                              <label htmlFor="forgot_email" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                                 E-mail corporativo
                              </label>
                              <input
                                 {...forgotForm('email')}
                                 id="forgot_email"
                                 placeholder="exemplo@empresa.com.br"
                                 type="email"
                                 autoCapitalize="none"
                                 autoCorrect="off"
                                 spellCheck={false}
                                 className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all focus:bg-white focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100"
                              />
                              {forgotErrors.email && (
                                 <p className="text-red-500 text-xs font-medium mt-1 flex items-center gap-1">
                                    <WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {forgotErrors.email.message}
                                 </p>
                              )}
                           </div>

                           <motion.button 
                              disabled={forgotSubmitting} 
                              type="submit" 
                              whileHover={{ scale: 1.01 }} 
                              whileTap={{ scale: 0.98 }} 
                              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0A2540] py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md hover:bg-slate-800 transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                           >
                              {forgotSubmitting ? (
                                 <>
                                    <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                                    <span>Enviando link...</span>
                                 </>
                              ) : (
                                 <span>Enviar Instruções</span>
                              )}
                           </motion.button>
                        </form>

                        <div className="mt-6 text-center border-t border-slate-100 pt-4">
                           <button 
                              onClick={() => setActiveView('login')} 
                              className="text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-[#0A2540] transition-colors"
                           >
                              Voltar para o Login
                           </button>
                        </div>

                        {devResetLink && (
                           <div className="mt-6 p-4 rounded-xl border border-orange-200 bg-orange-50 text-center">
                              <p className="text-xs font-bold text-orange-700 mb-1">Modo de Teste:</p>
                              <a 
                                 href={devResetLink} 
                                 onClick={(e) => { e.preventDefault(); navigate(devResetLink); }} 
                                 className="text-xs font-semibold text-[#0A2540] underline hover:text-[#EA580C]"
                              >
                                 Clique aqui para redefinir sua senha agora
                              </a>
                           </div>
                        )}
                     </motion.div>
                  )}

                  {/* --- RESET PASSWORD VIEW --- */}
                  {activeView === 'reset' && (
                     <motion.div key="reset" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="my-auto">
                        <div className="mb-6">
                           <h1 className="font-sans font-extrabold tracking-tight text-[#0A2540] text-3xl mb-2">
                              Criar nova senha
                           </h1>
                           <p className="text-sm text-slate-500">
                              Digite sua nova senha de acesso à plataforma.
                           </p>
                        </div>

                        <form onSubmit={handleResetSubmit(onReset)} className="space-y-5">
                           <div className="space-y-1.5">
                              <label htmlFor="reset_pass" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                                 Nova senha (mínimo 8 caracteres)
                              </label>
                              <div className="relative">
                                 <input
                                    {...resetForm('password')}
                                    id="reset_pass"
                                    placeholder="Digite a nova senha"
                                    type={showResetPassword ? 'text' : 'password'}
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-4 pr-12 py-3.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all focus:bg-white focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100"
                                 />
                                 <button 
                                    type="button" 
                                    onClick={() => setShowResetPassword(!showResetPassword)} 
                                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 transition-colors"
                                 >
                                    {showResetPassword ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                 </button>
                              </div>
                              {resetErrors.password && (
                                 <p className="text-red-500 text-xs font-medium mt-1 flex items-center gap-1">
                                    <WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {resetErrors.password.message}
                                 </p>
                              )}
                           </div>

                           <div className="space-y-1.5">
                              <label htmlFor="reset_confirm" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                                 Confirmar nova senha
                              </label>
                              <div className="relative">
                                 <input
                                    {...resetForm('confirmPassword')}
                                    id="reset_confirm"
                                    placeholder="Repita a nova senha"
                                    type={showResetConfirm ? 'text' : 'password'}
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-4 pr-12 py-3.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all focus:bg-white focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100"
                                 />
                                 <button 
                                    type="button" 
                                    onClick={() => setShowResetConfirm(!showResetConfirm)} 
                                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 transition-colors"
                                 >
                                    {showResetConfirm ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                 </button>
                              </div>
                              {resetErrors.confirmPassword && (
                                 <p className="text-red-500 text-xs font-medium mt-1 flex items-center gap-1">
                                    <WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {resetErrors.confirmPassword.message}
                                 </p>
                              )}
                           </div>

                           <motion.button 
                              disabled={resetSubmitting} 
                              type="submit" 
                              whileHover={{ scale: 1.01 }} 
                              whileTap={{ scale: 0.98 }} 
                              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0A2540] py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md hover:bg-slate-800 transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed"
                           >
                              {resetSubmitting ? (
                                 <>
                                    <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                                    <span>Salvando senha...</span>
                                 </>
                              ) : (
                                 <span>Atualizar Senha</span>
                              )}
                           </motion.button>
                        </form>

                        <div className="mt-6 text-center border-t border-slate-100 pt-4">
                           <button 
                              onClick={() => navigate('/login')} 
                              className="text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-[#0A2540] transition-colors"
                           >
                              Voltar para o Login
                           </button>
                        </div>
                     </motion.div>
                  )}
               </AnimatePresence>
            </div>

            {/* Footer Digital Day Software */}
            <div className="w-full text-center mt-8 pt-4 border-t border-slate-100">
               <a 
                  href="https://instagram.com/digitalday_software" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="inline-flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-full px-4 py-1.5 transition-all group"
               >
                  <span className="text-[11px] text-slate-500 group-hover:text-slate-700 transition-colors">
                     Desenvolvido por <strong className="text-[#0A2540] font-semibold">Digital Day Software</strong>
                  </span>
                  <InstagramLogo weight="fill" className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#EA580C] transition-colors" />
               </a>
            </div>
         </div>
      </main>
   );
}
