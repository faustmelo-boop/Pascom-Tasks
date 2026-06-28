import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Task, TaskStatus, TaskPriority, User, isCoordinator, ScheduleEvent } from '../types';
import { supabase } from '../supabaseClient';
import { lmsService } from '../lmsService';
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
  schedules: ScheduleEvent[];
  users: User[];
  currentUser: User;
  onRefresh: () => void;
}

export const Tasks: React.FC<TasksProps> = ({ tasks, schedules = [], users, currentUser, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'calendar'>('kanban');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');

  // Delete & Error States
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<{title: string, msg: string, code?: string} | null>(null);

  // Compromisso / Agenda States
  const [isCompromissoModalOpen, setIsCompromissoModalOpen] = useState(false);
  const [editingCompromissoId, setEditingCompromissoId] = useState<string | null>(null);
  const [isSavingCompromisso, setIsSavingCompromisso] = useState(false);
  const [compromissoForm, setCompromissoForm] = useState({
    title: '',
    type: 'Missa' as 'Missa' | 'Evento' | 'Reunião',
    date: new Date().toISOString().split('T')[0],
    isMultiDay: false,
    endDate: new Date().toISOString().split('T')[0],
    time: '19:00',
  });

  const getDaysArray = (start: string, end: string) => {
    const arr = [];
    const dt = new Date(start + "T12:00:00");
    const endDt = new Date(end + "T12:00:00");
    while (dt <= endDt) {
      arr.push(new Date(dt).toISOString().split('T')[0]);
      dt.setDate(dt.getDate() + 1);
    }
    return arr;
  };

  const handleOpenCompromissoModal = (schedule?: ScheduleEvent | null, prefilledDate?: string) => {
    setGlobalError(null);
    if (schedule) {
      setEditingCompromissoId(schedule.id);
      setCompromissoForm({
        title: schedule.title,
        type: schedule.type as 'Missa' | 'Evento' | 'Reunião',
        date: schedule.date,
        isMultiDay: false,
        endDate: schedule.date,
        time: schedule.time || '19:00',
      });
    } else {
      setEditingCompromissoId(null);
      const targetDate = prefilledDate || new Date().toISOString().split('T')[0];
      setCompromissoForm({
        title: '',
        type: 'Missa',
        date: targetDate,
        isMultiDay: false,
        endDate: targetDate,
        time: '19:00',
      });
    }
    setIsCompromissoModalOpen(true);
  };

  const handleSaveCompromisso = async () => {
    if (!compromissoForm.title || !compromissoForm.date) return;
    setIsSavingCompromisso(true);
    setGlobalError(null);
    try {
      const datesToSave = [];
      if (compromissoForm.isMultiDay && compromissoForm.endDate && compromissoForm.endDate > compromissoForm.date) {
        datesToSave.push(...getDaysArray(compromissoForm.date, compromissoForm.endDate));
      } else {
        datesToSave.push(compromissoForm.date);
      }

      const isAdminUser = currentUser && isCoordinator(currentUser.role);
      if (!isAdminUser) {
        throw new Error('Apenas coordenadores podem adicionar ou alterar compromissos na agenda.');
      }

      if (editingCompromissoId) {
        // Edit single event
        const { error } = await supabase
          .from('schedules')
          .update({
            title: compromissoForm.title,
            date: compromissoForm.date,
            time: compromissoForm.time,
            type: compromissoForm.type,
          })
          .eq('id', editingCompromissoId);
        if (error) throw error;
      } else {
        // Insert one or multiple events
        const rowsToInsert = datesToSave.map(d => ({
          title: compromissoForm.title,
          date: d,
          time: compromissoForm.time,
          type: compromissoForm.type,
          roles: [] // Empty roles so it acts as "sugestão de escala" on Escalas
        }));

        const { error } = await supabase
          .from('schedules')
          .insert(rowsToInsert);
        if (error) throw error;
      }

      setIsCompromissoModalOpen(false);
      onRefresh(); // Trigger update
    } catch (err: any) {
      console.error(err);
      setGlobalError({ title: 'Erro ao salvar compromisso', msg: err?.message || 'Houve um impedimento técnico.' });
    } finally {
      setIsSavingCompromisso(false);
    }
  };

  const handleDeleteCompromisso = async (id: string) => {
    const isAdminUser = currentUser && isCoordinator(currentUser.role);
    if (!isAdminUser) {
      setGlobalError({ title: 'Permissão Negada', msg: 'Apenas coordenadores podem excluir compromissos.' });
      return;
    }

    setIsSavingCompromisso(true);
    setGlobalError(null);
    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', id);
      if (error) throw error;

      setIsCompromissoModalOpen(false);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setGlobalError({ title: 'Erro ao excluir compromisso', msg: err?.message || 'Houve um impedimento técnico.' });
    } finally {
      setIsSavingCompromisso(false);
    }
  };

  // Scroll lock when modal is open
  useEffect(() => {
    const scrollContainer = document.querySelector('.overflow-y-auto.flex-1');
    const isAnyModalOpen = isModalOpen || deleteId || isCompromissoModalOpen;
    
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
  }, [isModalOpen, deleteId, isCompromissoModalOpen]);

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
        const originalTask = tasks.find(t => t.id === editingId);
        const originallyDone = originalTask ? originalTask.status === TaskStatus.DONE : false;

        const { error } = await supabase
          .from('tasks')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;

        if (payload.status === TaskStatus.DONE && !originallyDone && currentUser) {
          await lmsService.earnXP(currentUser.id, 100);
        }
      } else {
        const { data: newTaskData, error } = await supabase
          .from('tasks')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        finalTaskId = newTaskData.id;

        if (payload.status === TaskStatus.DONE && currentUser) {
          await lmsService.earnXP(currentUser.id, 100);
        }
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

    const getActiveSchedulesForDay = (dayNum: number) => {
      const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      return (schedules || []).filter(s => s.date === dateStr && !s.title.startsWith("[ARCHIVED] "));
    };

    const isCoordinatorUser = currentUser && isCoordinator(currentUser.role);

    // Google Agenda Mobile active days algorithm
    const todayDayNumStr = new Date().toDateString() === new Date(year, currentDate.getMonth(), new Date().getDate()).toDateString() 
      ? new Date().getDate() 
      : null;

    const activeDays: { dayNum: number; tasks: any[]; schedules: any[]; isToday: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayTasks = getTasksForDay(d);
      const daySchedules = getActiveSchedulesForDay(d);
      const isToday = d === todayDayNumStr;

      if (dayTasks.length > 0 || daySchedules.length > 0 || isToday) {
        activeDays.push({
          dayNum: d,
          tasks: dayTasks,
          schedules: daySchedules,
          isToday
        });
      }
    }

    // Week detection for Google Agenda headers
    const getWeekNumber = (d: Date) => {
      const tempDate = new Date(d.getTime());
      tempDate.setHours(0, 0, 0, 0);
      tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
      const week1 = new Date(tempDate.getFullYear(), 0, 4);
      return 1 + Math.round(((tempDate.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    };

    const getWeekIntervalString = (d: Date) => {
      const currentDay = d.getDay();
      const sunday = new Date(d);
      sunday.setDate(d.getDate() - currentDay);
      const saturday = new Date(sunday);
      saturday.setDate(sunday.getDate() + 6);
      
      const sunDay = sunday.getDate();
      const satDay = saturday.getDate();
      const sunMonth = sunday.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
      const satMonth = saturday.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
      
      if (sunMonth === satMonth) {
        return `${sunDay} - ${satDay} de ${sunMonth}`;
      }
      return `${sunDay} de ${sunMonth} - ${satDay} de ${satMonth}`;
    };

    let lastWeekNum: number | null = null;

    return (
      <>
        {/* DESKTOP VIEW -- Monthly Grid */}
        <div className="hidden md:flex flex-col h-full bg-white rounded-[3rem] border border-slate-100 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.06)] overflow-hidden animate-in fade-in zoom-in-95 duration-500">
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
              const daySchedules = day ? getActiveSchedulesForDay(day) : [];
              const isToday = day && new Date().toDateString() === new Date(year, currentDate.getMonth(), day).toDateString();
              const isWeekend = idx % 7 === 0 || idx % 7 === 6;

              return (
                <div 
                  key={idx} 
                  className={`min-h-[140px] border-b border-r border-slate-50 p-4 transition-all group relative ${
                    day ? 'bg-white hover:bg-slate-50/35' : 'bg-slate-50/20'
                  } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
                >
                  {day && (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <span className={`text-xs font-black w-8 h-8 flex items-center justify-center rounded-xl transition-all ${
                          isToday 
                          ? 'bg-brand-blue text-white shadow-xl shadow-brand-blue/30 scale-110' 
                          : isWeekend ? 'text-slate-300' : 'text-slate-800'
                        }`}>
                          {day}
                        </span>
                        {isCoordinatorUser && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                              handleOpenCompromissoModal(null, dateStr);
                            }}
                            title="Agendar Compromisso"
                            className="w-7 h-7 bg-brand-blue/10 text-brand-blue rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity active:scale-90 hover:bg-brand-blue hover:text-white"
                          >
                            <Plus size={12} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto hide-scroll pb-1">
                        {/* Compromissos de Agenda */}
                        {daySchedules.map(schedule => {
                          let badgeColors = 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100';
                          if (schedule.type === 'Missa') {
                            badgeColors = 'bg-amber-50/60 border-amber-100/50 text-amber-700 hover:bg-amber-100/80';
                          } else if (schedule.type === 'Reunião') {
                            badgeColors = 'bg-purple-50/60 border-purple-100/50 text-purple-700 hover:bg-purple-100/80';
                          } else if (schedule.type === 'Evento') {
                            badgeColors = 'bg-emerald-50/60 border-emerald-100/50 text-emerald-700 hover:bg-emerald-100/80';
                          }
                          
                          return (
                            <div 
                              key={schedule.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCompromissoModal(schedule);
                              }}
                              className={`text-[9.5px] font-bold p-2 rounded-xl border truncate cursor-pointer transition-all flex items-center gap-1.5 hover:scale-[1.02] active:scale-95 shadow-sm ${badgeColors}`}
                              title={`${schedule.type}: ${schedule.title} às ${schedule.time}h`}
                            >
                              <CalendarIcon size={10} className="shrink-0 opacity-75" />
                              <span className="font-extrabold text-[8.5px] bg-white px-1 leading-none rounded-[4px] shadow-sm shrink-0">{schedule.time}h</span>
                              <span className="truncate">{schedule.title}</span>
                            </div>
                          );
                        })}

                        {/* Tarefas de Produção */}
                        {dayTasks.map(task => (
                          <motion.div 
                            layoutId={task.id}
                            key={task.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenModal(task);
                            }}
                            className={`text-[9.5px] font-black p-2 rounded-xl border truncate cursor-pointer transition-all uppercase tracking-tight ${
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

        {/* MOBILE VIEW -- Google Agenda Style Timeline */}
        <div className="block md:hidden bg-transparent overflow-visible animate-in fade-in slide-in-from-bottom-8 duration-700 flex flex-col relative select-none">
          {/* Calendar Header Mobile */}
          <div className="flex items-center justify-between py-4 border-b border-slate-100 bg-white/70 sticky top-0 backdrop-blur-md z-30 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-800 capitalize">
                {monthName}
              </span>
              <div className="flex items-center gap-0.5 ml-1">
                <button 
                  onClick={prevMonth}
                  className="p-1 px-1.5 text-slate-500 hover:text-slate-800 rounded-lg active:scale-90 transition-all"
                  title="Mês Anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={nextMonth}
                  className="p-1 px-1.5 text-slate-500 hover:text-slate-800 rounded-lg active:scale-90 transition-all"
                  title="Próximo Mês"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Icons on Header (Lupa, Hoje, Avatar) */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setCurrentDate(new Date())}
                className="relative py-1 px-2.5 text-slate-600 hover:text-slate-800 rounded-xl active:scale-90 transition-all border border-slate-200 bg-white flex items-center justify-center gap-1 shadow-sm"
                title="Hoje"
              >
                <div className="flex flex-col items-center justify-center leading-none">
                  <span className="text-[6.5px] uppercase font-black tracking-widest text-brand-blue">Hoje</span>
                  <span className="text-[11px] font-black">{new Date().getDate()}</span>
                </div>
              </button>
              
              <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shadow-sm shrink-0">
                <img src={currentUser.avatar} alt="Me" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          {/* Agenda Scroll List */}
          <div className="flex-1 pb-24 space-y-2">
            {activeDays.length === 0 ? (
              <div className="text-center py-20 px-8 flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 border border-slate-200/60">
                  <CalendarIcon size={32} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-700">Nenhum compromisso agendado</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-1 max-w-[200px] mx-auto">
                    Não há missas, eventos ou reuniões registradas para o mês de <span className="capitalize text-brand-blue font-extrabold">{monthName}</span>.
                  </p>
                </div>
                {isCoordinatorUser && (
                  <button 
                    onClick={() => handleOpenCompromissoModal()}
                    className="mt-2 px-5 py-2.5 bg-brand-blue text-white rounded-xl font-black text-[9px] uppercase tracking-wider hover:bg-brand-blue/95 active:scale-95 transition-all shadow-md shadow-brand-blue/20"
                  >
                    Agendar Primeiro
                  </button>
                )}
              </div>
            ) : (
              activeDays.map((item) => {
                const itemDate = new Date(year, currentDate.getMonth(), item.dayNum);
                const weekNum = getWeekNumber(itemDate);
                const showWeekHeader = lastWeekNum !== weekNum;
                lastWeekNum = weekNum;

                const weekdayShort = itemDate.toLocaleDateString('pt-BR', { weekday: 'short' }).substring(0, 3);
                
                return (
                  <React.Fragment key={item.dayNum}>
                    {showWeekHeader && (
                      <div className="py-2.5 px-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none select-none italic text-left mt-4 first:mt-0">
                        {getWeekIntervalString(itemDate)}
                      </div>
                    )}

                    <div className={`flex items-start gap-4 py-3 px-3 rounded-2xl transition-all relative group ${item.isToday ? 'bg-brand-blue/5' : ''}`}>
                      {/* Left Column: Day Date */}
                      <div className="w-10 flex flex-col items-center shrink-0 pr-1">
                        <span className={`text-[8.5px] font-black uppercase tracking-wider mb-1 ${item.isToday ? 'text-brand-blue' : 'text-slate-400'}`}>
                          {weekdayShort}
                        </span>
                        {item.isToday ? (
                          <div className="w-8 h-8 rounded-full bg-brand-blue text-white font-black flex items-center justify-center text-sm shadow-md shadow-brand-blue/20">
                            {item.dayNum}
                          </div>
                        ) : (
                          <span className="text-lg font-black text-slate-700 leading-none">
                            {item.dayNum}
                          </span>
                        )}
                      </div>

                      {/* Right Column: Events */}
                      <div className="flex-1 space-y-2 min-w-0">
                        {/* If today is active but empty */}
                        {item.tasks.length === 0 && item.schedules.length === 0 && (
                          <div className="py-3 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] text-slate-400 font-bold italic">
                            Agenda livre de pastoral hoje
                          </div>
                        )}

                        {/* List Schedules */}
                        {item.schedules.map(schedule => {
                          let itemBgColor = 'bg-blue-50/50 hover:bg-blue-50 border-blue-100 text-brand-blue';
                          let typeBadgeColor = 'bg-brand-blue/10 text-brand-blue border-brand-blue/20';
                          let iconBg = 'bg-brand-blue/15 text-brand-blue';
                          
                          if (schedule.type === 'Missa') {
                            itemBgColor = 'bg-amber-50/70 hover:bg-amber-100/50 border-amber-100 text-amber-800';
                            typeBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200/40';
                            iconBg = 'bg-amber-100 text-amber-600';
                          } else if (schedule.type === 'Reunião') {
                            itemBgColor = 'bg-purple-50/70 hover:bg-purple-100/50 border-purple-100 text-purple-800';
                            typeBadgeColor = 'bg-purple-100 text-purple-800 border-purple-200/40';
                            iconBg = 'bg-purple-100 text-purple-600';
                          } else if (schedule.type === 'Evento') {
                            itemBgColor = 'bg-emerald-50/70 hover:bg-emerald-100/50 border-emerald-100 text-emerald-800';
                            typeBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200/40';
                            iconBg = 'bg-emerald-100 text-emerald-600';
                          }

                          return (
                            <div 
                              key={schedule.id}
                              onClick={() => handleOpenCompromissoModal(schedule)}
                              className={`w-full border px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-left transition-all active:scale-[0.98] cursor-pointer shadow-sm ${itemBgColor}`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                                  <CalendarIcon size={14} className="opacity-90" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-extrabold text-slate-800 truncate pr-2">{schedule.title}</h4>
                                  <p className="text-[10px] font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                                    <Clock size={10} className="text-slate-400" /> {schedule.time || '19:00'}h
                                  </p>
                                </div>
                              </div>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border tracking-wider shrink-0 ml-1 leading-normal ${typeBadgeColor}`}>
                                {schedule.type}
                              </span>
                            </div>
                          );
                        })}

                        {/* List Tasks */}
                        {item.tasks.map(task => (
                          <div 
                            key={task.id}
                            onClick={() => handleOpenModal(task)}
                            className={`w-full border px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-left transition-all active:scale-[0.98] cursor-pointer shadow-sm ${
                              task.priority === TaskPriority.HIGH 
                              ? 'border-rose-200 bg-rose-50/50 hover:bg-rose-50' 
                              : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                task.status === TaskStatus.DONE ? 'bg-emerald-150 text-emerald-600 border border-emerald-200/50' : 'bg-white border-slate-200 text-slate-400 shadow-sm'
                              }`}>
                                {task.status === TaskStatus.DONE ? <Check size={12} strokeWidth={3} /> : <Circle size={8} />}
                              </div>
                              <div className="min-w-0">
                                <h4 className={`text-xs font-bold truncate pr-2 ${task.status === TaskStatus.DONE ? 'line-through text-slate-400 font-medium' : 'text-slate-700'}`}>
                                  {task.title}
                                </h4>
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mt-0.5">Produção • {task.priority.toLowerCase()}</p>
                              </div>
                            </div>
                            {task.priority === TaskPriority.HIGH && (
                              <span className="text-[8px] font-black bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded">Alta</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>

          {/* Floater Button (FAB) + inside Mobile container for perfect absolute position */}
          {isCoordinatorUser && (
            <button 
              onClick={() => handleOpenCompromissoModal()}
              className="fixed bottom-24 right-6 z-[80] w-14 h-14 bg-brand-blue hover:bg-brand-blue/95 text-white rounded-2xl active:scale-95 transition-all shadow-xl shadow-brand-blue/30 flex items-center justify-center font-black animate-in zoom-in duration-300"
              title="Agendar Compromisso"
            >
              <Plus size={24} strokeWidth={3} className="text-white" />
            </button>
          )}
        </div>
      </>
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

            {viewMode === 'calendar' && currentUser && isCoordinator(currentUser.role) && (
              <button 
                onClick={() => handleOpenCompromissoModal()}
                className="bg-brand-blue text-white px-7 py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-widest transition-all shadow-[0_20px_40px_-12px_rgba(0,124,186,0.25)] flex items-center justify-center gap-3 hover:scale-105 active:scale-95"
              >
                <CalendarIcon size={18} strokeWidth={3} /> Agendar Compromisso
              </button>
            )}
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
        <>
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
        </AnimatePresence>

        <AnimatePresence>
          {isCompromissoModalOpen && (
            <div className="fixed inset-0 z-[1000] flex items-end md:items-center justify-center p-0 md:p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                onClick={() => setIsCompromissoModalOpen(false)}
              />
              <motion.div 
                initial={{ scale: 1, y: '100%' }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 1, y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="bg-white rounded-t-[2rem] md:rounded-[3rem] w-full max-w-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.25)] flex flex-col max-h-[92vh] md:max-h-[90vh] overflow-hidden relative z-[1010]"
              >
                {/* Modal Header */}
                <div className="px-6 py-6 md:px-10 md:py-10 border-b border-slate-50 flex justify-between items-center bg-slate-900 overflow-hidden relative shrink-0">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
                  <div className="flex items-center gap-4 md:gap-6 relative z-10">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/10 shadow-lg shrink-0">
                      <CalendarIcon className="w-6 h-6 md:w-8 md:h-8" />
                    </div>
                    <div>
                      <h3 className="text-xl md:text-3xl font-black text-white tracking-tighter leading-none mb-1">
                        {editingCompromissoId ? 'Ajustar Agenda' : 'Novo Compromisso'}
                      </h3>
                      <p className="text-[9px] md:text-[10px] font-black text-white/40 uppercase tracking-[0.25em]">
                        Planejamento e Escala Real-time
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setIsCompromissoModalOpen(false)} className="p-3 md:p-4 bg-white/10 text-white/50 hover:text-white rounded-xl md:rounded-[1.5rem] border border-white/5 backdrop-blur-md transition-all active:scale-90 relative z-10">
                    <X className="w-5 h-5 md:w-6 md:h-6" strokeWidth={3} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 md:p-10 overflow-y-auto flex-1 space-y-6 md:space-y-8 hide-scroll">
                  
                  {/* O que teremos */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">O que teremos?</label>
                    <input 
                      type="text" 
                      value={compromissoForm.title}
                      onChange={(e) => setCompromissoForm({...compromissoForm, title: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 px-5 py-4 md:px-6 md:py-5 rounded-2xl font-bold text-sm md:text-base focus:ring-4 focus:ring-brand-blue/5 focus:border-brand-blue outline-none text-slate-800 transition-all placeholder:text-slate-300"
                      placeholder="Ex: Missa de Quinta-feira Santa"
                    />
                  </div>

                  {/* Modalidade / Tipo */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modalidade / Tipo</label>
                    <div className="flex gap-2 md:gap-3">
                      {['Missa', 'Evento', 'Reunião'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setCompromissoForm({...compromissoForm, type: t as any})}
                          className={`flex-1 py-3.5 md:py-4 rounded-xl font-black text-[10px] md:text-[11px] uppercase tracking-widest transition-all ${compromissoForm.type === t ? 'bg-brand-blue text-white shadow-xl shadow-brand-blue/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Multi-dia Toggle */}
                  {!editingCompromissoId && (
                    <div className="flex items-center justify-between p-4 md:p-5 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="space-y-1 pr-4 min-w-0">
                        <h4 className="text-sm font-black text-slate-800 truncate">Evento de múltiplos dias?</h4>
                        <p className="text-[10px] md:text-[11px] text-slate-400 font-bold leading-normal">Cria simultaneamente uma atividade para cada dia do intervalo.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCompromissoForm({...compromissoForm, isMultiDay: !compromissoForm.isMultiDay})}
                        className={`w-12 h-7 md:w-14 md:h-8 rounded-full p-1 transition-colors duration-300 shrink-0 ${compromissoForm.isMultiDay ? 'bg-brand-blue' : 'bg-slate-200'}`}
                      >
                        <div className={`w-5 h-5 md:w-6 md:h-6 rounded-full bg-white transition-transform duration-300 shadow-sm ${compromissoForm.isMultiDay ? 'translate-x-5 md:translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  )}

                  {/* Data e Horário */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pb-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        {compromissoForm.isMultiDay ? 'Data de Início' : 'Data do Evento'}
                      </label>
                      <input 
                        type="date"
                        value={compromissoForm.date}
                        onChange={(e) => setCompromissoForm({...compromissoForm, date: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-100 px-5 py-4 md:px-6 md:py-5 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-brand-blue/5 outline-none text-slate-800"
                      />
                    </div>

                    {compromissoForm.isMultiDay && !editingCompromissoId ? (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data de Término</label>
                        <input 
                          type="date"
                          value={compromissoForm.endDate}
                          onChange={(e) => setCompromissoForm({...compromissoForm, endDate: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 px-5 py-4 md:px-6 md:py-5 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-brand-blue/5 outline-none text-slate-800"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Horário (24h)</label>
                        <input 
                          type="time"
                          value={compromissoForm.time}
                          onChange={(e) => setCompromissoForm({...compromissoForm, time: e.target.value})}
                          className="w-full bg-slate-50 border border-slate-100 px-5 py-4 md:px-6 md:py-5 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-brand-blue/5 outline-none text-slate-800"
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-blue-50/50 border border-blue-100/50 rounded-2xl flex items-start gap-3">
                    <AlertCircle size={16} className="text-brand-blue shrink-0 mt-0.5" />
                    <p className="text-[10.5px] text-brand-blue font-bold leading-normal italic">
                      💡 Este compromisso será registrado de forma unificada e aparecerá na aba "Escalas" como sugestão, onde você ou a equipe poderão atribuir agentes e funções.
                    </p>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-6 md:px-10 md:py-10 bg-slate-50/20 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6 shrink-0">
                  <div className="w-full md:w-auto">
                    {editingCompromissoId && (
                      <button 
                        onClick={() => handleDeleteCompromisso(editingCompromissoId)}
                        disabled={isSavingCompromisso}
                        className="w-full md:w-auto px-6 py-3.5 bg-white text-rose-500 border border-rose-100 hover:bg-rose-50 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all active:scale-95 shadow-sm"
                      >
                        <Trash2 size={14} strokeWidth={3} /> Excluir Compromisso
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 w-full md:w-auto">
                    <button 
                      onClick={() => setIsCompromissoModalOpen(false)}
                      className="w-full sm:w-auto px-8 py-3.5 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all active:scale-95"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleSaveCompromisso}
                      disabled={isSavingCompromisso || !compromissoForm.title}
                      className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-slate-200 hover:bg-brand-blue hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                    >
                      {isSavingCompromisso ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      <span>{editingCompromissoId ? 'Salvar Compromisso' : 'Confirmar'}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        </>,
        document.body
      )}
    </div>
  );
};
