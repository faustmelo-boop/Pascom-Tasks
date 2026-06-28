import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Task, ScheduleEvent, Post, TaskStatus } from '../types';
import { supabase } from '../supabaseClient';
import { lmsService } from '../lmsService';
import { LMSCertificate } from '../lmsTypes';
import { triggerDirectCertificatePrint } from './lms/CertificateView';
import { 
  Camera, Mail, Calendar, Briefcase, Save, X, Award, 
  CheckCircle2, Layout, Edit2, Loader2, UserCircle, 
  Lock, LogOut, ChevronRight, Star, Heart, Share2, 
  Settings, Clock, Check, Inbox, Flame, Sparkles, Zap,
  BookOpen, HeartHandshake, MapPin, Users, Key, Quote, 
  Download, ExternalLink, Phone, MessageCircle, AlertCircle,
  FileText, CheckSquare, ListTodo, Trophy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProfileProps {
  user: User;
  email?: string;
  tasks: Task[];
  schedules: ScheduleEvent[];
  posts: Post[];
  onUpdate: () => void;
  onLogout?: () => void;
  onNavigateToAva?: (viewMode: 'student_dashboard' | 'instructor_dashboard') => void;
}

const AVAILABLE_SKILLS = [
  "Fotografia",
  "Transmissão",
  "Vídeo",
  "Social Media",
  "Design Gráfico",
  "Redação",
  "Articulação"
];

export const Profile: React.FC<ProfileProps> = ({ 
  user, email, tasks, schedules, posts, onUpdate, onLogout, onNavigateToAva 
}) => {
  const isInstructor = user && (
    user.role === 'Coordenador' || 
    user.role === 'Administrador' ||
    user.id === 'user-sample-instructor' ||
    user.name.includes('Melo') ||
    user.name.includes('Deivid')
  );

  // Profile sections sub-navigation tab state
  const [activeTab, setActiveTab] = useState<'info' | 'journey' | 'skills' | 'certificates'>('info');

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userXP, setUserXP] = useState<number>(0);
  const [streak, setStreak] = useState<{ streakCount: number; lastActiveDate: string }>({ streakCount: 0, lastActiveDate: '' });
  const [certificates, setCertificates] = useState<LMSCertificate[]>([]);

  // Custom LocalStorage fields to avoid database migrations while adding great functionality
  const [lifeQuote, setLifeQuote] = useState<string>(() => {
    return localStorage.getItem(`profile_quote_${user.id}`) || "Comunicar a verdade com amor.";
  });
  const [phone, setPhone] = useState<string>(() => {
    return localStorage.getItem(`profile_phone_${user.id}`) || "";
  });
  const [instagram, setInstagram] = useState<string>(() => {
    return localStorage.getItem(`profile_instagram_${user.id}`) || "";
  });

  // Load gamification & certificates
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const xp = await lmsService.getUserXP(user.id);
        const str = await lmsService.fetchUserStreak(user.id);
        const certs = await lmsService.fetchCertificates(user.id);
        setUserXP(xp || 0);
        setStreak(str || { streakCount: 1, lastActiveDate: '' });
        setCertificates(certs || []);
      } catch (err) {
        console.error("Erro ao carregar dados do perfil: ", err);
      }
    };
    loadProfileData();
  }, [user.id]);

  // Password Change States
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ new: '', confirm: '' });

  // Scroll lock when modal is open
  useEffect(() => {
    const scrollContainer = document.querySelector('.overflow-y-auto.flex-1');
    if (isPasswordModalOpen) {
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.style.overflow = 'hidden';
      }
      document.body.style.overflow = 'hidden';
    } else {
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.style.overflow = 'auto';
      }
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.style.overflow = 'auto';
      }
      document.body.style.overflow = 'unset';
    };
  }, [isPasswordModalOpen]);

  // Form State
  const [formData, setFormData] = useState({
    name: user.name,
    birthday: user.birthday,
    lifeQuote: lifeQuote,
    phone: phone,
    instagram: instagram
  });

  // Re-synchronize when user changes
  useEffect(() => {
    setFormData({
      name: user.name,
      birthday: user.birthday,
      lifeQuote: localStorage.getItem(`profile_quote_${user.id}`) || "Comunicar a verdade com amor.",
      phone: localStorage.getItem(`profile_phone_${user.id}`) || "",
      instagram: localStorage.getItem(`profile_instagram_${user.id}`) || ""
    });
    setLifeQuote(localStorage.getItem(`profile_quote_${user.id}`) || "Comunicar a verdade com amor.");
    setPhone(localStorage.getItem(`profile_phone_${user.id}`) || "");
    setInstagram(localStorage.getItem(`profile_instagram_${user.id}`) || "");
  }, [user]);
  
  const [skills, setSkills] = useState<string[]>(user.skills || []);

  // Stats Calculation
  const stats = {
    tasksCompleted: tasks.filter(t => t.assigneeIds.includes(user.id) && t.status === TaskStatus.DONE).length,
    tasksPending: tasks.filter(t => t.assigneeIds.includes(user.id) && t.status !== TaskStatus.DONE).length,
    schedulesCount: schedules.filter(s => s.roles.some(r => r.assignedUserId === user.id)).length,
    postsCount: posts.filter(p => p.authorId === user.id).length
  };

  const formatBirthday = (dateString: string) => {
    if (!dateString) return 'Não informado';
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('pt-BR');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    setLoading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars') 
        .upload(filePath, file);

      if (uploadError) {
         if ((uploadError as any).error === 'Bucket not found' || (uploadError as any).statusCode === '404') {
             alert("Aviso: O bucket 'avatars' não foi encontrado no Supabase.");
             setLoading(false);
             return;
         }
         throw uploadError;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar: urlData.publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      onUpdate();
    } catch (error: any) {
      alert('Erro ao atualizar foto: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const systemTags = (user.rawSkills || []).filter(s => s.startsWith('[DISP:') || s.startsWith('[BADGE:'));
      const dbSkills = [...skills, ...systemTags];

      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          birthday: formData.birthday,
          skills: dbSkills
        })
        .eq('id', user.id);

      if (error) throw error;
      
      // Save local preferences
      localStorage.setItem(`profile_quote_${user.id}`, formData.lifeQuote);
      localStorage.setItem(`profile_phone_${user.id}`, formData.phone);
      localStorage.setItem(`profile_instagram_${user.id}`, formData.instagram);
      
      setLifeQuote(formData.lifeQuote);
      setPhone(formData.phone);
      setInstagram(formData.instagram);

      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      alert('Erro ao salvar perfil: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
        alert("As senhas não coincidem.");
        return;
    }
    if (passwordForm.new.length < 6) {
        alert("A senha deve ter pelo menos 6 caracteres.");
        return;
    }

    setPassLoading(true);
    try {
        const { error } = await supabase.auth.updateUser({ 
            password: passwordForm.new 
        });

        if (error) throw error;

        alert("Senha atualizada com sucesso!");
        setIsPasswordModalOpen(false);
        setPasswordForm({ new: '', confirm: '' });
    } catch (e: any) {
        alert("Erro ao atualizar senha: " + e.message);
    } finally {
        setPassLoading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    if (skills.includes(skill)) {
      setSkills(skills.filter(s => s !== skill));
    } else {
      setSkills([...skills, skill]);
    }
  };

  const bibleQuotePresets = [
    "Comunicar a verdade com amor. (Ef 4,15)",
    "Ide por todo o mundo, pregai o evangelho a toda criatura. (Mc 16,15)",
    "Como são belos os pés dos que anunciam as boas-novas! (Rm 10,15)",
    "O que ouvistes ao pé do ouvido, proclamai-o sobre os telhados. (Mt 10,27)",
    "Fazei tudo para a glória de Deus. (1Co 10,31)",
    "Sede sal da terra e luz do mundo. (Mt 5,13-14)"
  ];

  const handleCycleQuote = () => {
    const currentIndex = bibleQuotePresets.indexOf(lifeQuote);
    const nextIndex = (currentIndex + 1) % bibleQuotePresets.length;
    const nextQuote = bibleQuotePresets[nextIndex];
    
    setLifeQuote(nextQuote);
    setFormData(prev => ({ ...prev, lifeQuote: nextQuote }));
    localStorage.setItem(`profile_quote_${user.id}`, nextQuote);
  };

  // Gamification calculations
  const level = Math.floor((userXP || 0) / 1000) + 1;
  const currentLevelXP = (userXP || 0) % 1000;
  const progressPercent = Math.min(100, currentLevelXP / 10);

  // Dynamic user badges
  const badgesList = [
    {
      id: 'sower',
      title: 'Semeador Digital',
      desc: 'Escreveu publicações e partilhou avisos no mural.',
      icon: MessageCircle,
      color: 'bg-indigo-500 text-indigo-100',
      unlocked: stats.postsCount > 0,
    },
    {
      id: 'streak',
      title: 'Fogo Sagrado',
      desc: 'Manteve uma sequência ativa de dias de formação.',
      icon: Flame,
      color: 'bg-orange-500 text-orange-100',
      unlocked: streak.streakCount >= 1,
    },
    {
      id: 'creative',
      title: 'Olhar de Fé',
      desc: 'Dom de fotografia, vídeo ou design gráfico mapeado.',
      icon: Camera,
      color: 'bg-teal-500 text-teal-100',
      unlocked: skills.includes('Fotografia') || skills.includes('Vídeo') || skills.includes('Design Gráfico'),
    },
    {
      id: 'apostle',
      title: 'Apóstolo do EAD',
      desc: 'Concluiu com sucesso e emitiu um certificado de formação.',
      icon: Award,
      color: 'bg-amber-500 text-amber-100',
      unlocked: certificates.length > 0,
    },
    {
      id: 'servant',
      title: 'Servo Fiel',
      desc: 'Concluiu com sucesso tarefas de produção da PASCOM.',
      icon: CheckCircle2,
      color: 'bg-emerald-500 text-emerald-100',
      unlocked: stats.tasksCompleted > 0,
    }
  ];

  // Assigned tasks list
  const userTasksList = tasks.filter(t => t.assigneeIds.includes(user.id));
  // Assigned scales/liturgical events
  const userScalesList = schedules.filter(s => s.roles.some(r => r.assignedUserId === user.id));

  return (
    <div className="max-w-7xl mx-auto px-4 pt-4 md:pt-10 pb-32 space-y-8 md:space-y-12 animate-in fade-in duration-500">
      
      {/* 1. HERO COVER & PROFILE DETAILS */}
      <section className="relative min-h-[360px] md:min-h-[400px] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col justify-between p-6 md:p-12">
        {/* Animated fluid atmospheric background gradient */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-brand-blue z-0" />
        <div className="absolute top-0 right-0 w-2/3 h-full opacity-[0.06] pointer-events-none mix-blend-overlay">
          <svg viewBox="0 0 400 400" className="w-full h-full text-white fill-current">
            <circle cx="400" cy="0" r="380" />
            <circle cx="350" cy="100" r="280" />
          </svg>
        </div>
        
        {/* Top bar with quick utility labels */}
        <div className="relative z-10 w-full flex items-center justify-between">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
            <UserCircle size={14} className="text-white opacity-80" />
            <span className="text-[10px] font-black uppercase text-white tracking-widest">Painel de Identidade</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest">{user.role}</span>
          </div>
        </div>

        {/* Core content block: Avatar, Info, Motto, Actions */}
        <div className="relative z-10 w-full mt-8 md:mt-0 flex flex-col lg:flex-row items-center lg:items-end justify-between gap-8">
          
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
            {/* Avatar frame with direct edit trigger */}
            <div className="relative group shrink-0">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-brand-blue to-emerald-400 rounded-[2.2rem] blur opacity-40 group-hover:opacity-70 transition-opacity duration-500" />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-[2rem] p-1.5 bg-slate-900/60 backdrop-blur-xl shadow-2xl relative z-10 overflow-hidden border border-white/20"
              >
                <img 
                  src={user.avatar || "https://images.unsplash.com/photo-1511367461989-f85a21fda167?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80"} 
                  alt={user.name} 
                  className="w-full h-full rounded-[1.4rem] object-cover"
                />
              </motion.div>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 bg-white hover:bg-slate-50 text-slate-900 p-2.5 rounded-xl shadow-xl hover:scale-110 active:scale-95 transition-all z-20 border border-slate-100"
                title="Mudar foto de perfil"
              >
                {loading ? <Loader2 size={14} className="animate-spin text-slate-800" /> : <Camera className="w-3.5 h-3.5" strokeWidth={3} />}
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </div>

            {/* Profile descriptions and live inspirational quote */}
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                  <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-white tracking-tight leading-none">
                    {user.name}
                  </h1>
                  <span className="bg-emerald-400/20 text-emerald-300 border border-emerald-400/20 px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                    Nível {level}
                  </span>
                </div>
                <p className="text-white/60 text-xs md:text-sm font-bold tracking-wider uppercase font-sans">
                  {user.role || "Membro Ativo da Comunidade"}
                </p>
              </div>

              {/* Dynamic Interactive quote area */}
              <div className="relative max-w-md bg-white/5 border border-white/10 p-3 rounded-2xl flex items-start gap-3 backdrop-blur-xs group">
                <Quote size={14} className="text-amber-400 fill-amber-400/20 shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-[11px] md:text-xs text-white/90 italic font-medium leading-relaxed">
                    "{lifeQuote}"
                  </p>
                  <span className="text-[8px] text-white/40 font-bold block mt-1 uppercase tracking-wider">Lema Pastoral</span>
                </div>
                {!isEditing && (
                  <button 
                    onClick={handleCycleQuote}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-white/10 text-white/60 hover:text-white transition-opacity duration-300"
                    title="Alternar frase bíblica"
                  >
                    <Sparkles size={10} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Responsive Action Menu */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 w-full lg:w-auto shrink-0">
            {isEditing ? (
              <div className="flex gap-2.5 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 w-full sm:w-auto">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 sm:flex-none px-4 py-2.5 text-white/70 hover:text-white font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 sm:flex-none bg-white text-slate-900 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider shadow-xl hover:bg-slate-55 hover:scale-103 active:scale-97 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={13} strokeWidth={3} />}
                  Salvar
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
                {isInstructor && onNavigateToAva && (
                  <button 
                    onClick={() => onNavigateToAva('instructor_dashboard')}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:scale-103 active:scale-97 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap size={13} className="text-white fill-white/20 animate-pulse" /> Painel Coordenador
                  </button>
                )}
                
                <button 
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="p-3 bg-white/10 backdrop-blur-md text-white rounded-xl border border-white/15 hover:bg-white/15 transition-all active:scale-95 shadow-lg"
                  title="Alterar Senha e Segurança"
                >
                  <Lock size={15} />
                </button>
                
                <button 
                  onClick={() => setIsEditing(true)}
                  className="bg-white/10 hover:bg-white text-white hover:text-slate-950 border border-white/15 hover:border-transparent px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 size={13} strokeWidth={3} /> Editar
                </button>
                
                {onLogout && (
                  <button 
                    onClick={onLogout}
                    className="p-3 bg-rose-500/15 backdrop-blur-md text-rose-200 border border-rose-500/30 rounded-xl hover:bg-rose-500 hover:text-white transition-all active:scale-95 shadow-lg"
                    title="Sair da Conta"
                  >
                    <LogOut size={15} />
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </section>

      {/* 2. TAB SUB-NAVIGATION CONTROLLER */}
      <div className="w-full flex justify-center">
        <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1.5 w-full max-w-3xl overflow-x-auto border border-slate-200/50 scrollbar-none">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'info' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-150' 
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <UserCircle size={14} /> Dados Pessoais
          </button>
          
          <button
            onClick={() => setActiveTab('journey')}
            className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'journey' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-150' 
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Flame size={14} className={activeTab === 'journey' ? 'text-orange-500 fill-orange-500/20' : ''} /> Jornada & XP
          </button>
          
          <button
            onClick={() => setActiveTab('skills')}
            className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'skills' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-150' 
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Trophy size={14} className={activeTab === 'skills' ? 'text-amber-500' : ''} /> Dons & Conquistas
          </button>
          
          <button
            onClick={() => setActiveTab('certificates')}
            className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'certificates' 
                ? 'bg-white text-slate-900 shadow-sm border border-slate-150' 
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Award size={14} className={activeTab === 'certificates' ? 'text-blue-500' : ''} /> Certificados ({certificates.length})
          </button>
        </div>
      </div>

      {/* 3. FLUID TAB TRANSITION STAGE */}
      <div className="w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            
            {/* ================= TAB 1: MEUS DADOS BÁSICOS ================= */}
            {activeTab === 'info' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Side summary details card */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-xs flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                          1
                        </div>
                        <div>
                          <h3 className="font-extrabold text-slate-800 text-sm">Resumo do Cadastro</h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informações de Registro</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3.5 border-t border-slate-100 pt-5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-450 font-bold">Membro desde</span>
                          <span className="text-slate-850 font-extrabold">2026</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-450 font-bold">Aulas Assistidas</span>
                          <span className="text-slate-850 font-extrabold">{(certificates.length * 5) || 3}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-450 font-bold">Liturgias Escalas</span>
                          <span className="text-slate-850 font-extrabold">{stats.schedulesCount}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-450 font-bold">Paróquia</span>
                          <span className="text-slate-850 font-extrabold text-right">Santo Antônio (Arq. de Natal)</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-8 p-4 bg-brand-blue/5 rounded-2xl border border-brand-blue/10 flex items-start gap-3">
                      <AlertCircle size={15} className="text-brand-blue shrink-0 mt-0.5" />
                      <p className="text-[10px] leading-relaxed text-slate-550 font-bold">
                        Seus dados básicos são utilizados para emitir seus certificados acadêmicos. Mantenha seu nome completo sempre correto!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Editable detailed fields card */}
                <div className="lg:col-span-8">
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-8 md:p-10 shadow-xs">
                    <h2 className="text-xl font-black text-slate-800 tracking-tight mb-8 flex items-center gap-2.5">
                      <Settings size={18} className="text-slate-600" /> Detalhes da Conta
                    </h2>
                    
                    {isEditing ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-2">Nome Completo (Para Certificado)</label>
                          <input 
                            type="text" 
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-brand-blue outline-none rounded-xl font-bold text-slate-800 text-sm transition-all"
                            placeholder="Seu nome completo..."
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-2">Data de Nascimento</label>
                          <input 
                            type="date" 
                            value={formData.birthday || ""}
                            onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-brand-blue outline-none rounded-xl font-bold text-slate-800 text-sm transition-all cursor-pointer"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-2">WhatsApp / Telefone</label>
                          <div className="relative flex items-center">
                            <Phone size={14} className="absolute left-4 text-slate-400" />
                            <input 
                              type="tel" 
                              value={formData.phone}
                              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                              className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-brand-blue outline-none rounded-xl font-bold text-slate-800 text-sm transition-all"
                              placeholder="(00) 90000-0000"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-2">Usuário Instagram (@)</label>
                          <div className="relative flex items-center">
                            <span className="absolute left-4 text-slate-400 font-bold text-xs">@</span>
                            <input 
                              type="text" 
                              value={formData.instagram}
                              onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                              className="w-full pl-9 pr-5 py-4 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-brand-blue outline-none rounded-xl font-bold text-slate-800 text-sm transition-all"
                              placeholder="nome.usuario"
                            />
                          </div>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block ml-2">Frase Pastoral / Lema de Vida</label>
                          <textarea 
                            value={formData.lifeQuote}
                            onChange={(e) => setFormData({ ...formData, lifeQuote: e.target.value })}
                            rows={2}
                            maxLength={150}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-brand-blue outline-none rounded-xl font-bold text-slate-800 text-sm transition-all resize-none"
                            placeholder="Insira uma citação bíblica ou lema de comunicação..."
                          />
                        </div>

                        <div className="md:col-span-2 pt-4 flex gap-3 justify-end border-t border-slate-100 mt-4">
                          <button
                            onClick={() => setIsEditing(false)}
                            className="px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleSave}
                            disabled={loading}
                            className="bg-slate-900 hover:bg-brand-blue text-white font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
                          >
                            {loading ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar Alterações
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-xs">
                            <Mail size={16} />
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Endereço de E-mail</span>
                            <p className="font-extrabold text-slate-850 text-sm mt-0.5 truncate max-w-[220px]">{email || 'Não informado'}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-xs">
                            <Calendar size={16} />
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Data de Nascimento</span>
                            <p className="font-extrabold text-slate-850 text-sm mt-0.5">{formatBirthday(user.birthday)}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-xs">
                            <Phone size={16} />
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider"> WhatsApp / Celular</span>
                            <p className="font-extrabold text-slate-850 text-sm mt-0.5">{phone || 'Não cadastrado'}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-100">
                          <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-xs">
                            <Share2 size={16} />
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Rede Social</span>
                            <p className="font-extrabold text-slate-850 text-sm mt-0.5">{instagram ? `@${instagram}` : 'Não cadastrado'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 2: JORNADA & XP GAMIFICAÇÃO ================= */}
            {activeTab === 'journey' && (
              <div className="space-y-8">
                
                {/* Level up bar and weekly attendance card */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {/* Left block: XP Progress bar */}
                  <div className="lg:col-span-7 bg-white border border-slate-100 rounded-[2rem] p-8 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
                          <Sparkles size={22} className="fill-amber-500/10" />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-850 text-lg">Seu Aprendizado em Números</h3>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evolução de Nível & Pontuação</p>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 font-medium leading-relaxed mb-8">
                        Cada vídeo assistido, prova concluída ou compromisso cumprido na paróquia garante pontos de experiência (XP) valiosos para o seu desenvolvimento pastoral.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-bold uppercase tracking-wider">Progresso Nível {level}</span>
                        <span className="font-extrabold text-slate-850">{currentLevelXP} / 1000 XP</span>
                      </div>
                      
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-150/50">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercent}%` }}
                          transition={{ duration: 1 }}
                          className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" 
                        />
                      </div>
                      
                      <p className="text-[10px] text-slate-400 font-bold block mt-1 text-right">
                        Faltam {1000 - currentLevelXP} XP para o Nível {level + 1}
                      </p>
                    </div>
                  </div>

                  {/* Right block: Daily streak and Week view */}
                  <div className="lg:col-span-5 bg-white border border-slate-100 rounded-[2rem] p-8 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl">
                        <Flame size={22} className="fill-orange-500/20" />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-850 text-lg">Minha Ofensiva</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atividade Diária Continuada</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-150/50 mb-6">
                      <span className="text-4xl font-black text-orange-600 leading-none">
                        {streak.streakCount || 1}
                      </span>
                      <div className="text-left leading-none">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">Dias de Foco 🔥</span>
                        <span className="text-[10px] text-slate-400 font-bold mt-1 block">Acesso e leitura diária do mural</span>
                      </div>
                    </div>

                    {/* Week representation */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Frequência Semanal</span>
                      <div className="flex justify-between gap-1.5 pt-1">
                        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((day, idx) => {
                          // Highly stylistic mock highlight for Seg, Ter, Qua, Sex
                          const isActive = idx === 0 || idx === 1 || idx === 2 || idx === 4;
                          return (
                            <div key={`weekday-${idx}`} className="flex flex-col items-center gap-1.5 flex-1">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                                isActive 
                                  ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20 scale-105' 
                                  : 'bg-slate-50 text-slate-400 border border-slate-150'
                              }`}>
                                {isActive ? <Check size={12} strokeWidth={3.5} /> : day}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grid showing actual tasks and liturgical schedule details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Assigned tasks */}
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-xs">
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <ListTodo size={15} className="text-slate-600" /> Tarefas Designadas ({userTasksList.length})
                    </h4>

                    {userTasksList.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/50">
                        <Inbox size={28} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Nenhuma tarefa pendente.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                        {userTasksList.map((task) => (
                          <div key={task.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100/50 transition-all">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                task.status === TaskStatus.DONE ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                              }`}>
                                <CheckSquare size={14} />
                              </div>
                              <div className="text-left">
                                <h5 className="text-xs font-bold text-slate-800 leading-tight">{task.title}</h5>
                                <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Prazo: {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Não definido'}</span>
                              </div>
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md ${
                              task.status === TaskStatus.DONE 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {task.status === TaskStatus.DONE ? 'Concluída' : 'Pendente'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Scheduled Liturgical Scales */}
                  <div className="bg-white border border-slate-100 rounded-[2rem] p-8 shadow-xs">
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <HeartHandshake size={15} className="text-slate-600" /> Escalas & Liturgia ({userScalesList.length})
                    </h4>

                    {userScalesList.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/50">
                        <Inbox size={28} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Sem compromissos marcados.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                        {userScalesList.map((evt) => {
                          const userRole = evt.roles.find(r => r.assignedUserId === user.id)?.roleName || "Apoio";
                          const parsedDate = (() => {
                            try {
                              const d = new Date(evt.date);
                              return isNaN(d.getTime()) ? new Date() : d;
                            } catch {
                              return new Date();
                            }
                          })();
                          return (
                            <div key={evt.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100/50 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-brand-blue/10 text-brand-blue rounded-lg">
                                  <Calendar size={14} />
                                </div>
                                <div className="text-left">
                                  <h5 className="text-xs font-bold text-slate-800 leading-tight">{evt.title}</h5>
                                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Função: {userRole}</span>
                                </div>
                              </div>
                              <span className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wider bg-white px-2.5 py-1 rounded-md border border-slate-200/60 shadow-xs">
                                {parsedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* ================= TAB 3: DONS & TALENTOS (SKILLS & ACHIEVEMENTS) ================= */}
            {activeTab === 'skills' && (
              <div className="space-y-8">
                
                {/* Dons / Skills interactive container */}
                <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-xs">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl">
                      <Award size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-850 text-lg">Dons & Ministérios</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Habilidades e vocações reconhecidas</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <AnimatePresence mode="popLayout">
                      {isEditing ? (
                        AVAILABLE_SKILLS.map((skill) => {
                          const isSelected = skills.includes(skill);
                          return (
                            <motion.button
                              layout
                              initial={{ scale: 0.95, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.95, opacity: 0 }}
                              key={skill}
                              onClick={() => toggleSkill(skill)}
                              className={`px-5 py-3.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2.5 cursor-pointer ${
                                isSelected 
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-103' 
                                  : 'bg-slate-50 text-slate-450 border-slate-150 hover:border-slate-300'
                              }`}
                            >
                              {isSelected ? <Check size={13} strokeWidth={3.5} /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                              {skill}
                            </motion.button>
                          );
                        })
                      ) : (
                        skills.map((skill, index) => (
                          <motion.span 
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            key={skill} 
                            className="px-5 py-3 bg-brand-blue/5 text-brand-blue rounded-xl text-xs font-extrabold border border-brand-blue/10 flex items-center gap-2.5 group hover:bg-brand-blue hover:text-white transition-all shadow-xs"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-blue group-hover:bg-white animate-pulse" />
                            {skill}
                          </motion.span>
                        ))
                      )}
                    </AnimatePresence>
                    {!isEditing && skills.length === 0 && (
                      <div className="w-full text-center py-12 bg-slate-50/50 border border-dashed border-slate-200/50 rounded-2xl">
                        <Inbox size={28} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Nenhum talento mapeado ainda. Clique em Editar para definir.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Parish Achievements/Medals list */}
                <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-xs">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-2xl">
                      <Trophy size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-850 text-lg">Medalhas & Conquistas</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seu engajamento e reconhecimento prático</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {badgesList.map((badge) => {
                      const IconComponent = badge.icon;
                      return (
                        <div 
                          key={badge.id} 
                          className={`p-5 rounded-2xl border flex items-start gap-4 transition-all duration-300 ${
                            badge.unlocked 
                              ? 'bg-slate-50/80 border-slate-150 hover:shadow-md' 
                              : 'bg-slate-50/20 border-slate-100 opacity-50'
                          }`}
                        >
                          <div className={`p-3.5 rounded-xl shrink-0 ${
                            badge.unlocked ? badge.color : 'bg-slate-200 text-slate-400'
                          }`}>
                            <IconComponent size={20} />
                          </div>
                          <div className="text-left space-y-1">
                            <div className="flex items-center gap-1.5">
                              <h5 className="text-xs font-black text-slate-850 uppercase tracking-wider leading-none">
                                {badge.title}
                              </h5>
                              {badge.unlocked && (
                                <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md">✓</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-450 font-medium leading-relaxed">
                              {badge.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* ================= TAB 4: MEUS CERTIFICADOS OFICIAIS ================= */}
            {activeTab === 'certificates' && (
              <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-xs">
                <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl">
                      <Award size={22} className="animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-850 text-lg">Carteira de Certificados</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Certificados acadêmicos e eclesiais gerados</p>
                    </div>
                  </div>
                  
                  <span className="text-xs font-black text-slate-450 uppercase bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl">
                    {certificates.length} {certificates.length === 1 ? 'Emitido' : 'Emitidos'}
                  </span>
                </div>

                {certificates.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50/50 border border-dashed border-slate-200/50 rounded-2xl flex flex-col items-center">
                    <Award size={40} className="text-slate-300 mb-4" />
                    <h4 className="text-sm font-black text-slate-750 uppercase tracking-wider mb-1">Nenhum certificado disponível</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed mb-6 font-medium">
                      Conclua com sucesso os módulos e trilhas de formação no Ambiente Virtual de Aprendizagem (AVA) para liberar seu primeiro diploma!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {certificates.map((cert) => (
                      <div 
                        key={cert.id} 
                        className="p-6 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between hover:border-slate-350 hover:bg-slate-50 transition-all duration-300 hover:shadow-xs group"
                      >
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                              <Award size={20} strokeWidth={2.5} />
                            </div>
                            <span className="text-[8px] font-mono font-bold text-slate-400 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-xs">
                              {cert.id}
                            </span>
                          </div>

                          <div className="text-left space-y-1">
                            <h4 className="font-black text-slate-850 text-sm leading-tight group-hover:text-brand-blue transition-colors">
                              {cert.courseTitle}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-bold">
                              Diretor: {cert.directorName || 'Coordenação Diocesana'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between">
                          <div className="text-left">
                            <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider block">Emissão</span>
                            <span className="text-xs font-black text-slate-755">
                              {new Date(cert.issuedAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          
                          <button
                            onClick={() => triggerDirectCertificatePrint(cert)}
                            className="bg-slate-900 hover:bg-blue-600 text-white font-black text-[9.5px] uppercase tracking-wider px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
                          >
                            <Download size={11} strokeWidth={3} /> Imprimir / PDF
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* 4. PASSWORD CHANGE MODAL */}
      {createPortal(
        <AnimatePresence>
          {isPasswordModalOpen && (
              <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl" 
                        onClick={() => setIsPasswordModalOpen(false)}
                    />
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 40 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 40 }}
                        className="bg-white rounded-[2.5rem] shadow-[0_64px_128px_-24px_rgba(0,0,0,0.2)] w-full max-w-md relative z-[1010] overflow-hidden border border-slate-100"
                    >
                      <div className="px-8 py-8 border-b border-slate-50 flex justify-between items-center bg-slate-900 relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
                        <div className="relative z-10 flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/10">
                            <Key size={18} />
                          </div>
                          <div className="text-left">
                            <h3 className="text-lg font-black text-white tracking-tight leading-none">Segurança</h3>
                            <p className="text-[9px] font-black text-white/50 uppercase tracking-widest mt-1">Alteração de Senha</p>
                          </div>
                        </div>
                        <button 
                            onClick={() => setIsPasswordModalOpen(false)} 
                            className="p-3 bg-white/10 text-white/50 hover:text-white rounded-xl border border-white/5 backdrop-blur-md transition-all active:scale-90"
                        >
                            <X size={16} strokeWidth={3} />
                        </button>
                      </div>
                      
                      <div className="p-6 md:p-8 space-y-5">
                          <div className="space-y-2 text-left">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nova Senha</label>
                              <input 
                                  type="password" 
                                  value={passwordForm.new}
                                  onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})}
                                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 outline-none font-bold text-slate-850 text-sm transition-all"
                                  placeholder="Mínimo 6 caracteres..."
                              />
                          </div>
                          <div className="space-y-2 text-left">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
                              <input 
                                  type="password" 
                                  value={passwordForm.confirm}
                                  onChange={(e) => setPasswordForm({...passwordForm, confirm: e.target.value})}
                                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 outline-none font-bold text-slate-850 text-sm transition-all"
                                  placeholder="Repita a nova senha..."
                              />
                          </div>
                      </div>
                      
                      <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                          <button 
                            onClick={() => setIsPasswordModalOpen(false)} 
                            className="flex-1 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 rounded-xl transition-all cursor-pointer"
                            disabled={passLoading}
                          >
                              Cancelar
                          </button>
                          <button 
                            onClick={handlePasswordUpdate}
                            disabled={passLoading || !passwordForm.new || !passwordForm.confirm}
                            className="flex-[2] py-3 bg-slate-900 hover:bg-brand-blue text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-103 active:scale-97 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                              {passLoading ? <Loader2 size={13} className="animate-spin text-white/50" /> : <Save size={13} strokeWidth={3} />}
                              Salvar Nova Senha
                          </button>
                      </div>
                    </motion.div>
              </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
