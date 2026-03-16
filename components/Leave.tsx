import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useData } from '../contexts/DataProvider';
import { useAuth } from '../contexts/AuthProvider';
import { useRouter } from '../contexts/RouterProvider';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { LoggedInUser, LeaveApplication, LeaveApplicationDay, Page } from '../types';
import { IconCheckCircle, IconXCircle, IconRefresh } from '../constants';
import { LeaveDetailDrawer } from './LeaveDetailDrawer';

const SUNDAY = 0; // getDay() for Sunday

function getAppDateRange(app: LeaveApplication): { from: string; to: string; dayCount: number; summary: string } {
  const days = (app.leave_application_days || []).map(d => d.leave_date).sort();
  if (days.length === 0) return { from: '—', to: '—', dayCount: 0, summary: '—' };
  const from = days[0];
  const to = days[days.length - 1];
  return { from, to, dayCount: days.length, summary: from === to ? from : `${from} – ${to} (${days.length} days)` };
}

function isSunday(date: Date): boolean {
  return date.getDay() === SUNDAY;
}

function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const Leave: React.FC<{ currentUser: LoggedInUser; page: Page }> = ({ currentUser, page }) => {
  const { leaveApplications, fetchLeaveApplications, staff } = useData();
  const { addToast } = useToast();
  const { pathname, navigate } = useRouter();

  const isSuperAdmin = currentUser.role === 'Super Admin';
  const isLeaveRequests = page === Page.LeaveRequests;
  const isLeaveCalendar = page === Page.LeaveCalendar;

  useEffect(() => {
    fetchLeaveApplications(true);
  }, [fetchLeaveApplications]);

  // In-app reminder: "Leave starting tomorrow" (once per day per user)
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowYMD = dateToYMD(tomorrow);
    const storageKey = `leave_tomorrow_notified_${tomorrowYMD}`;
    if (sessionStorage.getItem(storageKey)) return;
    const myApproved = leaveApplications.filter(a => a.staff_id === currentUser.id && a.status === 'Approved');
    const startingTomorrow = myApproved.filter(a =>
      (a.leave_application_days || []).some((d: { leave_date: string }) => d.leave_date === tomorrowYMD)
    );
    if (startingTomorrow.length === 0) return;
    sessionStorage.setItem(storageKey, '1');
    const app = startingTomorrow[0];
    const days = (app.leave_application_days || []).map((d: { leave_date: string }) => d.leave_date).sort();
    const fromTo = days.length ? `${days[0]} to ${days[days.length - 1]}` : '—';
    supabase.from('notifications').insert({
      staff_id: currentUser.id,
      type: 'leave_starting_tomorrow',
      title: 'Leave starting tomorrow',
      body: `Your leave (${fromTo}) starts tomorrow.`,
      link: '/settings/my-leave',
    }).then(() => {});
  }, [leaveApplications, currentUser.id]);

  // In-app reminder: "You have a pending leave request" (once per day per user)
  useEffect(() => {
    const todayYMD = dateToYMD(new Date());
    const storageKey = `leave_pending_reminder_${todayYMD}`;
    if (sessionStorage.getItem(storageKey)) return;
    const myPending = leaveApplications.filter(a => a.staff_id === currentUser.id && a.status === 'Pending');
    if (myPending.length === 0) return;
    sessionStorage.setItem(storageKey, '1');
    supabase.from('notifications').insert({
      staff_id: currentUser.id,
      type: 'leave_pending_reminder',
      title: 'Pending leave request',
      body: 'You have a pending leave request awaiting approval.',
      link: '/settings/my-leave',
    }).then(() => {});
  }, [leaveApplications, currentUser.id]);

  // Redirect non–Super Admin away from Leave Requests
  useEffect(() => {
    if (isLeaveRequests && !isSuperAdmin) {
      navigate('/leave');
    }
  }, [isLeaveRequests, isSuperAdmin, navigate]);

  // All non–Super Admin users: leave is in Settings → My Leave; redirect to settings
  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/settings/my-leave');
    }
  }, [isSuperAdmin, navigate]);

  if (isLeaveRequests && !isSuperAdmin) {
    return null;
  }

  if (!isSuperAdmin) {
    return null;
  }

  // Default /leave to /leave/requests for Super Admin
  useEffect(() => {
    if (pathname === '/leave') navigate('/leave/requests');
  }, [pathname, navigate]);

  // Super Admin: only Leave Requests and Leave Calendar
  const isRequests = pathname === '/leave/requests';
  const isCalendar = pathname === '/leave/calendar';
  const effectiveView = isRequests ? 'requests' : isCalendar ? 'calendar' : 'requests';

  return (
    <div className="w-full min-w-0 px-3 py-4 sm:px-6 sm:py-4">
      <nav className="flex gap-1 border-b border-slate-200 mb-4 sm:mb-6 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
        <button
          onClick={() => navigate('/leave/requests')}
          className={`shrink-0 py-3 px-3 sm:px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${effectiveView === 'requests' ? 'border-[#191974] text-[#191974]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <span className="sm:hidden">Requests</span>
          <span className="hidden sm:inline">Leave Requests</span>
        </button>
        <button
          onClick={() => navigate('/leave/calendar')}
          className={`shrink-0 py-3 px-3 sm:px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${effectiveView === 'calendar' ? 'border-[#191974] text-[#191974]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Calendar
        </button>
      </nav>

      {effectiveView === 'requests' && <LeaveRequests leaveApplications={leaveApplications} fetchLeaveApplications={fetchLeaveApplications} staff={staff} currentUser={currentUser} addToast={addToast} />}
      {effectiveView === 'calendar' && <LeaveCalendar leaveApplications={leaveApplications} staff={staff} />}
    </div>
  );
};

const LeaveRequests: React.FC<{
  leaveApplications: LeaveApplication[];
  fetchLeaveApplications: (force?: boolean) => Promise<void>;
  staff: { id: number; name?: string; avatar_url?: string }[];
  currentUser: LoggedInUser;
  addToast: (msg: string, type?: 'success' | 'error') => void;
}> = ({ leaveApplications, fetchLeaveApplications, staff, currentUser, addToast }) => {
  const { search, navigate } = useRouter();
  const [detailApp, setDetailApp] = useState<LeaveApplication | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<LeaveApplication | null>(null);

  const allSorted = useMemo(
    () => [...leaveApplications].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [leaveApplications]
  );

  const staffMap = useMemo(() => {
    const m = new Map<number, { name?: string; avatar_url?: string }>();
    staff.forEach(s => m.set(s.id, { name: s.name, avatar_url: s.avatar_url }));
    return m;
  }, [staff]);

  const handleApprove = async (app: LeaveApplication) => {
    const { error } = await supabase.from('leave_applications').update({
      status: 'Approved',
      approved_by_staff_id: currentUser.id,
      rejected_reason: null,
    }).eq('id', app.id);
    if (error) {
      addToast(error.message, 'error');
      return;
    }
    addToast('Leave approved.', 'success');
    setDetailApp(prev => prev && prev.id === app.id ? { ...prev, status: 'Approved' } : prev);
    try {
      await fetchLeaveApplications(true);
      await notifyApplicant(app, 'approved', null);
    } catch (_e) {
      // ignore
    }
  };

  const handleRevoke = async (app: LeaveApplication) => {
    setRevokingId(app.id);
    const { error } = await supabase.from('leave_applications').update({
      status: 'Revoked',
    }).eq('id', app.id);
    setRevokingId(null);
    if (error) {
      addToast(error.message, 'error');
      return;
    }
    addToast('Leave revoked.', 'success');
    setDetailApp(prev => prev && prev.id === app.id ? { ...prev, status: 'Revoked' } : prev);
    try {
      await fetchLeaveApplications(true);
      await notifyApplicant(app, 'revoked', null);
    } catch (_e) {
      // ignore
    }
  };

  const handleRejectOpen = (app: LeaveApplication) => {
    setShowRejectModal(app);
    setRejectReason('');
  };

  const handleRejectSubmit = async () => {
    if (!showRejectModal) return;
    if (!rejectReason.trim()) {
      addToast('Please enter a reason for rejection.', 'error');
      return;
    }
    setRejectingId(showRejectModal.id);
    const { error } = await supabase.from('leave_applications').update({
      status: 'Rejected',
      approved_by_staff_id: currentUser.id,
      rejected_reason: rejectReason.trim(),
    }).eq('id', showRejectModal.id);
    const reason = rejectReason.trim();
    setRejectingId(null);
    setShowRejectModal(null);
    setRejectReason('');
    if (error) {
      addToast(error.message, 'error');
      return;
    }
    addToast('Leave rejected.', 'success');
    setDetailApp(prev => prev && prev.id === showRejectModal.id ? { ...prev, status: 'Rejected', rejected_reason: reason } : prev);
    try {
      await fetchLeaveApplications(true);
      await notifyApplicant(showRejectModal, 'rejected', reason);
    } catch (_e) {
      // Rejection succeeded; refresh or notification failed – don't show another error
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-emerald-100 text-emerald-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Withdrawn': return 'bg-slate-100 text-slate-600';
      case 'Revoked': return 'bg-orange-100 text-orange-800';
      default: return 'bg-amber-100 text-amber-800';
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(search);
    const leaveId = params.get('leave');
    if (!leaveId) return;
    const app = leaveApplications.find(a => a.id === leaveId);
    if (app) {
      setDetailApp(app);
    }
  }, [search, leaveApplications]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg sm:text-xl font-semibold text-slate-800">Leave requests</h1>
      {allSorted.length === 0 ? (
        <p className="text-sm text-slate-500 py-6">No leave requests.</p>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-3">
            {allSorted.map(app => {
              const s = app.staff || staffMap.get(app.staff_id);
              const { summary, dayCount } = getAppDateRange(app);
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setDetailApp(app)}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50/50 active:bg-slate-100 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {s?.avatar_url ? <img src={s.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" /> : <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium text-sm shrink-0">{s?.name?.charAt(0) || '?'}</div>}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 truncate">{s?.name || 'Staff'}</p>
                      <p className="text-sm text-slate-600 truncate">{summary} · {dayCount} day{dayCount !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5" title={app.reason}>{app.reason}</p>
                      <span className={`inline-flex mt-2 px-2.5 py-1 text-xs font-medium rounded-full ${getStatusClass(app.status)}`}>
                        {app.status}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {/* Desktop: table */}
          <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Date range</th>
                    <th className="px-4 py-3">Days</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allSorted.map(app => {
                    const s = app.staff || staffMap.get(app.staff_id);
                    const { from, to, dayCount, summary } = getAppDateRange(app);
                    return (
                      <tr
                        key={app.id}
                        onClick={() => setDetailApp(app)}
                        className="hover:bg-slate-50/50 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {s?.avatar_url ? <img src={s.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium text-sm">{s?.name?.charAt(0) || '?'}</div>}
                            <span className="font-medium text-slate-800">{s?.name || 'Staff'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{summary}</td>
                        <td className="px-4 py-3 text-slate-600">{dayCount}</td>
                        <td className="px-4 py-3 max-w-[200px] truncate text-slate-600" title={app.reason}>{app.reason}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${getStatusClass(app.status)}`}>
                            {app.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {detailApp && (
        <LeaveDetailDrawer
          app={detailApp}
          onClose={() => {
            setDetailApp(null);
            navigate('/leave/requests');
          }}
          showApplicantName
          onApprove={detailApp.status === 'Pending' ? () => handleApprove(detailApp) : undefined}
          onRejectOpen={detailApp.status === 'Pending' ? () => handleRejectOpen(detailApp) : undefined}
          onRevoke={detailApp.status === 'Approved' ? () => handleRevoke(detailApp) : undefined}
          revoking={revokingId === detailApp.id}
        />
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
          <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl p-5 sm:p-6 max-w-md w-full max-h-[85vh] overflow-y-auto sm:max-h-none">
            <h3 className="font-semibold text-slate-800">Reject leave request</h3>
            <p className="text-sm text-slate-600 mt-1">Reason for rejection *</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} className="w-full mt-2 p-2 border border-slate-300 rounded-md text-sm" placeholder="Enter reason" />
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4 pb-6 sm:pb-0">
              <button type="button" onClick={() => { setShowRejectModal(null); setRejectReason(''); }} className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={handleRejectSubmit} disabled={!rejectReason.trim() || rejectingId !== null} className="w-full sm:w-auto px-4 py-3 sm:py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{rejectingId ? 'Rejecting...' : 'Reject'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

async function notifyApplicant(app: LeaveApplication, action: 'approved' | 'rejected' | 'revoked', rejectedReason: string | null) {
  const { summary } = getAppDateRange(app);
  const title = action === 'approved' ? 'Leave approved' : action === 'rejected' ? 'Leave rejected' : 'Leave revoked';
  const body = action === 'approved'
    ? `Your leave (${summary}) has been approved.`
    : action === 'rejected'
      ? `Your leave (${summary}) was rejected.${rejectedReason ? ` Reason: ${rejectedReason}` : ''}`
      : `Your leave (${summary}) has been revoked by the administrator.`;
  const notifType = action === 'approved' ? 'leave_approved' : action === 'rejected' ? 'leave_rejected' : 'leave_revoked';
  const { error } = await supabase.from('notifications').insert({
    staff_id: app.staff_id,
    type: notifType,
    title,
    body,
    link: `/settings/my-leave?leave=${app.id}`,
  });
  if (error) {
    console.warn('Leave notification could not be sent:', error.message);
  }
}

const LeaveCalendar: React.FC<{
  leaveApplications: LeaveApplication[];
  staff: { id: number; name?: string; avatar_url?: string }[];
}> = ({ leaveApplications, staff }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [detailApp, setDetailApp] = useState<LeaveApplication | null>(null);
  const staffMap = useMemo(() => {
    const m = new Map<number, { name?: string; avatar_url?: string }>();
    staff.forEach(s => m.set(s.id, { name: s.name, avatar_url: s.avatar_url }));
    return m;
  }, [staff]);

  const approved = useMemo(() => leaveApplications.filter(a => a.status === 'Approved'), [leaveApplications]);

  const leaveByDate = useMemo(() => {
    const map = new Map<string, LeaveApplication[]>();
    approved.forEach(app => {
      (app.leave_application_days || []).forEach((day: LeaveApplicationDay) => {
        const key = day.leave_date;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(app);
      });
    });
    return map;
  }, [approved]);

  const { month, year, daysInMonth, firstDayOfMonth } = useMemo(() => {
    const m = currentDate.getMonth();
    const y = currentDate.getFullYear();
    const days = new Date(y, m + 1, 0).getDate();
    const first = new Date(y, m, 1).getDay();
    return { month: m, year: y, daysInMonth: days, firstDayOfMonth: first };
  }, [currentDate]);

  const calendarCells = useMemo(() => {
    const cells: { date: Date; isCurrentMonth: boolean }[] = [];
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    for (let i = 0; i < firstDayOfMonth; i++) {
      const day = daysInPrevMonth - firstDayOfMonth + i + 1;
      cells.push({ date: new Date(year, month - 1, day), isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return cells;
  }, [year, month, daysInMonth, firstDayOfMonth]);

  const ChevronLeft = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
  );
  const ChevronRight = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
  );

  const todayYMD = dateToYMD(new Date());

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayLabelsShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
        <h1 className="text-lg sm:text-xl font-semibold text-slate-800">Leave calendar</h1>
        <div className="flex items-center gap-1 sm:gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm w-full sm:w-auto">
          <button type="button" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors touch-manipulation" aria-label="Previous month">
            <ChevronLeft />
          </button>
          <span className="flex-1 min-w-0 text-center text-xs sm:text-sm font-semibold text-slate-800 truncate">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button type="button" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors touch-manipulation" aria-label="Next month">
            <ChevronRight />
          </button>
          <span className="h-5 sm:h-6 w-px bg-slate-200" />
          <button type="button" onClick={() => setCurrentDate(new Date())} className="px-2 sm:px-3 py-1.5 text-xs font-medium text-[#191974] rounded-lg hover:bg-[#191974]/10 transition-colors touch-manipulation">
            Today
          </button>
        </div>
      </div>
      <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden -mx-1 sm:mx-0">
        <div className="grid grid-cols-7 min-w-0">
          {dayLabelsShort.map((day, idx) => (
            <div key={day} className="border-b border-slate-100 bg-slate-50/80 py-1.5 sm:py-2.5 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500" title={dayLabels[idx]}>
              {day}
            </div>
          ))}
          {calendarCells.map((cell, i) => {
            const key = dateToYMD(cell.date);
            const onLeave = leaveByDate.get(key) || [];
            const isSun = cell.date.getDay() === SUNDAY;
            const isToday = key === todayYMD;
            return (
              <div
                key={i}
                className={`min-h-[64px] sm:min-h-[80px] md:min-h-[100px] border-b border-r border-slate-100 last:border-r-0 p-1 sm:p-2 transition-colors ${
                  cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/60'
                } ${isSun ? 'bg-slate-50' : ''} ${isToday ? 'ring-2 ring-inset ring-[#191974] ring-offset-0 sm:ring-offset-1' : ''}`}
              >
                <span className={`inline-flex h-6 sm:h-7 min-w-[1.25rem] sm:min-w-[1.75rem] items-center justify-center rounded text-xs sm:text-sm font-medium ${
                  isToday ? 'bg-[#191974] text-white' : cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'
                }`}>
                  {cell.date.getDate()}
                </span>
                {onLeave.length > 0 && (
                  <div className="mt-1 sm:mt-2 flex flex-wrap gap-0.5 sm:gap-1">
                    {onLeave.slice(0, 5).map((app) => {
                      const s = app.staff || staffMap.get(app.staff_id);
                      return (
                        <button
                          key={`${app.id}-${key}`}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setDetailApp(app); }}
                          className="rounded-full bg-[#191974]/10 p-0.5 hover:bg-[#191974]/20 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#191974]/40 touch-manipulation"
                          title={s?.name || 'Staff'}
                        >
                          {s?.avatar_url ? (
                            <img src={s.avatar_url} alt="" className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium text-[10px] sm:text-xs">
                              {s?.name?.charAt(0) || '?'}
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {onLeave.length > 5 && (
                      <span className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-slate-500 text-[10px] sm:text-xs font-medium" title={`+${onLeave.length - 5} more`}>
                        +{onLeave.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {detailApp && (
        <LeaveDetailDrawer app={detailApp} onClose={() => setDetailApp(null)} showApplicantName />
      )}
    </div>
  );
};
