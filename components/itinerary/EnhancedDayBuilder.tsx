import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    ItineraryDay, DetailedActivity, DetailedHotel, DetailedFlight,
    TransferType, Sightseeing, HotelCostingItem, Currency
} from '../../types';
import { IconChevronDown, IconClock } from '../../constants';
import {
    FlightIcon, HotelIcon, TransferIcon, ActivityIcon, IconAlertTriangle
} from './ItineraryIcons';

// Helper function to calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Helper function to check if two attraction names are similar (duplicate check)
const areAttractionsSimilar = (name1: string, name2: string): boolean => {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    if (n1 === n2) return true;
    // Check if one contains the other (with at least 80% similarity)
    const longer = n1.length > n2.length ? n1 : n2;
    const shorter = n1.length > n2.length ? n2 : n1;
    return longer.includes(shorter) && shorter.length / longer.length > 0.8;
};

const EnhancedDayBuilder: React.FC<{
    plan: ItineraryDay[];
    isEditing: boolean;
    onDayChange: (dayId: number, field: 'title' | 'description' | 'meals', value: string | { b: boolean; l: boolean; d: boolean; }) => void;
    onAddDay: () => void;
    onRemoveDay: (dayId: number) => void;
    startDate: Date | null;
    activities?: DetailedActivity[];
    hotels?: DetailedHotel[];
    flights?: DetailedFlight[];
    transferTypes?: TransferType[];
    sightseeing?: Sightseeing[];
    onAddTransfer?: (dayNumber: number) => void;
    onRemoveTransfer?: (activityId: number) => void;
    onModifyTransfer?: (activityId: number, dayNumber: number) => void;
    onOpenManualTransferModal?: (dayNumber: number) => void;
    onAddActivity?: (dayNumber: number) => void;
    onRemoveActivity?: (activityId: number) => void;
    onModifyActivity?: (activityId: number) => void;
    onActivityChange?: (activityId: number, field: keyof DetailedActivity | 'from' | 'to', value: any) => void;
    onOpenAttractionDrawer?: (dayNumber: number) => void;
    onOpenManualAttractionModal?: (dayNumber: number) => void;
    onAddHotel?: (dayNumber: number) => void;
    onRemoveHotel?: (hotelId: number) => void;
    onModifyHotel?: (hotelId: number) => void;
    onAddFlight?: (dayNumber: number, direction: 'arrival' | 'departure') => void;
    onRemoveFlight?: (flightId: number) => void;
    onModifyFlight?: (flightId: number) => void;
    onUseAI?: () => void;
    travelDate?: string;
    duration?: string;
    destination?: string;
    adults?: number;
    children?: number;
    costingHotels?: HotelCostingItem[];
    fxRates?: Record<Currency, number> | null;
    onHotelCostingChange?: (hotelId: number, field: string, value: any) => void;
    onHotelChange?: (hotelId: number, field: keyof DetailedHotel, value: any) => void;
    itineraryStatus?: string; // Itinerary status to show confirmation numbers when Confirmed
}> = ({ 
    plan, isEditing, onDayChange, onAddDay, onRemoveDay, startDate, 
    activities = [], hotels = [], flights = [], transferTypes = [], sightseeing = [],
    onAddTransfer, onRemoveTransfer, onModifyTransfer, onAddActivity, onRemoveActivity, onModifyActivity, onActivityChange,
    onAddHotel, onRemoveHotel, onModifyHotel, onAddFlight, onRemoveFlight, onModifyFlight,
    onUseAI, travelDate, duration, destination, adults, children, costingHotels = [], fxRates = null,
    onHotelCostingChange, onHotelChange, onOpenAttractionDrawer, onOpenManualAttractionModal, onOpenManualTransferModal,
    itineraryStatus
}) => {
    const [selectedDay, setSelectedDay] = useState<number>(1);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        flights: true,
        transfers: true,
        hotels: true,
        activities: true
    });
    const [hoveredDay, setHoveredDay] = useState<number | null>(null);
    const warningTooltipRef = useRef<HTMLDivElement>(null);

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    // Group items by day
    const activitiesByDay = useMemo(() => {
        const grouped: Record<number, { transfers: DetailedActivity[]; regularActivities: DetailedActivity[] }> = {};
        activities.forEach(activity => {
            const dayNum = activity.day_number || 1;
            if (!grouped[dayNum]) {
                grouped[dayNum] = { transfers: [], regularActivities: [] };
            }
            // Attractions/sightseeing are NEVER transfers: any activity with sightseeing_id goes to regularActivities only
            const isTransfer =
                !activity.sightseeing_id &&
                (activity.transfer_id != null ||
                    activity.transfer_name != null ||
                    activity.linked_activity_id != null ||
                    activity.linked_hotel_id != null);

            if (isTransfer) {
                grouped[dayNum].transfers.push(activity);
            } else {
                grouped[dayNum].regularActivities.push(activity);
            }
        });
        return grouped;
    }, [activities]);

    const hotelsByDay = useMemo(() => {
        const grouped: Record<number, DetailedHotel[]> = {};
        hotels.forEach(hotel => {
            if (hotel.check_in_date && hotel.check_out_date) {
                const checkIn = new Date(hotel.check_in_date);
                const checkOut = new Date(hotel.check_out_date);
                const startDay = Math.floor((checkIn.getTime() - (startDate?.getTime() || 0)) / (1000 * 60 * 60 * 24)) + 1;
                const endDay = Math.floor((checkOut.getTime() - (startDate?.getTime() || 0)) / (1000 * 60 * 60 * 24)) + 1;
                for (let d = Math.max(1, startDay); d <= endDay && d <= plan.length; d++) {
                    if (!grouped[d]) grouped[d] = [];
                    if (!grouped[d].find(h => h.id === hotel.id)) {
                        grouped[d].push(hotel);
                    }
                }
            }
        });
        return grouped;
    }, [hotels, startDate, plan.length]);

    const flightsByDay = useMemo(() => {
        const grouped: Record<number, { arrival: DetailedFlight[]; departure: DetailedFlight[]; intercity: DetailedFlight[] }> = {};
        flights.forEach(flight => {
            // Determine day based on flight segments departure time or direction
            const flightDate = flight.segments?.[0]?.departure_time ? new Date(flight.segments[0].departure_time) : null;
            let dayNum = 1;
            if (flightDate && startDate) {
                dayNum = Math.floor((flightDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                dayNum = Math.max(1, Math.min(dayNum, plan.length));
            }
            if (!grouped[dayNum]) {
                grouped[dayNum] = { arrival: [], departure: [], intercity: [] };
            }
            if (flight.direction === 'onward') {
                // Onward flights only on first day
                if (dayNum === 1) {
                    grouped[dayNum].arrival.push(flight);
                }
            } else if (flight.direction === 'return') {
                // Return flights only on last day
                if (dayNum === plan.length) {
                    grouped[dayNum].departure.push(flight);
                }
            } else if (flight.direction === 'intercity') {
                // Intercity flights only on middle days (not first or last)
                if (dayNum > 1 && dayNum < plan.length) {
                    grouped[dayNum].intercity.push(flight);
                }
            }
        });
        return grouped;
    }, [flights, startDate, plan.length]);

    const selectedDayData = plan[selectedDay - 1];
    const selectedDayDate = startDate ? new Date(startDate) : null;
    if (selectedDayDate) {
        selectedDayDate.setDate(selectedDayDate.getDate() + selectedDay - 1);
    }

    const dayTransfers = activitiesByDay[selectedDay]?.transfers || [];
    const dayActivities = activitiesByDay[selectedDay]?.regularActivities || [];
    const dayHotels = hotelsByDay[selectedDay] || [];
    const dayFlights = flightsByDay[selectedDay] || { arrival: [], departure: [], intercity: [] };
    const isFirstDay = selectedDay === 1;
    const isLastDay = selectedDay === plan.length;
    const isMiddleDay = selectedDay > 1 && selectedDay < plan.length;

    // Build flow-ordered list: Transfer (hotel to attraction) -> Attraction -> Transfer (attraction to attraction) -> Attraction -> Transfer (attraction to hotel)
    const flowOrderedItems = useMemo(() => {
        const items: Array<{ type: 'transfer' | 'activity' | 'hotel' | 'flight'; data: any; order: number }> = [];
        
        // Add flights first (if any)
        dayFlights.arrival.forEach(flight => {
            items.push({ type: 'flight', data: flight, order: 0 });
        });
        dayFlights.intercity.forEach(flight => {
            items.push({ type: 'flight', data: flight, order: 0 });
        });
        
        // If we have hotels and activities, create flow order
        if (dayHotels.length > 0 && dayActivities.length > 0) {
            // 1. Transfer from hotel to first attraction (if exists)
            const hotelToFirstTransfer = dayTransfers.find(t => 
                (t.linked_hotel_id && t.position === 'before' && t.linked_activity_id === dayActivities[0]?.id) ||
                (t.linked_activity_id === dayActivities[0]?.id && t.position === 'before')
            );
            // If no linked transfer found, use first standalone transfer as hotel-to-first-attraction
            const firstStandaloneTransfer = !hotelToFirstTransfer ? dayTransfers.find(t => 
                !t.linked_activity_id && !t.linked_hotel_id
            ) : null;
            if (hotelToFirstTransfer || firstStandaloneTransfer) {
                items.push({ type: 'transfer', data: hotelToFirstTransfer || firstStandaloneTransfer, order: 1 });
            }
            
            // 2. Activities with transfers between them
            dayActivities.forEach((activity, index) => {
                items.push({ type: 'activity', data: activity, order: 2 + index * 2 });
                
                // Add transfer to next activity (if exists and not last activity)
                if (index < dayActivities.length - 1) {
                    const transferToNext = dayTransfers.find(t => 
                        t.linked_activity_id === activity.id && t.position === 'after' &&
                        (!t.linked_hotel_id || t.linked_hotel_id === null)
                    );
                    // If no linked transfer, try to find a standalone transfer that could be between activities
                    const standaloneTransferForNext = !transferToNext ? dayTransfers.find(t => 
                        !t.linked_activity_id && !t.linked_hotel_id && 
                        !items.find(i => i.type === 'transfer' && i.data.id === t.id)
                    ) : null;
                    if (transferToNext || standaloneTransferForNext) {
                        items.push({ type: 'transfer', data: transferToNext || standaloneTransferForNext, order: 3 + index * 2 });
                    }
                }
            });
            
            // 3. Transfer from last attraction to hotel (if exists and not already added)
            const lastActivityToHotelTransfer = dayTransfers.find(t => 
                (t.linked_activity_id === dayActivities[dayActivities.length - 1]?.id && t.position === 'after') ||
                (t.linked_hotel_id && t.position === 'after')
            );
            // If no linked transfer, use last standalone transfer as last-attraction-to-hotel
            const lastStandaloneTransfer = !lastActivityToHotelTransfer ? dayTransfers.find(t => 
                !t.linked_activity_id && !t.linked_hotel_id && 
                !items.find(i => i.type === 'transfer' && i.data.id === t.id)
            ) : null;
            if ((lastActivityToHotelTransfer || lastStandaloneTransfer) && 
                !items.find(i => i.type === 'transfer' && i.data.id === (lastActivityToHotelTransfer || lastStandaloneTransfer)?.id)) {
                items.push({ type: 'transfer', data: lastActivityToHotelTransfer || lastStandaloneTransfer, order: 2 + dayActivities.length * 2 });
            }
            
            // Add any remaining standalone transfers that weren't placed
            dayTransfers.forEach(transfer => {
                if (!items.find(i => i.type === 'transfer' && i.data.id === transfer.id)) {
                    items.push({ type: 'transfer', data: transfer, order: 100 + dayTransfers.indexOf(transfer) });
                }
            });
        } else {
            // If no hotels or activities, just add transfers and activities in their original order
            dayTransfers.forEach(transfer => {
                items.push({ type: 'transfer', data: transfer, order: 1 });
            });
            dayActivities.forEach(activity => {
                items.push({ type: 'activity', data: activity, order: 2 });
            });
        }
        
        // Add hotels at the end (or if no activities)
        if (dayActivities.length === 0) {
            dayHotels.forEach(hotel => {
                items.push({ type: 'hotel', data: hotel, order: 10 });
            });
        } else {
            // Hotels are shown separately, but we can add them after activities if needed
            dayHotels.forEach(hotel => {
                items.push({ type: 'hotel', data: hotel, order: 100 });
            });
        }
        
        // Add departure flights last
        dayFlights.departure.forEach(flight => {
            items.push({ type: 'flight', data: flight, order: 200 });
        });
        
        return items.sort((a, b) => a.order - b.order);
    }, [dayTransfers, dayActivities, dayHotels, dayFlights]);

    const includedSummary = [
        dayFlights.arrival.length + dayFlights.departure.length > 0 ? `${dayFlights.arrival.length + dayFlights.departure.length} Flight${dayFlights.arrival.length + dayFlights.departure.length > 1 ? 's' : ''}` : null,
        dayTransfers.length > 0 ? `${dayTransfers.length} Transfer${dayTransfers.length > 1 ? 's' : ''}` : null,
        dayHotels.length > 0 ? `${dayHotels.length} Hotel${dayHotels.length > 1 ? 's' : ''}` : null,
        dayActivities.length > 0 ? `${dayActivities.length} ${dayActivities.length > 1 ? 'Activities' : 'Activity'}` : null,
    ].filter(Boolean);

    // Calculate warnings for each day
    const dayWarnings = useMemo(() => {
        const warnings: Record<number, Array<{ message: string; type: 'error' | 'warning' }>> = {};
        const numDays = plan.length;
        
        for (let day = 1; day <= numDays; day++) {
            const dayActivities = activitiesByDay[day]?.regularActivities || [];
            const dayTotalHours = dayActivities.reduce((sum, a) => sum + (a.average_duration_hours || 0), 0);
            const longAttractions = dayActivities.filter(a => (a.average_duration_hours || 0) >= 5);
            const dayWarns: Array<{ message: string; type: 'error' | 'warning' }> = [];
            
            if (dayTotalHours > 8) {
                dayWarns.push({ message: `Exceeds 8 hours limit (${dayTotalHours.toFixed(1)} hours)`, type: 'warning' });
            }
            
            if (longAttractions.length > 1) {
                dayWarns.push({ message: `Multiple long attractions (max 1 allowed)`, type: 'warning' });
            }
            
            // Check distances
            const attractionsWithCoords = dayActivities.filter(a => a.latitude && a.longitude);
            for (let i = 0; i < attractionsWithCoords.length; i++) {
                for (let j = i + 1; j < attractionsWithCoords.length; j++) {
                    const dist = calculateDistance(
                        attractionsWithCoords[i].latitude!,
                        attractionsWithCoords[i].longitude!,
                        attractionsWithCoords[j].latitude!,
                        attractionsWithCoords[j].longitude!
                    );
                    if (dist > 12) {
                        dayWarns.push({
                            message: `${attractionsWithCoords[i].name} and ${attractionsWithCoords[j].name} are ${dist.toFixed(1)}km apart`,
                            type: 'warning'
                        });
                    }
                }
            }
            
            // Check for duplicate attractions (similar names)
            for (let i = 0; i < dayActivities.length; i++) {
                for (let j = i + 1; j < dayActivities.length; j++) {
                    if (areAttractionsSimilar(dayActivities[i].name, dayActivities[j].name)) {
                        dayWarns.push({
                            message: `Duplicate attraction detected`,
                            type: 'warning'
                        });
                    }
                }
            }
            
            // Check arrival/departure day restrictions
            if (day === 1) {
                const invalidActivities = dayActivities.filter(a => {
                    if (a.tag === 'Night-only') return false;
                    if (!a.start_time) return true;
                    const [hour] = a.start_time.split(':').map(Number);
                    return hour < 17;
                });
                if (invalidActivities.length > 0) {
                    dayWarns.push({
                        message: `Arrival day: Activities should be after 5 PM or Night-only tours after 6 PM`,
                        type: 'warning'
                    });
                }
                
                const invalidDuration = dayActivities.filter(a => {
                    const hours = a.average_duration_hours || 0;
                    return hours < 2 || hours > 3;
                });
                if (invalidDuration.length > 0) {
                    dayWarns.push({
                        message: `Arrival day: Activities should be 2-3 hours duration`,
                        type: 'warning'
                    });
                }
            } else if (day === numDays) {
                const invalidActivities = dayActivities.filter(a => {
                    if (!a.start_time) return true;
                    const [hour] = a.start_time.split(':').map(Number);
                    return hour >= 12;
                });
                if (invalidActivities.length > 0) {
                    dayWarns.push({
                        message: `Departure day: Activities should be before 12 PM (morning only)`,
                        type: 'warning'
                    });
                }
                
                const invalidDuration = dayActivities.filter(a => {
                    const hours = a.average_duration_hours || 0;
                    return hours < 2 || hours > 3;
                });
                if (invalidDuration.length > 0) {
                    dayWarns.push({
                        message: `Departure day: Activities should be 2-3 hours duration`,
                        type: 'warning'
                    });
                }
            }
            
            // Check night-only attractions timing
            dayActivities.forEach(activity => {
                if (activity.tag === 'Night-only' && activity.start_time) {
                    const [hour] = activity.start_time.split(':').map(Number);
                    if (hour < 18) {
                        dayWarns.push({ message: `${activity.name} is night-only but scheduled before 6:30 PM`, type: 'warning' });
                    }
                }
            });
            
            if (dayWarns.length > 0) {
                warnings[day] = dayWarns;
            }
        }
        return warnings;
    }, [activitiesByDay, plan.length]);

    return (
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
            {/* Left Sidebar - Day Navigation */}
            <div className="w-full lg:w-64 flex-shrink-0">
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 sm:p-4 sticky top-4 sm:top-6">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <h3 className="font-semibold text-sm sm:text-base text-slate-900">Day Plan</h3>
                        {isEditing && onUseAI && (
                            <button
                                onClick={onUseAI}
                                className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-white bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 rounded-md transition-colors flex items-center gap-1 sm:gap-1.5 shadow-md"
                                title="AI will automatically arrange all attractions across all days based on travel date, duration, and traveler count"
                            >
                                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <span className="hidden sm:inline">Use AI</span>
                            </button>
                        )}
                    </div>
                    <div className="space-y-2">
                        {plan.map((day, index) => {
                            const dayNum = index + 1;
                            const dayDate = startDate ? new Date(startDate) : null;
                            if (dayDate) {
                                dayDate.setDate(dayDate.getDate() + index);
                            }
                            const isSelected = selectedDay === dayNum;
                            return (
                                <button
                                    key={day.id}
                                    onClick={() => setSelectedDay(dayNum)}
                                    className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors ${
                                        isSelected 
                                            ? 'bg-[#191975] text-white' 
                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                        {isSelected && (
                                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full flex-shrink-0"></div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-xs sm:text-sm truncate">
                                                {dayDate ? dayDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : `Day ${dayNum}`}
                                            </div>
                                            <div className={`text-[10px] sm:text-xs ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                                                {dayDate ? dayDate.toLocaleDateString('en-US', { weekday: 'short' }) : ''}
                                            </div>
                                        </div>
                                        {dayWarnings[dayNum] && dayWarnings[dayNum].length > 0 && (
                                            <div 
                                                className="flex-shrink-0 relative"
                                                onMouseEnter={() => setHoveredDay(dayNum)}
                                                onMouseLeave={() => setHoveredDay(null)}
                                            >
                                                <IconAlertTriangle className={`w-4 h-4 ${isSelected ? 'text-yellow-300' : 'text-yellow-600'} cursor-help`} />
                                                {hoveredDay === dayNum && (
                                                    <div 
                                                        ref={warningTooltipRef}
                                                        className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 w-72 p-3 bg-yellow-50 border border-yellow-200 rounded-lg shadow-xl"
                                                        style={{ whiteSpace: 'normal', pointerEvents: 'auto' }}
                                                    >
                                                        <div className="text-xs font-semibold text-yellow-800 mb-2 flex items-center gap-1">
                                                            <IconAlertTriangle className="w-3.5 h-3.5 text-yellow-600" />
                                                            Warnings for Day {dayNum}:
                                                        </div>
                                                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                                            {dayWarnings[dayNum].map((warning, idx) => (
                                                                <div key={idx} className="text-xs text-yellow-700 leading-relaxed">
                                                                    • {warning.message}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                        {isEditing && (
                            <button
                                onClick={onAddDay}
                                className="w-full mt-2 px-3 py-2 text-sm font-medium text-[#191975] border-2 border-dashed border-[#191975] rounded-lg hover:bg-[#191975]/5 transition-colors"
                            >
                                + Add Day
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1">
                {selectedDayData && (
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
                        {/* Day Header */}
                        <div className="bg-gradient-to-r from-[#191975] to-[#191975]/90 px-3 sm:px-6 py-3 sm:py-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                                <div className="flex-1 min-w-0 w-full sm:w-auto">
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-white font-bold text-base sm:text-xl whitespace-nowrap">Day {selectedDay}</span>
                                                <input
                                                    type="text"
                                                    value={selectedDayData.title?.replace(/^Day \d+\s*[-–—]?\s*/i, '') || ''}
                                                    onChange={e => {
                                                        const cleanTitle = e.target.value.replace(/^Day \d+\s*[-–—]?\s*/i, '');
                                                        onDayChange(selectedDayData.id, 'title', cleanTitle);
                                                    }}
                                                    className="flex-1 min-w-0 bg-white/20 text-white font-bold text-base sm:text-xl border-b border-white/30 focus:border-white focus:outline-none placeholder-white/70 px-2 py-1"
                                                    placeholder="Day title..."
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <h2 className="text-white font-bold text-base sm:text-xl break-words">
                                            Day {selectedDay}{selectedDayData.title ? ` – ${selectedDayData.title.replace(/^Day \d+\s*[-–—]?\s*/i, '')}` : ''}
                                        </h2>
                                    )}
                                    {selectedDayDate && (
                                        <p className="text-white/80 text-xs sm:text-sm mt-1">
                                            {selectedDayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                        </p>
                                    )}
                                    {includedSummary.length > 0 && (
                                        <p className="text-white/90 text-xs sm:text-sm mt-2 font-medium break-words">
                                            INCLUDED: {includedSummary.join(', ')}
                                        </p>
                                    )}
                                </div>
                                {isEditing && (
                                    <button
                                        onClick={() => onRemoveDay(selectedDayData.id)}
                                        className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors ml-0 sm:ml-4 w-full sm:w-auto whitespace-nowrap"
                                    >
                                        <span className="hidden sm:inline">Remove Day</span>
                                        <span className="sm:hidden">Remove</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
                            {/* FLIGHT Section - Only show on first day (arrival), last day (departure), or middle days (intercity) */}
                            {((isFirstDay && (dayFlights.arrival.length > 0 || isEditing)) || 
                              (isLastDay && (dayFlights.departure.length > 0 || isEditing)) ||
                              (isMiddleDay && (dayFlights.intercity.length > 0 || isEditing))) && (
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => toggleSection('flights')}
                                        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <FlightIcon className="w-5 h-5 text-slate-700" />
                                            <span className="font-semibold text-slate-900">FLIGHT</span>
                                        </div>
                                        <IconChevronDown className={`w-5 h-5 text-slate-600 transition-transform ${expandedSections.flights ? '' : '-rotate-180'}`} />
                                    </button>
                                    {expandedSections.flights && (
                                        <div className="p-4 space-y-3">
                                            {dayFlights.arrival.length === 0 && dayFlights.departure.length === 0 && dayFlights.intercity.length === 0 ? (
                                                <div className="text-center py-8 text-slate-500">
                                                    <p className="text-sm mb-2">No flights added</p>
                                                    {isEditing && onAddFlight && (
                                                        <div className="space-y-2">
                                                            {isFirstDay && (
                                                                <>
                                                                    <button
                                                                        onClick={() => onAddFlight(selectedDay, 'arrival')}
                                                                        className="w-full px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                                                                    >
                                                                        Search Flight
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (onAddFlight) {
                                                                                (window as any).__openManualFlightModal?.(selectedDay, 'onward');
                                                                            }
                                                                        }}
                                                                        className="w-full px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                                                                    >
                                                                        Add Manually
                                                                    </button>
                                                                </>
                                                            )}
                                                            {isLastDay && (
                                                                <>
                                                                    <button
                                                                        onClick={() => onAddFlight(selectedDay, 'departure')}
                                                                        className="w-full px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                                                                    >
                                                                        Search Flight
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (onAddFlight) {
                                                                                (window as any).__openManualFlightModal?.(selectedDay, 'return');
                                                                            }
                                                                        }}
                                                                        className="w-full px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                                                                    >
                                                                        Add Manually
                                                                    </button>
                                                                </>
                                                            )}
                                                            {isMiddleDay && (
                                                                <>
                                                                    <button
                                                                        onClick={() => onAddFlight(selectedDay, 'arrival')}
                                                                        className="w-full px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                                                                    >
                                                                        Search Flight
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (onAddFlight) {
                                                                                (window as any).__openManualFlightModal?.(selectedDay, 'intercity');
                                                                            }
                                                                        }}
                                                                        className="w-full px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                                                                    >
                                                                        Add Manually
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                    {dayFlights.arrival.map(flight => (
                                                        <div key={flight.id} className="bg-white border border-slate-200 rounded-lg p-4">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">Arrival</span>
                                                                        <span className="text-sm text-slate-600">Arrival in {flight.segments?.[0]?.to_airport || 'Destination'}</span>
                                                                    </div>
                                                                    {flight.segments && flight.segments.length > 0 && (
                                                                        <div className="text-sm text-slate-700">
                                                                            {flight.segments[0].airline} • {flight.segments[0].from_airport} → {flight.segments[flight.segments.length - 1].to_airport}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {isEditing && (
                                                                    <div className="flex items-center gap-2">
                                                                        {onModifyFlight && (
                                                                            <button
                                                                                onClick={() => onModifyFlight(flight.id)}
                                                                                className="px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded"
                                                                            >
                                                                                MODIFY
                                                                            </button>
                                                                        )}
                                                                        {onRemoveFlight && (
                                                                            <button
                                                                                onClick={() => onRemoveFlight(flight.id)}
                                                                                className="px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 rounded"
                                                                            >
                                                                                REMOVE
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {dayFlights.departure.map(flight => (
                                                        <div key={flight.id} className="bg-white border border-slate-200 rounded-lg p-4">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">Departure</span>
                                                                        <span className="text-sm text-slate-600">Departure from {flight.segments?.[0]?.from_airport || 'Origin'}</span>
                                                                    </div>
                                                                    {flight.segments && flight.segments.length > 0 && (
                                                                        <div className="text-sm text-slate-700">
                                                                            {flight.segments[0].airline} • {flight.segments[0].from_airport} → {flight.segments[flight.segments.length - 1].to_airport}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {isEditing && (
                                                                    <div className="flex items-center gap-2">
                                                                        {onModifyFlight && (
                                                                            <button
                                                                                onClick={() => onModifyFlight(flight.id)}
                                                                                className="px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded"
                                                                            >
                                                                                MODIFY
                                                                            </button>
                                                                        )}
                                                                        {onRemoveFlight && (
                                                                            <button
                                                                                onClick={() => onRemoveFlight(flight.id)}
                                                                                className="px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 rounded"
                                                                            >
                                                                                REMOVE
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {isEditing && onAddFlight && (
                                                        <div className="pt-2 border-t border-slate-200">
                                                            {isFirstDay && (
                                                                <button
                                                                    onClick={() => {
                                                                        if ((window as any).__openManualFlightModal) {
                                                                            (window as any).__openManualFlightModal(selectedDay, 'onward');
                                                                        }
                                                                    }}
                                                                    className="w-full px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                                                                >
                                                                    + Add Flight
                                                                </button>
                                                            )}
                                                            {isLastDay && (
                                                                <button
                                                                    onClick={() => {
                                                                        if ((window as any).__openManualFlightModal) {
                                                                            (window as any).__openManualFlightModal(selectedDay, 'return');
                                                                        }
                                                                    }}
                                                                    className="w-full px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                                                                >
                                                                    + Add Flight
                                                                </button>
                                                            )}
                                                            {isMiddleDay && (
                                                                <button
                                                                    onClick={() => {
                                                                        if ((window as any).__openManualFlightModal) {
                                                                            (window as any).__openManualFlightModal(selectedDay, 'intercity');
                                                                        }
                                                                    }}
                                                                    className="w-full px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
                                                                >
                                                                    + Add Flight
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TRANSFER Section */}
                            {(dayTransfers.length > 0 || isEditing) && (
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => toggleSection('transfers')}
                                        className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <TransferIcon className="w-5 h-5 text-slate-700" />
                                            <span className="font-semibold text-slate-900">TRANSFER</span>
                                            {dayTransfers.length > 0 && (
                                                <span className="text-sm text-slate-600">• {dayTransfers.length} Transfer{dayTransfers.length > 1 ? 's' : ''}</span>
                                            )}
                                        </div>
                                        <IconChevronDown className={`w-5 h-5 text-slate-600 transition-transform ${expandedSections.transfers ? '' : '-rotate-180'}`} />
                                    </button>
                                    {expandedSections.transfers && (
                                        <div className="p-4 space-y-3">
                                            {dayTransfers.length === 0 ? (
                                                <div className="text-center py-8 text-slate-500">
                                                    <p className="text-sm mb-4">No transfers added</p>
                                                    {isEditing && (
                                                        <div className="flex items-center justify-center gap-2">
                                                            {onAddTransfer && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        onAddTransfer(selectedDay);
                                                                    }}
                                                                    className="px-4 py-2 text-sm font-medium text-white bg-[#191975] hover:bg-[#191975]/90 rounded-lg transition-colors cursor-pointer"
                                                                >
                                                                    Select Transfer
                                                                </button>
                                                            )}
                                                            {onOpenManualTransferModal ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        if (onOpenManualTransferModal) {
                                                                            onOpenManualTransferModal(selectedDay);
                                                                        }
                                                                    }}
                                                                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer relative z-10"
                                                                >
                                                                    Add Manually
                                                                </button>
                                                            ) : (
                                                                <div className="px-4 py-2 text-xs text-red-500">onOpenManualTransferModal not available</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                {dayTransfers.map(transfer => {
                                                    const transferType = transferTypes.find(tt => tt.id === transfer.transfer_id);
                                                    
                                                    // Generate dynamic transfer description based on from/to
                                                    const getTransferDescription = (): string => {
                                                        // If linked to hotel, determine from/to based on position
                                                        if (transfer.linked_hotel_id) {
                                                            const linkedHotel = dayHotels.find(h => h.id === transfer.linked_hotel_id);
                                                            if (linkedHotel) {
                                                                if (transfer.position === 'before') {
                                                                    const isFirstDay = selectedDay === 1;
                                                                    const fromLocation = isFirstDay ? 'Airport' : 'Previous Location';
                                                                    return `Transfer from ${fromLocation} to ${linkedHotel.name} by private, air-conditioned vehicle.`;
                                                                } else if (transfer.position === 'after') {
                                                                    const isLastDay = selectedDay === plan.length;
                                                                    const toLocation = isLastDay ? 'Airport' : 'Next Location';
                                                                    return `Transfer from ${linkedHotel.name} to ${toLocation} by private, air-conditioned vehicle.`;
                                                                }
                                                            }
                                                        }
                                                        
                                                        // If linked to activity, determine from/to based on position
                                                        if (transfer.linked_activity_id) {
                                                            const linkedActivity = dayActivities.find(a => a.id === transfer.linked_activity_id);
                                                            if (linkedActivity) {
                                                                if (transfer.position === 'before') {
                                                                    const dayHotel = dayHotels[0];
                                                                    const fromLocation = dayHotel ? dayHotel.name : 'Hotel';
                                                                    return `Transfer from ${fromLocation} to ${linkedActivity.name} by private, air-conditioned vehicle.`;
                                                                } else if (transfer.position === 'after') {
                                                                    const dayHotel = dayHotels[0];
                                                                    const toLocation = dayHotel ? dayHotel.name : 'Hotel';
                                                                    return `Transfer from ${linkedActivity.name} to ${toLocation} by private, air-conditioned vehicle.`;
                                                                }
                                                            }
                                                        }
                                                        
                                                        // If it's a standalone transfer with day number, try to infer from context
                                                        const isFirstDay = selectedDay === 1;
                                                        const isLastDay = selectedDay === plan.length;
                                                        
                                                        if (isFirstDay && dayHotels.length > 0) {
                                                            return `Transfer from Airport to ${dayHotels[0].name} by private, air-conditioned vehicle.`;
                                                        } else if (isLastDay && dayHotels.length > 0) {
                                                            return `Transfer from ${dayHotels[0].name} to Airport by private, air-conditioned vehicle.`;
                                                        } else if (dayHotels.length > 0 && dayActivities.length > 0) {
                                                            return `Transfer between ${dayHotels[0].name} and attractions by private, air-conditioned vehicle.`;
                                                        }
                                                        
                                                        // Fallback to transfer type description or generic
                                                        return transferType?.description || 'Enjoy a comfortable transfer by private, air-conditioned vehicle.';
                                                    };
                                                    
                                                    // Get available options for From/To dropdowns
                                                    const isFirstDay = selectedDay === 1;
                                                    const isLastDay = selectedDay === plan.length;
                                                    
                                                    // From options: Airport (if first day), Hotels, Activities
                                                    const fromOptions: Array<{ value: string; label: string }> = [];
                                                    if (isFirstDay) {
                                                        fromOptions.push({ value: 'Airport', label: 'Airport' });
                                                    }
                                                    dayHotels.forEach(hotel => {
                                                        fromOptions.push({ value: `hotel_${hotel.id}`, label: hotel.name });
                                                    });
                                                    dayActivities.forEach(activity => {
                                                        fromOptions.push({ value: `activity_${activity.id}`, label: activity.name });
                                                    });
                                                    
                                                    // To options: Airport (if last day), Hotels, Activities
                                                    const toOptions: Array<{ value: string; label: string }> = [];
                                                    if (isLastDay) {
                                                        toOptions.push({ value: 'Airport', label: 'Airport' });
                                                    }
                                                    dayHotels.forEach(hotel => {
                                                        toOptions.push({ value: `hotel_${hotel.id}`, label: hotel.name });
                                                    });
                                                    dayActivities.forEach(activity => {
                                                        toOptions.push({ value: `activity_${activity.id}`, label: activity.name });
                                                    });
                                                    
                                                    // Get current from/to values (stored in transfer as custom fields)
                                                    // Check both 'from'/'to' and also check if they're stored in the transfer object
                                                    let currentFrom = (transfer as any).from || (transfer as any).transfer_from || '';
                                                    let currentTo = (transfer as any).to || (transfer as any).transfer_to || '';
                                                    
                                                    // Auto-populate from/to based on transfer name if not already set
                                                    if (!currentFrom || !currentTo) {
                                                        const transferName = (transfer.transfer_name || transfer.name || '').toLowerCase();
                                                        
                                                        // Parse patterns from transfer name
                                                        if (transferName.includes('airport to hotel') || transferName.includes('airport to')) {
                                                            if (!currentFrom) currentFrom = 'Airport';
                                                            if (!currentTo && dayHotels.length > 0) {
                                                                currentTo = `hotel_${dayHotels[0].id}`;
                                                            }
                                                        } else if (transferName.includes('hotel to airport') || transferName.includes('to airport')) {
                                                            if (!currentFrom && dayHotels.length > 0) {
                                                                currentFrom = `hotel_${dayHotels[0].id}`;
                                                            }
                                                            if (!currentTo) currentTo = 'Airport';
                                                        } else if (transferName.includes('hotel to attraction') || transferName.includes('hotel to')) {
                                                            if (!currentFrom && dayHotels.length > 0) {
                                                                currentFrom = `hotel_${dayHotels[0].id}`;
                                                            }
                                                            if (!currentTo && dayActivities.length > 0) {
                                                                currentTo = `activity_${dayActivities[0].id}`;
                                                            }
                                                        } else if (transferName.includes('attraction to hotel') || transferName.includes('to hotel')) {
                                                            if (!currentFrom && dayActivities.length > 0) {
                                                                currentFrom = `activity_${dayActivities[0].id}`;
                                                            }
                                                            if (!currentTo && dayHotels.length > 0) {
                                                                currentTo = `hotel_${dayHotels[0].id}`;
                                                            }
                                                        } else if (transferName.includes('attraction to attraction') || transferName.includes('attraction to')) {
                                                            if (!currentFrom && dayActivities.length > 0) {
                                                                currentFrom = `activity_${dayActivities[0].id}`;
                                                            }
                                                            if (!currentTo && dayActivities.length > 1) {
                                                                currentTo = `activity_${dayActivities[1].id}`;
                                                            }
                                                        }
                                                        
                                                        // Auto-save if we determined values and onActivityChange is available
                                                        if (isEditing && onActivityChange && (currentFrom !== ((transfer as any).from || '') || currentTo !== ((transfer as any).to || ''))) {
                                                            if (currentFrom && currentFrom !== ((transfer as any).from || '')) {
                                                                onActivityChange(transfer.id, 'from' as any, currentFrom);
                                                            }
                                                            if (currentTo && currentTo !== ((transfer as any).to || '')) {
                                                                onActivityChange(transfer.id, 'to' as any, currentTo);
                                                            }
                                                        }
                                                    }
                                                    
                                                    // Helper function to get display name from from/to value
                                                    const getDisplayName = (value: string): string => {
                                                        if (!value) return '';
                                                        if (value === 'Airport') return 'Airport';
                                                        if (value.startsWith('hotel_')) {
                                                            const hotelId = parseInt(value.replace('hotel_', ''));
                                                            const hotel = dayHotels.find(h => h.id === hotelId);
                                                            return hotel ? hotel.name : value;
                                                        }
                                                        if (value.startsWith('activity_')) {
                                                            const activityId = parseInt(value.replace('activity_', ''));
                                                            const activity = dayActivities.find(a => a.id === activityId);
                                                            return activity ? activity.name : value;
                                                        }
                                                        return value;
                                                    };
                                                    
                                                    const fromDisplay = getDisplayName(currentFrom);
                                                    const toDisplay = getDisplayName(currentTo);
                                                    
                                                    return (
                                                        <div key={transfer.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-[#4c49e6]/30 rounded-lg p-3">
                                                            <div className="flex items-start gap-2">
                                                                <div className="w-10 h-10 bg-[#4c49e6] rounded-lg flex items-center justify-center flex-shrink-0">
                                                                    <TransferIcon className="w-5 h-5 text-white" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <h4 className="font-semibold text-sm text-[#4c49e6] mb-1">
                                                                        {transfer.transfer_name || transfer.name || transferType?.name || 'Private Transfer'}
                                                                    </h4>
                                                                    {isEditing && onActivityChange ? (
                                                                        <div className="space-y-2 mb-2">
                                                                            <div>
                                                                                <label className="text-xs font-medium text-slate-700 mb-1 block">From</label>
                                                                                <select
                                                                                    value={currentFrom || ''}
                                                                                    onChange={(e) => {
                                                                                        onActivityChange(transfer.id, 'from' as any, e.target.value);
                                                                                    }}
                                                                                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md focus:border-[#4c49e6] focus:ring-1 focus:ring-[#4c49e6] outline-none bg-white"
                                                                                >
                                                                                    <option value="">Select From</option>
                                                                                    {fromOptions.length > 0 ? (
                                                                                        fromOptions.map(option => (
                                                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                                                        ))
                                                                                    ) : (
                                                                                        <option value="" disabled>No options available</option>
                                                                                    )}
                                                                                </select>
                                                                            </div>
                                                                            <div>
                                                                                <label className="text-xs font-medium text-slate-700 mb-1 block">To</label>
                                                                                <select
                                                                                    value={currentTo || ''}
                                                                                    onChange={(e) => {
                                                                                        onActivityChange(transfer.id, 'to' as any, e.target.value);
                                                                                    }}
                                                                                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded-md focus:border-[#4c49e6] focus:ring-1 focus:ring-[#4c49e6] outline-none bg-white"
                                                                                >
                                                                                    <option value="">Select To</option>
                                                                                    {toOptions.length > 0 ? (
                                                                                        toOptions.map(option => (
                                                                                            <option key={option.value} value={option.value}>{option.label}</option>
                                                                                        ))
                                                                                    ) : (
                                                                                        <option value="" disabled>No options available</option>
                                                                                    )}
                                                                                </select>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-xs text-slate-600 mb-1 space-y-0.5">
                                                                            {fromDisplay && toDisplay ? (
                                                                                <>
                                                                                    <div><span className="font-medium">From:</span> {fromDisplay}</div>
                                                                                    <div><span className="font-medium">To:</span> {toDisplay}</div>
                                                                                </>
                                                                            ) : fromDisplay || toDisplay ? (
                                                                                <>
                                                                                    {fromDisplay && <div><span className="font-medium">From:</span> {fromDisplay}</div>}
                                                                                    {toDisplay && <div><span className="font-medium">To:</span> {toDisplay}</div>}
                                                                                </>
                                                                            ) : (
                                                                                <div className="text-slate-400 italic">No route specified</div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {transferType?.vehicle_type && (
                                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                            </svg>
                                                                            {transferType.vehicle_type}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {isEditing && (
                                                                    <div className="flex items-center gap-2">
                                                                        {onModifyTransfer ? (
                                                                            <button
                                                                                onClick={() => onModifyTransfer(transfer.id, selectedDay)}
                                                                                className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded"
                                                                            >
                                                                                MODIFY
                                                                            </button>
                                                                        ) : onModifyActivity && (
                                                                            <button
                                                                                onClick={() => onModifyActivity(transfer.id)}
                                                                                className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded"
                                                                            >
                                                                                MODIFY
                                                                            </button>
                                                                        )}
                                                                        {onRemoveTransfer && (
                                                                            <button
                                                                                onClick={() => onRemoveTransfer(transfer.id)}
                                                                                className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded"
                                                                            >
                                                                                REMOVE
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {isEditing && (
                                                    <div className="w-full mt-2 flex items-center gap-2">
                                                        {onAddTransfer && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    onAddTransfer(selectedDay);
                                                                }}
                                                                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-[#191975] hover:bg-[#191975]/90 rounded-lg transition-colors"
                                                            >
                                                                Select Transfer
                                                            </button>
                                                        )}
                                                        {onOpenManualTransferModal && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    onOpenManualTransferModal(selectedDay);
                                                                }}
                                                                className="flex-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer relative z-10"
                                                            >
                                                                Add Manually
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* HOTEL Section - Show on all days where hotels exist */}
                            {(dayHotels.length > 0 || isEditing) && (
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => toggleSection('hotels')}
                                        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <HotelIcon className="w-5 h-5 text-slate-700" />
                                            <span className="font-semibold text-slate-900">HOTEL</span>
                                            {dayHotels.length > 0 && (
                                                <span className="text-sm text-slate-600">• {dayHotels.length} Hotel{dayHotels.length > 1 ? 's' : ''}</span>
                                            )}
                                        </div>
                                        <IconChevronDown className={`w-5 h-5 text-slate-600 transition-transform ${expandedSections.hotels ? '' : '-rotate-180'}`} />
                                    </button>
                                    {expandedSections.hotels && (
                                        <div className="p-4 space-y-3">
                                            {dayHotels.length === 0 ? (
                                                <div className="text-center py-4 text-slate-500">
                                                    <p className="text-xs mb-3">No hotel added</p>
                                                    {isEditing && onAddHotel && (
                                                        <button
                                                            onClick={() => onAddHotel(selectedDay)}
                                                            className="px-3 py-1.5 text-xs font-medium text-[#191975] border border-[#191975] rounded-lg hover:bg-[#191975]/5"
                                                        >
                                                            Add Hotel
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                {dayHotels.map(hotel => {
                                                    // Note: costingHotels and fxRates are used below to show pricing;
                                                    // noisy console logs removed for cleaner production behavior.
                                                    const costingHotel = costingHotels.find(ch => ch.name === hotel.name);

                                                    return (
                                                    <div key={hotel.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                                        <div className="flex gap-3">
                                                            <div className="w-20 h-20 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center">
                                                                <HotelIcon className="w-8 h-8 text-slate-400" />
                                                            </div>
                                                            <div className="flex-1 p-3">
                                                                <div className="flex items-start justify-between mb-2">
                                                                    <div className="flex-1">
                                                                        <h4 className="font-bold text-base text-slate-900 mb-1">
                                                                            {hotel.name}
                                                                        </h4>
                                                                        <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                            </svg>
                                                                            <span>{costingHotel?.city || 'Location details'}</span>
                                                                        </div>
                                                                        <div className="text-xs text-slate-600 mb-1">
                                                                            {hotel.check_in_date && hotel.check_out_date && (
                                                                                <>
                                                                                    {new Date(hotel.check_in_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(hotel.check_out_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {hotel.nights} Nights
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-xs text-slate-700 mb-1">
                                                                            <span className="font-medium">Room Type:</span>{' '}
                                                                            {isEditing && onHotelChange ? (
                                                                                <input
                                                                                    type="text"
                                                                                    value={hotel.room_type || 'Standard Room'}
                                                                                    onChange={(e) => onHotelChange(hotel.id, 'room_type', e.target.value)}
                                                                                    className="ml-1 px-2 py-0.5 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-[#191975] focus:border-transparent"
                                                                                />
                                                                            ) : (
                                                                                <span>{hotel.room_type || 'Standard Room'}</span>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {/* Costing Information - Display Only */}
                                                                        {costingHotel && (
                                                                            <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                                                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                                                    <div>
                                                                                        <span className="text-slate-500">Pricing Type:</span>
                                                                                        <div className="font-medium text-slate-700">{costingHotel.pricingType || 'Per Adult'}</div>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-slate-500">Currency:</span>
                                                                                        <div className="font-medium text-slate-700">{costingHotel.currency}</div>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-slate-500">Rooms:</span>
                                                                                        <div className="font-medium text-slate-700">{costingHotel.quantity}</div>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-slate-500">Rate/Night:</span>
                                                                                        <div className="font-medium text-slate-700">
                                                                                            {costingHotel.currency === 'USD' ? '$' : costingHotel.currency === 'EUR' ? '€' : costingHotel.currency === 'GBP' ? '£' : '₹'} {costingHotel.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                {fxRates && (
                                                                                    <div className="pt-1 border-t border-slate-100">
                                                                                        <div className="text-xs text-slate-500 mb-0.5">Cost Per Person:</div>
                                                                                        <div className="flex items-center gap-3 text-xs">
                                                                                            <span className="font-medium text-slate-700">
                                                                                                In {costingHotel.currency}: {costingHotel.currency === 'USD' ? '$' : costingHotel.currency === 'EUR' ? '€' : costingHotel.currency === 'GBP' ? '£' : '₹'} {costingHotel.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                        
                                                                        {/* Confirmation Numbers - Only shown when status is Confirmed */}
                                                                        {itineraryStatus === 'Confirmed' && hotel.rooms && hotel.rooms.length > 0 && hotel.rooms.some(room => room.confirmation_number) && (
                                                                            <div className="mt-2 pt-2 border-t border-slate-200">
                                                                                <div className="text-xs font-semibold text-slate-700 mb-1">Confirmation Numbers:</div>
                                                                                <div className="space-y-1">
                                                                                    {hotel.rooms.map((room, roomIdx) => (
                                                                                        room.confirmation_number ? (
                                                                                            <div key={room.id || roomIdx} className="text-xs text-slate-600">
                                                                                                <span className="font-medium">{room.name || `Room ${roomIdx + 1}`}:</span>{' '}
                                                                                                <span className="text-[#191975] font-semibold">{room.confirmation_number}</span>
                                                                                            </div>
                                                                                        ) : null
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        
                                                                        <div className="flex items-center gap-2 text-xs">
                                                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={(hotel as any).meals?.breakfast || false}
                                                                                    onChange={() => {}}
                                                                                    disabled={!isEditing}
                                                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                                                                />
                                                                                <span className={(hotel as any).meals?.breakfast ? 'text-green-600 font-medium' : 'text-slate-500'}>
                                                                                    Breakfast {(hotel as any).meals?.breakfast ? 'is included' : ''}
                                                                                </span>
                                                                            </label>
                                                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={(hotel as any).meals?.lunch || false}
                                                                                    onChange={() => {}}
                                                                                    disabled={!isEditing}
                                                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                                                                />
                                                                                <span className={(hotel as any).meals?.lunch ? 'text-green-600 font-medium' : 'text-slate-500'}>
                                                                                    Lunch {(hotel as any).meals?.lunch ? 'is included' : ''}
                                                                                </span>
                                                                            </label>
                                                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={(hotel as any).meals?.dinner || false}
                                                                                    onChange={() => {}}
                                                                                    disabled={!isEditing}
                                                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                                                                                />
                                                                                <span className={(hotel as any).meals?.dinner ? 'text-green-600 font-medium' : 'text-slate-500'}>
                                                                                    Dinner {(hotel as any).meals?.dinner ? 'is included' : ''}
                                                                                </span>
                                                                            </label>
                                                                        </div>
                                                                    </div>
                                                                    {isEditing && (
                                                                        <div className="flex items-center gap-2">
                                                                            {onModifyHotel && (
                                                                                <button
                                                                                    onClick={() => onModifyHotel(hotel.id)}
                                                                                    className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded"
                                                                                >
                                                                                    CHANGE
                                                                                </button>
                                                                            )}
                                                                            {onRemoveHotel && (
                                                                                <button
                                                                                    onClick={() => onRemoveHotel(hotel.id)}
                                                                                    className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded"
                                                                                >
                                                                                    REMOVE
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    );
                                                })}
                                                {isEditing && onAddHotel && (
                                                    <button
                                                        onClick={() => onAddHotel(selectedDay)}
                                                        className="w-full mt-2 px-3 py-2 text-xs font-medium text-[#191975] border border-dashed border-[#191975] rounded-lg hover:bg-[#191975]/5"
                                                    >
                                                        + Add Another Hotel
                                                    </button>
                                                )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ACTIVITY Section */}
                            {(dayActivities.length > 0 || isEditing) && (
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => toggleSection('activities')}
                                        className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <ActivityIcon className="w-5 h-5 text-slate-700" />
                                            <span className="font-semibold text-slate-900">ACTIVITY</span>
                                            {dayActivities.length > 0 && (
                                                <span className="text-sm text-slate-600">• {dayActivities.length} {dayActivities.length > 1 ? 'Activities' : 'Activity'}</span>
                                            )}
                                        </div>
                                        <IconChevronDown className={`w-5 h-5 text-slate-600 transition-transform ${expandedSections.activities ? '' : '-rotate-180'}`} />
                                    </button>
                                    {expandedSections.activities && (
                                        <div className="p-3 space-y-2">
                                            {dayActivities.length === 0 ? (
                                                <div className="text-center py-4 text-slate-500">
                                                    <p className="text-xs mb-3">No activities added</p>
                                                    {isEditing && (
                                                        <div className="flex items-center justify-center gap-2">
                                                            {onOpenAttractionDrawer && (
                                                                <button
                                                                    onClick={() => onOpenAttractionDrawer(selectedDay)}
                                                                    className="px-3 py-1.5 text-xs font-medium text-white bg-[#191975] hover:bg-[#191975]/90 rounded-lg transition-colors"
                                                                >
                                                                    Select Attraction
                                                                </button>
                                                            )}
                                                            {onOpenManualAttractionModal && (
                                                                <button
                                                                    onClick={() => onOpenManualAttractionModal(selectedDay)}
                                                                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                                                                >
                                                                    Add Manually
                                                                </button>
                                                            )}
                                                            {!onOpenAttractionDrawer && !onOpenManualAttractionModal && onAddActivity && (
                                                                <button
                                                                    onClick={() => onAddActivity(selectedDay)}
                                                                    className="px-3 py-1.5 text-xs font-medium text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50"
                                                                >
                                                                    Add Activity
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <>
                                                {dayActivities.map(activity => {
                                                    const activitySightseeing = sightseeing?.find(s => s.id === activity.sightseeing_id);
                                                    return (
                                                        <div key={activity.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                                            <div className="flex gap-3">
                                                                <div className="w-20 h-20 bg-slate-200 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                                                                    {activitySightseeing?.images?.[0] || activity.image_url ? (
                                                                        <img 
                                                                            src={activitySightseeing?.images?.[0] || activity.image_url || ''} 
                                                                            alt={activity.name}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <ActivityIcon className="w-8 h-8 text-slate-400" />
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 p-3">
                                                                    <div className="flex items-start justify-between mb-1">
                                                                        <div>
                                                                            <h4 className="font-bold text-base text-slate-900 mb-1">
                                                                                {activity.name || activitySightseeing?.attraction_name || 'Activity'}
                                                                            </h4>
                                                                            <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                                                                                {activitySightseeing?.remarks || activity.name || 'Discover amazing experiences and attractions.'}
                                                                            </p>
                                                                            <div className="flex items-center gap-3 text-xs text-slate-600">
                                                                                {activity.duration && (
                                                                                    <div className="flex items-center gap-1">
                                                                                        <IconClock className="w-4 h-4" />
                                                                                        <span>Duration {activity.duration}</span>
                                                                                    </div>
                                                                                )}
                                                                                {activity.start_time && activity.end_time && (
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span>Time Slot • {activity.start_time} - {activity.end_time}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {isEditing && (
                                                                            <div className="flex items-center gap-2">
                                                                                {onModifyActivity && (
                                                                                    <button
                                                                                        onClick={() => onModifyActivity(activity.id)}
                                                                                        className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded"
                                                                                    >
                                                                                        CHANGE
                                                                                    </button>
                                                                                )}
                                                                                {onRemoveActivity && (
                                                                                    <button
                                                                                        onClick={() => onRemoveActivity(activity.id)}
                                                                                        className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded"
                                                                                    >
                                                                                        REMOVE
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {isEditing && (
                                                    <div className="w-full mt-2 flex items-center gap-2">
                                                        {onOpenAttractionDrawer && (
                                                            <button
                                                                onClick={() => onOpenAttractionDrawer(selectedDay)}
                                                                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-[#191975] hover:bg-[#191975]/90 rounded-lg transition-colors"
                                                            >
                                                                Select Attraction
                                                            </button>
                                                        )}
                                                        {onOpenManualAttractionModal && (
                                                            <button
                                                                onClick={() => onOpenManualAttractionModal(selectedDay)}
                                                                className="flex-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                                                            >
                                                                Add Manually
                                                            </button>
                                                        )}
                                                        {!onOpenAttractionDrawer && !onOpenManualAttractionModal && onAddActivity && (
                                                            <button
                                                                onClick={() => onAddActivity(selectedDay)}
                                                                className="w-full px-3 py-2 text-xs font-medium text-purple-600 border border-dashed border-purple-600 rounded-lg hover:bg-purple-50"
                                                            >
                                                                + Add Another Activity
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EnhancedDayBuilder;

