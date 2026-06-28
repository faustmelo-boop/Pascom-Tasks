import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Loader2, Check, ArrowLeft, UserPlus, KeyRound, Mail, ChevronRight, AlertTriangle, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { UserRole } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

type AuthView = 'welcome' | 'login' | 'signup' | 'forgot_password';

const COLORS = {
  primary: '#007cba', // Azul
  accent: '#6cc04a',  // Verde
  secondary: '#fdb615', // Amarelo
};

// Beautiful interactive slides designed specifically for the desktop split layout
const loginSlides = [
  {
    category: "PLANEJAMENTO",
    title: "Escalas Inteligentes",
    description: "Distribua equipes de foto, transmissão e coordenação de forma visual, simples e automatizada.",
    card: (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 text-left shadow-lg select-none">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 px-2.5 py-1 rounded-full">Ativo</span>
          <span className="text-[10px] font-bold text-white/70">Domingo - 19:00</span>
        </div>
        <h4 className="text-sm font-black text-white leading-tight mb-3">Missa Solene da Noite</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-[10px] font-bold text-white/80">Transmissão</span>
            <span className="text-[10px] font-black text-white/50">Gabriel Souza</span>
          </div>
          <div className="flex items-center justify-between bg-white/5 rounded-xl p-2.5 border border-white/5">
            <span className="text-[10px] font-bold text-white/80">Fotografia</span>
            <span className="text-[10px] font-black text-white/50">Beatriz Costa</span>
          </div>
        </div>
      </div>
    )
  },
  {
    category: "TALENTOS",
    title: "Dons & Habilidades",
    description: "Mapeie dons de foto, vídeo, som e redação para valorizar e organizar o melhor de cada voluntário na liturgia.",
    card: (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 text-left shadow-lg select-none">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[9px] font-black uppercase bg-[#fdb615]/20 text-[#fdb615] border border-amber-400/20 px-2.5 py-1 rounded-full">Servos</span>
          <span className="text-[10px] font-bold text-white/70">Habilidades Mapeadas</span>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 bg-white/5 rounded-xl p-2.5 border border-white/5">
            <div className="w-6 h-6 rounded bg-[#6cc04a]/20 text-[#6cc04a] flex items-center justify-center text-[10px] font-black">F</div>
            <div className="flex-1 min-w-0">
              <h5 className="text-[10px] font-black text-white leading-none">Fernanda Castro</h5>
              <p className="text-[8px] text-white/40 mt-1 uppercase">Fotografia profissional</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/5 rounded-xl p-2.5 border border-white/5">
            <div className="w-6 h-6 rounded bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px] font-black">T</div>
            <div className="flex-1 min-w-0">
              <h5 className="text-[10px] font-black text-white leading-none">Thiago Neves</h5>
              <p className="text-[8px] text-white/40 mt-1 uppercase">Operação de Streaming</p>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    category: "INTEGRAÇÃO",
    title: "Mural de Avisos",
    description: "Dispare comunicados internos e alinhe diretrizes de forma rápida com notificações instantâneas.",
    card: (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 text-left shadow-lg select-none">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[9px] font-black uppercase bg-white/10 text-white border border-white/10 px-2.5 py-1 rounded-full">Comunicado</span>
          <span className="text-[10px] font-bold text-white/70">Urgente</span>
        </div>
        <h4 className="text-[11px] font-black text-white leading-tight mb-1 truncate">Missa da Quinta-feira Santa</h4>
        <p className="text-[10px] text-white/75 leading-normal line-clamp-2">Caros fotógrafos, favor chegar com 30 minutos de antecedência para definição do circuito interno.</p>
        <div className="mt-3 pt-2 border-t border-white/5 flex items-center gap-1.5">
          <div className="w-4 h-4 bg-white/10 rounded-full" />
          <span className="text-[9px] font-semibold text-white/40">Postado pela Coordenação</span>
        </div>
      </div>
    )
  }
];

export const Login: React.FC = () => {
  const [view, setView] = useState<AuthView>('welcome');
  const [showPassword, setShowPassword] = useState(false);
  
  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Only for signup
  const [confirmPassword, setConfirmPassword] = useState(''); // Only for signup
  const [rememberMe, setRememberMe] = useState(true);
  
  // Feedback States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Custom states for premium interactive Desktop features slideshow
  const [activeSlide, setActiveSlide] = useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 3);
    }, 5500);
    return () => clearInterval(timer);
  }, []);

  const clearFeedback = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const switchView = (newView: AuthView) => {
    clearFeedback();
    setView(newView);
    // Keep email if user typed it, clear passwords
    setPassword('');
    setConfirmPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearFeedback();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' 
        ? 'E-mail ou senha incorretos.' 
        : 'Ocorreu um erro ao tentar entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
        setError("As senhas não coincidem.");
        return;
    }
    if (password.length < 6) {
        setError("A senha deve ter no mínimo 6 caracteres.");
        return;
    }

    setLoading(true);
    clearFeedback();

    try {
        // 1. Create Auth User
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name: name }
            }
        });

        if (authError) throw authError;

        if (authData.user) {
            // 2. Create Public Profile
            // Check if profile exists first to avoid duplicate key errors if logic runs twice
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', authData.user.id)
                .single();

            if (!existingProfile) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        {
                            id: authData.user.id,
                            name: name,
                            email: email, // Optional, depending on schema, but good for redundancy
                            role: 'Pendente', // Novo cadastro entra como Pendente para o Fluxo de Aprovação
                            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=fdb615&color=fff`,
                            skills: [],
                            onboarding_completed: false
                        }
                    ]);
                
                if (profileError) {
                    console.error("Erro ao criar perfil:", profileError);
                    // Don't throw here, user is created, just profile missing. Can be fixed later or via trigger.
                }
            }

            setSuccessMsg("Sua conta foi criada com sucesso! Para garantir a segurança de nossa pastoral e as informações internas, o seu cadastro foi enviado para análise da Coordenação e está AGUARDANDO APROVAÇÃO. Você receberá acesso completo à plataforma assim que seu perfil for liberado!");
            // Optional: switch back to login after delay
            // setTimeout(() => setView('login'), 10000); // Increased delay to allow reading
        }

    } catch (err: any) {
        setError(err.message || "Erro ao criar conta.");
    } finally {
        setLoading(false);
    }
  };

  const handleRecoverPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      clearFeedback();

      try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: window.location.origin, // PWA handles this
          });

          if (error) throw error;

          setSuccessMsg("Se houver uma conta com este e-mail, enviamos um link de recuperação.");
      } catch (err: any) {
          setError(err.message || "Erro ao solicitar recuperação.");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex items-center justify-center font-sans overflow-hidden p-0 lg:p-4">
      
      {/* Container split for desktop, single column for mobile */}
      <div className="w-full max-w-full lg:max-w-6xl min-h-screen lg:min-h-0 lg:h-[750px] bg-white shadow-2xl lg:rounded-[3rem] overflow-hidden relative flex flex-col lg:flex-row transition-all duration-700">
        
        {/* BRANDING SIDEBAR (Desktop) / TOPOGRAPHIC HEADER (Mobile) */}
        <div className={`relative ${view === 'welcome' ? 'h-[30vh] lg:h-full' : 'h-[160px] lg:h-full'} w-full lg:w-[48%] shrink-0 transition-all duration-500 overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-br from-[#007cba] via-[#007cba] to-[#6cc04a]">
            {/* Topographic Lines SVG Overlay */}
            <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
              <g fill="none" stroke="white" strokeWidth="1">
                <circle cx="100" cy="100" r="150" />
                <circle cx="100" cy="100" r="120" />
                <circle cx="100" cy="100" r="90" />
                <circle cx="100" cy="100" r="60" />
                <circle cx="100" cy="100" r="30" />
                
                <circle cx="350" cy="50" r="100" />
                <circle cx="350" cy="50" r="80" />
                <circle cx="350" cy="50" r="60" />
                <circle cx="350" cy="50" r="40" />

                <circle cx="200" cy="300" r="180" />
                <circle cx="200" cy="300" r="150" />
                <circle cx="200" cy="300" r="120" />
                <circle cx="200" cy="300" r="90" />
                <path d="M0,200 Q100,150 200,200 T400,200" />
                <path d="M0,220 Q100,170 200,220 T400,220" />
              </g>
            </svg>
          </div>

          {/* Desktop Branding Content - Interactive Features Carousel */}
          <div className="hidden lg:flex absolute inset-0 flex-col items-center justify-between p-12 text-center text-white">
            {/* Logo/header elements excluded per request to declutter layout */}
            <div className="h-10 w-full self-start" />

            {/* Carousel Core */}
            <div className="flex-1 flex flex-col justify-center items-stretch w-full max-w-sm mt-6">
              {/* Category tag */}
              <div className="flex justify-start mb-3">
                <span className="text-[9px] font-black tracking-[0.25em] text-white bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                  {loginSlides[activeSlide].category}
                </span>
              </div>

              {/* Title & Description with slight fixed height to prevent structural movement */}
              <div className="h-28 text-left">
                <h3 className="text-2xl font-black text-white tracking-tight leading-tight">
                  {loginSlides[activeSlide].title}
                </h3>
                <p className="text-white/80 text-xs font-semibold leading-relaxed mt-2.5">
                  {loginSlides[activeSlide].description}
                </p>
              </div>

              {/* Float Glassmorphic Mockup Container */}
              <div className="relative h-44 mt-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSlide}
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -12 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="absolute inset-0"
                  >
                    {loginSlides[activeSlide].card}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Dynamic Slides Indicators */}
              <div className="flex justify-start gap-2.5 mt-8 select-none">
                {loginSlides.map((_, idx) => (
                  <button
                    key={`indicator-${idx}`}
                    type="button"
                    onClick={() => setActiveSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${activeSlide === idx ? 'w-8 bg-white' : 'w-2 bg-white/30 hover:bg-white/50'}`}
                  />
                ))}
              </div>
            </div>

            {/* Subtle Footer Citation */}
            <div className="text-left w-full self-end text-[10px] font-bold text-white/50 uppercase tracking-widest mt-4">
              © Pastoral da Comunicação
            </div>
          </div>

          {/* Botão Voltar (Apenas em telas secundárias - Mobile) */}
          {view !== 'welcome' && (
            <motion.button 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setView('welcome')}
              className="absolute top-8 left-6 z-20 flex items-center gap-2 text-white/90 font-black text-[10px] uppercase tracking-widest bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 hover:bg-white/20 transition-all lg:hidden"
            >
              <ArrowLeft size={14} /> Voltar
            </motion.button>
          )}

          {/* Wave Transition (Mobile Only) */}
          <div className="absolute bottom-[-2px] left-0 right-0 lg:hidden">
            <svg viewBox="0 0 400 120" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,60 C100,20 300,100 400,60 V120 H0 V60Z" />
            </svg>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 px-6 sm:px-10 lg:px-16 pt-8 pb-12 flex flex-col justify-center bg-white overflow-y-auto hide-scroll relative">
          
          {/* Desktop Navigation Back button */}
          {view !== 'welcome' && (
             <motion.button 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               onClick={() => setView('welcome')}
               className="hidden lg:flex absolute top-10 left-10 items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-[#007cba] transition-all"
             >
               <ArrowLeft size={16} /> Voltar para o início
             </motion.button>
          )}

          {/* MOBILE CONTENT PANEL - PRESERVED EXACTLY */}
          <div className="lg:hidden flex flex-col flex-1 pb-4">
            <AnimatePresence mode="wait">
              {view === 'welcome' && (
                <motion.div 
                  key="welcome-mobile"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex-1 flex flex-col items-center justify-center text-center gap-2 w-full"
                >
                  <div>
                      <motion.img 
                          initial={{ y: -10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          src="https://i.imgur.com/ofoiwCd.png" 
                          alt="Pascom Tasks" 
                          className="h-20 w-auto mb-6 object-contain"
                      />
                  </div>
                  
                  <div className="mt-4 w-full flex flex-col gap-4">
                     <button 
                      onClick={() => setView('login')}
                      className="w-full bg-brand-blue text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-blue/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                     >
                       ACESSAR O TASKS <ArrowRight size={18} />
                     </button>

                     <button 
                      onClick={() => setView('signup')}
                      className="w-full bg-slate-50 text-slate-600 py-5 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-100 hover:bg-white hover:shadow-lg transition-all"
                     >
                       Quero servir com vocês
                     </button>
                  </div>
                </motion.div>
              )}

              {view === 'login' && (
                <motion.div 
                  key="login-mobile"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex-1 flex flex-col gap-8"
                >
                  <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight">Que bom te ver!</h1>
                    <p className="text-slate-400 font-bold text-xs mt-2 uppercase tracking-widest italic">Acesse seu espaço de serviço</p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                      <div className="text-rose-500 text-xs font-bold bg-rose-50 p-3 rounded-xl border border-rose-100 flex items-center gap-2">
                        <AlertTriangle size={14} /> Ops! {error}
                      </div>
                    )}

                    <div className="space-y-1 group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                      <div className="relative border-b-2 border-slate-100 focus-within:border-brand-green transition-all pb-2 flex items-center gap-4">
                        <Mail className="text-slate-300" size={18} />
                        <input 
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Seu email"
                          className="w-full bg-transparent outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 group">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                      <div className="relative border-b-2 border-slate-100 focus-within:border-brand-green transition-all pb-2 flex items-center gap-4">
                        <KeyRound className="text-slate-300" size={18} />
                        <input 
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Sua senha"
                          className="w-full bg-transparent outline-none text-sm font-bold text-slate-700 placeholder:text-slate-300"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-slate-300 hover:text-brand-green transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer group/check">
                        <div 
                          onClick={() => setRememberMe(!rememberMe)}
                          className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-brand-green border-brand-green' : 'bg-slate-50 border-slate-200'}`}
                        >
                          {rememberMe && <Check size={12} strokeWidth={4} className="text-white" />}
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">Lembrar-me</span>
                      </label>
                      <button type="button" onClick={() => switchView('forgot_password')} className="text-[11px] font-black text-brand-green uppercase tracking-tighter">Esqueceu a senha?</button>
                    </div>

                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-brand-blue text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-blue/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="animate-spin" size={18} /> : 'Entrar'}
                    </button>
                  </form>

                  <div className="mt-auto pt-8 text-center text-[11px] font-bold text-slate-400">
                     Não tem conta? <button onClick={() => switchView('signup')} className="text-brand-green hover:underline">Cadastre-se</button>
                  </div>
                </motion.div>
              )}

              {view === 'signup' && (
                <motion.div 
                  key="signup-mobile"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex-1 flex flex-col gap-4"
                >
                  <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Crie seu Perfil</h1>
                    <p className="text-slate-400 font-bold text-[10px] mt-1 uppercase tracking-widest italic">Junte-se à nossa equipe</p>
                  </div>

                  <form onSubmit={handleSignUp} className="space-y-4">
                    {successMsg ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-emerald-50 text-emerald-700 p-6 rounded-[2rem] border border-emerald-100 text-xs font-bold leading-relaxed flex flex-col items-center text-center gap-4"
                      >
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                          <Mail size={32} />
                        </div>
                        <p className="px-2">{successMsg}</p>
                        <button 
                          type="button" 
                          onClick={() => switchView('login')} 
                          className="bg-emerald-600 text-white px-8 py-3 rounded-xl uppercase tracking-widest text-[10px] font-black shadow-lg shadow-emerald-250"
                        >
                          Ir para o Login
                        </button>
                      </motion.div>
                    ) : (
                      <>
                        {error && (
                          <div className="text-rose-500 text-xs font-bold bg-rose-50 p-3 rounded-xl border border-rose-100 flex items-center gap-2">
                            <AlertTriangle size={14} /> {error}
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                          <input 
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Como devemos te chamar?"
                            className="w-full bg-slate-50 border border-slate-100 px-6 py-3.5 rounded-2xl outline-none focus:ring-4 focus:ring-brand-blue/5 focus:border-brand-blue transition-all text-sm font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                          <input 
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Seu email"
                            className="w-full bg-slate-50 border border-slate-100 px-6 py-3.5 rounded-2xl outline-none focus:ring-4 focus:ring-brand-blue/5 focus:border-brand-blue transition-all text-sm font-bold"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                            <input 
                              type="password"
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Mín 6 letras"
                              className="w-full bg-slate-50 border border-slate-100 px-6 py-3.5 rounded-2xl outline-none focus:ring-4 focus:ring-brand-blue/5 focus:border-brand-blue transition-all text-sm font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar</label>
                            <input 
                              type="password"
                              required
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Repetir"
                              className="w-full bg-slate-50 border border-slate-100 px-6 py-3.5 rounded-2xl outline-none focus:ring-4 focus:ring-brand-blue/5 focus:border-brand-blue transition-all text-sm font-bold"
                            />
                          </div>
                        </div>

                        <button 
                          type="submit"
                          disabled={loading}
                          className="w-full bg-brand-green text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-green/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                          {loading ? <Loader2 className="animate-spin" size={18} /> : 'Criar Perfil'}
                        </button>
                      </>
                    )}
                  </form>

                  <div className="mt-auto pt-8 text-center text-[11px] font-bold text-slate-400">
                     Já tem uma conta? <button onClick={() => switchView('login')} className="text-brand-blue hover:underline">Entrar agora</button>
                  </div>
                </motion.div>
              )}

              {view === 'forgot_password' && (
                <motion.div 
                  key="forgot-mobile"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="flex-1 flex flex-col gap-8"
                >
                  <div>
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight">Recuperar</h1>
                    <div className="w-12 h-1.5 bg-[#6cc04a] mt-2 rounded-full"></div>
                  </div>

                  <form onSubmit={handleRecoverPassword} className="space-y-6 flex-1 flex flex-col">
                    {successMsg ? (
                       <div className="bg-emerald-50 text-emerald-600 p-6 rounded-[2rem] border border-emerald-100 text-xs font-bold leading-relaxed flex flex-col items-center text-center gap-4">
                          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                            <Mail size={32} />
                          </div>
                          <p>{successMsg}</p>
                          <button type="button" onClick={() => switchView('login')} className="bg-emerald-600 text-white px-6 py-3 rounded-xl uppercase tracking-widest text-[10px] font-black">Voltar ao Login</button>
                       </div>
                    ) : (
                      <>
                        <p className="text-slate-500 font-medium text-sm leading-relaxed">Insira seu e-mail abaixo. Enviaremos um link seguro para você redefinir sua senha.</p>
                        
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Cadastrado</label>
                          <input 
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl outline-none focus:ring-4 focus:ring-brand-blue/5 focus:border-brand-blue transition-all text-sm font-bold"
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={loading}
                          className="w-full bg-slate-800 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
                        >
                          {loading ? <Loader2 className="animate-spin" size={18} /> : 'Mandar Link'}
                        </button>

                        <button type="button" onClick={() => switchView('login')} className="mt-8 text-slate-400 hover:text-slate-600 transition-colors text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3">
                          <ArrowLeft size={16} /> Lembrei a senha
                        </button>
                      </>
                    )}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* DESKTOP CONTENT PANEL - NEW PREMIUM EXPERIENCE */}
          <div className="hidden lg:flex flex-col justify-center relative w-full h-full max-w-lg mx-auto animate-fade-in">
            <AnimatePresence mode="wait">
              {view === 'welcome' && (
                <motion.div 
                  key="welcome-desktop"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="space-y-8 select-none"
                >
                  <div className="flex flex-col items-center text-center">
                    <img 
                      src="https://i.imgur.com/ofoiwCd.png" 
                      alt="Pascom Tasks" 
                      className="h-32 w-auto object-contain"
                    />
                  </div>

                  <div className="space-y-4 pt-4">
                    <button
                      onClick={() => switchView('login')}
                      className="w-full bg-[#007cba] hover:bg-[#006ca3] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-blue/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3.5 cursor-pointer"
                    >
                      Acessar o Tasks <ArrowRight size={16} />
                    </button>

                    <button
                      onClick={() => switchView('signup')}
                      className="w-full bg-slate-50 text-slate-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-150 hover:bg-white hover:border-slate-300 hover:shadow-lg transition-all flex items-center justify-center cursor-pointer"
                    >
                      CADASTRE-SE
                    </button>
                  </div>
                </motion.div>
              )}

              {view === 'login' && (
                <motion.div 
                  key="login-desktop"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">Que bom te ver de volta!</h1>
                    <p className="text-slate-400 font-bold text-xs mt-1.5 uppercase tracking-wider italic">Acesse seu ambiente de serviço</p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-5">
                    {error && (
                      <div className="text-rose-500 text-xs font-bold bg-rose-50/50 p-4 rounded-xl border border-rose-100 flex items-center gap-2.5">
                        <AlertTriangle size={16} className="shrink-0" /> {error}
                      </div>
                    )}

                    {/* Integrated email input bounding box */}
                    <div className="relative bg-slate-50 border border-slate-150 focus-within:border-[#007cba]/30 focus-within:ring-4 focus-within:ring-[#007cba]/5 rounded-2xl p-4 transition-all flex items-center gap-3">
                      <Mail className="text-slate-400 shrink-0" size={18} />
                      <div className="flex-1 text-left">
                        <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Endereço de E-mail</label>
                        <input 
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="exemplo@igreja.com"
                          className="w-full bg-transparent outline-none text-xs font-bold text-slate-800 placeholder:text-slate-350 mt-0.5"
                        />
                      </div>
                    </div>

                    {/* Integrated password input bounding box */}
                    <div className="relative bg-slate-50 border border-slate-150 focus-within:border-[#6cc04a]/30 focus-within:ring-4 focus-within:ring-[#6cc04a]/5 rounded-2xl p-4 transition-all flex items-center gap-3">
                      <KeyRound className="text-slate-400 shrink-0" size={18} />
                      <div className="flex-1 text-left">
                        <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Senha de Acesso</label>
                        <input 
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Digite sua senha"
                          className="w-full bg-transparent outline-none text-xs font-bold text-slate-800 placeholder:text-slate-350 mt-0.5"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-brand-green transition-colors p-1"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {/* Options row */}
                    <div className="flex items-center justify-between pt-1 select-none">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={rememberMe}
                          onChange={() => setRememberMe(!rememberMe)}
                          className="rounded text-[#6cc04a] focus:ring-brand-green w-4 h-4 border-slate-300"
                        />
                        <span className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors">Lembrar de mim</span>
                      </label>
                      <button 
                        type="button" 
                        onClick={() => switchView('forgot_password')} 
                        className="text-xs font-bold text-[#6cc04a] hover:text-[#6cc04a]/80 uppercase tracking-tight transition-colors"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>

                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#007cba] hover:bg-[#007cba]/95 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-[#007cba]/15 hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-2.5 mt-2 cursor-pointer"
                    >
                      {loading ? <Loader2 className="animate-spin" size={16} /> : 'Acessar Conta'}
                    </button>
                  </form>

                  <div className="text-center text-xs font-bold text-slate-400 pt-4 select-none">
                    Ainda não serve conosco?{' '}
                    <button onClick={() => switchView('signup')} className="text-[#6cc04a] hover:underline font-black ms-1 cursor-pointer">
                      Cadastre-se para servir
                    </button>
                  </div>
                </motion.div>
              )}

              {view === 'signup' && (
                <motion.div 
                  key="signup-desktop"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight font-sans">Crie seu Perfil</h1>
                    <p className="text-slate-400 font-bold text-xs mt-1.5 uppercase tracking-wider italic">Junte-se à nossa equipe da Pascom</p>
                  </div>

                  <form onSubmit={handleSignUp} className="space-y-4">
                    {successMsg ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-emerald-50/50 text-emerald-700 p-6 rounded-[2rem] border border-emerald-100 text-xs font-bold leading-relaxed flex flex-col items-center text-center gap-4"
                      >
                        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                          <Mail size={24} />
                        </div>
                        <p className="px-2 leading-relaxed text-slate-650">{successMsg}</p>
                        <button 
                          type="button" 
                          onClick={() => switchView('login')} 
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-2xl uppercase tracking-widest text-[10px] font-black shadow-lg shadow-emerald-250 transition-all active:scale-95 cursor-pointer"
                        >
                          Ir para o Login
                        </button>
                      </motion.div>
                    ) : (
                      <>
                        {error && (
                          <div className="text-rose-500 text-xs font-bold bg-rose-50/50 p-3.5 rounded-xl border border-rose-100 flex items-center gap-2">
                            <AlertTriangle size={15} className="shrink-0" /> {error}
                          </div>
                        )}

                        {/* Name bounding box input */}
                        <div className="relative bg-slate-50 border border-slate-150 focus-within:border-[#007cba]/30 focus-within:ring-4 focus-within:ring-[#007cba]/5 rounded-2xl p-3.5 transition-all flex items-center gap-3">
                          <div className="flex-1 text-left">
                            <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Nome Completo</label>
                            <input 
                              type="text"
                              required
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              placeholder="Como devemos te chamar?"
                              className="w-full bg-transparent outline-none text-xs font-bold text-slate-800 placeholder:text-slate-300 mt-0.5"
                            />
                          </div>
                        </div>

                        {/* Email bounding box input */}
                        <div className="relative bg-slate-50 border border-slate-150 focus-within:border-[#007cba]/30 focus-within:ring-4 focus-within:ring-[#007cba]/5 rounded-2xl p-3.5 transition-all flex items-center gap-3">
                          <div className="flex-1 text-left">
                            <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider font-sans">E-mail para Contato</label>
                            <input 
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="seu@comunidade.com"
                              className="w-full bg-transparent outline-none text-xs font-bold text-slate-800 placeholder:text-slate-300 mt-0.5"
                            />
                          </div>
                        </div>

                        {/* Double password grid */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="relative bg-slate-50 border border-slate-150 focus-within:border-[#007cba]/30 focus-within:ring-4 focus-within:ring-[#007cba]/5 rounded-2xl p-3.5 transition-all flex items-center gap-3 text-left">
                            <div className="flex-1">
                              <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Senha</label>
                              <input 
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mín. 6 carecteres"
                                className="w-full bg-transparent outline-none text-xs font-bold text-slate-800 placeholder:text-slate-300 mt-0.5"
                              />
                            </div>
                          </div>

                          <div className="relative bg-slate-50 border border-slate-150 focus-within:border-[#007cba]/30 focus-within:ring-4 focus-within:ring-[#007cba]/5 rounded-2xl p-3.5 transition-all flex items-center gap-3 text-left">
                            <div className="flex-1">
                              <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Confirmar</label>
                              <input 
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repita a senha"
                                className="w-full bg-transparent outline-none text-xs font-bold text-slate-800 placeholder:text-slate-300 mt-0.5"
                              />
                            </div>
                          </div>
                        </div>

                        <button 
                          type="submit"
                          disabled={loading}
                          className="w-full bg-[#6cc04a] hover:bg-[#5cb13d] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-green/15 hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
                        >
                          {loading ? <Loader2 className="animate-spin" size={16} /> : 'Finalizar Cadastro'}
                        </button>
                      </>
                    )}
                  </form>

                  <div className="text-center text-xs font-bold text-slate-400 pt-2 select-none">
                    Já tem conta registrada?{' '}
                    <button onClick={() => switchView('login')} className="text-[#007cba] hover:underline font-black ms-1 cursor-pointer">
                      Acessar Conta
                    </button>
                  </div>
                </motion.div>
              )}

              {view === 'forgot_password' && (
                <motion.div 
                  key="forgot-desktop"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="space-y-6"
                >
                  <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">Recuperar Senha</h1>
                    <div className="w-12 h-1.5 bg-[#6cc04a] mt-2 rounded-full"></div>
                  </div>

                  <form onSubmit={handleRecoverPassword} className="space-y-5">
                    {successMsg ? (
                      <div className="bg-emerald-50/50 text-emerald-600 p-6 rounded-[2rem] border border-[#f8fafc] text-xs font-bold leading-relaxed flex flex-col items-center text-center gap-4">
                        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                          <Mail size={24} />
                        </div>
                        <p className="text-slate-650 leading-relaxed">{successMsg}</p>
                        <button 
                          type="button" 
                          onClick={() => switchView('login')} 
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl uppercase tracking-widest text-[10px] font-black transition-all shadow shadow-emerald-250 cursor-pointer"
                        >
                          Voltar ao Login
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-slate-500 font-medium text-sm leading-relaxed text-left">
                          Insira seu e-mail cadastrado baixo. Nós lhe enviaremos um link de redefinição seguro para restabelecer o seu acesso em instantes.
                        </p>
                        
                        {/* Integrated e-mail recovery input */}
                        <div className="relative bg-slate-50 border border-slate-150 focus-within:border-[#007cba]/30 focus-within:ring-4 focus-within:ring-[#007cba]/5 rounded-2xl p-4 transition-all flex items-center gap-3">
                          <Mail className="text-slate-400 shrink-0" size={18} />
                          <div className="flex-1 text-left">
                            <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">E-mail Cadastrado</label>
                            <input 
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="exemplo@igreja.com"
                              className="w-full bg-transparent outline-none text-xs font-bold text-slate-800 placeholder:text-slate-300 mt-0.5"
                            />
                          </div>
                        </div>

                        <button 
                          type="submit"
                          disabled={loading}
                          className="w-full bg-slate-800 hover:bg-slate-900 text-white py-4.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/10 hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
                        >
                          {loading ? <Loader2 className="animate-spin" size={16} /> : 'Mandar Link de Redefinição'}
                        </button>

                        <button 
                          type="button" 
                          onClick={() => switchView('login')} 
                          className="mt-6 text-slate-400 hover:text-slate-600 transition-colors text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 select-none w-full text-center cursor-pointer"
                        >
                          <ArrowLeft size={14} /> Lembra da sua senha? Retornar ao Login
                        </button>
                      </>
                    )}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>
    </div>
  );
};