import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, Lead, Note, Activity, Address, Staff, Branch, CustomerDocuments, LoggedInUser, Document, UploadedFile, PassportDetails, VisaDetails, AadhaarDetails, PanDetails, BankStatementDetails, OtherDocDetails } from '../types';
import { IconX, IconChatBubble, IconPencil, IconPlus, IconTrash, IconDownload, IconEye, IconCheckCircle } from '../constants';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { useData } from '../contexts/DataProvider';
import { useAuth } from '../contexts/AuthProvider';
import { useRouter } from '../contexts/RouterProvider';
import { getDefaultAvatarUrl } from '../lib/avatarUrl';

const countryStateData: { [key: string]: string[] } = {
    'India': ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'],
    'USA': ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'],
    'Canada': ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Nova Scotia', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan'],
    'Australia': ['New South Wales', 'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia'],
    'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
    'Germany': ['Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hesse', 'Lower Saxony', 'Mecklenburg-Vorpommern', 'North Rhine-Westphalia', 'Rhineland-Palatinate', 'Saarland', 'Saxony', 'Saxony-Anhalt', 'Schleswig-Holstein', 'Thuringia'],
};

const salutations = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'];

const MANUAL_CODE = '__manual__';
const SELECT_MANUAL = '__manual__';

export const countryCodes = [
    { name: 'India', code: '+91', flag: '🇮🇳' },
    { name: 'USA', code: '+1', flag: '🇺🇸' },
    { name: 'UK', code: '+44', flag: '🇬🇧' },
    { name: 'Australia', code: '+61', flag: '🇦🇺' },
    { name: 'UAE', code: '+971', flag: '🇦🇪' },
    { name: 'Singapore', code: '+65', flag: '🇸🇬' },
    { name: 'Germany', code: '+49', flag: '🇩🇪' },
    { name: 'France', code: '+33', flag: '🇫🇷' },
    { name: 'Malaysia', code: '+60', flag: '🇲🇾' },
];

export const PhoneInput: React.FC<{
    value: string;
    onChange: (value: string) => void;
    isEditing: boolean;
}> = ({ value, onChange, isEditing }) => {
    const [countryCode, number] = useMemo(() => {
        if (!value) return ['+91', ''];
        const match = value.match(/^(\+\d{1,4})\s*(.*)$/);
        if (match) return [match[1], match[2] || ''];
        if (value === '+' || /^\+\s/.test(value)) return ['+', value.replace(/^\+\s*/, '')];
        if (value.startsWith('+')) {
            const codeMatch = value.match(/^(\+\d{1,4})/);
            if (codeMatch) return [codeMatch[1], value.slice(codeMatch[1].length).replace(/^\s+/, '')];
        }
        return ['+91', value.replace(/^\+\d+\s*/, '')];
    }, [value]);

    const isManualCode = !countryCodes.some(c => c.code === countryCode);

    if (!isEditing) {
        return <p className="text-base text-slate-900 font-medium py-2 min-h-[40px]">{value || 'N/A'}</p>;
    }

    const handleCodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const v = e.target.value;
        if (v === MANUAL_CODE) {
            onChange(`+ ${number}`);
        } else {
            onChange(`${v} ${number}`);
        }
    };

    const handleManualCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let s = e.target.value.replace(/[^\d+]/g, '');
        if (!s || s === '+') {
            onChange(`+ ${number}`);
            return;
        }
        if (!s.startsWith('+')) s = '+' + s;
        s = '+' + s.slice(1).slice(0, 4);
        onChange(`${s} ${number}`);
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newNumber = e.target.value.replace(/[^0-9]/g, '');
        onChange(`${countryCode} ${newNumber}`);
    };

    return (
        <div className="flex w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden">
            {isManualCode ? (
                <input
                    type="text"
                    value={countryCode}
                    onChange={handleManualCodeChange}
                    placeholder="+XX"
                    className="p-2 border-0 rounded-l-md bg-slate-100 text-slate-800 focus:outline-none basis-[15%] min-w-0"
                    title="Enter country code (e.g. +33, +49)"
                />
            ) : (
                <select
                    value={countryCode}
                    onChange={handleCodeChange}
                    className="p-2 border-0 rounded-l-md bg-slate-100 text-slate-800 focus:outline-none h-full basis-[15%] min-w-0"
                >
                    {countryCodes.map(c => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                    ))}
                    <option value={MANUAL_CODE}>Other / Type code</option>
                </select>
            )}
            <input
                type="tel"
                value={number}
                onChange={handleNumberChange}
                className="bg-transparent p-2 border-0 focus:outline-none basis-[85%] min-w-0"
                placeholder="Enter phone number"
            />
        </div>
    );
};

