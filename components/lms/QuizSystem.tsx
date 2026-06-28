import React, { useState, useEffect, useRef } from 'react';
import { LMSQuiz, LMSQuestion, LMSQuizAttempt, LMSCertificate } from '../../lmsTypes';
import { lmsService } from '../../lmsService';
import { User } from '../../types';
import { 
  Clock, Award, BookOpen, AlertCircle, Save, CheckCircle, 
  ChevronRight, ChevronLeft, Send, Sparkles, RefreshCw, XSquare, PlayCircle, HelpCircle,
  FileDown, Upload, MoveUp, MoveDown, HelpCircle as HelpIcon, ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizSystemProps {
  quiz: LMSQuiz;
  currentUser: User;
  courseTitle?: string;
  onFinished: (attempt: LMSQuizAttempt) => void;
  onClose: () => void;
}

export const QuizSystem: React.FC<QuizSystemProps> = ({ quiz, currentUser, courseTitle, onFinished, onClose }) => {
  // Navigation states
  const [examState, setExamState] = useState<'info' | 'active' | 'submitting' | 'result'>('info');
  const [allQuestions, setAllQuestions] = useState<LMSQuestion[]>([]);
  const [questions, setQuestions] = useState<LMSQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  
  // Storing intermediate student answer responses
  // Stored as a string representation based on the question type:
  // - multiple_choice: "A", "B"...
  // - true_false: "V", "F"
  // - multiple_answers: "A,C,D"
  // - short_answer: "Jesus"
  // - discursive: "long essay body"
  // - association: "item1:pair1,item2:pair2"
  // - sorting: "item3,item1,item2"
  // - gap_fill: "blank1Val,blank2Val"
  // - file_upload: "simulated_uploaded_file_url"
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  
  // File Upload states per question
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});

  // Sorting list memory helper
  const [sortingList, setSortingList] = useState<string[]>([]);

  // Previous attempts state
  const [attempts, setAttempts] = useState<LMSQuizAttempt[]>([]);
  const [latestAttempt, setLatestAttempt] = useState<LMSQuizAttempt | null>(null);

  // Timer states
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadQuizData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [quiz.id]);

  // Load active question sorting state once index changes
  useEffect(() => {
    if (questions.length > 0) {
      const q = questions[currentIdx];
      if (q.type === 'sorting' && q.options) {
        // If an answer already exists for sorting, split it, else load original list
        if (answers[q.id]) {
          setSortingList(answers[q.id].split(','));
        } else {
          setSortingList([...q.options]);
        }
      }
    }
  }, [currentIdx, questions]);

  const loadQuizData = async () => {
    setLoading(true);
    try {
      // 1. Fetch questions
      let qs = await lmsService.fetchQuestions(quiz.courseId, quiz.id);
      
      // Fallback Seed injector if questions are empty
      if (qs.length === 0) {
        qs = [
          {
            id: 'q-s-1',
            courseId: quiz.courseId,
            quizId: quiz.id,
            questionText: 'Qual das opções abaixo melhor define a função integradora e ministerial da Pascom segundo o Diretório da CNBB número 99?',
            type: 'multiple_choice',
            options: [
              'Exclusivamente a operação do console de som e de transmissão da live da paróquia.',
              'Uma pastoral articuladora que anima, acolhe e promove a comunhão de todas as iniciativas de comunicação e mídias sociais da igreja.',
              'Uma editora clerical focada na redação de boletins informativos e pastorais locais.',
              'Um comitê estratégico para gerir anúncios publicitários pagos.'
            ],
            correctAnswer: 'B',
            points: 40,
            feedback: 'Correto! A Pascom atua como rede de comunhão litúrgica, teológica e promocional na comunidade.'
          },
          {
            id: 'q-s-2',
            courseId: quiz.courseId,
            quizId: quiz.id,
            questionText: 'Indique se a afirmação é Verdadeira (V) ou Falsa (F): "A fotografia de perto junto ao altar durante a Consagração deve ser efetuada com o mínimo barulho, sem uso de flash, discretamente."',
            type: 'true_false',
            correctAnswer: 'V',
            points: 20,
            feedback: 'Excelente! A liturgia exige silêncio reverencial profundo. Equipamentos luminosos ofuscam o rito bíblico.'
          },
          {
            id: 'q-s-3',
            courseId: quiz.courseId,
            quizId: quiz.id,
            questionText: 'Marque TODAS as alternativas que compõem pilares oficiais da Pascom (Multi-Seleção):',
            type: 'multiple_answers',
            options: [
              'Pilar da Espiritualidade',
              'Pilar da Formação Integral',
              'Pilar da Articulação Integrada',
              'Pilar da Produção de Vídeo'
            ],
            correctAnswer: 'A,B,C',
            points: 20,
            feedback: 'Parabéns! Espiritualidade, Formação, Articulação (e Produção Teológica Geral) formam os eixos basilares CNBB.'
          },
          {
            id: 'q-s-4',
            courseId: quiz.courseId,
            quizId: quiz.id,
            questionText: 'Ordene cronologicamente os momentos da missa que devem receber cobertura de transmissão e fotos (Ordene de cima para baixo usando as setas):',
            type: 'sorting',
            options: [
              'Ritos Iniciais e Acolhida da comunidade',
              'Liturgia da Palavra e Evangelho',
              'Liturgia Eucarística e Oração da Consagração',
              'Ritos Finais e Bênção de Envio Pastoral'
            ],
            correctAnswer: 'Ritos Iniciais e Acolhida da comunidade,Liturgia da Palavra e Evangelho,Liturgia Eucarística e Oração da Consagração,Ritos Finais e Bênção de Envio Pastoral',
            points: 10,
            feedback: 'Correto! Essa é a ordem natural orgânica da Santa Missa.'
          },
          {
            id: 'q-s-5',
            courseId: quiz.courseId,
            quizId: quiz.id,
            questionText: 'Para quais canais de comunicação você direcionaria uma identidade visual da CNBB? Escreva sua reflexão em formato de tese acadêmica pastoral.',
            type: 'discursive',
            correctAnswer: '',
            points: 10,
            feedback: 'Muito bem! Seu texto foi enviado com sucesso para revisão teológica de Faust Melo.'
          }
        ];
        // Save them to database state provider
        for (let q of qs) {
          await lmsService.saveQuestion(q);
        }
      }
      setAllQuestions(qs);

      // 2. Fetch student attempts
      const userAttempts = await lmsService.fetchUserAttempts(quiz.id, currentUser.id);
      setAttempts(userAttempts);
      if (userAttempts.length > 0) {
        const sorted = [...userAttempts].sort((a, b) => 
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        );
        setLatestAttempt(sorted[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = () => {
    if (quiz.maxAttempts > 0 && attempts.length >= quiz.maxAttempts) {
      alert("Você já atingiu o limite máximo de tentativas para este questionário.");
      return;
    }

    let questionsPool = [...allQuestions];
    if (quiz.randomizeQuestions) {
      questionsPool = questionsPool.sort(() => Math.random() - 0.5);
    }
    setQuestions(questionsPool);
    setAnswers({});
    setUploadProgress({});
    setUploadedFiles({});
    setCurrentIdx(0);

    if (quiz.timeLimitMins > 0) {
      setTimeLeft(quiz.timeLimitMins * 60);
    }

    setExamState('active');

    if (quiz.timeLimitMins > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            autoSubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const selectAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  // Toggle checklist selection for multiple answers type
  const selectMultiOption = (questionId: string, letter: string) => {
    const current = answers[questionId] ? answers[questionId].split(',') : [];
    const idx = current.indexOf(letter);
    if (idx !== -1) {
      current.splice(idx, 1);
    } else {
      current.push(letter);
    }
    const newVal = current.sort().join(',');
    setAnswers((prev) => ({ ...prev, [questionId]: newVal }));
  };

  // Handle re-ordering items inside sorting types
  const handleSortItem = (questionId: string, itemIdx: number, direction: 'up' | 'down') => {
    const listCopy = [...sortingList];
    if (direction === 'up' && itemIdx > 0) {
      const temp = listCopy[itemIdx - 1];
      listCopy[itemIdx - 1] = listCopy[itemIdx];
      listCopy[itemIdx] = temp;
    } else if (direction === 'down' && itemIdx < listCopy.length - 1) {
      const temp = listCopy[itemIdx + 1];
      listCopy[itemIdx + 1] = listCopy[itemIdx];
      listCopy[itemIdx] = temp;
    }
    setSortingList(listCopy);
    
    // Save updated CSV join list as the current answered text
    const newVal = listCopy.join(',');
    setAnswers((prev) => ({ ...prev, [questionId]: newVal }));
  };

  // Simulate file upload with progression indicator
  const simulateFileUpload = (questionId: string, fileName: string) => {
    setUploadProgress((prev) => ({ ...prev, [questionId]: 10 }));
    let progress = 10;
    const interval = setInterval(() => {
      progress += 25;
      if (progress >= 100) {
        clearInterval(interval);
        setUploadProgress((prev) => ({ ...prev, [questionId]: 100 }));
        setUploadedFiles((prev) => ({ ...prev, [questionId]: fileName }));
        setAnswers((prev) => ({ ...prev, [questionId]: `https://pascom.academia/uploads/${fileName}` }));
      } else {
        setUploadProgress((prev) => ({ ...prev, [questionId]: progress }));
      }
    }, 400);
  };

  const autoSubmitQuiz = () => {
    alert("O tempo limite expirou! Suas respostas serão enviadas de forma automática.");
    handleSubmit();
  };

  const handleSubmit = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setExamState('submitting');

    try {
      let scoreEarned = 0;
      let totalMaxPoints = 0;
      const gradesTable: Record<string, number> = {};
      let hasDiscursive = false;

      questions.forEach((q) => {
        const studentAnswer = answers[q.id]?.trim() || '';
        totalMaxPoints += q.points;

        const isObjective = q.type === 'multiple_choice' || q.type === 'true_false' || q.type === 'multiple_answers' || q.type === 'sorting' || q.type === 'short_answer';

        if (isObjective) {
          // Normalize matching values
          const isCorrect = studentAnswer.toLowerCase() === q.correctAnswer.toLowerCase();
          const p = isCorrect ? q.points : 0;
          gradesTable[q.id] = p;
          scoreEarned += p;
        } else {
          // Discursive or uploaded files needs manual evaluation
          hasDiscursive = true;
          gradesTable[q.id] = 0; 
        }
      });

      const calculatedPercentage = totalMaxPoints > 0 
        ? Math.round((scoreEarned / totalMaxPoints) * 100) 
        : 0;

      const attemptId = `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const newAttempt: LMSQuizAttempt = {
        id: attemptId,
        quizId: quiz.id,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        startedAt: new Date(Date.now() - (quiz.timeLimitMins * 60 - timeLeft) * 1000).toISOString(),
        submittedAt: new Date().toISOString(),
        answers,
        grades: gradesTable,
        score: hasDiscursive ? 0 : calculatedPercentage,
        maxScore: 100,
        manualGraded: !hasDiscursive,
        status: hasDiscursive ? 'submitted' : 'graded',
        feedback: hasDiscursive 
          ? 'Contém questões discursivas ou arquivos que necessitam de correção e feedback manual do tutor de mídias.'
          : (calculatedPercentage >= quiz.passingGrade 
              ? `Parabéns! Você alcançou com êxito ${calculatedPercentage}% de aproveitamento teórico e espiritual e foi aprovado.` 
              : `Você alcançou ${calculatedPercentage}% de aproveitamento. Estude mais um pouco as matérias com os tutores e tente novamente.`)
      };

      await lmsService.saveAttempt(newAttempt);

      // Create Certificate if approved automatically
      if (!hasDiscursive && calculatedPercentage >= quiz.passingGrade) {
        const clientCerts = await lmsService.fetchCertificates(currentUser.id);
        const alreadyHasCert = clientCerts.some(c => c.courseId === quiz.courseId);

        if (!alreadyHasCert) {
          const newCert: LMSCertificate = {
            id: `cert-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 4)}`,
            courseId: quiz.courseId,
            courseTitle: courseTitle || quiz.title.replace('Avaliação Final: ', '').replace('Prova: ', '').replace('Prova Prática e Teórica de ', ''),
            userId: currentUser.id,
            userName: currentUser.name,
            issuedAt: new Date().toISOString(),
            courseHours: 15,
            directorName: 'Pe. Francisco José',
            templateId: 'classic'
          };
          await lmsService.saveCertificate(newCert);

          // Earn certificate rewards (+200 XP!)
          await lmsService.earnXP(currentUser.id, 200);
          await lmsService.updateUserStreak(currentUser.id);
        }
      }

      setLatestAttempt(newAttempt);
      setAttempts(prev => [...prev, newAttempt]);
      setExamState('result');
      onFinished(newAttempt);
    } catch (e) {
      console.error(e);
      alert("Erro ao enviar questionário. Tente novamente.");
      setExamState('active');
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm col-span-3">
        <RefreshCw className="animate-spin text-brand-blue mb-3" size={32} />
        <span className="font-bold text-xs text-slate-450 uppercase tracking-wider">Carregando Questionário Moodle...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-1">
      <AnimatePresence mode="wait">
        
        {/* STATE 1: SUMMARY / RULES BOARD */}
        {examState === 'info' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-105 shadow-sm"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center shadow-inner">
                <BookOpen size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1.5">{quiz.title}</h2>
                <span className="text-[10px] font-black uppercase text-brand-blue tracking-widest bg-brand-blue/5 px-3 py-1 rounded-full">Exame de Avaliação Pascom</span>
              </div>
            </div>

            <p className="text-slate-550 text-xs md:text-sm leading-relaxed mb-8 font-medium">{quiz.description}</p>

            {/* Rules */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Tempo Disponível</span>
                <span className="text-sm md:text-base font-black text-slate-800 flex items-center gap-1.5">
                  <Clock size={16} className="text-slate-500" /> {quiz.timeLimitMins > 0 ? `${quiz.timeLimitMins} minutos` : 'Ilimitado'}
                </span>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Máximo de Tentativas</span>
                <span className="text-sm md:text-base font-black text-slate-800">
                  {quiz.maxAttempts > 0 ? `${attempts.length} de ${quiz.maxAttempts}` : 'Ilimitadas'}
                </span>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Média de Aprovação</span>
                <span className="text-sm md:text-base font-black text-brand-green flex items-center gap-1.5">
                  <Award size={16} className="text-[#34a853]" /> {quiz.passingGrade}% mínimo
                </span>
              </div>
            </div>

            {/* Attempt histories */}
            {attempts.length > 0 && (
              <div className="mb-8 border-t border-slate-100 pt-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Histórico de Submissões</h3>
                <div className="space-y-3">
                  {attempts.map((att, idx) => (
                    <div key={att.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-black text-slate-800">Tentativa #{idx + 1}</span>
                          <span className="text-[10px] text-slate-400 font-bold">({new Date(att.submittedAt!).toLocaleDateString('pt-BR')})</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-normal italic font-medium">{att.feedback}</p>
                      </div>
                      <div className="shrink-0">
                        <span className={`px-4 py-1.5 text-xs font-black rounded-xl inline-block ${
                          att.status === 'submitted' ? 'bg-[#007cba]/10 text-[#007cba]' :
                          att.score >= quiz.passingGrade ? 'bg-[#34a853]/10 text-[#34a853]' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {att.status === 'submitted' ? 'Aguardando Avaliação' : `Nota: ${att.score}%`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button 
                onClick={onClose}
                className="bg-slate-100 hover:bg-slate-250 text-slate-650 font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl transition-all cursor-pointer select-none"
              >
                Voltar à Aula
              </button>
              {(quiz.maxAttempts === 0 || attempts.length < quiz.maxAttempts) ? (
                <button 
                  onClick={startQuiz}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider px-8 py-3.5 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2 select-none"
                >
                  <PlayCircle size={15} /> Iniciar Questionário Estudar
                </button>
              ) : (
                <div className="px-6 py-3.5 bg-red-100 text-red-600 font-bold text-xs uppercase rounded-xl flex items-center gap-2">
                  <AlertCircle size={15} /> Tentativas Esgotadas
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* STATE 2: ACTIVE ASSESSMENT CORE */}
        {examState === 'active' && questions.length > 0 && (() => {
          const currentQuestion = questions[currentIdx];
          const hasAnsweredCurrent = answers[currentQuestion.id] !== undefined && answers[currentQuestion.id] !== '';

          return (
            <motion.div 
              key="active-quiz-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-4 gap-8"
            >
              {/* Question list map index on Left (Moodle Layout) */}
              <div className="lg:col-span-1 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between h-fit lg:sticky lg:top-24">
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-4 text-center">Mural de Questões</h4>
                  <div className="grid grid-cols-5 gap-2.5">
                    {questions.map((q, idx) => {
                      const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
                      return (
                        <button
                          key={`qa-nav-${idx}`}
                          onClick={() => setCurrentIdx(idx)}
                          className={`w-9 h-9 font-black text-xs rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                            currentIdx === idx ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-100' :
                            isAnswered ? 'bg-[#007cba]/15 text-[#007cba] border-[#007cba]/20 font-extrabold' : 'bg-slate-50 text-slate-500 border-slate-150 hover:bg-slate-100'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-50 space-y-4">
                  {quiz.timeLimitMins > 0 ? (
                    <div className="flex flex-col items-center gap-1 py-4 bg-slate-900 text-white rounded-2xl shadow-sm border border-slate-800">
                      <span className="text-[8.5px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1">
                        <Clock size={10} className="text-yellow-400" /> Cronômetro EAD
                      </span>
                      <span className="text-2xl font-black text-white font-mono tracking-wider">{formatTime(timeLeft)}</span>
                    </div>
                  ) : (
                    <div className="text-center font-bold text-[9px] uppercase text-slate-400 py-2.5 border bg-slate-50/50 rounded-2xl">
                      Sem tempo limite
                    </div>
                  )}
                </div>
              </div>

              {/* Central active question solver panel */}
              <div className="lg:col-span-3 bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between min-h-[460px]">
                <div>
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-50 text-slate-400 font-bold text-xs">
                    <span>Atividade {currentIdx + 1} de {questions.length}</span>
                    <span>Peso: {currentQuestion.points} pontos</span>
                  </div>

                  <h3 className="text-base md:text-lg font-black text-slate-850 leading-snug mb-8">
                    {currentQuestion.questionText}
                  </h3>

                  {/* CUSTOM QUESTION TYPES RENDER PANEL */}
                  <div className="space-y-4">
                    
                    {/* TYPE 1: MULTIPLE CHOICE */}
                    {currentQuestion.type === 'multiple_choice' && currentQuestion.options?.map((option, idx) => {
                      const letter = String.fromCharCode(65 + idx); // "A", "B", "C"...
                      const isSelected = answers[currentQuestion.id] === letter;
                      return (
                        <button
                          key={`option-mc-${letter}`}
                          onClick={() => selectAnswer(currentQuestion.id, letter)}
                          className={`w-full flex items-center gap-4 text-left p-4.5 rounded-[1.3rem] border transition-all cursor-pointer ${
                            isSelected 
                            ? 'bg-amber-500/5 border-amber-500 text-slate-900 shadow-sm ring-1 ring-amber-500/25' 
                            : 'bg-slate-50/50 hover:bg-slate-50 border-slate-150 text-slate-650 hover:text-slate-800'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-xl font-black text-[13px] flex items-center justify-center border transition-all ${
                            isSelected ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-450 border-slate-200'
                          }`}>
                            {letter}
                          </div>
                          <span className="font-bold text-xs md:text-sm leading-tight">{option}</span>
                        </button>
                      );
                    })}

                    {/* TYPE 2: TRUE OR FALSE */}
                    {currentQuestion.type === 'true_false' && (
                      <div className="grid grid-cols-2 gap-4">
                        {['V', 'F'].map((val) => {
                          const isSelected = answers[currentQuestion.id] === val;
                          return (
                            <button
                              key={`option-tf-${val}`}
                              onClick={() => selectAnswer(currentQuestion.id, val)}
                              className={`flex flex-col items-center justify-center py-8 px-4 rounded-[1.5rem] border transition-all cursor-pointer ${
                                isSelected
                                ? val === 'V'
                                  ? 'bg-green-50/20 border-green-500 text-green-700 ring-1 ring-green-500/20 shadow-sm'
                                  : 'bg-red-50/20 border-red-500 text-red-700 ring-1 ring-red-500/20 shadow-sm'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-150 text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              <span className="text-3xl font-black mb-1">{val === 'V' ? 'V' : 'F'}</span>
                              <span className="text-[10px] font-black uppercase tracking-widest">{val === 'V' ? 'Verdadeiro' : 'Falso'}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* TYPE 3: MULTIPLE ANSWERS CHECKLIST */}
                    {currentQuestion.type === 'multiple_answers' && currentQuestion.options?.map((option, idx) => {
                      const letter = String.fromCharCode(65 + idx); // "A", "B", "C"
                      const currentSelected = answers[currentQuestion.id] ? answers[currentQuestion.id].split(',') : [];
                      const isSelected = currentSelected.includes(letter);

                      return (
                        <button
                          key={`option-ma-${letter}`}
                          onClick={() => selectMultiOption(currentQuestion.id, letter)}
                          className={`w-full flex items-center gap-4 text-left p-4.5 rounded-[1.3rem] border transition-all cursor-pointer ${
                            isSelected 
                            ? 'bg-[#007cba]/5 border-[#007cba] text-slate-900 shadow-sm ring-1 ring-[#007cba]/25' 
                            : 'bg-slate-50/50 hover:bg-slate-50 border-slate-150 text-slate-65) hover:text-slate-800'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            isSelected ? 'bg-[#007cba] text-white border-[#007cba]' : 'bg-white text-slate-450 border-slate-200'
                          }`}>
                            {isSelected && '✓'}
                          </div>
                          <span className="font-bold text-xs md:text-sm leading-tight">{option}</span>
                        </button>
                      );
                    })}

                    {/* TYPE 4: TOUCH RANKING / REORDER SORTING */}
                    {currentQuestion.type === 'sorting' && (
                      <div className="space-y-2">
                        {sortingList.map((val, idx) => (
                          <div 
                            key={`option-sort-${val}`} 
                            className="p-3 bg-slate-50/80 rounded-xl border border-slate-150 flex items-center justify-between gap-3 text-xs md:text-sm font-bold text-slate-750 hover:bg-slate-100/50 transition-colors"
                          >
                            <span className="truncate">{val}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                disabled={idx === 0}
                                onClick={() => handleSortItem(currentQuestion.id, idx, 'up')}
                                className="p-1 px-2.5 bg-white border rounded hover:bg-slate-50 disabled:opacity-40 transition-colors"
                              >
                                <MoveUp size={11} />
                              </button>
                              <button
                                disabled={idx === sortingList.length - 1}
                                onClick={() => handleSortItem(currentQuestion.id, idx, 'down')}
                                className="p-1 px-2.5 bg-white border rounded hover:bg-slate-50 disabled:opacity-40 transition-colors"
                              >
                                <MoveDown size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TYPE 5: DISCURSIVE / LONG WRITTEN ESSAY */}
                    {(currentQuestion.type === 'discursive' || currentQuestion.type === 'long_answer') && (
                      <div className="flex flex-col gap-2">
                        <textarea
                          placeholder="Desenvolva sua tese teológica em detalhes para envio..."
                          className="w-full h-44 p-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-[#007cba]/15 focus:border-[#007cba] focus:bg-white text-slate-800 text-xs md:text-sm font-bold resize-none transition-all"
                          value={answers[currentQuestion.id] || ''}
                          onChange={(e) => selectAnswer(currentQuestion.id, e.target.value)}
                        />
                        <span className="text-[10px] text-slate-400 font-extrabold text-right">Esta questão necessita de revisão manual do ministério e gera nota de repasse secundária.</span>
                      </div>
                    )}

                    {/* TYPE 6: SHORT TEXT FILL */}
                    {currentQuestion.type === 'short_answer' && (
                      <div className="space-y-1">
                        <input
                          type="text"
                          placeholder="Digite aqui o termo exato pedido..."
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white text-xs md:text-sm font-black text-slate-800 focus:border-amber-500"
                          value={answers[currentQuestion.id] || ''}
                          onChange={(e) => selectAnswer(currentQuestion.id, e.target.value)}
                        />
                      </div>
                    )}

                    {/* TYPE 7: INTERACTIVE FILE ATTACHMENT UPLOAD MOCK */}
                    {currentQuestion.type === 'file_upload' && (
                      <div className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-2xl p-6 text-center bg-slate-50/40 relative">
                        {uploadedFiles[currentQuestion.id] ? (
                          <div className="space-y-2">
                            <span className="inline-block p-3 bg-green-100 text-green-700 rounded-full">
                              <CheckCircle size={22} />
                            </span>
                            <div className="space-y-0.5">
                              <h4 className="font-extrabold text-xs text-slate-805">{uploadedFiles[currentQuestion.id]}</h4>
                              <p className="text-[10px] text-slate-450 uppercase font-black tracking-widest bg-slate-100 rounded px-2 inline-block">Upload Completo</p>
                            </div>
                            <button
                              onClick={() => {
                                const filesCopy = { ...uploadedFiles };
                                delete filesCopy[currentQuestion.id];
                                setUploadedFiles(filesCopy);
                                
                                const answersCopy = { ...answers };
                                delete answersCopy[currentQuestion.id];
                                setAnswers(answersCopy);
                              }}
                              className="text-[10px] font-black uppercase text-red-500 hover:underline pt-2 block mx-auto cursor-pointer"
                            >
                              Remover Arquivo
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <Upload className="mx-auto text-slate-400" size={32} />
                            <div className="space-y-0.5">
                              <h3 className="font-extrabold text-xs text-slate-800">Carregar Atividade EAD</h3>
                              <p className="text-[10.5px] text-slate-450 font-medium">Arraste seu PDF, JPG ou planilha liturgica ou clique abaixo para iniciar.</p>
                            </div>
                            
                            <label className="inline-block px-4 py-2 bg-slate-900 border hover:bg-slate-850 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer">
                              Escolher Arquivo do Sistema
                              <input 
                                type="file" 
                                className="hidden" 
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    simulateFileUpload(currentQuestion.id, e.target.files[0].name);
                                  }
                                }}
                              />
                            </label>

                            {uploadProgress[currentQuestion.id] !== undefined && (
                              <div className="max-w-xs mx-auto pt-4 space-y-1">
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-brand-blue h-full" style={{ width: `${uploadProgress[currentQuestion.id]}%` }} />
                                </div>
                                <span className="text-[9.5px] font-mono text-slate-400">Enviando... {uploadProgress[currentQuestion.id]}%</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>

                {/* Lower Quiz Navigation */}
                <div className="flex items-center justify-between border-t border-slate-50 pt-6 mt-12 gap-3">
                  <button
                    disabled={currentIdx === 0}
                    onClick={() => setCurrentIdx((prev) => prev - 1)}
                    className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:hover:bg-slate-50 px-5 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer select-none"
                  >
                    <ChevronLeft size={16} /> Anterior
                  </button>

                  {currentIdx === questions.length - 1 ? (
                    <button
                      onClick={handleSubmit}
                      className="flex items-center gap-1.5 bg-brand-green hover:bg-brand-green/90 text-white font-black text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 shadow-brand-green/10"
                    >
                      Enviar Questionário <Send size={13} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setCurrentIdx((prev) => prev + 1)}
                      className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-xl font-bold text-xs transition-all cursor-pointer select-none"
                    >
                      Próxima Questão <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* STATE 3: SUBMITTING INDICATOR SPINNER */}
        {examState === 'submitting' && (
          <motion.div 
            key="submitting-spinner-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] p-12 border border-slate-100 text-center shadow-sm"
          >
            <RefreshCw className="animate-spin text-brand-blue mx-auto mb-6" size={48} />
            <h3 className="text-xl font-black text-slate-850 tracking-tight leading-none">Processando suas respostas...</h3>
            <p className="text-slate-500 text-xs md:text-sm mt-3 max-w-sm mx-auto font-semibold">Calculando folha de acerto e emitindo nota oficial do exame na base de dados.</p>
          </motion.div>
        )}

        {/* STATE 4: EXAM RESULTS OVERVIEW */}
        {examState === 'result' && latestAttempt && (() => {
          const isApproved = latestAttempt.score >= quiz.passingGrade;
          const needsCorrection = !latestAttempt.manualGraded;

          return (
            <motion.div 
              key="exam-result-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[3rem] border border-slate-105 p-8 md:p-10 shadow-sm text-center"
            >
              <div className="mx-auto mb-6">
                {needsCorrection ? (
                  <div className="w-16 h-16 bg-blue-100 text-brand-blue rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-50/5 shadow-inner animate-pulse">
                    <Clock size={32} />
                  </div>
                ) : isApproved ? (
                  <div className="w-16 h-16 bg-[#34a853]/10 text-[#34a853] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#34a853]/10 shadow-inner">
                    <Sparkles size={32} className="animate-bounce" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-50 shadow-inner animate-pulse">
                    <XSquare size={32} />
                  </div>
                )}
              </div>

              <span className={`text-[9.5px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full inline-block border ${
                needsCorrection ? 'bg-blue-50/50 text-[#007cba] border-blue-100' :
                isApproved ? 'bg-[#34a853]/5 text-[#34a853] border-[#34a853]/10' : 'bg-red-500/5 text-red-500 border-red-100'
              }`}>
                {needsCorrection ? 'Aguardando Correção Manual' : isApproved ? 'Aprovado Academicamente' : 'Abaixo do Aproveitamento'}
              </span>

              <h2 className="text-2xl md:text-3xl font-black text-slate-850 tracking-tight leading-tight mt-6">
                {needsCorrection ? 'Avaliação Enviada com Sucesso!' : isApproved ? 'Excelente Conquista Acadêmica!' : 'Umas respostas precisam de esforço...'}
              </h2>

              <p className="text-slate-500 text-xs md:text-sm max-w-xl mx-auto mt-3 leading-relaxed font-semibold">
                {latestAttempt.feedback}
              </p>

              {!needsCorrection && (
                <div className="w-44 bg-slate-50 p-5 rounded-2xl border border-slate-100 mx-auto my-8">
                  <span className="block text-[8.5px] font-black uppercase text-slate-400 tracking-wider mb-1">Seu Aproveitamento</span>
                  <span className={`text-3xl font-black leading-none ${isApproved ? 'text-brand-green' : 'text-red-500'}`}>{latestAttempt.score}%</span>
                </div>
              )}

              {isApproved && !needsCorrection && (
                <div className="p-5 bg-green-50/30 border border-green-500/10 rounded-2xl max-w-md mx-auto mb-8 text-xs text-green-700 leading-relaxed font-bold">
                  🕊️ Seu diploma de especialização em mídias CNBB foi assinado por Pe. Francisco José e gerado em formato homologado de certificação acadêmica. Você já pode consultá-lo em seu painel!
                </div>
              )}

              <div className="flex gap-3 justify-center pt-2">
                <button 
                  onClick={onClose}
                  className="bg-slate-900 hover:bg-slate-850 text-white font-black text-xs uppercase tracking-wider px-8 py-3.5 rounded-xl transition-all cursor-pointer shadow-sm select-none"
                >
                  Confirmar e Sair
                </button>
              </div>
            </motion.div>
          );
        })()}

      </AnimatePresence>
    </div>
  );
};
