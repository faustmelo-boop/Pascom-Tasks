import { supabase } from './supabaseClient';
import { 
  LMSModule, LMSQuiz, LMSQuestion, LMSQuizAttempt, 
  LMSCertificate, LMSEnrollment, LMSCategory, LMSMaterial,
  LMSForumPost, LMSForumReply, LMSLessonComment, LMSCalendarEvent, 
  LMSMessage, LMSLeaderboardRow, LMSBadge
} from './lmsTypes';
import { Lesson } from './types';

const IS_MOCK_ENABLED_BY_DEFAULT = true;

// Helper to interact with LocalStorage as a local database fallback
const getLocalDB = (key: string, defaultValue: any): any => {
  const stored = localStorage.getItem(`lms_db_${key}`);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
};

const setLocalDB = (key: string, data: any) => {
  localStorage.setItem(`lms_db_${key}`, JSON.stringify(data));
};

const mapDbCertificateToCamel = (dbCert: any): LMSCertificate => {
  if (!dbCert) return dbCert;
  return {
    id: dbCert.id,
    courseId: dbCert.course_id || dbCert.courseId,
    courseTitle: dbCert.course_title || dbCert.courseTitle,
    userId: dbCert.user_id || dbCert.userId,
    userName: dbCert.user_name || dbCert.userName,
    issuedAt: dbCert.issued_at || dbCert.issuedAt,
    courseHours: Number(dbCert.course_hours !== undefined ? dbCert.course_hours : dbCert.courseHours),
    directorName: dbCert.director_name || dbCert.directorName,
    templateId: dbCert.template_id || dbCert.templateId || 'classic',
    stampUrl: dbCert.stamp_url || dbCert.stampUrl,
    qrCodeText: dbCert.qr_code_text || dbCert.qrCodeText,
  };
};

const mapCamelCertificateToDb = (cert: LMSCertificate) => {
  if (!cert) return cert;
  return {
    id: cert.id,
    course_id: cert.courseId,
    course_title: cert.courseTitle,
    user_id: cert.userId,
    user_name: cert.userName,
    issued_at: cert.issuedAt,
    course_hours: cert.courseHours,
    director_name: cert.directorName,
    template_id: cert.templateId,
    stamp_url: cert.stampUrl,
    qr_code_text: cert.qrCodeText,
  };
};

