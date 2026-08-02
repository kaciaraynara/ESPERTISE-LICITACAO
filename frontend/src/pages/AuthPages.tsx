import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { CircleNotch, CheckCircle, WarningCircle, InstagramLogo, ArrowRight, ShieldCheck } from '@phosphor-icons/react';
import BrandLogo from '@components/brand/BrandLogo';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '@services/api';
import { useAuthStore } from '@store/auth.store';

// Zod Schemas
const loginSchema = z.object({
   email: z.string().email('E-mail corporativo inválido'),
   password: z.string().min(6, 'Senha inválida')
});

const forgotSchema = z.object({
   email: z.string().email('E-mail corporativo inválido')
});

const registerSchema = z.object({
   nome: z.string().min(2, 'Nome obrigatório'),
   email: z.string().email('E-mail corporativo inválido'),
   whatsapp: z.string().min(10, 'WhatsApp inválido'),
   cnpj: z.string().min(14, 'CNPJ inválido'),
   razoesocial: z.string().min(1, 'Razão Social obrigatória'),
   password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
   role: z.string().min(1, 'Selecione seu papel operacional')
});

type LoginFormValues = z.infer<typeof loginSchema>;
type ForgotFormValues = z.infer<typeof forgotSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

const carouselPhrases = [
   "SUA OPERAÇÃO PROTEGIDA 24H POR DIA",
   "O REVISOR QUE ENCONTRA AS ARMADILHAS DOS PREGOEIROS"
];

