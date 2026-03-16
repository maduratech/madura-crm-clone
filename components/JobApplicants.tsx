import React, { useState, useEffect, useMemo } from 'react';
import { JobApplicant, ApplicantStatus, LoggedInUser, Activity } from '../types';
import { IconSearch, IconPlus, IconX, IconPencil, IconTrash, IconDownload, IconCheckCircle, IconXCircle } from '../constants';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { useData } from '../contexts/DataProvider';
import { useAuth } from '../contexts/AuthProvider';

const ConfirmationModal: React.FC<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    showReasonInput?: boolean;
    reasonLabel?: string;
    onReasonChange?: (reason: string) => void;
}> = ({ title, message, onConfirm, onCancel, showReasonInput = false, reasonLabel = 'Reason', onReasonChange }) => {
    const [reason, setReason] = useState('');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">{title}</h3>
                <p className="text-sm text-slate-600 mb-4 whitespace-pre-wrap">{message}</p>
                {showReasonInput && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">{reasonLabel} <span className="text-red-500">*</span></label>
                        <textarea
                            value={reason}
                            onChange={(e) => {
                                setReason(e.target.value);
                                onReasonChange?.(e.target.value);
                            }}
                            className="w-full p-2 border rounded-md text-sm"
                            rows={3}
                            placeholder={`Enter ${reasonLabel.toLowerCase()}...`}
                            required
                        />
                    </div>
                )}
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm rounded-md bg-[#191974] text-white"
                        disabled={showReasonInput && !reason.trim()}
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

const ApplicantDetailPanel: React.FC<{
    applicant: JobApplicant | null;
    onClose: () => void;
    onSave: (applicant: Partial<JobApplicant>) => Promise<boolean>;
    currentUser: LoggedInUser;
    onApprove: (id: number, reason: string) => Promise<void>;
    onReject: (id: number, reason: string) => Promise<void>;
    onStatusChange: (id: number, status: ApplicantStatus) => Promise<void>;
}> = ({ applicant, onClose, onSave, currentUser, onApprove, onReject, onStatusChange }) => {
    const isNew = !applicant;
    const { addToast } = useToast();
    const [editedApplicant, setEditedApplicant] = useState<Partial<JobApplicant>>(
        applicant || {
            first_name: '',
            last_name: '',
            email: '',
            phone: '',
            educational_qualification: '',
            experience_level: 'Fresher',
            brief_about_yourself: '',
            role_applied_for: '',
            status: ApplicantStatus.Applied,
            activity: [],
        }
    );
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [approvalReason, setApprovalReason] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');

    const handleFieldChange = (field: keyof JobApplicant, value: any) => {
        setEditedApplicant(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!editedApplicant.first_name || !editedApplicant.last_name || !editedApplicant.email || !editedApplicant.phone) {
            addToast('Please fill in all required fields.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const success = await onSave(editedApplicant);
            if (success) {
                addToast('Applicant saved successfully.', 'success');
                onClose();
            }
        } catch (error: any) {
            addToast(`Error saving applicant: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleApprove = async () => {
        if (!approvalReason.trim()) {
            addToast('Please provide an approval reason.', 'error');
            return;
        }
        if (!applicant) return;
        await onApprove(applicant.id, approvalReason);
        setShowApproveModal(false);
        setApprovalReason('');
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            addToast('Please provide a rejection reason.', 'error');
            return;
        }
        if (!applicant) return;
        await onReject(applicant.id, rejectionReason);
        setShowRejectModal(false);
        setRejectionReason('');
    };

    const handleStatusChange = async (newStatus: ApplicantStatus) => {
        if (!applicant) return;
        await onStatusChange(applicant.id, newStatus);
    };

    const statusColors: Record<ApplicantStatus, string> = {
        [ApplicantStatus.Applied]: 'bg-blue-100 text-blue-800',
        [ApplicantStatus.InvitedForInterview]: 'bg-purple-100 text-purple-800',
        [ApplicantStatus.InterviewAttended]: 'bg-yellow-100 text-yellow-800',
        [ApplicantStatus.InReview]: 'bg-orange-100 text-orange-800',
        [ApplicantStatus.Approved]: 'bg-green-100 text-green-800',
        [ApplicantStatus.Rejected]: 'bg-red-100 text-red-800',
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>

            {/* Drawer */}
            <div className="fixed inset-y-0 right-0 w-full max-w-4xl bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800">
                        {isNew ? 'New Applicant' : `${editedApplicant.first_name} ${editedApplicant.last_name}`}
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
                        <IconX className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Tabs */}
                    <div className="border-b mb-6">
                        <nav className="-mb-px flex space-x-6">
                            <button
                                onClick={() => setActiveTab('details')}
                                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'details'
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Details
                            </button>
                            <button
                                onClick={() => setActiveTab('activity')}
                                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'activity'
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                Activity
                            </button>
                        </nav>
                    </div>

                    {activeTab === 'details' && (
                        <div className="space-y-4">
                            {/* Status Badge */}
                            {!isNew && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[editedApplicant.status || ApplicantStatus.Applied]}`}>
                                            {editedApplicant.status}
                                        </span>
                                        {currentUser.role_id === 1 || currentUser.role_id === 2 || currentUser.is_lead_manager === true ? (
                                            <select
                                                value={editedApplicant.status || ApplicantStatus.Applied}
                                                onChange={(e) => handleFieldChange('status', e.target.value as ApplicantStatus)}
                                                className="px-3 py-1 border rounded-md text-sm"
                                            >
                                                {Object.values(ApplicantStatus).map(status => (
                                                    <option key={status} value={status}>{status}</option>
                                                ))}
                                            </select>
                                        ) : null}
                                    </div>
                                </div>
                            )}

                            {/* Application Date and Last Updated */}
                            {!isNew && applicant && (
                                <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Application Date
                                        </label>
                                        <p className="text-sm text-slate-600">
                                            {new Date(applicant.created_at).toLocaleString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Last Updated
                                        </label>
                                        <p className="text-sm text-slate-600">
                                            {applicant.updated_at ? new Date(applicant.updated_at).toLocaleString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Name Fields */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        First Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={editedApplicant.first_name || ''}
                                        onChange={(e) => handleFieldChange('first_name', e.target.value)}
                                        className="w-full p-2 border rounded-md"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Last Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={editedApplicant.last_name || ''}
                                        onChange={(e) => handleFieldChange('last_name', e.target.value)}
                                        className="w-full p-2 border rounded-md"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Contact Information */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={editedApplicant.email || ''}
                                        onChange={(e) => handleFieldChange('email', e.target.value)}
                                        className="w-full p-2 border rounded-md"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Phone <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        value={editedApplicant.phone || ''}
                                        onChange={(e) => handleFieldChange('phone', e.target.value)}
                                        className="w-full p-2 border rounded-md"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Educational Qualification */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Educational Qualification
                                </label>
                                <input
                                    type="text"
                                    value={editedApplicant.educational_qualification || ''}
                                    onChange={(e) => handleFieldChange('educational_qualification', e.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="e.g., B.Tech, MBA, etc."
                                />
                            </div>

                            {/* Experience Level */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Experience Level <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            value="Fresher"
                                            checked={editedApplicant.experience_level === 'Fresher'}
                                            onChange={(e) => handleFieldChange('experience_level', e.target.value)}
                                        />
                                        Fresher
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            value="Experienced"
                                            checked={editedApplicant.experience_level === 'Experienced'}
                                            onChange={(e) => handleFieldChange('experience_level', e.target.value)}
                                        />
                                        Experienced
                                    </label>
                                </div>
                            </div>

                            {/* Role Applied For */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Role Applied For
                                </label>
                                <input
                                    type="text"
                                    value={editedApplicant.role_applied_for || ''}
                                    onChange={(e) => handleFieldChange('role_applied_for', e.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="e.g., Travel Consultant, Sales Executive, etc."
                                />
                            </div>

                            {/* Brief About Yourself */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Brief About Yourself
                                </label>
                                <textarea
                                    value={editedApplicant.brief_about_yourself || ''}
                                    onChange={(e) => handleFieldChange('brief_about_yourself', e.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    rows={4}
                                    placeholder="Tell us about yourself, your skills, and why you want to join us..."
                                />
                            </div>

                            {/* Resume */}
                            {applicant?.resume_url && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Resume/CV
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={applicant.resume_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline flex items-center gap-2"
                                        >
                                            <IconDownload className="w-4 h-4" />
                                            {applicant.resume_file_name || 'Download Resume'}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Approval/Rejection Reasons */}
                            {applicant?.approval_reason && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Approval Reason
                                    </label>
                                    <p className="text-sm text-slate-600 bg-green-50 p-3 rounded-md">
                                        {applicant.approval_reason}
                                    </p>
                                </div>
                            )}

                            {applicant?.rejection_reason && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Rejection Reason
                                    </label>
                                    <p className="text-sm text-slate-600 bg-red-50 p-3 rounded-md">
                                        {applicant.rejection_reason}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'activity' && (
                        <div className="space-y-3">
                            {(editedApplicant.activity || []).map((activity, index) => (
                                <div key={activity.id || index} className="border-l-2 border-blue-500 pl-4 py-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold text-slate-800">{activity.type}</p>
                                            <p className="text-sm text-slate-600">{activity.description}</p>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            {new Date(activity.timestamp).toLocaleString()}
                                        </div>
                                    </div>
                                    {activity.user && (
                                        <p className="text-xs text-slate-500 mt-1">By: {activity.user}</p>
                                    )}
                                </div>
                            ))}
                            {(!editedApplicant.activity || editedApplicant.activity.length === 0) && (
                                <p className="text-center text-slate-500 py-4">No activity recorded.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t flex justify-between items-center flex-shrink-0">
                    <div className="flex gap-2">
                        {/* Allow Super Admin, Managers, or Lead Manager (role_id 4) to approve/reject */}
                        {!isNew && (currentUser.role_id === 1 || currentUser.role_id === 2 || currentUser.is_lead_manager === true) && (
                            <>
                                {editedApplicant.status !== ApplicantStatus.Approved && (
                                    <button
                                        onClick={() => setShowApproveModal(true)}
                                        className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 flex items-center gap-2"
                                    >
                                        <IconCheckCircle className="w-4 h-4" />
                                        Approve
                                    </button>
                                )}
                                {editedApplicant.status !== ApplicantStatus.Rejected && (
                                    <button
                                        onClick={() => setShowRejectModal(true)}
                                        className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 flex items-center gap-2"
                                    >
                                        <IconXCircle className="w-4 h-4" />
                                        Reject
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border rounded-md text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-4 py-2 bg-[#191974] text-white rounded-md text-sm font-medium hover:bg-[#14145a] disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Approve Modal */}
            {showApproveModal && (
                <ConfirmationModal
                    title="Approve Applicant"
                    message="Are you sure you want to approve this applicant? Please provide a reason for approval."
                    onConfirm={handleApprove}
                    onCancel={() => {
                        setShowApproveModal(false);
                        setApprovalReason('');
                    }}
                    showReasonInput={true}
                    reasonLabel="Approval Reason"
                    onReasonChange={setApprovalReason}
                />
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <ConfirmationModal
                    title="Reject Applicant"
                    message="Are you sure you want to reject this applicant? Please provide a reason for rejection."
                    onConfirm={handleReject}
                    onCancel={() => {
                        setShowRejectModal(false);
                        setRejectionReason('');
                    }}
                    showReasonInput={true}
                    reasonLabel="Rejection Reason"
                    onReasonChange={setRejectionReason}
                />
            )}
        </div>
    );
};

const JobApplicants: React.FC<{ currentUser: LoggedInUser }> = ({ currentUser }) => {
    const { addToast } = useToast();
    const { session } = useAuth();
    const { jobApplicants, fetchJobApplicants, loadingJobApplicants } = useData();
    const [filteredApplicants, setFilteredApplicants] = useState<JobApplicant[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedApplicant, setSelectedApplicant] = useState<JobApplicant | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<ApplicantStatus | 'All'>('All');
    const [sortField, setSortField] = useState<'created_at' | 'name' | 'status' | 'role_applied_for'>('created_at');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [applicantToDelete, setApplicantToDelete] = useState<number | null>(null);

    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';

    // Check if user has access (Super Admin, Manager, or Lead Manager tag)
    const hasAccess = currentUser.role_id === 1 ||
        currentUser.role_id === 2 ||
        currentUser.is_lead_manager === true;
    const canDelete = currentUser.role_id === 1; // Only Super Admin can delete

    useEffect(() => {
        if (hasAccess && session) {
            fetchJobApplicants();
        }
    }, [hasAccess, session, fetchJobApplicants]);

    useEffect(() => {
        let filtered = jobApplicants;

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(applicant =>
                `${applicant.first_name} ${applicant.last_name}`.toLowerCase().includes(query) ||
                applicant.email.toLowerCase().includes(query) ||
                applicant.phone.toLowerCase().includes(query) ||
                applicant.role_applied_for?.toLowerCase().includes(query)
            );
        }

        // Filter by status
        if (statusFilter !== 'All') {
            filtered = filtered.filter(applicant => applicant.status === statusFilter);
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            let aVal: string | number = '';
            let bVal: string | number = '';

            if (sortField === 'created_at') {
                aVal = new Date(a.created_at).getTime();
                bVal = new Date(b.created_at).getTime();
            } else if (sortField === 'name') {
                aVal = `${a.first_name} ${a.last_name}`.toLowerCase();
                bVal = `${b.first_name} ${b.last_name}`.toLowerCase();
            } else if (sortField === 'status') {
                aVal = (a.status || '').toString().toLowerCase();
                bVal = (b.status || '').toString().toLowerCase();
            } else if (sortField === 'role_applied_for') {
                aVal = (a.role_applied_for || '').toLowerCase();
                bVal = (b.role_applied_for || '').toLowerCase();
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        setFilteredApplicants(sorted);
    }, [jobApplicants, searchQuery, statusFilter, sortField, sortDirection]);

    const handleSort = (field: 'created_at' | 'name' | 'status' | 'role_applied_for') => {
        if (sortField === field) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection(field === 'created_at' ? 'desc' : 'asc');
        }
    };

    const handleSelectApplicant = (applicant: JobApplicant) => {
        setSelectedApplicant(applicant);
        setIsPanelOpen(true);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedApplicant(null);
    };

    const handleSaveApplicant = async (applicantData: Partial<JobApplicant>): Promise<boolean> => {
        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return false;
        }

        try {
            const url = selectedApplicant
                ? `${API_BASE}/api/job-applicants/${selectedApplicant.id}`
                : `${API_BASE}/api/job-applicants`;

            const method = selectedApplicant ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(applicantData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save applicant');
            }

            await fetchJobApplicants(true);
            return true;
        } catch (error: any) {
            addToast(`Error saving applicant: ${error.message}`, 'error');
            return false;
        }
    };

    const handleApprove = async (id: number, reason: string) => {
        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return;
        }

        try {
            // Fetch current applicant to get latest activity
            const currentResponse = await fetch(`${API_BASE}/api/job-applicants/${id}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });
            const currentApplicant = currentResponse.ok ? await currentResponse.json() : null;

            const response = await fetch(`${API_BASE}/api/job-applicants/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    status: ApplicantStatus.Approved,
                    approval_reason: reason,
                    activity: [
                        ...(currentApplicant?.activity || selectedApplicant?.activity || []),
                        {
                            id: Date.now(),
                            type: 'Approved',
                            description: `Applicant approved. Reason: ${reason}`,
                            user: currentUser.name,
                            timestamp: new Date().toISOString(),
                        },
                    ],
                }),
            });

            if (!response.ok) throw new Error('Failed to approve applicant');

            addToast('Applicant approved successfully.', 'success');
            const updated = await response.json();
            await fetchJobApplicants(true);
            if (selectedApplicant?.id === id) {
                setSelectedApplicant(updated.applicant ?? updated);
            }
        } catch (error: any) {
            addToast(`Error approving applicant: ${error.message}`, 'error');
        }
    };

    const handleReject = async (id: number, reason: string) => {
        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return;
        }

        try {
            // Fetch current applicant to get latest activity
            const currentResponse = await fetch(`${API_BASE}/api/job-applicants/${id}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });
            const currentApplicant = currentResponse.ok ? await currentResponse.json() : null;

            const response = await fetch(`${API_BASE}/api/job-applicants/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    status: ApplicantStatus.Rejected,
                    rejection_reason: reason,
                    activity: [
                        ...(currentApplicant?.activity || selectedApplicant?.activity || []),
                        {
                            id: Date.now(),
                            type: 'Rejected',
                            description: `Applicant rejected. Reason: ${reason}`,
                            user: currentUser.name,
                            timestamp: new Date().toISOString(),
                        },
                    ],
                }),
            });

            if (!response.ok) throw new Error('Failed to reject applicant');

            addToast('Applicant rejected successfully.', 'success');
            const updated = await response.json();
            await fetchJobApplicants(true);
            if (selectedApplicant?.id === id) {
                setSelectedApplicant(updated.applicant ?? updated);
            }
        } catch (error: any) {
            addToast(`Error rejecting applicant: ${error.message}`, 'error');
        }
    };

    const handleStatusChange = async (id: number, status: ApplicantStatus) => {
        if (!session?.access_token) {
            addToast('Authentication required', 'error');
            return;
        }

        try {
            // Fetch current applicant to get latest activity
            const currentResponse = await fetch(`${API_BASE}/api/job-applicants/${id}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });
            const currentApplicant = currentResponse.ok ? await currentResponse.json() : null;

            const response = await fetch(`${API_BASE}/api/job-applicants/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    status,
                    activity: [
                        ...(currentApplicant?.activity || selectedApplicant?.activity || []),
                        {
                            id: Date.now(),
                            type: 'Status Changed',
                            description: `Status changed to ${status}`,
                            user: currentUser.name,
                            timestamp: new Date().toISOString(),
                        },
                    ],
                }),
            });

            if (!response.ok) throw new Error('Failed to update status');

            addToast('Status updated successfully.', 'success');
            const updated = await response.json();
            await fetchJobApplicants(true);
            if (selectedApplicant?.id === id) {
                setSelectedApplicant(updated.applicant ?? updated);
            }
        } catch (error: any) {
            addToast(`Error updating status: ${error.message}`, 'error');
        }
    };

    const handleDelete = async () => {
        if (!applicantToDelete || !session?.access_token) {
            if (!session?.access_token) {
                addToast('Authentication required', 'error');
            }
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/job-applicants/${applicantToDelete}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) throw new Error('Failed to delete applicant');

            addToast('Applicant deleted successfully.', 'success');
            await fetchJobApplicants(true);
            setShowDeleteConfirm(false);
            setApplicantToDelete(null);
            if (selectedApplicant?.id === applicantToDelete) {
                handleClosePanel();
            }
        } catch (error: any) {
            addToast(`Error deleting applicant: ${error.message}`, 'error');
        }
    };

    const statusColors: Record<ApplicantStatus, string> = {
        [ApplicantStatus.Applied]: 'bg-blue-100 text-blue-800',
        [ApplicantStatus.InvitedForInterview]: 'bg-purple-100 text-purple-800',
        [ApplicantStatus.InterviewAttended]: 'bg-yellow-100 text-yellow-800',
        [ApplicantStatus.InReview]: 'bg-orange-100 text-orange-800',
        [ApplicantStatus.Approved]: 'bg-green-100 text-green-800',
        [ApplicantStatus.Rejected]: 'bg-red-100 text-red-800',
    };

    if (!hasAccess) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm">
                <h1 className="text-2xl font-bold text-slate-800 mb-4">Job Applicants</h1>
                <p className="text-slate-600">You don't have permission to access this page.</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
                <h1 className="text-lg sm:text-2xl font-bold text-slate-800">Job Applicants</h1>
            </div>

            {/* Search and Filters */}
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
                <div className="flex-1 relative">
                    <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                        type="text"
                        placeholder="Search by name, email, phone, or role..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 sm:pl-10 pr-4 py-2 border rounded-md text-sm min-h-[44px] sm:min-h-0"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as ApplicantStatus | 'All')}
                    className="px-3 sm:px-4 py-2 border rounded-md text-sm w-full sm:w-auto min-h-[44px] sm:min-h-0"
                >
                    <option value="All">All Status</option>
                    {Object.values(ApplicantStatus).map(status => (
                        <option key={status} value={status}>{status}</option>
                    ))}
                </select>
            </div>

            {/* Applicants Table */}
            {loadingJobApplicants ? (
                <div className="text-center py-10 text-slate-500">Loading applicants...</div>
            ) : (
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm text-left text-slate-500">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0">
                            <tr>
                                <th className="px-6 py-3">
                                    <button
                                        type="button"
                                        className="flex items-center gap-1 hover:text-slate-900"
                                        onClick={() => handleSort('created_at')}
                                    >
                                        Applied Date
                                        {sortField === 'created_at' && (
                                            <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-3">
                                    <button
                                        type="button"
                                        className="flex items-center gap-1 hover:text-slate-900"
                                        onClick={() => handleSort('name')}
                                    >
                                        Name
                                        {sortField === 'name' && (
                                            <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-3">Contact</th>
                                <th className="px-6 py-3">
                                    <button
                                        type="button"
                                        className="flex items-center gap-1 hover:text-slate-900"
                                        onClick={() => handleSort('role_applied_for')}
                                    >
                                        Role Applied For
                                        {sortField === 'role_applied_for' && (
                                            <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-3">
                                    <button
                                        type="button"
                                        className="flex items-center gap-1 hover:text-slate-900"
                                        onClick={() => handleSort('status')}
                                    >
                                        Status
                                        {sortField === 'status' && (
                                            <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredApplicants.map(applicant => (
                                <tr
                                    key={applicant.id}
                                    className="bg-white border-b hover:bg-slate-50 cursor-pointer"
                                    onClick={() => handleSelectApplicant(applicant)}
                                >
                                    <td className="px-6 py-4">
                                        {new Date(applicant.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-slate-800">
                                        {applicant.first_name} {applicant.last_name}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm">
                                            <div>{applicant.email}</div>
                                            <div className="text-slate-500">{applicant.phone}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {applicant.role_applied_for || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[applicant.status]}`}>
                                            {applicant.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleSelectApplicant(applicant)}
                                                className="p-1 text-blue-600 hover:text-blue-800"
                                                title="View/Edit"
                                            >
                                                <IconPencil className="w-4 h-4" />
                                            </button>
                                            {canDelete && (
                                                <button
                                                    onClick={() => {
                                                        setApplicantToDelete(applicant.id);
                                                        setShowDeleteConfirm(true);
                                                    }}
                                                    className="p-1 text-red-600 hover:text-red-800"
                                                    title="Delete"
                                                >
                                                    <IconTrash className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredApplicants.length === 0 && (
                        <p className="text-center py-10 text-slate-500">
                            {searchQuery || statusFilter !== 'All' ? 'No applicants found matching your criteria.' : 'No applicants found.'}
                        </p>
                    )}
                </div>
            )}

            {/* Detail Panel */}
            {isPanelOpen && (
                <ApplicantDetailPanel
                    applicant={selectedApplicant}
                    onClose={handleClosePanel}
                    onSave={handleSaveApplicant}
                    currentUser={currentUser}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onStatusChange={handleStatusChange}
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <ConfirmationModal
                    title="Delete Applicant"
                    message={`Are you sure you want to delete this applicant? This action cannot be undone.`}
                    onConfirm={handleDelete}
                    onCancel={() => {
                        setShowDeleteConfirm(false);
                        setApplicantToDelete(null);
                    }}
                />
            )}
        </div>
    );
};

export default JobApplicants;

