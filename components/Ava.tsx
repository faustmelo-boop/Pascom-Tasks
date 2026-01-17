import React, { useState, useRef, useEffect } from 'react';
import { Course, DocumentItem, User, UserRole, Lesson } from '../types';
import { supabase } from '../supabaseClient';
import { BookOpen, PlayCircle, Award, ArrowRight, FileText, Download, Upload, Trash2, Search, Filter, Plus, X, Loader2, Save, Edit2, Camera, AlertTriangle, ArrowLeft, Video, CheckCircle, Play, ExternalLink, Youtube } from 'lucide-react';

interface AvaProps {
  courses: Course[];
  documents: DocumentItem[];
  currentUser: User;
  onRefresh: () => void;
}

export const Ava: React.FC<AvaProps> = ({ courses, documents, currentUser, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'courses' | 'library'>('courses');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Robust Admin Check
  const isAdmin = currentUser && (
    currentUser.role === UserRole.ADMIN || 
    (currentUser.role as string) === 'admin' || 
    (currentUser.role as string) === 'Admin' ||
    (typeof currentUser.role === 'string' && (currentUser.role as string).toLowerCase().includes('coorden'))
  );

  // --- STATES FOR COURSES & LESSONS ---
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null); // State for the active video
  const [lessonsLoading, setLessonsLoading] = useState(false);
  
  // Create/Edit Course States
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);
  
  // Lesson Management States
  const [isLessonFormOpen, setIsLessonFormOpen] = useState(false);
  const [lessonFormData, setLessonFormData] = useState({
    title: '',
    videoUrl: '',
    duration: '',
    description: ''
  });
  const [lessonSaving, setLessonSaving] = useState(false);

  // Delete Course State
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete Lesson State
  const [deleteLessonId, setDeleteLessonId] = useState<string | null>(null);
  const [isDeletingLesson, setIsDeletingLesson] = useState(false);

  const [courseFormData, setCourseFormData] = useState({
    title: '',
    category: 'Liturgia',
    thumbnail: ''
  });
  const [selectedCourseImage, setSelectedCourseImage] = useState<File | null>(null);
  const courseFileInputRef = useRef<HTMLInputElement>(null);

  // --- STATES FOR DOCUMENTS ---
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('Geral');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // HELPER: VIDEO URL PARSER
  // ==========================================
  const getEmbedUrl = (url: string) => {
    if (!url) return null;

    // YouTube (Updated to support Live and Shorts)
    // Matches: youtube.com/watch?v=ID, youtube.com/embed/ID, youtu.be/ID, etc.
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    
    if (youtubeMatch && youtubeMatch[1]) {
        // Adding origin prevents some embed errors
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return { type: 'youtube', src: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1&origin=${origin}` };
    }

    // Safety check: If it looks like a YouTube URL but didn't match regex, 
    // DO NOT use generic iframe (causes Connection Refused).
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return { type: 'external_youtube', src: url };
    }

    // Vimeo
    const vimeoRegex = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch && vimeoMatch[1]) {
        return { type: 'vimeo', src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1` };
    }

    // Direct File (mp4, webm, ogv)
    if (url.match(/\.(mp4|webm|ogv)$/i)) {
        return { type: 'video', src: url };
    }

    // Default fallback (try generic iframe for other sites)
    return { type: 'iframe', src: url };
  };

  // ==========================================
  // COURSE LOGIC
  // ==========================================

  const fetchLessons = async (courseId: string) => {
    setLessonsLoading(true);
    try {
        const { data, error } = await supabase
            .from('lessons')
            .select('*')
            .eq('course_id', courseId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const mappedLessons: Lesson[] = (data || []).map((l: any) => ({
            id: l.id,
            courseId: l.course_id,
            title: l.title,
            videoUrl: l.video_url,
            duration: l.duration,
            description: l.description
        }));

        setLessons(mappedLessons);
        setCurrentLesson(null); // Reset current lesson when loading course
    } catch (error) {
        console.error("Error fetching lessons:", error);
    } finally {
        setLessonsLoading(false);
    }
  };

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
    fetchLessons(course.id);
  };

  const handleBackToCourses = () => {
    setSelectedCourse(null);
    setLessons([]);
    setCurrentLesson(null);
    onRefresh();
  };

  const handleOpenCourseModal = (course?: Course) => {
    if (course) {
      setEditingCourseId(course.id);
      setCourseFormData({
        title: course.title,
        category: course.category,
        thumbnail: course.thumbnail
      });
    } else {
      setEditingCourseId(null);
      setCourseFormData({
        title: '',
        category: 'Liturgia',
        thumbnail: ''
      });
    }
    setSelectedCourseImage(null);
    setIsCourseModalOpen(true);
  };

  const handleCourseImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedCourseImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCourseFormData(prev => ({ ...prev, thumbnail: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveCourse = async () => {
    if (!courseFormData.title) return;
    setCourseLoading(true);

    try {
        let imageUrl = courseFormData.thumbnail;

        if (selectedCourseImage) {
            const fileExt = selectedCourseImage.name.split('.').pop();
            const fileName = `course-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;
            const { error: uploadError } = await supabase.storage.from('course-thumbnails').upload(filePath, selectedCourseImage);
            
            if (!uploadError) {
                const { data: urlData } = supabase.storage.from('course-thumbnails').getPublicUrl(filePath);
                imageUrl = urlData.publicUrl;
            } else if ((uploadError as any).statusCode !== '404') {
                throw uploadError;
            }
        }

        if (imageUrl && imageUrl.startsWith('data:')) imageUrl = ''; 

        const payload = {
            title: courseFormData.title,
            category: courseFormData.category,
            cover_image: imageUrl
        };

        if (editingCourseId) {
            const { error } = await supabase.from('courses').update(payload).eq('id', editingCourseId);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('courses').insert([payload]);
            if (error) throw error;
        }

        onRefresh();
        setIsCourseModalOpen(false);
    } catch (error: any) {
        alert(`Erro ao salvar curso: ${error.message}`);
    } finally {
        setCourseLoading(false);
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteCourseId(id);
  };

  const handleConfirmDelete = async () => {
      if (!deleteCourseId) return;
      setIsDeleting(true);
      try {
          const { error } = await supabase.from('courses').delete().eq('id', deleteCourseId);
          if (error) throw error;
          onRefresh();
          setDeleteCourseId(null);
      } catch (e: any) {
          alert("Erro ao excluir: " + e.message);
      } finally {
          setIsDeleting(false);
      }
  };

  // ==========================================
  // LESSON LOGIC
  // ==========================================

  const handlePlayLesson = (lesson: Lesson) => {
      setCurrentLesson(lesson);
      // Scroll to top to see player
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveLesson = async () => {
      if (!selectedCourse || !lessonFormData.title) return;
      setLessonSaving(true);

      try {
          const { error } = await supabase.from('lessons').insert([{
              course_id: selectedCourse.id,
              title: lessonFormData.title,
              video_url: lessonFormData.videoUrl,
              duration: lessonFormData.duration,
              description: lessonFormData.description
          }]);

          if (error) throw error;

          await fetchLessons(selectedCourse.id);
          setLessonFormData({ title: '', videoUrl: '', duration: '', description: '' });
          setIsLessonFormOpen(false);
          onRefresh(); 

      } catch (e: any) {
          alert("Erro ao adicionar aula: " + e.message);
      } finally {
          setLessonSaving(false);
      }
  };

  const handleConfirmDeleteLesson = async () => {
      if (!deleteLessonId) return;
      setIsDeletingLesson(true);
      try {
          const { error } = await supabase.from('lessons').delete().eq('id', deleteLessonId);
          if (error) throw error;
          if (selectedCourse) fetchLessons(selectedCourse.id);
          if (currentLesson?.id === deleteLessonId) setCurrentLesson(null);
          onRefresh();
          setDeleteLessonId(null);
      } catch (e: any) {
          alert("Erro ao excluir aula: " + e.message);
      } finally {
          setIsDeletingLesson(false);
      }
  };

  // ==========================================
  // DOCUMENT LOGIC
  // ==========================================

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
          alert("O arquivo é muito grande. Limite máximo: 10MB.");
          return;
      }
      setSelectedFile(file);
      if (!docTitle) setDocTitle(file.name.split('.')[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !docTitle) return;
    setUploading(true);
    try {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;
        
        const { error: uploadError } = await supabase.storage.from('formation-documents').upload(filePath, selectedFile);
        if (uploadError && (uploadError as any).statusCode !== '404') throw uploadError;

        const { data: urlData } = supabase.storage.from('formation-documents').getPublicUrl(filePath);
        
        const { error: dbError } = await supabase.from('documents').insert([{
            title: docTitle,
            category: docCategory,
            url: urlData.publicUrl,
            uploader_id: currentUser.id,
            size: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
        }]);

        if (dbError) throw dbError;

        onRefresh();
        setIsUploadModalOpen(false);
        setDocTitle('');
        setSelectedFile(null);
    } catch (error: any) {
        alert(`Erro ao enviar arquivo: ${error.message}`);
    } finally {
        setUploading(false);
    }
  };

  const handleDeleteDocument = async (doc: DocumentItem) => {
      if (!confirm("Tem certeza que deseja excluir este documento?")) return;
      try {
          const { error } = await supabase.from('documents').delete().eq('id', doc.id);
          if (error) throw error;
          onRefresh();
      } catch (e: any) {
          alert("Erro ao excluir: " + e.message);
      }
  };

  const filteredDocs = documents.filter(d => 
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      d.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="max-w-6xl mx-auto p-4 pb-24 lg:pb-8">
      
      {/* HEADER (Only show if not in Course View) */}
      {!selectedCourse && (
        <div className="bg-blue-900 rounded-2xl p-8 mb-8 text-white relative overflow-hidden">
            <div className="relative z-10 max-w-xl">
                <h1 className="text-3xl font-bold mb-2">Formação Pascom</h1>
                <p className="text-blue-100 mb-6">Desenvolva suas habilidades técnicas e espirituais para melhor servir.</p>
                <div className="flex gap-4">
                    <div className="bg-blue-800/50 p-3 rounded-lg flex items-center gap-3">
                        <BookOpen className="text-yellow-400" />
                        <div>
                            <p className="text-xl font-bold">{courses.length}</p>
                            <p className="text-xs text-blue-200">Cursos</p>
                        </div>
                    </div>
                    <div className="bg-blue-800/50 p-3 rounded-lg flex items-center gap-3">
                        <FileText className="text-yellow-400" />
                        <div>
                            <p className="text-xl font-bold">{documents.length}</p>
                            <p className="text-xs text-blue-200">Arquivos</p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="absolute right-0 top-0 h-full w-1/2 opacity-10 transform translate-x-1/4 -skew-x-12 bg-white"></div>
        </div>
      )}

      {/* VIEW: COURSE DETAIL */}
      {selectedCourse ? (
          <div className="animate-fade-in">
              <button 
                onClick={handleBackToCourses} 
                className="mb-4 flex items-center gap-2 text-gray-500 hover:text-blue-600 font-medium transition-colors"
              >
                  <ArrowLeft size={20} /> Voltar para Cursos
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Course Info / Player */}
                  <div className="lg:col-span-2 space-y-6">
                      
                      {/* PLAYER OR COVER */}
                      <div className="bg-black rounded-xl shadow-lg overflow-hidden relative aspect-video flex items-center justify-center group/player">
                          {currentLesson ? (
                              (() => {
                                  const embed = getEmbedUrl(currentLesson.videoUrl);
                                  
                                  if (!embed) return (
                                    <div className="text-white text-center p-6">
                                        <AlertTriangle size={40} className="mx-auto mb-2 text-yellow-500" />
                                        <p>Formato de vídeo inválido ou vazio.</p>
                                    </div>
                                  );

                                  // Check for external Youtube fallback (parse failed or link is weird)
                                  if (embed.type === 'external_youtube') {
                                      return (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-white p-8 text-center">
                                            <Youtube size={64} className="mb-4 text-red-600" />
                                            <h3 className="text-lg font-bold mb-2">Reprodução Externa</h3>
                                            <p className="text-sm text-gray-300 mb-6 max-w-xs mx-auto">
                                                Este vídeo não pode ser reproduzido aqui. Clique abaixo para assistir no YouTube.
                                            </p>
                                            <a 
                                                href={embed.src} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold transition-colors flex items-center gap-2 shadow-lg"
                                            >
                                                <ExternalLink size={18} /> Assistir no YouTube
                                            </a>
                                        </div>
                                      );
                                  }

                                  if (embed.type === 'video') {
                                      return (
                                          <video controls autoPlay className="w-full h-full">
                                              <source src={embed.src} type="video/mp4" />
                                              Seu navegador não suporta vídeos HTML5.
                                          </video>
                                      );
                                  } else {
                                      return (
                                          <iframe 
                                              src={embed.src} 
                                              title={currentLesson.title}
                                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                              allowFullScreen
                                              className="w-full h-full border-0"
                                          ></iframe>
                                      );
                                  }
                              })()
                          ) : (
                              selectedCourse.thumbnail ? (
                                  <div className="relative w-full h-full group cursor-pointer" onClick={() => lessons.length > 0 && handlePlayLesson(lessons[0])}>
                                      <img src={selectedCourse.thumbnail} alt={selectedCourse.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                              <Play className="text-white fill-white ml-1" size={32} />
                                          </div>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="text-gray-500 flex flex-col items-center">
                                      <BookOpen size={64} className="mb-4 opacity-50" />
                                      <p>Selecione uma aula para assistir</p>
                                  </div>
                              )
                          )}
                      </div>

                      {/* Fallback link if video fails to load or is refused */}
                      {currentLesson && (
                        <div className="flex justify-between items-center px-1">
                            <p className="text-xs text-gray-400">Problemas na reprodução?</p>
                            <a 
                                href={currentLesson.videoUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
                            >
                                <ExternalLink size={12} /> Abrir vídeo original
                            </a>
                        </div>
                      )}

                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                  <h2 className="text-2xl font-bold text-gray-900">{currentLesson ? currentLesson.title : selectedCourse.title}</h2>
                                  {!currentLesson && (
                                    <span className="inline-block mt-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wide">
                                        {selectedCourse.category}
                                    </span>
                                  )}
                              </div>
                          </div>
                          <p className="text-gray-600 mb-6 mt-2">
                              {currentLesson ? currentLesson.description : "Acompanhe as aulas abaixo. Marque como concluído para acompanhar seu progresso."}
                          </p>
                          
                          {/* Lessons List */}
                          <div className="space-y-3">
                              <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                                  <PlayCircle size={20} className="text-blue-600" /> 
                                  Conteúdo do Curso ({lessons.length} aulas)
                              </h3>
                              
                              {lessonsLoading ? (
                                  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" /></div>
                              ) : lessons.length === 0 ? (
                                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-500">
                                      Nenhuma aula cadastrada ainda.
                                  </div>
                              ) : (
                                  lessons.map((lesson, idx) => {
                                      const isActive = currentLesson?.id === lesson.id;
                                      return (
                                          <div 
                                            key={lesson.id} 
                                            onClick={() => handlePlayLesson(lesson)}
                                            className={`flex items-start gap-3 p-4 border rounded-lg transition-all cursor-pointer group ${
                                                isActive 
                                                ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' 
                                                : 'bg-white border-gray-200 hover:bg-gray-50'
                                            }`}
                                          >
                                              <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                                  {isActive ? <Play size={12} fill="currentColor" /> : idx + 1}
                                              </div>
                                              <div className="flex-1">
                                                  <div className="flex justify-between items-start">
                                                      <h4 className={`font-semibold ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>{lesson.title}</h4>
                                                      <div className="flex items-center gap-2">
                                                          {lesson.duration && <span className="text-xs text-gray-500">{lesson.duration}</span>}
                                                          {isAdmin && (
                                                              <button 
                                                                  onClick={(e) => { e.stopPropagation(); setDeleteLessonId(lesson.id); }}
                                                                  className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors" 
                                                                  title="Excluir aula"
                                                              >
                                                                  <Trash2 size={14} />
                                                              </button>
                                                          )}
                                                      </div>
                                                  </div>
                                                  {/* Show description in list only if not active, to save space, or keep simple */}
                                                  {!isActive && lesson.description && <p className="text-sm text-gray-500 mt-1 line-clamp-1">{lesson.description}</p>}
                                                  
                                                  <div className="mt-2 text-xs font-medium text-blue-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <PlayCircle size={14} /> Assistir agora
                                                  </div>
                                              </div>
                                          </div>
                                      );
                                  })
                              )}
                          </div>
                      </div>
                  </div>

                  {/* Right Column: Add Lesson (Admin) & Stats */}
                  <div className="space-y-6">
                      {/* Progress Card */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                          <h3 className="font-bold text-gray-800 mb-2">Seu Progresso</h3>
                          <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                              <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${selectedCourse.progress}%` }}></div>
                          </div>
                          <p className="text-sm text-gray-500">{selectedCourse.progress}% concluído</p>
                      </div>

                      {/* Add Lesson Form (Admin Only) */}
                      {isAdmin && (
                          <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-100 ring-4 ring-blue-50/50">
                              <div className="flex justify-between items-center mb-4">
                                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                      <Plus size={18} className="text-blue-600" /> Adicionar Aula
                                  </h3>
                              </div>

                              {!isLessonFormOpen ? (
                                  <button 
                                      onClick={() => setIsLessonFormOpen(true)}
                                      className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors font-medium text-sm"
                                  >
                                      Nova Aula
                                  </button>
                              ) : (
                                  <div className="space-y-3 animate-fade-in">
                                      <input 
                                          type="text" 
                                          placeholder="Título da Aula"
                                          value={lessonFormData.title}
                                          onChange={e => setLessonFormData({...lessonFormData, title: e.target.value})}
                                          className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                      />
                                      <input 
                                          type="text" 
                                          placeholder="Link do Vídeo (YouTube/Vimeo)"
                                          value={lessonFormData.videoUrl}
                                          onChange={e => setLessonFormData({...lessonFormData, videoUrl: e.target.value})}
                                          className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                      />
                                      <input 
                                          type="text" 
                                          placeholder="Duração (ex: 15min)"
                                          value={lessonFormData.duration}
                                          onChange={e => setLessonFormData({...lessonFormData, duration: e.target.value})}
                                          className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                      />
                                      <textarea 
                                          placeholder="Descrição (Opcional)"
                                          value={lessonFormData.description}
                                          onChange={e => setLessonFormData({...lessonFormData, description: e.target.value})}
                                          rows={2}
                                          className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500 resize-none"
                                      />
                                      <div className="flex gap-2">
                                          <button 
                                              onClick={() => setIsLessonFormOpen(false)}
                                              className="flex-1 py-1.5 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 text-sm"
                                          >
                                              Cancelar
                                          </button>
                                          <button 
                                              onClick={handleSaveLesson}
                                              disabled={lessonSaving || !lessonFormData.title}
                                              className="flex-1 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex justify-center items-center gap-1"
                                          >
                                              {lessonSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
                                          </button>
                                      </div>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      ) : (
        /* VIEW: COURSE LIST & LIBRARY */
        <>
            {/* Tabs */}
            <div className="flex items-center gap-6 border-b border-gray-200 mb-6">
                <button 
                    onClick={() => setActiveTab('courses')}
                    className={`pb-3 font-medium text-sm transition-colors relative ${activeTab === 'courses' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Cursos Online
                    {activeTab === 'courses' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
                </button>
                <button 
                    onClick={() => setActiveTab('library')}
                    className={`pb-3 font-medium text-sm transition-colors relative ${activeTab === 'library' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Biblioteca de Arquivos
                    {activeTab === 'library' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></span>}
                </button>
            </div>

            {/* --- COURSES TAB --- */}
            {activeTab === 'courses' && (
                <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-800">Meus Cursos</h2>
                        {isAdmin && (
                        <button 
                            onClick={() => handleOpenCourseModal()}
                            className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Plus size={16} /> Novo Curso
                        </button>
                        )}
                    </div>
                    
                    {courses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                                <BookOpen size={32} />
                            </div>
                            <p className="text-lg font-medium text-gray-700 mb-1">Nenhum curso disponível</p>
                            <p className="text-sm text-gray-500 mb-6">Comece criando trilhas de formação para a equipe.</p>
                            {isAdmin && (
                                <button 
                                    onClick={() => handleOpenCourseModal()}
                                    className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                                >
                                    <Plus size={18} /> Criar Primeiro Curso
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {courses.map((course) => (
                            <div 
                                key={course.id} 
                                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group relative flex flex-col h-full cursor-pointer"
                                onClick={() => handleSelectCourse(course)}
                            >
                                
                                {/* Course Image & Overlay */}
                                <div className="relative h-48 bg-gray-100 shrink-0">
                                    {course.thumbnail ? (
                                        <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                                            <BookOpen size={48} />
                                        </div>
                                    )}
                                    
                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <PlayCircle className="text-white w-12 h-12 drop-shadow-lg" />
                                    </div>
                                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-gray-800 shadow-sm z-10">
                                        {course.category}
                                    </div>

                                    {/* Admin Actions */}
                                    {isAdmin && (
                                        <div className="absolute top-2 right-2 flex gap-1 z-20">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleOpenCourseModal(course); }}
                                                className="p-1.5 bg-white/90 hover:bg-white text-gray-700 hover:text-blue-600 rounded shadow-sm transition-colors"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
                                                onClick={(e) => handleDeleteClick(course.id, e)}
                                                className="p-1.5 bg-white/90 hover:bg-white text-gray-700 hover:text-red-600 rounded shadow-sm transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-5 flex flex-col flex-1">
                                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 leading-tight">{course.title}</h3>
                                    
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                                        <span>{course.lessonsCount} aulas</span>
                                        <span>{course.progress}% completo</span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                                        <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${course.progress}%` }}></div>
                                    </div>

                                    <div className="mt-auto">
                                        <button className="w-full py-2 border border-blue-600 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:text-white">
                                            {course.progress > 0 ? 'Continuar' : 'Iniciar'} <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* --- LIBRARY TAB --- */}
            {activeTab === 'library' && (
                <div className="animate-fade-in">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div className="flex-1 w-full md:w-auto relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Buscar documento..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full md:w-80 pl-10 pr-4 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                            />
                        </div>
                        <button 
                            onClick={() => setIsUploadModalOpen(true)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                        >
                            <Upload size={18} /> Enviar Arquivo
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs">
                                <tr>
                                    <th className="p-4">Nome</th>
                                    <th className="p-4 hidden md:table-cell">Categoria</th>
                                    <th className="p-4 hidden sm:table-cell">Data</th>
                                    <th className="p-4 hidden md:table-cell">Tamanho</th>
                                    <th className="p-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredDocs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-400">
                                            Nenhum documento encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDocs.map((doc) => {
                                        const canDelete = isAdmin || doc.uploaderId === currentUser.id;
                                        return (
                                            <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                                            <FileText size={20} />
                                                        </div>
                                                        <span className="font-medium text-gray-900">{doc.title}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 hidden md:table-cell">
                                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">{doc.category}</span>
                                                </td>
                                                <td className="p-4 hidden sm:table-cell text-gray-500">
                                                    {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="p-4 hidden md:table-cell text-gray-500 text-xs font-mono">
                                                    {doc.size || '-'}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <a 
                                                            href={doc.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Baixar"
                                                        >
                                                            <Download size={18} />
                                                        </a>
                                                        {canDelete && (
                                                            <button 
                                                                onClick={() => handleDeleteDocument(doc)}
                                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- CREATE/EDIT COURSE MODAL --- */}
            {isCourseModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h3 className="text-lg font-bold text-gray-800">{editingCourseId ? 'Editar Curso' : 'Novo Curso'}</h3>
                            <button onClick={() => setIsCourseModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        
                        <div className="p-6 space-y-4 overflow-y-auto">
                            {/* Image Upload */}
                            <div className="flex flex-col items-center justify-center mb-4">
                                    <div 
                                        onClick={() => courseFileInputRef.current?.click()}
                                        className="w-full h-40 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative group"
                                    >
                                        {courseFormData.thumbnail ? (
                                            <>
                                                <img src={courseFormData.thumbnail} alt="Capa" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Camera className="text-white" size={32} />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <Camera className="text-gray-400 mb-2" size={32} />
                                                <span className="text-sm text-gray-500 font-medium">Capa do Curso</span>
                                            </>
                                        )}
                                    </div>
                                    <input 
                                        type="file" 
                                        ref={courseFileInputRef} 
                                        className="hidden" 
                                        accept="image/*" 
                                        onChange={handleCourseImageSelect}
                                    />
                                </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Título do Curso</label>
                                <input 
                                    type="text" 
                                    value={courseFormData.title}
                                    onChange={(e) => setCourseFormData({...courseFormData, title: e.target.value})}
                                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none placeholder-gray-400"
                                    placeholder="Ex: Introdução à Liturgia"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                                <select 
                                    value={courseFormData.category}
                                    onChange={(e) => setCourseFormData({...courseFormData, category: e.target.value})}
                                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                                >
                                    <option value="Liturgia">Liturgia</option>
                                    <option value="Fotografia">Fotografia</option>
                                    <option value="Identidade Visual">Identidade Visual</option>
                                    <option value="Redes Sociais">Redes Sociais</option>
                                    <option value="Espiritualidade">Espiritualidade</option>
                                    <option value="Técnica">Técnica/Equipamentos</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end rounded-b-2xl">
                            <button 
                                onClick={() => setIsCourseModalOpen(false)}
                                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSaveCourse}
                                disabled={courseLoading || !courseFormData.title}
                                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2"
                            >
                                {courseLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DELETE COURSE CONFIRMATION MODAL --- */}
            {deleteCourseId && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
                        <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Excluir Curso?</h3>
                        <p className="text-sm text-gray-600 mb-6">Esta ação apagará o curso e todo o histórico de progresso dos alunos associados.</p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteCourseId(null)} 
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

            {/* --- DELETE LESSON CONFIRMATION MODAL --- */}
            {deleteLessonId && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full text-center">
                        <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Excluir Aula?</h3>
                        <p className="text-sm text-gray-600 mb-6">Você tem certeza que deseja remover esta aula permanentemente?</p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteLessonId(null)} 
                                className="flex-1 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                                disabled={isDeletingLesson}
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleConfirmDeleteLesson}
                                disabled={isDeletingLesson}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
                            >
                                {isDeletingLesson && <Loader2 size={16} className="animate-spin" />}
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- UPLOAD DOCUMENT MODAL --- */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <h3 className="text-lg font-bold text-gray-800">Novo Documento</h3>
                            <button onClick={() => setIsUploadModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            {/* File Input */}
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-blue-300 transition-all group"
                            >
                                {selectedFile ? (
                                    <>
                                        <FileText className="text-blue-500 mb-2" size={32} />
                                        <p className="font-medium text-gray-800 text-center line-clamp-1">{selectedFile.name}</p>
                                        <p className="text-xs text-gray-400 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="text-gray-400 group-hover:text-blue-500 mb-2 transition-colors" size={32} />
                                        <p className="font-medium text-gray-600">Clique para selecionar</p>
                                        <p className="text-xs text-gray-400 mt-1">PDF, DOCX, PPTX (Max 10MB)</p>
                                    </>
                                )}
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Título do Documento</label>
                                <input 
                                    type="text" 
                                    value={docTitle}
                                    onChange={(e) => setDocTitle(e.target.value)}
                                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none placeholder-gray-400"
                                    placeholder="Ex: Manual de Liturgia 2024"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                                <select 
                                    value={docCategory}
                                    onChange={(e) => setDocCategory(e.target.value)}
                                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none"
                                >
                                    <option>Geral</option>
                                    <option>Liturgia</option>
                                    <option>Técnica</option>
                                    <option>Administrativo</option>
                                    <option>Espiritualidade</option>
                                    <option>Identidade Visual</option>
                                </select>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end rounded-b-2xl">
                            <button 
                                onClick={() => setIsUploadModalOpen(false)}
                                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleUpload}
                                disabled={uploading || !selectedFile || !docTitle}
                                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2"
                            >
                                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Enviar
                            </button>
                        </div>
                    </div>
                </div>
            )}
    </div>
  );
};