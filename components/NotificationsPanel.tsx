import React from 'react';
import { AppNotification } from '../types';
import { Bell, Check, Clock, Calendar, CheckSquare, MessageCircle, Info, X, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface NotificationsPanelProps {
  notifications: AppNotification[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ 
  notifications, 
  isOpen, 
  onClose, 
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'task_assigned': return <CheckSquare size={16} className="text-green-600" />;
      case 'schedule_update': return <Calendar size={16} className="text-blue-600" />;
      case 'mention': return <MessageCircle size={16} className="text-purple-600" />;
      default: return <Info size={16} className="text-gray-600" />;
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
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/20 z-40 md:hidden" 
        onClick={onClose}
      />
      
      <div className="absolute top-16 right-4 md:right-6 w-full max-w-sm bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-fade-in flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-gray-700" />
            <h3 className="font-bold text-gray-800">Notificações</h3>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {unreadCount} nova(s)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {notifications.length > 0 && (
               <button 
                onClick={onClearAll} 
                title="Limpar tudo"
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
               >
                 <Trash2 size={16} />
               </button>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <Bell size={24} className="text-gray-300" />
              </div>
              <p className="text-gray-500 text-sm font-medium">Tudo tranquilo por aqui!</p>
              <p className="text-gray-400 text-xs mt-1">Você não tem novas notificações.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`p-4 hover:bg-gray-50 transition-colors relative group cursor-pointer ${!notif.isRead ? 'bg-blue-50/40' : 'bg-white'}`}
                  onClick={() => onMarkAsRead(notif.id)}
                >
                  <div className="flex gap-3">
                    <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!notif.isRead ? 'bg-white shadow-sm ring-1 ring-gray-100' : 'bg-gray-100'}`}>
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                         <h4 className={`text-sm ${!notif.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                           {notif.title}
                         </h4>
                         <span className="text-[10px] text-gray-400 flex items-center gap-1 shrink-0 ml-2">
                           {formatTime(notif.createdAt)}
                         </span>
                      </div>
                      <p className={`text-xs ${!notif.isRead ? 'text-gray-600' : 'text-gray-500'} line-clamp-2 leading-relaxed`}>
                        {notif.content}
                      </p>
                    </div>
                  </div>
                  {!notif.isRead && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span title="Marcar como lida" className="w-2 h-2 bg-blue-500 rounded-full block"></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
            <button 
              onClick={onMarkAllAsRead}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center justify-center gap-1 w-full"
            >
              <Check size={14} /> Marcar todas como lidas
            </button>
          </div>
        )}
      </div>
    </>
  );
};