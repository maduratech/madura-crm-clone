import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  SubAgentRegistration,
  SubAgentRegistrationStatus,
  LoggedInUser,
} from '../types';
import { IconSearch, IconPlus, IconX, IconPencil, IconTrash } from '../constants';
import { useToast } from './ToastProvider';
import { useAuth } from '../contexts/AuthProvider';
import { useData } from '../contexts/DataProvider';

const PACKAGES: SubAgentRegistration['package'][] = [
  'Monthly Package',
  'Yearly Package',
  'Lifetime Package',
];

const STATUS_OPTIONS: SubAgentRegistrationStatus[] = [
  SubAgentRegistrationStatus.Enquiry,
  SubAgentRegistrationStatus.PaymentCompleted,
  SubAgentRegistrationStatus.BillingCompleted,
  SubAgentRegistrationStatus.PortalsLoginsSent,
  SubAgentRegistrationStatus.TrainingScheduled,
  SubAgentRegistrationStatus.TrainingCompleted,
  SubAgentRegistrationStatus.Live,
];

// --- Form (New Registration) - Terms & CAPTCHA are on WordPress form only ---
const SubAgentRegistrationForm: React.FC<{
  onCancel: () => void;
  onSubmit: (data: Partial<SubAgentRegistration>) => Promise<boolean>;
}> = ({ onCancel, onSubmit }) => {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<Partial<SubAgentRegistration>>({
    company_name: '',
    pan_number: '',
    do_not_have_pan: false,
    package: 'Monthly Package',
    first_name_middle: '',
    last_name: '',
    email: '',
    mobile: '',
    sales_in_charge_id: null,
    gst_number: '',
    gst_name: '',
    gst_address: '',
    street: '',
    pin_code: '',
    country: 'India',
    state: '',
    city: '',
    terms_accepted: true,
  });

  const handleChange = useCallback((field: keyof SubAgentRegistration, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name?.trim() || !form.first_name_middle?.trim() || !form.last_name?.trim() ||
        !form.email?.trim() || !form.mobile?.trim() || !form.street?.trim() || !form.pin_code?.trim()) {
      addToast('Please fill all required fields.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const ok = await onSubmit(form);
      if (ok) {
        addToast('Registration submitted successfully.', 'success');
        onCancel();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account Information */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Account Information</h3>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Company name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.company_name || ''}
              onChange={(e) => handleChange('company_name', e.target.value)}
              className="w-full p-2 border rounded-md text-sm"
              required
            />
          </div>
        </div>

        {/* Company Information - PAN */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Company Information</h3>
          <div className="space-y-2">
            {!form.do_not_have_pan && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">PAN Number</label>
                <input
                  type="text"
                  value={form.pan_number || ''}
                  onChange={(e) => handleChange('pan_number', e.target.value)}
                  className="w-full p-2 border rounded-md text-sm"
                  placeholder="e.g. AAAAA9999A"
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.do_not_have_pan || false}
                onChange={(e) => handleChange('do_not_have_pan', e.target.checked)}
              />
              Do Not Have PAN
            </label>
            <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
              Note: All TDS collected will be deducted on the given PAN Name & Number. If information is not provided, invalid or incomplete, 20% TDS will be deducted.
            </p>
          </div>
        </div>

        {/* Package */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Package <span className="text-red-500">*</span></label>
          <div className="flex gap-4">
            {PACKAGES.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="package"
                  value={p}
                  checked={form.package === p}
                  onChange={() => handleChange('package', p)}
                />
                {p}
              </label>
            ))}
          </div>
        </div>

        {/* Person In-Charge */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Person In-Charge</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">First Name and Middle Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.first_name_middle || ''}
                onChange={(e) => handleChange('first_name_middle', e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Last Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.last_name || ''}
                onChange={(e) => handleChange('last_name', e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Your Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Your Mobile no <span className="text-red-500">*</span></label>
              <div className="flex">
                <span className="inline-flex items-center px-3 py-2 border border-r-0 rounded-l-md bg-slate-100 text-sm text-slate-600">+91</span>
                <input
                  type="tel"
                  value={form.mobile || ''}
                  onChange={(e) => handleChange('mobile', e.target.value)}
                  className="flex-1 p-2 border rounded-r-md text-sm"
                  placeholder="10-digit mobile"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* GST Information */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">GST Information</h3>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">GST Number</label>
              <input
                type="text"
                value={form.gst_number || ''}
                onChange={(e) => handleChange('gst_number', e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">GST Name</label>
              <input
                type="text"
                value={form.gst_name || ''}
                onChange={(e) => handleChange('gst_name', e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">GST Address</label>
              <textarea
                value={form.gst_address || ''}
                onChange={(e) => handleChange('gst_address', e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Address</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Street <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.street || ''}
                onChange={(e) => handleChange('street', e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Pin Code <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.pin_code || ''}
                onChange={(e) => handleChange('pin_code', e.target.value)}
                className="w-full p-2 border rounded-md text-sm"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Country</label>
                <input
                  type="text"
                  value={form.country || ''}
                  onChange={(e) => handleChange('country', e.target.value)}
                  className="w-full p-2 border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
                <input
                  type="text"
                  value={form.state || ''}
                  onChange={(e) => handleChange('state', e.target.value)}
                  className="w-full p-2 border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
                <input
                  type="text"
                  value={form.city || ''}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className="w-full p-2 border rounded-md text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-md text-sm">
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-[#191974] text-white rounded-md text-sm font-medium disabled:opacity-50">
            {isSubmitting ? 'Submitting...' : 'Submit Registration'}
          </button>
        </div>
      </form>
  );
};

// --- Form Drawer (New Registration) ---
const FormDrawer: React.FC<{
  isOpen: boolean;
  isClosing: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}> = ({ isOpen, isClosing, onClose, children, title }) => {
  const slideClass = !isOpen || isClosing ? 'translate-x-full' : 'translate-x-0';
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-out ${
          isOpen && !isClosing ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-xl flex flex-col transition-transform duration-300 ease-out ${slideClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <IconX className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </>
  );
};

// --- Detail Drawer (smooth open/close) ---
const DetailDrawer: React.FC<{
  registration: SubAgentRegistration | null;
  isOpen: boolean;
  isClosing: boolean;
  onClose: () => void;
  onStatusChange: (id: number, status: SubAgentRegistrationStatus) => Promise<void>;
  onSave: (id: number, data: Partial<SubAgentRegistration>) => Promise<void>;
  canDelete: boolean;
  onDelete: (id: number) => Promise<void>;
}> = ({ registration, isOpen, isClosing, onClose, onStatusChange, onSave, canDelete, onDelete }) => {
  const [changingStatus, setChangingStatus] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<Partial<SubAgentRegistration>>({});

  useEffect(() => {
    if (registration) {
      setEdit({
        company_name: registration.company_name ?? '',
        pan_number: registration.pan_number ?? '',
        do_not_have_pan: registration.do_not_have_pan ?? false,
        package: registration.package ?? 'Monthly Package',
        first_name_middle: registration.first_name_middle ?? '',
        last_name: registration.last_name ?? '',
        email: registration.email ?? '',
        mobile: registration.mobile ?? '',
        gst_number: registration.gst_number ?? '',
        gst_name: registration.gst_name ?? '',
        gst_address: registration.gst_address ?? '',
        street: registration.street ?? '',
        pin_code: registration.pin_code ?? '',
        country: registration.country ?? 'India',
        state: registration.state ?? '',
        city: registration.city ?? '',
      });
    }
  }, [registration]);

  const handleEditChange = useCallback((field: keyof SubAgentRegistration, value: unknown) => {
    setEdit((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveClick = async () => {
    if (!registration) return;
    setSaving(true);
    try {
      await onSave(registration.id, edit);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusSelect = async (status: SubAgentRegistrationStatus) => {
    if (!registration) return;
    setChangingStatus(true);
    setShowStatusMenu(false);
    try {
      await onStatusChange(registration.id, status);
    } finally {
      setChangingStatus(false);
    }
  };

  const handleDeleteClick = () => setShowDeleteConfirm(true);
  const handleDeleteConfirm = async () => {
    if (!registration) return;
    setDeleting(true);
    setShowDeleteConfirm(false);
    try {
      await onDelete(registration.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };
  const handleDeleteCancel = () => setShowDeleteConfirm(false);

  const statusColors: Record<SubAgentRegistrationStatus, string> = {
    [SubAgentRegistrationStatus.Enquiry]: 'bg-slate-100 text-slate-800',
    [SubAgentRegistrationStatus.PaymentCompleted]: 'bg-blue-100 text-blue-800',
    [SubAgentRegistrationStatus.BillingCompleted]: 'bg-indigo-100 text-indigo-800',
    [SubAgentRegistrationStatus.PortalsLoginsSent]: 'bg-purple-100 text-purple-800',
    [SubAgentRegistrationStatus.TrainingScheduled]: 'bg-amber-100 text-amber-800',
    [SubAgentRegistrationStatus.TrainingCompleted]: 'bg-cyan-100 text-cyan-800',
    [SubAgentRegistrationStatus.Live]: 'bg-green-100 text-green-800',
  };

  if (!registration) return null;

  const slideClass = !isOpen || isClosing ? 'translate-x-full' : 'translate-x-0';

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ease-out ${
          isOpen && !isClosing ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-50/95 backdrop-blur-sm flex flex-col transition-transform duration-300 ease-out ${slideClass} border-l border-slate-200/80`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: name + status + close */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 truncate">
                {registration.first_name_middle} {registration.last_name}
              </h2>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${statusColors[registration.status]}`}>
                  {registration.status}
                </span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowStatusMenu((v) => !v)}
                    disabled={changingStatus}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                  >
                    <IconPencil className="w-3.5 h-3.5" />
                    Change status
                  </button>
                  {showStatusMenu && (
                    <div className="absolute left-0 top-full mt-1 py-1 bg-white rounded-lg shadow-lg border border-slate-200/80 z-10 min-w-[200px]">
                      {STATUS_OPTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleStatusSelect(s)}
                          className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-md last:rounded-b-md transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors" aria-label="Close">
              <IconX className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-5">
            <Section title="Account & Company">
              <EditRow label="Company name" value={edit.company_name ?? ''} onChange={(v) => handleEditChange('company_name', v)} />
              {!edit.do_not_have_pan && (
                <EditRow label="PAN Number" value={edit.pan_number ?? ''} onChange={(v) => handleEditChange('pan_number', v)} />
              )}
              <label className="flex items-center gap-2 text-sm text-slate-600 mt-2">
                <input type="checkbox" checked={edit.do_not_have_pan ?? false} onChange={(e) => handleEditChange('do_not_have_pan', e.target.checked)} className="rounded border-slate-300" />
                Do not have PAN
              </label>
              <div className="mt-2">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Package</span>
                <div className="flex flex-wrap gap-3 mt-1">
                  {PACKAGES.map((p) => (
                    <label key={p} className="flex items-center gap-1.5 text-sm">
                      <input type="radio" name="detail-package" checked={edit.package === p} onChange={() => handleEditChange('package', p)} className="text-slate-600" />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Person In-Charge">
              <EditRow label="First & Middle Name" value={edit.first_name_middle ?? ''} onChange={(v) => handleEditChange('first_name_middle', v)} />
              <EditRow label="Last Name" value={edit.last_name ?? ''} onChange={(v) => handleEditChange('last_name', v)} />
              <EditRow label="Email" value={edit.email ?? ''} onChange={(v) => handleEditChange('email', v)} />
              <EditRow label="Mobile" value={edit.mobile ?? ''} onChange={(v) => handleEditChange('mobile', v)} />
            </Section>

            <Section title="GST Information">
              <EditRow label="GST Number" value={edit.gst_number ?? ''} onChange={(v) => handleEditChange('gst_number', v)} />
              <EditRow label="GST Name" value={edit.gst_name ?? ''} onChange={(v) => handleEditChange('gst_name', v)} />
              <EditRow label="GST Address" value={edit.gst_address ?? ''} onChange={(v) => handleEditChange('gst_address', v)} textarea />
            </Section>

            <Section title="Address">
              <EditRow label="Street" value={edit.street ?? ''} onChange={(v) => handleEditChange('street', v)} />
              <EditRow label="Pin Code" value={edit.pin_code ?? ''} onChange={(v) => handleEditChange('pin_code', v)} />
              <EditRow label="Country" value={edit.country ?? 'India'} onChange={(v) => handleEditChange('country', v)} />
              <EditRow label="State" value={edit.state ?? ''} onChange={(v) => handleEditChange('state', v)} />
              <EditRow label="City" value={edit.city ?? ''} onChange={(v) => handleEditChange('city', v)} />
            </Section>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200/80">
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : null}
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200/80 text-[11px] text-slate-400 tracking-wide">
            Created {new Date(registration.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            <span className="mx-1.5">·</span>
            Updated {new Date(registration.updated_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>

          {canDelete && (
            <div className="mt-6 pt-4 border-t border-slate-200/80">
              {showDeleteConfirm ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-slate-600">Delete this registration? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteConfirm}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <IconTrash className="w-4 h-4" />}
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteCancel}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                >
                  <IconTrash className="w-4 h-4" />
                  Delete registration
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/80 border border-slate-200/60 p-4 shadow-sm">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function EditRow({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  textarea?: boolean;
}) {
  const inputClass = 'w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 disabled:bg-slate-50 disabled:text-slate-500';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} className={inputClass + ' min-h-[60px] resize-y'} rows={2} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} className={inputClass} />
      )}
    </div>
  );
}

// --- Main Page ---
const SubAgentRegistrations: React.FC<{ currentUser: LoggedInUser }> = ({ currentUser }) => {
  const { addToast } = useToast();
  const { session } = useAuth();
  const { subAgentRegistrations, loadingSubAgentRegistrations, fetchSubAgentRegistrations } = useData();
  const [filtered, setFiltered] = useState<SubAgentRegistration[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubAgentRegistrationStatus | 'All'>('All');
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [formDrawerClosing, setFormDrawerClosing] = useState(false);
  const [selected, setSelected] = useState<SubAgentRegistration | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);

  const hasAccess =
    currentUser.role_id === 1 ||
    currentUser.role_id === 2 ||
    currentUser.is_lead_manager === true;
  const isSuperAdmin = currentUser.role_id === 1;

  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    if (hasAccess) fetchSubAgentRegistrations();
  }, [hasAccess, fetchSubAgentRegistrations]);

  useEffect(() => {
    let result = subAgentRegistrations;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          `${r.first_name_middle} ${r.last_name}`.toLowerCase().includes(q) ||
          r.company_name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.mobile?.includes(q) ||
          r.city?.toLowerCase().includes(q) ||
          r.state?.toLowerCase().includes(q) ||
          r.country?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All') {
      result = result.filter((r) => r.status === statusFilter);
    }
    setFiltered(result);
  }, [subAgentRegistrations, search, statusFilter]);

  const openDrawer = useCallback((reg: SubAgentRegistration) => {
    setSelected(reg);
    setDrawerClosing(false);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerClosing(true);
    setTimeout(() => {
      setDrawerOpen(false);
      setSelected(null);
      setDrawerClosing(false);
    }, 300);
  }, []);

  const openFormDrawer = useCallback(() => {
    setFormDrawerClosing(false);
    setFormDrawerOpen(true);
  }, []);

  const closeFormDrawer = useCallback(() => {
    setFormDrawerClosing(true);
    setTimeout(() => {
      setFormDrawerOpen(false);
      setFormDrawerClosing(false);
    }, 300);
  }, []);

  const handleSubmit = async (data: Partial<SubAgentRegistration>): Promise<boolean> => {
    if (!session?.access_token) {
      addToast('Authentication required', 'error');
      return false;
    }
    try {
      const res = await fetch(`${API_BASE}/api/sub-agent-registrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...data,
          status: data.status || SubAgentRegistrationStatus.Enquiry,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to submit');
      }
      await fetchSubAgentRegistrations(true);
      return true;
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Failed to submit registration', 'error');
      return false;
    }
  };

  const handleStatusChange = async (id: number, status: SubAgentRegistrationStatus) => {
    if (!session?.access_token) {
      addToast('Authentication required', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/sub-agent-registrations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      addToast('Status updated.', 'success');
      await fetchSubAgentRegistrations(true);
      if (selected?.id === id) {
        const updated = await fetch(`${API_BASE}/api/sub-agent-registrations/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).then((r) => r.json());
        setSelected(updated);
      }
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Failed to update status', 'error');
    }
  };

  const handleSaveDetail = async (id: number, data: Partial<SubAgentRegistration>) => {
    if (!session?.access_token) {
      addToast('Authentication required', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/sub-agent-registrations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save');
      }
      const updated = await res.json();
      addToast('Changes saved.', 'success');
      await fetchSubAgentRegistrations(true);
      if (selected?.id === id) setSelected(updated);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Failed to save changes', 'error');
      throw e;
    }
  };

  const handleDelete = async (id: number) => {
    if (!session?.access_token) {
      addToast('Authentication required', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/sub-agent-registrations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete');
      }
      addToast('Registration deleted.', 'success');
      await fetchSubAgentRegistrations(true);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : 'Failed to delete registration', 'error');
      throw e;
    }
  };

  const statusColors: Record<SubAgentRegistrationStatus, string> = {
    [SubAgentRegistrationStatus.Enquiry]: 'bg-slate-100 text-slate-800',
    [SubAgentRegistrationStatus.PaymentCompleted]: 'bg-blue-100 text-blue-800',
    [SubAgentRegistrationStatus.BillingCompleted]: 'bg-indigo-100 text-indigo-800',
    [SubAgentRegistrationStatus.PortalsLoginsSent]: 'bg-purple-100 text-purple-800',
    [SubAgentRegistrationStatus.TrainingScheduled]: 'bg-amber-100 text-amber-800',
    [SubAgentRegistrationStatus.TrainingCompleted]: 'bg-cyan-100 text-cyan-800',
    [SubAgentRegistrationStatus.Live]: 'bg-green-100 text-green-800',
  };

  if (!hasAccess) {
    return (
      <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm">
        <h1 className="text-lg sm:text-2xl font-bold text-slate-800 mb-3 sm:mb-4">Sub-Agents Registrations</h1>
        <p className="text-slate-600 text-sm">You don&apos;t have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-2xl font-bold text-slate-800">Sub-Agents Registrations</h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => fetchSubAgentRegistrations(true)}
            disabled={loadingSubAgentRegistrations}
            className="px-3 sm:px-4 py-2 border rounded-md text-xs sm:text-sm font-medium hover:bg-slate-50 disabled:opacity-50 min-h-[44px] sm:min-h-0"
          >
            {loadingSubAgentRegistrations ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={openFormDrawer}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-[#191974] text-white rounded-md text-xs sm:text-sm font-medium hover:bg-[#14145a] min-h-[44px] sm:min-h-0"
          >
            <IconPlus className="w-5 h-5" />
            <span className="hidden sm:inline">New Registration</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      <FormDrawer
        isOpen={formDrawerOpen}
        isClosing={formDrawerClosing}
        onClose={closeFormDrawer}
        title="New Sub-Agent Registration"
      >
        {formDrawerOpen && (
          <SubAgentRegistrationForm
            key="new-registration-form"
            onCancel={closeFormDrawer}
            onSubmit={handleSubmit}
          />
        )}
      </FormDrawer>

      <div className="mb-4 flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
        <div className="flex-1 relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, company, email, phone, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-4 py-2 border rounded-md text-sm min-h-[44px] sm:min-h-0"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SubAgentRegistrationStatus | 'All')}
          className="px-3 sm:px-4 py-2 border rounded-md text-sm w-full sm:w-auto min-h-[44px] sm:min-h-0"
        >
          <option value="All">All status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loadingSubAgentRegistrations && filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-500">Loading...</div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Company</th>
                <th className="px-6 py-3">Package</th>
                <th className="px-6 py-3">Address</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((reg) => (
                <tr
                  key={reg.id}
                  className="bg-white border-b hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => openDrawer(reg)}
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{reg.first_name_middle} {reg.last_name}</div>
                    <div className="text-slate-500 text-xs">{reg.mobile}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-800">{reg.company_name}</td>
                  <td className="px-6 py-4">{reg.package}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {[reg.city, reg.state, reg.country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[reg.status]}`}>
                      {reg.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center py-10 text-slate-500">
              {search || statusFilter !== 'All' ? 'No registrations match your filters.' : 'No registrations yet.'}
            </p>
          )}
        </div>
      )}

      <DetailDrawer
        registration={selected}
        isOpen={drawerOpen}
        isClosing={drawerClosing}
        onClose={closeDrawer}
        onStatusChange={handleStatusChange}
        onSave={handleSaveDetail}
        canDelete={isSuperAdmin}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default SubAgentRegistrations;
