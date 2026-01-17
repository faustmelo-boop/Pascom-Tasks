import React, { useState } from 'react';
import { Task, TaskStatus, TaskPriority, User, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { Calendar, CheckCircle2, Clock, AlertCircle, Plus, X, Save, Trash2, ArrowRight, ArrowLeft, MoreHorizontal, User as UserIcon, Loader2, AlertTriangle } from 'lucide-react';

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

  // Delete & Error States
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<{title: string, msg: string, code?: string} | null>(null);

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

  const isAdmin = currentUser.role === UserRole.ADMIN;

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
        assigneeIds: [],
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

      // --- SEND NOTIFICATIONS ---
      // Notify assigned users (except self)
      if (finalTaskId && formData.assigneeIds.length > 0) {
        const notificationsToInsert = formData.assigneeIds
            .filter(id => id !== currentUser.id)
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
    e.preventDefault(); // prevent form submit if inside form
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
      setIsModalOpen(false); // Close the edit modal as well since the task is gone
    } catch (error: any) {
        console.error("Error deleting task:", error);
        
        let customError = {
            title: "Erro ao excluir",
            msg: error.message,
            code: error.code
        };

        if (error.code === '42501') {
            customError.title = "Permissão Negada (RLS)";
            customError.msg = "O Supabase bloqueou a exclusão. Verifique as Policies da tabela 'tasks'.";
        }
        
        setGlobalError(customError);
        setDeleteId(null); // Close confirm modal to show error on main modal
    } finally {
      setLoading(false);
    }
  };

  const changeStatus = async (task: Task, newStatus: TaskStatus) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id);
      
      if (error) throw error;
      onRefresh();
    } catch (error) {
      console.error('Error changing status', error);
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
      [TaskPriority.HIGH]: 'bg-red-100 text-red-700 border-red-200',
      [TaskPriority.MEDIUM]: 'bg-orange-100 text-orange-700 border-orange-200',
      [TaskPriority.LOW]: 'bg-green-100 text-green-700 border-green-200',
    };

    return (
      <div 
        onClick={() => handleOpenModal(task)}
        className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 hover:border-blue-200 transition-all duration-300 cursor-pointer group mb-3 relative shrink-0"
      >
        <div className="flex justify-between items-start mb-2">
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${priorityColors[task.priority]}`}>
            {task.priority}
          </span>
          {/* Quick Actions overlay on hover */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 bg-white/90 p-1 rounded-md shadow-sm border border-gray-100 flex gap-1">
             <button title="Editar" className="p-1 hover:bg-gray-100 rounded text-gray-600"><MoreHorizontal size={14} /></button>
          </div>
        </div>
        
        <h4 className="font-semibold text-gray-800 text-sm mb-1 leading-tight">{task.title}</h4>
        {task.description && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{task.description}</p>}
        
        <div className="flex flex-wrap gap-1 mb-3">
            {task.tags.map(tag => (
                <span key={tag} className="text-[10px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">{tag}</span>
            ))}
        </div>

        <div className="flex items-center justify-between border-t border-gray-50 pt-2 mt-auto">
          <div className="flex -space-x-2">
            {assignees.length > 0 ? assignees.map((a) => (
              <img key={a.id} src={a.avatar} alt={a.name} className="w-6 h-6 rounded-full border-2 border-white object-cover" title={a.name} />
            )) : (
                <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-gray-400">
                    <UserIcon size={12} />
                </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar size={12} />
            <span>{new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
          </div>
        </div>

        {/* Workflow Arrows */}
        <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-gray-50" onClick={(e) => e.stopPropagation()}>
           {task.status !== TaskStatus.TODO && (
               <button 
                onClick={() => changeStatus(task, task.status === TaskStatus.DONE ? TaskStatus.IN_PROGRESS : TaskStatus.TODO)}
                className="text-xs flex items-center gap-1 text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
               >
                 <ArrowLeft size={12} /> Voltar
               </button>
           )}
           {task.status !== TaskStatus.DONE && (
               <button 
                onClick={() => changeStatus(task, task.status === TaskStatus.TODO ? TaskStatus.IN_PROGRESS : TaskStatus.DONE)}
                className="text-xs flex items-center gap-1 text-blue-600 font-medium hover:bg-blue-50 px-2 py-1 rounded transition-colors ml-auto"
               >
                 Avançar <ArrowRight size={12} />
               </button>
           )}
        </div>
      </div>
    );
  };

  const Column: React.FC<{ title: string; status: TaskStatus }> = ({ title, status }) => {
    const icon = 
        status === TaskStatus.TODO ? <AlertCircle size={18} className="text-gray-500" /> :
        status === TaskStatus.IN_PROGRESS ? <Clock size={18} className="text-blue-500" /> :
        <CheckCircle2 size={18} className="text-green-600" />;

    const columnTasks = tasks.filter(t => t.status === status);

    return (
        <div className="flex flex-col bg-gray-100/50 rounded-xl border border-gray-200/50 h-auto md:h-full">
            <div className="p-4 flex items-center justify-between sticky top-0 bg-gray-100/90 backdrop-blur-sm z-10 rounded-t-xl shrink-0 border-b border-gray-200/50">
                <div className="flex items-center gap-2 font-bold text-gray-700">
                    {icon}
                    <h3>{title}</h3>
                    <span className="bg-white text-gray-600 text-xs px-2 py-0.5 rounded-full border border-gray-200 shadow-sm">{columnTasks.length}</span>
                </div>
                {status === TaskStatus.TODO && (
                    <button onClick={() => handleOpenModal()} className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors">
                        <Plus size={20} />
                    </button>
                )}
            </div>
            {/* Scrollable Area for tasks - On mobile it expands, on desktop it scrolls */}
            <div className="p-3 space-y-3 md:overflow-y-auto md:flex-1 hide-scroll">
                {columnTasks.map(task => (
                    <TaskCard key={task.id} task={task} />
                ))}
                {columnTasks.length === 0 && (
                    <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                        <p className="text-sm">Vazio</p>
                    </div>
                )}
            </div>
        </div>
    )
  }

  return (
    <div className="flex flex-col relative md:h-full md:overflow-hidden pb-20 md:pb-0">
      {/* Header */}
      <div className="p-4 md:p-6 pb-0 flex justify-between items-center shrink-0">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">Fluxo de Tarefas</h2>
            <p className="text-sm text-gray-500">Gerencie atividades e projetos</p>
        </div>
        <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
        >
            <Plus size={18} /> Nova Tarefa
        </button>
      </div>

       {/* Global Error Banner */}
       {globalError && (
        <div className="m-4 md:m-6 mb-0 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm animate-fade-in flex items-start gap-3 shrink-0">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
                <h3 className="text-red-800 font-bold text-sm">{globalError.title}</h3>
                <p className="text-red-700 text-sm mt-1 whitespace-pre-wrap">{globalError.msg}</p>
                {globalError.code && <span className="text-xs text-red-400 mt-2 block font-mono">Code: {globalError.code}</span>}
            </div>
            <button onClick={() => setGlobalError(null)} className="text-red-400 hover:text-red-600">
                <X size={18} />
            </button>
        </div>
      )}

      {/* Kanban Board Container - Stacked on Mobile, Horizontal on Desktop */}
      <div className="p-4 md:p-6 md:flex-1 md:overflow-hidden md:min-h-0">
          <div className="flex flex-col md:flex-row gap-6 md:h-full w-full">
              {/* Wrapper for each column */}
              <div className="w-full md:w-1/3 md:h-full">
                <Column title="A Fazer" status={TaskStatus.TODO} />
              </div>
              <div className="w-full md:w-1/3 md:h-full">
                <Column title="Em Andamento" status={TaskStatus.IN_PROGRESS} />
              </div>
              <div className="w-full md:w-1/3 md:h-full">
                <Column title="Concluído" status={TaskStatus.DONE} />
              </div>
          </div>
      </div>

      {/* CONFIRM DELETE MODAL */}
      {deleteId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
                  <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Excluir Tarefa?</h3>
                  <p className="text-sm text-gray-600 mb-6">Esta ação não pode ser desfeita. A tarefa será removida permanentemente.</p>
                  
                  <div className="flex gap-3">
                      <button 
                        onClick={() => setDeleteId(null)} 
                        className="flex-1 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                        disabled={loading}
                      >
                          Cancelar
                      </button>
                      <button 
                        onClick={confirmDelete}
                        disabled={loading}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                          {loading && <Loader2 size={16} className="animate-spin" />}
                          Excluir
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h3 className="text-lg font-bold text-gray-800">{editingId ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Title & Status Row */}
              <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                    <input 
                        type="text" 
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder-gray-500"
                        placeholder="Ex: Criar arte para Missa"
                    />
                  </div>
                  <div className="w-1/3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select 
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as TaskStatus})}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                    >
                        {Object.values(TaskStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea 
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none resize-none placeholder-gray-500"
                    placeholder="Detalhes da tarefa..."
                />
              </div>

              {/* Metadata Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prazo</label>
                    <input 
                        type="date" 
                        value={formData.dueDate}
                        onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                    <select 
                        value={formData.priority}
                        onChange={(e) => setFormData({...formData, priority: e.target.value as TaskPriority})}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                    >
                        {Object.values(TaskPriority).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                    <input 
                        type="text" 
                        value={formData.tags}
                        onChange={(e) => setFormData({...formData, tags: e.target.value})}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder-gray-500"
                        placeholder="Ex: Foto, Design..."
                    />
                  </div>
              </div>

              {/* Assignees Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Responsáveis</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                    {users.map(user => {
                        const isSelected = formData.assigneeIds.includes(user.id);
                        return (
                            <div 
                                key={user.id}
                                onClick={() => toggleAssignee(user.id)}
                                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                    isSelected ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                    {isSelected && <CheckCircle2 size={12} className="text-white" />}
                                </div>
                                <img src={user.avatar} className="w-6 h-6 rounded-full object-cover" alt="" />
                                <span className="text-sm text-gray-700 truncate">{user.name}</span>
                            </div>
                        )
                    })}
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center rounded-b-2xl">
              <div>
                 {editingId && (
                     <button 
                        onClick={onRequestDelete}
                        className="text-red-500 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                     >
                        <Trash2 size={16} /> Excluir
                     </button>
                 )}
              </div>
              <div className="flex gap-3">
                <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                >
                    Cancelar
                </button>
                <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2"
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};