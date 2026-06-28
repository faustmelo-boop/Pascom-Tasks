import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ScheduleEvent, User, UserRole, isCoordinator } from "../types";
import { supabase } from "../supabaseClient";
import { lmsService } from "../lmsService";
import {
  Calendar as CalendarIcon,
  User as UserIcon,
  Clock,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  Loader2,
  Save,
  Users,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SchedulesProps {
  schedules: ScheduleEvent[];
  users: User[];
  currentUser: User;
  onRefresh: () => void;
}

// Helper interface for the form form state
interface AssignmentRow {
  userId: string; // empty string means "Vago"
  role: string;
}

export const Schedules: React.FC<SchedulesProps> = ({
  schedules,
  users,
  currentUser,
  onRefresh,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Archive confirmation state
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);

  // Decline Justification Modal State
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineData, setDeclineData] = useState<{
    scheduleId: string;
    roleIndex: number;
  } | null>(null);
  const [justification, setJustification] = useState("");

  // Availability State
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [unavailableDate, setUnavailableDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());

  // Delete States
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<{
    title: string;
    msg: string;
    code?: string;
  } | null>(null);
  const [expandedDates, setExpandedDates] = useState<{
    [date: string]: boolean;
  }>({});

  // Scroll lock when modal is open
  useEffect(() => {
    const scrollContainer = document.querySelector(".overflow-y-auto.flex-1");
    const isAnyModalOpen =
      isModalOpen ||
      declineModalOpen ||
      availabilityModalOpen ||
      deleteId ||
      archiveConfirmId;

    if (isAnyModalOpen) {
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.style.overflow = "hidden";
      }
      document.body.style.overflow = "hidden";
    } else {
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.style.overflow = "auto";
      }
      document.body.style.overflow = "unset";
    }

    return () => {
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.style.overflow = "auto";
      }
      document.body.style.overflow = "unset";
    };
  }, [
    isModalOpen,
    declineModalOpen,
    availabilityModalOpen,
    deleteId,
    archiveConfirmId,
  ]);

  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    title: string;
    date: string;
    time: string;
    type: "Missa" | "Evento" | "Reunião";
    assignments: AssignmentRow[];
    archived: boolean;
  }>({
    title: "",
    date: new Date().toISOString().split("T")[0],
    time: "19:00",
    type: "Missa",
    assignments: [{ userId: "", role: "" }],
    archived: false,
  });

  // Robust check for Admin role unificado
  const isAdmin = currentUser && isCoordinator(currentUser.role);

  const getUser = (id?: string | null) => users.find((u) => u.id === id);

  // --- Calendar state and helper derivations ---
  const calendarYear = calendarDate.getFullYear();
  const calendarMonth = calendarDate.getMonth();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();

  const daysGrid: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    daysGrid.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push(d);
  }

  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const monthNamesStr = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const currentMonthUnavailable = (currentUser.unavailableDates || [])
    .filter((d) => d?.startsWith(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`))
    .sort();

  const handlePrevMonth = () => {
    setCalendarDate(new Date(calendarYear, calendarMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarDate(new Date(calendarYear, calendarMonth + 1, 1));
  };

  // --- Handlers ---

  const handleOpenModal = (schedule?: ScheduleEvent, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setGlobalError(null);

    if (schedule) {
      setEditingId(schedule.id);

      // Map existing roles to assignment rows
      const existingAssignments: AssignmentRow[] = (schedule.roles || []).map((r) => ({
        userId: r.assignedUserId || "",
        role: r.roleName,
      }));

      // Workaround: Archive status determined by title prefix
      const isArchived = schedule.title.startsWith("[ARCHIVED] ");
      const cleanTitle = isArchived
        ? schedule.title.replace("[ARCHIVED] ", "")
        : schedule.title;

      setFormData({
        title: cleanTitle,
        date: schedule.date,
        time: schedule.time,
        type: schedule.type,
        assignments:
          existingAssignments.length > 0
            ? existingAssignments
            : [{ userId: "", role: "" }],
        archived: isArchived,
      });
    } else {
      setEditingId(null);
      setFormData({
        title: "",
        date: new Date().toISOString().split("T")[0],
        time: "19:00",
        type: "Missa",
        assignments: [{ userId: "", role: "" }],
        archived: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.date) return;
    setLoading(true);
    setGlobalError(null);

    try {
      // Find original schedule to preserve status if possible, although simpler to reset if admin edits assignments
      const originalSchedule = editingId
        ? schedules.find((s) => s.id === editingId)
        : null;

      // Prepare roles structure
      const newRolesStructure = formData.assignments
        .filter((a) => a.role.trim() !== "")
        .map((a, idx) => {
          // Try to keep existing status if the user and role name match the original position
          // This is a basic heuristic. If assignments are reordered, status might be lost, which is acceptable for MVP.
          let existingStatus = "pending";
          let existingJustification = undefined;

          if (originalSchedule && originalSchedule.roles[idx]) {
            const originalRole = originalSchedule.roles[idx];
            if (
              originalRole.roleName === a.role &&
              originalRole.assignedUserId === a.userId
            ) {
              existingStatus = originalRole.status || "pending";
              existingJustification = originalRole.justification;
            }
          }

          return {
            roleName: a.role,
            assignedUserId: a.userId || null,
            status: a.userId ? existingStatus : undefined,
            justification: existingJustification,
          };
        });

      let finalScheduleId = editingId;
      // Workaround: Use title prefix for archive status
      const finalTitle = formData.archived
        ? `[ARCHIVED] ${formData.title}`
        : formData.title;

      if (editingId) {
        // Edit Mode
        const { error } = await supabase
          .from("schedules")
          .update({
            title: finalTitle,
            date: formData.date,
            time: formData.time,
            type: formData.type,
            roles: newRolesStructure,
          })
          .eq("id", editingId);

        if (error) throw error;
      } else {
        // Create Mode
        const { data: newSchedule, error } = await supabase
          .from("schedules")
          .insert([
            {
              title: finalTitle,
              date: formData.date,
              time: formData.time,
              type: formData.type,
              roles: newRolesStructure,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        finalScheduleId = newSchedule.id;
      }

      // --- NOTIFICATIONS (Safe Block) ---
      try {
        if (finalScheduleId) {
          const usersToNotify = newRolesStructure
            .filter(
              (r) => r.assignedUserId,
            )
            .map((r) => ({
              user_id: r.assignedUserId,
              type: "schedule_update",
              title: "Escala Atualizada",
              content: `Você foi escalado para: ${r.roleName} em "${formData.title}" (${new Date(formData.date).toLocaleDateString("pt-BR")})`,
              related_id: finalScheduleId,
            }));

          if (usersToNotify.length > 0) {
            await supabase.from("notifications").insert(usersToNotify);
          }
        }
      } catch (notifyError) {
        console.warn("Falha ao enviar notificação de escala:", notifyError);
      }

      onRefresh();
      setIsModalOpen(false);
    } catch (error: any) {
      console.error("Error saving schedule:", error);
      setGlobalError({
        title: "Erro ao salvar",
        msg: error.message,
        code: error.code,
      });
    } finally {
      setLoading(false);
    }
  };

  const onRequestDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setGlobalError(null);
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("schedules")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;

      setDeleteId(null);
      onRefresh();
    } catch (error: any) {
      console.error("Error deleting:", error);
      setGlobalError({
        title: "Erro ao excluir",
        msg: error.message,
      });
      setDeleteId(null);
    } finally {
      setLoading(false);
    }
  };

  const updateType = (type: "Missa" | "Evento" | "Reunião") => {
    let newAssignments = [...formData.assignments];
    let newTime = formData.time;

    if (type === "Missa") {
      newTime = "19:00";
    } else if (type === "Reunião") {
      newTime = "20:00";
      // Auto-assign everyone for meetings if it's a new or empty schedule
      if (
        formData.assignments.length <= 1 &&
        !formData.assignments[0]?.userId
      ) {
        newAssignments = users
          .filter((u) => !u.unavailableDates?.includes(formData.date))
          .map((u) => ({ userId: u.id, role: "Participante" }));
      }
    }

    setFormData({
      ...formData,
      type,
      time: newTime,
      assignments:
        newAssignments.length > 0 ? newAssignments : [{ userId: "", role: "" }],
    });
  };

  // --- Attendance Logic ---

  const handleToggleRole = async (
    schedule: ScheduleEvent,
    roleIndex: number,
  ) => {
    // "Assumir" logic (Take the role)
    const loadingKey = `${schedule.id}-${roleIndex}`;
    setRoleLoading(loadingKey);
    setGlobalError(null);

    try {
      const role = schedule.roles[roleIndex];
      const newRoles = [...schedule.roles];

      // If assigning self
      if (!role.assignedUserId || role.status === "declined") {
        // Warning if taking role on unavailable date
        const isUnavailable = currentUser.unavailableDates?.includes(
          schedule.date,
        );
        if (isUnavailable) {
          const confirm = window.confirm(
            "Atenção: Você marcou este dia como indisponível. Deseja mesmo assumir esta função?",
          );
          if (!confirm) return;
        }

        newRoles[roleIndex] = {
          ...role,
          assignedUserId: currentUser.id,
          status: "pending", // Default to pending so they can confirm
          justification: undefined,
        };
      } else {
        // If unassigning (simple 'Sair' without decline flow if needed, but we use Recusar now mainly)
        newRoles[roleIndex] = {
          ...role,
          assignedUserId: null,
          status: undefined,
          justification: undefined,
        };
      }

      const { error } = await supabase
        .from("schedules")
        .update({ roles: newRoles })
        .eq("id", schedule.id);

      if (error) throw error;
      onRefresh();
    } catch (error: any) {
      console.error("Error toggling role:", error);
      alert(`Erro ao atualizar função: ${error.message}`);
    } finally {
      setRoleLoading(null);
    }
  };

  const handleConfirmPresence = async (
    schedule: ScheduleEvent,
    roleIndex: number,
  ) => {
    const loadingKey = `${schedule.id}-${roleIndex}`;
    setRoleLoading(loadingKey);

    try {
      const newRoles = [...schedule.roles];
      newRoles[roleIndex] = { ...newRoles[roleIndex], status: "confirmed" };

      const { error } = await supabase
        .from("schedules")
        .update({ roles: newRoles })
        .eq("id", schedule.id);

      if (error) throw error;

      if (currentUser) {
        await lmsService.earnXP(currentUser.id, 100);
      }
      onRefresh();
    } catch (e: any) {
      alert(`Erro ao confirmar: ${e.message}`);
    } finally {
      setRoleLoading(null);
    }
  };

  const handleOpenDeclineModal = (scheduleId: string, roleIndex: number) => {
    setDeclineData({ scheduleId, roleIndex });
    setJustification("");
    setDeclineModalOpen(true);
  };

  const handleSubmitDecline = async () => {
    if (!declineData) return;

    const schedule = schedules.find((s) => s.id === declineData.scheduleId);
    if (!schedule) return;

    setLoading(true);

    try {
      const newRoles = [...schedule.roles];
      // We keep the assignedUserId so admins see WHO declined, but mark status declined
      newRoles[declineData.roleIndex] = {
        ...newRoles[declineData.roleIndex],
        status: "declined",
        justification: justification,
      };

      const { error } = await supabase
        .from("schedules")
        .update({ roles: newRoles })
        .eq("id", schedule.id);

      if (error) throw error;

      onRefresh();
      setDeclineModalOpen(false);
    } catch (e: any) {
      alert(`Erro ao recusar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- Form Assignment Manipulation ---

  const addAssignmentRow = () => {
    setFormData((prev) => ({
      ...prev,
      assignments: [...prev.assignments, { userId: "", role: "" }],
    }));
  };

  const removeAssignmentRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      assignments: prev.assignments.filter((_, i) => i !== index),
    }));
  };

  const updateAssignment = (
    index: number,
    field: keyof AssignmentRow,
    value: string,
  ) => {
    const newAssignments = [...formData.assignments];
    newAssignments[index] = { ...newAssignments[index], [field]: value };
    setFormData({ ...formData, assignments: newAssignments });
  };

  const handleArchive = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setArchiveConfirmId(id);
  };

  const confirmArchive = async () => {
    if (!archiveConfirmId) return;
    setLoading(true);
    try {
      const schedule = schedules.find((s) => s.id === archiveConfirmId);
      if (!schedule) return;

      const newTitle = `[ARCHIVED] ${schedule.title}`;
      const { error } = await supabase
        .from("schedules")
        .update({ title: newTitle })
        .eq("id", archiveConfirmId);
      if (error) throw error;
      setArchiveConfirmId(null);
      onRefresh();
    } catch (e: any) {
      alert(`Erro ao arquivar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnarchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const schedule = schedules.find((s) => s.id === id);
      if (!schedule) return;

      const newTitle = schedule.title.replace("[ARCHIVED] ", "");
      const { error } = await supabase
        .from("schedules")
        .update({ title: newTitle })
        .eq("id", id);
      if (error) throw error;
      onRefresh();
    } catch (e: any) {
      alert(`Erro ao restaurar: ${e.message}`);
    }
  };

  const handleToggleAvailabilityDate = async (dateStr: string) => {
    setLoading(true);
    try {
      const currentUnavailable = currentUser.unavailableDates || [];
      let newUnavailableDates: string[];
      
      const isAlreadyUnavailable = currentUnavailable.includes(dateStr);
      if (isAlreadyUnavailable) {
        newUnavailableDates = currentUnavailable.filter((d) => d !== dateStr);
      } else {
        newUnavailableDates = [...currentUnavailable, dateStr];
      }

      // Reconstruct full skills list for database: existing skills + all badges + all unavailable dates
      const badgeTags = (currentUser.rawSkills || []).filter(s => s.startsWith('[BADGE:'));
      const newSkills = [
        ...(currentUser.skills || []),
        ...badgeTags,
        ...newUnavailableDates.map((d) => `[DISP:${d}]`),
      ];

      const { error } = await supabase
        .from("profiles")
        .update({ skills: newSkills })
        .eq("id", currentUser.id);
        
      if (error) throw error;
      onRefresh();
    } catch (e: any) {
      alert(`Erro ao atualizar disponibilidade: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- Helper Functions for Schedules Scaling & Mobile view ---
  const groupSchedulesByDate = (events: ScheduleEvent[]) => {
    const groups: { [date: string]: ScheduleEvent[] } = {};
    const sorted = [...events].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    sorted.forEach((event) => {
      if (!groups[event.date]) {
        groups[event.date] = [];
      }
      groups[event.date].push(event);
    });

    return groups;
  };

  const getAgentAssignmentInfo = (
    userId: string,
    currentIndex: number,
    date: string,
  ) => {
    if (!userId) return null;
    const inOtherDaySchedules = schedules.filter(
      (s) =>
        s.date === date &&
        s.id !== editingId &&
        s.roles.some((r) => r.assignedUserId === userId),
    );

    const inThisEvent = formData.assignments.some(
      (row, idx) => idx !== currentIndex && row.userId === userId,
    );

    return {
      inOtherSchedules: inOtherDaySchedules,
      inThisEvent,
    };
  };

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const renderEventCard = (event: ScheduleEvent, index: number) => {
    const isArchived = event.title.startsWith("[ARCHIVED] ");
    const displayTitle = isArchived
      ? event.title.replace("[ARCHIVED] ", "")
      : event.title;

    return (
      <motion.div
        key={event.id}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: index * 0.05 }}
        className="group relative bg-white border border-slate-100 rounded-[2.5rem] p-6 sm:p-8 shadow-sm hover:shadow-2xl hover:shadow-slate-200/50 hover:border-brand-blue/20 transition-all duration-500 flex flex-col w-full text-left"
      >
        {isArchived && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-100 text-slate-500 text-[9px] font-black uppercase px-6 py-1.5 rounded-full z-10 border border-slate-200">
            Contexto Histórico
          </div>
        )}

        {/* Header do Card */}
        <div className="flex justify-between items-start mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-12 ${event.type === "Missa" ? "bg-brand-yellow/10 text-brand-yellow shadow-lg shadow-brand-yellow/5" : "bg-brand-blue/10 text-brand-blue shadow-lg shadow-brand-blue/5"}`}
            >
              <CalendarIcon size={28} />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight group-hover:text-brand-blue transition-colors">
                {displayTitle}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {event.type}
                </span>
                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest">
                  {event.time}h
                </span>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="flex gap-2 lg:opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-300">
              <button
                onClick={(e) =>
                  isArchived
                    ? handleUnarchive(event.id, e)
                    : handleArchive(event.id, e)
                }
                title={isArchived ? "Restaurar" : "Arquivar"}
                className={`p-2.5 rounded-2xl transition-all ${isArchived ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-amber-50 text-amber-600 hover:bg-amber-100"}`}
              >
                <Save size={14} strokeWidth={2.5} />
              </button>
              <button
                onClick={(e) => handleOpenModal(event, e)}
                title="Editar"
                className="p-2.5 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white rounded-2xl transition-all"
              >
                <Edit2 size={14} strokeWidth={2.5} />
              </button>
              <button
                onClick={(e) => onRequestDelete(event.id, e)}
                title="Excluir"
                className="p-2.5 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all"
              >
                <Trash2 size={14} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
            <CalendarIcon size={16} className="text-brand-blue shrink-0" />
            <div className="min-w-0">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">
                Data
              </p>
              <p className="text-[11px] font-extrabold text-slate-700 capitalize truncate">
                {new Date(event.date + "T00:00:00").toLocaleDateString(
                  "pt-BR",
                  { weekday: "short", day: "numeric", month: "short" },
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
            <Clock size={16} className="text-brand-blue shrink-0" />
            <div className="min-w-0">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">
                Horário
              </p>
              <p className="text-[11px] font-extrabold text-slate-700 truncate">
                {event.time}h
              </p>
            </div>
          </div>
        </div>

        {/* Roles List */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">
              Equipe Escalada
            </h4>
            <div className="flex -space-x-1.5 shrink-0">
              {(event.roles || []).slice(0, 4).map((r, i) => {
                const u = getUser(r.assignedUserId);
                return u ? (
                  <img
                    key={i}
                    src={u.avatar}
                    className="w-5 h-5 rounded-full border-2 border-white ring-1 ring-slate-100 object-cover"
                    alt=""
                  />
                ) : null;
              })}
            </div>
          </div>

          {(!event.roles || event.roles.length === 0) ? (
            <div className="p-5 bg-amber-50/50 border border-dashed border-amber-200 rounded-3xl text-center space-y-3">
              <div className="flex justify-center text-amber-500">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 className="text-xs font-black text-amber-800 leading-none mb-1">
                  Sugestão de Escala de Evento
                </h4>
                <p className="text-[10px] text-amber-700/80 font-bold leading-normal">
                  Este compromisso veio da Agenda da Paróquia. Defina a equipe que atuará neste dia!
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={(e) => handleOpenModal(event, e)}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-xl font-bold text-[9px] uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={12} strokeWidth={3} /> Configurar Escala
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {(event.roles || []).map((role, idx) => {
                const agent = getUser(role.assignedUserId);
                const isAssignedToMe = role.assignedUserId === currentUser.id;
                const status = role.status || "pending";
                const isDeclined = status === "declined";
                const isConfirmed = status === "confirmed";
                const isLoading = roleLoading === `${event.id}-${idx}`;

                return (
                  <div
                    key={idx}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-300 ${isAssignedToMe ? "bg-brand-blue/[0.03] border-brand-blue/20 ring-4 ring-brand-blue/5" : isDeclined ? "bg-rose-50/30 border-rose-100/50 opacity-60" : "bg-white border-slate-50 hover:border-slate-200"}`}
                  >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 bg-white overflow-hidden shrink-0 ${isAssignedToMe ? "ring-2 ring-brand-blue" : ""}`}
                      >
                        {agent ? (
                          <img
                            src={agent.avatar}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <UserIcon size={16} className="text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 tracking-tight leading-none truncate">
                          {role.roleName}
                        </p>
                        <p
                          className={`text-[11px] font-bold mt-1 ${agent ? "text-slate-400" : "text-amber-600 italic uppercase tracking-tighter"} truncate`}
                        >
                          {agent ? agent.name : "Vaga Aberta"}
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                      {agent && !isDeclined && (
                        <div
                          className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border shadow-sm ${isConfirmed ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-100/50 text-amber-600 border-amber-200"}`}
                        >
                          {isConfirmed ? "Confirmado" : "Aguardando"}
                        </div>
                      )}
                      {isDeclined && (
                        <div className="text-[8px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full uppercase tracking-widest border border-rose-200 shadow-sm">
                          Impossibilitado
                        </div>
                      )}

                      <div className="flex gap-2">
                        {isLoading ? (
                          <Loader2
                            size={14}
                            className="animate-spin text-brand-blue"
                          />
                        ) : (
                          <>
                            {isAssignedToMe && !isDeclined && (
                              <div className="flex gap-1">
                                {!isConfirmed && (
                                  <button
                                    onClick={() =>
                                      handleConfirmPresence(event, idx)
                                    }
                                    className="bg-brand-blue text-white px-3 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest shadow-md shadow-brand-blue/10 hover:scale-105 active:scale-95 transition-all"
                                  >
                                    Confirmar
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    handleOpenDeclineModal(event.id, idx)
                                  }
                                  className="bg-rose-50 text-rose-600 border border-rose-100 px-3 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-rose-100 transition-all"
                                >
                                  Recusar
                                </button>
                              </div>
                            )}

                            {(!agent || isDeclined) && !isAssignedToMe && (
                              <button
                                onClick={() => handleToggleRole(event, idx)}
                                className="group/btn flex items-center gap-1 text-[9px] text-brand-blue bg-white border border-brand-blue/10 hover:border-brand-blue hover:bg-brand-blue hover:text-white px-3 py-1 rounded-lg font-black transition-all shadow-sm uppercase tracking-widest active:scale-95"
                              >
                                Candidatar{" "}
                                <ChevronRight
                                  size={10}
                                  className="group-hover/btn:translate-x-0.5 transition-transform"
                                />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isDeclined && role.justification && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-2 ml-12 p-3 bg-rose-50/30 rounded-lg border border-rose-100/50 text-[10px] text-rose-500 font-bold italic leading-relaxed"
                      >
                        <p className="text-[8px] font-black uppercase text-rose-400 tracking-[0.1em] mb-1">
                          Nota de Recusa:
                        </p>
                        "{role.justification}"
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

  const displayedSchedules = schedules.filter((s) => {
    const isArchived = s.title.startsWith("[ARCHIVED] ");
    return isArchived === showHistory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 pt-1 md:p-10 space-y-8 min-h-screen pb-32">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 py-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-blue rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl shadow-brand-blue/30 rotate-3">
              <CalendarDays size={28} />
            </div>
            <div className="px-4 py-2 bg-brand-blue/10 rounded-full border border-brand-blue/10">
              <p className="text-[10px] font-black text-brand-blue uppercase tracking-[0.3em]">
                Planejamento Estratégico
              </p>
            </div>
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
              Escalas da Equipe
            </h1>
            <p className="text-slate-400 font-medium text-lg italic mt-2">
              Nossa organização a serviço do Evangelho.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-wrap items-center gap-3"
        >
          <button
            onClick={() => setAvailabilityModalOpen(true)}
            className="bg-white text-slate-600 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border border-slate-100 flex items-center gap-3 hover:bg-slate-50 active:scale-95 shadow-sm"
          >
            <CalendarIcon size={18} className="text-brand-green" /> Minha
            Disponibilidade
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center gap-3 active:scale-95 shadow-sm border ${showHistory ? "bg-slate-900 text-white border-slate-900 shadow-xl" : "bg-white text-slate-600 border-slate-100"}`}
          >
            <Clock size={18} />{" "}
            {showHistory ? "Ver Atuais" : "Consultar Histórico"}
          </button>

          {isAdmin && (
            <button
              onClick={() => handleOpenModal()}
              className="bg-brand-blue text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-[0_20px_40px_-10px_rgba(59,130,246,0.3)] flex items-center gap-3 hover:scale-105 active:scale-95"
            >
              <Plus size={18} strokeWidth={3} /> Nova Escala
            </button>
          )}
        </motion.div>
      </header>

      {/* Global Error Banner */}
      <AnimatePresence>
        {globalError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] flex items-start gap-5 shadow-sm overflow-hidden"
          >
            <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <h3 className="text-rose-900 font-black uppercase text-xs tracking-widest">
                {globalError.title}
              </h3>
              <p className="text-rose-700 text-sm mt-2 leading-relaxed font-medium">
                {globalError.msg}
              </p>
              {globalError.code && (
                <span className="text-[10px] font-black text-rose-300 mt-3 inline-block uppercase tracking-widest">
                  ERROR REF: {globalError.code}
                </span>
              )}
            </div>
            <button
              onClick={() => setGlobalError(null)}
              className="text-rose-300 hover:text-rose-600 transition-colors p-2"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid of Schedules */}

      {/* DESKTOP VERSION (Traditional chronological grid) */}
      <div className="hidden md:grid md:grid-cols-2 gap-10">
        <AnimatePresence mode="popLayout">
          {displayedSchedules.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full h-80 flex flex-col items-center justify-center text-slate-300 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 italic"
            >
              <CalendarIcon className="mb-6 opacity-10" size={80} />
              <p className="text-lg font-bold">
                Nenhuma escala {showHistory ? "no histórico" : "agendada"}.
              </p>
            </motion.div>
          ) : (
            displayedSchedules.map((event, index) =>
              renderEventCard(event, index),
            )
          )}
        </AnimatePresence>
      </div>

      {/* MOBILE VERSION (Grouped by day in expandable/accordion guides) */}
      <div className="md:hidden flex flex-col gap-4">
        <AnimatePresence mode="popLayout">
          {displayedSchedules.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-80 flex flex-col items-center justify-center text-slate-300 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 italic whitespace-normal text-center p-6"
            >
              <CalendarIcon className="mb-6 opacity-10" size={64} />
              <p className="text-base font-bold">
                Nenhuma escala {showHistory ? "no histórico" : "agendada"}.
              </p>
            </motion.div>
          ) : (
            (() => {
              const grouped = groupSchedulesByDate(displayedSchedules);
              const dates = Object.keys(grouped).sort(
                (a, b) => new Date(a).getTime() - new Date(b).getTime(),
              );

              return dates.map((date, idx) => {
                const isExpanded =
                  expandedDates[date] !== undefined
                    ? expandedDates[date]
                    : idx === 0;

                const isUserScheduledOnThisDay = grouped[date].some((event) =>
                  (event.roles || []).some(
                    (r) =>
                      r.assignedUserId === currentUser.id &&
                      r.status !== "declined",
                  ),
                );

                return (
                  <div key={date} className="space-y-3">
                    <button
                      onClick={() => toggleDate(date)}
                      className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:border-brand-blue/20 transition-all text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative w-10 h-10 bg-brand-blue/5 text-brand-blue rounded-xl flex items-center justify-center shrink-0">
                          <CalendarDays size={18} />
                          {isUserScheduledOnThisDay && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white"></span>
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900 capitalize tracking-tight leading-none truncate">
                            {new Date(date + "T00:00:00").toLocaleDateString(
                              "pt-BR",
                              {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                              },
                            )}
                          </h4>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                            <span>
                              {grouped[date].length}{" "}
                              {grouped[date].length === 1 ? "Escala" : "Escalas"}
                            </span>
                            {isUserScheduledOnThisDay && (
                              <>
                                <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                <span className="text-emerald-600 font-extrabold normal-case tracking-normal">Você escalado</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <motion.div
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 15,
                          }}
                          className="p-1.5 text-slate-400"
                        >
                          <ChevronRight size={18} />
                        </motion.div>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden space-y-4 pt-1"
                        >
                          {grouped[date].map((event, eventIdx) => {
                            const originalIdx = displayedSchedules.findIndex(
                              (e) => e.id === event.id,
                            );
                            return renderEventCard(
                              event,
                              originalIdx >= 0 ? originalIdx : eventIdx,
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              });
            })()
          )}
        </AnimatePresence>
      </div>

      {/* PORTALED MODALS */}
      {createPortal(
        <AnimatePresence>
          {/* CONFIRM DELETE MODAL */}
          {deleteId && (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                onClick={() => setDeleteId(null)}
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-[2.5rem] shadow-2xl p-10 max-w-sm w-full text-center relative z-[2010]"
              >
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-[2.2rem] flex items-center justify-center mx-auto mb-8 shadow-inner ring-8 ring-rose-50/50">
                  <Trash2 size={32} strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                  Excluir Escala?
                </h3>
                <p className="text-slate-400 font-bold text-sm mb-10 leading-relaxed italic px-4">
                  Esta operação é irreversível e removerá todos os dados de
                  alocação da equipe.
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={confirmDelete}
                    disabled={loading}
                    className="w-full py-5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-rose-500/20 flex items-center justify-center gap-3 active:scale-95"
                  >
                    {loading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                    Confirmar Exclusão
                  </button>
                  <button
                    onClick={() => setDeleteId(null)}
                    className="w-full py-5 text-slate-400 hover:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-slate-50"
                    disabled={loading}
                  >
                    Cancelar Operação
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* CONFIRM ARCHIVE MODAL */}
          {archiveConfirmId && (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                onClick={() => setArchiveConfirmId(null)}
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-[2.5rem] shadow-2xl p-10 max-w-sm w-full text-center relative z-[2010]"
              >
                <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-[2.2rem] flex items-center justify-center mx-auto mb-8 shadow-inner ring-8 ring-amber-50/50">
                  <Save size={32} strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                  Arquivar Escala?
                </h3>
                <p className="text-slate-400 font-bold text-sm mb-10 leading-relaxed italic px-4">
                  Esta escala será movida para o histórico da Pascom, liberando a visualização principal.
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={confirmArchive}
                    disabled={loading}
                    className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 active:scale-95"
                  >
                    {loading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    Confirmar Arquivamento
                  </button>
                  <button
                    onClick={() => setArchiveConfirmId(null)}
                    className="w-full py-5 text-slate-400 hover:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:bg-slate-50"
                    disabled={loading}
                  >
                    Cancelar Operação
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* DECLINE JUSTIFICATION MODAL */}
          {declineModalOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
                onClick={() => setDeclineModalOpen(false)}
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden relative z-[1010]"
              >
                <div className="px-10 py-10 border-b border-slate-50 flex justify-between items-center bg-slate-900 relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
                  <div className="relative z-10">
                    <h3 className="text-2xl font-black text-white flex items-center gap-3 tracking-tight uppercase leading-none mb-1">
                      <ThumbsDown size={24} /> Recusar
                    </h3>
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                      Informe sua coordenação
                    </p>
                  </div>
                  <button
                    onClick={() => setDeclineModalOpen(false)}
                    className="p-4 bg-white/10 text-white/50 hover:text-white rounded-[1.5rem] border border-white/5 backdrop-blur-md transition-all active:scale-90 relative z-10"
                  >
                    <X size={24} strokeWidth={3} />
                  </button>
                </div>

                <div className="p-10 space-y-6">
                  <p className="text-sm font-bold text-slate-500 leading-relaxed italic">
                    Sua transparência ajuda a Pascom a manter o fluxo constante
                    de serviço. Por que você não pode assumir esta função?
                  </p>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Observações Técnicas / Motivos
                    </label>
                    <textarea
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-100 rounded-[2rem] p-6 text-sm font-bold focus:ring-8 focus:ring-rose-50 focus:border-rose-200 outline-none resize-none h-40 transition-all placeholder:text-slate-300"
                      placeholder="Descreva brevemente o impedimento..."
                    ></textarea>
                  </div>

                  <button
                    onClick={handleSubmitDecline}
                    disabled={!justification.trim() || loading}
                    className="w-full bg-rose-500 text-white font-black py-6 rounded-2xl shadow-2xl shadow-rose-500/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-[0.2em] disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <MessageSquare size={20} />
                    )}
                    Registrar Recusa Oficial
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* CREATE / EDIT MODAL */}
          {isModalOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl"
                onClick={() => setIsModalOpen(false)}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 30 }}
                className="bg-white rounded-[3rem] w-full max-w-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.25)] flex flex-col max-h-[90vh] overflow-hidden relative z-[1010]"
              >
                <div className="px-10 py-10 border-b border-slate-50 flex justify-between items-center bg-slate-900 relative group/header">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
                  <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/10 shadow-lg group-hover/header:rotate-12 duration-500">
                      <CalendarIcon size={32} />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-white tracking-tighter leading-none mb-1">
                        {editingId ? "Ajustar Atividade" : "Planejar Momento"}
                      </h3>
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
                        Gerenciamento de Recurso Humano
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-4 bg-white/10 text-white/50 hover:text-white rounded-[1.5rem] border border-white/5 backdrop-blur-md transition-all active:scale-90 relative z-10"
                  >
                    <X size={24} strokeWidth={3} />
                  </button>
                </div>

                <div className="p-10 overflow-y-auto flex-1 space-y-10 hide-scroll">
                  {/* Content would go here - for brevity, keeping the flow */}
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          O que teremos?
                        </label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) =>
                            setFormData({ ...formData, title: e.target.value })
                          }
                          className="w-full bg-slate-50 border border-slate-100 px-6 py-5 rounded-[1.5rem] font-bold text-sm focus:ring-8 focus:ring-brand-blue/5 outline-none"
                          placeholder="Ex: Missa de Domingo"
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Modalidade
                        </label>
                        <div className="flex gap-2">
                          {["Missa", "Evento", "Reunião"].map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => updateType(t as any)}
                              className={`flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${formData.type === t ? "bg-brand-blue text-white shadow-xl shadow-brand-blue/20" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Data Programada
                        </label>
                        <input
                          type="date"
                          value={formData.date}
                          onChange={(e) =>
                            setFormData({ ...formData, date: e.target.value })
                          }
                          className="w-full bg-slate-50 border border-slate-100 px-6 py-5 rounded-[1.5rem] font-bold text-sm focus:ring-8 focus:ring-brand-blue/5 outline-none"
                        />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Horário (24h)
                        </label>
                        <input
                          type="time"
                          value={formData.time}
                          onChange={(e) =>
                            setFormData({ ...formData, time: e.target.value })
                          }
                          className="w-full bg-slate-50 border border-slate-100 px-6 py-5 rounded-[1.5rem] font-bold text-sm focus:ring-8 focus:ring-brand-blue/5 outline-none"
                        />
                      </div>
                    </div>

                    {/* Assignments Section in Modal */}
                    <div className="space-y-6 pt-10 border-t border-slate-50">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                          <Users className="text-brand-blue" />
                          Atribuições da Equipe
                        </h4>
                        <button
                          onClick={addAssignmentRow}
                          className="bg-slate-900 text-white px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
                        >
                          <Plus size={14} strokeWidth={3} /> Adicionar Posto
                        </button>
                      </div>

                      <div className="space-y-4">
                        {formData.assignments.map((row, index) => (
                          <div
                            key={index}
                            className="flex flex-col sm:flex-row gap-4 p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 group/row relative"
                          >
                            <div className="flex-1 space-y-3">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Função / Posto
                              </label>
                              <input
                                type="text"
                                value={row.role}
                                onChange={(e) =>
                                  updateAssignment(
                                    index,
                                    "role",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-white border border-slate-200 px-5 py-4 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-brand-blue/5 outline-none"
                                placeholder="Ex: Fotografia, Redes Sociais..."
                              />
                            </div>
                            <div className="flex-1 space-y-3">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Servidor Designado
                              </label>
                              <select
                                value={row.userId}
                                onChange={(e) =>
                                  updateAssignment(
                                    index,
                                    "userId",
                                    e.target.value,
                                  )
                                }
                                className={`w-full border px-5 py-4 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-brand-blue/5 outline-none transition-all ${row.userId && users.find((u) => u.id === row.userId)?.unavailableDates?.includes(formData.date) ? "bg-rose-50 border-rose-200 text-rose-600" : row.userId && (getAgentAssignmentInfo(row.userId, index, formData.date)?.inOtherSchedules.length || 0) > 0 ? "bg-amber-50 border-amber-300 text-amber-700" : row.userId && getAgentAssignmentInfo(row.userId, index, formData.date)?.inThisEvent ? "bg-amber-50/50 border-amber-200 text-amber-600" : "bg-white border-slate-200 text-slate-700"}`}
                              >
                                <option value="">Vago / Aberto</option>
                                <optgroup label="Agentes Disponíveis">
                                  {users
                                    .filter(
                                      (u) =>
                                        !u.unavailableDates?.includes(
                                          formData.date,
                                        ),
                                    )
                                    .map((u) =>
                                      (() => {
                                        const info = getAgentAssignmentInfo(
                                          u.id,
                                          index,
                                          formData.date,
                                        );
                                        const isScheduledElsewhere =
                                          info &&
                                          info.inOtherSchedules.length > 0;
                                        const isScheduledHere =
                                          info && info.inThisEvent;
                                        const labelSuffix = isScheduledElsewhere
                                          ? " (Já escalado hoje! ⚠️)"
                                          : isScheduledHere
                                            ? " (Alocado em outro posto)"
                                            : "";
                                        return (
                                          <option key={u.id} value={u.id}>
                                            {u.name}
                                            {labelSuffix}
                                          </option>
                                        );
                                      })(),
                                    )}
                                </optgroup>
                                <optgroup label="Com Impedimento Informatizado">
                                  {users
                                    .filter((u) =>
                                      u.unavailableDates?.includes(
                                        formData.date,
                                      ),
                                    )
                                    .map((u) => (
                                      <option
                                        key={u.id}
                                        value={u.id}
                                        className="text-rose-400"
                                      >
                                        {(() => {
                                          const info = getAgentAssignmentInfo(
                                            u.id,
                                            index,
                                            formData.date,
                                          );
                                          const isScheduledElsewhere =
                                            info &&
                                            info.inOtherSchedules.length > 0;
                                          const isScheduledHere =
                                            info && info.inThisEvent;
                                          if (isScheduledElsewhere)
                                            return `${u.name} (Folga & Já escalado hoje! ⚠️)`;
                                          if (isScheduledHere)
                                            return `${u.name} (Folga & Alocado em outro posto! ⚠️)`;
                                          return `${u.name} (Folga / Indisponível ⚠️)`;
                                        })()}
                                      </option>
                                    ))}
                                </optgroup>
                              </select>
                              {row.userId && (() => {
                                const isUnavailable = users
                                  .find((u) => u.id === row.userId)
                                  ?.unavailableDates?.includes(formData.date);
                                const info = getAgentAssignmentInfo(row.userId, index, formData.date);

                                if (isUnavailable) {
                                  return (
                                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest mt-2 ml-1 flex items-center gap-1">
                                      <AlertTriangle size={10} /> Este agente informou folga neste dia
                                    </p>
                                  );
                                }

                                if (info && (info.inOtherSchedules.length > 0 || info.inThisEvent)) {
                                  return (
                                    <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mt-2 ml-1 flex items-start gap-1 leading-normal">
                                      <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                                      <span>
                                        Aviso: {info.inThisEvent ? "Este agente já está alocado em outro posto nesta mesma escala." : `Já escalado hoje em: ${info.inOtherSchedules.map((s) => `"${s.title}"`).join(", ")}`}
                                      </span>
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <button
                              onClick={() => removeAssignmentRow(index)}
                              className="sm:mt-8 p-3 bg-white text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all shadow-sm self-end sm:self-center"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-10 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-slate-100 rounded-b-[3rem]">
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    {editingId && (
                      <button
                        type="button"
                        onClick={(e) => onRequestDelete(editingId, e)}
                        className="flex-1 sm:flex-none px-6 py-4 bg-white text-rose-500 border border-rose-100 hover:bg-rose-50 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                      >
                        <Trash2 size={16} /> Excluir
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 sm:flex-none px-8 py-5 text-slate-400 hover:text-slate-900 font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                      Descartar
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={loading || !formData.title}
                      className="flex-1 sm:flex-none bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-brand-blue hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Save size={18} />
                      )}
                      <span>
                        {editingId ? "Atualizar Escala" : "Lançar Escala"}
                      </span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {availabilityModalOpen && (
            <div id="availability-modal" className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                onClick={() => setAvailabilityModalOpen(false)}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden relative z-[1010] flex flex-col max-h-[90vh]"
              >
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center bg-brand-green relative group/avail">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 pointer-events-none" />
                  <div className="flex items-center gap-3.5 relative z-10">
                    <div className="w-10 h-10 bg-white/10 backdrop-blur-md text-white rounded-xl flex items-center justify-center border border-white/10 shadow-md">
                      <CalendarDays size={20} />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-black text-white tracking-tight leading-none mb-1">
                        Minha Disponibilidade
                      </h3>
                      <p className="text-[9px] font-semibold text-white/50 uppercase tracking-wider">
                        Altere sua escala de folgas abaixo
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAvailabilityModalOpen(false)}
                    className="p-2 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-xl backdrop-blur-md transition-all active:scale-90 relative z-10"
                    id="close-availability-header"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[75vh] hide-scroll">
                  
                  {/* Instructional Header & Legend Integrated */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <p className="text-[11px] font-medium text-slate-500 leading-normal">
                      Toque nos dias para alternar: <span className="text-blue-600 font-bold">Azul = Livre</span> | <span className="text-rose-500 font-bold">Vermelho = Folga</span>
                    </p>
                  </div>

                  {/* Month Navigator Header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex flex-col text-left">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Mês Selecionado</span>
                      <h4 className="text-base font-black text-slate-800 tracking-tight capitalize leading-none mt-0.5">
                        {monthNamesStr[calendarMonth]} {calendarYear}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handlePrevMonth}
                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition-all border border-slate-100 active:scale-95"
                        id="btn-prev-month"
                        title="Mês Anterior"
                      >
                        <ChevronLeft size={16} strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={handleNextMonth}
                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg transition-all border border-slate-100 active:scale-95"
                        id="btn-next-month"
                        title="Próximo Mês"
                      >
                        <ChevronRight size={16} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid Container */}
                  <div className="border border-slate-100 rounded-2xl p-3 bg-white relative">
                    {loading && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
                        <div className="flex flex-col items-center gap-1">
                          <Loader2 size={24} className="text-brand-green animate-spin" />
                          <span className="text-[10px] font-bold text-slate-500 animate-pulse">Sincronizando...</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center">
                      {/* Weekday Labels */}
                      {weekdays.map((w, index) => (
                        <div key={index} className="text-[9px] font-black text-slate-400 uppercase tracking-wider pb-0.5">
                          {w}
                        </div>
                      ))}

                      {/* Calendar Day Cells */}
                      {daysGrid.map((day, idx) => {
                        if (day === null) {
                          return <div key={`empty-${idx}`} className="w-8 h-8 sm:w-9 sm:h-9" />;
                        }

                        const formattedMonthStr = String(calendarMonth + 1).padStart(2, '0');
                        const formattedDayStr = String(day).padStart(2, '0');
                        const cellDateStr = `${calendarYear}-${formattedMonthStr}-${formattedDayStr}`;
                        const isUnavailable = currentUser.unavailableDates?.includes(cellDateStr);

                        return (
                          <div key={`day-${day}`} className="flex justify-center items-center">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              disabled={loading}
                              onClick={() => handleToggleAvailabilityDate(cellDateStr)}
                              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex flex-col items-center justify-center font-bold text-xs transition-all relative ${
                                isUnavailable
                                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-sm'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                              }`}
                              title={isUnavailable ? `Indisponível em ${day}/${formattedMonthStr}` : `Livre em ${day}/${formattedMonthStr}`}
                              id={`avail-btn-${cellDateStr}`}
                            >
                              {day}
                            </motion.button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary of marked days for active Month */}
                  <div className="space-y-2">
                    <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-left">
                      Suas Folgas em {monthNamesStr[calendarMonth]} ({currentMonthUnavailable.length})
                    </h5>

                    {currentMonthUnavailable.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-[75px] overflow-y-auto pr-1">
                        {currentMonthUnavailable.map((dateStr) => {
                          const dStr = dateStr.split('-');
                          const dayNum = parseInt(dStr[2], 10);
                          return (
                            <div
                              key={dateStr}
                              className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-[10px] font-bold text-rose-600 px-2.5 py-1 rounded-full text-left"
                            >
                              <span>Dia {dayNum}</span>
                              <button
                                onClick={() => handleToggleAvailabilityDate(dateStr)}
                                disabled={loading}
                                className="hover:text-rose-800 transition-colors font-extrabold text-xs leading-none shrink-0"
                                title="Mudar para Livre (Azul)"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-2.5 flex flex-col items-center justify-center text-slate-300 bg-slate-50/50 border border-dashed border-slate-150 rounded-xl">
                        <p className="text-[9px] uppercase font-bold tracking-widest opacity-40">
                          Nenhuma folga neste mês
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3.5 bg-slate-50/50 flex justify-end items-center border-t border-slate-100">
                  <button
                    onClick={() => setAvailabilityModalOpen(false)}
                    className="bg-slate-900 text-white px-5 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md"
                    id="close-availability-btn"
                  >
                    Fechar Painel
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};
