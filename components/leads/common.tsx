import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Lead, Note, Staff, LeadStatus, Customer, Activity, HotelPreference, StayPreference, Service, Branch, CustomerDocuments, UploadedFile, PassportDetails, AadhaarDetails, Itinerary, LoggedInUser, CostingOption, TourType, PanDetails, OtherDocDetails, Document, VisaDetails, BankStatementDetails, LeadType, ItineraryMetadata, Supplier, TourTypeDisplay, InvoiceStatus, InvoiceItem, Invoice, Flight, Priority, TourRegion, LeadSource, LeadSourceDisplay } from '../../types';
import { Page } from '../../types';
import { IconSearch, IconPlus, IconX, IconFilter, IconPencil, IconChevronDown, IconTrash, IconChatBubble, IconEye, IconRefresh, IconDownload, IconInfo } from '../../constants';
import { useToast } from '../ToastProvider';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataProvider';
import { useAuth } from '../../contexts/AuthProvider';
import { AuthApiError } from '@supabase/supabase-js';
import { useRouter } from '../../contexts/RouterProvider';
import { LeadDetailPanel } from '../Leads';

const ConfirmationModal: React.FC<{ title: string; message: string; onConfirm: () => void; onCancel: () => void; }> = ({ title, message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-[calc(100vw-2rem)] sm:max-w-sm">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-slate-600 my-4">{message}</p>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-4 py-2 text-sm rounded-md border">Cancel</button>
                <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-md bg-red-600 text-white">Confirm</button>
            </div>
        </div>
    </div>
);

const ITEMS_PER_PAGE = 50;

type SortableKeys = 'created_at' | 'destination' | 'travel_date' | 'priority';
type SortConfig = { key: SortableKeys; direction: 'asc' | 'desc' } | null;


const getStatusClass = (status: LeadStatus) => {
    switch (status) {
        case LeadStatus.Confirmed:
        case LeadStatus.Completed:
        case LeadStatus.BillingCompletion:
            return 'bg-green-100 text-green-800';
        case LeadStatus.Enquiry:
        case LeadStatus.Processing:
        case LeadStatus.OperationsInitiated:
            return 'bg-blue-100 text-blue-800';
        case LeadStatus.Voucher:
        case LeadStatus.OnTour:
        case LeadStatus.Invoicing:
            return 'bg-purple-100 text-purple-800';
        case LeadStatus.Rejected:
        case LeadStatus.NotAttended:
            return 'bg-red-100 text-red-800';
        case LeadStatus.Unqualified:
        case LeadStatus.Feedback:
            return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-slate-100 text-slate-800';
    }
};

const getPriorityClass = (priority?: Priority) => {
    switch (priority) {
        case Priority.High: return 'bg-red-100 text-red-800';
        case Priority.Medium: return 'bg-yellow-100 text-yellow-800';
        case Priority.Low: return 'bg-blue-100 text-blue-800';
        default: return 'bg-slate-100 text-slate-800';
    }
};

const StatusBadge: React.FC<{ status: LeadStatus }> = ({ status }) => (
    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusClass(status)}`}>
        {status}
    </span>
);

const PriorityBadge: React.FC<{ priority?: Priority }> = ({ priority }) => (
    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getPriorityClass(priority)}`}>
        {priority || 'N/A'}
    </span>
);

const AssignedToAvatars: React.FC<{ assignees: Staff[] }> = ({ assignees }) => {
    if (!assignees || assignees.length === 0) {
        return (
            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600" title="Unassigned">U</div>
        );
    }

    return (
        <div className="relative group">
            <div className="flex -space-x-3 cursor-pointer">
                {assignees.slice(0, 3).map((staff, index) => (
                    <img
                        key={staff.id}
                        className="h-8 w-8 rounded-full border-2 border-white"
                        src={staff.avatar_url}
                        alt={staff.name}
                        title={staff.name}
                        style={{ zIndex: assignees.length - index }}
                    />
                ))}
                {assignees.length > 3 && (
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 border-2 border-white" style={{ zIndex: 0 }}>
                        +{assignees.length - 3}
                    </div>
                )}
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-sm p-2 bg-slate-800 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                <ul className="space-y-2">
                    {assignees.map(staff => (
                        <li key={staff.id} className="flex items-center gap-2">
                            <img
                                className="h-6 w-6 rounded-full"
                                src={staff.avatar_url}
                                alt={staff.name}
                            />
                            <span className="text-xs whitespace-nowrap">{staff.name}</span>
                        </li>
                    ))}
                </ul>
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
            </div>
        </div>
    );
};

