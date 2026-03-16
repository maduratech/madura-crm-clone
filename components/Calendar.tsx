


import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Lead, Customer, LeadStatus, Page, LoggedInUser, Staff, Branch, Itinerary, Activity, ItineraryMetadata, Supplier, Service, Priority, Invoice, Address } from '../types';
import { useData } from '../contexts/DataProvider';
import { LeadDetailPanel } from './Leads';
import { useToast } from './ToastProvider';
import { useAuth } from '../contexts/AuthProvider';
import { useRouter } from '../contexts/RouterProvider';
import { supabase } from '../lib/supabase';
import { getDefaultAvatarUrl } from '../lib/avatarUrl';
import { AuthApiError } from '@supabase/supabase-js';
import { IconFilter, IconChevronDown } from '../constants';

// --- Helper Functions & Components ---

const getStatusClass = (status: LeadStatus) => {
    switch (status) {
        case LeadStatus.Confirmed:
        case LeadStatus.Completed:
        case LeadStatus.BillingCompletion:
            return 'bg-green-500 border-green-500 hover:bg-green-600';
        case LeadStatus.Enquiry:
        case LeadStatus.Processing:
        case LeadStatus.OperationsInitiated:
            return 'bg-blue-500 border-blue-500 hover:bg-blue-600';
        case LeadStatus.Voucher:
        case LeadStatus.OnTour:
        case LeadStatus.Invoicing:
            return 'bg-purple-500 border-purple-500 hover:bg-purple-600';
        case LeadStatus.Rejected:
            return 'bg-red-500 border-red-500 hover:bg-red-600';
        case LeadStatus.Unqualified:
        case LeadStatus.Feedback:
            return 'bg-yellow-500 border-yellow-500 hover:bg-yellow-600';
        default: return 'bg-slate-500 border-slate-500 hover:bg-slate-600';
    }
};

const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 010 1.06L9.81 10l2.98 2.97a.75.75 0 11-1.06 1.06l-3.5-3.5a.75.75 0 010-1.06l3.5-3.5a.75.75 0 011.06 0z" clipRule="evenodd" />
    </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 010-1.06L10.19 10 7.21 7.03a.75.75 0 011.06-1.06l3.5 3.5a.75.75 0 010 1.06l-3.5 3.5a.75.75 0 01-1.06 0z" clipRule="evenodd" />
    </svg>
);

