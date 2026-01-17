import React, { useState } from 'react';
import { ScheduleEvent, User, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { Calendar as CalendarIcon, User as UserIcon, Clock, Plus, Trash2, Edit2, X, Check, Loader2, Save, Users, AlertTriangle, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';

interface SchedulesProps {
  schedules: ScheduleEvent[];
  users: User[];
  currentUser: User;
  onRefresh: () => void;
}

// Helper interface for the form form state
interface AssignmentRow {
  userId: string; // empty string means "Vago"
  role: string;
}

export const Schedules: React.FC<SchedulesProps> = ({ schedules, users, currentUser, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Delete States
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<{title: string, msg: string, code?: string} | null>(null);

  // Decline Justification Modal State
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineData, setDeclineData] = useState<{scheduleId: string, roleIndex: number} | null>(null);
  const [justification, setJustification] = useState('');

  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    title: string;
    date: string;
    time: string;
    type: 'Missa' | 'Evento' | 'Reunião';
    assignments: AssignmentRow[];
  }>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '19:00',
    type: 'Missa',
    assignments: [{ userId: '', role: '' }],
  });

  // Robust check for Admin role
  const isAdmin = currentUser && (
    currentUser.role === UserRole.ADMIN || 
    (currentUser.role as string) === 'admin' || 
    (currentUser.role as string) === 'Admin' ||
    (typeof currentUser.role === 'string' && (currentUser.role as string).toLowerCase().includes('coorden'))
  );

  const getUser = (id?: string | null) => users.find((u) => u.id === id);

  // --- Handlers ---

  const handleOpenModal = (schedule?: ScheduleEvent, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setGlobalError(null);
    
    if (schedule) {
      setEditingId(schedule.id);
      
      // Map existing roles to assignment rows
      const existingAssignments: AssignmentRow[] = schedule.roles.map(r => ({
        userId: r.assignedUserId || '',
        role: r.roleName
      }));

      setFormData({
        title: schedule.title,
        date: schedule.date,
        time: schedule.time,
        type: schedule.type,
        assignments: existingAssignments.length > 0 ? existingAssignments : [{ userId: '', role: '' }]
      });
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '19:00',
        type: 'Missa',
        assignments: [{ userId: '', role: '' }]
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.date) return;
    setLoading(true);
    setGlobalError(null);

    try {
      // Find original schedule to preserve status if possible, although simpler to reset if admin edits assignments
      const originalSchedule = editingId ? schedules.find(s => s.id === editingId) : null;

      // Prepare roles structure
      const newRolesStructure = formData.assignments
        .filter(a => a.role.trim() !== '') 
        .map((a, idx) => {
            // Try to keep existing status if the user and role name match the original position
            // This is a basic heuristic. If assignments are reordered, status might be lost, which is acceptable for MVP.
            let existingStatus = 'pending';
            let existingJustification = undefined;
            
            if (originalSchedule && originalSchedule.roles[idx]) {
                const originalRole = originalSchedule.roles[idx];
                if (originalRole.roleName === a.role && originalRole.assignedUserId === a.userId) {
                    existingStatus = originalRole.status || 'pending';
                    existingJustification = originalRole.justification;
                }
            }

            return {
                roleName: a.role,
                assignedUserId: a.userId || null,
                status: a.userId ? existingStatus : undefined,
                justification: existingJustification
            };
        });

      let finalScheduleId = editingId;

      if (editingId) {
        // Edit Mode
        const { error } = await supabase
          .from('schedules')
          .update({
            title: formData.title,
            date: formData.date,
            time: formData.time,
            type: formData.type,
            roles: newRolesStructure
          })
          .eq('id', editingId);

        if (error) throw error;

      } else {
        // Create Mode
        const { data: newSchedule, error } = await supabase
          .from('schedules')
          .insert([{
            title: formData.title,
            date: formData.date,
            time: formData.time,
            type: formData.type,
            roles: newRolesStructure
          }])
          .select()
          .single();

        if (error) throw error;
        finalScheduleId = newSchedule.id;
      }

      // --- NOTIFICATIONS ---
      // Notify users assigned to roles (except self)
      if (finalScheduleId) {
          const usersToNotify = newRolesStructure
            .filter(r => r.assignedUserId && r.assignedUserId !== currentUser.id)
            .map(r => ({
                user_id: r.assignedUserId,
                type: 'schedule_update',
                title: 'Escala Atualizada',
                content: `Você foi escalado para: ${r.roleName} em "${formData.title}" (${new Date(formData.date).toLocaleDateString('pt-BR')})`,
                related_id: finalScheduleId
            }));

           if (usersToNotify.length > 0) {
               await supabase.from('notifications').insert(usersToNotify);
           }
      }

      onRefresh();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error saving schedule:", error);
      setGlobalError({
        title: "Erro ao salvar",
        msg: error.message,
        code: error.code
      });
    } finally {
      setLoading(false);
    }
  };

  const onRequestDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setGlobalError(null);
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setLoading(true);

    try {
        const { error } = await supabase.from('schedules').delete().eq('id', deleteId);
        if (error) throw error;
        
        setDeleteId(null);
        onRefresh();
    } catch (error: any) {
        console.error("Error deleting:", error);
        setGlobalError({
            title: "Erro ao excluir",
            msg: error.message
        });
        setDeleteId(null); 
    } finally {
        setLoading(false);
    }
  };

  // --- Attendance Logic ---

  const handleToggleRole = async (schedule: ScheduleEvent, roleIndex: number) => {
    // "Assumir" logic (Take the role)
    const loadingKey = `${schedule.id}-${roleIndex}`;
    setRoleLoading(loadingKey);
    setGlobalError(null);

    try {
      const role = schedule.roles[roleIndex];
      const newRoles = [...schedule.roles];

      // If assigning self
      if (!role.assignedUserId || role.status === 'declined') {
        newRoles[roleIndex] = { 
            ...role, 
            assignedUserId: currentUser.id, 
            status: 'pending', // Default to pending so they can confirm
            justification: undefined 
        };
      } else {
        // If unassigning (simple 'Sair' without decline flow if needed, but we use Recusar now mainly)
        newRoles[roleIndex] = { ...role, assignedUserId: null, status: undefined, justification: undefined };
      }

      const { error } = await supabase
        .from('schedules')
        .update({ roles: newRoles })
        .eq('id', schedule.id);

      if (error) throw error;
      onRefresh();

    } catch (error: any) {
      console.error("Error toggling role:", error);
      alert(`Erro ao atualizar função: ${error.message}`);
    } finally {
      setRoleLoading(null);
    }
  };

  const handleConfirmPresence = async (schedule: ScheduleEvent, roleIndex: number) => {
    const loadingKey = `${schedule.id}-${roleIndex}`;
    setRoleLoading(loadingKey);
    
    try {
        const newRoles = [...schedule.roles];
        newRoles[roleIndex] = { ...newRoles[roleIndex], status: 'confirmed' };

        const { error } = await supabase
            .from('schedules')
            .update({ roles: newRoles })
            .eq('id', schedule.id);

        if (error) throw error;
        onRefresh();
    } catch (e: any) {
        alert(`Erro ao confirmar: ${e.message}`);
    } finally {
        setRoleLoading(null);
    }
  };

  const handleOpenDeclineModal = (scheduleId: string, roleIndex: number) => {
      setDeclineData({ scheduleId, roleIndex });
      setJustification('');
      setDeclineModalOpen(true);
  }

  const handleSubmitDecline = async () => {
      if (!declineData) return;
      
      const schedule = schedules.find(s => s.id === declineData.scheduleId);
      if (!schedule) return;

      setLoading(true);

      try {
        const newRoles = [...schedule.roles];
        // We keep the assignedUserId so admins see WHO declined, but mark status declined
        newRoles[declineData.roleIndex] = { 
            ...newRoles[declineData.roleIndex], 
            status: 'declined',
            justification: justification 
        };

        const { error } = await supabase
            .from('schedules')
            .update({ roles: newRoles })
            .eq('id', schedule.id);

        if (error) throw error;
        
        onRefresh();
        setDeclineModalOpen(false);
      } catch (e: any) {
          alert(`Erro ao recusar: ${e.message}`);
      } finally {
          setLoading(false);
      }
  };

  // --- Form Assignment Manipulation ---

  const addAssignmentRow = () => {
    setFormData(prev => ({
      ...prev,
      assignments: [...prev.assignments, { userId: '', role: '' }]
    }));
  };

  const removeAssignmentRow = (index: number) => {
    setFormData(prev => ({
      ...prev,
      assignments: prev.assignments.filter((_, i) => i !== index)
    }));
  };

  const updateAssignment = (index: number, field: keyof AssignmentRow, value: string) => {
    const newAssignments = [...formData.assignments];
    newAssignments[index] = { ...newAssignments[index], [field]: value };
    setFormData({ ...formData, assignments: newAssignments });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 pb-24 lg:pb-8 relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">Escalas</h2>
            <p className="text-sm text-gray-500">Próximos eventos e compromissos</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
          >
            <Plus size={18} /> Nova Escala
          </button>
        )}
      </div>

      {/* Global Error Banner */}
      {globalError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg shadow-sm animate-fade-in flex items-start gap-3">
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

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schedules.length === 0 ? (
          <div className="col-span-full text-center py-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
            <CalendarIcon className="mx-auto mb-2 opacity-50" size={48} />
            <p>Nenhuma escala agendada.</p>
          </div>
        ) : (
          schedules.map((event) => (
            <div key={event.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-blue-300 transition-colors group relative">
              
              {/* Admin Actions */}
              {isAdmin && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-white/90 p-1 rounded-lg backdrop-blur-sm border border-gray-100 shadow-sm z-10">
                  <button onClick={(e) => handleOpenModal(event, e)} className="p-1.5 text-gray-600 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors" title="Editar">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={(e) => onRequestDelete(event.id, e)} className="p-1.5 text-gray-600 hover:text-red-600 rounded hover:bg-red-50 transition-colors" title="Excluir">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              {/* Card Header */}
              <div className="bg-gray-50 p-4 border-b border-gray-100 pr-12">
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{event.title}</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                        <CalendarIcon size={14} className="text-blue-500" />
                        <span>{new Date(event.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Clock size={14} className="text-blue-500" />
                        <span>{event.time}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${event.type === 'Missa' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                      {event.type}
                    </span>
                </div>
              </div>
              
              {/* Roles List */}
              <div className="p-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Users size={12} /> Equipe Escalada
                  </h4>
                  <div className="space-y-3">
                      {event.roles.map((role, idx) => {
                          const agent = getUser(role.assignedUserId);
                          const isAssignedToMe = role.assignedUserId === currentUser.id;
                          const isVacant = !role.assignedUserId;
                          const isLoading = roleLoading === `${event.id}-${idx}`;
                          
                          const status = role.status || 'pending';
                          const isDeclined = status === 'declined';
                          const isConfirmed = status === 'confirmed';

                          return (
                              <div key={idx} className={`flex flex-col p-3 rounded-lg border transition-all ${isAssignedToMe ? 'bg-blue-50 border-blue-100' : isDeclined ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                                  <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${isAssignedToMe ? 'bg-blue-200 border-blue-300 text-blue-700' : isDeclined ? 'bg-red-100 border-red-200 text-red-500' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                                              {agent ? (
                                                <img src={agent.avatar} className="w-full h-full rounded-full object-cover" alt="" /> 
                                              ) : (
                                                <UserIcon size={16} />
                                              )}
                                          </div>
                                          <div className="flex flex-col">
                                              <span className="text-sm font-medium text-gray-800">{role.roleName}</span>
                                              <span className={`text-xs ${agent ? 'text-gray-500' : 'text-orange-500 italic'}`}>
                                                  {agent ? agent.name : 'Vago'}
                                              </span>
                                          </div>
                                      </div>
                                      
                                      {/* Status Badge */}
                                      {agent && !isVacant && (
                                          <div className="flex flex-col items-end">
                                              {isConfirmed && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Check size={10} /> Confirmado</span>}
                                              {status === 'pending' && !isDeclined && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">Pendente</span>}
                                              {isDeclined && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">Recusado</span>}
                                          </div>
                                      )}
                                  </div>

                                  {/* Justification Display (if declined) */}
                                  {isDeclined && role.justification && (
                                      <div className="ml-11 text-xs text-red-600 bg-red-50/50 p-2 rounded border border-red-100 mt-1 italic">
                                          "{role.justification}"
                                      </div>
                                  )}

                                  {/* Actions Row */}
                                  <div className="flex justify-end mt-2 gap-2">
                                      {isLoading ? (
                                          <Loader2 size={16} className="animate-spin text-gray-400" />
                                      ) : (
                                          <>
                                              {isAssignedToMe && !isDeclined && (
                                                  <>
                                                      {!isConfirmed && (
                                                          <button 
                                                            onClick={() => handleConfirmPresence(event, idx)}
                                                            className="flex items-center gap-1 text-xs bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm"
                                                          >
                                                              <ThumbsUp size={12} /> Confirmar
                                                          </button>
                                                      )}
                                                      <button 
                                                          onClick={() => handleOpenDeclineModal(event.id, idx)}
                                                          className="flex items-center gap-1 text-xs text-red-600 bg-white border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-md font-medium transition-colors"
                                                      >
                                                          <ThumbsDown size={12} /> Recusar
                                                      </button>
                                                  </>
                                              )}

                                              {(isVacant || isDeclined) && !isAssignedToMe && (
                                                  <button 
                                                    onClick={() => handleToggleRole(event, idx)}
                                                    className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-md font-medium transition-colors"
                                                  >
                                                    Assumir Função
                                                  </button>
                                              )}
                                          </>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CONFIRM DELETE MODAL */}
      {deleteId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
                  <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Excluir Escala?</h3>
                  <p className="text-sm text-gray-600 mb-6">Você tem certeza que deseja remover esta escala? Esta ação não pode ser desfeita.</p>
                  
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

      {/* DECLINE JUSTIFICATION MODAL */}
      {declineModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <h3 className="text-lg font-bold text-red-600 flex items-center gap-2"><ThumbsDown size={18} /> Recusar Escala</h3>
                      <button onClick={() => setDeclineModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                  </div>
                  
                  <div className="p-6">
                      <p className="text-sm text-gray-600 mb-4">Por favor, informe o motivo da recusa para que a coordenação possa se organizar.</p>
                      
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Justificativa</label>
                      <textarea 
                          value={justification}
                          onChange={(e) => setJustification(e.target.value)}
                          className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-100 focus:border-red-300 outline-none resize-none h-32"
                          placeholder="Ex: Tenho um compromisso familiar, estou doente..."
                      ></textarea>
                  </div>

                  <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
                      <button 
                          onClick={() => setDeclineModalOpen(false)}
                          className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors text-sm"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={handleSubmitDecline}
                          disabled={!justification.trim() || loading}
                          className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                      >
                          {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
                          Enviar Justificativa
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">{editingId ? 'Editar Escala' : 'Nova Escala'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título do Evento</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none placeholder-gray-500"
                  placeholder="Ex: Missa de Domingo"
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input 
                    type="date" 
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
                  <input 
                    type="time" 
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                  />
                </div>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <div className="flex gap-2">
                  {['Missa', 'Evento', 'Reunião'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setFormData({...formData, type: t as any})}
                      className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${
                        formData.type === t 
                        ? 'bg-blue-50 border-blue-500 text-blue-700' 
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* ASSIGNMENTS SECTION */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Equipe e Funções</label>
                
                <div className="space-y-2 mb-3 max-h-60 overflow-y-auto pr-1">
                  {formData.assignments.map((assignment, idx) => (
                    <div key={idx} className="flex gap-2 items-start bg-gray-50 p-2 rounded-lg border border-gray-200">
                      
                      {/* Agent Select */}
                      <div className="flex-1">
                        <select 
                            value={assignment.userId}
                            onChange={(e) => updateAssignment(idx, 'userId', e.target.value)}
                            className={`w-full text-sm p-2 rounded border focus:ring-2 focus:ring-blue-100 outline-none ${assignment.userId ? 'bg-white border-gray-300 text-gray-800' : 'bg-yellow-50 border-yellow-200 text-yellow-700 font-medium'}`}
                        >
                            <option value="">(Sem Agente / Vago)</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                      </div>

                      {/* Role Input */}
                      <div className="flex-1">
                        <input 
                          type="text" 
                          placeholder="Função (ex: Fotos)"
                          value={assignment.role}
                          onChange={(e) => updateAssignment(idx, 'role', e.target.value)}
                          className="w-full text-sm p-2 bg-white text-gray-900 border border-gray-300 rounded focus:ring-2 focus:ring-blue-100 outline-none placeholder-gray-500"
                        />
                      </div>

                      {/* Remove Button */}
                      <button 
                        onClick={() => removeAssignmentRow(idx)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remover linha"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  
                  {formData.assignments.length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-4 border border-dashed border-gray-300 rounded-lg">
                        Ninguém escalado ainda.
                    </p>
                  )}
                </div>

                <button 
                    onClick={addAssignmentRow}
                    className="w-full py-2 flex items-center justify-center gap-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 border-dashed transition-colors"
                >
                    <Plus size={16} /> Adicionar Pessoa
                </button>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
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
                {editingId ? 'Salvar Alterações' : 'Criar Escala'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};