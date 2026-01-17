import React, { useState, useEffect, useCallback } from 'react';
import { Home, Calendar, CheckSquare, Users, GraduationCap, Bell, Search, Menu, Loader2, LogOut, LayoutGrid, X, UserCircle, Box, Palette } from 'lucide-react';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import { User, Post, Task, ScheduleEvent, Course, AppNotification, InventoryItem, DocumentItem } from './types';
import { Feed } from './components/Feed';
import { Tasks } from './components/Tasks';
import { Schedules } from './components/Schedules';
import { Ava } from './components/Ava';
import { Agents } from './components/Agents';
import { Inventory } from './components/Inventory';
import { Profile } from './components/Profile';
import { Login } from './components/Login';
import { NotificationsPanel } from './components/NotificationsPanel';

/*
  PARA ATIVAR DOCUMENTOS (Tabela 'documents'):
  create table public.documents (
      id uuid default gen_random_uuid() primary key,
      title text not null,
      category text,
      url text not null,
      uploader_id uuid references auth.users,
      size text,
      created_at timestamp with time zone default timezone('utc'::text, now())
  );
  alter table public.documents enable row level security;
  create policy "Todos podem ver documentos" on public.documents for select using (true);
  create policy "Auth users insert" on public.documents for insert with check (auth.role() = 'authenticated');
  create policy "Owner delete" on public.documents for delete using (auth.uid() = uploader_id);
*/

