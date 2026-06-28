import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Course, Lesson, User } from '../../types';
import { LMSModule, LMSQuiz, LMSQuestion, LMSQuizAttempt, LMSMaterial, LMSForumPost, LMSForumReply, LMSLessonComment, LMSCalendarEvent, LMSMessage, LMSBadge, LMSLeaderboardRow, LMSCertificate } from '../../lmsTypes';
import { lmsService } from '../../lmsService';
import { QuizSystem } from './QuizSystem';
import { supabase } from '../../supabaseClient';
import { 
  BookOpen, ChevronLeft, ChevronRight, CheckCircle2, Play, FileText, 
  Download, Award, ArrowLeft, RefreshCw, Layers, Monitor, ThumbsUp,
  MessageSquare, Calendar, Send, Lock, Sparkles, Code, ExternalLink,
  Users, Bookmark, Clock, CheckSquare, ShieldCheck, Mail, SendHorizontal,
  Flame, BookOpenCheck, Trophy, Trash2, Menu, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Interactive premium Avatar matching exactly the user's uploaded portrait of tutor Ton
const TonAvatar: React.FC<{ size?: number }> = ({ size = 40 }) => {
  return (
    <img 
      src="https://i.imgur.com/09S3lJS.png" 
      alt="Ton Avatar" 
      width={size} 
      height={size} 
      className="shrink-0 select-none shadow-xs rounded-full bg-[#f8fafc] border border-slate-200 object-cover" 
      style={{ width: size, height: size }}
      referrerPolicy="no-referrer"
    />
  );
};

interface CourseClassroomProps {
  course: Course;
  currentUser: User;
  onBack: () => void;
  onRefresh: () => void;
}

// Convert any YouTube URL to standard embed layout
const getYoutubeEmbedUrl = (url?: string): string => {
  if (!url) return '';
  if (url.includes('/embed/')) return url;
  
  let videoId = '';
  if (url.includes('youtube.com/watch')) {
    try {
      const urlObj = new URL(url);
      videoId = urlObj.searchParams.get('v') || '';
    } catch {
      const match = url.match(/[?&]v=([^&#]+)/);
      if (match) videoId = match[1];
    }
  } else if (url.includes('youtu.be/')) {
    const parts = url.split('youtu.be/');
    if (parts.length > 1) {
      videoId = parts[1].split(/[?#]/)[0];
    }
  } else if (url.includes('youtube.com/shorts/')) {
    const parts = url.split('youtube.com/shorts/');
    if (parts.length > 1) {
      videoId = parts[1].split(/[?#]/)[0];
    }
  }

  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
  }
  return url;
};

// Simple Markdown parser to guarantee no compile issues with uninstalled libraries
const SimpleMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-4 text-slate-700 leading-relaxed text-sm md:text-base font-normal">
      {lines.map((line, i) => {
        let trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
          return <h1 key={i} className="text-xl md:text-2xl font-black text-slate-900 mt-6 mb-2 tracking-tight">{trimmed.slice(2)}</h1>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={i} className="text-lg md:text-xl font-black text-slate-800 mt-5 mb-2 tracking-tight">{trimmed.slice(3)}</h2>;
        }
        if (trimmed.startsWith('### ')) {
          return <h3 key={i} className="text-base md:text-lg font-bold text-slate-800 mt-4 mb-1.5">{trimmed.slice(4)}</h3>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return <li key={i} className="list-disc pl-5 ml-2 text-slate-650 leading-relaxed">{trimmed.slice(2)}</li>;
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={i} className="border-l-4 border-slate-350 bg-slate-50 pl-4 py-3 italic my-3 text-slate-600 rounded-r-2xl font-normal">
              {trimmed.slice(2)}
            </blockquote>
          );
        }
        if (trimmed === '---') {
          return <hr key={i} className="border-slate-100 my-5" />;
        }
        if (formattedBold(line).includes('**')) {
          const parts = line.split('**');
          return (
            <p key={i} className="min-h-[1.2rem]">
              {parts.map((p, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="font-extrabold text-slate-900">{p}</strong> : p)}
            </p>
          );
        }
        return <p key={i} className="min-h-[1.2rem]">{line}</p>;
      })}
    </div>
  );
};

const formattedBold = (txt: string) => txt;

export const CourseClassroom: React.FC<CourseClassroomProps> = ({ 
  course, currentUser, onBack, onRefresh 
}) => {
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<LMSModule[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [quizzes, setQuizzes] = useState<LMSQuiz[]>([]);
  const [materials, setMaterials] = useState<LMSMaterial[]>([]);
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string | number>>(new Set());

  // Interactive LMS Navigation Tab
  // 'classroom' | 'forum' | 'calendar' | 'messaging' | 'gamification' | 'grades'
  const [centerTab, setCenterTab] = useState<'classroom' | 'forum' | 'calendar' | 'messaging' | 'gamification' | 'grades'>('classroom');

  // Mobile UX States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isStudyTrailOpenMobile, setIsStudyTrailOpenMobile] = useState(false);

  // Navigation states inside classroom
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<LMSQuiz | null>(null);
  const [isQuizMode, setIsQuizMode] = useState(false);

  // Social State variables
  const [lessonComments, setLessonComments] = useState<LMSLessonComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [forumPosts, setForumPosts] = useState<LMSForumPost[]>([]);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [activePostForReplies, setActivePostForReplies] = useState<LMSForumPost | null>(null);
  const [newReplyText, setNewReplyText] = useState('');

  // Calendar states
  const [calendarEvents, setCalendarEvents] = useState<LMSCalendarEvent[]>([]);

  // Messages State
  const [messages, setMessages] = useState<LMSMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');

  // AI "Ton" Chat Specialist State
  const [tonMessages, setTonMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([
    { 
      role: 'model', 
      content: 'Olá! Sou o **Ton**, seu assistente de inteligência artificial especialista teórico e pastoral da trilha formativa. Fui treinado pelo ministrante do curso para tirar suas dúvidas com base em nossos materiais e teologia prática. Como posso apoiar você hoje?' 
    }
  ]);
  const [tonInputText, setTonInputText] = useState('');
  const [isTonLoading, setIsTonLoading] = useState(false);

  // Load Ton chat history for this specific course and user
  useEffect(() => {
    if (currentUser && course) {
      try {
        const saved = localStorage.getItem(`lms_ton_chat_history_${currentUser.id}_${course.id}`);
        if (saved) {
          setTonMessages(JSON.parse(saved));
        } else {
          setTonMessages([
            { 
              role: 'model', 
              content: 'Olá! Sou o **Ton**, seu assistente de inteligência artificial especialista teórico e pastoral da trilha formativa. Fui treinado pelo ministrante do curso para tirar suas dúvidas com base em nossos materiais e teologia prática. Como posso apoiar você hoje?' 
            }
          ]);
        }
      } catch (e) {
        console.error("Erro ao carregar histórico do Ton (LMS):", e);
      }
    }
  }, [currentUser, course]);

  // Save Ton chat history for this specific course and user to localStorage
  useEffect(() => {
    if (currentUser && course && tonMessages.length > 0) {
      try {
        localStorage.setItem(`lms_ton_chat_history_${currentUser.id}_${course.id}`, JSON.stringify(tonMessages));
      } catch (e) {
        console.error("Erro ao salvar histórico do Ton (LMS):", e);
      }
    }
  }, [tonMessages, currentUser, course]);

  // Gamification States
  const [leaderboard, setLeaderboard] = useState<LMSLeaderboardRow[]>([]);
  const [userBadges, setUserBadges] = useState<LMSBadge[]>([]);

  // Lesson Lock warning popup
  const [lockingPrereqTitle, setLockingPrereqTitle] = useState<string | null>(null);

  // Document Mock Reader Panel settings
  const [mockPageNum, setMockPageNum] = useState(1);
  const [mockPageCount, setMockPageCount] = useState(5);
  const [readerFontSize, setReaderFontSize] = useState<'sm' | 'md' | 'lg'>('md');

  // Syntax highlighting mock terminal output
  const [isCodeCompiled, setIsCodeCompiled] = useState(false);
  const [codeRunResponse, setCodeRunResponse] = useState('');

  // Automatic certificate celebration modal
  const [showCertificateUnlockModal, setShowCertificateUnlockModal] = useState<boolean>(false);

  useEffect(() => {
    loadClassroomData();
  }, [course.id]);

  useEffect(() => {
    if (activeLesson) {
      loadLessonComments(activeLesson.id);
      setIsCodeCompiled(false);
      setCodeRunResponse('');
    }
  }, [activeLesson]);

  const loadClassroomData = async () => {
    setLoading(true);
    try {
      // 1. Fetch modules
      const mods = await lmsService.fetchModules(course.id);
      setModules(mods.sort((a,b) => a.orderIndex - b.orderIndex));

      // 2. Fetch materials
      const mats = await lmsService.fetchMaterials(course.id);
      setMaterials(mats);

      // 3. Fetch lessons from lmsService
      let matchedLessons = await lmsService.fetchLessons(course.id);
      
      // Fallback Seed injector if lessons list is empty
      if (matchedLessons.length === 0) {
        matchedLessons = [
          { 
            id: `l-1`, 
            courseId: course.id, 
            moduleId: mods[0]?.id || 'mod-default', 
            title: 'Introdução e Vocação Geral do Comunicador', 
            duration: '08:00',
            description: 'Breve teologia e objetivos principais da comunicação pastoral baseados no diretório de comunicação da CNBB.',
            contentType: 'markdown',
            markdownContent: '# Bem-vindo à Formação Interativa!\nEssa é uma experiência moderna inspirada nas melhores diretrizes de usabilidade estudantil.\n\n## 1. O Papel do Comunicador\nAnunciar Jesus Cristo é o cume da nossa comissão, vindo antes mesmo de qualquer recurso operacional.\n\n> "A Pascom não é apenas o grupo do som ou da fotografia, é a pastoral integradora de todas as mídias e serviços da paróquia." - Diretrizes Oficiais CNBB.',
            orderIndex: 1
          },
          { 
            id: `l-2`, 
            courseId: course.id, 
            moduleId: mods[0]?.id || 'mod-default', 
            title: 'Código Prático: Layout Litúrgico Responsivo', 
            duration: '14:20',
            description: 'Manipulação de elementos e codificação web com folha de estilo customizada para sites e canais de paróquias.',
            contentType: 'code',
            codeSnippet: `<!-- Exemplo de Card Litúrgico customizado -->
<div class="lithurgical-card max-a-3xl border-t-4 border-amber-600 rounded-xl bg-slate-50 p-6 self-center">
  <span class="text-amber-600 font-bold uppercase text-[10px]">Tempo Comum</span>
  <h3 class="text-slate-800 font-extrabold text-lg">Leitura do Dia</h3>
  <p class="text-slate-650 text-xs italic mt-2">"O Senhor é meu pastor e nada me faltará."</p>
  <button class="mt-4 px-4 py-2 bg-slate-900 text-white rounded text-xs">Marcar Presença</button>
</div>`,
            codeLanguage: 'html',
            orderIndex: 2
          },
          { 
            id: `l-3`, 
            courseId: course.id, 
            moduleId: mods[1]?.id || 'mod-default', 
            title: 'E-Book Completo de Fotometria e Uso das Cores', 
            duration: '22:00',
            description: 'Manual de bolso contendo técnicas fundamentais para fotografar missas com baixa claridade no presbitério.',
            contentType: 'document',
            documentUrl: 'https://www.cnbb.org.br/manual-comunicador-pdf',
            documentType: 'pdf',
            orderIndex: 3,
            isLocked: true,
            prerequisiteId: 'l-1' // Locked until Lesson 1 completed
          },
          {
            id: `l-4`,
            courseId: course.id,
            title: 'Simulação e Iframe: Painel Pastoral Externo',
            duration: '10:00',
            description: 'Ambiente prático em conformidade com as diretrizes da Pascom para aferição de cliques e estatísticas digitais.',
            contentType: 'embed',
            embedUrl: 'https://faustmelo-boop.github.io/moodle-mock-simulation',
            orderIndex: 4
          }
        ];
        // Save them to keep offline state updated
        for (let l of matchedLessons) {
          await lmsService.saveLesson(l);
        }
      }
      setLessons(matchedLessons.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)));

      // 4. Fetch Quizzes
      const courseQuizzes = await lmsService.fetchQuizzes(course.id);
      setQuizzes(courseQuizzes);

      // 5. Fetch lesson progress from localStorage
      const cachedProgressString = localStorage.getItem(`lms_completed_lessons_${currentUser.id}_${course.id}`);
      const cachedProgress = cachedProgressString ? JSON.parse(cachedProgressString) : [];
      setCompletedLessonIds(new Set(cachedProgress));

      // Set default loaded item
      const savedActiveLessonId = localStorage.getItem(`lms_active_lesson_id_${currentUser.id}_${course.id}`);
      const matchedSavedLesson = savedActiveLessonId ? matchedLessons.find(l => l.id === savedActiveLessonId) : null;
      
      const savedActiveQuizId = localStorage.getItem(`lms_active_quiz_id_${currentUser.id}_${course.id}`);
      const matchedSavedQuiz = savedActiveQuizId ? courseQuizzes.find(q => q.id === savedActiveQuizId) : null;

      if (matchedSavedQuiz) {
        setActiveQuiz(matchedSavedQuiz);
        setIsQuizMode(true);
        setCenterTab('classroom');
      } else if (matchedSavedLesson) {
        setActiveLesson(matchedSavedLesson);
        setActiveQuiz(null);
        setIsQuizMode(false);
        setCenterTab('classroom');
      } else if (matchedLessons.length > 0) {
        setActiveLesson(matchedLessons[0]);
      }

      // Load comments for active lesson
      const initialLesson = matchedSavedLesson || (matchedLessons.length > 0 ? matchedLessons[0] : null);
      if (initialLesson) {
        await loadLessonComments(initialLesson.id);
      }
      
      // Clean up single-use active selections so subsequent direct loads go to default unless clicked again
      localStorage.removeItem(`lms_active_lesson_id_${currentUser.id}_${course.id}`);
      localStorage.removeItem(`lms_active_quiz_id_${currentUser.id}_${course.id}`);

      // 6. Load Forum Posts
      const forumData = await lmsService.fetchForumPosts(course.id);
      setForumPosts(forumData);

      // 7. Load Calendar
      const calendarData = await lmsService.fetchCalendarEvents(course.id);
      setCalendarEvents(calendarData);

      // 8. Load messaging
      const messagesData = await lmsService.fetchMessages(currentUser.id);
      setMessages(messagesData);

      // 9. Load leaderboards and badges
      const leaderboardData = await lmsService.fetchLeaderboard();
      setLeaderboard(leaderboardData);
      const badgesData = await lmsService.fetchUserBadges(currentUser.id);
      setUserBadges(badgesData);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadLessonComments = async (lessonId: string) => {
    try {
      const comms = await lmsService.fetchLessonComments(course.id, lessonId);
      setLessonComments(comms);
    } catch (e) {
      console.error(e);
    }
  };

  const checkPrerequisiteCompleted = (item: Lesson | LMSQuiz): boolean => {
    if (!item.prerequisiteId) return true;
    
    // Prerequisite can be a lesson or quiz ID
    const completed = completedLessonIds.has(item.prerequisiteId);
    if (completed) return true;

    // Check if the prerequisite is a quiz and user passed it
    return false;
  };

  const toggleLessonComplete = async (lessonId: string | number) => {
    const updatedSet = new Set(completedLessonIds);
    let isMarkingComplete = !updatedSet.has(lessonId);

    if (updatedSet.has(lessonId)) {
      updatedSet.delete(lessonId);
    } else {
      updatedSet.add(lessonId);
    }
    setCompletedLessonIds(updatedSet);

    // Save status locally
    localStorage.setItem(
      `lms_completed_lessons_${currentUser.id}_${course.id}`, 
      JSON.stringify(Array.from(updatedSet))
    );
    
    // Trigger Gamification Experience points (XP) if marked complete!
    if (isMarkingComplete) {
      await lmsService.earnXP(currentUser.id, 50); // EAD Completed Lecture reward (+50 XP)
      await lmsService.updateUserStreak(currentUser.id); // Update daily learning streak (Ofensiva)
      
      // Reload profile metrics Silently
      const updatedLeaderboard = await lmsService.fetchLeaderboard();
      setLeaderboard(updatedLeaderboard);
      const updatedBadges = await lmsService.fetchUserBadges(currentUser.id);
      setUserBadges(updatedBadges);
    }

    // Recalculate course percentage progress
    const totalLessonsCount = lessons.length;
    let computedPct = 0;
    if (totalLessonsCount > 0) {
      computedPct = Math.round((updatedSet.size / totalLessonsCount) * 100);
    }

    course.progress = computedPct;

    // Automatic Certificate Generation upon Completing all Course Lessons (100% progress)
    if (isMarkingComplete && computedPct === 100) {
      try {
        const clientCerts = await lmsService.fetchCertificates(currentUser.id);
        const alreadyHasCert = clientCerts.some(c => c.courseId === course.id);

        if (!alreadyHasCert) {
          const newCert: LMSCertificate = {
            id: `cert-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`,
            courseId: course.id,
            courseTitle: course.title,
            userId: currentUser.id,
            userName: currentUser.name,
            issuedAt: new Date().toISOString(),
            courseHours: course.id === 'c1' ? 30 : 15,
            directorName: 'Pe. Francisco José',
            templateId: 'classic'
          };
          await lmsService.saveCertificate(newCert);

          // Earn certificate digital badges (+200 XP!)
          await lmsService.earnXP(currentUser.id, 200);
          await lmsService.saveUserBadge(currentUser.id, 'badge-4');

          // Open the celebration modal overlay!
          setShowCertificateUnlockModal(true);
        }
      } catch (err) {
        console.error("Erro ao gerar certificado automático ao concluir o curso:", err);
      }
    }
    
    try {
      await supabase.from('courses').update({ progress: computedPct }).eq('id', course.id);
    } catch {
      // Offline fallback ignored
    }

    onRefresh();
  };

  const selectLessonItem = (lesson: Lesson) => {
    // Learning path lock logic check!
    if (!checkPrerequisiteCompleted(lesson)) {
      const prereqLesson = lessons.find(l => l.id === lesson.prerequisiteId);
      setLockingPrereqTitle(prereqLesson ? prereqLesson.title : 'Aula teológica anterior');
      return;
    }

    setIsQuizMode(false);
    setActiveQuiz(null);
    setActiveLesson(lesson);
    setCenterTab('classroom');
  };

  const selectQuizItem = (quiz: LMSQuiz) => {
    if (!checkPrerequisiteCompleted(quiz)) {
      const prereqLesson = lessons.find(l => l.id === quiz.prerequisiteId);
      setLockingPrereqTitle(prereqLesson ? prereqLesson.title : 'Aula teológica anterior');
      return;
    }

    setActiveLesson(null);
    setActiveQuiz(quiz);
    setIsQuizMode(true);
    setCenterTab('classroom');
  };

  // Comments Operations
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !activeLesson) return;

    const commObj: LMSLessonComment = {
      id: `lc-${Date.now()}`,
      courseId: course.id,
      lessonId: activeLesson.id,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      content: newCommentText,
      createdAt: new Date().toISOString()
    };

    await lmsService.saveLessonComment(commObj);
    setNewCommentText('');
    loadLessonComments(activeLesson.id);
    
    // Earn social interaction XP (+10 XP)
    await lmsService.earnXP(currentUser.id, 10);
  };

  // Forum Operations
  const handleCreateForumPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) return;

    const postObj: LMSForumPost = {
      id: `fp-${Date.now()}`,
      courseId: course.id,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      title: newPostTitle,
      content: newPostContent,
      createdAt: new Date().toISOString(),
      likes: 0,
      likedBy: [],
      replies: []
    };

    await lmsService.saveForumPost(postObj);
    setNewPostTitle('');
    setNewPostContent('');
    
    // Refresh forums
    const forumData = await lmsService.fetchForumPosts(course.id);
    setForumPosts(forumData);

    // Reward XP (+30 XP per active topic)
    await lmsService.earnXP(currentUser.id, 30);
  };

  const handleLikeForumPost = async (postId: string) => {
    await lmsService.likeForumPost(postId, currentUser.id);
    const forumData = await lmsService.fetchForumPosts(course.id);
    setForumPosts(forumData);
  };

  const handleAddForumReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReplyText.trim() || !activePostForReplies) return;

    const replyObj: LMSForumReply = {
      id: `fr-${Date.now()}`,
      postId: activePostForReplies.id,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      content: newReplyText,
      createdAt: new Date().toISOString()
    };

    await lmsService.saveForumReply(replyObj);
    setNewReplyText('');
    
    // Refresh active post replies locally
    const updatedPosts = await lmsService.fetchForumPosts(course.id);
    setForumPosts(updatedPosts);
    const refreshedPost = updatedPosts.find(p => p.id === activePostForReplies.id);
    if (refreshedPost) {
      setActivePostForReplies(refreshedPost);
    }

    await lmsService.earnXP(currentUser.id, 15);
  };

  // Messaging operations
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    const msgObj: LMSMessage = {
      id: `msg-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      recipientId: 'instr-1', // Default message recipient is Instructor (Pe. Francisco)
      content: newMessageText,
      createdAt: new Date().toISOString(),
      read: false
    };

    await lmsService.sendMessage(msgObj);
    setNewMessageText('');
    
    // Refresh messages
    const msgs = await lmsService.fetchMessages(currentUser.id);
    setMessages(msgs);
  };

  const handleSendTonMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tonInputText.trim() || isTonLoading) return;

    const userMessage = { role: 'user' as const, content: tonInputText };
    const updatedMessages = [...tonMessages, userMessage];
    setTonMessages(updatedMessages);
    setTonInputText('');
    setIsTonLoading(true);

    try {
      const response = await fetch("/api/gemini/ton-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          referenceMaterials: materials
        })
      });

      if (!response.ok) {
        throw new Error("Falha ao obter resposta do Ton");
      }

      const data = await response.json();
      if (data.success && data.reply) {
        setTonMessages(prev => [...prev, { role: 'model', content: data.reply }]);
        // Earn student XP (5 pts) for asking questions to Ton!
        await lmsService.earnXP(currentUser.id, 5);
        if (onRefresh) onRefresh();
      } else {
        throw new Error(data.error || "Erro desconhecido");
      }
    } catch (err: any) {
      console.error(err);
      setTonMessages(prev => [
        ...prev,
        { role: 'model', content: "Desculpe-me, tive um breve imprevisto e não consegui responder agora. Poderia repetir a pergunta, por favor?" }
      ]);
    } finally {
      setIsTonLoading(false);
    }
  };

  // Mock code compiler simulator
  const runCodeSimulation = () => {
    setIsCodeCompiled(true);
    if (!activeLesson?.codeSnippet) return;

    if (activeLesson.codeLanguage === 'html' || activeLesson.codeSnippet.includes('<div>')) {
      setCodeRunResponse("✅ RENDER SUCCESS\nSua folha de estilo foi emulada com sucesso no frame virtual.\n\n[Console Litúrgico] Atributos aplicados:\n  - border-top: 4px solid #d97706 (Mel de Abóbora)\n  - padding: 1.5rem\n  - text-align: center");
    } else {
      setCodeRunResponse("✅ EXECUTE SUCCESS\n[Retorno do Servidor]:\nStatus: 200 OK\nPayload parsing: literal XML liturgic schema loaded correctly.");
    }
  };

  // Paging actions for interactive material preview
  const handleReaderPrev = () => {
    if (mockPageNum > 1) setMockPageNum(mockPageNum - 1);
  };
  const handleReaderNext = () => {
    if (mockPageNum < mockPageCount) setMockPageNum(mockPageNum + 1);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm col-span-3">
        <RefreshCw className="animate-spin text-brand-blue mb-4 hover:text-blue-500" size={32} />
        <span className="font-extrabold text-xs text-slate-400 uppercase tracking-widest">Sincronizando Plataforma EAD...</span>
      </div>
    );
  }

  // Calculate generic progress stats
  const totalItemsCount = lessons.length + quizzes.length;
  const completedItemsCount = completedLessonIds.size;
  const generalPercentage = totalItemsCount > 0 
    ? Math.round((completedItemsCount / totalItemsCount) * 100) 
    : 0;

  return (
    <div className="space-y-2 lg:space-y-3.5 max-w-7xl mx-auto px-2 md:px-0 lg:h-full lg:max-h-full lg:min-h-0 flex flex-col w-full">
      
      {/* Top Header Navigation Line: Super Compact and Integrated with horizontal tabs in the same line on Desktop */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 border-b border-slate-100 pb-2 md:pb-2.5">
        <div className="flex justify-between items-center w-full lg:w-auto gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={onBack}
              className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 hover:text-slate-900 transition-colors cursor-pointer select-none shrink-0"
            >
              <ArrowLeft size={11} className="text-slate-450" /> Painel
            </button>
            <div className="h-4 w-[1px] bg-slate-200 shrink-0 hidden sm:block"></div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-base font-black text-slate-850 tracking-tight flex items-center gap-1 leading-none">
                <Bookmark className="text-brand-blue fill-brand-blue/5 shrink-0" size={14} /> 
                <span className="truncate max-w-[120px] xs:max-w-[180px] sm:max-w-xs md:max-w-md">{course.title}</span>
              </h1>
              <p className="text-[8px] md:text-[9.5px] text-slate-450 font-bold uppercase tracking-wider leading-none mt-0.5">{course.category || 'Liturgia e Comunicação'}</p>
            </div>
          </div>

          {/* Mobile Sandwich Menu Trigger Icon */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-1.5 bg-slate-900 text-white rounded-lg flex items-center justify-center cursor-pointer transition-transform duration-200"
            title="Menu de Navegação"
          >
            {isMobileMenuOpen ? <X size={15} /> : <Menu size={15} />}
          </button>
        </div>

        {/* Desktop Only Inline Segmented Content Navigation Tabs */}
        <div className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl select-none shrink-0">
          <button
            onClick={() => { setCenterTab('classroom'); setIsQuizMode(false); setActiveQuiz(null); if (lessons.length > 0) setActiveLesson(lessons[0]); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10.5px] font-extrabold transition-all cursor-pointer ${
              centerTab === 'classroom'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'hover:bg-white/40 text-slate-550'
            }`}
          >
            <BookOpen size={11.5} /> Sala de Aula
          </button>

          <button
            onClick={() => { setCenterTab('forum'); setActivePostForReplies(null); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10.5px] font-extrabold transition-all cursor-pointer ${
              centerTab === 'forum'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'hover:bg-white/40 text-slate-550'
            }`}
          >
            <MessageSquare size={11.5} /> Fórum do Curso
          </button>

          <button
            onClick={() => setCenterTab('calendar')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10.5px] font-extrabold transition-all cursor-pointer ${
              centerTab === 'calendar'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'hover:bg-white/40 text-slate-550'
            }`}
          >
            <Calendar size={11.5} /> Calendário
          </button>

          <button
            onClick={() => setCenterTab('messaging')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10.5px] font-extrabold transition-all cursor-pointer ${
              centerTab === 'messaging'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'hover:bg-white/40 text-slate-550'
            }`}
          >
            <Sparkles size={11.5} className="text-amber-550 fill-amber-500/10 shrink-0" /> Ton IA
          </button>


        </div>

        {/* Global Progress Gauge inside Classroom Header (More compact) */}
        <div className="flex items-center justify-between gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100 w-full lg:w-auto">
          <div className="text-left select-none">
            <span className="text-[10px] font-extrabold text-slate-700">{generalPercentage}% concluído</span>
          </div>
          <div className="w-20 lg:w-16 h-1 bg-slate-200 rounded-full overflow-hidden shrink-0">
            <div className="h-full bg-brand-blue transition-all duration-500" style={{ width: `${generalPercentage}%` }} />
          </div>
        </div>
      </div>

      {/* Mobile Expanding Drawer/Sandwich Menu Card (Remains for mobile ergonomics) */}
      {isMobileMenuOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:hidden bg-white p-3 rounded-2xl border border-slate-150 flex flex-col gap-1.5 shadow-lg"
        >
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 px-2 py-0.5 select-none">Navegação do AVA</span>
          <button
            onClick={() => { setCenterTab('classroom'); setIsQuizMode(false); setActiveQuiz(null); if (lessons.length > 0) setActiveLesson(lessons[0]); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              centerTab === 'classroom'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'hover:bg-slate-550 text-slate-700 bg-slate-50/50'
            }`}
          >
            <BookOpen size={15} /> <span>Sala de Aula</span>
          </button>

          <button
            onClick={() => { setCenterTab('forum'); setActivePostForReplies(null); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              centerTab === 'forum'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'hover:bg-slate-550 text-slate-700 bg-slate-50/50'
            }`}
          >
            <MessageSquare size={15} /> <span>Fórum do Curso</span>
          </button>

          <button
            onClick={() => { setCenterTab('calendar'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              centerTab === 'calendar'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'hover:bg-slate-550 text-slate-700 bg-slate-50/50'
            }`}
          >
            <Calendar size={15} /> <span>Calendário Acadêmico</span>
          </button>

          <button
            onClick={() => { setCenterTab('messaging'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              centerTab === 'messaging'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'hover:bg-slate-550 text-slate-700 bg-slate-50/50'
            }`}
          >
            <Sparkles size={15} className="text-amber-550 fill-amber-500/10 shrink-0" /> <span>Pergunte ao Ton (IA)</span>
          </button>


        </motion.div>
      )}

      {/* Main Structural layouts side-panel and workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-4 lg:flex-1 lg:min-h-0">
        
        {/* LEFT COLUMN: Course Contents, Chapters, and Evaluations index (Hidden on Mobile) */}
        <div className="hidden lg:block lg:col-span-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4 lg:h-full lg:max-h-full overflow-y-auto">
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
              <Layers size={13} className="text-[#007cba]" /> Trilha de Estudo (CNBB)
            </h4>
            <h3 className="font-extrabold text-slate-800 text-sm leading-tight">Módulos & Avaliações</h3>
          </div>

          <div className="space-y-4 border-b border-white pb-3">
            {modules.map((m, mIdx) => {
              // Filters lessons associated explicitly or by layout fallback
              const currentModuleLessons = lessons.filter(l => l.moduleId === m.id);

              return (
                <div key={m.id} className="space-y-1.5">
                  <span className="text-[9.5px] uppercase font-black text-slate-450 tracking-wide block bg-slate-50/60 p-1.5 rounded-lg border border-slate-100">
                    Mód {mIdx + 1}: {m.title.replace(`Módulo ${mIdx + 1}: `, '')}
                  </span>
                  
                  <div className="space-y-1 pl-1 border-l border-slate-100">
                    {currentModuleLessons.length === 0 ? (
                      <p className="text-[9px] text-slate-400 italic pl-1.5 py-0.5">Leituras livres ou vago</p>
                    ) : (
                      currentModuleLessons.map((lesson) => {
                        const finished = completedLessonIds.has(lesson.id);
                        const isActive = activeLesson?.id === lesson.id && !isQuizMode && centerTab === 'classroom';
                        const isLocked = !checkPrerequisiteCompleted(lesson);

                        return (
                          <button
                            key={`lesson-item-${lesson.id}`}
                            onClick={() => selectLessonItem(lesson)}
                            className={`w-full text-left p-1.5 py-1.5 rounded-lg text-[11px] font-bold leading-normal flex items-start gap-2 transition-all outline-none cursor-pointer ${
                              isActive 
                              ? 'bg-slate-900 text-white shadow-xs' 
                              : isLocked 
                              ? 'opacity-50 hover:bg-slate-50 text-slate-400' 
                              : 'bg-white hover:bg-slate-50 border border-transparent text-slate-650'
                            }`}
                          >
                            {isLocked ? (
                              <Lock size={11} className="shrink-0 mt-0.5 text-slate-400" />
                            ) : (
                              <CheckCircle2 size={11} className={`shrink-0 mt-0.5 ${finished ? 'text-brand-green' : isActive ? 'text-white/40' : 'text-slate-305'}`} />
                            )}
                            <span className="flex-1 truncate">{lesson.title}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}

            {/* Quizzes and activities list directly at bottom */}
            {quizzes.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider flex items-center gap-1.5 pl-1.5">
                  <CheckSquare size={12} className="text-amber-500" /> Certificação Teórica
                </span>
                <div className="space-y-1.5 pl-2">
                  {quizzes.map((quiz) => {
                    const isLocked = !checkPrerequisiteCompleted(quiz);
                    return (
                      <button
                        key={`quiz-item-${quiz.id}`}
                        onClick={() => selectQuizItem(quiz)}
                        className={`w-full text-left p-3 rounded-xl text-xs font-black leading-snug flex items-center gap-2.5 transition-all cursor-pointer ${
                          activeQuiz?.id === quiz.id && isQuizMode && centerTab === 'classroom'
                          ? 'bg-amber-500 text-white shadow-md'
                          : isLocked
                          ? 'opacity-50 text-slate-400 cursor-not-allowed'
                          : 'bg-amber-550 border border-amber-100 text-amber-800 hover:bg-amber-100/50'
                        }`}
                      >
                        {isLocked ? <Lock size={12} /> : <Award size={13} className="shrink-0" />}
                        <span className="flex-1 truncate">{quiz.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive workspace boards based on Selected Tab */}
        <div className="lg:col-span-3 lg:h-full lg:max-h-full overflow-hidden lg:flex lg:flex-col lg:min-h-0">
          
          {/* TAB 1: MASTER CLASSROOM VIEW */}
          {centerTab === 'classroom' && (
            <div className="bg-white p-3.5 lg:p-4 rounded-xl border border-slate-100 shadow-sm space-y-3.5 lg:h-full lg:max-h-full lg:flex lg:flex-col lg:min-h-0 overflow-y-auto lg:pr-2.5">
              
              {/* MOBILE SYLLABUS DROPDOWN (Lista Suspensa) */}
              <div className="block lg:hidden bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                <button
                  type="button"
                  onClick={() => setIsStudyTrailOpenMobile(!isStudyTrailOpenMobile)}
                  className="w-full flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 hover:border-slate-300 font-extrabold text-xs text-slate-850 cursor-pointer select-none"
                >
                  <span className="flex items-center gap-1.5 text-left min-w-0">
                    <Layers size={14} className="text-[#007cba] shrink-0" />
                    <span className="truncate">
                      {isQuizMode && activeQuiz 
                        ? `Avaliação: ${activeQuiz.title}` 
                        : activeLesson 
                        ? `Aula: ${activeLesson.title}` 
                        : "Selecione uma aula ou avaliação"
                      }
                    </span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-mono shrink-0">Trilha</span>
                    {isStudyTrailOpenMobile ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
                  </div>
                </button>

                {isStudyTrailOpenMobile && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-2 max-h-[300px] overflow-y-auto space-y-3.5 border-t border-slate-200 mt-2"
                  >
                    <div className="space-y-3">
                      {modules.map((m, mIdx) => {
                        const currentModuleLessons = lessons.filter(l => l.moduleId === m.id);
                        return (
                          <div key={`m-mob-${m.id}`} className="space-y-1">
                            <span className="text-[9px] uppercase font-black text-slate-450 tracking-wider block bg-slate-100/70 p-1.5 rounded-lg">
                              Módulo {mIdx + 1}: {m.title.replace(`Módulo ${mIdx + 1}: `, '')}
                            </span>
                            <div className="space-y-1 pl-1 border-l border-slate-200">
                              {currentModuleLessons.length === 0 ? (
                                <p className="text-[9px] text-slate-400 italic pl-1.5 py-0.5">Sem aulas cadastradas</p>
                              ) : (
                                currentModuleLessons.map((lesson) => {
                                  const finished = completedLessonIds.has(lesson.id);
                                  const isActive = activeLesson?.id === lesson.id && !isQuizMode;
                                  const isLocked = !checkPrerequisiteCompleted(lesson);

                                  return (
                                    <button
                                      key={`lesson-mob-item-${lesson.id}`}
                                      disabled={isLocked}
                                      onClick={() => {
                                        selectLessonItem(lesson);
                                        setIsStudyTrailOpenMobile(false);
                                      }}
                                      className={`w-full text-left p-2 rounded-lg text-[11px] font-bold leading-normal flex items-start gap-2 transition-all outline-none cursor-pointer ${
                                        isActive
                                        ? 'bg-slate-950 text-white shadow-xs'
                                        : isLocked
                                        ? 'opacity-40 text-slate-450 cursor-not-allowed'
                                        : 'bg-white hover:bg-slate-100 border border-slate-100 text-slate-650'
                                      }`}
                                    >
                                      {isLocked ? (
                                        <Lock size={10} className="shrink-0 mt-0.5" />
                                      ) : (
                                        <CheckCircle2 size={11} className={`shrink-0 mt-0.5 ${finished ? 'text-brand-green' : isActive ? 'text-white/40' : 'text-slate-350'}`} />
                                      )}
                                      <span className="truncate flex-1">{lesson.title}</span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Quizzes list inside dropdown */}
                      {quizzes.length > 0 && (
                        <div className="space-y-1 pt-1.5 border-t border-slate-200">
                          <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider flex items-center gap-1">
                            <CheckSquare size={11} className="text-amber-550" /> Avaliações Teóricas
                          </span>
                          <div className="space-y-1 pl-1">
                            {quizzes.map((quiz) => {
                              const isLocked = !checkPrerequisiteCompleted(quiz);
                              const isActive = activeQuiz?.id === quiz.id && isQuizMode;
                              return (
                                <button
                                  key={`quiz-mob-item-${quiz.id}`}
                                  disabled={isLocked}
                                  onClick={() => {
                                    selectQuizItem(quiz);
                                    setIsStudyTrailOpenMobile(false);
                                  }}
                                  className={`w-full text-left p-2 rounded-lg text-[11px] font-black leading-normal flex items-center gap-2 transition-all cursor-pointer ${
                                    isActive
                                    ? 'bg-amber-500 text-white'
                                    : isLocked
                                    ? 'opacity-40 text-slate-450 cursor-not-allowed'
                                    : 'bg-amber-550/70 hover:bg-amber-100/50 border border-amber-100 text-amber-800'
                                  }`}
                                >
                                  {isLocked ? <Lock size={10} /> : <Award size={11} className="shrink-0" />}
                                  <span className="truncate flex-1">{quiz.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
              
              <AnimatePresence mode="wait">
                
                {/* A. RENDERING INDIVIDUAL ACTIVE MODULE LESSON */}
                {activeLesson && !isQuizMode && (
                  <motion.div
                    key={`lesson-render-${activeLesson.id}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="space-y-6"
                  >
                    {/* Media render matching lesson content types */}
                    {activeLesson.contentType === 'text' && (
                      <div className="w-full bg-slate-50 border border-slate-150 p-6 md:p-8 rounded-[11px] max-h-[400px] overflow-y-auto prose max-w-none text-slate-800 leading-relaxed font-medium">
                        <div className="space-y-4 whitespace-pre-line text-sm md:text-base">
                          {activeLesson.textContent || 'O conteúdo de leitura ainda está sendo polido e carregado.'}
                        </div>
                      </div>
                    )}

                    {activeLesson.contentType === 'markdown' && (
                      <div className="w-full bg-stone-50 border border-stone-200 p-6 md:p-8 rounded-[11px] max-h-[450px] overflow-y-auto prose max-w-none">
                        <SimpleMarkdown content={activeLesson.markdownContent || ''} />
                      </div>
                    )}

                    {activeLesson.contentType === 'html' && (
                      <div className="w-full bg-slate-900 border border-slate-850 p-0.5 rounded-[12px] overflow-hidden min-h-[380px] relative">
                        <div 
                          className="w-full min-h-[380px] bg-slate-900 text-slate-100 flex flex-col justify-center pre [&_iframe]:w-full [&_iframe]:h-[380px] [&_iframe]:border-0"
                          dangerouslySetInnerHTML={{ __html: activeLesson.htmlContent || '<p class="text-slate-400 text-center text-xs py-10">Integração de código concluída com sucesso.</p>' }}
                        />
                      </div>
                    )}

                    {activeLesson.contentType === 'video' && (
                      <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg border border-slate-20/5 shadow-black/5 relative">
                        <iframe
                          src={getYoutubeEmbedUrl(activeLesson.videoUrl || 'https://www.youtube.com/watch?v=N4Tf_Z-rE3E')}
                          title={activeLesson.title}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}

                    {/* MOODLE-STYLE INTERACTIVE FILE VIEWER */}
                    {activeLesson.contentType === 'document' && (
                      <div className="w-full border border-slate-200/80 rounded-2xl bg-slate-50 overflow-hidden shadow-inner flex flex-col">
                        <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="p-1 px-2 uppercase text-[9px] font-black tracking-widest bg-amber-500 rounded text-slate-950">
                              {activeLesson.documentType?.toUpperCase() || 'PDF'} Reader
                            </span>
                            <span className="font-bold truncate text-slate-300 max-w-[200px]">{activeLesson.title}</span>
                          </div>
                          
                          {/* Document reading toolbar */}
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setReaderFontSize(readerFontSize === 'sm' ? 'md' : readerFontSize === 'md' ? 'lg' : 'sm')}
                              className="p-1 text-[10px] font-black uppercase px-2 hover:bg-slate-800 rounded transition-colors"
                            >
                              Fonte: A{readerFontSize.toUpperCase()}
                            </button>
                            <a
                              href={activeLesson.documentUrl || '#'}
                              download
                              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 transition-colors px-3 py-1.5 rounded-lg text-xs font-bold"
                            >
                              <Download size={12} /> Download
                            </a>
                          </div>
                        </div>

                        {/* Paginated Simulation area */}
                        <div className="p-6 md:p-8 bg-white min-h-[300px] flex flex-col justify-between max-h-[400px] overflow-y-auto">
                          
                          <div className={`space-y-4 max-w-2xl mx-auto ${
                            readerFontSize === 'sm' ? 'text-xs' : readerFontSize === 'md' ? 'text-sm md:text-base' : 'text-lg md:text-xl'
                          } text-slate-700 leading-relaxed font-normal`}>
                            <h2 className="font-extrabold text-slate-900">Capítulo {mockPageNum}: Prática Eclesial de Comunicação</h2>
                            {mockPageNum === 1 && (
                              <p>Nesta primeira seção, introduzimos os conceitos essenciais do Manual do Comunicador. Uma ação de comunicação pastoral eficaz não se restringe a obter bons cliques espontâneos, mas em situar a câmera de tal modo que o mistério divino do sacrifício eucarístico seja capturado com reverência, silêncio e discrição.</p>
                            )}
                            {mockPageNum === 2 && (
                              <p>Fotometria Paroquial: O presbitério conta quase sempre com uma iluminação focal forte, vinda do claraboia e de holofotes quentes, enquanto a assembleia (as fileiras de bancos) permanece sob penumbra moderada ou luz natural dos vitrais. O triângulo de exposição deve privilegiar velocidades rápidas de obturação e ISOs altos, porém controlados para eliminar ruído estético.</p>
                            )}
                            {mockPageNum === 3 && (
                              <p>Comportamento do Agente Litúrgico: O fotógrafo e o operador de transmissão nunca devem chamar atenção para si durante a celebração sagrada. Vestimentas pretas ou escuras e discretas são recomendadas. Silêncio absoluto ao manusear as lentes e tripés. O momento ideal para registrar comunhão é no início da fila, jamais de costas para o altar.</p>
                            )}
                            {mockPageNum === 4 && (
                              <p>Canais de comunicação do Instagram, Facebook e sites devem atuar em sintonia com a secretaria da comunidade, publicando a liturgia diária, os avisos fundamentais, os eventos de caridade e, principalmente, as pastorais sociais e as intenções de oração que auxiliam s semente de Deus a brotar.</p>
                            )}
                            {mockPageNum === 5 && (
                              <p>Conclusão e Prática: O comunicador pastoral deve ser formado teologicamente e espiritualmente para exercer o seu apostolado de comunicador. Termine essa leitura e resolva as perguntas da avaliação teórica para obter sua certificação automática do curso.</p>
                            )}
                          </div>

                          {/* Pagination Slider controls */}
                          <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-6">
                            <button
                              disabled={mockPageNum === 1}
                              onClick={handleReaderPrev}
                              className="flex items-center gap-1.5 p-1 px-3 bg-slate-50 border hover:bg-slate-100 rounded-lg text-xs font-bold disabled:opacity-40 cursor-pointer select-none"
                            >
                              <ChevronLeft size={14} /> pág. Anterior
                            </button>
                            <span className="text-[11px] font-extrabold text-slate-400">Página {mockPageNum} de {mockPageCount}</span>
                            <button
                              disabled={mockPageNum === mockPageCount}
                              onClick={handleReaderNext}
                              className="flex items-center gap-1.5 p-1 px-3 bg-slate-50 border hover:bg-slate-100 rounded-lg text-xs font-bold disabled:opacity-40 cursor-pointer select-none"
                            >
                              Próxima pág. <ChevronRight size={14} />
                            </button>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* MOODLE-STYLE CODE SNIPPET AND RUNNER TERMINAL */}
                    {activeLesson.contentType === 'code' && (
                      <div className="w-full flex flex-col rounded-2xl overflow-hidden border border-slate-200">
                        {/* Tab header */}
                        <div className="bg-slate-900 border-b border-slate-850 p-4 flex items-center justify-between text-slate-200">
                          <div className="flex items-center gap-2">
                            <Code size={14} className="text-amber-500" />
                            <span className="text-xs font-bold font-mono">index.{activeLesson.codeLanguage || 'html'}</span>
                          </div>
                          <span className="text-[9.5px] uppercase font-black px-2 py-0.5 rounded bg-slate-800 text-slate-400">Editor Integrado</span>
                        </div>

                        {/* Code view */}
                        <div className="p-5 bg-slate-950 font-mono text-xs md:text-sm text-amber-500/90 leading-relaxed overflow-x-auto min-h-[180px] [&_pre]:m-0">
                          <pre>{activeLesson.codeSnippet || ''}</pre>
                        </div>

                        {/* Sandbox Console actions to test code syntax */}
                        <div className="p-4 bg-slate-900 border-t border-slate-850 flex items-center justify-between gap-4">
                          <span className="text-[10px] font-bold text-slate-400">Clique para testar a renderização do snippet litúrgico.</span>
                          <button
                            onClick={runCodeSimulation}
                            className="bg-brand-blue hover:bg-blue-600 transition-colors text-white text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl flex items-center gap-1.5"
                          >
                            <Sparkles size={13} /> Executar Depuração
                          </button>
                        </div>

                        {/* Interactive Compiler output panel */}
                        {isCodeCompiled && (
                          <div className="p-5 bg-slate-900 font-mono text-xs border-t border-slate-850 text-slate-300">
                            <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 block mb-2 font-sans">[CONSOLE DE OUTPUT]</span>
                            <pre className="whitespace-pre-wrap">{codeRunResponse}</pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SANDBOXED CONTENT IFRAME */}
                    {activeLesson.contentType === 'embed' && (
                      <div className="w-full border border-slate-200 rounded-2xl overflow-hidden shadow-inner flex flex-col bg-white">
                        <div className="bg-slate-50 border-b p-4 flex justify-between items-center text-xs text-slate-600">
                          <span className="flex items-center gap-1 font-bold"><ExternalLink size={13} /> Painel Sandbox Externo</span>
                          <span className="text-[9px] font-black uppercase text-slate-450 bg-slate-200 rounded px-1.5">Conectado</span>
                        </div>
                        <div className="aspect-video min-h-[350px] relative">
                          {/* We simulate a fully functional sandboxed widget inside */}
                          <div className="absolute inset-0 bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
                            <div className="p-4 bg-white rounded-full border shadow-sm">
                              <Monitor size={36} className="text-[#0284c7]" />
                            </div>
                            <h3 className="font-black text-slate-800 text-sm md:text-base">Moodle Virtual Widget</h3>
                            <p className="text-xs text-slate-600 max-w-sm font-medium leading-relaxed">Esse é um ambiente seguro simulado para manipulação de mídias de comunicação externas via iframe e barramentos remotos de clique.</p>
                            <a 
                              href={activeLesson.embedUrl || '#'} 
                              target="_blank" 
                              rel="noreferrer"
                              className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow"
                            >
                              Abrir em Nova Aba do Navegador <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Info and Lecture header details */}
                    <div className="space-y-4 border-t border-slate-100 pt-6">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                        <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight leading-none">{activeLesson.title}</h2>
                        
                        {/* Display lesson content type badge */}
                        <span className="text-[10px] font-black uppercase text-slate-600 px-3 py-1 bg-slate-100 rounded-full">
                          {activeLesson.contentType === 'text' && '📖 Leitura'}
                          {activeLesson.contentType === 'markdown' && '📝 Resumo Teológico'}
                          {activeLesson.contentType === 'html' && '⚡ Código HTML'}
                          {activeLesson.contentType === 'video' && '🎥 Vídeo-aula'}
                          {activeLesson.contentType === 'document' && '📂 Apostila'}
                          {activeLesson.contentType === 'code' && '💻 Coding Lab'}
                          {activeLesson.contentType === 'embed' && '🔗 Widget Virtual'}
                        </span>
                      </div>

                      {activeLesson.description && (
                        <p className="text-slate-600 text-xs md:text-sm leading-relaxed p-4 bg-slate-50/50 rounded-2xl border border-slate-100 italic font-medium">{activeLesson.description}</p>
                      )}

                      {/* PDF LINKS & ATTACHMENTS DISPLAY FOR STUDENTS */}
                      {((activeLesson.attachments && activeLesson.attachments.length > 0) || 
                        (activeLesson.pdfLinks && activeLesson.pdfLinks.length > 0)) && (
                        <div className="bg-slate-50/30 p-4 border border-slate-100 rounded-2xl space-y-3.5 mt-4">
                          <h4 className="text-[11px] font-black uppercase text-slate-450 tracking-wider flex items-center gap-1.5">
                            <Download size={12} className="text-[#007cba]" /> Materiais e Arquivos Complementares
                          </h4>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {activeLesson.pdfLinks && activeLesson.pdfLinks.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="block text-[9px] uppercase font-black tracking-wider text-slate-400">Links de Leitura (PDF)</span>
                                {activeLesson.pdfLinks.map((p, idx) => (
                                  <a 
                                    key={`stu-pdf-${idx}`}
                                    href={p.url}
                                    target="_blank"
                                    referrerPolicy="no-referrer"
                                    className="flex items-center justify-between p-2.5 bg-white border border-slate-150 rounded-xl hover:border-slate-300 hover:shadow-xs transition-all group cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileText size={14} className="text-red-500 shrink-0" />
                                      <span className="font-extrabold text-xs text-slate-700 truncate group-hover:text-slate-900">{p.title}</span>
                                    </div>
                                    <ExternalLink size={11} className="text-slate-350 group-hover:text-slate-600 shrink-0" />
                                  </a>
                                ))}
                              </div>
                            )}

                            {activeLesson.attachments && activeLesson.attachments.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="block text-[9px] uppercase font-black tracking-wider text-slate-400">Anexos para Baixar</span>
                                {activeLesson.attachments.map((file, idx) => (
                                  <a 
                                    key={`stu-att-${idx}`}
                                    href={file.url}
                                    target="_blank"
                                    referrerPolicy="no-referrer"
                                    className="flex items-center justify-between p-2.5 bg-white border border-slate-150 rounded-xl hover:border-[#007cba] hover:shadow-xs transition-all group cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <BookOpen size={14} className="text-emerald-500 shrink-0" />
                                      <div className="truncate text-left">
                                        <span className="font-extrabold text-xs text-slate-700 block truncate group-hover:text-[#007cba]">{file.name}</span>
                                        {file.size && <span className="text-[9px] text-slate-400 font-bold">{file.size}</span>}
                                      </div>
                                    </div>
                                    <Download size={11} className="text-slate-350 group-hover:text-[#007cba] shrink-0" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Complete lesson trigger button */}
                    <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                      <button
                        onClick={() => toggleLessonComplete(activeLesson.id)}
                        className={`flex items-center gap-1.5 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                          completedLessonIds.has(activeLesson.id)
                          ? 'bg-brand-green text-white shadow shadow-brand-green/10'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-650'
                        }`}
                      >
                        <CheckCircle2 size={14} />
                        {completedLessonIds.has(activeLesson.id) ? 'Aula Concluída (+50 XP)' : 'Concluir Aula (+50 XP)'}
                      </button>

                      {/* Display warning if materials exist */}
                      {materials.length > 0 && (
                        <div className="flex gap-2">
                          {materials.filter(m => m.moduleId === m.moduleId).slice(0, 2).map(mat => (
                            <a
                              key={mat.id}
                              href={mat.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-2 bg-slate-50 hover:bg-slate-100 border text-[11px] font-bold text-slate-700 rounded-xl transition-colors"
                            >
                              <FileText size={12} /> {mat.title}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* QUICK INTERACTIONS COMMENTS THREAD (Moodle-Style bottom widget per lesson) */}
                    <div className="mt-8 border-t border-slate-105 pt-6 space-y-4">
                      <h3 className="text-xs font-black uppercase text-slate-450 tracking-wider flex items-center gap-1.5">
                        <MessageSquare size={13} className="text-slate-400" /> Discussões e Esclarecimentos da Aula ({lessonComments.length})
                      </h3>
                      
                      {/* Comment Input */}
                      <form onSubmit={handleAddComment} className="flex gap-3">
                        <input
                          type="text"
                          required
                          placeholder="Fazer uma pergunta sobre esse tópico específico de aula..."
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-brand-blue"
                        />
                        <button 
                          type="submit"
                          className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider flex items-center gap-1"
                        >
                          Enviar <Send size={12} />
                        </button>
                      </form>

                      {/* Comment list */}
                      <div className="space-y-3.5 pt-2">
                        {lessonComments.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">Nenhum comentário nesta aula. Seja o primeiro a perguntar!</p>
                        ) : (
                          lessonComments.map((comm) => (
                            <div key={comm.id} className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-start gap-3">
                              <img 
                                src={comm.userAvatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80'} 
                                alt={comm.userName} 
                                className="w-8 h-8 rounded-full border shrink-0 object-cover"
                              />
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-extrabold text-slate-800">{comm.userName}</span>
                                  {comm.userName.includes('Pe.') && (
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#007cba]/10 text-[#007cba]">Clero</span>
                                  )}
                                  <span className="text-[9px] text-slate-400 font-bold">{new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-xs font-medium text-slate-650 leading-relaxed">{comm.content}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </motion.div>
                )}

                {/* B. RENDERING ACTIVE QUIZ SYSTEM */}
                {isQuizMode && activeQuiz && (
                  <motion.div
                    key={`quiz-render-${activeQuiz.id}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <QuizSystem
                      quiz={activeQuiz}
                      currentUser={currentUser}
                      courseTitle={course.title}
                      onFinished={() => {
                        loadClassroomData();
                      }}
                      onClose={() => {
                        setIsQuizMode(false);
                        setActiveQuiz(null);
                        if (lessons.length > 0) setActiveLesson(lessons[0]);
                      }}
                    />
                  </motion.div>
                )}

              </AnimatePresence>

              {/* Lower bottom classroom navigation back / next hooks */}
              {!isQuizMode && activeLesson && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-10 gap-3 text-slate-500 text-xs font-bold">
                  <button
                    disabled={lessons.findIndex(l => l.id === activeLesson.id) <= 0}
                    onClick={() => {
                      const idx = lessons.findIndex(l => l.id === activeLesson.id);
                      if (idx > 0) selectLessonItem(lessons[idx - 1]);
                    }}
                    className="flex items-center gap-1.5 hover:text-slate-900 disabled:opacity-40 cursor-pointer select-none"
                  >
                    <ChevronLeft size={16} /> Aula Anterior
                  </button>
                  <button
                    onClick={() => {
                      const idx = lessons.findIndex(l => l.id === activeLesson.id);
                      if (idx !== -1 && idx < lessons.length - 1) {
                        selectLessonItem(lessons[idx + 1]);
                      } else if (quizzes.length > 0) {
                        selectQuizItem(quizzes[0]);
                      }
                    }}
                    className="flex items-center gap-1.5 hover:text-slate-900 cursor-pointer select-none font-extrabold"
                  >
                    Próxima Lição <ChevronRight size={16} />
                  </button>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: ADVANCED FORUM DISCUSSIONS */}
          {centerTab === 'forum' && (
            <div className="bg-white p-3.5 lg:p-4 rounded-xl border border-slate-100 shadow-sm space-y-3.5 lg:h-full lg:max-h-full lg:flex lg:flex-col lg:min-h-0 overflow-y-auto lg:pr-2.5">
              
              {!activePostForReplies ? (
                /* Thread list views */
                <div className="space-y-6">
                  <div className="flex justify-between items-center gap-4">
                    <div className="space-y-0.5">
                      <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                        <MessageSquare className="text-brand-blue" size={20} /> Fórum Paroquial de Debates
                      </h2>
                      <p className="text-[11px] text-slate-450 font-bold uppercase tracking-wider">Esclarecimento de dúvidas e amadurecimento espiritual</p>
                    </div>
                  </div>

                  {/* Create New Thread form */}
                  <form onSubmit={handleCreateForumPost} className="p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-3">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Criar Nova Discussão / Esclarecimento</span>
                    <div className="space-y-2">
                      <input
                        type="text"
                        required
                        placeholder="Título do Tópico..."
                        value={newPostTitle}
                        onChange={(e) => setNewPostTitle(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black outline-none focus:border-brand-blue"
                      />
                      <textarea
                        required
                        rows={3}
                        placeholder="Explique sua dúvida técnica ou litúrgica..."
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-brand-blue"
                      />
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                      >
                        <SendHorizontal size={13} /> Publicar no Fórum (+30 XP)
                      </button>
                    </div>
                  </form>

                  {/* Posts feeds list */}
                  <div className="space-y-4 pt-2">
                    {forumPosts.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-10">O fórum está vazio neste momento. Crie um tópico arriba!</p>
                    ) : (
                      forumPosts.map((post) => (
                        <div key={post.id} className="p-5 bg-white border border-slate-150 hover:border-slate-250 transition-all rounded-[1.5rem] space-y-4">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex items-center gap-2.5">
                              <img 
                                src={post.userAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80'} 
                                alt={post.userName} 
                                className="w-9 h-9 rounded-full object-cover shrink-0 border"
                              />
                              <div>
                                <h3 className="font-extrabold text-slate-800 text-xs">{post.userName}</h3>
                                <span className="text-[9.5px] text-slate-400 font-bold">{new Date(post.createdAt).toLocaleDateString('pt-BR')} às {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                            {post.userId === 'instr-1' && (
                              <span className="bg-[#007cba]/10 text-[#007cba] text-[9px] font-black uppercase px-2 py-0.5 rounded-full">Instrutor</span>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <h4 className="font-extrabold text-slate-900 text-sm md:text-base leading-tight">{post.title}</h4>
                            <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap font-medium">{post.content}</p>
                          </div>

                          {/* Footer engagement panel */}
                          <div className="flex items-center justify-between border-t border-slate-50 pt-3 text-xs font-bold text-slate-500">
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => handleLikeForumPost(post.id)}
                                className={`flex items-center gap-1.5 p-1 px-2.5 rounded-lg border transition-all ${
                                  (post.likedBy || []).includes(currentUser.id)
                                  ? 'bg-rose-50 border-rose-100 text-rose-600'
                                  : 'bg-slate-50 hover:bg-slate-100'
                                }`}
                              >
                                <ThumbsUp size={13} /> {post.likes}
                              </button>
                              <button
                                onClick={() => setActivePostForReplies(post)}
                                className="flex items-center gap-1.5 p-1 px-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border"
                              >
                                <MessageSquare size={13} /> Respostas ({post.replies?.length || 0})
                              </button>
                            </div>

                            <button
                              onClick={() => setActivePostForReplies(post)}
                              className="text-brand-blue hover:underline text-xs"
                            >
                              Ver Conversa Completa →
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Thread detailed replies view */
                <div className="space-y-6">
                  <button
                    onClick={() => setActivePostForReplies(null)}
                    className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    <ArrowLeft size={14} /> Voltar aos Tópicos Gerais
                  </button>

                  {/* Main Parent Post card */}
                  <div className="p-5 bg-slate-50 border border-slate-150 rounded-[1.5rem] space-y-3">
                    <div className="flex items-center gap-2.5">
                      <img 
                        src={activePostForReplies.userAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80'} 
                        className="w-10 h-10 rounded-full border shrink-0 object-cover" 
                        alt=""
                      />
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-800">{activePostForReplies.userName}</h4>
                        <span className="text-[10px] text-slate-400 font-bold">{new Date(activePostForReplies.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-black text-slate-900 text-sm md:text-base">{activePostForReplies.title}</h3>
                      <p className="text-xs text-slate-650 leading-relaxed whitespace-pre-wrap font-medium">{activePostForReplies.content}</p>
                    </div>
                  </div>

                  {/* Replies feeds list */}
                  <div className="space-y-4 pl-4 border-l-2 border-slate-100">
                    <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Discussão encadeada ({activePostForReplies.replies?.length || 0})</h4>
                    
                    {activePostForReplies.replies?.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">Sem respostas enviadas neste tópico. Escreva uma abaixo.</p>
                    ) : (
                      activePostForReplies.replies?.map((r) => (
                        <div key={r.id} className="p-4 bg-white border border-slate-120 rounded-2xl space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                              <img 
                                src={r.userAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80'} 
                                className="w-8 h-8 rounded-full border shrinkage-0 object-cover" 
                                alt=""
                              />
                              <div>
                                <span className="font-extrabold text-xs text-slate-800 block">{r.userName}</span>
                                <span className="text-[9.5px] text-slate-400 font-bold">{new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                            {r.userName.includes('Pe. Francisco') && (
                              <span className="bg-[#007cba]/15 text-[#007cba] text-[8.5px] font-black uppercase px-2 py-0.5 rounded">Clero</span>
                            )}
                          </div>
                          <p className="text-xs font-semibold leading-relaxed text-slate-700 pt-1.5">{r.content}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Reply Form */}
                  <form onSubmit={handleAddForumReply} className="flex gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Adicione um esclarecimento construtivo ao fórum..."
                      value={newReplyText}
                      onChange={(e) => setNewReplyText(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-brand-blue"
                    />
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1 cursor-pointer"
                    >
                      Responder <Send size={12} />
                    </button>
                  </form>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: ACADEMIC CALENDAR & AGENDA */}
          {centerTab === 'calendar' && (
            <div className="bg-white p-3.5 lg:p-4 rounded-xl border border-slate-100 shadow-sm space-y-3 lg:h-full lg:max-h-full lg:flex lg:flex-col lg:min-h-0 overflow-y-auto lg:pr-2.5">
              <div className="space-y-0.5">
                <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                  <Calendar className="text-amber-500" size={20} /> Calendário Paroquial Acadêmico
                </h2>
                <p className="text-[11px] text-slate-450 font-bold uppercase tracking-wider">Acompanhamento das datas de provas litúrgicas e plantões gerais ao vivo</p>
              </div>

              {/* Event grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {calendarEvents.map((evt) => (
                  <div key={evt.id} className="p-4 rounded-2xl border bg-slate-50/50 hover:bg-slate-100/40 transition-colors flex items-start gap-3">
                    <div className="p-3 bg-white rounded-xl border shadow-sm shrink-0 flex flex-col items-center">
                      <span className="text-[10px] font-black uppercase text-amber-500">Mês</span>
                      <span className="text-lg font-black text-slate-800">
                        {new Date(evt.dueDate).getDay() + 10}
                      </span>
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded ${
                          evt.type === 'quiz' ? 'bg-amber-100 text-amber-700' :
                          evt.type === 'live' ? 'bg-[#007cba]/10 text-[#007cba]' : 'bg-brand-green/10 text-brand-green'
                        }`}>
                          {evt.type === 'quiz' ? 'Avaliação' : evt.type === 'live' ? 'Sessão ao Vivo' : 'Tarefa'}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-xs md:text-sm">{evt.title}</h4>
                      <p className="text-[11px] text-slate-500 font-bold leading-relaxed">{evt.description}</p>
                      <p className="text-[10px] text-slate-400 font-extrabold font-mono pt-1">Prazo: {new Date(evt.dueDate).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: PRIVATE MESSAGING DRAWER (REPLACED WITH TON AI SPECIALIST CHAT) */}
          {centerTab === 'messaging' && (
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4 lg:h-full lg:max-h-full lg:flex lg:flex-col lg:min-h-0">
              {/* Integrated Header of AI Chat */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-100 pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <TonAvatar size={40} />
                  <div className="space-y-0.5">
                    <h2 className="text-base md:text-lg font-black text-slate-800 tracking-tight flex items-center gap-1.5 leading-none">
                      Assistente Virtual Ton <span className="bg-amber-500/20 text-amber-600 border border-amber-500/30 text-[8px] font-black uppercase px-1.5 py-0.5 rounded ml-1 tracking-wide relative top-[-1px]">Tutor IA</span>
                    </h2>
                    <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-green inline-block animate-pulse"></span> Ativo para apoiar • Dúvidas pastorais e teológicas
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {materials.length > 0 && (
                    <span className="text-[9.5px] bg-emerald-50 text-emerald-700 font-extrabold px-3 py-1.5 rounded-full border border-emerald-100 uppercase tracking-wide select-none">
                      🧭 {materials.length} material(is)
                    </span>
                  )}
                  {/* Reset Chat button */}
                  <button 
                    onClick={() => {
                      if (confirm('Deseja realmente reiniciar sua conversa com Ton?')) {
                        setTonMessages([
                          { role: 'model', content: 'Olá novamente! Sou o **Ton**, seu assistente virtual. Em que ponto de sua formação pastoral ou técnica posso te auxiliar neste momento?' }
                        ]);
                      }
                    }} 
                    className="text-[9.5px] bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 font-extrabold px-3 py-1.5 rounded-xl border border-slate-200 transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    Reiniciar Chat
                  </button>
                </div>
              </div>

              {/* Chat Container integrated directly into the page */}
              <div className="flex-1 flex flex-col min-h-[300px] lg:min-h-0 lg:h-0 bg-slate-50/40 rounded-xl border border-slate-100 overflow-hidden">
                {/* Conversation Body */}
                <div className="p-5 space-y-4 flex-1 lg:h-0 overflow-y-auto flex flex-col bg-white">
                  {tonMessages.map((m, idx) => {
                    const isSelf = m.role === 'user';
                    return (
                      <div 
                        key={`ton-msg-${idx}`} 
                        className={`flex gap-2.5 max-w-[85%] ${isSelf ? 'self-end flex-row-reverse' : 'self-start items-start'}`}
                      >
                        {!isSelf && <TonAvatar size={28} />}
                        <div 
                          className={`p-3.5 rounded-[1.4rem] text-xs font-semibold leading-relaxed shadow-xs flex flex-col ${
                            isSelf 
                            ? 'bg-brand-blue text-white rounded-tr-none' 
                            : 'bg-slate-50 text-slate-750 border border-slate-100 rounded-tl-none'
                          }`}
                        >
                          {isSelf ? (
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          ) : (
                            <div className="prose prose-xs max-w-none text-slate-700">
                              <SimpleMarkdown content={m.content} />
                            </div>
                          )}
                          <span className="text-[8px] opacity-70 font-mono block text-right pt-2 mt-1 border-t border-slate-100/10">
                            {isSelf ? 'Você' : 'Ton'} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {isTonLoading && (
                    <div className="self-start flex gap-2.5 max-w-[80%] items-start">
                      <TonAvatar size={28} />
                      <div className="p-4 rounded-[1.4rem] rounded-tl-none bg-slate-50 text-slate-700 border border-slate-100 text-xs font-semibold leading-relaxed shadow-xs flex items-center gap-2">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-[10px] text-slate-450 italic font-medium">Ton está consultando a base de conhecimento...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Suggestion Chips */}
                <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex flex-wrap gap-2">
                  <span className="text-[9px] font-black uppercase text-slate-400 self-center tracking-wider mr-1">Sugestões:</span>
                  {[
                    "Resuma o que aprenderemos neste curso",
                    "Me dê dicas de estudo sobre este tema",
                    "Qual a importância pastoral deste conteúdo?"
                  ].map((sug, i) => (
                    <button
                      key={`sug-${i}`}
                      disabled={isTonLoading}
                      onClick={() => {
                        setTonInputText(sug);
                      }}
                      className="text-[10px] font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-full transition-all cursor-pointer disabled:opacity-40"
                    >
                      {sug}
                    </button>
                  ))}
                </div>

                {/* Send Footer */}
                <form onSubmit={handleSendTonMessage} className="p-3.5 bg-slate-50 border-t flex gap-2">
                  <input
                    type="text"
                    required
                    disabled={isTonLoading}
                    placeholder="Tire suas dúvidas pastorais ou teológicas..."
                    value={tonInputText}
                    onChange={(e) => setTonInputText(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-brand-blue disabled:opacity-50 transition-all placeholder:text-slate-400"
                  />
                  <button 
                    type="submit" 
                    disabled={isTonLoading || !tonInputText.trim()}
                    className="p-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed"
                  >
                    <SendHorizontal size={14} />
                  </button>
                </form>
              </div>
            </div>
          )}






        </div>

      </div>

      {/* WARNING POPUP DIALOG IF PRE-REQUISITE UNCOMPLETE */}
      <AnimatePresence>
        {lockingPrereqTitle && createPortal(
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-md w-full p-6 py-8 rounded-[2.5rem] border border-slate-100 shadow-xl text-center space-y-4"
            >
              <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                <Lock size={22} className="animate-bounce" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base md:text-lg font-black text-slate-900 leading-tight">Conteúdo Bloqueado</h3>
                <p className="text-xs text-slate-500 font-bold leading-normal">
                  Este curso possui trilha de aprendizagem sequencial (Moodle-EAD). Para desbloquear este item de ensino, você deve primeiro concluir con êxito a lição ou avaliação abaixo:
                </p>
              </div>

              <div className="p-3 bg-slate-50 border rounded-xl text-xs font-extrabold text-slate-700">
                {lockingPrereqTitle}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setLockingPrereqTitle(null)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Continuar Trilha
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* AUTOMATIC CERTIFICATE UNLOCKED CELEBRATION MODAL */}
      <AnimatePresence>
        {showCertificateUnlockModal && createPortal(
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white max-w-lg w-full p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl text-center space-y-6 relative overflow-hidden"
            >
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mt-10 -mr-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mb-10 -ml-10 pointer-events-none" />

              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <Award size={32} className="animate-pulse" />
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                  Curso Clássico Concluído!
                </span>
                <h3 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
                  Parabéns pela sua dedicação!
                </h3>
                <p className="text-xs md:text-sm text-slate-500 leading-relaxed font-bold">
                  Você contemplou todas as lições práticas, completando 100% de aproveitamento das matérias teológicas no curso <strong>{course.title}</strong>. Seu certificado oficial foi gerado e autenticado com sucesso!
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-left">
                <div className="flex justify-between items-center text-xs font-black text-slate-400 uppercase tracking-wider">
                  <span>DIPLOMA EMITIDO</span>
                  <span className="text-emerald-600 flex items-center gap-1 text-[11px]">
                    <ShieldCheck size={12} /> Autenticado
                  </span>
                </div>
                <div className="border-t border-slate-150/50 pt-2">
                  <div className="text-sm font-black text-slate-800">{currentUser.name}</div>
                  <div className="text-[11px] text-slate-500 font-bold mt-0.5">
                    Curso: {course.title} • Carga Horária: {course.id === 'c1' ? '30 horas' : '15 horas'}
                  </div>
                </div>
              </div>

              <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                <Sparkles size={12} className="text-amber-500 animate-spin" /> Concedido +200 XP de Bônus Teológico!
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowCertificateUnlockModal(false);
                    onRefresh();
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-3 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border border-transparent active:scale-95"
                >
                  Continuar Aprendizado
                </button>
                <button
                  onClick={() => {
                    setShowCertificateUnlockModal(false);
                    onRefresh();
                    onBack();
                  }}
                  className="w-full bg-[#007cba] hover:bg-blue-600 text-white rounded-xl py-3 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-blue-500/10 active:scale-95"
                >
                  Ir para Minhas Conquistas
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

    </div>
  );
};
