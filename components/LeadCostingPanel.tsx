import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Lead, LeadCosting, LeadCostItem, Service, LoggedInUser, Staff, TransactionApprovalStatus, Activity, Customer, TourRegion, ItineraryMetadata, CostingOption, TransactionType, PaymentMethod, Transaction, Supplier, Invoice, InvoiceStatus, LeadStatus, InvoiceItem, PaymentStatus } from '../types';
import { IconPlus, IconTrash, IconX, IconRefresh, IconPencil } from '../constants';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { recalculateInvoiceBalance } from '../lib/invoiceBalance';
import { useData } from '../contexts/DataProvider';

interface LeadCostingPanelProps {
    lead: Lead;
    customer?: Customer;
    currentUser: LoggedInUser;
    staff: Staff[];
    itineraries?: ItineraryMetadata[];
    onUpdateActivity: (activity: Activity) => void;
    refreshData: () => Promise<void>;
    onNavigate?: (path: string) => void;
}

export const LeadCostingPanel: React.FC<LeadCostingPanelProps> = ({
    lead,
    customer,
    currentUser,
    staff,
    itineraries = [],
    onUpdateActivity,
    refreshData,
    onNavigate
}) => {
    const { addToast } = useToast();
    const { transactions, invoices, suppliers, fetchTransactions, fetchInvoices } = useData();

    // Defer transactions/invoices fetch until after costing has loaded so the tab feels instant (like Details/Notes).
    // Costing table shows first; totals and transaction list fill in when these complete.
    const [costing, setCosting] = useState<LeadCosting | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [costItems, setCostItems] = useState<LeadCostItem[]>([]);
    const [rejectionNotes, setRejectionNotes] = useState('');
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [showDetailedCosting, setShowDetailedCosting] = useState(false);
    const [showTransactionMenu, setShowTransactionMenu] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [paymentType, setPaymentType] = useState<TransactionType>(TransactionType.Income);
    const [transactionAmount, setTransactionAmount] = useState<number | ''>('');
    const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
    const [transactionMethod, setTransactionMethod] = useState<PaymentMethod>(PaymentMethod.BankTransfer);
    const [transactionRef, setTransactionRef] = useState('');
    const [receiptNo, setReceiptNo] = useState('');
    const [transactionDescription, setTransactionDescription] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [isRecordingTransaction, setIsRecordingTransaction] = useState(false);
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
    const [transactionRejectionNotes, setTransactionRejectionNotes] = useState('');
    const [showTransactionRejectionModal, setShowTransactionRejectionModal] = useState(false);
    const [transactionToReject, setTransactionToReject] = useState<Transaction | null>(null);
    const [transactionDetailDrawer, setTransactionDetailDrawer] = useState<Transaction | null>(null);
    const [transactionDetailDrawerClosing, setTransactionDetailDrawerClosing] = useState(false);
    const [approveRejectDrawer, setApproveRejectDrawer] = useState<{ action: 'approve' | 'reject'; transaction: Transaction } | null>(null);
    const [approveRejectDrawerClosing, setApproveRejectDrawerClosing] = useState(false);
    const [approvalReceiptNo, setApprovalReceiptNo] = useState('');
    const [approvalExcelBillNo, setApprovalExcelBillNo] = useState('');
    const transactionMenuRef = useRef<HTMLDivElement>(null);
    const autoRejectedTxIdsRef = useRef<Set<number>>(new Set());

    const closeTransactionDetailDrawer = () => {
        setTransactionDetailDrawerClosing(true);
        setTimeout(() => {
            setTransactionDetailDrawer(null);
            setTransactionDetailDrawerClosing(false);
        }, 300);
    };
    const closeApproveRejectDrawer = () => {
        setApproveRejectDrawerClosing(true);
        setTransactionRejectionNotes('');
        setTimeout(() => {
            setApproveRejectDrawer(null);
            setApproveRejectDrawerClosing(false);
        }, 300);
    };
    const recordingInProgressRef = useRef(false); // Prevent duplicate transaction submit (double-click / race)
    const [invoiceCreated, setInvoiceCreated] = useState(false);
    const [costingRefreshTrigger, setCostingRefreshTrigger] = useState(0); // Trigger to force re-fetch costing
    const [costingDeletedByUser, setCostingDeletedByUser] = useState(false); // Flag to prevent re-fetching deleted costing

    // Check if user can approve: Super Admin, Manager, or Accountant (all can see and use approve/reject actions)
    const canApprove = useMemo(() => {
        if (currentUser.role === 'Super Admin' || currentUser.role === 'Manager') return true;
        if (currentUser.is_accountant === true) return true;
        return false;
    }, [currentUser]);

    // Get costing from props or fetch
    useEffect(() => {
        const getCosting = async () => {
            if (!lead?.id) {
                setIsLoading(false);
                return;
            }

            // If costing was deleted by user, don't fetch it again
            if (costingDeletedByUser) {
                setCosting(null);
                setCostItems([]);
                setIsLoading(false);
                return;
            }

            try {
                // Fetch costing
                const { data, error } = await supabase
                    .from('lead_costings')
                    .select('*')
                    .eq('lead_id', lead.id)
                    .maybeSingle(); // Use maybeSingle() instead of single() to handle 406 errors gracefully

                // Handle 406 (Not Acceptable) errors - usually RLS or table access issues
                if (error && error.code !== 'PGRST116') {
                    // Log 406 errors but don't throw - they're often RLS-related and non-critical
                    // Check for 406 in error message or if it's a network error
                    const is406Error = error.message?.includes('406') ||
                        (error as any).status === 406 ||
                        (error as any).statusCode === 406;
                    if (is406Error) {
                        console.warn('[LeadCostingPanel] 406 error fetching costing (likely RLS):', error.message);
                        setCosting(null);
                        setCostItems([]);
                        setIsLoading(false);
                        return;
                    }
                    throw error;
                }

                if (data) {
                    setCosting(data as LeadCosting);
                    // Get all services that should be included
                    const requiredServices = lead.services.filter(service =>
                        service === Service.Tour ||
                        service === Service.Visa ||
                        service === Service.AirTicketing ||
                        service === Service.HotelBooking ||
                        service === Service.Transport ||
                        service === Service.Insurance
                    );

                    // Merge saved items with required services - ensure all services are shown
                    const savedItems = data.items || [];
                    const mergedItems: LeadCostItem[] = [];
                    let itemIdCounter = Date.now();

                    // Start with saved items
                    savedItems.forEach(item => {
                        mergedItems.push(item);
                    });

                    // Add missing services as empty items
                    requiredServices.forEach(service => {
                        if (!mergedItems.find(item => item.service === service)) {
                            mergedItems.push({
                                id: itemIdCounter++,
                                service,
                                description: '',
                                amount: 0,
                                quantity: 1
                            });
                        }
                    });

                    setCostItems(mergedItems);
                } else {
                    // No costing found - clear state and initialize empty items
                    setCosting(null);
                    // Initialize with empty items based on lead services
                    const initialItems: LeadCostItem[] = lead.services
                        .filter(service => service === Service.Tour || service === Service.Visa || service === Service.AirTicketing || service === Service.HotelBooking || service === Service.Transport || service === Service.Insurance)
                        .map((service, index) => ({
                            id: Date.now() + index,
                            service,
                            description: '',
                            amount: 0,
                            quantity: 1
                        }));
                    setCostItems(initialItems);
                }
            } catch (error: any) {
                console.error('Error loading costing:', error);
                // Don't show error toast for missing costing
            } finally {
                setIsLoading(false);
                // Load transactions/invoices after costing is shown so tab opens fast; they fill in totals in background
                if (lead?.id) {
                    setTimeout(() => {
                        fetchTransactions?.();
                        fetchInvoices?.();
                    }, 0);
                }
            }
        };

        getCosting();
        setInvoiceCreated(false); // Reset invoice created flag when lead changes
        setCostingDeletedByUser(false); // Reset deleted flag when lead changes
    }, [lead?.id, addToast, costingRefreshTrigger, costingDeletedByUser]);

    // Check if invoice already exists when component loads
    useEffect(() => {
        if (!lead?.id || !invoices) return;
        const existingPaidInvoice = invoices.find(
            inv => inv.lead_id === lead.id && inv.status === InvoiceStatus.Paid
        );
        if (existingPaidInvoice) {
            setInvoiceCreated(true);
        }
    }, [lead?.id, invoices]);


    // Handle click outside transaction menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (transactionMenuRef.current && !transactionMenuRef.current.contains(event.target as Node)) {
                setShowTransactionMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Get tour package flag
    const hasTourPackage = lead.services.includes(Service.Tour);

    // Get services that should be included in costing
    const availableServices = useMemo(() => {
        return lead.services.filter(service =>
            service === Service.Tour ||
            service === Service.Visa ||
            service === Service.AirTicketing ||
            service === Service.HotelBooking ||
            service === Service.Transport ||
            service === Service.Insurance
        );
    }, [lead.services]);

    // Calculate totals including GST/TCS
    const totals = useMemo(() => {
        const subtotal = costItems.reduce((sum, item) => {
            const itemTotal = item.amount * (item.quantity || 1);
            return sum + itemTotal;
        }, 0);

        // Calculate GST/TCS based on tour region
        let gst = 0;
        let tcs = 0;

        if (lead.tour_region === TourRegion.Domestic) {
            // 5% GST for domestic tours (split into CGST and SGST)
            gst = subtotal * 0.05;
        } else if (lead.tour_region === TourRegion.International) {
            // 5% TCS for international tours
            tcs = subtotal * 0.05;
        }

        const grandTotal = subtotal + gst + tcs;

        return {
            subtotal,
            gst,
            cgst: gst / 2,
            sgst: gst / 2,
            tcs,
            grandTotal
        };
    }, [costItems, lead.tour_region]);

    const totalAmount = totals.grandTotal;

    // Financial Summary Calculations - Simplified (only costing, no transaction list)
    const financialSummary = useMemo(() => {
        // Use the saved total_amount from database, or calculate from current items
        const savedTotal = costing?.total_amount || 0;
        const calculatedTotal = totals.grandTotal;
        const approvedCosting = costing?.status === TransactionApprovalStatus.Approved ? (savedTotal || calculatedTotal) : 0;
        const pendingCount = costing?.status === TransactionApprovalStatus.Pending ? 1 : 0;

        return {
            totalCost: approvedCosting,
            pendingApprovals: pendingCount
        };
    }, [costing, totals.grandTotal]);

    // Helper variable declarations (non-hooks)
    const hasCosting = !!costing;
    const hasInvoice = (invoices || []).some(inv => inv.lead_id === lead.id);

    // Get transactions for this lead
    const leadTransactions = useMemo(() => {
        return (transactions || []).filter(t => t.lead_id === lead.id);
    }, [transactions, lead.id]);

    // Calculate financial totals
    const financialTotals = useMemo(() => {
        // Total Amount = sum of ALL invoices for this lead (so 100 invoices add up)
        const leadId = Number(lead.id);
        const leadInvoices = (invoices || []).filter(inv => Number(inv.lead_id) === leadId);
        const totalLeadCost = leadInvoices.length > 0
            ? leadInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
            : (hasCosting ? (totals.grandTotal || costing?.total_amount || 0) : 0);

        // Approved income transactions (status comparison robust to DB casing)
        const totalPaymentsMade = leadTransactions
            .filter(t => t.type === TransactionType.Income && (t.status as string)?.toLowerCase() === 'approved')
            .reduce((sum, t) => sum + t.amount, 0);

        // Calculate total due as: Total Lead Cost - Total Payments Made
        const totalDue = Math.max(0, totalLeadCost - totalPaymentsMade);

        // Approved expense transactions (status comparison robust to DB casing)
        const totalExpenses = leadTransactions
            .filter(t => t.type === TransactionType.Expense && (t.status as string)?.toLowerCase() === 'approved')
            .reduce((sum, t) => sum + t.amount, 0);

        return {
            totalLeadCost,
            totalPaymentsMade,
            totalDue,
            totalExpenses
        };
    }, [leadTransactions, costing, totals, lead.id, hasCosting, invoices]);

    // Auto-reject transactions that have been Pending for more than 24 hours; log system activity
    useEffect(() => {
        if (!lead?.id || !leadTransactions.length || !fetchTransactions) return;
        const now = Date.now();
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;
        const toAutoReject = leadTransactions.filter(
            t => t.status === TransactionApprovalStatus.Pending
                && (now - new Date(t.recorded_at).getTime() > twentyFourHoursMs)
                && !autoRejectedTxIdsRef.current.has(t.id)
        );
        if (toAutoReject.length === 0) return;
        toAutoReject.forEach((tx) => {
            autoRejectedTxIdsRef.current.add(tx.id);
            (async () => {
                try {
                    const { error } = await supabase
                        .from('transactions')
                        .update({
                            status: TransactionApprovalStatus.Rejected,
                            rejected_by_staff_id: null,
                            rejected_at: new Date().toISOString(),
                            rejection_notes: 'Auto-rejected: 24 hours passed without approval.',
                            approved_by_staff_id: null,
                            approved_at: null
                        })
                        .eq('id', tx.id);
                    if (error) throw error;
                    const activity: Activity = {
                        id: Date.now(),
                        type: 'System',
                        description: `24hrs passed - still recorded ${tx.type === TransactionType.Income ? 'payment' : 'expense'} not approved/rejected. Auto-rejected by system.`,
                        user: 'System',
                        timestamp: new Date().toISOString()
                    };
                    onUpdateActivity(activity);
                    await fetchTransactions(true);
                } catch (err) {
                    console.error('Auto-reject transaction failed:', err);
                    autoRejectedTxIdsRef.current.delete(tx.id);
                }
            })();
        });
    }, [lead?.id, leadTransactions, fetchTransactions, onUpdateActivity]);

    // Get linked itinerary for tour package leads
    const linkedItinerary = useMemo(() => {
        if (!hasTourPackage || !itineraries || itineraries.length === 0) return null;
        return itineraries.find(it =>
            lead.itinerary_ids?.includes(it.id) || it.lead_id === lead.id
        ) || null;
    }, [hasTourPackage, itineraries, lead]);

    // Auto-generate invoice and update lead status when payment is complete
    useEffect(() => {
        const handlePaymentComplete = async () => {
            // Only proceed if:
            // 1. Payment is complete (totalDue === 0)
            // 2. There's a costing
            // 3. Total payments made > 0
            // 4. Lead status is not already BillingCompletion
            // 5. Invoice hasn't been created yet
            if (
                !hasCosting ||
                financialTotals.totalDue > 0 ||
                financialTotals.totalPaymentsMade === 0 ||
                (lead.status as LeadStatus) === LeadStatus.BillingCompletion ||
                invoiceCreated ||
                !customer
            ) {
                return;
            }

            // Check if an invoice with status Paid already exists for this lead
            const existingPaidInvoice = (invoices || []).find(
                inv => inv.lead_id === lead.id && inv.status === InvoiceStatus.Paid
            );

            if (existingPaidInvoice) {
                setInvoiceCreated(true);
                // If invoice exists but lead status is not BillingCompletion, update it
                if ((lead.status as LeadStatus) !== LeadStatus.BillingCompletion) {
                    try {
                        const { error } = await supabase
                            .from('leads')
                            .update({ status: LeadStatus.BillingCompletion })
                            .eq('id', lead.id);

                        if (error) throw error;

                        const activity: Activity = {
                            id: Date.now(),
                            type: 'Lead Status Updated',
                            description: `Lead status updated to Billing Completed as full payment was received.`,
                            user: currentUser.name,
                            timestamp: new Date().toISOString()
                        };
                        onUpdateActivity(activity);
                        await refreshData();
                    } catch (error: any) {
                        console.error('Error updating lead status:', error);
                    }
                }
                return;
            }

            // Create invoice with status Paid
            try {
                setIsSaving(true);

                // Create invoice items from cost items
                const invoiceItems: InvoiceItem[] = costItems
                    .filter(item => item.amount > 0 && item.description)
                    .map(item => ({
                        id: Date.now() + Math.random(),
                        description: item.description || `${item.service}`,
                        qty: item.quantity || 1,
                        rate: item.amount,
                        amount: item.amount * (item.quantity || 1)
                    }));

                // If no items, create a default item
                if (invoiceItems.length === 0) {
                    invoiceItems.push({
                        id: Date.now(),
                        description: `Tour Package for ${lead.destination}`,
                        qty: 1,
                        rate: financialTotals.totalLeadCost,
                        amount: financialTotals.totalLeadCost
                    });
                }

                const today = new Date();
                const newInvoice: Partial<Invoice> = {
                    invoice_number: `INV-${Date.now().toString().slice(-6)}`,
                    lead_id: lead.id,
                    customer_id: customer.id,
                    issue_date: today.toISOString().split('T')[0],
                    due_date: today.toISOString().split('T')[0],
                    status: InvoiceStatus.Paid,
                    items: invoiceItems,
                    total_amount: financialTotals.totalLeadCost,
                    balance_due: 0,
                    created_at: new Date().toISOString()
                };

                const { data: savedInvoice, error: invoiceError } = await supabase
                    .from('invoices')
                    .insert(newInvoice)
                    .select()
                    .single();

                if (invoiceError) throw invoiceError;

                // Update lead status to Billing Completed
                const { error: leadError } = await supabase
                    .from('leads')
                    .update({ status: LeadStatus.BillingCompletion })
                    .eq('id', lead.id);

                if (leadError) throw leadError;

                setInvoiceCreated(true);

                // Add activity logs
                const invoiceActivity: Activity = {
                    id: Date.now(),
                    type: 'Invoice Created',
                    description: `Invoice ${savedInvoice.invoice_number} created and marked as Paid. Total amount: ₹${financialTotals.totalLeadCost.toLocaleString()}.`,
                    user: currentUser.name,
                    timestamp: new Date().toISOString()
                };
                onUpdateActivity(invoiceActivity);

                const statusActivity: Activity = {
                    id: Date.now() + 1,
                    type: 'Lead Status Updated',
                    description: `Lead status updated to Billing Completed as full payment of ₹${financialTotals.totalPaymentsMade.toLocaleString()} was received.`,
                    user: currentUser.name,
                    timestamp: new Date().toISOString()
                };
                onUpdateActivity(statusActivity);

                addToast('Payment completed! Invoice generated and lead status updated.', 'success');
                await refreshData();
            } catch (error: any) {
                console.error('Error creating invoice or updating lead status:', error);
                addToast(`Failed to create invoice: ${error.message}`, 'error');
            } finally {
                setIsSaving(false);
            }
        };

        handlePaymentComplete();
    }, [
        financialTotals.totalDue,
        financialTotals.totalPaymentsMade,
        financialTotals.totalLeadCost,
        hasCosting,
        lead.id,
        lead.status,
        invoiceCreated,
        customer,
        costItems,
        totals,
        lead.tour_region,
        lead.destination,
        invoices,
        currentUser.name,
        onUpdateActivity,
        refreshData,
        addToast
    ]);

    // Helper variable declarations (non-hooks, before handlers)
    const requiresApproval = hasTourPackage && costing?.status === TransactionApprovalStatus.Pending;
    const isApproved = costing?.status === TransactionApprovalStatus.Approved;
    const isRejected = costing?.status === TransactionApprovalStatus.Rejected;
    const isSuperAdmin = currentUser.role === 'Super Admin';
    const canEditCosting = isSuperAdmin || !isApproved;

    // Handle adding cost item
    const handleAddItem = () => {
        const newItem: LeadCostItem = {
            id: Date.now(),
            service: Service.Tour,
            description: '',
            amount: 0,
            quantity: 1
        };
        setCostItems([...costItems, newItem]);
        setIsEditing(true);
    };

    // Handle removing cost item
    const handleRemoveItem = (itemId: number) => {
        setCostItems(costItems.filter(item => item.id !== itemId));
        setIsEditing(true);
    };

    // Handle item change
    const handleItemChange = (itemId: number, field: keyof LeadCostItem, value: any) => {
        setCostItems(costItems.map(item =>
            item.id === itemId ? { ...item, [field]: value } : item
        ));
        setIsEditing(true);
    };

    // Save costing
    const handleSave = async () => {
        if (!lead?.id) return;

        // Validation: Tour Package requires at least one item
        if (lead.services.includes(Service.Tour)) {
            const tourItems = costItems.filter(item => item.service === Service.Tour);
            if (tourItems.length === 0 || tourItems.every(item => !item.description || item.amount === 0)) {
                addToast('Tour Package requires at least one cost item with description and amount', 'error');
                return;
            }
        }

        setIsSaving(true);
        try {
            const costingData = {
                lead_id: lead.id,
                items: costItems, // Save all items - user can have empty items for later
                total_amount: totals.subtotal, // Save subtotal, GST/TCS calculated on display
                status: TransactionApprovalStatus.Pending,
                created_by_staff_id: currentUser.id,
                created_at: new Date().toISOString()
            };

            if (costing?.id) {
                // Update existing
                const { error } = await supabase
                    .from('lead_costings')
                    .update({
                        items: costingData.items,
                        total_amount: totals.subtotal,
                        status: TransactionApprovalStatus.Pending, // Reset to pending when updated
                        rejection_notes: null,
                        approved_by_staff_id: null,
                        rejected_by_staff_id: null,
                        approved_at: null,
                        rejected_at: null
                    })
                    .eq('id', costing.id);

                if (error) throw error;
                addToast('Costing updated successfully. Waiting for approval.', 'success');
            } else {
                // Create new
                const { data, error } = await supabase
                    .from('lead_costings')
                    .insert(costingData)
                    .select()
                    .single();

                if (error) throw error;
                setCosting(data as LeadCosting);
                addToast('Costing saved successfully. Waiting for approval.', 'success');
            }

            // Add activity log
            const activity: Activity = {
                id: Date.now(),
                type: costing?.id ? 'Costing Updated' : 'Costing Created',
                description: `Lead costing ${costing?.id ? 'updated' : 'created'} with total amount ₹${totals.grandTotal.toLocaleString()}. Status: Pending Approval.`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);

            setIsEditing(false);
            await refreshData();
        } catch (error: any) {
            console.error('Error saving costing:', error);
            addToast(error.message || 'Failed to save costing', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle approval
    const handleApprove = async () => {
        if (!costing?.id || !canApprove) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('lead_costings')
                .update({
                    status: TransactionApprovalStatus.Approved,
                    approved_by_staff_id: currentUser.id,
                    approved_at: new Date().toISOString(),
                    rejected_by_staff_id: null,
                    rejected_at: null,
                    rejection_notes: null
                })
                .eq('id', costing.id);

            if (error) throw error;

            // Add activity log
            const activity: Activity = {
                id: Date.now(),
                type: 'Costing Approved',
                description: `Tour package costing (₹${totals.grandTotal.toLocaleString()}) approved by ${currentUser.name}.`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);

            addToast('Costing approved successfully', 'success');

            // Refetch costing to update status immediately
            const { data: updatedCosting, error: fetchError } = await supabase
                .from('lead_costings')
                .select('*')
                .eq('lead_id', lead.id)
                .maybeSingle();

            if (!fetchError && updatedCosting) {
                setCosting(updatedCosting as LeadCosting);
            }

            await refreshData();
        } catch (error: any) {
            console.error('Error approving costing:', error);
            addToast(error.message || 'Failed to approve costing', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle rejection
    const handleReject = async () => {
        if (!costing?.id || !canApprove || !rejectionNotes.trim()) {
            if (!rejectionNotes.trim()) {
                addToast('Please provide a reason for rejection', 'error');
            }
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('lead_costings')
                .update({
                    status: TransactionApprovalStatus.Rejected,
                    rejected_by_staff_id: currentUser.id,
                    rejected_at: new Date().toISOString(),
                    rejection_notes: rejectionNotes,
                    approved_by_staff_id: null,
                    approved_at: null
                })
                .eq('id', costing.id);

            if (error) throw error;

            // Add activity log
            const activity: Activity = {
                id: Date.now(),
                type: 'Costing Rejected',
                description: `Tour package costing (₹${totals.grandTotal.toLocaleString()}) rejected by ${currentUser.name}. Reason: ${rejectionNotes}`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);

            addToast('Costing rejected', 'success');
            setShowRejectionModal(false);
            setRejectionNotes('');

            // Refetch costing to update status immediately
            const { data: updatedCosting, error: fetchError } = await supabase
                .from('lead_costings')
                .select('*')
                .eq('lead_id', lead.id)
                .maybeSingle();

            if (!fetchError && updatedCosting) {
                setCosting(updatedCosting as LeadCosting);
            }

            await refreshData();
        } catch (error: any) {
            console.error('Error rejecting costing:', error);
            addToast(error.message || 'Failed to reject costing', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle delete costing - Only Super Admin can delete permanently
    const handleDeleteCosting = async () => {
        if (!costing?.id) {
            addToast('No costing found to delete', 'error');
            return;
        }

        if (!isSuperAdmin) {
            addToast('Only Super Admin can delete costing', 'error');
            setShowDeleteModal(false);
            return;
        }

        setIsSaving(true);
        try {
            // Permanently delete the costing from database
            const { data: deletedData, error } = await supabase
                .from('lead_costings')
                .delete()
                .eq('id', costing.id)
                .select();

            if (error) throw error;

            // Verify deletion was successful
            if (!deletedData || deletedData.length === 0) {
                console.warn('No rows deleted - costing may not exist or deletion was blocked. Will still clear local state.');
            } else {
                console.log(`Successfully deleted costing with id: ${costing.id}`);
            }

            // Add activity log
            const activity: Activity = {
                id: Date.now(),
                type: 'Costing Deleted',
                description: `Tour package costing permanently deleted by ${currentUser.name}.`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);

            // Clear local state immediately and mark as deleted by user
            setCosting(null);
            setCostItems([]);
            setCostingDeletedByUser(true); // Prevent re-fetching
            setShowDeleteModal(false);
            setIsEditing(false);

            // Refresh global data first
            await refreshData();

            // Wait a moment for database to complete deletion
            await new Promise(resolve => setTimeout(resolve, 500));

            // Force re-fetch costing to verify deletion (should return no data)
            setIsLoading(true);
            let deletionWasSuccessful = false;
            try {
                const { data: verifyData, error: verifyError } = await supabase
                    .from('lead_costings')
                    .select('*')
                    .eq('lead_id', lead.id)
                    .single();

                if (verifyError && verifyError.code === 'PGRST116') {
                    // Good: No costing found - deletion successful
                    deletionWasSuccessful = true;
                    setCosting(null);
                    setCostingDeletedByUser(false); // Reset flag since deletion was successful
                    // Initialize empty items based on lead services
                    const initialItems: LeadCostItem[] = lead.services
                        .filter(service => service === Service.Tour || service === Service.Visa || service === Service.AirTicketing || service === Service.HotelBooking || service === Service.Transport || service === Service.Insurance)
                        .map((service, index) => ({
                            id: Date.now() + index,
                            service,
                            description: '',
                            amount: 0,
                            quantity: 1
                        }));
                    setCostItems(initialItems);
                } else if (verifyData) {
                    // Costing still exists - deletion failed, likely due to database constraints or RLS policies
                    console.error('Costing still exists after deletion attempt. Record:', verifyData);
                    deletionWasSuccessful = false;
                    // For Super Admin: Try a more aggressive deletion approach
                    if (isSuperAdmin) {
                        // Try deleting by lead_id instead of id (in case id doesn't match)
                        const { data: deletedByLeadData, error: deleteByLeadError } = await supabase
                            .from('lead_costings')
                            .delete()
                            .eq('lead_id', lead.id)
                            .select();

                        if (!deleteByLeadError && deletedByLeadData && deletedByLeadData.length > 0) {
                            console.log('Successfully deleted costing by lead_id');
                            // Verify again after deletion
                            await new Promise(resolve => setTimeout(resolve, 300));
                            const { data: reVerifyData } = await supabase
                                .from('lead_costings')
                                .select('*')
                                .eq('lead_id', lead.id)
                                .single();
                            if (!reVerifyData) {
                                deletionWasSuccessful = true;
                                setCosting(null);
                                setCostItems([]);
                                setCostingDeletedByUser(false);
                            } else {
                                // Still exists - mark as failed
                                setCosting(null);
                                setCostItems([]);
                                setCostingDeletedByUser(true);
                                addToast('Unable to permanently delete costing. It may be referenced elsewhere. Local view has been cleared.', 'error');
                            }
                        } else {
                            console.error('Failed to delete by lead_id:', deleteByLeadError);
                            // Clear local state anyway so UI shows zero
                            // Even if DB record exists, we'll ignore it locally
                            setCosting(null);
                            setCostItems([]);
                            setCostingDeletedByUser(true); // Prevent re-fetching
                            addToast('Unable to permanently delete costing. It may be referenced elsewhere. Local view has been cleared.', 'error');
                        }
                    } else {
                        // For non-super-admin, just clear local state
                        setCosting(null);
                        setCostItems([]);
                        setCostingDeletedByUser(true); // Prevent re-fetching
                        addToast('Costing deletion failed. Please contact Super Admin.', 'error');
                    }
                } else {
                    // No data - deletion successful
                    deletionWasSuccessful = true;
                    setCosting(null);
                    setCostItems([]);
                    setCostingDeletedByUser(false);
                }
            } catch (verifyErr: any) {
                // Expected error when costing doesn't exist (PGRST116)
                if (verifyErr.code === 'PGRST116') {
                    deletionWasSuccessful = true;
                    setCosting(null);
                    setCostingDeletedByUser(false);
                    // Initialize empty items
                    const initialItems: LeadCostItem[] = lead.services
                        .filter(service => service === Service.Tour || service === Service.Visa || service === Service.AirTicketing || service === Service.HotelBooking || service === Service.Transport || service === Service.Insurance)
                        .map((service, index) => ({
                            id: Date.now() + index,
                            service,
                            description: '',
                            amount: 0,
                            quantity: 1
                        }));
                    setCostItems(initialItems);
                } else {
                    console.error('Error verifying deletion:', verifyErr);
                    setCosting(null);
                    setCostItems([]);
                    setCostingDeletedByUser(true); // Prevent re-fetching on error
                }
            } finally {
                setIsLoading(false);
            }

            // Only show success and trigger refresh if deletion was actually successful
            if (deletionWasSuccessful) {
                setCostingRefreshTrigger(prev => prev + 1);
                addToast('Costing permanently deleted successfully', 'success');
            }
            // If deletion failed, we've already shown error message and set costingDeletedByUser flag
        } catch (error: any) {
            console.error('Error deleting costing:', error);
            addToast(`Failed to delete costing: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Helper: create Payment record for an approved Income transaction (with or without invoice).
    // So the Supabase `payments` table always has a row when Income is recorded and approved.
    const createPaymentFromApprovedIncome = async (transaction: Transaction) => {
        try {
            let leadId = transaction.lead_id;
            let customerId = transaction.customer_id;
            let invoiceId: number | null = transaction.invoice_id ?? null;

            if (invoiceId) {
                const { data: invoice } = await supabase
                    .from('invoices')
                    .select('id, lead_id, customer_id')
                    .eq('id', invoiceId)
                    .single();
                if (invoice) {
                    leadId = invoice.lead_id ?? leadId;
                    customerId = invoice.customer_id ?? customerId;
                }
            }

            const { error: paymentError } = await supabase
                .from('payments')
                .insert({
                    invoice_id: invoiceId || undefined,
                    lead_id: leadId,
                    customer_id: customerId,
                    payment_date: transaction.recorded_at || new Date().toISOString(),
                    amount: transaction.amount,
                    method: transaction.payment_method,
                    reference_id: transaction.reference_id || null,
                    status: PaymentStatus.Paid,
                    notes: transaction.description ? `Payment from approved transaction: ${transaction.description}` : null,
                    source: 'Manual',
                    created_by_staff_id: transaction.approved_by_staff_id || transaction.recorded_by_staff_id,
                    created_at: new Date().toISOString(),
                });

            if (paymentError) {
                console.error('Error creating payment from approved income:', paymentError);
                throw paymentError;
            }

            if (invoiceId) {
                await recalculateInvoiceBalance(invoiceId);
            }
        } catch (error: any) {
            console.error('Error in createPaymentFromApprovedIncome:', error);
            throw error;
        }
    };

    // Handle record payment/expense inline
    const handleRecordTransaction = async () => {
        if (!customer || !lead?.id || !transactionAmount || transactionAmount <= 0) {
            addToast('Please enter a valid amount', 'error');
            return;
        }

        // Excel Bill No. and Receipt No. are optional when recording; can be filled at approval time

        // Prevent duplicate submission (double-click or rapid clicks)
        if (recordingInProgressRef.current) return;
        recordingInProgressRef.current = true;
        setIsRecordingTransaction(true);
        try {
            let receiptUrl = null;

            // Upload receipt if provided
            if (receiptFile) {
                const filePath = `public/transaction-receipts/${lead.id}/${Date.now()}-${receiptFile.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, receiptFile);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                receiptUrl = data.publicUrl;
            }

            // Auto-approve for super admin and accountant
            const isAutoApproved = canApprove;
            const transactionStatus = isAutoApproved ? TransactionApprovalStatus.Approved : TransactionApprovalStatus.Pending;

            // Build description with supplier info for expenses
            let finalDescription = transactionDescription || (paymentType === TransactionType.Income ? 'Payment received' : 'Expense recorded');
            if (paymentType === TransactionType.Expense && selectedSupplierId) {
                const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
                if (selectedSupplier) {
                    finalDescription = finalDescription ?
                        `${finalDescription} | Supplier: ${selectedSupplier.company_name} (${selectedSupplier.contact_person_name})` :
                        `Expense for ${selectedSupplier.company_name} (${selectedSupplier.contact_person_name})`;
                }
            }

            // Excel Bill No.: store with RC- prefix in DB
            const excelBillNoValue = (transactionRef || '').trim();
            const referenceIdForDb = excelBillNoValue
                ? (excelBillNoValue.toUpperCase().startsWith('RC-') ? excelBillNoValue : `RC-${excelBillNoValue}`)
                : null;
            const transactionData: any = {
                lead_id: lead.id,
                customer_id: customer.id,
                invoice_id: paymentType === TransactionType.Income ? (selectedInvoiceId || null) : null, // Only link to invoice for Income payments
                type: paymentType,
                amount: transactionAmount,
                payment_method: transactionMethod,
                reference_id: referenceIdForDb,
                receipt_no: (receiptNo || '').trim() || null,
                receipt_url: receiptUrl,
                description: finalDescription,
                status: transactionStatus,
                recorded_by_staff_id: currentUser.id,
                recorded_at: new Date(transactionDate + 'T00:00:00').toISOString()
            };

            // If auto-approved, set approval fields
            if (isAutoApproved) {
                transactionData.approved_by_staff_id = currentUser.id;
                transactionData.approved_at = new Date().toISOString();
            }

            const { data: insertedTransaction, error } = await supabase
                .from('transactions')
                .insert(transactionData)
                .select()
                .single();

            if (error) throw error;

            // If auto-approved Income, create Payment record immediately (so payments table has a row)
            if (isAutoApproved && paymentType === TransactionType.Income && insertedTransaction) {
                await createPaymentFromApprovedIncome(insertedTransaction);
            }

            // Add activity log
            const activity: Activity = {
                id: Date.now(),
                type: paymentType === TransactionType.Income ? 'Payment Recorded' : 'Expense Recorded',
                description: `${paymentType} of ₹${transactionAmount.toLocaleString()} recorded via ${transactionMethod}. ${isAutoApproved ? 'Auto-approved by ' + currentUser.name + '.' : 'Status: Pending Approval.'}`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);

            addToast(`${paymentType === TransactionType.Income ? 'Payment' : 'Expense'} recorded successfully. ${isAutoApproved ? 'Auto-approved.' : 'Waiting for approval.'}`, 'success');

            // Reset form
            setTransactionAmount('');
            setTransactionDate(new Date().toISOString().split('T')[0]);
            setTransactionMethod(PaymentMethod.BankTransfer);
            setTransactionRef('');
            setReceiptNo('');
            setTransactionDescription('');
            setReceiptFile(null);
            setSelectedSupplierId(null);
            setSelectedInvoiceId(null);
            setShowPaymentForm(false);
            setShowExpenseForm(false);
            setShowTransactionMenu(false);

            await refreshData();
            await fetchTransactions?.(true);
        } catch (error: any) {
            console.error('Error recording transaction:', error);
            addToast(error.message || 'Failed to record transaction', 'error');
        } finally {
            recordingInProgressRef.current = false;
            setIsRecordingTransaction(false);
        }
    };

    // Sync costing from itinerary
    const handleSyncFromItinerary = async () => {
        if (!linkedItinerary || !linkedItinerary.itinerary_versions || linkedItinerary.itinerary_versions.length === 0) {
            addToast('No itinerary found or itinerary has no versions', 'error');
            return;
        }

        // Get latest version
        const latestVersion = linkedItinerary.itinerary_versions.sort((a, b) =>
            (b.version_number || 0) - (a.version_number || 0)
        )[0];

        if (!latestVersion.costing_options || latestVersion.costing_options.length === 0) {
            addToast('Itinerary has no costing options', 'error');
            return;
        }

        const defaultOption = latestVersion.costing_options.find((opt: CostingOption) => opt.isDefault) || latestVersion.costing_options[0];

        setIsSaving(true);
        try {
            // Fetch FX rates for currency conversion
            let fxRates: Record<string, number> = { INR: 1 };
            try {
                const fxResponse = await fetch('https://api.frankfurter.app/latest?from=INR');
                if (fxResponse.ok) {
                    const fxData = await fxResponse.json();
                    fxRates = { ...fxData.rates, INR: 1 };
                }
            } catch (e) {
                console.warn('Could not fetch FX rates, using INR only');
            }

            const syncedItems: LeadCostItem[] = [];
            let itemIdCounter = Date.now();

            // Handle manual costing
            if (defaultOption.isManualCosting && defaultOption.manualPackageCost) {
                syncedItems.push({
                    id: itemIdCounter++,
                    service: Service.Tour,
                    description: 'Tour Package',
                    amount: defaultOption.manualPackageCost,
                    quantity: 1
                });
            } else {
                // Convert itemized costing from itinerary
                const costing = defaultOption.costing;

                // Map itinerary costing categories to Lead services
                const categoryToService: Record<string, Service> = {
                    'flights_outbound': Service.AirTicketing,
                    'flights_return': Service.AirTicketing,
                    'hotels': Service.HotelBooking,
                    'transfers': Service.Transport,
                    'sightseeing': Service.Tour,
                    'visa': Service.Visa,
                    'insurance': Service.Insurance,
                    'other': Service.Tour
                };

                // Process each category
                Object.entries(costing).forEach(([category, items]) => {
                    if (!Array.isArray(items)) return;

                    items.forEach((item: any) => {
                        if (!item.included) return;

                        // Convert currency to INR
                        const rate = fxRates[item.currency] || 1;
                        let amount = 0;

                        if (category === 'hotels') {
                            // Hotel costing item
                            amount = (item.unitPrice * item.quantity * item.nights || item.unitPrice) * rate;
                            syncedItems.push({
                                id: itemIdCounter++,
                                service: Service.HotelBooking,
                                description: `${item.name || 'Hotel'} - ${item.city || ''} (${item.nights || 1} nights)`,
                                amount: Math.round(amount * 100) / 100,
                                quantity: item.quantity || 1
                            });
                        } else {
                            // Regular costing item
                            amount = (item.unitPrice * item.quantity) * rate;
                            const service = categoryToService[category] || Service.Tour;
                            syncedItems.push({
                                id: itemIdCounter++,
                                service,
                                description: item.description || category,
                                amount: Math.round(amount * 100) / 100,
                                quantity: item.quantity || 1
                            });
                        }
                    });
                });
            }

            if (syncedItems.length === 0) {
                addToast('No valid costing items found in itinerary', 'error');
                setIsSaving(false);
                return;
            }

            // Update cost items and enable editing
            setCostItems(syncedItems);
            setIsEditing(true);
            addToast(`Synced ${syncedItems.length} item(s) from itinerary`, 'success');

            // Add activity log
            const activity: Activity = {
                id: Date.now(),
                type: 'Costing Synced',
                description: `Costing synced from itinerary "${linkedItinerary.creative_title}".`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);

        } catch (error: any) {
            console.error('Error syncing from itinerary:', error);
            addToast(error.message || 'Failed to sync costing from itinerary', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle transaction approval
    const handleApproveTransaction = async (transaction: Transaction) => {
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

            // If approved Income, create Payment record (so payments table has a row; invoice balance updated when invoice_id set)
            if (transaction.type === TransactionType.Income) {
                await createPaymentFromApprovedIncome(transaction);
            }

            const activity: Activity = {
                id: Date.now(),
                type: transaction.type === TransactionType.Income ? 'Payment Approved' : 'Expense Approved',
                description: `${transaction.type} of ₹${transaction.amount.toLocaleString()} approved by ${currentUser.name}.${transaction.type === TransactionType.Income && transaction.invoice_id ? ' Payment recorded in invoice.' : ''}`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);

            addToast(`${transaction.type} approved successfully${transaction.type === TransactionType.Income && transaction.invoice_id ? ' and payment recorded' : ''}`, 'success');
            await refreshData();
            await fetchTransactions?.(true);
        } catch (error: any) {
            console.error('Error approving transaction:', error);
            addToast(error.message || 'Failed to approve transaction', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle transaction rejection
    const handleRejectTransaction = async () => {
        if (!transactionToReject || !canApprove || !transactionRejectionNotes.trim()) {
            if (!transactionRejectionNotes.trim()) {
                addToast('Please provide a reason for rejection', 'error');
            }
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
                    rejection_notes: transactionRejectionNotes,
                    approved_by_staff_id: null,
                    approved_at: null
                })
                .eq('id', transactionToReject.id);

            if (error) throw error;

            const activity: Activity = {
                id: Date.now(),
                type: transactionToReject.type === TransactionType.Income ? 'Payment Rejected' : 'Expense Rejected',
                description: `${transactionToReject.type} of ₹${transactionToReject.amount.toLocaleString()} rejected by ${currentUser.name}. Reason: ${transactionRejectionNotes}`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);

            addToast(`${transactionToReject.type} rejected`, 'success');
            setShowTransactionRejectionModal(false);
            setTransactionRejectionNotes('');
            setTransactionToReject(null);
            await refreshData();
        } catch (error: any) {
            console.error('Error rejecting transaction:', error);
            addToast(error.message || 'Failed to reject transaction', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Confirm approve from drawer (Receipt No. & Excel Bill No. are mandatory)
    const confirmApproveFromDrawer = async () => {
        if (!approveRejectDrawer || approveRejectDrawer.action !== 'approve') return;
        if (!approvalExcelBillNo.trim() || !approvalReceiptNo.trim()) {
            addToast('Please enter both Excel Bill No. (RC-) and Receipt No. before approving.', 'error');
            return;
        }
        const tx = approveRejectDrawer.transaction;
        setIsSaving(true);
        try {
            const refVal = (approvalExcelBillNo || '').trim();
            const referenceIdForDb = refVal ? (refVal.toUpperCase().startsWith('RC-') ? refVal : `RC-${refVal}`) : null;
            const updatePayload: any = {
                status: TransactionApprovalStatus.Approved,
                approved_by_staff_id: currentUser.id,
                approved_at: new Date().toISOString(),
                rejected_by_staff_id: null,
                rejected_at: null,
                rejection_notes: null,
                receipt_no: (approvalReceiptNo || '').trim() || null,
                reference_id: referenceIdForDb
            };
            const { error } = await supabase.from('transactions').update(updatePayload).eq('id', tx.id);
            if (error) throw error;
            if (tx.type === TransactionType.Income) {
                await createPaymentFromApprovedIncome({ ...tx, ...updatePayload });
            }
            const activity: Activity = {
                id: Date.now(),
                type: tx.type === TransactionType.Income ? 'Payment Approved' : 'Expense Approved',
                description: `${tx.type} of ₹${tx.amount.toLocaleString()} approved by ${currentUser.name}.`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);
            addToast(`${tx.type} approved successfully`, 'success');
            closeApproveRejectDrawer();
            await refreshData();
            await fetchTransactions?.(true);
        } catch (error: any) {
            console.error('Error approving transaction:', error);
            addToast(error.message || 'Failed to approve transaction', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Confirm reject from drawer (only reason required; Excel Bill No. / Receipt No. not asked for rejection)
    const confirmRejectFromDrawer = async () => {
        if (!approveRejectDrawer || approveRejectDrawer.action !== 'reject') return;
        if (!transactionRejectionNotes.trim()) {
            addToast('Please provide a reason for rejection', 'error');
            return;
        }
        const tx = approveRejectDrawer.transaction;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('transactions')
                .update({
                    status: TransactionApprovalStatus.Rejected,
                    rejected_by_staff_id: currentUser.id,
                    rejected_at: new Date().toISOString(),
                    rejection_notes: transactionRejectionNotes,
                    approved_by_staff_id: null,
                    approved_at: null
                })
                .eq('id', tx.id);
            if (error) throw error;
            const activity: Activity = {
                id: Date.now(),
                type: tx.type === TransactionType.Income ? 'Payment Rejected' : 'Expense Rejected',
                description: `${tx.type} of ₹${tx.amount.toLocaleString()} rejected by ${currentUser.name}. Reason: ${transactionRejectionNotes}`,
                user: currentUser.name,
                timestamp: new Date().toISOString()
            };
            onUpdateActivity(activity);
            addToast(`${tx.type} rejected`, 'success');
            closeApproveRejectDrawer();
            await refreshData();
            await fetchTransactions?.(true);
        } catch (error: any) {
            console.error('Error rejecting transaction:', error);
            addToast(error.message || 'Failed to reject transaction', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Helper: render transaction details for drawers (modern layout)
    const renderTransactionDetails = (tx: Transaction) => {
        const linkedInvoice = tx.invoice_id ? (invoices || []).find(inv => inv.id === tx.invoice_id) : null;
        const excelBillDisplay = tx.reference_id || '—';
        const DetailRow = ({ label, value, valueClassName = 'text-slate-900 font-medium' }: { label: string; value: React.ReactNode; valueClassName?: string }) => (
            <div className="flex justify-between items-baseline gap-4 py-2.5 border-b border-slate-100 last:border-b-0">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider shrink-0">{label}</span>
                <span className={`text-sm text-right truncate ${valueClassName}`}>{value}</span>
            </div>
        );
        return (
            <div className="space-y-1">
                <DetailRow
                    label="Amount"
                    value={<span className={tx.type === TransactionType.Income ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>{tx.type === TransactionType.Income ? '+' : '−'}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>}
                />
                <DetailRow label="Date" value={new Date(tx.recorded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
                <DetailRow label="Payment Method" value={tx.payment_method} />
                {tx.type === TransactionType.Income && (
                    <DetailRow label="Link to Invoice" value={linkedInvoice ? `${linkedInvoice.invoice_number} (₹${linkedInvoice.total_amount?.toLocaleString()})` : 'No invoice linked'} />
                )}
                <DetailRow label="Excel Bill No." value={excelBillDisplay} />
                <DetailRow label="Receipt No." value={tx.receipt_no || '—'} />
                {tx.receipt_url && (
                    <DetailRow
                        label="Receipt"
                        value={<a href={tx.receipt_url} target="_blank" rel="noopener noreferrer" className="text-[#191974] hover:underline font-medium">View receipt</a>}
                    />
                )}
                <div className="pt-2.5 border-b border-slate-100">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1.5">Description</span>
                    <p className="text-sm text-slate-800 leading-relaxed">{tx.description || '—'}</p>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-slate-500">Loading costing data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Financial Summary - Total Amount, Total Payments Made, Total Due, Total Expenses */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-slate-500">Total Amount</p>
                        {isSuperAdmin && hasCosting && (
                            <div className="flex items-center gap-2">
                                {canEditCosting && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                        title="Edit Costing"
                                    >
                                        <IconPencil className="w-4 h-4" />
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (isSuperAdmin) {
                                            setShowDeleteModal(true);
                                        } else {
                                            addToast('Only Super Admin can delete costing', 'error');
                                        }
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                    title="Delete Costing (Super Admin Only)"
                                >
                                    <IconTrash className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                    <p className="text-xl font-bold text-slate-900">₹{financialTotals.totalLeadCost.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-slate-500 mb-1">Total Payments Made</p>
                    <p className="text-xl font-bold text-green-600">₹{financialTotals.totalPaymentsMade.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-slate-500 mb-1">Total Due</p>
                    <p className="text-xl font-bold text-orange-600">₹{financialTotals.totalDue.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-slate-500 mb-1">Total Expenses</p>
                    <p className="text-xl font-bold text-red-600">₹{financialTotals.totalExpenses.toLocaleString('en-IN')}</p>
                </div>
            </div>

            {/* Approval Status Banner */}
            {hasTourPackage && costing && (
                <div className={`p-4 rounded-lg border ${isApproved ? 'bg-emerald-50 border-emerald-200' :
                    isRejected ? 'bg-red-50 border-red-200' :
                        'bg-yellow-50 border-yellow-200'
                    }`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`font-semibold ${isApproved ? 'text-emerald-900' :
                                isRejected ? 'text-red-900' :
                                    'text-yellow-900'
                                }`}>
                                {isApproved ? '✓ Approved' : isRejected ? '✗ Rejected' : '⏳ Pending Approval'}
                            </p>
                            {isApproved && costing.approved_by_staff_id && (
                                <p className="text-sm text-emerald-700 mt-1">
                                    Approved by {staff.find(s => s.id === costing.approved_by_staff_id)?.name || 'Unknown'} on {costing.approved_at ? new Date(costing.approved_at).toLocaleDateString() : ''}
                                </p>
                            )}
                            {isRejected && (
                                <>
                                    <p className="text-sm text-red-700 mt-1">
                                        Rejected by {staff.find(s => s.id === costing.rejected_by_staff_id)?.name || 'Unknown'} on {costing.rejected_at ? new Date(costing.rejected_at).toLocaleDateString() : ''}
                                    </p>
                                    {costing.rejection_notes && (
                                        <p className="text-sm text-red-600 mt-2 font-medium">Reason: {costing.rejection_notes}</p>
                                    )}
                                </>
                            )}
                        </div>
                        {canApprove && requiresApproval && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleApprove}
                                    disabled={isSaving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-slate-400"
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => setShowRejectionModal(true)}
                                    disabled={isSaving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-slate-400"
                                >
                                    Reject
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Itemized costing section removed as per new design.
                We now only show financial summary cards (Total Payments, Due, Expenses, etc.). */}

            {/* Record Payment/Expense Section - Inline forms */}
            {customer && (
                <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-800">Record Transaction</h3>
                        <div className="relative" ref={transactionMenuRef}>
                            {!showPaymentForm && !showExpenseForm && (
                                <>
                                    <button
                                        onClick={() => setShowTransactionMenu(!showTransactionMenu)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md border border-blue-200"
                                        title="Record Payment or Expense"
                                    >
                                        <IconPlus className="w-5 h-5" />
                                    </button>
                                    {showTransactionMenu && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border z-20">
                                            <button
                                                onClick={() => {
                                                    setPaymentType(TransactionType.Income);
                                                    setShowPaymentForm(true);
                                                    setShowTransactionMenu(false);
                                                    const leadInvoices = (invoices || []).filter(inv => inv.lead_id === lead.id);
                                                    if (leadInvoices.length === 1) setSelectedInvoiceId(leadInvoices[0].id);
                                                    else setSelectedInvoiceId(null);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 rounded-t-md"
                                            >
                                                Record Income
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setPaymentType(TransactionType.Expense);
                                                    setShowExpenseForm(true);
                                                    setShowTransactionMenu(false);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 rounded-b-md"
                                            >
                                                Record Expense
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Payment/Expense Form */}
                    {(showPaymentForm || showExpenseForm) && (
                        <div className="border-t pt-4 mt-4">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-slate-700">
                                    {paymentType === TransactionType.Income ? 'Record Income' : 'Record Expense'}
                                </h4>
                                <button
                                    onClick={() => {
                                        setShowPaymentForm(false);
                                        setShowExpenseForm(false);
                                        setTransactionAmount('');
                                        setTransactionRef('');
                                        setReceiptNo('');
                                        setTransactionDescription('');
                                        setReceiptFile(null);
                                        setSelectedSupplierId(null);
                                        setSelectedInvoiceId(null);
                                    }}
                                    className="p-1 text-slate-500 hover:bg-slate-100 rounded"
                                >
                                    <IconX className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-slate-500 block mb-1">
                                        Amount {paymentType === TransactionType.Income ? 'Received' : ''} *
                                    </label>
                                    <input
                                        type="number"
                                        value={transactionAmount}
                                        onChange={(e) => setTransactionAmount(parseFloat(e.target.value) || '')}
                                        className="w-full p-2 border rounded-md text-sm"
                                        placeholder="0.00"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 block mb-1">Date *</label>
                                    <input
                                        type="date"
                                        value={transactionDate}
                                        onChange={(e) => setTransactionDate(e.target.value)}
                                        className="w-full p-2 border rounded-md text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 block mb-1">Payment Method *</label>
                                    <select
                                        value={transactionMethod}
                                        onChange={(e) => setTransactionMethod(e.target.value as PaymentMethod)}
                                        className="w-full p-2 border rounded-md text-sm"
                                    >
                                        <option value={PaymentMethod.BankTransfer}>Bank Transfer</option>
                                        <option value={PaymentMethod.UPI}>UPI</option>
                                        <option value={PaymentMethod.Cash}>Cash</option>
                                        <option value={PaymentMethod.Other}>Other</option>
                                    </select>
                                </div>
                                {paymentType === TransactionType.Income && (
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 block mb-1">
                                            Link to Invoice (Optional)
                                        </label>
                                        <select
                                            value={selectedInvoiceId || ''}
                                            onChange={(e) => setSelectedInvoiceId(e.target.value ? parseInt(e.target.value) : null)}
                                            className="w-full p-2 border rounded-md text-sm"
                                        >
                                            <option value="">No invoice (General payment)</option>
                                            {(invoices || []).filter(inv => inv.lead_id === lead.id).map(inv => (
                                                <option key={inv.id} value={inv.id}>
                                                    {inv.invoice_number} - ₹{inv.total_amount.toLocaleString()} (Due: ₹{inv.balance_due.toLocaleString()})
                                                </option>
                                            ))}
                                        </select>
                                        {selectedInvoiceId && (
                                            <p className="text-xs text-blue-600 mt-1">
                                                This payment will be recorded in the invoice after approval
                                            </p>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs font-medium text-slate-500 block mb-1">
                                        Excel Bill No. (Optional)
                                    </label>
                                    <div className="flex rounded-md border border-slate-300 bg-white">
                                        <span className="inline-flex items-center px-3 text-sm text-slate-600 bg-slate-100 border-r border-slate-300 rounded-l-md select-none">
                                            RC-
                                        </span>
                                        <input
                                            type="text"
                                            value={transactionRef}
                                            onChange={(e) => setTransactionRef(e.target.value)}
                                            className="flex-1 min-w-0 p-2 border-0 rounded-r-md text-sm focus:ring-0 focus:outline-none"
                                            placeholder="Enter number"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 block mb-1">
                                        Receipt No. (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={receiptNo}
                                        onChange={(e) => setReceiptNo(e.target.value)}
                                        className="w-full p-2 border rounded-md text-sm"
                                        placeholder="Enter receipt number (no prefix)"
                                    />
                                </div>
                                {(transactionMethod === PaymentMethod.BankTransfer || transactionMethod === PaymentMethod.UPI) && (
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-slate-500 block mb-1">Receipt (Optional)</label>
                                        <input
                                            type="file"
                                            accept="image/*,.pdf"
                                            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                                            className="w-full p-2 border rounded-md text-sm"
                                        />
                                    </div>
                                )}
                                {paymentType === TransactionType.Expense && (
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-medium text-slate-500 block mb-1">Supplier (Optional)</label>
                                        <select
                                            value={selectedSupplierId || ''}
                                            onChange={(e) => setSelectedSupplierId(e.target.value ? parseInt(e.target.value) : null)}
                                            className="w-full p-2 border rounded-md text-sm"
                                        >
                                            <option value="">Select Supplier</option>
                                            {suppliers.filter(s => s.status === 'Active').map(supplier => (
                                                <option key={supplier.id} value={supplier.id}>
                                                    {supplier.company_name}
                                                </option>
                                            ))}
                                        </select>
                                        {selectedSupplierId && (() => {
                                            const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
                                            return selectedSupplier ? (
                                                <div className="flex items-center gap-2 mt-2 p-2 bg-slate-50 rounded-md">
                                                    <img
                                                        src={selectedSupplier.contact_person_avatar_url || '/default-avatar.png'}
                                                        alt={selectedSupplier.contact_person_name}
                                                        className="w-8 h-8 rounded-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = '/default-avatar.png';
                                                        }}
                                                    />
                                                    <div>
                                                        <p className="text-xs font-medium text-slate-800">{selectedSupplier.company_name}</p>
                                                        <p className="text-xs text-slate-500">{selectedSupplier.contact_person_name}</p>
                                                    </div>
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>
                                )}
                                <div className="md:col-span-2">
                                    <label className="text-xs font-medium text-slate-500 block mb-1">Description</label>
                                    <textarea
                                        value={transactionDescription}
                                        onChange={(e) => setTransactionDescription(e.target.value)}
                                        className="w-full p-2 border rounded-md text-sm"
                                        rows={2}
                                        placeholder={`Enter ${paymentType === TransactionType.Income ? 'payment' : 'expense'} description`}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button
                                    onClick={() => {
setShowPaymentForm(false);
                                    setShowExpenseForm(false);
                                    setTransactionAmount('');
                                    setTransactionRef('');
                                    setReceiptNo('');
                                    setTransactionDescription('');
                                    setReceiptFile(null);
                                    setSelectedSupplierId(null);
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRecordTransaction}
                                    disabled={isRecordingTransaction || !transactionAmount || transactionAmount <= 0}
                                    className={`px-4 py-2 text-sm font-medium text-white rounded-md ${paymentType === TransactionType.Income
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                        } disabled:bg-slate-400`}
                                >
                                    {isRecordingTransaction ? 'Recording...' : `Record ${paymentType === TransactionType.Income ? 'Income' : 'Expense'}`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Transactions List with Approve/Reject */}
            {leadTransactions.length > 0 && (
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Transactions</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left bg-slate-50">
                                <tr>
                                    <th className="p-3 font-medium text-slate-700">Date</th>
                                    <th className="p-3 font-medium text-slate-700">Type</th>
                                    <th className="p-3 font-medium text-slate-700">Description</th>
                                    <th className="p-3 font-medium text-slate-700">Method</th>
                                    <th className="p-3 font-medium text-slate-700 text-right">Amount (₹)</th>
                                    <th className="p-3 font-medium text-slate-700">Status</th>
                                    <th className="p-3 font-medium text-slate-700">Recorded By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {leadTransactions.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()).map((transaction) => {
                                    const recordedBy = staff.find(s => s.id === transaction.recorded_by_staff_id);
                                    const approvedBy = transaction.approved_by_staff_id ? staff.find(s => s.id === transaction.approved_by_staff_id) : null;
                                    const rejectedBy = transaction.rejected_by_staff_id ? staff.find(s => s.id === transaction.rejected_by_staff_id) : null;
                                    const isPending = transaction.status === TransactionApprovalStatus.Pending;

                                    return (
                                        <tr
                                            key={transaction.id}
                                            className="border-b hover:bg-slate-50 cursor-pointer"
                                            onClick={() => setTransactionDetailDrawer(transaction)}
                                        >
                                            <td className="p-3 text-slate-600">
                                                {new Date(transaction.recorded_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${transaction.type === TransactionType.Income
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {transaction.type}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-600 max-w-xs truncate" title={transaction.description}>
                                                {transaction.description}
                                            </td>
                                            <td className="p-3 text-slate-600">{transaction.payment_method}</td>
                                            <td className="p-3 text-right font-semibold">
                                                {transaction.type === TransactionType.Income ? (
                                                    <span className="text-green-600">+₹{transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                ) : (
                                                    <span className="text-red-600">-₹{transaction.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${transaction.status === TransactionApprovalStatus.Approved
                                                    ? 'bg-green-100 text-green-700'
                                                    : transaction.status === TransactionApprovalStatus.Rejected
                                                        ? 'bg-red-100 text-red-700'
                                                        : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {transaction.status}
                                                </span>
                                                {approvedBy && (
                                                    <p className="text-xs text-slate-500 mt-1">Approved by {approvedBy.name}</p>
                                                )}
                                                {rejectedBy && transaction.rejection_notes && (
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        <p>Rejected by {rejectedBy.name}</p>
                                                        <p className="text-red-600">Reason: {transaction.rejection_notes}</p>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 text-slate-600">
                                                {recordedBy?.name || 'Unknown'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Transaction Detail Drawer — smooth open/close like Lead drawer */}
            {transactionDetailDrawer && (
                <>
                    <div
                        className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ease-out ${transactionDetailDrawerClosing ? 'opacity-0' : 'opacity-40'}`}
                        onClick={closeTransactionDetailDrawer}
                        aria-hidden="true"
                    />
                    <div
                        className={`fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ease-out ${!transactionDetailDrawerClosing ? 'translate-x-0' : 'translate-x-full'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
                            <h3 className="text-lg font-semibold text-slate-800">Transaction Details</h3>
                            <button type="button" onClick={closeTransactionDetailDrawer} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
                            <div className="px-5 py-4">
                                <div className="flex items-center gap-2 mb-5">
                                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide ${transactionDetailDrawer.type === TransactionType.Income ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {transactionDetailDrawer.type}
                                    </span>
                                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide ${transactionDetailDrawer.status === TransactionApprovalStatus.Approved ? 'bg-emerald-100 text-emerald-700' : transactionDetailDrawer.status === TransactionApprovalStatus.Rejected ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {transactionDetailDrawer.status}
                                    </span>
                                </div>
                                {renderTransactionDetails(transactionDetailDrawer)}
                            </div>
                        </div>
                        {/* Floating Approve / Reject bar at bottom of visible screen, 0 margin */}
                        {canApprove && transactionDetailDrawer.status === TransactionApprovalStatus.Pending && (
                            <div className="shrink-0 w-full bg-white border-t border-slate-200 p-4 pb-4 mt-auto" style={{ marginBottom: 0 }}>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeTransactionDetailDrawer();
                                            setApproveRejectDrawer({ action: 'approve', transaction: transactionDetailDrawer });
                                            setApprovalReceiptNo(transactionDetailDrawer.receipt_no || '');
                                            setApprovalExcelBillNo((transactionDetailDrawer.reference_id || '').replace(/^RC-/i, ''));
                                        }}
                                        disabled={isSaving}
                                        className="flex-1 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            closeTransactionDetailDrawer();
                                            setApproveRejectDrawer({ action: 'reject', transaction: transactionDetailDrawer });
                                            setApprovalReceiptNo(transactionDetailDrawer.receipt_no || '');
                                            setApprovalExcelBillNo((transactionDetailDrawer.reference_id || '').replace(/^RC-/i, ''));
                                            setTransactionRejectionNotes('');
                                        }}
                                        disabled={isSaving}
                                        className="flex-1 py-3 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Approve / Reject Transaction Drawer — smooth open/close */}
            {approveRejectDrawer && (
                <>
                    <div
                        className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ease-out ${approveRejectDrawerClosing ? 'opacity-0' : 'opacity-40'}`}
                        onClick={closeApproveRejectDrawer}
                        aria-hidden="true"
                    />
                    <div
                        className={`fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ease-out ${!approveRejectDrawerClosing ? 'translate-x-0' : 'translate-x-full'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
                            <h3 className="text-lg font-semibold text-slate-800">
                                {approveRejectDrawer.action === 'approve' ? 'Approve Transaction' : 'Reject Transaction'}
                            </h3>
                            <button type="button" onClick={closeApproveRejectDrawer} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
                            <div className="px-5 py-4 space-y-4">
                                {renderTransactionDetails(approveRejectDrawer.transaction)}
                                {approveRejectDrawer.action === 'approve' ? (
                                    <div className="border-t border-slate-200 pt-4 mt-4">
                                        <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-3">Required before approving</p>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1.5">Excel Bill No. (RC-) *</label>
                                                <div className="flex rounded-lg border border-slate-300 bg-white overflow-hidden">
                                                    <span className="inline-flex items-center px-3 text-sm text-slate-600 bg-slate-100 border-r border-slate-300 select-none">RC-</span>
                                                    <input
                                                        type="text"
                                                        value={approvalExcelBillNo}
                                                        onChange={(e) => setApprovalExcelBillNo(e.target.value)}
                                                        className="flex-1 min-w-0 p-2.5 border-0 text-sm focus:ring-0 focus:outline-none"
                                                        placeholder="Enter number (required)"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1.5">Receipt No. *</label>
                                                <input
                                                    type="text"
                                                    value={approvalReceiptNo}
                                                    onChange={(e) => setApprovalReceiptNo(e.target.value)}
                                                    className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#191974]/20 focus:border-[#191974]"
                                                    placeholder="Enter receipt number (required)"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border-t border-slate-200 pt-4 mt-4">
                                        <p className="text-xs font-medium text-slate-600 uppercase tracking-wider mb-3">Reason for rejection (required)</p>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1.5">Reason for rejection *</label>
                                            <textarea
                                                value={transactionRejectionNotes}
                                                onChange={(e) => setTransactionRejectionNotes(e.target.value)}
                                                placeholder="Enter rejection reason..."
                                                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm min-h-[88px] focus:ring-2 focus:ring-[#191974]/20 focus:border-[#191974]"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="shrink-0 p-4 border-t border-slate-200 flex gap-3 justify-end bg-white" style={{ marginBottom: 0 }}>
                            <button
                                type="button"
                                onClick={closeApproveRejectDrawer}
                                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            {approveRejectDrawer.action === 'approve' ? (
                                <button
                                    type="button"
                                    onClick={confirmApproveFromDrawer}
                                    disabled={isSaving || !approvalExcelBillNo.trim() || !approvalReceiptNo.trim()}
                                    className="px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                >
                                    {isSaving ? 'Approving...' : 'Confirm Approve'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={confirmRejectFromDrawer}
                                    disabled={isSaving || !transactionRejectionNotes.trim()}
                                    className="px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                    {isSaving ? 'Rejecting...' : 'Confirm Reject'}
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Rejection Modal */}
            {showRejectionModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Reject Costing</h3>
                        <p className="text-sm text-slate-600 mb-4">Please provide a reason for rejecting this costing:</p>
                        <textarea
                            value={rejectionNotes}
                            onChange={(e) => setRejectionNotes(e.target.value)}
                            placeholder="Enter rejection reason..."
                            className="w-full p-3 border rounded-md min-h-[100px] mb-4"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowRejectionModal(false);
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

            {/* Delete Confirmation Modal - Only for Super Admin */}
            {showDeleteModal && isSuperAdmin && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Delete Costing</h3>
                        <p className="text-sm text-slate-600 mb-4">
                            Are you sure you want to permanently delete this costing? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteCosting}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-slate-400"
                            >
                                {isSaving ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transaction Rejection Modal */}
            {showTransactionRejectionModal && transactionToReject && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Reject Transaction</h3>
                        <p className="text-sm text-slate-600 mb-4">Please provide a reason for rejecting this {transactionToReject.type.toLowerCase()}:</p>
                        <textarea
                            value={transactionRejectionNotes}
                            onChange={(e) => setTransactionRejectionNotes(e.target.value)}
                            placeholder="Enter rejection reason..."
                            className="w-full p-3 border rounded-md min-h-[100px] mb-4"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    setShowTransactionRejectionModal(false);
                                    setTransactionRejectionNotes('');
                                    setTransactionToReject(null);
                                }}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRejectTransaction}
                                disabled={isSaving || !transactionRejectionNotes.trim()}
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
