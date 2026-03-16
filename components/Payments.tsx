import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataProvider';
import { useAuth } from '../contexts/AuthProvider';
import { Payment, PaymentStatus, InvoiceStatus, Customer, Invoice, Service, PaymentMethod, Transaction, TransactionType, TransactionApprovalStatus, Staff, LeadCosting, Lead } from '../types';
import { IconTrash, IconRefresh, IconSearch } from '../constants';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { useRouter } from '../contexts/RouterProvider';

// Reusable KPI Card
const KPICard: React.FC<{ title: string; value: string; icon: string }> = ({ title, value, icon }) => (
    <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">{title}</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mt-1 truncate">{value}</p>
            </div>
            <div className="text-xl sm:text-2xl flex-shrink-0 ml-2">{icon}</div>
        </div>
    </div>
);

// Confirmation Modal for voiding/restoring
const ConfirmationModal: React.FC<{ title: string; message: string; onConfirm: () => void; onCancel: () => void; confirmText?: string; confirmClass?: string; }> = ({ title, message, onConfirm, onCancel, confirmText = 'Confirm', confirmClass = 'bg-red-600' }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-[calc(100vw-2rem)] sm:max-w-sm">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-slate-600 my-4">{message}</p>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
                <button onClick={onConfirm} className={`px-4 py-2 text-sm rounded-md text-white ${confirmClass}`}>{confirmText}</button>
            </div>
        </div>
    </div>
);

// Pagination Component
const Pagination: React.FC<{
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (size: number) => void;
}> = ({ currentPage, totalItems, itemsPerPage, onPageChange, onItemsPerPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalItems === 0) return null;

    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs sm:text-sm text-slate-600">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="whitespace-nowrap">Rows per page:</span>
                <select
                    value={itemsPerPage}
                    onChange={e => onItemsPerPageChange(Number(e.target.value))}
                    className="p-1.5 border rounded-md bg-white focus:ring-blue-500 focus:border-blue-500 text-xs sm:text-sm min-h-[36px] sm:min-h-0"
                >
                    {[25, 50, 75, 100].map(size => <option key={size} value={size}>{size}</option>)}
                </select>
            </div>
            <span className="text-xs sm:text-sm">
                Showing <span className="font-medium">{startItem}</span>-<span className="font-medium">{endItem}</span> of <span className="font-medium">{totalItems}</span>
            </span>
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-2.5 sm:px-3 py-1.5 sm:py-2 border rounded-md disabled:opacity-50 min-h-[36px] sm:min-h-0 touch-manipulation text-xs sm:text-sm"
                >
                    Previous
                </button>
                <span className="text-xs sm:text-sm whitespace-nowrap">Page {currentPage} of {totalPages}</span>
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-2.5 sm:px-3 py-1.5 sm:py-2 border rounded-md disabled:opacity-50 min-h-[36px] sm:min-h-0 touch-manipulation text-xs sm:text-sm"
                >
                    Next
                </button>
            </div>
        </div>
    );
};

// Unified Transaction Record Type
type UnifiedTransactionRecord = {
    id: string; // Unique identifier: 'payment-{id}' or 'transaction-{id}'
    recordType: 'payment' | 'transaction';
    date: string;
    amount: number;
    type?: TransactionType; // For transactions only
    payment_method: PaymentMethod;
    status: PaymentStatus | TransactionApprovalStatus;
    lead_id?: number;
    customer_id?: number;
    invoice_id?: number;
    description?: string;
    reference_id?: string;
    receipt_url?: string;
    recorded_by_staff_id?: number;
    approved_by_staff_id?: number;
    rejected_by_staff_id?: number;
    payment?: Payment;
    transaction?: Transaction;
};

// Status Badge for Payments (DB stores lowercase: paid, refunded, void, unlinked)
const getStatusClass = (status: PaymentStatus) => {
    const s = (status as string)?.toLowerCase();
    switch (s) {
        case 'paid': return 'bg-green-100 text-green-700';
        case 'refunded': return 'bg-yellow-100 text-yellow-700';
        case 'void': return 'bg-red-100 text-red-700';
        default: return 'bg-gray-100 text-gray-700';
    }
}