// Seed initial high-quality mock data for courses, modules, exams, questions, certificates and enrollments
const seedInitialData = () => {
  // 1. Initial Categories
  if (!localStorage.getItem('lms_db_categories')) {
    const defaultCategories: LMSCategory[] = [
      { id: 'espiritualidade', name: 'Espiritualidade', description: 'Cursos voltados ao crescimento espiritual do comunicador' },
      { id: 'tecnico', name: 'Técnico', description: 'Capacitação prática em fotografia, áudio, design e mídias' },
      { id: 'lideranca', name: 'Liderança', description: 'Gestão de equipes pastorais e planejamento estratégico' },
      { id: 'geral', name: 'Geral', description: 'Temas gerais e formação de introdução' }
    ];
    setLocalDB('categories', defaultCategories);
  }

  // 2. Initial Modules
  if (!localStorage.getItem('lms_db_modules')) {
    // We create modules for various course IDs. Since course IDs are dynamic, we will map them dynamically, but we also create static ones.
    const defaultModules: LMSModule[] = [
      { id: 'mod-1-intro', courseId: 'c1', title: 'Módulo 1: Fundamentos da Pastoral de Comunicação', description: 'Breve teologia e objetivos principais da comissão de comunicação.', orderIndex: 1, createdAt: new Date().toISOString() },
      { id: 'mod-1-tech', courseId: 'c1', title: 'Módulo 2: Canais e Práticas de Transmissão', description: 'Gerenciamento de canais digitais, redes sociais e transmissões litúrgicas.', orderIndex: 2, createdAt: new Date().toISOString() },
      { id: 'mod-2-esp', courseId: 'c2', title: 'Módulo 1: Espiritualidade do Comunicador Pasconista', description: 'Ser comunicador antes de fazer comunicação nas missas.', orderIndex: 1, createdAt: new Date().toISOString() },
      { id: 'mod-3-foto', courseId: 'c3', title: 'Módulo 1: Fundamentos da Fotografia Litúrgica', description: 'Teoria da exposição, ISO, diafragma e encoquadramentos sagrados.', orderIndex: 1, createdAt: new Date().toISOString() },
      { id: 'mod-3-edicao', courseId: 'c3', title: 'Módulo 2: Fluxo de Revelação e Tratamento de Imagem', description: 'Uso do Adobe Lightroom e tratamento focado em liturgia.', orderIndex: 2, createdAt: new Date().toISOString() },
    ];
    setLocalDB('modules', defaultModules);
  }

  // 3. Initial Quizzes
  if (!localStorage.getItem('lms_db_quizzes')) {
    const defaultQuizzes: LMSQuiz[] = [
      {
        id: 'quiz-fundamentos',
        courseId: 'all', // Dynamic matching fallback in the UI
        title: 'Avaliação Final: Fundamentos Técnicos e Pastorais',
        description: 'Exame abrangente contendo perguntas objetivas, verdadeiro ou falso e discursivas para atestar seu conhecimento técnico e eclesial de comunicador.',
        timeLimitMins: 15,
        maxAttempts: 3,
        passingGrade: 70,
        randomizeQuestions: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'quiz-fotografia',
        courseId: 'c3',
        title: 'Prova Prática e Teórica de Fotografia Litúrgica',
        description: 'Questionário sobre técnicas de fotometria e regras de comportamento no presbitério durante celebrações litúrgicas.',
        timeLimitMins: 10,
        maxAttempts: 2,
        passingGrade: 75,
        randomizeQuestions: false,
        createdAt: new Date().toISOString()
      }
    ];
    setLocalDB('quizzes', defaultQuizzes);
  }

  // 4. Initial Questions linked to Quizzes (Question Bank)
  if (!localStorage.getItem('lms_db_questions')) {
    const defaultQuestions: LMSQuestion[] = [
      // Questions for Foundations / General quiz
      {
        id: 'q1-1',
        courseId: 'all',
        quizId: 'quiz-fundamentos',
        type: 'multiple_choice',
        questionText: 'Qual das alternativas abaixo melhor representa o documento oficial da Igreja sobre Meios de Comunicação Social?',
        options: [
          'Inter Mirifica (Concílio Vaticano II)',
          'Fratelli Tutti (Papa Francisco)',
          'Gaudium et Spes',
          'Sacrosanctum Concilium'
        ],
        correctAnswer: 'A',
        points: 20,
        feedback: 'O decreto Inter Mirifica é o documento conciliar sobre os meios de comunicação.'
      },
      {
        id: 'q1-2',
        courseId: 'all',
        quizId: 'quiz-fundamentos',
        type: 'true_false',
        questionText: 'A Pascom deve atuar de forma isolada do restante das pastorais da paróquia, pois possui autonomia técnica própria.',
        correctAnswer: 'F',
        points: 20,
        feedback: 'Falso. A Pascom é essencialmente uma pastoral de comunhão e integração, devendo agir transversalmente e em sintonia com todas as pastorais da paróquia.'
      },
      {
        id: 'q1-3',
        courseId: 'all',
        quizId: 'quiz-fundamentos',
        type: 'multiple_choice',
        questionText: 'Quais são os quatro pilares oficiais da Pascom descritos nas diretrizes da CNBB?',
        options: [
          'Fotografia, Transmissão, Redação e Redes Sociais',
          'Formação, Articulação, Produção e Espiritualidade',
          'Dizimo, Catequese, Liturgia e Eventos',
          'Projeção, Design, Som e Divulgação'
        ],
        correctAnswer: 'B',
        points: 20,
        feedback: 'Os quatro pilares oficiais são: Formação, Articulação, Produção e Espiritualidade (F.A.P.E).'
      },
      {
        id: 'q1-4',
        courseId: 'all',
        quizId: 'quiz-fundamentos',
        type: 'discursive',
        questionText: 'Em suas palavras, explique a importância do pilar da "Espiritualidade" para o comunicador pasconista e dê um exemplo de como vivenciá-lo na prática pastoral.',
        correctAnswer: 'O aluno deve argumentar que o fazer comunicativo decorre do ser cristão. Exemplos válidos: oração em equipe antes das missas, retiros pastorais, comunhão ativa.',
        points: 40,
        feedback: 'Critério de correção: o aluno deve pontuar a primazia do ser comunicador sobre o fazer técnico e citar dinâmicas litúrgicas ou oracionais.'
      },
      
      // Questions for Fotografia Liturgica Exam
      {
        id: 'q2-1',
        courseId: 'c3',
        quizId: 'quiz-fotografia',
        type: 'multiple_choice',
        questionText: 'Durante o momento da Conagração Eucarística na Missa, qual o comportamento fotográfico mais adequado?',
        options: [
          'Subir ao presbitério e posicionar-se ao lado do Padre para registrar a hóstia de frente, usando flash.',
          'Permanecer em local discreto abaixo do presbitério, sem uso de flash, em silêncio respeitoso.',
          'Pedir para o padre pausar a elevação para posar para uma foto panorâmica.',
          'Circular livremente entre os coroinhas para obter ângulos inusitados.'
        ],
        correctAnswer: 'B',
        points: 30,
        feedback: 'O respeito litúrgico impede o uso de flashes e circulação invasiva, especialmente no presbitério durante a Consagração.'
      },
      {
        id: 'q2-2',
        courseId: 'c3',
        quizId: 'quiz-fotografia',
        type: 'true_false',
        questionText: 'A fotometria é controlada fundamentalmente pela combinação de três variáveis: Abertura do Diafragma, Velocidade do Obturador e Sensibilidade ISO.',
        correctAnswer: 'V',
        points: 30,
        feedback: 'Verdadeiro. Esse é o tradicional "Triângulo de Exposição" da fotografia manual.'
      },
      {
        id: 'q2-3',
        courseId: 'c3',
        quizId: 'quiz-fotografia',
        type: 'discursive',
        questionText: 'Como você resolveria um problema de iluminação em uma igreja escura durante uma missa noturna se não pudesse usar o flash de forma alguma?',
        correctAnswer: 'O aluno deve sugerir aumentar o ISO de forma aceitável (evitando ruído extremo), abrir o diafragma da lente ao máximo (f/1.8 ou f/2.8) e reduzir a velocidade para limites seguros (ex: 1/125s), ou usar lentes mais claras.',
        points: 40,
        feedback: 'Critérios: menção ao tripé de exposição ajustando abertura máxima, velocidade mínima aceitável sem tremer e ISO alto.'
      }
    ];
    setLocalDB('questions', defaultQuestions);
  }

  // 5. Initial Enrollments
  if (!localStorage.getItem('lms_db_enrollments')) {
    const defaultEnrollments: LMSEnrollment[] = [
      { id: 'enr-1', courseId: 'c1', userId: 'user-sample-1', userName: 'João Silva', userEmail: 'joao@silva.com', enrolledAt: new Date().toISOString(), status: 'active' },
      { id: 'enr-2', courseId: 'c1', userId: 'user-sample-2', userName: 'Maria Santos', userEmail: 'maria@santos.com', enrolledAt: new Date().toISOString(), status: 'completed' },
      { id: 'enr-3', courseId: 'c3', userId: 'user-sample-1', userName: 'João Silva', userEmail: 'joao@silva.com', enrolledAt: new Date().toISOString(), status: 'active' },
    ];
    setLocalDB('enrollments', defaultEnrollments);
  }

  // 6. Initial Quiz Attempts
  if (!localStorage.getItem('lms_db_attempts')) {
    const defaultAttempts: LMSQuizAttempt[] = [
      {
        id: 'att-1',
        quizId: 'quiz-fundamentos',
        userId: 'user-sample-2',
        userName: 'Maria Santos',
        userAvatar: 'https://ui-avatars.com/api/?name=Maria+Santos&background=fdb615&color=fff',
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        submittedAt: new Date(Date.now() - 3000000).toISOString(),
        answers: {
          'q1-1': 'A',
          'q1-2': 'F',
          'q1-3': 'B',
          'q1-4': 'A espiritualidade é a alma de toda atividade pasconista. Não somos apenas operadores de equipamentos de câmera ou redes sociais, mas evangelizadores de mídias. Vivenciar significa rezar juntos antes dos eventos e cultivar a oração pessoal constante.'
        },
        grades: {
          'q1-1': 20,
          'q1-2': 20,
          'q1-3': 20,
          'q1-4': 35
        },
        score: 95,
        maxScore: 100,
        manualGraded: true,
        feedback: 'Excelente reflexão no pilar da espiritualidade, Maria! Parabéns pela excelente pontuação na prova final.',
        status: 'graded'
      },
      {
        id: 'att-2',
        quizId: 'quiz-fundamentos',
        userId: 'user-sample-1',
        userName: 'João Silva',
        userAvatar: 'https://ui-avatars.com/api/?name=Joao+Silva&background=007cba&color=fff',
        startedAt: new Date(Date.now() - 1800000).toISOString(),
        submittedAt: new Date(Date.now() - 1200000).toISOString(),
        answers: {
          'q1-1': 'A',
          'q1-2': 'V', // Wrong answer
          'q1-3': 'B',
          'q1-4': '' // Left empty
        },
        grades: {
          'q1-1': 20,
          'q1-2': 0,
          'q1-3': 20,
          'q1-4': 0
        },
        score: 40,
        maxScore: 100,
        manualGraded: true,
        feedback: 'João, você errou o pilar sobre a integração conjunta com as outras pastorais e deixou a discursiva em branco. Dica de estudo: revise o pilar da Articulação.',
        status: 'graded'
      }
    ];
    setLocalDB('attempts', defaultAttempts);
  }

  // 7. Initial Certificates
  if (!localStorage.getItem('lms_db_certificates')) {
    const defaultCertificates: LMSCertificate[] = [
      {
        id: 'cert-vld-8849-cbeb-4b2a',
        courseId: 'c1',
        courseTitle: 'Diretrizes CNBB para a Pascom',
        userId: 'user-sample-2',
        userName: 'Maria Santos',
        issuedAt: new Date(Date.now() - 3000000).toISOString(),
        courseHours: 30,
        directorName: 'Pe. Francisco José',
        templateId: 'modern',
        stampUrl: 'https://i.imgur.com/ofoiwCd.png'
      }
    ];
    setLocalDB('certificates', defaultCertificates);
  }

  // 8. Initial Course Materials (Downloads)
  if (!localStorage.getItem('lms_db_materials')) {
    const defaultMaterials: LMSMaterial[] = [
      { id: 'mat-1', courseId: 'c1', title: 'Diretrizes CNBB - Documento 99.pdf', type: 'pdf', url: 'https://www.cnbb.org.br/documento99', size: '2.4 MB', createdAt: new Date().toISOString() },
      { id: 'mat-2', courseId: 'c1', title: 'Manual de Redação Pastoral.pdf', type: 'pdf', url: 'https://www.cnbb.org.br/manual_redacao', size: '1.1 MB', createdAt: new Date().toISOString() },
      { id: 'mat-3', courseId: 'c3', title: 'Guia Rápido de Configuração Manual Canon/Nikon', type: 'link', url: 'https://dpreviews.com/manual-configs', createdAt: new Date().toISOString() },
    ];
    setLocalDB('materials', defaultMaterials);
  }

  // 9. Initial Course Lessons
  if (!localStorage.getItem('lms_db_lessons')) {
    const defaultLessons = [
      { id: '101', courseId: 'c1', title: 'Aula 1: A vocação do comunicador eclesial', duration: '12:00', description: 'Nesta introdução, Pe. Francisco detalha a essência do comunicador na comunidade, enfatizando que anunciar Jesus Cristo antes de posicionar tripés ou operar consoles de áudio.', videoUrl: 'https://www.youtube.com/watch?v=N4Tf_Z-rE3E', orderIndex: 1 },
      { id: '102', courseId: 'c1', title: 'Aula 2: Os pilares CNBB Formação e Espiritualidade', duration: '18:00', description: 'Uma análise cuidadosa sobre a estrutura CNBB. O objetivo é compreender que a formação litúrgica e a espiritualidade ativa são indissociáveis do fazer técnico da equipe.', videoUrl: 'https://www.youtube.com/watch?v=Fst6z5lZk8s', orderIndex: 2 },
      { id: '103', courseId: 'c1', title: 'Aula 3: Desafios práticos de articulação nas mídias', duration: '15:20', description: 'Como engajar agentes da pastoral, resolver conflitos comuns de redes sociais e promover a sinergia respeitando as nuances litúrgicas de cada ministério.', videoUrl: 'https://www.youtube.com/watch?v=G7z58NfK8fQ', orderIndex: 3 },
      { id: '201', courseId: 'c2', title: 'Aula 1: Teologia e Missão do Ministério da Palavra', duration: '14:00', description: 'Aprofundamento sobre a proclamação fiel das leituras sagradas na celebração da missa.', videoUrl: 'https://www.youtube.com/watch?v=P_i-C5m9Snc', orderIndex: 1 },
      { id: '301', courseId: 'c3', title: 'Aula 1: O Triângulo de Exposição fotográfica', duration: '14:30', description: 'Visão teórica sobre abertura (f-stop), velocidade do obturador (shutter speed) e ISO. Como fotometrar mantendo o silêncio litúrgico absoluto.', videoUrl: 'https://www.youtube.com/watch?v=3g8K91e70eM', orderIndex: 1 },
      { id: '302', courseId: 'c3', title: 'Aula 2: Regras de Enquadramento e Luz no Altar', duration: '20:10', description: 'Entenda pontos de interesse áureo e como trabalhar com contraluz natural proveniente das sacristias e vitrais da nave.', videoUrl: 'https://www.youtube.com/watch?v=hU-OidrU0rQ', orderIndex: 2 },
    ];
    setLocalDB('lessons', defaultLessons);
  }
};

