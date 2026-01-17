import React, { useState, useRef } from 'react';
import { User, Task, ScheduleEvent, Post, TaskStatus } from '../types';
import { supabase } from '../supabaseClient';
import { Camera, Mail, Calendar, Briefcase, Save, X, Award, CheckCircle2, Layout, Edit2, Loader2, UserCircle, Lock } from 'lucide-react';

interface ProfileProps {
  user: User;
  email?: string;
  tasks: Task[];
  schedules: ScheduleEvent[];
  posts: Post[];
  onUpdate: () => void;
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

export const Profile: React.FC<ProfileProps> = ({ user, email, tasks, schedules, posts, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password Change States
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ new: '', confirm: '' });

  // Form State
  const [formData, setFormData] = useState({
    name: user.name,
    birthday: user.birthday
  });
  
  const [skills, setSkills] = useState<string[]>(user.skills || []);

  // Stats Calculation
  const stats = {
    tasksCompleted: tasks.filter(t => t.assigneeIds.includes(user.id) && t.status === TaskStatus.DONE).length,
    tasksPending: tasks.filter(t => t.assigneeIds.includes(user.id) && t.status !== TaskStatus.DONE).length,
    schedulesCount: schedules.filter(s => s.roles.some(r => r.assignedUserId === user.id)).length,
    postsCount: posts.filter(p => p.authorId === user.id).length
  };

  // Helper to fix timezone issue on birthday display
  const formatBirthday = (dateString: string) => {
    if (!dateString) return 'Não informado';
    // Split YYYY-MM-DD to avoid timezone shifting when creating Date object
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
      // Upload to 'avatars' bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars') // Make sure this bucket exists or use a generic one
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      
      // Update profile
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
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          birthday: formData.birthday,
          skills: skills
        })
        .eq('id', user.id);

      if (error) throw error;
      
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

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24 lg:pb-8 animate-fade-in">
      
      {/* Cover & Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 relative">
        <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
        <div className="px-6 pb-6 relative">
            <div className="flex flex-col md:flex-row items-center md:items-end -mt-12 gap-4">
                {/* Avatar */}
                <div className="relative group">
                    <img 
                        src={user.avatar || "https://via.placeholder.com/150"} 
                        alt={user.name} 
                        className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white object-cover shadow-md bg-white"
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-transform hover:scale-110"
                        title="Alterar foto"
                    >
                        <Camera size={16} />
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                </div>

                {/* Info */}
                <div className="flex-1 text-center md:text-left mb-2 md:mb-0">
                    <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
                    <p className="text-blue-600 font-medium">{user.role}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4 md:mt-0 flex-wrap justify-center">
                    {isEditing ? (
                        <>
                            <button 
                                onClick={() => setIsEditing(false)}
                                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                Salvar
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={() => setIsPasswordModalOpen(true)}
                                className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                <Lock size={16} /> <span className="hidden sm:inline">Alterar Senha</span>
                            </button>
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="px-4 py-2 bg-gray-800 text-white hover:bg-gray-900 rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                <Edit2 size={16} /> Editar Perfil
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Stats */}
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Award className="text-yellow-500" size={20} /> Impacto
                </h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 text-green-600 rounded-lg"><CheckCircle2 size={18} /></div>
                            <span className="text-sm text-gray-600">Tarefas Feitas</span>
                        </div>
                        <span className="font-bold text-gray-900">{stats.tasksCompleted}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Calendar size={18} /></div>
                            <span className="text-sm text-gray-600">Escalas</span>
                        </div>
                        <span className="font-bold text-gray-900">{stats.schedulesCount}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Layout size={18} /></div>
                            <span className="text-sm text-gray-600">Posts no Mural</span>
                        </div>
                        <span className="font-bold text-gray-900">{stats.postsCount}</span>
                    </div>
                </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-xl shadow-md text-white">
                 <h3 className="font-bold text-lg mb-2">Cartão do Agente</h3>
                 <p className="text-blue-100 text-sm mb-4">Membro ativo da Pastoral da Comunicação.</p>
                 <div className="flex items-center gap-3">
                    <UserCircle size={40} className="text-blue-200" />
                    <div>
                        <p className="font-bold uppercase tracking-wider text-sm">{user.role}</p>
                        <p className="text-xs text-blue-200">Desde 2023</p>
                    </div>
                 </div>
            </div>
        </div>

        {/* Right Column: Details */}
        <div className="md:col-span-2 space-y-6">
            
            {/* Personal Info */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4">Informações Pessoais</h3>
                
                {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                            <input 
                                type="text" 
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                            <input 
                                type="date" 
                                value={formData.birthday}
                                onChange={(e) => setFormData({...formData, birthday: e.target.value})}
                                className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-start gap-3">
                            <Mail className="text-gray-400 mt-0.5" size={18} />
                            <div>
                                <p className="text-sm text-gray-500">E-mail</p>
                                <p className="font-medium text-gray-900">{email || 'Não informado'}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Calendar className="text-gray-400 mt-0.5" size={18} />
                            <div>
                                <p className="text-sm text-gray-500">Nascimento</p>
                                <p className="font-medium text-gray-900">
                                    {formatBirthday(user.birthday)}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Briefcase className="text-gray-400 mt-0.5" size={18} />
                            <div>
                                <p className="text-sm text-gray-500">Função</p>
                                <p className="font-medium text-gray-900">{user.role}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Skills */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4">Habilidades & Competências</h3>
                
                {isEditing ? (
                    <div className="flex flex-wrap gap-2">
                         {AVAILABLE_SKILLS.map((skill) => {
                             const isSelected = skills.includes(skill);
                             return (
                                 <button
                                     key={skill}
                                     onClick={() => toggleSkill(skill)}
                                     className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all flex items-center gap-2 ${
                                         isSelected 
                                         ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                         : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                     }`}
                                 >
                                     {isSelected && <CheckCircle2 size={14} />}
                                     {skill}
                                 </button>
                             );
                         })}
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {skills.map((skill) => (
                            <span key={skill} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100 flex items-center gap-2">
                                {skill}
                            </span>
                        ))}
                        {skills.length === 0 && (
                            <p className="text-gray-400 text-sm italic">Nenhuma habilidade cadastrada.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* PASSWORD CHANGE MODAL */}
      {isPasswordModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Lock size={18} className="text-blue-600" /> Alterar Senha
                      </h3>
                      <button 
                        onClick={() => setIsPasswordModalOpen(false)} 
                        className="text-gray-400 hover:text-gray-600"
                      >
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                          <input 
                              type="password" 
                              value={passwordForm.new}
                              onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                              placeholder="Mínimo 6 caracteres"
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
                          <input 
                              type="password" 
                              value={passwordForm.confirm}
                              onChange={(e) => setPasswordForm({...passwordForm, confirm: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                              placeholder="Repita a nova senha"
                          />
                      </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                      <button 
                        onClick={() => setIsPasswordModalOpen(false)} 
                        className="flex-1 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                        disabled={passLoading}
                      >
                          Cancelar
                      </button>
                      <button 
                        onClick={handlePasswordUpdate}
                        disabled={passLoading || !passwordForm.new || !passwordForm.confirm}
                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                          {passLoading && <Loader2 size={16} className="animate-spin" />}
                          Salvar
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};