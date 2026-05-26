import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Post, User, UserRole, isCoordinator } from '../types';
import { supabase } from '../supabaseClient';
import { Plus, Trash2, Loader2, X, Image as ImageIcon, BarChart2, Megaphone, HeartHandshake, BookOpen, Camera, Send, AlertTriangle, Bold, Italic, Strikethrough, List, MoreVertical, Smile, Palette, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FeedProps {
  posts: Post[];
  users: User[];
  currentUser: User;
  onRefresh: () => void;
  isDashboardIntegrated?: boolean;
  mode?: 'full' | 'create-only' | 'posts-only';
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
        return <strong key={key} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return <em key={key} className="italic text-slate-800">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
        return <s key={key} className="text-slate-400 line-through">{part.slice(2, -2)}</s>;
      }
      return <span key={key}>{part}</span>;
    });
  };

  return lines.map((line, i) => {
    // Handle Lists
    if (line.trim().startsWith('- ')) {
      return (
        <div key={i} className="flex items-start gap-2 ml-1 mb-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 shrink-0"></span>
          <p className="text-slate-700 leading-relaxed">{formatInline(line.substring(2), `line-${i}`)}</p>
        </div>
      );
    }
    // Handle Empty Lines (Paragraph breaks)
    if (line.trim() === '') {
      return <div key={i} className="h-3"></div>;
    }
    // Normal Paragraph
    return (
      <p key={i} className="text-slate-700 mb-1 leading-relaxed whitespace-pre-wrap">
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
  
  // Robust Admin Check unificado
  const isAdmin = currentUser && isCoordinator(currentUser.role);

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
    <div className="bg-white rounded-[2.5rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.06)] border border-slate-50 p-5 sm:p-8 hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.1)] transition-all group overflow-hidden relative">
      {/* Visual Decoration */}
      <div className={`absolute top-0 left-0 w-2 h-full ${
        post.type === 'enquete' ? 'bg-brand-yellow' :
        'bg-brand-blue'
      } opacity-40`}></div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 sm:mb-8 gap-2">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="relative shrink-0">
             <img
              src={author?.avatar || 'https://via.placeholder.com/40'}
              alt={author?.name}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border-2 border-white shadow-xl shadow-slate-200"
            />
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-slate-900 text-base sm:text-lg tracking-tight leading-none mb-1.5 truncate">{author?.name || 'Desconhecido'}</h3>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest">{post.timestamp}</span>
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-slate-100 rounded-full"></div>
              <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] px-2 sm:px-3 py-1 rounded-full ${
                post.type === 'enquete' ? 'bg-brand-yellow/10 text-brand-yellow' :
                'bg-brand-blue/10 text-brand-blue'
              }`}>
                {post.type === 'enquete' ? 'Enquete' : 'Publicação'}
              </span>
            </div>
          </div>
        </div>
        
        {canDelete && (
            <button 
                onClick={() => onRequestDelete(post)} 
                className="text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-2xl p-2 sm:p-4 transition-all active:scale-90 shrink-0"
                title="Excluir publicação"
            >
                <Trash2 size={18} className="sm:w-5 sm:h-5" />
            </button>
        )}
      </div>

      {/* Content with Rich Text Rendering */}
      <div className="mb-8 text-slate-700 text-base sm:text-lg leading-relaxed font-medium">
        {renderStyledText(post.content)}
      </div>

      {post.image && (
        <div className="mb-8 rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl relative group/img">
             <img src={post.image} alt="Post content" className="w-full max-h-[600px] object-cover transition-transform duration-700 group-hover/img:scale-105" />
             <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity"></div>
        </div>
      )}

      {/* Poll Logic */}
      {post.type === 'enquete' && post.pollOptions && (
        <div className="space-y-4 mb-2 bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-50 shadow-inner">
          <div className="flex items-center gap-3 mb-4">
             <BarChart2 size={20} className="text-brand-yellow" />
             <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Enquete ativa</h4>
          </div>
          {post.pollOptions.map((opt) => {
            const totalVotes = post.pollOptions!.reduce((acc, curr) => acc + curr.votes, 0);
            const percent = totalVotes === 0 ? 0 : Math.round((opt.votes / totalVotes) * 100);
            return (
                <div 
                  key={opt.id} 
                  onClick={() => handleVote(opt.id)} 
                  className="relative group/opt cursor-pointer overflow-hidden rounded-2xl"
                >
                <div 
                  className="absolute top-0 left-0 h-full bg-brand-blue transition-all duration-1000 ease-out z-0" 
                  style={{ width: `${percent}%`, opacity: 0.15 }}
                ></div>
                <div className="relative p-5 border-2 border-white rounded-2xl flex justify-between items-center z-10 transition-all bg-white/40 backdrop-blur-[2px] group-hover/opt:border-brand-blue/20 group-hover/opt:bg-white shadow-sm">
                  <span className="text-sm font-black text-slate-800 tracking-tight">{opt.text}</span>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                       <span className="text-lg font-black text-brand-blue leading-none">{percent}%</span>
                       <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">{opt.votes} votos</span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${percent > 0 ? 'bg-brand-blue animate-pulse' : 'bg-slate-200'}`}></div>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200/50">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de participações</p>
             <p className="text-sm font-black text-slate-900">{post.pollOptions.reduce((acc, c) => acc + c.votes, 0)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export const Feed: React.FC<FeedProps> = ({ 
  posts, 
  users, 
  currentUser, 
  onRefresh, 
  isDashboardIntegrated = false,
  mode = 'full'
}) => {
  // New Post State
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostType, setNewPostType] = useState<'post' | 'enquete'>('post');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Delete State
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Image Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Ref for focusing the post input
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Scroll lock when modal is open
  useEffect(() => {
    const isAnyModalOpen = isCreateModalOpen || !!postToDelete;
    
    // Alvo: o container de scroll principal no App.tsx
    const scrollContainer = document.querySelector('.overflow-y-auto.flex-1');
    
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.style.overflow = 'hidden';
      }
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.style.overflow = 'auto';
      }
    }
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.style.overflow = 'auto';
      }
    };
  }, [isCreateModalOpen, postToDelete]);

  const filteredPosts = posts;

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

        // Feedback de Sucesso
        setNewPostContent('');
        setNewPostType('post');
        setPollOptions(['', '']);
        removeImage();
        onRefresh();
        setIsCreateModalOpen(false);
        
        // Dispatch local event for feedback (optional)
        console.log('Post criado com sucesso');
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
    { id: 'post', label: 'Publicação', icon: MessageSquare, color: 'text-brand-blue', hoverBg: 'hover:bg-brand-blue/10', activeBg: 'bg-brand-blue/20 ring-brand-blue/30' },
    { id: 'enquete', label: 'Enquete', icon: BarChart2, color: 'text-brand-yellow', hoverBg: 'hover:bg-brand-yellow/10', activeBg: 'bg-brand-yellow/20 ring-brand-yellow/30' },
  ];

  return (
    <div className={`${isDashboardIntegrated ? 'pb-2' : 'max-w-4xl mx-auto p-4 pb-20 lg:pb-8'} animate-in fade-in duration-700`}>
      {/* Main Feed Column */}
      <div className={isDashboardIntegrated ? 'space-y-4' : 'space-y-8'}>
        
        {/* Bento Create Post Input - Blue Theme */}
        {(mode === 'full' || mode === 'create-only') && (
          <div className={`bg-brand-blue rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,124,186,0.3)] border border-white/10 overflow-hidden ${isDashboardIntegrated ? 'mb-0' : 'mb-10'} group transition-all duration-700 relative z-10`}>
            <div className="p-5 sm:p-8">
              <div className="flex gap-4 sm:gap-6 items-center">
                <div className="shrink-0">
                  <img src={currentUser.avatar} alt="Me" className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover shadow-2xl shadow-black/20 border-2 border-white" />
                </div>
                <button 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex-1 bg-white/10 hover:bg-white/20 rounded-[1.8rem] px-6 py-4 text-left transition-all group/btn border border-white/5"
                >
                  <span className="text-white/70 text-sm sm:text-base font-medium group-hover/btn:text-white transition-colors">
                    Olá {currentUser.name.split(' ')[0]}, o que deseja partilhar hoje?
                  </span>
                </button>
                <div className="hidden sm:flex items-center gap-2">
                  <button 
                    onClick={() => { setNewPostType('post'); setIsCreateModalOpen(true); }}
                    className="p-3 bg-white/10 text-white rounded-xl hover:bg-white hover:text-brand-blue hover:scale-110 active:scale-95 transition-all shadow-lg"
                    title="Publicar"
                  >
                    <MessageSquare size={20} />
                  </button>
                  <button 
                    onClick={() => { setNewPostType('enquete'); setIsCreateModalOpen(true); }}
                    className="p-3 bg-white text-brand-yellow rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg"
                    title="Enquete"
                  >
                    <BarChart2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {(mode === 'full' || mode === 'posts-only') && filteredPosts.length === 0 ? (
            <div className={`text-center py-32 bg-white rounded-[2.5rem] border border-slate-50 shadow-sm animate-in zoom-in-95 duration-700 ${isDashboardIntegrated ? 'py-12' : 'py-32'}`}>
                <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-inner ring-4 ring-white">
                    <MessageSquare size={40} className="text-slate-200" />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">O Mural está tranquilo</h3>
                <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">Ainda não há mensagens por aqui. Que tal ser o primeiro a partilhar algo?</p>
            </div>
        ) : (
          <>
            <motion.div 
              layout="position"
              className={`${isDashboardIntegrated ? 'space-y-4 pb-2' : 'space-y-8 pb-12'}`}
            >
              <AnimatePresence initial={false}>
                {filteredPosts.map((post) => (
                  <motion.div
                    key={post.id}
                    layout="position"
                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                    animate={{ 
                      opacity: 1, 
                      height: "auto", 
                      scale: 1,
                    }}
                    exit={{ 
                      opacity: 0, 
                      height: 0, 
                      scale: 0.95,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 250,
                      damping: 26,
                    }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className={isDashboardIntegrated ? "mb-1" : "mb-8"}>
                      <PostCard 
                          post={post} 
                          users={users} 
                          currentUser={currentUser} 
                          onRefresh={onRefresh} 
                          onRequestDelete={(p) => setPostToDelete(p)}
                      />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
            {/* NEW POST MODAL */}
            {createPortal(
              <AnimatePresence>
                {isCreateModalOpen && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 md:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCreateModalOpen(false)}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-[100000]"
              >
                <div className="p-8 md:p-10 border-b border-slate-50 flex items-center justify-between">
                  <div>
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight">Nova Mensagem</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Comunicando com amor</p>
                  </div>
                  <button
                    onClick={() => setIsCreateModalOpen(false)}
                    className="p-3 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="p-8 md:p-10 overflow-y-auto space-y-6 custom-scrollbar flex-1">
                  <div className="flex gap-4 items-start">
                      <img src={currentUser.avatar} alt="Me" className="w-12 h-12 rounded-2xl object-cover shadow-lg border-2 border-white shrink-0" />
                      <div className="flex-1 w-full space-y-4">
                          <div className="relative bg-slate-50 rounded-[1.8rem] p-5 ring-1 ring-slate-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-blue/10 transition-all">
                              <textarea
                                  ref={textareaRef}
                                  autoFocus
                                  value={newPostContent}
                                  onChange={(e) => setNewPostContent(e.target.value)}
                                  placeholder={`O que quer compartilhar hoje, ${currentUser.name.split(' ')[0]}?`}
                                  className="w-full bg-transparent text-slate-800 placeholder:text-slate-400 text-lg font-medium resize-none focus:outline-none min-h-[120px] py-1 scrollbar-hide focus:ring-0"
                              />
                              
                              <div className="flex items-center gap-1 mt-2 border-t border-slate-100 pt-3">
                                  <button onClick={() => handleFormatText('bold')} className="p-2 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-white transition-all" title="Negrito"><Bold size={16} /></button>
                                  <button onClick={() => handleFormatText('italic')} className="p-2 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-white transition-all" title="Itálico"><Italic size={16} /></button>
                                  <button onClick={() => handleFormatText('list')} className="p-2 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-white transition-all" title="Lista"><List size={16} /></button>
                              </div>
                          </div>
                          
                          {imagePreview && (
                              <motion.div 
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="relative inline-block group/img"
                              >
                                  <img src={imagePreview} alt="Preview" className="h-48 w-auto rounded-[2rem] object-cover border-4 border-white shadow-xl" />
                                  <button onClick={removeImage} className="absolute -top-3 -right-3 bg-slate-900 text-white rounded-full p-2 shadow-xl hover:scale-110 active:scale-90 transition-all font-black"><X size={14} /></button>
                              </motion.div>
                          )}

                          <AnimatePresence>
                              {newPostType === 'enquete' && (
                                  <motion.div 
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="space-y-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner relative overflow-hidden"
                                  >
                                      <div className="flex items-center justify-between mb-2">
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opções da Enquete</p>
                                          <button onClick={() => setNewPostType('post')} className="text-slate-300 hover:text-rose-500 transition-colors"><X size={16}/></button>
                                      </div>
                                      {pollOptions.map((opt, idx) => (
                                          <div key={idx} className="flex gap-3 items-center">
                                              <input 
                                                  type="text" 
                                                  value={opt} 
                                                  onChange={(e) => handlePollOptionChange(idx, e.target.value)} 
                                                  placeholder={`Opção ${idx + 1}`} 
                                                  className="flex-1 text-sm py-3.5 px-5 bg-white text-slate-900 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/10 transition-all font-bold shadow-sm" 
                                              />
                                              {pollOptions.length > 2 && (
                                                  <button onClick={() => handleRemovePollOption(idx)} className="text-slate-300 hover:text-rose-500 p-2">
                                                      <Trash2 size={16} />
                                                  </button>
                                              )}
                                          </div>
                                      ))}
                                      <button onClick={handleAddPollOption} className="text-[10px] text-brand-blue font-black uppercase tracking-widest opacity-80 flex items-center gap-2 mt-2 px-2 transition-all">
                                          <Plus size={12} strokeWidth={3} /> Adicionar Opção
                                      </button>
                                  </motion.div>
                              )}
                          </AnimatePresence>
                      </div>
                  </div>
                </div>

                <div className="p-8 md:p-10 bg-slate-50/50 border-t border-slate-50 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                      <button 
                          onClick={() => fileInputRef.current?.click()} 
                          className={`p-4 rounded-2xl transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest ${selectedImage ? 'bg-brand-green text-white' : 'bg-white text-slate-400 hover:text-brand-green border border-slate-100 shadow-sm'}`}
                      >
                          <Camera size={18} />
                          {selectedImage ? 'Alterar Foto' : 'Adicionar Foto'}
                      </button>

                      <button 
                          onClick={() => setNewPostType(newPostType === 'enquete' ? 'post' : 'enquete')}
                          className={`p-4 rounded-2xl transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest ${newPostType === 'enquete' ? 'bg-brand-yellow text-slate-900' : 'bg-white text-slate-400 hover:text-brand-yellow border border-slate-100 shadow-sm'}`}
                      >
                          <BarChart2 size={18} />
                          {newPostType === 'enquete' ? 'Remover Enquete' : 'Criar Enquete'}
                      </button>
                  </div>

                  <button 
                      onClick={async () => {
                          await handleSubmit();
                      }} 
                      disabled={isSubmitting || (!newPostContent.trim() && !selectedImage)} 
                      className="w-full sm:w-auto bg-slate-900 text-white py-4 px-10 rounded-2xl hover:bg-brand-blue active:scale-95 transition-all font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 disabled:opacity-30 shadow-xl shadow-slate-200"
                  >
                      {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} 
                      <span>Partilhar agora</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* CONFIRM DELETE MODAL */}
      {createPortal(
        <AnimatePresence>
          {postToDelete && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-6">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
                    onClick={() => setPostToDelete(null)}
                />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="bg-white rounded-[3rem] shadow-2xl p-10 max-w-sm w-full text-center relative z-[100000]"
                >
                    <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[1.8rem] flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-rose-50/50">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Excluir Publicação?</h3>
                    <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed italic">Esta ação não pode ser desfeita. A publicação será removida permanentemente do feed.</p>
                    
                    <div className="flex gap-4">
                        <button 
                          onClick={() => setPostToDelete(null)} 
                          className="flex-1 py-5 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
                          disabled={isDeleting}
                        >
                            Cancelar
                        </button>
                        <button 
                          onClick={handleConfirmDelete}
                          disabled={isDeleting}
                          className="flex-[2] py-5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-rose-200 flex items-center justify-center gap-3"
                        >
                            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            Excluir
                        </button>
                    </div>
                </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* MODALS SECTION */}
          </>
        )}
      </div>
    </div>
  );
};
