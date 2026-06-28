import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Home, Calendar, CheckSquare, Users, GraduationCap, Bell, Search, Menu, Loader2, LogOut, LayoutGrid, X, Box, Palette, Copy, ChevronRight, ClipboardList, DollarSign } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import { 
  User, Post, Task, ScheduleEvent, Course, AppNotification, 
  InventoryItem, DocumentItem, UserRole, isCoordinator,
  FinancialAccount, FinancialCategory, FinancialProject, FinancialTransaction
} from './types';
import * as dataService from './dataService';
import { Feed } from './components/Feed';
import { Tasks } from './components/Tasks';
import { Schedules } from './components/Schedules';
import { Ava } from './components/Ava';
import { Agents } from './components/Agents';
import { Inventory } from './components/Inventory';
import { Profile } from './components/Profile';
import { Login } from './components/Login';
import { NotificationsPanel } from './components/NotificationsPanel';
import { Registrations } from './components/Registrations';
import { FinancialPatrimony } from './components/FinancialPatrimony';
import { Dashboard } from './components/Dashboard';
import { LoadingScreen } from './components/LoadingScreen';
import { OnboardingModal } from './components/OnboardingModal';
import { lmsService } from './lmsService';
import { CertificateView } from './components/lms/CertificateView';
import { LMSCertificate } from './lmsTypes';
import { Award } from 'lucide-react';
import { TonFABChat } from './components/TonFABChat';