type Tab = 'feed' | 'escalas' | 'tarefas' | 'ava' | 'agentes' | 'patrimonio' | 'perfil';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  // Application State
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Handle Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Define fetch data function to be reusable
  const refreshData = useCallback(async () => {
    if (!session) return;
    
    try {
      // 1. Fetch Profiles (Users)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');
      if (profilesError) throw profilesError;

      const mappedUsers: User[] = (profilesData || []).map((p: any) => ({
        id: p.id,
        // Altera o nome para pegar apenas o primeiro e segundo nome
        name: p.name ? p.name.split(' ').slice(0, 2).join(' ') : 'Sem Nome',
        role: p.role,
        avatar: p.avatar,
        birthday: p.birthday || p.birth_date || p.birthdate || p.data_nascimento || p.nascimento || p.aniversario || '',
        skills: p.skills || []
      }));

      setUsers(mappedUsers);

      const activeUser = mappedUsers.find(u => u.id === session.user.id);
      setCurrentUser(activeUser || null);

      // 2. Fetch Posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .order('timestamp', { ascending: false });
      if (postsError) throw postsError;

      const mappedPosts: Post[] = (postsData || []).map((p: any) => ({
        id: p.id,
        authorId: p.author_id,
        content: p.content,
        type: p.type,
        timestamp: new Date(p.timestamp).toLocaleString('pt-BR'), 
        likes: p.likes || 0,
        comments: p.comments || 0,
        image: p.image,
        pollOptions: p.poll_options
      }));
      setPosts(mappedPosts);

      // 3. Fetch Tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*');
      if (tasksError) throw tasksError;

      const mappedTasks: Task[] = (tasksData || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        assigneeIds: t.assignee_ids || [],
        dueDate: t.due_date,
        priority: t.priority,
        status: t.status,
        tags: t.tags || []
      }));
      setTasks(mappedTasks);

      // 4. Fetch Schedules
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select('*')
        .order('date', { ascending: true }); // Order by date
      if (schedulesError) throw schedulesError;

      const mappedSchedules: ScheduleEvent[] = (schedulesData || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        date: s.date,
        time: s.time,
        type: s.type,
        roles: s.roles || [] 
      }));
      setSchedules(mappedSchedules);

      // 5. Fetch Inventory
      try {
        const { data: inventoryData, error: invError } = await supabase
            .from('inventory')
            .select('*');
        if (invError) throw invError;

        const mappedInventory: InventoryItem[] = (inventoryData || []).map((i: any) => ({
            id: i.id,
            name: i.name,
            description: i.description,
            condition: i.condition,
            status: i.status,
            holderId: i.holder_id,
            image: i.image
        }));
        setInventory(mappedInventory);
      } catch (e: any) {
         console.warn("Could not fetch inventory. Ensure table 'inventory' exists.");
         setInventory([]);
      }

      // 6. Fetch Courses & Progress
      const { data: coursesDataRaw, error: coursesError } = await supabase.from('courses').select('*');
      if (coursesError) throw coursesError;

      const { data: lessonsData, error: lessonsError } = await supabase.from('lessons').select('id, course_id');
      if (lessonsError) throw lessonsError;

      const { data: userProgressData, error: progressError } = await supabase
        .from('user_progress')
        .select('lesson_id, user_id');
      if (progressError) throw progressError;

      const mappedCourses: Course[] = (coursesDataRaw || []).map((c: any) => {
        const courseLessons = (lessonsData || []).filter((l: any) => l.course_id === c.id);
        const totalLessons = courseLessons.length;
        const completedCount = (userProgressData || []).filter((up: any) => 
          activeUser && up.user_id === activeUser.id && 
          courseLessons.some((l: any) => l.id === up.lesson_id)
        ).length;

        const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

        return {
          id: c.id,
          title: c.title,
          category: c.category,
          thumbnail: c.cover_image,
          lessonsCount: totalLessons,
          progress: progressPercent
        };
      });

      setCourses(mappedCourses);

      // 7. Fetch Documents (Library)
      try {
        const { data: docsData, error: docsError } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (docsError) throw docsError;

        const mappedDocs: DocumentItem[] = (docsData || []).map((d: any) => ({
            id: d.id,
            title: d.title,
            category: d.category,
            url: d.url,
            createdAt: d.created_at,
            uploaderId: d.uploader_id,
            size: d.size
        }));
        setDocuments(mappedDocs);
      } catch (e: any) {
         console.warn("Could not fetch documents. Ensure table 'documents' exists.");
         setDocuments([]);
      }

      // 8. Fetch Notifications
      try {
        const { data: notifData, error: notifError } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
        
        if (notifError) throw notifError;

        const mappedNotifs: AppNotification[] = (notifData || []).map((n: any) => ({
            id: n.id,
            userId: n.user_id,
            type: n.type,
            title: n.title,
            content: n.content,
            isRead: n.is_read,
            createdAt: n.created_at,
            relatedId: n.related_id
        }));

        setNotifications(mappedNotifs);

      } catch (e: any) {
         console.warn("Could not fetch notifications. Ensure table 'notifications' exists.");
         setNotifications([]); 
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [session]);

  // Initial Fetch
  useEffect(() => {
    if (session) {
      // Don't set loading(true) here to avoid blocking UI on re-focus
      refreshData().finally(() => setLoading(false));
    }
  }, [session, refreshData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUsers([]);
    setCurrentUser(null);
  };

  // Notification Handlers
  const handleMarkAsRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    try {
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    } catch (e) { console.error(e); }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', session?.user.id);
    } catch (e) { console.error(e); }
  };

  const handleClearAll = async () => {
    setNotifications([]);
     try {
        await supabase.from('notifications').delete().eq('user_id', session?.user.id);
    } catch (e) { console.error(e); }
  };

  const toggleNotifications = () => setNotificationsOpen(!notificationsOpen);

  // Auth Guard
  if (!session) {
    return <Login />;
  }

  // Helper to render active component
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <Loader2 size={40} className="animate-spin mb-4 text-blue-600" />
          <p>Sincronizando com a Pascom...</p>
        </div>
      );
    }

    if (!currentUser) {
      return (
        <div className="flex flex-col items-center justify-center h-full px-4 text-center">
           <Users size={48} className="text-gray-300 mb-4" />
           <h3 className="text-xl font-bold text-gray-700">Perfil não encontrado</h3>
           <p className="text-gray-500 mt-2">Seu usuário está autenticado, mas não possui um perfil associado.</p>
           <button onClick={handleLogout} className="mt-4 text-blue-600 hover:underline">Sair</button>
        </div>
      );
    }

    switch (activeTab) {
      case 'feed': return <Feed posts={posts} users={users} currentUser={currentUser} onRefresh={refreshData} />;
      case 'tarefas': return <Tasks tasks={tasks} users={users} currentUser={currentUser} onRefresh={refreshData} />;
      case 'escalas': return <Schedules schedules={schedules} users={users} currentUser={currentUser} onRefresh={refreshData} />;
      case 'ava': return <Ava courses={courses} documents={documents} currentUser={currentUser} onRefresh={refreshData} />;
      case 'agentes': return <Agents users={users} currentUser={currentUser} onRefresh={refreshData} />;
      case 'patrimonio': return <Inventory items={inventory} users={users} currentUser={currentUser} onRefresh={refreshData} />;
      case 'perfil': return <Profile user={currentUser} email={session.user.email} tasks={tasks} schedules={schedules} posts={posts} onUpdate={refreshData} />;
      default: return <Feed posts={posts} users={users} currentUser={currentUser} onRefresh={refreshData} />;
    }
  };

  const NavItem = ({ tab, icon: Icon, label }: { tab: Tab; icon: React.ElementType; label: string }) => {
    const isActive = activeTab === tab;
    return (
      <button
        onClick={() => {
            setActiveTab(tab);
            setMobileMenuOpen(false);
        }}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left ${
          isActive
            ? 'bg-blue-600 text-white shadow-md'
            : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'
        }`}
      >
        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        <span className="font-medium text-sm">{label}</span>
      </button>
    );
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="h-screen w-full bg-[#F3F4F6] flex overflow-hidden relative">
      
      {/* --- Mobile Sidebar (Drawer) --- */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Sidebar Menu */}
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-out animate-fade-in-right">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-2">
                 <img src="https://i.imgur.com/ofoiwCd.png" alt="Logo" className="h-12 w-auto object-contain" />
               </div>
               <button onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
               </button>
            </div>
            
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              <NavItem tab="feed" icon={LayoutGrid} label="Mural" />
              <NavItem tab="escalas" icon={Calendar} label="Escalas" />
              <NavItem tab="tarefas" icon={CheckSquare} label="Tarefas" />
              <NavItem tab="ava" icon={GraduationCap} label="Formação" />
              <NavItem tab="agentes" icon={Users} label="Agentes" />
              <NavItem tab="patrimonio" icon={Box} label="Patrimônio" />
              
              {/* Canva External Link */}
              <a 
                href="https://www.canva.com/folder/FAFp4SfexIc" 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left text-gray-500 hover:bg-blue-50 hover:text-blue-600"
              >
                <Palette size={20} strokeWidth={2} />
                <span className="font-medium text-sm">Canva</span>
              </a>
            </nav>

            {currentUser && (
              <div className="p-4 border-t border-gray-100 bg-gray-50">
                 <div className="flex items-center gap-3 mb-4 cursor-pointer" onClick={() => { setActiveTab('perfil'); setMobileMenuOpen(false); }}>
                    <img src={currentUser.avatar} alt="Me" className="w-10 h-10 rounded-full object-cover border border-white shadow-sm" />
                    <div>
                        <p className="text-sm font-bold text-gray-900 truncate">{currentUser.name}</p>
                        <p className="text-xs text-blue-600 truncate">{currentUser.role}</p>
                    </div>
                 </div>
                 <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 text-white bg-red-500 hover:bg-red-600 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm"
                 >
                    <LogOut size={16} /> Sair
                 </button>
              </div>
            )}
          </aside>
        </div>
      )}


      {/* Desktop Sidebar (Static) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-full shrink-0 z-50">
        <div className="p-6 border-b border-gray-100 flex items-center justify-center shrink-0">
          <img src="https://i.imgur.com/ofoiwCd.png" alt="Logo" className="h-14 w-auto object-contain" />
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem tab="feed" icon={LayoutGrid} label="Mural" />
          <NavItem tab="escalas" icon={Calendar} label="Escalas" />
          <NavItem tab="tarefas" icon={CheckSquare} label="Tarefas" />
          <NavItem tab="ava" icon={GraduationCap} label="Formação" />
          <NavItem tab="agentes" icon={Users} label="Agentes" />
          <NavItem tab="patrimonio" icon={Box} label="Patrimônio" />

          {/* Canva External Link */}
          <a 
            href="https://www.canva.com/folder/FAFp4SfexIc" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full text-left text-gray-500 hover:bg-blue-50 hover:text-blue-600"
          >
            <Palette size={20} strokeWidth={2} />
            <span className="font-medium text-sm">Canva</span>
          </a>
        </nav>

        {currentUser && (
          <div className="p-4 border-t border-gray-100 shrink-0">
             <div 
                className="bg-blue-50 rounded-xl p-4 flex items-center gap-3 mb-2 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => setActiveTab('perfil')}
                title="Ver meu perfil"
             >
                <img src={currentUser.avatar} alt="Me" className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-gray-900 truncate">{currentUser.name}</p>
                    <p className="text-xs text-blue-600 truncate">{currentUser.role}</p>
                </div>
             </div>
             <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-red-600 hover:bg-red-50 py-2 rounded-lg transition-colors text-sm font-medium"
             >
                <LogOut size={16} /> Sair
             </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative overflow-hidden">
        
        {/* Notifications Panel */}
        <NotificationsPanel 
            notifications={notifications}
            isOpen={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onClearAll={handleClearAll}
        />

        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-gray-200 p-4 shrink-0 flex justify-between items-center shadow-sm z-40 relative h-16">
           {/* Left: Menu Button */}
           <div className="flex items-center">
                <button 
                  onClick={() => setMobileMenuOpen(true)}
                  className="text-gray-700 hover:bg-gray-100 p-1.5 rounded-lg transition-colors"
                >
                  <Menu size={24} />
                </button>
           </div>
           
           {/* Center: Large Logo */}
           <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
               <img src="https://i.imgur.com/ofoiwCd.png" alt="Logo" className="h-10 w-auto object-contain" />
           </div>

           {/* Right: Notifications */}
           <div className="flex gap-2 items-center">
               <button 
                onClick={toggleNotifications}
                className={`relative p-2 rounded-full transition-colors ${notificationsOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
               >
                   <Bell size={22} />
                   {unreadCount > 0 && (
                     <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                   )}
               </button>
           </div>
        </header>

        {/* Desktop Header Stats/Search */}
        <header className="hidden md:flex justify-between items-center p-6 pb-2 shrink-0">
           <div className="flex-1 max-w-md relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
               <input 
                 type="text" 
                 placeholder="Buscar..." 
                 className="w-full bg-white border border-gray-300 rounded-full py-2 pl-10 pr-4 shadow-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-500 outline-none"
               />
           </div>
           <div className="flex items-center gap-4 relative">
              <button 
                onClick={toggleNotifications}
                className={`relative p-2 rounded-full shadow-sm transition-all hover:scale-105 ${notificationsOpen ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-500 hover:text-blue-600'}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>
           </div>
        </header>

        {/* Content Render - Internal Scrolling */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
            {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;