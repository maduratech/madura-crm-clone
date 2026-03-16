import React, { useEffect, useMemo, useCallback } from 'react';
import { useData } from '../contexts/DataProvider';
import { Notification, NotificationType } from '../types';
import { supabase } from '../lib/supabase';
import { useRouter } from '../contexts/RouterProvider';
import { IconTrash } from '../constants';

const MS_24H = 24 * 60 * 60 * 1000;
const MS_48H = 48 * 60 * 60 * 1000;
const TASK_TYPES: NotificationType[] = ['task_assigned', 'task_due_today', 'task_due_tomorrow'];

const IconBell: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
);

const IconX: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const formatRelative = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
};

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ isOpen, onClose, anchorRef }) => {
  const { notifications, fetchNotifications, removeNotifications } = useData();
  const { navigate, pathname, search } = useRouter();

  useEffect(() => {
    if (isOpen) fetchNotifications(true);
  }, [isOpen, fetchNotifications]);

  const clearOne = useCallback(async (id: string) => {
    removeNotifications([id]);
    await supabase.from('notifications').delete().eq('id', id);
  }, [removeNotifications]);

  const clearAll = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ids = notifications.map(n => n.id);
    if (ids.length === 0) return;
    removeNotifications(ids);
    await supabase.from('notifications').delete().in('id', ids);
  }, [notifications, removeNotifications]);

  const visibleNotifications = useMemo(() => {
    const now = Date.now();
    return notifications.filter(n => {
      const type = (n.type || 'new_enquiry') as NotificationType;
      const created = new Date(n.created_at).getTime();
      const readAt = n.read_at ? new Date(n.read_at).getTime() : null;
      if (type === 'lead_note_mention') {
        if (!readAt) return true;
        return (now - readAt) < MS_24H;
      }
      if (TASK_TYPES.includes(type)) {
        return (now - created) < MS_48H;
      }
      return (now - created) < MS_24H;
    });
  }, [notifications]);

  const unreadCount = visibleNotifications.filter(n => !n.read_at).length;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" aria-hidden="true" onClick={onClose} />
      <div
        className="fixed top-14 right-0 sm:right-4 w-full max-w-md sm:max-w-sm bg-white rounded-lg shadow-xl border z-50 flex flex-col max-h-[calc(100vh-5rem)]"
        role="dialog"
        aria-label="Notifications"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b">
          <h2 className="font-semibold text-slate-800">Notifications</h2>
          <div className="flex items-center gap-2">
            {visibleNotifications.length > 0 && (
              <button type="button" onClick={clearAll} className="text-xs text-slate-500 hover:text-slate-700">
                Clear all
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500">
              <IconX className="w-5 h-5" />
            </button>
          </div>
        </div>
        <ul className="overflow-y-auto flex-1 min-h-0 divide-y">
          {visibleNotifications.length === 0 && (
            <li className="p-4 text-sm text-slate-500">No notifications.</li>
          )}
          {visibleNotifications.map(n => {
            const handleLinkClick = async (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              await clearOne(n.id);
              if (!n.link) return;
              try {
                const url = n.link.startsWith('/') ? new URL(n.link, window.location.origin) : new URL(n.link);
                const openLead = url.searchParams.get('openLead');
                const tab = url.searchParams.get('tab');
                if (openLead) {
                  sessionStorage.setItem('viewLeadId', openLead);
                  if (tab) sessionStorage.setItem('viewLeadTab', tab);
                  const targetPath = `${url.pathname}${url.search}`;
                  const currentPath = `${pathname}${search}`;
                  // If we're already on the same URL, dispatch a window event so Leads can open the panel directly.
                  if (currentPath === targetPath) {
                    window.dispatchEvent(
                      new CustomEvent('crm-open-lead-from-notification', {
                        detail: { leadId: Number(openLead), tab },
                      }),
                    );
                  } else {
                    // Navigate to full URL so Leads re-runs open logic when changing route/query
                    navigate(n.link);
                  }
                } else {
                  navigate(n.link);
                }
              } catch {
                navigate(n.link);
              }
              onClose();
            };
            const bodyText = (n as any).body ?? (n as any).message ?? null;
            const content = (
              <>
                {n.title && <p className="font-medium text-slate-800 text-sm">{n.title}</p>}
                {bodyText && <p className="text-sm text-slate-600">{bodyText}</p>}
              </>
            );
            return (
              <li
                key={n.id}
                className={`p-3 hover:bg-slate-50 ${!n.read_at ? 'bg-blue-50/50' : ''}`}
              >
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    {n.link ? (
                      <button
                        type="button"
                        onClick={handleLinkClick}
                        className="w-full text-left rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer hover:text-blue-600 hover:underline"
                      >
                        {content}
                      </button>
                    ) : (
                      <div>{content}</div>
                    )}
                    <p className="text-xs text-slate-400 mt-1">{formatRelative(n.created_at)}</p>
                  </div>
                  {!n.read_at && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearOne(n.id); }}
                      className="shrink-0 p-1 text-slate-500 hover:text-red-600 rounded hover:bg-slate-100"
                      aria-label="Clear notification"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
};

export const NotificationsBell: React.FC<{
  onClick: () => void;
  unreadCount: number;
}> = ({ onClick, unreadCount }) => (
  <button
    type="button"
    onClick={onClick}
    className="relative p-2 rounded-md text-gray-400 hover:bg-gray-700 hover:text-white"
    aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
  >
    <IconBell className="w-6 h-6" />
    {unreadCount > 0 && (
      <span className="absolute top-1 right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
        {unreadCount > 99 ? '99+' : unreadCount}
      </span>
    )}
  </button>
);
