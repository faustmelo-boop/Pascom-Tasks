import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  LMSModule, LMSQuiz, LMSQuestion, LMSQuizAttempt, 
  LMSCertificate, LMSEnrollment, LMSCategory, LMSMaterial 
} from '../../lmsTypes';
import { lmsService } from '../../lmsService';
import { Course, Lesson, User, AVAILABLE_BADGES } from '../../types';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { 
  TrendingUp, Users, BookOpen, Award, FileText, CheckCircle, 
  Plus, Edit, Trash2, HelpCircle, Save, X, ThumbsUp, ChevronRight,
  Download, Image, Check, Star, Settings, ShieldAlert, Layers,
  Video, AlignLeft, Code, Paperclip, Link, Upload, ArrowUp, ArrowDown, Eye, GripVertical,
  Sparkles, Loader2, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InstructorDashboardProps {
  courses: Course[];
  users: User[];
  onRefresh: () => void;
}

export const InstructorDashboard: React.FC<InstructorDashboardProps> = ({ courses, users, onRefresh }) => {
  // Navigation
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'courses' | 'grading' | 'enrollments' | 'certificate_settings'>('analytics');
  
  // Data
  const [modules, setModules] = useState<LMSModule[]>([]);
  const [quizzes, setQuizzes] = useState<LMSQuiz[]>([]);
  const [questions, setQuestions] = useState<LMSQuestion[]>([]);
  const [enrollments, setEnrollments] = useState<LMSEnrollment[]>([]);
  const [attempts, setAttempts] = useState<LMSQuizAttempt[]>([]);
  const [certificates, setCertificates] = useState<LMSCertificate[]>([]);
  const [categories, setCategories] = useState<LMSCategory[]>([]);
  const [materials, setMaterials] = useState<LMSMaterial[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);

  // Selection
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(courses[0] || null);

  // Forms Modals and states
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [moduleFormData, setModuleFormData] = useState({ id: '', title: '', description: '', orderIndex: 1 });

  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [lessonFormData, setLessonFormData] = useState({ 
    id: '', 
    moduleId: '', 
    title: '', 
    description: '', 
    videoUrl: '', 
    duration: '15:00', 
    orderIndex: 1,
    contentType: 'video' as 'video' | 'text' | 'html' | 'markdown' | 'document' | 'code' | 'embed',
    textContent: '',
    htmlContent: '',
    attachments: [] as { name: string; url: string; size?: string }[],
    pdfLinks: [] as { title: string; url: string }[]
  });
  
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizFormData, setQuizFormData] = useState({ id: '', title: '', description: '', timeLimitMins: 15, maxAttempts: 3, passingGrade: 70, randomizeQuestions: true });

  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [questionFormData, setQuestionFormData] = useState({
    id: '', quizId: '', type: 'multiple_choice' as any, questionText: '',
    options: ['', '', '', ''], correctAnswer: 'A', points: 20, feedback: ''
  });

  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedUserToEnroll, setSelectedUserToEnroll] = useState<string>('');

  // AI Question Importer States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTargetQuizId, setImportTargetQuizId] = useState<string>('');
  const [importUrl, setImportUrl] = useState('');
  const [importText, setImportText] = useState('');
  const [importFileBase64, setImportFileBase64] = useState<string>('');
  const [importFileMime, setImportFileMime] = useState<string>('');
  const [importFileName, setImportFileName] = useState<string>('');
  const [isImportLoader, setIsImportLoader] = useState(false);
  const [importErrorMsg, setImportErrorMsg] = useState('');
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);

  // Manual Grading Modal State
  const [selectedAttemptToGrade, setSelectedAttemptToGrade] = useState<LMSQuizAttempt | null>(null);
  const [awardGrades, setAwardGrades] = useState<Record<string, number>>({});
  const [instructorFeedback, setInstructorFeedback] = useState<string>('');

  // Cert Personalization Settings
  const [certSettings, setCertSettings] = useState({
    templateId: 'classic' as any,
    directorName: 'Pe. Francisco José',
    stampUrl: 'https://i.imgur.com/ofoiwCd.png',
    courseHours: 30
  });

  const [newPdfTitle, setNewPdfTitle] = useState('');
  const [newPdfUrl, setNewPdfUrl] = useState('');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadProgressValue, setUploadProgressValue] = useState<number | null>(null);

  // --- STATE: REFERENCE MATERIALS FOR TON AI ---
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [materialFormData, setMaterialFormData] = useState({
    id: '',
    title: '',
    type: 'document' as 'pdf' | 'link' | 'video_url' | 'document' | 'presentation' | 'code' | 'embed',
    url: '',
    contentSnippet: ''
  });

  // Delete Confirmation Modal State
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (() => void | Promise<void>) | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  const handleConfirmDelete = async () => {
    if (deleteModal.onConfirm) {
      setIsDeleteLoading(true);
      try {
        await deleteModal.onConfirm();
      } catch (err) {
        console.error("Error during deletion confirmation:", err);
      } finally {
        setIsDeleteLoading(false);
        setDeleteModal({
          isOpen: false,
          title: '',
          message: '',
          onConfirm: null
        });
      }
    }
  };

  const simulateInstructorFileUpload = (file: File) => {
    setUploadProgressValue(10);
    let current = 10;
    const interval = setInterval(() => {
      current += 20;
      if (current >= 100) {
        clearInterval(interval);
        setUploadProgressValue(null);
        
        // Format readable file size
        let formattedSize = '1.2 MB';
        if (file.size > 1024 * 1024) {
          formattedSize = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
        } else if (file.size > 1024) {
          formattedSize = (file.size / 1024).toFixed(0) + ' KB';
        }
        
        // Add to attachments
        setLessonFormData(prev => ({
          ...prev,
          attachments: [
            ...(prev.attachments || []),
            {
              name: file.name,
              url: `https://pascom.academia/files/${encodeURIComponent(file.name)}`,
              size: formattedSize
            }
          ]
        }));
      } else {
        setUploadProgressValue(current);
      }
    }, 150);
  };

  useEffect(() => {
    loadLMSData();
  }, [selectedCourse?.id]);

  const loadLMSData = async () => {
    try {
      const cats = await lmsService.fetchCategories();
      setCategories(cats);

      const allEnroll = await lmsService.fetchAllEnrollments();
      setEnrollments(allEnroll);

      const allCerts = await lmsService.fetchAllCertificates();
      setCertificates(allCerts);

      const allAttempts = await lmsService.fetchAllAttempts();
      setAttempts(allAttempts);

      if (selectedCourse) {
        const courseMods = await lmsService.fetchModules(selectedCourse.id);
        setModules(courseMods);

        const courseQuizes = await lmsService.fetchQuizzes(selectedCourse.id);
        setQuizzes(courseQuizes);

        const courseMats = await lmsService.fetchMaterials(selectedCourse.id);
        setMaterials(courseMats);
        
        // Load questions linked to course questions pool
        const courseQuestions = await lmsService.fetchQuestions(selectedCourse.id);
        setQuestions(courseQuestions);

        // Fetch lessons
        const courseLessons = await lmsService.fetchLessons(selectedCourse.id);
        setLessons(courseLessons);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- DRAG AND DROP HANDLERS FOR LESSONS ---
  const [draggingLessonId, setDraggingLessonId] = useState<string | null>(null);
  const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null);
  const [dragOverLessonId, setDragOverLessonId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, lessonId: string) => {
    setDraggingLessonId(lessonId);
    e.dataTransfer.setData('text/plain', lessonId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingLessonId(null);
    setDragOverModuleId(null);
    setDragOverLessonId(null);
  };

  const handleDropOnModule = async (moduleId: string | null) => {
    if (!draggingLessonId) return;
    
    // Find lesson
    const lesson = lessons.find(l => l.id === draggingLessonId);
    if (!lesson) return;
    
    // Filter active items from module and increment order
    const modLessons = lessons.filter(l => (moduleId ? l.moduleId === moduleId : !l.moduleId));
    
    const updatedLesson = {
      ...lesson,
      moduleId: moduleId || '',
      orderIndex: modLessons.length + 1
    };
    
    await lmsService.saveLesson(updatedLesson);
    await loadLMSData();
    if (onRefresh) onRefresh();
    
    setDraggingLessonId(null);
    setDragOverModuleId(null);
  };

  const handleDropOnLesson = async (targetLessonId: string) => {
    if (!draggingLessonId || draggingLessonId === targetLessonId) return;
    
    const dragIdx = lessons.findIndex(l => l.id === draggingLessonId);
    const targetIdx = lessons.findIndex(l => l.id === targetLessonId);
    if (dragIdx === -1 || targetIdx === -1) return;
    
    const dragLes = lessons[dragIdx];
    const targetLes = lessons[targetIdx];
    
    const targetModuleId = targetLes.moduleId || '';
    
    // Filter lessons of this target module and sort by order index
    const moduleLessons = lessons
      .filter(l => (targetModuleId ? l.moduleId === targetModuleId : !l.moduleId) && l.id !== draggingLessonId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    
    const insIdx = moduleLessons.findIndex(l => l.id === targetLessonId);
    if (insIdx === -1) return;
    
    // Insert dragging lesson at the position of the target lesson
    moduleLessons.splice(insIdx, 0, dragLes);
    
    // Bulk re-assign order Indexes
    for (let i = 0; i < moduleLessons.length; i++) {
       const u = moduleLessons[i];
       const toUpdate = {
         ...u,
         moduleId: targetModuleId || undefined,
         orderIndex: i + 1
       };
       await lmsService.saveLesson(toUpdate);
    }
    
    await loadLMSData();
    if (onRefresh) onRefresh();
    
    setDraggingLessonId(null);
    setDragOverLessonId(null);
  };

  // Manual Quick Reorder function (up/down arrows accessibility)
  const handleQuickReorder = async (lesson: Lesson, direction: 'up' | 'down') => {
    const siblingLessons = lessons
      .filter(l => l.moduleId === lesson.moduleId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      
    const idx = siblingLessons.findIndex(l => l.id === lesson.id);
    if (idx === -1) return;
    
    if (direction === 'up' && idx > 0) {
      const prev = siblingLessons[idx - 1];
      const prevOrder = prev.orderIndex || 1;
      const currOrder = lesson.orderIndex || 1;
      
      await lmsService.saveLesson({ ...lesson, orderIndex: prevOrder });
      await lmsService.saveLesson({ ...prev, orderIndex: currOrder });
    } else if (direction === 'down' && idx < siblingLessons.length - 1) {
      const next = siblingLessons[idx + 1];
      const nextOrder = next.orderIndex || 1;
      const currOrder = lesson.orderIndex || 1;
      
      await lmsService.saveLesson({ ...lesson, orderIndex: nextOrder });
      await lmsService.saveLesson({ ...next, orderIndex: currOrder });
    }
    
    await loadLMSData();
    if (onRefresh) onRefresh();
  };

  // --- ACTIONS: MODULE CRUD ---
  const handleOpenModuleModal = (mod?: LMSModule) => {
    if (mod) {
      setModuleFormData({ id: mod.id, title: mod.title, description: mod.description || '', orderIndex: mod.orderIndex });
    } else {
      setModuleFormData({ id: '', title: '', description: '', orderIndex: (modules.length + 1) });
    }
    setIsModuleModalOpen(true);
  };

  const handleSaveModule = async () => {
    if (!selectedCourse || !moduleFormData.title) return;
    const moduleToSave: LMSModule = {
      id: moduleFormData.id || `mod-${Date.now()}`,
      courseId: selectedCourse.id,
      title: moduleFormData.title,
      description: moduleFormData.description,
      orderIndex: moduleFormData.orderIndex,
      createdAt: new Date().toISOString()
    };
    await lmsService.saveModule(moduleToSave);
    await loadLMSData();
    setIsModuleModalOpen(false);
  };

  const handleDeleteModule = (id: string) => {
    setDeleteModal({
      isOpen: true,
      title: "Excluir Módulo",
      message: "Deseja realmente excluir este módulo? Todas as aulas contidas nele ficarão sem módulo associado.",
      onConfirm: async () => {
        await lmsService.deleteModule(id);
        await loadLMSData();
        if (onRefresh) onRefresh();
      }
    });
  };

  // --- ACTIONS: REFERENCE MATERIAL CRUD ---
  const handleOpenMaterialModal = (mat?: LMSMaterial) => {
    if (mat) {
      setMaterialFormData({
        id: mat.id,
        title: mat.title,
        type: mat.type,
        url: mat.url || '',
        contentSnippet: mat.metadata?.codeSnippet || ''
      });
    } else {
      setMaterialFormData({
        id: '',
        title: '',
        type: 'document',
        url: '',
        contentSnippet: ''
      });
    }
    setIsMaterialModalOpen(true);
  };

  const handleSaveMaterial = async () => {
    if (!selectedCourse || !materialFormData.title) return;
    const materialToSave: LMSMaterial = {
      id: materialFormData.id || `mat-${Date.now()}`,
      courseId: selectedCourse.id,
      title: materialFormData.title,
      type: materialFormData.type,
      url: materialFormData.url || '#',
      size: '15 KB',
      createdAt: new Date().toISOString(),
      metadata: {
        codeSnippet: materialFormData.contentSnippet
      }
    };
    await lmsService.saveMaterial(materialToSave);
    const updated = await lmsService.fetchMaterials(selectedCourse.id);
    setMaterials(updated);
    setIsMaterialModalOpen(false);
  };

  const handleDeleteMaterial = (id: string) => {
    setDeleteModal({
      isOpen: true,
      title: "Excluir Material de Consulta",
      message: "Deseja realmente excluir este material de consulta? O assistente Ton deixará de se guiar por este material.",
      onConfirm: async () => {
        await lmsService.deleteMaterial(id);
        if (selectedCourse) {
          const updated = await lmsService.fetchMaterials(selectedCourse.id);
          setMaterials(updated);
        }
      }
    });
  };

  // --- ACTIONS: LESSON CRUD ---
  const handleOpenLessonModal = (les?: Lesson) => {
    if (les) {
      setLessonFormData({
        id: les.id,
        moduleId: les.moduleId || '',
        title: les.title,
        description: les.description || '',
        videoUrl: les.videoUrl || '',
        duration: les.duration || '15:00',
        orderIndex: les.orderIndex || (lessons.length + 1),
        contentType: les.contentType || 'video',
        textContent: les.textContent || '',
        htmlContent: les.htmlContent || '',
        attachments: les.attachments || [],
        pdfLinks: les.pdfLinks || []
      });
    } else {
      const defaultModuleId = modules.length > 0 ? modules[0].id : '';
      setLessonFormData({
        id: '',
        moduleId: defaultModuleId,
        title: '',
        description: '',
        videoUrl: '',
        duration: '15:00',
        orderIndex: (lessons.length + 1),
        contentType: 'video',
        textContent: '',
        htmlContent: '',
        attachments: [],
        pdfLinks: []
      });
    }
    setIsLessonModalOpen(true);
  };

  const handleSaveLesson = async () => {
    if (!selectedCourse || !lessonFormData.title) return;
    const lessonToSave: Lesson = {
      id: lessonFormData.id || `les-${Date.now()}`,
      courseId: selectedCourse.id,
      moduleId: lessonFormData.moduleId || undefined,
      title: lessonFormData.title,
      description: lessonFormData.description,
      videoUrl: lessonFormData.videoUrl,
      duration: lessonFormData.duration,
      orderIndex: lessonFormData.orderIndex,
      contentType: lessonFormData.contentType,
      textContent: lessonFormData.textContent,
      htmlContent: lessonFormData.htmlContent,
      attachments: lessonFormData.attachments,
      pdfLinks: lessonFormData.pdfLinks
    };
    await lmsService.saveLesson(lessonToSave);
    await loadLMSData();
    setIsLessonModalOpen(false);
    if (onRefresh) onRefresh();
  };

  const handleDeleteLesson = (id: string) => {
    setDeleteModal({
      isOpen: true,
      title: "Excluir Aula",
      message: "Deseja realmente excluir esta aula? Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        await lmsService.deleteLesson(id);
        await loadLMSData();
        if (onRefresh) onRefresh();
      }
    });
  };

  // --- ACTIONS: QUIZ CRUD ---
  const handleOpenQuizModal = (quiz?: LMSQuiz) => {
    if (quiz) {
      setQuizFormData({
        id: quiz.id, title: quiz.title, description: quiz.description || '',
        timeLimitMins: quiz.timeLimitMins, maxAttempts: quiz.maxAttempts,
        passingGrade: quiz.passingGrade, randomizeQuestions: quiz.randomizeQuestions
      });
    } else {
      setQuizFormData({ id: '', title: '', description: '', timeLimitMins: 15, maxAttempts: 3, passingGrade: 70, randomizeQuestions: true });
    }
    setIsQuizModalOpen(true);
  };

  const handleSaveQuiz = async () => {
    if (!selectedCourse || !quizFormData.title) return;
    const quizToSave: LMSQuiz = {
      id: quizFormData.id || `quiz-${Date.now()}`,
      courseId: selectedCourse.id,
      title: quizFormData.title,
      description: quizFormData.description,
      timeLimitMins: quizFormData.timeLimitMins,
      maxAttempts: quizFormData.maxAttempts,
      passingGrade: quizFormData.passingGrade,
      randomizeQuestions: quizFormData.randomizeQuestions,
      createdAt: new Date().toISOString()
    };
    await lmsService.saveQuiz(quizToSave);
    await loadLMSData();
    setIsQuizModalOpen(false);
  };

  const handleDeleteQuiz = (id: string) => {
    setDeleteModal({
      isOpen: true,
      title: "Excluir Questionário",
      message: "Deseja realmente deletar este questionário e todas as suas perguntas? Quaisquer tentativas ou notas de alunos vinculadas a esta avaliação também poderão ser afetadas.",
      onConfirm: async () => {
        await lmsService.deleteQuiz(id);
        await loadLMSData();
        if (onRefresh) onRefresh();
      }
    });
  };

  // --- ACTIONS: QUESTIONS BANK ---
  const handleOpenQuestionModal = (q?: LMSQuestion, quizId?: string) => {
    if (q) {
      setQuestionFormData({
        id: q.id, quizId: q.quizId || quizId || '', type: q.type,
        questionText: q.questionText, options: q.options || ['', '', '', ''],
        correctAnswer: q.correctAnswer, points: q.points, feedback: q.feedback || ''
      });
    } else {
      setQuestionFormData({
        id: '', quizId: quizId || '', type: 'multiple_choice',
        questionText: '', options: ['', '', '', ''], correctAnswer: 'A',
        points: 20, feedback: ''
      });
    }
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!selectedCourse || !questionFormData.questionText) return;
    const questionToSave: LMSQuestion = {
      id: questionFormData.id || `q-${Date.now()}`,
      courseId: selectedCourse.id,
      quizId: questionFormData.quizId || undefined,
      type: questionFormData.type,
      questionText: questionFormData.questionText,
      options: questionFormData.type === 'multiple_choice' ? questionFormData.options : undefined,
      correctAnswer: questionFormData.correctAnswer,
      points: Number(questionFormData.points),
      feedback: questionFormData.feedback
    };
    await lmsService.saveQuestion(questionToSave);
    await loadLMSData();
    setIsQuestionModalOpen(false);
  };

  const handleDeleteQuestion = (id: string) => {
    setDeleteModal({
      isOpen: true,
      title: "Excluir Questão",
      message: "Excluir esta questão do banco de dados?",
      onConfirm: async () => {
        await lmsService.deleteQuestion(id);
        await loadLMSData();
        if (onRefresh) onRefresh();
      }
    });
  };

  // --- ACTIONS: AI QUESTIONS IMPORTATION ---
  const handleOpenImportQuestionsModal = (quizId: string) => {
    setImportTargetQuizId(quizId);
    setImportUrl('');
    setImportText('');
    setImportFileBase64('');
    setImportFileMime('');
    setImportFileName('');
    setImportErrorMsg('');
    setImportSuccessCount(null);
    setIsImportModalOpen(true);
  };

  const handleExecuteImportQuestions = async () => {
    if (!importUrl && !importText && !importFileBase64) {
      setImportErrorMsg("Por favor, forneça um link do Google Forms, um texto das questões ou faça upload de um arquivo.");
      return;
    }

    setIsImportLoader(true);
    setImportErrorMsg('');
    setImportSuccessCount(null);

    try {
      const response = await fetch('/api/gemini/import-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: importText,
          url: importUrl,
          fileBase64: importFileBase64,
          fileMimeType: importFileMime
        })
      });

      if (!response.ok) {
        const errResult = await response.json();
        throw new Error(errResult.error || "Ocorreu um problema ao conectar-se à IA de importação.");
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.questions)) {
        const parsedList = data.questions;
        for (let i = 0; i < parsedList.length; i++) {
          const rawQ = parsedList[i];
          const newQ: LMSQuestion = {
            id: `q-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
            courseId: selectedCourse?.id || '',
            quizId: importTargetQuizId || undefined,
            type: rawQ.type || 'multiple_choice',
            questionText: rawQ.questionText || '',
            options: rawQ.type === 'multiple_choice' ? (rawQ.options || ['', '', '', '']) : undefined,
            correctAnswer: rawQ.correctAnswer || 'A',
            points: Number(rawQ.points) || 20,
            feedback: rawQ.feedback || ''
          };
          await lmsService.saveQuestion(newQ);
        }
        await loadLMSData();
        setImportSuccessCount(parsedList.length);
        
        // Success feedback then dynamic close
        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportSuccessCount(null);
        }, 3000);
      } else {
        throw new Error("Formato de retorno inválido retornado pela IA do Gemini.");
      }
    } catch (err: any) {
      console.error(err);
      setImportErrorMsg(err.message || "Falha ao processar as questões. Verifique seu arquivo/conteúdo ou tente novamente.");
    } finally {
      setIsImportLoader(false);
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportFileMime(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64Str = reader.result.split(',')[1];
        setImportFileBase64(base64Str);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- ACTIONS: MANAGING ENROLLMENTS ---
  const handleAddEnrollment = async () => {
    if (!selectedCourse || !selectedUserToEnroll) return;
    
    // Check if duplicate enrollment
    const exists = enrollments.some(e => e.courseId === selectedCourse.id && e.userId === selectedUserToEnroll);
    if (exists) {
      alert("Este aluno já está matriculado neste curso.");
      return;
    }

    const matchedUser = users.find(u => u.id === selectedUserToEnroll);
    if (!matchedUser) return;

    const newEnrollment: LMSEnrollment = {
      id: `enr-${Date.now()}`,
      courseId: selectedCourse.id,
      userId: matchedUser.id,
      userName: matchedUser.name,
      userEmail: matchedUser.email || `${matchedUser.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')}@pascom.org`,
      enrolledAt: new Date().toISOString(),
      status: 'active'
    };

    await lmsService.saveEnrollment(newEnrollment);
    await loadLMSData();
    setIsEnrollModalOpen(false);
    setSelectedUserToEnroll('');
  };

  const handleUnenroll = (id: string) => {
    setDeleteModal({
      isOpen: true,
      title: "Desvincular Aluno",
      message: "Deseja realmente remover a matrícula deste estudante do curso?",
      onConfirm: async () => {
        await lmsService.deleteEnrollment(id);
        await loadLMSData();
        if (onRefresh) onRefresh();
      }
    });
  };

  // --- ACTIONS: MANUAL EVALUATING ---
  const handleOpenGradingModal = (attempt: LMSQuizAttempt) => {
    setSelectedAttemptToGrade(attempt);
    setInstructorFeedback(attempt.feedback || '');
    
    // Prefill award grades
    const prefilledGrades: Record<string, number> = {};
    Object.keys(attempt.answers).forEach(qid => {
      prefilledGrades[qid] = attempt.grades?.[qid] || 0;
    });
    setAwardGrades(prefilledGrades);
  };

  const handleSaveGrading = async () => {
    if (!selectedAttemptToGrade) return;
    
    // Fetch quiz questions to figure out max possible scoring
    const quizQuestions = await lmsService.fetchQuestions('all', selectedAttemptToGrade.quizId);
    let scoreEarned = 0;
    let totalMaxPoints = 0;

    quizQuestions.forEach(q => {
      totalMaxPoints += q.points;
      if (q.type === 'discursive') {
        const pointsAwarded = Number(awardGrades[q.id] || 0);
        scoreEarned += pointsAwarded;
      } else {
        scoreEarned += selectedAttemptToGrade.grades?.[q.id] || 0;
      }
    });

    const percentage = totalMaxPoints > 0 ? Math.round((scoreEarned / totalMaxPoints) * 100) : 0;
    
    const matchedQuiz = quizzes.find(q => q.id === selectedAttemptToGrade.quizId);
    const passingGrade = matchedQuiz ? matchedQuiz.passingGrade : 70;

    const updatedAttempt: LMSQuizAttempt = {
      ...selectedAttemptToGrade,
      grades: { ...selectedAttemptToGrade.grades, ...awardGrades },
      score: percentage,
      manualGraded: true,
      status: 'graded',
      feedback: instructorFeedback || `Sua prova discursiva foi corrigida por Faust Melo. Nota Final: ${percentage}%`
    };

    await lmsService.saveAttempt(updatedAttempt);

    // Auto issue certificate if grade is passing score and doesn't exist
    if (percentage >= passingGrade && matchedQuiz) {
      const clientCerts = await lmsService.fetchCertificates(selectedAttemptToGrade.userId);
      const alreadyHasCert = clientCerts.some(c => c.courseId === matchedQuiz.courseId);

      if (!alreadyHasCert) {
        const courseObj = courses.find(c => c.id === matchedQuiz.courseId);
        const newCert: LMSCertificate = {
          id: `cert-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 4)}`,
          courseId: matchedQuiz.courseId,
          courseTitle: courseObj?.title || matchedQuiz.title.replace('Avaliação Final: ', '').replace('Prova: ', '').replace('Prova Prática e Teórica de ', ''),
          userId: selectedAttemptToGrade.userId,
          userName: selectedAttemptToGrade.userName,
          issuedAt: new Date().toISOString(),
          courseHours: certSettings.courseHours,
          directorName: certSettings.directorName,
          templateId: certSettings.templateId,
          stampUrl: certSettings.stampUrl
        };
        await lmsService.saveCertificate(newCert);
      }
    }

    setSelectedAttemptToGrade(null);
    loadLMSData();
    onRefresh();
  };

  // --- ACTIONS: PERSONALIZATION ---
  const handleSaveCertSettings = () => {
    alert("Configurações do modelo de certificado salvas com sucesso!");
    // Persist in local storage
    localStorage.setItem('lms_cert_custom_settings', JSON.stringify(certSettings));
  };

  // --- EXPORTING CSV DATA PIPELINE ---
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Aluno,Email,Curso,Progresso,Data Matricula,Status\n";

    enrollments.forEach(e => {
      const courseObj = courses.find(c => c.id === e.courseId);
      const matchedUser = users.find(u => u.id === e.userId);
      const displayEmail = matchedUser?.email || e.userEmail;
      const row = `"${e.userName}","${displayEmail}","${courseObj?.title || 'Curso Excluido'}","${courseObj?.progress || 0}%","${new Date(e.enrolledAt).toLocaleDateString('pt-BR')}","${e.status}"`;
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Relatorio_Academico_LMS_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- STATISTICAL CALCULATIONS (KPIs) ---
  const kpiTotalStudents = Array.from(new Set(enrollments.map(e => e.userId))).length;
  const kpiTotalCourses = courses.length;
  const kpiEnrollmentsActives = enrollments.filter(e => e.status === 'active').length;
  const kpiCompletionRate = enrollments.length > 0 
    ? Math.round((enrollments.filter(e => e.status === 'completed').length / enrollments.length) * 100)
    : 0;
  const gradedAttempts = attempts.filter(a => a.manualGraded && a.status === 'graded');
  const kpiAverageGrade = gradedAttempts.length > 0
    ? Math.round(gradedAttempts.reduce((sum, a) => sum + a.score, 0) / gradedAttempts.length)
    : 0;
  const kpiCertificatesIssued = certificates.length;

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 lg:p-5 shadow-sm lg:h-full lg:max-h-full lg:flex lg:flex-col lg:min-h-0 overflow-y-auto lg:pr-2.5">
      
      {/* Header and User Badge checks */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-50 mb-5 gap-3 shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1.5 flex items-center gap-2">
            AVA Command Center
          </h2>
          <span className="text-[10px] font-black uppercase text-brand-blue bg-brand-blue/5 border border-brand-blue/5 px-3 py-1.5 rounded-xl">
             Perfil Instrutor Completo • Coordenador
          </span>
        </div>
        <div className="flex bg-slate-100/65 p-1 rounded-2xl border border-slate-150 text-[11px] font-extrabold uppercase shrink-0 gap-1.5 overflow-x-auto">
          {['analytics', 'courses', 'grading', 'enrollments', 'certificate_settings'].map((sub) => (
            <button
              key={`dashboard-sub-${sub}`}
              onClick={() => setActiveSubTab(sub as any)}
              className={`px-4.5 py-2.5 rounded-xl transition-all cursor-pointer select-none shrink-0 border ${
                activeSubTab === sub 
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm shadow-slate-900/10' 
                : 'text-slate-500 hover:text-slate-900 border-transparent'
              }`}
            >
              {sub === 'analytics' ? 'Painel' : 
               sub === 'courses' ? 'Módulos & Provas' : 
               sub === 'grading' ? 'Correções' : 
               sub === 'enrollments' ? 'Matrículas' : 'Certificados'}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ================= SUBTAB: ANALYTICS PAINEL ================= */}
        {activeSubTab === 'analytics' && (
          <motion.div
            key="subtab-analytics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* KPI grid boxes */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total de Estudantes', val: kpiTotalStudents, icon: Users, color: 'text-brand-blue', bg: 'bg-blue-50/50' },
                { label: 'Cursos Ativos', val: kpiTotalCourses, icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-50/50' },
                { label: 'Matrículas Ativas', val: kpiEnrollmentsActives, icon: Star, color: 'text-amber-500', bg: 'bg-amber-50/50' },
                { label: 'Taxa Conclusão', val: `${kpiCompletionRate}%`, icon: TrendingUp, color: 'text-brand-green', bg: 'bg-emerald-50/80' },
                { label: 'Média das Notas', val: `${kpiAverageGrade}%`, icon: Award, color: 'text-rose-500', bg: 'bg-rose-50/80' },
                { label: 'Diplomas Emitidos', val: kpiCertificatesIssued, icon: FileText, color: 'text-teal-600', bg: 'bg-teal-50/50' },
              ].map((kpi, kIdx) => {
                const Icon = kpi.icon;
                return (
                  <div key={`kpi-${kIdx}`} className={`${kpi.bg} p-5 rounded-2xl border border-slate-100 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow`}>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider leading-tight">{kpi.label}</span>
                      <Icon className={`${kpi.color} opacity-80`} size={16} />
                    </div>
                    <span className="text-2xl font-black text-slate-900 leading-none">{kpi.val}</span>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-700 tracking-wider mb-2">Relatórios Gerenciais</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-6">Exporte um demonstrativo flat contendo notas de repasse, progresso de todos os alunos e matrículas organizadas em Excel/CSV.</p>
                </div>
                <button 
                  onClick={handleExportCSV}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow active:scale-95 transition-all w-full md:w-fit px-6 mb-1"
                >
                  <Download size={15} /> Exportar Relatório Geral (CSV)
                </button>
              </div>

              {/* Course categories CRUD card inline */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-150/70 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-700 tracking-wider mb-4 flex items-center gap-1.5">
                    <Layers size={16} className="text-brand-blue" /> Categorias de Formação
                  </h3>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {categories.map(c => (
                      <div key={c.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="font-bold text-slate-800">{c.name}</span>
                        <span className="text-[10px] text-slate-405 italic">{c.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ================= SUBTAB: COURSE BUILDER MANAGER ================= */}
        {activeSubTab === 'courses' && (
          <motion.div
            key="subtab-courses"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8 animate-in fade-in"
          >
            {/* Course switcher */}
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-xs font-black uppercase text-slate-550 shrink-0">Configurando:</span>
              <select
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs md:text-sm font-bold text-slate-800 outline-none select-none cursor-pointer"
                value={selectedCourse?.id || ''}
                onChange={(e) => {
                  const matched = courses.find(c => c.id === e.target.value);
                  if (matched) setSelectedCourse(matched);
                }}
              >
                {courses.map(c => (
                  <option key={`opt-course-${c.id}`} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            {selectedCourse && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 1. MODULES BUILDING BOARD */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                    <h3 className="font-black text-sm uppercase text-slate-805">Módulos do Curso ({modules.length})</h3>
                    <button 
                      onClick={() => handleOpenModuleModal()}
                      className="bg-brand-blue/10 hover:bg-brand-blue text-brand-blue hover:text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all select-none"
                    >
                      <Plus size={13} strokeWidth={2.5} /> Cadastrar Módulo
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                    {modules.length === 0 ? (
                      <p className="text-center py-12 text-xs text-slate-400 italic">Nenhum módulo criado para este curso.</p>
                    ) : (
                      modules.map((m) => (
                        <div key={m.id} className="flex justify-between items-center p-4 bg-white border border-slate-150/70 rounded-xl shadow-inner hover:border-slate-205 transition-colors">
                          <div>
                            <span className="text-[9px] font-black uppercase font-mono text-slate-400">Posição: {m.orderIndex}</span>
                            <h4 className="font-bold text-xs md:text-sm text-slate-800">{m.title}</h4>
                            <p className="text-slate-450 italic text-[11px]">{m.description}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => handleOpenModuleModal(m)} className="p-2 text-slate-400 hover:text-brand-blue hover:bg-slate-50 rounded-lg"><Edit size={14} /></button>
                            <button onClick={() => handleDeleteModule(m.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-lg"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. QUIZZES AND EXAMS BOARD */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                    <h3 className="font-black text-sm uppercase text-slate-805">Exame ou Provas do Curso ({quizzes.length})</h3>
                    <button 
                      onClick={() => handleOpenQuizModal()}
                      className="bg-amber-500/10 hover:bg-amber-500 text-amber-600 hover:text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all select-none"
                    >
                      <Plus size={13} strokeWidth={2.5} /> Cadastrar Exame
                    </button>
                  </div>

                  <div className="space-y-3.5 max-h-[440px] overflow-y-auto pr-1">
                    {quizzes.length === 0 ? (
                      <p className="text-center py-12 text-xs text-slate-400 italic">Nenhuma avaliação atrelada.</p>
                    ) : (
                      quizzes.map((q) => {
                        const qCount = questions.filter(quest => quest.quizId === q.id).length;
                        return (
                          <div key={q.id} className="p-4 bg-slate-50/40 border border-slate-150 rounded-2xl flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="font-black text-xs md:text-sm text-slate-800">{q.title}</h4>
                                <span className="text-[10px] text-slate-450 font-semibold">{qCount} Questões • {q.timeLimitMins}m limite • Nota repasse: {q.passingGrade}%</span>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => handleOpenQuizModal(q)} className="p-1.5 text-slate-400 hover:text-brand-blue rounded-lg"><Edit size={13} /></button>
                                <button onClick={() => handleDeleteQuiz(q.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"><Trash2 size={13} /></button>
                              </div>
                            </div>

                            {/* Question list helper inside Quizzes */}
                            <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-100 mb-4">
                              <span className="block text-[8.5px] font-black uppercase text-slate-400 tracking-wider">Perguntas Integradas</span>
                              {questions.filter(quest => quest.quizId === q.id).map((quest, subIdx) => (
                                <div key={quest.id} className="flex justify-between items-center text-[11px] py-1 border-b border-slate-50 last:border-0">
                                  <span className="font-bold text-slate-700 truncate max-w-sm">{subIdx + 1}. {quest.questionText}</span>
                                  <span className="text-slate-450 font-mono text-[9px]">({quest.points} pts)</span>
                                </div>
                              ))}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                onClick={() => handleOpenQuestionModal(undefined, q.id)}
                                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[8.5px] uppercase tracking-wider py-2.5 rounded-lg text-center flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95"
                              >
                                <Plus size={11} strokeWidth={2.5} /> Incluir Manual
                              </button>
                              <button
                                onClick={() => handleOpenImportQuestionsModal(q.id)}
                                className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-extrabold text-[8.5px] uppercase tracking-wider py-2.5 rounded-lg text-center flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow shadow-indigo-500/10"
                              >
                                <Sparkles size={11} className="w-3 h-3 text-indigo-200 animate-pulse" /> Importar com IA
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 3. REFERENCE MATERIALS BOARD FOR TON AI ASSISTANT */}
                <div className="col-span-1 lg:col-span-2 bg-slate-50 border border-slate-205 p-6 rounded-[2rem] space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-200/60 pb-3.5">
                    <div>
                      <h3 className="font-black text-sm uppercase text-slate-800 flex items-center gap-1.5 tracking-tight">
                        <Sparkles size={16} className="text-amber-500 fill-amber-500/20" /> Materiais de Consulta do Assistente Ton (IA)
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Documentos, links e textos customizados que o assistente virtual <strong>Ton</strong> utilizará como material para responder dúvidas dos alunos deste curso.
                      </p>
                    </div>
                    <button
                      onClick={() => handleOpenMaterialModal()}
                      className="bg-[#007cba] hover:bg-[#007cba]/90 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto select-none"
                    >
                      <Plus size={13} strokeWidth={2.5} /> Cadastrar Material de Consulta
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {materials.length === 0 ? (
                      <div className="col-span-full py-8 text-center text-xs text-slate-400 italic">
                        Nenhum material de consulta cadastrado. O assistente Ton dará suporte com as bases gerais do curso.
                      </div>
                    ) : (
                      materials.map((mat) => (
                        <div key={mat.id} className="p-4 bg-white border border-slate-150 rounded-2xl flex justify-between items-start hover:border-slate-300 transition-colors shadow-xs">
                          <div className="space-y-1.5 select-none min-w-0 flex-1 mr-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                                {mat.type === 'pdf' ? '📖 PDF' : mat.type === 'link' ? '🔗 Link' : '📝 Texto / Documento'}
                              </span>
                              <span className="text-[9px] text-slate-400 font-semibold font-mono">{new Date(mat.createdAt).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <h4 className="font-extrabold text-xs md:text-sm text-slate-800 tracking-tight truncate">{mat.title}</h4>
                            {mat.url && mat.url !== '#' && (
                              <p className="text-[10px] text-[#007cba] truncate hover:underline font-mono font-bold">{mat.url}</p>
                            )}
                            {mat.metadata?.codeSnippet && (
                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2 max-h-[70px] overflow-y-auto">
                                <p className="text-[10px] text-slate-500 font-mono leading-normal whitespace-pre-wrap">
                                  {mat.metadata.codeSnippet}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleOpenMaterialModal(mat)}
                              className="p-1.5 text-slate-400 hover:text-[#007cba] hover:bg-slate-50 rounded-lg cursor-pointer"
                              title="Editar"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteMaterial(mat.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-lg cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedCourse && (
              <div className="space-y-6 pt-8 border-t border-slate-100">
                  {/* Visual Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 text-white p-5 rounded-3xl gap-4 shadow-xl">
                    <div className="space-y-1">
                      <span className="text-[10px] bg-[#007cba]/30 text-[#0c97e7] font-extrabold uppercase px-2.5 py-1 rounded-full border border-[#0c97e7]/40">Organizador Tátil</span>
                      <h3 className="font-black text-base md:text-lg tracking-tight">Trilha de Aprendizagem & Distribuição de Aulas</h3>
                      <p className="text-xs text-slate-300 font-medium">Arraste as aulas entre os módulos para mudar seus laços, ou arraste uma aula sobre a outra para reordenar a sequência de ensino.</p>
                    </div>
                    <button 
                      onClick={() => handleOpenLessonModal()}
                      className="bg-[#007cba] hover:bg-[#007cba]/90 text-white px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all select-none cursor-pointer"
                    >
                      <Plus size={14} strokeWidth={2.5} /> Cadastrar Nova Aula
                    </button>
                  </div>

                  {/* Organizer Board Grid - Vertical columns side-by-side */}
                  <div className="flex gap-5 overflow-x-auto pb-8 pt-4 snap-x select-none max-w-full scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    
                    {/* Column 1: Aulas Gerais / Sem Módulo atrelado */}
                    <div 
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverModuleId('unassigned');
                      }}
                      onDragLeave={() => setDragOverModuleId(null)}
                      onDrop={() => handleDropOnModule(null)}
                      className={`min-w-[290px] w-[320px] md:w-[350px] shrink-0 flex flex-col h-[580px] rounded-3xl border-2 transition-all p-4 snap-center ${
                        dragOverModuleId === 'unassigned' 
                          ? 'border-[#007cba] bg-blue-50/20 scale-[1.01]' 
                          : 'border-slate-150 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex justify-between items-start mb-3 bg-white/70 backdrop-blur-xs p-3.5 rounded-2xl border border-slate-100 shadow-xs">
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] bg-slate-100 text-slate-500 font-extrabold uppercase px-2 py-0.5 rounded-md font-mono">Gerais</span>
                          <h4 className="font-black text-xs md:text-sm text-slate-800 tracking-tight truncate mt-1">Aulas Introdutórias</h4>
                          <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">Sem módulo específico atrelado</p>
                        </div>
                        <span className="bg-slate-100 text-slate-650 px-2.5 py-1 rounded-full text-[10px] font-black uppercase font-mono shrink-0 ml-1">
                          {lessons.filter(l => !l.moduleId).length} Aulas
                        </span>
                      </div>

                      {/* Scrollable container for lessons */}
                      <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 scrollbar-thin">
                        {lessons.filter(l => !l.moduleId).length === 0 ? (
                          <div className="h-full border-2 border-dashed border-slate-205 bg-white/50 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                            <p className="text-xs text-slate-400 italic">Arraste uma aula aqui se desejar tirá-la de seu módulo de estudo.</p>
                          </div>
                        ) : (
                          lessons
                            .filter(l => !l.moduleId)
                            .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                            .map((l) => {
                              const isDragging = draggingLessonId === l.id;
                              const isOver = dragOverLessonId === l.id;
                              const arrCount = l.attachments?.length || 0;
                              const pdfCount = l.pdfLinks?.length || 0;

                              return (
                                <div
                                  key={l.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, l.id)}
                                  onDragEnd={handleDragEnd}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragOverLessonId(l.id);
                                  }}
                                  onDragLeave={() => setDragOverLessonId(null)}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    handleDropOnLesson(l.id);
                                  }}
                                  className={`p-4 bg-white border rounded-2xl flex flex-col justify-between transition-all select-none shadow-xs cursor-grab active:cursor-grabbing ${
                                    isDragging ? 'opacity-30 scale-95' : 'opacity-100'
                                  } ${
                                    isOver ? 'ring-2 ring-[#007cba] bg-blue-50/10 border-[#007cba]' : 'border-slate-200/80 hover:border-slate-300'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-start justify-between gap-1.5 mb-2">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <GripVertical size={13} className="text-slate-400 shrink-0" />
                                        <span className="font-extrabold text-[9px] bg-slate-100 text-slate-650 px-1.5 py-0.5 rounded font-mono">Pos: {l.orderIndex || 1}</span>
                                      </div>
                                      <div className="flex gap-0.5 shrink-0">
                                        <button onClick={() => handleQuickReorder(l, 'up')} className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer" title="Mover para cima"><ArrowUp size={11} /></button>
                                        <button onClick={() => handleQuickReorder(l, 'down')} className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer" title="Mover para baixo"><ArrowDown size={11} /></button>
                                        <button onClick={() => handleOpenLessonModal(l)} className="p-0.5 text-slate-400 hover:text-[#007cba] hover:bg-slate-100 rounded cursor-pointer" title="Editar aula"><Edit size={11} /></button>
                                        <button onClick={() => handleDeleteLesson(l.id)} className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded cursor-pointer" title="Excluir aula"><Trash2 size={11} /></button>
                                      </div>
                                    </div>

                                    <h5 className="font-black text-xs text-slate-800 leading-tight mb-1.5 hover:text-[#007cba] transition-colors">{l.title}</h5>

                                    {/* Badges/Metadata */}
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {l.duration && (
                                        <span className="bg-slate-50 text-slate-500 border border-slate-100 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md font-mono">
                                          ⏱ {l.duration}
                                        </span>
                                      )}
                                      {arrCount > 0 && (
                                        <span className="bg-blue-50 text-[#007cba] border border-blue-100 text-[8px] font-black px-1.5 py-0.5 rounded-md">
                                          📎 {arrCount} anexo{arrCount > 1 ? 's' : ''}
                                        </span>
                                      )}
                                      {pdfCount > 0 && (
                                        <span className="bg-red-50 text-red-655 border border-red-105 text-[8px] font-black px-1.5 py-0.5 rounded-md">
                                          📄 {pdfCount} PDF{pdfCount > 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>

                    {/* Columns for existing modules */}
                    {modules
                      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                      .map((m) => {
                        const moduleLessons = lessons.filter(l => l.moduleId === m.id);
                        const isOverThisModule = dragOverModuleId === m.id;

                        return (
                          <div
                            key={m.id}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOverModuleId(m.id);
                            }}
                            onDragLeave={() => setDragOverModuleId(null)}
                            onDrop={() => handleDropOnModule(m.id)}
                            className={`min-w-[290px] w-[320px] md:w-[350px] shrink-0 flex flex-col h-[580px] rounded-3xl border-2 transition-all p-4 snap-center bg-white ${
                              isOverThisModule 
                                ? 'border-[#007cba] bg-blue-50/10 scale-[1.01]' 
                                : 'border-slate-200/80 hover:border-slate-250 hover:bg-slate-50/10'
                            }`}
                          >
                            {/* Column Module Header */}
                            <div className="mb-3 border border-slate-100 bg-slate-50/50 p-3.5 rounded-2xl flex flex-col justify-between shrink-0">
                              <div className="flex justify-between items-start gap-1 pb-1">
                                <div className="truncate">
                                  <span className="text-[9px] bg-sky-50 text-[#007cba] border border-sky-100 font-black uppercase px-2 py-0.5 rounded-md font-mono">Módulo {m.orderIndex}</span>
                                  <h4 className="font-black text-xs md:text-sm text-slate-800 mt-1 tracking-tight truncate" title={m.title}>{m.title}</h4>
                                </div>
                                <span className="bg-emerald-50 text-emerald-750 px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 font-mono">
                                  {moduleLessons.length} Aulas
                                </span>
                              </div>
                              <p className="text-slate-400 italic text-[10px] font-medium leading-normal mt-1 block truncate" title={m.description}>
                                {m.description || "Sem descrição cadastrada do módulo."}
                              </p>
                            </div>

                            {/* Lessons vertical stack list inside Module column */}
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 scrollbar-thin">
                              {moduleLessons.length === 0 ? (
                                <div className="h-full border-2 border-dashed border-slate-150 bg-slate-50/30 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                                  <p className="text-[10px] text-slate-400 font-medium italic">Vazio. Arraste e solte alguma aula do curso aqui para vinculá-la!</p>
                                </div>
                              ) : (
                                moduleLessons
                                  .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                                  .map((l) => {
                                    const isDragging = draggingLessonId === l.id;
                                    const isOver = dragOverLessonId === l.id;
                                    const arrCount = l.attachments?.length || 0;
                                    const pdfCount = l.pdfLinks?.length || 0;

                                    return (
                                      <div
                                        key={l.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, l.id)}
                                        onDragEnd={handleDragEnd}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          setDragOverLessonId(l.id);
                                        }}
                                        onDragLeave={() => setDragOverLessonId(null)}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          handleDropOnLesson(l.id);
                                        }}
                                        className={`p-3.5 bg-white border rounded-2xl flex flex-col justify-between transition-all select-none shadow-xs cursor-grab active:cursor-grabbing ${
                                          isDragging ? 'opacity-30 scale-95' : 'opacity-100'
                                        } ${
                                          isOver ? 'ring-2 ring-emerald-500 bg-emerald-50/10 border-emerald-500' : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                      >
                                        <div>
                                          <div className="flex items-start justify-between gap-1 mb-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <GripVertical size={13} className="text-slate-455 shrink-0" />
                                              <span className="font-extrabold text-[9px] bg-slate-100 text-slate-750 px-1.5 py-0.5 rounded font-mono">Pos: {l.orderIndex || 1}</span>
                                            </div>
                                            <div className="flex gap-0.5 shrink-0">
                                              <button onClick={() => handleQuickReorder(l, 'up')} className="p-0.5 text-slate-405 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer" title="Subir posição"><ArrowUp size={11} /></button>
                                              <button onClick={() => handleQuickReorder(l, 'down')} className="p-0.5 text-slate-405 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer" title="Descer posição"><ArrowDown size={11} /></button>
                                              <button onClick={() => handleOpenLessonModal(l)} className="p-0.5 text-slate-400 hover:text-[#007cba] hover:bg-slate-100 rounded cursor-pointer" title="Editar"><Edit size={11} /></button>
                                              <button onClick={() => handleDeleteLesson(l.id)} className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded cursor-pointer" title="Excluir"><Trash2 size={11} /></button>
                                            </div>
                                          </div>

                                          <h5 className="font-black text-xs text-slate-800 leading-tight mb-1.5 hover:text-[#007cba] transition-colors">{l.title}</h5>

                                          {/* Badges / Metadata info */}
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {l.duration && (
                                              <span className="bg-slate-50 text-slate-500 border border-slate-100 text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md font-mono">
                                                ⏱ {l.duration}
                                              </span>
                                            )}
                                            {arrCount > 0 && (
                                              <span className="bg-blue-50 text-[#007cba] border border-blue-100 text-[8px] font-black px-1.5 py-0.5 rounded-md">
                                                📎 {arrCount} anexo{arrCount > 1 ? 's' : ''}
                                              </span>
                                            )}
                                            {pdfCount > 0 && (
                                              <span className="bg-red-50 text-red-650 border border-red-105 text-[8px] font-black px-1.5 py-0.5 rounded-md">
                                                📄 {pdfCount} PDF{pdfCount > 1 ? 's' : ''}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

        {/* ================= SUBTAB: EVALUATING BOARD ================= */}
        {activeSubTab === 'grading' && (() => {
          // Filter quiz attempts that contain discursive answers and require grading,
          // as well as general submitted records.
          const pendingGradings = attempts.filter(a => a.status === 'submitted' || !a.manualGraded);

          return (
            <motion.div
              key="subtab-grading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6 animate-in fade-in"
            >
              <div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/15 flex gap-3 text-xs text-amber-700 font-semibold mb-6">
                <ShieldAlert size={18} className="shrink-0 text-amber-500 mt-0.5" />
                <p>Aqui você realiza a correção manual das questões dissertativas de redações e teologias recebidas dos alunos. O sistema calculará a nota final agregada e liberará o diploma automaticamente após sua pontuação final.</p>
              </div>

              <div className="space-y-3.5">
                {pendingGradings.length === 0 ? (
                  <div className="text-center py-20 bg-slate-50 rounded-2xl border border-slate-100">
                    <ThumbsUp className="text-slate-300 mx-auto mb-3" size={32} />
                    <p className="text-xs text-slate-450 font-bold uppercase tracking-wider">Tudo Correto! Nenhuma avaliação pendente no momento.</p>
                  </div>
                ) : (
                  pendingGradings.map((att) => {
                    const quizObj = quizzes.find(q => q.id === att.quizId) || { title: 'Avaliação Geral' };
                    return (
                      <div key={att.id} className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-white border border-slate-150 rounded-2xl gap-4 hover:border-brand-blue/30 transition-colors">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-[9px] font-black uppercase text-[#ffc107] bg-[#ffc107]/5 border border-amber-200 px-2.5 py-1 rounded-lg">Aguardando Avaliação</span>
                            <span className="text-xs text-slate-450 font-bold">{quizObj.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <img src={att.userAvatar} alt="Avatar" className="w-6 h-6 rounded-lg object-cover" />
                            <span className="font-extrabold text-sm text-slate-800">{att.userName}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenGradingModal(att)}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all shadow active:scale-95 cursor-pointer"
                        >
                          Avaliar & Atribuir Nota
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          );
        })()}

        {/* ================= SUBTAB: MANAGING ENROLLMENTS ================= */}
        {activeSubTab === 'enrollments' && (
          <motion.div
            key="subtab-enrollments"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6 animate-in fade-in"
          >
            {/* Enrollment register action */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
              <h3 className="font-black text-sm uppercase text-slate-705">Matrículas e Alunos Registrados ({enrollments.length})</h3>
              <button 
                onClick={() => setIsEnrollModalOpen(true)}
                className="bg-brand-blue hover:bg-brand-blue/90 text-white font-black text-[11px] uppercase tracking-wider px-5 py-3 rounded-xl shadow active:scale-95 transition-all flex items-center gap-1"
              >
                <Plus size={14} strokeWidth={2.5} /> Matricular Estudante
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-150 rounded-2xl bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 font-black text-slate-400 uppercase tracking-wider text-[9px]">
                    <th className="p-4">Estudante</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Curso</th>
                    <th className="p-4">Data Registro</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                  {enrollments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 italic">Nenhum estudante matriculado em cursos.</td>
                    </tr>
                  ) : (
                    enrollments.map((enr) => {
                      const cObj = courses.find(c => c.id === enr.courseId);
                      const matchedUser = users.find(u => u.id === enr.userId);
                      const displayEmail = matchedUser?.email || enr.userEmail;
                      return (
                        <tr key={enr.id} className="hover:bg-slate-50/40">
                          <td className="p-4 font-extrabold text-slate-900">{enr.userName}</td>
                          <td className="p-4 text-slate-500 font-mono text-[10px]">{displayEmail}</td>
                          <td className="p-4">{cObj?.title || 'Curso Deletado/Dynamic'}</td>
                          <td className="p-4 font-mono text-[10px]">{new Date(enr.enrolledAt).toLocaleDateString('pt-BR')}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-lg text-[9px] uppercase font-black ${
                              enr.status === 'completed' ? 'bg-green-100 text-green-70s' : 'bg-blue-100 text-brand-blue'
                            }`}>
                              {enr.status === 'completed' ? 'Concluido' : 'Ativo'}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleUnenroll(enr.id)}
                              className="text-red-400 hover:text-red-650 hover:bg-rose-50 p-2 rounded-lg transition-colors cursor-pointer"
                              title="Cancelar Matrícula"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* ================= SUBTAB: CERTIFICATE MODEL PERSONALIZER ================= */}
        {activeSubTab === 'certificate_settings' && (
          <motion.div
            key="subtab-cert-settings"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in"
          >
            {/* Form */}
            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
              <h3 className="font-black text-sm uppercase text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                <Settings size={16} className="text-brand-blue" /> Personalização de Diplomas
              </h3>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400">Modelo / Estilo Visual</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'classic', name: 'Clássico Formal (Azul)' },
                    { id: 'modern', name: 'Contemporâneo (Verde)' },
                    { id: 'honor', name: 'Destaque e Honra (Ouro)' },
                    { id: 'minimalist', name: 'Minimalista (Escuro)' }
                  ].map((tpl) => (
                    <button
                      key={`cert-tpl-${tpl.id}`}
                      onClick={() => setCertSettings(prev => ({ ...prev, templateId: tpl.id }))}
                      className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                        certSettings.templateId === tpl.id 
                        ? 'bg-slate-900 text-white border-slate-900 shadow'
                        : 'bg-white hover:bg-slate-100 text-slate-655 border-slate-200'
                      }`}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400">Diretor / Assinatura Litúrgica</label>
                <input
                  type="text"
                  className="w-full text-xs font-bold bg-white p-3 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue text-slate-800"
                  value={certSettings.directorName}
                  onChange={(e) => setCertSettings(prev => ({ ...prev, directorName: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400">Carga Horária Padrão (Horas)</label>
                <input
                  type="number"
                  className="w-full text-xs font-bold bg-white p-3 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue text-slate-800"
                  value={certSettings.courseHours}
                  onChange={(e) => setCertSettings(prev => ({ ...prev, courseHours: Number(e.target.value) }))}
                />
              </div>

              <button
                onClick={handleSaveCertSettings}
                className="bg-brand-blue hover:bg-brand-blue/90 text-white font-black text-xs uppercase tracking-wider py-4 px-6 rounded-xl transition-all shadow active:scale-95 cursor-pointer flex items-center justify-center gap-1 w-full"
              >
                <Check size={14} strokeWidth={3} /> Salvar Modelo de Diploma
              </button>
            </div>

            {/* Visualizer card preview badge */}
            <div className="flex flex-col justify-center items-center p-8 bg-slate-90/50 rounded-[2rem] border border-dashed border-slate-250 min-h-[300px]">
              <Settings size={36} className="text-slate-350 animate-spin-slow mb-4" />
              <h4 className="font-extrabold text-sm text-slate-700">Prévia de Estilo de Diploma</h4>
              <p className="text-slate-450 text-xs mt-1.5 max-w-xs text-center leading-relaxed">
                Utilizando modelo <strong className="text-slate-800 text-xs underline uppercase">{certSettings.templateId}</strong>. O conteúdo é otimizado automaticamente para paisagem paisagem e impressões PDF institucionais de alta fidelidade.
              </p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ================= MODAL: MODULE FORM ================= */}
      {isModuleModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[9999] overflow-y-auto flex items-center justify-center p-4 md:p-10">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
          >
            <button onClick={() => setIsModuleModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-750 cursor-pointer"><X size={18} /></button>
            <h3 className="font-black text-lg text-slate-805 mb-6">{moduleFormData.id ? 'Editar Módulo' : 'Novo Módulo'}</h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400">Título do Módulo</label>
                <input
                  type="text"
                  placeholder="Ex: Módulo 1: Teologia das Comunicações"
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none focus:bg-white text-slate-800"
                  value={moduleFormData.title}
                  onChange={(e) => setModuleFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400">Descrição Curta</label>
                <textarea
                  placeholder="Escreva breve resumo..."
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none focus:bg-white text-slate-800 h-24 resize-none"
                  value={moduleFormData.description}
                  onChange={(e) => setModuleFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400">Ordem de Exibição (Número)</label>
                <input
                   type="number"
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none focus:bg-white text-slate-800"
                  value={moduleFormData.orderIndex}
                  onChange={(e) => setModuleFormData(prev => ({ ...prev, orderIndex: Number(e.target.value) }))}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button onClick={() => setIsModuleModalOpen(false)} className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-lg cursor-pointer">Cancelar</button>
                <button onClick={handleSaveModule} className="text-xs font-black text-white bg-brand-blue hover:bg-brand-blue/90 px-6 py-2.5 rounded-lg flex items-center gap-1 cursor-pointer"><Save size={13} /> Salvar</button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: LESSON FORM ================= */}
      {isLessonModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[9999] overflow-y-auto flex items-center justify-center p-4 md:p-10">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 w-full max-w-lg md:max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
          >
            <button onClick={() => setIsLessonModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-755 cursor-pointer"><X size={18} /></button>
            <h3 className="font-black text-lg text-slate-805 mb-6">{lessonFormData.id ? 'Editar Aula' : 'Nova Aula / Vídeo-aula'}</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400">Título da Aula</label>
                  <input
                    type="text"
                    placeholder="Ex: Aula 1: Introdução à Liturgia"
                    className="w-full bg-slate-50 border border-slate-205 p-3 rounded-xl text-xs font-bold outline-none focus:bg-white text-slate-800"
                    value={lessonFormData.title}
                    onChange={(e) => setLessonFormData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400">Vincular ao Módulo do Curso</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-205 p-3 rounded-xl text-xs font-bold outline-none focus:bg-white text-slate-850"
                    value={lessonFormData.moduleId}
                    onChange={(e) => setLessonFormData(prev => ({ ...prev, moduleId: e.target.value }))}
                  >
                    <option value="">Nenhum / Aula Geral de Introdução</option>
                    {modules.map(m => (
                      <option key={m.id} value={m.id}>{m.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TABS FOR CONTENT TYPE */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400">Formato / Tipo de Conteúdo Principal</label>
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-1 rounded-xl border border-slate-205/60">
                  <button
                    type="button"
                    onClick={() => setLessonFormData(prev => ({ ...prev, contentType: 'video' }))}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-black uppercase transition-all select-none cursor-pointer ${
                      lessonFormData.contentType === 'video'
                        ? 'bg-white text-emerald-653 shadow border border-slate-100'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Video size={13} /> Vídeo
                  </button>
                  <button
                    type="button"
                    onClick={() => setLessonFormData(prev => ({ ...prev, contentType: 'text' }))}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-black uppercase transition-all select-none cursor-pointer ${
                      lessonFormData.contentType === 'text'
                        ? 'bg-white text-purple-653 shadow border border-slate-100'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <AlignLeft size={13} /> Texto de Apoio
                  </button>
                  <button
                    type="button"
                    onClick={() => setLessonFormData(prev => ({ ...prev, contentType: 'html' }))}
                    className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-black uppercase transition-all select-none cursor-pointer ${
                      lessonFormData.contentType === 'html'
                        ? 'bg-white text-amber-653 shadow border border-slate-100'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Code size={13} /> HTML / Incorporar
                  </button>
                </div>
              </div>

              {/* CONDITIONAL CONTENT TYPES INPUTS */}
              {lessonFormData.contentType === 'video' && (
                <div className="space-y-1.5 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <label className="text-[10px] uppercase font-black text-slate-400">Link do Vídeo Complementar (YouTube)</label>
                  <input
                    type="text"
                    placeholder="Ex: https://www.youtube.com/watch?v=Fst6z5lZk8s"
                    className="w-full bg-white border border-slate-205 p-3 rounded-xl text-xs font-bold outline-none text-slate-800"
                    value={lessonFormData.videoUrl}
                    onChange={(e) => setLessonFormData(prev => ({ ...prev, videoUrl: e.target.value }))}
                  />
                  <p className="text-[10px] text-slate-450 italic font-medium">Insira a URL normal do YouTube. O sistema converterá automaticamente em player incorporado.</p>
                </div>
              )}

              {lessonFormData.contentType === 'text' && (
                <div className="space-y-1.5 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <label className="text-[10px] uppercase font-black text-slate-400">Conteúdo de Texto Completo da Aula</label>
                  <textarea
                    placeholder="Escreva a apostila completa, lição com parágrafos, tópicos e notas de formação recomendadas para estudo do aluno..."
                    className="w-full bg-white border border-slate-205 p-3 rounded-xl text-xs font-bold outline-none text-slate-800 h-60"
                    value={lessonFormData.textContent || ''}
                    onChange={(e) => setLessonFormData(prev => ({ ...prev, textContent: e.target.value }))}
                  />
                  <p className="text-[10px] text-slate-450 italic font-medium">Este texto ocupará a tela principal de estudos, com excelente legibilidade para o aluno.</p>
                </div>
              )}

              {lessonFormData.contentType === 'html' && (
                <div className="space-y-1.5 p-4 bg-slate-40/50 rounded-2xl border border-slate-100">
                  <label className="text-[10px] uppercase font-black text-slate-400">Snippet de Código HTML ou Código Iframe (&lt;iframe&gt;)</label>
                  <textarea
                    placeholder="Cole códigos de incorporação de PDF, slides (Google Slides / SlideShare), mapas mentais interativos ou outros players personalizados..."
                    className="w-full bg-white border border-slate-205 p-3 rounded-xl font-mono text-xs outline-none text-slate-800 h-40"
                    value={lessonFormData.htmlContent || ''}
                    onChange={(e) => setLessonFormData(prev => ({ ...prev, htmlContent: e.target.value }))}
                  />
                  <p className="text-[10px] text-amber-600 font-extrabold">&lt;!&gt; Atenção: Certifique-se de colar código seguro. Elementos como links externos e players interativos serão executados de forma integrada.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400">Duração Estimada</label>
                  <input
                    type="text"
                    placeholder="Ex: 15:00"
                    className="w-full bg-slate-50 border border-slate-205 p-3 rounded-xl text-xs font-bold outline-none focus:bg-white text-slate-800"
                    value={lessonFormData.duration}
                    onChange={(e) => setLessonFormData(prev => ({ ...prev, duration: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400">Ordem de Exibição (Número)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-205 p-3 rounded-xl text-xs font-bold outline-none focus:bg-white text-slate-800"
                    value={lessonFormData.orderIndex}
                    onChange={(e) => setLessonFormData(prev => ({ ...prev, orderIndex: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400">Resumo Curto de Apresentação (Exibido sob o Título)</label>
                <textarea
                  placeholder="Escreva breve resumo para a chamada ou listagem..."
                  className="w-full bg-slate-50 border border-slate-205 p-3 rounded-xl text-xs font-bold outline-none focus:bg-white text-slate-800 h-20 resize-none"
                  value={lessonFormData.description}
                  onChange={(e) => setLessonFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              {/* PDF LINKS AND FILE ATTACHMENTS MANAGER */}
              <div className="border-t border-slate-100 pt-5 mt-4 space-y-5">
                <h4 className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
                  <Paperclip size={14} className="text-[#007cba]" /> Anexos e Links de Apoio para a Aula
                </h4>

                {/* 1. PDF Links Manager */}
                <div className="space-y-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <span className="block text-[10px] uppercase font-black text-slate-500 tracking-wider">Links para Materiais em PDF / Slides</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Título do PDF (Ex: Diretório CNBB pdf)"
                      className="bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-bold outline-none text-slate-800"
                      value={newPdfTitle}
                      onChange={(e) => setNewPdfTitle(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Link do arquivo (Ex: https://...)"
                        className="flex-1 bg-white border border-slate-200 p-2.5 rounded-xl text-xs font-bold outline-none text-slate-800"
                        value={newPdfUrl}
                        onChange={(e) => setNewPdfUrl(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newPdfTitle || !newPdfUrl) return;
                          setLessonFormData(prev => ({
                            ...prev,
                            pdfLinks: [...(prev.pdfLinks || []), { title: newPdfTitle, url: newPdfUrl }]
                          }));
                          setNewPdfTitle('');
                          setNewPdfUrl('');
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs px-3 rounded-xl cursor-pointer"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>

                  {/* PDF Links Listed */}
                  {lessonFormData.pdfLinks && lessonFormData.pdfLinks.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      {lessonFormData.pdfLinks.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-white border border-slate-100 p-2 rounded-xl">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Link size={12} className="text-slate-400 shrink-0" />
                            <span className="font-extrabold text-slate-700 truncate">{p.title}</span>
                            <span className="text-[10px] text-slate-450 truncate">({p.url})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setLessonFormData(prev => ({
                                ...prev,
                                pdfLinks: prev.pdfLinks.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Drag & Drop File Attachments Manager */}
                <div className="space-y-3">
                  <span className="block text-[10px] uppercase font-black text-slate-500 tracking-wider">Anexar Materiais Diversos (Arraste e Solte)</span>
                  
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(true);
                    }}
                    onDragLeave={() => setIsDraggingFile(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingFile(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const file = e.dataTransfer.files[0];
                        simulateInstructorFileUpload(file);
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all ${
                      isDraggingFile 
                        ? 'border-brand-blue bg-blue-50/20' 
                        : 'border-slate-205 bg-slate-50/20 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="space-y-2">
                      <Upload className="mx-auto text-slate-400" size={24} />
                      <div className="text-xs">
                        <span className="font-black text-slate-700">Arraste seu arquivo de mídia ou apostila aqui</span>
                        <p className="text-[10px] text-slate-400 font-medium">Suporta PDFs, imagens litúrgicas, slides e mídias</p>
                      </div>
                      
                      <label className="inline-block px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-[10px] font-black uppercase cursor-pointer select-none">
                        Procurar Arquivo...
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              simulateInstructorFileUpload(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {uploadProgressValue !== null && (
                      <div className="max-w-xs mx-auto pt-3 space-y-1">
                        <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                          <div className="bg-[#007cba] h-full transition-all duration-200" style={{ width: `${uploadProgressValue}%` }} />
                        </div>
                        <span className="text-[9px] font-mono text-slate-400">Processando e enviando... {uploadProgressValue}%</span>
                      </div>
                    )}
                  </div>

                  {/* Attachments list with sizes */}
                  {lessonFormData.attachments && lessonFormData.attachments.length > 0 && (
                    <div className="space-y-1.5">
                      {lessonFormData.attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs bg-slate-50/80 border border-slate-150 p-2.5 rounded-xl">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={14} className="text-[#007cba]" />
                            <div className="truncate">
                              <span className="font-extrabold text-slate-800 block truncate">{file.name}</span>
                              {file.size && <span className="text-[9.5px] text-slate-450 font-semibold">{file.size}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setLessonFormData(prev => ({
                                  ...prev,
                                  attachments: prev.attachments.filter((_, i) => i !== idx)
                                }));
                              }}
                              className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button type="button" onClick={() => setIsLessonModalOpen(false)} className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-lg cursor-pointer">Cancelar</button>
                <button type="button" onClick={handleSaveLesson} className="text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 rounded-lg flex items-center gap-1 cursor-pointer"><Save size={13} /> Salvar Aula</button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: EXAM FORM ================= */}
      {isQuizModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[9999] overflow-y-auto flex items-center justify-center p-4 md:p-10">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
          >
            <button onClick={() => setIsQuizModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-755 cursor-pointer"><X size={18} /></button>
            <h3 className="font-black text-lg text-slate-805 mb-6">{quizFormData.id ? 'Editar Avaliação' : 'Nova Avaliação / Prova'}</h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400">Título do Exame</label>
                <input
                  type="text"
                  placeholder="Ex: Avaliação Final do Módulo 1"
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none focus:bg-white text-slate-800"
                  value={quizFormData.title}
                  onChange={(e) => setQuizFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400">Instruções / Diretrizes (Texto curtinho)</label>
                <textarea
                  placeholder="Instruções para a realização da avaliação..."
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none focus:bg-white text-slate-800 h-20 resize-none"
                  value={quizFormData.description}
                  onChange={(e) => setQuizFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400">Tempo limite (minutos)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none text-slate-800"
                    value={quizFormData.timeLimitMins}
                    onChange={(e) => setQuizFormData(prev => ({ ...prev, timeLimitMins: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400">Máximo de Tentativas</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none text-slate-800"
                    value={quizFormData.maxAttempts}
                    onChange={(e) => setQuizFormData(prev => ({ ...prev, maxAttempts: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400">Nota de Repasse Mínima (%)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none text-slate-800"
                    value={quizFormData.passingGrade}
                    onChange={(e) => setQuizFormData(prev => ({ ...prev, passingGrade: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400">Randomizar Perguntas?</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none text-slate-800 select-none cursor-pointer"
                    value={quizFormData.randomizeQuestions ? 'yes' : 'no'}
                    onChange={(e) => setQuizFormData(prev => ({ ...prev, randomizeQuestions: e.target.value === 'yes' }))}
                  >
                    <option value="yes">Sim, misturar</option>
                    <option value="no">Não, exibir em ordem</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button onClick={() => setIsQuizModalOpen(false)} className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-lg cursor-pointer">Cancelar</button>
                <button onClick={handleSaveQuiz} className="text-xs font-black text-white bg-brand-blue hover:bg-brand-blue/90 px-6 py-2.5 rounded-lg flex items-center gap-1 cursor-pointer"><Save size={13} /> Criar Exame</button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: INQUIRES / QUESTIONS FORM ================= */}
      {isQuestionModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[9999] overflow-y-auto flex items-center justify-center p-4 md:p-10">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] border border-slate-100 p-6 md:p-8 w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
          >
            <button onClick={() => setIsQuestionModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-750 cursor-pointer"><X size={18} /></button>
            <h3 className="font-black text-lg text-slate-855 mb-6">Questão Acadêmica</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400">Tipo da Questão</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none text-slate-800 cursor-pointer"
                    value={questionFormData.type}
                    onChange={(e) => setQuestionFormData(prev => ({ ...prev, type: e.target.value as any, correctAnswer: e.target.value === 'true_false' ? 'V' : 'A' }))}
                  >
                    <option value="multiple_choice">Múltipla Escolha</option>
                    <option value="true_false">Verdadeiro ou Falso</option>
                    <option value="discursive">Discursiva / Dissertativa</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400">Pontos / Peso</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none text-slate-800"
                    value={questionFormData.points}
                    onChange={(e) => setQuestionFormData(prev => ({ ...prev, points: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400">Enunciado / Pergunta</label>
                <textarea
                  placeholder="Digite aqui o texto principal da pergunta..."
                  className="w-full bg-slate-50 border border-slate-205 p-3 rounded-xl text-xs font-bold outline-none focus:bg-white text-slate-800 h-20 resize-none"
                  value={questionFormData.questionText}
                  onChange={(e) => setQuestionFormData(prev => ({ ...prev, questionText: e.target.value }))}
                />
              </div>

              {/* OPTIONS FOR MULTIPLE CHOICE */}
              {questionFormData.type === 'multiple_choice' && (
                <div className="space-y-2 pt-2 border-t border-slate-50">
                  <label className="text-[10px] uppercase font-black text-slate-400">Opções de Resposta</label>
                  {questionFormData.options.map((opt, oIdx) => {
                    const ltr = String.fromCharCode(65 + oIdx);
                    return (
                      <div key={`input-opt-${ltr}`} className="flex items-center gap-2">
                        <span className="font-black text-xs text-slate-450 w-5">{ltr})</span>
                        <input
                          type="text"
                          placeholder={`Opção ${ltr}`}
                          className="flex-1 bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold outline-none focus:bg-white"
                          value={opt}
                          onChange={(e) => {
                            const updated = [...questionFormData.options];
                            updated[oIdx] = e.target.value;
                            setQuestionFormData(prev => ({ ...prev, options: updated }));
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CORRECT ANSWER SELECTION */}
              <div className="space-y-1.5 pt-2 border-t border-slate-54">
                <label className="text-[10px] uppercase font-black text-slate-400">Gabarito / Resposta Correta</label>
                {questionFormData.type === 'discursive' ? (
                  <textarea
                    placeholder="Escreva diretrizes gerais ou critérios chaves para a aprovação correta que o inspetor deve analisar..."
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none text-slate-800 h-16 resize-none"
                    value={questionFormData.correctAnswer}
                    onChange={(e) => setQuestionFormData(prev => ({ ...prev, correctAnswer: e.target.value }))}
                  />
                ) : questionFormData.type === 'true_false' ? (
                  <select
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none text-slate-800 cursor-pointer"
                    value={questionFormData.correctAnswer}
                    onChange={(e) => setQuestionFormData(prev => ({ ...prev, correctAnswer: e.target.value }))}
                  >
                    <option value="V">Verdadeiro (V)</option>
                    <option value="F">Falso (F)</option>
                  </select>
                ) : (
                  <select
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none text-slate-800 cursor-pointer"
                    value={questionFormData.correctAnswer}
                    onChange={(e) => setQuestionFormData(prev => ({ ...prev, correctAnswer: e.target.value }))}
                  >
                    <option value="A">Opção A</option>
                    <option value="B">Opção B</option>
                    <option value="C">Opção C</option>
                    <option value="D">Opção D</option>
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400">Feedback explicativo (Opcional)</label>
                <input
                  type="text"
                  placeholder="Justificativa da resposta exibida em feedbacks..."
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none text-slate-800"
                  value={questionFormData.feedback}
                  onChange={(e) => setQuestionFormData(prev => ({ ...prev, feedback: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button onClick={() => setIsQuestionModalOpen(false)} className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-lg cursor-pointer">Cancelar</button>
                <button onClick={handleSaveQuestion} className="text-xs font-black text-white bg-brand-blue hover:bg-brand-blue/90 px-6 py-2.5 rounded-lg flex items-center gap-1 cursor-pointer"><Save size={13} /> Gravar Questão</button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: MANUAL EVALUATION FEEDBACKS ================= */}
      {selectedAttemptToGrade && createPortal(
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[9999] overflow-y-auto flex items-center justify-center p-4 md:p-10">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] border border-slate-100 p-6 md:p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
          >
            <button onClick={() => setSelectedAttemptToGrade(null)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-755 cursor-pointer"><X size={18} /></button>
            <h3 className="font-black text-lg text-slate-850 mb-6">Correction Board: {selectedAttemptToGrade.userName}</h3>

            <div className="space-y-6">
              {/* Load essay questions */}
              {questions.filter(q => q.type === 'discursive').map((quest, qIdx) => {
                const answerWritten = selectedAttemptToGrade.answers[quest.id] || '(Em branco)';
                return (
                  <div key={quest.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-450 uppercase text-[9.5px]">Pergunta Discursiva #{qIdx + 1}</span>
                      <span className="text-[10px] font-black text-brand-blue bg-blue-50/50 px-2.5 py-1 rounded-lg">Valor: {quest.points} pontos</span>
                    </div>

                    <h4 className="font-extrabold text-sm text-slate-800 font-serif leading-snug">{quest.questionText}</h4>
                    
                    <div className="bg-white p-3.5 rounded-xl border border-dashed border-slate-200 text-xs md:text-sm text-slate-700 leading-relaxed font-semibold italic">
                      &ldquo;{answerWritten}&rdquo;
                    </div>

                    <div className="text-[11px] text-slate-450 bg-slate-100 p-3 rounded-lg border border-slate-100 leading-relaxed font-semibold">
                      <strong className="text-slate-700">Instruções de Correção:</strong> {quest.correctAnswer}
                    </div>

                    <div className="flex items-center gap-3 w-40 pt-2">
                      <label className="text-[10px] uppercase font-black text-slate-400 shrink-0">Nota dada:</label>
                      <input
                        type="number"
                        max={quest.points}
                        min={0}
                        className="bg-white border border-slate-205 p-2 rounded-xl text-xs font-black text-center text-slate-800"
                        value={awardGrades[quest.id] || 0}
                        onChange={(e) => {
                          const val = Math.min(quest.points, Math.max(0, Number(e.target.value)));
                          setAwardGrades(prev => ({ ...prev, [quest.id]: val }));
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="space-y-1.5 pt-4 border-t border-slate-50">
                <label className="text-[10px] uppercase font-black text-slate-400">Feedback Textual do Instrutor</label>
                <textarea
                  placeholder="Escreva elogios e orientações pedagógicas para o aluno..."
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none focus:bg-white text-slate-800 h-24 resize-none"
                  value={instructorFeedback}
                  onChange={(e) => setInstructorFeedback(e.target.value)}
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setSelectedAttemptToGrade(null)} className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-lg cursor-pointer">Fechar</button>
                <button onClick={handleSaveGrading} className="text-xs font-black text-white bg-brand-green hover:bg-brand-green/90 px-6 py-2.5 rounded-lg flex items-center gap-1 cursor-pointer shadow shadow-brand-green/10"><Check size={13} strokeWidth={3} /> Salvar Avaliação</button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: ADD STUDENT ENROLLMENT ================= */}
      {isEnrollModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[9999] overflow-y-auto flex items-center justify-center p-4 md:p-10">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 w-full max-w-sm shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
          >
            <button onClick={() => setIsEnrollModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-755 cursor-pointer"><X size={18} /></button>
            <h3 className="font-black text-lg text-slate-800 mb-6">Matricular Aluno</h3>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400">Selecione o Estudante</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold outline-none text-slate-800 cursor-pointer"
                  value={selectedUserToEnroll}
                  onChange={(e) => setSelectedUserToEnroll(e.target.value)}
                >
                  <option value="">-- Escolher Aluno --</option>
                  {users.map(u => (
                    <option key={`enr-opt-user-${u.id}`} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <button onClick={() => setIsEnrollModalOpen(false)} className="text-xs font-bold text-slate-505 bg-slate-100 px-4 py-2.5 rounded-lg cursor-pointer">Cancelar</button>
                <button onClick={handleAddEnrollment} className="text-xs font-black text-white bg-brand-blue hover:bg-brand-blue/90 px-6 py-2.5 rounded-lg flex items-center gap-1 cursor-pointer"><Check size={13} strokeWidth={3} /> Efetuar Matrícula</button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: AI QUESTION IMPORTER ================= */}
      {isImportModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[9999] overflow-y-auto flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] border border-slate-100 p-6 md:p-8 w-full max-w-xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <button 
              onClick={() => {
                if (!isImportLoader) setIsImportModalOpen(false);
              }} 
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-750 cursor-pointer disabled:opacity-30"
              disabled={isImportLoader}
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <Sparkles size={18} strokeWidth={2.5} className="animate-pulse" />
              </div>
              <h3 className="font-black text-lg text-slate-800">Importação Inteligente via IA</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
              Nossa IA de processamento de documentos extrai as perguntas de forma autônoma. Insira um link, faça o upload de um arquivo ou cole seu rascunho de perguntas.
            </p>

            <div className="space-y-4">
              {/* Option 1: Link (Google Forms / Web) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-1">
                    <Link size={10} /> Link (Google Forms / Web)
                  </label>
                  {importUrl && (
                    <button onClick={() => setImportUrl('')} className="text-[9px] text-red-500 hover:underline">Limpar</button>
                  )}
                </div>
                <input
                  type="url"
                  disabled={isImportLoader || !!importFileBase64 || !!importText}
                  placeholder="https://docs.google.com/forms/d/e/.../viewform"
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold outline-none focus:bg-white text-slate-800 disabled:opacity-50 transition-all placeholder:text-slate-350"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                />
              </div>

              {/* Option 2: Document / Image File Upload */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-1">
                  <Upload size={10} /> Enviar Arquivo (PDF, Imagem, Texto)
                </label>
                <div className={`relative border border-dashed rounded-xl p-4 text-center transition-all ${
                  importFileBase64 ? 'bg-indigo-50/20 border-indigo-300' : 'bg-slate-50 hover:bg-slate-100/50 border-slate-200'
                }`}>
                  <input
                    type="file"
                    disabled={isImportLoader || !!importUrl || !!importText}
                    accept=".pdf,.png,.jpg,.jpeg,.txt,.csv"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    onChange={handleImportFileChange}
                  />
                  {importFileName ? (
                    <div className="flex items-center justify-between gap-2 px-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText size={16} className="text-indigo-600 flex-shrink-0" />
                        <span className="text-xs font-bold text-slate-700 truncate">{importFileName}</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setImportFileName('');
                          setImportFileBase64('');
                          setImportFileMime('');
                        }} 
                        className="text-[10px] text-red-500 font-extrabold hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-600">Arraste ou clique para selecionar</p>
                      <p className="text-[9px] text-slate-400">PDF, JPG, PNG ou TXT (Max 5MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Option 3: Copy/paste Raw text */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-black text-slate-400 flex items-center gap-1">
                    <AlignLeft size={10} /> Copiar e Colar Texto
                  </label>
                  {importText && (
                    <button onClick={() => setImportText('')} className="text-[9px] text-red-500 hover:underline">Limpar</button>
                  )}
                </div>
                <textarea
                  disabled={isImportLoader || !!importUrl || !!importFileBase64}
                  placeholder="Cole aqui o texto de suas perguntas com suas respectivas opções..."
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold outline-none focus:bg-white text-slate-800 h-24 resize-none disabled:opacity-50 transition-all placeholder:text-slate-350"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
              </div>

              {/* Status & Feedback Boxes */}
              {importErrorMsg && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-600">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span className="text-[11px] font-bold leading-relaxed">{importErrorMsg}</span>
                </div>
              )}

              {importSuccessCount !== null && (
                <div className="p-3 bg-brand-green/10 border border-brand-green/20 rounded-xl flex items-start gap-2 text-brand-green animate-bounce">
                  <CheckCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <div className="text-[11px] font-bold leading-relaxed">
                    Importação bem-sucedida! <span className="underline">{importSuccessCount} questões</span> foram extraídas e integradas com sucesso ao exame.
                  </div>
                </div>
              )}

              {/* Loading State Animation */}
              {isImportLoader && (
                <div className="py-4 flex flex-col items-center justify-center gap-2 bg-indigo-50/10 border border-indigo-100 rounded-2xl animate-pulse">
                  <Loader2 size={24} className="animate-spin text-indigo-600" />
                  <span className="text-xs font-black text-indigo-700">Analisando dados do exame com Gemini...</span>
                  <p className="text-[10px] text-slate-400 px-8 text-center italic">Isso pode levar alguns segundos dependendo do tamanho do conteúdo.</p>
                </div>
              )}

              {/* Final Actions Block */}
              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button 
                  disabled={isImportLoader}
                  onClick={() => setIsImportModalOpen(false)} 
                  className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-lg cursor-pointer disabled:opacity-40 transition-all"
                >
                  Fechar
                </button>
                <button 
                  disabled={isImportLoader || (!importUrl && !importText && !importFileBase64)}
                  onClick={handleExecuteImportQuestions} 
                  className="text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-all shadow shadow-indigo-600/15"
                >
                  {isImportLoader ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Importando...
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} /> Iniciar Importação
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: REFERENCE MATERIAL (TON GROUNDING) ================= */}
      {isMaterialModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[9999] overflow-y-auto flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
          >
            <button 
              type="button"
              onClick={() => setIsMaterialModalOpen(false)} 
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-[#007cba]/15 rounded-xl text-[#007cba]">
                <BookOpen size={18} strokeWidth={2.5} />
              </div>
              <h3 className="font-black text-lg text-slate-800">Material de Consulta (Ton)</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6">
              Adicione as informações de referência que guiarão as respostas do assistente de inteligência artificial do seu curso.
            </p>

            <div className="space-y-4">
              {/* Material Title */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Título do Material</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Diretrizes Pastorais de Catequese 2026"
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold outline-none focus:bg-white text-slate-850"
                  value={materialFormData.title}
                  onChange={(e) => setMaterialFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              {/* Material Type Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Tipo de Conhecimento</label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold outline-none focus:bg-white text-slate-850 cursor-pointer"
                  value={materialFormData.type}
                  onChange={(e) => setMaterialFormData(prev => ({ ...prev, type: e.target.value as any }))}
                >
                  <option value="document">📝 Texto Customizado / Documento</option>
                  <option value="pdf">📖 Link de PDF para Consulta</option>
                  <option value="link">🔗 Link Externo de Apoio</option>
                </select>
              </div>

              {/* Material URL */}
              {materialFormData.type !== 'document' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider">URL de Referência</label>
                  <input
                    type="url"
                    required
                    placeholder="https://exemplo.com/material-catequese.pdf"
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold outline-none focus:bg-white text-slate-850"
                    value={materialFormData.url}
                    onChange={(e) => setMaterialFormData(prev => ({ ...prev, url: e.target.value }))}
                  />
                </div>
              )}

              {/* Material Content / Snippet */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Conteúdo de Consulta / Grounding de IA</label>
                <textarea
                  placeholder="Escreva ou cole aqui as orientações e diretrizes precisas adicionais sobre este tema para guiar as respostas do Ton..."
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-semibold outline-none focus:bg-white text-slate-850 h-32 resize-none"
                  value={materialFormData.contentSnippet}
                  onChange={(e) => setMaterialFormData(prev => ({ ...prev, contentSnippet: e.target.value }))}
                />
              </div>

              {/* Modal controls */}
              <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsMaterialModalOpen(false)} 
                  className="text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-lg cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleSaveMaterial} 
                  disabled={!materialFormData.title}
                  className="text-xs font-black text-white bg-[#007cba] hover:bg-[#007ba8] px-6 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition-all shadow"
                >
                  Salvar Conhecimento
                </button>
              </div>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* ================= MODAL: CUSTOM DELETE CONFIRMATION ================= */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        title={deleteModal.title}
        message={deleteModal.message}
        onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false, onConfirm: null }))}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleteLoading}
      />

    </div>
  );
};
