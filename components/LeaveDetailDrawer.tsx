import React from 'react';
import { LeaveApplication, LeaveApplicationDay } from '../types';
import { IconX, IconCheckCircle, IconXCircle, IconRefresh } from '../constants';

const DAY_TYPE_LABELS: Record<string, string> = {
  full: 'Full day',
  half_AM: 'Half AM',
  half_PM: 'Half PM',
  hours: 'Hours',
};

function getAppDateRange(app: LeaveApplication): { from: string; to: string; dayCount: number } {
  const days = (app.leave_application_days || []).map((d) => d.leave_date).sort();
  if (days.length === 0) return { from: '—', to: '—', dayCount: 0 };
  return { from: days[0], to: days[days.length - 1], dayCount: days.length };
}

function formatDateYMD(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(t: string | null | undefined): string {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  if (h == null) return t;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m != null && m > 0 ? `${h12}:${String(m).padStart(2, '0')} ${period}` : `${h12} ${period}`;
}

interface LeaveDetailDrawerProps {
  app: LeaveApplication;
  onClose: () => void;
  /** Optional: show applicant name (e.g. in calendar view for Super Admin) */
  showApplicantName?: boolean;
  /** Optional: when provided and status is Pending, show Approve button */
  onApprove?: () => void;
  /** Optional: when provided and status is Pending, show Reject button (opens reject flow in parent) */
  onRejectOpen?: () => void;
  /** Optional: when provided and status is Approved, show Revoke button (super admin revokes the leave) */
  onRevoke?: () => void;
  /** True while revoke request is in progress */
  revoking?: boolean;
}

export const LeaveDetailDrawer: React.FC<LeaveDetailDrawerProps> = ({ app, onClose, showApplicantName, onApprove, onRejectOpen, onRevoke, revoking }) => {
  const { from, to, dayCount } = getAppDateRange(app);
  const days = (app.leave_application_days || []).sort((a, b) => a.leave_date.localeCompare(b.leave_date));
  const statusClass =
    app.status === 'Approved'
      ? 'bg-emerald-100 text-emerald-800'
      : app.status === 'Rejected'
        ? 'bg-red-100 text-red-800'
        : app.status === 'Withdrawn'
          ? 'bg-slate-100 text-slate-600'
          : app.status === 'Revoked'
            ? 'bg-orange-100 text-orange-800'
            : 'bg-amber-100 text-amber-800';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" aria-hidden onClick={onClose} />
      <div
        className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
        role="dialog"
        aria-label="Leave details"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-5 py-4 bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-800 truncate pr-2">Leave details</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors touch-manipulation shrink-0"
            aria-label="Close"
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {showApplicantName && app.staff && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Applicant</p>
              <p className="font-medium text-slate-800">{app.staff.name || 'Staff'}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Leave duration</p>
            <p className="text-slate-800 font-medium">
              {from === to ? formatDateYMD(from) : `${formatDateYMD(from)} – ${formatDateYMD(to)}`}
              {dayCount > 0 && <span className="text-slate-500 font-normal"> ({dayCount} day{dayCount !== 1 ? 's' : ''})</span>}
            </p>
          </div>

          {days.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Leave days</p>
              <ul className="space-y-1.5">
                {days.map((day: LeaveApplicationDay) => (
                  <li key={day.id} className="flex flex-col gap-0.5 text-sm text-slate-700">
                    <div className="flex items-center justify-between">
                      <span>{formatDateYMD(day.leave_date)}</span>
                      <span className="text-slate-500">
                        {DAY_TYPE_LABELS[day.type] || day.type}
                        {day.type === 'hours' && day.hours != null ? ` (${day.hours}h)` : ''}
                      </span>
                    </div>
                    {day.type === 'hours' && (day.start_time || day.end_time) && (
                      <p className="text-xs text-slate-600 font-medium">
                        Time: {formatTime(day.start_time)} – {formatTime(day.end_time)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Reason</p>
            <p className="text-slate-800">{app.reason || '—'}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Status</p>
            <span className={`inline-flex px-2.5 py-1 text-sm font-medium rounded-full ${statusClass}`}>
              {app.status}
            </span>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Leave applied</p>
            <p className="text-slate-600">{new Date(app.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
          </div>

          {app.status === 'Approved' && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Approved by</p>
              <div className="flex items-center gap-3">
                {app.approved_by_staff && (
                  <span title={app.approved_by_staff.name || 'Staff'}>
                    {app.approved_by_staff.avatar_url ? (
                      <img src={app.approved_by_staff.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <span className="inline-flex w-10 h-10 rounded-full bg-slate-200 items-center justify-center text-slate-600 font-medium text-sm">
                        {app.approved_by_staff.name?.charAt(0) || '?'}
                      </span>
                    )}
                  </span>
                )}
                <span className="text-slate-600 text-sm">
                  {app.updated_at ? new Date(app.updated_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                </span>
              </div>
            </div>
          )}

          {app.status === 'Rejected' && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Rejection reason</p>
              <p className="text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm">
                {app.rejected_reason || 'No reason provided.'}
              </p>
              {app.approved_by_staff && (
                <p className="text-xs text-slate-500 mt-1">Rejected by {app.approved_by_staff.name}</p>
              )}
            </div>
          )}

          {app.status === 'Revoked' && (
            <p className="text-sm text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
              This leave was revoked by the administrator after being approved.
            </p>
          )}
        </div>

        {app.status === 'Approved' && onRevoke && (
          <div className="sticky bottom-0 left-0 right-0 flex flex-col sm:flex-row gap-2 px-4 pt-4 pb-6 sm:pb-6 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <button
              type="button"
              onClick={onRevoke}
              disabled={revoking}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2 text-sm font-medium text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors touch-manipulation disabled:opacity-50"
            >
              <IconRefresh className="w-4 h-4" /> {revoking ? 'Revoking...' : 'Revoke'}
            </button>
          </div>
        )}

        {app.status === 'Pending' && (onApprove || onRejectOpen) && (
          <div className="sticky bottom-0 left-0 right-0 flex flex-col sm:flex-row gap-2 px-4 pt-4 pb-6 sm:pb-6 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {onApprove && (
              <button type="button" onClick={onApprove} className="inline-flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors touch-manipulation">
                <IconCheckCircle className="w-4 h-4" /> Approve
              </button>
            )}
            {onRejectOpen && (
              <button type="button" onClick={onRejectOpen} className="inline-flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors touch-manipulation">
                <IconXCircle className="w-4 h-4" /> Reject
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};