const AssignedSuppliersAvatars: React.FC<{ suppliers: Supplier[] }> = ({ suppliers }) => {
    if (!suppliers || suppliers.length === 0) {
        return <div className="text-slate-400 text-xs">None</div>;
    }

    return (
        <div className="relative group">
            <div className="flex -space-x-3 cursor-pointer">
                {suppliers.slice(0, 3).map((supplier, index) => (
                    <img
                        key={supplier.id}
                        className="h-8 w-8 rounded-full border-2 border-white object-cover"
                        src={supplier.contact_person_avatar_url || `https://avatar.iran.liara.run/public/boy?username=${supplier.company_name}`}
                        alt={supplier.company_name}
                        title={supplier.company_name}
                        style={{ zIndex: suppliers.length - index }}
                    />
                ))}
                {suppliers.length > 3 && (
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 border-2 border-white" style={{ zIndex: 0 }}>
                        +{suppliers.length - 3}
                    </div>
                )}
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-sm p-2 bg-slate-800 text-white rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                <ul className="space-y-2">
                    {suppliers.map(supplier => (
                        <li key={supplier.id} className="flex items-center gap-2">
                            <img
                                className="h-6 w-6 rounded-full object-cover"
                                src={supplier.contact_person_avatar_url || `https://avatar.iran.liara.run/public/boy?username=${supplier.company_name}`}
                                alt={supplier.company_name}
                            />
                            <span className="text-xs whitespace-nowrap">{supplier.company_name}</span>
                        </li>
                    ))}
                </ul>
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div>
            </div>
        </div>
    );
};

