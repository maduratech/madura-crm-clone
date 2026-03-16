import React, { useState, useMemo, useRef, useEffect } from 'react';
// Fix: Added missing 'Staff' and 'Notification' imports to resolve type errors.
import { Customer, LoggedInUser, Branch, Note, Staff, Activity, Address } from '../types';
import { IconSearch, IconPlus, IconFilter, IconChevronDown, IconTrash } from '../constants';
import { CustomerDetailPanel } from './CustomerDetailPanel';
import { useData } from '../contexts/DataProvider';
import { useToast } from './ToastProvider';
import { supabase } from '../lib/supabase';
import { getDefaultAvatarUrl } from '../lib/avatarUrl';

interface CustomersPageProps {
    currentUser: LoggedInUser;
}

const ConfirmationModal: React.FC<{ title: string; message: string; onConfirm: () => void; onCancel: () => void; }> = ({ title, message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-3 sm:p-5 w-full max-w-[95vw] sm:max-w-sm">
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-slate-600 my-3">{message}</p>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-3 py-1.5 text-xs rounded-md border">Cancel</button>
                <button onClick={onConfirm} className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white">Confirm</button>
            </div>
        </div>
    </div>
);


// --- Helper Icons ---
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
const SortIcon: React.FC<{ direction: 'asc' | 'desc' | null }> = ({ direction }) => {
    if (!direction) return <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>;
    if (direction === 'asc') return <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>;
    return <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>;
};

// --- Sub-components ---

type SortableKeys = 'first_name' | 'company' | 'date_added';
type SortConfig = { key: SortableKeys; direction: 'asc' | 'desc' } | null;

const CustomersTable: React.FC<{
    customers: Customer[];
    onSelectCustomer: (customer: Customer) => void;
    onSort: (key: SortableKeys) => void;
    sortConfig: SortConfig;
    selectedIds: number[];
    onSelectionChange: (ids: number[]) => void;
}> = ({ customers, onSelectCustomer, onSort, sortConfig, selectedIds, onSelectionChange }) => {

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            onSelectionChange(customers.map(c => c.id));
        } else {
            onSelectionChange([]);
        }
    };

    const handleSelectOne = (customerId: number) => {
        if (selectedIds.includes(customerId)) {
            onSelectionChange(selectedIds.filter(id => id !== customerId));
        } else {
            onSelectionChange([...selectedIds, customerId]);
        }
    };

    const SortableHeader: React.FC<{ label: string, sortKey: SortableKeys }> = ({ label, sortKey }) => (
        <th className="px-3 sm:px-6 py-3 cursor-pointer" onClick={() => onSort(sortKey)}>
            <div className="flex items-center gap-2">
                {label}
                <SortIcon direction={sortConfig?.key === sortKey ? sortConfig.direction : null} />
            </div>
        </th>
    );

    return (
        <div className="overflow-x-auto -mx-3 sm:mx-0" style={{ minHeight: 0 }}>
            <table className="w-full text-xs sm:text-sm text-left text-slate-500 min-w-[640px]">
                <thead className="text-[10px] sm:text-xs text-slate-700 uppercase bg-slate-50">
                    <tr>
                        <th className="p-2 sm:p-4 w-10 sm:w-4">
                            <input type="checkbox" onChange={handleSelectAll} checked={customers.length > 0 && selectedIds.length === customers.length} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" aria-label="Select all" />
                        </th>
                        <SortableHeader label="Added On" sortKey="date_added" />
                        <SortableHeader label="Name" sortKey="first_name" />
                        <SortableHeader label="Company" sortKey="company" />
                        <th className="px-3 sm:px-6 py-3">Contact</th>
                        <th className="px-3 sm:px-6 py-3">Added By</th>
                    </tr>
                </thead>
                <tbody>
                    {customers.map(customer => (
                        <tr key={customer.id} className="bg-white border-b hover:bg-slate-50">
                            <td className="p-2 sm:p-4 w-10 sm:w-4">
                                <input type="checkbox" checked={selectedIds.includes(customer.id)} onChange={() => handleSelectOne(customer.id)} onClick={e => e.stopPropagation()} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" aria-label={`Select ${customer.first_name}`} />
                            </td>
                            <td onClick={() => onSelectCustomer(customer)} className="px-3 sm:px-6 py-3 sm:py-4 cursor-pointer whitespace-nowrap">
                                {customer.date_added ? (() => {
                                    const date = new Date(customer.date_added);
                                    return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
                                })() : 'N/A'}
                            </td>
                            <td onClick={() => onSelectCustomer(customer)} className="px-3 sm:px-6 py-3 sm:py-4 cursor-pointer">
                                <div className="flex items-center min-w-0">
                                    <img src={customer.avatar_url || getDefaultAvatarUrl(`${customer.first_name} ${customer.last_name}`.trim() || 'Customer', 36)} alt={customer.first_name} className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover mr-2 sm:mr-3 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-slate-800 truncate max-w-[120px] sm:max-w-xs">{customer.first_name} {customer.last_name}</div>
                                        <div className="text-xs text-slate-500 truncate max-w-[120px] sm:max-w-xs">{customer.username}</div>
                                    </div>
                                </div>
                            </td>
                            <td onClick={() => onSelectCustomer(customer)} className="px-3 sm:px-6 py-3 sm:py-4 cursor-pointer max-w-[100px] sm:max-w-none truncate" title={customer.company || undefined}>{customer.company || 'N/A'}</td>
                            <td onClick={() => onSelectCustomer(customer)} className="px-3 sm:px-6 py-3 sm:py-4 cursor-pointer">
                                <div className="truncate max-w-[140px] sm:max-w-none">{customer.email}</div>
                                <div className="text-xs text-slate-500 truncate max-w-[140px] sm:max-w-none">{customer.phone}</div>
                            </td>
                            <td onClick={() => onSelectCustomer(customer)} className="px-3 sm:px-6 py-3 sm:py-4 cursor-pointer truncate max-w-[80px] sm:max-w-none">{customer.addedBy?.name || 'System'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const CustomerCard: React.FC<{ customer: Customer; onSelect: () => void; isSelected: boolean; onToggleSelect: () => void; }> = ({ customer, onSelect, isSelected, onToggleSelect }) => (
    <div onClick={onSelect} className={`relative bg-white p-3 sm:p-4 rounded-lg shadow-sm border hover:shadow-md hover:border-blue-500 cursor-pointer transition-all min-h-[72px] sm:min-h-[88px] flex items-center ${isSelected ? 'border-blue-500 ring-2 ring-blue-500' : ''}`}>
        <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            onClick={e => e.stopPropagation()}
            className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 h-4 w-4 sm:h-5 sm:w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 touch-manipulation"
            aria-label={`Select ${customer.first_name}`}
        />
        <div className="flex items-center gap-2.5 sm:gap-4 pr-7 sm:pr-8 min-w-0">
            <img src={customer.avatar_url || getDefaultAvatarUrl(`${customer.first_name} ${customer.last_name}`.trim() || 'Customer', 48)} alt={customer.first_name} className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover flex-shrink-0" />
            <div className="flex-1 overflow-hidden min-w-0">
                <p className="font-semibold text-xs sm:text-sm text-slate-800 truncate">{customer.first_name} {customer.last_name}</p>
                <p className="text-[11px] sm:text-sm text-slate-500 truncate">{customer.email}</p>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{customer.company || 'No company'}</p>
            </div>
        </div>
    </div>
);

const CustomersGrid: React.FC<{ customers: Customer[]; onSelectCustomer: (customer: Customer) => void; selectedIds: number[]; onSelectionChange: (ids: number[]) => void; }> = ({ customers, onSelectCustomer, selectedIds, onSelectionChange }) => {

    const handleSelectOne = (customerId: number) => {
        if (selectedIds.includes(customerId)) {
            onSelectionChange(selectedIds.filter(id => id !== customerId));
        } else {
            onSelectionChange([...selectedIds, customerId]);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {customers.map(customer => (
                <CustomerCard
                    key={customer.id}
                    customer={customer}
                    onSelect={() => onSelectCustomer(customer)}
                    isSelected={selectedIds.includes(customer.id)}
                    onToggleSelect={() => handleSelectOne(customer.id)}
                />
            ))}
        </div>
    );
};

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
        <div className="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2 mt-3 pt-2.5 border-t border-slate-200">
            <p className="text-[11px] sm:text-xs text-slate-600 shrink-0">
                <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>–<span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-medium">{totalItems}</span>
            </p>
            <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-600">
                    <span className="whitespace-nowrap">Rows:</span>
                    <select
                        value={itemsPerPage}
                        onChange={e => onItemsPerPageChange(Number(e.target.value))}
                        className="p-1.5 border rounded-md bg-white focus:ring-blue-500 focus:border-blue-500 text-xs min-h-[40px] sm:min-h-0"
                    >
                        {[25, 50, 75, 100].map(size => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-1.5">
                    <button onClick={handlePrev} disabled={currentPage === 1} className="px-2.5 py-2 sm:py-1 text-xs border rounded-md disabled:opacity-50 min-h-[40px] sm:min-h-0 touch-manipulation">Prev</button>
                    <button onClick={handleNext} disabled={currentPage === totalPages} className="px-2.5 py-2 sm:py-1 text-xs border rounded-md disabled:opacity-50 min-h-[40px] sm:min-h-0 touch-manipulation">Next</button>
                </div>
            </div>
        </div>
    );
};

const Customers: React.FC<CustomersPageProps> = ({ currentUser }) => {
    const { customers, leads, branches, staff, refreshData } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
        if (typeof window === 'undefined') return 'list';
        return window.matchMedia('(max-width: 767px)').matches ? 'grid' : 'list';
    });
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filters, setFilters] = useState({ branchIds: [] as number[] });
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date_added', direction: 'desc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const filterRef = useRef<HTMLDivElement>(null);
    const { addToast } = useToast();
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const isPrivilegedUser = currentUser.role === 'Super Admin' || currentUser.role === 'Manager';

    const handleAddNew = () => {
        setSelectedCustomer(null);
        setIsPanelOpen(true);
    };

    const handleSelectCustomer = (customer: Customer) => {
        setSelectedCustomer(customer);
        setIsPanelOpen(true);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedCustomer(null);
    };

    useEffect(() => {
        // Keep selected customer in sync with the master list from DataProvider
        if (isPanelOpen && selectedCustomer && customers.length > 0) {
            const updatedCustomer = customers.find(c => c.id === selectedCustomer.id);
            if (updatedCustomer && JSON.stringify(updatedCustomer) !== JSON.stringify(selectedCustomer)) {
                setSelectedCustomer(updatedCustomer);
            } else if (!updatedCustomer) {
                // Customer was deleted or is no longer in the visible list
                handleClosePanel();
            }
        }
    }, [customers, selectedCustomer, isPanelOpen]);

    useEffect(() => {
        const customerIdToView = sessionStorage.getItem('viewCustomerId');
        if (customerIdToView && customers.length > 0) {
            sessionStorage.removeItem('viewCustomerId');
            const customer = customers.find(c => c.id === parseInt(customerIdToView, 10));
            if (customer) {
                handleSelectCustomer(customer);
            }
        }

        const action = sessionStorage.getItem('action');
        if (action === 'new-customer') {
            sessionStorage.removeItem('action');
            handleAddNew();
        }
    }, [customers]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const sortedAndFilteredCustomers = useMemo(() => {
        let filtered = customers.filter(c => {
            const searchPool = `${c.first_name} ${c.last_name} ${c.email} ${c.phone} ${c.company}`.toLowerCase();
            const searchMatch = searchPool.includes(searchTerm.toLowerCase());
            const branchMatch = filters.branchIds.length === 0 || filters.branchIds.includes(c.added_by_branch_id);
            return searchMatch && branchMatch;
        });

        if (sortConfig !== null) {
            filtered.sort((a, b) => {
                if (sortConfig.key === 'date_added') {
                    const aDate = new Date(a.date_added).getTime();
                    const bDate = new Date(b.date_added).getTime();
                    return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
                }
                const aValue = a[sortConfig.key] || '';
                const bValue = b[sortConfig.key] || '';
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [customers, searchTerm, filters, sortConfig]);

    const paginatedCustomers = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedAndFilteredCustomers.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedAndFilteredCustomers, currentPage, itemsPerPage]);

    useEffect(() => {
        setSelectedCustomerIds([]);
    }, [currentPage, filters, searchTerm, itemsPerPage]);

    const handleSort = (key: SortableKeys) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleFilterChange = (branchId: number) => {
        setFilters(prev => {
            const newBranchIds = prev.branchIds.includes(branchId)
                ? prev.branchIds.filter(id => id !== branchId)
                : [...prev.branchIds, branchId];
            return { ...prev, branchIds: newBranchIds };
        });
        setCurrentPage(1); // Reset page on filter change
    };

    const handleItemsPerPageChange = (size: number) => {
        setItemsPerPage(size);
        setCurrentPage(1);
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

    const handleUpdateCustomer = async (customerToUpdate: Customer, avatarFile: File | null, options: { closePanel?: boolean } = { closePanel: true }): Promise<boolean> => {
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

        // Do not update username on edit (unique constraint); it is set only at creation. Prevents duplicate key when changing phone etc.
        delete (updateData as any).username;

        // Sanitize potentially empty date strings to null (but keep valid dates)
        // Handle both string dates and Date objects
        const sanitizeDate = (date: any): string | null => {
            if (!date) return null;
            if (typeof date === 'string') {
                return date.trim() !== '' ? date : null;
            }
            if (date instanceof Date) {
                return date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
            }
            return null;
        };
        
        updateData.date_of_birth = sanitizeDate(updateData.date_of_birth);
        updateData.passport_issue_date = sanitizeDate(updateData.passport_issue_date);
        updateData.passport_expiry_date = sanitizeDate(updateData.passport_expiry_date);

        // Debug: Log the date values being sent
        console.log('[Customer Update] Date values:', {
            date_of_birth: updateData.date_of_birth,
            passport_expiry_date: updateData.passport_expiry_date,
            passport_issue_date: updateData.passport_issue_date
        });

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

        const { error, data } = await supabase.from('customers').update(updateData).eq('id', customerToUpdate.id).select('id, date_of_birth, passport_number, passport_expiry_date, passport_issue_date').single();
        if (error) {
            console.error('[Customer Update] Supabase error:', error);
            console.error('[Customer Update] Update data sent:', updateData);
            addToast(`Error updating customer: ${error.message}`, 'error');
            return false;
        } else {
            console.log('[Customer Update] Success - customer updated:', customerToUpdate.id);
            console.log('[Customer Update] Returned data from Supabase:', data);
            if (options.closePanel) {
                addToast('Customer updated successfully.', 'success');
            }
            // Force refresh to get updated data
            await refreshData();
            // Also update the selected customer if panel is open
            if (!options.closePanel && selectedCustomer && selectedCustomer.id === customerToUpdate.id) {
                const updatedCustomer = { ...selectedCustomer, ...data };
                setSelectedCustomer(updatedCustomer);
            }
            if (options.closePanel) {
                handleClosePanel();
            }
            return true;
        }
    };

    const handleSaveNewCustomer = async (customerToSave: Customer, avatarFile: File | null) => {
        const { addedBy, ...customerData } = customerToSave;
        const generateUsername = (name: string) => {
            const base = (name || 'customer').toLowerCase().replace(/\s+/g, '');
            const suffix = Math.random().toString(36).slice(-4);
            return `@${base}_${suffix}`;
        };

        const creationActivity: Activity = {
            id: Date.now(),
            type: 'Customer Created',
            description: `New customer profile created for ${customerToSave.first_name} ${customerToSave.last_name}.`,
            user: currentUser.name,
            timestamp: new Date().toISOString(),
        };

        const newCustomer = {
            ...customerData,
            activity: [creationActivity, ...(customerData.activity || [])],
            username: generateUsername(customerToSave.first_name),
            avatar_url: getDefaultAvatarUrl('New Customer', 128), // Placeholder
            added_by_id: currentUser.id,
            date_added: new Date().toISOString(),
            added_by_branch_id: currentUser.branch_id,
        };

        // Sanitize potentially empty date strings to null (but keep valid dates)
        const sanitizeDate = (date: any): string | null => {
            if (!date) return null;
            if (typeof date === 'string') {
                return date.trim() !== '' ? date : null;
            }
            if (date instanceof Date) {
                return date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
            }
            return null;
        };
        
        newCustomer.date_of_birth = sanitizeDate(newCustomer.date_of_birth);
        newCustomer.passport_issue_date = sanitizeDate(newCustomer.passport_issue_date);
        newCustomer.passport_expiry_date = sanitizeDate(newCustomer.passport_expiry_date);

        const { data, error } = await supabase.from('customers').insert(newCustomer).select().single();
        if (error) {
            addToast(`Error creating customer: ${error.message}`, 'error');
            return;
        }

        if (avatarFile) {
            try {
                const filePath = `public/customer-avatars/${data.id}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                const finalAvatarUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;

                const { error: updateError } = await supabase.from('customers').update({ avatar_url: finalAvatarUrl }).eq('id', data.id);
                if (updateError) throw updateError;

                addToast('New customer with profile picture created successfully.', 'success');
            } catch (uploadError: any) {
                addToast(`Customer created, but avatar upload failed: ${uploadError.message}`, 'error');
            }
        } else {
            addToast('New customer created successfully.', 'success');
        }

        await refreshData();
        handleClosePanel();
    };

    const handleDeleteSelected = async () => {
        if (selectedCustomerIds.length === 0) return;

        const { error } = await supabase.from('customers').delete().in('id', selectedCustomerIds);

        if (error) {
            addToast(`Error deleting customers: ${error.message}. They may have associated leads.`, 'error');
        } else {
            addToast(`${selectedCustomerIds.length} customer(s) deleted successfully.`, 'success');
            await refreshData();
            setSelectedCustomerIds([]);
        }
        setShowDeleteConfirm(false);
    };

    const customerLeads = useMemo(() => {
        if (!selectedCustomer) return [];
        return leads.filter(l => l.customer_id === selectedCustomer.id);
    }, [selectedCustomer, leads]);

    return (
        <div className="flex h-full flex-col md:flex-row min-h-0">
            <div className="flex-1 flex flex-col min-w-0">
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm flex flex-col min-h-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                        <h1 className="text-sm sm:text-base font-bold text-slate-800 shrink-0">Customers ({sortedAndFilteredCustomers.length})</h1>
                        <div className="flex flex-wrap items-center gap-2">
                            {selectedCustomerIds.length > 0 ? (
                                isPrivilegedUser && (
                                    <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 min-h-[40px] sm:min-h-0">
                                        <IconTrash className="w-3.5 h-3.5" />
                                        Delete ({selectedCustomerIds.length})
                                    </button>
                                )
                            ) : (
                                <div className="relative flex-1 sm:flex-initial min-w-0 sm:min-w-[10rem]">
                                    <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        placeholder="Search by name, email..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="pl-8 sm:pl-9 pr-2.5 py-2 w-full sm:w-56 text-xs sm:text-sm bg-white border text-slate-900 border-slate-300 rounded-md focus:ring-2 focus:ring-[#191974] focus:border-[#191974]"
                                    />
                                </div>
                            )}
                            <button onClick={handleAddNew} className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[#191974] rounded-md hover:bg-[#13135c] shrink-0" aria-label="New Customer">
                                <IconPlus className="w-4 h-4" />
                                New Customer
                            </button>
                            <div className="relative flex-shrink-0">
                                <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="p-2 sm:p-1.5 text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 relative min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center">
                                    <IconFilter className="w-4 h-4 sm:w-5 sm:h-5" />
                                    {filters.branchIds.length > 0 && <span className="absolute top-1 right-1 sm:-top-0.5 sm:-right-0.5 block h-1.5 w-1.5 rounded-full bg-blue-500 ring-2 ring-white"></span>}
                                </button>
                                {isFilterOpen && (
                                    <div ref={filterRef} className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-56 max-w-sm bg-white rounded-lg shadow-lg border z-10 p-3 max-h-[70vh] overflow-y-auto">
                                        <h3 className="text-xs font-semibold mb-2 text-black">Filter by Branch</h3>
                                        <div className="space-y-1.5">
                                            {branches.map(branch => (
                                                <label key={branch.id} className="flex items-center text-xs cursor-pointer py-1">
                                                    <input type="checkbox" checked={filters.branchIds.includes(branch.id)} onChange={() => handleFilterChange(branch.id)} className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 bg-white" />
                                                    <span className="ml-2 text-slate-700">{branch.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border w-fit">
                                <button onClick={() => setViewMode('list')} className={`p-1.5 sm:p-1.5 rounded-md min-h-[40px] sm:min-h-0 ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-slate-500'}`} aria-label="List view"><IconListView className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                                <button onClick={() => setViewMode('grid')} className={`p-1.5 sm:p-1.5 rounded-md min-h-[40px] sm:min-h-0 ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-slate-500'}`} aria-label="Grid view"><IconGridView className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto -mx-3 sm:mx-0 px-3 sm:px-0">
                        {paginatedCustomers.length > 0 ? (
                            viewMode === 'list' ? (
                                <CustomersTable customers={paginatedCustomers} onSelectCustomer={handleSelectCustomer} onSort={handleSort} sortConfig={sortConfig} selectedIds={selectedCustomerIds} onSelectionChange={setSelectedCustomerIds} />
                            ) : (
                                <CustomersGrid customers={paginatedCustomers} onSelectCustomer={handleSelectCustomer} selectedIds={selectedCustomerIds} onSelectionChange={setSelectedCustomerIds} />
                            )
                        ) : (
                            <div className="text-center py-8 text-slate-500 text-xs sm:text-sm">No customers found.</div>
                        )}
                    </div>
                    {/* Mobile: floating New Customer button (desktop uses toolbar button) */}
                    <button
                        onClick={handleAddNew}
                        className="fixed bottom-5 right-5 z-20 w-14 h-14 flex sm:hidden items-center justify-center rounded-full bg-[#191974] text-white shadow-lg hover:bg-[#13135c] active:scale-95 transition-transform touch-manipulation"
                        aria-label="New Customer"
                    >
                        <IconPlus className="w-7 h-7" />
                    </button>
                    <Pagination
                        currentPage={currentPage}
                        totalItems={sortedAndFilteredCustomers.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={handleItemsPerPageChange}
                    />
                </div>
            </div>
            {isPanelOpen && (
                <CustomerDetailPanel
                    customer={selectedCustomer}
                    leads={customerLeads}
                    allLeads={leads}
                    allCustomers={customers}
                    onClose={handleClosePanel}
                    onSave={handleSaveNewCustomer}
                    onUpdate={handleUpdateCustomer}
                    currentUser={currentUser}
                    branches={branches}
                    staff={staff}
                />
            )}
            {showDeleteConfirm && (
                <ConfirmationModal
                    title="Confirm Deletion"
                    message={`Are you sure you want to delete ${selectedCustomerIds.length} customer(s)? This may fail if they have associated leads. This action cannot be undone.`}
                    onConfirm={handleDeleteSelected}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </div>
    );
};

export default Customers;