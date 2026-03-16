
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Branch, Address, Lead, Customer, Staff, LoggedInUser, BankDetails, TermsAndConditions } from '../types';
import { IconSearch, IconPlus, IconX, IconPencil, IconTrash, IconChevronDown, IconCheckCircle } from '../constants';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { useData } from '../contexts/DataProvider';

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

const AssociatedLeadsList: React.FC<{ leads: Lead[], customers: Customer[] }> = ({ leads, customers }) => {
    const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

    if (leads.length === 0) {
        return <p className="text-center text-slate-500 py-4">No associated leads found.</p>;
    }

    return (
        <ul className="space-y-3">
            {leads.map(lead => {
                const customer = customerMap.get(lead.customer_id);
                return (
                    <li key={lead.id} className="p-3 bg-slate-50 rounded-md border">
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

const BankDetailModal: React.FC<{
    detail: Partial<BankDetails>;
    onSave: (detail: BankDetails) => void;
    onClose: () => void;
}> = ({ detail, onSave, onClose }) => {
    const [editedDetail, setEditedDetail] = useState<Partial<BankDetails>>(detail || { bank_name: '', branch_name: '', ifsc_code: '', account_number: '', is_default: false, gstin: '', cheque_instructions: '' });

    const handleSave = () => {
        if (!editedDetail.bank_name || !editedDetail.account_number || !editedDetail.ifsc_code) {
            alert('Please fill all required fields.');
            return;
        }
        onSave({ id: Date.now(), is_default: false, branch_name: '', gstin: '', cheque_instructions: '', ...editedDetail } as BankDetails);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-4">Bank Account Details</h3>
                <div className="space-y-4">
                    <input type="text" placeholder="Bank Name *" value={editedDetail.bank_name || ''} onChange={e => setEditedDetail(d => ({ ...d, bank_name: e.target.value }))} className="w-full p-2 border rounded" />
                    <input type="text" placeholder="Branch Name" value={editedDetail.branch_name || ''} onChange={e => setEditedDetail(d => ({ ...d, branch_name: e.target.value }))} className="w-full p-2 border rounded" />
                    <input type="text" placeholder="Account Number *" value={editedDetail.account_number || ''} onChange={e => setEditedDetail(d => ({ ...d, account_number: e.target.value }))} className="w-full p-2 border rounded" />
                    <input type="text" placeholder="IFSC Code *" value={editedDetail.ifsc_code || ''} onChange={e => setEditedDetail(d => ({ ...d, ifsc_code: e.target.value }))} className="w-full p-2 border rounded" />
                    <input type="text" placeholder="GSTIN (e.g., 33AACCM4908J1ZJ (TAMILNADU))" value={editedDetail.gstin || ''} onChange={e => setEditedDetail(d => ({ ...d, gstin: e.target.value }))} className="w-full p-2 border rounded" />
                    <textarea placeholder="Cheque Instructions (e.g., All cheques / demand drafts in payment of bills must be crossed 'A/c Payee Only' and drawn in favour of 'MADURA TRAVEL SERVICE (P) LTD.'.)" value={editedDetail.cheque_instructions || ''} onChange={e => setEditedDetail(d => ({ ...d, cheque_instructions: e.target.value }))} className="w-full p-2 border rounded" rows={3} />
                    <label className="flex items-center gap-2"><input type="checkbox" checked={editedDetail.is_default || false} onChange={e => setEditedDetail(d => ({ ...d, is_default: e.target.checked }))} className="h-4 w-4" /> Set as default</label>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm rounded-md bg-[#191974] text-white">Save</button>
                </div>
            </div>
        </div>
    );
};

// WysiwygEditor component for rich text editing
const WysiwygEditor: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (editorRef.current && value !== editorRef.current.innerHTML) {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    const applyCommand = (command: string, value: string | null = null) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
    };

    const handleToolbarMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
    };

    return (
        <div className="border border-slate-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500">
            <div className="flex items-center gap-2 p-2 border-b bg-slate-50 rounded-t-md" onMouseDown={handleToolbarMouseDown}>
                <button type="button" onClick={() => applyCommand('bold')} className="px-2 py-1 text-sm font-bold hover:bg-slate-200 rounded" title="Bold">B</button>
                <button type="button" onClick={() => applyCommand('italic')} className="px-2 py-1 text-sm italic hover:bg-slate-200 rounded" title="Italic">I</button>
                <button type="button" onClick={() => applyCommand('underline')} className="px-2 py-1 text-sm underline hover:bg-slate-200 rounded" title="Underline">U</button>
                <button type="button" onClick={() => applyCommand('insertUnorderedList')} className="px-2 py-1 text-sm hover:bg-slate-200 rounded" title="Bullet List">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
                <button type="button" onClick={() => applyCommand('insertOrderedList')} className="px-2 py-1 text-sm hover:bg-slate-200 rounded" title="Numbered List">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
                <label className="flex items-center gap-1 text-sm cursor-pointer hover:bg-slate-200 p-1 rounded">
                    A
                    <input type="color" onChange={(e) => applyCommand('foreColor', e.target.value)} className="w-5 h-5 border-none bg-transparent cursor-pointer" title="Text Color" />
                </label>
                <label className="flex items-center gap-1 text-sm cursor-pointer hover:bg-slate-200 p-1 rounded">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd"></path></svg>
                    <input type="color" defaultValue="#FFFF00" onChange={(e) => applyCommand('hiliteColor', e.target.value)} className="w-5 h-5 border-none bg-transparent cursor-pointer" title="Highlight Color" />
                </label>
            </div>
            <div
                ref={editorRef}
                contentEditable={true}
                onInput={(e) => onChange(e.currentTarget.innerHTML)}
                className="prose prose-sm max-w-none p-3 min-h-[200px] focus:outline-none"
            />
        </div>
    );
};

const TermsModal: React.FC<{
    terms: Partial<TermsAndConditions>;
    onSave: (terms: TermsAndConditions) => void;
    onClose: () => void;
    title?: string;
    placeholder?: string;
}> = ({ terms, onSave, onClose, title = "Terms & Conditions", placeholder = "Enter terms and conditions text..." }) => {
    const [editedTerms, setEditedTerms] = useState<Partial<TermsAndConditions>>(terms);

    const handleSave = () => {
        if (!editedTerms.content?.trim()) {
            alert('Content cannot be empty.');
            return;
        }
        onSave({ id: Date.now(), is_default: false, ...editedTerms } as TermsAndConditions);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold mb-4">{title}</h3>
                <div className="space-y-4">
                    <WysiwygEditor value={editedTerms.content || ''} onChange={(val) => setEditedTerms(d => ({ ...d, content: val }))} />
                    <label className="flex items-center gap-2"><input type="checkbox" checked={editedTerms.is_default || false} onChange={e => setEditedTerms(d => ({ ...d, is_default: e.target.checked }))} className="h-4 w-4" /> Set as default</label>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm rounded-md bg-[#191974] text-white">Save</button>
                </div>
            </div>
        </div>
    );
};

/** Default Terms & Conditions for itinerary/branch (used when adding new terms). */
const DEFAULT_TERMS_AND_CONDITIONS_HTML = `<p><strong>Terms &amp; Conditions:</strong></p><ul><li>Quoted rates are valid for one (1) day from the date of quotation ({{date}}) unless otherwise specified.</li><li>Prices are based on current tariffs and may change before confirmation; once confirmed with full payment, prices will not change except for statutory tax or supplier-imposed revisions.</li><li>Additional surcharges may apply during public holidays, peak seasons, or special events and will be informed prior to confirmation.</li><li>All rooms, flights, seats, and services are subject to availability at the time of booking and payment.</li><li>The quotation includes only the services specifically mentioned; any additional services will be charged separately with prior approval.</li><li>Cancellation and refund policies will be as per the respective airline, hotel, or service provider rules communicated at booking.</li><li>The company is not liable for services remaining unconfirmed due to non-availability or delayed/non-payment.</li><li>The final itinerary may change due to operational needs, weather, force majeure, or supplier constraints, with prior intimation where possible.</li><li>In case of third-party cancellations, reasonable assistance will be provided for refunds or alternatives as per supplier policies.</li><li>The company reserves the right to cancel bookings only under exceptional circumstances such as non-payment, suspected fraud, force majeure, or supplier non-availability, with applicable refunds.</li><li>Bookings will be processed upon receipt of full payment only.</li><li>Applicable GST (5%), TCS (5%), and any other statutory government taxes will be charged additionally on the final invoice.</li></ul>`;

const DEFAULT_WELCOME_TEMPLATE = `
<div style="font-family: Arial, sans-serif; background-color: #e2e8f0; padding: 40px;">
    <div style="max-width: 600px; margin: auto;">
        <div style="background-color: #1f2937; color: white; padding: 30px; border-radius: 12px 12px 0 0;">
            <h1 style="font-size: 28px; font-weight: bold; margin: 0;">GT HOLIDAYS</h1>
            <p style="font-size: 14px; margin: 4px 0 0; color: #cbd5e1;">Travel World Class</p>
        </div>
        <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 12px 12px;">
            <p style="font-size: 20px; margin: 0;">Vanakkam {Customer Name}!</p>
            <p style="font-size: 16px; color: #4b5563; margin-top: 4px;">Thank you for your enquiry. Your trip is in trusted hands.</p>
            
            <div style="margin-top: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <div style="padding: 16px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; border-top-left-radius: 8px; border-top-right-radius: 8px;">
                    <h2 style="font-size: 18px; font-weight: bold; margin: 0;">Summary</h2>
                </div>
                <div style="padding: 16px;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tbody>
                            <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Agent:</td><td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">{Agent Name}, {Agent Phone}</td></tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">MTS ID:</td><td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">{MTS ID}</td></tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Name:</td><td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">{Customer Full Name}</td></tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Trip To:</td><td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">{Trip Destination}</td></tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">No. of Nights:</td><td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">{Trip Duration}</td></tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Start Date:</td><td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">{Trip Start Date}</td></tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">End Date:</td><td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">{Trip End Date}</td></tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Total Adults:</td><td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">{Total Adults}</td></tr>
                            <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280;">Total Kids:</td><td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">{Total Kids}</td></tr>
                            <tr><td style="padding: 8px 0; color: #6b7280;">Kid’s Age:</td><td style="padding: 8px 0; font-weight: 600; color: #111827; text-align: right;">{Kid Ages}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div style="margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
                <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">Next Steps</h2>
                <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">Your dedicated travel agent, <strong>{Agent Name}</strong>, will get in touch with you shortly with a detailed itinerary and quotation. In the meantime, feel free to reach out to them with any questions.</p>
            </div>
        </div>
    </div>
</div>
`;

// InfoField Component for Branch Detail
const InfoField: React.FC<{ label: string; value: string | undefined; isEditing: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ label, value, isEditing, onChange }) => (
    <div>
        <label className="block text-xs font-medium text-slate-500 capitalize mb-1">{label}</label>
        {isEditing ? (
            <input
                type="text"
                value={value || ''}
                onChange={onChange}
                className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
        ) : (
            <p className="text-base text-slate-900 font-medium py-2 min-h-[40px]">{value || 'N/A'}</p>
        )}
    </div>
);

export const BranchDetailPanel: React.FC<{
    branch: Branch | null;
    leads: Lead[];
    customers: Customer[];
    onClose: () => void;
    onSave: (branch: Branch) => void;
    onToggleStatus: (branchId: number, newStatus: 'Active' | 'Inactive') => void;
    staff: Staff[];
    currentUser: LoggedInUser;
}> = ({ branch, leads, customers, onClose, onSave, onToggleStatus, staff, currentUser }) => {
    const isNew = !branch;
    const { addToast } = useToast();

    const [editedBranch, setEditedBranch] = useState<Partial<Branch>>(
        branch || {
            name: '',
            address: { street: '', city: '', state: '', zip: '', country: 'India' },
            logo_url: '',
            seal_signature_url: '',
            letterhead_image_url: '',
            front_page_image_url: '',
            final_page_image_url: '',
            primary_contact: '',
            primary_email: '',
            admin_id: undefined,
            notes: '',
            status: 'Active',
            bank_details: [],
            terms_and_conditions: [],
            cancellation_policy: [],
            welcome_email_template: DEFAULT_WELCOME_TEMPLATE,
            razorpay_link: ''
        }
    );
    const [isEditing, setIsEditing] = useState(isNew);
    const [logoPreview, setLogoPreview] = useState<string | null>(branch?.logo_url || null);
    const [letterheadPreview, setLetterheadPreview] = useState<string | null>(branch?.letterhead_image_url || null);
    const [frontPagePreview, setFrontPagePreview] = useState<string | null>(branch?.front_page_image_url || null);
    const [finalPagePreview, setFinalPagePreview] = useState<string | null>(branch?.final_page_image_url || null);
    const [sealPreview, setSealPreview] = useState<string | null>(branch?.seal_signature_url || null);
    const [activeTab, setActiveTab] = useState<'details' | 'leads' | 'templates'>('details');

    const [bankDetailToEdit, setBankDetailToEdit] = useState<Partial<BankDetails> | 'new' | null>(null);
    const [termsToEdit, setTermsToEdit] = useState<Partial<TermsAndConditions> | 'new' | null>(null);
    const [cancellationPolicyToEdit, setCancellationPolicyToEdit] = useState<Partial<TermsAndConditions> | 'new' | null>(null);
    const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
    const adminDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const initialBranch = branch || {
            name: '',
            address: { street: '', city: '', state: '', zip: '', country: 'India' },
            logo_url: '',
            seal_signature_url: '',
            letterhead_image_url: '',
            front_page_image_url: '',
            final_page_image_url: '',
            primary_contact: '',
            primary_email: '',
            admin_id: undefined,
            notes: '',
            status: 'Active',
            bank_details: [],
            terms_and_conditions: [],
            cancellation_policy: [],
            welcome_email_template: DEFAULT_WELCOME_TEMPLATE,
            razorpay_link: ''
        };
        setEditedBranch(initialBranch);
        setLogoPreview(initialBranch.logo_url || null);
        setLetterheadPreview(initialBranch.letterhead_image_url || null);
        setFrontPagePreview(initialBranch.front_page_image_url || null);
        setFinalPagePreview(initialBranch.final_page_image_url || null);
        setSealPreview(initialBranch.seal_signature_url || null);
        setIsEditing(isNew);
        setActiveTab('details');
    }, [branch, isNew]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
                setIsAdminDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-populate contact/email when admin is selected
    useEffect(() => {
        if (editedBranch.admin_id) {
            const selectedAdmin = staff.find(s => s.id === editedBranch.admin_id);
            if (selectedAdmin) {
                setEditedBranch(prev => ({
                    ...prev,
                    primary_contact: selectedAdmin.phone || prev.primary_contact,
                    primary_email: selectedAdmin.email || prev.primary_email
                }));
            }
        }
    }, [editedBranch.admin_id, staff]);

    const handleFieldChange = (field: keyof Branch, value: any) => {
        setEditedBranch(prev => ({ ...prev, [field]: value }));
    };

    const handleAddressChange = (field: keyof Address, value: string) => {
        setEditedBranch(prev => ({
            ...prev,
            address: { ...prev.address!, [field]: value }
        }));
    };

    const handleBankSave = (detail: BankDetails) => {
        setEditedBranch(prev => {
            const currentDetails = prev.bank_details || [];
            const isUpdate = bankDetailToEdit && bankDetailToEdit !== 'new' && 'id' in bankDetailToEdit;
            let newDetails;
            if (isUpdate) {
                newDetails = currentDetails.map(d => d.id === detail.id ? detail : d);
            } else {
                newDetails = [...currentDetails, detail];
            }
            return { ...prev, bank_details: newDetails };
        });
        setBankDetailToEdit(null);
    };

    const handleTermsSave = (terms: TermsAndConditions) => {
        setEditedBranch(prev => {
            const currentTerms = prev.terms_and_conditions || [];
            const isUpdate = termsToEdit && termsToEdit !== 'new' && 'id' in termsToEdit;
            let newTerms;
            if (isUpdate) {
                newTerms = currentTerms.map(t => t.id === terms.id ? terms : t);
            } else {
                newTerms = [...currentTerms, terms];
            }
            return { ...prev, terms_and_conditions: newTerms };
        });
        setTermsToEdit(null);
    };

    const handleCancellationPolicySave = (policy: TermsAndConditions) => {
        setEditedBranch(prev => {
            const currentPolicies = prev.cancellation_policy || [];
            const isUpdate = cancellationPolicyToEdit && cancellationPolicyToEdit !== 'new' && 'id' in cancellationPolicyToEdit;
            let newPolicies;
            if (isUpdate) {
                newPolicies = currentPolicies.map(p => p.id === policy.id ? policy : p);
            } else {
                newPolicies = [...currentPolicies, policy];
            }
            return { ...prev, cancellation_policy: newPolicies };
        });
        setCancellationPolicyToEdit(null);
    };

    const handleDeleteBank = (id: number) => {
        setEditedBranch(prev => ({ ...prev, bank_details: prev.bank_details?.filter(d => d.id !== id) }));
    };

    const handleDeleteTerms = (id: number) => {
        setEditedBranch(prev => ({ ...prev, terms_and_conditions: prev.terms_and_conditions?.filter(t => t.id !== id) }));
    };

    const handleDeleteCancellationPolicy = (id: number) => {
        setEditedBranch(prev => ({ ...prev, cancellation_policy: prev.cancellation_policy?.filter(t => t.id !== id) }));
    };

    const handleSave = () => {
        if (!editedBranch.name) {
            addToast('Branch name is required.', 'error');
            return;
        }
        onSave(editedBranch as Branch);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-20" onClick={onClose}>
            <div className="fixed inset-y-0 right-0 w-full sm:w-full md:max-w-4xl bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b h-16">
                    <h2 className="text-lg font-semibold text-slate-800">{isNew ? 'Add New Branch' : 'Branch Details'}</h2>
                    <div className="flex items-center gap-2">
                        {!isNew && !isEditing && (
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-[5px] hover:bg-slate-200"><IconPencil className="w-4 h-4" /> Edit</button>
                        )}
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><IconX className="w-5 h-5 text-slate-600" /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    <div className="border-b border-gray-200 mb-6 bg-white -mx-6 px-6 -mt-6 pt-2 sticky top-0 z-10">
                        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                            <button onClick={() => setActiveTab('details')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'details' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Details</button>
                            {!isNew && <button onClick={() => setActiveTab('leads')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'leads' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Associated Leads</button>}
                            <button onClick={() => setActiveTab('templates')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'templates' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Templates</button>
                        </nav>
                    </div>

                    {activeTab === 'details' && (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-lg border border-slate-200">
                                <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2">General Info</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <InfoField label="Branch Name" value={editedBranch.name} isEditing={isEditing} onChange={e => handleFieldChange('name', e.target.value)} />
                                    </div>
                                    {/* Address fields */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                                        {isEditing ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                <input type="text" placeholder="Street" value={editedBranch.address?.street || ''} onChange={e => handleAddressChange('street', e.target.value)} className="w-full p-2 border rounded text-sm col-span-2" />
                                                <input type="text" placeholder="City" value={editedBranch.address?.city || ''} onChange={e => handleAddressChange('city', e.target.value)} className="w-full p-2 border rounded text-sm" />
                                                <input type="text" placeholder="State" value={editedBranch.address?.state || ''} onChange={e => handleAddressChange('state', e.target.value)} className="w-full p-2 border rounded text-sm" />
                                                <input type="text" placeholder="ZIP" value={editedBranch.address?.zip || ''} onChange={e => handleAddressChange('zip', e.target.value)} className="w-full p-2 border rounded text-sm" />
                                                <input type="text" placeholder="Country" value={editedBranch.address?.country || ''} onChange={e => handleAddressChange('country', e.target.value)} className="w-full p-2 border rounded text-sm" />
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-900">{editedBranch.address ? `${editedBranch.address.street}, ${editedBranch.address.city}, ${editedBranch.address.state} - ${editedBranch.address.zip}, ${editedBranch.address.country}` : 'N/A'}</p>
                                        )}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Branch Admin</label>
                                        {isEditing ? (
                                            <div ref={adminDropdownRef} className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsAdminDropdownOpen(prev => !prev)}
                                                    className="w-full text-left p-2 border rounded-md bg-slate-50 min-h-[40px] flex items-center justify-between"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {editedBranch.admin_id ? (
                                                            <>
                                                                <img
                                                                    src={staff.find(s => s.id === editedBranch.admin_id)?.avatar_url || ''}
                                                                    alt=""
                                                                    className="w-6 h-6 rounded-full"
                                                                />
                                                                <span className="text-sm text-slate-900">
                                                                    {staff.find(s => s.id === editedBranch.admin_id)?.name}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-sm text-slate-500">Select admin...</span>
                                                        )}
                                                    </div>
                                                    <IconChevronDown className="w-4 h-4 text-slate-400" />
                                                </button>
                                                {isAdminDropdownOpen && (
                                                    <div className="absolute top-full mt-1 w-full bg-white rounded-md shadow-lg border z-20 max-h-60 overflow-y-auto">
                                                        <ul>
                                                            <li
                                                                onClick={() => {
                                                                    handleFieldChange('admin_id', undefined);
                                                                    setIsAdminDropdownOpen(false);
                                                                }}
                                                                className="p-2 hover:bg-slate-100 cursor-pointer flex items-center justify-between"
                                                            >
                                                                <span className="text-sm text-slate-500">None</span>
                                                                {!editedBranch.admin_id && <IconCheckCircle className="w-5 h-5 text-blue-600" />}
                                                            </li>
                                                            {staff
                                                                .filter(s => s.role_id === 1 || s.role_id === 2) // Only Super Admin (1) and Manager (2)
                                                                .map(s => (
                                                                    <li
                                                                        key={s.id}
                                                                        onClick={() => {
                                                                            handleFieldChange('admin_id', s.id);
                                                                            setIsAdminDropdownOpen(false);
                                                                        }}
                                                                        className="p-2 hover:bg-slate-100 cursor-pointer flex items-center gap-2"
                                                                    >
                                                                        <img src={s.avatar_url} alt={s.name} className="w-6 h-6 rounded-full" />
                                                                        <div className="flex-1 min-w-0">
                                                                            <span className="text-sm text-slate-800 block">{s.name}</span>
                                                                            <span className="text-xs text-slate-500">
                                                                                {s.role_id === 1 ? 'Super Admin' : 'Manager'}
                                                                            </span>
                                                                        </div>
                                                                        {editedBranch.admin_id === s.id && <IconCheckCircle className="w-5 h-5 text-blue-600" />}
                                                                    </li>
                                                                ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="py-2">
                                                {editedBranch.admin_id ? (
                                                    <div className="flex items-center gap-2">
                                                        <img
                                                            src={staff.find(s => s.id === editedBranch.admin_id)?.avatar_url || ''}
                                                            alt=""
                                                            className="w-8 h-8 rounded-full"
                                                        />
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-900">
                                                                {staff.find(s => s.id === editedBranch.admin_id)?.name}
                                                            </p>
                                                            <p className="text-xs text-slate-500">
                                                                {staff.find(s => s.id === editedBranch.admin_id)?.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-500">No admin assigned</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <InfoField label="Primary Contact" value={editedBranch.primary_contact} isEditing={isEditing} onChange={e => handleFieldChange('primary_contact', e.target.value)} />
                                    <InfoField label="Primary Email" value={editedBranch.primary_email} isEditing={isEditing} onChange={e => handleFieldChange('primary_email', e.target.value)} />
                                    <div className="md:col-span-2">
                                        <InfoField label="Razorpay Payment Link" value={editedBranch.razorpay_link} isEditing={isEditing} onChange={e => handleFieldChange('razorpay_link', e.target.value)} />
                                    </div>

                                    {/* Branch Logo Upload */}
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Branch Logo</label>
                                        {isEditing ? (
                                            <div className="space-y-2">
                                                {logoPreview && (
                                                    <div className="relative inline-block">
                                                        <img src={logoPreview} alt="Branch Logo" className="max-h-20 max-w-40 object-contain border rounded p-2 bg-white" />
                                                    </div>
                                                )}
                                                <label className="cursor-pointer inline-block px-3 py-1.5 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">
                                                    {logoPreview ? 'Change Logo' : 'Upload Logo'}
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept="image/png,image/jpeg,image/jpg"
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file || !editedBranch.id) return;

                                                            try {
                                                                const filePath = `public/branch-logos/${editedBranch.id}/${Date.now()}-${file.name}`;
                                                                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
                                                                if (uploadError) throw uploadError;

                                                                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                                                                const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

                                                                setLogoPreview(logoUrl);
                                                                handleFieldChange('logo_url', logoUrl);
                                                                addToast('Logo uploaded successfully. Remember to save changes.', 'success');
                                                            } catch (error: any) {
                                                                addToast(`Logo upload failed: ${error.message}`, 'error');
                                                            }
                                                        }}
                                                    />
                                                </label>
                                                {logoPreview && (
                                                    <button
                                                        onClick={() => {
                                                            setLogoPreview(null);
                                                            handleFieldChange('logo_url', '');
                                                        }}
                                                        className="ml-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-[5px] hover:bg-red-200"
                                                    >
                                                        Remove
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            logoPreview ? (
                                                <img src={logoPreview} alt="Branch Logo" className="max-h-20 max-w-40 object-contain border rounded p-2 bg-white" />
                                            ) : (
                                                <p className="text-sm text-slate-500">No logo uploaded</p>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* PDF / Branding Images Section */}
                            <div className="bg-white p-6 rounded-lg border border-slate-200">
                                <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2">PDF & Branding Images</h3>

                                {/* Seal with Signature Image */}
                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Seal with Signature (used on invoices)</label>
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            {sealPreview && (
                                                <div className="relative inline-block">
                                                    <img src={sealPreview} alt="Branch Seal with Signature" className="max-h-24 max-w-full object-contain border rounded p-2 bg-white" />
                                                </div>
                                            )}
                                            <label className="cursor-pointer inline-block px-3 py-1.5 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">
                                                {sealPreview ? 'Change Seal Image' : 'Upload Seal Image'}
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/png,image/jpeg,image/jpg"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file || !editedBranch.id) return;

                                                        try {
                                                            const filePath = `public/branch-seals/${editedBranch.id}/seal-${Date.now()}-${file.name}`;
                                                            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
                                                            if (uploadError) throw uploadError;

                                                            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                                                            const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;

                                                            setSealPreview(imageUrl);
                                                            handleFieldChange('seal_signature_url', imageUrl);
                                                            addToast('Seal image uploaded successfully. Remember to save changes.', 'success');
                                                        } catch (error: any) {
                                                            addToast(`Seal upload failed: ${error.message}`, 'error');
                                                        }
                                                    }}
                                                />
                                            </label>
                                            {sealPreview && (
                                                <button
                                                    onClick={() => {
                                                        setSealPreview(null);
                                                        handleFieldChange('seal_signature_url', '');
                                                    }}
                                                    className="ml-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-[5px] hover:bg-red-200"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        sealPreview ? (
                                            <img src={sealPreview} alt="Branch Seal with Signature" className="max-h-24 max-w-full object-contain border rounded p-2 bg-white" />
                                        ) : (
                                            <p className="text-sm text-slate-500">No seal image uploaded</p>
                                        )
                                    )}
                                </div>

                                {/* Front Page Image */}
                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Front Page Image</label>
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            {frontPagePreview && (
                                                <div className="relative inline-block">
                                                    <img src={frontPagePreview} alt="Front Page" className="max-h-40 max-w-full object-contain border rounded p-2 bg-white" />
                                                </div>
                                            )}
                                            <label className="cursor-pointer inline-block px-3 py-1.5 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">
                                                {frontPagePreview ? 'Change Front Page Image' : 'Upload Front Page Image'}
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/png,image/jpeg,image/jpg"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file || !editedBranch.id) return;

                                                        try {
                                                            const filePath = `public/branch-images/${editedBranch.id}/front-page-${Date.now()}-${file.name}`;
                                                            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
                                                            if (uploadError) throw uploadError;

                                                            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                                                            const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;

                                                            setFrontPagePreview(imageUrl);
                                                            handleFieldChange('front_page_image_url', imageUrl);
                                                            addToast('Front page image uploaded successfully. Remember to save changes.', 'success');
                                                        } catch (error: any) {
                                                            addToast(`Image upload failed: ${error.message}`, 'error');
                                                        }
                                                    }}
                                                />
                                            </label>
                                            {frontPagePreview && (
                                                <button
                                                    onClick={() => {
                                                        setFrontPagePreview(null);
                                                        handleFieldChange('front_page_image_url', '');
                                                    }}
                                                    className="ml-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-[5px] hover:bg-red-200"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        frontPagePreview ? (
                                            <img src={frontPagePreview} alt="Front Page" className="max-h-40 max-w-full object-contain border rounded p-2 bg-white" />
                                        ) : (
                                            <p className="text-sm text-slate-500">No front page image uploaded</p>
                                        )
                                    )}
                                </div>

                                {/* Final Page Image */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Final Page Image</label>
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            {finalPagePreview && (
                                                <div className="relative inline-block">
                                                    <img src={finalPagePreview} alt="Final Page" className="max-h-40 max-w-full object-contain border rounded p-2 bg-white" />
                                                </div>
                                            )}
                                            <label className="cursor-pointer inline-block px-3 py-1.5 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">
                                                {finalPagePreview ? 'Change Final Page Image' : 'Upload Final Page Image'}
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/png,image/jpeg,image/jpg"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file || !editedBranch.id) return;

                                                        try {
                                                            const filePath = `public/branch-images/${editedBranch.id}/final-page-${Date.now()}-${file.name}`;
                                                            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
                                                            if (uploadError) throw uploadError;

                                                            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                                                            const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;

                                                            setFinalPagePreview(imageUrl);
                                                            handleFieldChange('final_page_image_url', imageUrl);
                                                            addToast('Final page image uploaded successfully. Remember to save changes.', 'success');
                                                        } catch (error: any) {
                                                            addToast(`Image upload failed: ${error.message}`, 'error');
                                                        }
                                                    }}
                                                />
                                            </label>
                                            {finalPagePreview && (
                                                <button
                                                    onClick={() => {
                                                        setFinalPagePreview(null);
                                                        handleFieldChange('final_page_image_url', '');
                                                    }}
                                                    className="ml-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-[5px] hover:bg-red-200"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        finalPagePreview ? (
                                            <img src={finalPagePreview} alt="Final Page" className="max-h-40 max-w-full object-contain border rounded p-2 bg-white" />
                                        ) : (
                                            <p className="text-sm text-slate-500">No final page image uploaded</p>
                                        )
                                    )}
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-lg border border-slate-200">
                                <div className="flex justify-between items-center mb-4 border-b pb-2">
                                    <h3 className="font-semibold text-slate-800">Bank Accounts</h3>
                                    {isEditing && <button onClick={() => setBankDetailToEdit('new')} className="text-sm text-blue-600 hover:underline">+ Add Account</button>}
                                </div>
                                {editedBranch.bank_details?.length === 0 ? <p className="text-sm text-slate-500">No bank details added.</p> : (
                                    <ul className="space-y-2">
                                        {editedBranch.bank_details?.map(bd => (
                                            <li key={bd.id} className="p-3 border rounded bg-slate-50 flex justify-between items-center">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm">{bd.bank_name} - {bd.account_number}</p>
                                                    <p className="text-xs text-slate-500">{bd.branch_name}, IFSC: {bd.ifsc_code} {bd.is_default && <span className="bg-green-100 text-green-800 px-1 rounded ml-2">Default</span>}</p>
                                                    {bd.gstin && <p className="text-xs text-slate-500 mt-1">GSTIN: {bd.gstin}</p>}
                                                    {bd.cheque_instructions && <p className="text-xs text-slate-500 mt-1 line-clamp-2">Cheque: {bd.cheque_instructions}</p>}
                                                </div>
                                                {isEditing && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setBankDetailToEdit(bd)} className="p-1 text-slate-500 hover:text-blue-600"><IconPencil className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDeleteBank(bd.id)} className="p-1 text-slate-500 hover:text-red-600"><IconTrash className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="bg-white p-6 rounded-lg border border-slate-200">
                                <div className="flex justify-between items-center mb-4 border-b pb-2">
                                    <h3 className="font-semibold text-slate-800">Terms & Conditions</h3>
                                    {isEditing && <button onClick={() => setTermsToEdit('new')} className="text-sm text-blue-600 hover:underline">+ Add Terms</button>}
                                </div>
                                {editedBranch.terms_and_conditions?.length === 0 ? <p className="text-sm text-slate-500">No terms added.</p> : (
                                    <ul className="space-y-2">
                                        {editedBranch.terms_and_conditions?.map(tc => (
                                            <li key={tc.id} className="p-3 border rounded bg-slate-50 flex justify-between items-start">
                                                <div className="text-sm text-slate-700 prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
                                                    <div dangerouslySetInnerHTML={{ __html: tc.content }} />
                                                    {tc.is_default && <span className="text-xs bg-green-100 text-green-800 px-1 rounded mt-1 inline-block">Default</span>}
                                                </div>
                                                {isEditing && (
                                                    <div className="flex gap-2 shrink-0 ml-2">
                                                        <button onClick={() => setTermsToEdit(tc)} className="p-1 text-slate-500 hover:text-blue-600"><IconPencil className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDeleteTerms(tc.id)} className="p-1 text-slate-500 hover:text-red-600"><IconTrash className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="bg-white p-6 rounded-lg border border-slate-200">
                                <div className="flex justify-between items-center mb-4 border-b pb-2">
                                    <h3 className="font-semibold text-slate-800">Cancellation Policy</h3>
                                    {isEditing && <button onClick={() => setCancellationPolicyToEdit('new')} className="text-sm text-blue-600 hover:underline">+ Add Policy</button>}
                                </div>
                                {editedBranch.cancellation_policy?.length === 0 ? <p className="text-sm text-slate-500">No cancellation policy added.</p> : (
                                    <ul className="space-y-2">
                                        {editedBranch.cancellation_policy?.map(cp => (
                                            <li key={cp.id} className="p-3 border rounded bg-slate-50 flex justify-between items-start">
                                                <div>
                                                    <p className="text-sm line-clamp-2">{cp.content}</p>
                                                    {cp.is_default && <span className="text-xs bg-green-100 text-green-800 px-1 rounded mt-1 inline-block">Default</span>}
                                                </div>
                                                {isEditing && (
                                                    <div className="flex gap-2 shrink-0 ml-2">
                                                        <button onClick={() => setCancellationPolicyToEdit(cp)} className="p-1 text-slate-500 hover:text-blue-600"><IconPencil className="w-4 h-4" /></button>
                                                        <button onClick={() => handleDeleteCancellationPolicy(cp.id)} className="p-1 text-slate-500 hover:text-red-600"><IconTrash className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'leads' && (
                        <div className="bg-white p-4 rounded-lg border border-slate-200">
                            <AssociatedLeadsList leads={leads.filter(l => l.branch_ids.includes(editedBranch.id || 0))} customers={customers} />
                        </div>
                    )}

                    {activeTab === 'templates' && (
                        <div className="space-y-6">
                            <div className="bg-white p-6 rounded-lg border border-slate-200">
                                <h3 className="font-semibold text-slate-800 mb-4 border-b pb-2">Welcome Email Template (HTML)</h3>
                                {isEditing ? (
                                    <textarea
                                        value={editedBranch.welcome_email_template || ''}
                                        onChange={e => handleFieldChange('welcome_email_template', e.target.value)}
                                        className="w-full h-64 p-2 border rounded font-mono text-xs"
                                    />
                                ) : (
                                    <div className="h-64 overflow-y-auto p-2 bg-slate-50 border rounded font-mono text-xs whitespace-pre-wrap">
                                        {editedBranch.welcome_email_template}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {isEditing && (
                    <div className="p-4 bg-white border-t">
                        <button onClick={handleSave} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">
                            {isNew ? 'Create Branch' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>

            {bankDetailToEdit && (
                <BankDetailModal
                    detail={bankDetailToEdit === 'new' ? {} : bankDetailToEdit}
                    onClose={() => setBankDetailToEdit(null)}
                    onSave={handleBankSave}
                />
            )}
            {termsToEdit && (
                <TermsModal
                    terms={termsToEdit === 'new' ? { content: DEFAULT_TERMS_AND_CONDITIONS_HTML } : termsToEdit}
                    onClose={() => setTermsToEdit(null)}
                    onSave={handleTermsSave}
                />
            )}
            {cancellationPolicyToEdit && (
                <TermsModal
                    terms={cancellationPolicyToEdit === 'new' ? {} : cancellationPolicyToEdit}
                    onClose={() => setCancellationPolicyToEdit(null)}
                    onSave={handleCancellationPolicySave}
                    title="Cancellation Policy"
                    placeholder="Enter cancellation policy text..."
                />
            )}
        </div>
    );
};

const Branches: React.FC<{ currentUser: LoggedInUser }> = ({ currentUser }) => {
    const { branches, leads, customers, staff, refreshData } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const { addToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    const filteredBranches = useMemo(() => {
        return branches.filter(b =>
            b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.address.city.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [branches, searchTerm]);

    const handleAddNew = () => {
        setSelectedBranch(null);
        setIsPanelOpen(true);
    };

    const handleSelectBranch = (branch: Branch) => {
        setSelectedBranch(branch);
        setIsPanelOpen(true);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedBranch(null);
    };

    const handleSaveBranch = async (branchToSave: Branch) => {
        setIsSaving(true);
        try {
            const { bank_details, terms_and_conditions, ...branchData } = branchToSave;

            let branchId = branchToSave.id;

            if (!branchToSave.id || branchToSave.id.toString().startsWith('temp')) { // New branch check logic (id might be generated)
                // Insert branch
                const { data, error } = await supabase.from('branches').insert([{
                    name: branchData.name,
                    address: branchData.address,
                    primary_contact: branchData.primary_contact,
                    primary_email: branchData.primary_email,
                    admin_id: branchData.admin_id || null,
                    logo_url: branchData.logo_url,
                    seal_signature_url: branchData.seal_signature_url,
                    letterhead_image_url: branchData.letterhead_image_url,
                    front_page_image_url: branchData.front_page_image_url,
                    final_page_image_url: branchData.final_page_image_url,
                    welcome_email_template: branchData.welcome_email_template,
                    status: branchData.status,
                    razorpay_link: branchData.razorpay_link || null
                }]).select().single();
                if (error) throw error;
                branchId = data.id;
            } else {
                // Update branch
                const { error } = await supabase.from('branches').update({
                    name: branchData.name,
                    address: branchData.address,
                    primary_contact: branchData.primary_contact,
                    primary_email: branchData.primary_email,
                    admin_id: branchData.admin_id || null,
                    logo_url: branchData.logo_url,
                    seal_signature_url: branchData.seal_signature_url,
                    letterhead_image_url: branchData.letterhead_image_url,
                    front_page_image_url: branchData.front_page_image_url,
                    final_page_image_url: branchData.final_page_image_url,
                    welcome_email_template: branchData.welcome_email_template,
                    status: branchData.status,
                    razorpay_link: branchData.razorpay_link || null
                }).eq('id', branchId);
                if (error) throw error;
            }

            // Handle Bank Details
            if (bank_details) {
                for (const bd of bank_details) {
                    const payload = {
                        branch_id: branchId,
                        bank_name: bd.bank_name,
                        branch_name: bd.branch_name,
                        ifsc_code: bd.ifsc_code,
                        account_number: bd.account_number,
                        is_default: bd.is_default,
                        gstin: bd.gstin || null,
                        cheque_instructions: bd.cheque_instructions || null
                    };
                    if (bd.id && bd.id > 1000000000000) { // Assuming large IDs are temp timestamps
                        await supabase.from('bank_details').insert([payload]);
                    } else if (bd.id) {
                        await supabase.from('bank_details').update(payload).eq('id', bd.id);
                    } else {
                        await supabase.from('bank_details').insert([payload]);
                    }
                }
            }

            // Handle Terms
            if (terms_and_conditions) {
                for (const tc of terms_and_conditions) {
                    const payload = {
                        branch_id: branchId,
                        content: tc.content,
                        is_default: tc.is_default
                    };
                    if (tc.id && tc.id > 1000000000000) {
                        await supabase.from('terms_and_conditions').insert([payload]);
                    } else if (tc.id) {
                        await supabase.from('terms_and_conditions').update(payload).eq('id', tc.id);
                    } else {
                        await supabase.from('terms_and_conditions').insert([payload]);
                    }
                }
            }

            // Handle Cancellation Policy
            if (branchToSave.cancellation_policy) {
                for (const cp of branchToSave.cancellation_policy) {
                    const payload = {
                        branch_id: branchId,
                        content: cp.content,
                        is_default: cp.is_default
                    };
                    if (cp.id && cp.id > 1000000000000) {
                        await supabase.from('cancellation_policy').insert([payload]);
                    } else if (cp.id) {
                        await supabase.from('cancellation_policy').update(payload).eq('id', cp.id);
                    } else {
                        await supabase.from('cancellation_policy').insert([payload]);
                    }
                }
            }

            await refreshData();
            addToast('Branch saved successfully.', 'success');
            handleClosePanel();

        } catch (error: any) {
            addToast(`Error saving branch: ${error.message}`, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleStatus = async (branchId: number, status: 'Active' | 'Inactive') => {
        const { error } = await supabase.from('branches').update({ status }).eq('id', branchId);
        if (error) {
            addToast(`Error updating status: ${error.message}`, 'error');
        } else {
            addToast(`Branch marked as ${status}`, 'success');
            refreshData();
        }
    };

    return (
        <div className="flex h-full">
            <div className="flex-1 flex flex-col">
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <h1 className="text-lg sm:text-xl font-bold text-slate-800">Branches</h1>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                                <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 sm:pl-10 pr-4 py-2 w-full sm:w-64 text-sm border rounded-md min-h-[44px] sm:min-h-0" />
                            </div>
                            <button onClick={handleAddNew} className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c] min-h-[44px] sm:min-h-0">
                                <IconPlus className="w-4 h-4" /> 
                                <span className="hidden sm:inline">New Branch</span>
                                <span className="sm:hidden">New</span>
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {filteredBranches.map(branch => {
                            const branchAdmin = branch.admin_id ? staff.find(s => s.id === branch.admin_id) : null;
                            return (
                                <div
                                    key={branch.id}
                                    onClick={() => handleSelectBranch(branch)}
                                    className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-slate-900 text-base mb-1">{branch.name}</h3>
                                            <p className="text-sm text-slate-600">{branch.address.city}, {branch.address.state}</p>
                                        </div>
                                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${branch.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {branch.status}
                                        </span>
                                    </div>
                                    <div className="space-y-2 pt-3 border-t border-slate-100">
                                        {branchAdmin ? (
                                            <div className="flex items-center gap-2">
                                                <img src={branchAdmin.avatar_url} alt={branchAdmin.name} className="w-6 h-6 rounded-full" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-slate-500">Admin</p>
                                                    <p className="text-sm font-medium text-slate-900 truncate">{branchAdmin.name}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400">No admin assigned</div>
                                        )}
                                        <div className="text-xs text-slate-500">
                                            <p className="truncate">{branch.primary_email}</p>
                                            {branch.primary_contact && <p className="truncate">{branch.primary_contact}</p>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {filteredBranches.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                            <p>No branches found</p>
                        </div>
                    )}
                </div>
            </div>
            {isPanelOpen && (
                <BranchDetailPanel
                    branch={selectedBranch}
                    leads={leads}
                    customers={customers}
                    onClose={handleClosePanel}
                    onSave={handleSaveBranch}
                    onToggleStatus={handleToggleStatus}
                    staff={staff}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
};

export default Branches;