const CalendarHeader: React.FC<{
    currentDate: Date;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onToday: () => void;
    selectedServices: Service[];
    selectedStaffIds: number[];
    selectedStatuses: LeadStatus[];
    onServiceFilterChange: (service: Service) => void;
    onStaffFilterChange: (staffId: number) => void;
    onStatusFilterChange: (status: LeadStatus) => void;
    staff: Staff[];
}> = ({ currentDate, onPrevMonth, onNextMonth, onToday, selectedServices, selectedStaffIds, selectedStatuses, onServiceFilterChange, onStaffFilterChange, onStatusFilterChange, staff }) => {
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const allowedServices = [Service.Tour, Service.MICE, Service.HotelBooking, Service.AirTicketing];

    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-2 sm:gap-4">
                <h1 className="text-lg sm:text-xl font-bold text-slate-800">
                    {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h1>
                <div className="flex items-center gap-1">
                    <button onClick={onPrevMonth} className="p-2.5 sm:p-1.5 rounded-full hover:bg-slate-100 text-slate-500 touch-manipulation" aria-label="Previous month"><ChevronLeftIcon className="w-5 h-5" /></button>
                    <button onClick={onNextMonth} className="p-2.5 sm:p-1.5 rounded-full hover:bg-slate-100 text-slate-500 touch-manipulation" aria-label="Next month"><ChevronRightIcon className="w-5 h-5" /></button>
                </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial" ref={filterRef}>
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="px-3 py-2.5 sm:py-1.5 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 flex items-center justify-center gap-2 w-full sm:w-auto min-h-[44px] sm:min-h-0 touch-manipulation"
                    >
                        <IconFilter className="w-4 h-4" />
                        Filter
                        <IconChevronDown className="w-4 h-4" />
                    </button>
                    {isFilterOpen && (
                        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-72 md:w-80 bg-white rounded-md shadow-lg border z-50 p-4 max-h-[80vh] overflow-y-auto">
                            <h3 className="text-sm font-semibold mb-3 text-black">Filters</h3>

                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-600 mb-2">By Services</label>
                            <div className="space-y-2">
                                {allowedServices.map(service => (
                                    <label key={service} className="flex items-center text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedServices.includes(service)}
                                            onChange={() => onServiceFilterChange(service)}
                                            className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white"
                                        />
                                        <span className="ml-2 text-slate-700">{service}</span>
                                    </label>
                                ))}
                                </div>
                            </div>

                            <hr className="my-3" />

                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-600 mb-2">By Status</label>
                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                    {Object.values(LeadStatus).filter(s => s !== LeadStatus.Rejected).map(status => (
                                        <label key={status} className="flex items-center text-sm cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedStatuses.includes(status)}
                                                onChange={() => onStatusFilterChange(status)}
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white"
                                            />
                                            <span className="ml-2 text-slate-700">{status}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <hr className="my-3" />

                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-2">By Assigned Staff</label>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {staff.map(s => (
                                        <label key={s.id} className="flex items-center text-sm cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedStaffIds.includes(s.id)}
                                                onChange={() => onStaffFilterChange(s.id)}
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 bg-white"
                                            />
                                            <img src={s.avatar_url} className="w-6 h-6 rounded-full ml-2 mr-1.5" alt={s.name} />
                                            <span className="text-slate-700">{s.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <button onClick={onToday} className="px-3 py-2.5 sm:py-1.5 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 w-full sm:w-auto min-h-[44px] sm:min-h-0 touch-manipulation">Today</button>
            </div>
        </div>
    );
};

interface TooltipInfo {
    lead: Lead;
    customer: Customer | undefined;
    position: { top: number; left: number };
}

const LeadTooltip: React.FC<{ info: TooltipInfo & { staff: Staff[] } }> = ({ info }) => {
    const { lead, customer, position, staff } = info;
    const getPriorityColor = (priority?: Priority) => {
        switch (priority) {
            case Priority.High: return 'text-red-500';
            case Priority.Medium: return 'text-yellow-500';
            case Priority.Low: return 'text-blue-500';
            default: return 'text-slate-400';
        }
    };

    // Calculate tooltip position to avoid going off-screen
    const getTooltipStyle = () => {
        if (typeof window === 'undefined') {
            return { top: position.top + 10, left: position.left + 10 };
        }
        const maxTop = window.innerHeight - 250;
        const maxLeft = window.innerWidth - 320;
        return {
            top: Math.min(position.top + 10, maxTop),
            left: Math.min(position.left + 10, maxLeft),
        };
    };

    return (
        <div className="absolute z-30 p-3 sm:p-4 bg-slate-800 text-white text-xs sm:text-sm rounded-lg shadow-xl max-w-[90vw] sm:max-w-xs" style={{ ...getTooltipStyle(), pointerEvents: 'none' }}>
            <p className="font-bold text-base mb-2">{lead.destination}</p>
            <div className="space-y-2">
                <div>
                    <p className="text-slate-300 text-xs">Customer</p>
                    <p className="font-medium">{customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown Customer'}</p>
                    {customer?.phone && <p className="text-slate-400 text-xs mt-0.5">{customer.phone}</p>}
                </div>
                {lead.priority && (
                    <div>
                        <p className="text-slate-300 text-xs">Priority</p>
                        <p className={`font-medium ${getPriorityColor(lead.priority)}`}>{lead.priority}</p>
                    </div>
                )}
                {lead.services && lead.services.length > 0 && (
                    <div>
                        <p className="text-slate-300 text-xs">Services</p>
                        <p className="text-xs mt-0.5">{lead.services.join(', ')}</p>
                    </div>
                )}
                {lead.assigned_to && lead.assigned_to.length > 0 && (
                    <div>
                        <p className="text-slate-300 text-xs">Assigned Staff</p>
                        <div className="flex items-center gap-2 mt-1">
                            {lead.assigned_to.slice(0, 3).map(assignedStaff => {
                                const staffMember = staff.find(s => s.id === assignedStaff.id);
                                return (
                                    <div key={assignedStaff.id} className="flex items-center gap-1.5">
                                        <img src={staffMember?.avatar_url || assignedStaff.avatar_url} className="w-5 h-5 rounded-full" alt={staffMember?.name || assignedStaff.name} />
                                        <span className="text-xs">{staffMember?.name || assignedStaff.name}</span>
                                    </div>
                                );
                            })}
                            {lead.assigned_to.length > 3 && (
                                <span className="text-xs text-slate-400">+{lead.assigned_to.length - 3} more</span>
                            )}
                        </div>
                    </div>
                )}
                <div>
                    <p className="text-slate-300 text-xs">Status</p>
                    <span className={`mt-1 inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getStatusClass(lead.status).replace('hover:bg-', 'bg-').replace('border-', '')}`}>
                        {lead.status}
                    </span>
                </div>
            </div>
        </div>
    );
};


// Main Calendar Component
const Calendar: React.FC = () => {
    const { leads, customers, itineraries, staff, branches, suppliers, invoices, refreshData } = useData();
    // Fix: Renamed `profile` from `useAuth` to `currentUser` to match usage within the component.
    const { profile: currentUser, signOut } = useAuth();
    const { addToast } = useToast();
    const { navigate } = useRouter();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [tooltipInfo, setTooltipInfo] = useState<(TooltipInfo & { staff: Staff[] }) | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedServices, setSelectedServices] = useState<Service[]>([Service.Tour, Service.MICE, Service.HotelBooking, Service.AirTicketing]);

    const customerMap = useMemo(() => {
        const map = new Map<number, Customer>();
        customers.forEach(c => map.set(c.id, c));
        return map;
    }, [customers]);

    const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<LeadStatus[]>([]);

    const handleStaffFilterChange = (staffId: number) => {
        setSelectedStaffIds(prev =>
            prev.includes(staffId)
                ? prev.filter(id => id !== staffId)
                : [...prev, staffId]
        );
    };

    const handleStatusFilterChange = (status: LeadStatus) => {
        setSelectedStatuses(prev =>
            prev.includes(status)
                ? prev.filter(s => s !== status)
                : [...prev, status]
        );
    };

    const leadsByDate = useMemo(() => {
        const map = new Map<string, Lead[]>();
        // Filter leads by allowed services: Tour Package, MICE, Hotel, Air Ticket
        const allowedServices = [Service.Tour, Service.MICE, Service.HotelBooking, Service.AirTicketing];
        const today = new Date();
        today.setHours(0, 0, 0, 0); // normalize to start of day

        leads
            .filter(lead => {
                // Don't show rejected leads
                if (lead.status === LeadStatus.Rejected) return false;

                // Only show leads that have at least one of the allowed services
                if (!lead.services || lead.services.length === 0) return false;
                const hasAllowedService = lead.services.some(service => allowedServices.includes(service));
                if (!hasAllowedService) return false;

                // Hide past travel dates (before today)
                const travelDate = lead.travel_date ? new Date(lead.travel_date) : null;
                if (!travelDate || isNaN(travelDate.getTime())) return false;
                travelDate.setHours(0, 0, 0, 0);
                if (travelDate < today) return false;

                // Apply service filter if any services are selected
                if (selectedServices.length > 0 && selectedServices.length < allowedServices.length) {
                    const serviceMatch = lead.services.some(service => selectedServices.includes(service));
                    if (!serviceMatch) return false;
                }

                // Apply staff filter
                if (selectedStaffIds.length > 0) {
                    const staffMatch = lead.assigned_to && lead.assigned_to.some(s => selectedStaffIds.includes(s.id));
                    if (!staffMatch) return false;
                }

                // Apply status filter
                if (selectedStatuses.length > 0) {
                    if (!selectedStatuses.includes(lead.status)) return false;
                }

                return true;
            })
            .forEach(lead => {
                const date = new Date(lead.travel_date).toISOString().split('T')[0];
                if (!map.has(date)) {
                    map.set(date, []);
                }
                map.get(date)?.push(lead);
            });
        return map;
    }, [leads, selectedServices, selectedStaffIds, selectedStatuses]);

    const { month, year, daysInMonth, firstDayOfMonth } = useMemo(() => {
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        return { month, year, daysInMonth, firstDayOfMonth };
    }, [currentDate]);

    const calendarCells = useMemo(() => {
        const cells = [];
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        // Previous month's days
        for (let i = 0; i < firstDayOfMonth; i++) {
            const day = daysInPrevMonth - firstDayOfMonth + i + 1;
            const date = new Date(year, month - 1, day);
            cells.push({ date, isCurrentMonth: false });
        }

        // Current month's days
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            cells.push({ date, isCurrentMonth: true });
        }

        // Next month's days to fill the grid
        const remainingCells = 42 - cells.length; // 6 weeks * 7 days
        for (let i = 1; i <= remainingCells; i++) {
            const date = new Date(year, month + 1, i);
            cells.push({ date, isCurrentMonth: false });
        }

        return cells;
    }, [year, month, daysInMonth, firstDayOfMonth]);

    // --- Event Handlers ---
    const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const handleToday = () => setCurrentDate(new Date());

    const handleLeadClick = (lead: Lead) => {
        setSelectedLead(lead);
        setIsPanelOpen(true);
    };

    const handleClosePanel = () => {
        setIsPanelOpen(false);
        setSelectedLead(null);
    };

    const handleLeadHover = (e: React.MouseEvent, lead: Lead) => {
        const customer = customerMap.get(lead.customer_id);
        setTooltipInfo({ lead, customer, position: { top: e.clientY, left: e.clientX }, staff });
    };

    const handleServiceFilterChange = (service: Service) => {
        setSelectedServices(prev =>
            prev.includes(service)
                ? prev.filter(s => s !== service)
                : [...prev, service]
        );
    };

    // --- Copied Logic from Leads.tsx for LeadDetailPanel ---
    const generateUpdateDescription = (original: Lead, updated: Lead, staff: Staff[], branches: Branch[]): string => {
        const changes: string[] = [];
        if (original.status !== updated.status) changes.push(`status to '${updated.status}'`);
        if (original.destination !== updated.destination) changes.push(`destination to '${updated.destination}'`);
        return changes.length > 0 ? `Updated ${changes.join(' and ')}.` : 'Lead details were saved with no changes.';
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

    const handleSaveLead = async (leadToSave: Lead): Promise<boolean> => {
        if (!currentUser) return false;
        try {
            const { assigned_to, assigned_suppliers, ...leadForDb } = leadToSave;

            // This is only for updates from the calendar view
            const originalLead = leads.find(l => l.id === leadToSave.id);
            if (!originalLead) throw new Error("Original lead not found.");

            const description = generateUpdateDescription(originalLead, leadToSave, staff, branches);
            const activity: Activity = { id: Date.now(), type: 'Lead Updated', description, user: currentUser.name, timestamp: new Date().toISOString() };
            const updatedActivity = [activity, ...(leadToSave.activity || [])];

            const { error } = await supabase.from('leads').update({ ...leadForDb, activity: updatedActivity }).eq('id', leadToSave.id);
            if (error) throw error;

            // Handle Staff Assignments
            await supabase.from('lead_assignees').delete().eq('lead_id', leadToSave.id);
            if (assigned_to && assigned_to.length > 0) {
                const assignments = assigned_to.map(s => ({ lead_id: leadToSave.id, staff_id: s.id }));
                await supabase.from('lead_assignees').insert(assignments);
            }

            // Handle Supplier Assignments
            await supabase.from('lead_suppliers').delete().eq('lead_id', leadToSave.id);
            if (assigned_suppliers && assigned_suppliers.length > 0) {
                const supplierAssignments = assigned_suppliers.map(s => ({ lead_id: leadToSave.id, supplier_id: s.id }));
                await supabase.from('lead_suppliers').insert(supplierAssignments);
            }

            addToast('Lead updated successfully.', 'success');
            await refreshData();
            return true;
        } catch (error: any) {
            if (error instanceof AuthApiError) signOut();
            else addToast(`Error: ${error.message}`, 'error');
            return false;
        }
    };

    const handleSaveCustomer = async (customerToSave: Customer, avatarFile: File | null): Promise<Customer | void> => {
        const generateUsername = (name: string) => {
            const base = (name || 'customer').toLowerCase().replace(/\s+/g, '');
            const suffix = Math.random().toString(36).slice(-4);
            return `@${base}_${suffix}`;
        };
        const { addedBy, ...customerData } = customerToSave;
        const newCustomer = {
            ...customerData,
            username: generateUsername(customerToSave.first_name),
            avatar_url: getDefaultAvatarUrl('New Customer', 128),
            added_by_id: currentUser?.id,
            date_added: new Date().toISOString(),
            added_by_branch_id: currentUser?.branch_id,
        };

        // Sanitize potentially empty date strings to null
        newCustomer.date_of_birth = newCustomer.date_of_birth || null;
        newCustomer.passport_issue_date = newCustomer.passport_issue_date || null;
        newCustomer.passport_expiry_date = newCustomer.passport_expiry_date || null;

        const { data, error } = await supabase.from('customers').insert(newCustomer).select().single();
        if (error) {
            addToast(`Error creating customer: ${error.message}`, 'error');
            return;
        }

        let savedCustomer = data as Customer;

        if (avatarFile) {
            try {
                const filePath = `public/customer-avatars/${savedCustomer.id}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, avatarFile, { upsert: true });
                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                const finalAvatarUrl = `${urlData.publicUrl}?t=${new Date().getTime()}`;

                const { data: updatedData, error: updateError } = await supabase.from('customers').update({ avatar_url: finalAvatarUrl }).eq('id', savedCustomer.id).select().single();
                if (updateError) throw updateError;
                savedCustomer = updatedData as Customer;
                addToast('New customer with profile picture created successfully.', 'success');
            } catch (uploadError: any) {
                addToast(`Customer created, but avatar upload failed: ${uploadError.message}`, 'error');
            }
        } else {
            addToast('New customer created successfully.', 'success');
        }

        await refreshData();
        return savedCustomer;
    };

    const handleUpdateCustomer = async (customerToUpdate: Customer, avatarFile: File | null, options?: { closePanel?: boolean }): Promise<boolean> => {
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

        // Do not update username (unique constraint); set only at creation
        delete (updateData as any).username;

        // Sanitize potentially empty date strings to null
        updateData.date_of_birth = updateData.date_of_birth || null;
        updateData.passport_issue_date = updateData.passport_issue_date || null;
        updateData.passport_expiry_date = updateData.passport_expiry_date || null;

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

        const { error } = await supabase.from('customers').update(updateData).eq('id', customerToUpdate.id);
        if (error) {
            addToast(`Error updating customer: ${error.message}`, 'error');
            return false;
        } else {
            await refreshData();
            return true;
        }
    };


    if (!currentUser) return null;

    return (
        <div className="flex h-full bg-white rounded-lg shadow-sm p-3 sm:p-4 flex-col overflow-hidden min-h-0">
            <CalendarHeader
                currentDate={currentDate}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onToday={handleToday}
                selectedServices={selectedServices}
                selectedStaffIds={selectedStaffIds}
                selectedStatuses={selectedStatuses}
                onServiceFilterChange={handleServiceFilterChange}
                onStaffFilterChange={handleStaffFilterChange}
                onStatusFilterChange={handleStatusFilterChange}
                staff={staff}
            />
            <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs font-semibold text-slate-500 border-b pb-1.5 sm:pb-2 shrink-0 gap-px">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="hidden sm:block">{day}</div>
                ))}
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <div key={`mobile-${idx}`} className="sm:hidden">{day}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0 overflow-auto -mx-px -my-px gap-px content-stretch">
                {calendarCells.map(({ date, isCurrentMonth }, index) => {
                    const dateString = date.toISOString().split('T')[0];
                    const dayLeads = leadsByDate.get(dateString) || [];
                    const isToday = new Date().toDateString() === date.toDateString();

                    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                    return (
                        <div
                            key={index}
                            className={`border border-slate-200 p-1 sm:p-1.5 flex flex-col relative min-h-[64px] sm:min-h-[80px] bg-white rounded-sm ${dayLeads.length > 0 ? 'cursor-pointer' : ''}`}
                            onClick={() => {
                                if (dayLeads.length > 0) setSelectedDate(date);
                            }}
                        >
                            <span className={`self-end text-[10px] sm:text-sm shrink-0 ${isToday ? 'bg-blue-600 text-white rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center font-bold' : ''} ${isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                                {date.getDate()}
                            </span>
                            {/* Mobile: count badge only; tap day to see list below */}
                            {dayLeads.length > 0 && (
                                <div className="sm:hidden flex-1 flex items-center justify-center mt-0.5 min-h-0">
                                    <span className="inline-flex items-center justify-center min-w-[22px] h-6 px-1.5 rounded-full bg-slate-200 text-slate-700 text-xs font-medium">
                                        {dayLeads.length}
                                    </span>
                                </div>
                            )}
                            {/* Desktop: event pills as before */}
                            <div className="hidden sm:flex flex-1 overflow-y-auto flex-col space-y-1 mt-1 min-h-0">
                                {dayLeads.slice(0, 2).map(lead => (
                                    <button
                                        key={lead.id}
                                        onClick={(e) => { e.stopPropagation(); handleLeadClick(lead); }}
                                        onMouseEnter={(e) => handleLeadHover(e, lead)}
                                        onMouseLeave={() => setTooltipInfo(null)}
                                        className={`w-full text-left p-1.5 text-xs text-white rounded touch-manipulation ${getStatusClass(lead.status)}`}
                                        title={lead.destination}
                                    >
                                        {lead.destination}
                                    </button>
                                ))}
                                {dayLeads.length > 2 && (
                                    <div className="text-xs text-slate-600 font-medium">
                                        + {dayLeads.length - 2} more
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Mobile: selected day events list with full names */}
            {selectedDate && (
                <div className="sm:hidden mt-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-slate-800">
                            {selectedDate.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </h3>
                        <button onClick={() => setSelectedDate(null)} className="text-slate-500 hover:text-slate-700 p-1 text-xs font-medium" aria-label="Close">Close</button>
                    </div>
                    <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                        {(leadsByDate.get(selectedDate.toISOString().split('T')[0]) || []).map(lead => (
                            <li key={lead.id}>
                                <button
                                    onClick={() => handleLeadClick(lead)}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-white touch-manipulation ${getStatusClass(lead.status)}`}
                                >
                                    {lead.destination}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {tooltipInfo && <LeadTooltip info={tooltipInfo} />}
            {isPanelOpen && selectedLead && (
                <LeadDetailPanel
                    lead={selectedLead}
                    onSave={handleSaveLead}
                    onClose={handleClosePanel}
                    customers={customers}
                    leads={leads}
                    onSaveCustomer={handleSaveCustomer}
                    onUpdateCustomer={handleUpdateCustomer}
                    itineraries={itineraries}
                    currentUser={currentUser}
                    staff={staff}
                    suppliers={suppliers}
                    branches={branches}
                    invoices={invoices}
                    onNavigate={navigate}
                    refreshData={refreshData}
                />
            )}
        </div>
    );
};

export default Calendar;