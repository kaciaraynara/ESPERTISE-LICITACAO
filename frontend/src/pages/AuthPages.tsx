import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { 
   CircleNotch, CheckCircle, WarningCircle, InstagramLogo, 
   ArrowRight, ShieldCheck, Eye, EyeSlash, LockKey
} from '@phosphor-icons/react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '@services/api';
import { useAuthStore } from '@store/auth.store';

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
   nome: z.string().min(2, 'Nome obrigatório'),
   email: z.string().email('E-mail corporativo inválido'),
   whatsapp: z.string().min(10, 'WhatsApp inválido'),
   cnpj: z.string().min(14, 'CNPJ inválido'),
   razoesocial: z.string().min(1, 'Razão Social obrigatória'),
   password: z.string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Za-z]/, 'A senha deve conter pelo menos uma letra')
      .regex(/\d/, 'A senha deve conter pelo menos um número'),
   confirmPassword: z.string(),
   role: z.string().min(1, 'Selecione seu papel operacional')
}).refine(data => data.password === data.confirmPassword, {
   message: 'As senhas não coincidem',
   path: ['confirmPassword']
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
   const [showRegConfirm, setShowRegConfirm] = useState(false);
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
         const response = await authApi.login({ email: data.email, senha: data.password });
         const { user, accessToken, refreshToken } = response.data.data;

         localStorage.setItem('token', accessToken);
         setAuth(user, accessToken, refreshToken ?? undefined);

         toast.success('Acesso seguro liberado. Bem-vindo à sua área protegida.', { icon: '🛡️' });
         navigate('/dashboard', { replace: true });
      } catch (error: any) {
         toast.error(error.response?.data?.message || 'Acesso negado. Verifique suas credenciais.');
      }
   };

   // -----------------------------
   // REGISTRO
   // -----------------------------
   const { register: regForm, handleSubmit: handleRegSubmit, watch: regWatch, setValue: regSetValue, formState: { errors: regErrors, isSubmitting: regSubmitting } } = useForm<RegisterFormValues>({
      resolver: zodResolver(registerSchema),
      defaultValues: {
         nome: location.state?.nome || '',
         email: location.state?.email || '',
         whatsapp: location.state?.whatsapp || '',
         cnpj: location.state?.cnpj || '',
         razoesocial: location.state?.razaoSocial || '',
         password: '',
         confirmPassword: '',
         role: 'Empresário / Diretor'
      }
   });

   const cnpjValue = regWatch('cnpj');
   const passWatch = regWatch('password');
   const confirmWatch = regWatch('confirmPassword');
   const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);

   useEffect(() => {
      const sanitized = cnpjValue.replace(/\D/g, '').slice(0, 14);
      if (sanitized !== cnpjValue) {
         regSetValue('cnpj', sanitized);
      }
      if (sanitized.length === 14) {
         setIsLoadingCnpj(true);
         axios.get(`https://brasilapi.com.br/api/cnpj/v1/${sanitized}`)
            .then((res: any) => regSetValue('razoesocial', res.data.razao_social || '', { shouldValidate: true }))
            .catch(() => regSetValue('razoesocial', '', { shouldValidate: true }))
            .finally(() => setIsLoadingCnpj(false));
      } else {
         if (regWatch('razoesocial') !== '') regSetValue('razoesocial', '', { shouldValidate: true });
      }
   }, [cnpjValue, regSetValue, regWatch]);

   const onRegister = async (data: RegisterFormValues) => {
      try {
         const response = await authApi.register({
            nome: data.nome,
            email: data.email,
            senha: data.password,
            telefone: data.whatsapp,
            cnpj: data.cnpj,
            razao_social: data.razoesocial,
            aceite_lgpd: true,
            role: 'fornecedor'
         });

         const { user, accessToken, refreshToken } = response.data?.data || {};
         
         if (accessToken) {
            localStorage.setItem('token', accessToken);
            setAuth(user, accessToken, refreshToken ?? undefined);
            toast.success('Ambiente corporativo criado e criptografado com sucesso!', { icon: '🔐' });
            navigate('/dashboard', { replace: true });
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
         const res = await authApi.forgotPassword({ email: data.email });
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
      <div className="flex min-h-screen w-full bg-white font-sans text-slate-800 relative">
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
         <div className="hidden lg:flex w-1/2 bg-[#0A2540] flex-col justify-between p-12 lg:p-16 relative overflow-hidden">
            {/* Animacao de background */}
            <motion.div 
               className="absolute inset-0 z-0 opacity-10"
               animate={{ backgroundPosition: ['0% 0%', '100% 100%'] }}
               transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
               style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                  backgroundSize: '40px 40px'
               }}
            />

            <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, type: "spring", bounce: 0.4 }} className="pt-8 relative z-10">
               <img src="/logo.png" alt="Expertise Licitatória" className="h-14 md:h-16 w-auto object-contain brightness-0 invert opacity-95 drop-shadow-lg mb-8" />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.2, type: "spring" }} className="z-10 flex flex-col justify-center flex-1 pr-10 mt-12">
               <AnimatePresence mode="wait">
                  {activeView === 'login' ? (
                     <motion.div key="text-login" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
                        <h2 className="font-sans font-black uppercase tracking-tighter text-white text-4xl xl:text-5xl leading-[1.1] mb-6">
                           AMBIENTE SEGURO DE GESTÃO INSTITUCIONAL
                        </h2>
                        <p className="text-blue-100 text-lg font-medium leading-relaxed mb-10">
                           Acesse seus dados criptografados, visualize seus prazos estratégicos e envie cotações ao mercado governamental com precisão e controle.
                        </p>
                     </motion.div>
                  ) : activeView === 'register' ? (
                     <motion.div key="text-reg" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
                        <h2 className="font-sans font-black uppercase tracking-tighter text-white text-4xl xl:text-5xl leading-[1.1] mb-6">
                           PROTEJA SUA EMPRESA COM TECNOLOGIA DE PONTA
                        </h2>
                        <p className="text-blue-100 text-lg font-medium leading-relaxed mb-10">
                           Cadastre seu CNPJ e tenha um ambiente blindado para analisar editais complexos, monitorar concorrência e preservar o sigilo das suas margens.
                        </p>
                     </motion.div>
                  ) : activeView === 'forgot' ? (
                     <motion.div key="text-forgot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
                        <h2 className="font-sans font-black uppercase tracking-tighter text-white text-4xl xl:text-5xl leading-[1.1] mb-6">
                           RECUPERAÇÃO DE CONTA CORPORATIVA
                        </h2>
                        <p className="text-blue-100 text-lg font-medium leading-relaxed mb-10">
                           Para manter a segurança das informações de licitação da sua empresa, enviamos um token temporário diretamente para o seu e-mail institucional.
                        </p>
                     </motion.div>
                  ) : (
                     <motion.div key="text-reset" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
                        <h2 className="font-sans font-black uppercase tracking-tighter text-white text-4xl xl:text-5xl leading-[1.1] mb-6">
                           ATUALIZAÇÃO DE CREDENCIAIS
                        </h2>
                        <p className="text-blue-100 text-lg font-medium leading-relaxed mb-10">
                           Crie uma nova senha de alta complexidade. Proteja suas informações corporativas e estratégias de mercado.
                        </p>
                     </motion.div>
                  )}
               </AnimatePresence>

               <div className="space-y-6">
                  {[
                     'Análise Jurídica Automatizada e Precisa',
                     'Automação de Cronogramas Críticos',
                     'Inteligência Competitiva de Preços',
                     'Armazenamento Isolado e Criptografado'
                  ].map((item, idx) => (
                     <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.4 + (idx * 0.1) }} className="flex items-center gap-4">
                        <LockKey weight="bold" className="text-[#EA580C] w-6 h-6 shrink-0" />
                        <span className="text-white font-bold tracking-wide text-sm">{item}</span>
                     </motion.div>
                  ))}
               </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.8 }} className="text-slate-400 text-[11px] font-bold uppercase tracking-widest flex items-center gap-3 mt-12 z-10">
               <ShieldCheck size={20} weight="fill" className="text-emerald-500" /> CONFORMIDADE JURÍDICA E PROTEÇÃO DE DADOS ATIVA
            </motion.div>
         </div>

         {/* RIGHT PANEL: Formulários */}
         <div className="w-full lg:w-1/2 flex flex-col justify-between items-center p-6 sm:p-12 h-screen overflow-y-auto bg-white relative">
            {/* Header Mobile */}
            <div className="w-full flex lg:hidden items-center justify-center mb-8 mt-12">
               <img src="/logo.png" alt="Expertise" className="w-[60%] max-w-[200px] h-auto object-contain" />
            </div>

            <div className="w-full max-w-md flex-1 flex flex-col justify-center relative">
               <AnimatePresence mode="wait">
                  {/* --- LOGIN VIEW --- */}
                  {activeView === 'login' && (
                     <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                        <h2 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-3xl mb-8 flex items-center gap-3">
                           Acesso Seguro <ShieldCheck weight="duotone" className="w-8 h-8 text-emerald-500" />
                        </h2>

                        <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-5">
                           <div className="relative group">
                              <input {...loginForm('email')} id="login_email" placeholder=" " type="email" className="peer w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pb-2 pt-6 text-sm font-bold uppercase tracking-wider text-slate-900 focus:border-[#0A2540] focus:bg-white outline-none transition-all" />
                              <label htmlFor="login_email" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#0A2540] pointer-events-none">E-MAIL CORPORATIVO</label>
                              {loginErrors.email && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {loginErrors.email.message}</p>}
                           </div>

                           <div className="relative group">
                              <input {...loginForm('password')} id="login_password" placeholder=" " type={showLoginPassword ? 'text' : 'password'} className="peer w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 pb-2 pt-6 text-sm font-bold tracking-wider text-slate-900 focus:border-[#0A2540] focus:bg-white outline-none transition-all" />
                              <label htmlFor="login_password" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#0A2540] pointer-events-none">SENHA INSTITUCIONAL</label>
                              <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-4 top-3.5 text-slate-400 hover:text-[#0A2540] transition-colors focus:outline-none">
                                 {showLoginPassword ? <EyeSlash className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                              </button>
                              {loginErrors.password && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {loginErrors.password.message}</p>}
                           </div>

                           <motion.button disabled={loginSubmitting} type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden w-full flex items-center justify-center gap-2 rounded-xl bg-[#0A2540] py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg hover:bg-slate-800 transition-colors group mt-2 disabled:opacity-70 disabled:cursor-not-allowed">
                              <span className="relative z-10 flex items-center gap-2">
                                 {loginSubmitting ? (
                                    <>
                                       <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                                       AUTENTICANDO CRIPTOGRAFIA...
                                    </>
                                 ) : (
                                    <>
                                       ACESSAR AMBIENTE
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
                        <h2 className="font-sans font-black uppercase tracking-tighter text-[#0A2540] text-3xl mb-8 flex items-center gap-3">
                           Cadastro Corporativo <LockKey weight="duotone" className="w-8 h-8 text-[#EA580C]" />
                        </h2>

                        <form onSubmit={handleRegSubmit(onRegister)} className="space-y-4">
                           <div className="relative group">
                              <input {...regForm('nome')} id="reg_nome" placeholder=" " type="text" className="peer w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pb-2 pt-6 text-sm font-bold uppercase tracking-wider text-slate-900 focus:border-[#EA580C] focus:bg-white outline-none transition-all" />
                              <label htmlFor="reg_nome" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">NOME DO RESPONSÁVEL</label>
                              {regErrors.nome && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {regErrors.nome.message}</p>}
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="relative group">
                                 <input {...regForm('email')} id="reg_email" placeholder=" " type="email" className="peer w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pb-2 pt-6 text-sm font-bold uppercase tracking-wider text-slate-900 focus:border-[#EA580C] focus:bg-white outline-none transition-all" />
                                 <label htmlFor="reg_email" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">E-MAIL INSTITUCIONAL</label>
                                 {regErrors.email && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {regErrors.email.message}</p>}
                              </div>
                              <div className="relative group">
                                 <input {...regForm('whatsapp')} id="reg_whats" placeholder=" " type="tel" className="peer w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pb-2 pt-6 text-sm font-bold uppercase tracking-wider text-slate-900 focus:border-[#EA580C] focus:bg-white outline-none transition-all" />
                                 <label htmlFor="reg_whats" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">WHATSAPP DA EMPRESA</label>
                                 {regErrors.whatsapp && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {regErrors.whatsapp.message}</p>}
                              </div>
                           </div>

                           <div className="relative group">
                              <input {...regForm('cnpj')} id="reg_cnpj" placeholder=" " type="text" maxLength={14} className="peer w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-10 pb-2 pt-6 text-sm font-bold uppercase tracking-wider text-slate-900 focus:border-[#EA580C] focus:bg-white outline-none transition-all" />
                              <label htmlFor="reg_cnpj" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">CNPJ MATRIZ/FILIAL</label>
                              {isLoadingCnpj && <CircleNotch className="absolute right-4 top-4 h-5 w-5 text-[#EA580C] animate-spin" />}
                              {regErrors.cnpj && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {regErrors.cnpj.message}</p>}
                           </div>

                           {isLoadingCnpj ? (
                              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-center h-[54px]">
                                 <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} className="h-4 bg-slate-300 rounded w-2/3"></motion.div>
                              </div>
                           ) : (
                              <div className="relative">
                                 <input {...regForm('razoesocial')} id="reg_razao" placeholder=" " type="text" className={`peer w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-10 pb-2 pt-6 text-sm font-black uppercase tracking-wider text-slate-900 focus:border-[#EA580C] focus:bg-white outline-none transition-all ${regWatch('razoesocial') && !regErrors.razoesocial ? 'border-emerald-200 bg-emerald-50/30' : ''}`} />
                                 <label htmlFor="reg_razao" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">RAZÃO SOCIAL</label>
                                 {regWatch('razoesocial') && !regErrors.razoesocial && <CheckCircle className="absolute right-4 top-4 h-5 w-5 text-emerald-500" weight="fill" />}
                                 {regErrors.razoesocial && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle weight="bold" className="w-4 h-4 shrink-0" /> {regErrors.razoesocial.message}</p>}
                              </div>
                           )}

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="relative group">
                                 <input {...regForm('password')} id="reg_pass" placeholder=" " type={showRegPassword ? 'text' : 'password'} className="peer w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 pb-2 pt-6 text-sm font-bold tracking-wider text-slate-900 focus:border-[#EA580C] focus:bg-white outline-none transition-all" />
                                 <label htmlFor="reg_pass" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">CRIAR SENHA SECRETA</label>
                                 <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-3 top-3.5 text-slate-400 hover:text-[#EA580C] transition-colors focus:outline-none">
                                    {showRegPassword ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                 </button>
                                 {regErrors.password && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-start gap-1 leading-tight"><WarningCircle weight="bold" className="w-4 h-4 shrink-0 mt-0.5" /> {regErrors.password.message}</p>}
                              </div>
                              <div className="relative group">
                                 <input {...regForm('confirmPassword')} id="reg_confirm" placeholder=" " type={showRegConfirm ? 'text' : 'password'} className={`peer w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 pb-2 pt-6 text-sm font-bold tracking-wider text-slate-900 focus:border-[#EA580C] focus:bg-white outline-none transition-all ${passWatch && confirmWatch && passWatch === confirmWatch ? 'border-emerald-300 ring-1 ring-emerald-300' : ''}`} />
                                 <label htmlFor="reg_confirm" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">REPETIR SENHA</label>
                                 <button type="button" onClick={() => setShowRegConfirm(!showRegConfirm)} className="absolute right-3 top-3.5 text-slate-400 hover:text-[#EA580C] transition-colors focus:outline-none">
                                    {showRegConfirm ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                 </button>
                                 {regErrors.confirmPassword && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-start gap-1 leading-tight"><WarningCircle weight="bold" className="w-4 h-4 shrink-0 mt-0.5" /> {regErrors.confirmPassword.message}</p>}
                              </div>
                           </div>
                           
                           {/* Hint de segurança dinâmico */}
                           <AnimatePresence>
                              {passWatch && passWatch.length > 0 && passWatch === confirmWatch && (
                                 <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-widest bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                                    <ShieldCheck weight="fill" className="w-4 h-4" /> Senhas coincidem
                                 </motion.div>
                              )}
                           </AnimatePresence>

                           <motion.button disabled={regSubmitting} type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden w-full flex items-center justify-center gap-2 rounded-xl bg-[#EA580C] py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg hover:bg-orange-600 transition-colors group mt-6 disabled:opacity-70 disabled:cursor-not-allowed">
                              <span className="relative z-10 flex items-center gap-2">
                                 {regSubmitting ? (
                                    <>
                                       <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                                       CRIANDO AMBIENTE PROTEGIDO...
                                    </>
                                 ) : (
                                    <>
                                       VALIDAR CNPJ E PROTEGER DADOS
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
                              <input {...forgotForm('email')} id="forgot_email" placeholder=" " type="email" className="peer w-full rounded-xl border border-slate-200 bg-slate-50 px-4 pb-2 pt-6 text-sm font-bold uppercase tracking-wider text-slate-900 focus:border-[#0A2540] focus:bg-white outline-none transition-all" />
                              <label htmlFor="forgot_email" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#0A2540] pointer-events-none">E-MAIL INSTITUCIONAL</label>
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
                              <input {...resetForm('password')} id="reset_pass" placeholder=" " type={showResetPassword ? 'text' : 'password'} className="peer w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 pb-2 pt-6 text-sm font-bold tracking-wider text-slate-900 focus:border-[#EA580C] focus:bg-white outline-none transition-all" />
                              <label htmlFor="reset_pass" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">NOVA SENHA (MÍN 8 CARACT.)</label>
                              <button type="button" onClick={() => setShowResetPassword(!showResetPassword)} className="absolute right-3 top-3.5 text-slate-400 hover:text-[#EA580C] transition-colors focus:outline-none">
                                 {showResetPassword ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                              {resetErrors.password && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-start gap-1 leading-tight"><WarningCircle weight="bold" className="w-4 h-4 shrink-0 mt-0.5" /> {resetErrors.password.message}</p>}
                           </div>

                           <div className="relative group">
                              <input {...resetForm('confirmPassword')} id="reset_confirm" placeholder=" " type={showResetConfirm ? 'text' : 'password'} className={`peer w-full rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-12 pb-2 pt-6 text-sm font-bold tracking-wider text-slate-900 focus:border-[#EA580C] focus:bg-white outline-none transition-all ${passResetWatch && passResetConfirmWatch && passResetWatch === passResetConfirmWatch ? 'border-emerald-300 ring-1 ring-emerald-300' : ''}`} />
                              <label htmlFor="reset_confirm" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">REPETIR NOVA SENHA</label>
                              <button type="button" onClick={() => setShowResetConfirm(!showResetConfirm)} className="absolute right-3 top-3.5 text-slate-400 hover:text-[#EA580C] transition-colors focus:outline-none">
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
                  <span className="text-[10px] text-slate-400 group-hover:text-slate-600 transition-colors uppercase font-bold tracking-widest">Desenvolvido por <strong className="text-[#0A2540]">Digital Day Software</strong></span>
                  <InstagramLogo weight="fill" className="h-4 w-4 text-slate-400 group-hover:text-[#EA580C] transition-colors" />
               </a>
            </div>
         </div>
      </div>
   );
}