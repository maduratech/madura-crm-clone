import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../contexts/DataProvider';
// FIX: Added 'PaymentStatus' to the import list to resolve a type error.
import { Invoice, InvoiceItem, Customer, Lead, InvoiceStatus, LoggedInUser, ItineraryMetadata, CostingOption, CostingItem, HotelCostingItem, Currency, TourRegion, Payment, PaymentMethod, Activity, PaymentStatus, Branch, Service, LeadType, Priority, Transaction, TransactionType, TransactionApprovalStatus, canEditResource } from '../types';
import { IconSearch, IconPlus, IconX, IconTrash, IconDownload, IconWhatsapp, IconChevronDown, IconEye, IconFilter, IconRefresh, IconCheckCircle, IconChatBubble, MADURA_TRAVEL_BANK_DETAILS, MADURA_TRAVEL_COMPANY_HEADER } from '../constants';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { useRouter } from '../contexts/RouterProvider';
import { generateBookingId } from './itinerary/ItineraryUtils';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface InvoiceSaveOptions {
    generateLink?: boolean;
    markAsInvoiced?: boolean;
}

interface InvoicingPageProps {
    currentUser: LoggedInUser;
}

const ConfirmationModal: React.FC<{ title: string; message: string; onConfirm: () => void; onCancel: () => void; }> = ({ title, message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-slate-600 my-4">{message}</p>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
                <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-md bg-red-600 text-white">Delete</button>
            </div>
        </div>
    </div>
);

const getStatusClass = (status: InvoiceStatus) => {
    switch (status) {
        case InvoiceStatus.Paid:
            return 'bg-green-100 text-green-800';
        case InvoiceStatus.PartiallyPaid:
            return 'bg-yellow-100 text-yellow-800';
        case InvoiceStatus.Sent:
            return 'bg-blue-100 text-blue-800';
        case InvoiceStatus.Overdue:
            return 'bg-red-100 text-red-800';
        case InvoiceStatus.Draft:
        case InvoiceStatus.Invoiced:
            return 'bg-slate-100 text-slate-800';
        case InvoiceStatus.Void:
            return 'bg-orange-100 text-orange-800';
        default:
            return 'bg-slate-100 text-slate-800';
    }
};

const StatusBadge: React.FC<{ status: InvoiceStatus }> = ({ status }) => (
    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusClass(status)}`}>
        {status}
    </span>
);

const IconListView: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);

const IconGridView: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 8.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6A2.25 2.25 0 0115.75 3.75h2.25A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75A2.25 2.25 0 0115.75 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
);

const Pagination: React.FC<{
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (size: number) => void;
}> = ({ currentPage, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalItems === 0) return null;

    const handlePrev = () => onPageChange(Math.max(1, currentPage - 1));
    const handleNext = () => onPageChange(Math.min(totalPages, currentPage + 1));

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
            <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="whitespace-nowrap">Rows per page:</span>
                <select
                    value={itemsPerPage}
                    onChange={e => onItemsPerPageChange(Number(e.target.value))}
                    className="p-1.5 border rounded-md bg-white focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                    {[25, 50, 75, 100].map(size => (
                        <option key={size} value={size}>{size}</option>
                    ))}
                </select>
            </div>
            <p className="text-sm text-slate-600 order-last sm:order-none">
                Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-medium">{totalItems}</span> results
            </p>
            <div className="flex items-center gap-2">
                <button onClick={handlePrev} disabled={currentPage === 1} className="px-3 py-2 text-sm border rounded-md disabled:opacity-50 min-h-[44px] sm:min-h-0 touch-manipulation">Previous</button>
                <button onClick={handleNext} disabled={currentPage === totalPages} className="px-3 py-2 text-sm border rounded-md disabled:opacity-50 min-h-[44px] sm:min-h-0 touch-manipulation">Next</button>
            </div>
        </div>
    );
};

const InvoiceGrid: React.FC<{ invoices: Invoice[], customerMap: Map<number, Customer>, leadMap: Map<number, Lead>, onSelect: (inv: Invoice) => void, onNavigateLead: (leadId: number) => void }> = ({ invoices, customerMap, leadMap, onSelect, onNavigateLead }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {invoices.map(inv => {
            const customer = customerMap.get(inv.customer_id);
            const lead = inv.lead_id ? leadMap.get(inv.lead_id) : null;
            const amountReceived = inv.total_amount - inv.balance_due;
            const mtsId = lead ? generateBookingId(lead) : (inv.lead_id ? `MTS-${inv.lead_id}` : null);
            return (
                <div key={inv.id} onClick={() => onSelect(inv)} className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md cursor-pointer transition-all relative">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="font-bold text-blue-600">{inv.invoice_number}</p>
                            <p className="text-sm text-slate-600">{new Date(inv.issue_date).toLocaleDateString()}</p>
                        </div>
                        <StatusBadge status={inv.status} />
                    </div>
                    <p className="font-medium text-slate-800 mb-1">{customer ? `${customer.first_name} ${customer.last_name}` : 'N/A'}</p>
                    {mtsId && (
                        <p className="text-xs text-blue-600 hover:underline mb-2" onClick={(e) => { e.stopPropagation(); onNavigateLead(inv.lead_id!); }}>
                            {mtsId}
                        </p>
                    )}
                    <div className="flex justify-between items-end mt-3 border-t pt-2">
                        <div>
                            <p className="text-xs text-slate-500">Due: {new Date(inv.due_date).toLocaleDateString()}</p>
                            {inv.razorpay_payment_link_url && (
                                <a href={inv.razorpay_payment_link_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-blue-600 hover:underline block mt-1">
                                    Payment Link
                                </a>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-slate-800">₹{inv.total_amount.toLocaleString()}</p>
                            <p className="text-xs text-slate-500">Paid: ₹{amountReceived.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            );
        })}
    </div>
);

export const Invoicing: React.FC<InvoicingPageProps> = ({ currentUser }) => {
    const { invoices, customers, leads, itineraries, payments, refreshData, fetchInvoices, loadingInvoices } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const { addToast } = useToast();
    const { navigate } = useRouter();
    // Default: grid on mobile, list on desktop (sm breakpoint = 640px)
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() =>
        typeof window !== 'undefined' && window.innerWidth < 640 ? 'grid' : 'list'
    );
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [invoiceToDelete, setInvoiceToDelete] = useState<number | null>(null);
    const [filters, setFilters] = useState({ startDate: '', endDate: '', status: '' });
    const [showFilters, setShowFilters] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: 'issue_date' | 'due_date' | 'total_amount' | 'invoice_number', direction: 'asc' | 'desc' } | null>(null);
    const filterRef = useRef<HTMLDivElement>(null);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

    const NEW_INVOICE_DRAFT_KEY = 'invoicing_new_invoice_draft';

    // Lazy-load invoices when component mounts or when invoices become empty (e.g., after tab switch)
    useEffect(() => {
        if (invoices.length === 0 && !loadingInvoices) {
            fetchInvoices();
        }
    }, [invoices.length, loadingInvoices, fetchInvoices]);

    // Restore new-invoice draft when returning to the page (e.g. after switching tabs/apps)
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(NEW_INVOICE_DRAFT_KEY);
            if (raw) {
                const draft = JSON.parse(raw) as Partial<Invoice>;
                if (draft && (draft.customer_id || draft.items?.length || draft.issue_date)) {
                    setSelectedInvoice(draft as Invoice | null);
                    setIsPanelOpen(true);
                }
            }
        } catch (_) {}
    }, []);

    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    const leadMap = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads]);

    const filteredInvoices = useMemo(() => {
        let filtered = invoices.filter(inv => {
            // Search filter
            if (searchTerm) {
                const customer = customerMap.get(inv.customer_id);
                const lead = inv.lead_id ? leadMap.get(inv.lead_id) : null;
                const mtsId = lead ? generateBookingId(lead) : '';
                const searchPool = `${inv.invoice_number} ${customer?.first_name} ${customer?.last_name} ${mtsId}`.toLowerCase();
                if (!searchPool.includes(searchTerm.toLowerCase())) {
                    return false;
                }
            }

            // Date filter
            if (filters.startDate) {
                const issueDate = new Date(inv.issue_date);
                const startDate = new Date(filters.startDate);
                if (issueDate < startDate) {
                    return false;
                }
            }
            if (filters.endDate) {
                const issueDate = new Date(inv.issue_date);
                const endDate = new Date(filters.endDate);
                endDate.setHours(23, 59, 59, 999); // Include entire end date
                if (issueDate > endDate) {
                    return false;
                }
            }

            // Status filter
            if (filters.status && inv.status !== filters.status) {
                return false;
            }

            return true;
        });

        // Sort
        if (sortConfig) {
            filtered.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                if (sortConfig.key === 'issue_date' || sortConfig.key === 'due_date') {
                    aValue = new Date(a[sortConfig.key]).getTime();
                    bValue = new Date(b[sortConfig.key]).getTime();
                } else if (sortConfig.key === 'total_amount') {
                    aValue = a.total_amount;
                    bValue = b.total_amount;
                } else if (sortConfig.key === 'invoice_number') {
                    aValue = a.invoice_number.toLowerCase();
                    bValue = b.invoice_number.toLowerCase();
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            // Default sort by last saved/edited first (updated_at or created_at descending)
            filtered.sort((a, b) => {
                const aTime = new Date(a.updated_at || a.created_at).getTime();
                const bTime = new Date(b.updated_at || b.created_at).getTime();
                return bTime - aTime;
            });
        }

        return filtered;
    }, [invoices, searchTerm, filters, sortConfig, customerMap, leadMap]);

    const paginatedInvoices = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredInvoices.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredInvoices, currentPage, itemsPerPage]);

    // Sync selected invoice with the main list after data refresh
    useEffect(() => {
        if (selectedInvoice && isPanelOpen) {
            const updatedInvoice = invoices.find(inv => inv.id === selectedInvoice.id);
            if (updatedInvoice && JSON.stringify(updatedInvoice) !== JSON.stringify(selectedInvoice)) {
                setSelectedInvoice(updatedInvoice);
            }
        }
    }, [invoices, selectedInvoice, isPanelOpen]);

    useEffect(() => {
        setCurrentPage(1);
        setSelectedInvoiceIds(new Set()); // Clear selection when filters change
    }, [searchTerm, filters, sortConfig]);

    // Close filter panel when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setShowFilters(false);
            }
        };

        if (showFilters) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showFilters]);

    const handleSort = (key: 'issue_date' | 'due_date' | 'total_amount' | 'invoice_number') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const clearFilters = () => {
        setFilters({ startDate: '', endDate: '', status: '' });
        setSearchTerm('');
    };

    const hasActiveFilters = filters.startDate || filters.endDate || filters.status || searchTerm;

    useEffect(() => {
        const leadForInvoice = sessionStorage.getItem('newInvoiceForLead');
        if (leadForInvoice) {
            sessionStorage.removeItem('newInvoiceForLead');
            try {
                const lead: Lead = JSON.parse(leadForInvoice);
                setSelectedInvoice({
                    lead_id: lead.id,
                    customer_id: lead.customer_id,
                } as any); // Pre-fill for a new invoice
                setIsPanelOpen(true);
            } catch (e) { console.error("Could not parse lead for invoice", e) }
        }
        const invoiceToView = sessionStorage.getItem('viewInvoiceId');
        if (invoiceToView) {
            sessionStorage.removeItem('viewInvoiceId');
            const inv = invoices.find(i => i.id === parseInt(invoiceToView, 10));
            if (inv) {
                setSelectedInvoice(inv);
                setIsPanelOpen(true);
            }
        }
    }, [invoices]);

    const handleSaveInvoice = async (invoiceToSave: Partial<Invoice>, options?: InvoiceSaveOptions) => {
        const isNew = !invoiceToSave.id;

        if (!isNew && !canEditResource(currentUser, 'invoices')) {
            addToast('You do not have permission to modify existing invoices.', 'error');
            return;
        }

        let savedInvoice: Invoice | null = null;

        try {
            if (isNew) {
                const { id, ...newInvoiceData } = invoiceToSave;
                const status = options?.markAsInvoiced ? InvoiceStatus.Invoiced : (invoiceToSave.status ?? InvoiceStatus.Draft);
                const { data, error } = await supabase.from('invoices').insert({ ...newInvoiceData, status }).select().single();
                if (error) throw error;
                savedInvoice = data;
                addToast('Invoice created successfully.', 'success');
            } else {
                const { id, ...updateInvoiceData } = invoiceToSave;
                const { data, error } = await supabase.from('invoices').update(updateInvoiceData).eq('id', id!).select().single();
                if (error) throw error;
                savedInvoice = data;
                addToast('Invoice updated successfully.', 'success');
            }

            if (options?.generateLink && savedInvoice) {
                addToast('Generating Razorpay payment link...', 'success');
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) throw new Error('Authentication required. Please log in again.');
                const response = await fetch(`${API_BASE_URL}/api/invoicing/create-link`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ invoiceId: savedInvoice.id })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Server error');
                addToast('Payment link generated and invoice status updated to SENT.', 'success');
            }

        } catch (error: any) {
            addToast(`Failed to save invoice: ${error.message}`, 'error');
        } finally {
            await fetchInvoices(true);
            setIsPanelOpen(false);
            try { sessionStorage.removeItem(NEW_INVOICE_DRAFT_KEY); } catch (_) {}
        }
    };

    const confirmDeleteInvoice = async () => {
        if (!invoiceToDelete) return;
        try {
            const { error } = await supabase.from('invoices').delete().eq('id', invoiceToDelete);
            if (error) throw error;
            addToast('Invoice deleted permanently.', 'success');
            await fetchInvoices(true);
            setIsPanelOpen(false);
        } catch (error: any) {
            addToast(`Error deleting invoice: ${error.message}`, 'error');
        } finally {
            setInvoiceToDelete(null);
        }
    };

    const handleNavigateLead = (leadId: number) => {
        sessionStorage.setItem('viewLeadId', leadId.toString());
        navigate('/leads/all');
    };

    // Bulk selection handlers
    const handleSelectInvoice = (invoiceId: number, checked: boolean) => {
        setSelectedInvoiceIds(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(invoiceId);
            } else {
                newSet.delete(invoiceId);
            }
            return newSet;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedInvoiceIds(new Set(paginatedInvoices.map(inv => inv.id)));
        } else {
            setSelectedInvoiceIds(new Set());
        }
    };

    const isAllSelected = paginatedInvoices.length > 0 && paginatedInvoices.every(inv => selectedInvoiceIds.has(inv.id));
    const isSomeSelected = paginatedInvoices.some(inv => selectedInvoiceIds.has(inv.id));

    // Bulk operations
    const sendableStatuses = [InvoiceStatus.Invoiced, InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid, InvoiceStatus.Paid, InvoiceStatus.Overdue];
    const handleBulkSend = async () => {
        if (selectedInvoiceIds.size === 0) return;
        setIsBulkProcessing(true);
        const selectedInvoices = invoices.filter(inv => selectedInvoiceIds.has(inv.id));
        const toSend = selectedInvoices.filter(inv => sendableStatuses.includes(inv.status));
        const skipped = selectedInvoices.length - toSend.length;
        let successCount = 0;
        let failCount = 0;
        const { data: { session } } = await supabase.auth.getSession();
        const authHeader = session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
        for (const invoice of toSend) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/invoicing/send-whatsapp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeader },
                    body: JSON.stringify({ invoiceId: invoice.id })
                });
                const data = await response.json();
                if (response.ok) successCount++;
                else failCount++;
            } catch (_) {
                failCount++;
            }
        }
        if (successCount > 0) addToast(`Successfully sent ${successCount} invoice(s) via WhatsApp.`, 'success');
        if (failCount > 0) addToast(`Failed to send ${failCount} invoice(s).`, 'error');
        if (skipped > 0) addToast(`${skipped} invoice(s) skipped (Draft / Void).`, 'success');
        setSelectedInvoiceIds(new Set());
        setIsBulkProcessing(false);
        await fetchInvoices(true);
    };

    const handleBulkArchive = async () => {
        if (selectedInvoiceIds.size === 0) return;
        setIsBulkProcessing(true);
        try {
            const { error } = await supabase
                .from('invoices')
                .update({ status: InvoiceStatus.Void })
                .in('id', Array.from(selectedInvoiceIds));
            if (error) throw error;
            addToast(`Successfully archived ${selectedInvoiceIds.size} invoice(s).`, 'success');
            setSelectedInvoiceIds(new Set());
            await fetchInvoices(true);
        } catch (error: any) {
            addToast(`Failed to archive invoices: ${error.message}`, 'error');
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleBulkVoid = async () => {
        if (selectedInvoiceIds.size === 0) return;
        if (currentUser.role !== 'Super Admin' || currentUser.branch_id !== 1) {
            addToast('Only Super Admin can void invoices.', 'error');
            return;
        }
        setIsBulkProcessing(true);
        try {
            const { error } = await supabase
                .from('invoices')
                .update({ status: InvoiceStatus.Void })
                .in('id', Array.from(selectedInvoiceIds));
            if (error) throw error;
            addToast(`Successfully voided ${selectedInvoiceIds.size} invoice(s).`, 'success');
            setSelectedInvoiceIds(new Set());
            await fetchInvoices(true);
        } catch (error: any) {
            addToast(`Failed to void invoices: ${error.message}`, 'error');
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const isSuperAdmin = currentUser.role === 'Super Admin';
    // Only Super Admin can void invoices; Accountant can view/create/edit but not void
    const canVoidInvoices = currentUser.role === 'Super Admin' && currentUser.branch_id === 1;

    return (
        <div className="flex h-full min-h-0">
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm flex flex-col min-h-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                        <h1 className="text-lg sm:text-xl font-bold text-slate-800 truncate">Invoices ({filteredInvoices.length})</h1>
                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            <button
                                onClick={() => fetchInvoices(true)}
                                disabled={loadingInvoices}
                                className="flex items-center gap-2 px-2.5 sm:px-3 py-2 text-sm font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-50 shrink-0"
                                title="Refresh invoice list"
                            >
                                <IconRefresh className={`w-4 h-4 ${loadingInvoices ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                            <div className="relative flex-1 sm:flex-none min-w-0 sm:w-64">
                                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Search invoice #, customer, MTS ID"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 w-full sm:w-64 text-sm bg-white border text-slate-900 border-slate-300 rounded-md"
                                />
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-md transition-colors ${hasActiveFilters
                                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    <IconFilter className="w-4 h-4" />
                                    Filter
                                    {hasActiveFilters && (
                                        <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                                            {[filters.startDate, filters.endDate, filters.status, searchTerm].filter(Boolean).length}
                                        </span>
                                    )}
                                </button>
                                {showFilters && (
                                    <div ref={filterRef} className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] bg-white rounded-md shadow-lg border z-20 p-4 max-h-[85vh] overflow-y-auto">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="text-sm font-semibold text-slate-800">Filters</h3>
                                            <button
                                                onClick={() => setShowFilters(false)}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                <IconX className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={filters.startDate}
                                                    onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                                                <input
                                                    type="date"
                                                    value={filters.endDate}
                                                    onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                                                <select
                                                    value={filters.status}
                                                    onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md"
                                                >
                                                    <option value="">All Statuses</option>
                                                    {Object.values(InvoiceStatus).map(status => (
                                                        <option key={status} value={status}>{status}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {hasActiveFilters && (
                                                <button
                                                    onClick={clearFilters}
                                                    className="w-full px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200"
                                                >
                                                    Clear Filters
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="relative">
                                <select
                                    value={sortConfig ? `${sortConfig.key}-${sortConfig.direction}` : 'issue_date-desc'}
                                    onChange={e => {
                                        const [key, direction] = e.target.value.split('-') as [string, 'asc' | 'desc'];
                                        setSortConfig({ key: key as any, direction });
                                    }}
                                    className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-md text-slate-700 cursor-pointer appearance-none pr-8"
                                >
                                    <option value="issue_date-desc">Sort: Issue Date (Newest)</option>
                                    <option value="issue_date-asc">Sort: Issue Date (Oldest)</option>
                                    <option value="due_date-desc">Sort: Due Date (Latest)</option>
                                    <option value="due_date-asc">Sort: Due Date (Earliest)</option>
                                    <option value="total_amount-desc">Sort: Amount (High to Low)</option>
                                    <option value="total_amount-asc">Sort: Amount (Low to High)</option>
                                    <option value="invoice_number-asc">Sort: Invoice # (A-Z)</option>
                                    <option value="invoice_number-desc">Sort: Invoice # (Z-A)</option>
                                </select>
                                <IconChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border shrink-0">
                                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-slate-500'}`} aria-label="List view"><IconListView className="w-5 h-5" /></button>
                                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-slate-500'}`} aria-label="Grid view"><IconGridView className="w-5 h-5" /></button>
                            </div>
                            <button
                                onClick={() => {
                                    try { sessionStorage.removeItem(NEW_INVOICE_DRAFT_KEY); } catch (_) {}
                                    setSelectedInvoice(null);
                                    setIsPanelOpen(true);
                                }}
                                className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c] shrink-0"
                            >
                                <IconPlus className="w-4 h-4" />
                                New Invoice
                            </button>
                        </div>
                    </div>
                    {selectedInvoiceIds.size > 0 && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <span className="text-sm font-medium text-blue-800">
                                {selectedInvoiceIds.size} invoice(s) selected
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={handleBulkSend}
                                    disabled={isBulkProcessing}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-[5px] hover:bg-green-700 disabled:bg-slate-400"
                                >
                                    {isBulkProcessing ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    ) : (
                                        <IconWhatsapp className="w-4 h-4" />
                                    )}
                                    {isBulkProcessing ? 'Processing...' : 'Send'}
                                </button>
                                <button
                                    onClick={handleBulkArchive}
                                    disabled={isBulkProcessing}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-800 bg-amber-100 rounded-[5px] hover:bg-amber-200 disabled:bg-slate-300"
                                >
                                    {isBulkProcessing ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-700"></div>
                                    ) : (
                                        <IconTrash className="w-4 h-4" />
                                    )}
                                    {isBulkProcessing ? 'Processing...' : 'Archive'}
                                </button>
                                {canVoidInvoices && (
                                    <button
                                        onClick={handleBulkVoid}
                                        disabled={isBulkProcessing}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-[5px] hover:bg-red-700 disabled:bg-slate-400"
                                    >
                                        {isBulkProcessing ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        ) : (
                                            <IconTrash className="w-4 h-4" />
                                        )}
                                        {isBulkProcessing ? 'Processing...' : 'Void'}
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedInvoiceIds(new Set())}
                                    className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-[5px] hover:bg-slate-50"
                                >
                                    Clear Selection
                                </button>
                            </div>
                        </div>
                    )}
                    {paginatedInvoices.length > 0 ? (
                        viewMode === 'list' ? (
                            <div className="overflow-x-auto min-h-0 rounded-lg border border-slate-200" style={{ WebkitOverflowScrolling: 'touch' }}>
                                <table className="w-full text-sm text-left text-slate-500 min-w-[800px]">
                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-[1]">
                                        <tr>
                                            <th className="px-3 sm:px-6 py-2 sm:py-3 w-10 sm:w-12">
                                                <input
                                                    type="checkbox"
                                                    checked={isAllSelected}
                                                    ref={(input) => {
                                                        if (input) input.indeterminate = isSomeSelected && !isAllSelected;
                                                    }}
                                                    onChange={(e) => handleSelectAll(e.target.checked)}
                                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </th>
                                            <th
                                                className="px-6 py-3 cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleSort('issue_date')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Issue Date
                                                    {sortConfig?.key === 'issue_date' && (
                                                        <span className="text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                className="px-6 py-3 cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleSort('invoice_number')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Invoice #
                                                    {sortConfig?.key === 'invoice_number' && (
                                                        <span className="text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                                    )}
                                                </div>
                                            </th>
                                            <th className="px-3 sm:px-6 py-2 sm:py-3">Customer</th>
                                            <th className="px-3 sm:px-6 py-2 sm:py-3">MTS ID</th>
                                            <th
                                                className="px-6 py-3 cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleSort('due_date')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Due Date
                                                    {sortConfig?.key === 'due_date' && (
                                                        <span className="text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                className="px-6 py-3 text-right cursor-pointer hover:bg-slate-100 select-none"
                                                onClick={() => handleSort('total_amount')}
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    Amount Received / Total
                                                    {sortConfig?.key === 'total_amount' && (
                                                        <span className="text-blue-600">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                                    )}
                                                </div>
                                            </th>
                                            <th className="px-3 sm:px-6 py-2 sm:py-3">Status</th>
                                            <th className="px-3 sm:px-6 py-2 sm:py-3">Payment Link</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedInvoices.map(inv => {
                                            const customer = customerMap.get(inv.customer_id);
                                            const lead = inv.lead_id ? leadMap.get(inv.lead_id) : null;
                                            const mtsId = lead ? generateBookingId(lead) : (inv.lead_id ? `MTS-${inv.lead_id}` : 'N/A');
                                            const amountReceived = inv.total_amount - inv.balance_due;
                                            return (
                                                <tr key={inv.id} onClick={() => { setSelectedInvoice(inv); setIsPanelOpen(true); }} className="bg-white border-b hover:bg-slate-50 cursor-pointer">
                                                    <td className="px-3 sm:px-6 py-2 sm:py-4" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedInvoiceIds.has(inv.id)}
                                                            onChange={(e) => handleSelectInvoice(inv.id, e.target.checked)}
                                                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </td>
                                                    <td className="px-3 sm:px-6 py-2 sm:py-4">{new Date(inv.issue_date).toLocaleDateString()}</td>
                                                    <td className="px-3 sm:px-6 py-2 sm:py-4 font-semibold text-blue-600">{inv.invoice_number}</td>
                                                    <td className="px-3 sm:px-6 py-2 sm:py-4">{customer ? `${customer.first_name} ${customer.last_name}` : 'N/A'}</td>
                                                    <td
                                                        className="px-6 py-4 text-blue-600 hover:underline"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (inv.lead_id) {
                                                                handleNavigateLead(inv.lead_id);
                                                            }
                                                        }}
                                                    >
                                                        {mtsId}
                                                    </td>
                                                    <td className="px-3 sm:px-6 py-2 sm:py-4">{new Date(inv.due_date).toLocaleDateString()}</td>
                                                    <td className="px-3 sm:px-6 py-2 sm:py-4 text-right font-medium text-slate-800">
                                                        ₹{amountReceived.toLocaleString()} / ₹{inv.total_amount.toLocaleString()}
                                                    </td>
                                                    <td className="px-3 sm:px-6 py-2 sm:py-4"><StatusBadge status={inv.status} /></td>
                                                    <td className="px-3 sm:px-6 py-2 sm:py-4">
                                                        {inv.razorpay_payment_link_url ? (
                                                            <a href={inv.razorpay_payment_link_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline">
                                                                View Link
                                                            </a>
                                                        ) : 'Not Generated'}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <InvoiceGrid invoices={paginatedInvoices} customerMap={customerMap} leadMap={leadMap} onSelect={(inv) => { setSelectedInvoice(inv); setIsPanelOpen(true); }} onNavigateLead={handleNavigateLead} />
                        )
                    ) : <p className="text-center p-8 text-slate-500">No invoices found.</p>}
                    <Pagination
                        currentPage={currentPage}
                        totalItems={filteredInvoices.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                    />
                </div>
                {/* Mobile: floating New Invoice button */}
                <button
                    onClick={() => {
                        try { sessionStorage.removeItem(NEW_INVOICE_DRAFT_KEY); } catch (_) {}
                        setSelectedInvoice(null);
                        setIsPanelOpen(true);
                    }}
                    className="fixed bottom-5 right-5 z-20 w-14 h-14 flex sm:hidden items-center justify-center rounded-full bg-[#191974] text-white shadow-lg hover:bg-[#13135c] active:scale-95 transition-transform touch-manipulation"
                    aria-label="New Invoice"
                >
                    <IconPlus className="w-7 h-7" />
                </button>
            </div>
            {isPanelOpen && (
                <InvoiceDetailPanel
                    invoice={selectedInvoice}
                    onClose={() => setIsPanelOpen(false)}
                    onSave={handleSaveInvoice}
                    onDelete={setInvoiceToDelete}
                    customers={customers}
                    leads={leads}
                    itineraries={itineraries}
                    payments={payments}
                    onRefresh={() => fetchInvoices(true)}
                    currentUser={currentUser}
                />
            )}
            {invoiceToDelete && (
                <ConfirmationModal
                    title="Delete Invoice"
                    message="Are you sure you want to permanently delete this draft invoice? This action cannot be undone."
                    onConfirm={confirmDeleteInvoice}
                    onCancel={() => setInvoiceToDelete(null)}
                />
            )}
        </div>
    );
};

// Invoice Preview Modal Component (Drawer)
const InvoicePreviewModal: React.FC<{
    invoice: Partial<Invoice>;
    customer: Customer | undefined;
    lead: Lead | undefined;
    branch: Branch | undefined;
    totals: { subtotal: number; totalTaxableValue: number; cgst: number; sgst: number; totalGst: number; tcs: number; total: number; discount: number };
    payUrl: string;
    onClose: () => void;
}> = ({ invoice, customer, lead, branch, totals, payUrl, onClose }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Prevent body scroll when drawer is open
        document.body.style.overflow = 'hidden';
        // Trigger slide-in animation
        setTimeout(() => setIsOpen(true), 10);
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const handleClose = () => {
        setIsClosing(true);
        setIsOpen(false);
        setTimeout(() => {
            onClose();
        }, 300); // Match transition duration
    };

    if (!customer || !branch) {
        return null;
    }

    const displayName = (invoice as any).billing_name || invoice.display_name || (customer.company && customer.gst_number
        ? customer.company
        : `${customer.first_name} ${customer.last_name}`);

    // Prefer invoice billing_address (from form); fallback to customer address object
    const customerAddress = (invoice as any).billing_address?.trim()
        || (customer.address
            ? `${customer.address.street || ""}${customer.address.city ? `, ${customer.address.city}` : ""}${customer.address.state ? `, ${customer.address.state}` : ""}${customer.address.country ? `, ${customer.address.country}` : ""}${customer.address.zip ? ` - ${customer.address.zip}` : ""}`
            : "");

    // Only show cheque text, not the full terms
    const chequeText = "All Cheques / Drafts in payment of bills must be crossed 'A/c Payee Only' and drawn in favour of 'MADURA TRAVEL SERVICE (P) LTD.'.";

    return (
        <div className="fixed inset-0 z-[110]" style={{ pointerEvents: 'auto' }}>
            <div
                className={`absolute inset-0 bg-black transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-40'}`}
                onClick={handleClose}
                style={{ pointerEvents: 'auto' }}
            ></div>
            <div
                className={`absolute inset-y-0 right-0 w-full sm:w-[60vw] bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-out z-[110] ${isOpen && !isClosing ? 'translate-x-0' : 'translate-x-full'}`}
                onClick={(e) => e.stopPropagation()}
                style={{ pointerEvents: 'auto' }}
            >
                <div className="flex items-center justify-between p-3 sm:p-4 bg-[#191974] text-white border-b shrink-0">
                    <h2 className="text-base sm:text-lg font-semibold truncate min-w-0">Invoice Preview</h2>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-slate-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation" aria-label="Close">
                        <IconX className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 p-3 sm:p-6 bg-slate-50">
                    <div className="bg-white p-4 sm:p-8 shadow-sm w-full max-w-full min-w-0" style={{ margin: '0 auto', minWidth: 'min(100%, 210mm)' }}>
                        {/* Header */}
                        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 pb-4 border-b mb-4 sm:mb-6">
                            <div>
                                {branch.logo_url && <img src={branch.logo_url} alt="Company Logo" className="h-16 w-auto mb-2" />}
                                <h1 className="font-bold text-lg">MADURA TRAVEL SERVICE (P) LTD.</h1>
                                <p className="text-xs text-slate-600">{MADURA_TRAVEL_COMPANY_HEADER.addressLine1}</p>
                                <p className="text-xs text-slate-600">{MADURA_TRAVEL_COMPANY_HEADER.addressLine2}</p>
                                <p className="text-xs text-slate-600">Tel : {MADURA_TRAVEL_COMPANY_HEADER.tel}</p>
                                <p className="text-xs text-slate-600">Email : {MADURA_TRAVEL_COMPANY_HEADER.email} &nbsp; URL : {MADURA_TRAVEL_COMPANY_HEADER.url}</p>
                                <p className="text-xs text-slate-600">PAN : {MADURA_TRAVEL_COMPANY_HEADER.pan}</p>
                                <p className="text-xs text-slate-600">GSTIN : {MADURA_TRAVEL_COMPANY_HEADER.gstin}</p>
                            </div>
                            <div className="sm:text-right">
                                <h2 className="text-xl sm:text-2xl font-bold uppercase text-gray-700">Tax Invoice</h2>
                                <div className="bg-slate-100 p-3 rounded mt-2">
                                    <p className="text-xs"><span className="font-semibold">Invoice #:</span> {invoice.invoice_number || 'N/A'}</p>
                                    <p className="text-xs"><span className="font-semibold">IATA No.:</span> 14:3:36420</p>
                                    <p className="text-xs"><span className="font-semibold">Date:</span> {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : 'N/A'}</p>
                                    <p className="text-xs"><span className="font-semibold">Due Date:</span> {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</p>
                                </div>
                            </div>
                        </header>

                        {/* Bill To */}
                        <section className="my-4 sm:my-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <h3 className="font-semibold text-gray-500 uppercase tracking-wider mb-1 text-xs">Bill To</h3>
                                    <p className="font-bold">{displayName}</p>
                                    {customerAddress && <p className="text-xs text-slate-600">{customerAddress}</p>}
                                    {customer.email && <p className="text-xs text-slate-600">{customer.email}</p>}
                                    {customer.phone && <p className="text-xs text-slate-600">{customer.phone}</p>}
                                    {customer.gst_number && <p className="text-xs text-slate-600"><span className="font-semibold">GST:</span> {customer.gst_number}</p>}
                                </div>
                                <div className="sm:text-right">
                                    <h3 className="font-semibold text-gray-500 uppercase tracking-wider mb-1 text-xs">Place of Supply</h3>
                                    <p className="text-xs">TAMIL NADU (33)</p>
                                </div>
                            </div>
                        </section>

                        {/* Items Table */}
                        <section className="my-4 sm:my-6 overflow-x-auto -mx-1">
                            <table className="w-full text-left border-collapse min-w-[640px]">
                                <thead className="bg-[#191974] text-white">
                                    <tr>
                                        <th className="p-2 text-[11px] font-semibold">Narration / Description</th>
                                        <th className="p-2 text-[11px] font-semibold text-center">SAC</th>
                                        <th className="p-2 text-[11px] font-semibold text-center">Qty</th>
                                        <th className="p-2 text-[11px] font-semibold text-right">Rate (₹)</th>
                                        <th className="p-2 text-[11px] font-semibold text-right">Service Fees (₹)</th>
                                        <th className="p-2 text-[11px] font-semibold text-right">Taxable Value (₹)</th>
                                        <th className="p-2 text-[11px] font-semibold text-center">GST %</th>
                                        <th className="p-2 text-[11px] font-semibold text-right">GST Amount (₹)</th>
                                        <th className="p-2 text-[11px] font-semibold text-right">Total (₹)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoice.items?.map((item, index) => (
                                        <tr key={item.id} className="border-b">
                                            <td className="p-2 text-[11px] align-top">
                                                <div className="font-semibold">{item.itemName || item.serviceType || 'Item'}</div>
                                                {item.description ? <div className="text-[10px] text-slate-500 mt-0.5">{item.description}</div> : null}
                                            </td>
                                            <td className="p-2 text-[11px] text-center whitespace-nowrap">{item.sac || '9985'}</td>
                                            <td className="p-2 text-[11px] text-center whitespace-nowrap">{item.qty || 0}</td>
                                            <td className="p-2 text-[11px] text-right whitespace-nowrap">₹{(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-2 text-[11px] text-right whitespace-nowrap">₹{(item.professionalFee || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-2 text-[11px] text-right whitespace-nowrap">₹{(item.taxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-2 text-[11px] text-center whitespace-nowrap">{item.gstPercentage || 0}%</td>
                                            <td className="p-2 text-[11px] text-right whitespace-nowrap">₹{(item.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="p-2 text-[11px] text-right font-semibold whitespace-nowrap">₹{(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>

                        {/* Totals Section */}
                        <section className="mt-6 flex flex-wrap items-start gap-6 justify-start">
                            {payUrl ? (
                                <div className="flex flex-col items-center shrink-0">
                                    <a href={payUrl} target="_blank" rel="noopener noreferrer" className="inline-block" onClick={(e) => { e.preventDefault(); window.open(payUrl, '_blank', 'noopener,noreferrer'); }}>
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(payUrl)}`} alt="Pay with Razorpay" className="w-[100px] h-[100px]" />
                                    </a>
                                    <span className="text-xs font-semibold text-slate-700 mt-2">Scan/Click to pay</span>
                                </div>
                            ) : null}
                            <div className="w-1/2 min-w-[200px] space-y-1 ml-auto">
                                <div className="flex justify-between text-xs">
                                    <span>Sub Total</span>
                                    <span>₹ {totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {totals.discount > 0 && (
                                    <div className="flex justify-between text-xs text-red-600">
                                        <span>Discount</span>
                                        <span>- ₹ {totals.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xs font-semibold">
                                    <span>GST Amount</span>
                                    <span>₹ {totals.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                {totals.tcs > 0 && invoice.is_tcs_applied && (
                                    <div className="flex justify-between text-xs">
                                        <span>TCS {invoice.tcs_percentage ? `(${invoice.tcs_percentage}%)` : '(5%)'}</span>
                                        <span>₹ {totals.tcs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <hr className="my-1" />
                                {(() => {
                                    const roundOff = (invoice as Invoice).round_off ?? (Math.round(totals.total) - totals.total);
                                    const totalWithRoundOff = totals.total + roundOff;
                                    const invoiceTotal = invoice.id ? (invoice as Invoice).total_amount ?? totalWithRoundOff : totalWithRoundOff;
                                    const invoiceBalanceDue = invoice.id ? ((invoice as Invoice).balance_due ?? invoiceTotal) : invoiceTotal;
                                    const amountPaid = Math.max(0, invoiceTotal - invoiceBalanceDue);
                                    const currentBalanceDue = Math.max(0, totalWithRoundOff - amountPaid);
                                    return (
                                        <>
                                            {roundOff !== 0 && (
                                                <div className={`flex justify-between text-xs ${roundOff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    <span>Round off</span>
                                                    <span>₹ {roundOff >= 0 ? '+' : ''}{roundOff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-bold text-base">
                                                <span>Total Amount</span>
                                                <span>₹ {totalWithRoundOff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            {amountPaid > 0 && (
                                                <div className="flex justify-between text-xs text-red-600 mt-1">
                                                    <span>Amount Paid</span>
                                                    <span>(-) ₹ {amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between text-[9px] font-semibold text-green-600 mt-1">
                                                <span>Balance Due</span>
                                                <span>₹ {currentBalanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </section>

                        {/* Footer */}
                        <footer className="mt-6 sm:mt-8 pt-4 border-t">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4">
                                <div>
                                    <h4 className="font-bold mb-1 text-xs">Bank Details</h4>
                                    <p className="text-xs"><span className="font-semibold">Bank:</span> {MADURA_TRAVEL_BANK_DETAILS.bankName}</p>
                                    <p className="text-xs"><span className="font-semibold">Account type:</span> {MADURA_TRAVEL_BANK_DETAILS.accountType}</p>
                                    <p className="text-xs"><span className="font-semibold">Account holder Name:</span> {MADURA_TRAVEL_BANK_DETAILS.accountHolderName}</p>
                                    <p className="text-xs"><span className="font-semibold">Branch:</span> {MADURA_TRAVEL_BANK_DETAILS.branch}</p>
                                    <p className="text-xs"><span className="font-semibold">Account no:</span> {MADURA_TRAVEL_BANK_DETAILS.accountNumber}</p>
                                    <p className="text-xs"><span className="font-semibold">IFSC Code:</span> {MADURA_TRAVEL_BANK_DETAILS.ifscCode}</p>
                                    <p className="text-xs"><span className="font-semibold">SWIFT Code:</span> {MADURA_TRAVEL_BANK_DETAILS.swiftCode}</p>
                                </div>
                                <div className="sm:text-right">
                                    <h4 className="font-bold mb-1 text-xs">For MADURA TRAVEL SERVICE (P) LTD.</h4>
                                    {(invoice.is_signed && branch.seal_signature_url) ? (
                                        <div className="h-16 flex items-center justify-end mb-1 mt-1">
                                            <img
                                                src={branch.seal_signature_url}
                                                alt="Seal with Signature"
                                                className="h-12 w-auto object-contain inline-block"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-12 mb-1 mt-2"></div>
                                    )}
                                    <p className="border-t pt-1 text-xs">Authorised Signatory</p>
                                </div>
                            </div>
                            <div className="mt-4 pt-2 border-t">
                                <h4 className="font-bold mb-1 text-xs">Terms & Conditions</h4>
                                <p className="text-xs text-slate-600">{chequeText}</p>
                            </div>
                            {invoice.is_signed && (
                                <div className="mt-2 text-center text-[10px] text-slate-500">
                                    This invoice has been digitally signed by MADURA TRAVEL SERVICE (P) LTD.
                                </div>
                            )}
                        </footer>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Service Type Dropdown Component for Items
const ServiceTypeDropdown: React.FC<{
    item: InvoiceItem;
    onSelect: (serviceType: string, itemName: string, gst: number, sac: string) => void;
    disabled?: boolean;
}> = ({ item, onSelect, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const serviceTypes = [
        { value: 'Tour Package', label: 'Tour Package', sac: '998552', gst: 5, needsTCS: true },
        { value: 'Air Ticket', label: 'Air Ticket', sac: '998551', gst: 18, needsTCS: false },
        { value: 'Visa', label: 'Visa', sac: '998555', gst: 18, needsTCS: false },
        { value: 'Passport', label: 'Passport', sac: '998555', gst: 18, needsTCS: false },
        { value: 'Rail Travel', label: 'Rail Travel', sac: '9967', gst: 18, needsTCS: false },
        { value: 'Rent-a-Cab', label: 'Rent-a-Cab', sac: '9967', gst: 5, needsTCS: false },
        { value: 'Other renting services', label: 'Other renting services', sac: '998559', gst: 18, needsTCS: false },
        { value: 'Hotel Booking With ITC', label: 'Hotel Booking With ITC', sac: '998552', gst: 18, needsTCS: false },
        { value: 'Hotel Booking Without ITC', label: 'Hotel Booking Without ITC', sac: '998552', gst: 5, needsTCS: false },
        { value: 'Tour Package (wholly outside India)', label: 'Tour Package (wholly outside India)', sac: '9985', gst: 0, needsTCS: false },
        { value: 'Cruise Booking With ITC', label: 'Cruise Booking With ITC', sac: '998552', gst: 18, needsTCS: false },
        { value: 'Cruise Booking Without ITC', label: 'Cruise Booking Without ITC', sac: '998552', gst: 5, needsTCS: false },
    ];

    const filteredServiceTypes = useMemo(() => {
        if (!searchTerm) return serviceTypes;
        const term = searchTerm.toLowerCase();
        return serviceTypes.filter(st =>
            st.label.toLowerCase().includes(term) ||
            st.value.toLowerCase().includes(term)
        );
    }, [searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const selectedServiceType = serviceTypes.find(st => st.value === item.serviceType || item.itemName === st.value);

    return (
        <div ref={dropdownRef} className="relative w-full">
            {disabled ? (
                <div className="p-2 text-sm border rounded-md bg-slate-100">{item.itemName || '-'}</div>
            ) : (
                <>
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm || item.itemName || item.serviceType || ''}
                        onChange={e => {
                            setSearchTerm(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => {
                            setIsOpen(true);
                            if (!item.itemName && !item.serviceType) {
                                setSearchTerm('');
                            }
                        }}
                        className="w-full text-sm p-2 border rounded-md bg-slate-50"
                        placeholder="Service Type"
                    />
                    {isOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredServiceTypes.length > 0 ? (
                                filteredServiceTypes.map(st => (
                                    <div
                                        key={st.value}
                                        onClick={() => {
                                            onSelect(st.value, st.value, st.gst, st.sac);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                        className="p-2 hover:bg-blue-50 cursor-pointer text-sm"
                                    >
                                        <div className="font-medium">{st.label}</div>
                                        <div className="text-xs text-slate-500">SAC {st.sac} - {st.gst}% GST</div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-2 text-sm text-slate-500">No service types found</div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export const InvoiceDetailPanel: React.FC<{
    invoice: Invoice | null;
    onClose: () => void;
    onSave: (invoice: Partial<Invoice>, options?: InvoiceSaveOptions) => void;
    onDelete: (id: number) => void;
    customers: Customer[];
    leads: Lead[];
    itineraries: ItineraryMetadata[];
    payments: Payment[];
    onRefresh: () => void;
    currentUser: LoggedInUser;
}> = ({ invoice, onClose, onSave, onDelete, customers, leads, itineraries, payments, onRefresh, currentUser }) => {
    const isNew = !invoice?.id;
    const { branches, staff, transactions } = useData();
    const payUrl = (invoice?.razorpay_payment_link_url && String(invoice.razorpay_payment_link_url).trim()) || (branches.find(b => b.id === 1)?.razorpay_link) || '';
    const [editedInvoice, setEditedInvoice] = useState<Partial<Invoice>>({});
    const [isArchiving, setIsArchiving] = useState(false);
    const { addToast } = useToast();
    const [fxRates, setFxRates] = useState<Record<Currency, number> | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
    const [shouldGenerateLink, setShouldGenerateLink] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [isPanelClosing, setIsPanelClosing] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');

    const newInvoiceNumber = useRef(isNew ? `INV-${Date.now().toString().slice(-6)}` : '');

    useEffect(() => {
        // Trigger slide-in animation
        setTimeout(() => setIsPanelOpen(true), 10);
        // Prevent body scroll when panel is open
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const handlePanelClose = () => {
        if (isNew) {
            try { sessionStorage.removeItem(DRAFT_STORAGE_KEY); } catch (_) {}
        }
        setIsPanelClosing(true);
        setIsPanelOpen(false);
        setTimeout(() => {
            onClose();
        }, 300); // Match transition duration
    };

    const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.BankTransfer);
    const [paymentRef, setPaymentRef] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [isRecordingPayment, setIsRecordingPayment] = useState(false);

    const invoicePayments = useMemo(() => {
        if (!invoice?.id) return [];
        return payments.filter(p => p.invoice_id === invoice.id).sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
    }, [payments, invoice]);

    const leadIdForTransactions = editedInvoice.lead_id ?? invoice?.lead_id;
    const leadTransactions = useMemo(() => {
        if (!leadIdForTransactions || !transactions) return [];
        return transactions.filter(t => t.lead_id === leadIdForTransactions).sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
    }, [transactions, leadIdForTransactions]);

    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const customerDropdownRef = useRef<HTMLDivElement>(null);

    const filteredCustomers = useMemo(() => {
        const lowerQuery = customerSearchQuery.toLowerCase();
        if (!lowerQuery) {
            return customers.slice(0, 10);
        }
        return customers
            .filter(c =>
                `${c.first_name} ${c.last_name}`.toLowerCase().includes(lowerQuery) ||
                (c.email || '').toLowerCase().includes(lowerQuery) ||
                (c.phone || '').toLowerCase().includes(lowerQuery)
            )
            .slice(0, 20);
    }, [customers, customerSearchQuery]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target as Node)) {
                setIsCustomerDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const calculateItineraryTotal = useCallback((costingOption: CostingOption | undefined, lead: Lead | undefined) => {
        if (!costingOption || !fxRates || !lead) return 0;

        if (costingOption.isManualCosting && costingOption.manualPackageCost) {
            return costingOption.manualPackageCost;
        }

        let subtotal = 0, gst = 0, tcs = 0, flightFee = 0;
        const hasFlights = (costingOption.costing.flights_outbound?.length || 0) > 0 || (costingOption.costing.flights_return?.length || 0) > 0;
        if (hasFlights) flightFee = 100;

        const processItems = (items: (CostingItem | HotelCostingItem)[], category: string) => {
            items.forEach(item => {
                if (!item.included) return;
                const rawInr = item.unitPrice * item.quantity * (fxRates[item.currency] || 1) * ((item as HotelCostingItem).nights || 1);
                const costWithMarkup = category.startsWith('flights') ? rawInr : (rawInr + 2) * 1.15;
                subtotal += costWithMarkup;
                if (category === 'visa') gst += costWithMarkup * 0.18;
                if (lead.tour_region === TourRegion.Domestic && ['hotels', 'transfers', 'sightseeing'].includes(category)) gst += costWithMarkup * 0.05;
                if (lead.tour_region === TourRegion.International && ['hotels', 'transfers', 'sightseeing', 'insurance', 'other'].includes(category)) tcs += costWithMarkup * 0.05;
            });
        };
        Object.entries(costingOption.costing).forEach(([category, items]) => processItems(items as any[], category));
        return subtotal + gst + tcs + flightFee;
    }, [fxRates]);

    const calculateTotals = useCallback((
        items: InvoiceItem[] = [],
        leadId?: number,
        gstPercentage: number = 5,
        discountAmount: number = 0,
        isTcsApplied: boolean = false,
        serviceType?: string,
        tcsPercentage: number = 5
    ) => {
        // Calculate per-row GST and sum up
        let totalTaxableValue = 0;
        let totalGstAmount = 0;
        let subtotalBeforeGst = 0;

        items.forEach(item => {
            const rate = Number(item.rate) || 0;
            const professionalFee = Number(item.professionalFee) || 0;
            const qty = Number(item.qty) || 0;

            // Determine service type from item
            const serviceTypeName = item.serviceType || item.itemName || '';
            const isTourPackageWhollyOutside = serviceTypeName.includes('Tour Package (wholly outside India)');
            const isTourPackage = serviceTypeName.includes('Tour Package') && !isTourPackageWhollyOutside;
            const isPassThrough = item.isPassThrough || item.itemName?.includes('Base Fare') || item.itemName?.includes('Pass-through');
            const isRentACabOrRenting = /rent.?a.?cab|other renting/i.test(serviceTypeName);

            // Calculate taxable value for this row
            let taxableValue = 0;
            if (isPassThrough) {
                taxableValue = 0;
            } else if (isTourPackageWhollyOutside || isTourPackage) {
                taxableValue = (rate + professionalFee) * qty;
            } else if (isRentACabOrRenting) {
                taxableValue = (rate + professionalFee) * qty; // Rent-a-Cab: Taxable Value = Rate + Service Fees
            } else {
                taxableValue = professionalFee * qty; // Others: only professional fee is taxable
            }

            // Calculate GST for this row (use item's GST % if set)
            const rowGstPercentage = item.gstPercentage || 0;
            const rowGstAmount = item.gstAmount !== undefined ? item.gstAmount : (taxableValue * (rowGstPercentage / 100));

            // For subtotal calculation: base amount before GST/TCS
            let itemBaseAmount = 0;
            if (isPassThrough) {
                itemBaseAmount = rate * qty;
            } else if (isTourPackage) {
                itemBaseAmount = (rate + professionalFee) * qty; // Rate + Service Fee before GST and TCS
            } else {
                itemBaseAmount = (rate + professionalFee) * qty; // Rate (pass-through) + Professional Fee
            }

            totalTaxableValue += taxableValue;
            totalGstAmount += rowGstAmount;
            subtotalBeforeGst += itemBaseAmount;
        });

        // Apply discount to subtotal (before GST)
        const discountedSubtotal = subtotalBeforeGst - discountAmount;

        // Split GST into CGST and SGST (50-50)
        const cgst = totalGstAmount / 2;
        const sgst = totalGstAmount / 2;

        // TCS is applied once at invoice level on (Sub Total Taxable Value + GST), not per item
        let tcs = 0;
        if (isTcsApplied) {
            tcs = (discountedSubtotal + totalGstAmount) * (tcsPercentage / 100);
        }

        // Grand total: Sub Total + GST + TCS (invoice-level only)
        const total = discountedSubtotal + totalGstAmount + tcs;

        return {
            subtotal: discountedSubtotal,
            totalTaxableValue,
            cgst,
            sgst,
            totalGst: totalGstAmount,
            tcs,
            total,
            discount: discountAmount,
            gstPercentage: 0 // No global GST percentage anymore
        };
    }, []);

    useEffect(() => {
        const fetchRates = async () => {
            try {
                const response = await fetch('https://api.frankfurter.app/latest?from=INR');
                if (!response.ok) throw new Error('Failed to fetch FX rates');
                const data = await response.json();
                setFxRates(data.rates);
            } catch (error) { addToast('Could not load currency rates.', 'error'); }
        };
        fetchRates();
    }, [addToast]);

    const DRAFT_STORAGE_KEY = 'invoicing_new_invoice_draft';

    useEffect(() => {
        const leadForInvoice = invoice?.lead_id ? leads.find(l => l.id === invoice.lead_id) : null;
        let initialState: Partial<Invoice>;
        if (isNew) {
            const defaultIssue = new Date().toISOString().split('T')[0];
            const defaultDue = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const defaultItems = [{ id: Date.now(), itemName: '', description: '', qty: 1, rate: 0, amount: 0 }];
            initialState = {
                ...invoice,
                invoice_number: (invoice as any)?.invoice_number || newInvoiceNumber.current,
                issue_date: (invoice as any)?.issue_date || defaultIssue,
                due_date: (invoice as any)?.due_date || defaultDue,
                status: InvoiceStatus.Draft,
                items: (invoice as any)?.items?.length ? (invoice as any).items : defaultItems,
                gst_percentage: (invoice as any)?.gst_percentage ?? 5,
                discount_amount: (invoice as any)?.discount_amount ?? 0,
                is_tcs_applied: (invoice as any)?.is_tcs_applied ?? false,
                tcs_percentage: (invoice as any)?.tcs_percentage ?? 5,
                display_name: (invoice as any)?.display_name,
                billing_name: (invoice as any)?.billing_name,
                billing_address: (invoice as any)?.billing_address,
                billing_company: (invoice as any)?.billing_company,
                billing_gst_number: (invoice as any)?.billing_gst_number,
                billing_pan_number: (invoice as any)?.billing_pan_number,
            };
        } else {
            const savedRoundOff = (invoice as Invoice).round_off;
            initialState = {
                ...invoice,
                tcs_percentage: invoice?.tcs_percentage ?? 5,
                // Only keep saved round_off if it was explicitly non-zero (so auto-calc applies for 0/null/undefined)
                round_off: savedRoundOff != null && savedRoundOff !== 0 ? savedRoundOff : undefined,
            };
            // If TCS checkbox is unchecked but items have TCS amounts, clear them
            if (!initialState.is_tcs_applied && initialState.items) {
                initialState.items = initialState.items.map(item => {
                    if (item.tcsAmount && item.tcsAmount > 0) {
                        // Recalculate amount without TCS
                        const amountWithoutTcs = (item.amount || 0) - (item.tcsAmount || 0);
                        return {
                            ...item,
                            tcsAmount: 0,
                            amount: amountWithoutTcs
                        };
                    }
                    return item;
                });
            }
        }
        setEditedInvoice(initialState);
    }, [invoice, isNew, leads]);

    // Persist new-invoice draft to sessionStorage so it survives tab switch / navigation
    useEffect(() => {
        if (!isNew) return;
        const key = DRAFT_STORAGE_KEY;
        const t = setTimeout(() => {
            try {
                const payload = { ...editedInvoice };
                if (payload.customer_id || payload.items?.length || payload.issue_date) {
                    sessionStorage.setItem(key, JSON.stringify(payload));
                }
            } catch (_) {}
        }, 500);
        return () => clearTimeout(t);
    }, [isNew, editedInvoice]);

    useEffect(() => {
        if (isNew && fxRates && editedInvoice.lead_id && editedInvoice.items?.length === 1 && editedInvoice.items[0].amount === 0) {
            const leadForInvoice = leads.find(l => l.id === editedInvoice.lead_id);
            if (leadForInvoice && leadForInvoice.lead_type === LeadType.Booked) {
                const itineraryMeta = itineraries.find(i => leadForInvoice.itinerary_ids?.includes(i.id));
                const latestVersion = itineraryMeta?.itinerary_versions?.sort((a, b) => b.version_number - a.version_number)[0];
                const defaultOption = latestVersion?.costing_options?.find(o => o.isDefault);

                if (itineraryMeta && defaultOption) {
                    const totalFromItinerary = calculateItineraryTotal(defaultOption, leadForInvoice);
                    const items = [{ id: Date.now(), itemName: 'Tour Package', description: `Full Payment for ${leadForInvoice.destination} Tour Package`, qty: 1, rate: totalFromItinerary, amount: totalFromItinerary }];

                    setEditedInvoice(prev => ({ ...prev, items }));
                } else if (leadForInvoice.status === 'Confirmed') { // Fallback for advance invoice on confirmed leads
                    const totalCost = 5000;
                    const items = [{ id: Date.now(), itemName: 'Tour Package', description: `Booking Confirmation & Advance for ${leadForInvoice.destination}`, qty: 1, rate: totalCost, amount: totalCost }];
                    setEditedInvoice(prev => ({ ...prev, items }));
                }
            }
        }
    }, [isNew, fxRates, editedInvoice.lead_id, leads, itineraries, calculateItineraryTotal]);

    // Auto-populate item name and description when lead is selected and service type is Tour Package
    useEffect(() => {
        if (editedInvoice.lead_id && editedInvoice.service_type?.includes('Tour Package') && editedInvoice.items) {
            const leadForInvoice = leads.find(l => l.id === editedInvoice.lead_id);
            if (leadForInvoice) {
                const needsUpdate = editedInvoice.items.some(item =>
                    !item.itemName || item.itemName === '' || !item.description || item.description === ''
                );
                if (needsUpdate) {
                    setEditedInvoice(prev => ({
                        ...prev,
                        items: prev.items?.map(item => ({
                            ...item,
                            itemName: item.itemName || 'Tour Package',
                            description: item.description || `${leadForInvoice.destination} Tour Package`
                        }))
                    }));
                }
            }
        }
    }, [editedInvoice.lead_id, editedInvoice.service_type, leads]);

    const handleItemChange = (id: number, field: keyof InvoiceItem, value: string | number | boolean | undefined) => {
        const newItems = editedInvoice.items?.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };

                // Reverse calculation (Total mode): When Total (amount) is changed, back-calculate Service Fee from Total and Rate
                if (field === 'amount') {
                    const totalAmount = Number(value) || 0;
                    const rate = Number(updatedItem.rate) || 0;
                    const qty = Number(updatedItem.qty) || 1;
                    const serviceTypeName = updatedItem.serviceType || updatedItem.itemName || '';
                    const isTourPackageWhollyOutside = serviceTypeName.includes('Tour Package (wholly outside India)');
                    const isTourPackage = serviceTypeName.includes('Tour Package') && !isTourPackageWhollyOutside;
                    const isRentACabOrRenting = /rent.?a.?cab|other renting/i.test(serviceTypeName);
                    const gstPercentage = updatedItem.gstPercentage || (isTourPackage ? 5 : (isRentACabOrRenting ? 5 : 18));

                    let professionalFee = 0;
                    let taxableValue = 0;
                    let gstAmount = 0;
                    let tcsAmount = 0;

                    if (isTourPackageWhollyOutside) {
                        // Total = (Rate + Service Fee) * Qty => Service Fee = Total/Qty - Rate
                        professionalFee = (totalAmount / qty) - rate;
                        taxableValue = (rate + professionalFee) * qty;
                        gstAmount = 0;
                        tcsAmount = 0;
                    } else if (isTourPackage) {
                        if (editedInvoice.is_tcs_applied) {
                            const tcsPercent = editedInvoice.tcs_percentage ?? 5;
                            taxableValue = totalAmount / ((1 + gstPercentage / 100) * (1 + tcsPercent / 100));
                            gstAmount = taxableValue * (gstPercentage / 100);
                            tcsAmount = (taxableValue + gstAmount) * (tcsPercent / 100);
                        } else {
                            taxableValue = totalAmount / (1 + gstPercentage / 100);
                            gstAmount = taxableValue * (gstPercentage / 100);
                            tcsAmount = 0;
                        }
                        // Taxable Value = (Rate + Service Fee) * Qty => Service Fee = TaxableValue/Qty - Rate
                        professionalFee = (taxableValue / qty) - rate;
                    } else if (isRentACabOrRenting) {
                        taxableValue = totalAmount / (1 + gstPercentage / 100);
                        gstAmount = taxableValue * (gstPercentage / 100);
                        tcsAmount = 0;
                        professionalFee = (taxableValue / qty) - rate;
                    } else {
                        // Others: Total = Rate*Qty + ServiceFee*Qty*(1+GST%) => Service Fee = (Total - Rate*Qty) / (Qty*(1+GST%))
                        const rateQty = rate * qty;
                        professionalFee = (totalAmount - rateQty) / (qty * (1 + gstPercentage / 100));
                        taxableValue = professionalFee * qty;
                        gstAmount = taxableValue * (gstPercentage / 100);
                        tcsAmount = 0;
                    }

                    updatedItem.rate = rate;
                    updatedItem.professionalFee = professionalFee;
                    updatedItem.taxableValue = taxableValue;
                    updatedItem.gstPercentage = gstPercentage;
                    updatedItem.gstAmount = gstAmount;
                    updatedItem.tcsAmount = tcsAmount;
                    updatedItem.amount = totalAmount;
                    updatedItem.sac = updatedItem.sac || '9985';
                    return updatedItem;
                }

                // Total mode: when Rate or Qty is changed, back-calculate Service Fee from current Total (amount) and Rate
                const amountMode = (item as InvoiceItem & { amountMode?: 'rate' | 'total' }).amountMode ?? 'rate';
                if ((field === 'rate' || field === 'qty') && amountMode === 'total') {
                    const totalAmount = Number(updatedItem.amount) || 0;
                    const rate = field === 'rate' ? Number(value) || 0 : Number(updatedItem.rate) || 0;
                    const qty = field === 'qty' ? Number(value) || 1 : Number(updatedItem.qty) || 1;
                    const serviceTypeName = updatedItem.serviceType || updatedItem.itemName || '';
                    const isTourPackageWhollyOutside = serviceTypeName.includes('Tour Package (wholly outside India)');
                    const isTourPackage = serviceTypeName.includes('Tour Package') && !isTourPackageWhollyOutside;
                    const isRentACabOrRenting = /rent.?a.?cab|other renting/i.test(serviceTypeName);
                    const gstPercentage = updatedItem.gstPercentage || (isTourPackage ? 5 : (isRentACabOrRenting ? 5 : 18));

                    let professionalFee = 0;
                    let taxableValue = 0;
                    let gstAmount = 0;
                    let tcsAmount = 0;

                    if (isTourPackageWhollyOutside) {
                        professionalFee = (totalAmount / qty) - rate;
                        taxableValue = (rate + professionalFee) * qty;
                        gstAmount = 0;
                        tcsAmount = 0;
                    } else if (isTourPackage) {
                        if (editedInvoice.is_tcs_applied) {
                            const tcsPercent = editedInvoice.tcs_percentage ?? 5;
                            taxableValue = totalAmount / ((1 + gstPercentage / 100) * (1 + tcsPercent / 100));
                            gstAmount = taxableValue * (gstPercentage / 100);
                            tcsAmount = (taxableValue + gstAmount) * (tcsPercent / 100);
                        } else {
                            taxableValue = totalAmount / (1 + gstPercentage / 100);
                            gstAmount = taxableValue * (gstPercentage / 100);
                            tcsAmount = 0;
                        }
                        professionalFee = (taxableValue / qty) - rate;
                    } else if (isRentACabOrRenting) {
                        taxableValue = totalAmount / (1 + gstPercentage / 100);
                        gstAmount = taxableValue * (gstPercentage / 100);
                        tcsAmount = 0;
                        professionalFee = (taxableValue / qty) - rate;
                    } else {
                        const rateQty = rate * qty;
                        professionalFee = (totalAmount - rateQty) / (qty * (1 + gstPercentage / 100));
                        taxableValue = professionalFee * qty;
                        gstAmount = taxableValue * (gstPercentage / 100);
                        tcsAmount = 0;
                    }

                    updatedItem.rate = field === 'rate' ? rate : updatedItem.rate;
                    updatedItem.qty = qty;
                    updatedItem.professionalFee = professionalFee;
                    updatedItem.taxableValue = taxableValue;
                    updatedItem.gstAmount = gstAmount;
                    updatedItem.tcsAmount = tcsAmount;
                    updatedItem.sac = updatedItem.sac || '9985';
                    return updatedItem;
                }

                // Forward calculation: Recalculate when rate, qty, professionalFee (Service Fees), serviceType changes (Rate mode)
                if (field === 'rate' || field === 'qty' || field === 'professionalFee' || field === 'gstPercentage' || field === 'serviceType' || field === 'itemName') {
                    const rate = Number(updatedItem.rate) || 0;
                    const serviceFee = Number(updatedItem.professionalFee) || 0; // Service Fees column
                    const qty = Number(updatedItem.qty) || 0;

                    // Determine service type from item
                    const serviceTypeName = updatedItem.serviceType || updatedItem.itemName || '';
                    const isTourPackageWhollyOutside = serviceTypeName.includes('Tour Package (wholly outside India)');
                    const isTourPackage = serviceTypeName.includes('Tour Package') && !isTourPackageWhollyOutside;
                    // Rent-a-Cab / Other renting: GST on Taxable Value = Rate (₹) + Service Fees (₹)
                    const isRentACabOrRenting = /rent.?a.?cab|other renting/i.test(serviceTypeName);

                    // Calculate taxable value and GST per row
                    let taxableValue = 0;
                    let gstPercentage = updatedItem.gstPercentage || 0;
                    let tcsAmount = 0;

                    if (isTourPackageWhollyOutside) {
                        // Tour Package (wholly outside India): 0% GST, no TCS, but include service fee in total
                        taxableValue = rate * qty;
                        gstPercentage = 0;
                        updatedItem.amount = (rate + serviceFee) * qty; // Rate + Service Fee (no GST, no TCS)
                    } else if (isTourPackage) {
                        // Tour Package: GST on full value including service fee -> (rate + serviceFee) * qty
                        taxableValue = (rate + serviceFee) * qty;
                        gstPercentage = updatedItem.gstPercentage || 5;
                        const gstAmount = taxableValue * (gstPercentage / 100);
                        if (editedInvoice.is_tcs_applied) {
                            const tcsPercent = editedInvoice.tcs_percentage ?? 5;
                            tcsAmount = (taxableValue + gstAmount) * (tcsPercent / 100);
                        }
                        updatedItem.amount = taxableValue + gstAmount + tcsAmount;
                    } else if (isRentACabOrRenting) {
                        // Rent-a-Cab / Other renting: GST on Taxable Value = Rate + Service Fees
                        taxableValue = (rate + serviceFee) * qty;
                        gstPercentage = updatedItem.gstPercentage || 5;
                        const gstAmount = taxableValue * (gstPercentage / 100);
                        updatedItem.amount = taxableValue + gstAmount; // Rate + Service Fee + GST
                    } else {
                        // Others (Air Ticket, Visa, etc.): GST only on Service Fees
                        taxableValue = serviceFee * qty;
                        gstPercentage = updatedItem.gstPercentage || 18;
                        const gstAmount = taxableValue * (gstPercentage / 100);
                        updatedItem.amount = (rate + serviceFee) * qty + gstAmount; // Rate (pass-through) + Service Fee + GST
                    }

                    // Calculate GST amount for this row
                    const gstAmount = taxableValue * (gstPercentage / 100);

                    // Update item with calculated values
                    updatedItem.taxableValue = taxableValue;
                    updatedItem.gstPercentage = gstPercentage;
                    updatedItem.gstAmount = gstAmount;
                    updatedItem.tcsAmount = tcsAmount;
                    updatedItem.sac = updatedItem.sac || '9985';
                }
                return updatedItem;
            }
            return item;
        });
        setEditedInvoice(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => {
        const newItem: InvoiceItem & { amountMode?: 'rate' | 'total' } = {
            id: Date.now(),
            itemName: '',
            serviceType: '',
            description: '',
            qty: 1,
            rate: 0,
            professionalFee: 0,
            amount: 0,
            taxableValue: 0,
            gstPercentage: 0,
            gstAmount: 0,
            sac: '9985',
            isPassThrough: false,
            tcsAmount: 0,
            amountMode: 'rate',
        };
        setEditedInvoice(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
    };

    const setItemAmountMode = (id: number, mode: 'rate' | 'total') => {
        setEditedInvoice(prev => ({
            ...prev,
            items: prev.items?.map(i => (i.id === id ? { ...i, amountMode: mode } as InvoiceItem & { amountMode?: 'rate' | 'total' } : i)) || [],
        }));
    };

    const removeItem = (id: number) => {
        setEditedInvoice(prev => ({ ...prev, items: prev.items?.filter(item => item.id !== id) }));
    };

    // Recalculate all items when TCS checkbox or percentage changes
    useEffect(() => {
        if (editedInvoice.items && editedInvoice.items.length > 0) {
            setEditedInvoice(prev => {
                const newItems = prev.items?.map(item => {
                    const rate = Number(item.rate) || 0;
                    const serviceFee = Number(item.professionalFee) || 0;
                    const qty = Number(item.qty) || 0;
                    const serviceTypeName = item.serviceType || item.itemName || '';
                    const isTourPackageWhollyOutside = serviceTypeName.includes('Tour Package (wholly outside India)');
                    const isTourPackage = serviceTypeName.includes('Tour Package') && !isTourPackageWhollyOutside;

                    if (isTourPackage && !isTourPackageWhollyOutside) {
                        const taxableValue = (rate + serviceFee) * qty;
                        const gstPercentage = item.gstPercentage || 5;
                        const gstAmount = taxableValue * (gstPercentage / 100);
                        let tcsAmount = 0;

                        // Only calculate TCS if checkbox is checked
                        if (prev.is_tcs_applied) {
                            const tcsPercent = prev.tcs_percentage ?? 5;
                            tcsAmount = (taxableValue + gstAmount) * (tcsPercent / 100);
                        }

                        return {
                            ...item,
                            taxableValue,
                            gstPercentage,
                            gstAmount,
                            tcsAmount,
                            amount: taxableValue + gstAmount + tcsAmount
                        };
                    } else {
                        // For non-Tour Package items, ensure TCS is 0 if checkbox is unchecked
                        if (!prev.is_tcs_applied && item.tcsAmount) {
                            // Recalculate amount without TCS
                            const currentAmount = item.amount || 0;
                            const amountWithoutTcs = currentAmount - (item.tcsAmount || 0);
                            return {
                                ...item,
                                tcsAmount: 0,
                                amount: amountWithoutTcs
                            };
                        }
                    }
                    return item;
                });
                return { ...prev, items: newItems };
            });
        }
    }, [editedInvoice.is_tcs_applied, editedInvoice.tcs_percentage]);

    // Recalculate all items when service type changes or items are modified
    useEffect(() => {
        if (editedInvoice.items && editedInvoice.items.length > 0 && editedInvoice.service_type) {
            const needsRecalculation = editedInvoice.items.some(item =>
                item.taxableValue === undefined ||
                item.gstAmount === undefined ||
                item.gstPercentage === undefined
            );

            if (needsRecalculation) {
                setEditedInvoice(prev => {
                    const serviceTypeName = prev.service_type || '';
                    const isTourPackage = serviceTypeName.includes('Tour Package') && !serviceTypeName.includes('Tour Package (wholly outside India)');

                    return {
                        ...prev,
                        items: prev.items?.map(item => {
                            const rate = Number(item.rate) || 0;
                            const professionalFee = Number(item.professionalFee) || 0;
                            const qty = Number(item.qty) || 0;
                            const itemServiceType = item.serviceType || item.itemName || '';
                            const isRentACabOrRenting = /rent.?a.?cab|other renting/i.test(itemServiceType);

                            // Calculate taxable value
                            const taxableValue = isTourPackage
                                ? (rate + professionalFee) * qty
                                : isRentACabOrRenting
                                    ? (rate + professionalFee) * qty // Rent-a-Cab: Rate + Service Fees
                                    : professionalFee * qty;

                            // Calculate GST
                            const gstPercentage = item.gstPercentage || (isTourPackage ? 5 : 18);
                            const gstAmount = taxableValue * (gstPercentage / 100);

                            // Calculate TCS for Tour Package if checkbox is checked
                            let tcsAmount = 0;
                            if (isTourPackage && prev.is_tcs_applied) {
                                const tcsPercent = prev.tcs_percentage ?? 5;
                                tcsAmount = (taxableValue + gstAmount) * (tcsPercent / 100);
                            }

                            // Total for row (rate + professionalFee) * qty + GST + TCS
                            const totalForRow = ((rate + professionalFee) * qty) + gstAmount + tcsAmount;

                            return {
                                ...item,
                                taxableValue,
                                gstPercentage,
                                gstAmount,
                                tcsAmount,
                                amount: totalForRow,
                                sac: item.sac || prev.sac_code || '9985'
                            };
                        })
                    };
                });
            }
        }
    }, [editedInvoice.service_type, editedInvoice.sac_code]);

    const totals = useMemo(() => {
        return calculateTotals(
            editedInvoice.items || [],
            editedInvoice.lead_id,
            editedInvoice.gst_percentage !== undefined && editedInvoice.gst_percentage !== null ? editedInvoice.gst_percentage : 5,
            editedInvoice.discount_amount || 0,
            editedInvoice.is_tcs_applied || false,
            editedInvoice.service_type,
            editedInvoice.tcs_percentage !== undefined && editedInvoice.tcs_percentage !== null ? editedInvoice.tcs_percentage : 5
        );
    }, [editedInvoice.items, editedInvoice.lead_id, editedInvoice.gst_percentage, editedInvoice.discount_amount, editedInvoice.is_tcs_applied, editedInvoice.service_type, editedInvoice.tcs_percentage, calculateTotals]);

    const defaultRoundOff = useMemo(() => Math.round(totals.total) - totals.total, [totals.total]);
    const effectiveRoundOff = editedInvoice.round_off !== undefined && editedInvoice.round_off !== null
        ? editedInvoice.round_off
        : (invoice?.id && invoice.total_amount != null ? (invoice.total_amount - totals.total) : defaultRoundOff);

    const handleSave = (markAsInvoiced: boolean = false) => {
        const { total, cgst, sgst, tcs } = totals;
        const amountPaid = (invoice?.total_amount || 0) - (invoice?.balance_due || 0);
        const totalWithRoundOff = total + effectiveRoundOff;
        const finalBalance = Math.max(0, totalWithRoundOff - amountPaid);
        const itemsForSave = editedInvoice.items?.map(item => {
            const { amountMode, ...rest } = item as InvoiceItem & { amountMode?: 'rate' | 'total' };
            return rest;
        });
        const invoiceToSave: Partial<Invoice> = {
            ...editedInvoice,
            items: itemsForSave,
            total_amount: totalWithRoundOff,
            balance_due: finalBalance,
            round_off: effectiveRoundOff,
            cgst_amount: cgst,
            sgst_amount: sgst,
            tcs_amount: tcs,
            tcs_percentage: editedInvoice.tcs_percentage ?? 5,
        };
        onSave(invoiceToSave, { generateLink: shouldGenerateLink, markAsInvoiced });
    };

    const handleRecordPayment = async () => {
        if (!invoice?.id) {
            addToast('Invoice must be saved before recording payment.', 'error');
            return;
        }

        if (!paymentAmount || paymentAmount <= 0) {
            addToast('Please enter a valid payment amount.', 'error');
            return;
        }

        if (!paymentDate) {
            addToast('Please select a payment date.', 'error');
            return;
        }

        setIsRecordingPayment(true);
        try {
            // Insert payment record
            const { error: paymentError } = await supabase
                .from('payments')
                .insert({
                    invoice_id: invoice.id,
                    lead_id: invoice.lead_id,
                    customer_id: invoice.customer_id,
                    payment_date: new Date(paymentDate).toISOString(),
                    amount: paymentAmount,
                    method: paymentMethod,
                    reference_id: paymentRef || null,
                    status: PaymentStatus.Paid,
                    notes: paymentNotes || null,
                    source: 'Manual',
                    created_by_staff_id: currentUser.id,
                    created_at: new Date().toISOString(),
                });

            if (paymentError) throw paymentError;

            // Recalculate invoice balance using helper
            const { recalculateInvoiceBalance } = await import('../lib/invoiceBalance');
            await recalculateInvoiceBalance(invoice.id);

            addToast('Payment recorded successfully.', 'success');

            // Reset form
            setPaymentAmount('');
            setPaymentDate(new Date().toISOString().split('T')[0]);
            setPaymentMethod(PaymentMethod.BankTransfer);
            setPaymentRef('');
            setPaymentNotes('');

            // Refresh data
            onRefresh();
        } catch (error: any) {
            console.error('Error recording payment:', error);
            addToast(`Failed to record payment: ${error.message}`, 'error');
        } finally {
            setIsRecordingPayment(false);
        }
    };

    const associatedLeads = useMemo(() => {
        if (!editedInvoice.customer_id) return [];
        return leads.filter(l => l.customer_id === editedInvoice.customer_id);
    }, [editedInvoice.customer_id, leads]);

    const invoiceActivity: Activity[] = useMemo(() => {
        return (editedInvoice.activity || invoice?.activity || []) as Activity[];
    }, [editedInvoice.activity, invoice?.activity]);

    const canSignInvoice = useMemo(() => {
        if (isNew) return false;
        return currentUser.role === 'Super Admin' || currentUser.role === 'Manager' || currentUser.is_accountant === true;
    }, [currentUser.role, currentUser.is_accountant, isNew]);

    const isSigned = useMemo(() => {
        return Boolean(editedInvoice.is_signed ?? invoice?.is_signed);
    }, [editedInvoice.is_signed, invoice?.is_signed]);

    const appendInvoiceActivity = useCallback(
        async (type: string, description: string, details?: string) => {
            if (!invoice?.id) return;
            const activity: Activity = {
                id: Date.now(),
                type,
                description,
                details,
                user: currentUser.name,
                timestamp: new Date().toISOString(),
            };
            const updated = [activity, ...invoiceActivity];
            setEditedInvoice(prev => ({ ...prev, activity: updated }));
            const { error } = await supabase
                .from('invoices')
                .update({ activity: updated })
                .eq('id', invoice.id);
            if (error) {
                console.error('[Invoice Activity] Failed to append activity:', error.message);
            }
        },
        [invoice?.id, invoiceActivity, currentUser.name],
    );

    const handleDownloadPdf = async () => {
        if (!invoice?.id) {
            addToast('Unable to generate PDF. Please save the invoice first.', 'error');
            return;
        }

        setIsDownloading(true);
        try {
            addToast('Generating PDF...', 'success');

            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Authentication required. Please log in again.');
            }

            const response = await fetch(`${API_BASE_URL}/api/invoice/generate-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ invoiceId: invoice.id }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to generate PDF');
            }

            // Get PDF blob and validate
            const blob = await response.blob();

            // Validate blob
            if (!blob || blob.size === 0) {
                throw new Error('Received empty PDF file');
            }

            // Check if it's actually a PDF
            const blobType = blob.type;
            if (blobType && !blobType.includes('pdf') && !blobType.includes('application/pdf')) {
                console.warn('Warning: Response type is not PDF:', blobType);
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Invoice_${invoice.invoice_number}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            addToast('PDF downloaded successfully!', 'success');
            await appendInvoiceActivity('Invoice Downloaded', `Invoice ${invoice.invoice_number} PDF downloaded.`, undefined);
        } catch (error: any) {
            console.error('Error generating PDF:', error);
            addToast(`Failed to generate PDF: ${error.message}`, 'error');
        } finally {
            setIsDownloading(false);
        }
    };

    const customerForInvoice = useMemo(() => {
        return customers.find(c => c.id === editedInvoice.customer_id);
    }, [editedInvoice.customer_id, customers]);

    const leadForInvoice = useMemo(() => {
        return leads.find(l => l.id === editedInvoice.lead_id);
    }, [editedInvoice.lead_id, leads]);

    // Format MTS ID string: MTS-{lead_id} - {duration} {destination} Tour Package x {adults}A+{children}C
    const formattedMTSId = useMemo(() => {
        if (!leadForInvoice) return null;

        const leadId = leadForInvoice.id;
        const duration = leadForInvoice.duration || '';
        const destination = leadForInvoice.destination || '';

        // Get adults and children from requirements
        const adults = leadForInvoice.requirements?.adults || 0;
        const children = leadForInvoice.requirements?.children || 0;

        return `MTS-${leadId} - ${duration} ${destination} Tour Package x ${adults}A+${children}C`;
    }, [leadForInvoice]);

    const branchForInvoice = useMemo(() => {
        if (!leadForInvoice || !leadForInvoice.branch_ids || leadForInvoice.branch_ids.length === 0) {
            return branches.find(b => b.id === currentUser.branch_id) || branches[0];
        }
        return branches.find(b => b.id === leadForInvoice.branch_ids[0]) || branches[0];
    }, [leadForInvoice, branches, currentUser.branch_id]);

    const showGenerateLinkCheckbox = (isNew || (invoice?.status === InvoiceStatus.Draft && !invoice?.razorpay_payment_link_url));

    const sendableStatuses = [InvoiceStatus.Invoiced, InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid, InvoiceStatus.Paid, InvoiceStatus.Overdue];
    const currentStatus = editedInvoice.status ?? invoice?.status;
    const canSendInvoice = !isNew && currentStatus && sendableStatuses.includes(currentStatus);

    const handleSendWhatsApp = async () => {
        if (!invoice?.id) return;
        const status = editedInvoice.status ?? invoice?.status;
        if (!sendableStatuses.includes(status)) {
            const msg = status === InvoiceStatus.Draft ? "Can't send - invoice is in DRAFT." : status === InvoiceStatus.Void ? "Can't send - invoice is VOID." : `Invoice cannot be sent (status: ${status}).`;
            addToast(msg, 'error');
            return;
        }
        setIsSendingWhatsApp(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Authentication required. Please log in again.');
            const response = await fetch(`${API_BASE_URL}/api/invoicing/send-whatsapp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ invoiceId: invoice.id })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            addToast('Invoice sent via WhatsApp.', 'success');
            await appendInvoiceActivity('Invoice Sent', `Invoice ${invoice.invoice_number} sent via WhatsApp.`, undefined);
            await onRefresh();
        } catch (error: any) {
            addToast(`Failed to send: ${error.message}`, 'error');
        } finally {
            setIsSendingWhatsApp(false);
        }
    };

    const handleArchive = async () => {
        if (!invoice?.id) return;
        if (currentUser.role !== 'Super Admin' || currentUser.branch_id !== 1) {
            addToast('Only Super Admin can archive invoices.', 'error');
            return;
        }
        setIsArchiving(true);
        try {
            const { error } = await supabase
                .from('invoices')
                .update({ status: InvoiceStatus.Void })
                .eq('id', invoice.id);
            if (error) throw error;
            addToast('Invoice archived.', 'success');
            await onRefresh();
            onClose();
        } catch (error: any) {
            addToast(`Failed to archive invoice: ${error.message}`, 'error');
        } finally {
            setIsArchiving(false);
        }
    };

    // Super Admin (Branch 1) and Accountant can edit all invoices.
    // Additionally, staff assigned to the related lead can edit invoices for that lead.
    const isPrivilegedInvoiceEditor =
        (currentUser.role === 'Super Admin' && currentUser.branch_id === 1) ||
        currentUser.is_accountant === true;
    const isLeadAssignee =
        !!invoice?.lead_id &&
        leads
            .find(l => l.id === invoice.lead_id)
            ?.assigned_to?.some(s => s.id === currentUser.id);
    const canEdit = isNew || isPrivilegedInvoiceEditor || !!isLeadAssignee;
    const canRecordPayment = false; // Disabled - payments must be recorded via Lead Costing tab

    // Determine if the user can permanently delete the invoice
    const canDelete = !isNew &&
        currentUser.role === 'Super Admin' &&
        invoice?.status === InvoiceStatus.Draft &&
        !invoice?.razorpay_payment_link_id &&
        invoicePayments.length === 0;
    const canArchive = !isNew && editedInvoice.status !== InvoiceStatus.Void;

    const handleToggleSign = async () => {
        if (!invoice?.id) return;
        if (!canSignInvoice) {
            addToast('Only Super Admin, Manager, or Accountant can sign/undo sign.', 'error');
            return;
        }
        const nextSignedState = !isSigned;
        try {
            const payload: Partial<Invoice> & { activity?: Activity[] } = {
                is_signed: nextSignedState,
                signed_by_staff_id: nextSignedState ? currentUser.id : null,
                signed_at: nextSignedState ? new Date().toISOString() : null,
            };

            const actionText = nextSignedState ? 'signed' : 'signature removed';
            const description = nextSignedState
                ? `Invoice ${invoice.invoice_number} signed by ${currentUser.name}.`
                : `Invoice ${invoice.invoice_number} signature removed by ${currentUser.name}.`;

            // Optimistic UI update for sign fields
            setEditedInvoice(prev => ({
                ...prev,
                is_signed: payload.is_signed,
                signed_by_staff_id: payload.signed_by_staff_id ?? undefined,
                signed_at: payload.signed_at ?? undefined,
            }));

            // Update sign fields + append activity in a single update
            const activity: Activity = {
                id: Date.now(),
                type: nextSignedState ? 'Invoice Signed' : 'Invoice Unsigned',
                description,
                user: currentUser.name,
                timestamp: new Date().toISOString(),
            };
            const updatedActivity = [activity, ...invoiceActivity];

            const { error } = await supabase
                .from('invoices')
                .update({ ...payload, activity: updatedActivity })
                .eq('id', invoice.id);

            if (error) {
                throw error;
            }

            setEditedInvoice(prev => ({ ...prev, activity: updatedActivity }));
            addToast(`Invoice ${actionText}.`, 'success');
        } catch (error: any) {
            console.error('[Invoice Sign] Failed to toggle sign:', error.message || error);
            addToast(`Failed to update sign status: ${error.message || 'Unknown error'}`, 'error');
        }
    };

    const drawer = (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-[100] transition-opacity duration-300" onClick={handlePanelClose} style={{ pointerEvents: showPreview ? 'none' : 'auto' }}>
            <div className={`fixed inset-y-0 right-0 z-[100] w-full sm:w-[98vw] sm:max-w-[98vw] bg-slate-50 shadow-xl flex flex-col transform transition-transform duration-300 ease-out ${isPanelOpen && !isPanelClosing ? 'translate-x-0' : 'translate-x-full'}`} onClick={(e) => e.stopPropagation()} style={{ pointerEvents: showPreview ? 'none' : 'auto' }}>
                <div className="flex items-center justify-between gap-2 p-3 sm:p-6 bg-[#1f2937] text-white shrink-0">
                    <h2 className="text-base sm:text-lg font-semibold truncate min-w-0">
                        {isNew ? 'New Invoice' : `Invoice ${editedInvoice.invoice_number}`}
                        {isSigned && !isNew && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500 text-white uppercase tracking-wide">
                                Signed
                            </span>
                        )}
                    </h2>
                    <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 shrink-0">
                        {canSendInvoice && (
                            <button onClick={handleSendWhatsApp} disabled={isSendingWhatsApp} className="flex items-center justify-center w-11 h-11 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-full sm:rounded-[5px] text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-slate-400 touch-manipulation" title="Send invoice via WhatsApp">
                                {isSendingWhatsApp ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <IconWhatsapp className="w-4 h-4 shrink-0" />}
                                <span className="hidden sm:inline sm:ml-1.5">{isSendingWhatsApp ? 'Sending...' : 'Send to WhatsApp'}</span>
                            </button>
                        )}
                        <button onClick={() => setShowPreview(true)} className="flex items-center justify-center w-11 h-11 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-full sm:rounded-[5px] text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 touch-manipulation" aria-label="Preview Invoice">
                            <IconEye className="w-4 h-4 shrink-0" />
                            <span className="hidden sm:inline sm:ml-1.5">Preview Invoice</span>
                        </button>
                        {!isNew && canSignInvoice && (
                            <button
                                onClick={handleToggleSign}
                                className={`flex items-center justify-center w-11 h-11 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-full sm:rounded-[5px] text-sm font-medium touch-manipulation ${
                                    isSigned
                                        ? 'text-amber-800 bg-amber-100 hover:bg-amber-200'
                                        : 'text-emerald-800 bg-emerald-100 hover:bg-emerald-200'
                                }`}
                                aria-label={isSigned ? 'Undo Sign Invoice' : 'Sign Invoice'}
                            >
                                <IconCheckCircle className="w-4 h-4 shrink-0" />
                                <span className="hidden sm:inline sm:ml-1.5">
                                    {isSigned ? 'Undo Sign' : 'Sign Invoice'}
                                </span>
                            </button>
                        )}
                        {!isNew && (
                            <button onClick={handleDownloadPdf} disabled={isDownloading} className="flex items-center justify-center w-11 h-11 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-full sm:rounded-[5px] text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-400 touch-manipulation" aria-label="Download PDF">
                                {isDownloading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-700"></div> : <IconDownload className="w-4 h-4 shrink-0" />}
                                <span className="hidden sm:inline sm:ml-1.5">{isDownloading ? 'Downloading...' : 'Download PDF'}</span>
                            </button>
                        )}
                        {canArchive && currentUser.role === 'Super Admin' && currentUser.branch_id === 1 && (
                            <button
                                onClick={handleArchive}
                                disabled={isArchiving}
                                className="flex items-center justify-center w-11 h-11 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-full sm:rounded-[5px] text-sm font-medium text-slate-800 bg-amber-100 hover:bg-amber-200 disabled:bg-slate-300 touch-manipulation"
                                title="Archive invoice (Super Admin only)"
                                aria-label={isArchiving ? 'Archiving' : 'Archive'}
                            >
                                {isArchiving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-700 shrink-0"></div> : <IconTrash className="w-4 h-4 shrink-0" />}
                                <span className="hidden sm:inline sm:ml-1.5">{isArchiving ? 'Archiving...' : 'Archive'}</span>
                            </button>
                        )}
                        {canDelete && (
                            <button onClick={() => onDelete(invoice.id)} className="flex items-center justify-center w-11 h-11 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-full sm:rounded-[5px] text-sm font-medium text-white bg-red-600 hover:bg-red-700 touch-manipulation" title="Permanently Delete Draft" aria-label="Delete">
                                <IconTrash className="w-4 h-4" />
                            </button>
                        )}
                        <button type="button" onClick={(e) => { e.stopPropagation(); handlePanelClose(); }} className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-slate-700 touch-manipulation" aria-label="Close"><IconX className="w-5 h-5" /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 space-y-4 sm:space-y-6 min-h-0">
                    <div className="bg-white p-3 sm:p-4 rounded-lg border mb-2">
                        <nav className="-mb-px flex space-x-6" aria-label="Invoice Tabs">
                            <button
                                type="button"
                                onClick={() => setActiveTab('details')}
                                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-xs sm:text-sm ${
                                    activeTab === 'details'
                                        ? 'border-blue-600 text-blue-700'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                Details
                            </button>
                            {!isNew && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('activity')}
                                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-xs sm:text-sm ${
                                        activeTab === 'activity'
                                            ? 'border-blue-600 text-blue-700'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    Activity
                                </button>
                            )}
                        </nav>
                    </div>

                    {activeTab === 'details' && (
                        <div className="bg-white p-4 sm:p-6 rounded-lg border">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
                                {canEdit ? (
                                    <div ref={customerDropdownRef} className="relative w-full">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={isCustomerDropdownOpen ? customerSearchQuery : (customerForInvoice ? `${customerForInvoice.first_name} ${customerForInvoice.last_name}` : '')}
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
                                                    {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                                                        <li
                                                            key={c.id}
                                                            onClick={() => {
                                                                setEditedInvoice(prev => ({ ...prev, customer_id: c.id, lead_id: undefined }));
                                                                setIsCustomerDropdownOpen(false);
                                                                setCustomerSearchQuery('');
                                                            }}
                                                            className="p-2 hover:bg-slate-100 cursor-pointer text-sm"
                                                        >
                                                            {c.first_name} {c.last_name}{c.phone ? ` — ${c.phone}` : ''}
                                                        </li>
                                                    )) : (
                                                        <li className="p-2 text-sm text-slate-500">No customers found.</li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-2 bg-slate-100 rounded-md text-sm text-slate-700">
                                        {customerForInvoice ? `${customerForInvoice.first_name} ${customerForInvoice.last_name}` : 'N/A'}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Link to Lead (Optional)</label>
                                {canEdit ? (
                                    <select
                                        value={editedInvoice.lead_id || ''}
                                        onChange={e => {
                                            const leadId = e.target.value ? parseInt(e.target.value) : undefined;
                                            const selectedLead = leadId ? leads.find(l => l.id === leadId) : null;
                                            setEditedInvoice(prev => {
                                                const updated = { ...prev, lead_id: leadId };
                                                // If Tour Package service type is selected, auto-set item name and description
                                                if (selectedLead && prev.service_type?.includes('Tour Package') && prev.items) {
                                                    updated.items = prev.items.map(item => ({
                                                        ...item,
                                                        itemName: item.itemName || 'Tour Package',
                                                        description: item.description || `${selectedLead.destination} Tour Package`
                                                    }));
                                                }
                                                return updated;
                                            });
                                        }}
                                        disabled={!editedInvoice.customer_id}
                                        className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900 disabled:bg-slate-200"
                                    >
                                        <option value="">Select a lead</option>
                                        {associatedLeads.map(l => (
                                            <option key={l.id} value={l.id}>#{l.id} - {l.destination}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="p-2 bg-slate-100 rounded-md text-sm text-slate-700">
                                            {leadForInvoice ? `#${leadForInvoice.id} - ${leadForInvoice.destination}` : 'N/A'}
                                        </div>
                                        {formattedMTSId && (
                                            <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                                                <p className="text-xs font-medium text-blue-700 mb-1">MTS ID</p>
                                                <p className="text-sm font-semibold text-blue-900">{formattedMTSId}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="mt-4">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Invoice Status</label>
                                {canEdit ? (
                                    <select
                                        value={editedInvoice.status ?? InvoiceStatus.Draft}
                                        onChange={e => setEditedInvoice(prev => ({ ...prev, status: e.target.value as InvoiceStatus }))}
                                        className="w-full max-w-xs text-sm p-2 border rounded-md bg-slate-50 text-slate-900"
                                    >
                                        {Object.values(InvoiceStatus).map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="inline-block"><StatusBadge status={(editedInvoice.status ?? InvoiceStatus.Draft) as InvoiceStatus} /></div>
                                )}
                            </div>
                        </div>

                        {/* Customer Details Section - editable when canEdit */}
                        {customerForInvoice && (
                            <div className="mt-6 p-4 bg-slate-50 rounded-lg border">
                                <h3 className="text-sm font-semibold text-slate-800 mb-3">Customer Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-1">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Display Name</label>
                                        {canEdit ? (
                                            <input
                                                type="text"
                                                value={editedInvoice.display_name ?? (customerForInvoice.company && customerForInvoice.gst_number ? customerForInvoice.company : `${customerForInvoice.first_name} ${customerForInvoice.last_name}`)}
                                                onChange={e => setEditedInvoice(prev => ({ ...prev, display_name: e.target.value }))}
                                                className="w-full text-sm p-2 border rounded-md bg-white text-slate-900"
                                                placeholder="Display name for invoice"
                                            />
                                        ) : (
                                            <div className="p-2 bg-white rounded-md text-sm text-slate-700 border">
                                                {editedInvoice.display_name ?? (customerForInvoice.company && customerForInvoice.gst_number ? customerForInvoice.company : `${customerForInvoice.first_name} ${customerForInvoice.last_name}`)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="sm:col-span-1">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Company Name</label>
                                        {canEdit ? (
                                            <input
                                                type="text"
                                                value={editedInvoice.billing_company ?? customerForInvoice.company ?? ''}
                                                onChange={e => setEditedInvoice(prev => ({ ...prev, billing_company: e.target.value }))}
                                                className="w-full text-sm p-2 border rounded-md bg-white text-slate-900"
                                                placeholder="Company name"
                                            />
                                        ) : (
                                            <div className="p-2 bg-white rounded-md text-sm text-slate-700 border">
                                                {editedInvoice.billing_company ?? customerForInvoice.company ?? '—'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="sm:col-span-1">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                                        {canEdit ? (
                                            <input
                                                type="text"
                                                value={editedInvoice.billing_name ?? `${customerForInvoice.first_name} ${customerForInvoice.last_name}`.trim()}
                                                onChange={e => setEditedInvoice(prev => ({ ...prev, billing_name: e.target.value }))}
                                                className="w-full text-sm p-2 border rounded-md bg-white text-slate-900"
                                                placeholder="Customer name"
                                            />
                                        ) : (
                                            <div className="p-2 bg-white rounded-md text-sm text-slate-700 border">
                                                {editedInvoice.billing_name ?? `${customerForInvoice.first_name} ${customerForInvoice.last_name}`}
                                            </div>
                                        )}
                                    </div>
                                    <div className="col-span-1 sm:col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                                        {canEdit ? (
                                            <textarea
                                                value={editedInvoice.billing_address ?? (customerForInvoice.address?.street ? [
                                                    customerForInvoice.address.street,
                                                    customerForInvoice.address.city,
                                                    customerForInvoice.address.state,
                                                    customerForInvoice.address.country,
                                                    customerForInvoice.address.zip,
                                                ].filter(Boolean).join(', ') : '')}
                                                onChange={e => setEditedInvoice(prev => ({ ...prev, billing_address: e.target.value }))}
                                                className="w-full text-sm p-2 border rounded-md bg-white text-slate-900 min-h-[60px] resize-y"
                                                placeholder="Billing address"
                                                rows={2}
                                            />
                                        ) : (
                                            <div className="p-2 bg-white rounded-md text-sm text-slate-700 border">
                                                {editedInvoice.billing_address ?? (customerForInvoice.address?.street ? [
                                                    customerForInvoice.address.street,
                                                    customerForInvoice.address.city,
                                                    customerForInvoice.address.state,
                                                    customerForInvoice.address.country,
                                                    customerForInvoice.address.zip,
                                                ].filter(Boolean).join(', ') : '—')}
                                            </div>
                                        )}
                                    </div>
                                    <div className="sm:col-span-1">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">GST Number</label>
                                        {canEdit ? (
                                            <input
                                                type="text"
                                                value={editedInvoice.billing_gst_number ?? customerForInvoice.gst_number ?? ''}
                                                onChange={e => setEditedInvoice(prev => ({ ...prev, billing_gst_number: e.target.value }))}
                                                className="w-full text-sm p-2 border rounded-md bg-white text-slate-900"
                                                placeholder="GST number"
                                            />
                                        ) : (
                                            <div className="p-2 bg-white rounded-md text-sm text-slate-700 border">
                                                {editedInvoice.billing_gst_number ?? customerForInvoice.gst_number ?? '—'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="sm:col-span-1">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">PAN Number</label>
                                        {canEdit ? (
                                            <input
                                                type="text"
                                                value={editedInvoice.billing_pan_number ?? customerForInvoice.pan_number ?? ''}
                                                onChange={e => setEditedInvoice(prev => ({ ...prev, billing_pan_number: e.target.value }))}
                                                className="w-full text-sm p-2 border rounded-md bg-white text-slate-900"
                                                placeholder="PAN number"
                                            />
                                        ) : (
                                            <div className="p-2 bg-white rounded-md text-sm text-slate-700 border">
                                                {editedInvoice.billing_pan_number ?? customerForInvoice.pan_number ?? '—'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-6">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Invoice #</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={editedInvoice.invoice_number || ''}
                                    className="w-full text-sm p-2 border rounded-md bg-slate-200 text-slate-600 cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Issue Date</label>
                                <input
                                    type="date"
                                    value={editedInvoice.issue_date || ''}
                                    onChange={e => setEditedInvoice(prev => ({ ...prev, issue_date: e.target.value }))}
                                    disabled={!canEdit}
                                    className={`w-full text-sm p-2 border rounded-md ${canEdit ? 'bg-slate-50 text-slate-900' : 'bg-slate-100 text-slate-600'}`}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Due Date</label>
                                <input
                                    type="date"
                                    value={editedInvoice.due_date || ''}
                                    onChange={e => setEditedInvoice(prev => ({ ...prev, due_date: e.target.value }))}
                                    disabled={!canEdit}
                                    className={`w-full text-sm p-2 border rounded-md ${canEdit ? 'bg-slate-50 text-slate-900' : 'bg-slate-100 text-slate-600'}`}
                                />
                            </div>
                        </div>

                        </div>
                    )}

                    {!isNew && activeTab === 'activity' && (
                        <div className="bg-white p-4 sm:p-6 rounded-lg border">
                            <h3 className="text-sm font-semibold text-slate-800 mb-3">Invoice Activity</h3>
                            {invoiceActivity.length === 0 ? (
                                <p className="text-sm text-slate-500">No activity logged for this invoice yet.</p>
                            ) : (
                                <div className="relative pb-4">
                                    <div className="absolute left-3 sm:left-4 top-1 h-full w-px bg-slate-200" aria-hidden="true"></div>
                                    {invoiceActivity.map(activity => (
                                        <div key={activity.id} className="relative pl-8 sm:pl-12 pb-6 sm:pb-8">
                                            <div className="absolute left-3 sm:left-4 top-1 -translate-x-1/2 rounded-full bg-white p-1 border border-slate-300 shrink-0">
                                                <IconChatBubble className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-0">
                                                <div className="shrink-0 w-full sm:w-24 text-xs text-slate-500 text-left sm:text-left">
                                                    <p>
                                                        {new Date(activity.timestamp).toLocaleDateString('en-GB', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                        }).replace(/\//g, '-')}
                                                        {' '}
                                                        {new Date(activity.timestamp).toLocaleTimeString('en-US', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            hour12: true,
                                                        })}
                                                    </p>
                                                </div>
                                                <div className="sm:ml-4 grow min-w-0 rounded-lg border bg-white shadow-sm p-2.5 sm:p-3">
                                                    <p className="font-semibold text-sm text-slate-800">{activity.type}</p>
                                                    <p className="text-sm text-slate-600 break-words">{activity.description}</p>
                                                    <p className="text-xs text-slate-500 mt-1 break-words">
                                                        by {activity.user}
                                                        {activity.details && (
                                                            <span className="ml-2 text-blue-600">
                                                                {activity.details}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Items Table - horizontal scroll on mobile */}
                    <div className="bg-white p-4 sm:p-6 rounded-lg border">
                        <div className="overflow-x-auto -mx-4 sm:mx-0 sm:overflow-visible">
                            <div className="min-w-[800px] px-4 sm:px-0">
                        <div className="grid grid-cols-[minmax(200px,1fr)_80px_70px_130px_100px_100px_100px_70px_100px_100px_auto] gap-3 items-start mb-2 text-xs font-medium text-slate-500 px-2">
                            <span>Narration / Description</span>
                            <span className="text-center">SAC</span>
                            <span className="text-center">Qty</span>
                            <span className="text-left">Mode</span>
                            <span className="text-right">Rate (₹)</span>
                            <span className="text-right">Service Fees (₹)</span>
                            <span className="text-right">Taxable Value (₹)</span>
                            <span className="text-center">GST %</span>
                            <span className="text-right">GST Amount (₹)</span>
                            <span className="text-right">Total (₹)</span>
                            <span></span>
                        </div>
                        <div className="space-y-3">
                            {editedInvoice.items?.map((item) => {
                                const handleServiceTypeSelect = (serviceType: string, itemName: string, gst: number, sac: string) => {
                                    // Update all service type related fields in a single state update
                                    setEditedInvoice(prev => {
                                        const newItems = prev.items?.map(i => {
                                            if (i.id === item.id) {
                                                const updatedItem = {
                                                    ...i,
                                                    serviceType,
                                                    itemName,
                                                    gstPercentage: gst,
                                                    sac
                                                };

                                                // Recalculate values based on the new service type
                                                const rate = Number(updatedItem.rate) || 0;
                                                const serviceFee = Number(updatedItem.professionalFee) || 0;
                                                const qty = Number(updatedItem.qty) || 0;

                                                const isTourPackageWhollyOutside = serviceType.includes('Tour Package (wholly outside India)') || itemName.includes('Tour Package (wholly outside India)');
                                                const isTourPackage = (serviceType.includes('Tour Package') || itemName.includes('Tour Package')) && !isTourPackageWhollyOutside;
                                                const isRentACabOrRenting = /rent.?a.?cab|other renting/i.test(serviceType) || /rent.?a.?cab|other renting/i.test(itemName);

                                                let taxableValue = 0;
                                                let calculatedGstPercentage = gst;
                                                let tcsAmount = 0;

                                                if (isTourPackageWhollyOutside) {
                                                    taxableValue = rate * qty;
                                                    calculatedGstPercentage = 0;
                                                    updatedItem.amount = (rate + serviceFee) * qty;
                                                } else if (isTourPackage) {
                                                    taxableValue = (rate + serviceFee) * qty;
                                                    calculatedGstPercentage = gst;
                                                    const gstAmount = taxableValue * (calculatedGstPercentage / 100);
                                                    if (prev.is_tcs_applied) {
                                                        const tcsPercent = prev.tcs_percentage ?? 5;
                                                        tcsAmount = (taxableValue + gstAmount) * (tcsPercent / 100);
                                                    }
                                                    updatedItem.amount = taxableValue + gstAmount + tcsAmount;
                                                } else if (isRentACabOrRenting) {
                                                    // Rent-a-Cab / Other renting: GST on Taxable Value = Rate + Service Fees
                                                    taxableValue = (rate + serviceFee) * qty;
                                                    calculatedGstPercentage = gst;
                                                    const gstAmount = taxableValue * (calculatedGstPercentage / 100);
                                                    updatedItem.amount = taxableValue + gstAmount;
                                                } else {
                                                    taxableValue = serviceFee * qty;
                                                    calculatedGstPercentage = gst;
                                                    const gstAmount = taxableValue * (calculatedGstPercentage / 100);
                                                    updatedItem.amount = (rate + serviceFee) * qty + gstAmount;
                                                }

                                                const gstAmount = taxableValue * (calculatedGstPercentage / 100);

                                                return {
                                                    ...updatedItem,
                                                    taxableValue,
                                                    gstPercentage: calculatedGstPercentage,
                                                    gstAmount,
                                                    tcsAmount
                                                };
                                            }
                                            return i;
                                        });

                                        return { ...prev, items: newItems };
                                    });
                                };

                                const amountMode: 'rate' | 'total' = (item as any).amountMode ?? 'rate';
                                return (
                                    <div key={item.id} className="grid grid-cols-[minmax(200px,1fr)_80px_70px_130px_100px_100px_100px_70px_100px_100px_auto] gap-3 items-start">
                                        <div className="flex flex-col gap-1.5 min-w-0">
                                            <ServiceTypeDropdown
                                                item={item}
                                                onSelect={handleServiceTypeSelect}
                                                disabled={!canEdit}
                                            />
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                                disabled={!canEdit}
                                                className={`w-full text-sm p-2 border rounded-md ${canEdit ? 'bg-slate-50' : 'bg-slate-100'} text-slate-600`}
                                                placeholder="Description (optional)"
                                            />
                                        </div>
                                        <div className="p-2 text-center text-sm text-slate-600 border rounded-md bg-slate-50">
                                            {item.sac || '9985'}
                                        </div>
                                        <input
                                            type="number"
                                            value={item.qty}
                                            onChange={e => handleItemChange(item.id, 'qty', parseInt(e.target.value, 10) || 1)}
                                            disabled={!canEdit}
                                            className={`w-full text-sm p-2 border rounded-md text-center ${canEdit ? 'bg-slate-50' : 'bg-slate-100'}`}
                                        />
                                        <div className="flex flex-col gap-1 text-[11px]">
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="radio" name={`mode-${item.id}`} checked={amountMode === 'rate'} onChange={() => setItemAmountMode(item.id, 'rate')} disabled={!canEdit} className="rounded border-slate-300" />
                                                <span>Rate (₹)</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input type="radio" name={`mode-${item.id}`} checked={amountMode === 'total'} onChange={() => setItemAmountMode(item.id, 'total')} disabled={!canEdit} className="rounded border-slate-300" />
                                                <span>Total Amount</span>
                                            </label>
                                        </div>
                                        <div className={`flex items-center w-full text-sm border rounded-md focus-within:ring-1 focus-within:ring-blue-500 ${canEdit ? 'bg-slate-50' : 'bg-slate-100'}`}>
                                            <span className="text-slate-500 pl-3 pr-1">₹</span>
                                            <input
                                                type="number"
                                                value={item.rate}
                                                onChange={e => handleItemChange(item.id, 'rate', parseFloat(e.target.value) || 0)}
                                                disabled={!canEdit}
                                                className="w-full bg-transparent text-right outline-none p-2"
                                            />
                                        </div>
                                        <div className={`flex flex-col gap-0.5 ${amountMode === 'total' ? '' : ''}`}>
                                            <div className={`flex items-center w-full text-sm border rounded-md focus-within:ring-1 focus-within:ring-blue-500 ${canEdit && amountMode === 'rate' ? 'bg-slate-50' : 'bg-slate-100'}`}>
                                                <span className="text-slate-500 pl-3 pr-1">₹</span>
                                                <input
                                                    type="number"
                                                    value={item.professionalFee ?? 0}
                                                    onChange={e => handleItemChange(item.id, 'professionalFee', parseFloat(e.target.value) || 0)}
                                                    disabled={!canEdit || amountMode === 'total'}
                                                    className={`w-full bg-transparent text-right outline-none p-2 ${amountMode === 'total' && Number(item.professionalFee ?? 0) < 0 ? 'text-red-600 font-medium' : ''}`}
                                                />
                                            </div>
                                            {amountMode === 'total' && Number(item.professionalFee ?? 0) < 0 && (
                                                <p className="text-xs text-red-600 font-medium">Rate is higher than total; service fee is negative.</p>
                                            )}
                                        </div>
                                        <div className="p-2 text-right text-sm border rounded-md bg-slate-50">
                                            ₹{(item.taxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="p-2 text-center text-sm border rounded-md bg-slate-50">
                                            {item.gstPercentage || 0}%
                                        </div>
                                        <div className="p-2 text-right text-sm border rounded-md bg-slate-50">
                                            ₹{(item.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className={`flex items-center w-full text-sm border rounded-md focus-within:ring-1 focus-within:ring-blue-500 ${canEdit && amountMode === 'total' ? 'bg-slate-50' : 'bg-slate-100'}`}>
                                            <span className="text-slate-500 pl-3 pr-1">₹</span>
                                            <input
                                                type="number"
                                                value={item.amount || 0}
                                                onChange={e => handleItemChange(item.id, 'amount', parseFloat(e.target.value) || 0)}
                                                disabled={!canEdit || amountMode === 'rate'}
                                                readOnly={amountMode === 'rate'}
                                                className="w-full bg-transparent text-right font-medium outline-none p-2"
                                                placeholder="Total"
                                            />
                                        </div>
                                        {canEdit && <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-500"><IconTrash className="w-5 h-5" /></button>}
                                    </div>
                                );
                            })}
                            {canEdit && <button onClick={addItem} className="px-3 py-1 text-xs font-medium text-white bg-slate-700 rounded-md hover:bg-slate-800">+ Add Item</button>}
                        </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-start gap-6 mt-6 pt-4 border-t justify-start">
                            {payUrl ? (
                                <div className="flex flex-col items-center shrink-0">
                                    <a href={payUrl} target="_blank" rel="noopener noreferrer" className="inline-block" onClick={(e) => { e.preventDefault(); window.open(payUrl, '_blank', 'noopener,noreferrer'); }}>
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(payUrl)}`} alt="Pay with Razorpay" className="w-[100px] h-[100px]" />
                                    </a>
                                    <span className="text-sm font-semibold text-slate-700 mt-2">Scan/Click to pay</span>
                                </div>
                            ) : null}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 flex-1 min-w-0 ml-auto">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Discount (₹)</label>
                                    <input
                                        type="number"
                                        value={editedInvoice.discount_amount ?? 0}
                                        onChange={e => setEditedInvoice(prev => ({ ...prev, discount_amount: parseFloat(e.target.value) || 0 }))}
                                        disabled={!canEdit}
                                        className={`w-full text-sm p-2 border rounded-md ${canEdit ? 'bg-slate-50' : 'bg-slate-100'}`}
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                                        <input
                                            type="checkbox"
                                            checked={editedInvoice.is_tcs_applied || false}
                                            onChange={e => setEditedInvoice(prev => ({ ...prev, is_tcs_applied: e.target.checked }))}
                                            disabled={!canEdit}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span>TCS</span>
                                    </label>
                                    {editedInvoice.is_tcs_applied && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <input
                                                type="number"
                                                value={editedInvoice.tcs_percentage ?? 5}
                                                onChange={e => setEditedInvoice(prev => ({ ...prev, tcs_percentage: parseFloat(e.target.value) || 5 }))}
                                                disabled={!canEdit}
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                className={`w-20 text-sm p-2 border rounded-md ${canEdit ? 'bg-slate-50' : 'bg-slate-100'}`}
                                            />
                                            <span className="text-xs text-slate-500">%</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-right space-y-2 text-sm">
                                <div className="flex justify-between"><span>Sub Total</span> <span>₹ {(totals.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                {totals.discount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span> <span>- ₹ {totals.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>}
                                <div className="flex justify-between font-semibold"><span>GST Amount</span> <span>₹ {(totals.totalGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                {totals.tcs > 0 && editedInvoice.is_tcs_applied && <div className="flex justify-between"><span>TCS {editedInvoice.tcs_percentage ? `(${editedInvoice.tcs_percentage}%)` : '(5%)'}</span> <span>₹ {totals.tcs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>}
                                <hr />
                                <div className="flex justify-between text-sm items-center gap-2">
                                    <span>Round off</span>
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={effectiveRoundOff}
                                            onChange={e => setEditedInvoice(prev => ({ ...prev, round_off: parseFloat(e.target.value) || 0 }))}
                                            className="w-24 text-right text-sm p-1.5 border rounded-md bg-slate-50"
                                        />
                                        <span className={effectiveRoundOff >= 0 ? 'text-green-600' : 'text-red-600'}>
                                            {effectiveRoundOff >= 0 ? '+' : ''}{effectiveRoundOff.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex justify-between font-bold text-lg"><span>Total Amount</span> <span>₹ {(totals.total + effectiveRoundOff).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                {(() => {
                                    const amountPaid = (invoice?.total_amount || 0) - (invoice?.balance_due || 0);
                                    const currentBalanceDue = Math.max(0, totals.total + effectiveRoundOff - amountPaid);
                                    return <div className="flex justify-between font-semibold text-green-600"><span>Balance Due</span> <span>₹ {currentBalanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>;
                                })()}
                            </div>
                            </div>
                        </div>
                    </div>

                    {canRecordPayment && (
                        <div className="bg-white p-4 sm:p-6 rounded-lg border">
                            <h3 className="text-md font-semibold text-slate-800 mb-4 border-b pb-2">Record a Manual Payment</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div><label className="text-xs font-medium text-slate-500">Amount Received *</label><input type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value) || '')} className="w-full text-sm p-2 border rounded-md" /></div>
                                <div><label className="text-xs font-medium text-slate-500">Payment Date *</label><input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="w-full text-sm p-2 border rounded-md" /></div>
                                <div><label className="text-xs font-medium text-slate-500">Payment Method *</label><select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full text-sm p-2 border rounded-md"><option value={PaymentMethod.BankTransfer}>Bank Transfer</option><option value={PaymentMethod.UPI}>UPI</option><option value={PaymentMethod.Cash}>Cash</option><option value={PaymentMethod.Other}>Other</option></select></div>
                                <div><label className="text-xs font-medium text-slate-500">Reference ID</label><input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} className="w-full text-sm p-2 border rounded-md" /></div>
                                <div className="sm:col-span-2"><label className="text-xs font-medium text-slate-500">Notes</label><textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} className="w-full text-sm p-2 border rounded-md" rows={2}></textarea></div>
                            </div>
                            <button onClick={handleRecordPayment} disabled={isRecordingPayment} className="mt-4 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-[5px] hover:bg-green-700 disabled:bg-slate-400">
                                {isRecordingPayment ? 'Recording...' : 'Record Payment'}
                            </button>
                        </div>
                    )}

                    {leadIdForTransactions != null && (
                        <div className="bg-white p-6 rounded-lg border">
                            <h3 className="text-md font-semibold text-slate-800 mb-4">Costing – Transactions for this lead</h3>
                            <p className="text-xs text-slate-500 mb-3">All income and expense transactions recorded for this lead (from Lead Costing).</p>
                            {leadTransactions.length === 0 ? (
                                <p className="text-sm text-slate-500">No transactions for this lead yet.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="text-left bg-slate-50">
                                            <tr>
                                                <th className="p-2 font-medium text-slate-700">Date</th>
                                                <th className="p-2 font-medium text-slate-700">Type</th>
                                                <th className="p-2 font-medium text-slate-700">Description</th>
                                                <th className="p-2 font-medium text-slate-700">Method</th>
                                                <th className="p-2 font-medium text-slate-700 text-right">Amount (₹)</th>
                                                <th className="p-2 font-medium text-slate-700">Status</th>
                                                <th className="p-2 font-medium text-slate-700">Recorded By</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leadTransactions.map((tx) => {
                                                const recordedBy = staff?.find(s => s.id === tx.recorded_by_staff_id);
                                                return (
                                                    <tr key={tx.id} className="border-b">
                                                        <td className="p-2 text-slate-600">{new Date(tx.recorded_at).toLocaleDateString()}</td>
                                                        <td className="p-2">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${tx.type === TransactionType.Income ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                {tx.type}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 text-slate-600 max-w-xs truncate" title={tx.description}>{tx.description || '–'}</td>
                                                        <td className="p-2 text-slate-600">{tx.payment_method}</td>
                                                        <td className="p-2 text-right font-medium">
                                                            {tx.type === TransactionType.Income ? (
                                                                <span className="text-green-600">+₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                            ) : (
                                                                <span className="text-red-600">-₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                            )}
                                                        </td>
                                                        <td className="p-2">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                                tx.status === TransactionApprovalStatus.Approved ? 'bg-green-100 text-green-700' :
                                                                tx.status === TransactionApprovalStatus.Rejected ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                                            }`}>
                                                                {tx.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 text-slate-600">{recordedBy?.name ?? '–'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {invoicePayments.length > 0 && (
                        <div className="bg-white p-6 rounded-lg border">
                            <h3 className="text-md font-semibold text-slate-800 mb-4">Payment History</h3>
                            <p className="text-xs text-slate-500 mb-3">Payments recorded from Lead Costing or the Payments dashboard are reflected here. Balance due is updated accordingly.</p>
                            <table className="w-full text-sm">
                                <thead className="text-left text-xs text-slate-500 bg-slate-50">
                                    <tr><th className="p-2">Date</th><th className="p-2">Amount</th><th className="p-2">Method</th><th className="p-2">Source</th><th className="p-2">Recorded by</th><th className="p-2">Reference</th></tr>
                                </thead>
                                <tbody>
                                    {invoicePayments.map(p => (
                                        <tr key={p.id} className="border-b">
                                            <td className="p-2">{new Date(p.payment_date).toLocaleDateString()}</td>
                                            <td className="p-2 font-medium">₹{p.amount.toLocaleString()}</td>
                                            <td className="p-2">{p.method}</td>
                                            <td className="p-2">
                                                <span className={`px-2 py-0.5 text-xs rounded ${p.source === 'RazorpayWebhook' || p.source === 'RazorpayLink'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-slate-100 text-slate-800'
                                                    }`}>
                                                    {p.source || 'Manual'}
                                                </span>
                                            </td>
                                            <td className="p-2">{p.created_by_staff_id && staff?.length ? (staff.find(s => s.id === p.created_by_staff_id)?.name ?? '-') : '-'}</td>
                                            <td className="p-2">{p.reference_id || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t flex flex-wrap justify-end items-center gap-4 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
                    {showGenerateLinkCheckbox && (
                        <label className="flex items-center gap-2 text-sm text-slate-600 mr-auto">
                            <input
                                type="checkbox"
                                checked={shouldGenerateLink}
                                onChange={(e) => setShouldGenerateLink(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            Generate Razorpay payment link
                        </label>
                    )}
                    {isNew ? (
                        <>
                            <button
                                onClick={() => handleSave(false)}
                                disabled={!canEdit}
                                className={`px-4 py-2 text-sm font-medium text-white rounded-[5px] ${canEdit ? 'bg-slate-600 hover:bg-slate-700' : 'bg-slate-400 cursor-not-allowed'}`}
                            >
                                Save draft
                            </button>
                            <button
                                onClick={() => handleSave(true)}
                                disabled={!canEdit}
                                className={`px-4 py-2 text-sm font-medium text-white rounded-[5px] ${canEdit ? 'bg-[#191974] hover:bg-[#13135c]' : 'bg-slate-400 cursor-not-allowed'}`}
                            >
                                Create invoice
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => handleSave(false)}
                            disabled={!canEdit}
                            className={`px-4 py-2 text-sm font-medium text-white rounded-[5px] ${canEdit ? 'bg-[#191974] hover:bg-[#13135c]' : 'bg-slate-400 cursor-not-allowed'}`}
                        >
                            Save Changes
                        </button>
                    )}
                </div>
            </div>
            {showPreview && (
                <InvoicePreviewModal
                    invoice={editedInvoice}
                    customer={customerForInvoice}
                    lead={leadForInvoice}
                    branch={branchForInvoice}
                    totals={totals}
                    payUrl={payUrl}
                    onClose={() => setShowPreview(false)}
                />
            )}
        </div>
    );
    return createPortal(drawer, document.body);
};

export default Invoicing;