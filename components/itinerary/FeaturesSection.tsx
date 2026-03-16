import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Customer, Destination, Lead } from '../../types';
import { IconSearch, IconChevronDown } from '../../constants';
import { DurationIcon, TravelersIcon, StartingIcon, MinAgeIcon } from './ItineraryIcons';
import { generateBookingId } from './ItineraryUtils';

// Customer Search Dropdown Component
const CustomerSearchDropdown: React.FC<{
    customers: Customer[];
    selectedCustomer: Customer | null;
    onSelect: (customer: Customer | null) => void;
}> = ({ customers, selectedCustomer, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownMenuRef = useRef<HTMLDivElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(target) &&
                dropdownMenuRef.current &&
                !dropdownMenuRef.current.contains(target)
            ) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    }, [isOpen]);

    const filteredCustomers = useMemo(() => {
        if (!searchTerm) return customers;
        const term = searchTerm.toLowerCase();
        return customers.filter(c => 
            c.first_name.toLowerCase().includes(term) ||
            c.last_name.toLowerCase().includes(term) ||
            c.email.toLowerCase().includes(term) ||
            c.phone.toLowerCase().includes(term)
        );
    }, [customers, searchTerm]);

    return (
        <>
            <div ref={dropdownRef} className="relative w-full">
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={selectedCustomer ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}` : ''}
                        readOnly
                        onClick={() => setIsOpen(!isOpen)}
                        className="w-full p-1.5 border border-slate-300 rounded-md bg-white focus:border-[#191975] focus:ring-1 focus:ring-[#191975] outline-none cursor-pointer"
                        placeholder="Select a customer..."
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                        <IconChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </div>
            {isOpen && (
                <div 
                    ref={dropdownMenuRef}
                    className="fixed z-[99999] bg-white border border-slate-300 rounded-md shadow-2xl max-h-60 overflow-hidden"
                    style={{ 
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`,
                        width: `${Math.max(dropdownPosition.width, 300)}px`
                    }}
                >
                    <div className="p-3 border-b bg-slate-50">
                        <div className="relative">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search customers..."
                                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#191975] focus:border-[#191975]"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto max-h-48">
                        {filteredCustomers.length === 0 ? (
                            <div className="p-3 text-sm text-slate-500 text-center">No customers found</div>
                        ) : (
                            filteredCustomers.map(customer => (
                                <div
                                    key={customer.id}
                                    onClick={() => {
                                        onSelect(customer);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors"
                                >
                                    <div className="font-medium text-slate-900 text-sm">{customer.first_name} {customer.last_name}</div>
                                    <div className="text-xs text-slate-500 mt-1">{customer.email} • {customer.phone}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

// FeatureItem component
const FeatureItem: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
    <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-red-100 fill-current">
                <path d="M50 0 L93.3 25 V75 L50 100 L6.7 75 V25 Z" />
            </svg>
            <div className="relative text-red-600">{icon}</div>
        </div>
        <div>
            <p className="text-xs text-slate-500">{label}</p>
            {children}
        </div>
    </div>
);

interface FeaturesSectionProps {
    isEditing: boolean;
    meta: { starting_point: string; duration: string; destination: string; travel_date: string; adults: number; children: number; infants: number; mts_booking_id?: string; };
    onMetaChange: (field: 'duration' | 'destination' | 'travel_date' | 'adults' | 'children' | 'infants' | 'starting_point' | 'customer_id' | 'mts_booking_id', value: string | number) => void;
    customer: Customer | null;
    customers: Customer[];
    destinations: Destination[];
    onCustomerChange: (customer: Customer | null) => void;
    isDownloading: boolean;
    lead?: Lead | null;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ 
    isEditing, 
    meta, 
    onMetaChange, 
    customer, 
    customers, 
    destinations, 
    onCustomerChange, 
    isDownloading, 
    lead 
}) => {
    // Parse destinations from comma-separated string or use as single destination
    const selectedDestinations = useMemo(() => {
        if (!meta.destination) return [];
        // Check if it's comma-separated (multi-destination)
        if (meta.destination.includes(',')) {
            return meta.destination.split(',').map(d => d.trim()).filter(Boolean);
        }
        return [meta.destination];
    }, [meta.destination]);

    const handleDestinationChange = (destinations: string[]) => {
        onMetaChange('destination', destinations.join(', '));
    };

    return (
        <div className="bg-white rounded-lg p-4 border space-y-4">
            <h3 className="font-bold text-lg text-slate-800">Features</h3>
            <div className="flex items-center justify-between gap-6 flex-wrap">
                {!isDownloading && (
                    <FeatureItem icon={<MinAgeIcon className="w-5 h-5" />} label="Customer">
                        <div className="w-48">
                            <CustomerSearchDropdown
                                customers={customers}
                                selectedCustomer={customer}
                                onSelect={onCustomerChange}
                            />
                        </div>
                    </FeatureItem>
                )}
                <FeatureItem icon={<DurationIcon className="w-5 h-5" />} label="Duration">
                    <div className="font-bold text-sm text-slate-800 w-32 p-1">
                        {meta.duration || 'N/A'}
                    </div>
                </FeatureItem>
                <FeatureItem icon={<TravelersIcon className="w-5 h-5" />} label="Travelers">
                    <div className="flex items-end gap-3">
                        <div>
                            <label className="text-[10px] text-slate-500 block text-center">Adult</label>
                            {isEditing ? (
                                <input type="number" min={0} value={meta.adults ?? 0} onChange={e => onMetaChange('adults', parseInt(e.target.value, 10) || 0)} className="font-bold text-sm w-12 p-1 text-center border border-slate-300 rounded focus:ring-1 focus:ring-[#191975] focus:border-[#191975] outline-none" />
                            ) : (
                                <div className="font-bold text-sm w-12 p-1 text-center">{meta.adults || 0}</div>
                            )}
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 block text-center">Child(3-11yrs)</label>
                            {isEditing ? (
                                <input type="number" min={0} value={meta.children ?? 0} onChange={e => onMetaChange('children', parseInt(e.target.value, 10) || 0)} className="font-bold text-sm w-12 p-1 text-center border border-slate-300 rounded focus:ring-1 focus:ring-[#191975] focus:border-[#191975] outline-none" />
                            ) : (
                                <div className="font-bold text-sm w-12 p-1 text-center">{meta.children || 0}</div>
                            )}
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 block text-center">Infant(0-2yrs)</label>
                            {isEditing ? (
                                <input type="number" min={0} value={meta.infants ?? 0} onChange={e => onMetaChange('infants', parseInt(e.target.value, 10) || 0)} className="font-bold text-sm w-12 p-1 text-center border border-slate-300 rounded focus:ring-1 focus:ring-[#191975] focus:border-[#191975] outline-none" />
                            ) : (
                                <div className="font-bold text-sm w-12 p-1 text-center">{meta.infants || 0}</div>
                            )}
                        </div>
                    </div>
                </FeatureItem>
                <FeatureItem icon={<StartingIcon className="w-5 h-5" />} label="Starting Point">
                    <div className="font-bold text-sm text-slate-800 w-32 p-1">
                        {meta.starting_point || 'N/A'}
                    </div>
                </FeatureItem>
                <FeatureItem icon={<StartingIcon className="w-5 h-5" />} label="Destination">
                    <div className="font-bold text-sm text-slate-800 w-48 p-1">
                        {meta.destination || 'N/A'}
                    </div>
                </FeatureItem>
                {/* Hide Date of Travel and MTS Booking ID for destination/template itineraries (no lead) */}
                {lead != null && (
                    <>
                        <FeatureItem icon={<DurationIcon className="w-5 h-5" />} label="Date of Travel">
                            <div className="font-bold text-sm text-slate-800 w-32 p-1">
                                {meta.travel_date ? new Date(meta.travel_date).toLocaleDateString() : 'N/A'}
                            </div>
                        </FeatureItem>
                        <FeatureItem icon={<DurationIcon className="w-5 h-5" />} label="MTS Booking ID">
                            <div className="font-bold text-sm text-slate-800 w-32 p-1">
                                {generateBookingId(lead)}
                            </div>
                        </FeatureItem>
                    </>
                )}
            </div>
        </div>
    );
};

