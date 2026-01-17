import React, { useState, useRef } from 'react';
import { Post, User, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, Loader2, X, Image as ImageIcon, BarChart2, Megaphone, HandHelping, BookOpen, Camera, Send, AlertTriangle, Bold, Italic, Strikethrough, List } from 'lucide-react';

interface FeedProps {
  posts: Post[];
  users: User[];
  currentUser: User;
  onRefresh: () => void;
}

// --- Helper: Render Markdown-like Text ---
const renderStyledText = (text: string) => {
  if (!text) return null;

  const lines = text.split('\n');
  
  // Helper to process inline styles
  const formatInline = (str: string, keyPrefix: string) => {
    // Split by markers: **bold**, *italic*, ~~strike~~
    // Regex splits and captures delimiters to allow mapping
    const parts = str.split(/(\*\*.*?\*\*|\*.*?\*|~~.*?~~)/g);

    return parts.map((part, index) => {
      const key = `${keyPrefix}-${index}`;
      
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return <strong key={key} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return <em key={key} className="italic text-gray-800">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
        return <s key={key} className="text-gray-500 line-through">{part.slice(2, -2)}</s>;
      }
      return <span key={key}>{part}</span>;
    });
  };

  return lines.map((line, i) => {
    // Handle Lists
    if (line.trim().startsWith('- ')) {
      return (
        <div key={i} className="flex items-start gap-2 ml-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 shrink-0"></span>
          <p className="text-gray-800 leading-relaxed">{formatInline(line.substring(2), `line-${i}`)}</p>
        </div>
      );
    }
    // Handle Empty Lines (Paragraph breaks)
    if (line.trim() === '') {
      return <div key={i} className="h-2"></div>;
    }
    // Normal Paragraph
    return (
      <p key={i} className="text-gray-800 mb-1 leading-relaxed whitespace-pre-wrap">
        {formatInline(line, `line-${i}`)}
      </p>
    );
  });
};

