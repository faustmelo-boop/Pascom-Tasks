import React, { useEffect, useState } from 'react';
import { AppNotification, User } from '../types';
import { Bell, Check, Clock, Calendar, CheckSquare, MessageCircle, Info, X, Trash2, Smartphone, Inbox, MailOpen, Settings, ChevronDown, ChevronUp, Sparkles, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NotificationsPanelProps {
  notifications: AppNotification[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onRequestSystemPermissions: () => void;
  currentUser?: User | null;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ 
  notifications, 
  isOpen, 
  onClose, 
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onRequestSystemPermissions,
  currentUser
}) => {
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('unread');

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    }
  }, [isOpen]);

  const handleRequestPermission = () => {
    onRequestSystemPermissions();
    setTimeout(() => {
       if ('Notification' in window) setPermissionState(Notification.permission);
    }, 1000);
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const filteredNotifications = activeTab === 'unread' 
    ? notifications.filter(n => !n.isRead) 
    : notifications;

  const getIcon = (type: string) => {
    switch (type) {
      case 'task_assigned': return <CheckSquare size={18} />;
      case 'schedule_update': return <Calendar size={18} />;
      case 'mention': return <MessageCircle size={18} />;
      default: return <Info size={18} />;
    }
  };

  const getIconColor = (type: string, isRead: boolean) => {
    if (isRead) return 'bg-slate-100 text-slate-400';
    switch (type) {
      case 'task_assigned': return 'bg-emerald-50 text-emerald-600 ring-emerald-100';
      case 'schedule_update': return 'bg-brand-blue/10 text-brand-blue ring-brand-blue/20';
      case 'mention': return 'bg-purple-50 text-purple-600 ring-purple-100';
      default: return 'bg-slate-100 text-slate-600 ring-slate-100';
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Agora';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m atrás`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h atrás`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60]" 
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20, x: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20, x: 20 }}
        className="fixed top-4 right-4 md:top-20 md:right-10 w-[calc(100%-32px)] max-w-md bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border border-slate-100 z-[70] overflow-hidden flex flex-col max-h-[85vh] ring-1 ring-black/5"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-700 shadow-inner">
                <Bell size={24} className={unreadCount > 0 ? "animate-bounce" : ""} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">Notificações</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Painel de Avisos</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all active:scale-90 border border-slate-50 shadow-sm">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-100/50 p-1.5 rounded-2xl mb-4 border border-slate-200/50">
            <button 
              onClick={() => setActiveTab('unread')}
              className={`flex-1 flex flex-col items-center justify-center py-3 rounded-xl transition-all relative ${
                activeTab === 'unread' ? 'bg-white text-brand-blue shadow-md ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">Pendentes</span>
              <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold opacity-60 font-mono">{unreadCount}</span>
                  {unreadCount > 0 && <div className="w-1.5 h-1.5 bg-brand-yellow rounded-full animate-pulse shadow-[0_0_8px_rgba(253,182,21,0.6)]" />}
              </div>
            </button>
            <button 
              onClick={() => setActiveTab('all')}
              className={`flex-1 flex flex-col items-center justify-center py-3 rounded-xl transition-all relative ${
                activeTab === 'all' ? 'bg-white text-brand-blue shadow-md ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">Histórico</span>
              <span className="text-xs font-bold opacity-60 font-mono">{notifications.length}</span>
            </button>
          </div>
        </div>

        {/* System Permission Prompt */}
        {permissionState === 'default' && 'Notification' in window && (
           <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-8 mb-4 bg-brand-blue text-white p-5 rounded-[2rem] flex items-center justify-between shadow-xl shadow-brand-blue/20 relative overflow-hidden group"
           >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
              <div className="flex items-center gap-4 relative z-10">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black leading-tight">Push Notifications</h4>
                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Receba avisos em tempo real</p>
                  </div>
              </div>
              <button 
                onClick={handleRequestPermission}
                className="relative z-10 text-[10px] font-black uppercase tracking-widest bg-white text-brand-blue px-5 py-3 rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-lg"
              >
                Ativar
              </button>
           </motion.div>
        )}

        {/* List */}
        <div className="overflow-y-auto flex-1 px-8 py-4 hide-scroll scroll-smooth min-h-[300px]">
          <AnimatePresence mode="popLayout">
            {filteredNotifications.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-20 px-4 text-center"
              >
                <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner relative group">
                  <div className="absolute inset-0 bg-brand-blue/5 rounded-[2.5rem] scale-0 group-hover:scale-110 transition-transform duration-500" />
                  {activeTab === 'unread' ? <MailOpen size={40} className="text-slate-200 relative z-10" /> : <Inbox size={40} className="text-slate-200 relative z-10" />}
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                  {activeTab === 'unread' ? 'Nenhuma pendência' : 'Silêncio absoluto'}
                </h3>
                <p className="text-slate-400 text-xs font-bold mt-3 leading-relaxed max-w-[200px] mx-auto uppercase tracking-tighter">
                  {activeTab === 'unread' ? 'Você já visualizou todas as suas notificações recentes.' : 'Sua central de notificações está vazia por enquanto.'}
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4 pb-4">
                {filteredNotifications.map((notif, idx) => (
                  <motion.div 
                    layout
                    key={notif.id} 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`p-6 rounded-[2.5rem] transition-all relative group cursor-pointer border-2 ${
                      !notif.isRead 
                      ? 'bg-white border-brand-blue/40 shadow-[0_12px_24px_-8px_rgba(59,130,246,0.15)] ring-4 ring-brand-blue/5' 
                      : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-100 hover:shadow-md'
                    }`}
                    onClick={() => onMarkAsRead(notif.id)}
                  >
                    <div className="flex gap-5">
                      <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-6 ring-4 ${getIconColor(notif.type, notif.isRead)}`}>
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex justify-between items-start mb-1 gap-2">
                           <h4 className={`text-sm tracking-tight leading-snug ${!notif.isRead ? 'font-black text-slate-900' : 'font-bold text-slate-500'}`}>
                             {notif.title}
                           </h4>
                        </div>
                        <p className={`text-[11px] leading-relaxed line-clamp-2 ${!notif.isRead ? 'text-slate-700 font-bold' : 'text-slate-400 font-medium'}`}>
                          {notif.content}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Clock size={12} className="text-slate-300" />
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter truncate">
                               {formatTime(notif.createdAt)}
                            </span>
                          </div>
                          <div className="h-1 w-1 bg-slate-200 rounded-full" />
                          <span className="text-[10px] font-black text-brand-blue uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                             Ver detalhes
                          </span>
                        </div>
                      </div>
                    </div>
                    {!notif.isRead && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-brand-blue rounded-full shadow-[0_0_12px_rgba(59,130,246,0.4)]"></div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-slate-50/50 border-t border-slate-100">
          <div className="flex gap-4">
             {unreadCount > 0 ? (
               <button 
                 onClick={onMarkAllAsRead}
                 className="flex-1 bg-brand-blue text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-blue/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <Check size={18} strokeWidth={3} /> Ler todas
               </button>
             ) : notifications.length > 0 && (
               <button 
                 onClick={onClearAll}
                 className="flex-1 bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                 <Trash2 size={18} /> Limpar Central
               </button>
             )}
          </div>
          
          {unreadCount === 0 && Array.from(new Set(notifications.map(n => n.type))).length > 0 && notifications.length > 0 && (
            <p className="mt-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center leading-relaxed">
              Você está em dia com as atividades da Pascom.<br/>
              Boas missões!
            </p>
          )}
        </div>
      </motion.div>
    </>
  );
};