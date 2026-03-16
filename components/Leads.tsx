import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Lead, Note, Staff, LeadStatus, Customer, Activity, HotelPreference, StayPreference, Service, Branch, CustomerDocuments, UploadedFile, PassportDetails, AadhaarDetails, Itinerary, LoggedInUser, CostingOption, TourType, PanDetails, OtherDocDetails, Document, VisaDetails, BankStatementDetails, LeadType, ItineraryMetadata, Supplier, TourTypeDisplay, InvoiceStatus, InvoiceItem, Invoice, Flight, Priority, TourRegion, LeadSource, LeadSourceDisplay, VisaType, PassportServiceType, Address, HotelStay, StaffStatus, LeadCosting, LeadCostItem, TransactionApprovalStatus, Visa, canEditResource, Task, TaskPriority, TaskStatus, isSuperAdmin, isTaskManager, ItineraryStatus } from '../types';
import { Page } from '../types';
import { IconSearch, IconPlus, IconX, IconFilter, IconPencil, IconChevronDown, IconTrash, IconChatBubble, IconEye, IconRefresh, IconDownload, IconInfo, MailIcon, IconWhatsapp, IconCheckCircle } from '../constants';
import { CustomerDetailPanel } from './CustomerDetailPanel';
import { LeadCostingPanel } from './LeadCostingPanel';
import { TransactionPanel } from './TransactionPanel';
import { VisaDetailDrawer } from './VisaDetailDrawer';
import { InvoiceDetailPanel, type InvoiceSaveOptions } from './Invoicing';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { syncTaskEventToLeadAndCustomer } from '../lib/taskActivitySync';
import { useData } from '../contexts/DataProvider';
import { useAuth } from '../contexts/AuthProvider';
import { AuthApiError } from '@supabase/supabase-js';
import { useRouter } from '../contexts/RouterProvider';
import { TaskDetailPanel } from './Tasks';
import { getDefaultAvatarUrl } from '../lib/avatarUrl';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface LeadsPageProps {
    page: Page;
    currentUser: LoggedInUser;
}

const MealIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 12c0-5.14-4.16-9.3-9.3-9.3S3.15 6.86 3.15 12m18.6 0c0 2.23-1.07 4.23-2.7 5.51M3.15 12a6.8 6.8 0 01.37-2.02m17.66 2.02c.26.65.37 1.32.37 2.02m-1.5-3.32l-3.32-3.32m-4.5 0L7.85 5.36m0 6.64l-3.32 3.32" />
    </svg>
);

const generateBookingId = (lead: Lead | Partial<Lead>): string => {
    if (!lead || !lead.id || !lead.created_at) {
        return 'N/A';
    }
    const createdAt = new Date(lead.created_at);
    const day = String(createdAt.getDate()).padStart(2, '0');
    const month = String(createdAt.getMonth() + 1).padStart(2, '0');
    const year = String(createdAt.getFullYear()).slice(-2);
    return `MTS-${lead.id}${day}${month}${year}`;
};


const ConfirmationModal: React.FC<{ title: string; message: string; onConfirm: () => void; onCancel: () => void; }> = ({ title, message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-slate-600 my-4">{message}</p>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
                <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-md bg-red-600 text-white">Confirm</button>
            </div>
        </div>
    </div>
);

const ITEMS_PER_PAGE = 50;

const BUDGET_OPTIONS = [
    { value: 'economical', label: 'Economical', description: 'Budget stay, basic vehicles, essential tours' },
    { value: 'standard', label: 'Standard', description: '3★ hotels, AC vehicles, smooth tours' },
    { value: 'deluxe', label: 'Deluxe', description: '4★ hotels, premium vehicles, relaxed tours' },
    { value: 'luxury', label: 'Luxury', description: '5★ resorts, luxury vehicles, curated experiences' },
] as const;

const getBudgetDisplayLabel = (budget: string | number | null | undefined): string => {
    if (!budget) return 'N/A';
    if (typeof budget === 'number') return `₹${budget.toLocaleString()}`;
    const option = BUDGET_OPTIONS.find(opt => opt.value === budget);
    if (option) return option.label;
    // Legacy support: if it's "budget", show as "Economical"
    if (budget === 'budget') return 'Economical';
    // Fallback: capitalize first letter
    return budget.charAt(0).toUpperCase() + budget.slice(1);
};

const getBudgetDescription = (budget: string | number | null | undefined): string | null => {
    if (!budget || typeof budget === 'number') return null;
    const option = BUDGET_OPTIONS.find(opt => opt.value === budget);
    if (option) return option.description;
    // Legacy support: if it's "budget", return economical description
    if (budget === 'budget') return BUDGET_OPTIONS[0].description;
    return null;
};

const getStatusClass = (status: LeadStatus) => {
    switch (status) {
        case LeadStatus.Confirmed:
        case LeadStatus.Completed:
        case LeadStatus.BillingCompletion:
            return 'bg-green-100 text-green-800';
        case LeadStatus.PartialPaymentOnCredit:
            return 'bg-cyan-100 text-cyan-800';
        case LeadStatus.Enquiry:
        case LeadStatus.Processing:
        case LeadStatus.OperationsInitiated:
            return 'bg-blue-100 text-blue-800';
        case LeadStatus.Voucher:
        case LeadStatus.OnTour:
        case LeadStatus.Invoicing:
            return 'bg-purple-100 text-purple-800';
        case LeadStatus.Rejected:
        case LeadStatus.NotAttended:
            return 'bg-red-100 text-red-800';
        case LeadStatus.Unqualified:
        case LeadStatus.Feedback:
            return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-slate-100 text-slate-800';
    }
};

const getLeadTypeClass = (type?: LeadType) => {
    switch (type) {
        case LeadType.Booked: return 'bg-green-600 text-white';
        case LeadType.Hot: return 'bg-red-100 text-red-800';
        case LeadType.Warm: return 'bg-orange-100 text-orange-800';
        case LeadType.Cold: return 'bg-blue-100 text-blue-800';
        default: return 'bg-slate-100 text-slate-800';
    }
};

const getPriorityClass = (priority?: Priority) => {
    switch (priority) {
        case Priority.High: return 'bg-red-100 text-red-800';
        case Priority.Medium: return 'bg-yellow-100 text-yellow-800';
        case Priority.Low: return 'bg-blue-100 text-blue-800';
        default: return 'bg-slate-100 text-slate-800';
    }
};

const getLeadTypeFromStatus = (status: LeadStatus): LeadType => {
    switch (status) {
        // Cold Lead: Enquiry, Rejected, Unqualified Lead
        case LeadStatus.Enquiry:
        case LeadStatus.Rejected:
        case LeadStatus.Unqualified:
            return LeadType.Cold;
        // Warm Lead: Processing, Operations Initiated, Invoicing, On Travel, Feedback
        case LeadStatus.Processing:
        case LeadStatus.OperationsInitiated:
        case LeadStatus.Invoicing:
        case LeadStatus.OnTour:
        case LeadStatus.Feedback:
            return LeadType.Warm;
        // Hot Lead: Partial Payment/ On-Credit, Confirmed, Billing Completed, Voucher
        case LeadStatus.PartialPaymentOnCredit:
        case LeadStatus.Confirmed:
        case LeadStatus.BillingCompletion:
        case LeadStatus.Voucher:
            return LeadType.Hot;
        // Completed stays as Booked (if needed, but not in your list)
        case LeadStatus.Completed:
            return LeadType.Booked;
        default:
            return LeadType.Cold;
    }
};

// Calculate if 48 hours have passed since lead creation
const has48HoursPassed = (createdAt: string): boolean => {
    if (!createdAt) return true; // If no creation date, allow the change

    const createdDate = new Date(createdAt);
    const now = new Date();

    // Calculate the difference in milliseconds
    const diffMs = now.getTime() - createdDate.getTime();

    // Convert to hours (48 hours = 48 * 60 * 60 * 1000 milliseconds)
    const hoursPassed = diffMs / (1000 * 60 * 60);

    return hoursPassed >= 48;
};
const calculateLeadPriority = (lead: Partial<Lead>): Priority => {
    if (!lead.travel_date || !lead.status || !lead.lead_type) {
        return lead.priority || Priority.Low;
    }

    const travelDate = new Date(lead.travel_date);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const urgencyOverrideStatuses: LeadStatus[] = [LeadStatus.BillingCompletion, LeadStatus.Voucher, LeadStatus.OnTour, LeadStatus.Completed, LeadStatus.Feedback];

    if (
        travelDate <= thirtyDaysFromNow &&
        lead.lead_type === LeadType.Hot &&
        !urgencyOverrideStatuses.includes(lead.status)
    ) {
        return Priority.High;
    }
    switch (lead.status) {
        case LeadStatus.BillingCompletion:
        case LeadStatus.Voucher:
            return Priority.High;

        case LeadStatus.Confirmed:
        case LeadStatus.PartialPaymentOnCredit:
        case LeadStatus.Invoicing:
        case LeadStatus.OnTour:
        case LeadStatus.Completed:
        case LeadStatus.Feedback:
            return Priority.Medium;

        case LeadStatus.Enquiry:
        case LeadStatus.Processing:
        case LeadStatus.OperationsInitiated:
            return Priority.Low;

        default:
            return Priority.Low;
    }
};

/** Sales/Operations can set status up to Confirmed; only Super Admin can change Partial/On-Credit → Confirmed; only Accountant/Super Admin can set Billing Completed; Accountant/Super Admin OR Sales/Operations (when lead is already Billing Completed) can set Voucher; after Voucher, Sales/Operations can set On Travel, Feedback, Completed. */
const canSetLeadStatus = (currentUser: LoggedInUser, currentStatus: LeadStatus | undefined, newStatus: LeadStatus): boolean => {
    const isSuperAdmin = currentUser.role === 'Super Admin';
    const isAccountantOrSuperAdmin = isSuperAdmin || currentUser.is_accountant === true;
    // Partial / On-Credit → Confirmed: only Super Admin can set
    if (currentStatus === LeadStatus.PartialPaymentOnCredit && newStatus === LeadStatus.Confirmed) {
        return isSuperAdmin;
    }
    // Only Accountant or Super Admin can set Billing Completed
    if (newStatus === LeadStatus.BillingCompletion) {
        return isAccountantOrSuperAdmin;
    }
    // Voucher: Accountant/Super Admin can set from any allowed status; Sales/Operations can set only when lead is already Billing Completed
    if (newStatus === LeadStatus.Voucher) {
        return isAccountantOrSuperAdmin || currentStatus === LeadStatus.BillingCompletion;
    }
    // On Travel, Feedback, Completed: only allowed if (Accountant/Super Admin) OR lead is already at Voucher or beyond
    if (newStatus === LeadStatus.OnTour || newStatus === LeadStatus.Feedback || newStatus === LeadStatus.Completed) {
        const atVoucherOrBeyond = currentStatus === LeadStatus.Voucher || currentStatus === LeadStatus.OnTour || currentStatus === LeadStatus.Feedback || currentStatus === LeadStatus.Completed;
        return isAccountantOrSuperAdmin || !!atVoucherOrBeyond;
    }
    // All other statuses: Sales/Operations can set
    return true;
};

const StatusBadge: React.FC<{ status: LeadStatus | InvoiceStatus }> = ({ status }) => (
    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusClass(status as LeadStatus)}`}>
        {status}
    </span>
);

const PriorityBadge: React.FC<{ priority?: Priority }> = ({ priority }) => (
    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getPriorityClass(priority)}`}>
        {priority || 'N/A'}
    </span>
);

