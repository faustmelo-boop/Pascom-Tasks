import { User, UserRole, Post, Task, TaskStatus, TaskPriority, ScheduleEvent, Course } from './types';

// Mock Users (Mantidos para visualização inicial de membros se a tabela profiles estiver vazia, mas idealmente deve vir do Supabase)
export const USERS: User[] = [
  {
    id: 'u1',
    name: 'Ana Silva',
    role: UserRole.ADMIN,
    avatar: 'https://picsum.photos/id/64/150/150',
    birthday: '1990-05-15',
    skills: ['Coordenação', 'Planejamento', 'Redação'],
  },
  {
    id: 'u2',
    name: 'João Pedro',
    role: UserRole.AGENT,
    avatar: 'https://picsum.photos/id/91/150/150',
    birthday: '1995-10-20',
    skills: ['Fotografia', 'Edição'],
  },
];

export const CURRENT_USER = USERS[0]; 

// Mock Posts - Limpo
export const POSTS: Post[] = [];

// Mock Tasks - Limpo
export const TASKS: Task[] = [];

// Mock Schedules - Limpo
export const SCHEDULES: ScheduleEvent[] = [];

// Mock Courses - Limpo para garantir uso do Banco de Dados
export const COURSES: Course[] = [];