// Status Badge for Transactions
const getTransactionStatusClass = (status: TransactionApprovalStatus) => {
    switch (status) {
        case TransactionApprovalStatus.Approved: return 'bg-green-100 text-green-700';
        case TransactionApprovalStatus.Rejected: return 'bg-red-100 text-red-700';
        case TransactionApprovalStatus.Pending: return 'bg-yellow-100 text-yellow-700';
        default: return 'bg-gray-100 text-gray-700';
    }
}

// Get unified status class
const getUnifiedStatusClass = (status: PaymentStatus | TransactionApprovalStatus, recordType: 'payment' | 'transaction') => {
    if (recordType === 'payment') {
        return getStatusClass(status as PaymentStatus);
    }
    return getTransactionStatusClass(status as TransactionApprovalStatus);
}

const Payments: React.FC = () => {
    const { payments, invoices, customers, leads, transactions, leadCostings, staff, refreshData, fetchPayments, fetchTransactions, fetchInvoices, loadingPayments, loadingTransactions } = useData();
    const { profile: currentUser } = useAuth();
    const { addToast } = useToast();
    const { navigate } = useRouter();

    const [activeTab, setActiveTab] = useState('All');
    const [actionTarget, setActionTarget] = useState<{ type: 'void' | 'restore' | 'delete'; payment: Payment } | null>(null);
    const [transactionToDelete, setTransactionToDelete] = useState<UnifiedTransactionRecord | null>(null);

    // State for new table controls
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ startDate: '', endDate: '', method: '' });
    const [sortConfig, setSortConfig] = useState<{ key: 'date' | 'amount', direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    // Lazy-load payments, transactions, and invoices when component mounts (so Inv No. and Total Invoices work)
    React.useEffect(() => {
        if (payments.length === 0 && !loadingPayments) {
            fetchPayments();
        }
        if (transactions.length === 0 && !loadingTransactions) {
            fetchTransactions();
        }
        if (invoices.length === 0 && fetchInvoices) {
            fetchInvoices();
        }
    }, [payments.length, transactions.length, invoices.length, loadingPayments, loadingTransactions, fetchPayments, fetchTransactions, fetchInvoices]);

    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
    const invoiceMap = useMemo(() => new Map(invoices.map(i => [i.id, i])), [invoices]);
    const leadMap = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads]);
    const staffMap = useMemo(() => new Map(staff.map(s => [s.id, s])), [staff]);

    // Helper function to generate MTS ID
    const generateBookingId = (lead: Lead | null): string => {
        if (!lead || !lead.id || !lead.created_at) {
            return 'N/A';
        }
        const createdAt = new Date(lead.created_at);
        const day = String(createdAt.getDate()).padStart(2, '0');
        const month = String(createdAt.getMonth() + 1).padStart(2, '0');
        const year = String(createdAt.getFullYear()).slice(-2);
        return `MTS-${lead.id}${day}${month}${year}`;
    };

    const kpiData = useMemo(() => {
        // Total Revenue = full cost of all invoices (both paid & due), i.e. sum of total_amount for all issued invoices (exclude Draft, Void)
        const totalRevenue = invoices
            .filter(i => i.status !== InvoiceStatus.Draft && i.status !== InvoiceStatus.Void)
            .reduce((s, i) => s + i.total_amount, 0);

        // Total Payments Made = actual cash received (payments table only)
        const totalPaymentsMade = payments.filter(p => (p.status as string)?.toLowerCase() === 'paid').reduce((s, p) => s + p.amount, 0);

        // Total Due = what customers still owe (Revenue − Payments Made). Keeps the three cards consistent.
        const totalDue = totalRevenue - totalPaymentsMade;

        // Total Invoices: only non-Draft (Draft = still in progress)
        const totalInvoices = invoices.filter(i => i.status !== InvoiceStatus.Draft).length;

        // Total Expense: approved expense transactions (from Lead Costing)
        const totalExpense = (transactions || [])
            .filter(t => t.type === TransactionType.Expense && (t.status as string)?.toLowerCase() === 'approved')
            .reduce((s, t) => s + t.amount, 0);

        return [
            { title: 'Total Due', value: `₹${totalDue.toLocaleString('en-IN')}`, icon: '💳' },
            { title: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: '💰' },
            { title: 'Total Payments Made', value: `₹${totalPaymentsMade.toLocaleString('en-IN')}`, icon: '✅' },
            { title: 'Total Expense', value: `₹${totalExpense.toLocaleString('en-IN')}`, icon: '📤' },
            { title: 'Total Invoices', value: totalInvoices.toString(), icon: '🧾' },
        ];
    }, [payments, invoices, leads, leadMap, transactions]);

    // Combine Payment and Transaction records into unified view (dedupe: hide payment if matching approved Income exists)
    const unifiedTransactions = useMemo(() => {
        const unified: UnifiedTransactionRecord[] = [];
        const dateOnly = (d: string) => d.split('T')[0];

        // Approved income transactions that created a payment (we'll show only the transaction, not the payment)
        const approvedIncomeKeys = new Set(
            transactions
                .filter(t => t.type === TransactionType.Income && (t.status as string) === TransactionApprovalStatus.Approved)
                .map(t => `${t.invoice_id ?? ''}|${t.customer_id}|${t.amount}|${dateOnly(t.recorded_at)}`)
        );

        // Add Payment records (skip if same as an approved income: same invoice, customer, amount, date)
        payments.forEach(p => {
            const key = `${p.invoice_id ?? ''}|${p.customer_id}|${p.amount}|${dateOnly(p.payment_date)}`;
            if (approvedIncomeKeys.has(key)) return; // already shown as Income transaction
            unified.push({
                id: `payment-${p.id}`,
                recordType: 'payment',
                date: p.payment_date,
                amount: p.amount,
                payment_method: p.method,
                status: p.status,
                lead_id: p.lead_id || undefined,
                customer_id: p.customer_id || undefined,
                invoice_id: p.invoice_id || undefined,
                payment: p,
            });
        });

        // Add Transaction records
        transactions.forEach(t => {
            unified.push({
                id: `transaction-${t.id}`,
                recordType: 'transaction',
                date: t.recorded_at,
                amount: t.amount,
                type: t.type,
                payment_method: t.payment_method,
                status: t.status,
                lead_id: t.lead_id,
                customer_id: t.customer_id,
                invoice_id: t.invoice_id ?? undefined,
                description: t.description,
                reference_id: t.reference_id,
                receipt_url: t.receipt_url,
                recorded_by_staff_id: t.recorded_by_staff_id,
                approved_by_staff_id: t.approved_by_staff_id,
                rejected_by_staff_id: t.rejected_by_staff_id,
                transaction: t,
            });
        });

        return unified;
    }, [payments, transactions]);

    const filteredAndSortedPayments = useMemo(() => {
        let filtered = [...unifiedTransactions];

        // Filter by tab (All, Income, Expense, or Payment Status)
        if (activeTab !== 'All') {
            if (activeTab === TransactionType.Income || activeTab === TransactionType.Expense) {
                filtered = filtered.filter(r => r.recordType === 'transaction' && r.type === activeTab);
            } else {
                // Filter by payment status
                filtered = filtered.filter(r => r.recordType === 'payment' && (r.status as string)?.toLowerCase() === (activeTab as string)?.toLowerCase());
            }
        }
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(r => {
                const invoice = r.invoice_id ? invoiceMap.get(r.invoice_id) : null;
                const customer = r.customer_id ? customerMap.get(r.customer_id) : null;
                const lead = r.lead_id ? leadMap.get(r.lead_id) : null;
                return (
                    invoice?.invoice_number.toLowerCase().includes(lowerSearch) ||
                    customer?.first_name.toLowerCase().includes(lowerSearch) ||
                    customer?.last_name.toLowerCase().includes(lowerSearch) ||
                    r.lead_id?.toString().includes(lowerSearch) ||
                    r.reference_id?.toLowerCase().includes(lowerSearch) ||
                    r.description?.toLowerCase().includes(lowerSearch) ||
                    (lead && generateBookingId(lead).toLowerCase().includes(lowerSearch))
                );
            });
        }
        if (filters.startDate) filtered = filtered.filter(r => r.date >= filters.startDate);
        if (filters.endDate) filtered = filtered.filter(r => r.date <= filters.endDate);
        if (filters.method) filtered = filtered.filter(r => r.payment_method === filters.method);

        // Sort by date (default) or amount
        filtered.sort((a, b) => {
            if (sortConfig) {
                if (sortConfig.key === 'date') {
                    return sortConfig.direction === 'asc'
                        ? new Date(a.date).getTime() - new Date(b.date).getTime()
                        : new Date(b.date).getTime() - new Date(a.date).getTime();
                }
                if (sortConfig.key === 'amount') {
                    return sortConfig.direction === 'asc'
                        ? a.amount - b.amount
                        : b.amount - a.amount;
                }
            }
            // Default: sort by date descending
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        return filtered;
    }, [unifiedTransactions, activeTab, searchTerm, filters, sortConfig, invoiceMap, customerMap, leadMap]);

    const paginatedPayments = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAndSortedPayments.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAndSortedPayments, currentPage, itemsPerPage]);

    const handleAction = async () => {
        if (!actionTarget) return;

        // Extra security check - Only Super Admin from Branch 1 can delete/void/restore payments
        if (currentUser?.role !== 'Super Admin' || currentUser?.branch_id !== 1) {
            addToast('Unauthorized action. Only Branch 1 Super Admin can modify payments.', 'error');
            setActionTarget(null);
            return;
        }

        const { type, payment } = actionTarget;
        const invoice = payment.invoice_id ? invoiceMap.get(payment.invoice_id) : null;
        if (!invoice && payment.invoice_id) {
            addToast('Associated invoice not found.', 'error');
            setActionTarget(null);
            return;
        }
        if (!invoice && type !== 'delete') {
            addToast('Associated invoice not found.', 'error');
            setActionTarget(null);
            return;
        }

        const isPermanentDelete = type === 'delete';
        const isVoiding = type === 'void';
        const newPaymentStatus = isVoiding ? PaymentStatus.Void : PaymentStatus.Paid;

        try {
            if (isPermanentDelete) {
                const { error: deleteError } = await supabase
                    .from('payments')
                    .delete()
                    .eq('id', payment.id);
                if (deleteError) throw deleteError;
                if (invoice) {
                    const { recalculateInvoiceBalance } = await import('../lib/invoiceBalance');
                    await recalculateInvoiceBalance(invoice.id);
                }
                addToast('Payment permanently deleted from database. Invoice balance updated.', 'success');
            } else {
                const { error: paymentError } = await supabase
                    .from('payments')
                    .update({ status: newPaymentStatus })
                    .eq('id', payment.id);
                if (paymentError) throw paymentError;
                if (invoice) {
                    const { recalculateInvoiceBalance } = await import('../lib/invoiceBalance');
                    await recalculateInvoiceBalance(invoice.id);
                }
                addToast(`Payment successfully ${isVoiding ? 'voided' : 'restored'}.`, 'success');
            }
            await fetchPayments(true);
            await fetchTransactions(true);
        } catch (error: any) {
            console.error('Error updating payment:', error);
            addToast(`Error: ${error.message}`, 'error');
        } finally {
            setActionTarget(null);
        }
    };

    const handleSort = (key: 'date' | 'amount') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleDeleteTransaction = async () => {
        if (!transactionToDelete || transactionToDelete.recordType !== 'transaction' || !transactionToDelete.transaction) return;
        if (currentUser?.role !== 'Super Admin' || currentUser?.branch_id !== 1) {
            addToast('Only Branch 1 Super Admin can delete transactions.', 'error');
            setTransactionToDelete(null);
            return;
        }
        try {
            const { error } = await supabase.from('transactions').delete().eq('id', transactionToDelete.transaction.id);
            if (error) throw error;
            addToast('Transaction deleted from database.', 'success');
            await fetchPayments(true);
            await fetchTransactions(true);
        } catch (error: any) {
            addToast(`Failed to delete: ${error.message}`, 'error');
        } finally {
            setTransactionToDelete(null);
        }
    };

    const tabs = ['All', TransactionType.Income, TransactionType.Expense, ...Object.values(PaymentStatus)];

    return (
        <div className="space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Payments</h1>
                </div>
                <button
                    onClick={() => { fetchPayments(true); fetchTransactions(true); }}
                    disabled={loadingPayments || loadingTransactions}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-50 shrink-0 min-h-[44px] sm:min-h-0 touch-manipulation"
                    title="Refresh payments and transactions"
                >
                    <IconRefresh className={`w-4 h-4 ${(loadingPayments || loadingTransactions) ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4 md:gap-6">
                {kpiData.map(kpi => <KPICard key={kpi.title} {...kpi} />)}
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-2 sm:p-3 md:p-4 border-b overflow-x-auto scrollbar-hide">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-max">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:bg-gray-100/50'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-3 sm:p-4 flex flex-col gap-3 bg-gray-50/50">
                    {/* Search Bar */}
                    <div className="relative w-full">
                        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by Inv #, Customer..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 sm:pl-10 pr-4 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    {/* Filters Row */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                        <div className="flex items-center gap-2 flex-1">
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
                                className="flex-1 p-2 border rounded-md text-sm min-w-0"
                            />
                            <span className="text-slate-500 text-xs sm:text-sm flex-shrink-0">to</span>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
                                className="flex-1 p-2 border rounded-md text-sm min-w-0"
                            />
                        </div>
                        <select
                            value={filters.method}
                            onChange={e => setFilters(f => ({ ...f, method: e.target.value }))}
                            className="p-2 border rounded-md text-sm w-full sm:w-auto sm:min-w-[140px]"
                        >
                            <option value="">All Methods</option>
                            {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                {/* Mobile: Card View, Desktop: Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[960px]">
                        <thead className="text-xs text-gray-500 uppercase bg-white sticky top-0 z-[1]">
                            <tr>
                                <th className="px-3 sm:px-4 py-2 sm:py-3 cursor-pointer" onClick={() => handleSort('date')}>Date</th>
                                <th className="px-3 sm:px-4 py-2 sm:py-3">Type</th>
                                <th className="px-3 sm:px-4 py-2 sm:py-3 text-right cursor-pointer" onClick={() => handleSort('amount')}>Amount</th>
                                <th className="px-3 sm:px-4 py-2 sm:py-3">Method</th>
                                <th className="px-3 sm:px-4 py-2 sm:py-3">Reference</th>
                                <th className="px-3 sm:px-4 py-2 sm:py-3">Description</th>
                                <th className="px-3 sm:px-4 py-2 sm:py-3">Recorded By</th>
                                <th className="px-3 sm:px-4 py-2 sm:py-3">Status</th>
                                <th className="px-3 sm:px-4 py-2 sm:py-3">Approved/Rejected By</th>
                                <th className="px-3 sm:px-4 py-2 sm:py-3">Lead</th>
                                <th className="px-3 sm:px-4 py-2 sm:py-3">Customer</th>
                                <th className="px-3 sm:px-4 py-2 sm:py-3">Inv No.</th>
                                {currentUser?.role === 'Super Admin' && currentUser?.branch_id === 1 && <th className="px-3 sm:px-4 py-2 sm:py-3">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="text-gray-700">
                            {paginatedPayments.map(r => {
                                const invoice = r.invoice_id ? invoiceMap.get(r.invoice_id) : null;
                                const customer = r.customer_id ? customerMap.get(r.customer_id) : null;
                                const lead = r.lead_id ? leadMap.get(r.lead_id) : null;
                                const recordedBy = r.recorded_by_staff_id ? staffMap.get(r.recorded_by_staff_id) : null;
                                const approvedBy = r.approved_by_staff_id ? staffMap.get(r.approved_by_staff_id) : null;
                                const rejectedBy = r.rejected_by_staff_id ? staffMap.get(r.rejected_by_staff_id) : null;

                                const isIncome = r.recordType === 'transaction' && r.type === TransactionType.Income;
                                const isExpense = r.recordType === 'transaction' && r.type === TransactionType.Expense;

                                return (
                                    <tr key={r.id} className="border-t hover:bg-gray-50">
                                        <td className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap">{new Date(r.date).toLocaleDateString()}</td>
                                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                                            {r.recordType === 'transaction' ? (
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-md ${isIncome ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                    {r.type}
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 text-xs font-semibold rounded-md bg-gray-100 text-gray-700">Payment</span>
                                            )}
                                        </td>
                                        <td className={`px-3 sm:px-4 py-2 sm:py-3 font-semibold text-right ${isExpense ? 'text-red-600' : isIncome ? 'text-green-600' : 'text-gray-900'}`}>
                                            {isExpense ? '-' : ''}₹{r.amount.toLocaleString('en-IN')}
                                        </td>
                                        <td className="px-3 sm:px-4 py-2 sm:py-3">{r.payment_method}</td>
                                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                                            {r.receipt_url ? (
                                                <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Receipt</a>
                                            ) : (
                                                <span className="text-gray-500">{r.reference_id || 'N/A'}</span>
                                            )}
                                        </td>
                                        <td className="px-3 sm:px-4 py-2 sm:py-3 max-w-xs truncate" title={r.description}>{r.description || 'N/A'}</td>
                                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                                            {recordedBy ? (
                                                <div className="flex items-center gap-2">
                                                    <img src={recordedBy.avatar_url || `https://avatar.iran.liara.run/public/boy?username=${recordedBy.name}`} alt={recordedBy.name} className="h-6 w-6 rounded-full object-cover" />
                                                    <span className="text-xs">{recordedBy.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-500">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-md ${getUnifiedStatusClass(r.status, r.recordType)}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td className="px-3 sm:px-4 py-2 sm:py-3">
                                            {approvedBy ? (
                                                <div className="flex items-center gap-2">
                                                    <img src={approvedBy.avatar_url || `https://avatar.iran.liara.run/public/boy?username=${approvedBy.name}`} alt={approvedBy.name} className="h-6 w-6 rounded-full object-cover" />
                                                    <span className="text-xs text-green-600">{approvedBy.name}</span>
                                                </div>
                                            ) : rejectedBy ? (
                                                <div className="flex items-center gap-2">
                                                    <img src={rejectedBy.avatar_url || `https://avatar.iran.liara.run/public/boy?username=${rejectedBy.name}`} alt={rejectedBy.name} className="h-6 w-6 rounded-full object-cover" />
                                                    <span className="text-xs text-red-600">{rejectedBy.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-500">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 sm:px-4 py-2 sm:py-3 text-blue-600 hover:underline cursor-pointer" onClick={() => lead && navigate(`/leads?view=${lead.id}`)}>
                                            {lead ? generateBookingId(lead) : r.lead_id ? `#${r.lead_id}` : 'N/A'}
                                        </td>
                                        <td className="px-3 sm:px-4 py-2 sm:py-3 font-medium">{customer ? `${customer.first_name} ${customer.last_name}` : 'Unlinked'}</td>
                                        <td className="px-3 sm:px-4 py-2 sm:py-3 font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => invoice && navigate(`/invoicing?view=${invoice.id}`)}>{invoice?.invoice_number || 'N/A'}</td>
                                        {currentUser?.role === 'Super Admin' && currentUser?.branch_id === 1 && r.recordType === 'payment' && (
                                            <td className="px-3 sm:px-4 py-2 sm:py-3">
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {(r.status as string)?.toLowerCase() === 'void' ? (
                                                        <button onClick={() => r.payment && setActionTarget({ type: 'restore', payment: r.payment })} className="p-1 text-slate-500 hover:text-green-600" title="Restore Payment"><IconRefresh className="w-5 h-5" /></button>
                                                    ) : (
                                                        <button onClick={() => r.payment && setActionTarget({ type: 'void', payment: r.payment })} className="px-1.5 py-0.5 text-xs text-slate-600 hover:text-orange-600 border border-slate-300 rounded" title="Void (keep record)">Void</button>
                                                    )}
                                                    <button onClick={() => r.payment && setActionTarget({ type: 'delete', payment: r.payment })} className="p-1 text-slate-500 hover:text-red-600" title="Delete permanently from database"><IconTrash className="w-5 h-5" /></button>
                                                </div>
                                            </td>
                                        )}
                                        {currentUser?.role === 'Super Admin' && currentUser?.branch_id === 1 && r.recordType === 'transaction' && (
                                            <td className="px-3 sm:px-4 py-2 sm:py-3">
                                                <button onClick={() => setTransactionToDelete(r)} className="p-1 text-slate-500 hover:text-red-600" title="Delete transaction from database"><IconTrash className="w-5 h-5" /></button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3 p-3">
                    {paginatedPayments.map(r => {
                        const invoice = r.invoice_id ? invoiceMap.get(r.invoice_id) : null;
                        const customer = r.customer_id ? customerMap.get(r.customer_id) : null;
                        const lead = r.lead_id ? leadMap.get(r.lead_id) : null;
                        const recordedBy = r.recorded_by_staff_id ? staffMap.get(r.recorded_by_staff_id) : null;
                        const approvedBy = r.approved_by_staff_id ? staffMap.get(r.approved_by_staff_id) : null;
                        const rejectedBy = r.rejected_by_staff_id ? staffMap.get(r.rejected_by_staff_id) : null;

                        const isIncome = r.recordType === 'transaction' && r.type === TransactionType.Income;
                        const isExpense = r.recordType === 'transaction' && r.type === TransactionType.Expense;

                        return (
                            <div key={r.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
                                {/* Header: Date, Type, Amount */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs text-slate-500">{new Date(r.date).toLocaleDateString()}</span>
                                            {r.recordType === 'transaction' ? (
                                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${isIncome ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                                    {r.type}
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-gray-100 text-gray-700">Payment</span>
                                            )}
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${getUnifiedStatusClass(r.status, r.recordType)}`}>
                                                {r.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`text-lg font-bold ${isExpense ? 'text-red-600' : isIncome ? 'text-green-600' : 'text-gray-900'}`}>
                                        {isExpense ? '-' : ''}₹{r.amount.toLocaleString('en-IN')}
                                    </div>
                                </div>

                                {/* Key Info */}
                                <div className="space-y-2 text-sm">
                                    {customer && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 font-medium w-20 flex-shrink-0">Customer:</span>
                                            <span className="font-medium truncate">{customer.first_name} {customer.last_name}</span>
                                        </div>
                                    )}
                                    {lead && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 font-medium w-20 flex-shrink-0">Lead:</span>
                                            <span 
                                                onClick={() => navigate(`/leads?view=${lead.id}`)}
                                                className="text-blue-600 hover:underline cursor-pointer font-medium truncate"
                                            >
                                                {generateBookingId(lead)}
                                            </span>
                                        </div>
                                    )}
                                    {invoice && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 font-medium w-20 flex-shrink-0">Invoice:</span>
                                            <span 
                                                onClick={() => navigate(`/invoicing?view=${invoice.id}`)}
                                                className="text-blue-600 hover:underline cursor-pointer font-medium truncate"
                                            >
                                                {invoice.invoice_number}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500 font-medium w-20 flex-shrink-0">Method:</span>
                                        <span className="truncate">{r.payment_method}</span>
                                    </div>
                                    {r.description && (
                                        <div className="flex items-start gap-2">
                                            <span className="text-slate-500 font-medium w-20 flex-shrink-0">Desc:</span>
                                            <span className="flex-1 text-slate-700 break-words">{r.description}</span>
                                        </div>
                                    )}
                                    {r.reference_id && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 font-medium w-20 flex-shrink-0">Ref:</span>
                                            {r.receipt_url ? (
                                                <a href={r.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">Receipt</a>
                                            ) : (
                                                <span className="text-slate-700 truncate">{r.reference_id}</span>
                                            )}
                                        </div>
                                    )}
                                    {recordedBy && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 font-medium w-20 flex-shrink-0">Recorded:</span>
                                            <div className="flex items-center gap-1.5">
                                                <img src={recordedBy.avatar_url || `https://avatar.iran.liara.run/public/boy?username=${recordedBy.name}`} alt={recordedBy.name} className="h-5 w-5 rounded-full object-cover" />
                                                <span className="text-sm">{recordedBy.name}</span>
                                            </div>
                                        </div>
                                    )}
                                    {(approvedBy || rejectedBy) && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500 font-medium w-20 flex-shrink-0">
                                                {approvedBy ? 'Approved:' : 'Rejected:'}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <img src={(approvedBy || rejectedBy)?.avatar_url || `https://avatar.iran.liara.run/public/boy?username=${(approvedBy || rejectedBy)?.name}`} alt={(approvedBy || rejectedBy)?.name} className="h-5 w-5 rounded-full object-cover" />
                                                <span className={`text-sm ${approvedBy ? 'text-green-600' : 'text-red-600'}`}>
                                                    {(approvedBy || rejectedBy)?.name}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                {currentUser?.role === 'Super Admin' && currentUser?.branch_id === 1 && (
                                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                        {r.recordType === 'payment' && (
                                            <>
                                                {(r.status as string)?.toLowerCase() === 'void' ? (
                                                    <button 
                                                        onClick={() => r.payment && setActionTarget({ type: 'restore', payment: r.payment })} 
                                                        className="px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100"
                                                    >
                                                        Restore
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => r.payment && setActionTarget({ type: 'void', payment: r.payment })} 
                                                        className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 rounded-md hover:bg-orange-100"
                                                    >
                                                        Void
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => r.payment && setActionTarget({ type: 'delete', payment: r.payment })} 
                                                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100"
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                        {r.recordType === 'transaction' && (
                                            <button 
                                                onClick={() => setTransactionToDelete(r)} 
                                                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100"
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {paginatedPayments.length === 0 && <p className="text-center p-8 text-slate-500">No transactions found for this filter.</p>}
                </div>
                <Pagination currentPage={currentPage} totalItems={filteredAndSortedPayments.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
            </div>
            {actionTarget && (
                <ConfirmationModal
                    title={actionTarget.type === 'delete' ? 'Delete payment permanently' : `Confirm ${actionTarget.type === 'void' ? 'Void' : 'Restore'} Payment`}
                    message={actionTarget.type === 'delete'
                        ? `Permanently delete this payment of ₹${actionTarget.payment.amount.toLocaleString()} from the database? It will be removed from this list, lead costing, and the invoice balance will be recalculated. This cannot be undone.`
                        : `Are you sure you want to ${actionTarget.type} this payment of ₹${actionTarget.payment.amount.toLocaleString()}? This will update the invoice balance.`}
                    onConfirm={handleAction}
                    onCancel={() => setActionTarget(null)}
                    confirmText={actionTarget.type === 'delete' ? 'Delete permanently' : actionTarget.type === 'void' ? 'Void' : 'Restore'}
                    confirmClass="bg-red-600"
                />
            )}
            {transactionToDelete && (
                <ConfirmationModal
                    title="Delete transaction from database"
                    message={`Delete this ${transactionToDelete.type === 'Income' ? 'Income' : 'Expense'} of ₹${transactionToDelete.amount.toLocaleString()} (${transactionToDelete.date})? This removes the row from the transactions table and cannot be undone.`}
                    onConfirm={handleDeleteTransaction}
                    onCancel={() => setTransactionToDelete(null)}
                    confirmText="Delete"
                    confirmClass="bg-red-600"
                />
            )}
        </div>
    );
};

export default Payments;