const LeadTypeBadge: React.FC<{ type?: LeadType }> = ({ type }) => (
    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getLeadTypeClass(type)}`}>
        {type || 'N/A'}
    </span>
);

const AvatarSkeleton: React.FC = () => (
    <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse"></div>
);


const AssignedToAvatars: React.FC<{ assignees: Staff[], isLoading?: boolean }> = ({ assignees, isLoading }) => {
    if (isLoading) {
        return <AvatarSkeleton />;
    }

    if (!assignees || assignees.length === 0) {
        return (
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600" title="Unassigned">U</div>
        );
    }

    return (
        <div className="relative group">
            <div className="flex -space-x-3 cursor-pointer">
                {assignees.slice(0, 3).map((staff, index) => (
                    <img
                        key={staff.id}
                        className="h-8 w-8 rounded-full border-2 border-white"
                        src={staff.avatar_url}
                        alt={staff.name}
                        title={staff.name}
                        style={{ zIndex: assignees.length - index }}
                    />
                ))}
                {assignees.length > 3 && (
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 border-2 border-white" style={{ zIndex: 0 }}>
                        +{assignees.length - 3}
                    </div>
                )}
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-sm p-2 bg-slate-800 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                <ul className="space-y-2">
                    {assignees.map(staff => (
                        <li key={staff.id} className="flex items-center gap-2">
                            <img
                                className="h-6 w-6 rounded-full"
                                src={staff.avatar_url}
                                alt={staff.name}
                            />
                            <span className="text-xs whitespace-nowrap">{staff.name}</span>
                        </li>
                    ))}
                </ul>
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
            </div>
        </div>
    );
};

const AssignedSuppliersAvatars: React.FC<{ suppliers: Supplier[], isLoading?: boolean }> = ({ suppliers, isLoading }) => {
    if (isLoading) {
        return <AvatarSkeleton />;
    }

    if (!suppliers || suppliers.length === 0) {
        return <div className="text-slate-400 text-xs">None</div>;
    }

    return (
        <div className="relative group">
            <div className="flex -space-x-3 cursor-pointer">
                {suppliers.slice(0, 3).map((supplier, index) => (
                    <div key={supplier.id} className="relative" style={{ zIndex: suppliers.length - index }}>
                        <img
                            className="h-8 w-8 rounded-full border-2 border-white object-cover"
                            src={supplier.contact_person_avatar_url || getDefaultAvatarUrl(supplier.company_name || 'Supplier', 32)}
                            alt={supplier.company_name}
                            title={supplier.company_name}
                        />
                        {supplier.is_verified && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white">
                                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2 7l3 3 5-7" />
                                </svg>
                            </div>
                        )}
                    </div>
                ))}
                {suppliers.length > 3 && (
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 border-2 border-white" style={{ zIndex: 0 }}>
                        +{suppliers.length - 3}
                    </div>
                )}
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-sm p-2 bg-slate-800 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                <ul className="space-y-2">
                    {suppliers.map(supplier => (
                        <li key={supplier.id} className="flex items-center gap-2">
                            <img
                                className="h-6 w-6 rounded-full object-cover"
                                src={supplier.contact_person_avatar_url || getDefaultAvatarUrl(supplier.company_name || 'Supplier', 32)}
                                alt={supplier.company_name}
                            />
                            <span className="text-xs whitespace-nowrap flex items-center gap-1.5">
                                {supplier.company_name}
                                {supplier.is_verified && <span className="text-blue-400">✓</span>}
                            </span>
                        </li>
                    ))}
                </ul>
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
            </div>
        </div>
    );
};

const generateUpdateDescription = (original: Lead, updated: Lead, staff: Staff[], branches: Branch[]): string => {
    const changes: string[] = [];

    if (original.status !== updated.status) {
        changes.push(`status from '${original.status}' to '${updated.status}'`);
    }
    if (original.destination !== updated.destination) {
        changes.push(`destination to '${updated.destination}'`);
    }
    if (original.travel_date !== updated.travel_date) {
        changes.push(`travel date to '${new Date(updated.travel_date).toLocaleDateString()}'`);
    }
    if (original.tour_type !== updated.tour_type) {
        changes.push(`tour type to '${updated.tour_type}'`);
    }

    const oldStaffNames = (original.assigned_to || []).map(s => s.name).sort();
    const newStaffNames = (updated.assigned_to || []).map(s => s.name).sort();
    if (JSON.stringify(oldStaffNames) !== JSON.stringify(newStaffNames)) {
        const added = newStaffNames.filter(name => !oldStaffNames.includes(name));
        const removed = oldStaffNames.filter(name => !newStaffNames.includes(name));
        const staffChanges: string[] = [];
        if (added.length > 0) staffChanges.push(`assigned ${added.join(', ')}`);
        if (removed.length > 0) staffChanges.push(`unassigned ${removed.join(', ')}`);
        if (staffChanges.length > 0) changes.push(staffChanges.join(' and '));
    }

    const oldBranchIds = [...(original.branch_ids || [])].sort();
    const newBranchIds = [...(updated.branch_ids || [])].sort();
    if (JSON.stringify(oldBranchIds) !== JSON.stringify(newBranchIds)) {
        const addedBranches = newBranchIds.filter(id => !oldBranchIds.includes(id)).map(id => branches.find(b => b.id === id)?.name).filter(Boolean);
        const removedBranches = oldBranchIds.filter(id => !newBranchIds.includes(id)).map(id => branches.find(b => b.id === id)?.name).filter(Boolean);
        const shareChanges: string[] = [];
        if (addedBranches.length > 0) shareChanges.push(`shared lead with ${addedBranches.join(', ')}`);
        if (removedBranches.length > 0) shareChanges.push(`removed access for ${removedBranches.join(', ')}`);
        if (shareChanges.length > 0) changes.push(shareChanges.join(' and '));
    }

    if (JSON.stringify(original.transfer_request) !== JSON.stringify(updated.transfer_request) && updated.transfer_request?.status === 'pending') {
        const toBranchName = branches.find(b => b.id === updated.transfer_request.to_branch_id)?.name;
        changes.push(`requested a transfer to ${toBranchName}`);
    }

    const oldServices = (original.services || []).sort().join(', ');
    const newServices = (updated.services || []).sort().join(', ');
    if (oldServices !== newServices) {
        changes.push(`required services`);
    }

    if (JSON.stringify(original.requirements) !== JSON.stringify(updated.requirements)) {
        changes.push(`customer requirements`);
    }

    if (changes.length === 0) {
        return 'Lead details were saved with no changes.';
    }

    if (changes.length > 2) {
        return `Updated ${changes.slice(0, 2).join(', ')}, and other fields.`;
    }

    return `Updated ${changes.join(' and ')}.`;
};

const Pagination: React.FC<{ currentPage: number; totalItems: number; itemsPerPage: number; onPageChange: (page: number) => void }> = ({ currentPage, totalItems, itemsPerPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    const handlePrev = () => onPageChange(Math.max(1, currentPage - 1));
    const handleNext = () => onPageChange(Math.min(totalPages, currentPage + 1));

    return (
        <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-slate-600">
                Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-medium">{totalItems}</span> results
            </p>
            <div className="flex items-center gap-2">
                <button onClick={handlePrev} disabled={currentPage === 1} className="px-3 py-1 text-sm border rounded-md disabled:opacity-50">Previous</button>
                <button onClick={handleNext} disabled={currentPage === totalPages} className="px-3 py-1 text-sm border rounded-md disabled:opacity-50">Next</button>
            </div>
        </div>
    );
};

const SortIcon: React.FC<{ direction: 'asc' | 'desc' | null }> = ({ direction }) => {
    if (!direction) return <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>;
    if (direction === 'asc') return <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>;
    return <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>;
};

type SortableKeys = 'created_at' | 'last_updated' | 'destination' | 'travel_date' | 'priority';
type SortConfig = { key: SortableKeys; direction: 'asc' | 'desc' } | null;

const ensureMentionsAreCaptured = (notes: Note[], allStaff: Staff[]): Note[] => {
    return notes.map(note => {
        const textMentions = (note.text.match(/@([\w\s]+)/g) || []).map(m => m.substring(1).trim());
        if (textMentions.length === 0) return note;

        const updatedMentions = [...(note.mentions || [])];
        const capturedMentionIds = new Set(updatedMentions.map(m => m.id));

        for (const name of textMentions) {
            const mentionedStaff = allStaff.find(s => s.name.toLowerCase() === name.toLowerCase());
            if (mentionedStaff && !capturedMentionIds.has(mentionedStaff.id)) {
                updatedMentions.push({ id: mentionedStaff.id, name: mentionedStaff.name });
                capturedMentionIds.add(mentionedStaff.id);
            }
        }

        return { ...note, mentions: updatedMentions };
    });
};

const VersionedDocumentDisplay: React.FC<{
    title: string;
    docType: keyof CustomerDocuments;
    documents: Document<any>[];
    isEditing: boolean;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>, docType: keyof CustomerDocuments) => void;
    onCameraScan: (docType: keyof CustomerDocuments) => void;
    onDelete: (docType: keyof CustomerDocuments, docId: number) => void;
    isMandatoryMissing?: boolean;
    mandatoryMessage?: string;
}> = ({ title, docType, documents, isEditing, onUpload, onCameraScan, onDelete, isMandatoryMissing, mandatoryMessage }) => {
    return (
        <div className="bg-white p-4 rounded-lg border">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                    {title}
                    {isMandatoryMissing && (
                        <div className="relative group">
                            <IconInfo className="w-5 h-5 text-red-500" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs text-white bg-slate-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                                {mandatoryMessage}
                                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                            </div>
                        </div>
                    )}
                </h4>
                {isEditing && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => onCameraScan(docType)} className="px-3 py-1 text-sm font-medium text-purple-700 bg-purple-100 rounded-[5px] hover:bg-purple-200">
                            📷 Scan
                        </button>
                        <label className="cursor-pointer px-3 py-1 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">
                            Upload
                            <input type="file" className="hidden" onChange={(e) => onUpload(e, docType)} accept=".pdf,.doc,.docx,.jpg,.png" />
                        </label>
                    </div>
                )}
            </div>
            {documents && documents.length > 0 ? (
                <div className="space-y-2">
                    {documents.map((doc, index) => (
                        <div key={doc.id} className="group flex items-center justify-between p-2 bg-slate-50 rounded-md text-sm hover:bg-slate-100">
                            <div className="flex items-center gap-3">
                                <a href={doc.file.content} target="_blank" rel="noopener noreferrer" title="View File" className="text-blue-600 hover:text-blue-800">
                                    <IconEye className="w-5 h-5" />
                                </a>
                                <div>
                                    <p className="font-medium text-slate-800 truncate pr-4"><span className="font-bold">V{index + 1}:</span> {doc.file.name}</p>
                                    <p className="text-xs text-slate-500">{new Date(doc.id).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a href={doc.file.content} download={doc.file.name} className="p-1.5 text-slate-500 hover:text-blue-600" title="Download">
                                    <IconDownload className="w-4 h-4" />
                                </a>
                                {isEditing && (
                                    <button onClick={() => onDelete(docType, doc.id)} className="p-1.5 text-slate-500 hover:text-red-600" title="Delete">
                                        <IconTrash className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : <p className="text-xs text-slate-400 text-center py-2">No document uploaded.</p>}
        </div>
    );
};

const MultiDocumentDisplay: React.FC<{
    title: string;
    docType: keyof CustomerDocuments;
    documents: Document<any>[];
    isEditing: boolean;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>, docType: keyof CustomerDocuments) => void;
    onCameraScan: (docType: keyof CustomerDocuments) => void;
    onDelete: (docType: keyof CustomerDocuments, docId: number) => void;
}> = ({ title, docType, documents, isEditing, onUpload, onCameraScan, onDelete }) => {
    return (
        <div className="bg-white p-4 rounded-lg border">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-700">{title}</h4>
                {isEditing && (
                    <div className="flex items-center gap-2">
                        <button onClick={() => onCameraScan(docType)} className="px-3 py-1 text-sm font-medium text-purple-700 bg-purple-100 rounded-[5px] hover:bg-purple-200">
                            📷 Scan
                        </button>
                        <label className="cursor-pointer px-3 py-1 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">
                            Upload
                            <input type="file" className="hidden" onChange={(e) => onUpload(e, docType)} accept=".pdf,.doc,.docx,.jpg,.png" />
                        </label>
                    </div>
                )}
            </div>
            {documents && documents.length > 0 ? (
                <div className="space-y-2">
                    {documents.map((doc) => (
                        <div key={doc.id} className="group flex items-center justify-between p-2 bg-slate-50 rounded-md text-sm hover:bg-slate-100">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <a href={doc.file.content} target="_blank" rel="noopener noreferrer" title="View File" className="shrink-0 text-blue-600 hover:text-blue-800">
                                    <IconEye className="w-5 h-5" />
                                </a>
                                <div className="truncate">
                                    <p className="font-medium text-slate-800 truncate">{doc.file.name}</p>
                                    <p className="text-xs text-slate-500 truncate">{doc.details?.personName || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex items-center shrink-0 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a href={doc.file.content} download={doc.file.name} className="p-1.5 text-slate-500 hover:text-blue-600" title="Download">
                                    <IconDownload className="w-4 h-4" />
                                </a>
                                {isEditing && (
                                    <button onClick={() => onDelete(docType, doc.id)} className="p-1.5 text-slate-500 hover:text-red-600" title="Delete">
                                        <IconTrash className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : <p className="text-xs text-slate-400 text-center py-2">No documents uploaded.</p>}
        </div>
    );
};

const HotelStaysEditor: React.FC<{
    stays: HotelStay[];
    onChange: (stays: HotelStay[]) => void;
    isEditing: boolean;
}> = ({ stays, onChange, isEditing }) => {

    const handleAddStay = () => {
        const lastStay = stays[stays.length - 1];
        let nextCheckIn = '';

        if (lastStay && lastStay.checkOut) {
            nextCheckIn = lastStay.checkOut;
        } else {
            nextCheckIn = new Date().toISOString().split('T')[0];
        }

        // Default next checkout to +1 day
        const nextCheckOutDate = new Date(nextCheckIn);
        nextCheckOutDate.setDate(nextCheckOutDate.getDate() + 1);
        const nextCheckOut = nextCheckOutDate.toISOString().split('T')[0];

        const newStay: HotelStay = {
            id: Date.now(),
            hotelName: '',
            city: '',
            checkIn: nextCheckIn,
            checkOut: nextCheckOut,
            nights: 1,
            roomType: 'Standard',
            mealPlan: 'CP'
        };
        onChange([...stays, newStay]);
    };

    const handleRemoveStay = (id: number) => {
        onChange(stays.filter(s => s.id !== id));
    };

    const handleStayChange = (id: number, field: keyof HotelStay, value: any) => {
        const newStays = stays.map(s => {
            if (s.id === id) {
                const updatedStay = { ...s, [field]: value };
                // Auto-calculate nights if dates change
                if (field === 'checkIn' || field === 'checkOut') {
                    if (updatedStay.checkIn && updatedStay.checkOut) {
                        const start = new Date(updatedStay.checkIn);
                        const end = new Date(updatedStay.checkOut);
                        const diffTime = Math.abs(end.getTime() - start.getTime());
                        updatedStay.nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    }
                }
                // Auto-calculate checkout if nights change
                if (field === 'nights' && updatedStay.checkIn) {
                    const start = new Date(updatedStay.checkIn);
                    start.setDate(start.getDate() + (value as number));
                    updatedStay.checkOut = start.toISOString().split('T')[0];
                }
                return updatedStay;
            }
            return s;
        });

        onChange(newStays);
    };

    if (!isEditing && (!stays || stays.length === 0)) {
        return <p className="text-sm text-slate-500 py-2">No hotel details available.</p>;
    }

    return (
        <div className="space-y-3">
            {stays.map((stay, index) => (
                <div key={stay.id} className="p-3 bg-slate-50 rounded-md border relative group">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                        <div className="sm:col-span-2">
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">City</label>
                            {isEditing ? (
                                <input type="text" value={stay.city} onChange={e => handleStayChange(stay.id, 'city', e.target.value)} className="w-full text-sm p-1.5 border rounded bg-white" placeholder="City" />
                            ) : <p className="text-sm">{stay.city || 'N/A'}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Check-In</label>
                            {isEditing ? (
                                <input type="date" value={stay.checkIn} onChange={e => handleStayChange(stay.id, 'checkIn', e.target.value)} className="w-full text-sm p-1.5 border rounded bg-white" />
                            ) : <p className="text-sm">{stay.checkIn ? new Date(stay.checkIn).toLocaleDateString() : 'N/A'}</p>}
                        </div>
                        <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Nights</label>
                            {isEditing ? (
                                <input type="number" min="1" value={stay.nights} onChange={e => handleStayChange(stay.id, 'nights', parseInt(e.target.value))} className="w-full text-sm p-1.5 border rounded bg-white" />
                            ) : <p className="text-sm">{stay.nights}</p>}
                        </div>
                        <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Check-Out</label>
                            {isEditing ? (
                                <input type="date" value={stay.checkOut} onChange={e => handleStayChange(stay.id, 'checkOut', e.target.value)} className="w-full text-sm p-1.5 border rounded bg-white" />
                            ) : <p className="text-sm">{stay.checkOut ? new Date(stay.checkOut).toLocaleDateString() : 'N/A'}</p>}
                        </div>
                        <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Room/Meal</label>
                            {isEditing ? (
                                <input type="text" value={stay.roomType} onChange={e => handleStayChange(stay.id, 'roomType', e.target.value)} className="w-full text-sm p-1.5 border rounded bg-white" placeholder="Room Type" />
                            ) : <p className="text-sm">{stay.roomType || 'Std'}</p>}
                        </div>
                    </div>
                    {isEditing && (
                        <button onClick={() => handleRemoveStay(stay.id)} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <IconTrash className="w-4 h-4" />
                        </button>
                    )}
                </div>
            ))}
            {isEditing && (
                <button onClick={handleAddStay} className="w-full py-2 border-2 border-dashed border-slate-300 rounded-md text-slate-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                    <IconPlus className="w-4 h-4" /> Add Hotel Stay
                </button>
            )}
        </div>
    );
};

/** Format duration string for display (e.g. "5 Days / 4 Nights" or "5" -> "5 Days"). */
const formatDurationToDays = (duration?: string | null): string => {
    const d = duration == null || duration === '' ? null : parseDurationDays(duration);
    return d != null ? `${d} Day${d !== 1 ? 's' : ''}` : 'N/A';
};

/** Parse duration string to number of days (e.g. "5", "5 Days", "5 Days / 4 Nights" -> 5). */
const parseDurationDays = (duration?: string): number | null => {
    if (!duration) return null;
    const match = duration.toString().match(/(\d+)/);
    if (!match) return null;
    const days = parseInt(match[1], 10);
    return Number.isNaN(days) || days < 1 ? null : days;
};

const addDaysToDateString = (dateString: string, days: number): string | null => {
    if (!dateString) return null;
    const base = new Date(dateString);
    if (Number.isNaN(base.getTime())) return null;
    const updated = new Date(base);
    updated.setDate(updated.getDate() + days);
    return updated.toISOString().split('T')[0];
};

const getLatestCheckoutDate = (hotelStays?: HotelStay[]): string | null => {
    if (!hotelStays || hotelStays.length === 0) return null;
    const valid = hotelStays
        .map(stay => stay.checkOut)
        .filter((date): date is string => !!date);
    if (valid.length === 0) return null;
    return valid.reduce((latest, current) => (new Date(current) > new Date(latest) ? current : latest), valid[0]);
};

/** Trip length in days (from duration or hotel stays). */
const deriveTripDays = (lead: Partial<Lead>): number | null => {
    const durationDays = parseDurationDays(lead.duration);
    if (durationDays !== null) return durationDays;

    if (lead.hotel_stays && lead.hotel_stays.length > 0) {
        const latestCheckout = getLatestCheckoutDate(lead.hotel_stays);
        const baseDate = lead.travel_date || lead.hotel_stays[0]?.checkIn;
        if (latestCheckout && baseDate) {
            const diffMs = new Date(latestCheckout).getTime() - new Date(baseDate).getTime();
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
            return diffDays >= 0 ? diffDays + 1 : null;
        }
    }

    return null;
};

const calculateAutoReturnDate = (lead: Partial<Lead>): string | null => {
    if (!lead.travel_date) return null;
    const tripDays = deriveTripDays(lead);
    if (tripDays !== null && tripDays >= 1) {
        const computed = addDaysToDateString(lead.travel_date, tripDays - 1);
        if (computed) return computed;
    }
    const latestCheckout = getLatestCheckoutDate(lead.hotel_stays);
    return latestCheckout;
};

const calculateDurationBasedReturnDate = (travelDate?: string, duration?: string): string | null => {
    if (!travelDate) return null;
    const days = parseDurationDays(duration);
    if (days === null || days < 1) return null;
    return addDaysToDateString(travelDate, days - 1);
};

/** Compute number of days (inclusive) from travel date to return date. Returns null if invalid. */
const computeDaysFromDates = (travelDate?: string, returnDate?: string): number | null => {
    if (!travelDate || !returnDate) return null;
    const start = new Date(travelDate);
    const end = new Date(returnDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1);
};

export const Leads: React.FC<LeadsPageProps> = ({ page, currentUser }) => {
    const { leads, totalLeadCount, leadsLoadingMore, customers, itineraries, staff, branches, suppliers, invoices, tasks, fetchTasks, refreshData, fetchInvoices, loading: isDataLoading, destinations, updateLeadInPlace, addLeadInPlace } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const [filters, setFilters] = useState({ staffIds: [] as number[], branchIds: [] as number[], statuses: [] as LeadStatus[], leadTypes: [] as LeadType[], services: [] as Service[], sources: [] as string[], destinations: [] as string[], showUnassigned: false });
    const { addToast } = useToast();
    const { signOut } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const { navigate, search } = useRouter();
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'last_updated', direction: 'desc' });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [initialLeadTab, setInitialLeadTab] = useState<'details' | 'notes' | 'tasks' | 'activity' | 'documents' | 'itinerary' | 'costing' | 'invoices' | null>(null);


    const isHQ = currentUser.branch_id === 1;

    const isPrivilegedUser =
        currentUser.role === 'Super Admin' ||
        currentUser.role === 'Manager' ||
        currentUser.is_lead_manager;

    const customerMap = useMemo(() => {
        const map = new Map<number, Customer>();
        customers.forEach(c => map.set(c.id, c));
        return map;
    }, [customers]);

    const handleAddNew = () => {
        setSelectedLead(null);
        setIsPanelOpen(true);
    };

    const handleSelectLead = (lead: Lead) => {
        setSelectedLead(lead);
        setIsPanelOpen(true);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedLead(null);
        setInitialLeadTab(null);
    };

    useEffect(() => {
        if (!isPanelOpen || !selectedLead || leads.length === 0) return;
        const updatedLead = leads.find(l => l.id === selectedLead.id);
        if (!updatedLead) {
            handleClosePanel();
            return;
        }
        // Always sync from the latest leads array so changes like assigned_to are reflected,
        // even when last_updated doesn't change.
        if (updatedLead !== selectedLead) {
            setSelectedLead(updatedLead);
        }
    }, [leads, selectedLead, isPanelOpen]);

    // Load invoices when lead panel is open so Invoices tab and Costing Total Amount show correct data
    useEffect(() => {
        if (isPanelOpen && selectedLead?.id && fetchInvoices) {
            fetchInvoices();
        }
    }, [isPanelOpen, selectedLead?.id, fetchInvoices]);

    useEffect(() => {
        const action = sessionStorage.getItem('action');
        let leadIdToView = sessionStorage.getItem('viewLeadId');
        let tabToOpen = sessionStorage.getItem('viewLeadTab');
        // Also read from URL (e.g. notification link /leads?openLead=123&tab=notes) so navigation works when already on Leads
        if (search) {
            const params = new URLSearchParams(search);
            const openLead = params.get('openLead');
            if (openLead) {
                leadIdToView = leadIdToView || openLead;
                tabToOpen = tabToOpen || params.get('tab') || null;
            }
        }

        const openLeadById = (idStr: string | null, tab?: string | null) => {
            if (!idStr || leads.length === 0) return;
            const leadIdNum = parseInt(idStr, 10);
            if (!Number.isFinite(leadIdNum)) return;
            const lead = leads.find(l => l.id === leadIdNum);
            if (!lead) return;
            handleSelectLead(lead);
            if (tab === 'notes' || tab === 'details' || tab === 'tasks' || tab === 'activity' || tab === 'documents' || tab === 'itinerary' || tab === 'costing' || tab === 'invoices') {
                setInitialLeadTab(tab);
            }
        };

        if (leadIdToView) {
            sessionStorage.removeItem('viewLeadId');
            sessionStorage.removeItem('viewLeadTab');
            openLeadById(leadIdToView, tabToOpen);
            // Clear openLead from URL so address bar stays clean
            if (search && new URLSearchParams(search).get('openLead')) {
                window.history.replaceState({}, '', '/leads');
            }
        }

        if (action === 'new-lead') {
            sessionStorage.removeItem('action');
            handleAddNew();
        }

        // Handle "open lead" events from the notifications drawer when the URL doesn't change.
        const handleNotificationOpen = (event: Event) => {
            const custom = event as CustomEvent<{ leadId?: number; tab?: string | null }>;
            const fromEventId = custom.detail?.leadId != null ? custom.detail.leadId.toString() : null;
            const fromStorageId = sessionStorage.getItem('viewLeadId');
            const idToUse = fromEventId || fromStorageId;
            const tabFromEvent = custom.detail?.tab ?? sessionStorage.getItem('viewLeadTab');
            if (!idToUse) return;
            sessionStorage.removeItem('viewLeadId');
            sessionStorage.removeItem('viewLeadTab');
            openLeadById(idToUse, tabFromEvent || null);
        };

        window.addEventListener('crm-open-lead-from-notification', handleNotificationOpen as EventListener);
        return () => {
            window.removeEventListener('crm-open-lead-from-notification', handleNotificationOpen as EventListener);
        };
    }, [leads, search, handleSelectLead]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSort = (key: SortableKeys) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredLeads = useMemo(() => {
        return [...leads]
            .filter(l => {
                if (page === Page.LeadsOngoing) {
                    return [LeadStatus.Enquiry, LeadStatus.Processing].includes(l.status);
                } else if (page === Page.LeadsCompleted) {
                    return [LeadStatus.Completed, LeadStatus.Feedback].includes(l.status);
                } else if (page === Page.LeadsRejected) {
                    return l.status === LeadStatus.Rejected || l.status === LeadStatus.Unqualified;
                } else if (page === Page.LeadsUnqualified) {
                    return l.status === LeadStatus.Unqualified;
                }
                return true;
            })
            .filter(l => {
                const customer = customerMap.get(l.customer_id);
                const customerInfo = customer ? `${customer.first_name} ${customer.last_name} ${customer.phone}` : '';
                const mtsId = generateBookingId(l);

                const searchMatch = `${customerInfo} ${l.destination} ${mtsId}`.toLowerCase().includes(searchTerm.toLowerCase());
                const staffMatch = filters.staffIds.length === 0 || l.assigned_to.some(s => filters.staffIds.includes(s.id));
                const branchMatch = filters.branchIds.length === 0 || l.branch_ids.some(branchId => filters.branchIds.includes(branchId));
                const statusMatch = filters.statuses.length === 0 || filters.statuses.includes(l.status);
                const leadTypeMatch = filters.leadTypes.length === 0 || (l.lead_type && filters.leadTypes.includes(l.lead_type));
                const servicesMatch = filters.services.length === 0 || (l.services && filters.services.some(service => l.services.includes(service)));
                const unassignedMatch = !filters.showUnassigned || (l.assigned_to.length === 0);
                const rawSource = (l.source || '').toString().toLowerCase();
                const normalizedSource = rawSource === 'whatsapp' ? LeadSource.WhatsApp : (Object.values(LeadSource).includes(l.source as LeadSource) ? l.source : rawSource || null);
                const sourceMatch = filters.sources.length === 0 || (normalizedSource && filters.sources.includes(normalizedSource as string));
                const destinationMatch = filters.destinations.length === 0 || (l.destination && l.destination.trim() !== '' && filters.destinations.includes(l.destination.trim()));

                return searchMatch && staffMatch && branchMatch && statusMatch && leadTypeMatch && servicesMatch && unassignedMatch && sourceMatch && destinationMatch;
            })
            .sort((a, b) => {
                if (sortConfig) {
                    if (sortConfig.key === 'priority') {
                        const priorityOrder: Record<Priority, number> = { [Priority.High]: 3, [Priority.Medium]: 2, [Priority.Low]: 1 };
                        const aPriority = priorityOrder[a.priority || Priority.Medium] || 0;
                        const bPriority = priorityOrder[b.priority || Priority.Medium] || 0;
                        if (aPriority > bPriority) return sortConfig.direction === 'asc' ? 1 : -1;
                        if (aPriority < bPriority) return sortConfig.direction === 'asc' ? -1 : 1;
                        return 0;
                    }

                    // Handle date fields (created_at, last_updated, travel_date)
                    if (sortConfig.key === 'created_at' || sortConfig.key === 'last_updated' || sortConfig.key === 'travel_date') {
                        const aDate = new Date(a[sortConfig.key] || 0).getTime();
                        const bDate = new Date(b[sortConfig.key] || 0).getTime();
                        if (aDate === 0) return 1;
                        if (bDate === 0) return -1;
                        if (aDate < bDate) return sortConfig.direction === 'asc' ? -1 : 1;
                        if (aDate > bDate) return sortConfig.direction === 'asc' ? 1 : -1;
                        return 0;
                    }

                    const aValue = a[sortConfig.key];
                    const bValue = b[sortConfig.key];

                    if (aValue === null || aValue === undefined) return 1;
                    if (bValue === null || bValue === undefined) return -1;

                    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                }
                // Default sort by last_updated (most recently edited first)
                return new Date(b.last_updated || b.created_at).getTime() - new Date(a.last_updated || a.created_at).getTime();
            });
    }, [leads, searchTerm, page, customerMap, filters, sortConfig]);

    const paginatedLeads = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredLeads.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredLeads, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
        setSelectedLeadIds([]);
    }, [searchTerm, filters, page]);

    const handleSaveLead = async (leadToSave: Lead): Promise<boolean> => {
        if (!currentUser) return false;

        try {
            leadToSave.notes = ensureMentionsAreCaptured(leadToSave.notes || [], staff);

            const isNew = !leadToSave.id;
            const originalLead = isNew ? undefined : leads.find(l => l.id === leadToSave.id);
            let leadId: number;
            let savedActivity: Activity[] = leadToSave.activity || [];
            let newLeadData: { id: number; created_at?: string } | null = null;
            let createdActivity: Activity | null = null;

            // Leads table has NOT NULL on customer_id; block save if missing
            if (leadToSave.customer_id == null || leadToSave.customer_id === undefined) {
                addToast('Please select a customer for this lead.', 'error');
                return false;
            }

            const isManualStaffAssignment = (leadToSave as any).__manual_staff_assignment === true;

            // Only for manual staff assignment done by Super Admin: ensure the lead is shared with the staff's branch(es)
            if (isManualStaffAssignment && currentUser.role === 'Super Admin' && leadToSave.assigned_to && leadToSave.assigned_to.length > 0) {
                const currentBranchIds = new Set(leadToSave.branch_ids || []);
                let branchesChanged = false;

                leadToSave.assigned_to.forEach(staffMember => {
                    if (!currentBranchIds.has(staffMember.branch_id)) {
                        currentBranchIds.add(staffMember.branch_id);
                        branchesChanged = true;
                    }
                });

                if (branchesChanged) {
                    leadToSave.branch_ids = Array.from(currentBranchIds);
                    addToast('Lead shared with new branch(es) based on staff assignment.', 'success');
                }
            }

            // Remove internal-only flag before sending to DB
            if ((leadToSave as any).__manual_staff_assignment) {
                delete (leadToSave as any).__manual_staff_assignment;
            }

            const { assigned_to, assigned_suppliers, customer, ...leadForDb } = leadToSave as any;

            const isStatusChangeToPartialOnCredit =
                !isNew &&
                originalLead &&
                originalLead.status !== LeadStatus.PartialPaymentOnCredit &&
                leadToSave.status === LeadStatus.PartialPaymentOnCredit;

            if (leadToSave.hotel_stays && leadToSave.hotel_stays.length > 0) {
                const checkIn = leadToSave.hotel_stays[0].checkIn;
                const checkOut = leadToSave.hotel_stays[leadToSave.hotel_stays.length - 1].checkOut;
                leadForDb.check_in_date = (checkIn && checkIn.trim() !== '') ? checkIn : null;
                leadForDb.check_out_date = (checkOut && checkOut.trim() !== '') ? checkOut : null;
            }

            const dbData: Omit<typeof leadForDb, 'id'> & { lead_type: LeadType; priority: Priority; } = {
                ...leadForDb,
                lead_type: getLeadTypeFromStatus(leadToSave.status),
                // Respect manually selected priority when present; otherwise fall back to auto-calculation
                priority: (leadToSave.priority as Priority) || calculateLeadPriority(leadToSave as Lead),
            };

            // Sanitize potentially empty date strings to null (PostgreSQL doesn't accept empty strings for date fields)
            const sanitizeDate = (date: any): string | null => {
                if (!date || (typeof date === 'string' && date.trim() === '')) {
                    return null;
                }
                return date;
            };

            // Sanitize all date fields
            (dbData as any).travel_date = sanitizeDate(dbData.travel_date);
            dbData.check_in_date = sanitizeDate(dbData.check_in_date);
            dbData.check_out_date = sanitizeDate(dbData.check_out_date);
            (dbData as any).return_date = sanitizeDate(dbData.return_date);
            (dbData as any).passport_expiry_date = sanitizeDate((dbData as any).passport_expiry_date);
            (dbData as any).event_date = sanitizeDate((dbData as any).event_date);

            // When status is On Travel, set on_travel_since (for 24h rule on auto Feedback); when leaving On Travel, clear it
            (dbData as any).on_travel_since = leadToSave.status === LeadStatus.OnTour ? new Date().toISOString() : null;

            // Also sanitize any date fields that might be in hotel_stays
            if (dbData.hotel_stays && Array.isArray(dbData.hotel_stays)) {
                dbData.hotel_stays = dbData.hotel_stays.map((stay: any) => ({
                    ...stay,
                    checkIn: sanitizeDate(stay.checkIn),
                    checkOut: sanitizeDate(stay.checkOut),
                }));
            }

            delete (dbData as any).id;

            // Determine final branch_ids - ensure branch_id 1 is always included
            let finalBranchIds: number[];
            if (isNew) {
                // CHANGED: Set branch_ids - if branch 1 creates, only branch 1. Otherwise, creator's branch + branch 1
                if (currentUser.branch_id === 1) {
                    finalBranchIds = [1];
                } else {
                    finalBranchIds = [currentUser.branch_id, 1];
                }
                dbData.branch_ids = finalBranchIds;
            } else {
                // Ensure branch_id 1 is always included and cannot be removed
                finalBranchIds = leadToSave.branch_ids || [];
                if (!finalBranchIds.includes(1)) {
                    finalBranchIds = [...finalBranchIds, 1];
                    dbData.branch_ids = finalBranchIds;
                }
            }

            if (isNew) {
                createdActivity = { id: Date.now(), type: 'Lead Created', description: 'A new lead was created.', user: currentUser.name, timestamp: new Date().toISOString() };

                dbData.last_updated = new Date().toISOString();
                dbData.activity = [createdActivity, ...(dbData.activity || [])];

                const { data: inserted, error } = await supabase.from('leads').insert(dbData).select().single();
                if (error) { throw error; }
                newLeadData = inserted;
                leadId = (inserted as { id: number }).id;

            } else {
                leadId = leadToSave.id;
                if (!originalLead) throw new Error("Original lead not found for update.");

                // Check if branches were removed (excluding branch 1)
                const oldBranchIds = new Set(originalLead.branch_ids || []);
                const newBranchIds = new Set(finalBranchIds);
                const removedBranches = Array.from(oldBranchIds).filter((id: number) => !newBranchIds.has(id) && id !== 1); // Exclude branch 1
                const addedBranches = Array.from(newBranchIds).filter(id => !oldBranchIds.has(id));

                // When branches are added, update related itineraries to be accessible
                if (addedBranches.length > 0) {
                    // Get all itineraries linked to this lead
                    const { data: relatedItineraries } = await supabase
                        .from('itineraries')
                        .select('id, branch_id')
                        .eq('lead_id', leadId);

                    if (relatedItineraries && relatedItineraries.length > 0) {
                        // Update itineraries whose branch_id is not in the new shared branches
                        // Set them to branch 1 (which is always in the shared branches)
                        const itinerariesToUpdate = relatedItineraries.filter(
                            (it: { id: number; branch_id: number }) => !finalBranchIds.includes(it.branch_id)
                        );

                        if (itinerariesToUpdate.length > 0) {
                            const itineraryIdsToUpdate = itinerariesToUpdate.map(it => it.id);
                            await supabase
                                .from('itineraries')
                                .update({ branch_id: 1 })
                                .in('id', itineraryIdsToUpdate);
                        }
                    }
                }

                // When a branch (other than 1) is removed, delete related data for that branch
                if (removedBranches.length > 0) {
                    for (const removedBranchId of removedBranches) {
                        // Delete itineraries for this branch
                        const { data: relatedItineraries } = await supabase
                            .from('itineraries')
                            .select('id')
                            .eq('lead_id', leadId)
                            .eq('branch_id', removedBranchId);

                        if (relatedItineraries && relatedItineraries.length > 0) {
                            const itineraryIds = relatedItineraries.map(i => i.id);
                            await supabase.from('itinerary_versions').delete().in('itinerary_id', itineraryIds);
                            await supabase.from('itineraries').delete().in('id', itineraryIds);
                        }

                        // Delete invoices for this branch (invoices are linked via lead, so we check if lead is only in removed branch)
                        // Actually, invoices don't have branch_id directly, they're linked via lead.branch_ids
                        // So we'll handle invoice visibility through lead.branch_ids

                        // Remove customer access for this branch
                        const primaryCustomer = customers.find(c => c.id === leadToSave.customer_id);
                        if (primaryCustomer) {
                            const customerSharedBranches = (primaryCustomer.shared_with_branch_ids || []).filter(id => id !== removedBranchId);
                            const { addedBy, ...customerUpdateData } = {
                                ...primaryCustomer,
                                shared_with_branch_ids: customerSharedBranches
                            };
                            delete (customerUpdateData as any).username;
                            await supabase.from('customers').update(customerUpdateData).eq('id', primaryCustomer.id);
                        }
                    }

                    addToast(`Access removed for branch(es): ${removedBranches.map(id => branches.find(b => b.id === id)?.name).filter(Boolean).join(', ')}`, 'success');
                }

                const description = generateUpdateDescription(originalLead, leadToSave, staff, branches);
                const checklistChanged = JSON.stringify(originalLead.confirmation_checklist) !== JSON.stringify(leadToSave.confirmation_checklist);

                savedActivity = leadToSave.activity || [];
                if (description !== 'Lead details were saved with no changes.' || checklistChanged) {
                    const summaryActivity: Activity = { id: Date.now(), type: 'Lead Updated', description, user: currentUser.name, timestamp: new Date().toISOString() };
                    savedActivity = [summaryActivity, ...savedActivity];
                }
                dbData.activity = savedActivity;
                dbData.last_updated = new Date().toISOString();

                const { error } = await supabase.from('leads').update(dbData).eq('id', leadToSave.id);
                if (error) { throw error; }

                // When a non–Super Admin changes status to Partial / On-Credit, notify Super Admins for approval and also notify the assignees.
                if (!isNew && isStatusChangeToPartialOnCredit && currentUser.role !== 'Super Admin') {
                    const summaryLabel = generateBookingId({ id: leadToSave.id, created_at: leadToSave.created_at });
                    const statusLabel = LeadStatus.PartialPaymentOnCredit;
                    const baseTitle = 'Lead moved to Partial / On-Credit';
                    const baseBody = `${currentUser.name} changed lead ${summaryLabel} status to "${statusLabel}". Approval is required to proceed.`;
                    const link = `/leads?openLead=${leadToSave.id}&tab=summary`;

                    try {
                        const { data: superAdmins } = await supabase.from('staff').select('id').eq('role_id', 1);
                        if (Array.isArray(superAdmins)) {
                            for (const sa of superAdmins) {
                                await supabase.from('notifications').insert({
                                    staff_id: sa.id,
                                    type: 'leave_pending_reminder', // closest existing generic type
                                    title: baseTitle,
                                    body: baseBody,
                                    link,
                                });
                            }
                        }

                        const assigneeIds = (assigned_to || []).map(s => s.id).filter(id => id !== currentUser.id);
                        if (assigneeIds.length > 0) {
                            for (const staffId of assigneeIds) {
                                await supabase.from('notifications').insert({
                                    staff_id: staffId,
                                    type: 'leave_pending_reminder',
                                    title: baseTitle,
                                    body: `${currentUser.name} changed this lead to "${statusLabel}". Waiting for approval to proceed.`,
                                    link,
                                });
                            }
                        }
                    } catch (e) {
                        console.warn('Failed to send Partial / On-Credit status notifications:', (e as any)?.message);
                    }
                }
            }

            // CHANGED: Auto-add creator as secondary assignee if not already assigned (for new leads)
            let finalAssignees = assigned_to || [];
            if (isNew && !finalAssignees.some(s => s.id === currentUser.id)) {
                finalAssignees = [...finalAssignees, currentUser as any];
            }

            // Auto-add anyone mentioned in any note as an assignee ONLY when creating a new lead.
            // For existing leads, respect manual unassignment in the UI and do not silently re-add
            // staff just because they were mentioned in past notes.
            if (isNew) {
                const mentionedIds = new Set<number>();
                (leadToSave.notes || []).forEach(note => {
                    (note.mentions || []).forEach((m: { id: number }) => mentionedIds.add(m.id));
                });
                const existingAssigneeIds = new Set(finalAssignees.map(s => s.id));
                staff.forEach(s => {
                    if (mentionedIds.has(s.id) && !existingAssigneeIds.has(s.id)) {
                        finalAssignees = [...finalAssignees, s];
                        existingAssigneeIds.add(s.id);
                    }
                });
            }

            // Deduplicate assignees to prevent duplicate key errors
            const uniqueAssignees = Array.from(
                new Map((finalAssignees as any[]).map(s => [s.id, s])).values()
            );

            await supabase.from('lead_assignees').delete().eq('lead_id', leadId);
            if (uniqueAssignees.length > 0) {
                const assignments = uniqueAssignees.map(s => ({ lead_id: leadId, staff_id: s.id }));
                const { error: assignError } = await supabase.from('lead_assignees').insert(assignments);
                if (assignError) { throw assignError; }
            }

            await supabase.from('lead_suppliers').delete().eq('lead_id', leadId);
            if (assigned_suppliers && assigned_suppliers.length > 0) {
                const supplierAssignments = assigned_suppliers.map(s => ({ lead_id: leadId, supplier_id: s.id }));
                const { error: supplierAssignError } = await supabase.from('lead_suppliers').insert(supplierAssignments);
                if (supplierAssignError) { throw supplierAssignError; }
            }

            // Sync customer's shared_with_branch_ids with lead's branch_ids (excluding customer's owner branch)
            const primaryCustomer = customers.find(c => c.id === leadToSave.customer_id);
            if (primaryCustomer) {
                const customerOwnerBranch = primaryCustomer.added_by_branch_id;
                const leadBranchIds = finalBranchIds;

                // Include all lead branch_ids in customer's shared_with_branch_ids (except owner branch)
                const customerSharedBranches = leadBranchIds.filter(id => id !== customerOwnerBranch);
                const currentCustomerShared = new Set(primaryCustomer.shared_with_branch_ids || []);
                const newCustomerShared = new Set(customerSharedBranches);

                // Check if customer sharing needs update
                const needsCustomerUpdate =
                    customerSharedBranches.length !== currentCustomerShared.size ||
                    customerSharedBranches.some(id => !currentCustomerShared.has(id));

                if (needsCustomerUpdate) {
                    const { addedBy, ...customerUpdateData } = {
                        ...primaryCustomer,
                        shared_with_branch_ids: Array.from(newCustomerShared)
                    };
                    delete (customerUpdateData as any).username;
                    const { error } = await supabase.from('customers').update(customerUpdateData).eq('id', primaryCustomer.id);
                    if (error) {
                        addToast(`Lead saved, but customer sharing failed: ${error.message}`, 'error');
                    }
                }
            }

            // Notify mentioned staff when notes contain @mentions (so they get a clickable notification that opens this lead)
            const notesWithMentions = leadToSave.notes || [];
            const originalNotesMap = new Map<number, Note>((originalLead?.notes || []).map((n: Note) => [n.id, n]));
            const mtsLabel = generateBookingId({ id: leadId, created_at: leadToSave.created_at });
            for (const note of notesWithMentions) {
                const mentions = (note as Note).mentions || [];
                if (!mentions.length) continue;
                const messageText = note.text.length > 80 ? note.text.slice(0, 77) + '...' : note.text;
                const prevNote = originalNotesMap.get((note as Note).id);
                const prevMentionIds = new Set((prevNote?.mentions || []).map((m: { id: number }) => m.id));
                for (const mention of mentions) {
                    if (mention.id === currentUser.id) continue;
                    if (prevMentionIds.has(mention.id)) continue;
                    await supabase.from('notifications').insert({
                        staff_id: mention.id,
                        type: 'lead_note_mention',
                        title: 'You were mentioned in a lead note',
                        message: `${currentUser.name} mentioned you on lead ${mtsLabel}: "${messageText}"`,
                        timestamp: new Date().toISOString(),
                        link: `/leads?openLead=${leadId}&tab=notes`,
                    });
                }
            }

            // Update list and panel immediately so the Lead's page reflects the change without refresh (like HubSpot/Zoho)
            const lastUpdated = new Date().toISOString();
            const savedLead: Lead = {
                ...leadToSave,
                id: leadId,
                last_updated: lastUpdated,
                assigned_to: uniqueAssignees as any,
                assigned_suppliers: (assigned_suppliers || []) as any,
                ...(isNew && createdActivity && newLeadData
                    ? { created_at: newLeadData.created_at ?? lastUpdated, activity: [createdActivity, ...(leadToSave.activity || [])] }
                    : { activity: savedActivity }),
            };
            if (isNew) {
                addLeadInPlace(savedLead);
            } else {
                updateLeadInPlace(savedLead);
            }
            setSelectedLead(savedLead);

            addToast(isNew ? 'New lead created successfully.' : 'Lead updated successfully.', 'success');
            return true;
        } catch (error: any) {
            console.error("Failed to save lead:", error);
            const isPoolTimeout = error?.code === 'PGRST003' || (error?.message && /connection pool|Timed out acquiring/.test(error.message));
            const message = isPoolTimeout
                ? 'Server is busy. Please try again in a moment.'
                : `Error saving lead: ${error?.message || 'Unknown error'}`;
            addToast(message, 'error');
            return false;
        }
    };

    const generateCustomerUpdateDescription = (original: Customer, updated: Partial<Customer>): string | null => {
        const changes: string[] = [];
        const simpleFields: (keyof Customer)[] = [
            'salutation', 'first_name', 'last_name', 'email', 'phone', 'company', 'nationality',
            'date_of_birth', 'passport_number', 'aadhaar_number', 'pan_number', 'place_of_birth',
            'passport_issue_date', 'passport_expiry_date'
        ];

        simpleFields.forEach(field => {
            const originalValue = original[field] || '';
            const updatedValue = updated[field] || '';
            if (String(originalValue) !== String(updatedValue)) {
                const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                changes.push(`updated ${fieldName}`);
            }
        });

        const originalAddress = original.address || {};
        const updatedAddress = updated.address || {};
        const addressFields: (keyof Address)[] = ['street', 'city', 'state', 'zip', 'country'];
        let addressChanged = false;
        addressFields.forEach(field => {
            if ((originalAddress[field] || '') !== (updatedAddress[field] || '')) {
                addressChanged = true;
            }
        });
        if (addressChanged) {
            changes.push('updated the address');
        }

        if (changes.length === 0) return null;

        if (changes.length > 3) {
            return `Updated ${changes.slice(0, 2).join(', ')}, and ${changes.length - 2} other fields.`;
        }

        return changes.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ') + '.';
    };

    const handleUpdateCustomer = async (customerToUpdate: Customer, avatarFile: File | null, options?: { closePanel?: boolean }): Promise<boolean> => {
        const originalCustomer = customers.find(c => c.id === customerToUpdate.id);
        const newActivityLog: Activity[] = [...(customerToUpdate.activity || [])];

        if (originalCustomer) {
            const activityDescription = generateCustomerUpdateDescription(originalCustomer, customerToUpdate);
            if (activityDescription) {
                const newActivity: Activity = {
                    id: Date.now(),
                    type: 'Profile Updated',
                    description: activityDescription,
                    user: currentUser.name,
                    timestamp: new Date().toISOString(),
                };
                newActivityLog.unshift(newActivity);
            }
        }

        if (avatarFile) {
            const avatarActivity: Activity = {
                id: Date.now() + 1,
                type: 'Profile Updated',
                description: 'Updated the profile picture.',
                user: currentUser.name,
                timestamp: new Date().toISOString(),
            };
            newActivityLog.unshift(avatarActivity);
        }

        const { addedBy, ...updateData } = { ...customerToUpdate, activity: newActivityLog };

        // Do not update username (unique constraint); set only at creation
        delete (updateData as any).username;

        // Sanitize potentially empty date strings to null
        updateData.date_of_birth = updateData.date_of_birth || null;
        updateData.passport_issue_date = updateData.passport_issue_date || null;
        updateData.passport_expiry_date = updateData.passport_expiry_date || null;

        if (avatarFile) {
            try {
                const filePath = `public/customer-avatars/${customerToUpdate.id}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                updateData.avatar_url = `${urlData.publicUrl}?t=${new Date().getTime()}`;
            } catch (e: any) {
                addToast(`Avatar upload failed: ${e.message}`, 'error');
            }
        }

        const { error } = await supabase.from('customers').update(updateData).eq('id', customerToUpdate.id);
        if (error) {
            addToast(`Error updating customer: ${error.message}`, 'error');
            return false;
        } else {
            await refreshData();
            return true;
        }
    };

    const handleSaveCustomer = async (customerToSave: Customer, avatarFile: File | null): Promise<Customer | void> => {
        const generateUsername = (name: string) => {
            const base = (name || 'customer').toLowerCase().replace(/\s+/g, '');
            const suffix = Math.random().toString(36).slice(-4);
            return `@${base}_${suffix}`;
        };
        const { addedBy, ...customerData } = customerToSave;
        const newCustomer = {
            ...customerData,
            username: generateUsername(customerToSave.first_name),
            avatar_url: getDefaultAvatarUrl('New Customer', 128),
            added_by_id: currentUser?.id,
            date_added: new Date().toISOString(),
            added_by_branch_id: currentUser?.branch_id,
        };

        // Sanitize potentially empty date strings to null
        newCustomer.date_of_birth = newCustomer.date_of_birth || null;
        newCustomer.passport_issue_date = newCustomer.passport_issue_date || null;
        newCustomer.passport_expiry_date = newCustomer.passport_expiry_date || null;

        const { data, error } = await supabase.from('customers').insert(newCustomer).select().single();
        if (error) {
            addToast(`Error creating customer: ${error.message}`, 'error');
            return;
        }

        let savedCustomer = data as Customer;

        if (avatarFile) {
            try {
                const filePath = `public/customer-avatars/${savedCustomer.id}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                const finalAvatarUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;

                const { data: updatedData, error: updateError } = await supabase.from('customers').update({ avatar_url: finalAvatarUrl }).eq('id', savedCustomer.id).select().single();
                if (updateError) throw updateError;
                savedCustomer = updatedData as Customer;
                addToast('New customer with profile picture created successfully.', 'success');
            } catch (uploadError: any) {
                addToast(`Customer created, but avatar upload failed: ${uploadError.message}`, 'error');
            }
        } else {
            addToast('New customer created successfully.', 'success');
        }

        await refreshData();
        return savedCustomer;
    };

    const handleFilterChange = (filterType: 'staffIds' | 'branchIds' | 'statuses' | 'leadTypes' | 'services', value: number | LeadStatus | LeadType | Service) => {
        setFilters(prev => {
            const currentValues = prev[filterType] as (number | LeadStatus | LeadType | Service)[];
            const newValues = currentValues.includes(value as any)
                ? currentValues.filter(v => v !== value)
                : [...currentValues, value];
            return { ...prev, [filterType]: newValues };
        });
    };

    const handleSourceDestinationFilter = (filterType: 'sources' | 'destinations', value: string) => {
        setFilters(prev => {
            const current = prev[filterType];
            const newValues = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
            return { ...prev, [filterType]: newValues };
        });
    };

    const leadSourcesInLeads = useMemo(() => {
        const set = new Set<string>();
        leads.forEach(l => {
            const raw = (l.source || '').toString().toLowerCase();
            const norm = raw === 'whatsapp' ? LeadSource.WhatsApp : (Object.values(LeadSource).includes(l.source as LeadSource) ? l.source : raw);
            if (norm) set.add(norm as string);
        });
        return Array.from(set).sort((a, b) => (LeadSourceDisplay[a as LeadSource] || a).localeCompare(LeadSourceDisplay[b as LeadSource] || b));
    }, [leads]);

    const destinationOptionsFromAllDestinations = useMemo(() => {
        const leadDestinationSet = new Set(leads.map(l => (l.destination || '').trim()).filter(Boolean));
        return (destinations || [])
            .filter(d => d.name?.trim() && leadDestinationSet.has(d.name.trim()))
            .map(d => d.name)
            .sort((a, b) => a.localeCompare(b));
    }, [destinations, leads]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refreshData();
        addToast('Leads refreshed.', 'success');
        setIsRefreshing(false);
    };

    const handleDeleteSelected = async () => {
        if (selectedLeadIds.length === 0) return;

        // Close the confirmation popup immediately for a snappier UX.
        setShowDeleteConfirm(false);

        try {
            // Prefer optimized server-side cascade delete via RPC if available
            const { error: rpcError } = await supabase.rpc('delete_leads_cascade', {
                lead_ids: selectedLeadIds
            });

            if (!rpcError) {
                addToast(`${selectedLeadIds.length} lead(s) and associated data deleted successfully.`, 'success');
                // Ensure UI reflects deletions immediately even if Realtime doesn't fire for RPC
                await refreshData();
                setSelectedLeadIds([]);
                return;
            }

            // Fallback to existing client-side cascade logic if RPC is not available
            const { data: blockingInvoices, error: checkInvoicesError } = await supabase
                .from('invoices')
                .select('id, lead_id, invoice_number, status')
                .in('lead_id', selectedLeadIds)
                .in('status', ['PARTIALLY PAID', 'PAID']);

            if (checkInvoicesError) throw checkInvoicesError;

            if (blockingInvoices.length > 0) {
                const leadId = blockingInvoices[0].lead_id;
                addToast(
                    `Cannot delete lead #${leadId}. It has a paid/partially paid invoice (${blockingInvoices[0].invoice_number}). Please handle the invoice first.`,
                    'error'
                );
                setShowDeleteConfirm(false);
                return;
            }

            await supabase.from('payments').delete().in('lead_id', selectedLeadIds);
            await supabase.from('invoices').delete().in('lead_id', selectedLeadIds);

            const { data: relatedItineraries, error: fetchItinerariesError } = await supabase
                .from('itineraries')
                .select('id')
                .in('lead_id', selectedLeadIds);

            if (fetchItinerariesError) throw fetchItinerariesError;

            const itineraryIdsToDelete = relatedItineraries.map(i => i.id);

            if (itineraryIdsToDelete.length > 0) {
                await supabase.from('itinerary_versions').delete().in('itinerary_id', itineraryIdsToDelete);
            }

            await supabase.from('itineraries').delete().in('lead_id', selectedLeadIds);
            await supabase.from('lead_assignees').delete().in('lead_id', selectedLeadIds);
            await supabase.from('lead_suppliers').delete().in('lead_id', selectedLeadIds);

            const { error: leadsError } = await supabase.from('leads').delete().in('id', selectedLeadIds);
            if (leadsError) throw leadsError;

            addToast(`${selectedLeadIds.length} lead(s) and associated data deleted successfully.`, 'success');
            setSelectedLeadIds([]);
        } catch (error: any) {
            let friendlyMessage = error.message;
            if (error.message.includes('violates foreign key constraint')) {
                const constraint = error.message.match(/"(.*?)"/);
                friendlyMessage = `Deletion failed due to a database relationship (${constraint ? constraint[1] : 'unknown'}). Please check for linked data that could not be automatically removed.`;
            }
            addToast(`Error deleting leads: ${friendlyMessage}`, 'error');
        }
    };

    if (!currentUser) return null;

    return (
        <div className="flex flex-col w-full min-w-0">
            <div className="flex flex-col min-w-0 w-full">
                <div className="w-full bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                        <h1 className="text-lg sm:text-xl font-bold text-slate-800 truncate">{page}</h1>
                        <div className="flex flex-wrap items-center gap-2">
                            {selectedLeadIds.length > 0 ? (
                                isPrivilegedUser && (
                                    <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-[5px] hover:bg-red-700">
                                        <IconTrash className="w-4 h-4" />
                                        Delete ({selectedLeadIds.length})
                                    </button>
                                )
                            ) : (
                                <>
                                    <div className="relative flex-1 sm:flex-none min-w-0 sm:w-64">
                                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 shrink-0" />
                                        <input
                                            type="text"
                                            placeholder="Search by customer, phone, MTS ID..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="pl-10 pr-4 py-2 w-full sm:w-64 text-sm bg-white border text-slate-900 border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="relative">
                                        <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="p-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                                            <IconFilter className="w-5 h-5" />
                                        </button>
                                        {isFilterOpen && (
                                            <div ref={filterRef} className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-white rounded-md shadow-lg border z-10 p-4 max-h-[85vh] overflow-y-auto">
                                                <h3 className="text-sm font-semibold mb-3 text-black">Filter Options</h3>
                                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-600 mb-2">By Lead Type</label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {Object.values(LeadType).map(type => (
                                                                <label key={type} className="flex items-center text-sm">
                                                                    <input type="checkbox" checked={filters.leadTypes.includes(type)} onChange={() => handleFilterChange('leadTypes', type)} className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white" />
                                                                    <span className="ml-2 text-slate-700">{type}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <hr />
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-600 mb-2">By Status</label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {Object.values(LeadStatus).map(status => (
                                                                <label key={status} className="flex items-center text-sm">
                                                                    <input type="checkbox" checked={filters.statuses.includes(status)} onChange={() => handleFilterChange('statuses', status)} className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white" />
                                                                    <span className="ml-2 text-slate-700">{status}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <hr />
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-600 mb-2">By Services</label>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {Object.values(Service).map(service => (
                                                                <label key={service} className="flex items-center text-sm">
                                                                    <input type="checkbox" checked={filters.services.includes(service)} onChange={() => handleFilterChange('services', service)} className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white" />
                                                                    <span className="ml-2 text-slate-700">{service}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <hr />
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-600 mb-2">By Lead Source</label>
                                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                                            {leadSourcesInLeads.length === 0 ? (
                                                                <p className="text-xs text-slate-500">No sources in leads</p>
                                                            ) : (
                                                                leadSourcesInLeads.map(source => (
                                                                    <label key={source} className="flex items-center text-sm">
                                                                        <input type="checkbox" checked={filters.sources.includes(source)} onChange={() => handleSourceDestinationFilter('sources', source)} className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white" />
                                                                        <span className="ml-2 text-slate-700">{LeadSourceDisplay[source as LeadSource] || source}</span>
                                                                    </label>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                    <hr />
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-600 mb-2">By Destination</label>
                                                        <div className="space-y-1 max-h-32 overflow-y-auto">
                                                            {destinationOptionsFromAllDestinations.length === 0 ? (
                                                                <p className="text-xs text-slate-500">No destinations with leads</p>
                                                            ) : (
                                                                destinationOptionsFromAllDestinations.map(dest => (
                                                                    <label key={dest} className="flex items-center text-sm">
                                                                        <input type="checkbox" checked={filters.destinations.includes(dest)} onChange={() => handleSourceDestinationFilter('destinations', dest)} className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white" />
                                                                        <span className="ml-2 text-slate-700 truncate" title={dest}>{dest}</span>
                                                                    </label>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                    <hr />
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-600 mb-2">By Assigned Staff</label>
                                                        <div className="space-y-1">
                                                            <label className="flex items-center text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={filters.showUnassigned}
                                                                    onChange={(e) => setFilters(prev => ({ ...prev, showUnassigned: e.target.checked }))}
                                                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white"
                                                                />
                                                                <span className="ml-2 text-slate-700 font-medium">Unassigned Leads</span>
                                                            </label>
                                                            {staff.map(s => (
                                                                <label key={s.id} className="flex items-center text-sm">
                                                                    <input type="checkbox" checked={filters.staffIds.includes(s.id)} onChange={() => handleFilterChange('staffIds', s.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white" />
                                                                    <img src={s.avatar_url} className="w-6 h-6 rounded-full ml-2 mr-1.5" />
                                                                    <span className="text-slate-700">{s.name}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {currentUser.role === 'Super Admin' && <>
                                                        <hr />
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-2">By Branch</label>
                                                            <div className="space-y-1">
                                                                {branches.map(branch => (
                                                                    <label key={branch.id} className="flex items-center text-sm">
                                                                        <input type="checkbox" checked={filters.branchIds.includes(branch.id)} onChange={() => handleFilterChange('branchIds', branch.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white" />
                                                                        <span className="ml-2 text-slate-700">{branch.name}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleRefresh}
                                        disabled={isRefreshing}
                                        className="p-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
                                        title="Refresh Leads"
                                    >
                                        <IconRefresh className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                    </button>
                                    <button onClick={handleAddNew} className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c] shrink-0" aria-label="New Lead">
                                        <IconPlus className="w-4 h-4" />
                                        New Lead
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col w-full border-t border-slate-200 px-4 sm:px-6 py-2">
                        <div className="-mx-4 sm:-mx-6">
                            {isDataLoading ?
                                <TableSkeleton /> :
                                <LeadsTable
                                    leads={paginatedLeads}
                                    customers={customerMap}
                                    onSelectLead={handleSelectLead}
                                    onSort={handleSort}
                                    sortConfig={sortConfig}
                                    selectedLeadIds={selectedLeadIds}
                                    onSelectionChange={setSelectedLeadIds}
                                    isHQ={isHQ}
                                    loadingMore={leadsLoadingMore && paginatedLeads.length === 0 && currentPage > 1}
                                />
                            }
                        </div>
                        {!isDataLoading && <Pagination currentPage={currentPage} totalItems={totalLeadCount > 0 ? totalLeadCount : filteredLeads.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />}
                    </div>
                </div>
                {/* Mobile: floating New Lead button (desktop uses toolbar button) */}
                <button
                    onClick={handleAddNew}
                    className="fixed bottom-5 right-5 z-20 w-14 h-14 flex sm:hidden items-center justify-center rounded-full bg-[#191974] text-white shadow-lg hover:bg-[#13135c] active:scale-95 transition-transform touch-manipulation"
                    aria-label="New Lead"
                >
                    <IconPlus className="w-7 h-7" />
                </button>
            </div>
            {isPanelOpen && <LeadDetailPanel lead={selectedLead} initialTab={initialLeadTab} onClearInitialTab={() => setInitialLeadTab(null)} onSave={handleSaveLead} onClose={handleClosePanel} customers={customers} leads={leads} onSaveCustomer={handleSaveCustomer} onUpdateCustomer={handleUpdateCustomer} itineraries={itineraries} currentUser={currentUser} staff={staff} suppliers={suppliers} branches={branches} invoices={invoices} onNavigate={navigate} refreshData={refreshData} onSelectLead={handleSelectLead} />}
            {showDeleteConfirm && (
                <ConfirmationModal
                    title="Confirm Deletion"
                    message={`Are you sure you want to delete ${selectedLeadIds.length} lead(s)? This action cannot be undone.`}
                    onConfirm={handleDeleteSelected}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </div>
    );
};

const SKELETON_ROW_COUNT = 15;

const TableSkeleton: React.FC = () => {
    return (
        <div className="overflow-x-auto sm:overflow-x-visible min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex items-center gap-2 px-2 sm:px-4 py-2 text-slate-500 text-sm">
                <span className="inline-block w-3 h-3 rounded-full bg-slate-300 animate-pulse" aria-hidden />
                Loading leads…
            </div>
            <table className="w-full text-sm table-fixed">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                    <tr>
                        <th className="p-2 sm:p-4 w-4 sm:w-10"><div className="h-4 w-4 bg-slate-200 rounded"></div></th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded w-24"></div></th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded w-32"></div></th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded w-20"></div></th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded w-24"></div></th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded w-16"></div></th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded w-20"></div></th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded w-24"></div></th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded w-24"></div></th>
                    </tr>
                </thead>
                <tbody className="animate-pulse">
                    {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
                        <tr key={i} className="border-b border-slate-100">
                            <td className="p-2 sm:p-4 w-4 sm:w-10"><div className="h-4 w-4 bg-slate-200 rounded"></div></td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded"></div></td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded"></div></td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded"></div></td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded"></div></td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded"></div></td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded"></div></td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-8 w-8 bg-slate-200 rounded-full"></div></td>
                            <td className="px-2 sm:px-4 py-2 sm:py-3"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const ServiceBadges: React.FC<{ services: Service[] }> = ({ services = [] }) => {
    const MAX_BADGES = 2;
    const displayedServices = services.slice(0, MAX_BADGES);
    const remainingCount = services.length - MAX_BADGES;
    const allServicesTooltip = services.join(', ');

    return (
        <div className="flex flex-wrap gap-1 items-center">
            {displayedServices.map(service => (
                <span key={service} className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-600">
                    {service}
                </span>
            ))}
            {remainingCount > 0 && (
                <div className="relative group">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-200 text-slate-700 cursor-pointer">
                        +{remainingCount}
                    </span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs text-white bg-slate-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                        {allServicesTooltip}
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                    </div>
                </div>
            )}
        </div>
    );
};


const LeadsTable: React.FC<{ leads: Lead[], customers: Map<number, Customer>, onSelectLead: (lead: Lead) => void, onSort: (key: SortableKeys) => void, sortConfig: SortConfig, selectedLeadIds: number[], onSelectionChange: (ids: number[]) => void, isHQ: boolean, loadingMore?: boolean }> = ({ leads, customers, onSelectLead, onSort, sortConfig, selectedLeadIds, onSelectionChange, isHQ, loadingMore }) => {
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            onSelectionChange(leads.map(l => l.id));
        } else {
            onSelectionChange([]);
        }
    };

    const handleSelectOne = (leadId: number) => {
        if (selectedLeadIds.includes(leadId)) {
            onSelectionChange(selectedLeadIds.filter(id => id !== leadId));
        } else {
            onSelectionChange([...selectedLeadIds, leadId]);
        }
    };

    const SortableHeader: React.FC<{ label: string, sortKey: SortableKeys, align?: 'left' | 'center' }> = ({ label, sortKey, align = 'left' }) => (
        <th className={`px-2 sm:px-4 py-2 sm:py-3 cursor-pointer whitespace-nowrap ${align === 'center' ? 'text-center' : ''}`} onClick={() => onSort(sortKey)}>
            <div className={`flex items-center gap-1 sm:gap-2 ${align === 'center' ? 'justify-center' : ''}`}>
                <span className="text-xs">{label}</span>
                <SortIcon direction={sortConfig?.key === sortKey ? sortConfig.direction : null} />
            </div>
        </th>
    );
    return (
        <div className="overflow-x-auto sm:overflow-x-visible overflow-y-visible min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="hidden sm:block">
                <table className="w-full text-sm text-left text-slate-500 table-fixed">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                    <tr>
                        <th className="p-2 sm:p-4 w-4 sm:w-10">
                            <input type="checkbox" onChange={handleSelectAll} checked={leads.length > 0 && selectedLeadIds.length === leads.length} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        </th>
                        <SortableHeader label="Lead Added date" sortKey="created_at" />
                        <th className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">Booking ID</th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">Customer</th>
                        <SortableHeader label="Destination" sortKey="destination" />
                        <SortableHeader label="Travel Date" sortKey="travel_date" />
                        <SortableHeader label="Priority" sortKey="priority" align="center" />
                        <th className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center">Status</th>
                        <th className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-center">Assigned Staff</th>
                    </tr>
                </thead>
                <tbody>
                    {loadingMore ? (
                        <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-500">Loading more leads…</td></tr>
                    ) : (
                    leads.map(lead => {
                        const customer = customers.get(lead.customer_id);
                        const isAssigningStaff = lead.current_staff_name === 'Assigning...' && lead.assigned_to.length === 0;

                        return (
                            <tr key={lead.id} onClick={() => onSelectLead(lead)} className="bg-white border-b hover:bg-slate-50 cursor-pointer">
                                <td className="p-2 sm:p-4 w-4 sm:w-10">
                                    <input type="checkbox" checked={selectedLeadIds.includes(lead.id)} onChange={() => handleSelectOne(lead.id)} onClick={e => e.stopPropagation()} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                </td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">{new Date(lead.created_at).toLocaleDateString()}</td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap font-mono text-xs text-slate-600">{generateBookingId(lead)}</td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 min-w-0">
                                    <div className="font-semibold text-slate-800 truncate max-w-[120px] sm:max-w-none">{customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown'}</div>
                                    <div className="text-xs text-slate-500 truncate max-w-[120px] sm:max-w-none">{customer?.phone}</div>
                                </td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 min-w-0 max-w-[100px] sm:max-w-none truncate" title={lead.destination}>{lead.destination}</td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap">{lead.travel_date && new Date(lead.travel_date).getFullYear() > 1970 ? new Date(lead.travel_date).toLocaleDateString() : 'N/A'}</td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><PriorityBadge priority={lead.priority} /></td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><StatusBadge status={lead.status} /></td>
                                <td className="px-2 sm:px-4 py-2 sm:py-3 text-center"><AssignedToAvatars assignees={lead.assigned_to} isLoading={isAssigningStaff} /></td>
                            </tr>
                        );
                    })
                    )}
                </tbody>
                </table>
            </div>

            {/* Mobile view: card rows */}
            <div className="block sm:hidden">
                {loadingMore ? (
                    <div className="text-center py-6 text-slate-500">Loading more leads…</div>
                ) : leads.length === 0 ? (
                    <div className="text-center py-6 text-slate-500">No leads found.</div>
                ) : (
                    leads.map(lead => {
                        const customer = customers.get(lead.customer_id);
                        const isAssigningStaff = lead.current_staff_name === 'Assigning...' && lead.assigned_to.length === 0;
                        return (
                            <div key={lead.id} className="bg-white border-b hover:bg-slate-50 cursor-pointer p-3" onClick={() => onSelectLead(lead)}>
                                <div className="flex gap-3">
                                    <div className="flex-shrink-0 pt-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedLeadIds.includes(lead.id)}
                                            onChange={(e) => { e.stopPropagation(); handleSelectOne(lead.id); }}
                                            onClick={e => e.stopPropagation()}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="font-semibold text-slate-800 text-sm truncate">{customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown'}</div>
                                                <div className="text-[12px] text-slate-500 truncate">{customer?.phone}</div>
                                                <div className="text-[12px] text-slate-500 mt-1 truncate">{generateBookingId(lead)} • {lead.destination}</div>
                                            </div>
                                            <div className="flex-shrink-0 text-right ml-2">
                                                <div className="text-[12px] text-slate-500">{lead.travel_date && new Date(lead.travel_date).getFullYear() > 1970 ? new Date(lead.travel_date).toLocaleDateString() : 'N/A'}</div>
                                                <div className="mt-2 flex items-center justify-end gap-2">
                                                    <div><PriorityBadge priority={lead.priority} /></div>
                                                    <div><StatusBadge status={lead.status} /></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="text-[12px] text-slate-500">Destination: <span className="text-slate-700">{lead.destination}</span></div>
                                            <div className="flex items-center gap-2">
                                                <AssignedToAvatars assignees={lead.assigned_to} isLoading={isAssigningStaff} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

const ActivityTimeline: React.FC<{ activities: Activity[] }> = ({ activities }) => {
    const formatDate = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    };
    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    return (
        <div className="relative pb-4">
            <div className="absolute left-3 sm:left-4 top-1 h-full w-px bg-slate-200" aria-hidden="true"></div>
            {(activities || []).map(activity => (
                <div key={activity.id} className="relative pl-8 sm:pl-12 pb-6 sm:pb-8">
                    <div className="absolute left-3 sm:left-4 top-1 -translate-x-1/2 rounded-full bg-white p-1 border border-slate-300 shrink-0">
                        <IconChatBubble className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
                        <div className="shrink-0 w-full sm:w-24 text-xs text-slate-500 text-left sm:text-left">
                            <p>{formatDate(activity.timestamp)} {formatTime(activity.timestamp)}</p>
                        </div>
                        <div className="sm:ml-4 grow min-w-0 rounded-lg border bg-white shadow-sm p-2.5 sm:p-3">
                            <p className="font-semibold text-sm text-slate-800">{activity.type}</p>
                            <p className="text-sm text-slate-600 break-words">{activity.description}</p>
                            <p className="text-xs text-slate-500 mt-1 break-words">
                                by {activity.user}
                                {activity.details && <button className="ml-2 text-blue-600 hover:underline">{activity.details}</button>}
                            </p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const PRIORITY_TASK_COLORS: Record<TaskPriority, string> = { LOW: 'bg-slate-100 text-slate-700', MEDIUM: 'bg-blue-100 text-blue-800', HIGH: 'bg-amber-100 text-amber-800', URGENT: 'bg-red-100 text-red-800' };

const LeadTasksTab: React.FC<{
    leadId: number;
    currentUser: LoggedInUser;
    tasks: Task[];
    staff: Staff[];
    fetchTasks: (force?: boolean) => Promise<void>;
    addToast: (msg: string, type?: 'success' | 'error') => void;
    onOpenNewTask: () => void;
    onOpenTask?: (task: Task) => void;
}> = ({ leadId, currentUser, tasks, staff, fetchTasks, addToast, onOpenNewTask, onOpenTask }) => {
    const leadTasks = useMemo(() => tasks.filter(t => (t.task_leads || []).some((l: { lead_id: number }) => l.lead_id === leadId)), [tasks, leadId]);

    const handleMarkDone = async (task: Task) => {
        const assignees = (task.task_assignees || []).map((a: { staff_id: number }) => a.staff_id);
        if (!assignees.includes(currentUser.id) || task.status === 'COMPLETED') return;
        const { error } = await supabase.from('tasks').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', task.id);
        if (error) {
            addToast('Failed to mark as done: ' + error.message, 'error');
            return;
        }
        const leadIds = (task.task_leads || []).map((l: { lead_id: number }) => l.lead_id).filter(Boolean);
        if (leadIds.length) await syncTaskEventToLeadAndCustomer(leadIds, task.title, 'completed', currentUser.name);
        addToast('Task marked as done.', 'success');
        fetchTasks(true);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700">Tasks</h3>
                <button type="button" onClick={onOpenNewTask} className="shrink-0 py-1.5 px-2.5 bg-slate-800 text-white rounded-md hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5">
                    <IconPlus className="w-3.5 h-3.5" /> New task
                </button>
            </div>
            {leadTasks.length === 0 && (
                <p className="text-xs text-slate-500 py-3">No tasks linked. Add one with &quot;New task&quot;.</p>
            )}
            <ul className="space-y-1.5">
                {leadTasks.map(task => {
                    const assignees = (task.task_assignees || []).map((a: { staff?: Staff }) => a.staff).filter(Boolean) as Staff[];
                    const isDone = task.status === 'COMPLETED';
                    const canMarkDone = !isDone && assignees.some(s => s.id === currentUser.id);
                    return (
                        <li key={task.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-slate-300 transition-colors">
                            <div className="flex -space-x-2 shrink-0">
                                {assignees.length > 0 ? assignees.slice(0, 3).map((s, i) => (
                                    s.avatar_url
                                        ? <img key={s.id} src={s.avatar_url} alt="" className="w-7 h-7 rounded-full border-2 border-white object-cover shadow-sm" style={{ zIndex: assignees.length - i }} title={s.name} />
                                        : <span key={s.id} className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600 shadow-sm" style={{ zIndex: assignees.length - i }} title={s.name}>{s.name?.charAt(0) || '?'}</span>
                                )) : (
                                    <span className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-xs text-slate-400" title="Unassigned">—</span>
                                )}
                                {assignees.length > 3 && (
                                    <span className="w-7 h-7 rounded-full border-2 border-white bg-slate-300 flex items-center justify-center text-[10px] font-medium text-slate-600" style={{ zIndex: 0 }}>+{assignees.length - 3}</span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                                {onOpenTask ? (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpenTask(task); }} className={`font-medium text-sm truncate text-left hover:underline ${isDone ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{task.title}</button>
                                ) : (
                                    <span className={`font-medium text-sm truncate ${isDone ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{task.title}</span>
                                )}
                                <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded ${PRIORITY_TASK_COLORS[task.priority]}`}>{task.priority}</span>
                                <span className="text-[11px] text-slate-400 shrink-0">
                                    {isDone && task.completed_at
                                        ? `Done ${new Date(task.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
                                        : `Due ${new Date(task.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                                </span>
                            </div>
                            {canMarkDone && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleMarkDone(task); }}
                                    className="shrink-0 w-6 h-6 rounded-full border-2 border-slate-400 hover:border-emerald-500 hover:bg-emerald-50 flex items-center justify-center transition-colors"
                                    title="Mark as done"
                                    aria-label="Mark as done"
                                />
                            )}
                            {isDone && (
                                <span className="shrink-0 text-emerald-600" title="Completed"><IconCheckCircle className="w-5 h-5" /></span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

const ItinerarySummaryView: React.FC<{ itinerary: Itinerary; metadata: ItineraryMetadata }> = ({ itinerary, metadata }) => {
    const getFlagEmoji = (destination: string) => {
        const lowerDest = destination.toLowerCase();
        if (lowerDest.includes('paris') || lowerDest.includes('france')) return '🇫🇷';
        if (lowerDest.includes('switzerland')) return '🇨🇭';
        if (lowerDest.includes('lucerne')) return '🇨🇭';
        if (lowerDest.includes('milan') || lowerDest.includes('pisa') || lowerDest.includes('rome') || lowerDest.includes('vatican') || lowerDest.includes('venice') || lowerDest.includes('italy')) return '🇮🇹';
        if (lowerDest.includes('innsbruck') || lowerDest.includes('munich') || lowerDest.includes('germany')) return '🇩🇪';
        return '';
    };

    const renderMeals = (meals: { b: boolean; l: boolean; d: boolean; }) => {
        const mealParts: React.ReactNode[] = [];
        if (meals.b) mealParts.push(<div key="b" title="Breakfast Included" className="p-1 bg-slate-100 rounded-full"><MealIcon className="w-4 h-4 text-slate-600" /></div>);
        if (meals.l) mealParts.push(<div key="l" title="Lunch Included" className="p-1 bg-slate-100 rounded-full"><MealIcon className="w-4 h-4 text-slate-600" /></div>);
        if (meals.d) mealParts.push(<div key="d" title="Dinner Included" className="p-1 bg-slate-100 rounded-full"><MealIcon className="w-4 h-4 text-slate-600" /></div>);

        if (mealParts.length === 0) return null;

        return (
            <div className="flex items-center gap-1.5 shrink-0">
                {mealParts}
            </div>
        );
    };

    return (
        <div className="bg-white text-slate-800 p-6 rounded-lg font-sans shadow-sm border">
            <h2 className="text-xl font-bold mb-6 text-slate-900 flex items-center gap-3">
                <span className="text-2xl">🗺️</span>
                <span>{metadata.creative_title}</span>
            </h2>

            <div className="relative pl-6">
                {/* Timeline line */}
                <div className="absolute left-8 top-3 h-full w-0.5 bg-slate-200" aria-hidden="true"></div>

                {itinerary.day_wise_plan.sort((a, b) => a.day - b.day).map((day, index) => (
                    <div key={day.id} className="relative mb-6">
                        {/* Day number circle */}
                        <div className="absolute left-0 top-2 w-5 h-5 bg-blue-600 rounded-full text-white flex items-center justify-center text-xs font-bold ring-8 ring-white z-10 day-timeline-circle">{index + 1}</div>

                        <div className="ml-10">
                            <div className="flex items-start justify-between mb-2 gap-4">
                                <h4 className="font-bold text-lg text-slate-800">{`Day ${index + 1}: ${day.title}`} {getFlagEmoji(day.title)}</h4>
                                {renderMeals(day.meals)}
                            </div>
                            <div
                                className="text-slate-600 prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_p]:m-0"
                                dangerouslySetInnerHTML={{ __html: day.description || '' }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
const ShareModal: React.FC<{
    lead: Lead;
    branches: Branch[];
    onSave: (branchIds: number[]) => void;
    onClose: () => void;
}> = ({ lead, branches, onSave, onClose }) => {
    const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>(lead.branch_ids || []);

    const handleToggle = (branchId: number) => {
        setSelectedBranchIds(prev =>
            prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId]
        );
    };

    const handleSave = () => {
        onSave(selectedBranchIds);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold mb-4">Share Lead with Branches</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {branches.map(branch => {
                        const isOwner = lead.branch_ids.includes(branch.id);
                        return (
                            <label key={branch.id} className={`flex items-center space-x-3 p-2 rounded-md hover:bg-slate-50 ${isOwner ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                <input
                                    type="checkbox"
                                    checked={selectedBranchIds.includes(branch.id)}
                                    onChange={() => handleToggle(branch.id)}
                                    disabled={isOwner}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-slate-700">{branch.name} {isOwner && '(Owner)'}</span>
                            </label>
                        );
                    })}
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm rounded-md bg-[#191974] text-white">Save Sharing</button>
                </div>
            </div>
        </div>
    );
};

const BookedFlightsList: React.FC<{ flights: Flight[] }> = ({ flights }) => {
    if (!flights || flights.length === 0) {
        return <p className="text-center text-slate-500 py-6">No flights booked for this lead yet.</p>;
    }

    const formatFlightTime = (dateTimeString: string) => {
        return new Date(dateTimeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    const formatFlightDate = (dateTimeString: string) => {
        return new Date(dateTimeString).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    }

    return (
        <div className="space-y-4 bg-white p-6 rounded-lg border border-slate-200">
            {flights.map((flight, index) => (
                <div key={`${flight.id}-${index}`} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-slate-800">{flight.airline} {flight.flight_no}</p>
                            <p className="text-sm text-slate-500">Date: {new Date(flight.departure_time).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-lg font-bold text-slate-900">₹{flight.price.toLocaleString('en-IN')}</p>
                            <p className="text-xs text-slate-500">Total Price</p>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-center">
                        <div>
                            <p className="font-bold text-slate-900 text-xl">{formatFlightTime(flight.departure_time)}</p>
                            <p className="text-sm text-slate-600 font-semibold">{flight.from}</p>
                        </div>
                        <div className="text-center w-32">
                            <p className="text-xs text-slate-500">{flight.duration}</p>
                            <div className="w-full h-px bg-slate-300 my-1 relative">
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                                <div className="absolute left-1/2 -translate-x-1/2 w-5 h-5 -mt-2.5 text-slate-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10.891 2.12a1.518 1.518 0 00-1.782 0l-4.5 3.25a1.5 1.5 0 00-.609 1.282V17.5a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5V6.652a1.5 1.5 0 00-.61-1.282l-4.5-3.25zM12 8.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" clipRule="evenodd" /></svg>
                                </div>
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                            </div>
                            <p className="text-xs text-slate-500">{flight.stops} stop(s)</p>
                        </div>
                        <div>
                            <p className="font-bold text-slate-900 text-xl">{formatFlightTime(flight.arrival_time)}</p>
                            <p className="text-sm text-slate-600 font-semibold">{flight.to}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

// Link Itinerary Modal Component
const LinkItineraryModal: React.FC<{
    itineraries: ItineraryMetadata[];
    onLink: (itineraryId: number) => Promise<void>;
}> = ({ itineraries, onLink }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredItineraries = useMemo(() => {
        if (!searchTerm) return itineraries;
        const term = searchTerm.toLowerCase();
        return itineraries.filter(it =>
            (it.creative_title && it.creative_title.toLowerCase().includes(term)) ||
            (it.destination && it.destination.toLowerCase().includes(term))
        );
    }, [itineraries, searchTerm]);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex-1 px-4 py-2 border-2 border-dashed border-slate-300 rounded-md text-slate-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
                <IconPlus className="w-4 h-4" /> Link Existing Itinerary
            </button>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={() => setIsOpen(false)}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">Link Existing Itinerary</h3>
                    <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <IconX className="w-5 h-5" />
                    </button>
                </div>
                <div className="mb-4">
                    <div className="relative">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search itineraries..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto mb-4">
                    {filteredItineraries.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            {searchTerm ? 'No itineraries found matching your search.' : 'No available itineraries to link.'}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredItineraries.map(itinerary => (
                                <div key={itinerary.id} className="p-3 border rounded-md hover:bg-slate-50 flex justify-between items-center">
                                    <div>
                                        <p className="font-medium text-slate-800">{itinerary.creative_title}</p>
                                        <p className="text-xs text-slate-500">{formatDurationToDays(itinerary.duration)} • {itinerary.destination || 'N/A'}</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            await onLink(itinerary.id);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                    >
                                        Link
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 border-t pt-4">
                    <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
                </div>
            </div>
        </div>
    );
};

export const LeadDetailPanel: React.FC<{
    lead: Lead | null,
    initialTab?: 'details' | 'notes' | 'tasks' | 'activity' | 'documents' | 'itinerary' | 'costing' | 'invoices' | null,
    onClearInitialTab?: () => void,
    onSave: (lead: Lead) => Promise<boolean>,
    onClose: () => void,
    customers: Customer[],
    leads: Lead[],
    onSaveCustomer: (customer: Customer, avatarFile: File | null) => Promise<Customer | void>;
    onUpdateCustomer: (customer: Customer, avatarFile: File | null, options?: { closePanel?: boolean }) => Promise<boolean>,
    itineraries: ItineraryMetadata[],
    currentUser: LoggedInUser,
    staff: Staff[],
    suppliers: Supplier[],
    branches: Branch[],
    invoices: Invoice[],
    onNavigate: (path: string) => void,
    refreshData: () => Promise<void>;
    onSelectLead?: (lead: Lead) => void;
}> = ({ lead, initialTab, onClearInitialTab, onSave, onClose, customers, leads, onSaveCustomer, onUpdateCustomer, itineraries, currentUser, staff, suppliers, branches, invoices, onNavigate, refreshData, onSelectLead }) => {
    const isNewLead = !lead;
    const { navigate } = useRouter();
    const { visas, fetchVisas, payments, fetchInvoices, tasks, fetchTasks, destinations } = useData();
    const { addToast } = useToast();
    const isHQ = currentUser.branch_id === 1;
    const defaultNewLeadState: Partial<Lead> = {
        customer_id: undefined,
        destination: '',
        starting_point: '',
        travel_date: '',
        duration: '',
        status: LeadStatus.Enquiry,
        priority: Priority.Low,
        lead_type: LeadType.Cold,
        tour_type: TourType.FAMILY,
        tour_region: undefined,
        assigned_to: [],
        assigned_suppliers: [],
        requirements: {
            adults: 2,
            children: 0,
            babies: 0,
            hotelPreference: HotelPreference.NoPreference,
            stayPreference: StayPreference.NoPreference,
            rooms: [{ id: 1, adults: 2, children: 0 }],
        },
        services: [],
        summary: '',
        notes: [],
        activity: [],
        confirmation_checklist: {},
        itinerary_ids: [],
        booked_flights: [],
        return_date: '',
        source: undefined,
        is_flexible_dates: false,
        is_return_ticket: false,
        visa_type: '',
        visa_duration: '',
        check_in_date: '',
        check_out_date: '',
        budget: undefined,
        forex_currency_have: '',
        forex_currency_required: '',
        passport_service_type: undefined,
        passport_city_of_residence: '',
        hotel_stays: [],
        passport_number: '',
        passport_expiry_date: '',
        insurance_type: '',
        vehicle_type: '',
        pickup_location: '',
        dropoff_location: '',
        event_type: '',
        event_date: '',
        venue_location: '',
        attendees: 0,
        travelers: 0,
        passengers: 0,
        amount: 0,
        mice_requirements: ''
    };

    const [editedLead, setEditedLead] = useState<Partial<Lead>>(
        lead
            ? {
                ...lead,
                // Always derive lead_type from status when opening the panel
                lead_type: getLeadTypeFromStatus(lead.status),
                // Backwards compatibility: some older leads may have stored type_of_visa instead of visa_type
                visa_type: (lead as any).visa_type || (lead as any).type_of_visa || '',
            }
            : defaultNewLeadState
    );
    const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'tasks' | 'activity' | 'documents' | 'itinerary' | 'costing' | 'invoices'>('details');
    const [newNote, setNewNote] = useState('');
    const [isEditing, setIsEditing] = useState(isNewLead);
    const [isSaving, setIsSaving] = useState(false);
    const [isStaffDropdownOpen, setIsStaffDropdownOpen] = useState(false);
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const staffDropdownRef = useRef<HTMLDivElement>(null);
    const supplierDropdownRef = useRef<HTMLDivElement>(null);
    const branchDropdownRef = useRef<HTMLDivElement>(null);
    const [isCustomerPanelOpen, setIsCustomerPanelOpen] = useState(false);
    const [isNewCustomerPanelOpen, setIsNewCustomerPanelOpen] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isPanelClosing, setIsPanelClosing] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [openInvoiceId, setOpenInvoiceId] = useState<number | null>(null);
    const [openNewInvoiceDrawer, setOpenNewInvoiceDrawer] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState<number | null>(null);
    const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
    const [isTaskDrawerClosing, setIsTaskDrawerClosing] = useState(false);
    const [initialLeadIdsForTask, setInitialLeadIdsForTask] = useState<number[]>([]);
    const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
    const [isTaskPanelEditing, setIsTaskPanelEditing] = useState(false);
    const [showAssignmentReasonPopup, setShowAssignmentReasonPopup] = useState(false);
    const [pendingStaffAssignment, setPendingStaffAssignment] = useState<Staff | null>(null);
    const [assignmentReason, setAssignmentReason] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);

    // Drawer animation effect
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        setTimeout(() => setIsPanelOpen(true), 10);
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // When opened from a mention notification (or other deep link), switch to the requested tab
    useEffect(() => {
        if (lead && initialTab) {
            setActiveTab(initialTab);
            onClearInitialTab?.();
        }
    }, [lead?.id, initialTab, onClearInitialTab]);

    const handlePanelClose = () => {
        setIsPanelClosing(true);
        setIsPanelOpen(false);
        setTimeout(() => {
            onClose();
        }, 300); // Match transition duration
    };

    const openTaskDrawer = () => {
        if (editedLead.id != null) {
            setSelectedTaskForDetail(null);
            setInitialLeadIdsForTask([editedLead.id]);
            setIsTaskPanelEditing(true);
            setIsTaskDrawerClosing(false);
            setIsTaskDrawerOpen(true);
        }
    };
    const openTaskDrawerForTask = (task: Task) => {
        setSelectedTaskForDetail(task);
        setIsTaskPanelEditing(false);
        setIsTaskDrawerClosing(false);
        setIsTaskDrawerOpen(true);
    };
    const closeTaskDrawer = () => {
        setIsTaskDrawerClosing(true);
        setTimeout(() => {
            setIsTaskDrawerOpen(false);
            setSelectedTaskForDetail(null);
            setInitialLeadIdsForTask([]);
            setIsTaskPanelEditing(false);
            setIsTaskDrawerClosing(false);
        }, 300);
    };
    const handleMarkDoneForLeadTask = useCallback(async () => {
        if (!selectedTaskForDetail?.id) return;
        const assignees = (selectedTaskForDetail.task_assignees || []).map((a: { staff_id: number }) => a.staff_id);
        if (!assignees.includes(currentUser.id) || selectedTaskForDetail.status === 'COMPLETED') return;
        const { error } = await supabase.from('tasks').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', selectedTaskForDetail.id);
        if (error) {
            addToast('Failed to mark as done: ' + error.message, 'error');
            return;
        }
        const leadIds = (selectedTaskForDetail.task_leads || []).map((l: { lead_id: number }) => l.lead_id).filter(Boolean);
        if (leadIds.length) await syncTaskEventToLeadAndCustomer(leadIds, selectedTaskForDetail.title, 'completed', currentUser.name);
        addToast('Task marked as done.', 'success');
        fetchTasks(true);
        setSelectedTaskForDetail(prev => prev ? { ...prev, status: 'COMPLETED', completed_at: new Date().toISOString() } : null);
    }, [selectedTaskForDetail, currentUser.id, currentUser.name, addToast, fetchTasks]);

    const handleUndoDoneForLeadTask = useCallback(async () => {
        if (!selectedTaskForDetail?.id) return;
        const assignees = (selectedTaskForDetail.task_assignees || []).map((a: { staff_id: number }) => a.staff_id);
        if (!assignees.includes(currentUser.id) || selectedTaskForDetail.status !== 'COMPLETED') return;
        const { error } = await supabase.from('tasks').update({ status: 'PENDING', completed_at: null }).eq('id', selectedTaskForDetail.id);
        if (error) {
            addToast('Failed to reopen task: ' + error.message, 'error');
            return;
        }
        addToast('Task reopened.', 'success');
        fetchTasks(true);
        setSelectedTaskForDetail(prev => prev ? { ...prev, status: 'PENDING', completed_at: null } : null);
    }, [selectedTaskForDetail, currentUser.id, addToast, fetchTasks]);
    const createdByStaffMap = useMemo(() => {
        const m = new Map<number, Staff>();
        staff.forEach(s => m.set(s.id, s));
        return m;
    }, [staff]);
    const handleSaveTaskFromLead = useCallback(async (payload: { title: string; description: string; status: TaskStatus; priority: TaskPriority; end_date: string; assigneeIds: number[]; leadIds: number[]; customer_id?: number | null }) => {
        const effectiveAssigneeIds = (payload.assigneeIds?.length ? payload.assigneeIds : [currentUser.id]).filter(Boolean);
        if (selectedTaskForDetail?.id) {
            const { error: taskError } = await supabase.from('tasks').update({
                title: payload.title,
                description: payload.description || null,
                status: payload.status,
                priority: payload.priority,
                end_date: payload.end_date,
                customer_id: payload.customer_id || null,
                completed_at: payload.status === 'COMPLETED' ? (selectedTaskForDetail.completed_at || new Date().toISOString()) : null,
            }).eq('id', selectedTaskForDetail.id);
            if (taskError) {
                addToast('Failed to update task: ' + taskError.message, 'error');
                return;
            }
            await supabase.from('task_assignees').delete().eq('task_id', selectedTaskForDetail.id);
            if (effectiveAssigneeIds.length) await supabase.from('task_assignees').insert(effectiveAssigneeIds.map(staff_id => ({ task_id: selectedTaskForDetail.id, staff_id })));
            await supabase.from('task_leads').delete().eq('task_id', selectedTaskForDetail.id);
            if (payload.leadIds.length) await supabase.from('task_leads').insert(payload.leadIds.map(lead_id => ({ task_id: selectedTaskForDetail.id, lead_id })));
            addToast('Task updated.', 'success');
            fetchTasks(true);
            setSelectedTaskForDetail(null);
            closeTaskDrawer();
        } else {
            const { data: newTask, error: taskError } = await supabase.from('tasks').insert({
                title: payload.title,
                description: payload.description || null,
                status: payload.status,
                priority: payload.priority,
                end_date: payload.end_date,
                created_by_staff_id: currentUser.id,
                customer_id: payload.customer_id || null,
            }).select('id').single();
            if (taskError || !newTask) {
                addToast('Failed to create task: ' + (taskError?.message || 'Unknown error'), 'error');
                return;
            }
            if (effectiveAssigneeIds.length) await supabase.from('task_assignees').insert(effectiveAssigneeIds.map(staff_id => ({ task_id: newTask.id, staff_id })));
            if (payload.leadIds.length) {
                await supabase.from('task_leads').insert(payload.leadIds.map(lead_id => ({ task_id: newTask.id, lead_id })));
                await syncTaskEventToLeadAndCustomer(payload.leadIds, payload.title, 'created', currentUser.name);
            }
            addToast('Task created.', 'success');
            fetchTasks(true);
            closeTaskDrawer();
        }
    }, [currentUser.id, addToast, fetchTasks, selectedTaskForDetail]);

    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [cameraDocType, setCameraDocType] = useState<keyof CustomerDocuments | null>(null);
    const [isWhatsappMenuOpen, setIsWhatsappMenuOpen] = useState(false);
    const whatsappMenuRef = useRef<HTMLDivElement>(null);

    const [activeItineraryId, setActiveItineraryId] = useState<number | null>(null);
    const [isMentioning, setIsMentioning] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionableStaff, setMentionableStaff] = useState<Staff[]>([]);
    const [filteredMentionStaff, setFilteredMentionStaff] = useState<Staff[]>([]);
    const [currentMentions, setCurrentMentions] = useState<{ id: number; name: string }[]>([]);

    const [editedCustomer, setEditedCustomer] = useState<Partial<Customer> | null>(null);
    const autoReturnDateRef = useRef<string | null>(null);
    const [showUnqualifiedModal, setShowUnqualifiedModal] = useState(false);
    const [unqualifiedReason, setUnqualifiedReason] = useState('');
    const [showRejectedModal, setShowRejectedModal] = useState(false);
    const [rejectedReason, setRejectedReason] = useState('');
    const [pendingStatusChange, setPendingStatusChange] = useState<LeadStatus | null>(null);
    const primaryCustomer = useMemo(() => customers.find(c => c.id === editedLead.customer_id), [editedLead.customer_id, customers]);

    // Visa state (list from context)
    const [selectedVisaForView, setSelectedVisaForView] = useState<Visa | null>(null);
    const [isVisaDrawerOpen, setIsVisaDrawerOpen] = useState(false);
    const { session } = useAuth();

    // --- State for Customer Search Dropdown ---
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const customerDropdownRef = useRef<HTMLDivElement>(null);

    const filteredCustomersForDropdown = useMemo(() => {
        const lowerQuery = customerSearchQuery.toLowerCase();
        if (!lowerQuery) {
            return customers.slice(0, 6);
        }
        return customers.filter(c =>
            `${c.first_name} ${c.last_name}`.toLowerCase().includes(lowerQuery)
        ).slice(0, 6);
    }, [customers, customerSearchQuery]);

    const selectedCustomerName = useMemo(() => {
        return primaryCustomer ? `${primaryCustomer.first_name} ${primaryCustomer.last_name}` : '';
    }, [primaryCustomer]);



    // --- PERMISSION LOGIC ---
    const primaryAssigneeId = editedLead.assigned_to?.[0]?.id;
    const isPrimaryAssignee = currentUser.id === primaryAssigneeId;

    const isLeadAdmin = currentUser.is_lead_manager === true; // Lead Manager tag can manage all leads

    const isAdminOrManager = currentUser.role === 'Super Admin' || currentUser.role === 'Manager' || isLeadAdmin;
    const isAssigned = (editedLead.assigned_to || []).some(s => s.id === currentUser.id);
    const isUnassigned = !editedLead.assigned_to || editedLead.assigned_to.length === 0;

    // CHANGED: All users can see/interact with the dropdown, and all branches can edit assigned staff
    const canViewStaffDropdown = true; // ALL users can see the staff assignment dropdown
    const canEnterEditMode = isPrimaryAssignee || isAdminOrManager || isNewLead;
    const canContribute = canEnterEditMode;
    const canEditAssignedStaff = isEditing; // All users can edit assigned staff when in edit mode
    // CHANGED: Creator from other branches can view and add notes but not edit
    const isCreatorViewOnly = isAssigned && currentUser.branch_id !== 1;
    // --- END PERMISSION LOGIC ---


    const isForexOnly = useMemo(() => editedLead.services?.length === 1 && editedLead.services[0] === Service.ForEx, [editedLead.services]);
    const isPassportService = useMemo(() => editedLead.services?.includes(Service.Passport), [editedLead.services]);

    const showRoomDetails = useMemo(() =>
        editedLead.services?.includes(Service.Tour) || editedLead.services?.includes(Service.HotelBooking),
        [editedLead.services]
    );

    useEffect(() => {
        if (primaryCustomer) {
            setEditedCustomer(JSON.parse(JSON.stringify(primaryCustomer)));
        } else {
            setEditedCustomer(null);
        }
    }, [primaryCustomer]);

    const primaryCustomerForDisplay = isEditing ? editedCustomer : primaryCustomer;

    const isAadhaarMissing = useMemo(() => editedLead.tour_region === TourRegion.Domestic && (!primaryCustomerForDisplay?.documents?.aadhaarCards || primaryCustomerForDisplay.documents.aadhaarCards.length === 0), [editedLead.tour_region, primaryCustomerForDisplay]);
    const isPassportMissing = useMemo(() => editedLead.tour_region === TourRegion.International && (!primaryCustomerForDisplay?.documents?.passports || primaryCustomerForDisplay.documents.passports.length === 0), [editedLead.tour_region, primaryCustomerForDisplay]);

    // Fetch visas from context when lead has Visa service
    useEffect(() => {
        if (editedLead.services?.includes(Service.Visa) && session?.access_token) {
            fetchVisas();
        }
    }, [session?.access_token, editedLead.services, fetchVisas]);

    useEffect(() => {
        // When first opening an existing lead with no priority set, initialize it from auto-calculation.
        if (isEditing && !editedLead.priority) {
            const newPriority = calculateLeadPriority(editedLead as Lead);
            if (newPriority !== editedLead.priority) {
                setEditedLead(prev => ({ ...prev, priority: newPriority }));
            }
        }
    }, [editedLead.status, editedLead.travel_date, editedLead.lead_type, isEditing]);


    const leadInvoices = useMemo(() => {
        if (!lead) return [];
        const leadId = Number(lead.id);
        return (invoices || []).filter(inv => Number(inv.lead_id) === leadId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [invoices, lead]);

    const selectedInvoiceForDrawer = useMemo(() => {
        if (!openInvoiceId || !invoices) return null;
        return invoices.find(i => i.id === openInvoiceId) ?? null;
    }, [openInvoiceId, invoices]);

    const invoiceForDrawer = useMemo((): Invoice | null => {
        if (openNewInvoiceDrawer && lead) {
            return { lead_id: lead.id, customer_id: lead.customer_id } as Invoice;
        }
        return selectedInvoiceForDrawer;
    }, [openNewInvoiceDrawer, lead, selectedInvoiceForDrawer]);

    const summaryData = useMemo(() => {
        if (!activeItineraryId) return null;
        const metadata = itineraries.find(i => i.id === activeItineraryId);
        if (!metadata || !metadata.itinerary_versions || metadata.itinerary_versions.length === 0) {
            return null;
        }
        const latestVersion = [...metadata.itinerary_versions].sort((a, b) => b.version_number - a.version_number)[0];
        return { itinerary: latestVersion, metadata };
    }, [activeItineraryId, itineraries]);

    useEffect(() => {
    }, [editedLead.customer_id, customers]);

    const customerLeads = useMemo(() => {
        if (!primaryCustomer) return [];
        return leads.filter(l => l.customer_id === primaryCustomer.id);
    }, [primaryCustomer, leads]);

    const isConfirmedOrLater = useMemo(() => {
        if (!editedLead || !editedLead.status) return false;
        const confirmedIndex = Object.values(LeadStatus).indexOf(LeadStatus.Confirmed);
        const currentIndex = Object.values(LeadStatus).indexOf(editedLead.status);
        return currentIndex >= confirmedIndex;
    }, [editedLead.status]);

    const isAirTicketingOnly = useMemo(() => editedLead.services?.length === 1 && editedLead.services[0] === Service.AirTicketing, [editedLead.services]);

    // Find all itineraries linked to this specific lead (via itinerary_ids or lead_id)
    // Exclude Archived so archiving an itinerary removes it from this list
    const leadItineraries = useMemo<ItineraryMetadata[]>(() => {
        if (!lead) return [];
        // Prefer editedLead.itinerary_ids for immediate updates during editing
        const idsFromLead = (editedLead.itinerary_ids !== undefined && editedLead.itinerary_ids !== null)
            ? editedLead.itinerary_ids
            : (lead.itinerary_ids || []);
        const linkedItineraries: ItineraryMetadata[] = [];

        // Get itineraries linked via itinerary_ids (exclude Archived)
        if (idsFromLead && idsFromLead.length > 0) {
            idsFromLead.forEach(id => {
                const itinerary = itineraries.find(i => i.id === id && i.status !== ItineraryStatus.Archived);
                if (itinerary) linkedItineraries.push(itinerary);
            });
        }

        // Also check for itineraries linked via lead_id (fallback), exclude Archived
        const byLeadId = itineraries.find(i => i.lead_id === lead.id && i.status !== ItineraryStatus.Archived);
        if (byLeadId && !linkedItineraries.find(i => i.id === byLeadId.id)) {
            linkedItineraries.push(byLeadId);
        }

        return linkedItineraries;
    }, [lead, editedLead.itinerary_ids, itineraries]);

    const hasItineraryForLead = useMemo(() => {
        return leadItineraries.length > 0;
    }, [leadItineraries]);

    const showReturnDateField = useMemo(() => editedLead.services?.includes(Service.AirTicketing), [editedLead.services]);

    const durationBasedReturnDate = useMemo(
        () => calculateDurationBasedReturnDate(editedLead.travel_date, editedLead.duration),
        [editedLead.travel_date, editedLead.duration]
    );

    const hasReturnMismatch = useMemo(() => {
        if (!durationBasedReturnDate || !editedLead.return_date) return false;
        return durationBasedReturnDate !== editedLead.return_date;
    }, [durationBasedReturnDate, editedLead.return_date]);


    useEffect(() => {
        if (lead) {
            const leadData = { ...lead, lead_type: getLeadTypeFromStatus(lead.status) };

            const currentReqs = leadData.requirements;
            const rooms = (currentReqs?.rooms && currentReqs.rooms.length > 0)
                ? currentReqs.rooms
                : [{ id: 1, adults: currentReqs?.adults ?? 2, children: currentReqs?.children ?? 0 }];

            // Migrate child_ages from old format (requirements.child_ages) to first room if not already in rooms
            if (currentReqs?.child_ages && currentReqs.child_ages.length > 0 && rooms.length > 0) {
                const firstRoom = rooms[0];
                if (!firstRoom.child_ages || firstRoom.child_ages.length === 0) {
                    firstRoom.child_ages = [...currentReqs.child_ages];
                }
            }

            leadData.requirements = {
                ...currentReqs,
                adults: currentReqs?.adults ?? 2,
                children: currentReqs?.children ?? 0,
                babies: currentReqs?.babies ?? 0,
                hotelPreference: currentReqs?.hotelPreference ?? HotelPreference.NoPreference,
                stayPreference: currentReqs?.stayPreference ?? StayPreference.NoPreference,
                rooms: rooms,
            };
            leadData.return_date = lead.return_date || '';

            setEditedLead(leadData);
            autoReturnDateRef.current = leadData.return_date || null;

            // Prefer explicit itinerary_ids on the lead but gracefully fall back
            // to any itinerary that is already linked to this lead via lead_id.
            const itineraryIdFromLead = lead.itinerary_ids?.[0];
            if (itineraryIdFromLead) {
                setActiveItineraryId(itineraryIdFromLead);
            } else {
                const existingMetaForLead = itineraries.find(i => i.lead_id === lead.id);
                setActiveItineraryId(existingMetaForLead ? existingMetaForLead.id : null);
            }
        } else {
            setEditedLead(defaultNewLeadState);
            setActiveItineraryId(null);
            autoReturnDateRef.current = null;
        }

        if (isNewLead) {
            setIsEditing(true);
            setActiveTab('details');
        } else {
            setIsEditing(false);
        }
    }, [lead, isNewLead, itineraries]);

    useEffect(() => {
        if (!isEditing) return;
        if (!editedLead.is_return_ticket) return;
        if (!showReturnDateField) return;
        const autoDate = calculateAutoReturnDate(editedLead);
        if (!autoDate) return;
        setEditedLead(prev => {
            if (prev.return_date && prev.return_date !== autoReturnDateRef.current) {
                return prev;
            }
            if (prev.return_date === autoDate) {
                autoReturnDateRef.current = autoDate;
                return prev;
            }
            autoReturnDateRef.current = autoDate;
            return { ...prev, return_date: autoDate };
        });
    }, [
        editedLead.duration,
        editedLead.hotel_stays,
        editedLead.is_return_ticket,
        editedLead.travel_date,
        showReturnDateField,
        isEditing
    ]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (staffDropdownRef.current && !staffDropdownRef.current.contains(event.target as Node)) {
                setIsStaffDropdownOpen(false);
                setStaffSearchQuery('');
            }
            if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target as Node)) {
                setIsSupplierDropdownOpen(false);
            }
            if (whatsappMenuRef.current && !whatsappMenuRef.current.contains(event.target as Node)) {
                setIsWhatsappMenuOpen(false);
            }
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
                setIsCustomerDropdownOpen(false);
            }
            if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
                setIsBranchDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleFieldChange = (field: keyof Lead, value: any) => {
        const newValues: Partial<Lead> = { [field]: value };
        if (field === 'return_date') {
            autoReturnDateRef.current = null;
            // When return date is set, derive No. of days from travel_date → return_date
            const days = computeDaysFromDates(editedLead.travel_date, value);
            if (days != null) newValues.duration = String(days);
        }
        if (field === 'duration') {
            // When No. of days is set, derive return date from travel_date + (days - 1)
            const returnDate = calculateDurationBasedReturnDate(editedLead.travel_date, value);
            if (returnDate) newValues.return_date = returnDate;
        }
        if (field === 'travel_date') {
            // Keep return date in sync: new return = new travel + (days - 1)
            const returnDate = calculateDurationBasedReturnDate(value, editedLead.duration);
            if (returnDate) newValues.return_date = returnDate;
        }

        if (field === 'status') {
            // Role-based status rules: only Accountant/Super Admin can set Billing Completed & Voucher; On Travel/Feedback/Completed only after Voucher for others
            if (!canSetLeadStatus(currentUser, editedLead.status, value as LeadStatus)) {
                addToast('You do not have permission to change status to this value. Only Accountant or Super Admin can set Billing Completed; Voucher is allowed by them or by Sales/Operations when lead is already Billing Completed; On Travel, Feedback, Completed are allowed only after status is Voucher.', 'error');
                return;
            }
            // If changing to Unqualified Lead, check 48 hours restriction
            if (value === LeadStatus.Unqualified && editedLead.status !== LeadStatus.Unqualified) {
                // Check if 48 hours have passed since lead creation
                const createdAt = lead?.created_at || editedLead.created_at;
                if (createdAt && !has48HoursPassed(createdAt)) {
                    addToast('Cannot change status to "Unqualified Lead" within 48 hours of lead creation. Please try again later.', 'error');
                    return;
                }
                // If 48 hours have passed, show modal to get reason
                setPendingStatusChange(value);
                setShowUnqualifiedModal(true);
                setUnqualifiedReason('');
                return;
            }

            // If changing to Rejected, show modal to capture reason
            if (value === LeadStatus.Rejected && editedLead.status !== LeadStatus.Rejected) {
                setPendingStatusChange(value);
                setShowRejectedModal(true);
                setRejectedReason('');
                return;
            }

            // Automatically update lead_type based on status
            newValues.lead_type = getLeadTypeFromStatus(value);
            if (editedLead.status === LeadStatus.Enquiry && value !== LeadStatus.Enquiry && (editedLead.assigned_to?.length || 0) > 0) {
                addToast('Lead status updated.', 'success');
            }
        }

        // REMOVED: Automatic status change from Enquiry to Processing when staff is assigned
        // Status should be changed manually by the user, not automatically
        // if (field === 'assigned_to' && editedLead.status === LeadStatus.Enquiry && (editedLead.assigned_to?.length || 0) === 0 && value.length > 0) {
        //     newValues.status = LeadStatus.Processing;
        //     newValues.lead_type = getLeadTypeFromStatus(LeadStatus.Processing);
        //     addToast('Lead status updated to Processing.', 'success');
        // }
        if (field === 'tour_type' && value === TourType.HONEYMOON) {
            newValues.requirements = {
                ...editedLead.requirements!,
                adults: 2,
                children: 0,
                babies: 0,
                rooms: [{ id: 1, adults: 2, children: 0 }]
            };
            addToast('Passenger count set for Honeymoon Tour.', 'success');
        }

        // Auto-calculate hotel stays if travel_date or duration changes (duration = No. of days)
        if ((field === 'travel_date' || field === 'duration')) {
            if ((!editedLead.hotel_stays || editedLead.hotel_stays.length === 0)) {
                const tDate = field === 'travel_date' ? value : editedLead.travel_date;
                const durStr = field === 'duration' ? value : editedLead.duration;
                const days = parseDurationDays(durStr) || 1;
                const nights = Math.max(1, days - 1);

                if (tDate && nights > 0) {
                    const checkIn = new Date(tDate).toISOString().split('T')[0];
                    const checkOutDate = new Date(tDate);
                    checkOutDate.setDate(checkOutDate.getDate() + (days - 1));
                    const checkOut = checkOutDate.toISOString().split('T')[0];

                    const defaultStay: HotelStay = {
                        id: Date.now(),
                        hotelName: '',
                        city: editedLead.destination || '',
                        checkIn,
                        checkOut,
                        nights,
                        roomType: 'Standard',
                        mealPlan: 'CP'
                    };
                    newValues.hotel_stays = [defaultStay];
                }
            }
        }

        setEditedLead(prev => ({ ...prev, ...newValues }));
    };

    const handleUnqualifiedReasonSubmit = async () => {
        if (!unqualifiedReason.trim()) {
            addToast('Please provide a reason for marking this lead as unqualified.', 'error');
            return;
        }

        const newValues: Partial<Lead> = {
            status: LeadStatus.Unqualified,
            lead_type: getLeadTypeFromStatus(LeadStatus.Unqualified),
        };

        const activity: Activity = {
            id: Date.now(),
            type: 'Status Changed',
            description: `Lead marked as Unqualified Lead. Reason: ${unqualifiedReason.trim()}`,
            user: currentUser.name,
            timestamp: new Date().toISOString(),
        };

        const note: Note = {
            id: Date.now(),
            text: `Lead marked as Unqualified Lead. Reason: ${unqualifiedReason.trim()} — by ${currentUser.name}`,
            date: new Date().toISOString(),
            addedBy: currentUser as unknown as Staff,
            mentions: [],
        };

        const updatedLead: Partial<Lead> = {
            ...editedLead,
            ...newValues,
            activity: [activity, ...(editedLead?.activity || [])],
            notes: [...(editedLead?.notes || []), note],
        };

        setEditedLead(updatedLead);
        setShowUnqualifiedModal(false);
        setUnqualifiedReason('');
        setPendingStatusChange(null);

        const success = await onSave(updatedLead as Lead);
        if (success) {
            addToast('Lead marked as unqualified. Reason has been logged in Activity and Notes.', 'success');
        } else {
            addToast('Lead status updated locally; save failed. Try saving again.', 'error');
        }
    };

    const handleUnqualifiedModalCancel = () => {
        setShowUnqualifiedModal(false);
        setUnqualifiedReason('');
        setPendingStatusChange(null);
    };

    const handleRejectedReasonSubmit = async () => {
        if (!rejectedReason.trim()) {
            addToast('Please provide a reason for marking this lead as rejected.', 'error');
            return;
        }

        const newValues: Partial<Lead> = {
            status: LeadStatus.Rejected,
            lead_type: getLeadTypeFromStatus(LeadStatus.Rejected),
        };

        const activity: Activity = {
            id: Date.now(),
            type: 'Status Changed',
            description: `Lead marked as Rejected. Reason: ${rejectedReason.trim()}`,
            user: currentUser.name,
            timestamp: new Date().toISOString(),
        };

        const note: Note = {
            id: Date.now(),
            text: `Lead marked as Rejected. Reason: ${rejectedReason.trim()} — by ${currentUser.name}`,
            date: new Date().toISOString(),
            addedBy: currentUser as unknown as Staff,
            mentions: [],
        };

        const updatedLead: Partial<Lead> = {
            ...editedLead,
            ...newValues,
            activity: [activity, ...(editedLead?.activity || [])],
            notes: [...(editedLead?.notes || []), note],
        };

        setEditedLead(updatedLead);
        setShowRejectedModal(false);
        setRejectedReason('');
        setPendingStatusChange(null);

        const success = await onSave(updatedLead as Lead);
        if (success) {
            addToast('Lead marked as rejected. Reason has been logged in Activity and Notes.', 'success');
        } else {
            addToast('Lead status updated locally; save failed. Try saving again.', 'error');
        }
    };

    const handleRejectedModalCancel = () => {
        setShowRejectedModal(false);
        setRejectedReason('');
        setPendingStatusChange(null);
    };

    const handleRoomChange = (roomId: number, field: 'adults' | 'children', delta: number) => {
        const newRooms = (editedLead.requirements?.rooms || []).map(room => {
            if (room.id === roomId) {
                const newValue = room[field] + delta;
                const minValue = field === 'adults' ? 1 : 0;
                const updatedRoom = { ...room, [field]: Math.max(minValue, newValue) };

                // Clear child_ages if children count decreased
                if (field === 'children' && newValue < room.children) {
                    updatedRoom.child_ages = [];
                } else if (field === 'children' && updatedRoom.child_ages) {
                    // Trim child_ages array if it's longer than new children count
                    if (updatedRoom.child_ages.length > newValue) {
                        updatedRoom.child_ages = updatedRoom.child_ages.slice(0, newValue);
                    }
                }

                return updatedRoom;
            }
            return room;
        });
        setEditedLead(prev => ({ ...prev, requirements: { ...prev.requirements!, rooms: newRooms } }));
    };

    const handleSimplifiedPaxChange = (field: 'adults' | 'children', delta: number) => {
        const newRooms = [...(editedLead.requirements?.rooms || [])];
        if (newRooms.length === 0) {
            newRooms.push({ id: Date.now(), adults: 1, children: 0 });
        }

        const firstRoom = { ...newRooms[0] };
        const newValue = firstRoom[field] + delta;
        const minValue = field === 'adults' ? 1 : 0;
        firstRoom[field] = Math.max(minValue, newValue);

        // Clear child_ages if children count decreased
        if (field === 'children' && newValue < (newRooms[0]?.children || 0)) {
            firstRoom.child_ages = [];
        } else if (field === 'children' && firstRoom.child_ages) {
            // Trim child_ages array if it's longer than new children count
            if (firstRoom.child_ages.length > newValue) {
                firstRoom.child_ages = firstRoom.child_ages.slice(0, newValue);
            }
        }

        const finalRooms = [firstRoom];

        setEditedLead(prev => ({
            ...prev,
            requirements: {
                ...prev.requirements!,
                rooms: finalRooms
            }
        }));
    };

    const addRoom = () => {
        const newRoom = { id: Date.now(), adults: 1, children: 0 };
        const newRooms = [...(editedLead.requirements?.rooms || []), newRoom];
        setEditedLead(prev => ({ ...prev, requirements: { ...prev.requirements!, rooms: newRooms } }));
    };

    const removeRoom = (roomId: number) => {
        if ((editedLead.requirements?.rooms?.length || 0) <= 1) return;
        const newRooms = (editedLead.requirements?.rooms || []).filter(room => room.id !== roomId);
        setEditedLead(prev => ({ ...prev, requirements: { ...prev.requirements!, rooms: newRooms } }));
    };

    const handleChildAgeChange = (roomId: number | null, childIndex: number, age: string) => {
        const ageValue = age === '' ? undefined : (isNaN(parseInt(age, 10)) ? undefined : parseInt(age, 10));

        if (roomId === null) {
            // Simplified view - update first room
            const newRooms = [...(editedLead.requirements?.rooms || [])];
            if (newRooms.length === 0) {
                newRooms.push({ id: Date.now(), adults: 1, children: 0 });
            }

            const firstRoom = { ...newRooms[0] };
            if (!firstRoom.child_ages) {
                firstRoom.child_ages = [];
            }

            // Ensure array matches children count
            while (firstRoom.child_ages.length < (firstRoom.children || 0)) {
                firstRoom.child_ages.push(undefined as any);
            }

            // Update the specific age
            if (ageValue !== undefined) {
                firstRoom.child_ages[childIndex] = ageValue;
            } else {
                firstRoom.child_ages[childIndex] = undefined as any;
            }

            // Trim to children count
            firstRoom.child_ages = firstRoom.child_ages.slice(0, firstRoom.children || 0);

            newRooms[0] = firstRoom;
            setEditedLead(prev => ({
                ...prev,
                requirements: {
                    ...prev.requirements!,
                    rooms: newRooms
                }
            }));
        } else {
            // Room-based view
            const newRooms = (editedLead.requirements?.rooms || []).map(room => {
                if (room.id === roomId) {
                    const updatedRoom = { ...room };
                    if (!updatedRoom.child_ages) {
                        updatedRoom.child_ages = [];
                    }

                    // Ensure array matches children count
                    while (updatedRoom.child_ages.length < (updatedRoom.children || 0)) {
                        updatedRoom.child_ages.push(undefined as any);
                    }

                    // Update the specific age
                    if (ageValue !== undefined) {
                        updatedRoom.child_ages[childIndex] = ageValue;
                    } else {
                        updatedRoom.child_ages[childIndex] = undefined as any;
                    }

                    // Trim to children count
                    updatedRoom.child_ages = updatedRoom.child_ages.slice(0, updatedRoom.children || 0);

                    return updatedRoom;
                }
                return room;
            });
            setEditedLead(prev => ({ ...prev, requirements: { ...prev.requirements!, rooms: newRooms } }));
        }
    };

    const totalPassengers = useMemo(() => {
        return (editedLead.requirements?.rooms || []).reduce((acc, room) => acc + room.adults + room.children, 0);
    }, [editedLead.requirements?.rooms]);

    const handleSelectRequirementChange = (field: 'hotelPreference' | 'stayPreference', value: string) => {
        setEditedLead(prev => ({ ...prev, requirements: { ...prev.requirements!, [field]: value } }));
    };

    const handleStaffToggle = (staffMember: Staff) => {
        const currentAssigned = editedLead.assigned_to || [];
        const isAssigned = currentAssigned.some(s => s.id === staffMember.id);

        // If removing staff, just remove them (no popup needed)
        if (isAssigned) {
            const newAssigned = currentAssigned.filter(s => s.id !== staffMember.id);
            handleFieldChange('assigned_to', newAssigned);
            return;
        }

        // Always treat assignments done from the UI as manual and ask for a reason
        setPendingStaffAssignment(staffMember);
        setAssignmentReason('');
        setShowAssignmentReasonPopup(true);
    };

    const handleConfirmAssignmentReason = async () => {
        if (!pendingStaffAssignment || !assignmentReason.trim()) {
            addToast('Please provide a reason for assignment.', 'error');
            return;
        }

        if (!currentUser) {
            addToast('User information not available.', 'error');
            return;
        }

        // Add the staff member to assigned_to
        const currentAssigned = editedLead.assigned_to || [];
        const newAssigned = [...currentAssigned, pendingStaffAssignment];
        
        // Add note with assignment reason
        const noteText = `@${pendingStaffAssignment.name} you've been assigned for: ${assignmentReason.trim()}...`;
        const note: Note = {
            id: Date.now(),
            text: noteText,
            date: new Date().toISOString(),
            addedBy: currentUser,
            mentions: [{ id: pendingStaffAssignment.id, name: pendingStaffAssignment.name }],
        };
        
        const updatedNotes = [...(editedLead.notes || []), note];
        // Mark this save as a manual staff assignment so we can adjust branches accordingly
        const updatedLead = { ...editedLead, assigned_to: newAssigned, notes: updatedNotes, __manual_staff_assignment: true } as Lead & { __manual_staff_assignment?: boolean };
        
        // Optimistic local update
        setEditedLead(updatedLead);

        // Save immediately if lead is already saved, otherwise note will be saved when lead is saved
        if (!isNewLead && editedLead.id) {
            setIsAssigning(true);
            try {
                const success = await onSave(updatedLead);
                if (success) {
                    addToast(`Staff assigned and note added.`, 'success');
                }
            } finally {
                setIsAssigning(false);
            }
        } else {
            addToast(`Staff assigned. Note will be added when lead is saved.`, 'success');
        }

        // Close popup and reset state
        setShowAssignmentReasonPopup(false);
        setPendingStaffAssignment(null);
        setAssignmentReason('');
        setIsStaffDropdownOpen(false);
    };

    const handleCancelAssignmentReason = () => {
        setShowAssignmentReasonPopup(false);
        setPendingStaffAssignment(null);
        setAssignmentReason('');
    };

    const handleSupplierToggle = (supplier: Supplier) => {
        const currentAssigned = editedLead.assigned_suppliers || [];
        const isAssigned = currentAssigned.some(s => s.id === supplier.id);
        const newAssigned = isAssigned
            ? currentAssigned.filter(s => s.id !== supplier.id)
            : [...currentAssigned, supplier];
        handleFieldChange('assigned_suppliers', newAssigned);
    };


    const handleServiceToggle = (service: Service) => {
        const currentServices = editedLead.services || [];
        const isSelected = currentServices.includes(service);
        const newServices = isSelected
            ? currentServices.filter(s => s !== service)
            : [...currentServices, service];
        handleFieldChange('services', newServices);
    };

    const handleChecklistChange = (key: string, isChecked: boolean) => {
        const activity: Activity = {
            id: Date.now(),
            type: 'Confirmation Update',
            description: `${key} was ${isChecked ? 'confirmed' : 'unconfirmed'} by ${currentUser.name}.`,
            user: currentUser.name,
            timestamp: new Date().toISOString(),
        };

        setEditedLead(prev => ({
            ...prev,
            confirmation_checklist: {
                ...prev.confirmation_checklist,
                [key]: isChecked
            },
            activity: [activity, ...(prev.activity || [])]
        }));
    };

    const handleSave = async () => {
        if (!editedLead.customer_id) {
            addToast('Please select a customer.', 'error');
            return;
        }
        // Destination is not required for Forex or Passport services
        if (!isForexOnly && !isPassportService && !editedLead.destination?.trim()) {
            addToast('Destination is required.', 'error');
            return;
        }
        // Travel date is not required for Forex or Passport services
        if (!isForexOnly && !isPassportService && !editedLead.travel_date) {
            addToast('Date of Travel is required.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            let customerUpdateSuccess = true;
            if (primaryCustomer && editedCustomer && JSON.stringify(primaryCustomer) !== JSON.stringify(editedCustomer)) {
                customerUpdateSuccess = await onUpdateCustomer(editedCustomer as Customer, null, { closePanel: false });
            }

            if (!customerUpdateSuccess) {
                addToast('Failed to save customer details. Lead changes were not saved.', 'error');
                setIsSaving(false);
                return;
            }

            const totalAdults = (editedLead.requirements?.rooms || []).reduce((sum, room) => sum + room.adults, 0);
            const totalChildren = (editedLead.requirements?.rooms || []).reduce((sum, room) => sum + room.children, 0);

            // Consolidate child ages from all rooms for backward compatibility
            const allChildAges: number[] = [];
            (editedLead.requirements?.rooms || []).forEach(room => {
                if (room.child_ages && room.child_ages.length > 0) {
                    allChildAges.push(...room.child_ages.filter(age => age !== undefined && age !== null));
                }
            });

            const leadToSave = {
                ...editedLead,
                requirements: {
                    ...editedLead.requirements!,
                    adults: totalAdults,
                    children: totalChildren,
                    child_ages: allChildAges.length > 0 ? allChildAges : undefined,
                }
            };

            const leadSaveSuccess = await onSave(leadToSave as Lead);
            if (leadSaveSuccess) {
                handlePanelClose();
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddNote = async () => {
        if (isNewLead) {
            addToast("Please save the lead before adding notes.", 'error');
            return;
        }

        if (newNote.trim() && currentUser && editedLead.id) {
            const note: Note = {
                id: Date.now(),
                text: newNote.trim(),
                date: new Date().toISOString(),
                addedBy: currentUser,
                mentions: currentMentions,
            };
            const updatedNotes = [...(editedLead.notes || []), note];
            const leadWithNewNote = { ...editedLead, notes: updatedNotes } as Lead;

            const success = await onSave(leadWithNewNote);

            if (success) {
                setNewNote('');
                setCurrentMentions([]);
            }
        }
    };

    const handleDeleteNote = (noteId: number) => {
        const updatedNotes = (editedLead.notes || []).filter(n => n.id !== noteId);
        handleFieldChange('notes', updatedNotes);
    };

    const handleShareSave = (newBranchIds: number[]) => {
        const updatedLead = { ...editedLead, branch_ids: newBranchIds };
        setEditedLead(updatedLead);
        onSave(updatedLead as Lead).then(success => {
            if (success) {
                addToast('Lead sharing access updated.', 'success');
            }
        });
    };

    const handleBranchToggle = (branchId: number) => {
        // Prevent removing branch_id 1
        if (branchId === 1) {
            addToast('Branch 1 cannot be removed from lead sharing.', 'error');
            return;
        }
        const current = editedLead.branch_ids || [];
        const next = current.includes(branchId)
            ? current.filter(id => id !== branchId)
            : [...current, branchId];
        handleShareSave(next);
    };

    const handleNewCustomerSave = async (newCustomer: Customer, avatarFile: File | null) => {
        const savedCustomer = await onSaveCustomer(newCustomer, avatarFile);
        if (savedCustomer) {
            handleFieldChange('customer_id', savedCustomer.id);
        }
        setIsNewCustomerPanelOpen(false);
    };

    const handleCreateItinerary = () => {
        if (lead) {
            sessionStorage.setItem('newItineraryForLead', JSON.stringify(lead));
            onNavigate('/itineraries');
            handlePanelClose();
        } else {
            addToast('Please save the lead before creating an itinerary.', 'error');
        }
    };

    const handleViewItinerary = (itineraryId: number) => {
        sessionStorage.setItem('viewItineraryId', itineraryId.toString());
        onNavigate('/itineraries');
        handlePanelClose();
    };

    const handleLinkItinerary = async (itineraryId: number) => {
        if (!lead) return;
        try {
            const currentItineraryIds = editedLead.itinerary_ids || [];
            if (currentItineraryIds.includes(itineraryId)) {
                addToast('This itinerary is already linked to this lead.', 'error');
                return;
            }
            const updatedIds = [...currentItineraryIds, itineraryId];
            await supabase.from('leads').update({ itinerary_ids: updatedIds }).eq('id', lead.id);
            setEditedLead(prev => ({ ...prev, itinerary_ids: updatedIds }));
            addToast('Itinerary linked successfully.', 'success');
            await refreshData();
        } catch (error: any) {
            addToast(`Error linking itinerary: ${error.message}`, 'error');
        }
    };

    const handleArchiveItinerary = async (itineraryId: number) => {
        if (!lead || !lead.id) {
            addToast('Cannot archive itinerary: Lead not found.', 'error');
            return;
        }

        try {
            const { error } = await supabase
                .from('itineraries')
                .update({ status: ItineraryStatus.Archived })
                .eq('id', itineraryId);

            if (error) {
                console.error('Supabase error archiving itinerary:', error);
                throw error;
            }

            addToast('Itinerary archived. It has been removed from this lead.', 'success');
            await refreshData();
        } catch (error: any) {
            console.error('Error archiving itinerary:', error);
            addToast(`Error archiving itinerary: ${error.message || 'Unknown error'}`, 'error');
        }
    };

    const handleCreateInvoice = () => {
        setOpenNewInvoiceDrawer(true);
    };

    const handleSaveInvoiceInLead = async (invoiceToSave: Partial<Invoice>, options?: InvoiceSaveOptions) => {
        const isNew = !invoiceToSave.id;
        const isLeadAssignee =
            !!lead &&
            Array.isArray(lead.assigned_to) &&
            lead.assigned_to.some((s: Staff) => s.id === currentUser.id);
        const canEditInvoiceFromLead = isNew || canEditResource(currentUser, 'invoices') || isLeadAssignee;
        if (!canEditInvoiceFromLead && !isNew) {
            addToast('You do not have permission to modify existing invoices.', 'error');
            return;
        }
        try {
            if (isNew) {
                const { id: _id, ...newInvoiceData } = invoiceToSave;
                const status = options?.markAsInvoiced ? InvoiceStatus.Invoiced : (invoiceToSave.status ?? InvoiceStatus.Draft);
                const { data, error } = await supabase.from('invoices').insert({ ...newInvoiceData, status, created_by_staff_id: currentUser.id }).select().single();
                if (error) throw error;
                addToast('Invoice created successfully.', 'success');
                if (options?.generateLink && data) {
                    addToast('Generating Razorpay payment link...', 'success');
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) throw new Error('Authentication required. Please log in again.');
                    const response = await fetch(`${API_BASE_URL}/api/invoicing/create-link`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({ invoiceId: data.id })
                    });
                    const resData = await response.json();
                    if (!response.ok) throw new Error(resData.message || 'Server error');
                    addToast('Payment link generated and invoice status updated to SENT.', 'success');
                }
            } else {
                const { id, ...updateInvoiceData } = invoiceToSave;
                const { error } = await supabase.from('invoices').update(updateInvoiceData).eq('id', id!).select().single();
                if (error) throw error;
                addToast('Invoice updated successfully.', 'success');
                if (options?.generateLink && invoiceToSave.id) {
                    addToast('Generating Razorpay payment link...', 'success');
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.access_token) throw new Error('Authentication required. Please log in again.');
                    const response = await fetch(`${API_BASE_URL}/api/invoicing/create-link`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({ invoiceId: invoiceToSave.id })
                    });
                    const resData = await response.json();
                    if (!response.ok) throw new Error(resData.message || 'Server error');
                    addToast('Payment link generated and invoice status updated to SENT.', 'success');
                }
            }
        } catch (error: any) {
            addToast(`Failed to save invoice: ${error.message}`, 'error');
        } finally {
            await fetchInvoices(true);
            await refreshData();
            setOpenInvoiceId(null);
            setOpenNewInvoiceDrawer(false);
        }
    };

    const confirmDeleteInvoiceInLead = async () => {
        if (!invoiceToDelete) return;
        try {
            const { error } = await supabase.from('invoices').delete().eq('id', invoiceToDelete);
            if (error) throw error;
            addToast('Invoice deleted permanently.', 'success');
            await fetchInvoices(true);
            await refreshData();
            setOpenInvoiceId(null);
        } catch (error: any) {
            addToast(`Error deleting invoice: ${error.message}`, 'error');
        } finally {
            setInvoiceToDelete(null);
        }
    };

    const bookingFeeInvoice = useMemo(() => leadInvoices[0], [leadInvoices]);

    // Validation function to check if all required fields are filled for MTS summary
    const validateMtsSummaryRequiredFields = useCallback((lead: Partial<Lead> | null): { isValid: boolean; missingFields: string[] } => {
        if (!lead) return { isValid: false, missingFields: ['All fields'] };

        const missingFields: string[] = [];

        // 1. Services Required
        if (!lead.services || !Array.isArray(lead.services) || lead.services.length === 0) {
            missingFields.push('Services');
        }

        // 2. Destination (not required for Forex or Passport services)
        const isPassportService = lead.services?.includes(Service.Passport);
        const isForexOnlyService = lead.services?.length === 1 && lead.services[0] === Service.ForEx;
        if (!isForexOnlyService && !isPassportService && (!lead.destination || lead.destination === 'N/A' || lead.destination.trim() === '')) {
            missingFields.push('Destination');
        }

        // 3. Duration (not required for Forex or Passport services)
        if (!isForexOnlyService && !isPassportService && (!lead.duration || lead.duration.trim() === '')) {
            missingFields.push('Duration');
        }

        // 4. Date of Travel (OPTIONAL - can use check_in_date if travel_date is not available)
        // Handle null, undefined, empty string, or invalid dates (like epoch 0 = 1970-01-01)
        // Also check check_in_date if travel_date is not available
        let hasTravelDate = false;
        const travelDateToCheck = lead.travel_date || lead.check_in_date;
        if (travelDateToCheck) {
            const travelDateStr = String(travelDateToCheck).trim();
            if (travelDateStr !== '' && travelDateStr !== 'null' && travelDateStr !== 'undefined') {
                // Check if it's a valid date (not epoch 0 = 1970-01-01)
                const dateObj = new Date(travelDateStr);
                if (!isNaN(dateObj.getTime()) && dateObj.getFullYear() > 1970) {
                    hasTravelDate = true;
                }
            }
        }
        // Note: Date of Travel is now optional - don't add to missingFields

        // 5. Passenger Details (adults or children must be filled)
        // First check rooms array, then fall back to requirements.adults/children
        let totalAdults = 0;
        if (lead.requirements?.rooms && Array.isArray(lead.requirements.rooms) && lead.requirements.rooms.length > 0) {
            totalAdults = lead.requirements.rooms.reduce(
                (sum, room) => sum + (room.adults || 0),
                0
            );
        } else if (lead.requirements?.adults !== null && lead.requirements?.adults !== undefined) {
            totalAdults = parseInt(String(lead.requirements.adults)) || 0;
        }

        let totalChildren = 0;
        if (lead.requirements?.rooms && Array.isArray(lead.requirements.rooms) && lead.requirements.rooms.length > 0) {
            totalChildren = lead.requirements.rooms.reduce(
                (sum, room) => sum + (room.children || 0),
                0
            );
        } else if (lead.requirements?.children !== null && lead.requirements?.children !== undefined) {
            totalChildren = parseInt(String(lead.requirements.children)) || 0;
        }

        // Note: Passenger Details is now optional - don't add to missingFields
        // Only Services, Destination, and Duration are required
        // Date of Travel and Passenger Details are optional

        return {
            isValid: missingFields.length === 0,
            missingFields,
        };
    }, []);

    const mtsSummaryValidation = useMemo(() => {
        return validateMtsSummaryRequiredFields(editedLead);
    }, [editedLead, validateMtsSummaryRequiredFields]);

    const whatsappTemplates = useMemo(() => {
        const baseTemplates = [
            {
                title: 'Send Summary Confirmation',
                message: 'Hi {customer_name}, here is your trip summary for {destination}. Please reply CONFIRM to proceed or MODIFY to share changes. Once you confirm, we will lock your booking.',
                disabled: !mtsSummaryValidation.isValid,
                disabledReason: mtsSummaryValidation.missingFields.length > 0
                    ? `Missing: ${mtsSummaryValidation.missingFields.join(', ')}`
                    : undefined,
            },
            {
                title: 'Send Itinerary',
                message: 'Sending itinerary via WhatsApp...',
                type: 'itinerary',
                disabled: leadItineraries.length === 0,
                disabledReason: leadItineraries.length === 0
                    ? 'No itinerary found for this lead'
                    : undefined,
            },
            {
                title: 'Send Invoice',
                message: 'Send invoice PDF via WhatsApp...',
                type: 'invoice',
                disabled: leadInvoices.length === 0 || !leadInvoices.some(inv => [InvoiceStatus.Invoiced, InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid, InvoiceStatus.Paid, InvoiceStatus.Overdue].includes(inv.status)),
                disabledReason: leadInvoices.length === 0
                    ? 'No invoice found for this lead'
                    : !leadInvoices.some(inv => [InvoiceStatus.Invoiced, InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid, InvoiceStatus.Paid, InvoiceStatus.Overdue].includes(inv.status))
                        ? 'No invoice in sendable status (Invoiced / Sent / Partially Paid / Paid / Overdue)'
                        : undefined,
            },
        ];

        return baseTemplates;
    }, [editedLead.services, leadInvoices, mtsSummaryValidation, leadItineraries]);

    const handleSendWhatsapp = async (template: { title: string; message: string; type?: string; }) => {
        if (!primaryCustomer?.phone) {
            addToast('Customer phone number is not available.', 'error');
            return;
        }

        const whatsappNumber = primaryCustomer.phone.replace(/[+\s]/g, '');

        // Handle itinerary template
        if (template.type === 'itinerary') {
            if (leadItineraries.length === 0) {
                addToast('No itinerary found for this lead.', 'error');
                return;
            }
            const latestItinerary = leadItineraries[0];
            try {
                setIsWhatsappMenuOpen(false);
                addToast('Sending itinerary via WhatsApp...', 'success');
                const response = await fetch(`${API_BASE_URL}/api/whatsapp/send-itinerary`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        leadId: lead?.id,
                        itineraryId: latestItinerary.id
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Failed to send itinerary');
                addToast('Itinerary sent via WhatsApp.', 'success');
                await refreshData();
            } catch (err: any) {
                addToast(`Failed to send itinerary: ${err.message}`, 'error');
            }
            return;
        }

        // Handle Send Invoice template (PDF via WhatsApp; only INVOICED, PARTIALLY PAID, PAID, OVERDUE)
        if (template.type === 'invoice') {
            if (leadInvoices.length === 0) {
                addToast('No invoice found for this lead.', 'error');
                return;
            }
            const sendableStatuses = [InvoiceStatus.Invoiced, InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid, InvoiceStatus.Paid, InvoiceStatus.Overdue];
            const invoiceToSend = bookingFeeInvoice || leadInvoices[0];
            if (!sendableStatuses.includes(invoiceToSend.status)) {
                const msg = invoiceToSend.status === InvoiceStatus.Draft ? "Can't send - invoice is in DRAFT." : invoiceToSend.status === InvoiceStatus.Void ? "Can't send - invoice is VOID." : `Invoice cannot be sent (status: ${invoiceToSend.status}).`;
                addToast(msg, 'error');
                return;
            }
            try {
                setIsWhatsappMenuOpen(false);
                addToast('Sending invoice via WhatsApp...', 'success');
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) throw new Error('Authentication required. Please log in again.');
                const response = await fetch(`${API_BASE_URL}/api/invoicing/send-whatsapp`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ invoiceId: invoiceToSend.id })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Failed to send invoice');
                addToast('Invoice sent via WhatsApp.', 'success');
            } catch (err: any) {
                addToast(`Failed to send invoice: ${err.message}`, 'error');
            }
            return;
        }

        try {
            setIsWhatsappMenuOpen(false);
            addToast('Sending summary via WhatsApp...', 'success');
            const response = await fetch(`${API_BASE_URL}/api/whatsapp/send-summary`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leadId: lead?.id })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Failed to send summary');
            addToast('Summary sent via WhatsApp.', 'success');
        } catch (err: any) {
            addToast(`Failed to send summary: ${err.message}`, 'error');
        }

        if (isNewLead) return;

        const note: Note = {
            id: Date.now(),
            text: `Sent WhatsApp message using '${template.title}' template.`,
            date: new Date().toISOString(),
            addedBy: currentUser,
            mentions: [],
        };
        const updatedNotes = [...(editedLead.notes || []), note];
        const leadWithNewNote = { ...editedLead, notes: updatedNotes } as Lead;

        onSave(leadWithNewNote);
    };

    useEffect(() => {
        if (!currentUser) return;
        let availableStaff: Staff[] = [];

        // CHANGED: Mention suggestions show only assignable staff from branch 1
        availableStaff = staff.filter(isAssignableStaff);

        setMentionableStaff(availableStaff.filter(s => s.id !== currentUser.id));
    }, [currentUser, staff]);

    const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setNewNote(text);

        const mentionMatch = text.match(/@(\w*)$/);
        if (mentionMatch) {
            const query = mentionMatch[1].toLowerCase();
            setMentionQuery(query);
            setFilteredMentionStaff(mentionableStaff.filter(s => s.name.toLowerCase().includes(query)));
            setIsMentioning(true);
            setMentionIndex(0);
        } else {
            setIsMentioning(false);
        }
    };

    const handleSelectMention = (staffMember: Staff) => {
        const text = newNote;
        const mentionMatch = text.match(/@\w*$/);
        if (mentionMatch) {
            const newText = text.substring(0, mentionMatch.index) + `@${staffMember.name} `;
            setNewNote(newText);
            setCurrentMentions(prev => [...prev, { id: staffMember.id, name: staffMember.name }]);
        }
        setIsMentioning(false);
    };

    const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isMentioning && filteredMentionStaff.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % filteredMentionStaff.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + filteredMentionStaff.length) % filteredMentionStaff.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                handleSelectMention(filteredMentionStaff[mentionIndex]);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setIsMentioning(false);
            }
        }
    };

    const renderNoteText = (note: Note): React.ReactNode => {
        if (!note.text) {
            return null;
        }

        if (!note.mentions || note.mentions.length === 0) {
            return <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words">{note.text}</p>;
        }

        const sortedMentions = [...note.mentions].sort((a, b) => b.name.length - a.name.length);
        const mentionPatterns = sortedMentions.map(m => `@${m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).join('|');

        if (!mentionPatterns) {
            return <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words">{note.text}</p>;
        }

        const regex = new RegExp(`(${mentionPatterns})`, 'g');
        const parts = note.text.split(regex);

        return (
            <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words">
                {parts.filter(part => part).map((part, index) => {
                    const mention = sortedMentions.find(m => `@${m.name}` === part);
                    if (mention) {
                        return (
                            <a
                                key={`${mention.id}-${index}`}
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    sessionStorage.setItem('viewStaffId', mention.id.toString());
                                    onNavigate('/employees');
                                    onClose();
                                }}
                                className="font-bold text-blue-600 bg-blue-100 rounded px-1"
                            >
                                {part}
                            </a>
                        );
                    }
                    return <React.Fragment key={index}>{part}</React.Fragment>;
                })}
            </p>
        );
    };

    const updateDocumentsForType = (docType: keyof CustomerDocuments, newDocsForType: Document<any>[]) => {
        setEditedCustomer(prev => {
            if (!prev) return null;
            const currentDocs = prev.documents || { passports: [], visas: [], aadhaarCards: [], panCards: [], bankStatements: [], otherDocuments: [] };
            return {
                ...prev,
                documents: { ...currentDocs, [docType]: newDocsForType }
            };
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, docType: keyof CustomerDocuments) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fileName = file.name;

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Content = event.target?.result as string;
            if (!base64Content) {
                addToast(`Failed to read ${fileName}.`, 'error');
                return;
            }
            const updated = { current: false };
            setEditedCustomer(prev => {
                if (!prev) return prev;
                const personName = `${prev.first_name} ${prev.last_name}`;
                let defaultDetails: any = { personName, customerId: prev.id };
                switch (docType) {
                    case 'passports': defaultDetails = { ...defaultDetails, number: '', nameOnCard: personName } as PassportDetails; break;
                    case 'visas': defaultDetails = { ...defaultDetails, visaType: '', country: '' } as VisaDetails; break;
                    case 'aadhaarCards': defaultDetails = { ...defaultDetails, number: '', nameOnCard: personName } as AadhaarDetails; break;
                    case 'panCards': defaultDetails = { ...defaultDetails, number: '', nameOnCard: personName } as PanDetails; break;
                    case 'bankStatements': defaultDetails = { ...defaultDetails, notes: '' } as BankStatementDetails; break;
                    case 'otherDocuments': defaultDetails = { ...defaultDetails, documentName: fileName.split('.').slice(0, -1).join('.'), notes: '' } as OtherDocDetails; break;
                }
                const newFile: UploadedFile = { name: file.name, type: file.type, size: file.size, content: base64Content };
                const newDoc: Document<any> = { id: Date.now(), file: newFile, details: defaultDetails };
                const currentDocs = prev.documents || { passports: [], visas: [], aadhaarCards: [], panCards: [], bankStatements: [], otherDocuments: [] };
                const currentForType = currentDocs[docType] || [];
                updated.current = true;
                return {
                    ...prev,
                    documents: { ...currentDocs, [docType]: [...currentForType, newDoc] }
                };
            });
            if (updated.current) addToast(`${fileName} uploaded. Remember to save changes.`, 'success');
            else addToast('No customer selected. Select a customer first.', 'error');
        };
        reader.onerror = () => {
            addToast(`Failed to read file ${fileName}.`, 'error');
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleDeleteDocument = (docType: keyof CustomerDocuments, docId: number) => {
        setEditedCustomer(prev => {
            if (!prev) return prev;
            const currentDocs = prev.documents || { passports: [], visas: [], aadhaarCards: [], panCards: [], bankStatements: [], otherDocuments: [] };
            const currentForType = currentDocs[docType] || [];
            const newDocsForType = currentForType.filter(d => d.id !== docId);
            return { ...prev, documents: { ...currentDocs, [docType]: newDocsForType } };
        });
        addToast('Document removed. Remember to save changes.', 'success');
    };

    const handleEmailSuppliers = async () => {
        if (!editedLead || !primaryCustomer) return;

        const staffMember = editedLead.assigned_to?.[0];
        if (!staffMember) {
            addToast('At least one staff member must be assigned to send emails.', 'error');
            return;
        }

        const suppliersToSend = editedLead.assigned_suppliers;
        if (!suppliersToSend || suppliersToSend.length === 0) {
            addToast('No suppliers are assigned to this lead.', 'error');
            return;
        }

        const branch = branches.find(b => editedLead.branch_ids.includes(b.id));
        if (!branch?.primary_email) {
            addToast('Could not find a primary email for the lead\'s branch to CC.', 'error');
            return;
        }

        setIsSendingEmail(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/email/send-supplier-request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead: editedLead,
                    staff: staffMember,
                    suppliers: suppliersToSend,
                    branchEmail: branch.primary_email,
                }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            addToast('Requirement emails have been sent to suppliers.', 'success');
            await refreshData();
        } catch (error: any) {
            addToast(`Failed to send emails: ${error.message}`, 'error');
        } finally {
            setIsSendingEmail(false);
        }
    };

    const indianPlaces = useMemo(() => [
        'India', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
        'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
        'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
        'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
        'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
        'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai', 'Kolkata', 'Surat', 'Pune', 'Jaipur'
    ].map(p => p.toLowerCase()), []);

    useEffect(() => {
        if (isEditing && editedLead.destination) {
            const destinationLower = editedLead.destination.toLowerCase();
            const isIndian = indianPlaces.some(place => destinationLower.includes(place));
            const newRegion = isIndian ? TourRegion.Domestic : TourRegion.International;
            if (editedLead.tour_region !== newRegion) {
                handleFieldChange('tour_region', newRegion);
            }
        }
    }, [editedLead.destination, isEditing, indianPlaces]);

    const handleOpenCamera = (docType: keyof CustomerDocuments) => {
        setCameraDocType(docType);
        setIsCameraModalOpen(true);
    };

    const handleCapture = (file: File) => {
        if (!file || !cameraDocType) return;
        const mockEvent = {
            target: { files: [file] }
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFileUpload(mockEvent, cameraDocType);
    };


    const isAssignableStaff = (s: Staff): boolean => {
        if (!s) return false;

        const isActive = s.status === StaffStatus.Active; // Active status only

        // Exclude system/bot accounts
        const nameLower = (s.name || '').toLowerCase();
        const emailLower = (s.email || '').toLowerCase();
        const isSystemByName = nameLower.includes('ai assistant') || nameLower.includes('assistant') || nameLower.includes('bot');
        const isSystemByEmail = emailLower.includes('bot@') || emailLower.includes('no-reply') || emailLower.includes('noreply');
        if (isSystemByName || isSystemByEmail) return false;

        // Super Admin: sees all staffs, managers, super admin
        if (currentUser.role === 'Super Admin') {
            return isActive && (s.role_id === 1 || s.role_id === 2 || s.role_id === 3); // Super Admin, Manager, or Staff
        }

        // Branch Manager: sees branch 1 staffs & their own branch staffs
        if (currentUser.role === 'Manager') {
            const isBranch1Staff = s.branch_id === 1;
            const isOwnBranchStaff = s.branch_id === currentUser.branch_id;
            return isActive && (isBranch1Staff || isOwnBranchStaff) && (s.role_id === 2 || s.role_id === 3); // Manager or Staff from branch 1 or own branch
        }

        // Regular Staff: sees themselves and branch 1 staffs
        const isMyself = s.id === currentUser.id;
        const isBranch1Staff = s.branch_id === 1 && s.role_id === 3; // Only staff from branch 1
        return isActive && (isMyself || isBranch1Staff);
    };

    const filteredStaffForDropdown = useMemo(() => {
        const assignableStaff = staff.filter(isAssignableStaff);
        const lowerQuery = staffSearchQuery.toLowerCase();
        if (!lowerQuery) {
            return assignableStaff.slice(0, 7);
        }
        return assignableStaff.filter(s =>
            s.name.toLowerCase().includes(lowerQuery) ||
            s.email.toLowerCase().includes(lowerQuery)
        ).slice(0, 7);
    }, [staff, staffSearchQuery, currentUser]);

    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
    const [isStaffPanelOpen, setIsStaffPanelOpen] = useState(false);
    const [isStaffPanelClosing, setIsStaffPanelClosing] = useState(false);

    const handleStaffClick = (staffMember: Staff) => {
        setSelectedStaff(staffMember);
        setIsStaffPanelOpen(true);
    };

    const handleStaffPanelClose = () => {
        setIsStaffPanelClosing(true);
        setIsStaffPanelOpen(false);
        setTimeout(() => {
            setSelectedStaff(null);
            setIsStaffPanelClosing(false);
        }, 300);
    };


    return (
        <div className="fixed inset-0 z-40" style={{ pointerEvents: 'auto' }}>
            <div
                className={`absolute inset-0 bg-black transition-opacity duration-300 ${isPanelClosing ? 'opacity-0' : 'opacity-40'}`}
                onClick={handlePanelClose}
                style={{ pointerEvents: 'auto' }}
            ></div>
            {isTaskDrawerOpen && (
                <TaskDetailPanel
                    task={selectedTaskForDetail}
                    isAddMode={!selectedTaskForDetail}
                    initialLeadIds={selectedTaskForDetail ? undefined : initialLeadIdsForTask}
                    isEditing={isTaskPanelEditing}
                    isPanelClosing={isTaskDrawerClosing}
                    currentUser={currentUser}
                    staff={staff}
                    branches={branches}
                    leads={leads}
                    customers={customers}
                    createdByStaff={createdByStaffMap}
                    canDelete={false}
                    canMarkDone={false}
                    onClose={closeTaskDrawer}
                    onEdit={() => setIsTaskPanelEditing(true)}
                    onMarkDone={selectedTaskForDetail?.status === 'PENDING' ? handleMarkDoneForLeadTask : undefined}
                    onUndoDone={selectedTaskForDetail?.status === 'COMPLETED' ? handleUndoDoneForLeadTask : undefined}
                    onSave={handleSaveTaskFromLead}
                    onCancelEdit={() => setIsTaskPanelEditing(false)}
                    overlayZIndex={50}
                />
            )}
            <div
                className={`absolute inset-y-0 right-0 w-full max-w-[100vw] sm:max-w-4xl bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-out ${isPanelOpen && !isPanelClosing ? 'translate-x-0' : 'translate-x-full'}`}
                onClick={(e) => e.stopPropagation()}
                style={{ pointerEvents: 'auto' }}
            >
                <div className="flex items-center justify-between gap-2 p-3 sm:p-4 border-b min-h-[52px] sm:h-16 shrink-0">
                    <h2 className="text-base sm:text-lg font-semibold text-slate-800 flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <span className="truncate">{isNewLead ? 'Add New Lead' : `Lead: ${primaryCustomer ? `${primaryCustomer.first_name} ${primaryCustomer.last_name}` : ''} - ${editedLead.destination}`}</span>
                        {!isNewLead && lead && (
                            <span className="text-[10px] sm:text-xs font-mono bg-slate-200 text-slate-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded shrink-0">
                                {generateBookingId(lead)}
                            </span>
                        )}
                    </h2>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        {!isNewLead && !isEditing && (
                            <div className="relative" ref={whatsappMenuRef}>
                                <button
                                    onClick={() => setIsWhatsappMenuOpen(p => !p)}
                                    disabled={!primaryCustomer?.phone}
                                    title={!primaryCustomer?.phone ? 'Customer phone number required' : 'Send a WhatsApp message'}
                                    className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-1 text-sm font-medium text-slate-600 border rounded-[5px] hover:bg-slate-100 disabled:bg-slate-200 min-h-[40px] sm:min-h-0 touch-manipulation"
                                >
                                    <IconWhatsapp className="w-4 h-4 shrink-0" />
                                    <span className="hidden sm:inline">Templates</span>
                                    <IconChevronDown className="w-4 h-4 shrink-0 sm:ml-0" />
                                </button>
                                {isWhatsappMenuOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-md shadow-lg border z-20">
                                        <ul className="p-1">
                                            {whatsappTemplates.map(template => (
                                                <li key={template.title}>
                                                    <button
                                                        onClick={() => !template.disabled && handleSendWhatsapp(template)}
                                                        disabled={template.disabled}
                                                        className={`w-full text-left p-2 text-sm rounded-md ${template.disabled
                                                            ? 'opacity-50 cursor-not-allowed bg-slate-50'
                                                            : 'hover:bg-slate-100'
                                                            }`}
                                                        title={template.disabledReason}
                                                    >
                                                        {template.title}
                                                        {template.disabled && (
                                                            <span className="ml-2 text-xs text-slate-500">
                                                                (Required fields missing)
                                                            </span>
                                                        )}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                        {!isNewLead && !isEditing && canEnterEditMode && (
                            <button onClick={() => setIsEditing(true)} className="px-2.5 sm:px-3 py-1.5 sm:py-1 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-[5px] hover:bg-slate-200 min-h-[40px] sm:min-h-0 touch-manipulation">
                                Edit
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 sm:p-1 rounded-full hover:bg-slate-100 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center touch-manipulation" aria-label="Close"><IconX className="w-5 h-5 text-slate-600" /></button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="border-b border-gray-200 shrink-0 bg-white -mx-3 sm:-mx-6 px-3 sm:px-6 pt-3 sm:pt-4 pb-0">
                        <nav className="-mb-px flex space-x-2 sm:space-x-6 overflow-x-auto overflow-y-hidden scrollbar-hide pb-px gap-0 min-w-0" aria-label="Tabs" style={{ WebkitOverflowScrolling: 'touch' }}>
                            <button onClick={() => setActiveTab('details')} className={`whitespace-nowrap py-2.5 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm touch-manipulation ${activeTab === 'details' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Details</button>
                            <button onClick={() => setActiveTab('notes')} className={`whitespace-nowrap py-2.5 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm touch-manipulation ${activeTab === 'notes' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Notes</button>
                            {!isNewLead && editedLead.services?.includes(Service.Tour) && <button onClick={() => setActiveTab('itinerary')} className={`whitespace-nowrap py-2.5 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm touch-manipulation ${activeTab === 'itinerary' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Itinerary</button>}
                            {!isNewLead && <button onClick={() => setActiveTab('costing')} className={`whitespace-nowrap py-2.5 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm touch-manipulation ${activeTab === 'costing' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Costing</button>}
                            {!isNewLead && <button onClick={() => setActiveTab('invoices')} className={`whitespace-nowrap py-2.5 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm touch-manipulation ${activeTab === 'invoices' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Invoices</button>}
                            {!isNewLead && <button onClick={() => setActiveTab('documents')} className={`flex items-center gap-1 whitespace-nowrap py-2.5 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm touch-manipulation ${activeTab === 'documents' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Documents {(isAadhaarMissing || isPassportMissing) && <span className="w-2 h-2 bg-red-500 rounded-full shrink-0"></span>}</button>}
                            {!isNewLead && <button onClick={() => setActiveTab('tasks')} className={`whitespace-nowrap py-2.5 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm touch-manipulation ${activeTab === 'tasks' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Tasks</button>}
                            {!isNewLead && <button onClick={() => setActiveTab('activity')} className={`whitespace-nowrap py-2.5 sm:py-3 px-1 border-b-2 font-medium text-xs sm:text-sm touch-manipulation ${activeTab === 'activity' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Activity</button>}
                        </nav>
                    </div>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 bg-slate-50 min-h-0">
                    {activeTab === 'details' && (
                        <div className="space-y-4 sm:space-y-6">
                            {/* Section 1: Primary Info */}
                            <div className="bg-white p-4 sm:p-6 rounded-lg border border-slate-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">
                                            Primary Customer
                                        </label>
                                        {isEditing ? (
                                            <div className="flex items-center gap-2">
                                                <div ref={customerDropdownRef} className="relative w-full">
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={isCustomerDropdownOpen ? customerSearchQuery : selectedCustomerName}
                                                            onChange={e => setCustomerSearchQuery(e.target.value)}
                                                            onFocus={() => {
                                                                setIsCustomerDropdownOpen(true);
                                                                if (!customerSearchQuery) {
                                                                    setCustomerSearchQuery('');
                                                                }
                                                            }}
                                                            placeholder="Search or select a customer"
                                                            className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900 pr-8"
                                                        />
                                                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                                                            <IconChevronDown className="w-5 h-5 text-slate-400" />
                                                        </div>
                                                    </div>

                                                    {isCustomerDropdownOpen && (
                                                        <div className="absolute top-full right-0 mt-1 w-full bg-white rounded-md shadow-lg border z-20 max-h-60 overflow-y-auto">
                                                            <ul>
                                                                {filteredCustomersForDropdown.length > 0 ? filteredCustomersForDropdown.map(c => (
                                                                    <li
                                                                        key={c.id}
                                                                        onClick={() => {
                                                                            handleFieldChange('customer_id', c.id);
                                                                            setIsCustomerDropdownOpen(false);
                                                                            setCustomerSearchQuery('');
                                                                        }}
                                                                        className="p-2 hover:bg-slate-100 cursor-pointer text-sm"
                                                                    >
                                                                        {c.first_name} {c.last_name}
                                                                    </li>
                                                                )) : (
                                                                    <li className="p-2 text-sm text-slate-500">No customers found.</li>
                                                                )}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                                <button onClick={() => setIsNewCustomerPanelOpen(true)} className="p-2 bg-[#191974] text-white rounded-[5px] hover:bg-[#13135c] shrink-0"><IconPlus className="w-4 h-4" /></button>
                                            </div>
                                            ) : (
                                            <div>
                                                <button
                                                    onClick={() => setIsCustomerPanelOpen(true)}
                                                    className="font-medium py-2 text-blue-700 hover:underline focus:outline-none text-left w-full"
                                                >
                                                    {selectedCustomerName || 'N/A'}
                                                </button>
                                            </div>
                                        )}
                                        {primaryCustomer?.phone && (
                                            <p className="text-[11px] text-slate-500">
                                                {primaryCustomer.phone}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                                            {isEditing ? (
                                                <select
                                                    value={editedLead.status}
                                                    onChange={e => handleFieldChange('status', e.target.value)}
                                                    className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900"
                                                >
                                                    {Object.values(LeadStatus)
                                                        // Do not offer "Not Attended" as a selectable status in the drawer;
                                                        // it can still exist and be displayed if set via other flows.
                                                        .filter(s => s !== LeadStatus.NotAttended)
                                                        .map(s => {
                                                        const createdAt = lead?.created_at || editedLead.created_at;
                                                        const isUnqualifiedDisabled = s === LeadStatus.Unqualified && createdAt && !has48HoursPassed(createdAt);
                                                        const statusNotAllowed = !canSetLeadStatus(currentUser, editedLead.status, s);
                                                        const disabled = isUnqualifiedDisabled || statusNotAllowed;
                                                        const hint = isUnqualifiedDisabled ? ' (48 hours required)' : statusNotAllowed ? ' (restricted)' : '';
                                                            return (
                                                                <option
                                                                    key={s}
                                                                    value={s}
                                                                    disabled={disabled}
                                                                >
                                                                    {s}{hint}
                                                                </option>
                                                            );
                                                        })}
                                                </select>
                                            ) : <div className="py-2"><StatusBadge status={editedLead.status!} /></div>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
                                            {isEditing ? (
                                                <select value={editedLead.priority} onChange={e => handleFieldChange('priority', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900">
                                                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            ) : (
                                                <div className="py-2"><PriorityBadge priority={editedLead.priority} /></div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Lead Type</label>
                                            <div className="py-2"><LeadTypeBadge type={editedLead.lead_type} /></div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Source</label>
                                        {isEditing ? (
                                            <select
                                                value={editedLead.source || ''}
                                                onChange={e => handleFieldChange('source', e.target.value)}
                                                className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900"
                                            >
                                                <option value="">Select Source</option>
                                                {Object.values(LeadSource).map(s => (
                                                    <option key={s} value={s}>
                                                        {LeadSourceDisplay[s]}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <p className="font-medium py-2 text-slate-900">
                                                {editedLead.source
                                                    ? // Prefer typed display label; fall back to handling legacy values (e.g. "WhatsApp")
                                                    (LeadSourceDisplay[editedLead.source as LeadSource] ||
                                                        (typeof editedLead.source === 'string' &&
                                                            editedLead.source.toLowerCase() === 'whatsapp'
                                                            ? 'WhatsApp'
                                                            : editedLead.source))
                                                    : 'N/A'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t">
                                    <h3 className="text-sm font-semibold text-slate-600 mb-2">Services Required</h3>
                                    {isEditing ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
                                            {Object.values(Service).map(service => (
                                                <label key={service} className="flex items-center space-x-2 text-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={editedLead.services?.includes(service)}
                                                        onChange={() => handleServiceToggle(service)}
                                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white"
                                                    />
                                                    <span className="text-slate-700">{service}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 py-2">
                                            {(editedLead.services?.length || 0) > 0 ? (
                                                editedLead.services!.map(service => (
                                                    <span key={service} className="px-2.5 py-1 text-sm font-medium rounded-md bg-slate-100 text-slate-700">
                                                        {service}
                                                    </span>
                                                ))
                                            ) : (
                                                <p className="text-sm text-slate-500 py-2">No services selected.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white p-4 sm:p-6 rounded-lg border border-slate-200">
                                <h3 className="font-semibold text-slate-700 mb-3 sm:mb-4 border-b pb-2 text-sm sm:text-base">Assignment & Sharing</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                                    {/* Assigned Staff */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Assigned Staff</label>
                                        {isEditing && canEditAssignedStaff ? (
                                            <div ref={staffDropdownRef} className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsStaffDropdownOpen(prev => !prev)}
                                                    className="w-full text-left p-2 border rounded-md bg-slate-50 min-h-[40px]"
                                                >
                                                    <AssignedToAvatars assignees={editedLead.assigned_to || []} />
                                                </button>
                                                {isStaffDropdownOpen && (
                                                    <div className="absolute top-full mt-1 w-full bg-white rounded-md shadow-lg border z-20">
                                                        <div className="p-2 border-b">
                                                            <div className="relative">
                                                                <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search staff..."
                                                                    value={staffSearchQuery}
                                                                    onChange={e => setStaffSearchQuery(e.target.value)}
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="w-full pl-8 pr-2 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                                    autoFocus
                                                                />
                                                            </div>
                                                        </div>
                                                        <ul className="max-h-48 overflow-y-auto">
                                                            {filteredStaffForDropdown.length > 0 ? filteredStaffForDropdown.map(s => (
                                                                <li key={s.id} onClick={() => {
                                                                    handleStaffToggle(s);
                                                                    setStaffSearchQuery('');
                                                                }} className="p-2 hover:bg-slate-100 cursor-pointer flex items-center justify-between">
                                                                    <div className="flex items-center gap-2">
                                                                        <img src={s.avatar_url} className="w-6 h-6 rounded-full" />
                                                                        <div className="flex flex-col">
                                                                            <span className="text-sm text-slate-900">{s.name}</span>
                                                                            <span className="text-xs text-slate-500">{branches.find(b => b.id === s.branch_id)?.name || 'Unknown Branch'}</span>
                                                                        </div>
                                                                    </div>
                                                                    {(editedLead.assigned_to || []).some(as => as.id === s.id) && <IconCheckCircle className="w-5 h-5 text-blue-600" />}
                                                                </li>
                                                            )) : (
                                                                <li className="p-2 text-sm text-slate-500 text-center">No staff found.</li>
                                                            )}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        ) : !isEditing ? (
                                            <div className="py-2">
                                                {(editedLead.assigned_to || []).length > 0 ? (
                                                    <div
                                                        className="flex -space-x-3 cursor-pointer group"
                                                        onClick={(e) => {
                                                            // If clicking on a specific avatar, open that staff member
                                                            const target = e.target as HTMLElement;
                                                            const img = target.closest('img');
                                                            if (img) {
                                                                const staffId = parseInt(img.getAttribute('data-staff-id') || '0');
                                                                const staffMember = (editedLead.assigned_to || []).find(s => s.id === staffId);
                                                                if (staffMember) {
                                                                    handleStaffClick(staffMember);
                                                                }
                                                            } else {
                                                                // If clicking on the container, open the first staff member
                                                                const firstStaff = (editedLead.assigned_to || [])[0];
                                                                if (firstStaff) {
                                                                    handleStaffClick(firstStaff);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        {(editedLead.assigned_to || []).slice(0, 3).map((staff, index) => (
                                                            <img
                                                                key={staff.id}
                                                                data-staff-id={staff.id}
                                                                className="h-8 w-8 rounded-full border-2 border-white hover:scale-110 transition-transform"
                                                                src={staff.avatar_url}
                                                                alt={staff.name}
                                                                title={staff.name}
                                                                style={{ zIndex: (editedLead.assigned_to || []).length - index }}
                                                            />
                                                        ))}
                                                        {(editedLead.assigned_to || []).length > 3 && (
                                                            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 border-2 border-white hover:scale-110 transition-transform" style={{ zIndex: 0 }}>
                                                                +{(editedLead.assigned_to || []).length - 3}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <AssignedToAvatars assignees={editedLead.assigned_to || []} />
                                                )}
                                            </div>
                                        ) : (
                                            <div className="py-2">
                                                <AssignedToAvatars assignees={editedLead.assigned_to || []} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Assigned Suppliers (Super Admin only) */}
                                    {currentUser.role === 'Super Admin' && (
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Assigned Suppliers</label>
                                            {isEditing && canContribute ? (
                                                <div ref={supplierDropdownRef} className="relative">
                                                    <button type="button" onClick={() => setIsSupplierDropdownOpen(prev => !prev)} className="w-full text-left p-2 border rounded-md bg-slate-50 min-h-[40px]">
                                                        <AssignedSuppliersAvatars suppliers={editedLead.assigned_suppliers || []} />
                                                    </button>
                                                    {isSupplierDropdownOpen && (
                                                        <div className="absolute top-full mt-1 w-full bg-white rounded-md shadow-lg border z-20 max-h-60 overflow-y-auto">
                                                            <ul>
                                                                {suppliers.map(s => (
                                                                    <li key={s.id} onClick={() => handleSupplierToggle(s)} className="p-2 hover:bg-slate-100 cursor-pointer flex items-center justify-between">
                                                                        <div className="flex items-center gap-2">
                                                                            <img src={s.contact_person_avatar_url || getDefaultAvatarUrl(s.company_name || 'Supplier', 24)} className="w-6 h-6 rounded-full" />
                                                                            <span className="text-sm">{s.company_name}</span>
                                                                        </div>
                                                                        {(editedLead.assigned_suppliers || []).some(as => as.id === s.id) && <IconCheckCircle className="w-5 h-5 text-blue-600" />}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="py-2">
                                                    <AssignedSuppliersAvatars suppliers={editedLead.assigned_suppliers || []} />
                                                </div>
                                            )}
                                        </div>
                                    )}



                                    {/* Share with Branches (HQ only) */}
                                    {isHQ && (
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Shared with Branches</label>
                                            {isEditing && (currentUser.role === 'Super Admin' || isLeadAdmin) ? (
                                                <div ref={branchDropdownRef} className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsBranchDropdownOpen(prev => !prev)}
                                                        className="w-full text-left p-2 border rounded-md bg-slate-50 min-h-[40px]"
                                                    >
                                                        <span className="text-sm text-slate-700">
                                                            {(editedLead.branch_ids || [])
                                                                .map(id => branches.find(b => b.id === id)?.name)
                                                                .filter(Boolean)
                                                                .join(', ') || 'Share...'}
                                                        </span>
                                                    </button>
                                                    {isBranchDropdownOpen && (
                                                        <div className="absolute top-full mt-1 w-full bg-white rounded-md shadow-lg border z-20 max-h-60 overflow-y-auto">
                                                            <ul>
                                                                {branches.map(branch => {
                                                                    const isBranch1 = branch.id === 1;
                                                                    const isSelected = (editedLead.branch_ids || []).includes(branch.id);
                                                                    return (
                                                                        <li
                                                                            key={branch.id}
                                                                            onClick={() => !isBranch1 && handleBranchToggle(branch.id)}
                                                                            className={`p-2 flex items-center justify-between ${isBranch1
                                                                                ? 'opacity-60 cursor-not-allowed bg-slate-50'
                                                                                : 'hover:bg-slate-100 cursor-pointer'
                                                                                }`}
                                                                        >
                                                                            <span className="text-sm text-slate-800">
                                                                                {branch.name} {isBranch1 && '(Required)'}
                                                                            </span>
                                                                            {isSelected && (
                                                                                <IconCheckCircle className="w-5 h-5 text-blue-600" />
                                                                            )}
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="py-2 text-sm text-slate-700">
                                                    {(editedLead.branch_ids || [])
                                                        .map(id => branches.find(b => b.id === id)?.name)
                                                        .filter(Boolean)
                                                        .join(', ') || 'None'}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>


                            {/* Section 2: Core Details */}
                            {!isForexOnly && (
                                <div className="bg-white p-4 sm:p-6 rounded-lg border border-slate-200">
                                    <h3 className="font-semibold text-slate-700 mb-3 sm:mb-4 border-b pb-2 text-sm sm:text-base">Core Trip Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Starting Point</label>
                                            {isEditing ? <input type="text" value={editedLead.starting_point || ''} onChange={e => handleFieldChange('starting_point', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900 placeholder:text-slate-400" /> : <p className="font-medium py-2 text-slate-900">{editedLead.starting_point || 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Destination</label>
                                            {isEditing ? (
                                                <>
                                                    <input
                                                        type="text"
                                                        list="lead-destination-datalist"
                                                        value={editedLead.destination || ''}
                                                        onChange={e => handleFieldChange('destination', e.target.value)}
                                                        placeholder="Select or type destination"
                                                        className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900 placeholder:text-slate-400"
                                                    />
                                                    <datalist id="lead-destination-datalist">
                                                        {(destinations || []).filter(d => d.name?.trim()).map(d => (
                                                            <option key={d.id} value={d.name} />
                                                        ))}
                                                    </datalist>
                                                </>
                                            ) : (
                                                <p className="font-medium py-2 text-slate-900">{editedLead.destination || 'N/A'}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Date of Travel</label>
                                            {isEditing ? <input type="date" value={editedLead.travel_date || ''} onChange={e => handleFieldChange('travel_date', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" /> : <p className="font-medium py-2 text-slate-900">{editedLead.travel_date && new Date(editedLead.travel_date).getFullYear() > 1970 ? new Date(editedLead.travel_date).toLocaleDateString() : 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Return Date</label>
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={editedLead.return_date || ''}
                                                    onChange={e => handleFieldChange('return_date', e.target.value)}
                                                    className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900"
                                                />
                                            ) : (
                                                <p className="font-medium py-2 text-slate-900">
                                                    {editedLead.return_date ? new Date(editedLead.return_date).toLocaleDateString() : 'N/A'}
                                                </p>
                                            )}
                                            {hasReturnMismatch && (
                                                <p className="text-xs text-red-600 mt-1">Duration & return date are not matching.</p>
                                            )}
                                        </div>
                                        {!isAirTicketingOnly && (
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">No. of days</label>
                                                {isEditing ? (
                                                    <div className="flex items-center gap-2">
                                                        <button type="button" onClick={() => { const d = parseDurationDays(editedLead.duration) || 1; if (d <= 1) return; handleFieldChange('duration', String(d - 1)); }} className="w-8 h-8 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 font-medium">−</button>
                                                        <span className="w-10 text-center text-sm font-semibold text-slate-900">{parseDurationDays(editedLead.duration) || 1}</span>
                                                        <button type="button" onClick={() => { const d = parseDurationDays(editedLead.duration) || 1; handleFieldChange('duration', String(d + 1)); }} className="w-8 h-8 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 font-medium">+</button>
                                                        <span className="text-xs text-slate-500">days</span>
                                                    </div>
                                                ) : (
                                                    <p className="font-medium py-2 text-slate-900">
                                                        {formatDurationToDays(editedLead.duration)}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        <div className="md:col-span-2">
                                            <h3 className="text-sm font-semibold text-slate-600 mb-2">Passenger Details</h3>
                                            {isEditing ? (
                                                <div className="space-y-3">
                                                    {showRoomDetails ? (
                                                        <>
                                                            {(editedLead.requirements?.rooms || []).map((room, index) => (
                                                                <div key={room.id} className="space-y-3">
                                                                    <div className="p-3 bg-slate-50 rounded-md border grid grid-cols-[1fr_auto] gap-4">
                                                                        <div>
                                                                            <div className="flex justify-between items-center">
                                                                                <p className="font-semibold text-slate-700">Room {index + 1}</p>
                                                                                <div className="flex items-center gap-2">
                                                                                    <p className="text-slate-600">Adults</p>
                                                                                    <div className="flex items-center gap-2 border rounded-md p-1 bg-white">
                                                                                        <button onClick={() => handleRoomChange(room.id, 'adults', -1)} className="w-6 h-6 rounded text-xl text-slate-600 hover:bg-slate-100">-</button>
                                                                                        <span className="w-8 text-center font-semibold">{room.adults}</span>
                                                                                        <button onClick={() => handleRoomChange(room.id, 'adults', 1)} className="w-6 h-6 rounded text-xl text-slate-600 hover:bg-slate-100">+</button>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <p className="text-slate-600">Children</p>
                                                                                    <div className="flex items-center gap-2 border rounded-md p-1 bg-white">
                                                                                        <button onClick={() => handleRoomChange(room.id, 'children', -1)} className="w-6 h-6 rounded text-xl text-slate-600 hover:bg-slate-100">-</button>
                                                                                        <span className="w-8 text-center font-semibold">{room.children}</span>
                                                                                        <button onClick={() => handleRoomChange(room.id, 'children', 1)} className="w-6 h-6 rounded text-xl text-slate-600 hover:bg-slate-100">+</button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center">
                                                                            {(editedLead.requirements?.rooms?.length || 0) > 1 && (
                                                                                <button onClick={() => removeRoom(room.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50"><IconTrash className="w-4 h-4" /></button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    {room.children > 0 && (
                                                                        <div className="ml-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                                                                            <p className="text-sm font-semibold text-blue-900 mb-3">Children Ages</p>
                                                                            <div className="space-y-2">
                                                                                {Array.from({ length: room.children }).map((_, childIndex) => (
                                                                                    <div key={childIndex} className="flex justify-between items-center">
                                                                                        <label className="block text-xs font-medium text-slate-500">Child {childIndex + 1} Age:</label>
                                                                                        <div className="flex items-center gap-2 border rounded-md p-1 bg-white">
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    const currentAgeValue = room.child_ages?.[childIndex];
                                                                                                    const currentAge = typeof currentAgeValue === 'number' ? currentAgeValue : (parseInt(String(currentAgeValue || '1')) || 1);
                                                                                                    const newAge = Math.max(1, currentAge - 1);
                                                                                                    handleChildAgeChange(room.id, childIndex, String(newAge));
                                                                                                }}
                                                                                                className="w-6 h-6 rounded text-xl text-slate-600 hover:bg-slate-100"
                                                                                            >-</button>
                                                                                            <span className="w-8 text-center font-semibold">{String(room.child_ages?.[childIndex] || '1')}</span>
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    const currentAgeValue = room.child_ages?.[childIndex];
                                                                                                    const currentAge = typeof currentAgeValue === 'number' ? currentAgeValue : (parseInt(String(currentAgeValue || '1')) || 1);
                                                                                                    const newAge = Math.min(18, currentAge + 1);
                                                                                                    handleChildAgeChange(room.id, childIndex, String(newAge));
                                                                                                }}
                                                                                                className="w-6 h-6 rounded text-xl text-slate-600 hover:bg-slate-100"
                                                                                            >+</button>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            <button onClick={addRoom} className="px-3 py-1 text-xs font-medium text-white bg-slate-700 rounded-md hover:bg-slate-800">+ Add Room</button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="p-3 bg-slate-50 rounded-md border grid grid-cols-2 gap-4">
                                                                <div className="flex justify-between items-center">
                                                                    <p className="text-slate-600">Adults</p>
                                                                    <div className="flex items-center gap-2 border rounded-md p-1 bg-white">
                                                                        <button onClick={() => handleSimplifiedPaxChange('adults', -1)} className="w-6 h-6 rounded text-xl text-slate-600 hover:bg-slate-100">-</button>
                                                                        <span className="w-8 text-center font-semibold">{(editedLead.requirements?.rooms || [])[0]?.adults || 0}</span>
                                                                        <button onClick={() => handleSimplifiedPaxChange('adults', 1)} className="w-6 h-6 rounded text-xl text-slate-600 hover:bg-slate-100">+</button>
                                                                    </div>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <p className="text-slate-600">Children</p>
                                                                    <div className="flex items-center gap-2 border rounded-md p-1 bg-white">
                                                                        <button onClick={() => handleSimplifiedPaxChange('children', -1)} className="w-6 h-6 rounded text-xl text-slate-600 hover:bg-slate-100">-</button>
                                                                        <span className="w-8 text-center font-semibold">{(editedLead.requirements?.rooms || [])[0]?.children || 0}</span>
                                                                        <button onClick={() => handleSimplifiedPaxChange('children', 1)} className="w-6 h-6 rounded text-xl text-slate-600 hover:bg-slate-100">+</button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {((editedLead.requirements?.rooms || [])[0]?.children || 0) > 0 && (
                                                                <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                                                                    <p className="text-sm font-semibold text-blue-900 mb-3">Children Ages</p>
                                                                    <div className="space-y-2">
                                                                        {Array.from({ length: (editedLead.requirements?.rooms || [])[0]?.children || 0 }).map((_, index) => {
                                                                            const firstRoom = (editedLead.requirements?.rooms || [])[0];
                                                                            const currentAgeValue = firstRoom?.child_ages?.[index];
                                                                            const currentAge = typeof currentAgeValue === 'number' ? currentAgeValue : (parseInt(String(currentAgeValue || '1')) || 1);
                                                                            return (
                                                                                <div key={index} className="flex justify-between items-center">
                                                                                    <label className="block text-xs font-medium text-slate-500">Child {index + 1} Age:</label>
                                                                                    <div className="flex items-center gap-2 border rounded-md p-1 bg-white">
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                const newAge = Math.max(1, currentAge - 1);
                                                                                                handleChildAgeChange(null, index, String(newAge));
                                                                                            }}
                                                                                            className="w-6 h-6 rounded text-xl text-slate-600 hover:bg-slate-100"
                                                                                        >-</button>
                                                                                        <span className="w-8 text-center font-semibold">{String(firstRoom?.child_ages?.[index] || '1')}</span>
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                const newAge = Math.min(18, currentAge + 1);
                                                                                                handleChildAgeChange(null, index, String(newAge));
                                                                                            }}
                                                                                            className="w-6 h-6 rounded text-xl text-slate-600 hover:bg-slate-100"
                                                                                        >+</button>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="py-2 space-y-2">
                                                    {(editedLead.requirements?.rooms && editedLead.requirements.rooms.length > 0) ? (
                                                        <>
                                                            {editedLead.requirements.rooms.map((room, index) => {
                                                                const adults = room.adults || 0;
                                                                const children = room.children || 0;
                                                                const adultText = adults === 1 ? 'Adult' : 'Adults';
                                                                const childText = children === 1 ? 'Child' : 'Children';

                                                                // Format child ages if available
                                                                let childAgesText = '';
                                                                if (room.child_ages && room.child_ages.length > 0) {
                                                                    const validAges = room.child_ages.filter(age => age !== undefined && age !== null);
                                                                    if (validAges.length > 0) {
                                                                        childAgesText = ` (${validAges.map(age => `${age} years`).join(', ')})`;
                                                                    }
                                                                }

                                                                return (
                                                                    <p key={room.id} className="text-slate-900">
                                                                        <span className="font-medium">Room {index + 1}:</span> {adults} {adultText}, {children} {childText}{childAgesText}
                                                                    </p>
                                                                );
                                                            })}
                                                        </>
                                                    ) : (
                                                        <p className="text-slate-500 italic">N/A - Please fill passenger details</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Section 3: Service-Specifics */}
                            {editedLead.services?.includes(Service.AirTicketing) && (
                                <div className="bg-white p-6 rounded-lg border border-slate-200">
                                    <h3 className="font-semibold text-slate-700 mb-4 border-b pb-2">✈️ Air Ticket Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Tour Region</label>
                                            {isEditing ? (
                                                <select value={editedLead.tour_region || ''} onChange={e => handleFieldChange('tour_region', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900">
                                                    <option value="">Select Region</option>
                                                    {Object.values(TourRegion).map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            ) : <p className="font-medium py-2 text-slate-900">{editedLead.tour_region || 'N/A'}</p>}
                                        </div>
                                        <div className="flex items-end gap-6">
                                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editedLead.is_flexible_dates} onChange={e => handleFieldChange('is_flexible_dates', e.target.checked)} disabled={!isEditing} className="h-4 w-4 rounded" /> Travel dates flexible</label>
                                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editedLead.is_return_ticket} onChange={e => handleFieldChange('is_return_ticket', e.target.checked)} disabled={!isEditing} className="h-4 w-4 rounded" /> Return Ticket</label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {editedLead.services?.includes(Service.Visa) && (
                                <div className="bg-white p-6 rounded-lg border border-slate-200">
                                    <h3 className="font-semibold text-slate-700 mb-4 border-b pb-2">🛂 Visa Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Select Visa</label>
                                            {isEditing ? (
                                                <select
                                                    value={editedLead.visa_id || ''}
                                                    onChange={e => handleFieldChange('visa_id', e.target.value ? parseInt(e.target.value) : undefined)}
                                                    className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900"
                                                >
                                                    <option value="">Select a visa...</option>
                                                    {visas.map(v => (
                                                        <option key={v.id} value={v.id}>{v.visa_name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div>
                                                    {editedLead.visa_id ? (
                                                        <button
                                                            onClick={() => {
                                                                const visa = visas.find(v => v.id === editedLead.visa_id);
                                                                if (visa) {
                                                                    setSelectedVisaForView(visa);
                                                                    setIsVisaDrawerOpen(true);
                                                                }
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800 font-medium py-2 underline"
                                                        >
                                                            {visas.find(v => v.id === editedLead.visa_id)?.visa_name || 'View Visa'}
                                                        </button>
                                                    ) : (
                                                        <p className="font-medium py-2 text-slate-900">No visa selected</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Type of Visa</label>
                                            {isEditing ? <select value={editedLead.visa_type || ''} onChange={e => handleFieldChange('visa_type', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900">{Object.values(VisaType).map(v => <option key={v} value={v}>{v}</option>)}</select> : <p className="font-medium py-2 text-slate-900">{editedLead.visa_type || 'N/A'}</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {editedLead.services?.includes(Service.HotelBooking) && (
                                <div className="bg-white p-6 rounded-lg border border-slate-200">
                                    <h3 className="font-semibold text-slate-700 mb-4 border-b pb-2">🏨 Hotel Details</h3>
                                    <HotelStaysEditor
                                        stays={editedLead.hotel_stays || []}
                                        onChange={(stays) => handleFieldChange('hotel_stays', stays)}
                                        isEditing={isEditing}
                                    />
                                </div>
                            )}

                            {editedLead.services?.includes(Service.Tour) && (
                                <div className="bg-white p-6 rounded-lg border border-slate-200">
                                    <h3 className="font-semibold text-slate-700 mb-4 border-b pb-2">🧳 Tour Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Tour Region</label>
                                            {isEditing ? <select value={editedLead.tour_region || ''} onChange={e => handleFieldChange('tour_region', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900"><option value="">Select Region</option>{Object.values(TourRegion).map(t => <option key={t} value={t}>{t}</option>)}</select> : <p className="font-medium py-2 text-slate-900">{editedLead.tour_region || 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Tour Type</label>
                                            {isEditing ? <select value={editedLead.tour_type || ''} onChange={e => handleFieldChange('tour_type', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900">{Object.values(TourType).map(t => <option key={t} value={t}>{TourTypeDisplay[t]}</option>)}</select> : <p className="font-medium py-2 text-slate-900">{editedLead.tour_type ? TourTypeDisplay[editedLead.tour_type] : 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Budget Per Person</label>
                                            {isEditing ? (
                                                <div>
                                                    <select
                                                        value={typeof editedLead.budget === 'string' ? editedLead.budget : ''}
                                                        onChange={e => {
                                                            const value = e.target.value;
                                                            if (value === 'economical' || value === 'standard' || value === 'deluxe' || value === 'luxury' || value === 'budget') {
                                                                // Normalize "budget" to "economical" for consistency
                                                                handleFieldChange('budget', value === 'budget' ? 'economical' : value);
                                                            } else {
                                                                handleFieldChange('budget', null);
                                                            }
                                                        }}
                                                        className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900 mb-2"
                                                    >
                                                        <option value="">Select Budget Category</option>
                                                        {BUDGET_OPTIONS.map(option => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label} - {option.description}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2 text-slate-500">₹</span>
                                                        <input
                                                            type="number"
                                                            value={typeof editedLead.budget === 'number' ? editedLead.budget : ''}
                                                            onChange={e => {
                                                                const value = e.target.value;
                                                                if (value === '') {
                                                                    handleFieldChange('budget', null);
                                                                } else {
                                                                    const numValue = parseInt(value);
                                                                    if (!isNaN(numValue)) {
                                                                        handleFieldChange('budget', numValue);
                                                                    }
                                                                }
                                                            }}
                                                            placeholder="Or enter numeric value"
                                                            className="w-full text-sm p-2 pl-7 border rounded-md bg-slate-50 text-slate-900"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-2">
                                                    <p className="font-medium text-slate-900">
                                                        {getBudgetDisplayLabel(editedLead.budget)}
                                                    </p>
                                                    {getBudgetDescription(editedLead.budget) && (
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            {getBudgetDescription(editedLead.budget)}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {editedLead.services?.includes(Service.Passport) && (
                                <div className="bg-white p-6 rounded-lg border border-slate-200">
                                    <h3 className="font-semibold text-slate-700 mb-4 border-b pb-2">🪪 Passport Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Service Type</label>
                                            {isEditing ? <select value={editedLead.passport_service_type || ''} onChange={e => handleFieldChange('passport_service_type', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900">{Object.values(PassportServiceType).map(t => <option key={t} value={t}>{t}</option>)}</select> : <p className="font-medium py-2 text-slate-900">{editedLead.passport_service_type || 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">City of Residence</label>
                                            {isEditing ? <input type="text" value={editedLead.passport_city_of_residence || ''} onChange={e => handleFieldChange('passport_city_of_residence', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" /> : <p className="font-medium py-2 text-slate-900">{editedLead.passport_city_of_residence || 'N/A'}</p>}
                                        </div>
                                        {editedLead.passport_service_type === 'Renewal' && (
                                            <>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Passport Number</label>
                                                    {isEditing ? <input type="text" value={editedLead.passport_number || ''} onChange={e => handleFieldChange('passport_number', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" placeholder="e.g., A1234567" /> : <p className="font-medium py-2 text-slate-900">{editedLead.passport_number || 'N/A'}</p>}
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-500 mb-1">Passport Expiry Date</label>
                                                    {isEditing ? <input type="date" value={editedLead.passport_expiry_date || ''} onChange={e => handleFieldChange('passport_expiry_date', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" /> : <p className="font-medium py-2 text-slate-900">{editedLead.passport_expiry_date ? new Date(editedLead.passport_expiry_date).toLocaleDateString() : 'N/A'}</p>}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {editedLead.services?.includes(Service.ForEx) && (
                                <div className="bg-white p-6 rounded-lg border border-slate-200">
                                    <h3 className="font-semibold text-slate-700 mb-4 border-b pb-2">💱 Forex Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Currency You Have</label>
                                            {isEditing ? <input type="text" value={editedLead.forex_currency_have || ''} onChange={e => handleFieldChange('forex_currency_have', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" placeholder="e.g. INR" /> : <p className="font-medium py-2 text-slate-900">{editedLead.forex_currency_have || 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Currency Required</label>
                                            {isEditing ? <input type="text" value={editedLead.forex_currency_required || ''} onChange={e => handleFieldChange('forex_currency_required', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" placeholder="e.g. USD" /> : <p className="font-medium py-2 text-slate-900">{editedLead.forex_currency_required || 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Amount</label>
                                            {isEditing ? <input type="number" value={editedLead.amount || ''} onChange={e => handleFieldChange('amount', parseFloat(e.target.value))} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" placeholder="e.g., 1000" /> : <p className="font-medium py-2 text-slate-900">{editedLead.amount || 'N/A'}</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {editedLead.services?.includes(Service.Transport) && (
                                <div className="bg-white p-6 rounded-lg border border-slate-200">
                                    <h3 className="font-semibold text-slate-700 mb-4 border-b pb-2">🚗 Transport Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Pickup Location</label>
                                            {isEditing ? <input type="text" value={editedLead.pickup_location || ''} onChange={e => handleFieldChange('pickup_location', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" placeholder="e.g., Airport, Hotel Name" /> : <p className="font-medium py-2 text-slate-900">{editedLead.pickup_location || 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Drop-off Location</label>
                                            {isEditing ? <input type="text" value={editedLead.dropoff_location || ''} onChange={e => handleFieldChange('dropoff_location', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" placeholder="e.g., Hotel, City Center" /> : <p className="font-medium py-2 text-slate-900">{editedLead.dropoff_location || 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Vehicle Type</label>
                                            {isEditing ? <select value={editedLead.vehicle_type || ''} onChange={e => handleFieldChange('vehicle_type', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900">
                                                <option value="">Select Vehicle Type</option>
                                                <option value="Sedan">Sedan</option>
                                                <option value="SUV">SUV</option>
                                                <option value="Van">Van</option>
                                                <option value="Bus">Bus</option>
                                                <option value="Luxury">Luxury</option>
                                            </select> : <p className="font-medium py-2 text-slate-900">{editedLead.vehicle_type || 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Number of Passengers</label>
                                            {isEditing ? <input type="number" value={editedLead.passengers || ''} onChange={e => handleFieldChange('passengers', parseInt(e.target.value))} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" min="1" /> : <p className="font-medium py-2 text-slate-900">{editedLead.passengers || 'N/A'}</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {editedLead.services?.includes(Service.MICE) && (
                                <div className="bg-white p-6 rounded-lg border border-slate-200">
                                    <h3 className="font-semibold text-slate-700 mb-4 border-b pb-2">🎯 MICE Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Event Type</label>
                                            {isEditing ? <input type="text" value={editedLead.event_type || ''} onChange={e => handleFieldChange('event_type', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" placeholder="e.g., Conference, Meeting, Exhibition" /> : <p className="font-medium py-2 text-slate-900">{editedLead.event_type || 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Event Date</label>
                                            {isEditing ? <input type="date" value={editedLead.event_date || ''} onChange={e => handleFieldChange('event_date', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" /> : <p className="font-medium py-2 text-slate-900">{editedLead.event_date ? new Date(editedLead.event_date).toLocaleDateString() : 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Number of Attendees</label>
                                            {isEditing ? <input type="number" value={editedLead.attendees || ''} onChange={e => handleFieldChange('attendees', parseInt(e.target.value))} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" min="1" placeholder="50" /> : <p className="font-medium py-2 text-slate-900">{editedLead.attendees || 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Venue Location</label>
                                            {isEditing ? <input type="text" value={editedLead.venue_location || ''} onChange={e => handleFieldChange('venue_location', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" placeholder="e.g., Mumbai" /> : <p className="font-medium py-2 text-slate-900">{editedLead.venue_location || 'N/A'}</p>}
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Special Requirements</label>
                                            {isEditing ? <textarea value={editedLead.mice_requirements || ''} onChange={e => handleFieldChange('mice_requirements', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" rows={3} placeholder="Any special requirements or notes..." /> : <p className="font-medium py-2 text-slate-900 whitespace-pre-wrap">{editedLead.mice_requirements || 'N/A'}</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {editedLead.services?.includes(Service.Insurance) && (
                                <div className="bg-white p-6 rounded-lg border border-slate-200">
                                    <h3 className="font-semibold text-slate-700 mb-4 border-b pb-2">🛡️ Insurance Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Insurance Type</label>
                                            {isEditing ? <select value={editedLead.insurance_type || ''} onChange={e => handleFieldChange('insurance_type', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900">
                                                <option value="">Select Insurance Type</option>
                                                <option value="Travel Insurance">Travel Insurance</option>
                                                <option value="Health Insurance">Health Insurance</option>
                                                <option value="Trip Cancellation">Trip Cancellation</option>
                                                <option value="Baggage Insurance">Baggage Insurance</option>
                                            </select> : <p className="font-medium py-2 text-slate-900">{editedLead.insurance_type || 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Number of Travelers</label>
                                            {isEditing ? <input type="number" value={editedLead.travelers || ''} onChange={e => handleFieldChange('travelers', parseInt(e.target.value))} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" min="1" placeholder="1" /> : <p className="font-medium py-2 text-slate-900">{editedLead.travelers || 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Travel Start Date</label>
                                            {isEditing ? <input type="date" value={editedLead.travel_date || ''} onChange={e => handleFieldChange('travel_date', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" /> : <p className="font-medium py-2 text-slate-900">{editedLead.travel_date ? new Date(editedLead.travel_date).toLocaleDateString() : 'N/A'}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Travel End Date</label>
                                            {isEditing ? <input type="date" value={editedLead.return_date || ''} onChange={e => handleFieldChange('return_date', e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900" /> : <p className="font-medium py-2 text-slate-900">{editedLead.return_date ? new Date(editedLead.return_date).toLocaleDateString() : 'N/A'}</p>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="space-y-4 min-w-0">
                            <div className="flex items-start gap-3 w-full">
                                <img src={currentUser.avatar_url} alt={currentUser.name} className="h-8 w-8 rounded-full shrink-0" />
                                <div className="flex-1 relative min-w-0">
                                    <textarea
                                        value={newNote}
                                        onChange={handleNoteChange}
                                        onKeyDown={handleNoteKeyDown}
                                        placeholder="Add a new note... Type '@' to mention staff."
                                        className="w-full text-sm p-2 border rounded-md"
                                        rows={3}
                                    ></textarea>
                                    {isMentioning && filteredMentionStaff.length > 0 && (
                                        <div className="absolute top-full left-0 mt-1 w-full max-w-xs bg-white rounded-md shadow-lg border z-20 max-h-48 overflow-y-auto">
                                            {filteredMentionStaff.map((staffMember, index) => (
                                                <div
                                                    key={staffMember.id}
                                                    onClick={() => handleSelectMention(staffMember)}
                                                    className={`flex items-center gap-2 p-2 cursor-pointer ${index === mentionIndex ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                                                >
                                                    <img src={staffMember.avatar_url} alt={staffMember.name} className="w-6 h-6 rounded-full" />
                                                    <span className="text-sm font-medium text-slate-800">{staffMember.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="text-right mt-2">
                                        <button onClick={handleAddNote} className="px-4 py-1.5 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">Add Note</button>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {(editedLead.notes || []).slice().reverse().map(note => (
                                    <div key={note.id} className="group p-3 sm:p-4 bg-white rounded-md border shadow-sm relative min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                            <div className="flex-1 min-w-0 break-words">
                                                {renderNoteText(note)}
                                                <div className="flex items-center gap-2 mt-2">
                                                    <img src={note.addedBy.avatar_url} alt={note.addedBy.name} className="w-5 h-5 rounded-full" />
                                                    <p className="text-xs text-slate-600">{note.addedBy.name}</p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-400 shrink-0 sm:ml-4">{new Date(note.date).toLocaleDateString()}</p>
                                        </div>
                                        {isEditing && (
                                            <button onClick={() => handleDeleteNote(note.id)} className="absolute top-2 right-2 p-1 rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100">
                                                <IconTrash className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'activity' && <ActivityTimeline activities={editedLead.activity || []} />}

                    {activeTab === 'tasks' && !isNewLead && editedLead.id != null && (
                        <LeadTasksTab
                            leadId={editedLead.id}
                            currentUser={currentUser}
                            tasks={tasks}
                            staff={staff}
                            fetchTasks={fetchTasks}
                            addToast={addToast}
                            onOpenNewTask={openTaskDrawer}
                            onOpenTask={openTaskDrawerForTask}
                        />
                    )}

                    {activeTab === 'documents' && (
                        <div className="space-y-4 min-w-0">
                            {primaryCustomerForDisplay ? (
                                <>
                                    <VersionedDocumentDisplay
                                        title="Passports"
                                        docType="passports"
                                        documents={editedCustomer?.documents?.passports || primaryCustomerForDisplay.documents?.passports || []}
                                        isEditing={!!isEditing}
                                        onUpload={handleFileUpload}
                                        onCameraScan={handleOpenCamera}
                                        onDelete={handleDeleteDocument}
                                        isMandatoryMissing={isPassportMissing}
                                        mandatoryMessage="Passport is mandatory for international trips."
                                    />
                                    <VersionedDocumentDisplay
                                        title="Aadhaar Cards"
                                        docType="aadhaarCards"
                                        documents={editedCustomer?.documents?.aadhaarCards || primaryCustomerForDisplay.documents?.aadhaarCards || []}
                                        isEditing={!!isEditing}
                                        onUpload={handleFileUpload}
                                        onCameraScan={handleOpenCamera}
                                        onDelete={handleDeleteDocument}
                                        isMandatoryMissing={isAadhaarMissing}
                                        mandatoryMessage="Aadhaar is mandatory for domestic trips."
                                    />
                                    <MultiDocumentDisplay
                                        title="PAN Cards"
                                        docType="panCards"
                                        documents={editedCustomer?.documents?.panCards || primaryCustomerForDisplay.documents?.panCards || []}
                                        isEditing={!!isEditing}
                                        onUpload={handleFileUpload}
                                        onCameraScan={handleOpenCamera}
                                        onDelete={handleDeleteDocument}
                                    />
                                    <MultiDocumentDisplay
                                        title="Bank Statements"
                                        docType="bankStatements"
                                        documents={editedCustomer?.documents?.bankStatements || primaryCustomerForDisplay.documents?.bankStatements || []}
                                        isEditing={!!isEditing}
                                        onUpload={handleFileUpload}
                                        onCameraScan={handleOpenCamera}
                                        onDelete={handleDeleteDocument}
                                    />
                                    <MultiDocumentDisplay
                                        title="Other Documents"
                                        docType="otherDocuments"
                                        documents={editedCustomer?.documents?.otherDocuments || primaryCustomerForDisplay.documents?.otherDocuments || []}
                                        isEditing={!!isEditing}
                                        onUpload={handleFileUpload}
                                        onCameraScan={handleOpenCamera}
                                        onDelete={handleDeleteDocument}
                                    />
                                </>
                            ) : (
                                <p className="text-sm text-slate-500">Select a customer to view and manage documents.</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'invoices' && (
                        <div className="space-y-4 min-w-0">
                            {!isNewLead && (
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Invoices</h3>
                                    {leadInvoices.length > 0 ? (
                                        <div className="space-y-3">
                                            {leadInvoices.map(inv => {
                                                const preparedByStaff = inv.created_by_staff_id && staff?.length ? staff.find(s => s.id === inv.created_by_staff_id) : null;
                                                return (
                                                <div
                                                    key={inv.id}
                                                    onClick={() => setOpenInvoiceId(inv.id)}
                                                    className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 cursor-pointer hover:shadow-md hover:border-blue-500 transition-all"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-bold text-blue-600 truncate">{inv.invoice_number}</p>
                                                        <p className="text-sm text-slate-500">Date: {new Date(inv.issue_date).toLocaleDateString()}</p>
                                                        {(preparedByStaff || inv.created_by_staff_id) && (
                                                            <div className="flex items-center gap-2 mt-2">
                                                                {preparedByStaff ? (
                                                                    <>
                                                                        <img src={preparedByStaff.avatar_url || getDefaultAvatarUrl(preparedByStaff.name || 'Staff', 24)} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                                                                        <span className="text-xs text-slate-500">Prepared by {preparedByStaff.name}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-xs text-slate-400">Prepared by —</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:text-right shrink-0">
                                                        <p className="font-bold text-slate-900">₹{inv.total_amount.toLocaleString()}</p>
                                                        <StatusBadge status={inv.status} />
                                                    </div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    ) : <p className="text-center text-slate-500 py-4">No invoices created yet.</p>}
                                    <button onClick={handleCreateInvoice} className="mt-3 w-full py-2 border-2 border-dashed border-slate-300 rounded-md text-slate-500 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                                        <IconPlus className="w-4 h-4" /> Create Invoice
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'itinerary' && (
                        <div className="space-y-4 min-w-0">
                            {leadItineraries.length > 0 && (
                                <div className="space-y-3">
                                    {leadItineraries.map(itinerary => (
                                        <div key={itinerary.id} className="p-3 sm:p-4 bg-emerald-50 rounded-lg border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-emerald-900 line-clamp-1">
                                                    {itinerary.creative_title} • {formatDurationToDays(itinerary.duration)}
                                                </p>
                                                {itinerary.destination && (
                                                    <p className="text-xs text-emerald-700 mt-1">Destination: {itinerary.destination}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleViewItinerary(itinerary.id)}
                                                    className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleArchiveItinerary(itinerary.id);
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                                                    title="Archive itinerary (removes from this list)"
                                                    type="button"
                                                >
                                                    Archive
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Link Existing Itinerary */}
                            <div className="flex flex-col sm:flex-row gap-2">
                                <LinkItineraryModal
                                    itineraries={itineraries.filter(i => !(editedLead.itinerary_ids || []).includes(i.id))}
                                    onLink={handleLinkItinerary}
                                />
                                <button
                                    onClick={handleCreateItinerary}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                                >
                                    Create New Itinerary
                                </button>
                            </div>

                            {leadItineraries.length === 0 && (
                                <div className="text-center py-8 bg-white rounded-lg border border-dashed border-slate-300">
                                    <p className="text-slate-500 mb-4">No itineraries linked to this lead.</p>
                                    <p className="text-xs text-slate-400 mb-4">Link an existing itinerary or create a new one.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'costing' && lead && (
                        <div className="min-h-0">
                        <LeadCostingPanel
                            lead={lead}
                            customer={primaryCustomer || undefined}
                            currentUser={currentUser}
                            staff={staff}
                            itineraries={leadItineraries}
                            onNavigate={onNavigate}
                            onUpdateActivity={(activity) => {
                                setEditedLead(prev => ({
                                    ...prev,
                                    activity: [...(prev?.activity || []), activity]
                                }));
                                // Also update the lead's activity in the database
                                const updateLeadActivity = async () => {
                                    if (!lead?.id) return;
                                    try {
                                        const currentActivity = editedLead.activity || [];
                                        const { error } = await supabase
                                            .from('leads')
                                            .update({ activity: [...currentActivity, activity] })
                                            .eq('id', lead.id);
                                        if (error) throw error;
                                    } catch (error: any) {
                                        console.error('Error updating activity:', error);
                                    }
                                };
                                updateLeadActivity();
                            }}
                            refreshData={refreshData}
                        />
                        </div>
                    )}


                    </div>
                </div>

                {isEditing && (
                    <div className="p-3 sm:p-4 bg-white border-t flex justify-between items-center gap-3 z-30 sticky bottom-0 shrink-0">
                        <div className="text-xs text-slate-500 truncate min-w-0">
                            {isSaving ? 'Saving changes...' : 'Unsaved changes'}
                        </div>
                        <button onClick={handleSave} disabled={isSaving} className="px-4 sm:px-6 py-2.5 sm:py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c] disabled:bg-slate-400 min-w-[100px] min-h-[44px] sm:min-h-0 touch-manipulation shrink-0">
                            {isSaving ? 'Saving...' : (isNewLead ? 'Create Lead' : 'Save Changes')}
                        </button>
                    </div>
                )}
            </div>

            {isNewCustomerPanelOpen && (
                <CustomerDetailPanel
                    customer={null}
                    leads={[]}
                    allLeads={leads}
                    allCustomers={customers}
                    onClose={() => setIsNewCustomerPanelOpen(false)}
                    onSave={handleNewCustomerSave}
                    onUpdate={async () => false}
                    currentUser={currentUser}
                    branches={branches}
                    staff={staff}
                    onSelectLead={onSelectLead}
                />
            )}
            {isCustomerPanelOpen && primaryCustomer && (
                <CustomerDetailPanel
                    customer={primaryCustomer}
                    leads={customerLeads}
                    allLeads={leads}
                    allCustomers={customers}
                    onClose={() => setIsCustomerPanelOpen(false)}
                    onSave={async () => { }}
                    onUpdate={onUpdateCustomer}
                    currentUser={currentUser}
                    branches={branches}
                    staff={staff}
                    onSelectLead={onSelectLead}
                />
            )}

            {((openInvoiceId != null && selectedInvoiceForDrawer) || (openNewInvoiceDrawer && lead)) && invoiceForDrawer !== null && (
                <InvoiceDetailPanel
                    invoice={invoiceForDrawer}
                    onClose={() => { setOpenInvoiceId(null); setOpenNewInvoiceDrawer(false); }}
                    onSave={handleSaveInvoiceInLead}
                    onDelete={setInvoiceToDelete}
                    customers={customers}
                    leads={leads}
                    itineraries={itineraries}
                    payments={payments ?? []}
                    onRefresh={async () => { await fetchInvoices(true); await refreshData(); }}
                    currentUser={currentUser}
                />
            )}
            {invoiceToDelete != null && (
                <ConfirmationModal
                    title="Delete Invoice"
                    message="Are you sure you want to permanently delete this draft invoice? This action cannot be undone."
                    onConfirm={confirmDeleteInvoiceInLead}
                    onCancel={() => setInvoiceToDelete(null)}
                />
            )}

            {/* Rejected Lead Reason Modal */}
            {showRejectedModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-40 flex items-start justify-end pt-8 pr-4 sm:pr-6 z-50"
                    onClick={(e) => {
                        e.stopPropagation(); // prevent bubbling to detail panel
                        handleRejectedModalCancel();
                    }}
                >
                    <div
                        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Mark Lead as Rejected
                                </h3>
                                <button
                                    onClick={handleRejectedModalCancel}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <IconX className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">
                                Please provide a reason for marking this lead as rejected. This will be logged in the lead's activity.
                            </p>
                            <textarea
                                value={rejectedReason}
                                onChange={(e) => setRejectedReason(e.target.value)}
                                placeholder="Enter reason (e.g., Duplicate enquiry, Invalid contact, Not serviceable, etc.)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                rows={4}
                                autoFocus
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={handleRejectedModalCancel}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRejectedReasonSubmit}
                                    className="px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-md hover:bg-[#13135c]"
                                >
                                    Submit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Staff Assignment Reason Modal */}
            {(showAssignmentReasonPopup && pendingStaffAssignment) && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleCancelAssignmentReason();
                    }}
                >
                    <div
                        className="bg-white rounded-lg shadow-xl max-w-md w-full"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Assign Staff Member
                                </h3>
                                <button
                                    onClick={handleCancelAssignmentReason}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <IconX className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                                Assigning: <span className="font-semibold">{pendingStaffAssignment.name}</span>
                            </p>
                            <p className="text-sm text-gray-600 mb-4">
                                Please provide a reason for this assignment. This will be added as a note.
                            </p>
                            <textarea
                                value={assignmentReason}
                                onChange={(e) => setAssignmentReason(e.target.value)}
                                placeholder="Enter reason for assignment (e.g., Customer requested, Expertise in destination, Availability, etc.)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                rows={4}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        handleConfirmAssignmentReason();
                                    }
                                }}
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={handleCancelAssignmentReason}
                                    disabled={isAssigning}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmAssignmentReason}
                                    disabled={!assignmentReason.trim() || isAssigning}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed min-w-[130px]"
                                >
                                    {isAssigning ? 'Assigning…' : 'Assign & Add Note'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Unqualified Lead Reason Modal */}
            {showUnqualifiedModal && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-40 flex items-start justify-end pt-8 pr-4 sm:pr-6 z-50"
                    onClick={(e) => {
                        e.stopPropagation(); // prevent bubbling to detail panel
                        handleUnqualifiedModalCancel();
                    }}
                >
                    <div
                        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Mark Lead as Unqualified
                                </h3>
                                <button
                                    onClick={handleUnqualifiedModalCancel}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <IconX className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">
                                Please provide a reason for marking this lead as unqualified. This will be logged in the lead's activity.
                            </p>
                            <textarea
                                value={unqualifiedReason}
                                onChange={(e) => setUnqualifiedReason(e.target.value)}
                                placeholder="Enter reason (e.g., Customer did not pick up call, Not interested, Budget mismatch, etc.)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                rows={4}
                                autoFocus
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={handleUnqualifiedModalCancel}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUnqualifiedReasonSubmit}
                                    className="px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-md hover:bg-[#13135c]"
                                >
                                    Submit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {isCameraModalOpen && cameraDocType && (
                <CameraScanModal
                    onCapture={handleCapture}
                    onClose={() => setIsCameraModalOpen(false)}
                    docType={cameraDocType}
                />
            )}
            {isVisaDrawerOpen && selectedVisaForView && (
                <VisaDetailDrawer
                    visa={selectedVisaForView}
                    onClose={() => {
                        setIsVisaDrawerOpen(false);
                        setSelectedVisaForView(null);
                    }}
                />
            )}
            {isStaffPanelOpen && selectedStaff && (
                <StaffDetailDrawer
                    staffMember={selectedStaff}
                    branches={branches}
                    onClose={handleStaffPanelClose}
                    isPanelOpen={isStaffPanelOpen}
                    isPanelClosing={isStaffPanelClosing}
                />
            )}
        </div>
    );
};

// Staff Detail Drawer with Overview and Daily Tracking tabs
const StaffDetailDrawer: React.FC<{
    staffMember: Staff;
    branches: Branch[];
    onClose: () => void;
    isPanelOpen: boolean;
    isPanelClosing: boolean;
}> = ({ staffMember, branches, onClose, isPanelOpen, isPanelClosing }) => {
    const { session } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [drawerTab, setDrawerTab] = useState<'overview' | 'daily-tracking'>('overview');

    // Daily Tracking state
    const [sessionData, setSessionData] = useState<any[]>([]);
    const [sessionLoading, setSessionLoading] = useState(false);
    const [dailyTrackingFilterStartDate, setDailyTrackingFilterStartDate] = useState<string>('');
    const [dailyTrackingFilterEndDate, setDailyTrackingFilterEndDate] = useState<string>('');
    const [dailyTrackingSortBy, setDailyTrackingSortBy] = useState<'date' | 'first_login' | 'last_login' | 'active_time'>('date');
    const [dailyTrackingSortOrder, setDailyTrackingSortOrder] = useState<'asc' | 'desc'>('desc');
    const [dailyTrackingPage, setDailyTrackingPage] = useState<number>(1);
    const dailyTrackingPageSize = 10;

    // Default date range (last 30 days)
    const defaultStartDate = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
    const defaultEndDate = new Date().toISOString().split('T')[0];

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        setTimeout(() => setIsOpen(true), 10);
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    // Fetch session data for staff member
    useEffect(() => {
        const fetchSessionData = async () => {
            if (!staffMember?.id) {
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

        if (drawerTab === 'daily-tracking') {
            fetchSessionData();
        }
    }, [staffMember?.id, drawerTab, dailyTrackingFilterStartDate, dailyTrackingFilterEndDate, session, defaultStartDate, defaultEndDate]);

    const roleNames: Record<number, string> = {
        1: 'Super Admin',
        2: 'Manager',
        3: 'Staff'
    };

    return (
        <div className="fixed inset-0 z-50" style={{ pointerEvents: 'auto' }}>
            <div
                className={`absolute inset-0 bg-black transition-opacity duration-300 ${isPanelClosing ? 'opacity-0' : 'opacity-40'}`}
                onClick={onClose}
                style={{ pointerEvents: 'auto' }}
            ></div>
            <div
                className={`absolute inset-y-0 right-0 w-full max-w-4xl bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-out ${isOpen && !isPanelClosing ? 'translate-x-0' : 'translate-x-full'}`}
                onClick={(e) => e.stopPropagation()}
                style={{ pointerEvents: 'auto' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6" style={{ backgroundColor: '#111827' }}>
                    <h2 className="text-lg font-semibold text-white">Staff Details</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                        <IconX className="w-6 h-6 text-white" />
                    </button>
                </div>

                {/* Tabs Navigation */}
                <div className="border-b border-slate-200 bg-white">
                    <nav className="flex space-x-6 px-6" aria-label="Tabs">
                        <button
                            onClick={() => setDrawerTab('overview')}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${drawerTab === 'overview'
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setDrawerTab('daily-tracking')}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${drawerTab === 'daily-tracking'
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                        >
                            Daily Tracking
                        </button>
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {drawerTab === 'overview' ? (
                        <div className="bg-white p-6 rounded-lg border border-slate-200">
                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <img
                                        src={staffMember.avatar_url || getDefaultAvatarUrl(staffMember.name || 'Staff', 32)}
                                        alt={staffMember.name}
                                        className="h-20 w-20 rounded-full object-cover bg-slate-100 border"
                                    />
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-slate-800">{staffMember.name}</h3>
                                        <p className="text-sm text-slate-500">{staffMember.email}</p>
                                    </div>
                                </div>
                                <hr />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Staff No.</label>
                                        <p className="font-medium py-2 text-slate-900">{staffMember.staff_no || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                                        <p className="font-medium py-2 text-slate-900">{staffMember.phone || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Extension No.</label>
                                        <p className="font-medium py-2 text-slate-900">{staffMember.extension_no || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                                        <p className="font-medium py-2 text-slate-900">{roleNames[staffMember.role_id] || 'Unknown'}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Branch</label>
                                        <p className="font-medium py-2 text-slate-900">{branches.find(b => b.id === staffMember.branch_id)?.name || 'Unknown'}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                                        <p className="font-medium py-2 text-slate-900">{staffMember.status}</p>
                                    </div>
                                    {(staffMember.services?.length || 0) > 0 && (
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-medium text-slate-500 mb-2">Handled Services</label>
                                            <div className="flex flex-wrap gap-2 py-2">
                                                {staffMember.services!.map(service => (
                                                    <span key={service} className="px-2.5 py-1 text-sm font-medium rounded-md bg-slate-100 text-slate-700">
                                                        {service}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
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
            </div>
        </div>
    );
};

const CameraScanModal: React.FC<{
    onCapture: (file: File) => void;
    onClose: () => void;
    docType: string;
}> = ({ onCapture, onClose, docType }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const { addToast } = useToast();

    useEffect(() => {
        const startCamera = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
                setStream(mediaStream);
            } catch (err) {
                console.error("Error accessing camera:", err);
                addToast('Could not access the camera. Please check permissions.', 'error');
                onClose();
            }
        };

        startCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(video, 0, 0, canvas.width, canvas.height);

            const dataUrl = canvas.toDataURL('image/jpeg');

            // Convert dataURL to File object
            const arr = dataUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)![1];
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
                u8arr[n] = bstr.charCodeAt(n);
            }
            const file = new File([u8arr], `${docType}_${new Date().toISOString()}.jpg`, { type: mime });

            onCapture(file);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Scan Document</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><IconX className="w-5 h-5" /></button>
                </div>
                <div className="p-4">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-md bg-slate-200"></video>
                    <canvas ref={canvasRef} className="hidden"></canvas>
                </div>
                <div className="p-4 border-t flex justify-center">
                    <button onClick={handleCapture} className="px-6 py-3 text-lg font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700">
                        Capture
                    </button>
                </div>
            </div>
        </div>
    );
};
