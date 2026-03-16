
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Staff, Branch, LoggedInUser, Lead, Customer, StaffStatus, Service, getRoleName, RoleTag, LeaveApplication } from '../types';
import { IconSearch, IconPlus, IconX, IconPencil, IconTrash, IconEye, IconEyeOff } from '../constants';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { validatePasswordStrength, PASSWORD_HINT, PASSWORD_MIN_LENGTH } from '../lib/passwordValidation';
import { useData } from '../contexts/DataProvider';
import { useAuth } from '../contexts/AuthProvider';
import { AuthApiError } from '@supabase/supabase-js';
import { useRouter } from '../contexts/RouterProvider';
import { PhoneInput } from './CustomerDetailPanel';
import { getDefaultAvatarUrl } from '../lib/avatarUrl';

function getLeaveAppDisplay(app: LeaveApplication): { from: string; to: string; isHalfDay: boolean; halfDayPeriod: string } {
  const days = (app.leave_application_days || []).slice().sort((a, b) => a.leave_date.localeCompare(b.leave_date));
  if (days.length === 0) return { from: '—', to: '—', isHalfDay: false, halfDayPeriod: '' };
  const from = days[0].leave_date;
  const to = days[days.length - 1].leave_date;
  const halfDay = days.find(d => d.type === 'half_AM' || d.type === 'half_PM');
  const isHalfDay = !!halfDay;
  const halfDayPeriod = halfDay?.type === 'half_PM' ? 'PM' : 'AM';
  return { from, to, isHalfDay, halfDayPeriod };
}

