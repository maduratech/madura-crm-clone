import React, { useState, useEffect, useMemo } from 'react';
import { Transfer, TransferType, Destination } from '../../types';
import { IconX, IconChevronLeft, IconChevronDown } from '../../constants';
import { TransferIcon, ActivityIcon } from './ItineraryIcons';
import { useAuth } from '../../contexts/AuthProvider';
import { useData } from '../../contexts/DataProvider';

interface TransferSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDay: number;
    destination?: string;
    destinations?: Destination[];
    onSelectTransfer: (transfer: Transfer) => void;
}

function transferTypeToTransfer(tt: TransferType): Transfer {
    return {
        id: tt.id,
        name: tt.name,
        destination_id: tt.destination_id ?? null,
        cost: tt.default_cost ?? 0,
        currency: tt.default_currency ?? 'USD',
        vehicle_type: tt.vehicle_type ?? null,
        capacity: tt.capacity ?? null,
        duration: tt.duration ?? null,
        image_url: tt.image_url ?? null,
        type: tt.category,
        created_at: tt.created_at,
        updated_at: tt.updated_at ?? null,
    };
}

export const TransferSelectorModal: React.FC<TransferSelectorModalProps> = ({ 
    isOpen, 
    onClose, 
    selectedDay, 
    destination, 
    destinations = [], 
    onSelectTransfer 
}) => {
    const { session } = useAuth();
    const { transfers, transferTypes, fetchTransfers, fetchTransferTypes, loadingTransfers, loadingTransferTypes } = useData();
    const [selectedCategory, setSelectedCategory] = useState<'Main Segment' | 'Attraction Transfer' | null>(null);

    // Load transfers and transfer types from Supabase when modal opens
    useEffect(() => {
        if (isOpen && session?.access_token) {
            fetchTransfers();
            fetchTransferTypes();
        }
    }, [isOpen, session?.access_token, fetchTransfers, fetchTransferTypes]);

    // Build list from DB: transfers (with type from transfer_type if needed) + transfer_types as Transfer shape
    const { mainSegmentTransfers, attractionTransfers } = useMemo(() => {
        const transferTypeList = (transferTypes || []).map(transferTypeToTransfer);
        const transferList = (transfers || []).map(t => ({
            ...t,
            type: t.type ?? (t.transfer_type_id != null ? (transferTypes || []).find(tt => tt.id === t.transfer_type_id)?.category : null) ?? null,
        }));
        let list: Transfer[] = [...transferList, ...transferTypeList];

        if (destination && destinations?.length) {
            const matchingDestination = destinations.find(d => 
                d.name.toLowerCase().includes(destination.toLowerCase()) ||
                destination.toLowerCase().includes(d.name.toLowerCase())
            );
            if (matchingDestination) {
                list = list.filter(t => t.destination_id == null || t.destination_id === matchingDestination.id);
            }
        }

        return {
            mainSegmentTransfers: list.filter(t => t.type === 'Main Segment'),
            attractionTransfers: list.filter(t => t.type === 'Attraction Transfer'),
        };
    }, [transfers, transferTypes, destination, destinations]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
            
            {/* Drawer */}
            <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 flex justify-between items-center flex-shrink-0 bg-[#111827]">
                    <div>
                        <h3 className="text-white font-semibold text-lg">Select Transfer for Day {selectedDay}</h3>
                        <p className="text-white/80 text-sm mt-1">Choose transfer type and option</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
                    >
                        <IconX className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {(loadingTransfers || loadingTransferTypes) ? (
                        <div className="text-center py-8">
                            <p className="text-slate-500">Loading transfers...</p>
                        </div>
                    ) : !selectedCategory ? (
                        // Category Selection
                        <div className="space-y-4">
                            <button
                                onClick={() => setSelectedCategory('Main Segment')}
                                className="w-full p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 hover:border-blue-400 rounded-lg transition-all text-left group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-[#111827] rounded-lg flex items-center justify-center flex-shrink-0">
                                        <TransferIcon className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-lg text-slate-900 group-hover:text-[#111827]">Main Transfers</h4>
                                        <p className="text-sm text-slate-600 mt-1">Airport, Hotel, and Cruise Terminal transfers</p>
                                    </div>
                                    <IconChevronDown className="w-5 h-5 text-slate-400 group-hover:text-[#111827] rotate-[-90deg]" />
                                </div>
                            </button>
                            <button
                                onClick={() => setSelectedCategory('Attraction Transfer')}
                                className="w-full p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 hover:border-purple-400 rounded-lg transition-all text-left group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-[#4c49e6] rounded-lg flex items-center justify-center flex-shrink-0">
                                        <ActivityIcon className="w-8 h-8 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-lg text-slate-900 group-hover:text-[#4c49e6]">Attractions Transfers</h4>
                                        <p className="text-sm text-slate-600 mt-1">Hotel to Attraction, Attraction to Attraction, Car at Disposal</p>
                                    </div>
                                    <IconChevronDown className="w-5 h-5 text-slate-400 group-hover:text-[#4c49e6] rotate-[-90deg]" />
                                </div>
                            </button>
                        </div>
                    ) : (
                        // Transfer Options
                        <div className="space-y-3">
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
                            >
                                <IconChevronLeft className="w-5 h-5" />
                                <span className="text-sm font-medium">Back to Categories</span>
                            </button>
                            <h4 className="font-semibold text-slate-900 mb-4">
                                {selectedCategory === 'Main Segment' ? 'Main Transfers' : 'Attractions Transfers'}
                            </h4>
                            {(selectedCategory === 'Main Segment' ? mainSegmentTransfers : attractionTransfers).length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <p className="text-sm">No {selectedCategory === 'Main Segment' ? 'Main' : 'Attractions'} transfers available for this destination.</p>
                                    <p className="text-xs mt-2">Please add transfers in the All Transfers page.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(selectedCategory === 'Main Segment' ? mainSegmentTransfers : attractionTransfers).map((transfer) => (
                                        <button
                                            key={transfer.id}
                                            onClick={() => onSelectTransfer(transfer)}
                                            className="p-4 bg-white border-2 border-slate-200 hover:border-[#4c49e6] rounded-lg transition-all text-left group"
                                        >
                                            <div className="flex items-start gap-3">
                                                {transfer.image_url ? (
                                                    <img 
                                                        src={transfer.image_url} 
                                                        alt={transfer.name}
                                                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                                    />
                                                ) : (
                                                    <div className={`w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0 ${transfer.name.toLowerCase().includes('sic') ? 'bg-blue-100' : 'bg-[#4c49e6]'}`}>
                                                        <svg className={`w-8 h-8 ${transfer.name.toLowerCase().includes('sic') ? 'text-blue-600' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <h5 className="font-semibold text-slate-900 group-hover:text-[#4c49e6] mb-1">{transfer.name}</h5>
                                                    {transfer.vehicle_type && (
                                                        <p className="text-xs text-slate-600 mb-1">{transfer.vehicle_type}</p>
                                                    )}
                                                    <p className="text-xs text-slate-500">
                                                        {transfer.name.toLowerCase().includes('sic') ? 'Shared (SIC)' : 'Private (PVT)'}
                                                        {transfer.cost && transfer.currency && (
                                                            <span className="ml-2">• {transfer.currency} {transfer.cost}</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
