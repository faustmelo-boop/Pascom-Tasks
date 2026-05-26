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

type Tab = 'dashboard' | 'escalas' | 'tarefas' | 'ava' | 'agentes' | 'patrimonio' | 'tesouro' | 'perfil';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  const [avaBreadcrumbs, setAvaBreadcrumbs] = useState<React.ReactNode | null>(null);
  
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

  if (!session) return <Login />;

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
      case 'tarefas': return <Tasks tasks={tasks} users={users} currentUser={currentUser} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })} />;
      case 'escalas': return <Schedules schedules={schedules} users={users} currentUser={currentUser} onRefresh={refreshData} />;
      case 'ava': return <Ava 
        courses={courses} 
        documents={documents} 
        currentUser={currentUser} 
        users={users} 
        onRefresh={refreshData} 
        onBreadcrumbChange={setAvaBreadcrumbs}
      />;
      case 'agentes': return <Agents users={users} currentUser={currentUser} onRefresh={refreshData} />;
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
      case 'perfil': return <Profile user={currentUser} email={session.user.email} tasks={tasks} schedules={schedules} posts={posts} onUpdate={refreshData} onLogout={handleLogout} />;
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
        <NotificationsPanel notifications={notifications} isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} onMarkAsRead={handleMarkAsRead} onMarkAllAsRead={handleMarkAllAsRead} onClearAll={handleClearAll} onRequestSystemPermissions={requestSystemNotificationPermission} />
        
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
              
              <div className="w-px h-6 bg-slate-200 hidden xl:block" />
              
              <div className="hidden xl:flex items-center min-w-0">
                {activeTab === 'ava' && avaBreadcrumbs && (
                  <div className="animate-in fade-in slide-in-from-left-4 duration-500 whitespace-nowrap overflow-hidden">
                    {avaBreadcrumbs}
                  </div>
                )}
              </div>
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
          className={`flex-1 overflow-y-auto pt-1 pb-24 md:pb-12 hide-scroll transition-all duration-700 ${loading ? 'blur-xl grayscale opacity-50 scale-[0.98]' : 'blur-0 grayscale-0 opacity-100 scale-100'}`}
        >
          <div className="max-w-7xl mx-auto md:px-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {loading && <LoadingScreen />}

        {/* Floating Bottom Nav for Mobile */}
        <nav className="md:hidden fixed bottom-6 left-6 right-6 z-50 bg-brand-blue/90 backdrop-blur-xl rounded-3xl p-2 px-1 shadow-2xl flex items-center justify-around border border-white/10">
          <MobileNavItem tab="dashboard" icon={Home} label="Início" />
          <MobileNavItem tab="escalas" icon={Calendar} label="Escalas" />
          <MobileNavItem tab="tarefas" icon={CheckSquare} label="Tarefas" />
          <MobileNavItem tab="ava" icon={GraduationCap} label="Formação" />
          <MobileNavItem tab="agentes" icon={Users} label="Membros" />
        </nav>
      </main>
    </div>
  );
}

export default App;