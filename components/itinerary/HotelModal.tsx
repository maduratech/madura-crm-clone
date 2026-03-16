import React, { useState, useEffect, useMemo } from 'react';
import { DetailedHotel, HotelCostingItem, Currency, HotelRoom, Lead } from '../../types';
import { IconX, IconPlus, IconTrash, IconChevronDown, IconChevronLeft } from '../../constants';

interface HotelModalProps {
    isOpen: boolean;
    onClose: () => void;
    hotel: DetailedHotel;
    onSave: (hotel: DetailedHotel, costingHotel?: HotelCostingItem) => void;
    existingCostingHotel?: HotelCostingItem | null;
    lead?: Lead | null; // Lead data for child ages and validation
    itineraryStatus?: string; // Itinerary status to show confirmation number field when Confirmed
}

export const HotelModal: React.FC<HotelModalProps> = ({ isOpen, onClose, hotel, onSave, existingCostingHotel, lead, itineraryStatus }) => {
    const [formData, setFormData] = useState<DetailedHotel>(hotel);
    const [rooms, setRooms] = useState<HotelRoom[]>(hotel.rooms || []);
    const [expandedRooms, setExpandedRooms] = useState<Set<number>>(new Set());

    // Get available child ages from Lead
    const availableChildAges = useMemo(() => {
        if (!lead?.requirements?.child_ages || lead.requirements.child_ages.length === 0) {
            return [];
        }
        return lead.requirements.child_ages;
    }, [lead]);

    // Calculate totals for validation
    const totalAdults = useMemo(() => rooms.reduce((sum, room) => sum + room.adults, 0), [rooms]);
    const totalChildren = useMemo(() => rooms.reduce((sum, room) => sum + room.children, 0), [rooms]);
    
    // Validation warnings
    const validationWarnings = useMemo(() => {
        const warnings: string[] = [];
        if (lead?.requirements) {
            const maxAdults = lead.requirements.adults || 0;
            const maxChildren = lead.requirements.children || 0;
            
            if (totalAdults > maxAdults) {
                warnings.push(`Total adults (${totalAdults}) exceeds Lead requirement (${maxAdults})`);
            }
            if (totalChildren > maxChildren) {
                warnings.push(`Total children (${totalChildren}) exceeds Lead requirement (${maxChildren})`);
            }
        }
        return warnings;
    }, [totalAdults, totalChildren, lead]);

    useEffect(() => {
        // Set default check-in and check-out times if not already set
        const hotelWithDefaults = {
            ...hotel,
            check_in_time: hotel.check_in_time || '15:00', // Default 3pm
            check_out_time: hotel.check_out_time || '12:00' // Default 12pm
        };
        setFormData(hotelWithDefaults);
        // Initialize with one room if no rooms exist (for new hotels)
        if (!hotel.rooms || hotel.rooms.length === 0) {
            // Pre-populate from Lead requirements
            const leadAdults = lead?.requirements?.adults || 2;
            const leadChildren = lead?.requirements?.children || 0;
            const leadChildAges = lead?.requirements?.child_ages || [];
            // Ensure childAges array matches children count
            const defaultChildAges = leadChildAges.length >= leadChildren
                ? leadChildAges.slice(0, leadChildren)
                : [...leadChildAges, ...Array.from({ length: leadChildren - leadChildAges.length }, () => 0)];
            
            const defaultRoom: HotelRoom = {
                id: Date.now(),
                name: 'Room 1',
                adults: leadAdults,
                children: leadChildren,
                childAges: defaultChildAges,
                pricePerAdultPerNight: 0,
                childPrices: {}
            };
            setRooms([defaultRoom]);
            // Expand first room by default
            setExpandedRooms(new Set([defaultRoom.id]));
        } else {
            setRooms(hotel.rooms);
            // Expand all rooms by default
            setExpandedRooms(new Set(hotel.rooms.map(r => r.id)));
        }
    }, [hotel, isOpen, lead]);

    // Toggle room expansion
    const toggleRoomExpansion = (roomId: number) => {
        setExpandedRooms(prev => {
            const newSet = new Set(prev);
            if (newSet.has(roomId)) {
                newSet.delete(roomId);
            } else {
                newSet.add(roomId);
            }
            return newSet;
        });
    };

    // Calculate nights from dates
    const calculateNights = (checkIn: string, checkOut: string): number => {
        if (!checkIn || !checkOut) return 1;
        try {
            const checkInDate = new Date(checkIn);
            const checkOutDate = new Date(checkOut);
            if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) return 1;
            const diffTime = checkOutDate.getTime() - checkInDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays > 0 ? diffDays : 1;
        } catch (error) {
            console.error('Error calculating nights:', error);
            return 1;
        }
    };

    // Update check-out date when nights change
    const updateCheckOutFromNights = (nights: number) => {
        if (!formData.check_in_date) return;
        try {
            const checkIn = new Date(formData.check_in_date);
            if (isNaN(checkIn.getTime())) return; // Invalid date
            const checkOut = new Date(checkIn);
            checkOut.setDate(checkOut.getDate() + nights);
            if (isNaN(checkOut.getTime())) return; // Invalid date
            setFormData(prev => ({
                ...prev,
                check_out_date: checkOut.toISOString().split('T')[0],
                nights: nights
            }));
        } catch (error) {
            console.error('Error updating check-out date:', error);
        }
    };

    // Update nights when dates change
    const updateNightsFromDates = (checkIn: string, checkOut: string) => {
        const nights = calculateNights(checkIn, checkOut);
        setFormData(prev => ({ ...prev, nights }));
    };

    // Add new room
    const handleAddRoom = () => {
        // Pre-populate from Lead requirements for new rooms
        const leadAdults = lead?.requirements?.adults || 2;
        const leadChildren = lead?.requirements?.children || 0;
        const leadChildAges = lead?.requirements?.child_ages || [];
        // Ensure childAges array matches children count
        const defaultChildAges = leadChildAges.length >= leadChildren
            ? leadChildAges.slice(0, leadChildren)
            : [...leadChildAges, ...Array.from({ length: leadChildren - leadChildAges.length }, () => 0)];
        
        const newRoom: HotelRoom = {
            id: Date.now() + Math.random(),
            name: `Room ${rooms.length + 1}`,
            adults: leadAdults,
            children: leadChildren,
            childAges: defaultChildAges,
            pricePerAdultPerNight: 0,
            childPrices: {}
        };
        setRooms(prev => [...prev, newRoom]);
        // Automatically expand the new room
        setExpandedRooms(prev => new Set([...prev, newRoom.id]));
    };

    // Remove room
    const handleRemoveRoom = (roomId: number) => {
        setRooms(prev => prev.filter(r => r.id !== roomId));
    };

    // Update room field
    const updateRoom = (roomId: number, field: keyof HotelRoom, value: any) => {
        setRooms(prev => prev.map(room => {
            if (room.id === roomId) {
                if (field === 'children') {
                    const newChildren = parseInt(value) || 0;
                    const currentAges = room.childAges || [];
                    // Adjust childAges array to match new children count
                    let newAges = [...currentAges];
                    if (newChildren > currentAges.length) {
                        // Add empty ages for new children
                        while (newAges.length < newChildren) {
                            newAges.push(availableChildAges[0] || 0);
                        }
                    } else if (newChildren < currentAges.length) {
                        // Remove excess ages
                        newAges = newAges.slice(0, newChildren);
                    }
                    return { ...room, [field]: newChildren, childAges: newAges };
                }
                return { ...room, [field]: value };
            }
            return room;
        }));
    };

    // Update child age for a specific child index
    const updateChildAge = (roomId: number, childIndex: number, age: number) => {
        setRooms(prev => prev.map(room => {
            if (room.id === roomId) {
                const newAges = [...(room.childAges || [])];
                newAges[childIndex] = age;
                return { ...room, childAges: newAges };
            }
            return room;
        }));
    };

    // Update child price for a specific age
    const updateChildPrice = (roomId: number, age: number, price: number) => {
        setRooms(prev => prev.map(room => {
            if (room.id === roomId) {
                const newChildPrices = { ...room.childPrices };
                newChildPrices[age] = price;
                return { ...room, childPrices: newChildPrices };
            }
            return room;
        }));
    };

    // Calculate room total
    const calculateRoomTotal = (room: HotelRoom, nights: number): number => {
        const adultTotal = room.adults * room.pricePerAdultPerNight * nights;
        const childTotal = room.childAges.reduce((sum, age) => {
            const price = room.childPrices[age] || 0;
            const count = room.childAges.filter(a => a === age).length;
            return sum + (price * count * nights);
        }, 0);
        return adultTotal + childTotal;
    };

    // Group child ages by age value for display
    const getChildAgeGroups = (room: HotelRoom): { age: number; count: number }[] => {
        const groups: { [age: number]: number } = {};
        room.childAges.forEach(age => {
            groups[age] = (groups[age] || 0) + 1;
        });
        return Object.entries(groups).map(([age, count]) => ({
            age: parseInt(age),
            count
        }));
    };

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            return;
        }
        if (rooms.length === 0) {
            alert('Please add at least one room');
            return;
        }

        // Update formData with rooms
        const updatedHotel: DetailedHotel = {
            ...formData,
            rooms: rooms
        };

        // Create costing hotel item (for backward compatibility)
        // Calculate total cost from all rooms
        const totalCost = rooms.reduce((sum, room) => sum + calculateRoomTotal(room, formData.nights || 1), 0);
        const costingHotel: HotelCostingItem = {
            id: existingCostingHotel?.id || Date.now(),
            name: formData.name,
            city: formData.city || '',
            nights: formData.nights || 1,
            quantity: rooms.length,
            unitPrice: totalCost / (formData.nights || 1) / rooms.length, // Average per room per night
            currency: 'INR' as Currency,
            included: true,
            pricingType: 'Per Adult' as const
        };

        onSave(updatedHotel, costingHotel);
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
            
            {/* Drawer */}
            <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#191975] to-[#191975]/90 px-6 py-4 flex items-center justify-between flex-shrink-0">
                        <h3 className="text-lg font-semibold text-white">{hotel.id && hotel.id > 1000000 ? 'Add Hotel' : 'Edit Hotel'}</h3>
                        <button type="button" onClick={onClose} className="p-2 text-white hover:bg-white/10 rounded-md transition-colors">
                            <IconX className="w-5 h-5" />
                        </button>
                    </div>
                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Static Hotel Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Hotel Name *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                required
                                className="w-full p-2 border border-slate-300 rounded-md"
                                placeholder="Enter hotel name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Check-in Date *</label>
                            <input
                                type="date"
                                value={formData.check_in_date}
                                onChange={e => {
                                    const checkIn = e.target.value;
                                    setFormData(prev => ({ ...prev, check_in_date: checkIn }));
                                    updateNightsFromDates(checkIn, formData.check_out_date);
                                }}
                                required
                                className="w-full p-2 border border-slate-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Check-in Time</label>
                            <input
                                type="time"
                                value={formData.check_in_time || '15:00'}
                                onChange={e => setFormData(prev => ({ ...prev, check_in_time: e.target.value }))}
                                className="w-full p-2 border border-slate-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Check-out Date *</label>
                            <input
                                type="date"
                                value={formData.check_out_date}
                                onChange={e => {
                                    const checkOut = e.target.value;
                                    setFormData(prev => ({ ...prev, check_out_date: checkOut }));
                                    updateNightsFromDates(formData.check_in_date, checkOut);
                                }}
                                required
                                className="w-full p-2 border border-slate-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Check-out Time</label>
                            <input
                                type="time"
                                value={formData.check_out_time || '12:00'}
                                onChange={e => setFormData(prev => ({ ...prev, check_out_time: e.target.value }))}
                                className="w-full p-2 border border-slate-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nights</label>
                            <input
                                type="number"
                                value={formData.nights}
                                onChange={e => {
                                    const nights = parseInt(e.target.value) || 1;
                                    updateCheckOutFromNights(nights);
                                }}
                                min="1"
                                className="w-full p-2 border border-slate-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Room Type</label>
                            <input
                                type="text"
                                value={formData.room_type || ''}
                                onChange={e => setFormData(prev => ({ ...prev, room_type: e.target.value }))}
                                className="w-full p-2 border border-slate-300 rounded-md"
                                placeholder="e.g., Deluxe, Standard"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Meals Included</label>
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.meals?.breakfast || false}
                                        onChange={e => setFormData(prev => ({ 
                                            ...prev, 
                                            meals: { 
                                                ...(prev.meals || {}), 
                                                breakfast: e.target.checked 
                                            } 
                                        }))}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                    />
                                    <span className="text-sm text-slate-700">Breakfast</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.meals?.lunch || false}
                                        onChange={e => setFormData(prev => ({ 
                                            ...prev, 
                                            meals: { 
                                                ...(prev.meals || {}), 
                                                lunch: e.target.checked 
                                            } 
                                        }))}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                    />
                                    <span className="text-sm text-slate-700">Lunch</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.meals?.dinner || false}
                                        onChange={e => setFormData(prev => ({ 
                                            ...prev, 
                                            meals: { 
                                                ...(prev.meals || {}), 
                                                dinner: e.target.checked 
                                            } 
                                        }))}
                                        className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                    />
                                    <span className="text-sm text-slate-700">Dinner</span>
                                </label>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">City *</label>
                            <input
                                type="text"
                                value={formData.city || ''}
                                onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                                required
                                className="w-full p-2 border border-slate-300 rounded-md"
                                placeholder="Enter city/location"
                            />
                        </div>
                    </div>

                    {/* Validation Warnings */}
                    {validationWarnings.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                            <p className="text-sm font-medium text-yellow-800 mb-1">Warning:</p>
                            <ul className="list-disc list-inside text-sm text-yellow-700">
                                {validationWarnings.map((warning, idx) => (
                                    <li key={idx}>{warning}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Rooms Section */}
                    <div className="border-t pt-4">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-semibold text-slate-700">Rooms</h4>
                            <button
                                type="button"
                                onClick={handleAddRoom}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#191975] text-white rounded-md hover:bg-[#191975]/90"
                            >
                                <IconPlus className="w-4 h-4" />
                                Add Room
                            </button>
                        </div>

                        {rooms.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">No rooms added. Click "Add Room" to get started.</p>
                        ) : (
                            <div className="space-y-4">
                                {rooms.map((room, roomIndex) => {
                                    const roomTotal = calculateRoomTotal(room, formData.nights || 1);
                                    const childAgeGroups = getChildAgeGroups(room);
                                    const isExpanded = expandedRooms.has(room.id);
                                    
                                    return (
                                        <div key={room.id} className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden">
                                            {/* Room Header - Always Visible */}
                                            <div 
                                                className="p-4 bg-white border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                                                onClick={() => toggleRoomExpansion(room.id)}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-3 flex-1">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleRoomExpansion(room.id);
                                                            }}
                                                            className="p-1 text-slate-600 hover:text-slate-900"
                                                        >
                                                            {isExpanded ? (
                                                                <IconChevronDown className="w-5 h-5" />
                                                            ) : (
                                                                <IconChevronLeft className="w-5 h-5" />
                                                            )}
                                                        </button>
                                                        <div className="flex-1">
                                                            <input
                                                                type="text"
                                                                value={room.name}
                                                                onChange={e => {
                                                                    e.stopPropagation();
                                                                    updateRoom(room.id, 'name', e.target.value);
                                                                }}
                                                                onClick={e => e.stopPropagation()}
                                                                className="w-full p-2 border border-slate-300 rounded-md bg-white font-medium"
                                                                placeholder="e.g., Ram & Sita Room"
                                                            />
                                                        </div>
                                                        <div className="text-sm text-slate-600">
                                                            {room.adults} Adults, {room.children} Children
                                                        </div>
                                                        <div className="text-sm font-semibold text-slate-900">
                                                            Total ({formData.nights || 1} nights): ₹{roomTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    </div>
                                                    {rooms.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRemoveRoom(room.id);
                                                            }}
                                                            className="ml-2 p-2 text-red-600 hover:bg-red-50 rounded-md"
                                                            title="Remove Room"
                                                        >
                                                            <IconTrash className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Room Details - Expandable */}
                                            {isExpanded && (
                                                <div className="p-4 space-y-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-medium text-slate-700 mb-1">Adults</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={room.adults}
                                                                onChange={e => updateRoom(room.id, 'adults', parseInt(e.target.value) || 0)}
                                                                className="w-full p-2 border border-slate-300 rounded-md bg-white"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-slate-700 mb-1">Children</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={room.children}
                                                                onChange={e => updateRoom(room.id, 'children', parseInt(e.target.value) || 0)}
                                                                className="w-full p-2 border border-slate-300 rounded-md bg-white"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Child Age Selection */}
                                                    {room.children > 0 && (
                                                        <div>
                                                            <label className="block text-sm font-medium text-slate-700 mb-2">Child Ages (from Lead)</label>
                                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                                {Array.from({ length: room.children }).map((_, childIndex) => (
                                                                    <div key={childIndex}>
                                                                        <label className="block text-xs text-slate-600 mb-1">Child {childIndex + 1}</label>
                                                                        <select
                                                                            value={room.childAges[childIndex] || availableChildAges[0] || ''}
                                                                            onChange={e => updateChildAge(room.id, childIndex, parseInt(e.target.value))}
                                                                            className="w-full p-2 border border-slate-300 rounded-md bg-white text-sm"
                                                                        >
                                                                            {availableChildAges.length > 0 ? (
                                                                                availableChildAges.map(age => (
                                                                                    <option key={age} value={age}>{age} years</option>
                                                                                ))
                                                                            ) : (
                                                                                <option value="">No ages available</option>
                                                                            )}
                                                                        </select>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Confirmation Number - Only shown when status is Confirmed */}
                                                    {itineraryStatus === 'Confirmed' && (
                                                        <div className="border-t pt-4">
                                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                                Confirmation Number
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={room.confirmation_number || ''}
                                                                onChange={e => updateRoom(room.id, 'confirmation_number', e.target.value)}
                                                                className="w-full p-2 border border-slate-300 rounded-md bg-white"
                                                                placeholder="Enter room confirmation number"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Pricing Section */}
                                                    <div className="border-t pt-4 space-y-3">
                                                        <div>
                                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                                Price per Adult (per night) - INR
                                                            </label>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-600 font-medium">₹</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={room.pricePerAdultPerNight}
                                                                    onChange={e => updateRoom(room.id, 'pricePerAdultPerNight', parseFloat(e.target.value) || 0)}
                                                                    className="flex-1 p-2 border border-slate-300 rounded-md bg-white"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Child Prices by Age Group */}
                                                        {childAgeGroups.length > 0 && (
                                                            <div>
                                                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                                                    Price per Child (per night) - INR
                                                                </label>
                                                                <div className="space-y-2">
                                                                    {childAgeGroups.map(({ age, count }) => (
                                                                        <div key={age} className="flex items-center gap-2">
                                                                            <span className="text-sm text-slate-600 w-32">
                                                                                Child ({age} years){count > 1 ? ` × ${count}` : ''}:
                                                                            </span>
                                                                            <span className="text-slate-600 font-medium">₹</span>
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                step="0.01"
                                                                                value={room.childPrices[age] || 0}
                                                                                onChange={e => updateChildPrice(room.id, age, parseFloat(e.target.value) || 0)}
                                                                                className="flex-1 p-2 border border-slate-300 rounded-md bg-white"
                                                                                placeholder="0.00"
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    </div>
                    
                    {/* Footer */}
                    <div className="border-t bg-white px-6 py-4 flex justify-end gap-2 flex-shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-slate-300 hover:bg-slate-50">
                            Cancel
                        </button>
                        <button type="submit" className="px-4 py-2 text-sm rounded-md bg-[#191975] text-white hover:bg-[#191975]/90">
                            Save Hotel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
