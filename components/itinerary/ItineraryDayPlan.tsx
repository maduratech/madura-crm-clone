import React, { useMemo } from 'react';
import {
    ItineraryDay, DetailedActivity, DetailedHotel, TransferType
} from '../../types';
import { IconTrash, IconClock } from '../../constants';
import { HotelIcon } from './ItineraryIcons';

// WysiwygEditor component (needed for ItineraryDayPlan)
const WysiwygEditor: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
    const editorRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
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
                className="prose prose-sm max-w-none p-3 min-h-[120px] focus:outline-none"
            />
        </div>
    );
};

const ItineraryDayPlan: React.FC<{
    plan: ItineraryDay[];
    isEditing: boolean;
    onDayChange: (dayId: number, field: 'title' | 'description' | 'meals', value: string | { b: boolean; l: boolean; d: boolean; }) => void;
    onAddDay: () => void;
    onRemoveDay: (dayId: number) => void;
    startDate: Date | null;
    activities?: DetailedActivity[];
    hotels?: DetailedHotel[];
    transferTypes?: TransferType[];
    onAddTransfer?: (dayNumber: number) => void;
    onRemoveTransfer?: (activityId: number) => void;
}> = ({ plan, isEditing, onDayChange, onAddDay, onRemoveDay, startDate, activities = [], hotels = [], transferTypes = [], onAddTransfer, onRemoveTransfer }) => {

    const renderMeals = (dayId: number, meals: { b: boolean; l: boolean; d: boolean; }) => {
        const toggleMeal = (meal: 'b' | 'l' | 'd') => {
            if (!isEditing) return;
            onDayChange(dayId, 'meals', { ...meals, [meal]: !meals[meal] });
        };

        const mealParts: { key: 'b' | 'l' | 'd'; label: string; included: boolean; icon: string }[] = [
            { key: 'b', label: 'Breakfast', included: meals.b, icon: '🌅' },
            { key: 'l', label: 'Lunch', included: meals.l, icon: '☀️' },
            { key: 'd', label: 'Dinner', included: meals.d, icon: '🌙' },
        ];

        return (
            <div className="flex items-center gap-2 flex-shrink-0">
                {mealParts.map(({ key, label, included, icon }) => (
                    <label
                        key={key}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ${isEditing ? 'cursor-pointer hover:bg-white/20' : 'cursor-default'
                            } ${included ? 'bg-white/20 text-white' : 'bg-white/10 text-white/50'
                            }`}
                    >
                        {isEditing ? (
                            <>
                                <input
                                    type="checkbox"
                                    checked={included}
                                    onChange={() => toggleMeal(key)}
                                    className="w-4 h-4 rounded border-white/30 bg-white/10 text-white focus:ring-2 focus:ring-white/50"
                                />
                                <span className="text-sm">{icon}</span>
                                <span className="text-xs font-medium">{included ? `${label} is included` : label}</span>
                            </>
                        ) : (
                            <>
                                <span className="text-sm">{icon}</span>
                                <span className="text-xs font-medium">{included ? `${label} is included` : label}</span>
                            </>
                        )}
                    </label>
                ))}
            </div>
        );
    };

    // Group activities and transfers by day number
    const activitiesByDay = useMemo(() => {
        const grouped: Record<number, { transfers: DetailedActivity[]; regularActivities: DetailedActivity[] }> = {};
        activities.forEach(activity => {
            const dayNum = activity.day_number || 1;
            if (!grouped[dayNum]) {
                grouped[dayNum] = { transfers: [], regularActivities: [] };
            }
            // Attractions/sightseeing are NEVER transfers: any activity with sightseeing_id is regular only
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

    // Group hotels by day (based on check-in/check-out dates)
    const hotelsByDay = useMemo(() => {
        const grouped: Record<number, DetailedHotel[]> = {};
        hotels.forEach(hotel => {
            if (hotel.check_in_date && hotel.check_out_date) {
                const checkIn = new Date(hotel.check_in_date);
                const checkOut = new Date(hotel.check_out_date);
                // Simple day calculation - can be improved
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

    return (
        <div className="space-y-4">
            {plan.map((day, index) => {
                const dayNumber = index + 1;
                const dayDate = startDate ? new Date(startDate) : null;
                if (dayDate) {
                    dayDate.setDate(dayDate.getDate() + index);
                }
                const dayTransfers = activitiesByDay[dayNumber]?.transfers || [];
                const dayHotels = hotelsByDay[dayNumber] || [];
                const includedCount = [
                    dayTransfers.length > 0 ? `${dayTransfers.length} Transfer${dayTransfers.length > 1 ? 's' : ''}` : null,
                    dayHotels.length > 0 ? `${dayHotels.length} Hotel${dayHotels.length > 1 ? 's' : ''}` : null,
                ].filter(Boolean).join(', ');

                return (
                    <div key={day.id} className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
                        {/* Day Header */}
                        <div className="bg-[#191975] px-4 py-3 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                                    {dayNumber}
                                </div>
                                <div className="flex-1">
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={day.title}
                                            onChange={e => onDayChange(day.id, 'title', e.target.value)}
                                            className="bg-transparent text-white font-bold text-base w-full border-b border-white/30 focus:border-white focus:outline-none placeholder-white/70"
                                            placeholder="Day title..."
                                        />
                                    ) : (
                                        <h4 className="font-bold text-base text-white">{day.title}</h4>
                                    )}
                                    {dayDate && (
                                        <p className="text-white/70 text-xs mt-1">
                                            {dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                        </p>
                                    )}
                                    {includedCount && (
                                        <p className="text-white/80 text-xs mt-1 font-medium">INCLUDED: {includedCount}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {renderMeals(day.id, day.meals)}
                                {isEditing && (
                                    <button
                                        onClick={() => onRemoveDay(day.id)}
                                        className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                        title="Remove Day"
                                    >
                                        <IconTrash className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Day Content */}
                        <div className="p-4 space-y-4">
                            {/* Transfers */}
                            {dayTransfers.length > 0 && (
                                <div className="space-y-2">
                                    {dayTransfers.map(transfer => {
                                        const transferType = transferTypes.find(tt => tt.id === transfer.transfer_id);
                                        return (
                                            <div key={transfer.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-[#4c49e6]/30 p-3 flex items-center gap-3">
                                                <div className="w-10 h-10 bg-[#4c49e6] rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                    </svg>
                                                </div>
                                                <div className="flex-1">
                                                    <h5 className="font-semibold text-[#4c49e6] text-sm">{transfer.transfer_name || transfer.name || transferType?.name || 'Transfer'}</h5>
                                                    {transferType?.vehicle_type && (
                                                        <p className="text-xs text-slate-600">{transferType.vehicle_type}</p>
                                                    )}
                                                </div>
                                                {isEditing && onRemoveTransfer && (
                                                    <button 
                                                        onClick={() => onRemoveTransfer(transfer.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Remove Transfer"
                                                    >
                                                        <IconTrash className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            
                            {/* Hotels */}
                            {dayHotels.length > 0 && (
                                <div className="space-y-2">
                                    {dayHotels.map(hotel => (
                                        <div key={hotel.id} className="bg-slate-50 rounded-lg border border-slate-200 p-3 flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <HotelIcon className="w-6 h-6 text-slate-600" />
                                            </div>
                                            <div className="flex-1">
                                                <h5 className="font-semibold text-slate-900 text-sm">{hotel.name}</h5>
                                                {hotel.room_type && (
                                                    <p className="text-xs text-slate-600">{hotel.room_type}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Day Description */}
                            {isEditing ? (
                                <WysiwygEditor value={day.description} onChange={val => onDayChange(day.id, 'description', val)} />
                            ) : (
                                <div className="text-slate-600 prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_p]:m-0 [&_h4]:font-semibold [&_h4]:text-slate-800 [&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-base [&_h4]:first:mt-0" dangerouslySetInnerHTML={{ __html: day.description || '' }}></div>
                            )}

                            {/* Add Activities/Transfers Button */}
                            {isEditing && onAddTransfer && (
                                <div className="pt-2 border-t border-slate-200">
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            {isEditing && (
                <button
                    onClick={onAddDay}
                    className="w-full px-4 py-3 text-sm font-medium text-white bg-[#191975] rounded-lg hover:bg-[#191975]/90 transition-colors flex items-center justify-center gap-2 border-2 border-dashed border-[#191975]/50"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Day
                </button>
            )}
        </div>
    );
};

export default ItineraryDayPlan;

