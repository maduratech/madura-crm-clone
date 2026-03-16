import { supabase } from './supabase';
import { InvoiceStatus } from '../types';

/**
 * Recalculates invoice balance and status based on all paid payments.
 * This is the single source of truth for invoice balance calculations.
 * 
 * @param invoiceId - The ID of the invoice to recalculate
 * @returns Promise<void>
 */
export async function recalculateInvoiceBalance(invoiceId: number): Promise<void> {
  try {
    // 1. Get all paid payments for this invoice
    const { data: paidPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount')
      .eq('invoice_id', invoiceId)
      .eq('status', 'Paid');

    if (paymentsError) {
      throw new Error(`Failed to fetch payments: ${paymentsError.message}`);
    }

    const totalPaid = (paidPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    // 2. Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('total_amount, due_date, status')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) {
      throw new Error(`Failed to fetch invoice: ${invoiceError.message}`);
    }

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const balanceDue = invoice.total_amount - totalPaid;

    // 3. Determine new status
    let newStatus: InvoiceStatus;
    if (balanceDue <= 0) {
      newStatus = InvoiceStatus.Paid;
    } else if (totalPaid > 0) {
      newStatus = InvoiceStatus.PartiallyPaid;
    } else {
      // Check if overdue
      const dueDate = new Date(invoice.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        newStatus = InvoiceStatus.Overdue;
      } else {
        // Use existing status if it's Draft/Invoiced/Sent, otherwise default to Invoiced
        const currentStatus = invoice.status as InvoiceStatus;
        if ([InvoiceStatus.Draft, InvoiceStatus.Invoiced, InvoiceStatus.Sent].includes(currentStatus)) {
          newStatus = currentStatus;
        } else {
          newStatus = InvoiceStatus.Invoiced;
        }
      }
    }

    // 4. Update invoice
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        balance_due: balanceDue,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    if (updateError) {
      throw new Error(`Failed to update invoice: ${updateError.message}`);
    }
  } catch (error: any) {
    console.error(`Error recalculating invoice balance for invoice ${invoiceId}:`, error);
    throw error;
  }
}
