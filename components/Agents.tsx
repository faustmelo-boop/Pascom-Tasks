import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { User, UserRole, isCoordinator } from '../types';
import { supabase } from '../supabaseClient';
import { lmsService } from '../lmsService';
import { 
  Mail, Phone, Award, Loader2, Search, Users, 
  Send, MessageSquare, X, CheckCircle2, Calendar, ChevronRight, 
  Filter, MoreVertical, Star, Info, Settings, Trash2, ClipboardList,
  Flame, Sparkles, Clock, CheckSquare, Bell, BellRing, Smartphone,
  ChevronUp, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentsProps {
  users: User[];
  currentUser: User;
  onRefresh: () => void;
  onTabChange?: (tab: string) => void;
}

export const Agents: React.FC<AgentsProps> = ({ users, currentUser, onRefresh, onTabChange }) => {
  const isCurrentUserCoordinator = currentUser && isCoordinator(currentUser.role);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [updatingBadgesId, setUpdatingBadgesId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<User | null>(null);

  const [selectedAgentXP, setSelectedAgentXP] = useState<number>(0);
  const [selectedAgentStreak, setSelectedAgentStreak] = useState<number>(1);

  React.useEffect(() => {
    if (selectedAgent) {
      const loadAgentStats = async () => {
        try {
          const xp = await lmsService.getUserXP(selectedAgent.id);
          const str = await lmsService.fetchUserStreak(selectedAgent.id);
          setSelectedAgentXP(xp || 0);
          setSelectedAgentStreak(str?.streakCount || 1);
        } catch (err) {
          console.error(err);
        }
      };
      loadAgentStats();
    }
  }, [selectedAgent]);

  // Custom dialog & toast replacement for alert/confirm in sandboxed iframe
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    type: 'danger' | 'warning' | 'success' | 'info';
  } | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => {
        if (prev?.message === message) return null;
        return prev;
      });
    }, 4500);
  };

  // Message / Notification State
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageTarget, setMessageTarget] = useState<{id: string | null, name: string} | null>(null);
  const [messageForm, setMessageForm] = useState({ title: '', content: '' });
  const [isSending, setIsSending] = useState(false);

  // --- Coordinator Web Push Command Center States ---
  const [isPushPanelOpen, setIsPushPanelOpen] = useState(false);
  const [pushRemindersEnabled, setPushRemindersEnabled] = useState(false);
  const [pushReminderTime, setPushReminderTime] = useState('08:00');
  const [pushCategories, setPushCategories] = useState<string[]>(['escalas', 'tarefas', 'formacao']);
  const [pushTone, setPushTone] = useState<'spiritual' | 'motivational' | 'direct'>('spiritual');
  const [instantPushTitle, setInstantPushTitle] = useState('');
  const [instantPushBody, setInstantPushBody] = useState('');
  const [instantPushTarget, setInstantPushTarget] = useState<'all' | 'coordinators'>('all');
  const [isTriggeringInstantPush, setIsTriggeringInstantPush] = useState(false);
  const [testNotificationStatus, setTestNotificationStatus] = useState<'idle' | 'success' | 'denied' | 'requesting'>('idle');

  // Load configuration
  React.useEffect(() => {
    if (isCurrentUserCoordinator) {
      try {
        const stored = localStorage.getItem('pascom_shared_push_config');
        if (stored) {
          const config = JSON.parse(stored);
          setPushRemindersEnabled(config.enabled ?? false);
          setPushReminderTime(config.time ?? '08:00');
          setPushCategories(config.categories ?? ['escalas', 'tarefas', 'formacao']);
          setPushTone(config.tone ?? 'spiritual');
        } else {
          // Initialize defaults
          setPushRemindersEnabled(true);
          setPushReminderTime('08:00');
          setPushCategories(['escalas', 'tarefas', 'formacao']);
          setPushTone('spiritual');
        }
      } catch (e) {
        console.error("Error loading push configuration", e);
      }
    }
  }, [isCurrentUserCoordinator]);

  // Save config helper
  const savePushConfig = (updated: {
    enabled?: boolean;
    time?: string;
    categories?: string[];
    tone?: 'direct' | 'motivational' | 'spiritual';
  }) => {
    try {
      const stored = localStorage.getItem('pascom_shared_push_config');
      const currentConfig = stored ? JSON.parse(stored) : {
        enabled: true,
        time: '08:00',
        categories: ['escalas', 'tarefas', 'formacao'],
        tone: 'spiritual'
      };
      const newConfig = { ...currentConfig, ...updated };
      localStorage.setItem('pascom_shared_push_config', JSON.stringify(newConfig));
      // Sync it also to coordinator's personal device storage for continuity
      localStorage.setItem(`pascom_push_reminders_${currentUser.id}`, JSON.stringify(newConfig));
    } catch (e) {
      console.error("Error saving push config", e);
    }
  };

  const handleToggleReminder = (checked: boolean) => {
    setPushRemindersEnabled(checked);
    savePushConfig({ enabled: checked });
    showToast(checked ? 'Lembretes diários ativados!' : 'Lembretes diários desativados!', 'info');
  };

  const handleTimeChange = (time: string) => {
    setPushReminderTime(time);
    savePushConfig({ time });
  };

  const handleCategoryToggle = (category: string) => {
    const nextCategories = pushCategories.includes(category)
      ? pushCategories.filter(c => c !== category)
      : [...pushCategories, category];
    setPushCategories(nextCategories);
    savePushConfig({ categories: nextCategories });
  };

  const handleToneChange = (tone: 'direct' | 'motivational' | 'spiritual') => {
    setPushTone(tone);
    savePushConfig({ tone });
  };

  // Preset templates for instant push message
  const fillPreset = (type: 'escala' | 'reuniao' | 'mutirao') => {
    if (type === 'escala') {
      setInstantPushTitle('📅 Nova Escala de Transmissão Disponível');
      setInstantPushBody('A escala do próximo domingo foi publicada no painel da Pascom. Acesse para conferir a sua função e horário de escalação!');
    } else if (type === 'reuniao') {
      setInstantPushTitle('Reunião Geral da Pascom - Santo Antônio');
      setInstantPushBody('Convocamos todos os agentes para nossa reunião mensal neste sábado às 15h00 na sala da pastoral. Contamos com sua valiosa presença!');
    } else {
      setInstantPushTitle('Mutirão de Cobertura e Fotos');
      setInstantPushBody('Temos um evento paroquial especial agendado hoje. Verifique as diretrizes de fotografia e o checklist de equipamentos!');
    }
  };

  // Broadcast Web Push Instant Message
  const handleSendInstantPush = async () => {
    if (!instantPushTitle.trim() || !instantPushBody.trim()) {
      showToast('Por favor, preencha o título e a mensagem do push.', 'error');
      return;
    }
    setIsTriggeringInstantPush(true);
    try {
      // 1. Send native notification locally for the coordinator to see it right now as real feedback
      if ('Notification' in window) {
        if ((Notification.permission as string) === 'granted') {
          new Notification(instantPushTitle, {
            body: instantPushBody,
            icon: 'https://i.imgur.com/ofoiwCd.png',
            tag: 'pascom-instant-push'
          });
        } else if ((Notification.permission as string) === 'default') {
          await Notification.requestPermission();
          if ((Notification.permission as string) === 'granted') {
            new Notification(instantPushTitle, {
              body: instantPushBody,
              icon: 'https://i.imgur.com/ofoiwCd.png',
              tag: 'pascom-instant-push'
            });
          }
        }
      }

      // 2. Insert into the database so all matching agents get the in-app notification instantly
      let notificationsPayload = [];
      const titlePrefix = instantPushTarget === 'coordinators' ? '📢 [Push Coordenação] ' : '📢 [Web Push] ';
      
      if (instantPushTarget === 'all') {
        notificationsPayload = users
          .filter(u => u.id !== currentUser.id)
          .map(u => ({
            user_id: u.id,
            type: 'system',
            title: `${titlePrefix}${instantPushTitle}`,
            content: instantPushBody,
            is_read: false
          }));
      } else {
        notificationsPayload = users
          .filter(u => u.id !== currentUser.id && isCoordinator(u.role))
          .map(u => ({
            user_id: u.id,
            type: 'system',
            title: `${titlePrefix}${instantPushTitle}`,
            content: instantPushBody,
            is_read: false
          }));
      }

      if (notificationsPayload.length > 0) {
        const { error } = await supabase.from('notifications').insert(notificationsPayload);
        if (error) throw error;
      }

      showToast('Web Push disparado com sucesso para toda a comunidade!', 'success');
      setInstantPushTitle('');
      setInstantPushBody('');
    } catch (err: any) {
      console.error(err);
      showToast(`Falha ao disparar push: ${err.message || err}`, 'error');
    } finally {
      setIsTriggeringInstantPush(false);
    }
  };

  // Helper to fix timezone issue on birthday display
  const formatBirthday = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('pt-BR', {day: 'numeric', month: 'long'});
  };

  // Scroll lock when modal is open
  React.useEffect(() => {
    // We target the main scrollable container in App.tsx
    const scrollContainer = document.querySelector('.overflow-y-auto.flex-1');
    
    if (selectedAgent || isMessageModalOpen) {
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
  }, [selectedAgent, isMessageModalOpen]);

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    setConfirmDialog({
      title: 'Promover Membro',
      message: `Tem certeza que deseja promover este membro a ${newRole}?`,
      type: 'warning',
      onConfirm: async () => {
        setConfirmDialog(null);
        setPromotingId(userId);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId)
                .select();
            
            if (error) throw error;
            if (!data || data.length === 0) {
                showToast("Erro de Permissão: Verifique as RLS policies no Supabase.", "error");
                return;
            }
            
            showToast(`Sucesso! Usuário promovido.`);
            onRefresh();
        } catch (err: any) {
            showToast("Falha ao promover: " + (err.message || "Erro desconhecido"), "error");
        } finally {
            setPromotingId(null);
        }
      }
    });
  };

  const handleOpenMessageModal = (targetUser?: User) => {
    if (targetUser) {
        setMessageTarget({ id: targetUser.id, name: targetUser.name });
    } else {
        setMessageTarget({ id: null, name: 'Todos os Agentes (Comunicado)' });
    }
    setMessageForm({ title: '', content: '' });
    setIsMessageModalOpen(true);
  };

  const handleSendMessage = async () => {
    if (!messageForm.title.trim() || !messageForm.content.trim()) return;
    setIsSending(true);

    try {
        let notificationsPayload = [];

        if (messageTarget?.id) {
            notificationsPayload.push({
                user_id: messageTarget.id,
                type: 'system',
                title: messageForm.title,
                content: messageForm.content,
                is_read: false
            });
        } else {
            notificationsPayload = users
                .filter(u => u.id !== currentUser.id)
                .map(u => ({
                    user_id: u.id,
                    type: 'system',
                    title: `📢 ${messageForm.title}`, 
                    content: messageForm.content,
                    is_read: false
                }));
        }

        if (notificationsPayload.length > 0) {
            const { error } = await supabase.from('notifications').insert(notificationsPayload);
            if (error) throw error;
            showToast('Mensagem enviada com sucesso!');
            setIsMessageModalOpen(false);
        } else {
            showToast('Nenhum destinatário encontrado.', 'info');
        }

    } catch (e: any) {
        showToast(`Erro ao enviar: ${e.message}`, 'error');
    } finally {
        setIsSending(false);
    }
  };

  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('Todos');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemoveUser = async (userId: string, userName: string) => {
    setConfirmDialog({
      title: 'Remover Integrante',
      message: `TEM CERTEZA absoluta que deseja remover ${userName} da Pascom? Esta ação excluirá permanentemente o cadastro e perfil deste integrante.`,
      type: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        setRemovingId(userId);
        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) throw error;
            showToast(`Sucesso! ${userName} foi removido(a) da Pascom.`);
            setSelectedAgent(null);
            onRefresh();
        } catch (err: any) {
            showToast("Falha ao remover integrante: " + (err.message || err), 'error');
        } finally {
            setRemovingId(null);
        }
      }
    });
  };

  // Divide o array bruto em ativos e pendentes
  const activeUsers = users.filter(u => String(u.role).toLowerCase() !== 'pendente');

  const matchesRole = (roleStr: string | UserRole, filter: string) => {
    if (filter === 'Todos') return true;
    if (filter === 'Coordenador') return isCoordinator(roleStr);
    return String(roleStr).toLowerCase() === filter.toLowerCase();
  };

  const filteredUsers = activeUsers.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRoleFilter = matchesRole(user.role, selectedRoleFilter);
    return matchesSearch && matchesRoleFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 pt-1 md:p-10 space-y-8 md:space-y-12 animate-in fade-in duration-1000 pb-32">
      {/* modern Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 py-6 border-b border-slate-100/60">
        <div className="animate-in slide-in-from-left-8 duration-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-brand-blue rounded-[1.2rem] flex items-center justify-center text-white shadow-2xl shadow-brand-blue/20 rotate-3">
                <Users size={24} />
            </div>
            <p className="text-[9px] font-black text-brand-blue uppercase tracking-[0.25em] bg-brand-blue/10 px-3.5 py-1.5 rounded-full border border-brand-blue/10">Corpo da Pascom</p>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">Nossa Equipe</h1>
          <p className="text-slate-400 font-medium text-sm md:text-base italic mt-1.5 max-w-2xl">
            Unidos no serviço, comunicando a Palavra através da diversidade de dons e talentos de cada um.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 animate-in slide-in-from-right-8 duration-700 shrink-0">
            {isCurrentUserCoordinator && (
              <>
                <button 
                  onClick={() => onTabChange && onTabChange('inscricoes')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/15 flex items-center justify-center gap-2 group active:scale-95"
                >
                  <ClipboardList size={16} /> Ver Inscrições
                </button>
                <button 
                  onClick={() => handleOpenMessageModal()}
                  className="bg-brand-blue hover:bg-brand-blue/95 text-white px-6 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-brand-blue/15 flex items-center justify-center gap-2 group active:scale-95"
                >
                  <MessageSquare size={16} className="group-hover:rotate-12 transition-transform" /> Comunicado Geral
                </button>
              </>
            )}
            <div className="relative group min-w-[260px]">
                <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-355 group-focus-within:text-brand-blue transition-all" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou dom..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-6 py-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-sm outline-none focus:ring-4 focus:ring-brand-blue/5 focus:border-brand-blue font-bold text-xs transition-all"
                />
            </div>
        </div>
      </header>

      {/* Coordinator Web Push Central Control Panel */}
      {isCurrentUserCoordinator && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xs overflow-hidden transition-all duration-300">
          <button
            type="button"
            onClick={() => setIsPushPanelOpen(!isPushPanelOpen)}
            className="w-full flex flex-col md:flex-row md:items-center justify-between p-6 md:p-8 bg-gradient-to-r from-slate-50 to-slate-100/30 hover:bg-slate-100/50 transition-all text-left cursor-pointer outline-none gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-[#1b3a70] shadow-2xs border border-slate-150">
                <BellRing size={24} className={pushRemindersEnabled ? "animate-bounce text-[#f1a80a]" : "text-slate-400"} />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Central de Transmissão Web Push
                  <span className="text-[9px] font-black uppercase bg-[#1b3a70] text-white px-2 py-0.5 rounded-md tracking-wider">Coordenador</span>
                </h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {pushRemindersEnabled 
                    ? `Lembretes Diários: Ativos (${pushReminderTime}) • Tom: ${pushTone === 'spiritual' ? 'Espiritual' : pushTone === 'motivational' ? 'Motivador' : 'Direto'}`
                    : "Lembretes Automáticos Desativados • Envie avisos manuais abaixo"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-end md:self-center">
              <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${
                pushRemindersEnabled 
                  ? "bg-emerald-50 text-emerald-600 border-emerald-150" 
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}>
                {pushRemindersEnabled ? "Lembretes Ativos" : "Apenas Manual"}
              </span>
              <div className="p-2 bg-white rounded-xl shadow-3xs border border-slate-100 text-slate-500">
                {isPushPanelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
          </button>

          <AnimatePresence>
            {isPushPanelOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden border-t border-slate-150 bg-white"
              >
                <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-slate-50/25">
                  
                  {/* Left Column: Daily scheduler config */}
                  <div className="space-y-6 bg-white p-6 rounded-[2rem] border border-slate-150/80 shadow-3xs">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                      <Clock className="text-[#1b3a70]" size={18} />
                      <div>
                        <h4 className="text-xs font-black text-[#1b3a70] uppercase tracking-wider">1. Programar Lembrete Diário Automático</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Envia lembrete de tarefas e escalas para todos os agentes</p>
                      </div>
                    </div>

                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <div>
                        <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Lembretes Diários</h5>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Ativa ou desativa os disparos recorrentes</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleToggleReminder(!pushRemindersEnabled)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${pushRemindersEnabled ? 'bg-[#1b3a70]' : 'bg-slate-200'}`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${pushRemindersEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* Time Picker */}
                    <div className={`flex items-center justify-between p-1 transition-all ${!pushRemindersEnabled && 'opacity-40 pointer-events-none'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Horário de Disparo</span>
                      </div>
                      <input 
                        type="time" 
                        value={pushReminderTime}
                        onChange={(e) => handleTimeChange(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-[#1b3a70] rounded-xl px-4 py-2 text-xs font-black outline-none focus:ring-2 focus:ring-[#1b3a70]/10 cursor-pointer"
                      />
                    </div>

                    {/* Tone Selector */}
                    <div className={`space-y-2 transition-all ${!pushRemindersEnabled && 'opacity-44 pointer-events-none'}`}>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Estilo & Tom de Voz</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['spiritual', 'motivational', 'direct'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => handleToneChange(t)}
                            className={`p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                              pushTone === t 
                                ? 'bg-[#1b3a70]/5 border-[#1b3a70] text-[#1b3a70] shadow-3xs' 
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-lg mb-1">
                              {t === 'spiritual' ? '⛪' : t === 'motivational' ? '💡' : '📢'}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider leading-none">
                              {t === 'spiritual' ? 'Espiritual' : t === 'motivational' ? 'Motivador' : 'Direto'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Included Categories */}
                    <div className={`space-y-2 transition-all ${!pushRemindersEnabled && 'opacity-44 pointer-events-none'}`}>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Conteúdos no Lembrete</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: 'escalas', label: '📅 Escalas' },
                          { id: 'tarefas', label: '📝 Tarefas' },
                          { id: 'formacao', label: '📖 Formação' }
                        ].map((cat) => {
                          const active = pushCategories.includes(cat.id);
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => handleCategoryToggle(cat.id)}
                              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border flex items-center gap-1.5 ${
                                active 
                                  ? 'bg-[#1b3a70] text-white border-transparent shadow-3xs' 
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              {cat.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Mock notification preview */}
                    <div className="bg-slate-900 text-white rounded-[2rem] p-5 relative overflow-hidden shadow-inner mt-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 p-1 border border-white/10">
                          <img src="https://i.imgur.com/ofoiwCd.png" alt="Pascom" className="w-full h-full object-contain" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[8px] uppercase tracking-widest font-black text-[#f1a80a]">Simulador Web Push</span>
                            <span className="text-[8px] text-white/30 font-mono">Lembrete Diário</span>
                          </div>
                          <h5 className="font-black text-[11px] text-white tracking-tight leading-snug">
                            {pushTone === 'spiritual' 
                              ? '⛪ Bênção e Missão Diária - Pascom' 
                              : pushTone === 'motivational' 
                              ? '💡 Evangelizar e Comunicar - Pascom' 
                              : '📢 Lembrete de Tarefas - Pascom'}
                          </h5>
                          <p className="text-[10px] text-white/70 leading-relaxed font-bold mt-1 line-clamp-3">
                            {pushTone === 'spiritual' 
                              ? 'Olá, Agente! Que Santo Antônio abençoe seu dia na Pascom da Arquidiocese de Natal. Confira suas escalas e tarefas agendadas!'
                              : pushTone === 'motivational'
                              ? 'Olá, Agente! Cada post e transmissão aproxima as pessoas de Deus. Venha ver as missões do dia e avance na formação!'
                              : 'Olá, Agente! Você tem escalas e tarefas pendentes hoje. Acesse o painel da pastoral para conferir os detalhes.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Instant push broadcaster */}
                  <div className="space-y-6 bg-white p-6 rounded-[2rem] border border-slate-150/80 shadow-3xs flex flex-col justify-between">
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                        <Send className="text-[#f1a80a]" size={18} />
                        <div>
                          <h4 className="text-xs font-black text-[#1b3a70] uppercase tracking-wider">2. Disparar Web Push Instantâneo</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Envia uma notificação imediata aos navegadores dos agentes</p>
                        </div>
                      </div>

                      {/* Templates / Presets */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Modelos Rápidos (Preencher com 1-Clique)</label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => fillPreset('escala')}
                            className="px-3 py-1.5 bg-slate-50 text-slate-700 hover:bg-[#1b3a70]/5 hover:text-[#1b3a70] transition-all rounded-xl text-[9px] font-black uppercase tracking-wider border border-slate-200 cursor-pointer"
                          >
                            📅 Nova Escala
                          </button>
                          <button
                            type="button"
                            onClick={() => fillPreset('reuniao')}
                            className="px-3 py-1.5 bg-slate-50 text-slate-700 hover:bg-[#1b3a70]/5 hover:text-[#1b3a70] transition-all rounded-xl text-[9px] font-black uppercase tracking-wider border border-slate-200 cursor-pointer"
                          >
                            ⛪ Reunião Mensal
                          </button>
                          <button
                            type="button"
                            onClick={() => fillPreset('mutirao')}
                            className="px-3 py-1.5 bg-slate-50 text-slate-700 hover:bg-[#1b3a70]/5 hover:text-[#1b3a70] transition-all rounded-xl text-[9px] font-black uppercase tracking-wider border border-slate-200 cursor-pointer"
                          >
                            📸 Mutirão Cobertura
                          </button>
                        </div>
                      </div>

                      {/* Title & Body Inputs */}
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Título do Alerta</label>
                          <input 
                            type="text"
                            placeholder="Ex: Reunião Extraordinária Pascom"
                            value={instantPushTitle}
                            onChange={(e) => setInstantPushTitle(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#1b3a70]/10 focus:border-[#1b3a70] transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Mensagem Principal</label>
                          <textarea 
                            rows={3}
                            placeholder="Escreva a mensagem que aparecerá no celular/computador..."
                            value={instantPushBody}
                            onChange={(e) => setInstantPushBody(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#1b3a70]/10 focus:border-[#1b3a70] transition-all resize-none"
                          />
                        </div>
                      </div>

                      {/* Target Audience selection */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Público-Alvo do Disparo</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setInstantPushTarget('all')}
                            className={`p-3 rounded-xl border text-center font-black uppercase tracking-wider text-[9px] transition-all cursor-pointer ${
                              instantPushTarget === 'all' 
                                ? 'bg-[#1b3a70] text-white border-transparent shadow-3xs' 
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'
                            }`}
                          >
                            👥 Todos os Agentes
                          </button>
                          <button
                            type="button"
                            onClick={() => setInstantPushTarget('coordinators')}
                            className={`p-3 rounded-xl border text-center font-black uppercase tracking-wider text-[9px] transition-all cursor-pointer ${
                              instantPushTarget === 'coordinators' 
                                ? 'bg-[#1b3a70] text-white border-transparent shadow-3xs' 
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'
                            }`}
                          >
                            👑 Só Coordenadores
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Trigger Button */}
                    <button
                      type="button"
                      onClick={handleSendInstantPush}
                      disabled={isTriggeringInstantPush}
                      className="w-full mt-6 bg-gradient-to-r from-[#1b3a70] to-indigo-900 text-white hover:scale-[1.01] active:scale-[0.98] py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-[#1b3a70]/15 transition-all flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-55"
                    >
                      <Sparkles size={14} className={isTriggeringInstantPush ? "animate-spin" : ""} />
                      {isTriggeringInstantPush ? 'Disparando Transmissão...' : 'Disparar Web Push Agora 🚀'}
                    </button>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}



      {/* Role filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scroll -mx-4 px-4 select-none">
        {['Todos', 'Coordenador', 'Agente', 'Tesoureiro', 'Editor'].map(role => {
          const isActive = selectedRoleFilter === role;
          let activeStyles = 'bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10 scale-105';
          let inactiveStyles = 'bg-white hover:bg-slate-50 border-slate-200/60 text-slate-500';
          
          if (role === 'Coordenador' && isActive) {
            activeStyles = 'bg-gradient-to-r from-amber-500 to-brand-yellow border-amber-500 text-white shadow-md shadow-amber-500/10 scale-105';
          } else if (role === 'Agente' && isActive) {
            activeStyles = 'bg-brand-blue border-brand-blue text-white shadow-md shadow-brand-blue/10 scale-105';
          } else if (role === 'Tesoureiro' && isActive) {
            activeStyles = 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/10 scale-105';
          } else if (role === 'Editor' && isActive) {
            activeStyles = 'bg-purple-500 border-purple-500 text-white shadow-md shadow-purple-500/10 scale-105';
          }

          return (
            <button
              key={role}
              onClick={() => setSelectedRoleFilter(role)}
              className={`px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider border shrink-0 transition-all active:scale-95 ${isActive ? activeStyles : inactiveStyles}`}
            >
              {role === 'Todos' ? '✨ Mostrar Todos' : role}
            </button>
          );
        })}
      </div>

      {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border border-slate-100 text-center animate-in zoom-in-95 shadow-sm">
              <div className="p-6 bg-slate-50 rounded-2xl mb-4 text-slate-300 ring-6 ring-slate-100">
                <Users size={48} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Nenhum membro encontrado</h3>
              <p className="text-slate-400 font-bold mt-1 max-w-xs mx-auto text-xs italic">
                {activeUsers.length === 0 
                  ? "O diretório está aguardando os primeiros cadastros." 
                  : "Tente reajustar seu filtro ou termo de busca."}
              </p>
          </div>
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {filteredUsers.map((user, idx) => {
              const userIsCoordinator = isCoordinator(user.role);
              const isMe = user.id === currentUser.id;
              
              // Map dynamic badge styling by user roles
              let roleBadgeStyle = 'bg-slate-50 text-slate-600 border-slate-205';
              const userRoleStr = String(user.role).toLowerCase();
              if (userIsCoordinator) {
                roleBadgeStyle = 'bg-amber-50 text-amber-800 border-amber-200/40';
              } else if (userRoleStr === 'agente') {
                roleBadgeStyle = 'bg-blue-50 text-brand-blue border-blue-200/40';
              } else if (userRoleStr === 'tesoureiro') {
                roleBadgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200/40';
              } else if (userRoleStr === 'editor') {
                roleBadgeStyle = 'bg-purple-50 text-purple-800 border-purple-200/40';
              }

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={user.id} 
                  onClick={() => setSelectedAgent(user)}
                  className="group relative bg-white p-6 rounded-[2.2rem] border border-slate-100 hover:border-brand-blue/20 transition-all cursor-pointer shadow-[0_8px_30px_rgb(0,0,0,0.015)] hover:shadow-xl hover:shadow-slate-100 flex flex-col items-center text-center overflow-hidden"
                >
                    {/* Decorative Background Element */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-brand-blue/[0.01] rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
                    
                    <div className="absolute top-5 right-5">
                      {userIsCoordinator ? (
                        <div className="bg-amber-100 p-1.5 rounded-full text-amber-600" title="Coordenador">
                           <Star size={13} fill="currentColor" />
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-1.5 rounded-full text-slate-300">
                           <Info size={13} />
                        </div>
                      )}
                    </div>
                    
                    {/* Avatar with dynamic border */}
                    <div className="relative mb-5">
                      <div className={`w-24 h-24 rounded-[2rem] p-1 ${userIsCoordinator ? 'bg-gradient-to-tr from-brand-yellow to-amber-500' : 'bg-gradient-to-tr from-brand-blue/80 to-cyan-400'} overflow-hidden group-hover:rotate-3 transition-transform duration-500 shadow-lg relative z-10`}>
                        <img src={user.avatar} alt={user.name} className="w-full h-full rounded-[1.8rem] object-cover ring-2 ring-white/10" />
                      </div>
                      {isMe && (
                        <div className="absolute -bottom-1 -right-1 bg-brand-blue text-white p-2 rounded-xl shadow-md z-20 ring-4 ring-white">
                          <CheckCircle2 size={13} strokeWidth={3.5} />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-1.5 mb-5 flex-1 select-none">
                      <h3 className="text-lg font-black text-slate-800 tracking-tight group-hover:text-brand-blue transition-colors leading-tight mb-1">{user.name}</h3>
                      <p className={`text-[8.5px] font-black uppercase tracking-[0.15em] py-1 px-3.5 rounded-full inline-block border ${roleBadgeStyle}`}>
                        {user.role}
                      </p>
                    </div>

                    <div className="flex gap-2 justify-center mb-4 select-none">
                      <div className="flex items-center gap-1 bg-orange-500/5 border border-orange-200/20 px-2.5 py-1 rounded-xl text-[9px] font-extrabold text-orange-600">
                        <Flame size={12} className="text-orange-500 fill-orange-500 shrink-0" />
                        <span>Ativo</span>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-500/5 border border-amber-200/20 px-2.5 py-1 rounded-xl text-[9px] font-extrabold text-amber-700">
                        <Sparkles size={11} className="text-amber-500 shrink-0 animate-pulse" />
                        <span>Pasconero</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 justify-center mb-6 h-[52px] overflow-hidden">
                        {user.skills && user.skills.length > 0 ? (
                            user.skills.slice(0, 3).map((skill, sIdx) => {
                                let skillTagColor = 'bg-slate-50 text-slate-500 border-slate-100';
                                if (skill === 'Transmissão' || skill === 'Vídeo') {
                                  skillTagColor = 'bg-blue-50/50 text-blue-600 border-blue-100/50';
                                } else if (skill === 'Fotografia' || skill === 'Design Gráfico') {
                                  skillTagColor = 'bg-indigo-50/50 text-indigo-600 border-indigo-100/50';
                                } else if (skill === 'Social Media' || skill === 'Redação') {
                                  skillTagColor = 'bg-amber-50/50 text-amber-700 border-amber-100/60';
                                }
                                return (
                                  <span key={`${user.id}-skill-${sIdx}`} className={`text-[9.5px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-xl border ${skillTagColor}`}>
                                    {skill}
                                  </span>
                                );
                            })
                        ) : (
                            <span className="text-[9.5px] font-bold text-slate-400 italic bg-slate-50/50 border border-slate-100/50 px-3 py-1.5 rounded-xl uppercase tracking-wider">
                               🌱 Dons a Preencher
                            </span>
                        )}
                        {user.skills && user.skills.length > 3 && (
                            <span className="text-[9.5px] font-black uppercase tracking-wider bg-slate-900 text-white px-2.5 py-1 rounded-xl shadow-sm">
                              +{user.skills.length - 3}
                            </span>
                        )}
                    </div>

                    <div className="w-full mt-auto">
                        <button className="w-full py-3 bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-500 hover:shadow-md hover:shadow-slate-900/10 text-[9px] font-black uppercase tracking-[0.2em] rounded-xl transition-all flex items-center justify-center gap-1.5 group/btn">
                           Visualizar Perfil <ChevronRight size={13} className="group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </motion.div>
              );
            })}
          </div>
      )}

      {/* MODALS WITH FRAMER MOTION - PORTALED TO BODY */}
      {createPortal(
        <AnimatePresence>
          {selectedAgent && (() => {
            const agent = users.find(u => u.id === selectedAgent.id) || selectedAgent;
            const isCurrentUserCoordinator = isCoordinator(currentUser.role);
            return (
              <div key="agent-details-modal-root" className="fixed inset-0 z-[1000] flex items-end md:items-center justify-center p-0 md:p-6">
                <motion.div 
                    key="agent-details-backdrop"
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                    onClick={() => setSelectedAgent(null)}
                />
                <motion.div 
                    key="agent-details-content"
                    initial={{ scale: 1, y: '100%' }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 1, y: '105%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                    className="bg-white rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden relative z-[1010] flex flex-col md:flex-row h-auto max-h-[85vh] md:max-h-[90vh]"
                >
                    {/* Modal Left / Top Bar */}
                    <div className="w-full md:w-[38%] bg-slate-900 p-6 md:p-10 flex flex-col items-center justify-center text-center relative overflow-hidden shrink-0">
                        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                            <svg viewBox="0 0 100 100" className="w-full h-full fill-white">
                                <circle cx="0" cy="0" r="50" />
                            </svg>
                        </div>
                        
                        <button 
                          onClick={() => setSelectedAgent(null)}
                          className="absolute top-4 right-4 md:hidden p-2 text-white/50 hover:text-white"
                        >
                           <X className="w-6 h-6" />
                        </button>

                        <div className="relative mb-5 z-10 shrink-0">
                            <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] p-1 bg-white/10 backdrop-blur-md shadow-xl overflow-hidden ring-4 ring-white/10">
                              <img src={agent.avatar} alt={agent.name} className="w-full h-full rounded-[1.8rem] object-cover" />
                            </div>
                        </div>

                        <div className="space-y-3 z-10">
                            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight leading-none">{agent.name}</h2>
                            <div className="flex flex-col items-center gap-1.5">
                               <span className="px-3.5 py-1 bg-brand-blue text-white rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20 ring-4 ring-brand-blue/10 inline-block">
                                  {agent.role}
                                </span>
                               {agent.birthday && (
                                 <p className="text-white/40 text-[8.5px] font-black uppercase tracking-widest italic leading-none">{formatBirthday(agent.birthday)}</p>
                               )}
                            </div>
                        </div>
                    </div>

                    {/* Modal Content */}
                    <div className="flex-1 p-6 md:p-10 overflow-y-auto bg-white flex flex-col min-h-0">
                        <div className="hidden md:flex justify-end mb-6">
                           <button onClick={() => setSelectedAgent(null)} className="p-2.5 bg-slate-50 text-slate-300 hover:text-slate-800 rounded-xl transition-all hover:scale-105 active:scale-95">
                              <X size={18} strokeWidth={3.5} />
                           </button>
                        </div>

                        <div className="flex-1 space-y-8 min-h-0">
                            <section>
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="w-8 h-8 bg-brand-blue/5 text-brand-blue rounded-xl flex items-center justify-center">
                                        <Award size={16} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Dons e Talentos</h4>
                                        <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest italic leading-none mt-0.5">Dons a Serviço</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {agent.skills && agent.skills.length > 0 ? (
                                      agent.skills.map((skill, sIdx) => {
                                        let skillTagColor = 'bg-slate-50 text-slate-600 border-slate-100';
                                        if (skill === 'Transmissão' || skill === 'Vídeo') {
                                          skillTagColor = 'bg-blue-50/50 text-blue-600 border-blue-100/50';
                                        } else if (skill === 'Fotografia' || skill === 'Design Gráfico') {
                                          skillTagColor = 'bg-indigo-50/50 text-indigo-600 border-indigo-100/50';
                                        } else if (skill === 'Social Media' || skill === 'Redação') {
                                          skillTagColor = 'bg-amber-50/50 text-amber-700 border-amber-100/60';
                                        }
                                        return (
                                          <span key={`agent-skill-${sIdx}`} className={`px-3 py-2 bg-slate-50 text-slate-600 text-[10px] font-black rounded-lg border uppercase tracking-widest flex items-center gap-1.5 ${skillTagColor}`}>
                                             <div className="w-1 h-1 rounded-full bg-current" />
                                             {skill}
                                          </span>
                                        );
                                      })
                                    ) : (
                                      <p className="text-xs text-slate-400 italic font-medium">Este membro da Pascom ainda não especificou seus dons.</p>
                                    )}
                                </div>
                            </section>

                            {/* Section: Ofensiva e Progresso */}
                            <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="w-8 h-8 bg-orange-500/5 text-orange-500 rounded-xl flex items-center justify-center animate-pulse">
                                        <Flame size={16} className="fill-orange-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Ofensiva e Evolução</h4>
                                        <p className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest italic leading-none mt-0.5">Engajamento na Pastoral</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                                        <Flame size={20} className="text-orange-500 fill-orange-500" />
                                        <div>
                                            <span className="block text-xs font-black text-slate-800 leading-none">{selectedAgentStreak} Dias</span>
                                            <span className="block text-[8px] text-slate-400 font-extrabold uppercase mt-0.5">Ofensiva Ativa</span>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-3">
                                         <Sparkles size={18} className="text-amber-500" />
                                         <div>
                                             <span className="block text-xs font-black text-slate-800 leading-none">{selectedAgentXP} XP</span>
                                             <span className="block text-[8px] text-slate-400 font-extrabold uppercase mt-0.5 font-sans">Nível {Math.floor(selectedAgentXP / 1000) + 1}</span>
                                         </div>
                                    </div>
                                </div>
                            </section>

                            {agent.birthday && (
                              <section className="bg-slate-50/60 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                                  <Calendar size={15} />
                                </div>
                                <div>
                                  <span className="block text-[8.5px] font-black uppercase tracking-widest text-slate-400">Aniversariante</span>
                                  <span className="block text-xs font-black text-slate-700 mt-0.5">Celebra a vida no dia <span className="text-rose-600">{formatBirthday(agent.birthday)}</span></span>
                                </div>
                              </section>
                            )}

                            {isCurrentUserCoordinator && agent.id !== currentUser.id && (
                              <section className="bg-slate-50 p-5 rounded-[1.8rem] border border-slate-100/80 shadow-inner">
                                  <h4 className="text-[9px] font-black text-slate-800 uppercase tracking-[0.2em] mb-4 flex items-center gap-1.5 leading-none">
                                     <Settings size={13} className="text-brand-blue" /> Coordenação e Apoio
                                  </h4>
                                  <div className="space-y-3">
                                      <button 
                                        onClick={() => handleOpenMessageModal(agent)}
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-slate-950 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 active:scale-98 transition-all shadow-md"
                                      >
                                         <Send size={14} /> Enviar Mensagem Direta
                                      </button>
                                      
                                      <div className="flex gap-2.5">
                                        {!isCoordinator(agent.role) && (
                                          <button 
                                              onClick={() => handleUpdateRole(agent.id, UserRole.ADMIN)}
                                              disabled={promotingId === agent.id}
                                              className="flex-1 py-3.5 text-amber-600 bg-white border border-amber-200/50 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-amber-55 hover:text-amber-800 transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                                          >
                                              {promotingId === agent.id ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} fill="currentColor" />}
                                              Tornar Coord.
                                          </button>
                                        )}
                                        {agent.role !== UserRole.TREASURER && (
                                            <button 
                                                onClick={() => handleUpdateRole(agent.id, UserRole.TREASURER)}
                                                disabled={promotingId === agent.id}
                                                className="flex-1 py-3.5 text-brand-blue bg-white border border-brand-blue/20 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-50 transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                                            >
                                                {promotingId === agent.id ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />}
                                                Tornar Tesour.
                                            </button>
                                        )}
                                      </div>

                                      <button 
                                          onClick={() => handleRemoveUser(agent.id, agent.name)}
                                          disabled={removingId === agent.id}
                                          className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100/80 text-red-600 border border-red-200/50 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 mt-1"
                                      >
                                         {removingId === agent.id ? <Loader2 size={14} className="animate-spin text-red-600" /> : <Trash2 size={14} />}
                                         Remover Membro da Pascom
                                      </button>
                                  </div>
                              </section>
                            )}
                        </div>
                    </div>
                </motion.div>
              </div>
            );
          })()}

          {isMessageModalOpen && (
              <div key="message-modal-root" className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
                  <motion.div 
                      key="message-modal-backdrop"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                      onClick={() => setIsMessageModalOpen(false)}
                  />
                  <motion.div 
                      key="message-modal-content"
                      initial={{ opacity: 0, scale: 0.92, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, y: 15 }}
                      className="bg-white rounded-[2.2rem] shadow-2xl w-full max-w-md overflow-hidden relative z-[2010]"
                  >
                      <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-slate-900">
                          <div className="space-y-0.5">
                            <h3 className="text-lg font-black text-white tracking-tight leading-none">
                              {messageTarget?.id ? 'Mensagem Direta' : 'Comunicado Central'}
                            </h3>
                            <p className="text-[9px] font-black text-brand-blue uppercase tracking-widest italic opacity-85 leading-none mt-1">
                              Para: {messageTarget?.name}
                            </p>
                          </div>
                          <button onClick={() => setIsMessageModalOpen(false)} className="p-2 text-white/30 hover:text-white transition-all">
                            <X size={18} strokeWidth={3} />
                          </button>
                      </div>
                      
                      <div className="p-6 md:p-8 space-y-5">
                          <div className="space-y-2">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1.5">Assunto</label>
                            <input 
                                type="text"
                                value={messageForm.title}
                                onChange={(e) => setMessageForm({...messageForm, title: e.target.value})}
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-150 rounded-xl focus:ring-4 focus:ring-brand-blue/5 focus:border-brand-blue outline-none placeholder-slate-300 font-bold transition-all text-xs text-slate-800"
                                placeholder="Título claro da mensagem..."
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1.5">Conteúdo</label>
                            <textarea 
                                value={messageForm.content}
                                onChange={(e) => setMessageForm({...messageForm, content: e.target.value})}
                                className="w-full bg-slate-50 text-slate-800 border border-slate-150 rounded-xl p-5 text-xs font-semibold focus:ring-4 focus:ring-brand-blue/5 focus:border-brand-blue outline-none resize-none h-36 transition-all"
                                placeholder="Escreva a mensagem aqui..."
                            ></textarea>
                          </div>
                      </div>

                      <div className="px-6 pb-6 flex gap-3">
                          <button 
                              onClick={() => setIsMessageModalOpen(false)}
                              className="flex-1 py-3.5 text-slate-400 font-black text-[9px] uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-all"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={handleSendMessage}
                              disabled={!messageForm.title.trim() || !messageForm.content.trim() || isSending}
                              className="flex-[2] py-3.5 bg-brand-blue hover:bg-brand-blue/95 text-white font-black text-[9px] uppercase tracking-widest rounded-xl shadow-lg shadow-brand-blue/15 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                              {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} strokeWidth={3} />}
                              Enviar Comunicado
                          </button>
                      </div>
                  </motion.div>
              </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Custom Confirmation Dialog for Sandbox Iframe Environment */}
      {createPortal(
        <AnimatePresence>
          {confirmDialog && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white rounded-[2rem] p-6 md:p-8 max-w-sm w-full shadow-2xl border border-slate-100/80 flex flex-col items-center text-center focus:outline-none"
              >
                <div className={`p-4 rounded-2xl mb-4 ${
                  confirmDialog.type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
                }`}>
                  {confirmDialog.type === 'danger' ? <Trash2 size={28} /> : <Info size={28} />}
                </div>
                
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-slate-500 font-bold leading-relaxed mb-6">
                  {confirmDialog.message}
                </p>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="flex-1 py-3 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDialog.onConfirm}
                    className={`flex-1 py-3 text-white rounded-xl font-black text-[9px] uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95 shadow-md ${
                      confirmDialog.type === 'danger' 
                        ? 'bg-red-600 hover:bg-red-500 hover:shadow-red-200' 
                        : 'bg-brand-blue hover:bg-brand-blue/95 hover:shadow-blue-200'
                    }`}
                  >
                    Confirmar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Custom Toast System */}
      {createPortal(
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9, x: '-50%' }}
              animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
              exit={{ opacity: 0, y: -10, scale: 0.9, x: '-50%' }}
              className="fixed top-6 left-1/2 z-[120] px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border bg-slate-900 border-slate-800 text-white min-w-[300px] max-w-sm"
              style={{ transform: 'translateX(-50%)' }}
            >
              <div className={`p-1.5 rounded-lg shrink-0 ${
                toast.type === 'error' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {toast.type === 'error' ? <Info size={16} /> : <CheckCircle2 size={16} />}
              </div>
              <p className="text-[11px] font-bold tracking-tight flex-1 leading-normal">
                {toast.message}
              </p>
              <button 
                onClick={() => setToast(null)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
