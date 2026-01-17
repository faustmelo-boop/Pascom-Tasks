import React, { useState, useRef } from 'react';
import { InventoryItem, User, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { Box, Plus, Search, Filter, Camera, Trash2, Edit2, X, Save, Loader2, AlertTriangle, CheckCircle2, AlertCircle, Wrench, User as UserIcon } from 'lucide-react';

interface InventoryProps {
  items: InventoryItem[];
  users: User[];
  currentUser: User;
  onRefresh: () => void;
}

export const Inventory: React.FC<InventoryProps> = ({ items, users, currentUser, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Todos');

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    condition: InventoryItem['condition'];
    status: InventoryItem['status'];
    holderId: string;
    image: string | null;
  }>({
    name: '',
    description: '',
    condition: 'Bom',
    status: 'Disponível',
    holderId: '',
    image: null
  });

  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin Check
  const isAdmin = currentUser && (
    currentUser.role === UserRole.ADMIN || 
    (currentUser.role as string) === 'admin' || 
    (currentUser.role as string) === 'Admin' ||
    (typeof currentUser.role === 'string' && (currentUser.role as string).toLowerCase().includes('coorden'))
  );

  // Handlers
  const handleOpenModal = (item?: InventoryItem) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        name: item.name,
        description: item.description || '',
        condition: item.condition,
        status: item.status,
        holderId: item.holderId || '',
        image: item.image || null
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        condition: 'Bom',
        status: 'Disponível',
        holderId: '',
        image: null
      });
    }
    setSelectedImageFile(null);
    setIsModalOpen(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImageFile(file);
      // Create local preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!formData.name) return;
    setLoading(true);

    try {
      let imageUrl = formData.image;

      // Handle Image Upload if a new file is selected
      if (selectedImageFile) {
        const fileExt = selectedImageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('inventory-images') 
          .upload(filePath, selectedImageFile);

        if (uploadError) {
             // Fallback: If bucket missing, warn but continue without image
             // Checks for various Supabase error codes related to missing buckets or resources
             if ((uploadError as any).error === 'Bucket not found' || (uploadError as any).statusCode === '404' || (uploadError as any).message?.includes('not found')) {
                 alert("Aviso: O bucket 'inventory-images' não existe no Supabase.\nO item será salvo sem a foto.\n\nPara habilitar fotos: Crie um bucket público chamado 'inventory-images' no Storage do Supabase.");
                 imageUrl = null; // Proceed with saving item, just without the image URL
             } else {
                 throw uploadError; // Stop execution for other errors
             }
        } else {
            const { data: urlData } = supabase.storage.from('inventory-images').getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
        }
      }

      // If imageUrl is still the base64 preview (upload failed or skipped), clear it so we don't save huge strings to DB
      if (imageUrl && imageUrl.startsWith('data:')) {
          imageUrl = null;
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        condition: formData.condition,
        status: formData.status,
        holder_id: formData.holderId || null,
        image: imageUrl
      };

      if (editingId) {
        const { error } = await supabase.from('inventory').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory').insert([payload]);
        if (error) throw error;
      }

      onRefresh();
      setIsModalOpen(false);
    } catch (error: any) {
      alert(`Erro ao salvar item: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', deleteId);
      if (error) throw error;
      onRefresh();
      setDeleteId(null);
    } catch (error: any) {
      alert(`Erro ao excluir: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Helper for status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Disponível': return 'bg-green-100 text-green-700 border-green-200';
      case 'Em Uso': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Em Manutenção': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getConditionIcon = (condition: string) => {
    switch(condition) {
        case 'Novo': return <CheckCircle2 size={14} className="text-green-500" />;
        case 'Bom': return <CheckCircle2 size={14} className="text-blue-500" />;
        case 'Regular': return <AlertCircle size={14} className="text-yellow-500" />;
        case 'Ruim': return <AlertTriangle size={14} className="text-orange-500" />;
        case 'Danificado': return <Wrench size={14} className="text-red-500" />;
        default: return null;
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'Todos' || item.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 pb-24 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Box className="text-blue-600" /> Patrimônio
          </h2>
          <p className="text-sm text-gray-500">Gerencie equipamentos e inventário da Pascom</p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
          >
            <Plus size={18} /> Novo Item
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
                type="text" 
                placeholder="Buscar equipamento..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder-gray-500"
            />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 hide-scroll">
            <Filter size={18} className="text-gray-400 shrink-0" />
            {['Todos', 'Disponível', 'Em Uso', 'Em Manutenção'].map(status => (
                <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                        filterStatus === status 
                        ? 'bg-gray-800 text-white border-gray-800' 
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    {status}
                </button>
            ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredItems.map(item => {
            const holder = users.find(u => u.id === item.holderId);
            
            return (
                <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
                    {/* Image Area */}
                    <div className="h-48 bg-gray-100 relative overflow-hidden">
                        {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <Box size={48} />
                            </div>
                        )}
                        <span className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold uppercase shadow-sm border ${getStatusColor(item.status)}`}>
                            {item.status}
                        </span>
                        {/* Admin Actions Overlay */}
                        {isAdmin && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenModal(item)} className="p-2 bg-white rounded-full text-gray-700 hover:text-blue-600 transition-colors">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => setDeleteId(item.id)} className="p-2 bg-white rounded-full text-gray-700 hover:text-red-600 transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-4 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-gray-900 line-clamp-1" title={item.name}>{item.name}</h3>
                        </div>
                        
                        <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-600 bg-gray-50 w-fit px-2 py-1 rounded border border-gray-100">
                             {getConditionIcon(item.condition)}
                             <span>Estado: {item.condition}</span>
                        </div>

                        <p className="text-sm text-gray-500 mb-4 line-clamp-2 flex-1">{item.description || 'Sem descrição.'}</p>

                        <div className="border-t border-gray-100 pt-3 mt-auto">
                            <p className="text-xs text-gray-400 font-medium uppercase mb-2">Responsável Atual</p>
                            <div className="flex items-center gap-2">
                                {holder ? (
                                    <>
                                        <img src={holder.avatar} alt={holder.name} className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                                        <span className="text-sm font-medium text-gray-700 truncate">{holder.name}</span>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                                            <UserIcon size={14} />
                                        </div>
                                        <span className="text-sm italic">Não atribuído</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )
        })}
      </div>

      {filteredItems.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Box className="mx-auto text-gray-300 mb-3" size={48} />
              <p className="text-gray-500 font-medium">Nenhum equipamento encontrado.</p>
              {searchTerm && <p className="text-gray-400 text-sm mt-1">Tente ajustar sua busca.</p>}
          </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h3 className="text-lg font-bold text-gray-800">{editingId ? 'Editar Item' : 'Novo Equipamento'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {/* Image Upload */}
                <div className="flex flex-col items-center justify-center mb-4">
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative group"
                    >
                        {formData.image ? (
                            <>
                                <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="text-white" size={32} />
                                </div>
                            </>
                        ) : (
                            <>
                                <Camera className="text-gray-400 mb-2" size={32} />
                                <span className="text-sm text-gray-500 font-medium">Adicionar Foto</span>
                            </>
                        )}
                    </div>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleImageSelect}
                    />
                </div>

                {/* Fields */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Equipamento</label>
                    <input 
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder-gray-500"
                        placeholder="Ex: Câmera Canon T7i"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                    <textarea 
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        rows={3}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none resize-none placeholder-gray-500"
                        placeholder="Detalhes, número de série, acessórios inclusos..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estado de Conservação</label>
                        <select 
                            value={formData.condition}
                            onChange={(e) => setFormData({...formData, condition: e.target.value as any})}
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                        >
                            {['Novo', 'Bom', 'Regular', 'Ruim', 'Danificado'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status Atual</label>
                        <select 
                            value={formData.status}
                            onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                            className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                        >
                            {['Disponível', 'Em Uso', 'Em Manutenção'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quem está com o item?</label>
                    <select 
                        value={formData.holderId}
                        onChange={(e) => setFormData({...formData, holderId: e.target.value})}
                        className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
                    >
                        <option value="">-- Ninguém (No armário) --</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end rounded-b-2xl">
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
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
                  <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Excluir Item?</h3>
                  <p className="text-sm text-gray-600 mb-6">Esta ação não pode ser desfeita. O histórico deste equipamento será perdido.</p>
                  
                  <div className="flex gap-3">
                      <button 
                        onClick={() => setDeleteId(null)} 
                        className="flex-1 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                        disabled={loading}
                      >
                          Cancelar
                      </button>
                      <button 
                        onClick={handleDelete}
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
    </div>
  );
};