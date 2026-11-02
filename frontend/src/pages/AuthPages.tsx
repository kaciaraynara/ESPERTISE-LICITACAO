import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
   CircleNotch, CheckCircle, WarningCircle, InstagramLogo, 
   ArrowRight, ShieldCheck, Eye, EyeSlash, LockKey
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

export default function AuthPages() {
   const navigate = useNavigate();
   const location = useLocation();
   const setAuth = useAuthStore(state => state.setAuth);

   const [activeView, setActiveView] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
   
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

         toast.success('Bem-vindo à sua área protegida.', { icon: '🛡️' });
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
         regSetValue('razoesocial', '', { shouldValidate: true });
         return;
      }

      let isCurrentLookup = true;
      setIsLoadingCnpj(true);
      setCnpjLookupError(null);
      regSetValue('razoesocial', '', { shouldValidate: true });
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
         const response = await authApi.register({
            nome: 'Administrador da conta',
            email: data.email.trim().toLowerCase(),
            senha: data.password,
            cnpj: data.cnpj,
            razao_social: data.razoesocial || '',
            aceite_lgpd: data.aceite_lgpd,
            role: 'fornecedor'
         });

         const { user, accessToken, refreshToken } = response.data?.data || {};
         
         if (accessToken) {
            localStorage.setItem('token', accessToken);
            setAuth(user, accessToken, refreshToken ?? undefined);
            toast.success('Ambiente corporativo criado e criptografado com sucesso!', { icon: '🔐' });
            navigate(FORNECEDOR_ROUTES.dashboard, { replace: true });
         } else {
            toast.success('Empresa validada! Faça o login para acessar o ambiente.');
            setActiveView('login');
         }
      } catch (error: any) {
         toast.error(error.response?.data?.message || 'Falha ao registrar empresa. Verifique os dados.');
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
         
         // Se o backend enviar um devToken (pois não temos envio de email real configurado ainda)
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
   const { register: resetForm, handleSubmit: handleResetSubmit, watch: resetWatch, formState: { errors: resetErrors, isSubmitting: resetSubmitting } } = useForm<ResetFormValues>({
      resolver: zodResolver(resetSchema)
   });

   const passResetWatch = resetWatch('password');
   const passResetConfirmWatch = resetWatch('confirmPassword');

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

   return (
      <main className="flex min-h-screen w-full bg-white font-sans text-slate-800 relative motion-reduce:animate-none">
         {/* Botão de Escape */}
         <button
            onClick={() => window.location.href = '/'}
            title="Voltar para a página inicial"
            className="absolute left-6 top-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0A2540] shadow-sm transition-all hover:scale-105 hover:bg-slate-50 active:scale-95"
         >
            <svg xmlns="http://w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
               <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
         </button>

         {/* LEFT PANEL: Institucional, Criptografia e Segurança */}
         <div className="hidden lg:flex w-1/2 bg-[#F5F8FC] flex-col justify-between p-12 lg:p-16 relative overflow-hidden">
            {/* Animacao de background */}
            <motion.div 
               className="absolute inset-0 z-0 opacity-[0.07]"
               animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
               transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
               style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, #0A2540 1px, transparent 0)',
                  backgroundSize: '36px 36px'
               }}
            />

            <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, type: "spring", bounce: 0.4 }} className="pt-8 relative z-10">
               <img src="/logo.png" alt="Expertise Licitatória" className="h-14 md:h-16 w-auto object-contain opacity-95 mb-8" />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2, type: "spring" }} className="z-10 flex flex-col justify-center flex-1 pr-10 mt-12">
               <AnimatePresence mode="wait">
                  {activeView === 'login' ? (
                     <motion.div key="text-login" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
                        <h2 className="font-sans font-black tracking-tight text-[#0A2540] text-4xl xl:text-5xl leading-[1.1] mb-6">
                           Sua vantagem estratégica em licitações públicas.
                        </h2>
                        <p className="text-slate-600 text-lg font-medium leading-relaxed mb-10">
                           Acompanhe prazos, oportunidades e informações da sua empresa em um só lugar.
                        </p>
                     </motion.div>
                  ) : activeView === 'register' ? (
                     <motion.div key="text-reg" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
                        <h2 className="font-sans font-black tracking-tight text-[#0A2540] text-4xl xl:text-5xl leading-[1.1] mb-6">
                           Sua empresa pronta para novas oportunidades.
                        </h2>
                        <p className="text-slate-600 text-lg font-medium leading-relaxed mb-10">
                           Cadastre seu CNPJ para organizar documentos, acompanhar oportunidades e preparar propostas para o mercado público.
                        </p>
                     </motion.div>
                  ) : activeView === 'forgot' ? (
                     <motion.div key="text-forgot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
                        <h2 className="font-sans font-black tracking-tight text-[#0A2540] text-4xl xl:text-5xl leading-[1.1] mb-6">
                           Recupere seu acesso com segurança.
                        </h2>
                        <p className="text-slate-600 text-lg font-medium leading-relaxed mb-10">
                           Para manter a segurança das informações de licitação da sua empresa, enviamos um token temporário diretamente para o seu e-mail institucional.
                        </p>
                     </motion.div>
                  ) : (
                     <motion.div key="text-reset" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
                        <h2 className="font-sans font-black tracking-tight text-[#0A2540] text-4xl xl:text-5xl leading-[1.1] mb-6">
                           Atualize suas credenciais.
                        </h2>
                        <p className="text-slate-600 text-lg font-medium leading-relaxed mb-10">
                           Crie uma nova senha de alta complexidade. Proteja suas informações corporativas e estratégias de mercado.
                        </p>
                     </motion.div>
                  )}
               </AnimatePresence>

               <div className="space-y-6">
                  {[
                     'Análise assistida de editais',
                     'Acompanhamento de prazos importantes',
                     'Inteligência Competitiva de Preços',
                     'Documentos organizados por empresa'
                  ].map((item, idx) => (
                     <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 + (idx * 0.1) }} className="flex items-center gap-4">
                        <LockKey weight="bold" className="text-[#EA580C] w-6 h-6 shrink-0" />
                        <span className="text-[#0A2540] font-bold tracking-wide text-sm">{item}</span>
                     </motion.div>
                  ))}
               </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.8 }} className="text-slate-500 text-[11px] font-bold uppercase tracking-widest flex items-center gap-3 mt-12 z-10">
               <ShieldCheck size={20} weight="fill" className="text-emerald-500" /> CONFORMIDADE JURÍDICA E PROTEÇÃO DE DADOS ATIVA
            </motion.div>
         </div>

         {/* RIGHT PANEL: Formulários */}
         <div className="w-full lg:w-1/2 flex flex-col justify-between items-center p-6 sm:p-12 min-h-screen lg:h-screen overflow-y-auto bg-white relative">
            {/* Header Mobile */}
            <div className="w-full flex lg:hidden items-center justify-center mb-8 mt-12">
               <img src="/logo.png" alt="Expertise" className="w-[60%] max-w-[200px] h-auto object-contain" />
            </div>

            <div className="w-full max-w-md flex-1 flex flex-col justify-center relative">
               <AnimatePresence mode="wait">
                  {/* --- LOGIN VIEW --- */}
                  {activeView === 'login' && (
                     <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                        <h2 className="font-sans font-black tracking-tight text-[#0A2540] text-3xl mb-3 flex items-center gap-3">
                           Bem-vindo de volta <ShieldCheck weight="duotone" className="w-8 h-8 text-emerald-500" />
                        </h2>
                        <p className="mb-8 text-sm text-slate-500">Acesse sua central de oportunidades.</p>

                        <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-5">
                           <div className="relative group">
                              <input
                                 {...loginForm('email')}
                                 id="login_email"
                                 placeholder=" "
                                 type="email"
                                 autoCapitalize="none"
                                 autoCorrect="off"
                                 spellCheck={false}
                                 className="peer w-full rounded-xl border border-slate-200 bg-white px-4 pb-2 pt-6 text-sm font-medium lowercase tracking-wide text-slate-900 shadow-[0_8px_24px_rgba(15,35,60,0.04)] outline-none transition-all focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100"
                              />
                              <label htmlFor="login_email" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#0A2540] pointer-events-none">E-MAIL CORPORATIVO</label>
                              {loginErrors.email && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {loginErrors.email.message}</p>}
                           </div>

                           <div className="relative group">
                              <input
                                 {...loginForm('password')}
                                 id="login_password"
                                 placeholder=" "
                                 type={showLoginPassword ? 'text' : 'password'}
                                 autoCapitalize="none"
                                 autoCorrect="off"
                                 spellCheck={false}
                                 className="peer w-full rounded-xl border border-slate-200 bg-white pl-4 pr-12 pb-2 pt-6 text-sm font-medium tracking-wide text-slate-900 shadow-[0_8px_24px_rgba(15,35,60,0.04)] outline-none transition-all focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100"
                              />
                              <label htmlFor="login_password" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#0A2540] pointer-events-none">SENHA INSTITUCIONAL</label>
                              <button type="button" aria-label={showLoginPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showLoginPassword} onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-4 top-3.5 text-slate-500 hover:text-[#0A2540] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] rounded">
                                 {showLoginPassword ? <EyeSlash className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                              </button>
                              {loginErrors.password && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {loginErrors.password.message}</p>}
                           </div>

                           <motion.button disabled={loginSubmitting} type="submit" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden w-full flex items-center justify-center gap-2 rounded-xl bg-[#EA580C] py-4 text-sm font-black uppercase tracking-widest text-white shadow-[0_10px_26px_rgba(234,88,12,0.22)] hover:bg-orange-600 transition-colors group mt-2 disabled:opacity-70 disabled:cursor-not-allowed">
                              <span className="relative z-10 flex items-center gap-2">
                                 {loginSubmitting ? (
                                    <>
                                       <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                                       AUTENTICANDO CRIPTOGRAFIA...
                                    </>
                                 ) : (
                                    <>
                                       ACEDER À PLATAFORMA
                                       <ArrowRight weight="bold" className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                 )}
                              </span>
                           </motion.button>
                        </form>


                        <div className="mt-8 flex flex-col items-center gap-4">
                           <button onClick={() => setActiveView('forgot')} className="text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-[#0A2540] transition-colors">Esqueceu seus dados?</button>
                           <button onClick={() => setActiveView('register')} className="text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-[#0A2540] transition-colors">Nova empresa? <span className="text-[#EA580C] underline decoration-[#EA580C] decoration-2 underline-offset-4">Cadastrar CNPJ</span></button>
                        </div>
                     </motion.div>
                  )}

                  {/* --- REGISTER VIEW --- */}
                  {activeView === 'register' && (
                     <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="my-auto py-8">
                        <h2 className="font-sans font-black tracking-tight text-[#0A2540] text-3xl mb-3 flex items-center gap-3">
                           Crie sua conta <LockKey weight="duotone" className="w-8 h-8 text-[#EA580C]" />
                        </h2>
                        <p className="mb-7 text-sm text-slate-500">Comece com três informações. Validaremos a empresa pelo CNPJ.</p>

                        <form onSubmit={handleRegSubmit(onRegister)} className="space-y-5">
                           <div>
                              <div className="relative group">
                                 <input
                                    {...regForm('email')}
                                    id="reg_email"
                                    placeholder=" "
                                    type="email"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    autoComplete="email"
                                    required
                                    className="peer w-full rounded-xl border border-slate-200 bg-white px-4 pb-2 pt-6 text-sm font-medium lowercase tracking-wide text-slate-900 shadow-[0_8px_24px_rgba(15,35,60,0.04)] outline-none transition-all focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100"
                                 />
                                 <label htmlFor="reg_email" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">E-MAIL INSTITUCIONAL</label>
                                 {regErrors.email && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {regErrors.email.message}</p>}
                              </div>
                           </div>

                           <div className="relative group">
                              <input
                                 {...regForm('cnpj')}
                                 id="reg_cnpj"
                                 placeholder=" "
                                 type="text"
                                 inputMode="numeric"
                                 autoComplete="off"
                                 maxLength={18}
                                 required
                                 className="peer w-full rounded-xl border border-slate-200 bg-white pl-4 pr-10 pb-2 pt-6 text-sm font-medium tracking-wide text-slate-900 shadow-[0_8px_24px_rgba(15,35,60,0.04)] outline-none transition-all focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100"
                              />
                              <label htmlFor="reg_cnpj" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">CNPJ MATRIZ/FILIAL</label>
                              {isLoadingCnpj && <CircleNotch className="absolute right-4 top-4 h-5 w-5 text-[#EA580C] animate-spin" />}
                              {regErrors.cnpj && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {regErrors.cnpj.message}</p>}
                           </div>

                           <div className="relative">
                              <input
                                 {...regForm('razoesocial')}
                                 id="reg_razao"
                                 placeholder=" "
                                 type="text"
                                 disabled={isLoadingCnpj}
                                 aria-live="polite"
                                 className="peer w-full rounded-xl border border-slate-200 bg-white pl-4 pr-10 pb-2 pt-6 text-sm font-medium tracking-wide text-slate-900 shadow-[0_8px_24px_rgba(15,35,60,0.04)] outline-none transition-all focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100 disabled:bg-slate-50 disabled:text-slate-500"
                              />
                              <label htmlFor="reg_razao" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">RAZÃO SOCIAL DA EMPRESA</label>
                              {regWatch('razoesocial') && <CheckCircle className="absolute right-4 top-4 h-5 w-5 text-emerald-500" weight="fill" />}
                              {isLoadingCnpj && <span className="absolute right-4 top-4 text-xs text-slate-500">Consultando...</span>}
                              {cnpjLookupError && <p role="status" className="mt-2 text-xs font-medium text-amber-700">{cnpjLookupError}</p>}
                           </div>

                           <div>
                              <div className="relative group">
                                 <input
                                    {...regForm('password')}
                                    id="reg_pass"
                                    placeholder=" "
                                    type={showRegPassword ? 'text' : 'password'}
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    required
                                    autoComplete="new-password"
                                    className="peer w-full rounded-xl border border-slate-200 bg-white pl-4 pr-12 pb-2 pt-6 text-sm font-medium tracking-wide text-slate-900 shadow-[0_8px_24px_rgba(15,35,60,0.04)] outline-none transition-all focus:border-[#EA580C] focus:ring-4 focus:ring-orange-100"
                                 />
                                 <label htmlFor="reg_pass" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">CRIAR SENHA SECRETA</label>
                                 <button type="button" aria-label={showRegPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showRegPassword} onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-3 top-3.5 text-slate-500 hover:text-[#EA580C] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EA580C] rounded">
                                    {showRegPassword ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                 </button>
                                 {regErrors.password && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-start gap-1 leading-tight"><WarningCircle weight="bold" className="w-4 h-4 shrink-0 mt-0.5" /> {regErrors.password.message}</p>}
                              </div>
                           </div>

                           <label className="flex items-start gap-3 text-xs leading-relaxed text-slate-600">
                              <input
                                 {...regForm('aceite_lgpd')}
                                 type="checkbox"
                                 className="mt-0.5 h-4 w-4 shrink-0 accent-[#EA580C]"
                              />
                              <span>
                                 Li e aceito os <a href="/termos" target="_blank" rel="noreferrer" className="font-semibold text-[#0A2540] underline">Termos de Uso</a> e a <a href="/privacidade" target="_blank" rel="noreferrer" className="font-semibold text-[#0A2540] underline">Política de Privacidade</a>.
                                 {regErrors.aceite_lgpd && <span className="mt-1 block text-red-600">{regErrors.aceite_lgpd.message}</span>}
                              </span>
                           </label>

                           <p className="flex items-center gap-2 text-xs leading-relaxed text-slate-500">
                              <LockKey className="h-4 w-4 shrink-0 text-emerald-600" weight="bold" />
                              Conexão protegida e dados tratados com segurança.
                           </p>

                           <motion.button disabled={regSubmitting} type="submit" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden w-full flex items-center justify-center gap-2 rounded-xl bg-[#EA580C] py-4 text-sm font-black uppercase tracking-widest text-white shadow-[0_10px_26px_rgba(234,88,12,0.22)] hover:bg-orange-600 transition-colors group mt-6 disabled:opacity-70 disabled:cursor-not-allowed">
                              <span className="relative z-10 flex items-center gap-2">
                                 {regSubmitting ? (
                                    <>
                                       <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                                       CRIANDO CONTA...
                                    </>
                                 ) : (
                                    <>
                                       CRIAR CONTA
                                       <ArrowRight weight="bold" className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                 )}
                              </span>
                           </motion.button>
                        </form>

                        <div className="mt-6 text-center">
                           <button onClick={() => setActiveView('login')} className="text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-[#EA580C] transition-colors">Já cadastrou a empresa? <span className="text-[#0A2540] underline decoration-[#EA580C] decoration-2 underline-offset-4">Acesso Seguro</span></button>
                        </div>
                     </motion.div>
                  )}

                  {/* --- FORGOT PASSWORD VIEW --- */}
                  {activeView === 'forgot' && (
                     <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                        <h2 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-3xl mb-4">RECUPERAR ACESSO</h2>
                        <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">Insira seu e-mail corporativo cadastrado para receber as instruções seguras de redefinição de credenciais.</p>

                        <form onSubmit={handleForgotSubmit(onForgot)} className="space-y-6">
                           <div className="relative group">
                              <input
                                 {...forgotForm('email')}
                                 id="forgot_email"
                                 placeholder=" "
                                 type="email"
                                 autoCapitalize="none"
                                 autoCorrect="off"
                                 spellCheck={false}
                                 className="peer w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pb-2 pt-6 text-sm font-bold lowercase tracking-wider text-slate-900 focus:border-[#0A2540] focus:bg-white outline-none transition-all"
                              />
                              <label htmlFor="forgot_email" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#0A2540] pointer-events-none">E-MAIL INSTITUCIONAL</label>
                              {forgotErrors.email && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {forgotErrors.email.message}</p>}
                           </div>

                           <motion.button disabled={forgotSubmitting} type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden w-full flex items-center justify-center gap-2 rounded-xl bg-[#0A2540] py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg hover:bg-slate-800 transition-colors group disabled:opacity-70 disabled:cursor-not-allowed">
                              <span className="relative z-10 flex items-center gap-2">
                                 {forgotSubmitting ? (
                                    <>
                                       <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                                       ENVIANDO TOKEN SEGURO...
                                    </>
                                 ) : (
                                    <>
                                       SOLICITAR NOVA SENHA
                                    </>
                                 )}
                              </span>
                           </motion.button>
                        </form>

                        <div className="mt-8 text-center">
                           <button onClick={() => setActiveView('login')} className="text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-[#0A2540] transition-colors">Voltar para Login Seguro</button>
                        </div>

                        {devResetLink && (
                           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 p-4 rounded-xl border border-orange-200 bg-orange-50 text-center">
                              <p className="text-[10px] font-black uppercase text-orange-600 mb-2 tracking-widest">Simulação de E-mail (Modo Teste)</p>
                              <a href={devResetLink} onClick={(e) => { e.preventDefault(); navigate(devResetLink); }} className="text-sm font-bold text-[#0A2540] underline underline-offset-4 decoration-orange-400 hover:text-orange-600 transition-colors">
                                 Clique aqui para atualizar a senha
                              </a>
                           </motion.div>
                        )}
                     </motion.div>
                  )}

                  {/* --- RESET PASSWORD VIEW --- */}
                  {activeView === 'reset' && (
                     <motion.div key="reset" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="my-auto">
                        <h2 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-3xl mb-8 flex items-center gap-3">
                           Nova Senha <LockKey weight="duotone" className="w-8 h-8 text-[#EA580C]" />
                        </h2>

                        <form onSubmit={handleResetSubmit(onReset)} className="space-y-6">
                           <div className="relative group">
                              <input
                                 {...resetForm('password')}
                                 id="reset_pass"
                                 placeholder=" "
                                 type={showResetPassword ? 'text' : 'password'}
                                 autoCapitalize="none"
                                 autoCorrect="off"
                                 spellCheck={false}
                                 className="peer w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 pb-2 pt-6 text-sm font-bold tracking-wider text-slate-900 focus:border-[#EA580C] focus:bg-white outline-none transition-all"
                              />
                              <label htmlFor="reset_pass" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">NOVA SENHA (MÍN 8 CARACT.)</label>
                              <button type="button" onClick={() => setShowResetPassword(!showResetPassword)} className="absolute right-3 top-3.5 text-slate-500 hover:text-[#EA580C] transition-colors focus:outline-none">
                                 {showResetPassword ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                              {resetErrors.password && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-start gap-1 leading-tight"><WarningCircle weight="bold" className="w-4 h-4 shrink-0 mt-0.5" /> {resetErrors.password.message}</p>}
                           </div>

                           <div className="relative group">
                              <input
                                 {...resetForm('confirmPassword')}
                                 id="reset_confirm"
                                 placeholder=" "
                                 type={showResetConfirm ? 'text' : 'password'}
                                 autoCapitalize="none"
                                 autoCorrect="off"
                                 spellCheck={false}
                                 className={`peer w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 pb-2 pt-6 text-sm font-bold tracking-wider text-slate-900 focus:border-[#EA580C] focus:bg-white outline-none transition-all ${passResetWatch && passResetConfirmWatch && passResetWatch === passResetConfirmWatch ? 'border-emerald-300 ring-1 ring-emerald-300' : ''}`}
                              />
                              <label htmlFor="reset_confirm" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">REPETIR NOVA SENHA</label>
                              <button type="button" onClick={() => setShowResetConfirm(!showResetConfirm)} className="absolute right-3 top-3.5 text-slate-500 hover:text-[#EA580C] transition-colors focus:outline-none">
                                 {showResetConfirm ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                              {resetErrors.confirmPassword && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-start gap-1 leading-tight"><WarningCircle weight="bold" className="w-4 h-4 shrink-0 mt-0.5" /> {resetErrors.confirmPassword.message}</p>}
                           </div>

                           <AnimatePresence>
                              {passResetWatch && passResetWatch.length > 0 && passResetWatch === passResetConfirmWatch && (
                                 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-widest bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                                    <ShieldCheck weight="fill" className="w-4 h-4" /> Senhas coincidem
                                 </motion.div>
                              )}
                           </AnimatePresence>

                           <motion.button disabled={resetSubmitting} type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden w-full flex items-center justify-center gap-2 rounded-xl bg-[#0A2540] py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg hover:bg-slate-800 transition-colors group disabled:opacity-70 disabled:cursor-not-allowed mt-4">
                              <span className="relative z-10 flex items-center gap-2">
                                 {resetSubmitting ? (
                                    <>
                                       <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                                       ATUALIZANDO...
                                    </>
                                 ) : (
                                    <>
                                       REDEFINIR SENHA
                                    </>
                                 )}
                              </span>
                           </motion.button>
                        </form>

                        <div className="mt-8 text-center">
                           <button onClick={() => navigate('/login')} className="text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-[#0A2540] transition-colors">Voltar para Login Seguro</button>
                        </div>
                     </motion.div>
                  )}
               </AnimatePresence>
            </div>

            {/* Footer Digital Day Software */}
            <div className="w-full text-center mt-8 pt-6 border-t border-slate-100">
               <a href="https://instagram.com/digitalday_software" target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-full px-5 py-2 transition-all group">
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-600 transition-colors uppercase font-bold tracking-widest">Desenvolvido por <strong className="text-[#0A2540]">Digital Day Software</strong></span>
                  <InstagramLogo weight="fill" className="h-4 w-4 text-slate-500 group-hover:text-[#EA580C] transition-colors" />
               </a>
            </div>
         </div>
      </main>
   );
}