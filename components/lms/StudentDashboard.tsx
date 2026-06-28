import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Course, User } from '../../types';
import { LMSCertificate, LMSEnrollment, LMSQuizAttempt, LMSQuiz, LMSLeaderboardRow, LMSBadge, LMSModule } from '../../lmsTypes';
import { lmsService } from '../../lmsService';
import { supabase } from '../../supabaseClient';
import { 
  Award, BookOpen, Clock, CheckCircle, Flame, Grid, ListTodo, Bookmark, 
  ChevronRight, Calendar, ArrowUpRight, Search, FileDown, PlusCircle, LayoutGrid, Heart,
  Trophy, Sparkles, Users, Snowflake, Lock, Play, Check, ChevronDown, Star, Zap, HelpCircle, X, Shield, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StudentDashboardProps {
  courses: Course[];
  currentUser: User;
  users: User[];
  onSelectCourse: (course: Course) => void;
  onViewCertificate: (cert: LMSCertificate) => void;
  onRefresh: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ 
  courses, currentUser, users, onSelectCourse, onViewCertificate, onRefresh
}) => {
  // Primary sub-navigation tab
  const [filterMode, setFilterMode] = useState<'learning_path' | 'history' | 'certificates'>('learning_path');
  const [searchTerm, setSearchTerm] = useState('');

  // Course Selector for Visual Progression Map
  const [activeCourseId, setActiveCourseId] = useState<string>('');

  // Visual Progression Map details
  const [pathModules, setPathModules] = useState<LMSModule[]>([]);
  const [pathLessons, setPathLessons] = useState<any[]>([]);
  const [pathQuizzes, setPathQuizzes] = useState<LMSQuiz[]>([]);
  const [pathCompletedIds, setPathCompletedIds] = useState<Set<string | number>>(new Set());

  // Interactive drawer details for selected progression map step
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    type: 'lesson' | 'quiz';
    title: string;
    description: string;
    duration?: string;
    isLocked: boolean;
    isCompleted: boolean;
    orderIndex: number;
    rawItem: any;
    moduleTitle?: string;
  } | null>(null);

  // Sync statistics & data
  const [enrollments, setEnrollments] = useState<LMSEnrollment[]>([]);
  const [certificates, setCertificates] = useState<LMSCertificate[]>([]);
  const [attempts, setAttempts] = useState<LMSQuizAttempt[]>([]);
  const [quizzes, setQuizzes] = useState<LMSQuiz[]>([]);
  
  // Gamification & streak states
  const [leaderboard, setLeaderboard] = useState<LMSLeaderboardRow[]>([]);
  const [userOffensiveDates, setUserOffensiveDates] = useState<string[]>([]);
  const [hasCheckedInToday, setHasCheckedInToday] = useState<boolean>(() => {
    try {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const stored = localStorage.getItem(`lms_daily_checkins_${currentUser.id}`);
      const dates = stored ? JSON.parse(stored) : [];
      return dates.includes(todayStr);
    } catch {
      return false;
    }
  });

  // Celebration state
  const [celebration, setCelebration] = useState<{
    show: boolean;
    title: string;
    subtitle: string;
    xpEarned: number;
  } | null>(null);

  useEffect(() => {
    loadLMSStudentData();
  }, [filterMode]);

  const loadLMSStudentData = async () => {
    try {
      let allEnroll = await lmsService.fetchAllEnrollments();
      let studentEnroll = allEnroll.filter(e => e.userId === currentUser.id);
      
      // Load gamification profiles
      const leaderboardData = await lmsService.fetchLeaderboard();
      setLeaderboard(leaderboardData);

      const offensiveList = await lmsService.fetchUserOffensiveDates(currentUser.id);
      setUserOffensiveDates(offensiveList);

      // Fetch authentic certificates & attempts
      const studentCerts = await lmsService.fetchCertificates(currentUser.id);
      setCertificates(studentCerts);

      const allAttempts = await lmsService.fetchAllAttempts();
      const usersAttempts = allAttempts.filter(a => a.userId === currentUser.id);
      setAttempts(usersAttempts);

      // Auto-enroll the logged-in user in all offered courses automatically
      const missingCourses = courses.filter(c => !studentEnroll.some(e => e.courseId === c.id));
      if (missingCourses.length > 0) {
        let realEmail = currentUser.email || 'aluno@pascom.net';
        for (const c of missingCourses) {
          const newEnroll: LMSEnrollment = {
            id: `enr-${c.id}-${currentUser.id}`,
            courseId: c.id,
            userId: currentUser.id,
            userName: currentUser.name,
            userEmail: realEmail,
            enrolledAt: new Date().toISOString(),
            status: 'active'
          };
          await lmsService.saveEnrollment(newEnroll);
        }
        allEnroll = await lmsService.fetchAllEnrollments();
        studentEnroll = allEnroll.filter(e => e.userId === currentUser.id);
      }
      
      setEnrollments(studentEnroll);

      // Load all available quizzes
      const allQuizzes: LMSQuiz[] = [];
      for (const c of courses) {
        const qList = await lmsService.fetchQuizzes(c.id);
        allQuizzes.push(...qList);
      }
      setQuizzes(allQuizzes);
    } catch (e) {
      console.error("Error loading LMS student data:", e);
    }
  };

  // Switchers & computations
  const isEnrolled = (courseId: string) => enrollments.some(e => e.courseId === courseId);
  const enrolledCourses = courses.filter(c => isEnrolled(c.id));

  // Default active course selector binding
  useEffect(() => {
    if (enrolledCourses.length > 0 && !activeCourseId) {
      setActiveCourseId(enrolledCourses[0].id);
    }
  }, [enrolledCourses, activeCourseId]);

  // Load modules & progression list for the active selected Course
  useEffect(() => {
    if (activeCourseId) {
      loadPathwayData(activeCourseId);
    }
  }, [activeCourseId, enrollments]);

  const loadPathwayData = async (courseId: string) => {
    try {
      const mods = await lmsService.fetchModules(courseId);
      setPathModules(mods.sort((a,b) => a.orderIndex - b.orderIndex));

      const less = await lmsService.fetchLessons(courseId);
      setPathLessons(less.sort((a,b) => (a.orderIndex || 0) - (b.orderIndex || 0)));

      const quizList = await lmsService.fetchQuizzes(courseId);
      setPathQuizzes(quizList);

      const cachedProgressString = localStorage.getItem(`lms_completed_lessons_${currentUser.id}_${courseId}`);
      const cachedProgress = cachedProgressString ? JSON.parse(cachedProgressString) : [];
      setPathCompletedIds(new Set(cachedProgress));
    } catch (e) {
      console.error("Error loading pathway data:", e);
    }
  };

  const handleEnroll = async (course: Course) => {
    try {
      const exists = enrollments.some(e => e.courseId === course.id);
      if (exists) return;

      const newEnrollment: LMSEnrollment = {
        id: `enr-${Date.now()}`,
        courseId: course.id,
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email || 'aluno@pascom.net',
        enrolledAt: new Date().toISOString(),
        status: 'active'
      };

      await lmsService.saveEnrollment(newEnrollment);
      await loadLMSStudentData();
      setActiveCourseId(course.id);
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  // Compute User Gamification Levels
  const userLeaderboardRow = leaderboard.find(x => x.userId === currentUser.id);
  const userXP = userLeaderboardRow?.xp || Number(localStorage.getItem(`user_xp_${currentUser.id}`)) || 150;
  const userLevel = Math.floor(userXP / 250) + 1;
  const xpInCurrentLevel = userXP % 250;
  const progressToNextLevel = (xpInCurrentLevel / 250) * 100;
  const userStreak = userLeaderboardRow?.streakCount || Number(localStorage.getItem(`user_streak_${currentUser.id}`)) || 3;

  // Build weekly streak tracker array (Monday to Sunday, centered on today)
  const getWeeklyStreak = () => {
    const streakDays = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      const dayNum = d.getDate();
      const hasStudied = userOffensiveDates.includes(dateStr);
      streakDays.push({
        dateStr,
        dayName: dayName.substring(0, 3).toUpperCase(),
        dayNum,
        hasStudied,
        isToday: i === 0
      });
    }
    return streakDays;
  };

  // Define 3 Daily Missions
  const dailyMissions = [
    {
      id: 'mission-study',
      title: 'Ardor Comunicativo',
      desc: 'Entre no ambiente de estudos e estude hoje para manter sua ofensiva.',
      reward: 20,
      progress: userOffensiveDates.includes(new Date().toLocaleDateString('en-CA')) ? 100 : 0,
      icon: Flame,
      color: 'text-orange-500 bg-orange-50 border-orange-100'
    },
    {
      id: 'mission-lesson',
      title: 'Apostolado Intelectual',
      desc: 'Complete pelo menos uma aula em vídeo ou leitura técnica.',
      reward: 35,
      progress: pathCompletedIds.size > 0 ? 100 : 0,
      icon: BookOpen,
      color: 'text-blue-500 bg-blue-50 border-blue-100'
    },
    {
      id: 'mission-xp',
      title: 'Voto de Dedicação',
      desc: 'Acumule 50 XP adicionais estudando trilhas ou completando avaliações.',
      reward: 50,
      progress: userXP >= 200 ? 100 : Math.min(100, Math.round((userXP / 200) * 100)),
      icon: Sparkles,
      color: 'text-amber-500 bg-amber-50 border-amber-100'
    }
  ];

  const isMissionClaimed = (id: string) => {
    return localStorage.getItem(`lms_mission_claimed_${currentUser.id}_${id}`) === 'true';
  };

  const handleClaimReward = async (missionId: string, xpReward: number) => {
    try {
      const newXp = await lmsService.earnXP(currentUser.id, xpReward);
      localStorage.setItem(`lms_mission_claimed_${currentUser.id}_${missionId}`, 'true');
      await lmsService.updateUserStreak(currentUser.id);
      
      // Update global user badges
      const finishedCourses = courses.filter(c => isEnrolled(c.id) && c.progress === 100).length;
      if (finishedCourses > 0) {
        await lmsService.saveUserBadge(currentUser.id, 'espiritualidade');
      }

      setCelebration({
        show: true,
        title: 'Missão Cumprida!',
        subtitle: `Você demonstrou excelente disciplina formativa. Recebeu +${xpReward} XP de comunhão e avançou rumo ao próximo nível!`,
        xpEarned: xpReward
      });

      await loadLMSStudentData();
      if (activeCourseId) {
        await loadPathwayData(activeCourseId);
      }
      onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  // Compile active course modules, lessons, and quizzes into a unified serpentine roadmap
  const activeCourse = courses.find(c => c.id === activeCourseId);
  const learningPath = React.useMemo(() => {
    if (!activeCourse) return [];

    const path: {
      id: string;
      type: 'lesson' | 'quiz';
      title: string;
      description: string;
      duration?: string;
      isLocked: boolean;
      isCompleted: boolean;
      orderIndex: number;
      rawItem: any;
      moduleTitle?: string;
    }[] = [];

    // Process structured modules
    pathModules.forEach((mod) => {
      const modLessons = pathLessons.filter(l => l.moduleId === mod.id);
      const modQuizzes = pathQuizzes.filter(q => q.moduleId === mod.id);
      const combined: typeof path = [];

      modLessons.forEach(l => {
        combined.push({
          id: l.id,
          type: 'lesson',
          title: l.title,
          description: l.description || 'Teoria de estudo fundamental para agentes.',
          duration: l.duration || '10:00',
          isLocked: false,
          isCompleted: pathCompletedIds.has(l.id),
          orderIndex: l.orderIndex || 1,
          rawItem: l,
          moduleTitle: mod.title
        });
      });

      modQuizzes.forEach(q => {
        combined.push({
          id: q.id,
          type: 'quiz',
          title: q.title,
          description: q.description || 'Avaliação final para obtenção de diploma pastoral.',
          duration: `${q.timeLimitMins} mins`,
          isLocked: false,
          isCompleted: attempts.some(att => att.quizId === q.id && att.score >= q.passingGrade),
          orderIndex: 999, // Quizzes are sorted to appear after lessons
          rawItem: q,
          moduleTitle: mod.title
        });
      });

      combined.sort((a,b) => a.orderIndex - b.orderIndex);
      path.push(...combined);
    });

    // Fallbacks for module-less/general items
    const generalLessons = pathLessons.filter(l => !l.moduleId || !pathModules.some(m => m.id === l.moduleId));
    const generalQuizzes = pathQuizzes.filter(q => !q.moduleId || !pathModules.some(m => m.id === q.moduleId));
    const generalCombined: typeof path = [];

    generalLessons.forEach(l => {
      generalCombined.push({
        id: l.id,
        type: 'lesson',
        title: l.title,
        description: l.description || 'Conteúdo complementar livre para estudo.',
        duration: l.duration || '15:00',
        isLocked: false,
        isCompleted: pathCompletedIds.has(l.id),
        orderIndex: l.orderIndex || 1,
        rawItem: l,
        moduleTitle: 'Fundamentos Gerais'
      });
    });

    generalQuizzes.forEach(q => {
      generalCombined.push({
        id: q.id,
        type: 'quiz',
        title: q.title,
        description: q.description || 'Avaliação geral.',
        duration: `${q.timeLimitMins} mins`,
        isLocked: false,
        isCompleted: attempts.some(att => att.quizId === q.id && att.score >= q.passingGrade),
        orderIndex: 999,
        rawItem: q,
        moduleTitle: 'Avaliação Final'
      });
    });

    generalCombined.sort((a,b) => a.orderIndex - b.orderIndex);
    path.push(...generalCombined);

    // Apply linear dependency lock logic (Duolingo style: subsequent steps are locked until previous is completed)
    let previousCompleted = true;
    return path.map((step, index) => {
      let isLocked = false;
      if (index > 0) {
        isLocked = !previousCompleted;
      }
      previousCompleted = step.isCompleted;
      return {
        ...step,
        isLocked
      };
    });
  }, [activeCourse, pathModules, pathLessons, pathQuizzes, pathCompletedIds, attempts]);

  // Find next pending uncompleted active step for Highlighted CTA
  const nextPendingStep = React.useMemo(() => {
    return learningPath.find(step => !step.isCompleted && !step.isLocked);
  }, [learningPath]);

  // Group learning path steps by module title for the Netflix-style catalog catalog layout
  const modulesMap = React.useMemo(() => {
    const map: { [key: string]: typeof learningPath } = {};
    learningPath.forEach(item => {
      const key = item.moduleTitle || 'Módulo Geral';
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(item);
    });
    return map;
  }, [learningPath]);

  // Dynamic cinematic thumbnail generator based on class/quiz title
  const getThumbnailForStep = (step: typeof learningPath[0]) => {
    const title = step.title.toLowerCase();
    
    // 1. Photography / Camera
    if (title.includes('foto') || title.includes('imagem') || title.includes('câmera') || title.includes('exposição') || title.includes('enquadramento') || title.includes('iluminação') || title.includes('lente') || title.includes('mídias') || title.includes('regras')) {
      return 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&auto=format&fit=crop&q=80';
    }
    // 2. Audio / Sound
    if (title.includes('som') || title.includes('áudio') || title.includes('console') || title.includes('microfone') || title.includes('acústica') || title.includes('áudio')) {
      return 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80';
    }
    // 3. Social Media / Digital Communications
    if (title.includes('mídia') || title.includes('redes') || title.includes('site') || title.includes('instagram') || title.includes('comunicação') || title.includes('divulgação') || title.includes('canais')) {
      return 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80';
    }
    // 4. Theology / Church / Liturgy / Spirituality
    if (title.includes('teologia') || title.includes('espiritualidade') || title.includes('vocação') || title.includes('liturgia') || title.includes('eclesial') || title.includes('cnbb') || title.includes('pastoral') || title.includes('missa') || title.includes('ritores') || title.includes('cristão')) {
      return 'https://images.unsplash.com/photo-1548625361-155deee223d0?w=600&auto=format&fit=crop&q=80';
    }
    // 5. Quiz / Assessment
    if (step.type === 'quiz' || title.includes('avaliação') || title.includes('prova')) {
      return 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=600&auto=format&fit=crop&q=80';
    }
    
    // Default fallback
    return 'https://images.unsplash.com/photo-1447069387593-a5de0862481e?w=600&auto=format&fit=crop&q=80';
  };

  const handleStartNodeStep = (step: typeof learningPath[0]) => {
    if (!activeCourse) return;
    
    // Save state indicator into localStorage so classroom deep links directly
    if (step.type === 'lesson') {
      localStorage.setItem(`lms_active_lesson_id_${currentUser.id}_${activeCourse.id}`, String(step.id));
    } else {
      localStorage.setItem(`lms_active_quiz_id_${currentUser.id}_${activeCourse.id}`, String(step.id));
    }

    onSelectCourse(activeCourse);
  };

  const filterBySearch = (list: Course[]) => {
    return list.filter(c => 
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleDailyCheckIn = async () => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    try {
      const stored = localStorage.getItem(`lms_daily_checkins_${currentUser.id}`);
      const dates: string[] = stored ? JSON.parse(stored) : [];
      if (dates.includes(todayStr)) {
        return;
      }
      dates.push(todayStr);
      localStorage.setItem(`lms_daily_checkins_${currentUser.id}`, JSON.stringify(dates));
    } catch (e) {
      console.error(e);
    }

    const updatedXP = await lmsService.earnXP(currentUser.id, 40);
    await lmsService.updateUserStreak(currentUser.id);
    
    setHasCheckedInToday(true);
    
    setCelebration({
      show: true,
      title: 'Check-in Diário Realizado!',
      subtitle: 'Sua presença hoje foi confirmada na comunidade! Você conquistou +40 XP extras.',
      xpEarned: 40
    });

    await loadLMSStudentData();
    if (activeCourseId) {
      await loadPathwayData(activeCourseId);
    }
    onRefresh();
  };

  // Render Confetti Sparkles
  const CelebrationConfetti = () => {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-[99999]">
        {[...Array(35)].map((_, i) => {
          const size = Math.random() * 10 + 6;
          const colors = ['#f59e0b', '#fbbf24', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6'];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          return (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute rounded-full"
              style={{
                width: size,
                height: size,
                backgroundColor: randomColor,
                left: `${Math.random() * 100}%`,
                top: `-5%`,
              }}
              animate={{
                y: ['0vh', '105vh'],
                x: [`0px`, `${(Math.random() - 0.5) * 200}px`],
                rotate: [0, Math.random() * 360],
                opacity: [1, 1, 0]
              }}
              transition={{
                duration: Math.random() * 2 + 1.8,
                ease: 'easeOut',
              }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-6 lg:pb-2 w-full text-slate-800">
      
      {/* Visual Celebration Portal */}
      <AnimatePresence>
        {celebration?.show && createPortal(
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
            <CelebrationConfetti />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full border border-slate-100 shadow-2xl text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
              {/* Gold light burst */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl -z-10" />

              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20 mb-5 text-3xl select-none animate-bounce">
                🏆
              </div>

              <h3 className="text-xl font-black text-slate-900 tracking-tight">{celebration.title}</h3>
              <p className="text-slate-500 text-xs font-bold mt-2.5 leading-relaxed">{celebration.subtitle}</p>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 my-5 flex items-center justify-center gap-2">
                <span className="text-amber-500 text-lg">⚡</span>
                <span className="text-lg font-black text-slate-800">+{celebration.xpEarned} XP Acumulado</span>
              </div>

              <button
                onClick={() => setCelebration(null)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider py-3.5 rounded-xl cursor-pointer shadow-sm transition-all active:scale-95"
              >
                Continuar Aprendizado
              </button>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* ================= LEVEL & STREAK HEADER (TOP HUB) ================= */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-4 shrink-0"
      >
        {/* Level & XP Progression Card */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-150 p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md shadow-amber-500/10">
                Lvl {userLevel}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Grau Pasconero</span>
                <h4 className="text-xs font-black text-slate-800 leading-tight">
                  {userLevel === 1 ? 'Agente Iniciante' : userLevel === 2 ? 'Comunicador Comprometido' : 'Apóstolo Digital'}
                </h4>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-slate-850">{userXP} XP</span>
              <span className="block text-[8px] font-bold text-slate-400 uppercase">Total</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5">
              <span>Nível {userLevel}</span>
              <span>{xpInCurrentLevel} / 250 XP para Nível {userLevel + 1}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 p-0.5 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressToNextLevel}%` }}
                className="bg-gradient-to-r from-amber-400 to-yellow-500 h-1.5 rounded-full" 
              />
            </div>
          </div>
        </div>

        {/* Weekly Streak Tracker (Ofensiva Flame Block) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-150 p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔥</span>
              <div>
                <h4 className="text-xs font-black text-slate-800">Sua Ofensiva de Estudo</h4>
                <p className="text-[10px] font-bold text-slate-400">Estude diariamente para não quebrar o seu hábito!</p>
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-2.5 py-1 text-center">
              <span className="text-sm font-black text-orange-600 block leading-none">{userStreak}</span>
              <span className="text-[7.5px] font-black text-orange-400 uppercase tracking-wider">Dias</span>
            </div>
          </div>

          {/* Mini study grid of 7 weekdays */}
          <div className="grid grid-cols-7 gap-1.5 text-center mt-2 border-t border-slate-50 pt-2.5">
            {getWeeklyStreak().map((day) => (
              <div 
                key={`streak-day-${day.dateStr}`} 
                className={`p-1 py-1.5 rounded-xl border flex flex-col items-center justify-center ${
                  day.isToday ? 'bg-orange-500/5 border-orange-200' : 'bg-slate-50/50 border-slate-100'
                }`}
              >
                <span className="text-[8px] font-black text-slate-400">{day.dayName}</span>
                <span className="text-[9px] font-black text-slate-700 font-mono my-0.5">{day.dayNum}</span>
                <div className="mt-0.5">
                  {day.hasStudied ? (
                    <motion.span animate={{ scale: [1, 1.2, 1] }} className="text-xs select-none">🔥</motion.span>
                  ) : (
                    <span className="text-xs select-none grayscale-100 opacity-20">🧊</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Overview Achievements */}
        <div className="lg:col-span-3 bg-slate-900 text-white rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
          {/* Subtle graphic layout decor */}
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full border border-white/5" />

          <div className="flex items-start justify-between">
            <div>
              <span className="text-[8.5px] font-black tracking-widest text-slate-450 uppercase">Formação Diocesana</span>
              <h3 className="text-sm font-black text-slate-100 mt-1">Status de Comunhão</h3>
            </div>
            <Award className="text-amber-400" size={18} />
          </div>

          <div className="flex items-center gap-4 mt-3 border-t border-white/5 pt-3 text-xs font-semibold">
            <div>
              <span className="block text-white text-lg font-black leading-none mb-0.5">
                {enrolledCourses.length}
              </span>
              <span className="text-[9px] text-slate-400">Trilhas Ativas</span>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div>
              <span className="block text-emerald-400 text-lg font-black leading-none mb-0.5">
                {certificates.length}
              </span>
              <span className="text-[9px] text-slate-400">Certificados</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ================= MAIN NAVIGATION PILLS ================= */}
      <div className="bg-white p-2 rounded-2xl border border-slate-150 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs shrink-0">
        <div className="flex bg-slate-100 rounded-xl p-1 text-[10px] font-black uppercase shrink-0 gap-1 overflow-x-auto select-none">
          {[
            { id: 'learning_path', label: 'Jornada de Aprendizagem', icon: Award },
            { id: 'history', label: 'Avaliações e Notas', icon: ListTodo },
            { id: 'certificates', label: 'Certificados Emitidos', icon: Award },
          ].map(filter => {
            const IconComp = filter.icon;
            return (
              <button
                key={`student-filter-${filter.id}`}
                onClick={() => setFilterMode(filter.id as any)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all cursor-pointer shrink-0 ${
                  filterMode === filter.id 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <IconComp size={11} />
                <span>{filter.label}</span>
              </button>
            );
          })}
        </div>

        {filterMode === 'learning_path' && (
          <button 
            onClick={hasCheckedInToday ? undefined : handleDailyCheckIn}
            disabled={hasCheckedInToday}
            className={`px-3.5 py-2 border text-[10.5px] font-black uppercase tracking-wider rounded-xl transition-all shrink-0 ${
              hasCheckedInToday 
                ? "bg-emerald-50 border-emerald-200 text-emerald-600 cursor-not-allowed flex items-center gap-1.5"
                : "bg-slate-900 hover:bg-slate-800 text-white border-transparent cursor-pointer active:scale-95 flex items-center gap-1.5 shadow-xs"
            }`}
            title={hasCheckedInToday ? "Você já fez seu check-in diário hoje!" : "Registre sua presença diária e ganhe +40 XP"}
          >
            {hasCheckedInToday ? (
              <>
                <Check size={12} strokeWidth={3} /> Check-in Realizado
              </>
            ) : (
              <>
                <span>📅 Check-in Diário (+40 XP)</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* ================= PRIMARY DYNAMIC CANVAS CONTENT ================= */}
      <div className="flex-1 pr-1">
        <AnimatePresence mode="wait">
          
          {/* ================= VIEW 1: DUOLINGO PROGRESSION LEARNING PATHWAY ================= */}
          {filterMode === 'learning_path' && (
            <motion.div 
              key="view-learning-pathway"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              
              {/* LEFT COLUMN: Enrolled Courses Grid with Progress Bars */}
              <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-150 p-6 flex flex-col shadow-xs min-h-[500px]">
                
                {/* Header section */}
                <div className="w-full border-b border-slate-100 pb-4 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider">Meus Cursos Matriculados</span>
                    <h3 className="text-sm font-black text-slate-800 leading-tight">Painel de Estudo Ativo</h3>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 text-[10px] font-black uppercase text-slate-600 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                    <BookOpen size={12} className="text-blue-500" />
                    <span>{enrolledCourses.length} {enrolledCourses.length === 1 ? 'Curso' : 'Cursos'} em andamento</span>
                  </div>
                </div>

                {/* If no courses enrolled, show blank state prompt */}
                {enrolledCourses.length === 0 ? (
                  <div className="text-center py-24 max-w-sm mx-auto my-auto flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-4 shadow-xs">
                      <Bookmark size={28} />
                    </div>
                    <h3 className="font-extrabold text-slate-800 text-sm">Nenhum curso disponível</h3>
                    <p className="text-xs text-slate-400 mt-1">A coordenação da Pascom ainda não disponibilizou cursos no momento.</p>
                    <button 
                      onClick={() => onRefresh()}
                      className="mt-6 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition-all cursor-pointer active:scale-95"
                    >
                      Atualizar Página
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {enrolledCourses.map((course) => {
                      const isCompleted = course.progress >= 100;
                      
                      return (
                        <motion.div
                          key={`enrolled-course-${course.id}`}
                          whileHover={{ scale: 1.015, y: -2 }}
                          transition={{ duration: 0.2 }}
                          className="bg-slate-50/50 hover:bg-white rounded-2xl border border-slate-150 p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-all group duration-300 relative overflow-hidden hover:border-[#1b3a70]/30"
                        >
                          {/* Inner container */}
                          <div className="space-y-3.5">
                            {/* Course Thumbnail Image ("thumb") */}
                            <div className="relative h-36 rounded-xl overflow-hidden bg-slate-900 shadow-sm">
                              {course.thumbnail ? (
                                <img 
                                  src={course.thumbnail} 
                                  alt={course.title} 
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover opacity-90 group-hover:scale-103 transition-transform duration-500"
                                />
                              ) : (
                                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300">
                                  <BookOpen size={36} />
                                </div>
                              )}
                              
                              {/* Dark overlay at bottom for text contrast */}
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent pointer-events-none" />

                              {/* Category badge over thumb */}
                              <span className="absolute top-2.5 left-2.5 text-[8.5px] font-extrabold uppercase text-white tracking-wider bg-slate-950/70 backdrop-blur-xs px-2.5 py-1 rounded-md border border-white/10 shadow-sm">
                                {course.category}
                              </span>

                              {/* Completed Badge */}
                              {isCompleted && (
                                <span className="absolute top-2.5 right-2.5 bg-[#f1a80a] text-white text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-md shadow-sm flex items-center gap-1 border border-white/10">
                                  <Check size={10} strokeWidth={3} /> Concluído
                                </span>
                              )}
                            </div>

                            {/* Title & Info */}
                            <div className="space-y-1">
                              <h4 className="font-black text-xs text-slate-800 leading-snug group-hover:text-[#1b3a70] transition-colors line-clamp-2 min-h-[32px]">
                                {course.title}
                              </h4>
                              <span className="text-[10px] text-slate-400 font-bold block">
                                {course.lessonsCount} {course.lessonsCount === 1 ? 'aula disponível' : 'aulas disponíveis'}
                              </span>
                            </div>

                            {/* Progress bar ("barra com o progresso") */}
                            <div className="space-y-1.5 pt-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-400 font-bold">Progresso</span>
                                <span className="font-black text-slate-700">{course.progress}%</span>
                              </div>
                              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/50">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${course.progress}%` }}
                                  transition={{ duration: 0.8, ease: "easeOut" }}
                                  className={`h-full rounded-full bg-gradient-to-r from-[#1b3a70] to-[#f1a80a]`}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              onClick={() => onSelectCourse(course)}
                              className={`flex-1 text-[10px] font-black uppercase tracking-wider py-2.5 rounded-xl text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                                isCompleted
                                  ? 'bg-slate-100 text-[#1b3a70] hover:bg-slate-200'
                                  : 'bg-[#1b3a70] text-white hover:bg-[#152e5a]'
                              }`}
                            >
                              {isCompleted ? (
                                <>
                                  Rever Conteúdo <BookOpen size={11} />
                                </>
                              ) : course.progress > 0 ? (
                                <>
                                  Continuar Aula <Play size={10} fill="currentColor" />
                                </>
                              ) : (
                                <>
                                  Começar Estudo <Play size={10} fill="currentColor" />
                                </>
                              )}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: Daily Missions & Badges achievements list */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Missões Diárias Panel */}
                <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1b3a70] to-[#f1a80a]" />
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <div className="flex items-center gap-1.5">
                      <ListTodo size={14} className="text-[#1b3a70]" />
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Missões Diárias</h3>
                    </div>
                    <span className="text-[9px] font-black uppercase bg-[#1b3a70]/10 text-[#1b3a70] px-2 py-0.5 rounded-lg select-none">Hoje</span>
                  </div>

                  <div className="space-y-4">
                    {dailyMissions.map((mission) => {
                      const isClaimed = isMissionClaimed(mission.id);
                      const isComplete = mission.progress >= 100;

                      return (
                        <div key={mission.id} className="space-y-2 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                          <div className="flex items-start gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border text-xs shrink-0 ${mission.color}`}>
                              <mission.icon size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-[11.5px] font-black text-slate-850 leading-none">{mission.title}</h4>
                              <p className="text-[9.5px] font-semibold text-slate-450 leading-tight mt-1">{mission.desc}</p>
                            </div>
                          </div>

                          {/* Progress indicators */}
                          <div className="flex items-center justify-between gap-3 pt-1">
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                              <div 
                                className="bg-gradient-to-r from-[#1b3a70] to-[#f1a80a] h-1.5 rounded-full transition-all duration-700" 
                                style={{ width: `${mission.progress}%` }} 
                              />
                            </div>
                            
                            {isClaimed ? (
                              <span className="text-[9px] font-black uppercase text-emerald-500 flex items-center gap-0.5">
                                <Check size={10} strokeWidth={3} /> Resgatado
                              </span>
                            ) : isComplete ? (
                              <button
                                onClick={() => handleClaimReward(mission.id, mission.reward)}
                                className="bg-[#f1a80a] hover:bg-[#d49308] text-white font-black text-[9px] uppercase tracking-wider px-2 py-1 rounded-lg cursor-pointer shadow-sm active:scale-95"
                              >
                                Resgatar +{mission.reward} XP
                              </button>
                            ) : (
                              <span className="text-[8.5px] font-black uppercase text-slate-400">Pendente</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Badge Achievements Collection Panel */}
                <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1b3a70] to-[#f1a80a]" />
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Award size={14} className="text-[#1b3a70]" />
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Meus Selos e Conquistas</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'espiritualidade', name: 'Estrela da Fé', emoji: '🕊️', desc: 'Concluiu curso de espiritualidade Pasconera.', color: 'from-amber-400 to-yellow-500' },
                      { id: 'tecnico', name: 'Mestre das Mídias', emoji: '🛠️', desc: 'Concluiu módulo técnico da plataforma.', color: 'from-blue-500 to-indigo-600' },
                      { id: 'lideranca', name: 'Líder de Comunhão', emoji: '🧭', desc: 'Concluiu módulo de liderança.', color: 'from-purple-500 to-fuchsia-600' },
                      { id: 'geral', name: 'Zelo Apostólico', emoji: '📚', desc: 'Primeira aula concluída com sucesso.', color: 'from-emerald-500 to-teal-600' }
                    ].map((badge) => {
                      // Deterministic unlock conditions
                      const isUnlocked = badge.id === 'geral' || (badge.id === 'espiritualidade' && certificates.length > 0) || (badge.id === 'tecnico' && pathCompletedIds.size > 0);

                      return (
                        <div 
                          key={`achiev-badge-${badge.id}`}
                          className={`p-3 rounded-2xl border flex flex-col items-center text-center transition-all ${
                            isUnlocked 
                              ? 'bg-slate-50 border-slate-200/60 shadow-xs' 
                              : 'bg-white border-slate-100 opacity-60'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg select-none shadow-xs ${
                            isUnlocked ? `bg-gradient-to-br ${badge.color} text-white` : 'bg-slate-100 grayscale-100'
                          }`}>
                            {badge.emoji}
                          </div>
                          <h4 className="text-[10px] font-black text-slate-800 mt-2 truncate max-w-full leading-none">{badge.name}</h4>
                          <span className="text-[8px] font-semibold text-slate-400 mt-1 leading-tight line-clamp-2">{badge.desc}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Diocesan Leaderboard Friendly Emulation Block */}
                <div className="bg-white rounded-3xl border border-slate-150 p-5 shadow-xs relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#1b3a70] to-[#f1a80a]" />
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Trophy size={14} className="text-[#1b3a70]" />
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Ranking</h3>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1 scrollbar-thin">
                    {leaderboard.slice(0, 4).map((row, index) => {
                      const isCurrent = row.userId === currentUser.id;
                      return (
                        <div 
                          key={`lead-rank-${row.userId}`}
                          className={`flex items-center justify-between p-2 rounded-xl border text-[11px] font-bold transition-all ${
                            isCurrent 
                              ? 'bg-[#f1a80a]/10 border-[#f1a80a]/40 shadow-xs text-[#1b3a70]' 
                              : 'bg-white border-slate-100 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {index === 0 ? (
                              <span className="text-sm select-none">🥇</span>
                            ) : index === 1 ? (
                              <span className="text-sm select-none">🥈</span>
                            ) : index === 2 ? (
                              <span className="text-sm select-none">🥉</span>
                            ) : (
                              <span className="w-4 text-center text-[9px] font-black text-slate-400">#{index + 1}</span>
                            )}

                            {/* Avatar or Placeholder */}
                            <div className="w-5 h-5 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200/50">
                              {row.userAvatar ? (
                                <img referrerPolicy="no-referrer" src={row.userAvatar} alt={row.userName} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-500 text-[8px] font-black">
                                  {row.userName.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <span className={`truncate leading-none ${isCurrent ? 'text-[#1b3a70] font-black' : 'text-slate-700 font-extrabold'}`}>
                              {row.userName} {isCurrent && <span className="text-[7.5px] bg-[#f1a80a]/20 text-[#1b3a70] px-1.5 py-0.5 rounded font-black ml-1 uppercase">Você</span>}
                            </span>
                          </div>

                          <span className="text-slate-700 font-extrabold text-[10px] font-mono shrink-0 select-none">{row.xp} XP</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

            </motion.div>
          )}



          {/* ================= VIEW 3: HISTORIC ACADEMICO ================= */}
          {filterMode === 'history' && (
            <motion.div 
              key="view-academic-history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white border border-slate-150 rounded-2xl overflow-hidden shadow-xs"
            >
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 font-black text-slate-400 uppercase tracking-wider text-[8px]">
                    <th className="p-3">Avaliação / Prova</th>
                    <th className="p-3">Curso Relacionado</th>
                    <th className="p-3 text-center">Tentativa</th>
                    <th className="p-3 text-center">Aproveitamento</th>
                    <th className="p-3">Aprovação</th>
                    <th className="p-3">Feedback do Instrutor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {attempts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 italic">Você não realizou nenhuma avaliação até o momento.</td>
                    </tr>
                  ) : (
                    attempts.map((att) => {
                      const matchedQuiz = quizzes.find(q => q.id === att.quizId);
                      const matchedCourse = courses.find(c => c.id === matchedQuiz?.courseId);
                      const passed = matchedQuiz ? att.score >= matchedQuiz.passingGrade : true;

                      return (
                        <tr key={att.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-black text-slate-800">{matchedQuiz?.title || 'Avaliação Acadêmica'}</td>
                          <td className="p-3 text-slate-500">{matchedCourse?.title || 'Curso Integrado'}</td>
                          <td className="p-3 text-center font-mono text-[9px]">{new Date(att.submittedAt || '').toLocaleDateString('pt-BR')}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-black ${
                              !att.manualGraded ? 'bg-[#ffc107]/10 text-amber-600' :
                              passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                            }`}>
                              {!att.manualGraded ? 'Corrigindo...' : `${att.score}%`}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500">Mínimo {matchedQuiz?.passingGrade || 70}%</td>
                          <td className="p-3 text-slate-450 italic max-w-sm truncate" title={att.feedback}>{att.feedback || '(Sem comentários)'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </motion.div>
          )}

          {/* ================= VIEW 4: CERTIFICADOS ================= */}
          {filterMode === 'certificates' && (
            <motion.div 
              key="view-certificates-wallet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {certificates.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-150 shadow-xs max-w-sm mx-auto">
                  <Award className="text-slate-200 mx-auto mb-2.5" size={40} />
                  <h3 className="font-extrabold text-slate-800 text-sm">Nenhum diploma disponível</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">Conclua todas as etapas e atinja aprovação nas provas finais do ambiente de estudos para liberar certificados emitidos oficialmente.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {certificates.map((cert) => (
                    <div key={cert.id} className="p-4 bg-white rounded-2xl border border-slate-150 border-l-4 border-l-[#f1a80a] flex justify-between items-center shadow-xs hover:border-slate-250 transition-all hover:shadow-md">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Award className="text-[#1b3a70]" size={13} />
                          <span className="text-[8px] uppercase font-black text-slate-400">Certificado Autenticado</span>
                        </div>
                        <h4 className="font-extrabold text-slate-800 text-xs leading-snug">{cert.courseTitle}</h4>
                        <p className="text-[9px] text-slate-450 font-mono mt-0.5">Carga Horária: {cert.courseHours}h • ID: {cert.id.substring(0, 14)}...</p>
                      </div>
                      <button
                        onClick={() => onViewCertificate(cert)}
                        className="bg-[#1b3a70] hover:bg-[#152e5a] text-white p-2 px-3 rounded-xl shadow-xs transition-all text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer select-none shrink-0"
                      >
                        Ver <FileDown size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
};