export default function AuthPages() {
   const navigate = useNavigate();
   const location = useLocation();
   const setAuth = useAuthStore(state => state.setAuth);

   const [activeView, setActiveView] = useState<'login' | 'register' | 'forgot'>('login');
   const [phraseIndex, setPhraseIndex] = useState(0);
   useEffect(() => {
      if (location.pathname === '/register') setActiveView('register');
      else if (location.pathname === '/login') setActiveView('login');
   }, [location.pathname]);

   useEffect(() => {
      const interval = setInterval(() => {
         setPhraseIndex(prev => (prev + 1) % carouselPhrases.length);
      }, 5000);
      return () => clearInterval(interval);
   }, []);

   // -----------------------------
   // LOGIN FORM LOGIC
   // -----------------------------
   const { register: loginForm, handleSubmit: handleLoginSubmit, formState: { errors: loginErrors, isSubmitting: loginSubmitting } } = useForm<LoginFormValues>({
      resolver: zodResolver(loginSchema)
   });

   const onLogin = async (data: LoginFormValues) => {
      try {
         const response = await authApi.login({ email: data.email, senha: data.password });
         const { user, accessToken } = response.data.data;

         // Persist token & Zustand state
         localStorage.setItem('token', accessToken);
         setAuth(user, accessToken);

         toast.success('Acesso liberado. Bem-vindo à Central de Comando.');
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
         role: 'Empresário / Diretor'
      }
   });

   const cnpjValue = regWatch('cnpj');
   const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);

   useEffect(() => {
      const sanitized = cnpjValue.replace(/\D/g, '').slice(0, 14);
      if (sanitized !== cnpjValue) {
         regSetValue('cnpj', sanitized);
      }
      if (sanitized.length === 14) {
         setIsLoadingCnpj(true);
         axios.get(`https://brasilapi.com.br/api/cnpj/v1/${sanitized}`)
            .then(res => regSetValue('razoesocial', res.data.razao_social || ''))
            .catch(() => regSetValue('razoesocial', ''))
            .finally(() => setIsLoadingCnpj(false));
      } else {
         if (regWatch('razoesocial') !== '') regSetValue('razoesocial', '');
      }
   }, [cnpjValue, regSetValue, regWatch]);

   const onRegister = async () => {
      localStorage.setItem('token', 'novo_token_operacional');
      toast.success('Conta criada com sucesso.');
      navigate('/dashboard', { replace: true });
   };

   // -----------------------------
   // FORGOT FORM LOGIC
   // -----------------------------
   const { register: forgotForm, handleSubmit: handleForgotSubmit, formState: { errors: forgotErrors, isSubmitting: forgotSubmitting } } = useForm<ForgotFormValues>({
      resolver: zodResolver(forgotSchema)
   });

   const onForgot = (data: ForgotFormValues) => {
      toast.success('Instruções enviadas para ' + data.email);
      setActiveView('login');
   };

   return (
      <div className="flex min-h-screen w-full bg-white font-sans text-slate-800 relative">

         {/* Botão de Escape - Posicionado de forma absoluta e discreta no canto superior esquerdo */}
         <button
            onClick={() => window.location.href = '/'}
            title="Voltar para o portal principal"
            className="absolute left-6 top-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0A2540] shadow-sm transition-all hover:scale-105 hover:bg-slate-50 active:scale-95"
         >
            {/* Utilize o ícone ArrowLeft com dimensões estritas de 20px (w-5 h-5) */}
            <svg
               xmlns="http://w3.org"
               fill="none"
               viewBox="0 0 24 24"
               strokeWidth={2}
               stroke="currentColor"
               className="h-5 w-5"
            >
               <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
         </button>

         {/* LEFT PANEL: Branding & Support (Hidden on Mobile) */}
         <div className="hidden lg:flex w-1/2 bg-[#0A2540] flex-col justify-between p-12 lg:p-16 relative overflow-hidden">

            {/* Monumental Logo */}
            <motion.div
               initial={{ opacity: 0, y: -30 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
               className="pt-8"
            >
               <img src="/logo-expertise.png" alt="Expertise" className="w-[60%] h-auto object-contain brightness-0 invert opacity-95 drop-shadow-2xl" />
            </motion.div>

            <motion.div
               initial={{ opacity: 0, x: -40 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ duration: 0.7, delay: 0.2, type: "spring" }}
               className="z-10 flex flex-col justify-center flex-1 pr-10 mt-12"
            >
               <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="font-sans font-black uppercase tracking-tighter text-white text-5xl leading-[1.05] mb-8"
               >
                  DOMINE AS LICITAÇÕES COM INTELIGÊNCIA ARTIFICIAL
               </motion.h2>

               <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="text-blue-100 text-lg font-medium leading-relaxed mb-10"
               >
                  Pare de perder tempo com processos manuais. A Expertise Licitatória automatiza sua análise de editais, monitoramento de oportunidades e gestão de prazos.
               </motion.p>

               <div className="space-y-6">
                  {[
                     'Saneamento de editais em segundos via IA Lex',
                     'Radar georreferenciado de oportunidades',
                     'Automação de cronogramas e prazos críticos',
                     'Cálculo de margem e inteligência competitiva'
                  ].map((item, idx) => (
                     <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.6 + (idx * 0.15) }}
                        className="flex items-center gap-4"
                     >
                        <motion.div
                           animate={{ scale: [1, 1.15, 1] }}
                           transition={{ duration: 2.5, repeat: Infinity, delay: idx * 0.3, ease: "easeInOut" }}
                        >
                           <CheckCircle weight="fill" className="text-[#EA580C] w-7 h-7 shrink-0" />
                        </motion.div>
                        <span className="text-white font-bold tracking-wide text-sm">{item}</span>
                     </motion.div>
                  ))}
               </div>
            </motion.div>

            <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.6, delay: 1.2 }}
               className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-3 mt-12"
            >
               <ShieldCheck size={20} weight="fill" className="text-emerald-500" /> AMBIENTE BLINDADO SOB CONFORMIDADE JURÍDICA
            </motion.div>
         </div>

         {/* RIGHT PANEL: Forms */}
         <div className="w-full lg:w-1/2 flex flex-col justify-between items-center p-6 sm:p-12 h-screen overflow-y-auto bg-white relative">

            {/* Mobile escape arrow inside right panel if needed, but absolute covers both */}

            {/* Mobile Header (Only visible on small screens) */}
            <div className="w-full flex lg:hidden items-center justify-center gap-2 mb-8 mt-12">
               <img src="/logo-expertise.png" alt="Expertise" className="w-[60%] h-auto object-contain" />
            </div>

            <div className="w-full max-w-md flex-1 flex flex-col justify-center relative">
               <AnimatePresence mode="wait">
                  {/* --- LOGIN VIEW --- */}
                  {activeView === 'login' && (
                     <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                        <h2 className="font-sans font-black uppercase tracking-tighter text-slate-900 text-3xl mb-8">ACESSE SUA CENTRAL DE COMANDO</h2>

                        <form onSubmit={handleLoginSubmit(onLogin)} className="space-y-6">
                           <div className="relative group">
                              <input {...loginForm('email')} id="login_email" placeholder=" " type="email" className="peer w-full rounded-xl border border-slate-200 bg-white px-4 pb-2 pt-6 text-sm font-bold uppercase tracking-wider text-slate-900 focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none transition-all shadow-sm" />
                              <label htmlFor="login_email" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">E-MAIL CORPORATIVO</label>
                              {loginErrors.email && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle /> {loginErrors.email.message}</p>}
                           </div>

                           <div className="relative group">
                              <input {...loginForm('password')} id="login_password" placeholder=" " type="password" className="peer w-full rounded-xl border border-slate-200 bg-white px-4 pb-2 pt-6 text-sm font-bold tracking-wider text-slate-900 focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none transition-all shadow-sm" />
                              <label htmlFor="login_password" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">SENHA DE ACESSO</label>
                              {loginErrors.password && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle /> {loginErrors.password.message}</p>}
                           </div>

                           <motion.button disabled={loginSubmitting} type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden w-full flex items-center justify-center gap-2 rounded-xl bg-[#EA580C] py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg hover:bg-orange-600 transition-colors group disabled:opacity-70 disabled:cursor-not-allowed">
                              <span className="relative z-10 flex items-center gap-2">
                                 {loginSubmitting ? (
                                    <>
                                       <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                                       AUTENTICANDO AMBIENTE SEGURO...
                                    </>
                                 ) : (
                                    <>
                                       ACESSAR PLATAFORMA
                                       <ArrowRight weight="bold" className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                 )}
                              </span>
                              {!loginSubmitting && <motion.div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12" animate={{ x: ['-200%', '200%'] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 2.5 }} />}
                           </motion.button>
                        </form>

                        <div className="mt-8 flex flex-col items-center gap-4">
                           <button onClick={() => setActiveView('forgot')} className="text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-[#EA580C] transition-colors">Esqueceu seus dados de acesso?</button>
                           <button onClick={() => setActiveView('register')} className="text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-[#EA580C] transition-colors">Não tem conta? <span className="text-[#0A2540] underline decoration-[#EA580C] decoration-2 underline-offset-4">Cadastre seu CNPJ</span></button>
                        </div>
                     </motion.div>
                  )}

                  {/* --- REGISTER VIEW --- */}
                  {activeView === 'register' && (
                     <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="my-auto py-8">
                        <h2 className="font-sans font-black uppercase tracking-tighter text-slate-900 text-3xl mb-8">CRIE SUA CONTA DE EMPRESA JOGANDO PARA GANHAR</h2>

                        <form onSubmit={handleRegSubmit(onRegister)} className="space-y-4">
                           <div className="relative group">
                              <input {...regForm('nome')} id="reg_nome" placeholder=" " type="text" className="peer w-full rounded-xl border border-slate-200 bg-white px-4 pb-2 pt-6 text-sm font-bold uppercase tracking-wider text-slate-900 focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none transition-all shadow-sm" />
                              <label htmlFor="reg_nome" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">NOME DO RESPONSÁVEL</label>
                              {regErrors.nome && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle /> {regErrors.nome.message}</p>}
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="relative group">
                                 <input {...regForm('email')} id="reg_email" placeholder=" " type="email" className="peer w-full rounded-xl border border-slate-200 bg-white px-4 pb-2 pt-6 text-sm font-bold uppercase tracking-wider text-slate-900 focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none transition-all shadow-sm" />
                                 <label htmlFor="reg_email" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">E-MAIL CORPORATIVO</label>
                                 {regErrors.email && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle /> {regErrors.email.message}</p>}
                              </div>
                              <div className="relative group">
                                 <input {...regForm('whatsapp')} id="reg_whats" placeholder=" " type="tel" className="peer w-full rounded-xl border border-slate-200 bg-white px-4 pb-2 pt-6 text-sm font-bold uppercase tracking-wider text-slate-900 focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none transition-all shadow-sm" />
                                 <label htmlFor="reg_whats" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">WHATSAPP (COM DDD)</label>
                                 {regErrors.whatsapp && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle /> {regErrors.whatsapp.message}</p>}
                              </div>
                           </div>

                           <div className="relative group">
                              <input {...regForm('cnpj')} id="reg_cnpj" placeholder=" " type="text" maxLength={14} className="peer w-full rounded-xl border border-slate-200 bg-white px-4 pb-2 pt-6 text-sm font-bold uppercase tracking-wider text-slate-900 focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none transition-all pr-10 shadow-sm" />
                              <label htmlFor="reg_cnpj" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">CNPJ DA EMPRESA</label>
                              {isLoadingCnpj && <CircleNotch className="absolute right-4 top-4 h-5 w-5 text-[#EA580C] animate-spin" />}
                              {regErrors.cnpj && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle /> {regErrors.cnpj.message}</p>}
                           </div>

                           {isLoadingCnpj ? (
                              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-center h-[54px]">
                                 <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} className="h-4 bg-slate-300 rounded w-2/3"></motion.div>
                              </div>
                           ) : (
                              <div className="relative">
                                 <input {...regForm('razoesocial')} id="reg_razao" placeholder=" " type="text" readOnly className="peer w-full rounded-xl border border-transparent bg-slate-50 px-4 pb-2 pt-6 text-sm font-black uppercase tracking-wider text-[#0A2540] opacity-90 cursor-not-allowed" />
                                 <label htmlFor="reg_razao" className="absolute left-4 top-1.5 text-[10px] font-bold text-[#0A2540] uppercase tracking-widest pointer-events-none">RAZÃO SOCIAL</label>
                                 {regWatch('razoesocial') && <CheckCircle className="absolute right-4 top-4 h-5 w-5 text-emerald-500" weight="fill" />}
                                 {regErrors.razoesocial && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle /> {regErrors.razoesocial.message}</p>}
                              </div>
                           )}

                           <div className="relative group">
                              <input {...regForm('password')} id="reg_pass" placeholder=" " type="password" className="peer w-full rounded-xl border border-slate-200 bg-white px-4 pb-2 pt-6 text-sm font-bold tracking-wider text-slate-900 focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none transition-all shadow-sm" />
                              <label htmlFor="reg_pass" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">CRIE SUA SENHA (MÍN 6 CARACTERES)</label>
                              {regErrors.password && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle /> {regErrors.password.message}</p>}
                           </div>

                           <motion.button disabled={regSubmitting} type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden w-full flex items-center justify-center gap-2 rounded-xl bg-[#EA580C] py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg hover:bg-orange-600 transition-colors group mt-6 disabled:opacity-70 disabled:cursor-not-allowed">
                              <span className="relative z-10 flex items-center gap-2">
                                 {regSubmitting ? (
                                    <>
                                       <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                                       CRIANDO AMBIENTE...
                                    </>
                                 ) : (
                                    <>
                                       CADASTRAR EMPRESA E ACESSAR
                                       <ArrowRight weight="bold" className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                 )}
                              </span>
                              {!regSubmitting && <motion.div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12" animate={{ x: ['-200%', '200%'] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 2.5 }} />}
                           </motion.button>
                        </form>

                        <div className="mt-6 text-center">
                           <button onClick={() => setActiveView('login')} className="text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-[#EA580C] transition-colors">Já possui credenciais? <span className="text-[#0A2540] underline decoration-[#EA580C] decoration-2 underline-offset-4">Fazer Login</span></button>
                        </div>
                     </motion.div>
                  )}

                  {/* --- FORGOT PASSWORD VIEW --- */}
                  {activeView === 'forgot' && (
                     <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                        <h2 className="font-sans font-black uppercase tracking-tighter text-slate-900 text-3xl mb-4">RECUPERE SEU ACESSO OPERACIONAL</h2>
                        <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">Insira seu e-mail corporativo cadastrado para receber as instruções imediatas de redefinição de credenciais.</p>

                        <form onSubmit={handleForgotSubmit(onForgot)} className="space-y-6">
                           <div className="relative group">
                              <input {...forgotForm('email')} id="forgot_email" placeholder=" " type="email" className="peer w-full rounded-xl border border-slate-200 bg-white px-4 pb-2 pt-6 text-sm font-bold uppercase tracking-wider text-slate-900 focus:border-[#EA580C] focus:ring-1 focus:ring-[#EA580C] outline-none transition-all shadow-sm" />
                              <label htmlFor="forgot_email" className="absolute left-4 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest transition-all peer-placeholder-shown:top-4 peer-placeholder-shown:text-sm peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#EA580C] pointer-events-none">E-MAIL CORPORATIVO</label>
                              {forgotErrors.email && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 flex items-center gap-1"><WarningCircle /> {forgotErrors.email.message}</p>}
                           </div>

                           <motion.button disabled={forgotSubmitting} type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="relative overflow-hidden w-full flex items-center justify-center gap-2 rounded-xl bg-[#EA580C] py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg hover:bg-orange-600 transition-colors group disabled:opacity-70 disabled:cursor-not-allowed">
                              <span className="relative z-10 flex items-center gap-2">
                                 {forgotSubmitting ? (
                                    <>
                                       <CircleNotch className="h-5 w-5 animate-spin" weight="bold" />
                                       ENVIANDO INSTRUÇÕES...
                                    </>
                                 ) : (
                                    <>
                                       [ RECEBER INSTRUÇÕES DE ACESSO ]
                                    </>
                                 )}
                              </span>
                              {!forgotSubmitting && <motion.div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12" animate={{ x: ['-200%', '200%'] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 2.5 }} />}
                           </motion.button>
                        </form>

                        <div className="mt-8 text-center">
                           <button onClick={() => setActiveView('login')} className="text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-[#EA580C] transition-colors">Voltar para Central de Comando</button>
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