// Separate component to handle Post logic cleanly
const PostCard: React.FC<{ 
    post: Post; 
    users: User[]; 
    currentUser: User; 
    onRefresh: () => void;
    onRequestDelete: (post: Post) => void; 
}> = ({ post, users, currentUser, onRefresh, onRequestDelete }) => {
  const author = users.find((u) => u.id === post.authorId);
  const [voteLoading, setVoteLoading] = useState(false);
  
  // Robust Admin Check
  const isAdmin = currentUser && (
    currentUser.role === UserRole.ADMIN || 
    (currentUser.role as string) === 'admin' || 
    (currentUser.role as string) === 'Admin' ||
    (typeof currentUser.role === 'string' && (currentUser.role as string).toLowerCase().includes('coorden'))
  );

  const isAuthor = post.authorId === currentUser.id;
  const canDelete = isAuthor || isAdmin;
  
  const handleVote = async (optionId: string) => {
    if (!post.pollOptions || voteLoading) return;
    setVoteLoading(true);

    try {
      const newOptions = post.pollOptions.map(opt => 
        opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
      );

      const { error } = await supabase
        .from('posts')
        .update({ poll_options: newOptions })
        .eq('id', post.id);

      if (error) throw error;
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setVoteLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <img
            src={author?.avatar || 'https://via.placeholder.com/40'}
            alt={author?.name}
            className="w-10 h-10 rounded-full object-cover border border-gray-200"
          />
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{author?.name || 'Desconhecido'}</h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{post.timestamp}</span>
              <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
              <span className={`uppercase font-bold tracking-wider ${
                post.type === 'aviso' ? 'text-red-500' :
                post.type === 'enquete' ? 'text-purple-500' :
                'text-blue-500'
              }`}>
                {post.type}
              </span>
            </div>
          </div>
        </div>
        
        {canDelete && (
            <button 
                onClick={() => onRequestDelete(post)} 
                className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors p-2"
                title="Excluir publicação"
            >
                <Trash2 size={16} />
            </button>
        )}
      </div>

      {/* Content with Rich Text Rendering */}
      <div className="mb-3">
        {renderStyledText(post.content)}
      </div>

      {post.image && (
        <div className="mb-3 rounded-lg overflow-hidden border border-gray-100">
             <img src={post.image} alt="Post content" className="w-full max-h-[500px] object-cover" />
        </div>
      )}

      {/* Poll Logic */}
      {post.type === 'enquete' && post.pollOptions && (
        <div className="space-y-2 mb-3">
          {post.pollOptions.map((opt) => {
            const totalVotes = post.pollOptions!.reduce((acc, curr) => acc + curr.votes, 0);
            const percent = totalVotes === 0 ? 0 : Math.round((opt.votes / totalVotes) * 100);
            return (
              <div key={opt.id} onClick={() => handleVote(opt.id)} className="relative group cursor-pointer">
                <div className="absolute top-0 left-0 h-full bg-blue-50 rounded-lg transition-all duration-500" style={{ width: `${percent}%` }}></div>
                <div className="relative p-3 border border-blue-100 rounded-lg flex justify-between items-center z-10 hover:border-blue-300 transition-colors">
                  <span className="text-sm font-medium text-gray-700">{opt.text}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-600">{percent}%</span>
                    <span className="text-xs text-gray-400">({opt.votes})</span>
                  </div>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-right text-gray-500">Total de votos: {post.pollOptions.reduce((acc, c) => acc + c.votes, 0)}</p>
        </div>
      )}
    </div>
  );
};

export const Feed: React.FC<FeedProps> = ({ posts, users, currentUser, onRefresh }) => {
  // New Post State
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostType, setNewPostType] = useState<'aviso' | 'pedido' | 'cobertura' | 'enquete' | 'formacao'>('aviso');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Todos');

  // Delete State
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Image Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Ref for focusing the post input
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const filteredPosts = activeFilter === 'Todos' 
    ? posts 
    : posts.filter(p => p.type.toLowerCase() === activeFilter.toLowerCase().slice(0, -1));

  const handleAddPollOption = () => {
    setPollOptions([...pollOptions, '']);
  }

  const handlePollOptionChange = (idx: number, val: string) => {
    const newOpts = [...pollOptions];
    newOpts[idx] = val;
    setPollOptions(newOpts);
  }

  const handleRemovePollOption = (idx: number) => {
    if (pollOptions.length <= 2) return;
    setPollOptions(pollOptions.filter((_, i) => i !== idx));
  }

  // Handle Image Selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (file.size > 5 * 1024 * 1024) {
            alert("A imagem deve ter no máximo 5MB.");
            return;
        }
        setSelectedImage(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
        if (newPostType === 'aviso') setNewPostType('cobertura');
    }
  };

  const removeImage = () => {
      setSelectedImage(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFormatText = (format: 'bold' | 'italic' | 'strike' | 'list') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = newPostContent;
    
    let prefix = '';
    let suffix = '';

    switch(format) {
      case 'bold': prefix = '**'; suffix = '**'; break;
      case 'italic': prefix = '*'; suffix = '*'; break;
      case 'strike': prefix = '~~'; suffix = '~~'; break;
      case 'list': prefix = '\n- '; suffix = ''; break;
    }

    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);

    const newText = `${before}${prefix}${selection}${suffix}${after}`;
    
    setNewPostContent(newText);

    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = end + prefix.length + (format === 'list' ? 0 : suffix.length > 0 && selection.length === 0 ? -suffix.length : 0);
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleSubmit = async () => {
    if (!newPostContent.trim() && !selectedImage) return;
    setIsSubmitting(true);

    try {
        let imageUrl = null;
        if (selectedImage) {
            const fileExt = selectedImage.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;
            const { error: uploadError } = await supabase.storage.from('post-images').upload(filePath, selectedImage);
            if (uploadError) {
                if ((uploadError as any).statusCode === '404' || (uploadError as any).error === 'Bucket not found') {
                    alert("Erro: Bucket 'post-images' não encontrado no Supabase.");
                    setIsSubmitting(false);
                    return;
                }
                throw uploadError;
            }
            const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
        }

        // Initialize payload with common fields
        const payload: any = {
            author_id: currentUser.id,
            content: newPostContent,
            type: newPostType,
            likes: 0,
            comments: 0,
            image: imageUrl
        };

        // Only add poll_options if type is 'enquete' to avoid schema errors if column is missing for simple posts
        if (newPostType === 'enquete') {
            const optionsPayload = pollOptions.filter(o => o.trim() !== '').map((text, idx) => ({
                id: `opt-${Date.now()}-${idx}`,
                text,
                votes: 0
            }));
            payload.poll_options = optionsPayload;
        }

        const { error } = await supabase.from('posts').insert([payload]);
        if (error) throw error;

        setNewPostContent('');
        setNewPostType('aviso');
        setPollOptions(['', '']);
        removeImage();
        onRefresh();
    } catch (e: any) {
        alert(`Erro ao criar publicação: ${e.message}`);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!postToDelete) return;
    setIsDeleting(true);
    
    try {
        // 1. Tentar remover dependências manualmente (Comentários e Likes)
        await Promise.allSettled([
            supabase.from('comments').delete().eq('post_id', postToDelete.id),
            supabase.from('post_likes').delete().eq('post_id', postToDelete.id)
        ]);

        // 2. Excluir o Post
        const { error } = await supabase.from('posts').delete().eq('id', postToDelete.id);
        
        if (error) {
            console.error("Erro ao deletar post:", error);
            if (error.code === '23503') { // Foreign Key Violation
                 alert("Não foi possível excluir: Existem comentários ou curtidas vinculados. Contate o administrador.");
            } else if (error.code === '42501') { // RLS Policy Violation
                 alert("Permissão negada: Você não tem permissão para excluir este post.");
            } else {
                 alert(`Erro ao excluir: ${error.message}`);
            }
            setPostToDelete(null);
            return; 
        }

        // 3. Limpar Imagem do Storage (Apenas se o post foi deletado com sucesso)
        if (postToDelete.image) {
            try {
                const fileName = postToDelete.image.split('/').pop();
                if (fileName && fileName.includes('.')) {
                    await supabase.storage.from('post-images').remove([fileName]);
                }
            } catch (imgError) {
                console.warn("Post deletado, mas falha ao remover imagem:", imgError);
            }
        }
        
        onRefresh();
        setPostToDelete(null);
    } catch(e: any) { 
        console.error("Erro crítico:", e); 
        alert(`Erro inesperado: ${e.message}`);
    } finally {
        setIsDeleting(false);
    }
  };

  const POST_TYPES = [
    { id: 'aviso', label: 'Aviso', icon: Megaphone, color: 'text-red-500', hoverBg: 'hover:bg-red-50' },
    { id: 'cobertura', label: 'Foto/Vídeo', icon: ImageIcon, color: 'text-green-500', hoverBg: 'hover:bg-green-50' },
    { id: 'enquete', label: 'Enquete', icon: BarChart2, color: 'text-orange-500', hoverBg: 'hover:bg-orange-50' },
    { id: 'pedido', label: 'Pedido', icon: HandHelping, color: 'text-yellow-500', hoverBg: 'hover:bg-yellow-50' },
    { id: 'formacao', label: 'Formação', icon: BookOpen, color: 'text-blue-500', hoverBg: 'hover:bg-blue-50' },
  ];

  return (
    <div className="max-w-3xl mx-auto p-4 pb-20 lg:pb-8">
      {/* Main Feed Column */}
      <div className="space-y-4">
        
        {/* Create Post Input */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex gap-4 items-start">
            <img src={currentUser.avatar} alt="Me" className="w-10 h-10 rounded-full object-cover hidden sm:block" />
            <div className="flex-1 w-full">
                
                {/* Text Editor Toolbar */}
                <div className="flex items-center gap-1 mb-2 border-b border-gray-100 pb-2">
                    <button onClick={() => handleFormatText('bold')} title="Negrito" className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors">
                        <Bold size={16} />
                    </button>
                    <button onClick={() => handleFormatText('italic')} title="Itálico" className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors">
                        <Italic size={16} />
                    </button>
                    <button onClick={() => handleFormatText('strike')} title="Tachado" className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors">
                        <Strikethrough size={16} />
                    </button>
                    <div className="w-px h-4 bg-gray-200 mx-1"></div>
                    <button onClick={() => handleFormatText('list')} title="Lista" className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors">
                        <List size={16} />
                    </button>
                </div>

                <textarea
                    ref={textareaRef}
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder={`No que você está pensando, ${currentUser.name.split(' ')[0]}?`}
                    className="w-full bg-transparent rounded-lg p-2 text-lg text-gray-900 placeholder-gray-500 focus:outline-none resize-none h-20"
                />
                {imagePreview && (
                    <div className="relative mt-2 mb-2 inline-block group">
                        <img src={imagePreview} alt="Preview" className="h-32 w-auto rounded-lg object-cover border border-gray-200" />
                        <button onClick={removeImage} className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"><X size={14} /></button>
                    </div>
                )}
            </div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
            
          {newPostType === 'enquete' && (
              <div className="mt-3 ml-0 sm:ml-14 space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-700">Opções da Enquete</p>
                    <button onClick={() => setNewPostType('aviso')} className="text-gray-400 hover:text-gray-600"><X size={14}/></button>
                  </div>
                  {pollOptions.map((opt, idx) => (
                      <div key={idx} className="flex gap-2">
                          <input type="text" value={opt} onChange={(e) => handlePollOptionChange(idx, e.target.value)} placeholder={`Opção ${idx + 1}`} className="flex-1 text-sm p-2 bg-white text-gray-900 border border-gray-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder-gray-500" />
                          {pollOptions.length > 2 && <button onClick={() => handleRemovePollOption(idx)} className="text-gray-400 hover:text-red-500"><X size={16} /></button>}
                      </div>
                  ))}
                  <button onClick={handleAddPollOption} className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 mt-2"><Plus size={14} /> Adicionar Opção</button>
              </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center mt-4 pt-3 border-t border-gray-100 gap-3">
              <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto hide-scroll pb-1 sm:pb-0">
                   <button onClick={() => fileInputRef.current?.click()} title="Adicionar Foto" className={`p-2 rounded-full transition-all flex items-center justify-center mr-2 ${selectedImage ? 'bg-green-100 text-green-600' : 'text-gray-500 hover:bg-gray-100'}`}>
                        <Camera size={22} className={selectedImage ? 'stroke-[2.5px]' : ''} />
                   </button>
                   <div className="h-6 w-px bg-gray-200 mx-1"></div>
                  <span className="text-sm font-semibold text-gray-600 mr-2 whitespace-nowrap ml-1">Tipo:</span>
                  {POST_TYPES.map((type) => (
                      <button key={type.id} onClick={() => setNewPostType(type.id as any)} title={type.label} className={`p-2 rounded-full transition-all flex items-center justify-center ${newPostType === type.id ? 'bg-gray-100 shadow-inner ring-2 ring-gray-200 ' + type.color : 'text-gray-400 ' + type.hoverBg}`}>
                          <type.icon size={22} className={newPostType === type.id ? 'stroke-[2.5px]' : ''} />
                      </button>
                  ))}
              </div>
              <button onClick={handleSubmit} disabled={isSubmitting || (!newPostContent.trim() && !selectedImage)} className="w-full sm:w-auto bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Publicar
              </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scroll">
            {['Todos', 'Avisos', 'Pedidos', 'Enquetes', 'Coberturas'].map((filter, idx) => (
                <button key={idx} onClick={() => setActiveFilter(filter)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${activeFilter === filter ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                    {filter}
                </button>
            ))}
        </div>

        {filteredPosts.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
                <p>Nenhuma publicação encontrada no Mural.</p>
            </div>
        ) : (
            filteredPosts.map((post) => (
            <PostCard 
                key={post.id} 
                post={post} 
                users={users} 
                currentUser={currentUser} 
                onRefresh={onRefresh} 
                onRequestDelete={(p) => setPostToDelete(p)}
            />
            ))
        )}
      </div>

      {/* CONFIRM DELETE MODAL */}
      {postToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
                  <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Excluir Publicação?</h3>
                  <p className="text-sm text-gray-600 mb-6">Esta ação não pode ser desfeita. A publicação será removida permanentemente.</p>
                  
                  <div className="flex gap-3">
                      <button 
                        onClick={() => setPostToDelete(null)} 
                        className="flex-1 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                        disabled={isDeleting}
                      >
                          Cancelar
                      </button>
                      <button 
                        onClick={handleConfirmDelete}
                        disabled={isDeleting}
                        className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                          {isDeleting && <Loader2 size={16} className="animate-spin" />}
                          Excluir
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};