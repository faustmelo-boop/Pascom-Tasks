import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { Mail, Phone, Award, ShieldCheck, Loader2 } from 'lucide-react';

interface AgentsProps {
  users: User[];
  currentUser: User;
  onRefresh: () => void;
}

export const Agents: React.FC<AgentsProps> = ({ users, currentUser, onRefresh }) => {
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // Helper to fix timezone issue on birthday display
  const formatBirthday = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('pt-BR', {day: 'numeric', month: 'long'});
  };

  const handlePromote = async (userId: string) => {
    if (!confirm("Tem certeza que deseja promover este membro a Coordenador?")) return;
    
    setPromotingId(userId);
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ role: UserRole.ADMIN })
            .eq('id', userId);
        
        if (error) throw error;
        
        // Notify the user about promotion (Optional - handled via DB trigger usually, but could be manual here)
        await supabase.from('notifications').insert({
            user_id: userId,
            type: 'system',
            title: 'Parabéns!',
            content: `Você foi promovido a ${UserRole.ADMIN}.`
        });

        onRefresh();
    } catch (err: any) {
        alert("Erro ao promover usuário: " + err.message);
    } finally {
        setPromotingId(null);
    }
  };

  const isCurrentUserAdmin = currentUser && (
    currentUser.role === UserRole.ADMIN || 
    (currentUser.role as string) === 'admin' || 
    (currentUser.role as string) === 'Admin' ||
    (typeof currentUser.role === 'string' && (currentUser.role as string).toLowerCase().includes('coorden'))
  );

  return (
    <div className="max-w-6xl mx-auto p-4 pb-24 lg:pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">Diretório de Agentes</h2>
            <p className="text-sm text-gray-500">Conheça nossa equipe e suas habilidades</p>
        </div>
        <input 
            type="text" 
            placeholder="Buscar por nome ou habilidade..." 
            className="px-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg w-full md:w-64 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder-gray-500"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {users.map((user) => {
          const isCoordinator = user.role === UserRole.ADMIN || (user.role as string) === 'Coordenador';
          
          return (
            <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center relative hover:border-blue-300 transition-colors">
                <span className={`absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    isCoordinator ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-600'
                }`}>
                    {user.role}
                </span>
                
                <img src={user.avatar} alt={user.name} className="w-24 h-24 rounded-full object-cover mb-4 border-4 border-gray-50" />
                
                <h3 className="font-bold text-gray-900 text-lg">{user.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{formatBirthday(user.birthday)}</p>
                
                <div className="flex flex-wrap gap-1 justify-center mb-6">
                    {user.skills.map(skill => (
                        <span key={skill} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{skill}</span>
                    ))}
                </div>

                <div className="flex gap-2 w-full mt-auto mb-2">
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 hover:text-blue-600 transition-colors">
                        <Mail size={16} /> Email
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 hover:text-green-600 transition-colors">
                        <Phone size={16} /> WhatsApp
                    </button>
                </div>

                {/* Admin Promotion Action */}
                {isCurrentUserAdmin && !isCoordinator && (
                    <button 
                        onClick={() => handlePromote(user.id)}
                        disabled={promotingId === user.id}
                        className="w-full mt-2 py-2 text-xs font-bold text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                    >
                        {promotingId === user.id ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        Promover a Coordenador
                    </button>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
};