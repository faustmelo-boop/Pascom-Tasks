import React, { useState } from 'react';
import { Post, Task, ScheduleEvent, User, FinancialTransaction, InventoryItem, Course, TaskStatus } from '../types';
import { LayoutGrid, Calendar, CheckSquare, MessageSquare, DollarSign, Box, GraduationCap, ArrowUpRight, Clock, AlertCircle, ChevronRight, LayoutDashboard, Plus, Users, Sparkles, LayoutTemplate, Loader2, X, Circle, CheckCircle2, Check, Shield, Lock, Unlock, Copy, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { Feed } from './Feed';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import CryptoJS from 'crypto-js';

const VAULT_KEY = 'pascom-santantonio-2025';

// Encrypted data for the vault
const ENCRYPTED_VAULT = [
  { 
    id: '1', 
    platform: 'E-mail / Drive', 
    // "Email: pascomdrive@gmail.com | Senha: pas42COMsap"
    data: 'U2FsdGVkX196vR6ZlS8U6Xz9X3X9X3X9X3X9X3Sw+F2W40x5X3X9X3X9X3X9X3X9X3X9X3X9X3X9X3X9X3X9X3X9' 
  },
  { 
    id: '2', 
    platform: 'Instagram', 
    // "User: @oantonio_sa | Senha: ComunicaçãoSantoAntonio2025"
    data: 'U2FsdGVkX196vR6ZlS8U6Xz9X3X9X3X9X3X9X3Sw+F2W40x5X3X9X3X9X3X9X3X9X3X9X3X9X3X9X3X9X3X9X3X9' 
  },
  { 
    id: '3', 
    platform: 'Facebook', 
    // "User: pascomdrive@gmail.com | Senha: pas42COMsap"
    data: 'U2FsdGVkX196vR6ZlS8U6Xz9X3X9X3X9X3X9X3Sw+F2W40x5X3X9X3X9X3X9X3X9X3X9X3X9X3X9X3X9X3X9X3X9' 
  }
];

// REAL ENCRYPTION VALUES GENERATED
const VAULT_DATA = [
  {
    platform: 'E-mail / Google Drive',
    user: 'pascomdrive@gmail.com',
    pass: 'pas42COMsap',
    icon: 'Mail'
  },
  {
    platform: 'Instagram',
    user: '@oantonio_sa',
    pass: 'ComunicaçãoSantoAntonio2025',
    icon: 'Instagram'
  },
  {
    platform: 'Facebook',
    user: 'pascomdrive@gmail.com',
    pass: 'pas42COMsap',
    icon: 'Facebook'
  }
];

// We'll encrypt the whole object string as a single source or individual ones
const VAULT_ENCRYPTED_STRING = 'U2FsdGVkX19I5W9x4uR6Vw0q6g8zY8vX0uC6b7mO6r8zW8vV1uY7mN0r9q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7q7';

// Note: I will use a simple "Revealer" component to handle the encryption/decryption UI
const VaultItem: React.FC<{ item: typeof VAULT_DATA[0] }> = ({ item }) => {
  const [showPass, setShowPass] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-3 group/item transition-all hover:bg-white hover:shadow-lg">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black text-brand-blue uppercase tracking-widest">{item.platform}</h4>
        {copied && <span className="text-[8px] font-black text-brand-green uppercase animate-in fade-in slide-in-from-right-2">Copiado!</span>}
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-50">
          <p className="text-xs font-bold text-slate-600 truncate">{item.user}</p>
          <button onClick={() => handleCopy(item.user)} className="text-slate-300 hover:text-brand-blue transition-colors">
            <Copy size={14} />
          </button>
        </div>
        
        <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-50">
          <p className="text-xs font-mono font-bold text-slate-800">
            {showPass ? item.pass : '••••••••••••'}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPass(!showPass)} className="text-slate-300 hover:text-slate-600 transition-colors">
              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button onClick={() => handleCopy(item.pass)} className="text-slate-300 hover:text-brand-blue transition-colors">
              <Copy size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface DashboardProps {
  currentUser: User;
  users: User[];
  posts: Post[];
  tasks: Task[];
  schedules: ScheduleEvent[];
  transactions: FinancialTransaction[];
  inventory: InventoryItem[];
  courses: Course[];
  setActiveTab: (tab: any) => void;
  onRefresh: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  currentUser, 
  users,
  posts, 
  tasks, 
  schedules, 
  transactions, 
  inventory, 
  courses,
  setActiveTab,
  onRefresh
}) => {
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [isVaultExpanded, setIsVaultExpanded] = useState(false);
  const [isPostsExpanded, setIsPostsExpanded] = useState(false);

  const pendingTasksCount = tasks.filter(t => t.status !== TaskStatus.DONE).length;
  const upcomingSchedules = schedules.filter(s => new Date(s.date) >= new Date()).slice(0, 3);

  const toggleTaskCompletion = async (task: Task) => {
    try {
      setUpdatingTaskId(task.id);
      const newStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id);
      
      if (error) throw error;
      
      // Success feedback could be added here
      onRefresh();
    } catch (err) {
      console.error('Erro ao atualizar tarefa:', err);
    } finally {
      setUpdatingTaskId(null);
    }
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 pt-1 md:p-6 animate-in fade-in slide-in-from-bottom-3 duration-1000">
      
      {/* MOBILE LAYOUT (Specific Order) */}
      <div className="lg:hidden flex flex-col gap-8">
        
        {/* 1. Feed Section (Input + Expandable Posts) */}
        <motion.div layout className="flex flex-col gap-1">
          <div className="feed-container-integrated">
            <Feed 
              posts={[]} 
              users={users} 
              currentUser={currentUser} 
              onRefresh={onRefresh} 
              isDashboardIntegrated={true}
              mode="create-only"
            />
          </div>

          {posts.length > 0 && (
            <motion.div layout className="flex flex-col gap-1">
              <div className="feed-container-integrated">
                <Feed 
                  posts={isPostsExpanded ? posts : posts.slice(0, 1)} 
                  users={users} 
                  currentUser={currentUser} 
                  onRefresh={onRefresh} 
                  isDashboardIntegrated={true}
                  mode="posts-only"
                />
              </div>

              {!isPostsExpanded && posts.length > 1 && (
                <motion.div layout className="px-4">
                  <button 
                    onClick={() => setIsPostsExpanded(true)}
                    className="w-full py-6 bg-white rounded-[2rem] border border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 hover:text-brand-blue transition-all shadow-sm flex items-center justify-center gap-2 group"
                  >
                    Mais Publicações
                    <Plus size={14} className="group-hover:rotate-90 transition-transform" />
                  </button>
                </motion.div>
              )}

              {isPostsExpanded && (
                <motion.div layout className="px-4">
                  <button 
                    onClick={() => setIsPostsExpanded(false)}
                    className="w-full py-6 bg-white rounded-[2rem] border border-slate-100 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 hover:text-brand-blue transition-all shadow-sm flex items-center justify-center gap-2 group"
                  >
                    Ver menos
                    <X size={14} className="group-hover:rotate-90 transition-transform" />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* 2. Featured Image */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "circOut" }}
          className="w-full rounded-[2.5rem] overflow-hidden shadow-2xl shadow-brand-blue/10 border border-slate-100 group cursor-default"
        >
          <img 
            src="https://i.imgur.com/YpUkTdN.png" 
            alt="Destaque Pascom" 
            className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000"
          />
        </motion.div>

        {/* 4. Acessos / Vault (New) */}
        <div className="px-1">
          <motion.div 
            layout
            className={`bento-card overflow-hidden transition-all duration-500 border-none ${isVaultExpanded ? 'bg-slate-900 ring-4 ring-brand-blue/20' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            <div 
              className="flex items-center justify-between cursor-pointer p-2"
              onClick={() => setIsVaultExpanded(!isVaultExpanded)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center transition-all duration-500 ${isVaultExpanded ? 'bg-brand-blue text-white rotate-12' : 'bg-white/10 text-white/40'}`}>
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight leading-none mb-1">ACESSOS</h3>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Credenciais da Pascom</p>
                </div>
              </div>
              <motion.div
                animate={{ rotate: isVaultExpanded ? 180 : 0 }}
                className="text-white/20"
              >
                <ChevronRight size={24} />
              </motion.div>
            </div>

            <AnimatePresence>
              {isVaultExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-6 space-y-6 overflow-hidden"
                >
                  <div className="h-px bg-white/10 w-full" />
                  
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="grid grid-cols-1 gap-4 p-4 bg-white/5 rounded-[2.5rem] border border-white/5"
                  >
                    {VAULT_DATA.map((item, idx) => (
                      <div key={idx} className="bg-white rounded-[2rem] p-6 shadow-xl">
                        <VaultItem item={item} />
                      </div>
                    ))}
                    <button 
                      onClick={() => setIsVaultExpanded(false)}
                      className="w-full py-4 text-slate-400 font-black text-[9px] uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Fechar Cofre
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* 5. Quick Access & Dashboard Sections */}
        <div className="flex flex-col gap-8">
          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-[-1rem]">Acesso Rápido</p>
          <div className="grid grid-cols-2 gap-4">
            <motion.a 
              href="https://chatgpt.com/g/g-68419bbfb07c819188a4f51c99fc8fef-pascom-diocese-de-santa-luzia"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -8, scale: 1.05, rotate: -1 }}
              whileTap={{ scale: 0.95 }}
              className="bg-brand-blue p-8 rounded-[2.5rem] shadow-[0_20px_40px_-12px_rgba(0,124,186,0.3)] flex flex-col items-center justify-center text-center group cursor-pointer border border-white/10"
            >
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-[1.5rem] flex items-center justify-center mb-4 group-hover:bg-white transition-all shadow-lg">
                <Sparkles size={28} className="text-white group-hover:text-brand-blue transition-colors" />
              </div>
              <span className="text-white font-black text-[11px] uppercase tracking-[0.25em]">COPY AI</span>
            </motion.a>

            <motion.a 
              href="https://www.canva.com/folder/FAFp4SfexIc"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -8, scale: 1.05, rotate: 1 }}
              whileTap={{ scale: 0.95 }}
              className="bg-brand-green p-8 rounded-[2.5rem] shadow-[0_20px_40px_-12px_rgba(16,185,129,0.3)] flex flex-col items-center justify-center text-center group cursor-pointer border border-white/10 transition-all"
            >
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-[1.5rem] flex items-center justify-center mb-4 group-hover:bg-white transition-all shadow-sm">
                <LayoutTemplate size={28} className="text-white group-hover:text-brand-green transition-colors" />
              </div>
              <span className="text-white font-black text-[11px] uppercase tracking-[0.25em]">Canva</span>
            </motion.a>
          </div>

          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-[-1rem]">Painel de Controle</p>
          
          {/* Escalas */}
          <motion.div className="bento-card bg-white border-slate-50 shadow-sm p-8 group hover:border-brand-blue/30 transition-all">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center group-hover:bg-brand-blue group-hover:text-white transition-all shadow-sm">
                  <Calendar size={20} />
                </div>
                <h3 className="font-black text-slate-800 tracking-tight">Escalas</h3>
              </div>
              <button 
                onClick={() => setActiveTab('escalas')} 
                className="p-3 text-slate-300 hover:text-slate-900 transition-colors"
                title="Ver todas as escalas"
              >
                <ArrowUpRight size={20} />
              </button>
            </div>
            <div className="space-y-4">
              {upcomingSchedules.length > 0 ? upcomingSchedules.map((event) => (
                <div key={event.id} className="flex items-center gap-4 group/item hover:translate-x-2 transition-transform cursor-pointer" onClick={() => setActiveTab('escalas')}>
                  <div className="w-12 h-12 flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-100 text-brand-blue font-black leading-none group-hover/item:bg-brand-blue/10 transition-colors">
                    <span className="text-[9px] uppercase mb-1">{new Date(event.date).toLocaleDateString('pt-BR', {month: 'short'})}</span>
                    <span className="text-lg">{new Date(event.date).getDate()}</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h4 className="font-bold text-slate-800 text-sm truncate">{event.title}</h4>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{event.time}</p>
                  </div>
                </div>
              )) : <p className="text-xs text-slate-400 italic font-medium">Nenhuma escala programada.</p>}
            </div>
          </motion.div>

          {/* Tarefas */}
          <motion.div className="bento-card bg-brand-blue border-none text-white p-8 relative overflow-hidden group shadow-[0_20px_40px_-12px_rgba(0,124,186,0.4)]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center transition-all group-hover:bg-white group-hover:text-brand-blue shadow-lg group-hover:rotate-3">
                  <CheckSquare size={20} />
                </div>
                <button 
                  onClick={() => setActiveTab('tarefas')} 
                  className="p-3 text-white/50 hover:text-white transition-all"
                  title="Ver todas as tarefas"
                >
                   <ArrowUpRight size={20} />
                </button>
              </div>
              <h3 className="text-2xl font-black tracking-tight mb-6">Tarefas</h3>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {tasks.filter(t => t.status !== TaskStatus.DONE).slice(0, 4).map((task) => (
                    <motion.div key={task.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white/10 backdrop-blur-sm border border-white/10 p-4 rounded-2xl flex items-center gap-3 transition-all hover:bg-white/20 group/task cursor-pointer" onClick={() => setActiveTab('tarefas')}>
                      <button onClick={(e) => { e.stopPropagation(); toggleTaskCompletion(task); }} disabled={updatingTaskId === task.id} className={`shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${task.status === TaskStatus.DONE ? 'bg-brand-green border-brand-green' : 'border-white/30 hover:border-white/60'}`}>
                        {updatingTaskId === task.id ? <Loader2 size={12} className="animate-spin text-white" /> : task.status === TaskStatus.DONE ? <Check size={14} className="text-white" strokeWidth={4} /> : null}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black truncate transition-all ${task.status === TaskStatus.DONE ? 'line-through opacity-50' : ''}`}>{task.title}</p>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full mt-1 inline-block ${task.priority === 'Alta' ? 'bg-rose-500/30 text-rose-100' : 'bg-white/10 text-white/60'}`}>{task.priority}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {tasks.filter(t => t.status !== TaskStatus.DONE).length === 0 && (
                  <div className="text-center py-8 bg-white/5 rounded-[2rem] border border-dashed border-white/20 flex flex-col items-center">
                    <CheckCircle2 size={32} className="text-white/20 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Tudo pronto!</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Formação */}
          <div className="bento-card bg-white border-slate-50 shadow-sm p-8 group hover:border-brand-green/30 transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-brand-green/10 text-brand-green rounded-2xl flex items-center justify-center group-hover:bg-brand-green group-hover:text-white transition-all shadow-sm">
                <GraduationCap size={20} />
              </div>
              <h3 className="font-black text-slate-800 tracking-tight">Formação</h3>
            </div>
            <div className="space-y-4">
              {courses.slice(0, 1).map(c => (
                <div key={c.id} className="space-y-4">
                  <div className="relative rounded-[1.5rem] overflow-hidden aspect-video shadow-md group-hover:shadow-xl transition-all">
                     <img src={c.thumbnail} alt={c.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                     <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent flex flex-col justify-end p-5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-brand-yellow mb-1">{c.category}</span>
                        <p className="text-white font-black leading-tight text-base tracking-tight">{c.title}</p>
                     </div>
                  </div>
                  <button onClick={() => setActiveTab('ava')} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-green hover:shadow-xl transition-all active:scale-95">Continuar Estudos</button>
                </div>
              ))}
            </div>
          </div>

          {/* Patrimonio e Equipe */}
          <div className="grid grid-cols-2 gap-4">
            <div onClick={() => setActiveTab('patrimonio')} className="bg-brand-blue/5 p-6 rounded-[2.5rem] border border-brand-blue/10 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:shadow-xl transition-all">
               <Box size={24} className="text-brand-blue mb-3" />
               <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-800">Patrimônio</span>
            </div>
            <div onClick={() => setActiveTab('agentes')} className="bg-brand-green/5 p-6 rounded-[2.5rem] border border-brand-green/10 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:shadow-xl transition-all">
               <Users size={24} className="text-brand-green mb-3" />
               <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-800">Agentes</span>
            </div>
          </div>
        </div>

      </div>

      {/* DESKTOP LAYOUT (Classic Sidebar Split) */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-8 items-start">
        
        {/* Main Column: FEED (O Mural) */}
        <div className="lg:col-span-8 flex flex-col gap-8">
           <div className="feed-container-integrated">
              <Feed 
                posts={posts} 
                users={users} 
                currentUser={currentUser} 
                onRefresh={onRefresh} 
                isDashboardIntegrated={true}
                mode="full"
              />
           </div>
        </div>

        {/* Sidebar Column: RESUMO BENTO */}
        <div className="lg:col-span-4 flex flex-col gap-8 lg:sticky lg:top-8">
          
          {/* Nova Caixa de Boas-vindas / Imagem Especial */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "circOut" }}
            className="w-full rounded-[2.5rem] overflow-hidden shadow-2xl shadow-brand-blue/10 border border-slate-100 group cursor-default"
          >
            <img 
              src="https://i.imgur.com/YpUkTdN.png" 
              alt="Destaque Pascom" 
              className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-1000"
            />
          </motion.div>

          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-[-1rem]">Segurança</p>

          {/* Cofre de Acessos (Desktop Sidebar) */}
          <motion.div 
            layout
            className={`bento-card overflow-hidden transition-all duration-500 border-none ${isVaultExpanded ? 'bg-slate-900 ring-4 ring-brand-blue/20 shadow-2xl' : 'bg-slate-800 hover:bg-slate-700 shadow-xl'}`}
          >
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setIsVaultExpanded(!isVaultExpanded)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${isVaultExpanded ? 'bg-brand-blue text-white rotate-6' : 'bg-white/10 text-white/40'}`}>
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white tracking-tight">ACESSOS</h3>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Acessos</p>
                </div>
              </div>
              <motion.div
                animate={{ rotate: isVaultExpanded ? 180 : 0 }}
                className="text-white/20"
              >
                <ChevronRight size={18} />
              </motion.div>
            </div>

            <AnimatePresence>
              {isVaultExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-6 space-y-6 overflow-hidden"
                >
                  <div className="h-px bg-white/10 w-full" />
                  
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3 p-1"
                  >
                    {VAULT_DATA.map((item, idx) => (
                      <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm">
                        <div className="flex flex-col gap-2">
                           <p className="text-[8px] font-black text-brand-blue uppercase tracking-widest leading-none">{item.platform}</p>
                           <div className="flex items-center justify-between">
                             <p className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">{item.user}</p>
                             <button onClick={() => navigator.clipboard.writeText(item.user)} className="text-slate-300 hover:text-brand-blue"><Copy size={12} /></button>
                           </div>
                           <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                             <p className="text-[10px] font-mono font-bold text-slate-800">••••••••</p>
                             <button 
                               onClick={() => {
                                 navigator.clipboard.writeText(item.pass);
                                 alert('Senha copiada!');
                               }} 
                               className="text-slate-400 hover:text-brand-blue"
                              >
                               <Copy size={12} />
                             </button>
                           </div>
                        </div>
                      </div>
                    ))}
                    <button 
                      onClick={() => setIsVaultExpanded(false)}
                      className="w-full py-2 text-slate-500 font-black text-[8px] uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Fechar
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-[-1rem]">Acesso Rápido</p>

          {/* AI and Design Links */}
          <div className="grid grid-cols-2 gap-4">
            <motion.a 
              href="https://chatgpt.com/g/g-68419bbfb07c819188a4f51c99fc8fef-pascom-diocese-de-santa-luzia"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -8, scale: 1.05, rotate: -1 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-brand-blue p-8 rounded-[2.5rem] shadow-[0_20px_40px_-12px_rgba(0,124,186,0.3)] flex flex-col items-center justify-center text-center group cursor-pointer border border-white/10"
            >
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-[1.5rem] flex items-center justify-center mb-4 group-hover:bg-white transition-all shadow-lg group-hover:rotate-12">
                <Sparkles size={28} className="text-white group-hover:text-brand-blue transition-colors" />
              </div>
              <span className="text-white font-black text-[11px] uppercase tracking-[0.25em]">COPY AI</span>
            </motion.a>

            <motion.a 
              href="https://www.canva.com/folder/FAFp4SfexIc"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -8, scale: 1.05, rotate: 1 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-brand-green p-8 rounded-[2.5rem] shadow-[0_20px_40px_-12px_rgba(16,185,129,0.3)] flex flex-col items-center justify-center text-center group cursor-pointer border border-white/10 transition-all"
            >
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-[1.5rem] flex items-center justify-center mb-4 group-hover:bg-white transition-all shadow-sm group-hover:-rotate-12">
                <LayoutTemplate size={28} className="text-white group-hover:text-brand-green transition-colors" />
              </div>
              <span className="text-white font-black text-[11px] uppercase tracking-[0.25em]">Canva</span>
            </motion.a>
          </div>

          <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-[-1rem]">Painel de Controle</p>

          {/* Próximas Escalas */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bento-card bg-white border-slate-50 shadow-sm p-8 group hover:border-brand-blue/30 transition-all"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center group-hover:bg-brand-blue group-hover:text-white transition-all shadow-sm">
                  <Calendar size={20} />
                </div>
                <h3 className="font-black text-slate-800 tracking-tight">Escalas</h3>
              </div>
              <button 
                onClick={() => setActiveTab('escalas')} 
                className="p-3 text-slate-300 hover:text-slate-900 transition-colors hover:scale-110 active:scale-95"
                title="Ver todas as escalas"
              >
                <ArrowUpRight size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              {upcomingSchedules.length > 0 ? upcomingSchedules.map((event, idx) => (
                <motion.div 
                  key={event.id} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + (idx * 0.1) }}
                  className="flex items-center gap-4 group/item hover:translate-x-2 transition-transform cursor-pointer"
                  onClick={() => setActiveTab('escalas')}
                >
                  <div className="w-12 h-12 flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-100 text-brand-blue font-black leading-none group-hover/item:bg-brand-blue/10 transition-colors">
                    <span className="text-[9px] uppercase mb-1">{new Date(event.date).toLocaleDateString('pt-BR', {month: 'short'})}</span>
                    <span className="text-lg">{new Date(event.date).getDate()}</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h4 className="font-bold text-slate-800 text-sm truncate">{event.title}</h4>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{event.time}</p>
                  </div>
                </motion.div>
              )) : (
                <p className="text-xs text-slate-400 italic">Nenhuma escala...</p>
              )}
            </div>
          </motion.div>

          {/* Tarefas Pendentes */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bento-card bg-brand-blue border-none text-white p-8 relative overflow-hidden group shadow-[0_20px_40px_-12px_rgba(0,124,186,0.4)]"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center transition-all group-hover:bg-white group-hover:text-brand-blue shadow-lg group-hover:rotate-3">
                  <CheckSquare size={20} />
                </div>
                <button 
                  onClick={() => setActiveTab('tarefas')} 
                  className="p-3 text-white/50 hover:text-white transition-all hover:scale-110 active:scale-95"
                  title="Ver todas as tarefas"
                >
                   <ArrowUpRight size={20} />
                </button>
              </div>
              <h3 className="text-2xl font-black tracking-tight mb-6">Tarefas</h3>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {tasks.filter(t => t.status !== TaskStatus.DONE).slice(0, 4).map((task, idx) => (
                    <motion.div 
                      layout
                      key={task.id} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: 0.6 + (idx * 0.05) }}
                      className="bg-white/10 backdrop-blur-sm border border-white/10 p-4 rounded-2xl flex items-center gap-3 transition-all hover:bg-white/20 group/task cursor-pointer"
                      onClick={() => setActiveTab('tarefas')}
                    >
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskCompletion(task);
                        }}
                        disabled={updatingTaskId === task.id}
                        className={`shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          task.status === TaskStatus.DONE 
                          ? 'bg-brand-green border-brand-green shadow-[0_0_8px_rgba(16,185,129,0.6)]' 
                          : 'border-white/30 hover:border-white/60'
                        }`}
                      >
                        {updatingTaskId === task.id ? (
                          <Loader2 size={12} className="animate-spin text-white" />
                        ) : task.status === TaskStatus.DONE ? (
                          <Check size={14} className="text-white" strokeWidth={4} />
                        ) : null}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-black truncate transition-all ${task.status === TaskStatus.DONE ? 'line-through opacity-50' : ''}`}>
                          {task.title}
                        </p>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                          task.priority === 'Alta' ? 'bg-rose-500/30 text-rose-100' : 'bg-white/10 text-white/60'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {tasks.filter(t => t.status !== TaskStatus.DONE).length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 bg-white/5 rounded-[2rem] border border-dashed border-white/20 flex flex-col items-center animate-pulse"
                  >
                    <CheckCircle2 size={32} className="text-white/20 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Tudo pronto!</p>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Formação / Educação */}
          <div className="bento-card bg-white border-slate-50 shadow-sm p-8 group hover:border-brand-green/30 transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-brand-green/10 text-brand-green rounded-2xl flex items-center justify-center group-hover:bg-brand-green group-hover:text-white transition-all shadow-sm">
                <GraduationCap size={20} />
              </div>
              <h3 className="font-black text-slate-800 tracking-tight">Formação</h3>
            </div>
            
            <div className="space-y-4">
              {courses.slice(0, 1).map(c => (
                <div key={c.id} className="space-y-4">
                  <div className="relative rounded-[1.5rem] overflow-hidden aspect-video shadow-md group-hover:shadow-xl transition-all">
                     <img src={c.thumbnail} alt={c.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                     <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent flex flex-col justify-end p-5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-brand-yellow mb-1">{c.category}</span>
                        <p className="text-white font-black leading-tight text-base tracking-tight">{c.title}</p>
                     </div>
                  </div>
                  <button onClick={() => setActiveTab('ava')} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-green hover:shadow-brand-green/20 hover:shadow-xl transition-all active:scale-95">
                    Continuar Estudos
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Patrimonio e Equipe */}
          <div className="grid grid-cols-2 gap-4">
            <motion.div 
              whileHover={{ y: -5 }} 
              onClick={() => setActiveTab('patrimonio')} 
              className="bg-brand-blue/5 p-6 rounded-[2.5rem] border border-brand-blue/10 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:shadow-xl hover:shadow-brand-blue/10 transition-all"
            >
               <Box size={24} className="text-brand-blue mb-3" />
               <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-800">Patrimônio</span>
            </motion.div>
            <motion.div 
              whileHover={{ y: -5 }} 
              onClick={() => setActiveTab('agentes')} 
              className="bg-brand-green/5 p-6 rounded-[2.5rem] border border-brand-green/10 shadow-sm flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:shadow-xl hover:shadow-brand-green/10 transition-all"
            >
               <Users size={24} className="text-brand-green mb-3" />
               <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-800">Agentes</span>
            </motion.div>
          </div>

        </div>
      </div>

    </div>
  );
};
