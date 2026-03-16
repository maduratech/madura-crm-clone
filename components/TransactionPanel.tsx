import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Lead, Transaction, TransactionType, TransactionApprovalStatus, PaymentMethod, LoggedInUser, Staff, Activity, Customer } from '../types';
import { IconPlus, IconTrash, IconCheckCircle, IconX, IconUpload } from '../constants';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';

interface TransactionPanelProps {
    lead: Lead;
    customer: Customer;
    currentUser: LoggedInUser;
    staff: Staff[];
    onUpdateActivity: (activity: Activity) => void;
    refreshData: () => Promise<void>;
}

export const TransactionPanel: React.FC<TransactionPanelProps> = ({
    lead,
    customer,
    currentUser,
    staff,
    onUpdateActivity,
    refreshData
}) => {
    const { addToast } = useToast();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showIncomeForm, setShowIncomeForm] = useState(false);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [rejectionNotes, setRejectionNotes] = useState('');
    const [transactionToReject, setTransactionToReject] = useState<Transaction | null>(null);

    // Income form state
    const [incomeAmount, setIncomeAmount] = useState<number | ''>('');
    const [incomeMethod, setIncomeMethod] = useState<PaymentMethod>(PaymentMethod.BankTransfer);
    const [incomeReference, setIncomeReference] = useState('');
    const [incomeReceipt, setIncomeReceipt] = useState<File | null>(null);
    const [incomeReceiptPreview, setIncomeReceiptPreview] = useState<string | null>(null);
    const [incomeDescription, setIncomeDescription] = useState('');
    const [incomeDate, setIncomeDate] = useState(new Date().toISOString().split('T')[0]);

    // Expense form state
    const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
    const [expenseMethod, setExpenseMethod] = useState<PaymentMethod>(PaymentMethod.Cash);
    const [expenseReference, setExpenseReference] = useState('');
    const [expenseReceipt, setExpenseReceipt] = useState<File | null>(null);
    const [expenseReceiptPreview, setExpenseReceiptPreview] = useState<string | null>(null);
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);

    const incomeReceiptInputRef = useRef<HTMLInputElement>(null);
    const expenseReceiptInputRef = useRef<HTMLInputElement>(null);

    // Check if user can approve: Super Admin / Manager always; Accountant only for leads they are assigned to
    const canApprove = useMemo(() => {
        if (currentUser.role === 'Super Admin' || currentUser.role === 'Manager') return true;
        if (currentUser.is_accountant === true) {
            const isAssignedToLead = lead?.assigned_to?.some((s: Staff) => s.id === currentUser.id);
            return !!isAssignedToLead;
        }
        return false;
    }, [currentUser, lead?.assigned_to]);

    // Check if user can record transactions: same rule as canApprove
    const canRecord = useMemo(() => {
        if (currentUser.role === 'Super Admin' || currentUser.role === 'Manager') return true;
        if (currentUser.is_accountant === true) {
            const isAssignedToLead = lead?.assigned_to?.some((s: Staff) => s.id === currentUser.id);
            return !!isAssignedToLead;
        }
        return false;
    }, [currentUser, lead?.assigned_to]);

    // Fetch transactions
    useEffect(() => {
        const fetchTransactions = async () => {
            if (!lead?.id) {
                setIsLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('lead_id', lead.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setTransactions(data || []);
            } catch (error: any) {
                console.error('Error fetching transactions:', error);
                addToast('Failed to load transactions', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchTransactions();
    }, [lead?.id, addToast]);

    // Separate transactions by type
    const incomeTransactions = useMemo(() => {
        return transactions.filter(t => t.type === TransactionType.Income);
    }, [transactions]);

    const expenseTransactions = useMemo(() => {
        return transactions.filter(t => t.type === TransactionType.Expense);
    }, [transactions]);

    // Calculate totals
    const totalIncome = useMemo(() => {
        return incomeTransactions
            .filter(t => t.status === TransactionApprovalStatus.Approved)
            .reduce((sum, t) => sum + t.amount, 0);
    }, [incomeTransactions]);

    const totalExpenses = useMemo(() => {
        return expenseTransactions
            .filter(t => t.status === TransactionApprovalStatus.Approved)
            .reduce((sum, t) => sum + t.amount, 0);
    }, [expenseTransactions]);

    const totalPendingIncome = useMemo(() => {
        return incomeTransactions
            .filter(t => t.status === TransactionApprovalStatus.Pending)
            .reduce((sum, t) => sum + t.amount, 0);
    }, [incomeTransactions]);

    const totalPendingExpenses = useMemo(() => {
        return expenseTransactions
            .filter(t => t.status === TransactionApprovalStatus.Pending)
            .reduce((sum, t) => sum + t.amount, 0);
    }, [expenseTransactions]);

    // Handle receipt upload
    const handleReceiptUpload = async (file: File, type: 'income' | 'expense'): Promise<string | null> => {
        try {
            const filePath = `receipts/${lead.id}/${type}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('receipts')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (error: any) {
            console.error('Error uploading receipt:', error);
            addToast('Failed to upload receipt', 'error');
            return null;
        }
    };

    // Handle income receipt change
    const handleIncomeReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIncomeReceipt(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setIncomeReceiptPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle expense receipt change
    const handleExpenseReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setExpenseReceipt(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setExpenseReceiptPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Validate transaction form
    const validateTransaction = (
        amount: number | '',
        method: PaymentMethod,
        reference: string,
        receipt: File | null,
        description: string
    ): boolean => {
        if (!amount || amount <= 0) {
            addToast('Please enter a valid amount', 'error');
            return false;
        }

        if (!description.trim()) {
            addToast('Please enter a description', 'error');
            return false;
        }

        // For Bank Transfer and UPI, require receipt OR reference
        if ((method === PaymentMethod.BankTransfer || method === PaymentMethod.UPI) && !receipt && !reference.trim()) {
            addToast('Please provide either a receipt or reference number for Bank Transfer/UPI', 'error');
            return false;
        }

        // For other methods, require reference if no receipt
        if (method !== PaymentMethod.BankTransfer && method !== PaymentMethod.UPI && !receipt && !reference.trim()) {
            addToast('Please provide either a receipt or reference number', 'error');
            return false;
        }

        return true;
    };

    const costingTabLink = `/leads?openLead=${lead.id}&tab=costing`;

    const notifyApproversForTransaction = async (transactionId: number, amount: number, type: TransactionType) => {
        try {
            const { data: superAdmins } = await supabase
                .from('staff')
                .select('id')
                .eq('role_id', 1);
            const { data: accountants } = await supabase
                .from('staff')
                .select('id')
                .eq('is_accountant', true);

            const recipients = new Set<number>();
            (superAdmins || []).forEach((s: any) => recipients.add(s.id));
            (accountants || []).forEach((s: any) => recipients.add(s.id));
            recipients.delete(currentUser.id);

            if (recipients.size === 0) return;

            const title = 'New transaction pending approval';
            const body = `${currentUser.name} recorded a ${type.toLowerCase()} transaction of ₹${amount.toLocaleString()} for this lead. Please review and approve/reject.`;

            const payloads = Array.from(recipients).map((staffId) => ({
                staff_id: staffId,
                type: 'transaction_pending_approval' as const,
                title,
                body,
                link: costingTabLink,
            }));

            await supabase.from('notifications').insert(payloads);
        } catch (error: any) {
            console.warn('Failed to send transaction approval notifications:', error?.message || error);
        }
    };

    const notifyRequesterOnDecision = async (
        transaction: Transaction,
        decision: 'approved' | 'rejected' | 'auto_rejected',
        reason?: string | null
    ) => {
        if (!transaction.recorded_by_staff_id) return;
        if (transaction.recorded_by_staff_id === currentUser.id && decision !== 'auto_rejected') return;

        const amountText = transaction.amount.toLocaleString();
        let title: string;
        let body: string;
        let type: 'transaction_approved' | 'transaction_rejected' | 'transaction_auto_rejected';

        if (decision === 'approved') {
            title = 'Transaction approved';
            body = `Your ${transaction.type.toLowerCase()} transaction of ₹${amountText} has been approved.`;
            type = 'transaction_approved';
        } else if (decision === 'rejected') {
            title = 'Transaction rejected';
            body = `Your ${transaction.type.toLowerCase()} transaction of ₹${amountText} was rejected by ${currentUser.name}.${reason ? ` Reason: ${reason}` : ''}`;
            type = 'transaction_rejected';
        } else {
            title = 'Transaction auto-rejected after 24 hours';
            body = `Your ${transaction.type.toLowerCase()} transaction of ₹${amountText} was automatically rejected because it was pending for more than 24 hours.`;
            type = 'transaction_auto_rejected';
        }

        try {
            await supabase.from('notifications').insert({
                staff_id: transaction.recorded_by_staff_id,
                type,
                title,
                body,
                link: costingTabLink,
            });
        } catch (error: any) {
            console.warn('Failed to send transaction decision notification:', error?.message || error);
        }
    };

    // Record income transaction
    const handleRecordIncome = async () => {
        if (!validateTransaction(incomeAmount, incomeMethod, incomeReference, incomeReceipt, incomeDescription)) {
            return;
        }

        setIsSaving(true);
        try {
            let receiptUrl: string | null = null;

            if (incomeReceipt) {
                receiptUrl = await handleReceiptUpload(incomeReceipt, 'income');
                if (!receiptUrl) {
                    setIsSaving(false);
                    return;
                }
            }

            const transactionData = {
                lead_id: lead.id,
                customer_id: customer.id,
                type: TransactionType.Income,
                amount: incomeAmount as number,
                payment_method: incomeMethod,
                reference_id: incomeReference.trim() || null,
                receipt_url: receiptUrl,
                description: incomeDescription.trim(),
                status: TransactionApprovalStatus.Pending,
                recorded_by_staff_id: currentUser.id,
                recorded_at: new Date(incomeDate).toISOString(),
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('transactions')
                .insert(transactionData)
                .select()
                .single();

            if (error) throw error;

            if (data?.id) {
                await notifyApproversForTransaction(data.id as number, incomeAmount as number, TransactionType.Income);
            }

            // Add activity log
            const activity: Activity = {
                id: Date.now(),
                type: 'Payment Received',
                description: `Income transaction of ₹${incomeAmount.toLocaleString()} recorded via ${incomeMethod}. Status: Pending Approval.`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);

            addToast('Income transaction recorded. Waiting for approval.', 'success');

            // Reset form
            setIncomeAmount('');
            setIncomeMethod(PaymentMethod.BankTransfer);
            setIncomeReference('');
            setIncomeReceipt(null);
            setIncomeReceiptPreview(null);
            setIncomeDescription('');
            setIncomeDate(new Date().toISOString().split('T')[0]);
            setShowIncomeForm(false);

            await refreshData();
        } catch (error: any) {
            console.error('Error recording income:', error);
            addToast(error.message || 'Failed to record income transaction', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Record expense transaction
    const handleRecordExpense = async () => {
        if (!validateTransaction(expenseAmount, expenseMethod, expenseReference, expenseReceipt, expenseDescription)) {
            return;
        }

        setIsSaving(true);
        try {
            let receiptUrl: string | null = null;

            if (expenseReceipt) {
                receiptUrl = await handleReceiptUpload(expenseReceipt, 'expense');
                if (!receiptUrl) {
                    setIsSaving(false);
                    return;
                }
            }

            const transactionData = {
                lead_id: lead.id,
                customer_id: customer.id,
                type: TransactionType.Expense,
                amount: expenseAmount as number,
                payment_method: expenseMethod,
                reference_id: expenseReference.trim() || null,
                receipt_url: receiptUrl,
                description: expenseDescription.trim(),
                status: TransactionApprovalStatus.Pending,
                recorded_by_staff_id: currentUser.id,
                recorded_at: new Date(expenseDate).toISOString(),
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('transactions')
                .insert(transactionData)
                .select()
                .single();

            if (error) throw error;

            if (data?.id) {
                await notifyApproversForTransaction(data.id as number, expenseAmount as number, TransactionType.Expense);
            }

            // Add activity log
            const activity: Activity = {
                id: Date.now(),
                type: 'Expense Recorded',
                description: `Expense transaction of ₹${expenseAmount.toLocaleString()} recorded via ${expenseMethod}. Status: Pending Approval.`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);

            addToast('Expense transaction recorded. Waiting for approval.', 'success');

            // Reset form
            setExpenseAmount('');
            setExpenseMethod(PaymentMethod.Cash);
            setExpenseReference('');
            setExpenseReceipt(null);
            setExpenseReceiptPreview(null);
            setExpenseDescription('');
            setExpenseDate(new Date().toISOString().split('T')[0]);
            setShowExpenseForm(false);

            await refreshData();
        } catch (error: any) {
            console.error('Error recording expense:', error);
            addToast(error.message || 'Failed to record expense transaction', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle approval
    const handleApprove = async (transaction: Transaction) => {
        if (!canApprove) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('transactions')
                .update({
                    status: TransactionApprovalStatus.Approved,
                    approved_by_staff_id: currentUser.id,
                    approved_at: new Date().toISOString(),
                    rejected_by_staff_id: null,
                    rejected_at: null,
                    rejection_notes: null
                })
                .eq('id', transaction.id);

            if (error) throw error;

            // Add activity log
            const activity: Activity = {
                id: Date.now(),
                type: transaction.type === TransactionType.Income ? 'Payment Approved' : 'Expense Approved',
                description: `${transaction.type} transaction of ₹${transaction.amount.toLocaleString()} approved by ${currentUser.name}.`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);

            addToast('Transaction approved successfully', 'success');
            await notifyRequesterOnDecision(transaction, 'approved', null);
            await refreshData();
        } catch (error: any) {
            console.error('Error approving transaction:', error);
            addToast(error.message || 'Failed to approve transaction', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle rejection
    const handleReject = async () => {
        if (!transactionToReject || !rejectionNotes.trim()) {
            addToast('Please provide a reason for rejection', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('transactions')
                .update({
                    status: TransactionApprovalStatus.Rejected,
                    rejected_by_staff_id: currentUser.id,
                    rejected_at: new Date().toISOString(),
                    rejection_notes: rejectionNotes,
                    approved_by_staff_id: null,
                    approved_at: null
                })
                .eq('id', transactionToReject.id);

            if (error) throw error;

            // Add activity log
            const activity: Activity = {
                id: Date.now(),
                type: transactionToReject.type === TransactionType.Income ? 'Payment Rejected' : 'Expense Rejected',
                description: `${transactionToReject.type} transaction of ₹${transactionToReject.amount.toLocaleString()} rejected by ${currentUser.name}. Reason: ${rejectionNotes}`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);

            addToast('Transaction rejected', 'success');
            await notifyRequesterOnDecision(transactionToReject, 'rejected', rejectionNotes);
            setTransactionToReject(null);
            setRejectionNotes('');
            await refreshData();
        } catch (error: any) {
            console.error('Error rejecting transaction:', error);
            addToast(error.message || 'Failed to reject transaction', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-reject pending transactions after 24 hours (based on recorded_at)
    useEffect(() => {
        const autoReject = async () => {
            const now = Date.now();
            const STALE_MS = 24 * 60 * 60 * 1000;
            const stale = transactions.filter(
                (t) =>
                    t.status === TransactionApprovalStatus.Pending &&
                    t.recorded_at &&
                    now - new Date(t.recorded_at).getTime() >= STALE_MS
            );

            if (!stale.length) return;

            for (const tx of stale) {
                try {
                    const { error } = await supabase
                        .from('transactions')
                        .update({
                            status: TransactionApprovalStatus.Rejected,
                            rejected_by_staff_id: null,
                            rejected_at: new Date().toISOString(),
                            rejection_notes: 'Automatically rejected after 24 hours without approval.',
                            approved_by_staff_id: null,
                            approved_at: null,
                        })
                        .eq('id', tx.id);

                    if (error) throw error;

                    await notifyRequesterOnDecision(tx, 'auto_rejected', null);
                } catch (error: any) {
                    console.warn('Failed to auto-reject transaction:', error?.message || error);
                }
            }

            if (stale.length > 0) {
                await refreshData();
            }
        };

        if (transactions.length > 0) {
            autoReject();
        }
    }, [transactions, refreshData]);

    // Render transaction row
    const renderTransactionRow = (transaction: Transaction) => {
        const recordedBy = staff.find(s => s.id === transaction.recorded_by_staff_id);
        const approvedBy = transaction.approved_by_staff_id ? staff.find(s => s.id === transaction.approved_by_staff_id) : null;
        const rejectedBy = transaction.rejected_by_staff_id ? staff.find(s => s.id === transaction.rejected_by_staff_id) : null;

        return (
            <tr key={transaction.id} className="border-b hover:bg-slate-50">
                <td className="p-3">{new Date(transaction.recorded_at).toLocaleDateString()}</td>
                <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${transaction.type === TransactionType.Income
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {transaction.type}
                    </span>
                </td>
                <td className="p-3 font-semibold">₹{transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td className="p-3">{transaction.payment_method}</td>
                <td className="p-3">
                    {transaction.reference_id && (
                        <span className="text-xs text-slate-600">{transaction.reference_id}</span>
                    )}
                    {transaction.receipt_url && (
                        <a
                            href={transaction.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline ml-2"
                        >
                            View Receipt
                        </a>
                    )}
                    {!transaction.reference_id && !transaction.receipt_url && (
                        <span className="text-xs text-slate-400">-</span>
                    )}
                </td>
                <td className="p-3 text-sm">{transaction.description}</td>
                <td className="p-3">
                    <div className="flex items-center gap-2">
                        <img
                            src={recordedBy?.avatar_url || `https://avatar.iran.liara.run/public/boy?username=${recordedBy?.name || 'User'}`}
                            alt={recordedBy?.name || 'User'}
                            className="w-6 h-6 rounded-full"
                        />
                        <span className="text-xs text-slate-600">{recordedBy?.name || 'Unknown'}</span>
                    </div>
                </td>
                <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${transaction.status === TransactionApprovalStatus.Approved
                        ? 'bg-green-100 text-green-800'
                        : transaction.status === TransactionApprovalStatus.Rejected
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {transaction.status}
                    </span>
                </td>
                <td className="p-3">
                    {approvedBy && (
                        <div className="flex items-center gap-2">
                            <img
                                src={approvedBy.avatar_url || `https://avatar.iran.liara.run/public/boy?username=${approvedBy.name}`}
                                alt={approvedBy.name}
                                className="w-6 h-6 rounded-full"
                            />
                            <span className="text-xs text-slate-600">{approvedBy.name}</span>
                        </div>
                    )}
                    {rejectedBy && (
                        <div className="flex items-center gap-2">
                            <img
                                src={rejectedBy.avatar_url || `https://avatar.iran.liara.run/public/boy?username=${rejectedBy.name}`}
                                alt={rejectedBy.name}
                                className="w-6 h-6 rounded-full"
                            />
                            <span className="text-xs text-red-600">{rejectedBy.name}</span>
                        </div>
                    )}
                    {transaction.status === TransactionApprovalStatus.Pending && (
                        <span className="text-xs text-slate-400">-</span>
                    )}
                </td>
                <td className="p-3">
                    {canApprove && transaction.status === TransactionApprovalStatus.Pending && (
                        <div className="flex gap-1">
                            <button
                                onClick={() => handleApprove(transaction)}
                                disabled={isSaving}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Approve"
                            >
                                <IconCheckCircle className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                    setTransactionToReject(transaction);
                                    setRejectionNotes('');
                                }}
                                disabled={isSaving}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Reject"
                            >
                                <IconX className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </td>
            </tr>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-slate-500">Loading transactions...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">Total Income</p>
                    <p className="text-xl font-bold text-green-600">₹{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    {totalPendingIncome > 0 && (
                        <p className="text-xs text-yellow-600 mt-1">+ ₹{totalPendingIncome.toLocaleString()} pending</p>
                    )}
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">Total Expenses</p>
                    <p className="text-xl font-bold text-red-600">₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    {totalPendingExpenses > 0 && (
                        <p className="text-xs text-yellow-600 mt-1">+ ₹{totalPendingExpenses.toLocaleString()} pending</p>
                    )}
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">Net Profit</p>
                    <p className={`text-xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{(totalIncome - totalExpenses).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 mb-1">Total Transactions</p>
                    <p className="text-xl font-bold text-slate-800">{transactions.length}</p>
                    <p className="text-xs text-yellow-600 mt-1">
                        {transactions.filter(t => t.status === TransactionApprovalStatus.Pending).length} pending approval
                    </p>
                </div>
            </div>

            {/* Action Buttons */}
            {canRecord && (
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            setShowIncomeForm(true);
                            setShowExpenseForm(false);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                    >
                        <IconPlus className="w-4 h-4" />
                        Record Income
                    </button>
                    <button
                        onClick={() => {
                            setShowExpenseForm(true);
                            setShowIncomeForm(false);
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                    >
                        <IconPlus className="w-4 h-4" />
                        Record Expense
                    </button>
                </div>
            )}

            {/* Income Form */}
            {showIncomeForm && (
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">Record Income</h3>
                        <button
                            onClick={() => {
                                setShowIncomeForm(false);
                                // Reset form
                                setIncomeAmount('');
                                setIncomeMethod(PaymentMethod.BankTransfer);
                                setIncomeReference('');
                                setIncomeReceipt(null);
                                setIncomeReceiptPreview(null);
                                setIncomeDescription('');
                                setIncomeDate(new Date().toISOString().split('T')[0]);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600"
                        >
                            <IconX className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₹) *</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={incomeAmount}
                                onChange={(e) => setIncomeAmount(e.target.value ? parseFloat(e.target.value) : '')}
                                className="w-full p-2 border rounded-md"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Payment Date *</label>
                            <input
                                type="date"
                                value={incomeDate}
                                onChange={(e) => setIncomeDate(e.target.value)}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method *</label>
                            <select
                                value={incomeMethod}
                                onChange={(e) => setIncomeMethod(e.target.value as PaymentMethod)}
                                className="w-full p-2 border rounded-md"
                            >
                                <option value={PaymentMethod.BankTransfer}>Bank Transfer</option>
                                <option value={PaymentMethod.UPI}>UPI</option>
                                <option value={PaymentMethod.Cash}>Cash</option>
                                <option value={PaymentMethod.Other}>Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Reference Number {incomeMethod === PaymentMethod.BankTransfer || incomeMethod === PaymentMethod.UPI ? '(Required if no receipt)' : ''}
                            </label>
                            <input
                                type="text"
                                value={incomeReference}
                                onChange={(e) => setIncomeReference(e.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="Enter reference number"
                            />
                        </div>
                        {(incomeMethod === PaymentMethod.BankTransfer || incomeMethod === PaymentMethod.UPI) && (
                            <div className="md:col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                    Receipt/Screenshot {incomeReference.trim() ? '(Optional)' : '(Required if no reference)'}
                                </label>
                                <div className="flex items-center gap-4">
                                    <input
                                        ref={incomeReceiptInputRef}
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={handleIncomeReceiptChange}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => incomeReceiptInputRef.current?.click()}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                                    >
                                        <IconUpload className="w-4 h-4" />
                                        Upload Receipt
                                    </button>
                                    {incomeReceiptPreview && (
                                        <div className="relative">
                                            <img src={incomeReceiptPreview} alt="Receipt preview" className="h-16 w-auto rounded border" />
                                            <button
                                                onClick={() => {
                                                    setIncomeReceipt(null);
                                                    setIncomeReceiptPreview(null);
                                                    if (incomeReceiptInputRef.current) {
                                                        incomeReceiptInputRef.current.value = '';
                                                    }
                                                }}
                                                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                                            >
                                                <IconX className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Description *</label>
                            <textarea
                                value={incomeDescription}
                                onChange={(e) => setIncomeDescription(e.target.value)}
                                className="w-full p-2 border rounded-md"
                                rows={3}
                                placeholder="Enter description (e.g., Payment received from customer)"
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowIncomeForm(false);
                                    // Reset form
                                    setIncomeAmount('');
                                    setIncomeMethod(PaymentMethod.BankTransfer);
                                    setIncomeReference('');
                                    setIncomeReceipt(null);
                                    setIncomeReceiptPreview(null);
                                    setIncomeDescription('');
                                    setIncomeDate(new Date().toISOString().split('T')[0]);
                                }}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRecordIncome}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-slate-400"
                            >
                                {isSaving ? 'Recording...' : 'Record Income'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Expense Form */}
            {showExpenseForm && (
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-slate-800">Record Expense</h3>
                        <button
                            onClick={() => {
                                setShowExpenseForm(false);
                                // Reset form
                                setExpenseAmount('');
                                setExpenseMethod(PaymentMethod.Cash);
                                setExpenseReference('');
                                setExpenseReceipt(null);
                                setExpenseReceiptPreview(null);
                                setExpenseDescription('');
                                setExpenseDate(new Date().toISOString().split('T')[0]);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600"
                        >
                            <IconX className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Amount (₹) *</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={expenseAmount}
                                onChange={(e) => setExpenseAmount(e.target.value ? parseFloat(e.target.value) : '')}
                                className="w-full p-2 border rounded-md"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Expense Date *</label>
                            <input
                                type="date"
                                value={expenseDate}
                                onChange={(e) => setExpenseDate(e.target.value)}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Payment Method *</label>
                            <select
                                value={expenseMethod}
                                onChange={(e) => setExpenseMethod(e.target.value as PaymentMethod)}
                                className="w-full p-2 border rounded-md"
                            >
                                <option value={PaymentMethod.Cash}>Cash</option>
                                <option value={PaymentMethod.BankTransfer}>Bank Transfer</option>
                                <option value={PaymentMethod.UPI}>UPI</option>
                                <option value={PaymentMethod.Other}>Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Reference Number {expenseMethod === PaymentMethod.BankTransfer || expenseMethod === PaymentMethod.UPI ? '(Required if no receipt)' : ''}
                            </label>
                            <input
                                type="text"
                                value={expenseReference}
                                onChange={(e) => setExpenseReference(e.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="Enter reference number"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                Receipt {expenseReference.trim() ? '(Optional)' : '(Required if no reference)'}
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    ref={expenseReceiptInputRef}
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={handleExpenseReceiptChange}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => expenseReceiptInputRef.current?.click()}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                                >
                                    <IconUpload className="w-4 h-4" />
                                    Upload Receipt
                                </button>
                                {expenseReceiptPreview && (
                                    <div className="relative">
                                        <img src={expenseReceiptPreview} alt="Receipt preview" className="h-16 w-auto rounded border" />
                                        <button
                                            onClick={() => {
                                                setExpenseReceipt(null);
                                                setExpenseReceiptPreview(null);
                                                if (expenseReceiptInputRef.current) {
                                                    expenseReceiptInputRef.current.value = '';
                                                }
                                            }}
                                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                                        >
                                            <IconX className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Description *</label>
                            <textarea
                                value={expenseDescription}
                                onChange={(e) => setExpenseDescription(e.target.value)}
                                className="w-full p-2 border rounded-md"
                                rows={3}
                                placeholder="Enter description (e.g., Petrol, Payment to supplier, etc.)"
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowExpenseForm(false);
                                    // Reset form
                                    setExpenseAmount('');
                                    setExpenseMethod(PaymentMethod.Cash);
                                    setExpenseReference('');
                                    setExpenseReceipt(null);
                                    setExpenseReceiptPreview(null);
                                    setExpenseDescription('');
                                    setExpenseDate(new Date().toISOString().split('T')[0]);
                                }}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRecordExpense}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-slate-400"
                            >
                                {isSaving ? 'Recording...' : 'Record Expense'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transactions Table */}
            <div className="bg-white p-6 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">All Transactions</h3>
                {transactions.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <p>No transactions recorded yet.</p>
                        {canRecord && (
                            <p className="text-sm mt-2">Use the buttons above to record income or expenses.</p>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left bg-slate-50">
                                <tr>
                                    <th className="p-3 font-medium text-slate-700">Date</th>
                                    <th className="p-3 font-medium text-slate-700">Type</th>
                                    <th className="p-3 font-medium text-slate-700 text-right">Amount</th>
                                    <th className="p-3 font-medium text-slate-700">Method</th>
                                    <th className="p-3 font-medium text-slate-700">Reference/Receipt</th>
                                    <th className="p-3 font-medium text-slate-700">Description</th>
                                    <th className="p-3 font-medium text-slate-700">Recorded By</th>
                                    <th className="p-3 font-medium text-slate-700">Status</th>
                                    <th className="p-3 font-medium text-slate-700">Approved/Rejected By</th>
                                    <th className="p-3 font-medium text-slate-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(renderTransactionRow)}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Rejection Modal */}
            {transactionToReject && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Reject Transaction</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Rejecting {transactionToReject.type} transaction of ₹{transactionToReject.amount.toLocaleString()}
                        </p>
                        <p className="text-sm text-slate-600 mb-4">Please provide a reason for rejection:</p>
                        <textarea
                            value={rejectionNotes}
                            onChange={(e) => setRejectionNotes(e.target.value)}
                            placeholder="Enter rejection reason..."
                            className="w-full p-3 border rounded-md min-h-[100px] mb-4"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setTransactionToReject(null);
                                    setRejectionNotes('');
                                }}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={isSaving || !rejectionNotes.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-slate-400"
                            >
                                {isSaving ? 'Rejecting...' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