const ConfirmationModal: React.FC<{ title: string; message: string; onConfirm: () => void; onCancel: () => void; }> = ({ title, message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-slate-600 my-4 whitespace-pre-wrap">{message}</p>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
                <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-md bg-red-600 text-white">Confirm</button>
            </div>
        </div>
    </div>
);

const AssociatedLeadsList: React.FC<{ leads: Lead[], customers: Customer[] }> = ({ leads, customers }) => {
    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    const { navigate } = useRouter();

    if (leads.length === 0) {
        return <p className="text-center text-slate-500 py-4">No associated leads found.</p>;
    }

    return (
        <ul className="space-y-3">
            {leads.map(lead => {
                const customer = customerMap.get(lead.customer_id);
                return (
                    <li
                        key={lead.id}
                        className="p-3 bg-slate-50 rounded-md border cursor-pointer hover:bg-slate-100 hover:border-blue-500 transition-colors"
                        onClick={() => {
                            sessionStorage.setItem('viewLeadId', lead.id.toString());
                            navigate('/leads/all');
                        }}
                    >
                        <p className="font-semibold text-slate-800">{lead.destination}</p>
                        <p className="text-sm text-slate-600">Customer: {customer ? `${customer.first_name} ${customer.last_name}` : 'N/A'}</p>
                        <div className="flex justify-between items-center mt-1">
                            <p className="text-xs text-slate-500">Travel Date: {new Date(lead.travel_date).toLocaleDateString()}</p>
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-200 text-slate-700">{lead.status}</span>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

/** Capsule style for tag (Lead Manager, Accountant, etc.). */
function getRoleTagCapsuleClass(rt: RoleTag): string {
    const slug = (rt.slug || rt.name || '').toLowerCase().replace(/\s+/g, '-');
    if (slug === 'accountant') return 'bg-amber-100 text-amber-800';
    if (slug === 'lead-manager') return 'bg-blue-100 text-blue-800';
    if (slug === 'task-manager') return 'bg-teal-100 text-teal-800';
    if (slug === 'developer') return 'bg-sky-100 text-sky-800';
    if (slug === 'design') return 'bg-pink-100 text-pink-800';
    if (slug === 'design-intern') return 'bg-pink-50 text-pink-700';
    if (slug === 'developer-intern') return 'bg-sky-50 text-sky-700';
    if (slug === 'sales-intern') return 'bg-emerald-50 text-emerald-700';
    if (slug === 'editor') return 'bg-indigo-100 text-indigo-800';
    if (slug === 'sales') return 'bg-emerald-100 text-emerald-800';
    if (slug === 'operations') return 'bg-violet-100 text-violet-800';
    return 'bg-slate-100 text-slate-700';
}

const DestinationBadges: React.FC<{ destinations?: string }> = ({ destinations = '' }) => {
    if (!destinations) return <span className="text-slate-400">N/A</span>;

    const MAX_BADGES = 3;
    const allDestinations = destinations.split(',').map(d => d.trim()).filter(Boolean);
    const displayedDestinations = allDestinations.slice(0, MAX_BADGES);
    const remainingCount = allDestinations.length - MAX_BADGES;

    return (
        <div className="flex flex-wrap gap-1 items-center">
            {displayedDestinations.map(dest => (
                <span key={dest} className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-600">
                    {dest}
                </span>
            ))}
            {remainingCount > 0 && (
                <div className="relative group">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-200 text-slate-700 cursor-pointer">
                        +{remainingCount}
                    </span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs text-white bg-slate-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                        {allDestinations.join(', ')}
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                    </div>
                </div>
            )}
        </div>
    );
};


// Detail panel for adding/editing a staff member
const StaffDetailPanel: React.FC<{
    staffMember: Staff | null;
    branches: Branch[];
    roleTags: RoleTag[];
    onClose: () => void;
    onSave: (staff: Partial<Staff>, avatarFile: File | null, password?: string | null, roleTagIds?: number[]) => Promise<boolean>;
    onToggleStatus: (staffId: number, newStatus: StaffStatus) => void;
    currentUser: LoggedInUser;
    leads: Lead[];
    customers: Customer[];
    leaveApplications: LeaveApplication[];
    fetchLeaveApplications: (force?: boolean) => Promise<void>;
}> = ({ staffMember, branches, roleTags, onClose, onSave, onToggleStatus, currentUser, leads, customers, leaveApplications, fetchLeaveApplications }) => {
    const isNew = !staffMember;
    const { addToast } = useToast();
    const { session } = useAuth();

    const [editedStaff, setEditedStaff] = useState<Partial<Staff>>(
        staffMember || { name: '', avatar_url: '', email: '', phone: '', extension_no: '', role_id: 3, branch_id: branches[0]?.id || 1, status: StaffStatus.Active, staff_no: '', on_leave_until: null, destinations: '', services: [], excluded_destinations: '', excluded_services: [], is_lead_manager: false, manage_lead_branches: [] }
    );
    const [isEditing, setIsEditing] = useState(isNew);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState(staffMember?.avatar_url || '');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isConfirmVisible, setIsConfirmVisible] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'daily-tracking'>('overview');

    // Daily Tracking state
    const [sessionData, setSessionData] = useState<any[]>([]);
    const [sessionLoading, setSessionLoading] = useState(false);
    const [dailyTrackingFilterStartDate, setDailyTrackingFilterStartDate] = useState<string>('');
    const [dailyTrackingFilterEndDate, setDailyTrackingFilterEndDate] = useState<string>('');
    const [dailyTrackingSortBy, setDailyTrackingSortBy] = useState<'date' | 'first_login' | 'last_login' | 'active_time'>('date');
    const [dailyTrackingSortOrder, setDailyTrackingSortOrder] = useState<'asc' | 'desc'>('desc');
    const [dailyTrackingPage, setDailyTrackingPage] = useState<number>(1);
    const dailyTrackingPageSize = 10;

    // Tags (Lead Manager, Accountant, etc.) – IDs for save
    const [selectedRoleTagIds, setSelectedRoleTagIds] = useState<number[]>([]);

    // Default date range (last 30 days)
    const defaultStartDate = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
    const defaultEndDate = new Date().toISOString().split('T')[0];

    useEffect(() => {
        const defaultStaff: Partial<Staff> = { name: '', avatar_url: '', email: '', phone: '', extension_no: '', role_id: 3, branch_id: branches[0]?.id || 1, status: StaffStatus.Active, staff_no: '', on_leave_until: null, destinations: '', services: [], excluded_destinations: '', excluded_services: [], is_lead_manager: false, manage_lead_branches: [] };
        setEditedStaff(staffMember || defaultStaff);
        setAvatarPreview(staffMember?.avatar_url || '');
        setAvatarFile(null);
        setIsEditing(isNew);
        setPassword('');
        setConfirmPassword('');
        setActiveTab('overview');
        setSelectedRoleTagIds(staffMember?.role_tags?.map(rt => rt.id) ?? []);
    }, [staffMember, isNew, branches]);

    // Fetch session data for staff member
    useEffect(() => {
        const fetchSessionData = async () => {
            if (!staffMember?.id || activeTab !== 'daily-tracking') {
                setSessionData([]);
                return;
            }

            setSessionLoading(true);
            try {
                const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
                const params = new URLSearchParams({
                    staffId: staffMember.id.toString(),
                    startDate: dailyTrackingFilterStartDate || defaultStartDate,
                    endDate: dailyTrackingFilterEndDate || defaultEndDate,
                    period: 'daily'
                });

                const response = await fetch(`${API_BASE}/api/sessions/report?${params}`, {
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch session data');
                }

                const responseData = await response.json();
                const sessionArray = Array.isArray(responseData?.data) ? responseData.data : (Array.isArray(responseData) ? responseData : []);
                setSessionData(sessionArray);
            } catch (error) {
                setSessionData([]);
            } finally {
                setSessionLoading(false);
            }
        };

        if (activeTab === 'daily-tracking') {
            fetchSessionData();
        }
    }, [staffMember?.id, activeTab, dailyTrackingFilterStartDate, dailyTrackingFilterEndDate, defaultStartDate, defaultEndDate]);

    const associatedLeads = useMemo(() => {
        if (!staffMember) return [];
        return leads.filter(lead => lead.assigned_to.some(assignee => assignee.id === staffMember.id));
    }, [leads, staffMember]);

    const handleFieldChange = (field: keyof Staff, value: any) => {
        setEditedStaff(prev => ({ ...prev, [field]: value }));
    };

    const handleServiceToggle = (service: Service) => {
        const currentServices = editedStaff.services || [];
        const isSelected = currentServices.includes(service);
        const newServices = isSelected
            ? currentServices.filter(s => s !== service)
            : [...currentServices, service];
        handleFieldChange('services', newServices);
    };

    const handleExcludedServiceToggle = (service: Service) => {
        const currentServices = editedStaff.excluded_services || [];
        const isSelected = currentServices.includes(service);
        const newServices = isSelected
            ? currentServices.filter(s => s !== service)
            : [...currentServices, service];
        handleFieldChange('excluded_services', newServices);
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 1024 * 1024) { // 1MB limit
                addToast('File size should not exceed 1MB.', 'error');
                return;
            }
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        let staffData = { ...editedStaff };

        // If a leave date is set, update the status accordingly
        if (staffData.on_leave_until && new Date(staffData.on_leave_until) > new Date()) {
            staffData.status = StaffStatus.OnLeave;
        } else if (staffData.status === StaffStatus.OnLeave && (!staffData.on_leave_until || new Date(staffData.on_leave_until) <= new Date())) {
            staffData.status = StaffStatus.Active;
        }

        if (isNew) {
            if (!staffData.name?.trim() || !staffData.email?.trim()) {
                addToast('Name and Email are required.', 'error');
                return;
            }
            if (password !== confirmPassword) {
                addToast('Passwords do not match.', 'error');
                return;
            }
            const pwdError = validatePasswordStrength(password);
            if (pwdError) {
                addToast(pwdError, 'error');
                return;
            }
        } else {
            if (!staffData.name?.trim()) {
                addToast('Name is required.', 'error');
                return;
            }
        }

        // Derive is_lead_manager / is_accountant / is_task_manager from selected tags (for DB sync)
        if (!isNew && roleTags.length > 0) {
            const leadManagerTag = roleTags.find(rt => (rt.slug || '').toLowerCase() === 'lead-manager' || rt.name === 'Lead Manager');
            const accountantTag = roleTags.find(rt => (rt.slug || '').toLowerCase() === 'accountant' || rt.name === 'Accountant');
            const taskManagerTag = roleTags.find(rt => (rt.slug || '').toLowerCase() === 'task-manager' || rt.name === 'Task Manager');
            staffData.is_lead_manager = leadManagerTag ? selectedRoleTagIds.includes(leadManagerTag.id) : false;
            staffData.is_accountant = accountantTag ? selectedRoleTagIds.includes(accountantTag.id) : false;
            staffData.is_task_manager = taskManagerTag ? selectedRoleTagIds.includes(taskManagerTag.id) : false;
            staffData.manage_lead_branches = staffData.is_lead_manager ? branches.map(b => b.id) : [];
        }

        setIsSaving(true);
        try {
            const roleTagIdsToSave = !isNew ? selectedRoleTagIds : undefined;
            const success = await onSave(staffData, avatarFile, isNew ? password : null, roleTagIdsToSave);
            if (success) {
                onClose();
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-20" onClick={onClose}>
            <div className="fixed inset-y-0 right-0 w-full sm:w-[50%] bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b h-16">
                    <h2 className="text-lg font-semibold text-slate-800">{isNew ? 'Add New Staff' : 'Staff Details'}</h2>
                    <div className="flex items-center gap-2">
                        {!isNew && !isEditing && currentUser.role === 'Super Admin' && (
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-[5px] hover:bg-slate-200"><IconPencil className="w-4 h-4" /> Edit</button>
                        )}
                        {!isNew && currentUser.role === 'Super Admin' && (
                            <select
                                value={staffMember?.status ?? ''}
                                onChange={(e) => { const v = e.target.value as StaffStatus; if (v && staffMember) onToggleStatus(staffMember.id, v); }}
                                className="text-sm font-medium px-3 py-1.5 border rounded-[5px] bg-white border-slate-200 text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value={StaffStatus.Active}>Active</option>
                                <option value={StaffStatus.DND}>DND</option>
                                <option value={StaffStatus.OnLeave}>On Leave</option>
                                <option value={StaffStatus.Inactive}>Inactive</option>
                            </select>
                        )}
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><IconX className="w-5 h-5 text-slate-600" /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {!isNew && (
                        <div className="border-b border-gray-200 mb-6 bg-white -mx-6 px-6 -mt-6 pt-2 sticky top-0 z-10">
                            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                                <button onClick={() => setActiveTab('overview')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Overview</button>
                                <button onClick={() => setActiveTab('daily-tracking')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'daily-tracking' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Daily Tracking</button>
                            </nav>
                        </div>
                    )}

                    {(activeTab === 'overview' || isNew) && (
                        <div className="space-y-6 bg-white p-6 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-4">
                                <div className="relative group shrink-0">
                                    <img src={avatarPreview || getDefaultAvatarUrl(editedStaff.name || 'Staff')} alt="Avatar" className="h-20 w-20 rounded-full object-cover bg-slate-100 border" />
                                    {isEditing && (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isSaving}
                                            className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-full shadow-md hover:bg-slate-100"
                                        >
                                            {isSaving ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> : <IconPencil className="w-4 h-4 text-slate-600" />}
                                        </button>
                                    )}
                                    <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/png, image/jpeg, image/gif" />
                                </div>
                                <div className="flex-1">
                                    {!isEditing ? (
                                        <>
                                            <h3 className="text-xl font-bold text-slate-800">{editedStaff.name}</h3>
                                            <p className="text-sm text-slate-500">{editedStaff.email}</p>
                                        </>
                                    ) : (
                                        <div className="text-xs text-slate-500">
                                            Update the staff member's details below.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <hr />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <InfoField label="Staff No." value={editedStaff.staff_no} isEditing={isEditing} onChange={e => handleFieldChange('staff_no', e.target.value)} />
                                <InfoField label="Full Name" value={editedStaff.name} isEditing={isEditing} onChange={e => handleFieldChange('name', e.target.value)} />

                                <div className="md:col-span-2">
                                    <InfoField label="Email Address" value={editedStaff.email} isEditing={isEditing && isNew} readOnly={!isNew} onChange={e => handleFieldChange('email', e.target.value)} />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-500 capitalize mb-1">Phone</label>
                                    <PhoneInput
                                        value={editedStaff.phone || ''}
                                        onChange={value => handleFieldChange('phone', value)}
                                        isEditing={isEditing}
                                    />
                                </div>

                                <div>
                                    <InfoField label="Extension No." value={editedStaff.extension_no} isEditing={isEditing} onChange={e => handleFieldChange('extension_no', e.target.value)} placeholder="Enter extension number" />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                                    {isEditing ? (
                                        <select value={editedStaff.role_id} onChange={e => handleFieldChange('role_id', parseInt(e.target.value))} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900">
                                            {[1, 2, 3].map(id => (
                                                <option key={id} value={id}>{getRoleName(id)}</option>
                                            ))}
                                        </select>
                                    ) : <p className="font-medium py-2 text-slate-900">{getRoleName(editedStaff.role_id!)}</p>}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Tags (Lead Manager, Accountant, Task Manager)</label>
                                    {isEditing ? (
                                        <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-slate-50 min-h-[2.5rem]">
                                            {roleTags.length === 0 ? (
                                                <span className="text-sm text-slate-500">No tags defined. Add tags in Settings → Manage Roles.</span>
                                            ) : (
                                                roleTags.map(rt => (
                                                    <label key={rt.id} className="flex items-center gap-1.5 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedRoleTagIds.includes(rt.id)}
                                                            onChange={() => setSelectedRoleTagIds(prev => prev.includes(rt.id) ? prev.filter(id => id !== rt.id) : [...prev, rt.id])}
                                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getRoleTagCapsuleClass(rt)}`}>{rt.name}</span>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5 py-2">
                                            {(staffMember?.role_tags?.length ?? 0) > 0 ? (
                                                staffMember!.role_tags!.map(rt => (
                                                    <span key={rt.id} className={`px-2.5 py-1 text-xs font-medium rounded-full ${getRoleTagCapsuleClass(rt)}`}>
                                                        {rt.name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-sm text-slate-500">None</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Branch</label>
                                    {isEditing ? (
                                        <select value={editedStaff.branch_id} onChange={e => handleFieldChange('branch_id', parseInt(e.target.value))} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900">
                                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    ) : <p className="font-medium py-2 text-slate-900">{branches.find(b => b.id === editedStaff.branch_id)?.name}</p>}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Handled Destinations (comma-separated)</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editedStaff.destinations || ''}
                                            onChange={e => handleFieldChange('destinations', e.target.value)}
                                            className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900"
                                            placeholder="e.g., Singapore, Dubai, Ooty"
                                        />
                                    ) : (
                                        <div className="py-2">
                                            <DestinationBadges destinations={editedStaff.destinations} />
                                        </div>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <h3 className="text-xs font-medium text-slate-500 mb-2">Handled Services</h3>
                                    {isEditing ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                                            {Object.values(Service).map(service => (
                                                <label key={service} className="flex items-center space-x-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={editedStaff.services?.includes(service)}
                                                        onChange={() => handleServiceToggle(service)}
                                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-slate-700">{service}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 py-2">
                                            {(editedStaff.services?.length || 0) > 0 ? (
                                                editedStaff.services!.map(service => (
                                                    <span key={service} className="px-2.5 py-1 text-sm font-medium rounded-md bg-slate-100 text-slate-700">
                                                        {service}
                                                    </span>
                                                ))
                                            ) : (
                                                <p className="text-sm text-slate-500 py-1">No services assigned.</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="md:col-span-2"><hr /></div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Excluded Destinations (comma-separated)</label>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editedStaff.excluded_destinations || ''}
                                            onChange={e => handleFieldChange('excluded_destinations', e.target.value)}
                                            className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900"
                                            placeholder="e.g., Kerala, Goa"
                                        />
                                    ) : (
                                        <div className="py-2">
                                            <DestinationBadges destinations={editedStaff.excluded_destinations} />
                                        </div>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <h3 className="text-xs font-medium text-slate-500 mb-2">Excluded Services</h3>
                                    {isEditing ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                                            {Object.values(Service).map(service => (
                                                <label key={service} className="flex items-center space-x-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={editedStaff.excluded_services?.includes(service)}
                                                        onChange={() => handleExcludedServiceToggle(service)}
                                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-slate-700">{service}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 py-2">
                                            {(editedStaff.excluded_services?.length || 0) > 0 ? (
                                                editedStaff.excluded_services!.map(service => (
                                                    <span key={service} className="px-2.5 py-1 text-sm font-medium rounded-md bg-red-100 text-red-700">
                                                        {service}
                                                    </span>
                                                ))
                                            ) : (
                                                <p className="text-sm text-slate-500 py-1">No services excluded.</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {!isNew && editedStaff.id != null && (
                                    <>
                                        <div className="md:col-span-2"><hr /></div>
                                        <div className="md:col-span-2">
                                            <h3 className="text-xs font-medium text-slate-500 mb-2">Leave history</h3>
                                            {(() => {
                                                const staffLeaves = leaveApplications.filter(a => a.staff_id === editedStaff.id).slice(0, 10);
                                                if (staffLeaves.length === 0) return <p className="text-sm text-slate-500 py-1">No leave applications.</p>;
                                                return (
                                                    <ul className="space-y-2">
                                                        {staffLeaves.map(app => {
                                                                const range = getLeaveAppDisplay(app);
                                                                return (
                                                            <li key={app.id} className="text-sm py-1.5 border-b border-slate-100 last:border-0">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-slate-700">{range.from} – {range.to}{range.isHalfDay ? ` (${range.halfDayPeriod} half)` : ''}</span>
                                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full shrink-0 ${app.status === 'Approved' ? 'bg-green-100 text-green-800' : app.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{app.status}</span>
                                                                </div>
                                                                {app.reason && <p className="text-slate-500 text-xs mt-0.5">{app.reason}</p>}
                                                                {app.status === 'Rejected' && app.rejected_reason && <p className="text-red-600 text-xs mt-0.5">Rejection: {app.rejected_reason}</p>}
                                                            </li>
                                                        );})}
                                                    </ul>
                                                );
                                            })()}
                                        </div>
                                    </>
                                )}
                                {isNew && isEditing && (
                                    <>
                                        <div className="md:col-span-2"><hr /></div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
                                            <p className="text-xs text-slate-400 mb-1">{PASSWORD_HINT}</p>
                                            <div className="relative">
                                                <input type={isPasswordVisible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} minLength={PASSWORD_MIN_LENGTH} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900 pr-10" />
                                                <button type="button" onClick={() => setIsPasswordVisible(!isPasswordVisible)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600">
                                                    {isPasswordVisible ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Confirm Password</label>
                                            <div className="relative">
                                                <input type={isConfirmVisible ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900 pr-10" />
                                                <button type="button" onClick={() => setIsConfirmVisible(!isConfirmVisible)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600">
                                                    {isConfirmVisible ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    {!isNew && activeTab === 'daily-tracking' && (
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-slate-800">Daily Tracking</h3>

                                    {/* Filters */}
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="date"
                                            value={dailyTrackingFilterStartDate}
                                            onChange={(e) => {
                                                setDailyTrackingFilterStartDate(e.target.value);
                                                setDailyTrackingPage(1);
                                            }}
                                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                                            placeholder="Start Date"
                                        />
                                        <span className="text-slate-500">to</span>
                                        <input
                                            type="date"
                                            value={dailyTrackingFilterEndDate}
                                            onChange={(e) => {
                                                setDailyTrackingFilterEndDate(e.target.value);
                                                setDailyTrackingPage(1);
                                            }}
                                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                                            placeholder="End Date"
                                        />
                                        <select
                                            value={dailyTrackingSortBy}
                                            onChange={(e) => {
                                                setDailyTrackingSortBy(e.target.value as any);
                                                setDailyTrackingPage(1);
                                            }}
                                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                                        >
                                            <option value="date">Sort by Date</option>
                                            <option value="first_login">Sort by First Login</option>
                                            <option value="last_login">Sort by Last Active</option>
                                            <option value="active_time">Sort by Active Time</option>
                                        </select>
                                        <button
                                            onClick={() => setDailyTrackingSortOrder(dailyTrackingSortOrder === 'asc' ? 'desc' : 'asc')}
                                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
                                        >
                                            {dailyTrackingSortOrder === 'asc' ? '↑' : '↓'}
                                        </button>
                                    </div>
                                </div>

                                {sessionLoading ? (
                                    <div className="text-center p-8 text-slate-500">Loading session data...</div>
                                ) : !Array.isArray(sessionData) || sessionData.length === 0 ? (
                                    <div className="text-center p-8 text-slate-500">
                                        No session data available for the selected date range.
                                    </div>
                                ) : (() => {
                                    // Filter and sort data
                                    let filteredData = [...sessionData];

                                    // Apply date filters
                                    if (dailyTrackingFilterStartDate) {
                                        filteredData = filteredData.filter(s => s.date >= dailyTrackingFilterStartDate);
                                    }
                                    if (dailyTrackingFilterEndDate) {
                                        filteredData = filteredData.filter(s => s.date <= dailyTrackingFilterEndDate);
                                    }

                                    // Sort data
                                    filteredData.sort((a, b) => {
                                        let aVal: any, bVal: any;

                                        switch (dailyTrackingSortBy) {
                                            case 'date':
                                                aVal = new Date(a.date).getTime();
                                                bVal = new Date(b.date).getTime();
                                                break;
                                            case 'first_login':
                                                aVal = a.first_login_time ? new Date(a.first_login_time).getTime() : 0;
                                                bVal = b.first_login_time ? new Date(b.first_login_time).getTime() : 0;
                                                break;
                                            case 'last_login':
                                                aVal = a.last_activity_time ? new Date(a.last_activity_time).getTime() : 0;
                                                bVal = b.last_activity_time ? new Date(b.last_activity_time).getTime() : 0;
                                                break;
                                            case 'active_time':
                                                aVal = a.total_active_seconds || 0;
                                                bVal = b.total_active_seconds || 0;
                                                break;
                                            default:
                                                aVal = 0;
                                                bVal = 0;
                                        }

                                        if (dailyTrackingSortOrder === 'asc') {
                                            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                                        } else {
                                            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
                                        }
                                    });

                                    // Pagination
                                    const totalPages = Math.ceil(filteredData.length / dailyTrackingPageSize);
                                    const startIndex = (dailyTrackingPage - 1) * dailyTrackingPageSize;
                                    const paginatedData = filteredData.slice(startIndex, startIndex + dailyTrackingPageSize);

                                    return (
                                        <div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-50 border-b-2 border-slate-200">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Date</th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">First Login</th>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Last Active</th>
                                                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Total Active Time</th>
                                                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Current Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-slate-100">
                                                        {paginatedData.map((session: any, index: number) => {
                                                            const totalHours = Math.floor((session.total_active_seconds || 0) / 3600);
                                                            const totalMinutes = Math.floor(((session.total_active_seconds || 0) % 3600) / 60);
                                                            const formattedTime = totalHours > 0 || totalMinutes > 0 ? `${totalHours}h ${totalMinutes}m` : '--';

                                                            const firstLogin = session.first_login_time
                                                                ? new Date(session.first_login_time).toLocaleString('en-IN', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                    hour12: true
                                                                })
                                                                : '--';

                                                            const lastActive = session.last_activity_time
                                                                ? new Date(session.last_activity_time).toLocaleString('en-IN', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                    hour12: true
                                                                })
                                                                : '--';

                                                            const isToday = session.date === new Date().toISOString().split('T')[0];
                                                            const statusColor = session.session_status === 'active' ? 'bg-green-100 text-green-800' :
                                                                session.session_status === 'idle' ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-slate-100 text-slate-800';

                                                            const displayStatus = session.session_status === 'active' ? 'active' :
                                                                session.session_status === 'idle' ? 'idle' :
                                                                    'N/A';

                                                            return (
                                                                <tr key={index} className={`hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-slate-700 font-medium">
                                                                                {new Date(session.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                            </span>
                                                                            {isToday && (
                                                                                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Today</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{firstLogin}</td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{lastActive}</td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-right text-slate-700 font-medium">{formattedTime}</td>
                                                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                                                            {displayStatus}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Pagination */}
                                            {totalPages > 1 && (
                                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                                                    <div className="text-sm text-slate-600">
                                                        Showing {startIndex + 1} to {Math.min(startIndex + dailyTrackingPageSize, filteredData.length)} of {filteredData.length} entries
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => setDailyTrackingPage(Math.max(1, dailyTrackingPage - 1))}
                                                            disabled={dailyTrackingPage === 1}
                                                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            Previous
                                                        </button>
                                                        <span className="px-3 py-1.5 text-sm text-slate-700">
                                                            Page {dailyTrackingPage} of {totalPages}
                                                        </span>
                                                        <button
                                                            onClick={() => setDailyTrackingPage(Math.min(totalPages, dailyTrackingPage + 1))}
                                                            disabled={dailyTrackingPage === totalPages}
                                                            className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            Next
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>

                {isEditing && (
                    <div className="p-4 bg-white border-t">
                        <button onClick={handleSave} disabled={isSaving} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c] disabled:bg-slate-400">
                            {isSaving ? 'Saving...' : (isNew ? 'Save Staff' : 'Save Changes')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const InfoField: React.FC<{ label: string; value: string | number | undefined | null; isEditing: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; readOnly?: boolean; placeholder?: string; }> =
    ({ label, value, isEditing, onChange, readOnly = false, placeholder }) => (
        <div>
            <label className="block text-xs font-medium text-slate-500 capitalize mb-1">{label}</label>
            {isEditing ? (
                <input
                    type="text"
                    value={value || ''}
                    onChange={onChange}
                    readOnly={readOnly}
                    placeholder={placeholder}
                    className={`w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${readOnly ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
                />
            ) : (
                <p className="text-base text-slate-900 font-medium py-2 min-h-10">{value || 'N/A'}</p>
            )}
        </div>
    );


const Employees: React.FC<{ currentUser: LoggedInUser }> = ({ currentUser }) => {
    const { staff, branches, leads, customers, roleTags, refreshData, leaveApplications, fetchLeaveApplications } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<StaffStatus>(StaffStatus.Active);
    const { addToast } = useToast();
    const { signOut } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const { navigate } = useRouter();

    // Redirect non-Super Admin users
    useEffect(() => {
        if (currentUser.role !== 'Super Admin') {
            addToast('Access denied. Only Super Admins can view employees.', 'error');
            navigate('/dashboard');
        }
    }, [currentUser, navigate, addToast]);

    // Return null if redirecting to prevent flash of content
    if (currentUser.role !== 'Super Admin') return null;

    const handleAddNew = () => {
        setSelectedStaff(null);
        setIsPanelOpen(true);
    };

    const handleSelectStaff = (staffMember: Staff) => {
        setSelectedStaff(staffMember);
        setIsPanelOpen(true);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedStaff(null);
    };

    useEffect(() => {
        // Keep selected staff in sync with the master list from DataProvider
        if (isPanelOpen && selectedStaff && staff.length > 0) {
            const updatedStaff = staff.find(s => s.id === selectedStaff.id);
            if (updatedStaff && JSON.stringify(updatedStaff) !== JSON.stringify(selectedStaff)) {
                setSelectedStaff(updatedStaff);
            } else if (!updatedStaff) {
                // Staff member was deleted or is no longer in the visible list
                handleClosePanel();
            }
        }
    }, [staff, selectedStaff, isPanelOpen]);

    useEffect(() => {
        const action = sessionStorage.getItem('action');
        const staffIdToView = sessionStorage.getItem('viewStaffId');

        if (action === 'new-staff') {
            sessionStorage.removeItem('action');
            handleAddNew();
        } else if (staffIdToView && staff.length > 0) {
            sessionStorage.removeItem('viewStaffId');
            const staffMember = staff.find(s => s.id === parseInt(staffIdToView, 10));
            if (staffMember) {
                handleSelectStaff(staffMember);
            }
        }
    }, [staff]);

    const filteredStaff = useMemo(() => {
        const activeStatuses = [StaffStatus.Active, StaffStatus.DND];
        return staff
            .filter(s => {
                if (activeTab === StaffStatus.Active) return activeStatuses.includes(s.status);
                return s.status === activeTab;
            })
            .filter(s => {
                const searchPool = `${s.name} ${s.email} ${s.phone}`.toLowerCase();
                return searchPool.includes(searchTerm.toLowerCase());
            });
    }, [staff, searchTerm, activeTab]);

    useEffect(() => {
        setSelectedStaffIds([]);
    }, [activeTab, searchTerm]);

    const handleSaveStaff = async (staffToSave: Partial<Staff>, avatarFile: File | null, password?: string | null, roleTagIds?: number[]): Promise<boolean> => {
        setIsSaving(true);
        try {
            if (staffToSave.id && selectedStaff) { // UPDATE existing staff
                let newAvatarUrl = selectedStaff.avatar_url;
                if (avatarFile) {
                    const userId = selectedStaff.user_id;
                    if (!userId) throw new Error("Cannot update avatar for staff without a user_id.");
                    const filePath = `public/staff-avatars/${userId}`;
                    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true, cacheControl: '3600' });
                    if (uploadError) throw uploadError;

                    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                    newAvatarUrl = `${data.publicUrl}?t=${new Date().getTime()}`;
                }

                const finalUpdateData = { ...staffToSave, avatar_url: newAvatarUrl };
                delete finalUpdateData.id;
                delete (finalUpdateData as any).role_tags;
                finalUpdateData.is_lead_manager = staffToSave.is_lead_manager;
                finalUpdateData.is_accountant = staffToSave.is_accountant;
                finalUpdateData.is_task_manager = staffToSave.is_task_manager;
                finalUpdateData.manage_lead_branches = staffToSave.manage_lead_branches;

                const { error } = await supabase.from('staff').update(finalUpdateData).eq('id', staffToSave.id);
                if (error) throw error;

                if (roleTagIds !== undefined) {
                    const { error: delErr } = await supabase.from('staff_role_tags').delete().eq('staff_id', staffToSave.id);
                    if (delErr) throw delErr;
                    if (roleTagIds.length > 0) {
                        const { error: insErr } = await supabase.from('staff_role_tags').insert(roleTagIds.map(role_tag_id => ({ staff_id: staffToSave.id, role_tag_id })));
                        if (insErr) throw insErr;
                    }
                }

                addToast('Staff updated successfully.', 'success');
                if (staffToSave.id === currentUser.id) {
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    await refreshData();
                }
                return true;

            } else { // CREATE new staff
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: staffToSave.email!,
                    password: password!,
                    options: { emailRedirectTo: window.location.origin }
                });

                if (signUpError) {
                    if (signUpError.message.toLowerCase().includes("user already registered")) {
                        throw new Error("A user with this email address already exists.");
                    }
                    throw signUpError;
                }
                if (!signUpData.user) throw new Error("Sign up did not return a user object.");

                const newUser = signUpData.user;
                let avatar_url = staffToSave.avatar_url || '';

                if (avatarFile) {
                    const filePath = `public/staff-avatars/${newUser.id}`;
                    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true, cacheControl: '3600' });
                    if (uploadError) throw uploadError;

                    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                    avatar_url = `${data.publicUrl}?t=${new Date().getTime()}`;
                }

                const staffDataForDb = {
                    ...staffToSave,
                    user_id: newUser.id,
                    avatar_url: avatar_url,
                };
                delete (staffDataForDb as any).role_tags; // not a column on staff

                const { error } = await supabase.from('staff').insert(staffDataForDb);
                if (error) {
                    if (error.code === '23505') { // Unique constraint violation
                        throw new Error(`A staff member with the email ${staffToSave.email} or staff no. ${staffToSave.staff_no} might already exist.`);
                    }
                    // Clean up the created auth user if the staff profile creation fails
                    // FIX: Admin actions like deleteUser cannot be performed on the client-side due to security restrictions.
                    // This line would fail at runtime. Proper implementation requires a server-side function.
                    // await supabase.auth.admin.deleteUser(newUser.id); 
                    throw error;
                }

                addToast('Staff created successfully! A confirmation email has been sent.', 'success');
                await refreshData();
                return true;
            }
        } catch (error: any) {
            console.error('Save staff error:', error);
            addToast(error.message || 'An unexpected error occurred.', 'error');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleStaffStatus = async (staffId: number, newStatus: StaffStatus) => {
        if (staffId === currentUser.id && newStatus === 'Inactive') {
            addToast("You cannot deactivate your own account.", 'error');
            return;
        }
        const { error } = await supabase.from('staff').update({ status: newStatus }).eq('id', staffId);
        if (error) {
            addToast(error.message, 'error');
            return;
        }
        await refreshData();
        addToast(`Staff status updated to ${newStatus.toLowerCase()}.`, 'success');
        handleClosePanel();
    };

    const handleDeleteSelected = async () => {
        if (selectedStaffIds.length === 0) return;
        if (selectedStaffIds.includes(currentUser.id)) {
            addToast("You cannot delete your own profile.", "error");
            setShowDeleteConfirm(false);
            return;
        }

        const { data: usersToDelete, error: fetchError } = await supabase
            .from('staff')
            .select('user_id')
            .in('id', selectedStaffIds);

        if (fetchError) {
            addToast(`Could not fetch users to delete: ${fetchError.message}`, 'error');
            setShowDeleteConfirm(false);
            return;
        }

        const userIdsToDelete = usersToDelete.map(u => u.user_id).filter(Boolean);

        if (userIdsToDelete.length !== selectedStaffIds.length) {
            addToast("Some staff profiles could not be deleted as they are not linked to an authentication user.", "error");
        }

        if (userIdsToDelete.length > 0) {
            addToast(`Deletion is not fully implemented. This would require an admin call to delete users: ${userIdsToDelete.join(', ')}`, 'error');
        }

        setShowDeleteConfirm(false);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedStaffIds(filteredStaff.map(s => s.id));
        } else {
            setSelectedStaffIds([]);
        }
    };

    const handleSelectOne = (staffId: number) => {
        if (selectedStaffIds.includes(staffId)) {
            setSelectedStaffIds(selectedStaffIds.filter(id => id !== staffId));
        } else {
            setSelectedStaffIds([...selectedStaffIds, staffId]);
        }
    };

    return (
        <div className="flex h-full">
            <div className="flex-1 flex flex-col">
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <h1 className="text-lg sm:text-xl font-bold text-slate-800">Employees</h1>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                            {selectedStaffIds.length > 0 ? (
                                <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-[5px] hover:bg-red-700 min-h-[44px] sm:min-h-0">
                                    <IconTrash className="w-4 h-4" />
                                    Delete ({selectedStaffIds.length})
                                </button>
                            ) : (
                                <div className="relative w-full sm:w-64">
                                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                                    <input type="text" placeholder="Search by name, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 sm:pl-10 pr-4 py-2 w-full sm:w-64 text-sm bg-white border text-slate-900 border-slate-300 rounded-md min-h-[44px] sm:min-h-0" />
                                </div>
                            )}
                            <button onClick={handleAddNew} className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c] min-h-[44px] sm:min-h-0">
                                <IconPlus className="w-4 h-4" />
                                <span className="hidden sm:inline">New Staff</span>
                                <span className="sm:hidden">New</span>
                            </button>
                        </div>
                    </div>
                    <div className="border-b border-slate-200 overflow-x-auto scrollbar-hide">
                        <nav className="-mb-px flex space-x-4 sm:space-x-6 min-w-max" aria-label="Tabs">
                            {[StaffStatus.Active, StaffStatus.OnLeave, StaffStatus.DND, StaffStatus.Inactive].map(status => (
                                <button key={status} onClick={() => setActiveTab(status)} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-xs sm:text-sm ${activeTab === status ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>{status}</button>
                            ))}
                        </nav>
                    </div>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-500">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                <tr>
                                    <th className="p-4 w-4">
                                        <input type="checkbox" onChange={handleSelectAll} checked={filteredStaff.length > 0 && selectedStaffIds.length === filteredStaff.length} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                    </th>
                                    <th className="px-6 py-3">Staff No.</th>
                                    <th className="px-6 py-3">Name</th>
                                    <th className="px-6 py-3">Branch</th>
                                    <th className="px-6 py-3">Role & Tags</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStaff.map(staffMember => {
                                    const branch = branches.find(b => b.id === staffMember.branch_id);
                                    const roleLabel = getRoleName(staffMember.role_id);
                                    return (
                                        <tr key={staffMember.id} className="bg-white border-b hover:bg-slate-50">
                                            <td className="p-4 w-4">
                                                <input type="checkbox" checked={selectedStaffIds.includes(staffMember.id)} onChange={() => handleSelectOne(staffMember.id)} onClick={e => e.stopPropagation()} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                            </td>
                                            <td onClick={() => handleSelectStaff(staffMember)} className="px-6 py-4 cursor-pointer text-slate-700">{staffMember.staff_no || '—'}</td>
                                            <td onClick={() => handleSelectStaff(staffMember)} className="px-6 py-4 cursor-pointer">
                                                <div className="flex items-center gap-3">
                                                    <img src={staffMember.avatar_url} alt={staffMember.name} className="h-9 w-9 rounded-full object-cover shrink-0" />
                                                    <div>
                                                        <div className="font-semibold text-slate-800">{staffMember.name}</div>
                                                        <div className="text-xs text-slate-500">{staffMember.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td onClick={() => handleSelectStaff(staffMember)} className="px-6 py-4 cursor-pointer text-slate-700">{branch?.name || '—'}</td>
                                            <td onClick={() => handleSelectStaff(staffMember)} className="px-6 py-4 cursor-pointer">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-200 text-slate-700">{roleLabel}</span>
                                                    {(staffMember.role_tags?.length ?? 0) > 0 && staffMember.role_tags!.map(rt => (
                                                        <span key={rt.id} className={`px-2 py-0.5 text-xs font-medium rounded-full ${getRoleTagCapsuleClass(rt)}`}>{rt.name}</span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3 mt-3">
                        {filteredStaff.map(staffMember => {
                            const branch = branches.find(b => b.id === staffMember.branch_id);
                            const roleLabel = getRoleName(staffMember.role_id);
                            return (
                                <div key={staffMember.id} onClick={() => handleSelectStaff(staffMember)} className="bg-white border border-slate-200 rounded-lg p-4 cursor-pointer hover:bg-slate-50">
                                    <div className="flex items-start gap-3">
                                        <input type="checkbox" checked={selectedStaffIds.includes(staffMember.id)} onChange={() => handleSelectOne(staffMember.id)} onClick={e => e.stopPropagation()} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-1 flex-shrink-0" />
                                        <img src={staffMember.avatar_url} alt={staffMember.name} className="h-12 w-12 rounded-full object-cover shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-slate-800 text-sm mb-1">{staffMember.name}</div>
                                            <div className="text-xs text-slate-500 mb-2 truncate">{staffMember.email}</div>
                                            <div className="space-y-1 text-xs">
                                                {staffMember.staff_no && <div className="text-slate-600">Staff No: <span className="font-medium">{staffMember.staff_no}</span></div>}
                                                <div className="text-slate-600">Branch: <span className="font-medium">{branch?.name || '—'}</span></div>
                                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-200 text-slate-700">{roleLabel}</span>
                                                    {(staffMember.role_tags?.length ?? 0) > 0 && staffMember.role_tags!.map(rt => (
                                                        <span key={rt.id} className={`px-2 py-0.5 text-xs font-medium rounded-full ${getRoleTagCapsuleClass(rt)}`}>{rt.name}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredStaff.length === 0 && <p className="text-center py-10 text-slate-500">No staff members found.</p>}
                    </div>
                </div>
            </div>
            {isPanelOpen && <StaffDetailPanel staffMember={selectedStaff} branches={branches} roleTags={roleTags} onClose={handleClosePanel} onSave={handleSaveStaff} onToggleStatus={handleToggleStaffStatus} currentUser={currentUser} leads={leads} customers={customers} leaveApplications={leaveApplications} fetchLeaveApplications={fetchLeaveApplications} />}
            {showDeleteConfirm && (
                <ConfirmationModal
                    title="Confirm Deletion"
                    message={`Are you sure you want to delete ${selectedStaffIds.length} staff member(s)? This action requires manual cleanup of the authentication user and cannot be undone.\n\nNote: This is a high-risk operation.`}
                    onConfirm={handleDeleteSelected}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </div>
    );
};

export default Employees;
