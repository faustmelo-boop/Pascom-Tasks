import { supabase } from './supabaseClient';
import { User, Post, Task, ScheduleEvent, Course, AppNotification, InventoryItem, FinancialAccount, FinancialCategory, FinancialProject, FinancialTransaction } from './types';

export const fetchUsers = async (): Promise<User[]> => {
  const [profilesRes, coursesRes, lessonsRes, progressRes] = await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('courses').select('*'),
    supabase.from('lessons').select('id, course_id'),
    supabase.from('user_progress').select('lesson_id, user_id')
  ]);

  if (profilesRes.error) throw profilesRes.error;
  
  const profiles = profilesRes.data || [];
  const courses = coursesRes.data || [];
  const lessons = lessonsRes.data || [];
  const progressList = progressRes.data || [];

  return profiles.map((p: any) => {
    const skills = p.skills || [];
    
    // Calculate badges dynamically based on course completions
    const completedCategories = new Set<string>();
    
    courses.forEach((course: any) => {
      const courseLessons = lessons.filter((l: any) => l.course_id === course.id);
      if (courseLessons.length > 0) {
        const completedLessonsCount = progressList.filter((up: any) => 
          up.user_id === p.id && courseLessons.some((l: any) => l.id === up.lesson_id)
        ).length;
        
        if (completedLessonsCount === courseLessons.length) {
          const categorySlug = String(course.category || 'geral')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
          completedCategories.add(categorySlug);
        }
      }
    });

    const computedBadges = Array.from(completedCategories);

    return {
      id: p.id,
      name: p.name ? p.name.split(' ').slice(0, 2).join(' ') : 'Sem Nome',
      email: p.email || undefined,
      role: p.role,
      avatar: p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || 'User')}&background=fdb615&color=fff`,
      birthday: p.birthday || p.birth_date || p.birthdate || p.data_nascimento || p.nascimento || p.aniversario || '',
      skills: skills.filter((s: string) => !s.startsWith('[DISP:') && !s.startsWith('[BADGE:')),
      onboarding_completed: p.onboarding_completed ?? true, // Default to true for existing users
      unavailableDates: skills
        .filter((s: string) => s.startsWith('[DISP:'))
        .map((s: string) => s.match(/\[DISP:(.+?)\]/)?.[1])
        .filter(Boolean) as string[],
      badges: computedBadges,
      rawSkills: skills
    };
  });
};

export const fetchPosts = async (): Promise<Post[]> => {
  const { data, error } = await supabase.from('posts').select('*').order('timestamp', { ascending: false });
  if (error) throw error;
  return (data || []).map((p: any) => ({
    id: p.id, authorId: p.author_id, content: p.content, type: p.type,
    timestamp: new Date(p.timestamp).toLocaleString('pt-BR'),
    likes: p.likes || 0, comments: p.comments || 0, image: p.image, pollOptions: p.poll_options
  }));
};

export const fetchTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase.from('tasks').select('*');
  if (error) throw error;
  return (data || []).map((t: any) => ({
    id: t.id, title: t.title, description: t.description, assigneeIds: t.assignee_ids || [],
    dueDate: t.due_date, priority: t.priority, status: t.status, tags: t.tags || []
  }));
};

export const fetchSchedules = async (): Promise<ScheduleEvent[]> => {
  const { data, error } = await supabase.from('schedules').select('*').order('date', { ascending: true });
  if (error) throw error;
  return (data || []).map((s: any) => ({
    id: s.id, title: s.title, date: s.date, time: s.time, type: s.type, roles: s.roles || []
  }));
};

export const fetchTrainingData = async (currentUserId?: string): Promise<Course[]> => {
  const [coursesRes, lessonsRes, progressRes] = await Promise.all([
    supabase.from('courses').select('*'),
    supabase.from('lessons').select('id, course_id'),
    supabase.from('user_progress').select('lesson_id, user_id')
  ]);
  
  if (coursesRes.error) throw coursesRes.error;

  return (coursesRes.data || []).map((c: any) => {
    const courseLessons = (lessonsRes.data || []).filter((l: any) => l.course_id === c.id);
    const completed = (progressRes.data || []).filter((up: any) => 
      currentUserId && up.user_id === currentUserId && courseLessons.some((l: any) => l.id === up.lesson_id)
    ).length;
    return {
      id: c.id, title: c.title, category: c.category, thumbnail: c.cover_image,
      lessonsCount: courseLessons.length, progress: courseLessons.length > 0 ? Math.round((completed / courseLessons.length) * 100) : 0
    };
  });
};

export const fetchInventory = async (): Promise<InventoryItem[]> => {
  const { data, error } = await supabase.from('inventory').select('*');
  if (error) throw error;
  return (data || []).map((i: any) => ({
    id: i.id, name: i.name, description: i.description, condition: i.condition, status: i.status, holderId: i.holder_id, image: i.image
  }));
};

export const fetchFinancialData = async () => {
  const [acc, cat, proj, trans] = await Promise.all([
    supabase.from('financial_accounts').select('*'),
    supabase.from('financial_categories').select('*'),
    supabase.from('financial_projects').select('*'),
    supabase.from('financial_transactions').select('*').order('date', { ascending: false })
  ]);
  
  return {
    accounts: acc.data || [] as FinancialAccount[],
    categories: cat.data || [] as FinancialCategory[],
    projects: (proj.data || []).map((p: any) => ({
      id: p.id, name: p.name, description: p.description, budgetPlanned: p.budget_planned || 0, budgetExecuted: p.budget_executed || 0
    })) as FinancialProject[],
    transactions: (trans.data || []).map((t: any) => ({
      id: t.id, type: t.type, value: t.value, date: t.date, categoryId: t.category_id, accountId: t.account_id,
      toAccountId: t.to_account_id, projectId: t.project_id, paymentMethod: t.payment_method, description: t.description, status: t.status, createdAt: t.created_at
    })) as FinancialTransaction[]
  };
};

export const fetchNotifications = async (userId: string): Promise<AppNotification[]> => {
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data || []).map((n: any) => ({
    id: n.id, userId: n.user_id, type: n.type, title: n.title, content: n.content, isRead: n.is_read, createdAt: n.created_at, relatedId: n.related_id
  }));
};