const Pagination: React.FC<{ currentPage: number; totalItems: number; itemsPerPage: number; onPageChange: (page: number) => void }> = ({ currentPage, totalItems, itemsPerPage, onPageChange }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    const handlePrev = () => onPageChange(Math.max(1, currentPage - 1));
    const handleNext = () => onPageChange(Math.min(totalPages, currentPage + 1));

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
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

const SortIcon: React.FC<{ direction: 'asc' | 'desc' | null }> = ({ direction }) => {
    if (!direction) return <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" /></svg>;
    if (direction === 'asc') return <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>;
    return <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>;
};

const BookingsTable: React.FC<{ leads: Lead[], customers: Map<number, Customer>, onSelectLead: (lead: Lead) => void, onSort: (key: SortableKeys) => void, sortConfig: SortConfig, selectedLeadIds: number[], onSelectionChange: (ids: number[]) => void, isHQ: boolean }> = ({ leads, customers, onSelectLead, onSort, sortConfig, selectedLeadIds, onSelectionChange, isHQ }) => {

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            onSelectionChange(leads.map(l => l.id));
        } else {
            onSelectionChange([]);
        }
    };

    const handleSelectOne = (leadId: number) => {
        if (selectedLeadIds.includes(leadId)) {
            onSelectionChange(selectedLeadIds.filter(id => id !== leadId));
        } else {
            onSelectionChange([...selectedLeadIds, leadId]);
        }
    };

    const SortableHeader: React.FC<{ label: string, sortKey: SortableKeys }> = ({ label, sortKey }) => (
        <th className="px-3 sm:px-4 py-2 sm:py-3 cursor-pointer whitespace-nowrap" onClick={() => onSort(sortKey)}>
            <div className="flex items-center gap-2">
                {label}
                <SortIcon direction={sortConfig?.key === sortKey ? sortConfig.direction : null} />
            </div>
        </th>
    );
    return (
        <div className="overflow-x-auto min-h-0 -mx-4 sm:mx-0">
            <table className="w-full text-sm text-left text-slate-500 min-w-[700px]">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 sticky top-0 z-[1]">
                    <tr>
                        <th className="p-3 sm:p-4 w-10 sm:w-4">
                            <input type="checkbox" onChange={handleSelectAll} checked={leads.length > 0 && selectedLeadIds.length === leads.length} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        </th>
                        <SortableHeader label="Lead Added date" sortKey="created_at" />
                        <th className="px-3 sm:px-4 py-2 sm:py-3">Customer</th>
                        <SortableHeader label="Destination" sortKey="destination" />
                        <SortableHeader label="Travel Date" sortKey="travel_date" />
                        <SortableHeader label="Priority" sortKey="priority" />
                        <th className="px-3 sm:px-4 py-2 sm:py-3">Status</th>
                        <th className="px-3 sm:px-4 py-2 sm:py-3">Assigned Staff</th>
                    </tr>
                </thead>
                <tbody>
                    {leads.map(lead => {
                        const customer = customers.get(lead.customer_id);
                        return (
                            <tr key={lead.id} className="bg-white border-b hover:bg-slate-50">
                                <td className="p-3 sm:p-4 w-10">
                                    <input type="checkbox" checked={selectedLeadIds.includes(lead.id)} onChange={() => handleSelectOne(lead.id)} onClick={e => e.stopPropagation()} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                                </td>
                                <td onClick={() => onSelectLead(lead)} className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap cursor-pointer">{new Date(lead.created_at).toLocaleDateString()}</td>
                                <td onClick={() => onSelectLead(lead)} className="px-3 sm:px-4 py-2 sm:py-3 cursor-pointer min-w-0">
                                    <div className="font-semibold text-slate-800 truncate max-w-[120px] sm:max-w-none">{customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown'}</div>
                                    <div className="text-xs text-slate-500 truncate max-w-[120px] sm:max-w-none">{customer?.phone}</div>
                                </td>
                                <td onClick={() => onSelectLead(lead)} className="px-3 sm:px-4 py-2 sm:py-3 cursor-pointer truncate max-w-[100px] sm:max-w-none">{lead.destination}</td>
                                <td onClick={() => onSelectLead(lead)} className="px-3 sm:px-4 py-2 sm:py-3 whitespace-nowrap cursor-pointer">{new Date(lead.travel_date).toLocaleDateString()}</td>
                                <td onClick={() => onSelectLead(lead)} className="px-3 sm:px-4 py-2 sm:py-3 cursor-pointer"><PriorityBadge priority={lead.priority} /></td>
                                <td onClick={() => onSelectLead(lead)} className="px-3 sm:px-4 py-2 sm:py-3 cursor-pointer"><StatusBadge status={lead.status} /></td>
                                <td onClick={() => onSelectLead(lead)} className="px-3 sm:px-4 py-2 sm:py-3 cursor-pointer"><AssignedToAvatars assignees={lead.assigned_to} /></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {leads.length === 0 && <div className="text-center py-10 text-slate-500">No bookings found.</div>}
        </div>
    );
};

export const Bookings: React.FC = () => {
    const { leads, customers, itineraries, staff, branches, suppliers, invoices, refreshData } = useData();
    const { profile: currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const [filters, setFilters] = useState({ staffIds: [] as number[], branchIds: [] as number[], leadTypes: [] as LeadType[] });
    const { addToast } = useToast();
    const { signOut } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const { navigate } = useRouter();
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const isHQ = currentUser?.branch_id === 1;

    const customerMap = useMemo(() => {
        const map = new Map<number, Customer>();
        customers.forEach(c => map.set(c.id, c));
        return map;
    }, [customers]);

    const handleSelectLead = (lead: Lead) => {
        setSelectedLead(lead);
        setIsPanelOpen(true);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedLead(null);
    };

    const bookingStatuses: LeadStatus[] = [LeadStatus.BillingCompletion, LeadStatus.Voucher, LeadStatus.OnTour, LeadStatus.Completed, LeadStatus.Feedback];

    const filteredLeads = useMemo(() => {
        return [...leads]
            .filter(l => bookingStatuses.includes(l.status))
            .filter(l => {
                const customer = customerMap.get(l.customer_id);
                const customerInfo = customer ? `${customer.first_name} ${customer.last_name} ${customer.phone}` : '';

                const searchMatch = `${customerInfo} ${l.destination}`.toLowerCase().includes(searchTerm.toLowerCase());
                const staffMatch = filters.staffIds.length === 0 || l.assigned_to.some(s => filters.staffIds.includes(s.id));
                const branchMatch = filters.branchIds.length === 0 || l.branch_ids.some(branchId => filters.branchIds.includes(branchId));
                const leadTypeMatch = filters.leadTypes.length === 0 || (l.lead_type && filters.leadTypes.includes(l.lead_type));

                return searchMatch && staffMatch && branchMatch && leadTypeMatch;
            })
            .sort((a, b) => {
                if (sortConfig) {
                    if (sortConfig.key === 'priority') {
                        const priorityOrder: Record<Priority, number> = { [Priority.High]: 3, [Priority.Medium]: 2, [Priority.Low]: 1 };
                        const aPriority = priorityOrder[a.priority || Priority.Medium] || 0;
                        const bPriority = priorityOrder[b.priority || Priority.Medium] || 0;
                        if (aPriority > bPriority) return sortConfig.direction === 'asc' ? 1 : -1;
                        if (aPriority < bPriority) return sortConfig.direction === 'asc' ? -1 : 1;
                        return 0;
                    }

                    const aValue = a[sortConfig.key];
                    const bValue = b[sortConfig.key];

                    if (aValue === null || aValue === undefined) return 1;
                    if (bValue === null || bValue === undefined) return -1;

                    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
    }, [leads, searchTerm, customerMap, filters, sortConfig]);

    const paginatedLeads = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredLeads.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredLeads, currentPage]);

    useEffect(() => {
        setSelectedLeadIds([]);
    }, [currentPage, filters, searchTerm]);


    const handleDeleteSelected = async () => {
        if (selectedLeadIds.length === 0) return;

        const { error } = await supabase.from('leads').delete().in('id', selectedLeadIds);

        if (error) {
            addToast(`Error deleting bookings: ${error.message}`, 'error');
        } else {
            addToast(`${selectedLeadIds.length} booking(s) deleted successfully.`, 'success');
            await refreshData();
            setSelectedLeadIds([]);
        }
        setShowDeleteConfirm(false);
    };

    if (!currentUser) return null;

    // Most handlers like handleSaveLead, handleUpdateCustomer, etc., are in LeadDetailPanel now,
    // so we just need to pass the right props.

    return (
        <div className="flex h-full min-h-0">
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm flex flex-col min-h-0">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                        <h1 className="text-lg sm:text-xl font-bold text-slate-800">Bookings</h1>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <div className="relative flex-1 sm:flex-none min-w-0">
                                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search by customer, phone..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 w-full sm:w-64 text-sm bg-white border text-slate-900 border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            {selectedLeadIds.length > 0 && (
                                <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-[5px] hover:bg-red-700 min-h-[44px] sm:min-h-0 touch-manipulation">
                                    <IconTrash className="w-4 h-4 shrink-0" />
                                    Delete ({selectedLeadIds.length})
                                </button>
                            )}
                        </div>
                    </div>
                    <BookingsTable
                        leads={paginatedLeads}
                        customers={customerMap}
                        onSelectLead={handleSelectLead}
                        onSort={(key) => { }}
                        sortConfig={sortConfig}
                        selectedLeadIds={selectedLeadIds}
                        onSelectionChange={setSelectedLeadIds}
                        isHQ={isHQ}
                    />
                    <Pagination currentPage={currentPage} totalItems={filteredLeads.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
                </div>
            </div>
            {/* FIX: Pass the required 'refreshData' prop to the LeadDetailPanel component. */}
            {/* FIX: Removed non-existent onSaveItinerary prop and corrected signatures for onSave, onSaveCustomer, and onUpdateCustomer. */}
            {isPanelOpen && <LeadDetailPanel
                lead={selectedLead}
                onSave={async (lead) => {
                    addToast('This action is not supported from the Bookings view.', 'error');
                    return false;
                }}
                onClose={handleClosePanel}
                customers={customers}
                leads={leads}
                onSaveCustomer={async (customer, avatarFile) => {
                    addToast('This action is not supported from the Bookings view.', 'error');
                }}
                onUpdateCustomer={async (customer, avatarFile) => {
                    addToast('This action is not supported from the Bookings view.', 'error');
                    return false;
                }}
                itineraries={itineraries}
                currentUser={currentUser}
                staff={staff}
                suppliers={suppliers}
                branches={branches}
                invoices={invoices}
                onNavigate={navigate}
                refreshData={refreshData}
            />}
            {showDeleteConfirm && (
                <ConfirmationModal
                    title="Confirm Deletion"
                    message={`Are you sure you want to delete ${selectedLeadIds.length} booking(s)? This action cannot be undone.`}
                    onConfirm={handleDeleteSelected}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </div>
    );
};