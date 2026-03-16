import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataProvider';
import { useToast } from './ToastProvider';
import { useRouter } from '../contexts/RouterProvider';
import { supabase } from '../lib/supabase';
import { LoggedInUser, LeaveApplication, LeaveDayType } from '../types';
import { IconPlus, IconX } from '../constants';
import { LeaveDetailDrawer } from './LeaveDetailDrawer';

const SUNDAY = 0;

function isSunday(date: Date): boolean {
  return date.getDay() === SUNDAY;
}

function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type DayRow = { id: string; leave_date: string; type: LeaveDayType; hours: number | null; start_time: string | null; end_time: string | null };

function getAppDateRange(app: LeaveApplication): { from: string; to: string; dayCount: number } {
  const days = (app.leave_application_days || []).map((d) => d.leave_date).sort();
  if (days.length === 0) return { from: '—', to: '—', dayCount: 0 };
  return { from: days[0], to: days[days.length - 1], dayCount: days.length };
}

function formatDateShort(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function minutesToTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function hoursBetween(start: string, end: string): number {
  let min = timeToMinutes(end) - timeToMinutes(start);
  if (min < 0) min += 24 * 60;
  return Math.round((min / 60) * 2) / 2;
}

async function notifySuperAdminsNewLeave(applicant: LoggedInUser, summary: string, reason: string, leaveId: string) {
  const { data: superAdmins } = await supabase.from('staff').select('id').eq('role_id', 1);
  if (!superAdmins?.length) return;
  const title = 'New leave request';
  const body = `${applicant.name} applied for leave: ${summary}. Reason: ${reason.slice(0, 100)}${reason.length > 100 ? '...' : ''}`;
  const link = `/leave/requests?leave=${leaveId}`;
  for (const s of superAdmins) {
    if (s.id === applicant.id) continue;
        await supabase.from('notifications').insert({
      staff_id: s.id,
      type: 'leave_request_submitted',
      title,
      body,
      link,
    });
  }
}

const TYPE_OPTIONS: { value: LeaveDayType; label: string }[] = [
  { value: 'full', label: 'Full day' },
  { value: 'half_AM', label: 'Half AM' },
  { value: 'half_PM', label: 'Half PM' },
  { value: 'hours', label: 'Hours' },
];

const MyLeaveTab: React.FC<{ currentUser: LoggedInUser }> = ({ currentUser }) => {
  const { leaveApplications, fetchLeaveApplications, updateLeaveApplication } = useData();
  const { addToast } = useToast();
  const { search, navigate } = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLeaveId, setDetailLeaveId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'range'>('single');
  const [singleDate, setSingleDate] = useState('');
  const [singleType, setSingleType] = useState<LeaveDayType>('full');
  const [singleHours, setSingleHours] = useState<number>(2);
  const [singleStartTime, setSingleStartTime] = useState<string>('09:00');
  const [singleEndTime, setSingleEndTime] = useState<string>('11:00');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [rangeType, setRangeType] = useState<LeaveDayType>('full');
  const [rangeHours, setRangeHours] = useState<number>(2);
  const [rangeStartTime, setRangeStartTime] = useState<string>('09:00');
  const [rangeEndTime, setRangeEndTime] = useState<string>('11:00');
  const [days, setDays] = useState<DayRow[]>([]);

  useEffect(() => {
    fetchLeaveApplications(true);
  }, [fetchLeaveApplications]);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const leaveId = params.get('leave');
    if (leaveId) setDetailLeaveId(leaveId);
  }, [search]);

  const myApplications = useMemo(
    () => leaveApplications.filter((a) => a.staff_id === currentUser.id),
    [leaveApplications, currentUser.id]
  );

  const addSingleDay = useCallback(() => {
    if (!singleDate) {
      addToast('Select a date.', 'error');
      return;
    }
    const d = new Date(singleDate);
    if (isSunday(d)) {
      addToast('Sunday cannot be selected (weekly off).', 'error');
      return;
    }
    const type = singleType;
    const start_time = type === 'hours' ? singleStartTime || null : null;
    const end_time = type === 'hours' ? singleEndTime || null : null;
    const hours = type === 'hours' && start_time && end_time ? hoursBetween(start_time, end_time) : null;
    if (type === 'hours' && (hours == null || hours <= 0)) {
      addToast('Enter a valid time range (To time must be after From time).', 'error');
      return;
    }
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setDays((prev) => {
      const isDuplicate = prev.some((x) => {
        if (x.leave_date !== singleDate) return false;
        if (type === 'hours') {
          return x.type === 'hours' && x.start_time === start_time && x.end_time === end_time;
        }
        return true;
      });
      if (isDuplicate) {
        addToast(
          type === 'hours'
            ? 'This date and time slot are already added. You can add another time slot for the same day.'
            : 'This date is already added (one full or half day per date).',
          'error'
        );
        return prev;
      }
      return [...prev, { id, leave_date: singleDate, type, hours, start_time, end_time }].sort((a, b) => a.leave_date.localeCompare(b.leave_date));
    });
    setSingleDate('');
    setSingleHours(2);
    setSingleStartTime('09:00');
    setSingleEndTime('11:00');
  }, [singleDate, singleType, singleHours, singleStartTime, singleEndTime, addToast]);

  const addRange = useCallback(() => {
    if (!rangeFrom || !rangeTo) {
      addToast('Select From and To dates.', 'error');
      return;
    }
    const from = new Date(rangeFrom);
    const to = new Date(rangeTo);
    if (from > to) {
      addToast('From must be on or before To.', 'error');
      return;
    }
    const start_time = rangeType === 'hours' ? rangeStartTime || null : null;
    const end_time = rangeType === 'hours' ? rangeEndTime || null : null;
    const rangeHrs = rangeType === 'hours' && start_time && end_time ? hoursBetween(start_time, end_time) : null;
    const toAdd: DayRow[] = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (isSunday(d)) continue;
      const dateStr = dateToYMD(d);
      toAdd.push({
        id: `t-${dateStr}-${Math.random().toString(36).slice(2)}`,
        leave_date: dateStr,
        type: rangeType,
        hours: rangeHrs,
        start_time,
        end_time,
      });
    }
    setDays((prev) => {
      const isDuplicate = (r: DayRow) =>
        prev.some(
          (x) =>
            x.leave_date === r.leave_date &&
            (x.type !== 'hours' || (x.start_time === r.start_time && x.end_time === r.end_time))
        );
      const newRows = toAdd.filter((r) => !isDuplicate(r));
      const skipped = toAdd.length - newRows.length;
      if (skipped > 0) {
        addToast(
          rangeType === 'hours'
            ? `${skipped} date(s) skipped (same date and time slot already added).`
            : `${skipped} date(s) skipped (already added).`,
          'success'
        );
      }
      return [...prev, ...newRows].sort((a, b) => a.leave_date.localeCompare(b.leave_date));
    });
    setRangeFrom('');
    setRangeTo('');
  }, [rangeFrom, rangeTo, rangeType, rangeStartTime, rangeEndTime, addToast]);

  const removeDay = useCallback((id: string) => {
    setDays((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateDayType = useCallback((id: string, type: LeaveDayType, hours: number | null) => {
    setDays((prev) =>
      prev.map((r) => (r.id === id ? { ...r, type, hours: type === 'hours' ? (hours ?? 0) : null } : r))
    );
  }, []);

  const validateAndSubmit = useCallback(async () => {
    if (!reason.trim()) {
      addToast('Please enter a reason.', 'error');
      return;
    }
    if (days.length === 0) {
      addToast('Add at least one leave date.', 'error');
      return;
    }
    for (const row of days) {
      if (row.type === 'hours') {
        if (row.hours == null || row.hours <= 0) {
          addToast(`Enter hours for ${row.leave_date}.`, 'error');
          return;
        }
        if (!row.start_time || !row.end_time) {
          addToast(`Enter exact from/to time for ${row.leave_date} (hourly leave).`, 'error');
          return;
        }
      }
    }
    setSubmitting(true);
    try {
      const { data: appRow, error: appError } = await supabase
        .from('leave_applications')
        .insert({
          staff_id: currentUser.id,
          reason: reason.trim(),
          status: 'Pending',
        })
        .select('id')
        .single();
      if (appError) throw appError;
      if (!appRow?.id) throw new Error('Failed to create leave application.');
      for (const row of days) {
        const { error: dayError } = await supabase.from('leave_application_days').insert({
          leave_application_id: appRow.id,
          leave_date: row.leave_date,
          type: row.type,
          hours: row.type === 'hours' ? row.hours : null,
          start_time: row.type === 'hours' ? row.start_time : null,
          end_time: row.type === 'hours' ? row.end_time : null,
        });
        if (dayError) throw dayError;
      }
      addToast('Leave application submitted.', 'success');
      setReason('');
      setDays([]);
      setDrawerOpen(false);
      await fetchLeaveApplications(true);
      const summary = days.length === 1 ? days[0].leave_date : `${days[0].leave_date} – ${days[days.length - 1].leave_date} (${days.length} days)`;
      // Notify Super Admins
      await notifySuperAdminsNewLeave(currentUser, summary, reason.trim(), appRow.id);
      // Notify applicant that request was submitted
      await supabase.from('notifications').insert({
        staff_id: currentUser.id,
        type: 'leave_request_submitted',
        title: 'Leave request submitted',
        body: `Your leave (${summary}) has been submitted for approval.`,
        link: `/settings/my-leave?leave=${appRow.id}`,
      });
    } catch (e: any) {
      addToast(e?.message || 'Failed to submit leave application.', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [reason, days, currentUser, fetchLeaveApplications, addToast]);

  const getStatusClass = (status: string) => {
    if (status === 'Approved') return 'bg-emerald-100 text-emerald-800';
    if (status === 'Rejected') return 'bg-red-100 text-red-800';
    if (status === 'Withdrawn') return 'bg-slate-100 text-slate-600';
    if (status === 'Revoked') return 'bg-orange-100 text-orange-800';
    return 'bg-amber-100 text-amber-800';
  };

  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const handleWithdraw = useCallback(
    async (e: React.MouseEvent, appId: string) => {
      e.stopPropagation();
      setWithdrawingId(appId);
      try {
        const { data, error } = await supabase
          .from('leave_applications')
          .update({ status: 'Withdrawn' })
          .eq('id', appId)
          .eq('staff_id', currentUser.id)
          .select('id, status')
          .maybeSingle();
        if (error) throw error;
        if (!data || data.status !== 'Withdrawn') {
          throw new Error('Could not withdraw. You may not have permission, or the request may have already been processed.');
        }
        updateLeaveApplication(appId, { status: 'Withdrawn' });
        addToast('Leave request withdrawn. It remains in your list with status Withdrawn.', 'success');
        await fetchLeaveApplications(true);
      } catch (err: any) {
        addToast(err?.message || 'Failed to withdraw leave request.', 'error');
      } finally {
        setWithdrawingId(null);
      }
    },
    [currentUser.id, fetchLeaveApplications, updateLeaveApplication, addToast]
  );

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-800">My Leave</h2>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-[#191974] text-white rounded-lg hover:bg-[#13135c] text-sm font-medium transition-colors shadow-sm touch-manipulation w-full sm:w-auto"
        >
          <IconPlus className="w-4 h-4" /> Apply for leave
        </button>
      </div>

      {myApplications.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">No leave applications yet.</p>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-3">
            {myApplications.map((app) => {
              const { from, to, dayCount } = getAppDateRange(app);
              const durationText = from === to ? formatDateShort(from) : `${formatDateShort(from)} – ${formatDateShort(to)} (${dayCount} days)`;
              return (
                <div
                  key={app.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setDetailLeaveId(app.id)}
                    className="w-full text-left"
                  >
                    <p className="text-slate-800 font-medium">
                      {new Date(app.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </p>
                    <p className="text-sm text-slate-600 mt-0.5">{durationText}</p>
                    <p className="text-xs text-slate-500 truncate mt-1" title={app.reason}>{app.reason}</p>
                    <span className={`inline-flex mt-2 px-2.5 py-1 text-xs font-medium rounded-full ${getStatusClass(app.status)}`}>
                      {app.status}
                    </span>
                  </button>
                  {app.status === 'Pending' && (
                    <div className="mt-3 pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleWithdraw(e, app.id)}
                        disabled={withdrawingId !== null}
                        className="text-sm font-medium text-slate-600 hover:text-slate-800 underline disabled:opacity-50 touch-manipulation"
                      >
                        {withdrawingId === app.id ? 'Withdrawing...' : 'Withdraw'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Desktop: table */}
          <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600">
                <thead className="text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Leave applied</th>
                    <th className="px-4 py-3">Leave duration</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {myApplications.map((app) => {
                    const { from, to, dayCount } = getAppDateRange(app);
                    const durationText = from === to ? formatDateShort(from) : `${formatDateShort(from)} – ${formatDateShort(to)} (${dayCount} days)`;
                    return (
                      <tr
                        key={app.id}
                        onClick={() => setDetailLeaveId(app.id)}
                        className="hover:bg-slate-50/50 cursor-pointer"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-slate-800 font-medium">
                          {new Date(app.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </td>
                        <td className="px-4 py-3 text-slate-700">{durationText}</td>
                        <td className="px-4 py-3 max-w-[220px] truncate" title={app.reason}>
                          {app.reason}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${getStatusClass(app.status)}`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          {app.status === 'Pending' && (
                            <button
                              type="button"
                              onClick={(e) => handleWithdraw(e, app.id)}
                              disabled={withdrawingId !== null}
                              className="text-xs font-medium text-slate-600 hover:text-slate-800 underline disabled:opacity-50"
                            >
                              {withdrawingId === app.id ? 'Withdrawing...' : 'Withdraw'}
                            </button>
                          )}
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

      {detailLeaveId && (() => {
        const app = myApplications.find((a) => a.id === detailLeaveId);
        if (!app) return null;
        return (
          <LeaveDetailDrawer
            app={app}
            onClose={() => {
              setDetailLeaveId(null);
              navigate('/settings/my-leave');
            }}
          />
        );
      })()}

      {/* Right-side drawer: Apply for leave */}
      <>
        <div
          className={`fixed inset-0 z-40 bg-black/25 transition-opacity duration-300 ease-out ${
            drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
        <div
          className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
            drawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-4 sm:px-5 py-4">
            <h3 className="text-lg font-semibold text-slate-800">Apply for leave</h3>
            <button type="button" onClick={() => setDrawerOpen(false)} className="p-2 -mr-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors touch-manipulation" aria-label="Close">
              <IconX className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {/* Add days: mode toggle + single set of fields */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex gap-1 p-1 rounded-lg bg-white border border-slate-200 w-fit mb-4">
                <button
                  type="button"
                  onClick={() => setAddMode('single')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${addMode === 'single' ? 'bg-[#191974] text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  Single day
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('range')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${addMode === 'range' ? 'bg-[#191974] text-white shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  Date range
                </button>
              </div>
              {addMode === 'single' ? (
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                    <input type="date" value={singleDate} onChange={(e) => setSingleDate(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#191974] focus:border-[#191974]" />
                  </div>
                  <div className="w-36">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                    <select value={singleType} onChange={(e) => setSingleType(e.target.value as LeaveDayType)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#191974]">
                      {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  {singleType === 'hours' && (
                    <>
                      <div className="w-20">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Hrs</label>
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={singleHours}
                          onChange={(e) => {
                            const h = Number(e.target.value) || 0;
                            setSingleHours(h);
                            setSingleEndTime(minutesToTime(timeToMinutes(singleStartTime) + h * 60));
                          }}
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">From time</label>
                        <input
                          type="time"
                          value={singleStartTime}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSingleStartTime(v);
                            setSingleEndTime(minutesToTime(timeToMinutes(v) + singleHours * 60));
                          }}
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">To time</label>
                        <input
                          type="time"
                          value={singleEndTime}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSingleEndTime(v);
                            if (timeToMinutes(v) > timeToMinutes(singleStartTime)) {
                              setSingleHours(hoursBetween(singleStartTime, v));
                            }
                          }}
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </>
                  )}
                  <button type="button" onClick={addSingleDay} className="px-4 py-2.5 text-sm font-medium text-white bg-[#191974] rounded-lg hover:bg-[#13135c] transition-colors">
                    Add
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
                    <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="w-full min-w-[130px] px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#191974]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
                    <input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="w-full min-w-[130px] px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#191974]" />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                    <select value={rangeType} onChange={(e) => setRangeType(e.target.value as LeaveDayType)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm">
                      {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  {rangeType === 'hours' && (
                    <>
                      <div className="w-20">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Hrs</label>
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={rangeHours}
                          onChange={(e) => {
                            const h = Number(e.target.value) || 0;
                            setRangeHours(h);
                            setRangeEndTime(minutesToTime(timeToMinutes(rangeStartTime) + h * 60));
                          }}
                          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">From time</label>
                        <input
                          type="time"
                          value={rangeStartTime}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRangeStartTime(v);
                            setRangeEndTime(minutesToTime(timeToMinutes(v) + rangeHours * 60));
                          }}
                          className="w-full min-w-[100px] px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">To time</label>
                        <input
                          type="time"
                          value={rangeEndTime}
                          onChange={(e) => {
                            const v = e.target.value;
                            setRangeEndTime(v);
                            if (timeToMinutes(v) > timeToMinutes(rangeStartTime)) {
                              setRangeHours(hoursBetween(rangeStartTime, v));
                            }
                          }}
                          className="w-full min-w-[100px] px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </>
                  )}
                  <button type="button" onClick={addRange} className="px-4 py-2.5 text-sm font-medium text-white bg-[#191974] rounded-lg hover:bg-[#13135c] transition-colors">
                    Add range
                  </button>
                </div>
              )}
              <p className="text-xs text-slate-500 mt-2">Sundays are skipped.</p>
            </div>

            {/* Selected days as chips */}
            {days.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Your leave days · {days.length}</p>
                <div className="flex flex-wrap gap-2">
                  {days.map((row) => (
                    <span
                      key={row.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#191974]/10 px-3 py-1.5 text-sm text-[#191974] font-medium"
                    >
                      {row.leave_date}
                      <span className="text-slate-500 font-normal">
                        · {row.type === 'hours'
                          ? (row.start_time && row.end_time ? `${row.start_time} – ${row.end_time}` : `${row.hours}h`)
                          : TYPE_OPTIONS.find((o) => o.value === row.type)?.label ?? row.type}
                      </span>
                      <button type="button" onClick={() => removeDay(row.id)} className="ml-0.5 p-0.5 rounded-full hover:bg-[#191974]/20 text-slate-400 hover:text-red-600" aria-label="Remove">
                        <IconX className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm placeholder-slate-400 focus:ring-2 focus:ring-[#191974] focus:border-[#191974]" placeholder="Brief reason for leave" />
            </div>
          </div>
          <div className="p-4 sm:p-5 pb-6 sm:pb-5 border-t border-slate-200 flex flex-col sm:flex-row gap-3 bg-white">
            <button type="button" onClick={() => setDrawerOpen(false)} className="flex-1 px-4 py-3 sm:py-2.5 text-sm font-medium border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors touch-manipulation">
              Cancel
            </button>
            <button type="button" onClick={validateAndSubmit} disabled={submitting || days.length === 0} className="flex-1 px-4 py-3 sm:py-2.5 text-sm font-medium bg-[#191974] text-white rounded-xl hover:bg-[#13135c] disabled:opacity-50 transition-colors touch-manipulation">
              {submitting ? 'Submitting...' : 'Submit request'}
            </button>
          </div>
        </div>
      </>
    </div>
  );
};

export default MyLeaveTab;