const SelectWithManual: React.FC<{
    value: string;
    onChange: (value: string) => void;
    options: string[];
    label: string;
    isEditing: boolean;
    placeholder?: string;
    selectPlaceholder?: string;
}> = ({ value, onChange, options, label, isEditing, placeholder = 'Type here', selectPlaceholder }) => {
    const [forceManual, setForceManual] = useState(false);

    useEffect(() => {
        if (options.includes(value)) setForceManual(false);
    }, [value, options]);

    const isManual = forceManual || (value !== '' && !options.includes(value));

    if (!isEditing) {
        return <p className="text-base text-slate-900 font-medium py-2 min-h-[40px]">{value || 'N/A'}</p>;
    }

    if (isManual) {
        return (
            <div>
                <label className="block text-xs font-medium text-slate-500 capitalize mb-1">{label}</label>
                <input
                    type="text"
                    value={value}
                    onChange={e => { onChange(e.target.value); setForceManual(false); }}
                    placeholder={placeholder}
                    className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400"
                />
            </div>
        );
    }

    return (
        <div>
            <label className="block text-xs font-medium text-slate-500 capitalize mb-1">{label}</label>
            <select
                value={options.includes(value) ? value : ''}
                onChange={e => {
                    const v = e.target.value;
                    if (v === SELECT_MANUAL) {
                        onChange('');
                        setForceManual(true);
                    } else {
                        onChange(v);
                    }
                }}
                className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
                <option value="">{selectPlaceholder ?? `Select ${label}`}</option>
                {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
                <option value={SELECT_MANUAL}>Other / Type</option>
            </select>
        </div>
    );
};

const DetailInputField: React.FC<{ label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; }> = ({ label, value, onChange, type = 'text' }) => (
    <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
        <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900 placeholder:text-slate-400" />
    </div>
);

const InfoField: React.FC<{ label: string; value: string | number | undefined | null; isEditing: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void; readOnly?: boolean; type?: string; options?: string[]; required?: boolean; alwaysEditable?: boolean; maxLength?: number; placeholder?: string }> =
    ({ label, value, isEditing, onChange, readOnly = false, type = 'text', options, required = false, alwaysEditable = false, maxLength, placeholder }) => {
        const showInput = isEditing || alwaysEditable;
        return (
            <div>
                <label className="block text-xs font-medium text-slate-500 capitalize mb-1">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
                {showInput ? (
                    type === 'select' ? (
                        <select
                            value={value || ''}
                            onChange={onChange}
                            className={`w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                        >
                            <option value="">Select {label}</option>
                            {options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    ) : (
                        <input
                            type={type}
                            value={value || ''}
                            onChange={onChange}
                            readOnly={readOnly}
                            maxLength={maxLength}
                            placeholder={placeholder}
                            className={`w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-400 ${readOnly ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
                        />
                    )
                ) : (
                    <p className="text-base text-slate-900 font-medium py-2 min-h-[40px] truncate">{value || 'N/A'}</p>
                )}
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
        <div className="relative">
            <div className="absolute left-4 top-1 h-full w-px bg-slate-200" aria-hidden="true"></div>
            {(activities || []).map(activity => (
                <div key={activity.id} className="relative pl-12 pb-8">
                    <div className="absolute left-4 top-1 -translate-x-1/2 rounded-full bg-white p-1 border border-slate-300">
                        <IconChatBubble className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex items-start">
                        <div className="flex-shrink-0 w-24 text-xs text-slate-500 text-left">
                            <p>{formatDate(activity.timestamp)}</p>
                            <p>{formatTime(activity.timestamp)}</p>
                        </div>
                        <div className="ml-4 flex-grow rounded-lg border bg-white shadow-sm p-3">
                            <p className="font-semibold text-sm text-slate-800">{activity.type}</p>
                            <p className="text-sm text-slate-600">{activity.description}</p>
                            <p className="text-xs text-slate-500 mt-1">
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


const DocumentSection: React.FC<{
    title: string;
    documents: Document<any>[];
    isEditing: boolean;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onEdit: (doc: Document<any>) => void;
    onDelete: (id: number) => void;
    onCameraScan?: () => void;
}> = ({ title, documents, isEditing, onFileUpload, onEdit, onDelete, onCameraScan }) => {

    return (
        <div className="bg-white p-4 rounded-lg border">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-700">{title}</h4>
                {isEditing && (
                    <div className="flex items-center gap-2">
                        {onCameraScan && (
                            <button onClick={onCameraScan} className="px-3 py-1 text-sm font-medium text-purple-700 bg-purple-100 rounded-[5px] hover:bg-purple-200">
                                📷 Scan
                            </button>
                        )}
                        <label className="cursor-pointer px-3 py-1 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">
                            <IconPlus className="w-4 h-4 inline-block -mt-px mr-1" /> Upload
                            <input type="file" className="hidden" onChange={onFileUpload} accept=".pdf,.doc,.docx,.jpg,.png" />
                        </label>
                    </div>
                )}
            </div>
            <div className="space-y-2">
                {documents.map((doc) => (
                    <div key={doc.id} className="group flex items-center justify-between p-2 bg-slate-50 rounded-md text-sm hover:bg-slate-100">
                        <div className="flex items-center gap-3">
                            <a href={doc.file.content} target="_blank" rel="noopener noreferrer" title="View File" className="text-blue-600 hover:text-blue-800">
                                <IconEye className="w-5 h-5" />
                            </a>
                            <div>
                                <p className="font-medium text-slate-800 truncate pr-4">{doc.file.name}</p>
                                <p className="text-xs text-slate-500">{doc.details.personName || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <a href={doc.file.content} download={doc.file.name} className="p-1.5 text-slate-500 hover:text-blue-600" title="Download">
                                <IconDownload className="w-4 h-4" />
                            </a>
                            {isEditing && (
                                <>
                                    <button onClick={() => onEdit(doc)} className="p-1.5 text-slate-500 hover:text-blue-600" title="Edit Details"><IconPencil className="w-4 h-4" /></button>
                                    <button onClick={() => onDelete(doc.id)} className="p-1.5 text-slate-500 hover:text-red-600" title="Delete"><IconTrash className="w-4 h-4" /></button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
                {documents.length === 0 && <p className="text-xs text-slate-400 text-center py-2">No documents uploaded.</p>}
            </div>
        </div>
    );
};


const DocumentEditModal: React.FC<{
    doc: Document<any>;
    docType: keyof CustomerDocuments;
    onClose: () => void;
    onSave: (doc: Document<any>) => void;
}> = ({ doc, docType, onClose, onSave }) => {
    const [details, setDetails] = useState(doc.details);

    const handleSave = () => {
        onSave({ ...doc, details });
    };

    const renderFields = () => {
        switch (docType) {
            case 'passports':
                return (
                    <div className="space-y-4">
                        <DetailInputField label="Person's Name" value={details.personName || ''} onChange={v => setDetails(d => ({ ...d, personName: v }))} />
                        <DetailInputField label="Name on Passport" value={details.nameOnCard || ''} onChange={v => setDetails(d => ({ ...d, nameOnCard: v }))} />
                        <DetailInputField label="Passport Number" value={details.number || ''} onChange={v => setDetails(d => ({ ...d, number: v }))} />
                        <DetailInputField label="Issue Date" type="date" value={details.issue_date || ''} onChange={v => setDetails(d => ({ ...d, issue_date: v }))} />
                        <DetailInputField label="Expiry Date" type="date" value={details.expiry_date || ''} onChange={v => setDetails(d => ({ ...d, expiry_date: v }))} />
                    </div>
                );
            case 'visas':
                return (
                    <div className="space-y-4">
                        <DetailInputField label="Person's Name" value={details.personName || ''} onChange={v => setDetails(d => ({ ...d, personName: v }))} />
                        <DetailInputField label="Visa Type" value={details.visaType || ''} onChange={v => setDetails(d => ({ ...d, visaType: v }))} />
                        <DetailInputField label="Country" value={details.country || ''} onChange={v => setDetails(d => ({ ...d, country: v }))} />
                        <DetailInputField label="Visa Number" value={details.number || ''} onChange={v => setDetails(d => ({ ...d, number: v }))} />
                        <DetailInputField label="Issue Date" type="date" value={details.issue_date || ''} onChange={v => setDetails(d => ({ ...d, issue_date: v }))} />
                        <DetailInputField label="Expiry Date" type="date" value={details.expiry_date || ''} onChange={v => setDetails(d => ({ ...d, expiry_date: v }))} />
                    </div>
                );
            case 'aadhaarCards':
            case 'panCards':
                return (
                    <div className="space-y-4">
                        <DetailInputField label="Person's Name" value={details.personName || ''} onChange={v => setDetails(d => ({ ...d, personName: v }))} />
                        <DetailInputField label="Name on Card" value={details.nameOnCard || ''} onChange={v => setDetails(d => ({ ...d, nameOnCard: v }))} />
                        <DetailInputField label="Card Number" value={details.number || ''} onChange={v => setDetails(d => ({ ...d, number: v }))} />
                    </div>
                );
            case 'bankStatements':
                return <DetailInputField label="Notes" value={details.notes || ''} onChange={v => setDetails(d => ({ ...d, notes: v }))} />;
            case 'otherDocuments':
                return (
                    <div className="space-y-4">
                        <DetailInputField label="Person's Name" value={details.personName || ''} onChange={v => setDetails(d => ({ ...d, personName: v }))} />
                        <DetailInputField label="Document Name" value={details.documentName || ''} onChange={v => setDetails(d => ({ ...d, documentName: v }))} />
                        <DetailInputField label="Notes" value={details.notes || ''} onChange={v => setDetails(d => ({ ...d, notes: v }))} />
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Edit Document Details</h3>
                {renderFields()}
                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-[5px] hover:bg-slate-50">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">Save</button>
                </div>
            </div>
        </div>
    );
};

function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) {
        throw new Error('Invalid data URL');
    }
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

interface CustomerDetailPanelProps {
    customer: Customer | null;
    leads: Lead[];
    allLeads: Lead[];
    allCustomers: Customer[];
    onClose: () => void;
    onSave: (customer: Customer, avatarFile: File | null) => Promise<any> | void;
    onUpdate: (customer: Customer, avatarFile: File | null, options?: { closePanel?: boolean }) => Promise<any> | void;
    currentUser: LoggedInUser;
    branches: Branch[];
    staff: Staff[];
    onSelectLead?: (lead: Lead) => void;
}


export const CustomerDetailPanel: React.FC<CustomerDetailPanelProps> = ({ customer, leads, allLeads, allCustomers, onClose, onSave, onUpdate, currentUser, branches, staff, onSelectLead }) => {
    const { fetchCustomerById } = useData();
    const isNewCustomer = !customer;
    const generateUsername = (name: string) => {
        const base = (name || 'customer').toLowerCase().replace(/\s+/g, '');
        const suffix = Math.random().toString(36).slice(-4);
        return `@${base}_${suffix}`;
    };
    const { addToast } = useToast();
    const { navigate } = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [editedCustomer, setEditedCustomer] = useState<Partial<Customer>>(
        customer || { salutation: 'Mr.', first_name: '', last_name: '', username: '', avatar_url: '', address: { street: '', city: '', state: '', zip: '', country: 'India' }, notes: [], activity: [], shared_with_branch_ids: [], documents: { passports: [], visas: [], aadhaarCards: [], panCards: [], bankStatements: [], otherDocuments: [] }, gst_number: '', pan_number: '', date_of_birth: null, passport_number: null, passport_expiry_date: null }
    );
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'leads' | 'notes' | 'activity' | 'documents'>('details');
    const [newNote, setNewNote] = useState('');
    const [isEditing, setIsEditing] = useState(isNewCustomer);
    const [docToEdit, setDocToEdit] = useState<{ doc: Document<any>, type: keyof CustomerDocuments } | null>(null);
    const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
    const [docTypeForCamera, setDocTypeForCamera] = useState<keyof CustomerDocuments | null>(null);
    const [avatarPreview, setAvatarPreview] = useState(customer?.avatar_url || '');

    const [isMentioning, setIsMentioning] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionableStaff, setMentionableStaff] = useState<Staff[]>([]);
    const [filteredMentionStaff, setFilteredMentionStaff] = useState<Staff[]>([]);
    const [currentMentions, setCurrentMentions] = useState<{ id: number; name: string }[]>([]);
    const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
    const branchDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const defaultCustomer = {
            salutation: 'Mr.', first_name: '', last_name: '', username: generateUsername('New Customer'), avatar_url: '',
            address: { street: '', city: '', state: '', zip: '', country: 'India' }, notes: [], activity: [], shared_with_branch_ids: [], gst_number: '', pan_number: '',
            added_by_branch_id: currentUser?.branch_id || 1,
            documents: { passports: [], visas: [], aadhaarCards: [], panCards: [], bankStatements: [], otherDocuments: [] },
            date_of_birth: null, passport_number: null, passport_expiry_date: null, passport_issue_date: null
        };

        // Always sync with the customer prop, especially after updates
        if (customer) {
            setEditedCustomer({
                ...defaultCustomer,
                ...customer,
                // Ensure date fields are preserved
                date_of_birth: customer.date_of_birth || null,
                passport_number: customer.passport_number || null,
                passport_expiry_date: customer.passport_expiry_date || null,
                passport_issue_date: customer.passport_issue_date || null,
            });
            setAvatarPreview(customer.avatar_url || '');
        } else {
            setEditedCustomer(defaultCustomer);
            setAvatarPreview('');
        }
        setAvatarFile(null);
        if (isNewCustomer) {
            setIsEditing(true);
            setActiveTab('details');
        } else {
            setIsEditing(false);
            setActiveTab('details');
        }
    }, [customer, isNewCustomer, currentUser]);

    // Load full customer (activity, documents) when opening existing customer from list (list may omit heavy fields)
    useEffect(() => {
        if (!customer?.id || isNewCustomer) return;
        const hasFull = Array.isArray((customer as any).activity) && (customer as any).documents != null;
        if (hasFull) return;
        let cancelled = false;
        (async () => {
            const full = await fetchCustomerById(customer.id);
            if (cancelled || !full) return;
            setEditedCustomer(prev => ({
                ...prev,
                ...full,
                activity: full.activity ?? prev?.activity ?? [],
                documents: full.documents ?? prev?.documents ?? { passports: [], visas: [], aadhaarCards: [], panCards: [], bankStatements: [], otherDocuments: [] },
            }));
        })();
        return () => { cancelled = true; };
    }, [customer?.id, isNewCustomer, fetchCustomerById]);

    useEffect(() => {
        if (!currentUser) return;
        setMentionableStaff(staff.filter(s => s.id !== currentUser.id));
    }, [currentUser, staff]);

    // Close branch dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (branchDropdownRef.current && !branchDropdownRef.current.contains(event.target as Node)) {
                setIsBranchDropdownOpen(false);
            }
        };
        if (isBranchDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isBranchDropdownOpen]);

    const handleBranchToggle = (branchId: number) => {
        const currentShared = new Set(editedCustomer.shared_with_branch_ids || []);
        const customerOwnerBranch = editedCustomer.added_by_branch_id;

        // Don't allow toggling the owner branch
        if (branchId === customerOwnerBranch) return;

        if (currentShared.has(branchId)) {
            currentShared.delete(branchId);
        } else {
            currentShared.add(branchId);
        }

        handleFieldChange('shared_with_branch_ids', Array.from(currentShared));
    };


    const handleFieldChange = (field: keyof Customer, value: any) => {
        setEditedCustomer(prev => ({ ...prev, [field]: value }));
        // Auto-enable edit mode when name fields are changed (if not already editing)
        if (!isEditing && (field === 'first_name' || field === 'last_name')) {
            setIsEditing(true);
        }
    };

    const handleAddressChange = (field: keyof Address, value: string) => {
        setEditedCustomer(prev => ({
            ...prev,
            address: { ...(prev.address as Address), [field]: value }
        }));
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

    const handleSaveClick = () => {
        if (!editedCustomer.first_name?.trim()) {
            addToast('First name is required.', 'error');
            return;
        }

        const hasEmail = !!editedCustomer.email?.trim();
        const phoneContent = (editedCustomer.phone || '').trim();
        const hasPhone = phoneContent.length > 4; // Check if phone has more than just the default country code (e.g. "+91 ")

        if (!hasEmail && !hasPhone) {
            addToast('Either Email or Phone number is required.', 'error');
            return;
        }

        const customerToSave = { ...editedCustomer };
        if (customerToSave.notes) {
            customerToSave.notes = customerToSave.notes.map(note => {
                const textMentions = (note.text.match(/@([\w\s]+)/g) || []).map(m => m.substring(1).trim());
                if (textMentions.length === 0) return note;
                const updatedMentions = [...(note.mentions || [])];
                const capturedMentionIds = new Set(updatedMentions.map(m => m.id));
                for (const name of textMentions) {
                    const mentionedStaff = staff.find(s => s.name.toLowerCase() === name.toLowerCase());
                    if (mentionedStaff && !capturedMentionIds.has(mentionedStaff.id)) {
                        updatedMentions.push({ id: mentionedStaff.id, name: mentionedStaff.name });
                        capturedMentionIds.add(mentionedStaff.id);
                    }
                }
                return { ...note, mentions: updatedMentions };
            });
        }

        if (isNewCustomer) {
            onSave(customerToSave as Customer, avatarFile);
        } else {
            onUpdate(customerToSave as Customer, avatarFile);
        }
    };

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
        if (mentionMatch && mentionMatch.index !== undefined) {
            const newText = text.substring(0, mentionMatch.index) + `@${staffMember.name} `;
            setNewNote(newText);
            setCurrentMentions(prev => [...prev, { id: staffMember.id, name: staffMember.name }]);
        }
        setIsMentioning(false);
    };

    const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isMentioning && filteredMentionStaff.length > 0) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(prev => (prev + 1) % filteredMentionStaff.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(prev => (prev - 1 + filteredMentionStaff.length) % filteredMentionStaff.length); }
            else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleSelectMention(filteredMentionStaff[mentionIndex]); }
            else if (e.key === 'Escape') { e.preventDefault(); setIsMentioning(false); }
        }
    };

    const handleAddNote = async () => {
        if (isNewCustomer) {
            addToast("Please save the customer before adding notes.", 'error');
            return;
        }
        if (newNote.trim() && currentUser && editedCustomer.id) {
            const note: Note = {
                id: Date.now(),
                text: newNote.trim(),
                date: new Date().toISOString(),
                addedBy: currentUser,
                mentions: currentMentions,
            };
            const activity: Activity = {
                id: Date.now() + 1,
                type: 'Note Added',
                description: `Added a new note: "${newNote.trim().substring(0, 50)}..."`,
                user: currentUser.name,
                timestamp: new Date().toISOString(),
            };

            const updatedNotes = [...(editedCustomer.notes || []), note];
            const updatedActivity = [activity, ...(editedCustomer.activity || [])];

            const customerToUpdate = { ...editedCustomer, notes: updatedNotes, activity: updatedActivity };

            const success = await onUpdate(customerToUpdate as Customer, null, { closePanel: false });

            if (success) {
                setNewNote('');
                setCurrentMentions([]);
            }
        }
    };

    const handleDeleteNote = async (noteId: number) => {
        if (isNewCustomer) return;
        const updatedNotes = (editedCustomer.notes || []).filter(n => n.id !== noteId);
        const activity: Activity = {
            id: Date.now(),
            type: 'Note Deleted',
            description: `A note was deleted.`,
            user: currentUser.name,
            timestamp: new Date().toISOString(),
        };
        const updatedActivity = [activity, ...(editedCustomer.activity || [])];
        const customerToUpdate = { ...editedCustomer, notes: updatedNotes, activity: updatedActivity };
        await onUpdate(customerToUpdate as Customer, null, { closePanel: false });
    };

    const renderNoteText = (note: Note): React.ReactNode => {
        if (!note.text) return null;
        if (!note.mentions || note.mentions.length === 0) {
            return <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words">{note.text}</p>;
        }
        const sortedMentions = [...note.mentions].sort((a, b) => b.name.length - a.name.length);
        const mentionPatterns = sortedMentions.map(m => `@${m.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).join('|');
        if (!mentionPatterns) return <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words">{note.text}</p>;

        const regex = new RegExp(`(${mentionPatterns})`, 'g');
        const parts = note.text.split(regex);

        return (
            <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words">
                {parts.filter(part => part).map((part, index) => {
                    const mention = sortedMentions.find(m => `@${m.name}` === part);
                    if (mention) {
                        return (
                            <a key={`${mention.id}-${index}`} href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); sessionStorage.setItem('viewStaffId', mention.id.toString()); navigate('/employees'); onClose(); }} className="font-bold text-blue-600 bg-blue-100 rounded px-1">{part}</a>
                        );
                    }
                    return <React.Fragment key={index}>{part}</React.Fragment>;
                })}
            </p>
        );
    };

    const handleDocUpload = (docType: keyof CustomerDocuments) => (e: React.ChangeEvent<HTMLInputElement>) => {
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
            const newFile: UploadedFile = { name: file.name, type: file.type, size: file.size, content: base64Content };
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
                const newDoc: Document<any> = { id: Date.now(), file: newFile, details: defaultDetails };
                const currentDocs = prev.documents || { passports: [], visas: [], aadhaarCards: [], panCards: [], bankStatements: [], otherDocuments: [] };
                const currentForType = currentDocs[docType] || [];
                return { ...prev, documents: { ...currentDocs, [docType]: [...currentForType, newDoc] } };
            });
            addToast(`${fileName} uploaded. Remember to save changes.`, 'success');
        };
        reader.onerror = () => addToast(`Failed to read file ${fileName}.`, 'error');
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleDocDelete = (docType: keyof CustomerDocuments) => (id: number) => {
        setEditedCustomer(prev => {
            if (!prev) return prev;
            const currentDocs = prev.documents || { passports: [], visas: [], aadhaarCards: [], panCards: [], bankStatements: [], otherDocuments: [] };
            const currentForType = (currentDocs[docType] || []) as Document<any>[];
            const updatedDocsForType = currentForType.filter((d) => d.id !== id);
            return { ...prev, documents: { ...currentDocs, [docType]: updatedDocsForType } };
        });
        addToast('Document removed. Remember to save changes.', 'success');
    };

    const handleDocEdit = (docType: keyof CustomerDocuments) => (doc: Document<any>) => {
        setDocToEdit({ doc, type: docType });
    };

    const handleSaveDocEdit = (updatedDoc: Document<any>) => {
        if (!docToEdit || !editedCustomer) return;
        const docType = docToEdit.type;
        const currentDocs = editedCustomer.documents || { passports: [], visas: [], aadhaarCards: [], panCards: [], bankStatements: [], otherDocuments: [] };
        const updatedDocsForType = (currentDocs[docType] || []).map((d: Document<any>) => d.id === updatedDoc.id ? updatedDoc : d);
        handleFieldChange('documents', { ...currentDocs, [docType]: updatedDocsForType });
        setDocToEdit(null);
        addToast('Document details updated.', 'success');
    };

    const handleOpenCamera = (docType: keyof CustomerDocuments) => {
        setDocTypeForCamera(docType);
        setIsCameraModalOpen(true);
    };

    const handleCapture = (file: File) => {
        if (!file || !docTypeForCamera) return;
        const mockEvent = {
            target: { files: [file] }
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleDocUpload(docTypeForCamera)(mockEvent);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-30" onClick={onClose} role="dialog" aria-modal="true">
            <div className="fixed inset-y-0 right-0 w-full max-w-full sm:max-w-2xl md:max-w-4xl bg-white shadow-xl flex flex-col min-h-0" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-3 sm:p-4 border-b h-14 sm:h-16 shrink-0">
                    <h2 className="text-base sm:text-lg font-semibold text-slate-800 truncate flex-1 min-w-0 mr-2">{isNewCustomer ? 'Add New Customer' : `${editedCustomer.first_name} ${editedCustomer.last_name}`}</h2>
                    <div className="flex items-center gap-2 shrink-0">
                        {!isNewCustomer && !isEditing && <button onClick={() => setIsEditing(true)} className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 min-h-[44px] sm:min-h-0 touch-manipulation">Edit</button>}
                        <button onClick={onClose} className="p-2.5 sm:p-1 rounded-full hover:bg-slate-100 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center" aria-label="Close"><IconX className="w-5 h-5 text-slate-600" /></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 bg-slate-50 min-h-0">
                    <div className="border-b border-gray-200 mb-4 sm:mb-6 bg-white -mx-4 sm:-mx-6 px-4 sm:px-6 -mt-4 sm:-mt-6 pt-2">
                        <nav className="-mb-px flex space-x-4 sm:space-x-6 overflow-x-auto pb-px scrollbar-thin" aria-label="Tabs">
                            <button onClick={() => setActiveTab('details')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm touch-manipulation ${activeTab === 'details' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Details</button>
                            {!isNewCustomer && <button onClick={() => setActiveTab('leads')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm touch-manipulation ${activeTab === 'leads' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Leads ({leads.length})</button>}
                            {!isNewCustomer && <button onClick={() => setActiveTab('notes')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm touch-manipulation ${activeTab === 'notes' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Notes</button>}
                            {!isNewCustomer && <button onClick={() => setActiveTab('activity')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm touch-manipulation ${activeTab === 'activity' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Activity</button>}
                            {!isNewCustomer && <button onClick={() => setActiveTab('documents')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm touch-manipulation ${activeTab === 'documents' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Documents</button>}
                        </nav>
                    </div>
                    {activeTab === 'details' && (
                        <div className="space-y-4 sm:space-y-6 bg-white p-4 sm:p-6 rounded-lg border border-slate-200">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                                <div className="relative group flex-shrink-0">
                                    <img src={avatarPreview || getDefaultAvatarUrl(`${editedCustomer.first_name} ${editedCustomer.last_name}`.trim() || 'Customer')} alt="Avatar" className="h-20 w-20 sm:h-24 sm:w-24 rounded-full object-cover bg-slate-100 border" />
                                    {isEditing && (
                                        <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-full shadow-md hover:bg-slate-100">
                                            <IconPencil className="w-4 h-4 text-slate-600" />
                                        </button>
                                    )}
                                    <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/png, image/jpeg, image/gif" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 w-full min-w-0">
                                    <InfoField label="Salutation" value={editedCustomer.salutation} isEditing={isEditing} onChange={e => handleFieldChange('salutation', e.target.value)} type="select" options={salutations} />
                                    <InfoField label="First Name" value={editedCustomer.first_name} isEditing={isEditing} onChange={e => handleFieldChange('first_name', e.target.value)} required={true} alwaysEditable={true} maxLength={50} />
                                    <InfoField label="Last Name" value={editedCustomer.last_name} isEditing={isEditing} onChange={e => handleFieldChange('last_name', e.target.value)} required={false} alwaysEditable={true} maxLength={50} />
                                </div>
                            </div>
                            <hr />
                            <h3 className="text-md font-semibold text-slate-700">Contact Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">
                                        Phone <span className="text-red-500">*</span>
                                    </label>
                                    <PhoneInput value={editedCustomer.phone || ''} onChange={val => handleFieldChange('phone', val)} isEditing={isEditing} />
                                </div>
                                <InfoField label="Email Address" value={editedCustomer.email} isEditing={isEditing} onChange={e => handleFieldChange('email', e.target.value)} type="email" />
                                <InfoField label="Company" value={editedCustomer.company} isEditing={isEditing} onChange={e => handleFieldChange('company', e.target.value)} />
                                <InfoField label="Nationality" value={editedCustomer.nationality} isEditing={isEditing} onChange={e => handleFieldChange('nationality', e.target.value)} />
                                {editedCustomer.company && editedCustomer.company.trim() && (
                                    <InfoField label="GST Number" value={editedCustomer.gst_number || ''} isEditing={isEditing} onChange={e => handleFieldChange('gst_number', e.target.value)} placeholder="e.g., 33AACCM4508J1Z2" />
                                )}
                                <InfoField label="PAN Number" value={editedCustomer.pan_number || ''} isEditing={isEditing} onChange={e => handleFieldChange('pan_number', e.target.value)} placeholder="e.g., ABCDE1234F" />
                            </div>
                            <hr />
                            <h3 className="text-md font-semibold text-slate-700">Passport & Personal Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Date of Birth</label>
                                    {isEditing ? (
                                        <input
                                            type="date"
                                            value={editedCustomer.date_of_birth || ''}
                                            onChange={e => handleFieldChange('date_of_birth', e.target.value || null)}
                                            className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900"
                                        />
                                    ) : (
                                        <div className="p-2 bg-slate-50 rounded-md text-sm text-slate-700 border">
                                            {editedCustomer.date_of_birth ? new Date(editedCustomer.date_of_birth).toLocaleDateString() : '—'}
                                        </div>
                                    )}
                                </div>
                                <InfoField label="Passport Number" value={editedCustomer.passport_number || ''} isEditing={isEditing} onChange={e => handleFieldChange('passport_number', e.target.value || null)} placeholder="e.g., A12345678" />
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Passport Expiry Date</label>
                                    {isEditing ? (
                                        <input
                                            type="date"
                                            value={editedCustomer.passport_expiry_date || ''}
                                            onChange={e => handleFieldChange('passport_expiry_date', e.target.value || null)}
                                            className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900"
                                        />
                                    ) : (
                                        <div className="p-2 bg-slate-50 rounded-md text-sm text-slate-700 border">
                                            {editedCustomer.passport_expiry_date ? new Date(editedCustomer.passport_expiry_date).toLocaleDateString() : '—'}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <hr />
                            {/* Share with Branches */}
                            {!isNewCustomer && (currentUser.role === 'Super Admin' || currentUser.branch_id === editedCustomer.added_by_branch_id) && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Shared with Branches</label>
                                    {isEditing ? (
                                        <div ref={branchDropdownRef} className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsBranchDropdownOpen(prev => !prev)}
                                                className="w-full text-left p-2 border rounded-md bg-slate-50 min-h-[40px]"
                                            >
                                                <span className="text-sm text-slate-700">
                                                    {(editedCustomer.shared_with_branch_ids || [])
                                                        .map(id => branches.find(b => b.id === id)?.name)
                                                        .filter(Boolean)
                                                        .join(', ') || 'Share with other branches...'}
                                                </span>
                                            </button>
                                            {isBranchDropdownOpen && (
                                                <div className="absolute top-full mt-1 w-full bg-white rounded-md shadow-lg border z-20 max-h-60 overflow-y-auto">
                                                    <ul>
                                                        {branches.map(branch => {
                                                            const isOwner = branch.id === editedCustomer.added_by_branch_id;
                                                            const isSelected = (editedCustomer.shared_with_branch_ids || []).includes(branch.id);
                                                            return (
                                                                <li
                                                                    key={branch.id}
                                                                    onClick={() => !isOwner && handleBranchToggle(branch.id)}
                                                                    className={`p-2 flex items-center justify-between ${isOwner
                                                                        ? 'opacity-60 cursor-not-allowed bg-slate-50'
                                                                        : 'hover:bg-slate-100 cursor-pointer'
                                                                        }`}
                                                                >
                                                                    <span className="text-sm text-slate-800">
                                                                        {branch.name} {isOwner && '(Owner)'}
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
                                            {(editedCustomer.shared_with_branch_ids || [])
                                                .map(id => branches.find(b => b.id === id)?.name)
                                                .filter(Boolean)
                                                .join(', ') || 'None'}
                                        </div>
                                    )}
                                </div>
                            )}
                            <hr />
                            <h3 className="text-md font-semibold text-slate-700">Address</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <InfoField label="Street" value={editedCustomer.address?.street} isEditing={isEditing} onChange={e => handleAddressChange('street', e.target.value)} />
                                </div>
                                <InfoField label="City" value={editedCustomer.address?.city} isEditing={isEditing} onChange={e => handleAddressChange('city', e.target.value)} />
                                <SelectWithManual label="Country" value={editedCustomer.address?.country || ''} onChange={v => handleAddressChange('country', v)} options={Object.keys(countryStateData)} isEditing={isEditing} selectPlaceholder="Select Country" placeholder="Type country" />
                                <SelectWithManual label="State" value={editedCustomer.address?.state || ''} onChange={v => handleAddressChange('state', v)} options={countryStateData[editedCustomer.address?.country || ''] || []} isEditing={isEditing} selectPlaceholder="Select State" placeholder="Type state" />
                                <InfoField label="ZIP Code" value={editedCustomer.address?.zip} isEditing={isEditing} onChange={e => handleAddressChange('zip', e.target.value)} />
                            </div>
                        </div>
                    )}
                    {activeTab === 'leads' && (
                        <div className="space-y-2">
                            {leads.map(lead => (
                                <div key={lead.id} onClick={() => { onSelectLead?.(lead); onClose(); }} className="p-4 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50">
                                    <p className="font-semibold text-slate-800">{lead.destination}</p>
                                    <p className="text-sm text-slate-500">Travel Date: {new Date(lead.travel_date).toLocaleDateString()}</p>
                                </div>
                            ))}
                            {leads.length === 0 && <p className="text-center text-slate-500 py-8">No leads found for this customer.</p>}
                        </div>
                    )}
                    {activeTab === 'notes' && (
                        <div className="space-y-4">
                            <div className="flex items-start space-x-3 w-full">
                                <img src={currentUser.avatar_url} alt={currentUser.name} className="h-8 w-8 rounded-full" />
                                <div className="flex-1 relative">
                                    <textarea value={newNote} onChange={handleNoteChange} onKeyDown={handleNoteKeyDown} placeholder="Add a new note... Type '@' to mention staff." className="w-full text-sm p-2 border rounded-md" rows={3}></textarea>
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
                                {(editedCustomer.notes || []).slice().reverse().map(note => (
                                    <div key={note.id} className="group p-4 bg-white rounded-md border shadow-sm relative">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                {renderNoteText(note)}
                                                <div className="flex items-center gap-2 mt-2">
                                                    <img src={note.addedBy.avatar_url} alt={note.addedBy.name} className="w-5 h-5 rounded-full" />
                                                    <p className="text-xs text-slate-600">{note.addedBy.name}</p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-400 flex-shrink-0 ml-4">{new Date(note.date).toLocaleDateString()}</p>
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
                    {activeTab === 'activity' && (
                        <ActivityTimeline activities={editedCustomer.activity || []} />
                    )}
                    {activeTab === 'documents' && (
                        <div className="space-y-4">
                            <DocumentSection title="Passports" documents={editedCustomer.documents?.passports || []} isEditing={isEditing} onFileUpload={handleDocUpload('passports')} onCameraScan={() => handleOpenCamera('passports')} onEdit={handleDocEdit('passports')} onDelete={handleDocDelete('passports')} />
                            <DocumentSection title="Visas" documents={editedCustomer.documents?.visas || []} isEditing={isEditing} onFileUpload={handleDocUpload('visas')} onCameraScan={() => handleOpenCamera('visas')} onEdit={handleDocEdit('visas')} onDelete={handleDocDelete('visas')} />
                            <DocumentSection title="Aadhaar Cards" documents={editedCustomer.documents?.aadhaarCards || []} isEditing={isEditing} onFileUpload={handleDocUpload('aadhaarCards')} onCameraScan={() => handleOpenCamera('aadhaarCards')} onEdit={handleDocEdit('aadhaarCards')} onDelete={handleDocDelete('aadhaarCards')} />
                            <DocumentSection title="PAN Cards" documents={editedCustomer.documents?.panCards || []} isEditing={isEditing} onFileUpload={handleDocUpload('panCards')} onCameraScan={() => handleOpenCamera('panCards')} onEdit={handleDocEdit('panCards')} onDelete={handleDocDelete('panCards')} />
                            <DocumentSection title="Bank Statements" documents={editedCustomer.documents?.bankStatements || []} isEditing={isEditing} onFileUpload={handleDocUpload('bankStatements')} onCameraScan={() => handleOpenCamera('bankStatements')} onEdit={handleDocEdit('bankStatements')} onDelete={handleDocDelete('bankStatements')} />
                            <DocumentSection title="Other Documents" documents={editedCustomer.documents?.otherDocuments || []} isEditing={isEditing} onFileUpload={handleDocUpload('otherDocuments')} onCameraScan={() => handleOpenCamera('otherDocuments')} onEdit={handleDocEdit('otherDocuments')} onDelete={handleDocDelete('otherDocuments')} />
                        </div>
                    )}
                </div>
                {isEditing && (
                    <div className="p-4 bg-white border-t">
                        <button onClick={handleSaveClick} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c]">
                            {isNewCustomer ? 'Save Customer' : 'Save Changes'}
                        </button>
                    </div>
                )}
                {docToEdit && <DocumentEditModal doc={docToEdit.doc} docType={docToEdit.type} onClose={() => setDocToEdit(null)} onSave={handleSaveDocEdit} />}
                {isCameraModalOpen && docTypeForCamera && (
                    <CameraScanModal
                        onCapture={handleCapture}
                        onClose={() => setIsCameraModalOpen(false)}
                        docType={docTypeForCamera}
                    />
                )}
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
            const file = dataURLtoFile(dataUrl, `${docType}_${new Date().toISOString()}.jpg`);
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