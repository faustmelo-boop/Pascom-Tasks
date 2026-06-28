
export enum UserRole {
  ADMIN = 'Coordenador',
  AGENT = 'Agente',
  EDITOR = 'Editor',
  TREASURER = 'Tesoureiro',
}

export enum TaskStatus {
  TODO = 'A Fazer',
  IN_PROGRESS = 'Em Andamento',
  REVIEW = 'Em Revisão',
  DONE = 'Concluído',
}

export enum TaskPriority {
  LOW = 'Baixa',
  MEDIUM = 'Média',
  HIGH = 'Alta',
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
}

export const AVAILABLE_BADGES: Badge[] = [
  { id: 'espiritualidade', name: 'Estrela da Fé', emoji: '🕊️', description: 'Concedido ao concluir um curso de Espiritualidade.', color: 'from-amber-400 to-yellow-500' },
  { id: 'tecnico', name: 'Mestre das Mídias', emoji: '🛠️', description: 'Concedido ao concluir um curso Técnico.', color: 'from-blue-500 to-indigo-600' },
  { id: 'lideranca', name: 'Líder Pasconista', emoji: '🧭', description: 'Concedido ao concluir um curso de Liderança.', color: 'from-purple-500 to-fuchsia-600' },
  { id: 'geral', name: 'Comunicador Geral', emoji: '📚', description: 'Concedido ao concluir um curso Geral.', color: 'from-emerald-500 to-teal-600' }
];

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole | string;
  avatar: string;
  birthday: string; // ISO date
  skills: string[];
  onboarding_completed?: boolean;
  unavailableDates?: string[]; // Array of ISO date strings (YYYY-MM-DD)
  badges?: string[];
  rawSkills?: string[];
}

export const isCoordinator = (role: string | UserRole): boolean => {
  if (!role) return false;
  const r = String(role).toLowerCase();
  return r === 'coordenador' || r === 'admin' || r.includes('coorden');
};

export interface Post {
  id: string;
  authorId: string;
  content: string;
  type: 'aviso' | 'pedido' | 'cobertura' | 'enquete' | 'formacao';
  timestamp: string;
  likes: number;
  comments: number;
  image?: string;
  pollOptions?: { id: string; text: string; votes: number }[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeIds: string[];
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  tags: string[];
}

export interface ScheduleEvent {
  id: string;
  title: string;
  date: string; // ISO date
  time: string;
  type: 'Missa' | 'Evento' | 'Reunião';
  archived?: boolean;
  roles: {
    roleName: string; // e.g. "Fotografia", "Transmissão"
    assignedUserId?: string | null;
    status?: 'pending' | 'confirmed' | 'declined';
    justification?: string;
  }[];
}

export interface Course {
  id: string;
  title: string;
  category: string;
  progress: number; // 0-100
  lessonsCount: number;
  thumbnail: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  moduleId?: string;
  title: string;
  videoUrl?: string;
  duration?: string;
  description?: string;
  orderIndex?: number;
  contentType?: 'video' | 'text' | 'html' | 'markdown' | 'document' | 'code' | 'embed';
  textContent?: string;
  htmlContent?: string;
  markdownContent?: string;
  videoType?: 'youtube' | 'vimeo' | 'upload' | 'external';
  documentUrl?: string;
  documentType?: 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'epub' | 'txt';
  codeSnippet?: string;
  codeLanguage?: string;
  embedUrl?: string;
  isLocked?: boolean;
  prerequisiteId?: string; // ID of lesson/quiz that must be done first
  attachments?: { name: string; url: string; size?: string }[];
  pdfLinks?: { title: string; url: string }[];
}

export interface DocumentItem {
  id: string;
  title: string;
  category: string; // e.g., "Liturgia", "Manual", "Ata"
  url: string;
  createdAt: string;
  uploaderId: string;
  size?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  condition: 'Novo' | 'Bom' | 'Regular' | 'Ruim' | 'Danificado';
  status: 'Disponível' | 'Em Uso' | 'Em Manutenção';
  holderId?: string | null; // ID of the user holding the item
  image?: string;
}

export enum FinancialTransactionType {
  INCOME = 'Entrada',
  EXPENSE = 'Saída',
  TRANSFER = 'Transferência',
}

export enum FinancialTransactionStatus {
  PLANNED = 'Previsto',
  PAID = 'Pago',
  CANCELLED = 'Cancelado',
  PENDING_APPROVAL = 'Aguardando Aprovação',
}

export interface FinancialAccount {
  id: string;
  name: string;
  type: 'Caixa' | 'Banco' | 'PIX';
  balance: number;
}

export interface FinancialCategory {
  id: string;
  name: string;
  type: 'Entrada' | 'Saída';
}

export interface FinancialProject {
  id: string;
  name: string;
  description?: string;
  budgetPlanned: number;
  budgetExecuted: number;
  startDate?: string;
  endDate?: string;
}

export interface FinancialTransaction {
  id: string;
  type: FinancialTransactionType;
  value: number;
  date: string; // ISO date
  categoryId: string;
  accountId: string;
  toAccountId?: string; // For transfers
  projectId?: string;
  paymentMethod: string;
  description: string;
  status: FinancialTransactionStatus;
  attachmentUrl?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'mention' | 'task_assigned' | 'schedule_update' | 'system';
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string; // ISO date
  relatedId?: string; // ID of the task, post, or schedule
}