type Tab = 'dashboard' | 'escalas' | 'tarefas' | 'ava' | 'agentes' | 'patrimonio' | 'tesouro' | 'perfil' | 'inscricoes';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Shared AVA states to allow changing them from the Profile page
  const [avaViewMode, setAvaViewMode] = useState<'student_dashboard' | 'classroom' | 'instructor_dashboard'>('student_dashboard');
  const [avaActiveCourse, setAvaActiveCourse] = useState<Course | null>(null);

  // Public verification tracker for scanned QR codes or verification links (Zero-Login Public Route)
  const [publicVerifyId, setPublicVerifyId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('verify');
    }
    return null;
  });
  const [publicCertificate, setPublicCertificate] = useState<LMSCertificate | null>(null);
  const [isPublicVerifying, setIsPublicVerifying] = useState(false);
  const [publicVerifyError, setPublicVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (publicVerifyId) {
      const fetchPublicCertificate = async () => {
        setIsPublicVerifying(true);
        setPublicVerifyError(null);
        try {
          const cert = await lmsService.fetchCertificateByCode(publicVerifyId);
          if (cert) {
            setPublicCertificate(cert);
          } else {
            setPublicVerifyError('Código de certificado inválido ou não localizado em nossa base de credenciais.');
          }
        } catch (e) {
          console.error(e);
          setPublicVerifyError('Ocorreu um erro ao conectar com o validador de certificados.');
        } finally {
          setIsPublicVerifying(false);
        }
      };
      fetchPublicCertificate();
    }
  }, [publicVerifyId]);
  
  
  // Application State managed by React Query
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: dataService.fetchUsers,
    enabled: !!session,
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: dataService.fetchPosts,
    enabled: !!session,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: dataService.fetchTasks,
    enabled: !!session,
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: dataService.fetchSchedules,
    enabled: !!session,
  });

  const { data: inventory = [], isLoading: inventoryLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: dataService.fetchInventory,
    enabled: !!session,
  });

  const { data: financialData, isLoading: financialLoading } = useQuery({
    queryKey: ['financial'],
    queryFn: dataService.fetchFinancialData,
    enabled: !!session,
  });

  const currentUser = session ? users.find(u => u.id === session.user.id) || null : null;
  if (currentUser && session?.user?.email) {
    currentUser.email = session.user.email;
  }

  const { data: courses = [], isLoading: coursesLoading } = useQuery({
    queryKey: ['courses', currentUser?.id],
    queryFn: () => dataService.fetchTrainingData(currentUser?.id),
    enabled: !!session && !!users.length,
  });

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications', session?.user.id],
    queryFn: () => dataService.fetchNotifications(session!.user.id),
    enabled: !!session,
  });

  const loading = usersLoading || postsLoading || tasksLoading || schedulesLoading || financialLoading || coursesLoading || inventoryLoading || notificationsLoading;

  const refreshData = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  // Scroll to top on tab change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeTab]);

  // Handle Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- Service Worker Registration for Notifications ---
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Usando caminho relativo direto para garantir que o SW seja registrado na mesma origem.
      // Removido o uso de new URL(..., import.meta.url) que causava erro de construção de URL em certos contextos.
      navigator.serviceWorker.register('sw.js', { scope: './' })
        .then((registration) => {
          console.log('Service Worker Registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker Registration Failed:', error);
        });
    }
  }, []);

  // System Notification Logic
  const requestSystemNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.warn("Notification permission request failed", e);
      }
    }
  }, []);

  // Auto-detect and ask for browser notification permission on load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      requestSystemNotificationPermission();
    }
  }, [requestSystemNotificationPermission]);

  const sendSystemNotification = async (title: string, body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      // Prioridade: Service Worker (para mobile/PWA e background)
      if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.getRegistration('./');
          if (registration && registration.showNotification) {
              await registration.showNotification(title, {
                  body: body,
                  icon: 'https://i.imgur.com/ofoiwCd.png',
                  vibrate: [200, 100, 200],
                  tag: 'pascom-app'
              } as any);
              return;
          }
      }

      // Fallback: API de Notificação Nativa (Desktop)
      new Notification(title, {
        body: body,
        icon: 'https://i.imgur.com/ofoiwCd.png',
        vibrate: [200, 100, 200]
      } as any);
    } catch (e) {
      console.warn('System Notification failed', e);
    }
  };

  const financialAccounts = financialData?.accounts || [];
  const financialCategories = financialData?.categories || [];
  const financialProjects = financialData?.projects || [];
  const financialTransactions = financialData?.transactions || [];
  const documents: DocumentItem[] = []; // Placeholder

  useEffect(() => {
    if (!session?.user?.id) return;
    const playNotificationSound = () => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.05, ctx.currentTime);
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.3);
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) { console.error("Audio failed", e); }
    };

    const channel = supabase.channel('app-realtime-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, (p) => {
         const newNotif: AppNotification = { id: p.new.id, userId: p.new.user_id, type: p.new.type, title: p.new.title, content: p.new.content, isRead: p.new.is_read, createdAt: p.new.created_at, relatedId: p.new.related_id };
         queryClient.setQueryData(['notifications', session.user.id], (prev: any) => [newNotif, ...(prev || [])]);
         playNotificationSound();
         sendSystemNotification(newNotif.title, newNotif.content);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => queryClient.invalidateQueries({ queryKey: ['tasks'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => queryClient.invalidateQueries({ queryKey: ['schedules'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => queryClient.invalidateQueries({ queryKey: ['posts'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => queryClient.invalidateQueries({ queryKey: ['inventory'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => queryClient.invalidateQueries({ queryKey: ['users'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id, queryClient]);

  useEffect(() => { 
    if (session) {
      // Session is valid
    } 
  }, [session]);

  const handleLogout = async () => { 
    await supabase.auth.signOut(); 
    setSession(null); 
    queryClient.clear();
  };

  const handleMarkAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    queryClient.setQueryData(['notifications', session?.user.id], (prev: any) => prev?.map((n: any) => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', session?.user.id);
    queryClient.setQueryData(['notifications', session?.user.id], (prev: any) => prev?.map((n: any) => ({ ...n, isRead: true })));
  };

  const handleClearAll = async () => {
    await supabase.from('notifications').delete().eq('user_id', session?.user.id);
    queryClient.setQueryData(['notifications', session?.user.id], []);
  };

  // Render high-fidelity client-agnostic public certificate validator (Bypasses logins/sessions for external verifiers, e.g., scanning QR codes)
  if (publicVerifyId) {
    return (
      <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-4 md:p-8 font-sans overflow-y-auto">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1b3a70]/10 via-slate-50/50 to-[#f1a80a]/5 -z-10" />
        
        <div className="w-full max-w-5xl bg-white shadow-2xl rounded-[3rem] border border-slate-100 overflow-hidden flex flex-col p-6 md:p-10 text-center relative animate-in zoom-in-95 duration-200">
          <button 
            onClick={() => {
              setPublicVerifyId(null);
              // Clear URL search param silently
              const url = new URL(window.location.href);
              url.searchParams.delete('verify');
              window.history.replaceState({}, '', url.pathname + url.search);
            }}
            className="absolute top-6 right-6 p-2.5 rounded-full bg-slate-50 hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-800 cursor-pointer border border-slate-100 shadow-sm"
            title="Voltar ao início de Pascom Tasks"
          >
            <X size={18} />
          </button>

          {isPublicVerifying ? (
            <div className="py-24 text-center animate-in fade-in duration-300">
              <Loader2 className="animate-spin text-[#1b3a70] mx-auto mb-4" size={40} />
              <p className="text-sm font-black text-slate-500 uppercase tracking-widest animate-pulse">Validando Registro do Certificado...</p>
              <p className="text-xs text-slate-400 mt-2">Segurança em conformidade com as diretrizes eclesiais Pascom</p>
            </div>
          ) : publicVerifyError ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-6">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-red-100">
                <X size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-slate-800">Falha na Autenticação</h3>
                <p className="text-slate-500 font-medium text-xs leading-relaxed">
                  {publicVerifyError}
                </p>
              </div>
              <button
                onClick={() => {
                  setPublicVerifyId(null);
                  const url = new URL(window.location.href);
                  url.searchParams.delete('verify');
                  window.history.replaceState({}, '', url.pathname + url.search);
                }}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider py-4 rounded-2xl cursor-pointer transition-all shadow-md active:scale-95"
              >
                Retornar ao Portal
              </button>
            </div>
          ) : publicCertificate ? (
            <div className="space-y-6 text-left animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-green-50 text-green-600 rounded-[1.2rem] flex items-center justify-center border border-green-150 shadow-sm shrink-0">
                    <Award size={30} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                      Certificado Validado
                      <span className="text-green-500 bg-green-50 border border-green-200 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">Oficial</span>
                    </h3>
                    <p className="text-sm text-slate-500 font-semibold mt-1">Este certificado de Conclusão de Curso Livre é autêntico e foi emitido de forma legítima.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 px-4 py-2.5 rounded-2xl self-start md:self-auto font-mono text-[10px] text-slate-500">
                  <span className="font-bold text-[#1b3a70]">Assinado com Chave Digital do Pároco</span>
                </div>
              </div>

              <CertificateView 
                certificate={publicCertificate} 
                onClose={() => {
                  setPublicVerifyId(null);
                  const url = new URL(window.location.href);
                  url.searchParams.delete('verify');
                  window.history.replaceState({}, '', url.pathname + url.search);
                }} 
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (!session) return <Login />;

  // Se o usuário está pendente de aprovação, exibe a tela de bloqueio com feedback detalhado
  if (currentUser && String(currentUser.role).toLowerCase() === 'pendente') {
    return (
      <div className="min-h-screen w-full bg-[#f8fafc] flex items-center justify-center font-sans overflow-hidden p-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#007cba]/5 via-slate-50 to-[#6cc04a]/5 -z-10" />
        
        <div className="w-full max-w-md bg-white shadow-2xl rounded-[3rem] border border-slate-100 overflow-hidden flex flex-col p-8 md:p-12 text-center relative animate-in zoom-in-95 duration-500">
          <div className="mx-auto mb-8 relative">
            <div className="w-20 h-20 bg-[#007cba]/10 rounded-[1.8rem] flex items-center justify-center text-[#007cba] border border-[#007cba]/15">
              <Users size={36} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-500 border-4 border-white rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white text-[10px] font-black leading-none animate-pulse">●</span>
            </div>
          </div>

          <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
            Aguardando Aprovação
          </h2>
          
          <p className="text-[10px] font-black text-[#007cba] uppercase tracking-[0.2em] bg-[#007cba]/10 px-4 py-1.5 rounded-full inline-block mt-4 mx-auto border border-[#007cba]/10">
            Segurança & Controle de Acesso
          </p>

          <p className="text-slate-500 font-medium text-xs mt-6 leading-relaxed max-w-sm mx-auto">
            Olá, <strong className="text-slate-800">{currentUser.name}</strong>! Para garantir que apenas pessoas ligadas à nossa pastoral tenham acesso aos dados internos e escalas da Pascom, seu cadastro precisa ser aprovado por um Coordenador.
          </p>

          <div className="my-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-4">
            <h4 className="text-[10px] font-black text-slate-850 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Próximos passos
            </h4>
            <ol className="text-xs text-slate-500 font-medium space-y-2 list-decimal list-inside pl-1 leading-relaxed">
              <li>Aguarde o coordenador validar sua participação na pastoral.</li>
              <li>O sistema se atualizará assim que seu perfil for aprovado.</li>
              <li>Clique abaixo para recarregar ou saia para usar outra conta.</li>
            </ol>
          </div>

          <div className="flex gap-4 justify-center items-center">
            <button 
              onClick={refreshData}
              className="flex-1 bg-slate-900 hover:bg-[#007cba] text-white py-4.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-slate-100/50 flex items-center justify-center gap-2 group active:scale-95 cursor-pointer"
            >
              <Loader2 size={14} className="animate-spin text-white" /> Atualizar Status
            </button>

            <button 
              onClick={handleLogout}
              className="bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 py-4.5 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>

          <p className="text-[9px] font-black text-slate-400 mt-8 uppercase tracking-widest select-none">
            Pascom Tasks • Comunidade Conectada
          </p>
        </div>
      </div>
    );
  }

  // Unificação da lógica de Coordenador e admin
  const isUserCoordinator = currentUser && isCoordinator(currentUser.role);

  const renderContent = () => {
    if (!currentUser) return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
         <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
             <Users size={48} className="text-slate-300 mb-4" />
             <h3 className="text-xl font-bold text-slate-700">Perfil não encontrado</h3>
             <button onClick={handleLogout} className="mt-6 text-brand-blue font-semibold hover:underline">Sair</button>
         </div>
      </div>
    );

    switch (activeTab) {
      case 'dashboard': return (
        <Dashboard 
          currentUser={currentUser}
          users={users}
          posts={posts}
          tasks={tasks}
          schedules={schedules}
          transactions={financialTransactions}
          inventory={inventory}
          courses={courses}
          setActiveTab={setActiveTab}
          onRefresh={refreshData}
        />
      );
      case 'tarefas': return <Tasks tasks={tasks} schedules={schedules} users={users} currentUser={currentUser} onRefresh={() => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); queryClient.invalidateQueries({ queryKey: ['schedules'] }); }} />;
      case 'escalas': return <Schedules schedules={schedules} users={users} currentUser={currentUser} onRefresh={refreshData} />;
      case 'ava': return <Ava 
        courses={courses} 
        documents={documents} 
        currentUser={currentUser} 
        users={users} 
        onRefresh={refreshData} 
        viewMode={avaViewMode}
        setViewMode={setAvaViewMode}
        activeCourse={avaActiveCourse}
        setActiveCourse={setAvaActiveCourse}
      />;
      case 'agentes': return <Agents users={users} currentUser={currentUser} onRefresh={refreshData} onTabChange={(tab: any) => setActiveTab(tab)} />;
      case 'inscricoes': return <Registrations currentUser={currentUser!} />;
      case 'patrimonio': return <Inventory items={inventory} users={users} currentUser={currentUser} onRefresh={refreshData} />;
      case 'tesouro': return (
        <FinancialPatrimony 
          accounts={financialAccounts}
          categories={financialCategories}
          projects={financialProjects}
          transactions={financialTransactions}
          currentUser={currentUser}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['financial'] })}
        />
      );
      case 'perfil': return (
        <Profile 
          user={currentUser} 
          email={session.user.email} 
          tasks={tasks} 
          schedules={schedules} 
          posts={posts} 
          onUpdate={refreshData} 
          onLogout={handleLogout} 
          onNavigateToAva={(mode) => {
            setAvaViewMode(mode);
            setAvaActiveCourse(null);
            setActiveTab('ava');
          }}
        />
      );
      default: return <Feed posts={posts} users={users} currentUser={currentUser} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['posts'] })} />;
    }
  };

  const MobileNavItem = ({ tab, icon: Icon, label }: { tab: Tab; icon: React.ElementType; label: string }) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => setActiveTab(tab)}
        className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all relative z-10 ${
            isActive ? 'text-white' : 'text-white/50 hover:text-white/80'
        }`}
      >
        <div className="relative p-1.5 flex items-center justify-center">
            {isActive && (
              <motion.div 
                layoutId="mobileActiveTab"
                className="absolute inset-0 bg-white/20 rounded-xl"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <motion.div
              animate={{ 
                scale: isActive ? 1.1 : 1,
                color: isActive ? '#4ade80' : 'rgba(255, 255, 255, 0.5)' // brand-green
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Icon size={20} fill={isActive ? 'currentColor' : 'none'} fillOpacity={0.2} />
            </motion.div>
        </div>
        <span className={`text-[9px] font-black uppercase tracking-tighter transition-all ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
      </button>
    );
};

  const DesktopNavItem = ({ tab, icon: Icon, label }: { tab: Tab; icon: React.ElementType; label: string }) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => setActiveTab(tab)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all relative group h-10 ${
            isActive 
                ? 'text-brand-blue font-black' 
                : 'text-slate-400 font-bold hover:text-slate-600 hover:bg-slate-50'
        }`}
      >
        <motion.div
          animate={{ scale: isActive ? 1.1 : 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className="relative z-10"
        >
          <Icon size={18} strokeWidth={isActive ? 3 : 2} />
        </motion.div>
        <span className="text-[11px] uppercase tracking-widest relative z-10">{label}</span>
        {isActive && (
          <motion.div 
            layoutId="activeTabUnderline"
            className="absolute -bottom-1 left-4 right-4 h-1 bg-brand-blue rounded-full shadow-[0_4px_12px_rgba(0,124,186,0.3)]"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
        {!isActive && (
          <motion.div 
            layoutId="hoverTab"
            className="absolute inset-0 bg-slate-200/0 group-hover:bg-slate-200/50 rounded-xl -z-0 transition-colors"
          />
        )}
      </button>
    );
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] flex flex-col overflow-hidden relative font-sans text-slate-900">
      <main className="flex-1 flex flex-col h-full min-w-0 relative overflow-hidden">
        <NotificationsPanel notifications={notifications} isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} onMarkAsRead={handleMarkAsRead} onMarkAllAsRead={handleMarkAllAsRead} onClearAll={handleClearAll} onRequestSystemPermissions={requestSystemNotificationPermission} currentUser={currentUser} />
        
        <AnimatePresence>
          {currentUser && currentUser.onboarding_completed === false && (
            <OnboardingModal user={currentUser} onComplete={refreshData} />
          )}
        </AnimatePresence>

        {/* Mobile Header */}
        <header className="md:hidden bg-white/80 backdrop-blur-md border-b border-slate-100 py-2 px-4 shrink-0 flex justify-between items-center z-50 sticky top-0">
           <div className="flex items-center gap-2">
              <img src="https://i.imgur.com/ofoiwCd.png" alt="Pascom Tasks" className="h-8 w-auto" />
           </div>
           <div className="flex items-center gap-3">
              <button 
                onClick={() => setActiveTab(prev => prev === 'perfil' ? 'dashboard' : 'perfil')}
                className={`w-10 h-10 rounded-xl overflow-hidden border-2 shadow-sm transition-all ${
                  activeTab === 'perfil' ? 'border-brand-blue scale-95' : 'border-white'
                }`}
              >
                 {currentUser && <img src={currentUser.avatar} alt="Profile" className="w-full h-full object-cover" />}
              </button>
              <button onClick={() => setNotificationsOpen(true)} className="relative bg-slate-100 p-2.5 rounded-xl transition-all active:scale-95"><Bell size={22} /> {notifications.filter(n => !n.isRead).length > 0 && <span className="absolute top-1.5 right-2 w-2 h-2 bg-brand-yellow rounded-full"></span>}</button>
           </div>
        </header>
 
        {/* Modern Desktop Navbar Integrated Header */}
        <header className="hidden md:flex justify-between items-center px-10 h-20 shrink-0 z-50 sticky top-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-[0_1px_5px_-1px_rgba(0,0,0,0.02)]">
           {/* Left: Brand + Breadcrumbs (Contextual) */}
           <div className="w-[30%] flex items-center gap-6">
              <button onClick={() => setActiveTab('dashboard')} className="shrink-0 hover:scale-105 transition-transform active:scale-95">
                <img src="https://i.imgur.com/ofoiwCd.png" alt="Pascom Tasks" className="h-10 w-auto" />
              </button>
              
              {/* Content left empty */}
           </div>

           {/* Center: Main Navigation */}
           <nav className="flex items-center gap-2 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/40 shadow-inner">
              <DesktopNavItem tab="dashboard" icon={Home} label="Início" />
              <DesktopNavItem tab="escalas" icon={Calendar} label="Escalas" />
              <DesktopNavItem tab="tarefas" icon={CheckSquare} label="Tarefas" />
              <DesktopNavItem tab="ava" icon={GraduationCap} label="Formação" />
              <DesktopNavItem tab="agentes" icon={Users} label="Membros" />
               

           </nav>

           {/* Right: Notifications + Identity */}
           <div className="w-[30%] flex items-center justify-end gap-5">
              <button onClick={() => setNotificationsOpen(true)} className="relative p-3 rounded-2xl bg-white border border-slate-100 shadow-sm text-slate-600 hover:text-brand-blue transition-all hover:shadow-md hover:border-brand-blue/20 group">
                <Bell size={20} className="group-hover:rotate-12 transition-transform" /> 
                {notifications.filter(n => !n.isRead).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-blue text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-in zoom-in">
                        {notifications.filter(n => !n.isRead).length}
                    </span>
                )}
              </button>

              <div className="w-px h-8 bg-slate-200" />
              
              {currentUser && (
                <div className="flex items-center gap-4 bg-brand-blue shadow-xl shadow-brand-blue/10 p-1.5 pr-5 rounded-[1.8rem] transition-all hover:scale-[1.02] active:scale-95 cursor-pointer" onClick={() => setActiveTab('perfil')}>
                   <div className="relative">
                      <img src={currentUser.avatar} alt="Me" className="w-9 h-9 rounded-2xl object-cover shadow-sm border-2 border-white/20" />
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-brand-green border-2 border-brand-blue rounded-full shadow-sm" />
                   </div>
                   <div className="hidden lg:block text-left">
                      <p className="text-[11px] font-black text-white truncate tracking-tight leading-none mb-1">{currentUser.name.split(' ')[0]}</p>
                      <p className="text-[8px] uppercase font-bold text-white/60 tracking-wider">
                          {currentUser.role}
                      </p>
                   </div>
                </div>
              )}
           </div>
        </header>

        <div 
          ref={scrollRef}
          className={`flex-1 pt-1 pb-12 hide-scroll transition-all duration-700 overflow-y-auto ${loading ? 'blur-xl grayscale opacity-50 scale-[0.98]' : 'blur-0 grayscale-0 opacity-100 scale-100'}`}
        >
          <div className="max-w-7xl mx-auto md:px-6 w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={activeTab === 'ava' ? 'w-full lg:h-full lg:max-h-full lg:flex lg:flex-col lg:min-h-0' : 'w-full'}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {loading && <LoadingScreen />}

        {/* Floating Sandwich Page Menu Overlay for Mobile */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.35 }}
              className="md:hidden fixed bottom-24 left-6 right-6 z-50 bg-slate-900/95 backdrop-blur-xl rounded-[2.5rem] p-6 shadow-2xl border border-white/10 flex flex-col gap-4 text-white"
            >
              <div className="grid grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
                {[
                  { tab: 'dashboard', icon: Home, label: 'Início', color: '#4ade80' },
                  { tab: 'escalas', icon: Calendar, label: 'Escalas', color: '#60a5fa' },
                  { tab: 'tarefas', icon: CheckSquare, label: 'Tarefas', color: '#f87171' },
                  { tab: 'ava', icon: GraduationCap, label: 'Formação', color: '#facc15' },
                  { tab: 'agentes', icon: Users, label: 'Membros', color: '#fb923c' },
                  { tab: 'patrimonio', icon: Box, label: 'Patrimônio', color: '#a78bfa' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.tab;
                  return (
                    <button
                      key={item.tab}
                      onClick={() => {
                        setActiveTab(item.tab as Tab);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex flex-col items-start gap-2.5 p-4 rounded-3xl transition-all border text-left scale-98 active:scale-95 cursor-pointer ${
                        isActive 
                          ? 'bg-white/15 border-white/30 ring-2 ring-white/15' 
                          : 'bg-white/5 border-transparent hover:bg-white/10'
                      }`}
                    >
                      <div className="p-2.5 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${item.color}15`, color: item.color }}>
                        <Icon size={18} strokeWidth={2.5} />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-white">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating circular menu button (hamburger menu button) styled aligned to bottom right, harmoniously below Ton */}
        <motion.button
          id="btn-mobile-menu-fab"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-brand-blue flex items-center justify-center shadow-[0_8px_30px_rgba(15,23,42,0.35)] hover:shadow-[0_12px_45px_rgba(15,23,42,0.45)] border-2 border-white cursor-pointer"
        >
          {mobileMenuOpen ? (
            <X size={24} className="text-white" />
          ) : (
            <Menu size={24} className="text-white" />
          )}
        </motion.button>
        
        {/* Persistent Floating Chat Assistant (Ton) for schedules, tasks and agenda */}
        {activeTab !== 'ava' && (
          <TonFABChat 
            currentUser={currentUser} 
            tasks={tasks} 
            schedules={schedules} 
            users={users} 
          />
        )}
      </main>
    </div>
  );
}

export default App;