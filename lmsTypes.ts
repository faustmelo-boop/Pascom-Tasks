export interface LMSModule {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  orderIndex: number;
  createdAt: string;
  isLocked?: boolean;
  prerequisiteId?: string; // Module that must be completed first
}

export type QuestionType = 
  | 'multiple_choice' 
  | 'multiple_answers' 
  | 'true_false' 
  | 'short_answer' 
  | 'long_answer' 
  | 'discursive'
  | 'association' 
  | 'sorting' 
  | 'gap_fill' 
  | 'file_upload';

export interface LMSQuestion {
  id: string;
  courseId: string; // Linked to course question bank
  quizId?: string;  // Assigned to specific quiz
  type: QuestionType;
  questionText: string;
  options?: string[]; // Used for multiple_choice and multiple_answers
  correctAnswer: string; // Correct ans value (single option, comma-separated keys, V/F, or text matching)
  points: number;
  feedback?: string;
  
  // Moodle-specific properties
  category?: string; // Question bank category (e.g. "Liturgia", "Vídeo", "Redes")
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  
  // Association properties
  associationPairs?: { left: string; right: string }[]; // Matching LHS value -> RHS value
  
  // Sorting properties
  sortingItems?: string[]; // Correct sequence of strings
  
  // Gap filling properties
  gapText?: string; // Formatted as "A Pascom foi criada no ano de [[blank]] pelo documento [[blank]]."
  gapSolutions?: string[]; // Solutions in sequential index order
}

export interface LMSQuiz {
  id: string;
  courseId: string;
  moduleId?: string;
  title: string;
  description?: string;
  timeLimitMins: number; // 0 for no limit
  maxAttempts: number; // 0 for unlimited
  passingGrade: number; // e.g. 70 out of 100
  randomizeQuestions: boolean;
  createdAt: string;
  category?: 'quiz' | 'exam' | 'activity' | 'mock_exam';
  isLocked?: boolean;
  prerequisiteId?: string; // ID of required prerequisite item
}

export interface LMSQuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  startedAt: string;
  submittedAt?: string;
  answers: Record<string, any>; // questionId -> studentAnswer (string, string[], or left-right record)
  grades?: Record<string, number>; // questionId -> score earned
  score: number; // calculated percentage score (0 - 100)
  maxScore: number; // maximum possible points (usually 100)
  manualGraded: boolean; // whether discursive, file uploads, etc., have been graded
  feedback?: string;
  status: 'in_progress' | 'submitted' | 'graded';
}

export interface LMSCertificate {
  id: string; // Verification code
  courseId: string;
  courseTitle: string;
  userId: string;
  userName: string;
  issuedAt: string;
  courseHours: number;
  directorName: string;
  templateId: 'classic' | 'modern' | 'minimalist' | 'honor';
  stampUrl?: string;
  qrCodeText?: string;
}

export interface LMSEnrollment {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  userEmail: string;
  enrolledAt: string;
  status: 'active' | 'completed' | 'suspended';
  grade?: number;
  attendancePct?: number; // Presence system (0-100)
}

export interface LMSCategory {
  id: string;
  name: string;
  description?: string;
}

export interface CertificateTemplate {
  id: 'classic' | 'modern' | 'minimalist' | 'honor';
  name: string;
  primaryColor: string;
  secondaryColor: string;
  borderColor: string;
  bgColor: string;
  fontFamily: string;
}

export interface LMSMaterial {
  id: string;
  courseId: string;
  moduleId?: string;
  title: string;
  type: 'pdf' | 'link' | 'video_url' | 'document' | 'presentation' | 'code' | 'embed';
  url: string;
  size?: string;
  createdAt: string;
  metadata?: {
    codeLanguage?: string;
    codeSnippet?: string;
    embedHeight?: number;
    presentationId?: string;
    docType?: 'docx' | 'pptx' | 'xlsx' | 'epub' | 'txt' | 'pdf';
  };
}

// Moodle-specific Social & Interactive Entities
export interface LMSForumPost {
  id: string;
  courseId: string;
  lessonId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  title: string;
  content: string;
  createdAt: string;
  likes: number;
  likedBy: string[]; // userIds
  replies: LMSForumReply[];
}

export interface LMSForumReply {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
}

export interface LMSLessonComment {
  id: string;
  courseId: string;
  lessonId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
}

export interface LMSMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export interface LMSCalendarEvent {
  id: string;
  courseId: string;
  courseTitle: string;
  title: string;
  description?: string;
  dueDate: string;
  type: 'quiz' | 'live' | 'reading' | 'presence';
}

export interface LMSBadge {
  id: string;
  title: string;
  description: string;
  image: string; // Styled SVG or emoji designator
  category: string;
  unlockedAt?: string;
}

export interface LMSLeaderboardRow {
  userId: string;
  userName: string;
  userAvatar?: string;
  xp: number;
  completedCount: number;
  badgesCount: number;
  streakCount?: number;
  rank: number;
}
