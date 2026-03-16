import React, { useMemo } from 'react';
import { Invoice, Customer, Branch, Lead } from '../types';
import { MADURA_TRAVEL_BANK_DETAILS, MADURA_TRAVEL_COMPANY_HEADER } from '../constants';

interface PrintableInvoiceProps {
    invoice: Invoice;
    customer: Customer;
    branch: Branch;
    lead: Lead | null;
    /** Razorpay link for QR: invoice-specific or HQ (branch 1) default. Pass from parent. */
    payUrl?: string;
}

const numberToWords = (num: number): string => {
    const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
    const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const s = Math.floor(num).toString();
    if (s.length > 9) return 'overflow';
    const n = ('000000000' + s).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (parseInt(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
    str += (parseInt(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
    str += (parseInt(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
    str += (parseInt(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
    str += (parseInt(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    str = str.trim();
    if (str === '') return 'Zero';
    return str.charAt(0).toUpperCase() + str.slice(1) + ' Only';
};

export const PrintableInvoice = React.forwardRef<HTMLDivElement, PrintableInvoiceProps>(({ invoice, customer, branch, lead, payUrl: payUrlProp }, ref) => {
    const payUrl = invoice.razorpay_payment_link_url || payUrlProp || (branch?.id === 1 ? branch?.razorpay_link : '') || '';

    // When balance_due is missing, treat as nothing paid (balance due = total)
    const invoiceTotal = invoice.total_amount || 0;
    const balanceDue = invoice.balance_due ?? invoiceTotal;
    const amountPaid = Math.max(0, invoiceTotal - balanceDue);

    const { subtotal, cgst, sgst, tcs, total, discount_amount, gst_percentage } = useMemo(() => {
        const sub = (invoice.items || []).reduce((acc, item) => acc + item.amount, 0);
        const discount = invoice.discount_amount || 0;
        const subAfterDiscount = sub - discount;
        const gstPercent = invoice.gst_percentage || 5;
        const calculatedGst = subAfterDiscount * (gstPercent / 100);

        return {
            subtotal: sub,
            cgst: invoice.cgst_amount ?? calculatedGst / 2,
            sgst: invoice.sgst_amount ?? calculatedGst / 2,
            tcs: invoice.tcs_amount || 0,
            total: invoice.total_amount || 0,
            discount_amount: discount,
            gst_percentage: gstPercent,
        };
    }, [invoice]);

    const description = useMemo(() => {
        if (lead) {
            // FIX: Changed property access from 'infants' to 'babies' to align with the 'Lead' type definition in types.ts.
            const travelers = (lead.requirements?.adults || 0) + (lead.requirements?.children || 0) + (lead.requirements?.babies || 0);
            return `${lead.destination} - ${travelers} Travelers - ${lead.duration} - Ref No. ${lead.id}`;
        }
        return invoice.items?.[0]?.description || 'Tour Package';
    }, [lead, invoice.items]);

    const defaultTerms = useMemo(() => {
        if (branch.terms_and_conditions && branch.terms_and_conditions.length > 0) {
            return branch.terms_and_conditions.find(tc => tc.is_default)?.content || branch.terms_and_conditions[0].content;
        }
        return "All Cheques / Drafts in payment of bills must be crossed 'A/c Payee Only' and drawn in favour of 'MADURA TRAVEL SERVICE (P) LTD.'.";
    }, [branch.terms_and_conditions]);


    return (
        <div className="overflow-x-auto max-w-full print:overflow-visible print:max-w-none -mx-2 sm:mx-0">
            <div ref={ref} className="bg-white p-6 sm:p-10 font-sans text-xs mx-auto" style={{ width: '210mm', minHeight: '297mm', position: 'relative' }}>
            {/* Header */}
            <header className="flex justify-between items-start pb-4 border-b">
                <div>
                    {branch.logo_url && <img src={branch.logo_url} alt="Company Logo" className="h-16 w-auto mb-2" />}
                    <h1 className="font-bold text-lg">MADURA TRAVEL SERVICE (P) LTD.</h1>
                    <p>{MADURA_TRAVEL_COMPANY_HEADER.addressLine1}</p>
                    <p>{MADURA_TRAVEL_COMPANY_HEADER.addressLine2}</p>
                    <p>Tel : {MADURA_TRAVEL_COMPANY_HEADER.tel}</p>
                    <p>Email : {MADURA_TRAVEL_COMPANY_HEADER.email} &nbsp; URL : {MADURA_TRAVEL_COMPANY_HEADER.url}</p>
                    <p>PAN : {MADURA_TRAVEL_COMPANY_HEADER.pan}</p>
                    <p>GSTIN : {MADURA_TRAVEL_COMPANY_HEADER.gstin}</p>
                </div>
                <div className="text-right shrink-0">
                    <h2 className="text-2xl font-bold uppercase text-gray-700">Tax Invoice</h2>
                    <p><span className="font-semibold">Invoice #:</span> {invoice.invoice_number}</p>
                    <p><span className="font-semibold">IATA No.:</span> 14:3:36420</p>
                    <p><span className="font-semibold">Date:</span> {new Date(invoice.issue_date).toLocaleDateString()}</p>
                    <p><span className="font-semibold">Due Date:</span> {new Date(invoice.due_date).toLocaleDateString()}</p>
                </div>
            </header>

            {/* Bill To */}
            <section className="my-8">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <h3 className="font-semibold text-gray-500 uppercase tracking-wider mb-1">Bill To</h3>
                        <p className="font-bold">{invoice.billing_name || `${customer.first_name} ${customer.last_name}`}</p>
                        {(invoice.billing_address && invoice.billing_address.trim()) ? (
                            <p className="whitespace-pre-line">{invoice.billing_address.trim()}</p>
                        ) : customer.address ? (
                            <p>{[customer.address.street, customer.address.city, customer.address.state, customer.address.country].filter(Boolean).join(', ')}{customer.address.zip ? ` - ${customer.address.zip}` : ''}</p>
                        ) : null}
                        <p>{customer.email}</p>
                        <p>{customer.phone}</p>
                    </div>
                    <div className="text-right">
                        <h3 className="font-semibold text-gray-500 uppercase tracking-wider mb-1">Place of Supply</h3>
                        <p>TAMIL NADU (33)</p>
                    </div>
                </div>
            </section>

            {/* Items Table */}
            <section>
                <table className="w-full text-left">
                    <thead className="bg-[#042f2e] text-white">
                        <tr>
                            <th className="p-2 w-10">#</th>
                            <th className="p-2">Narration / Description</th>
                            <th className="p-2 w-20 text-right">Qty</th>
                            <th className="p-2 w-28 text-right">Rate</th>
                            <th className="p-2 w-28 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b">
                            <td className="p-2">1</td>
                            <td className="p-2">{description}</td>
                            <td className="p-2 text-right">1.00</td>
                            <td className="p-2 text-right">{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="p-2 text-right">{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
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
                        <span className="text-sm font-semibold text-slate-700 mt-2">Scan/Click to pay</span>
                    </div>
                ) : null}
                <div className="w-1/2 min-w-[200px] space-y-2 ml-auto">
                    <div className="flex justify-between">
                        <span className="font-semibold">Sub Total</span>
                        <span>₹ {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {discount_amount > 0 && (
                        <div className="flex justify-between text-red-600">
                            <span>Discount</span>
                            <span>(-) ₹ {discount_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {cgst > 0 && (
                        <div className="flex justify-between">
                            <span>CGST ({gst_percentage / 2}%)</span>
                            <span>₹ {cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {sgst > 0 && (
                        <div className="flex justify-between">
                            <span>SGST ({gst_percentage / 2}%)</span>
                            <span>₹ {sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {tcs > 0 && (
                        <div className="flex justify-between">
                            <span>TCS (5%)</span>
                            <span>₹ {tcs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    {(invoice.round_off != null && invoice.round_off !== 0) && (
                        <div className={`flex justify-between ${invoice.round_off >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            <span>Round off</span>
                            <span>₹ {invoice.round_off >= 0 ? '+' : ''}{invoice.round_off.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    <hr />
                    <div className="flex justify-between font-bold text-base">
                        <span>Total Amount</span>
                        <span>₹ {total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    {amountPaid > 0 && (
                        <div className="flex justify-between text-red-600">
                            <span>Amount Paid</span>
                            <span>(-) ₹ {amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    )}
                    <div className="flex justify-between p-2 bg-gray-100 rounded-md font-bold text-lg">
                        <span>Balance Due</span>
                        <span>₹ {balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </section>

            {/* Amount in Words */}
            <section className="my-8 p-2 bg-gray-100">
                <span className="font-semibold mr-2">Amount in Words:</span>
                <span>{numberToWords(invoice.total_amount || 0)}</span>
            </section>


            {/* Footer */}
            <footer className="mt-8 pt-4 border-t absolute bottom-10 w-[calc(100%-5rem)]">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-bold mb-1">Bank Details</h4>
                        <p><span className="font-semibold">Bank:</span> {MADURA_TRAVEL_BANK_DETAILS.bankName}</p>
                        <p><span className="font-semibold">Account type:</span> {MADURA_TRAVEL_BANK_DETAILS.accountType}</p>
                        <p><span className="font-semibold">Account holder Name:</span> {MADURA_TRAVEL_BANK_DETAILS.accountHolderName}</p>
                        <p><span className="font-semibold">Branch:</span> {MADURA_TRAVEL_BANK_DETAILS.branch}</p>
                        <p><span className="font-semibold">Account no:</span> {MADURA_TRAVEL_BANK_DETAILS.accountNumber}</p>
                        <p><span className="font-semibold">IFSC Code:</span> {MADURA_TRAVEL_BANK_DETAILS.ifscCode}</p>
                        <p><span className="font-semibold">SWIFT Code:</span> {MADURA_TRAVEL_BANK_DETAILS.swiftCode}</p>
                    </div>
                    <div className="text-right">
                        <h4 className="font-bold mb-1">For MADURA TRAVEL SERVICE (P) LTD.</h4>
                        {(invoice.is_signed && branch.seal_signature_url) ? (
                            <div className="h-20 flex items-center justify-end mb-1 mt-1">
                                <img
                                    src={branch.seal_signature_url}
                                    alt="Seal with Signature"
                                    className="h-16 w-auto object-contain inline-block"
                                />
                            </div>
                        ) : (
                            <div className="h-16 mb-1 mt-2"></div>
                        )}
                        <p className="border-t pt-1">Authorised Signatory</p>
                    </div>
                </div>
                <div className="mt-4 pt-2 border-t">
                    <h4 className="font-bold mb-1">Terms & Conditions</h4>
                    <div
                        className="text-xs prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_p]:m-0"
                        dangerouslySetInnerHTML={{ __html: defaultTerms }}
                    />
                </div>
            </footer>
            {invoice.is_signed && (
                <div className="mt-2 text-center text-[10px] text-slate-500">
                    This invoice has been digitally signed by MADURA TRAVEL SERVICE (P) LTD.
                </div>
            )}
            </div>
        </div>
    );
});