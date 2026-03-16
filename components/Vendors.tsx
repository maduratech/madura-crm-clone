import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Supplier, Branch, LoggedInUser, Lead, Customer, Destination } from '../types';
import { IconSearch, IconPlus, IconX, IconPencil, IconTrash } from '../constants';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { useData } from '../contexts/DataProvider';
import { useRouter } from '../contexts/RouterProvider';
import { PhoneInput } from './CustomerDetailPanel';

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
    const { navigate } = useRouter();

    if (leads.length === 0) {
        return <p className="text-center text-slate-500 py-4">No associated leads found.</p>;
    }

    return (
        <ul className="space-y-3">
            {leads.map(lead => {
                const customer = customerMap.get(lead.customer_id);
                return (
                    <li 
                        key={lead.id} 
                        className="p-3 bg-slate-50 rounded-md border cursor-pointer hover:bg-slate-100 hover:border-blue-500 transition-colors"
                        onClick={() => {
                            sessionStorage.setItem('viewLeadId', lead.id.toString());
                            navigate('/leads/all');
                        }}
                    >
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

const VerifiedTickIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
    <div className={`flex-shrink-0 ${className} bg-blue-600 rounded-full flex items-center justify-center text-white`} title="Verified Supplier">
        <svg className="w-3/5 h-3/5" fill="none" viewBox="0 0 12 12" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2 7l3 3 5-7" />
        </svg>
    </div>
);


const SUPPLIER_CATEGORIES: string[] = [
    'Airlines',
    'Cruises',
    'International Accommodation',
    'Domestic Accommodation',
    'Online Travel Portal (OTA)',
    'Indian DMC Partner',
    'International DMC Partner',
    'Indian Ground Transportation (Car Rentals, Rail, Bus)',
    'International Ground Transportation (Car Rentals, Rail, Bus)',
    'International Activities/Excursions',
    'Indian Activities/Excursions',
    'Travel Technology/Software',
    'Supplier (General)',
];

// Detail panel for adding/editing a supplier
const SupplierDetailPanel: React.FC<{
    supplier: Supplier | null;
    branches: Branch[];
    onClose: () => void;
    onSave: (supplier: Partial<Supplier>, avatarFile: File | null, visitingCardFile: File | null) => Promise<boolean>;
    onToggleStatus: (supplierId: number, newStatus: 'Active' | 'Inactive') => void;
    currentUser: LoggedInUser;
    leads: Lead[];
    customers: Customer[];
    destinations: Destination[];
}> = ({ supplier, branches, onClose, onSave, onToggleStatus, currentUser, leads, customers, destinations }) => {
    const isNew = !supplier;
    const { addToast } = useToast();
    
    const [editedSupplier, setEditedSupplier] = useState<Partial<Supplier>>(
        supplier || {
            company_name: '',
            email: '',
            phone: '',
            contact_person_name: '',
            contact_person_phone: '',
            contact_person_avatar_url: '',
            status: 'Active',
            branch_id: currentUser.branch_id,
            destinations: '',
            is_verified: false,
            category: '',
            location: '',
            website: '',
            b2b_login_credentials: '',
            contract_link: '',
            notes: '',
            visiting_card_url: '',
        }
    );
    const [isEditing, setIsEditing] = useState(isNew);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState(supplier?.contact_person_avatar_url || '');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'leads'>('details');
    const [visitingCardFile, setVisitingCardFile] = useState<File | null>(null);
    const [selectedDestinations, setSelectedDestinations] = useState<string[]>(
        (supplier?.destinations || '')
            .split(',')
            .map(d => d.trim())
            .filter(Boolean)
    );
    const [destinationSearch, setDestinationSearch] = useState('');


    useEffect(() => {
        const defaultSupplier: Partial<Supplier> = {
            company_name: '',
            email: '',
            phone: '',
            contact_person_name: '',
            contact_person_phone: '',
            contact_person_avatar_url: '',
            status: 'Active',
            branch_id: currentUser.branch_id,
            destinations: '',
            is_verified: false,
            category: '',
            location: '',
            website: '',
            b2b_login_credentials: '',
            contract_link: '',
            notes: '',
            visiting_card_url: '',
        };
        setEditedSupplier(supplier || defaultSupplier);
        setAvatarPreview(supplier?.contact_person_avatar_url || '');
        setAvatarFile(null);
        setVisitingCardFile(null);
        setIsEditing(isNew);
        setActiveTab('details');
        setSelectedDestinations(
            (supplier?.destinations || '')
                .split(',')
                .map(d => d.trim())
                .filter(Boolean)
        );
        setDestinationSearch('');
    }, [supplier, isNew, currentUser.branch_id]);

    const associatedLeads = useMemo(() => {
        if (!supplier) return [];
        return leads.filter(lead => lead.assigned_suppliers?.some(s => s.id === supplier.id));
    }, [leads, supplier]);

    const handleFieldChange = (field: keyof Supplier, value: string | number | boolean) => {
        setEditedSupplier(prev => ({ ...prev, [field]: value }));
    };

    const handleDestinationInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
            e.preventDefault();
            const value = destinationSearch.trim();
            if (!value) return;
            if (!selectedDestinations.includes(value)) {
                setSelectedDestinations(prev => [...prev, value]);
            }
            setDestinationSearch('');
        }
    };

    const handleRemoveDestination = (name: string) => {
        setSelectedDestinations(prev => prev.filter(d => d !== name));
    };

    const filteredDestinationSuggestions = useMemo(() => {
        const term = destinationSearch.toLowerCase().trim();
        if (!term) {
            // Show suggestions only after user starts typing
            return [];
        }
        return destinations
            .filter(
                d =>
                    d.name.toLowerCase().includes(term) ||
                    (d.slug && d.slug.toLowerCase().includes(term))
            )
            .slice(0, 20);
    }, [destinations, destinationSearch]);

    const handleVisitingCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            addToast('Visiting card file must be less than 2MB.', 'error');
            return;
        }
        setVisitingCardFile(file);
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

    const handleSave = async () => {
        if (!editedSupplier.company_name?.trim()) {
            addToast('Supplier / Company Name is required.', 'error');
            return;
        }
        if (!editedSupplier.email?.trim()) {
            addToast('Primary Contact Email Address is required.', 'error');
            return;
        }
        if (!editedSupplier.phone?.trim()) {
            addToast('Business Phone Number is required.', 'error');
            return;
        }
        if (!editedSupplier.category?.trim()) {
            addToast('Supplier Category is required.', 'error');
            return;
        }
        if (!editedSupplier.location?.trim()) {
            addToast('Location / City / Country is required.', 'error');
            return;
        }

        setIsSaving(true);
        try {
            const supplierToSave: Partial<Supplier> = {
                ...editedSupplier,
                destinations: selectedDestinations.join(', '),
            };
            const success = await onSave(supplierToSave, avatarFile, visitingCardFile);
            if (success) {
                onClose();
            }
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-20" onClick={onClose}>
            <div className="fixed inset-y-0 right-0 w-full sm:w-full md:max-w-lg bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b h-16">
                    <h2 className="text-lg font-semibold text-slate-800">{isNew ? 'Add New Supplier' : 'Supplier Details'}</h2>
                    <div className="flex items-center gap-2">
                        {!isNew && !isEditing && (
                          <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-[5px] hover:bg-slate-200"><IconPencil className="w-4 h-4"/> Edit</button>
                        )}
                         {!isNew && supplier?.status === 'Active' && (
                          <button onClick={() => onToggleStatus(supplier.id, 'Inactive')} className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-[5px] hover:bg-red-100"><IconTrash className="w-4 h-4"/> Deactivate</button>
                        )}
                        {!isNew && supplier?.status === 'Inactive' && (
                             <button onClick={() => onToggleStatus(supplier.id, 'Active')} className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 border border-green-200 rounded-[5px] hover:bg-green-200">Reactivate</button>
                        )}
                        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><IconX className="w-5 h-5 text-slate-600" /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                     <div className="border-b border-gray-200 mb-6 bg-white -mx-6 px-6 -mt-6 pt-2 sticky top-0 z-10">
                        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                            <button onClick={() => setActiveTab('details')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'details' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Details</button>
                            {!isNew && <button onClick={() => setActiveTab('leads')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'leads' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Associated Leads ({associatedLeads.length})</button>}
                        </nav>
                    </div>

                    {activeTab === 'details' && (
                        <div className="space-y-6 bg-white p-6 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-4">
                                <div>
                                    {!isEditing ? (
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xl font-bold text-slate-800">{editedSupplier.company_name}</h3>
                                            {editedSupplier.is_verified && <VerifiedTickIcon />}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-500">
                                            Enter the supplier's details below.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <hr/>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div className="md:col-span-2">
                                    <InfoField
                                        label="Supplier / Company Name *"
                                        value={editedSupplier.company_name}
                                        isEditing={isEditing}
                                        onChange={e => handleFieldChange('company_name', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">
                                        Supplier Category *
                                    </label>
                                    {isEditing ? (
                                        <select
                                            className="w-full text-sm p-2 border rounded-md bg-slate-50 text-slate-900"
                                            value={editedSupplier.category || ''}
                                            onChange={e => handleFieldChange('category', e.target.value)}
                                        >
                                            <option value="">Select Category</option>
                                            {SUPPLIER_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <p className="text-base text-slate-900 font-medium py-2 min-h-[40px]">
                                            {editedSupplier.category || 'N/A'}
                                        </p>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <InfoField
                                        label="Location / City / Country *"
                                        value={editedSupplier.location}
                                        isEditing={isEditing}
                                        onChange={e => handleFieldChange('location', e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <InfoField
                                        label="Website / Portal Link"
                                        value={editedSupplier.website}
                                        isEditing={isEditing}
                                        onChange={e => handleFieldChange('website', e.target.value)}
                                    />
                                </div>
                                <InfoField
                                    label="Primary Contact Email Address *"
                                    value={editedSupplier.email}
                                    isEditing={isEditing}
                                    onChange={e => handleFieldChange('email', e.target.value)}
                                />
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">
                                        Business Phone Number (with Country Code) *
                                    </label>
                                    <PhoneInput
                                        value={editedSupplier.phone || ''}
                                        onChange={value => handleFieldChange('phone', value)}
                                        isEditing={isEditing}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                    Key Destinations / Services Provided
                                </label>
                                <p className="text-[11px] text-slate-500 mb-1">
                                    Select destinations or type notes like “Transfers in Bali”, “4-star hotels in Kerala”.
                                </p>
                                {isEditing ? (
                                    <div className="border border-slate-200 rounded-md p-2 bg-slate-50">
                                        <div className="flex flex-wrap gap-1 mb-2">
                                            {selectedDestinations.map(dest => (
                                                <span
                                                    key={dest}
                                                    className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-100"
                                                >
                                                    {dest}
                                                    <button
                                                        type="button"
                                                        className="ml-1 text-blue-500 hover:text-blue-700"
                                                        onClick={() => handleRemoveDestination(dest)}
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                            {selectedDestinations.length === 0 && (
                                                <span className="text-xs text-slate-400">
                                                    No destinations selected.
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={destinationSearch}
                                            onChange={e => setDestinationSearch(e.target.value)}
                                            onKeyDown={handleDestinationInputKeyDown}
                                            placeholder="Type to search or add destination..."
                                            className="w-full text-sm p-2 border rounded-md bg-white text-slate-900"
                                        />
                                        {filteredDestinationSuggestions.length > 0 && (
                                            <div className="mt-2 max-h-40 overflow-y-auto border border-slate-200 rounded-md bg-white">
                                                {filteredDestinationSuggestions.map(dest => (
                                                    <button
                                                        key={dest.id}
                                                        type="button"
                                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50"
                                                        onClick={() => {
                                                            if (!selectedDestinations.includes(dest.name)) {
                                                                setSelectedDestinations(prev => [...prev, dest.name]);
                                                            }
                                                        }}
                                                    >
                                                        {dest.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="py-2">
                                        <DestinationBadges
                                            destinations={selectedDestinations.join(', ')}
                                        />
                                    </div>
                                )}
                            </div>

                            <hr />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div className="md:col-span-2">
                                    <InfoField
                                        label="B2B Login Credentials (If applicable)"
                                        value={editedSupplier.b2b_login_credentials}
                                        isEditing={isEditing}
                                        onChange={e => handleFieldChange('b2b_login_credentials', e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <InfoField
                                        label="Contract / Tariff Link"
                                        value={editedSupplier.contract_link}
                                        isEditing={isEditing}
                                        onChange={e => handleFieldChange('contract_link', e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">
                                        Notes / Remarks
                                    </label>
                                    {isEditing ? (
                                        <textarea
                                            className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
                                            value={editedSupplier.notes || ''}
                                            onChange={e => handleFieldChange('notes', e.target.value)}
                                        />
                                    ) : (
                                        <p className="text-base text-slate-900 font-medium py-2 min-h-[40px] whitespace-pre-line">
                                            {editedSupplier.notes || 'N/A'}
                                        </p>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">
                                        Visiting Card
                                    </label>
                                    <div className="flex items-center gap-3">
                                        {isEditing && (
                                            <input
                                                type="file"
                                                accept="image/*,application/pdf"
                                                onChange={handleVisitingCardChange}
                                                className="text-xs"
                                            />
                                        )}
                                        {editedSupplier.visiting_card_url && (
                                            <a
                                                href={editedSupplier.visiting_card_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-600 hover:underline"
                                            >
                                                View current visiting card
                                            </a>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Upload supplier business card (max 2MB). Existing card will be kept if you don’t upload a new one.
                                    </p>
                                </div>
                            </div>
                            
                            <hr />
                            
                            <h3 className="text-md font-semibold text-slate-700">Contact Person</h3>
                            <div className="flex items-center gap-4">
                                <div className="relative group flex-shrink-0">
                                    <img src={avatarPreview || `https://avatar.iran.liara.run/public/boy?username=${editedSupplier.contact_person_name}`} alt="Avatar" className="h-20 w-20 rounded-full object-cover bg-slate-100 border"/>
                                    {isEditing && (
                                        <button 
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isSaving}
                                            className="absolute -bottom-1 -right-1 p-1.5 bg-white rounded-full shadow-md hover:bg-slate-100"
                                        >
                                            {isSaving ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> : <IconPencil className="w-4 h-4 text-slate-600"/>}
                                        </button>
                                    )}
                                    <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/png, image/jpeg, image/gif" />
                                </div>
                                <div className="flex-1 grid grid-cols-1 gap-x-6 gap-y-4">
                                    <InfoField
                                        label="Primary Contact Name"
                                        value={editedSupplier.contact_person_name}
                                        isEditing={isEditing}
                                        onChange={e => handleFieldChange('contact_person_name', e.target.value)}
                                    />
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">
                                            Primary Contact Phone
                                        </label>
                                        <PhoneInput
                                            value={editedSupplier.contact_person_phone || ''}
                                            onChange={value => handleFieldChange('contact_person_phone', value)}
                                            isEditing={isEditing}
                                        />
                                    </div>
                                </div>
                            </div>

                             {isEditing && currentUser.role === 'Super Admin' && (
                                <>
                                <hr/>
                                <div>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!!editedSupplier.is_verified}
                                            onChange={e => handleFieldChange('is_verified', e.target.checked)}
                                            className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="font-medium text-slate-700">Mark as Verified Supplier</span>
                                    </label>
                                </div>
                                </>
                             )}

                        </div>
                    )}
                    {activeTab === 'leads' && (
                         <div className="bg-white p-4 rounded-lg border border-slate-200">
                            <AssociatedLeadsList leads={associatedLeads} customers={customers} />
                        </div>
                    )}
                </div>

                {isEditing && (
                    <div className="p-4 bg-white border-t">
                        <button onClick={handleSave} disabled={isSaving} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c] disabled:bg-slate-400">
                            {isSaving ? 'Saving...' : (isNew ? 'Save Supplier' : 'Save Changes')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const InfoField: React.FC<{ label: string; value: string | number | undefined; isEditing: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; readOnly?: boolean; }> = 
({ label, value, isEditing, onChange, readOnly = false }) => (
    <div>
        <label className="block text-xs font-medium text-slate-500 capitalize mb-1">{label}</label>
        {isEditing ? (
            <input
                type="text"
                value={value || ''}
                onChange={onChange}
                readOnly={readOnly}
                className={`w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${readOnly ? 'bg-slate-100 cursor-not-allowed text-slate-500' : ''}`}
            />
        ) : (
            <p className="text-base text-slate-900 font-medium py-2 min-h-[40px]">{value || 'N/A'}</p>
        )}
    </div>
);

const DestinationBadges: React.FC<{ destinations?: string }> = ({ destinations = '' }) => {
    if (!destinations) return <span className="text-slate-400">N/A</span>;

    const MAX_BADGES = 2;
    const allDestinations = destinations.split(',').map(d => d.trim()).filter(Boolean);
    const displayedDestinations = allDestinations.slice(0, MAX_BADGES);
    const remainingCount = allDestinations.length - MAX_BADGES;

    return (
        <div className="flex flex-wrap gap-1 items-center">
            {displayedDestinations.map(dest => (
                <span key={dest} className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-600">
                    {dest}
                </span>
            ))}
            {remainingCount > 0 && (
                 <div className="relative group">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-200 text-slate-700 cursor-pointer">
                        +{remainingCount}
                    </span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs text-white bg-slate-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                        {allDestinations.join(', ')}
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
                    </div>
                </div>
            )}
        </div>
    );
};


const Suppliers: React.FC<{currentUser: LoggedInUser}> = ({ currentUser }) => {
    const { suppliers, branches, leads, customers, destinations, refreshData } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('');
    const [destinationFilter, setDestinationFilter] = useState<string>('');
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'Active' | 'Inactive'>('Active');
    const { addToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const importInputRef = useRef<HTMLInputElement | null>(null);

    const filteredSuppliers = useMemo(() => {
        return suppliers
            .filter(s => s.status === activeTab)
            .filter(s => {
                const searchPool = `${s.company_name} ${s.email} ${s.phone} ${s.contact_person_name} ${s.destinations} ${s.category || ''} ${s.location || ''} ${s.website || ''}`.toLowerCase();
                return searchPool.includes(searchTerm.toLowerCase());
            })
            .filter(s => !categoryFilter || s.category === categoryFilter)
            .filter(s => {
                if (!destinationFilter.trim()) return true;
                const dests = (s.destinations || '').toLowerCase();
                return dests.includes(destinationFilter.toLowerCase());
            });
    }, [suppliers, searchTerm, activeTab, categoryFilter, destinationFilter]);

    useEffect(() => {
        setSelectedSupplierIds([]);
    }, [activeTab, searchTerm, categoryFilter, destinationFilter]);

    const handleSelectSupplier = (supplier: Supplier) => {
        setSelectedSupplier(supplier);
        setIsPanelOpen(true);
    };

    const handleAddNew = () => {
        setSelectedSupplier(null);
        setIsPanelOpen(true);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedSupplier(null);
    };

    const handleSaveSupplier = async (supplierToSave: Partial<Supplier>, avatarFile: File | null, visitingCardFile: File | null): Promise<boolean> => {
        setIsSaving(true);
        try {
            let avatarUrl = supplierToSave.contact_person_avatar_url || '';
            let visitingCardUrl = supplierToSave.visiting_card_url || '';

            if (avatarFile) {
                const filePath = `public/supplier-avatars/${currentUser.user_id}/${Date.now()}-${avatarFile.name}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true, cacheControl: '3600' });
                if (uploadError) throw uploadError;
                
                const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                avatarUrl = `${data.publicUrl}?t=${new Date().getTime()}`;
            }

            if (visitingCardFile) {
                const visitingPath = `public/supplier-visiting-cards/${currentUser.user_id}/${Date.now()}-${visitingCardFile.name}`;
                const { error: visitingUploadError } = await supabase.storage.from('avatars').upload(visitingPath, visitingCardFile, { upsert: true, cacheControl: '3600' });
                if (visitingUploadError) throw visitingUploadError;

                const { data: visitingData } = supabase.storage.from('avatars').getPublicUrl(visitingPath);
                visitingCardUrl = `${visitingData.publicUrl}?t=${new Date().getTime()}`;
            }

            if (supplierToSave.id) { // UPDATE
                const finalUpdateData = { ...supplierToSave, contact_person_avatar_url: avatarUrl, visiting_card_url: visitingCardUrl };
                delete finalUpdateData.id;
    
                const { error } = await supabase.from('suppliers').update(finalUpdateData).eq('id', supplierToSave.id);
                if (error) throw error;
                addToast('Supplier updated successfully.', 'success');
    
            } else { // CREATE
                const supplierDataForDb = {
                    ...supplierToSave,
                    contact_person_avatar_url: avatarUrl,
                    visiting_card_url: visitingCardUrl,
                    created_by_staff_id: currentUser.id,
                    created_at: new Date().toISOString(),
                };
    
                const { error } = await supabase.from('suppliers').insert(supplierDataForDb);
                if (error) throw error;
                addToast('Supplier created successfully!', 'success');
            }
            await refreshData();
            return true;
        } catch (error: any) {
             addToast(error.message || 'An unexpected error occurred.', 'error');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleSupplierStatus = async (supplierId: number, newStatus: 'Active' | 'Inactive') => {
        const { error } = await supabase.from('suppliers').update({ status: newStatus }).eq('id', supplierId);
        if (error) {
            addToast(error.message, 'error');
            return;
        }
        await refreshData();
        addToast(`Supplier status updated to ${newStatus.toLowerCase()}.`, 'success');
        handleClosePanel();
    };

    const handleDeleteSelected = async () => {
        if (selectedSupplierIds.length === 0) return;

        const { error } = await supabase.from('suppliers').delete().in('id', selectedSupplierIds);

        if (error) {
            addToast(`Error deleting suppliers: ${error.message}. They may have associated leads.`, 'error');
        } else {
            addToast(`${selectedSupplierIds.length} supplier(s) deleted successfully.`, 'success');
            await refreshData();
            setSelectedSupplierIds([]);
        }
        setShowDeleteConfirm(false);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedSupplierIds(filteredSuppliers.map(s => s.id));
        } else {
            setSelectedSupplierIds([]);
        }
    };

    const handleSelectOne = (supplierId: number) => {
        if (selectedSupplierIds.includes(supplierId)) {
            setSelectedSupplierIds(selectedSupplierIds.filter(id => id !== supplierId));
        } else {
            setSelectedSupplierIds([...selectedSupplierIds, supplierId]);
        }
    };

    const handleExportCsv = () => {
        if (suppliers.length === 0) {
            addToast('No suppliers to export.', 'error');
            return;
        }
        const header = [
            'Supplier / Company Name',
            'Supplier Category',
            'Primary Contact Name',
            'Primary Contact Email Address',
            'Business Phone Number',
            'City / Country',
            'Website / Portal Link',
            'Key Destinations / Services Provided',
            'B2B Login Credentials',
            'Contract / Tariff Link',
            'Notes / Remarks'
        ];
        const escapeCsv = (value: string | number | null | undefined) => {
            const v = (value ?? '').toString();
            if (v.includes('"') || v.includes(',') || v.includes('\n')) {
                return `"${v.replace(/"/g, '""')}"`;
            }
            return v;
        };
        const rows = suppliers.map(s => [
            s.company_name,
            s.category || '',
            s.contact_person_name || '',
            s.email || '',
            s.phone || '',
            s.location || '',
            s.website || '',
            s.destinations || '',
            s.b2b_login_credentials || '',
            s.contract_link || '',
            s.notes || ''
        ]);
        const csv = [
            header.join(','),
            ...rows.map(r => r.map(escapeCsv).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `suppliers-${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast('Suppliers exported as CSV.', 'success');
    };

    const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
            if (lines.length < 2) {
                addToast('CSV file is empty or invalid.', 'error');
                return;
            }
            const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const idx = (name: string) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());

            const nameIdx = idx('Supplier / Company Name');
            const categoryIdx = idx('Supplier Category');
            const contactNameIdx = idx('Primary Contact Name');
            const emailIdx = idx('Primary Contact Email Address');
            const phoneIdx = idx('Business Phone Number');
            const locationIdx = idx('City / Country');
            const websiteIdx = idx('Website / Portal Link');
            const destinationsIdx = idx('Key Destinations / Services Provided');
            const b2bIdx = idx('B2B Login Credentials');
            const contractIdx = idx('Contract / Tariff Link');
            const notesIdx = idx('Notes / Remarks');

            if (nameIdx === -1 || emailIdx === -1 || phoneIdx === -1 || categoryIdx === -1 || locationIdx === -1) {
                addToast('Required columns missing. Please use the exported CSV template.', 'error');
                return;
            }

            const parseCell = (row: string[], index: number) => {
                if (index < 0 || index >= row.length) return '';
                const raw = row[index].trim();
                if (raw.startsWith('"') && raw.endsWith('"')) {
                    return raw.slice(1, -1).replace(/""/g, '"');
                }
                return raw;
            };

            const newSuppliers: Partial<Supplier>[] = [];
            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].split(',');
                const company_name = parseCell(row, nameIdx);
                if (!company_name) continue;
                const email = parseCell(row, emailIdx);
                const phone = parseCell(row, phoneIdx);
                const category = parseCell(row, categoryIdx);
                const location = parseCell(row, locationIdx);
                if (!email || !phone || !category || !location) continue;

                newSuppliers.push({
                    company_name,
                    category,
                    contact_person_name: parseCell(row, contactNameIdx),
                    email,
                    phone,
                    location,
                    website: parseCell(row, websiteIdx),
                    destinations: parseCell(row, destinationsIdx),
                    b2b_login_credentials: parseCell(row, b2bIdx),
                    contract_link: parseCell(row, contractIdx),
                    notes: parseCell(row, notesIdx),
                    status: 'Active',
                    branch_id: currentUser.branch_id,
                    created_by_staff_id: currentUser.id,
                    created_at: new Date().toISOString(),
                    contact_person_avatar_url: '',
                } as Partial<Supplier>);
            }

            if (newSuppliers.length === 0) {
                addToast('No valid supplier rows found in CSV.', 'error');
                return;
            }

            const { error } = await supabase.from('suppliers').insert(newSuppliers);
            if (error) {
                addToast(error.message || 'Failed to import suppliers.', 'error');
                return;
            }
            await refreshData();
            addToast(`Imported ${newSuppliers.length} supplier(s) from CSV.`, 'success');
        } catch (err: any) {
            addToast(err?.message || 'Failed to read CSV file.', 'error');
        } finally {
            if (importInputRef.current) {
                importInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="flex h-full">
            <div className="flex-1 flex flex-col">
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                        <h1 className="text-lg sm:text-xl font-bold text-slate-800">Suppliers</h1>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                            {selectedSupplierIds.length > 0 ? (
                                <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-[5px] hover:bg-red-700 min-h-[44px] sm:min-h-0">
                                    <IconTrash className="w-4 h-4" />
                                    Delete ({selectedSupplierIds.length})
                                </button>
                            ) : (
                                <div className="relative w-full sm:w-64">
                                    <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by name, email..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-9 sm:pl-10 pr-4 py-2 w-full sm:w-64 text-sm bg-white border text-slate-900 border-slate-300 rounded-md min-h-[44px] sm:min-h-0"
                                    />
                                </div>
                            )}
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <select
                                        className="w-full sm:w-48 text-xs sm:text-sm p-2 border rounded-md bg-white text-slate-900"
                                        value={categoryFilter}
                                        onChange={e => setCategoryFilter(e.target.value)}
                                    >
                                        <option value="">All Categories</option>
                                        {SUPPLIER_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="Filter by destination"
                                        value={destinationFilter}
                                        onChange={e => setDestinationFilter(e.target.value)}
                                        className="w-full sm:w-48 text-xs sm:text-sm p-2 border rounded-md bg-white text-slate-900"
                                    />
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                        type="button"
                                        onClick={handleExportCsv}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 rounded-[5px] hover:bg-slate-200 min-h-[36px]"
                                    >
                                        Export CSV
                                    </button>
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => importInputRef.current?.click()}
                                            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 rounded-[5px] hover:bg-slate-200 min-h-[36px]"
                                        >
                                            Import CSV
                                        </button>
                                        <input
                                            type="file"
                                            ref={importInputRef}
                                            accept=".csv,text/csv"
                                            className="hidden"
                                            onChange={handleImportCsv}
                                        />
                                    </div>
                                    <button onClick={handleAddNew} className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#191974] rounded-[5px] hover:bg-[#13135c] min-h-[44px] sm:min-h-0">
                                        <IconPlus className="w-4 h-4" />
                                        <span className="hidden sm:inline">New Supplier</span>
                                        <span className="sm:hidden">New</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="border-b border-slate-200 overflow-x-auto scrollbar-hide">
                        <nav className="-mb-px flex space-x-4 sm:space-x-6 min-w-max" aria-label="Tabs">
                            <button onClick={() => setActiveTab('Active')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-xs sm:text-sm ${activeTab === 'Active' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Active</button>
                            <button onClick={() => setActiveTab('Inactive')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-xs sm:text-sm ${activeTab === 'Inactive' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Inactive</button>
                        </nav>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-500">
                            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                <tr>
                                    <th className="p-4 w-4">
                                        <input type="checkbox" onChange={handleSelectAll} checked={filteredSuppliers.length > 0 && selectedSupplierIds.length === filteredSuppliers.length} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/>
                                    </th>
                                    <th className="px-6 py-3">Supplier / Company Name</th>
                                    <th className="px-6 py-3">Supplier Category</th>
                                    <th className="px-6 py-3">Location / City / Country</th>
                                    <th className="px-6 py-3">Contact Person</th>
                                    <th className="px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSuppliers.map(supplier => {
                                    return (
                                        <tr key={supplier.id} className="bg-white border-b hover:bg-slate-50">
                                            <td className="p-4 w-4">
                                                <input type="checkbox" checked={selectedSupplierIds.includes(supplier.id)} onChange={() => handleSelectOne(supplier.id)} onClick={e => e.stopPropagation()} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/>
                                            </td>
                                            <td onClick={() => handleSelectSupplier(supplier)} className="px-6 py-4 cursor-pointer">
                                                <div className="font-semibold text-slate-800 flex items-center gap-2">
                                                    {supplier.company_name}
                                                    {supplier.is_verified && <VerifiedTickIcon className="w-4 h-4" />}
                                                </div>
                                                <div className="text-xs text-slate-500">{supplier.email}</div>
                                            </td>
                                            <td onClick={() => handleSelectSupplier(supplier)} className="px-6 py-4 cursor-pointer">
                                                <span className="text-slate-800 text-sm">{supplier.category || 'N/A'}</span>
                                            </td>
                                            <td onClick={() => handleSelectSupplier(supplier)} className="px-6 py-4 cursor-pointer">
                                                <span className="text-slate-800 text-sm">{supplier.location || 'N/A'}</span>
                                            </td>
                                            <td onClick={() => handleSelectSupplier(supplier)} className="px-6 py-4 cursor-pointer">
                                                <div className="flex items-center">
                                                    <div className="relative flex-shrink-0">
                                                        <img src={supplier.contact_person_avatar_url || `https://avatar.iran.liara.run/public`} alt={supplier.contact_person_name} className="h-9 w-9 rounded-full object-cover"/>
                                                        {supplier.is_verified && (
                                                            <div className="absolute bottom-0 right-0 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white">
                                                                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2 7l3 3 5-7" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="ml-3">
                                                        <div className="font-semibold text-slate-800">{supplier.contact_person_name}</div>
                                                        <div className="text-xs text-slate-500">{supplier.contact_person_phone}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td onClick={() => handleSelectSupplier(supplier)} className="px-6 py-4 cursor-pointer">
                                                <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${supplier.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {supplier.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3 mt-3">
                        {filteredSuppliers.map(supplier => {
                            return (
                                <div key={supplier.id} onClick={() => handleSelectSupplier(supplier)} className="bg-white border border-slate-200 rounded-lg p-4 cursor-pointer hover:bg-slate-50">
                                    <div className="flex items-start gap-3">
                                        <input type="checkbox" checked={selectedSupplierIds.includes(supplier.id)} onChange={() => handleSelectOne(supplier.id)} onClick={e => e.stopPropagation()} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-1 flex-shrink-0" />
                                        <div className="relative flex-shrink-0">
                                            <img src={supplier.contact_person_avatar_url || `https://avatar.iran.liara.run/public`} alt={supplier.contact_person_name} className="h-12 w-12 rounded-full object-cover"/>
                                            {supplier.is_verified && (
                                                <div className="absolute bottom-0 right-0 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center border-2 border-white">
                                                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2 7l3 3 5-7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-slate-800 text-sm mb-1 flex items-center gap-2">
                                                {supplier.company_name}
                                                {supplier.is_verified && <VerifiedTickIcon className="w-3 h-3" />}
                                            </div>
                                            <div className="text-xs text-slate-500 mb-1 truncate">
                                                {supplier.category || 'No category'}
                                            </div>
                                            <div className="text-xs text-slate-500 mb-2 truncate">
                                                {supplier.location || 'No location'}
                                            </div>
                                            <div className="space-y-1 text-xs">
                                                <div className="text-slate-600">
                                                    Contact: <span className="font-medium">{supplier.contact_person_name}</span>
                                                </div>
                                                {supplier.contact_person_phone && (
                                                    <div className="text-slate-600">{supplier.contact_person_phone}</div>
                                                )}
                                                <div className="mt-2">
                                                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${supplier.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        {supplier.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredSuppliers.length === 0 && <div className="text-center py-10 text-slate-500">No suppliers found.</div>}
                    </div>
                </div>
            </div>
            {isPanelOpen && (
                <SupplierDetailPanel
                    supplier={selectedSupplier}
                    branches={branches}
                    onClose={handleClosePanel}
                    onSave={handleSaveSupplier}
                    onToggleStatus={handleToggleSupplierStatus}
                    currentUser={currentUser}
                    leads={leads}
                    customers={customers}
                    destinations={destinations}
                />
            )}
            {showDeleteConfirm && (
                <ConfirmationModal 
                    title="Confirm Deletion"
                    message={`Are you sure you want to delete ${selectedSupplierIds.length} supplier(s)? This may fail if they have associated leads. This action cannot be undone.`}
                    onConfirm={handleDeleteSelected}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </div>
    );
};

export default Suppliers;