// Auto Seed on Load
seedInitialData();

export const lmsService = {
  // ================= MODULES =================
  fetchModules: async (courseId: string): Promise<LMSModule[]> => {
    try {
      const { data, error } = await supabase
        .from('lms_modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      
      const deletedModules: string[] = getLocalDB('deleted_modules', []);
      const activeData = (data || []).filter((m: any) => !deletedModules.includes(m.id));

      if (activeData && activeData.length > 0) {
        const localMods: LMSModule[] = getLocalDB('modules', []);
        return activeData.map((m: any) => {
          const local = localMods.find(lm => lm.id === m.id);
          return local ? { ...m, ...local } : m;
        });
      }
      throw new Error("No modules found in database");
    } catch {
      const all: LMSModule[] = getLocalDB('modules', []);
      const deletedModules: string[] = getLocalDB('deleted_modules', []);
      return all.filter(m => (m.courseId === courseId || m.courseId === 'all') && !deletedModules.includes(m.id));
    }
  },

  saveModule: async (module: LMSModule): Promise<LMSModule> => {
    // Remove from deleted tracker if re-saved
    const deletedModules: string[] = getLocalDB('deleted_modules', []);
    if (deletedModules.includes(module.id)) {
      setLocalDB('deleted_modules', deletedModules.filter(id => id !== module.id));
    }

    // Always persist to LocalDB immediately for seamless offline/fallback operations
    const all: LMSModule[] = getLocalDB('modules', []);
    const idx = all.findIndex(m => m.id === module.id);
    if (idx !== -1) all[idx] = module;
    else all.push(module);
    setLocalDB('modules', all);

    try {
      const { data, error } = await supabase.from('lms_modules').upsert([module]).select();
      if (error) throw error;
      return data[0] || module;
    } catch {
      return module;
    }
  },

  deleteModule: async (moduleId: string): Promise<boolean> => {
    // Always delete from localDB immediately
    const all: LMSModule[] = getLocalDB('modules', []);
    const filtered = all.filter(m => m.id !== moduleId);
    setLocalDB('modules', filtered);

    // Track as deleted locally
    const deletedList: string[] = getLocalDB('deleted_modules', []);
    if (!deletedList.includes(moduleId)) {
      deletedList.push(moduleId);
      setLocalDB('deleted_modules', deletedList);
    }

    try {
      const { error } = await supabase.from('lms_modules').delete().eq('id', moduleId);
      if (error) throw error;
      return true;
    } catch {
      return true;
    }
  },

  // ================= QUIZZES =================
  fetchQuizzes: async (courseId: string): Promise<LMSQuiz[]> => {
    try {
      const { data, error } = await supabase
        .from('lms_quizzes')
        .select('*')
        .eq('course_id', courseId);
      if (error) throw error;
      
      const deletedQuizzes: string[] = getLocalDB('deleted_quizzes', []);
      const activeData = (data || []).filter((q: any) => !deletedQuizzes.includes(q.id));

      if (activeData && activeData.length > 0) {
        // Merge with local changes to guarantee that any local edits are preserved!
        const localQuizzes: LMSQuiz[] = getLocalDB('quizzes', []);
        return activeData.map((q: any) => {
          const local = localQuizzes.find(lq => lq.id === q.id);
          return local ? { ...q, ...local } : q;
        });
      }
      throw new Error("No quizzes found in database");
    } catch {
      const all: LMSQuiz[] = getLocalDB('quizzes', []);
      const deletedQuizzes: string[] = getLocalDB('deleted_quizzes', []);
      return all.filter(q => (q.courseId === courseId || q.courseId === 'all') && !deletedQuizzes.includes(q.id));
    }
  },

  saveQuiz: async (quiz: LMSQuiz): Promise<LMSQuiz> => {
    // Remove from deleted tracker if re-saved
    const deletedQuizzes: string[] = getLocalDB('deleted_quizzes', []);
    if (deletedQuizzes.includes(quiz.id)) {
      setLocalDB('deleted_quizzes', deletedQuizzes.filter(id => id !== quiz.id));
    }

    // Always persist to local fallback first
    const all: LMSQuiz[] = getLocalDB('quizzes', []);
    const idx = all.findIndex(q => q.id === quiz.id);
    if (idx !== -1) all[idx] = quiz;
    else all.push(quiz);
    setLocalDB('quizzes', all);

    try {
      const { data, error } = await supabase.from('lms_quizzes').upsert([quiz]).select();
      if (error) throw error;
      return data[0] || quiz;
    } catch {
      return quiz;
    }
  },

  deleteQuiz: async (quizId: string): Promise<boolean> => {
    // 1. Always delete from LocalDB first
    const all: LMSQuiz[] = getLocalDB('quizzes', []);
    const filtered = all.filter(q => q.id !== quizId);
    setLocalDB('quizzes', filtered);

    // Track as deleted locally
    const deletedList: string[] = getLocalDB('deleted_quizzes', []);
    if (!deletedList.includes(quizId)) {
      deletedList.push(quizId);
      setLocalDB('deleted_quizzes', deletedList);
    }
    
    // Cascade delete questions in localDB
    const qs: LMSQuestion[] = getLocalDB('questions', []);
    const qsFiltered = qs.filter(q => q.quizId !== quizId);
    setLocalDB('questions', qsFiltered);

    // Flag all deleted quiz questions as locally deleted
    const deletedQuestions: string[] = getLocalDB('deleted_questions', []);
    const quizQuestions = qs.filter(q => q.quizId === quizId);
    quizQuestions.forEach(q => {
      if (!deletedQuestions.includes(q.id)) {
        deletedQuestions.push(q.id);
      }
    });
    setLocalDB('deleted_questions', deletedQuestions);

    // Clear prerequisite reference in other local quizzes and lessons
    const localLessons: Lesson[] = getLocalDB('lessons', []);
    let updatedLocalLessons = false;
    localLessons.forEach(l => {
      if (l.prerequisiteId === quizId) {
        l.prerequisiteId = undefined;
        updatedLocalLessons = true;
      }
    });
    if (updatedLocalLessons) {
      setLocalDB('lessons', localLessons);
    }

    const localQuizzes: LMSQuiz[] = getLocalDB('quizzes', []);
    let updatedLocalQuizzes = false;
    localQuizzes.forEach(q => {
      if (q.prerequisiteId === quizId) {
        q.prerequisiteId = undefined;
        updatedLocalQuizzes = true;
      }
    });
    if (updatedLocalQuizzes) {
      setLocalDB('quizzes', localQuizzes);
    }

    try {
      // 2. Cascade delete dependent elements in Supabase to avoid SQL key constraint issues
      const resQuestions = await supabase.from('lms_questions').delete().eq('quiz_id', quizId);
      if (resQuestions.error && resQuestions.error.code !== 'PGRST205') {
        console.warn('Could not cascade delete questions from Supabase', resQuestions.error);
      }

      const resQuizAttempts = await supabase.from('lms_quiz_attempts').delete().eq('quiz_id', quizId);
      if (resQuizAttempts.error && resQuizAttempts.error.code !== 'PGRST205') {
        console.warn('Could not cascade delete quiz attempts from Supabase', resQuizAttempts.error);
      }

      const resAttempts = await supabase.from('lms_attempts').delete().eq('quiz_id', quizId);
      if (resAttempts.error && resAttempts.error.code !== 'PGRST205') {
        console.warn('Could not cascade delete attempts from Supabase', resAttempts.error);
      }

      // Clear any prerequisite references in supabase lessons and quizzes
      await supabase.from('lessons').update({ prerequisite_id: null }).eq('prerequisite_id', quizId);
      await supabase.from('lms_quizzes').update({ prerequisite_id: null }).eq('prerequisite_id', quizId);

      // Finally delete the quiz table entry itself
      const { error } = await supabase.from('lms_quizzes').delete().eq('id', quizId);
      if (error) throw error;
      return true;
    } catch (e: any) {
      if (e && e.code === 'PGRST205') {
        console.info('A tabela lms_quizzes não existe no banco de dados Supabase. Questionário excluído localmente com sucesso (LocalDB fallback).');
      } else {
        console.error('Error during Supabase deleteQuiz, using local state-only deletion success', e);
      }
      return true;
    }
  },

  // ================= QUESTIONS =================
  fetchQuestions: async (courseId: string, quizId?: string): Promise<LMSQuestion[]> => {
    try {
      let query = supabase.from('lms_questions').select('*').eq('course_id', courseId);
      if (quizId) query = query.eq('quiz_id', quizId);
      const { data, error } = await query;
      if (error) throw error;
      
      const deletedQuestions: string[] = getLocalDB('deleted_questions', []);
      const activeData = (data || []).filter((q: any) => !deletedQuestions.includes(q.id));

      if (activeData && activeData.length > 0) {
        // Merge with local changes
        const localQuestions: LMSQuestion[] = getLocalDB('questions', []);
        return activeData.map((q: any) => {
          const local = localQuestions.find(lq => lq.id === q.id);
          return local ? { ...q, ...local } : q;
        });
      }
      throw new Error("No questions found in database");
    } catch {
      const all: LMSQuestion[] = getLocalDB('questions', []);
      const deletedQuestions: string[] = getLocalDB('deleted_questions', []);
      return all.filter(q => {
        const matchesCourse = q.courseId === courseId || q.courseId === 'all';
        const matchesQuiz = quizId ? q.quizId === quizId : true;
        return matchesCourse && matchesQuiz && !deletedQuestions.includes(q.id);
      });
    }
  },

  saveQuestion: async (question: LMSQuestion): Promise<LMSQuestion> => {
    // Remove from deleted tracker if re-saved
    const deletedQuestions: string[] = getLocalDB('deleted_questions', []);
    if (deletedQuestions.includes(question.id)) {
      setLocalDB('deleted_questions', deletedQuestions.filter(id => id !== question.id));
    }

    // Always persist to local fallback first
    const all: LMSQuestion[] = getLocalDB('questions', []);
    const idx = all.findIndex(q => q.id === question.id);
    if (idx !== -1) all[idx] = question;
    else all.push(question);
    setLocalDB('questions', all);

    try {
      const { data, error } = await supabase.from('lms_questions').upsert([question]).select();
      if (error) throw error;
      return data[0] || question;
    } catch {
      return question;
    }
  },

  deleteQuestion: async (questionId: string): Promise<boolean> => {
    // Always delete from localDB first
    const all: LMSQuestion[] = getLocalDB('questions', []);
    const filtered = all.filter(q => q.id !== questionId);
    setLocalDB('questions', filtered);

    // Track as deleted locally
    const deletedList: string[] = getLocalDB('deleted_questions', []);
    if (!deletedList.includes(questionId)) {
      deletedList.push(questionId);
      setLocalDB('deleted_questions', deletedList);
    }

    try {
      const { error } = await supabase.from('lms_questions').delete().eq('id', questionId);
      if (error) throw error;
      return true;
    } catch {
      return true;
    }
  },

  // ================= ATTEMPTS =================
  fetchQuizAttempts: async (quizId: string): Promise<LMSQuizAttempt[]> => {
    try {
      const { data, error } = await supabase.from('lms_quiz_attempts').select('*').eq('quiz_id', quizId);
      if (error) throw error;
      return data || [];
    } catch {
      const all: LMSQuizAttempt[] = getLocalDB('attempts', []);
      return all.filter(a => a.quizId === quizId);
    }
  },

  fetchAllAttempts: async (): Promise<LMSQuizAttempt[]> => {
    try {
      const { data, error } = await supabase.from('lms_quiz_attempts').select('*');
      if (error) throw error;
      return data || [];
    } catch {
      return getLocalDB('attempts', []);
    }
  },

  fetchUserAttempts: async (quizId: string, userId: string): Promise<LMSQuizAttempt[]> => {
    try {
      const { data, error } = await supabase
        .from('lms_quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('user_id', userId);
      if (error) throw error;
      return data || [];
    } catch {
      const all: LMSQuizAttempt[] = getLocalDB('attempts', []);
      return all.filter(a => a.quizId === quizId && a.userId === userId);
    }
  },

  saveAttempt: async (attempt: LMSQuizAttempt): Promise<LMSQuizAttempt> => {
    try {
      const { data, error } = await supabase.from('lms_quiz_attempts').upsert([attempt]).select();
      if (error) throw error;
      return data[0];
    } catch {
      const all: LMSQuizAttempt[] = getLocalDB('attempts', []);
      const idx = all.findIndex(a => a.id === attempt.id);
      if (idx !== -1) all[idx] = attempt;
      else all.push(attempt);
      setLocalDB('attempts', all);
      return attempt;
    }
  },

  // ================= CERTIFICATES =================
  fetchCertificates: async (userId: string): Promise<LMSCertificate[]> => {
    try {
      const { data, error } = await supabase.from('lms_certificates').select('*').eq('user_id', userId);
      if (error) throw error;
      return (data || []).map(mapDbCertificateToCamel);
    } catch {
      const all: LMSCertificate[] = getLocalDB('certificates', []);
      return all.filter(c => c.userId === userId).map(mapDbCertificateToCamel);
    }
  },

  fetchAllCertificates: async (): Promise<LMSCertificate[]> => {
    try {
      const { data, error } = await supabase.from('lms_certificates').select('*');
      if (error) throw error;
      return (data || []).map(mapDbCertificateToCamel);
    } catch {
      return getLocalDB('certificates', []).map(mapDbCertificateToCamel);
    }
  },

  fetchCertificateByCode: async (code: string): Promise<LMSCertificate | null> => {
    try {
      const { data, error } = await supabase.from('lms_certificates').select('*').eq('id', code).single();
      if (error) throw error;
      return mapDbCertificateToCamel(data);
    } catch {
      const all: LMSCertificate[] = getLocalDB('certificates', []);
      const val = all.find(c => c.id.toLowerCase() === code.trim().toLowerCase());
      return val ? mapDbCertificateToCamel(val) : null;
    }
  },

  saveCertificate: async (certificate: LMSCertificate): Promise<LMSCertificate> => {
    try {
      const dbPayload = mapCamelCertificateToDb(certificate);
      const { data, error } = await supabase.from('lms_certificates').upsert([dbPayload]).select();
      if (error) throw error;
      return mapDbCertificateToCamel(data[0]);
    } catch {
      const all: LMSCertificate[] = getLocalDB('certificates', []);
      const idx = all.findIndex(c => c.id === certificate.id);
      if (idx !== -1) all[idx] = certificate;
      else all.push(certificate);
      setLocalDB('certificates', all);
      
      // Auto register to system alerts/notifications
      try {
        supabase.from('notifications').insert([{
          user_id: certificate.userId,
          type: 'system',
          title: '🎓 Certificado Emitido!',
          content: `Seu certificado de conclusão do curso "${certificate.courseTitle}" já está disponível para download. Código de validação: ${certificate.id}`,
          is_read: false
        }]);
      } catch (e) {
        console.warn("Notifications save ignored in service", e);
      }
      
      return certificate;
    }
  },

  // ================= ENROLLMENTS =================
  fetchEnrollments: async (courseId: string): Promise<LMSEnrollment[]> => {
    try {
      const { data, error } = await supabase.from('lms_enrollments').select('*').eq('course_id', courseId);
      if (error) throw error;
      return data || [];
    } catch {
      const all: LMSEnrollment[] = getLocalDB('enrollments', []);
      return all.filter(e => e.courseId === courseId || e.courseId === 'all');
    }
  },

  fetchAllEnrollments: async (): Promise<LMSEnrollment[]> => {
    try {
      const { data, error } = await supabase.from('lms_enrollments').select('*');
      if (error) throw error;
      return data || [];
    } catch {
      return getLocalDB('enrollments', []);
    }
  },

  saveEnrollment: async (enrollment: LMSEnrollment): Promise<LMSEnrollment> => {
    try {
      const { data, error } = await supabase.from('lms_enrollments').upsert([enrollment]).select();
      if (error) throw error;
      return data[0];
    } catch {
      const all: LMSEnrollment[] = getLocalDB('enrollments', []);
      const idx = all.findIndex(e => e.id === enrollment.id);
      if (idx !== -1) all[idx] = enrollment;
      else all.push(enrollment);
      setLocalDB('enrollments', all);
      return enrollment;
    }
  },

  deleteEnrollment: async (enrollmentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('lms_enrollments').delete().eq('id', enrollmentId);
      if (error) throw error;
      return true;
    } catch {
      const all: LMSEnrollment[] = getLocalDB('enrollments', []);
      const filtered = all.filter(e => e.id !== enrollmentId);
      setLocalDB('enrollments', filtered);
      return true;
    }
  },

  // ================= CATEGORIES =================
  fetchCategories: async (): Promise<LMSCategory[]> => {
    try {
      const { data, error } = await supabase.from('lms_categories').select('*');
      if (error) throw error;
      return data || [];
    } catch {
      return getLocalDB('categories', []);
    }
  },

  saveCategory: async (category: LMSCategory): Promise<LMSCategory> => {
    try {
      const { data, error } = await supabase.from('lms_categories').upsert([category]).select();
      if (error) throw error;
      return data[0];
    } catch {
      const all: LMSCategory[] = getLocalDB('categories', []);
      const idx = all.findIndex(c => c.id === category.id);
      if (idx !== -1) all[idx] = category;
      else all.push(category);
      setLocalDB('categories', all);
      return category;
    }
  },

  deleteCategory: async (categoryId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('lms_categories').delete().eq('id', categoryId);
      if (error) throw error;
      return true;
    } catch {
      const all: LMSCategory[] = getLocalDB('categories', []);
      const filtered = all.filter(c => c.id !== categoryId);
      setLocalDB('categories', filtered);
      return true;
    }
  },

  // ================= MATERIALS =================
  fetchMaterials: async (courseId: string): Promise<LMSMaterial[]> => {
    try {
      const { data, error } = await supabase.from('lms_materials').select('*').eq('course_id', courseId);
      if (error) throw error;
      return data || [];
    } catch {
      const all: LMSMaterial[] = getLocalDB('materials', []);
      return all.filter(m => m.courseId === courseId || m.courseId === 'all');
    }
  },

  saveMaterial: async (material: LMSMaterial): Promise<LMSMaterial> => {
    try {
      const { data, error } = await supabase.from('lms_materials').upsert([material]).select();
      if (error) throw error;
      return data[0];
    } catch {
      const all: LMSMaterial[] = getLocalDB('materials', []);
      const idx = all.findIndex(m => m.id === material.id);
      if (idx !== -1) all[idx] = material;
      else all.push(material);
      setLocalDB('materials', all);
      return material;
    }
  },

  deleteMaterial: async (materialId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('lms_materials').delete().eq('id', materialId);
      if (error) throw error;
      return true;
    } catch {
      const all: LMSMaterial[] = getLocalDB('materials', []);
      const filtered = all.filter(m => m.id !== materialId);
      setLocalDB('materials', filtered);
      return true;
    }
  },

  // ================= LESSONS =================
  fetchLessons: async (courseId: string): Promise<Lesson[]> => {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('id', { ascending: true });
      if (error) throw error;

      const deletedLessons: string[] = getLocalDB('deleted_lessons', []);
      const activeData = (data || []).filter((l: any) => !deletedLessons.includes(l.id || String(l.order_index)));

      if (activeData && activeData.length > 0) {
        const dbLessons = activeData.map((l: any) => ({
          id: l.id || String(l.order_index),
          courseId: l.course_id,
          moduleId: l.module_id || undefined,
          title: l.title,
          videoUrl: l.video_url || '',
          duration: l.duration || '15:00',
          description: l.description || '',
          orderIndex: l.order_index || 1,
          contentType: l.content_type || 'video',
          textContent: l.text_content || '',
          htmlContent: l.html_content || '',
          markdownContent: l.markdown_content || '',
          videoType: l.video_type || 'youtube',
          documentUrl: l.document_url || '',
          documentType: l.document_type || 'pdf',
          codeSnippet: l.code_snippet || '',
          codeLanguage: l.code_language || 'javascript',
          embedUrl: l.embed_url || '',
          isLocked: l.is_locked || false,
          prerequisiteId: l.prerequisite_id || undefined,
          attachments: l.attachments ? (typeof l.attachments === 'string' ? JSON.parse(l.attachments) : l.attachments) : [],
          pdfLinks: l.pdf_links ? (typeof l.pdf_links === 'string' ? JSON.parse(l.pdf_links) : l.pdf_links) : []
        }));

        // Always merge with local changes to guarantee that any local edits (like module dragging or assignment) are preserved!
        const localLessons: Lesson[] = getLocalDB('lessons', []);
        return dbLessons.map(dbl => {
          const local = localLessons.find(ll => ll.id === dbl.id);
          return local ? { ...dbl, ...local } : dbl;
        });
      }
      throw new Error("No data in Supabase table lessons");
    } catch {
      const all: Lesson[] = getLocalDB('lessons', []);
      const deletedLessons: string[] = getLocalDB('deleted_lessons', []);
      return all.filter(l => (l.courseId === courseId || l.courseId === 'all') && !deletedLessons.includes(l.id));
    }
  },

  saveLesson: async (lesson: Lesson): Promise<Lesson> => {
    // Remove from deleted tracker if re-saved
    const deletedLessons: string[] = getLocalDB('deleted_lessons', []);
    if (deletedLessons.includes(lesson.id)) {
      setLocalDB('deleted_lessons', deletedLessons.filter(id => id !== lesson.id));
    }

    // Always persist to local fallback first to avoid losing assignments or edits
    const all: Lesson[] = getLocalDB('lessons', []);
    const idx = all.findIndex(l => l.id === lesson.id);
    if (idx !== -1) all[idx] = lesson;
    else all.push(lesson);
    setLocalDB('lessons', all);

    try {
      const { data, error } = await supabase.from('lessons').upsert([{
        id: lesson.id,
        course_id: lesson.courseId,
        module_id: lesson.moduleId || null,
        title: lesson.title,
        video_url: lesson.videoUrl || '',
        duration: lesson.duration || '15:00',
        description: lesson.description || '',
        order_index: lesson.orderIndex || 1,
        content_type: lesson.contentType || 'video',
        text_content: lesson.textContent || '',
        html_content: lesson.htmlContent || '',
        markdown_content: lesson.markdownContent || '',
        video_type: lesson.videoType || 'youtube',
        document_url: lesson.documentUrl || '',
        document_type: lesson.documentType || 'pdf',
        code_snippet: lesson.codeSnippet || '',
        code_language: lesson.codeLanguage || 'javascript',
        embed_url: lesson.embedUrl || '',
        is_locked: lesson.isLocked || false,
        prerequisite_id: lesson.prerequisiteId || null,
        attachments: lesson.attachments ? JSON.stringify(lesson.attachments) : null,
        pdf_links: lesson.pdfLinks ? JSON.stringify(lesson.pdfLinks) : null
      }]).select();
      if (error) throw error;
      if (data && data.length > 0) {
        return {
          id: data[0].id,
          courseId: data[0].course_id,
          moduleId: data[0].module_id || undefined,
          title: data[0].title,
          videoUrl: data[0].video_url || '',
          duration: data[0].duration || '15:00',
          description: data[0].description || '',
          orderIndex: data[0].order_index || 1,
          contentType: data[0].content_type || 'video',
          textContent: data[0].text_content || '',
          htmlContent: data[0].html_content || '',
          markdownContent: data[0].markdown_content || '',
          videoType: data[0].video_type || 'youtube',
          documentUrl: data[0].document_url || '',
          documentType: data[0].document_type || 'pdf',
          codeSnippet: data[0].code_snippet || '',
          codeLanguage: data[0].code_language || 'javascript',
          embedUrl: data[0].embed_url || '',
          isLocked: data[0].is_locked || false,
          prerequisiteId: data[0].prerequisite_id || undefined,
          attachments: data[0].attachments ? (typeof data[0].attachments === 'string' ? JSON.parse(data[0].attachments) : data[0].attachments) : [],
          pdfLinks: data[0].pdf_links ? (typeof data[0].pdf_links === 'string' ? JSON.parse(data[0].pdf_links) : data[0].pdf_links) : []
        };
      }
      return lesson;
    } catch {
      return lesson;
    }
  },

  deleteLesson: async (lessonId: string): Promise<boolean> => {
    // Delete from LocalDB immediately
    const all: Lesson[] = getLocalDB('lessons', []);
    const filtered = all.filter(l => l.id !== lessonId);
    setLocalDB('lessons', filtered);

    // Track as deleted locally
    const deletedList: string[] = getLocalDB('deleted_lessons', []);
    if (!deletedList.includes(lessonId)) {
      deletedList.push(lessonId);
      setLocalDB('deleted_lessons', deletedList);
    }

    try {
      const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
      if (error) throw error;
      return true;
    } catch {
      return true;
    }
  },

  // ================= DISCUSSION FORUMS =================
  fetchForumPosts: async (courseId: string): Promise<LMSForumPost[]> => {
    const all: LMSForumPost[] = getLocalDB('forum_posts', [
      {
        id: 'fp-1',
        courseId: 'c1',
        userId: 'instr-1',
        userName: 'Pe. Francisco (Instrutor)',
        userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        title: 'Boas-vindas ao Curso de Fundamentos Pasconistas!',
        content: 'Olá a todos! Este espaço do fórum é voltado para esclarecer dúvidas e compartilhar vivências de comunicação pastoral. Sinta-se à vontade para se apresentar e compartilhar a realidade de sua comunidade.',
        createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
        likes: 5,
        likedBy: [],
        replies: [
          {
            id: 'fr-1',
            postId: 'fp-1',
            userId: 'user-sample-1',
            userName: 'João Silva',
            userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
            content: 'Amém, padre! Muito entusiasmado com a oportunidade de consolidar a equipe da nossa comunidade.',
            createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString()
          }
        ]
      },
      {
        id: 'fp-2',
        courseId: 'c1',
        userId: 'user-sample-2',
        userName: 'Maria Santos',
        userAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
        title: 'Dúvidas sobre o Regulamento de Mídia Litúrgica',
        content: 'Qual a orientação oficial para fotos e circulação de fotógrafos perto do altar durante o Canon Romano? Já presenciei alguns desentendimentos por falta de discrição.',
        createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        likes: 2,
        likedBy: [],
        replies: []
      }
    ]);
    return all.filter(p => p.courseId === courseId || p.courseId === 'all');
  },

  saveForumPost: async (post: LMSForumPost): Promise<LMSForumPost> => {
    const all: LMSForumPost[] = getLocalDB('forum_posts', []);
    const idx = all.findIndex(p => p.id === post.id);
    if (idx !== -1) all[idx] = post;
    else all.push(post);
    setLocalDB('forum_posts', all);
    return post;
  },

  likeForumPost: async (postId: string, userId: string): Promise<boolean> => {
    const all: LMSForumPost[] = getLocalDB('forum_posts', []);
    const idx = all.findIndex(p => p.id === postId);
    if (idx !== -1) {
      const p = all[idx];
      if (!p.likedBy) p.likedBy = [];
      const userIdx = p.likedBy.indexOf(userId);
      if (userIdx !== -1) {
        p.likedBy.splice(userIdx, 1);
        p.likes = Math.max(0, p.likes - 1);
      } else {
        p.likedBy.push(userId);
        p.likes += 1;
      }
      setLocalDB('forum_posts', all);
      return true;
    }
    return false;
  },

  saveForumReply: async (reply: LMSForumReply): Promise<LMSForumReply> => {
    const all: LMSForumPost[] = getLocalDB('forum_posts', []);
    const idx = all.findIndex(p => p.id === reply.postId);
    if (idx !== -1) {
      if (!all[idx].replies) all[idx].replies = [];
      all[idx].replies.push(reply);
      setLocalDB('forum_posts', all);
    }
    return reply;
  },

  // ================= IN-LESSON COMMENTS =================
  fetchLessonComments: async (courseId: string, lessonId: string): Promise<LMSLessonComment[]> => {
    const all: LMSLessonComment[] = getLocalDB('lesson_comments', [
      { id: 'lc-1', courseId: 'c1', lessonId: '101', userId: 'user-sample-1', userName: 'João Silva', content: 'Belíssima reflexão inicial sobre a vocação!', createdAt: new Date(Date.now() - 1000 * 3600 * 2).toISOString() },
      { id: 'lc-2', courseId: 'c1', lessonId: '101', userId: 'instr-1', userName: 'Pe. Francisco', content: 'Exato, João. O foco é sempre o Cristo.', createdAt: new Date(Date.now() - 1000 * 3600).toISOString() }
    ]);
    return all.filter(c => c.courseId === courseId && c.lessonId === lessonId);
  },

  saveLessonComment: async (comment: LMSLessonComment): Promise<LMSLessonComment> => {
    const all: LMSLessonComment[] = getLocalDB('lesson_comments', []);
    all.push(comment);
    setLocalDB('lesson_comments', all);
    return comment;
  },

  // ================= ACADEMIC CALENDAR =================
  fetchCalendarEvents: async (courseId?: string): Promise<LMSCalendarEvent[]> => {
    const all: LMSCalendarEvent[] = getLocalDB('calendar_events', [
      { id: 'evt-1', courseId: 'c1', courseTitle: 'Diretrizes CNBB para a Pascom', title: 'Prova Teórica Final', description: 'Questionário avaliativo com 15 minutos de tempo limite.', dueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(), type: 'quiz' },
      { id: 'evt-2', courseId: 'c1', courseTitle: 'Diretrizes CNBB para a Pascom', title: 'Plantão de Dúvidas ao Vivo', description: 'Atendimento e esclarecimento de dúvidas via canal online.', dueDate: new Date(Date.now() + 1 * 24 * 3600 * 1000).toISOString(), type: 'live' },
      { id: 'evt-3', courseId: 'c3', courseTitle: 'Fotografia Litúrgica', title: 'Upload de Atividade Prática', description: 'Envio de 3 fotos contendo planos abertos e detalhes sacros.', dueDate: new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString(), type: 'reading' }
    ]);
    if (courseId) {
      return all.filter(e => e.courseId === courseId);
    }
    return all;
  },

  saveCalendarEvent: async (event: LMSCalendarEvent): Promise<LMSCalendarEvent> => {
    const all: LMSCalendarEvent[] = getLocalDB('calendar_events', []);
    const idx = all.findIndex(e => e.id === event.id);
    if (idx !== -1) all[idx] = event;
    else all.push(event);
    setLocalDB('calendar_events', all);
    return event;
  },

  // ================= MESSAGING =================
  fetchMessages: async (userId: string): Promise<LMSMessage[]> => {
    const all: LMSMessage[] = getLocalDB('internal_messages', [
      {
        id: 'msg-1',
        senderId: 'instr-1',
        senderName: 'Pe. Francisco',
        senderAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
        recipientId: userId,
        content: 'Gostei muito da sua resposta à questão dissertativa. Você possui um ótimo senso litúrgico! Mantenha esse empenho.',
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        read: false
      }
    ]);
    return all.filter(m => m.recipientId === userId || m.senderId === userId);
  },

  sendMessage: async (msg: LMSMessage): Promise<LMSMessage> => {
    const all: LMSMessage[] = getLocalDB('internal_messages', []);
    all.push(msg);
    setLocalDB('internal_messages', all);
    return msg;
  },

  markMessageAsRead: async (msgId: string): Promise<boolean> => {
    const all: LMSMessage[] = getLocalDB('internal_messages', []);
    const idx = all.findIndex(m => m.id === msgId);
    if (idx !== -1) {
      all[idx].read = true;
      setLocalDB('internal_messages', all);
      return true;
    }
    return false;
  },

  // ================= GAMIFICATION & STATS =================
  fetchLeaderboard: async (): Promise<LMSLeaderboardRow[]> => {
    try {
      // Fetch all real registered users from profiles table to avoid fictitious mockup names
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, name, avatar');
      
      if (error || !profiles || profiles.length === 0) {
        // Fallback to minimal list with current session user
        return [];
      }

      const rows: LMSLeaderboardRow[] = profiles.map((p: any) => {
        // Read actual XP or generate a deterministic beautiful starter XP based on name length
        const savedXp = Number(localStorage.getItem(`user_xp_${p.id}`));
        const deterministicXp = savedXp > 0 ? savedXp : (p.name.length * 90 + 150);
        
        // Read actual streak or deterministic starter streak
        const streakKey = `user_streak_${p.id}`;
        let savedStreakObj = null;
        try {
          const str = localStorage.getItem(streakKey);
          if (str) savedStreakObj = JSON.parse(str);
        } catch (_) {}
        const streakCount = savedStreakObj && savedStreakObj.streakCount > 0 
          ? savedStreakObj.streakCount 
          : ((p.name.length % 5) + 2);

        return {
          userId: p.id,
          userName: p.name,
          userAvatar: p.avatar || '',
          xp: deterministicXp,
          completedCount: Math.floor(deterministicXp / 250) + 1,
          badgesCount: Math.floor(deterministicXp / 600),
          streakCount: streakCount,
          rank: 99
        };
      });

      return rows.sort((a, b) => b.xp - a.xp).map((item, index) => ({ ...item, rank: index + 1 }));
    } catch (err) {
      console.error("Error generating real leaderboard:", err);
      return [];
    }
  },

  earnXP: async (userId: string, xpAmount: number): Promise<number> => {
    const currentXp = Number(localStorage.getItem(`user_xp_${userId}`)) || 0;
    const newXp = currentXp + xpAmount;
    localStorage.setItem(`user_xp_${userId}`, String(newXp));

    // Guarantee that an offensive active date is recorded for today (and today-1 if streak > 1) when earning XP
    await lmsService.recordUserOffensiveDate(userId);

    return newXp;
  },

  fetchUserOffensiveDates: async (userId: string): Promise<string[]> => {
    const key = `user_offensive_dates_${userId}`;
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthStr = String(today.getMonth() + 1).padStart(2, '0');
    
    // Default mock history of study dates so the Duolingo calendar shows a cool set of flames
    const defaultDates = [
      `${currentYear}-${currentMonthStr}-${String(today.getDate()).padStart(2, '0')}`, // Today
      `${currentYear}-${currentMonthStr}-${String(Math.max(1, today.getDate() - 1)).padStart(2, '0')}`, // Yesterday
      `${currentYear}-${currentMonthStr}-${String(Math.max(1, today.getDate() - 3)).padStart(2, '0')}`, // 3 days ago
      `${currentYear}-${currentMonthStr}-${String(Math.max(1, today.getDate() - 4)).padStart(2, '0')}`, // 4 days ago
    ].filter((value, index, self) => self.indexOf(value) === index);

    const list = getLocalDB(key, defaultDates);
    return list;
  },

  recordUserOffensiveDate: async (userId: string, dateStr?: string): Promise<string[]> => {
    const key = `user_offensive_dates_${userId}`;
    const targetDate = dateStr || new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const list: string[] = getLocalDB(key, []);
    if (!list.includes(targetDate)) {
      list.push(targetDate);
      setLocalDB(key, list);
    }
    return list;
  },

  fetchUserStreak: async (userId: string): Promise<{ streakCount: number; lastActiveDate: string }> => {
    return getLocalDB(`user_streak_${userId}`, { streakCount: 1, lastActiveDate: new Date().toLocaleDateString('en-CA') });
  },

  updateUserStreak: async (userId: string): Promise<{ streakCount: number; increased: boolean }> => {
    const streak = getLocalDB(`user_streak_${userId}`, { streakCount: 0, lastActiveDate: '' });
    const todayStr = new Date().toLocaleDateString('en-CA');
    
    let currentStreakCount = streak.streakCount;
    let increased = false;

    if (!streak.lastActiveDate) {
      currentStreakCount = 1;
      increased = true;
    } else {
      const lastActive = new Date(streak.lastActiveDate + 'T00:00:00');
      const today = new Date(todayStr + 'T00:00:00');
      const diffTime = today.getTime() - lastActive.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreakCount += 1;
        increased = true;
      } else if (diffDays > 1) {
        currentStreakCount = 1;
        increased = true;
      } else if (diffDays === 0) {
        // Same day, keeping streak but not marked as freshly increased
      }
    }

    if (currentStreakCount === 0) {
      currentStreakCount = 1;
      increased = true;
    }

    streak.streakCount = currentStreakCount;
    streak.lastActiveDate = todayStr;
    setLocalDB(`user_streak_${userId}`, streak);

    // Also update in leaderboard row if present
    const leaderboard = getLocalDB('gamification_leaderboard', []);
    const idx = leaderboard.findIndex((r: any) => r.userId === userId);
    if (idx !== -1) {
      leaderboard[idx].streakCount = currentStreakCount;
      setLocalDB('gamification_leaderboard', leaderboard);
    }

    return { streakCount: currentStreakCount, increased };
  },

  fetchUserBadges: async (userId: string): Promise<LMSBadge[]> => {
    return [];
  },

  saveUserBadge: async (userId: string, badgeId: string): Promise<boolean> => {
    return false;
  },

  getUserXP: async (userId: string): Promise<number> => {
    const list = await lmsService.fetchLeaderboard();
    const found = list.find((r: any) => r.userId === userId);
    return found ? found.xp : 0;
  }
};
