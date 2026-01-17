
export enum UserRole {
  ADMIN = 'Coordenador',
  AGENT = 'Agente',
  EDITOR = 'Editor',
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

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  birthday: string; // ISO date
  skills: string[];
}

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
  title: string;
  videoUrl: string;
  duration?: string;
  description?: string;
  orderIndex?: number;
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