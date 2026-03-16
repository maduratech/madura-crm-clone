import React, { useState, useRef, useEffect } from 'react';
import { IconChevronDown, IconSearch } from '../constants';
import { searchHotelCities } from '../lib/amadeus';

// City cache for search results
const cityCache = new Map<string, Array<{ code: string; name: string; country?: string; countryCode?: string }>>();

// City Search Dropdown Component (similar to AirportSearchDropdown)
const CitySearchDropdown: React.FC<{
    onSelect: (city: { code: string; name: string; country?: string; countryCode?: string }) => void;
    onClose: () => void;
}> = ({ onSelect, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Array<{ code: string; name: string; country?: string; countryCode?: string }>>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [recentCities, setRecentCities] = useState<Array<{ code: string; name: string; country?: string; countryCode?: string }>>([]);
    const [manualMode, setManualMode] = useState(false);
    const [manualCityName, setManualCityName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimeout = useRef<number | null>(null);
    
    // Helper function to clean city name for display (remove state/province info)
    const cleanCityName = (name: string): string => {
        // Remove everything after comma (state/province)
        const commaIndex = name.indexOf(',');
        if (commaIndex > 0) {
            return name.substring(0, commaIndex).trim();
        }
        // Remove everything after slash
        const slashIndex = name.indexOf('/');
        if (slashIndex > 0) {
            return name.substring(0, slashIndex).trim();
        }
        return name.trim();
    };

    useEffect(() => {
        inputRef.current?.focus();
        const stored = localStorage.getItem('recent-hotel-cities');
        if (stored) {
            try {
                setRecentCities(JSON.parse(stored));
            } catch {
                setRecentCities([]);
            }
        }
        if (query.length >= 2) {
            handleSearch(query);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearch = (term: string) => {
        setQuery(term);
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        if (term.length < 2) {
            setResults([]);
            return;
        }
        const key = term.toLowerCase();
        if (cityCache.has(key)) {
            setResults(cityCache.get(key)!);
            return;
        }
        setIsLoading(true);
        debounceTimeout.current = window.setTimeout(async () => {
            try {
                const cityResults = await searchHotelCities(term);
                cityCache.set(key, cityResults);
                setResults(cityResults);
            } catch (error) {
                console.error("City search failed:", error);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        }, 400);
    };

    const handleSelect = (city: { code: string; name: string; country?: string; countryCode?: string }) => {
        onSelect(city);
        const nextRecents = [city, ...recentCities.filter(c => c.code !== city.code)].slice(0, 6);
        setRecentCities(nextRecents);
        localStorage.setItem('recent-hotel-cities', JSON.stringify(nextRecents));
        onClose();
    };

    return (
        <div className="absolute top-full left-0 mt-2 w-full max-w-xl bg-white z-30 p-3 flex flex-col rounded-xl shadow-2xl border" onClick={e => e.stopPropagation()}>
            <label className="relative shrink-0 mb-2 block text-xs font-semibold text-slate-500">
                Search city
                <div className="relative mt-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <IconSearch className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Type to search"
                        className="w-full p-3 pl-11 text-sm border border-blue-500 rounded-lg shadow-sm ring-2 ring-blue-200 focus:outline-none"
                    />
                </div>
            </label>
            {recentCities.length > 0 && (
                <div className="mb-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1">Recent</p>
                    <div className="flex flex-wrap gap-2">
                        {recentCities.map((city, idx) => (
                            <button
                                key={`${city.code || city.name}-recent-${idx}`}
                                onClick={() => handleSelect(city)}
                                className="px-3 py-1.5 rounded-md border text-xs text-slate-700 hover:bg-slate-100"
                            >
                                {cleanCityName(city.name)} {city.country ? `(${city.country})` : ''}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div className="mb-2 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setManualMode(!manualMode)}
                    className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${manualMode
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                >
                    {manualMode ? '← Search Mode' : 'Manual Entry'}
                </button>
            </div>

            {manualMode ? (
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">City Name (e.g., Mumbai, Chennai)</label>
                        <input
                            type="text"
                            value={manualCityName}
                            onChange={(e) => setManualCityName(e.target.value)}
                            placeholder="Enter city name directly"
                            className="w-full p-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                            autoFocus
                        />
                        <p className="text-xs text-slate-400 mt-1">You can enter just the city name (e.g., "Mumbai" instead of "Mumbai/Bombay, Maharashtra")</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (manualCityName.trim()) {
                                const manualCity: { code: string; name: string; country?: string; countryCode?: string } = {
                                    code: '',
                                    name: manualCityName.trim(),
                                    country: ''
                                };
                                handleSelect(manualCity);
                            }
                        }}
                        disabled={!manualCityName.trim()}
                        className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Use {manualCityName.trim() || 'City'}
                    </button>
                </div>
            ) : (
                <ul className="grow max-h-72 overflow-y-auto">
                    {isLoading && <li className="p-3 text-center text-slate-500">Searching...</li>}
                    {!isLoading && results.length === 0 && query.length >= 2 && <li className="p-3 text-center text-slate-500">No results found. Try manual entry.</li>}
                    {results.map((city, idx) => (
                        <li key={`${city.code || city.name}-${idx}`} onClick={() => handleSelect(city)} className="p-3 hover:bg-slate-100 cursor-pointer rounded-md flex items-center gap-3">
                            <div className="text-blue-600">🏙️</div>
                            <div>
                                <p className="font-semibold text-sm">{cleanCityName(city.name)}</p>
                                {city.country && <p className="text-xs text-slate-500">{city.country} {city.code ? `(${city.code})` : ''}</p>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

interface RoomConfig {
    adults: number;
    children: number;
    childAges: number[];
}

export interface HotelSearchParams {
    city: string;
    searchTerm?: string;
    nationality?: string;
    checkIn: string;
    checkOut: string;
    rooms: RoomConfig[];
    starRatings: number[];
}

// --- ICONS ---
const CalendarIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18" />
    </svg>
);
const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
);
const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
);

// --- CALENDAR POPUP ---
const CalendarPopup: React.FC<{
    checkIn?: string;
    checkOut?: string;
    onClose: () => void;
    onDatesChange: (checkIn: string, checkOut: string) => void;
}> = ({ checkIn, checkOut, onClose, onDatesChange }) => {
    const [displayDate, setDisplayDate] = useState(() => {
        if (checkIn) {
            const date = new Date(checkIn);
            return new Date(date.getFullYear(), date.getMonth());
        }
        return new Date();
    });
    const [selectedCheckIn, setSelectedCheckIn] = useState<Date | null>(checkIn ? new Date(checkIn) : null);
    const [selectedCheckOut, setSelectedCheckOut] = useState<Date | null>(checkOut ? new Date(checkOut) : null);
    const [hoverDate, setHoverDate] = useState<Date | null>(null);

    const formatDateString = (year: number, month: number, day: number) => {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const handleDateClick = (day: number, month: number, year: number) => {
        const clickedDate = new Date(year, month, day);
        const clickedStr = formatDateString(year, month, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (clickedDate < today) return; // Can't select past dates

        if (!selectedCheckIn || (selectedCheckIn && selectedCheckOut)) {
            // Start new selection
            setSelectedCheckIn(clickedDate);
            setSelectedCheckOut(null);
        } else if (clickedDate < selectedCheckIn!) {
            // Clicked date is before check-in, make it the new check-in
            setSelectedCheckIn(clickedDate);
            setSelectedCheckOut(null);
        } else {
            // Set check-out
            setSelectedCheckOut(clickedDate);
            onDatesChange(
                formatDateString(selectedCheckIn!.getFullYear(), selectedCheckIn!.getMonth(), selectedCheckIn!.getDate()),
                clickedStr
            );
            onClose();
        }
    };

    const renderMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthName = date.toLocaleString('default', { month: 'long' });
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${month}-${i}`}></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const isPast = currentDate < today;
            const isCheckIn = selectedCheckIn && currentDate.getTime() === selectedCheckIn.getTime();
            const isCheckOut = selectedCheckOut && currentDate.getTime() === selectedCheckOut.getTime();
            const isInRange = selectedCheckIn && !selectedCheckOut && hoverDate && currentDate > selectedCheckIn && currentDate <= hoverDate;
            const isSelectedRange = selectedCheckIn && selectedCheckOut && currentDate > selectedCheckIn && currentDate < selectedCheckOut;

            let dayClasses = 'text-center rounded-lg p-1 text-sm';
            if (isPast) {
                dayClasses += ' text-slate-300';
            } else {
                dayClasses += ' cursor-pointer';
                if (isCheckIn || isCheckOut) {
                    dayClasses += ' bg-blue-600 text-white font-bold';
                } else if (isInRange || isSelectedRange) {
                    dayClasses += ' bg-blue-100';
                } else {
                    dayClasses += ' hover:border-blue-600 border border-transparent';
                }
            }

            days.push(
                <div
                    key={day}
                    onClick={() => !isPast && handleDateClick(day, month, year)}
                    onMouseEnter={() => !isPast && setHoverDate(currentDate)}
                    className={dayClasses}
                >
                    <p>{day}</p>
                </div>
            );
        }

        return (
            <div className="flex-1">
                <h3 className="font-semibold text-center mb-2">{monthName} {year}</h3>
                <div className="grid grid-cols-7 text-center text-xs text-slate-500 mb-2">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <span key={d}>{d}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days}
                </div>
            </div>
        );
    };

    return (
        <div className="absolute top-full mt-2 w-full max-w-[700px] bg-white z-30 p-4 rounded-lg shadow-2xl border right-0 lg:right-auto lg:left-1/2 lg:-translate-x-1/2" onMouseLeave={() => setHoverDate(null)} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
                <button type="button" onClick={() => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() - 1))} className="p-2 rounded-full hover:bg-slate-100"><ChevronLeftIcon className="w-5 h-5" /></button>
                <p className="font-semibold text-blue-600">
                    {!selectedCheckIn ? 'Select check-in date' : !selectedCheckOut ? 'Select check-out date' : 'Selected'}
                </p>
                <button type="button" onClick={() => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() + 1))} className="p-2 rounded-full hover:bg-slate-100"><ChevronRightIcon className="w-5 h-5" /></button>
            </div>
            <div className="flex gap-6">
                {renderMonth(displayDate)}
                {renderMonth(new Date(displayDate.getFullYear(), displayDate.getMonth() + 1))}
            </div>
        </div>
    );
};

// --- TRAVELLERS & ROOMS POPUP ---
const TravellersPopup: React.FC<{
    rooms: RoomConfig[];
    onClose: () => void;
    onDone: (rooms: RoomConfig[]) => void;
}> = ({ rooms, onClose, onDone }) => {
    const [tempRooms, setTempRooms] = useState(rooms);

    const handleRoomChange = (index: number, field: 'adults' | 'children', delta: number) => {
        setTempRooms(prev => {
            const next = [...prev];
            const room = { ...next[index] };
            if (field === 'adults') {
                // TBO API: Adults must be 1-8 per room
                room.adults = Math.max(1, Math.min(8, room.adults + delta));
            } else {
                // TBO API: Children must be 0-4 per room
                const newChildren = Math.max(0, Math.min(4, room.children + delta));
                room.children = newChildren;
                if (room.childAges.length > newChildren) {
                    room.childAges = room.childAges.slice(0, newChildren);
                } else {
                    while (room.childAges.length < newChildren) {
                        room.childAges.push(6); // Default age: 6 years
                    }
                }
            }
            next[index] = room;
            return next;
        });
    };

    const handleChildAgeChange = (roomIndex: number, childIndex: number, value: number) => {
        setTempRooms(prev => {
            const next = [...prev];
            const room = { ...next[roomIndex] };
            const ages = [...room.childAges];
            ages[childIndex] = Math.max(0, Math.min(18, value));
            room.childAges = ages;
            next[roomIndex] = room;
            return next;
        });
    };

    const addRoom = () => {
        setTempRooms(prev => [...prev, { adults: 2, children: 0, childAges: [] }]);
    };

    const removeRoom = (index: number) => {
        setTempRooms(prev => prev.filter((_, i) => i !== index));
    };

    const totalTravellers = tempRooms.reduce((sum, r) => sum + r.adults + r.children, 0);

    return (
        <div className="absolute top-full mt-2 w-80 bg-white z-30 p-4 rounded-lg shadow-2xl border right-0" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Travellers & Rooms</h3>
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                {tempRooms.map((room, idx) => (
                    <div key={idx} className="border rounded-md p-3">
                        <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-sm text-slate-800">Room {idx + 1}</p>
                            {tempRooms.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeRoom(idx)}
                                    className="text-xs text-red-600 hover:underline"
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-medium text-slate-700 text-sm">Adults</p>
                                    <p className="text-xs text-slate-500">(1-8 per room)</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleRoomChange(idx, 'adults', -1)}
                                        disabled={room.adults <= 1}
                                        className={`w-7 h-7 rounded-full border text-lg flex items-center justify-center ${room.adults <= 1
                                            ? 'text-slate-300 border-slate-200 cursor-not-allowed'
                                            : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >-</button>
                                    <span className="w-8 text-center font-semibold">{room.adults}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRoomChange(idx, 'adults', 1)}
                                        disabled={room.adults >= 8}
                                        className={`w-7 h-7 rounded-full border text-lg flex items-center justify-center ${room.adults >= 8
                                            ? 'text-slate-300 border-slate-200 cursor-not-allowed'
                                            : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >+</button>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-medium text-slate-700 text-sm">Children</p>
                                    <p className="text-xs text-slate-500">(0-4 per room)</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleRoomChange(idx, 'children', -1)}
                                        disabled={room.children <= 0}
                                        className={`w-7 h-7 rounded-full border text-lg flex items-center justify-center ${room.children <= 0
                                            ? 'text-slate-300 border-slate-200 cursor-not-allowed'
                                            : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >-</button>
                                    <span className="w-8 text-center font-semibold">{room.children}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRoomChange(idx, 'children', 1)}
                                        disabled={room.children >= 4}
                                        className={`w-7 h-7 rounded-full border text-lg flex items-center justify-center ${room.children >= 4
                                            ? 'text-slate-300 border-slate-200 cursor-not-allowed'
                                            : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >+</button>
                                </div>
                            </div>
                            {room.children > 0 && (
                                <div className="mt-2">
                                    <p className="text-xs text-slate-500 mb-1">Child ages (0-18 yrs)</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {room.childAges.map((age, childIdx) => (
                                            <select
                                                key={childIdx}
                                                value={age}
                                                onChange={e => handleChildAgeChange(idx, childIdx, Number(e.target.value))}
                                                className="border rounded-md px-2 py-1 text-xs bg-slate-50"
                                            >
                                                {Array.from({ length: 19 }, (_, i) => i).map(a => (
                                                    <option key={a} value={a}>{a} {a === 0 ? 'year (infant)' : a === 1 ? 'year' : 'years'}</option>
                                                ))}
                                            </select>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {tempRooms.length < 4 && (
                    <button
                        type="button"
                        onClick={addRoom}
                        className="text-sm font-semibold text-blue-600 hover:underline"
                    >
                        + Add Room
                    </button>
                )}
            </div>
            <div className="border-t pt-3 mt-3">
                <p className="text-sm font-semibold text-slate-700 mb-2">Total: {totalTravellers} Traveller{totalTravellers > 1 ? 's' : ''}, {tempRooms.length} Room{tempRooms.length > 1 ? 's' : ''}</p>
            </div>
            <button type="button" onClick={() => onDone(tempRooms)} className="w-full mt-4 bg-blue-600 text-white py-2 rounded-md font-semibold">Done</button>
        </div>
    );
};

export const HotelSearchPanel: React.FC<{
    onSearch: (params: HotelSearchParams) => void;
    /** When provided (e.g. on results page), pre-fill the form with these params */
    initialParams?: HotelSearchParams | null;
}> = ({ onSearch, initialParams }) => {
    const [city, setCity] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [nationality, setNationality] = useState('India');
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [rooms, setRooms] = useState<RoomConfig[]>([
        { adults: 2, children: 0, childAges: [] },
    ]);
    const [starRatings, setStarRatings] = useState<number[]>([5, 4, 3]);
    const [activePopup, setActivePopup] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const totalTravellers = rooms.reduce((sum, r) => sum + r.adults + r.children, 0);

    useEffect(() => {
        if (!initialParams) return;
        setCity(initialParams.city);
        setSearchTerm(initialParams.searchTerm ?? '');
        setNationality(initialParams.nationality ?? 'India');
        setCheckIn(initialParams.checkIn);
        setCheckOut(initialParams.checkOut);
        setRooms(initialParams.rooms?.length ? initialParams.rooms : [{ adults: 2, children: 0, childAges: [] }]);
        setStarRatings(initialParams.starRatings?.length ? [...initialParams.starRatings] : [5, 4, 3]);
    }, [initialParams]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setActivePopup(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatDateDisplay = (dateStr: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr + 'T00:00:00');
        return {
            day: dateStr.split('-')[2],
            month: date.toLocaleString('default', { month: 'short', year: '2-digit' }),
            weekday: date.toLocaleString('default', { weekday: 'long' })
        };
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!city.trim()) return;
        if (!checkIn || !checkOut) return;
        onSearch({
            city: city.trim(),
            searchTerm: searchTerm.trim() || undefined,
            nationality,
            checkIn,
            checkOut,
            rooms,
            starRatings: starRatings.sort((a, b) => b - a),
        });
    };

    const checkInDisplay = formatDateDisplay(checkIn);
    const checkOutDisplay = formatDateDisplay(checkOut);

    return (
        <div className="bg-white p-4 rounded-2xl shadow-lg border relative" ref={panelRef} onClick={() => setActivePopup(null)}>
            <form onSubmit={handleSubmit}>
                <div className="relative">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.5fr_1.2fr_1fr_1fr_1.2fr] border border-slate-300 rounded-lg">
                        {/* CITY */}
                        <div className="p-2.5 cursor-pointer relative" onClick={(e) => { e.stopPropagation(); setActivePopup('city'); }}>
                            <p className="text-slate-500 text-sm">City</p>
                            <p className="text-2xl font-bold text-slate-800 truncate">{city || 'Select City'}</p>
                            <p className="text-xs text-slate-500 truncate">{city ? 'Destination' : 'Enter city name'}</p>
                            {activePopup === 'city' && (
                                <CitySearchDropdown
                                    onSelect={(selectedCity) => {
                                        setCity(selectedCity.name);
                                        setActivePopup(null);
                                    }}
                                    onClose={() => setActivePopup(null)}
                                />
                            )}
                        </div>

                        {/* SEARCH BY NAME */}
                        <div className="p-2.5 cursor-pointer border-t md:border-t-0 lg:border-l relative" onClick={(e) => { e.stopPropagation(); setActivePopup('search'); }}>
                            <p className="text-slate-500 text-sm">Search</p>
                            <p className="text-2xl font-bold text-slate-800 truncate">{searchTerm || 'By Name'}</p>
                            <p className="text-xs text-slate-500 truncate">{searchTerm ? 'Hotel name' : 'Optional'}</p>
                            {activePopup === 'search' && (
                                <div className="absolute top-full mt-2 left-0 w-full bg-white border rounded-lg shadow-xl z-30 p-3" onClick={e => e.stopPropagation()}>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Search by hotel name"
                                        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                    />
                                </div>
                            )}
                        </div>

                        {/* CHECK-IN */}
                        <div className="p-2.5 cursor-pointer border-t lg:border-t-0 lg:border-l relative" onClick={(e) => { e.stopPropagation(); setActivePopup('dates'); }}>
                            <p className="text-slate-500 text-sm flex justify-between">Check-In <CalendarIcon className="w-4 h-4 text-blue-500" /></p>
                            {checkInDisplay ? (
                                <>
                                    <p>
                                        <span className="text-2xl font-bold">{checkInDisplay.day}</span>{' '}
                                        {checkInDisplay.month}
                                    </p>
                                    <p className="text-xs text-slate-500">{checkInDisplay.weekday}</p>
                                </>
                            ) : (
                                <p className="text-slate-400 text-lg mt-1">Select Date</p>
                            )}
                        </div>

                        {/* CHECK-OUT */}
                        <div className="p-2.5 cursor-pointer border-t lg:border-t-0 lg:border-l relative" onClick={(e) => { e.stopPropagation(); setActivePopup('dates'); }}>
                            <p className="text-slate-500 text-sm flex justify-between">Check-Out <CalendarIcon className="w-4 h-4 text-blue-500" /></p>
                            {checkOutDisplay ? (
                                <>
                                    <p>
                                        <span className="text-2xl font-bold">{checkOutDisplay.day}</span>{' '}
                                        {checkOutDisplay.month}
                                    </p>
                                    <p className="text-xs text-slate-500">{checkOutDisplay.weekday}</p>
                                </>
                            ) : (
                                <p className="text-slate-400 text-sm mt-1">Select Date</p>
                            )}
                        </div>

                        {/* TRAVELLERS & ROOMS */}
                        <div className="p-2.5 cursor-pointer border-t lg:border-t-0 lg:border-l relative" onClick={(e) => { e.stopPropagation(); setActivePopup('travellers'); }}>
                            <p className="text-slate-500 text-sm">Travellers & Rooms</p>
                            <p><span className="text-2xl font-bold">{totalTravellers}</span> Traveller{totalTravellers > 1 ? 's' : ''}</p>
                            <p className="text-xs text-slate-500">{rooms.length} Room{rooms.length > 1 ? 's' : ''}</p>
                            {activePopup === 'travellers' && (
                                <TravellersPopup
                                    rooms={rooms}
                                    onClose={() => setActivePopup(null)}
                                    onDone={(newRooms) => {
                                        setRooms(newRooms);
                                        setActivePopup(null);
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    {activePopup === 'dates' && (
                        <CalendarPopup
                            checkIn={checkIn}
                            checkOut={checkOut}
                            onClose={() => setActivePopup(null)}
                            onDatesChange={(ci, co) => {
                                setCheckIn(ci);
                                setCheckOut(co);
                            }}
                        />
                    )}
                </div>

                {/* SECOND ROW: NATIONALITY & STAR RATING */}
                <div className="mt-4 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium text-slate-600 mb-0.5 block">Nationality</label>
                            <select
                                value={nationality}
                                onChange={e => setNationality(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="India">India</option>
                                <option value="Sri Lanka">Sri Lanka</option>
                                <option value="Australia">Australia</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="relative">
                            <label className="text-sm font-medium text-slate-600 mb-0.5 block">Star Rating</label>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setActivePopup('stars'); }}
                                className="w-full border rounded-md px-3 py-2 text-sm bg-white flex items-center justify-between"
                            >
                                <span>
                                    {starRatings.length
                                        ? `${starRatings.slice().sort((a, b) => b - a).map(s => `${s} Star`).join(', ')}`
                                        : 'Any Rating'}
                                </span>
                                <IconChevronDown className="w-4 h-4 text-slate-500" />
                            </button>
                            {activePopup === 'stars' && (
                                <div className="absolute top-full mt-2 w-full bg-white border rounded-lg shadow-xl z-30 p-3" onClick={e => e.stopPropagation()}>
                                    {[5, 4, 3, 2, 1].map(star => (
                                        <label key={star} className="flex items-center justify-between py-2 cursor-pointer">
                                            <span>{star} Star</span>
                                            <input
                                                type="checkbox"
                                                checked={starRatings.includes(star)}
                                                onChange={() => {
                                                    setStarRatings(prev =>
                                                        prev.includes(star) ? prev.filter(s => s !== star) : [...prev, star]
                                                    );
                                                }}
                                                className="h-4 w-4"
                                            />
                                        </label>
                                    ))}
                                    <div className="mt-2 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setActivePopup(null)}
                                            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="md:w-40">
                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-base font-bold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all"
                        >
                            Search Hotels
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};
