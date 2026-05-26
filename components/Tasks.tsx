import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Task, TaskStatus, TaskPriority, User, isCoordinator } from '../types';
import { supabase } from '../supabaseClient';
import { 
  Calendar as CalendarIcon, CheckCircle2, Clock, 
  AlertCircle, Plus, X, Save, Trash2, ArrowRight, 
  MoreHorizontal, User as UserIcon, Loader2, 
  AlertTriangle, ChevronLeft, ChevronRight, LayoutGrid,
  Search, Filter, CalendarDays, Kanban as KanbanIcon,
  Check, Circle, ChevronDown, Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TasksProps {
  tasks: Task[];
  users: User[];
  currentUser: User;
  onRefresh: () => void;
}

export const Tasks: React.FC<TasksProps> = ({ tasks, users, currentUser, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'calendar'>('kanban');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');

  // Delete & Error States
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<{title: string, msg: string, code?: string} | null>(null);

  // Scroll lock when modal is open
  useEffect(() => {
    const scrollContainer = document.querySelector('.overflow-y-auto.flex-1');
    const isAnyModalOpen = isModalOpen || deleteId;
    
    if (isAnyModalOpen) {
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
  }, [isModalOpen, deleteId]);

  // Form State
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    dueDate: string;
    priority: TaskPriority;
    status: TaskStatus;
    assigneeIds: string[];
    tags: string; // Comma separated string for input
  }>({
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    priority: TaskPriority.MEDIUM,
    status: TaskStatus.TODO,
    assigneeIds: [],
    tags: ''
  });

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => 
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [tasks, searchTerm]);

  // --- Handlers ---

  const handleOpenModal = (task?: Task) => {
    setGlobalError(null);
    if (task) {
      setEditingId(task.id);
      setFormData({
        title: task.title,
        description: task.description || '',
        dueDate: task.dueDate.split('T')[0],
        priority: task.priority,
        status: task.status,
        assigneeIds: task.assigneeIds || [],
        tags: task.tags.join(', ')
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        description: '',
        dueDate: new Date().toISOString().split('T')[0],
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.TODO,
        assigneeIds: [currentUser.id],
        tags: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title) return;
    setLoading(true);
    setGlobalError(null);

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        due_date: formData.dueDate,
        priority: formData.priority,
        status: formData.status,
        assignee_ids: formData.assigneeIds,
        tags: formData.tags.split(',').map(t => t.trim()).filter(t => t !== '')
      };

      let finalTaskId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { data: newTaskData, error } = await supabase
          .from('tasks')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        finalTaskId = newTaskData.id;
      }

      // --- SEND NOTIFICATIONS (Safe Block) ---
      try {
          if (finalTaskId && formData.assigneeIds.length > 0) {
            const notificationsToInsert = formData.assigneeIds
                .map(userId => ({
                    user_id: userId,
                    type: 'task_assigned',
                    title: editingId ? 'Tarefa Atualizada' : 'Nova Tarefa Atribuída',
                    content: `Você foi marcado na tarefa: "${formData.title}"`,
                    related_id: finalTaskId
                }));
            
            if (notificationsToInsert.length > 0) {
                await supabase.from('notifications').insert(notificationsToInsert);
            }
          }
      } catch (notifyError) {
          console.warn("Falha ao enviar notificação (não crítico):", notifyError);
      }

      onRefresh();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Error saving task:', error);
      setGlobalError({
        title: "Erro ao salvar",
        msg: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const onRequestDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    if (editingId) {
        setDeleteId(editingId);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    
    setLoading(true);
    setGlobalError(null);

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', deleteId);
      if (error) throw error;
      
      onRefresh();
      setDeleteId(null);
      setIsModalOpen(false);
    } catch (error: any) {
        console.error("Error deleting task:", error);
        let customError = { title: "Erro ao excluir", msg: error.message, code: error.code };
        if (error.code === '42501') {
            customError.title = "Permissão Negada (RLS)";
            customError.msg = "O Supabase bloqueou a exclusão. Verifique as Policies da tabela 'tasks'.";
        }
        setGlobalError(customError);
        setDeleteId(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setFormData(prev => {
      const exists = prev.assigneeIds.includes(userId);
      if (exists) {
        return { ...prev, assigneeIds: prev.assigneeIds.filter(id => id !== userId) };
      } else {
        return { ...prev, assigneeIds: [...prev.assigneeIds, userId] };
      }
    });
  };

  // --- Subcomponents ---

  const TaskCard: React.FC<{ task: Task }> = ({ task }) => {
    const assignees = users.filter((u) => task.assigneeIds.includes(u.id));
    
    const priorityColors = {
      [TaskPriority.HIGH]: 'bg-rose-50 text-rose-600 border-rose-100',
      [TaskPriority.MEDIUM]: 'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/20',
      [TaskPriority.LOW]: 'bg-brand-green/10 text-brand-green border-brand-green/20',
    };

    return (
      <motion.div 
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -4, scale: 1.02 }}
        onClick={() => handleOpenModal(task)}
        className="bento-card bg-white p-6 shadow-[0_12px_24px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)] hover:border-brand-blue/30 transition-all cursor-pointer group mb-4 relative flex flex-col min-h-[180px] border border-slate-100/50"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-[0.5rem] border ${priorityColors[task.priority]}`}>
              {task.priority}
            </span>
            {task.status === TaskStatus.DONE && (
              <span className="bg-brand-green/10 text-brand-green px-2 py-1 rounded-[0.5rem] border border-brand-green/20 text-[8px] font-black uppercase tracking-[0.2em]">Concluída</span>
            )}
          </div>
          <div className="p-2 transition-all group-hover:bg-brand-blue/5 group-hover:text-brand-blue text-slate-300 rounded-xl">
             <MoreHorizontal size={16} />
          </div>
        </div>
        
        <h4 className="text-slate-800 text-base mb-2 leading-tight tracking-tight group-hover:text-brand-blue transition-colors font-black">{task.title}</h4>
        {task.description && <p className="text-[11px] text-slate-400 font-medium line-clamp-2 mb-4 leading-relaxed font-sans italic opacity-80">{task.description}</p>}
        
        <div className="flex flex-wrap gap-1.5 mt-auto mb-5">
            {task.tags.map(tag => (
                <span key={tag} className="text-[8px] font-black bg-slate-50 text-slate-400 px-2.5 py-1 rounded-full border border-slate-100 uppercase tracking-widest group-hover:bg-brand-blue/5 transition-colors">{tag}</span>
            ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
          <div className="flex -space-x-3">
            {assignees.length > 0 ? assignees.slice(0, 3).map((a) => (
              <img key={a.id} src={a.avatar} alt={a.name} className="w-8 h-8 rounded-xl border-4 border-white object-cover shadow-sm ring-1 ring-slate-100/50" title={a.name} />
            )) : (
                <div className="w-8 h-8 rounded-xl border-4 border-white bg-slate-50 flex items-center justify-center text-slate-200 ring-1 ring-slate-100/50">
                    <UserIcon size={12} />
                </div>
            )}
            {assignees.length > 3 && (
              <div className="w-8 h-8 rounded-xl border-4 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400 tracking-tighter ring-1 ring-slate-100/50">
                +{assignees.length - 3}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 group-hover:text-brand-blue transition-colors">
            <CalendarIcon size={12} />
            <span>{new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
          </div>
        </div>
      </motion.div>
    );
  };

  const Column: React.FC<{ title: string; status: TaskStatus }> = ({ title, status }) => {
    const colors: Record<string, { bg: string; text: string; icon: React.FC<any>; brand: string }> = {
      [TaskStatus.TODO]: { bg: 'bg-slate-100/40', text: 'text-slate-500', icon: AlertCircle, brand: 'slate' },
      [TaskStatus.IN_PROGRESS]: { bg: 'bg-brand-blue/5', text: 'text-brand-blue', icon: Clock, brand: 'brand-blue' },
      [TaskStatus.REVIEW]: { bg: 'bg-brand-yellow/5', text: 'text-brand-yellow', icon: AlertCircle, brand: 'brand-yellow' },
      [TaskStatus.DONE]: { bg: 'bg-brand-green/5', text: 'text-brand-green', icon: CheckCircle2, brand: 'brand-green' },
    };

    const config = colors[status] || colors[TaskStatus.TODO];
    const Icon = config.icon;
    const columnTasks = filteredTasks.filter(t => t.status === status);

    return (
        <div className={`flex flex-col h-full ${config.bg} rounded-[2.5rem] p-4 border border-slate-100/50 shadow-sm transition-all`}>
            <div className="p-4 flex items-center justify-between shrink-0 mb-4">
                <div className="flex items-center gap-4">
                    <div className={`p-3 bg-white rounded-2xl shadow-sm border border-slate-100 ${config.text}`}>
                      <Icon size={20} strokeWidth={3} />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 tracking-tight text-lg leading-none mb-1.5">{title}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${status === TaskStatus.TODO ? 'bg-slate-300' : status === TaskStatus.IN_PROGRESS ? 'bg-brand-blue' : 'bg-brand-green'}`} />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{columnTasks.length} TAREFAS</p>
                      </div>
                    </div>
                </div>
                {status === TaskStatus.TODO && (
                    <button 
                      onClick={() => handleOpenModal()} 
                      className="p-3 bg-white text-brand-blue hover:bg-brand-blue hover:text-white rounded-2xl transition-all border border-slate-100 shadow-sm active:scale-95"
                    >
                        <Plus size={20} strokeWidth={3} />
                    </button>
                )}
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto hide-scroll pb-10 px-1">
                <AnimatePresence mode="popLayout">
                  {columnTasks.map(task => (
                      <TaskCard key={task.id} task={task} />
                  ))}
                </AnimatePresence>
                {columnTasks.length === 0 && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-24 bg-white/40 border-2 border-dashed border-slate-200/50 rounded-[2.5rem] flex flex-col items-center gap-4"
                    >
                        <div className="w-16 h-16 bg-white/60 rounded-3xl flex items-center justify-center text-slate-200 shadow-sm">
                           <LayoutGrid size={32} />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic opacity-60 px-8">Nada nesta coluna por enquanto...</p>
                    </motion.div>
                )}
            </div>
        </div>
    )
  }

  const CalendarView = () => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
    const year = currentDate.getFullYear();

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const weeks = [];
    let week: (number | null)[] = [];

    // Padding for first week
    for (let i = 0; i < firstDayOfMonth; i++) {
      week.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      week.push(i);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    // Padding for last week
    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null);
      }
      weeks.push(week);
    }

    const getTasksForDay = (day: number) => {
      const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return filteredTasks.filter(t => t.dueDate.startsWith(dateStr));
    };

    return (
      <div className="flex flex-col h-full bg-white rounded-[3rem] border border-slate-100 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.06)] overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        {/* Calendar Header */}
        <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-3xl font-black text-slate-800 capitalize tracking-tight leading-none mb-2">{monthName}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{year}</p>
          </div>
          <div className="flex items-center gap-4 bg-white p-2 rounded-[1.5rem] shadow-sm border border-slate-100">
            <button onClick={prevMonth} className="p-3 hover:bg-slate-50 text-slate-400 hover:text-brand-blue rounded-xl transition-all active:scale-90">
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())} 
              className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              Hoje
            </button>
            <button onClick={nextMonth} className="p-3 hover:bg-slate-50 text-slate-400 hover:text-brand-blue rounded-xl transition-all active:scale-90">
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-r border-slate-50 last:border-r-0 italic opacity-60">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 flex-1">
          {weeks.flat().map((day, idx) => {
            const dayTasks = day ? getTasksForDay(day) : [];
            const isToday = day && new Date().toDateString() === new Date(year, currentDate.getMonth(), day).toDateString();
            const isWeekend = idx % 7 === 0 || idx % 7 === 6;

            return (
              <div 
                key={idx} 
                className={`min-h-[140px] border-b border-r border-slate-50 p-4 transition-all group ${
                  day ? 'bg-white hover:bg-slate-50/30' : 'bg-slate-50/20'
                } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
              >
                {day && (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <span className={`text-xs font-black w-8 h-8 flex items-center justify-center rounded-xl transition-all ${
                        isToday 
                        ? 'bg-brand-blue text-white shadow-xl shadow-brand-blue/30 scale-110 mb-1' 
                        : isWeekend ? 'text-slate-300' : 'text-slate-800'
                      }`}>
                        {day}
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-[100px] overflow-y-auto hide-scroll">
                      {dayTasks.map(task => (
                        <motion.div 
                          layoutId={task.id}
                          key={task.id}
                          onClick={() => handleOpenModal(task)}
                          className={`text-[9px] font-black p-2 rounded-xl border truncate cursor-pointer transition-all uppercase tracking-tight ${
                            task.status === TaskStatus.DONE 
                            ? 'bg-brand-green/10 border-brand-green/20 text-brand-green line-through opacity-60' :
                            task.priority === TaskPriority.HIGH 
                            ? 'bg-rose-50 border-rose-100 text-rose-600' :
                            'bg-brand-blue/5 border-brand-blue/10 text-brand-blue'
                          } hover:scale-[1.03] active:scale-95 shadow-sm`}
                          title={task.title}
                        >
                          {task.title}
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pt-1 md:p-8 space-y-6 animate-in fade-in duration-1000">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 py-2">
        <div className="animate-in slide-in-from-left-8 duration-700">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 bg-brand-blue rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-brand-blue/30 rotate-3">
              {viewMode === 'kanban' ? <KanbanIcon size={28} /> : <CalendarIcon size={28} />}
            </div>
            <p className="text-[10px] font-black text-brand-blue uppercase tracking-[0.3em] bg-brand-blue/10 px-4 py-2 rounded-full border border-brand-blue/10">Produção Ativa</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">Tarefas</h1>
          <p className="text-slate-400 font-medium text-lg italic mt-2">Sincronize o ritmo das atividades pastorais com amor.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 animate-in slide-in-from-right-8 duration-700">
            {/* Search & Filter */}
            <div className="relative group min-w-[240px]">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-blue transition-all" size={20} />
                <input 
                  type="text" 
                  placeholder="Buscar tarefa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-14 pr-8 py-4 bg-white rounded-[1.8rem] border border-slate-100 shadow-sm outline-none focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue font-bold text-sm transition-all"
                />
            </div>

            <div className="bg-white border border-slate-100 p-2 rounded-[2rem] flex items-center gap-2 shadow-xl shadow-slate-200/20">
                <button 
                    onClick={() => setViewMode('kanban')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'kanban' ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20 ring-4 ring-brand-blue/10' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                    <LayoutGrid size={16} /> Quadro
                </button>
                <button 
                    onClick={() => setViewMode('calendar')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'calendar' ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20 ring-4 ring-brand-blue/10' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                    <CalendarDays size={16} /> Agenda
                </button>
            </div>

            <button 
              onClick={() => handleOpenModal()}
              className="bg-slate-900 text-white px-8 py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-widest transition-all shadow-[0_20px_40px_-12px_rgba(15,23,42,0.3)] flex items-center justify-center gap-3 hover:scale-105 active:scale-95"
            >
              <Plus size={20} strokeWidth={3} /> Criar Atividade
            </button>
        </div>
      </header>

       {/* Global Error Banner */}
       <AnimatePresence>
        {globalError && (
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] flex items-start gap-5 shadow-xl shadow-rose-200/20"
            >
                <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shadow-sm">
                  <AlertTriangle size={24} strokeWidth={3} />
                </div>
                <div className="flex-1">
                    <h3 className="text-rose-900 font-extrabold tracking-tight">Ops! Algo deu errado</h3>
                    <p className="text-rose-700/80 text-sm mt-1 font-medium italic">{globalError.msg}</p>
                </div>
                <button onClick={() => setGlobalError(null)} className="p-2 text-rose-300 hover:text-rose-600 transition-all rounded-xl hover:bg-white active:scale-90">
                    <X size={20} strokeWidth={3} />
                </button>
            </motion.div>
        )}
       </AnimatePresence>

      {/* Kanban Board or Calendar View */}
      <div className="min-h-[700px] pb-20">
          {viewMode === 'kanban' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 items-start">
                <Column title="Planejadas" status={TaskStatus.TODO} />
                <Column title="Em Andamento" status={TaskStatus.IN_PROGRESS} />
                <Column title="Aguardando" status={TaskStatus.REVIEW} />
                <Column title="Concluídas" status={TaskStatus.DONE} />
            </div>
          ) : (
            <div className="h-full">
              <CalendarView />
            </div>
          )}
      </div>

      {/* CONFIRM DELETE MODAL */}
      {createPortal(
        <AnimatePresence>
          {deleteId && (
              <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
                  <motion.div 
                      key="delete-backdrop"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
                      onClick={() => setDeleteId(null)}
                  />
                  <motion.div 
                      key="delete-content"
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 20 }}
                      className="bg-white rounded-[3rem] shadow-2xl p-10 max-w-sm w-full text-center relative z-[2010]"
                  >
                      <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2.2rem] flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-rose-50/50">
                          <Trash2 size={32} strokeWidth={2.5} />
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-3">Excluir Tarefa?</h3>
                      <p className="text-sm font-medium text-slate-400 mb-10 leading-relaxed px-4 italic">Esta decisão é irreversível. Todas as informações desta atividade serão permanentemente removidas.</p>
                      
                      <div className="flex gap-4">
                          <button 
                            onClick={() => setDeleteId(null)} 
                            className="flex-1 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                            disabled={loading}
                          >
                              Voltar
                          </button>
                          <button 
                            onClick={confirmDelete}
                            disabled={loading}
                            className="flex-1 py-5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-rose-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                          >
                              {loading && <Loader2 size={16} className="animate-spin" />}
                              Confirmar
                          </button>
                      </div>
                  </motion.div>
              </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* TASK FORM MODAL */}
      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
              <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6">
                  <motion.div 
                      key="form-backdrop"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl" 
                      onClick={() => setIsModalOpen(false)} 
                  />
                  <motion.div 
                      key="form-content"
                      initial={{ opacity: 0, scale: 0.9, y: 40 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 40 }}
                      className="bg-white rounded-[3rem] w-full max-w-3xl shadow-[0_64px_128px_-24px_rgba(0,0,0,0.2)] flex flex-col max-h-[90vh] relative z-[1010] overflow-hidden"
                  >
                      {/* Modal Header */}
                      <div className="px-10 py-10 border-b border-slate-50 flex justify-between items-center bg-slate-900 overflow-hidden relative">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
                          <div className="relative z-10">
                              <div className="flex items-center gap-4 mb-2">
                                  <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/10 shadow-lg">
                                      {editingId ? <Edit2 size={24} /> : <Plus size={24} strokeWidth={3} />}
                                  </div>
                                  <h3 className="text-3xl font-black text-white tracking-tight leading-none">
                                      {editingId ? 'Ajustar Atividade' : 'Nova Missão'}
                                  </h3>
                              </div>
                              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-[3.75rem]">Workflow Operacional Pascom</p>
                          </div>
                          <button onClick={() => setIsModalOpen(false)} className="p-4 bg-white/10 text-white/50 hover:text-white rounded-[1.5rem] border border-white/5 backdrop-blur-md transition-all active:scale-90 relative z-10">
                              <X size={24} strokeWidth={3} />
                          </button>
                      </div>
                      
                      {/* Modal Body */}
                      <div className="p-6 md:p-12 overflow-y-auto flex-1 space-y-10 hide-scroll">
                        {/* Title & Status Row */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                            <div className="md:col-span-8">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">O que faremos?</label>
                                <input 
                                    type="text" 
                                    value={formData.title}
                                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                                    className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[1.8rem] focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none placeholder-slate-300 font-extrabold text-slate-800 text-lg transition-all"
                                    placeholder="Ex: Cobertura da Santa Missa"
                                />
                            </div>
                            <div className="md:col-span-4">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Etapa</label>
                                <div className="relative group">
                                    <select 
                                        value={formData.status}
                                        onChange={(e) => setFormData({...formData, status: e.target.value as TaskStatus})}
                                        className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[1.8rem] focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none font-black text-slate-800 uppercase tracking-widest text-[10px] appearance-none cursor-pointer hover:bg-slate-100 transition-all"
                                    >
                                        {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronDown size={14} /></div>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Escopo / Descrição Técnica</label>
                            <textarea 
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                rows={4}
                                className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[1.8rem] focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none resize-none placeholder-slate-300 font-medium text-slate-600 leading-relaxed transition-all"
                                placeholder="Descreva os requisitos, dimensões ou observações importantes..."
                            />
                        </div>

                        {/* Metadata Bento Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/50">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prazo Final</label>
                                    <div className="p-2 bg-white rounded-lg text-brand-blue shadow-sm"><CalendarIcon size={14} /></div>
                                </div>
                                <input 
                                    type="date" 
                                    value={formData.dueDate}
                                    onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                                    className="w-full bg-transparent border-none outline-none font-black text-slate-800 text-sm cursor-pointer"
                                />
                                <button 
                                    onClick={() => setFormData({...formData, dueDate: new Date().toISOString().split('T')[0]})}
                                    className="mt-4 text-[9px] font-black text-brand-blue uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all"
                                >
                                    Agendar para Hoje <ArrowRight size={10} />
                                </button>
                            </div>

                            <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/50">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Urgência</label>
                                    <div className="p-2 bg-white rounded-lg text-rose-500 shadow-sm"><AlertCircle size={14} /></div>
                                </div>
                                <select 
                                    value={formData.priority}
                                    onChange={(e) => setFormData({...formData, priority: e.target.value as TaskPriority})}
                                    className="w-full bg-transparent border-none outline-none font-black text-slate-800 text-[10px] uppercase tracking-[0.2em] appearance-none cursor-pointer"
                                >
                                    {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <div className="mt-4 flex gap-1">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className={`h-1 flex-1 rounded-full ${
                                            formData.priority === TaskPriority.HIGH ? 'bg-rose-500' :
                                            formData.priority === TaskPriority.MEDIUM ? (i <= 2 ? 'bg-brand-yellow' : 'bg-slate-200') :
                                            (i === 1 ? 'bg-brand-green' : 'bg-slate-200')
                                        }`} />
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/50">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tags</label>
                                    <div className="p-2 bg-white rounded-lg text-slate-400 shadow-sm"><Filter size={14} /></div>
                                </div>
                                <input 
                                    type="text" 
                                    value={formData.tags}
                                    onChange={(e) => setFormData({...formData, tags: e.target.value})}
                                    className="w-full bg-transparent border-none outline-none font-black text-slate-800 text-xs placeholder-slate-300"
                                    placeholder="Separe por vírgula..."
                                />
                                <div className="mt-4 flex flex-wrap gap-1">
                                    {formData.tags.split(',').filter(t => t.trim()).slice(0, 2).map((t, i) => (
                                        <span key={i} className="text-[8px] font-black bg-white px-2 py-0.5 rounded-full border border-slate-100 text-slate-400 uppercase tracking-widest">{t.trim()}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Assignees Selection */}
                        <div className="bg-white p-2 rounded-[2.5rem] border border-slate-100 shadow-inner">
                            <div className="p-6">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 ml-2 italic">Responsáveis Designados</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-4 custom-scrollbar">
                                    {users.map(user => {
                                        const isSelected = formData.assigneeIds.includes(user.id);
                                        const isCurrentUser = user.id === currentUser.id;
                                        return (
                                            <motion.div 
                                                layout
                                                key={user.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleAssignee(user.id);
                                                }}
                                                className={`flex items-center gap-4 p-4 rounded-[1.8rem] border transition-all cursor-pointer group ${
                                                    isSelected 
                                                    ? 'bg-brand-blue/5 border-brand-blue/30 shadow-[0_8px_20px_-8px_rgba(59,130,246,0.2)] ring-1 ring-brand-blue/10 scale-[1.02]' 
                                                    : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className={`shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                                    isSelected 
                                                    ? 'bg-brand-blue border-brand-blue shadow-lg shadow-brand-blue/30' 
                                                    : 'bg-slate-100 border-slate-200 group-hover:border-slate-300'
                                                }`}>
                                                    {isSelected ? <Check size={14} className="text-white" strokeWidth={4} /> : <Circle size={10} className="text-slate-300" />}
                                                </div>
                                                <div className="relative shrink-0">
                                                    <img src={user.avatar} className="w-10 h-10 rounded-2xl object-cover ring-2 ring-white shadow-md group-hover:scale-110 transition-transform" alt="" />
                                                    {isCurrentUser && (
                                                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-brand-green border-4 border-white rounded-full shadow-sm"></div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className={`text-[11px] font-black truncate leading-none mb-1.5 ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                                                        {user.name}
                                                    </span>
                                                    <span className={`text-[9px] font-black uppercase tracking-widest truncate ${isSelected ? 'text-brand-blue opacity-100' : 'text-slate-400 opacity-60'}`}>
                                                        {user.role}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="px-10 py-10 bg-slate-50/20 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="w-full sm:w-auto">
                            {editingId && (
                                <button 
                                    onClick={onRequestDelete}
                                    className="w-full sm:w-auto px-8 py-4 bg-white text-rose-500 border border-rose-100 hover:bg-rose-50 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-sm"
                                >
                                    <Trash2 size={16} strokeWidth={3} /> Excluir Atividade
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 sm:flex-none px-10 py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 hover:bg-slate-100 rounded-[1.5rem] transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={loading || !formData.title}
                                className="flex-[2] sm:flex-none px-12 py-5 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[1.8rem] shadow-2xl shadow-slate-200 hover:bg-brand-blue hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                <span>Salvar Alterações</span>
                            </button>
                        </div>
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
