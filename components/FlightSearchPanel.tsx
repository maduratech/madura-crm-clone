import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TboAirport, TboCalendarFare, AmadeusFlightOffer, AmadeusApiDictionary, Currency, ALL_CURRENCIES } from '../types';
import { IconSearch, IconX } from '../constants';
import { searchAirports, getCalendarFares, searchFlightsRaw } from '../lib/amadeus';
import { useToast } from './ToastProvider';

type TripType = 'oneway' | 'roundtrip' | 'multicity' | 'group';

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

// --- MODAL/POPUP COMPONENTS ---

const airportCache = new Map<string, TboAirport[]>();
const AirportSearchDropdown: React.FC<{
    onSelect: (airport: TboAirport) => void;
    onClose: () => void;
}> = ({ onSelect, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TboAirport[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [recentAirports, setRecentAirports] = useState<TboAirport[]>([]);
    const [manualMode, setManualMode] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [manualName, setManualName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimeout = useRef<number | null>(null);

    // Remove duplicate airport codes to avoid React key collisions
    const dedupeAirports = (airports: TboAirport[]) => {
        const seen = new Set<string>();
        return airports.filter((airport) => {
            const key = (airport.code || '').toUpperCase();
            if (!key) return true; // keep entries without a code
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    useEffect(() => {
        inputRef.current?.focus();
        const stored = localStorage.getItem('recent-airports');
        if (stored) {
            try {
                setRecentAirports(JSON.parse(stored));
            } catch {
                setRecentAirports([]);
            }
        }
        // If user already typed (e.g., reopening), trigger a search to show options
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
        if (airportCache.has(key)) {
            setResults(airportCache.get(key)!);
            return;
        }
        setIsLoading(true);
        debounceTimeout.current = window.setTimeout(async () => {
            try {
                const airportResults = await searchAirports(term);
                const uniqueAirports = dedupeAirports(airportResults);
                airportCache.set(key, uniqueAirports);
                setResults(uniqueAirports);
            } catch (error) {
                console.error("Airport search failed:", error);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        }, 400);
    };

    const handleSelect = (airport: TboAirport) => {
        onSelect(airport);
        const nextRecents = [airport, ...recentAirports.filter(a => a.code !== airport.code)].slice(0, 6);
        setRecentAirports(nextRecents);
        localStorage.setItem('recent-airports', JSON.stringify(nextRecents));
        onClose();
    };

    return (
        <div className="absolute top-full left-0 mt-2 w-full max-w-[min(36rem,calc(100vw-1.5rem))] bg-white z-30 p-3 flex flex-col rounded-xl shadow-2xl border" onClick={e => e.stopPropagation()}>
            <label className="relative shrink-0 mb-2 block text-xs font-semibold text-slate-500">
                Search city or airport
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
            {recentAirports.length > 0 && (
                <div className="mb-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1">Recent</p>
                    <div className="flex flex-wrap gap-2">
                        {recentAirports.map((airport, idx) => (
                            <button
                                key={`${airport.code || airport.name}-recent-${idx}`}
                                onClick={() => handleSelect(airport)}
                                className="px-3 py-1.5 rounded-md border text-xs text-slate-700 hover:bg-slate-100"
                            >
                                {airport.city} ({airport.code})
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
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Airport Code (e.g., MAA, DEL)</label>
                        <input
                            type="text"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                            placeholder="Enter 3-letter airport code"
                            maxLength={3}
                            className="w-full p-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Airport/City Name (optional)</label>
                        <input
                            type="text"
                            value={manualName}
                            onChange={(e) => setManualName(e.target.value)}
                            placeholder="Enter airport or city name"
                            className="w-full p-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (manualCode && manualCode.length >= 3) {
                                const manualAirport: TboAirport = {
                                    code: manualCode,
                                    name: manualName || manualCode,
                                    city: manualName || manualCode,
                                    country: ''
                                };
                                handleSelect(manualAirport);
                            }
                        }}
                        disabled={!manualCode || manualCode.length < 3}
                        className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Use {manualCode || 'Airport'}
                    </button>
                </div>
            ) : (
                <ul className="grow max-h-72 overflow-y-auto">
                    {isLoading && <li className="p-3 text-center text-slate-500">Searching...</li>}
                    {!isLoading && results.length === 0 && query.length >= 2 && <li className="p-3 text-center text-slate-500">No results found. Try manual entry.</li>}
                    {results.map((airport, idx) => (
                        <li key={`${airport.code || airport.name}-${idx}`} onClick={() => handleSelect(airport)} className="p-3 hover:bg-slate-100 cursor-pointer rounded-md flex items-center gap-3">
                            <div className="text-blue-600">✈️</div>
                            <div>
                                <p className="font-semibold text-sm">{airport.city}, {airport.country}</p>
                                <p className="text-xs text-slate-500">{airport.name} ({airport.code})</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const formatDateString = (year: number, monthZeroBased: number, day: number) =>
    `${year}-${String(monthZeroBased + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const CalendarPopup: React.FC<{
    tripType: TripType;
    onClose: () => void;
    onDatesChange: (departure?: string, returnD?: string) => void;
    initialDeparture?: string;
    initialReturn?: string;
    fromCode?: string;
    toCode?: string;
}> = ({ onClose, onDatesChange, initialDeparture, initialReturn, tripType, fromCode, toCode }) => {
    const [displayDate, setDisplayDate] = useState(initialDeparture ? new Date(initialDeparture) : new Date());
    const [hoverDate, setHoverDate] = useState<Date | null>(null);
    const [departureDate, setDepartureDate] = useState(initialDeparture ? new Date(initialDeparture) : null);
    const [returnDate, setReturnDate] = useState(initialReturn ? new Date(initialReturn) : null);
    const [fareData, setFareData] = useState<Map<string, number>>(new Map());
    const [isLoadingFares, setIsLoadingFares] = useState(false);
    const fetchedMonths = useRef<Set<string>>(new Set());

    const fetchFaresForMonth = useCallback(async (date: Date) => {
        if (!fromCode || !toCode) return;

        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthKey = `${year}-${month}`;

        if (fetchedMonths.current.has(monthKey)) return;

        setIsLoadingFares(true);
        fetchedMonths.current.add(monthKey);

        try {
            const journeyDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const fares = await getCalendarFares(fromCode, toCode, journeyDate);

            setFareData(prevFares => {
                const newFares = new Map(prevFares);
                fares.forEach(fare => {
                    const dateKey = fare.Date.split('T')[0];
                    newFares.set(dateKey, fare.Price);
                });
                return newFares;
            });

        } catch (error) {
            console.error("Failed to fetch calendar fares:", error);
        } finally {
            setIsLoadingFares(false);
        }

    }, [fromCode, toCode]);

    useEffect(() => {
        const month1 = displayDate;
        const month2 = new Date(displayDate.getFullYear(), displayDate.getMonth() + 1);

        fetchFaresForMonth(month1);
        fetchFaresForMonth(month2);

    }, [displayDate, fetchFaresForMonth]);

    const handleDateClick = (day: number, month: number, year: number) => {
        const clickedDate = new Date(year, month, day);
        clickedDate.setHours(0, 0, 0, 0);
        const clickedStr = formatDateString(year, month, day);
        if (tripType === 'oneway' || tripType === 'multicity' || tripType === 'group') {
            onDatesChange(clickedStr);
            onClose();
        } else { // roundtrip
            const depMidnight = departureDate ? new Date(departureDate.getFullYear(), departureDate.getMonth(), departureDate.getDate()) : null;
            if (!depMidnight || clickedDate.getTime() <= depMidnight.getTime() || (depMidnight && returnDate)) {
                setDepartureDate(clickedDate);
                setReturnDate(null);
            } else {
                setReturnDate(clickedDate);
                onDatesChange(formatDateString(departureDate!.getFullYear(), departureDate!.getMonth(), departureDate!.getDate()), clickedStr);
                onClose();
            }
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
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const price = fareData.get(dateKey);

            const isPast = currentDate < today;
            const isDeparture = departureDate && currentDate.getTime() === departureDate.getTime();
            const isReturn = returnDate && currentDate.getTime() === returnDate.getTime();
            const isInRange = departureDate && !returnDate && hoverDate && currentDate > departureDate && currentDate <= hoverDate;
            const isSelectedRange = departureDate && returnDate && currentDate > departureDate && currentDate < returnDate;

            let dayClasses = 'text-center rounded-lg p-1.5 sm:p-1 text-sm min-h-[44px] sm:min-h-0 flex flex-col items-center justify-center touch-manipulation';
            if (isPast) {
                dayClasses += ' text-slate-300';
            } else {
                dayClasses += ' cursor-pointer';
                if (isDeparture || isReturn) {
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
                    {!isPast && price !== undefined && (
                        <p className="text-[10px] sm:text-xs text-green-600">{price.toLocaleString()}</p>
                    )}
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
        <>
            {/* Backdrop on mobile for easier close and focus */}
            <div className="fixed inset-0 z-[29] sm:hidden" aria-hidden onClick={onClose} />
            <div
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-1.5rem)] max-w-[700px] max-h-[90vh] overflow-y-auto bg-white z-30 p-4 rounded-xl shadow-2xl border sm:absolute sm:left-1/2 sm:right-auto sm:top-full sm:translate-x-[-50%] sm:translate-y-2 sm:mt-0 sm:max-h-none"
                onMouseLeave={() => setHoverDate(null)}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <button
                        type="button"
                        onClick={() => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() - 1))}
                        className="p-2.5 sm:p-2 rounded-full hover:bg-slate-100 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label="Previous month"
                    >
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <p className="font-semibold text-blue-600 text-xs sm:text-base text-center px-2">
                        {tripType === 'roundtrip' && (!departureDate ? 'Select departure date' : !returnDate ? 'Select return date' : 'Selected')}
                    </p>
                    <button
                        type="button"
                        onClick={() => setDisplayDate(new Date(displayDate.getFullYear(), displayDate.getMonth() + 1))}
                        className="p-2.5 sm:p-2 rounded-full hover:bg-slate-100 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label="Next month"
                    >
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                    {renderMonth(displayDate)}
                    {renderMonth(new Date(displayDate.getFullYear(), displayDate.getMonth() + 1))}
                </div>
                <p className="text-center text-xs text-slate-500 mt-3 sm:mt-4">Showing our lowest prices in ₹</p>
                <button
                    type="button"
                    onClick={onClose}
                    className="sm:hidden w-full mt-3 py-2.5 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 touch-manipulation"
                >
                    Close
                </button>
            </div>
        </>
    );
};

const PassengerPopup: React.FC<{
    passengers: { adults: number; children: number; infants: number; };
    cabin: string;
    onClose: () => void;
    onDone: (passengers: any, cabin: string) => void;
}> = ({ passengers, cabin, onClose, onDone }) => {
    const [tempPassengers, setTempPassengers] = useState(passengers);
    const [tempCabin, setTempCabin] = useState(cabin);

    const handlePassengerChange = (type: 'adults' | 'children' | 'infants', delta: number) => {
        setTempPassengers(prev => {
            const currentVal = prev[type];
            const newVal = currentVal + delta;
            const minVal = type === 'adults' ? 1 : 0;
            return { ...prev, [type]: Math.max(minVal, newVal) };
        });
    };

    const PassengerCounter: React.FC<{ label: string; sublabel: string; count: number; onDelta: (d: number) => void; }> = ({ label, sublabel, count, onDelta }) => (
        <div className="flex justify-between items-center">
            <div>
                <p className="font-medium text-slate-700">{label}</p>
                <p className="text-xs text-slate-500">{sublabel}</p>
            </div>
            <div className="flex items-center gap-2">
                <button type="button" onClick={() => onDelta(-1)} className="w-7 h-7 rounded-full border text-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center">-</button>
                <span className="w-8 text-center font-semibold">{count}</span>
                <button type="button" onClick={() => onDelta(1)} className="w-7 h-7 rounded-full border text-lg text-slate-600 hover:bg-slate-100 flex items-center justify-center">+</button>
            </div>
        </div>
    );

    return (
        <div className="absolute top-full mt-2 w-80 bg-white z-30 p-4 rounded-lg shadow-2xl border right-0" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Travellers</h3>
            <div className="space-y-3 mb-4">
                <PassengerCounter label="Adults" sublabel="(12+ Yrs)" count={tempPassengers.adults} onDelta={d => handlePassengerChange('adults', d)} />
                <PassengerCounter label="Children" sublabel="(2-12 Yrs)" count={tempPassengers.children} onDelta={d => handlePassengerChange('children', d)} />
                <PassengerCounter label="Infants" sublabel="(Under 2 Yrs)" count={tempPassengers.infants} onDelta={d => handlePassengerChange('infants', d)} />
            </div>
            <h3 className="font-semibold mb-2">Cabin Class</h3>
            <select value={tempCabin} onChange={e => setTempCabin(e.target.value)} className="w-full p-2 border rounded-md bg-white">
                <option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option>
            </select>
            <button type="button" onClick={() => onDone(tempPassengers, tempCabin)} className="w-full mt-4 bg-blue-600 text-white py-2 rounded-md font-semibold">Done</button>
        </div>
    );
};

// --- MAIN PANEL ---

export const FlightSearchPanel: React.FC<{
    onSearch: ((params: any) => void) | ((offer: AmadeusFlightOffer, dictionaries: AmadeusApiDictionary) => void);
    initialFrom?: string; // City name for starting point
    initialTo?: string; // City name for destination
    isItineraryContext?: boolean; // If true, perform search and return AmadeusFlightOffer
    initialPassengers?: { adults: number; children: number; infants: number }; // Pre-fill from lead requirements
    initialDepartureDate?: string; // Pre-fill departure date from lead travel_date
}> = ({ onSearch, initialFrom, initialTo, isItineraryContext = false, initialPassengers, initialDepartureDate }) => {
    const { addToast } = useToast();
    const [tripType, setTripType] = useState<TripType>('oneway');
    const [segments, setSegments] = useState([
        { from: null as TboAirport | null, to: null as TboAirport | null, date: '' }
    ]);
    const [returnDate, setReturnDate] = useState('');
    const [passengers, setPassengers] = useState({
        adults: initialPassengers?.adults || 1,
        children: initialPassengers?.children || 0,
        infants: initialPassengers?.infants || 0
    });
    const [cabin, setCabin] = useState('Economy');
    const [fareType, setFareType] = useState('Regular');

    const [activePopup, setActivePopup] = useState<string | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [isPreFilling, setIsPreFilling] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<{ offers: AmadeusFlightOffer[], dictionaries: AmadeusApiDictionary } | null>(null);

    // Update passengers when initialPassengers prop changes
    useEffect(() => {
        if (initialPassengers) {
            setPassengers({
                adults: initialPassengers.adults || 1,
                children: initialPassengers.children || 0,
                infants: initialPassengers.infants || 0
            });
        }
    }, [initialPassengers]);

    // Update departure date when initialDepartureDate prop changes
    useEffect(() => {
        if (initialDepartureDate && segments[0] && !segments[0].date) {
            // Format date as YYYY-MM-DD if needed
            const dateStr = initialDepartureDate.includes('T')
                ? initialDepartureDate.split('T')[0]
                : initialDepartureDate;
            setSegments(prev => {
                const newSegments = [...prev];
                if (newSegments[0]) {
                    newSegments[0] = { ...newSegments[0], date: dateStr };
                }
                return newSegments;
            });
        }
    }, [initialDepartureDate]);

    useEffect(() => {
        setReturnDate('');
        if (tripType === 'multicity' && segments.length < 2) {
            addSegment();
        } else if ((tripType === 'oneway' || tripType === 'group') && segments.length > 1) {
            setSegments(prev => [prev[0]]);
        }
    }, [tripType]);

    // Helper function to sanitize location string for airport search
    const sanitizeLocationForSearch = (location: string): string => {
        if (!location) return '';
        // Remove extra whitespace
        let cleaned = location.trim();
        // If it contains commas, take the first part (usually the primary destination)
        if (cleaned.includes(',')) {
            cleaned = cleaned.split(',')[0].trim();
        }
        // Remove common prefixes/suffixes that might interfere
        cleaned = cleaned.replace(/^(to|from|via)\s+/i, '');
        return cleaned;
    };

    // Pre-fill from and to airports based on itinerary's starting_point and destination
    useEffect(() => {
        const preFillAirports = async () => {
            // Only pre-fill if we have initial values and haven't already pre-filled
            if ((initialFrom || initialTo) && !isPreFilling) {
                const needsPreFill = (initialFrom && !segments[0].from) || (initialTo && !segments[0].to);
                if (!needsPreFill) return;

                setIsPreFilling(true);
                try {
                    const newSegments = [...segments];

                    if (initialFrom && !newSegments[0].from) {
                        try {
                            const searchTerm = sanitizeLocationForSearch(initialFrom);
                            if (searchTerm.length >= 2) { // Only search if we have at least 2 characters
                                const airports = await searchAirports(searchTerm);
                                if (airports.length > 0) {
                                    // Prefer airports that match the city name closely
                                    const matchingAirport = airports.find(a =>
                                        a.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        searchTerm.toLowerCase().includes(a.city?.toLowerCase() || '')
                                    ) || airports[0];
                                    newSegments[0].from = matchingAirport;
                                }
                            }
                        } catch (error) {
                            console.error('Failed to search airports for initialFrom:', error);
                        }
                    }

                    if (initialTo && !newSegments[0].to) {
                        try {
                            const searchTerm = sanitizeLocationForSearch(initialTo);
                            if (searchTerm.length >= 2) { // Only search if we have at least 2 characters
                                const airports = await searchAirports(searchTerm);
                                if (airports.length > 0) {
                                    // Prefer airports that match the city name closely
                                    const matchingAirport = airports.find(a =>
                                        a.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        searchTerm.toLowerCase().includes(a.city?.toLowerCase() || '')
                                    ) || airports[0];
                                    newSegments[0].to = matchingAirport;
                                }
                            }
                        } catch (error) {
                            console.error('Failed to search airports for initialTo:', error);
                        }
                    }

                    setSegments(newSegments);
                } finally {
                    setIsPreFilling(false);
                }
            }
        };

        preFillAirports();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialFrom, initialTo]);

    const handleSegmentChange = (index: number, field: 'from' | 'to' | 'date', value: any) => {
        const newSegments = [...segments];
        newSegments[index][field] = value;
        setSegments(newSegments);
    };

    const addSegment = () => {
        setSegments(prev => [...prev, { from: prev[prev.length - 1].to, to: null, date: '' }]);
    };

    const removeSegment = (index: number) => {
        setSegments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSwap = () => {
        handleSegmentChange(0, 'from', segments[0].to);
        handleSegmentChange(0, 'to', segments[0].from);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let searchSegments = segments;
        if (tripType === 'roundtrip') {
            if (!segments[0].date || !returnDate) {
                addToast('Please select departure and return dates for a round trip.', 'error');
                return;
            }
        }

        for (const [index, seg] of segments.entries()) {
            if (!seg.from || !seg.to || !seg.date) {
                addToast(`Please complete all fields for flight ${index + 1}.`, 'error');
                return;
            }
        }

        const searchParams = {
            tripType,
            passengers,
            cabin,
            fareType,
            segments: segments.map(s => ({ from: s.from?.code, to: s.to?.code, date: s.date, fromName: s.from?.city, toName: s.to?.city })),
            returnDate: tripType === 'roundtrip' ? returnDate : null,
        };

        // If in itinerary context, perform search and show results
        if (isItineraryContext) {
            setIsSearching(true);
            try {
                const { offers, dictionaries } = await searchFlightsRaw(searchParams);
                setSearchResults({ offers, dictionaries });
            } catch (error: any) {
                addToast(`Flight search failed: ${error.message}`, 'error');
            } finally {
                setIsSearching(false);
            }
        } else {
            // Normal flow: just pass params to parent
            (onSearch as (params: any) => void)(searchParams);
        }
    };

    const handleSelectFlight = (offer: AmadeusFlightOffer) => {
        if (!searchResults) return;

        // Check if offer has price
        const priceTotal = offer.price?.total ?? (offer as any)?.price?.grandTotal;
        if (!offer.price || !priceTotal) {
            addToast('Selected flight is missing price details. Please pick another option.', 'error');
            return;
        }

        // Type assertion for itinerary context callback
        if (isItineraryContext) {
            (onSearch as (offer: AmadeusFlightOffer, dictionaries: AmadeusApiDictionary) => void)(offer, searchResults.dictionaries);
        }
    };

    const totalPassengers = passengers.adults + passengers.children + passengers.infants;
    const isSimpleTrip = tripType === 'oneway' || tripType === 'roundtrip';

    return (
        <div className="bg-white p-3 sm:p-6 rounded-2xl shadow-lg border relative" ref={panelRef} onClick={() => setActivePopup(null)}>
            <form onSubmit={handleSubmit}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        {(['oneway', 'roundtrip', 'multicity', 'group'] as const).map(type => (
                            <label key={type} className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="tripType" value={type} checked={tripType === type} onChange={() => setTripType(type)} className="form-radio h-4 w-4 text-blue-600 shrink-0" />
                                <span className={`text-xs sm:text-sm font-medium whitespace-nowrap ${tripType === type ? 'text-blue-600' : 'text-slate-600'}`}>
                                    {{ oneway: 'One Way', roundtrip: 'Round Trip', multicity: 'Multi City', group: 'Group' }[type]}
                                </span>
                            </label>
                        ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-0">Book International and Domestic Flights</p>
                </div>

                {tripType !== 'multicity' ? (
                    <div className="relative">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1fr_0.8fr_0.8fr_1fr] border border-slate-300 rounded-lg">
                            {/* FROM */}
                            <div className="p-3 cursor-pointer relative min-w-0" onClick={(e) => { e.stopPropagation(); setActivePopup('from-0'); }}>
                                <p className="text-slate-500 text-xs sm:text-sm">From</p>
                                <p className="text-lg sm:text-2xl font-bold text-slate-800 truncate">{segments[0].from ? segments[0].from.city : 'Select City'}</p>
                                <p className="text-xs text-slate-500 truncate">{segments[0].from ? `${segments[0].from.code}, ${segments[0].from.name}` : 'Starting point'}</p>
                                {activePopup === 'from-0' && <AirportSearchDropdown onClose={() => setActivePopup(null)} onSelect={airport => { handleSegmentChange(0, 'from', airport); setActivePopup('to-0'); }} />}
                            </div>

                            {/* TO */}
                            <div className="p-3 cursor-pointer border-t md:border-t-0 lg:border-l relative min-w-0" onClick={(e) => { e.stopPropagation(); setActivePopup('to-0'); }}>
                                <p className="text-slate-500 text-xs sm:text-sm">To</p>
                                <p className="text-lg sm:text-2xl font-bold text-slate-800 truncate">{segments[0].to ? segments[0].to.city : 'Select City'}</p>
                                <p className="text-xs text-slate-500 truncate">{segments[0].to ? `${segments[0].to.code}, ${segments[0].to.name}` : 'Destination'}</p>
                                {activePopup === 'to-0' && <AirportSearchDropdown onClose={() => setActivePopup(null)} onSelect={airport => { handleSegmentChange(0, 'to', airport); setActivePopup('date'); }} />}
                            </div>

                            {/* DEPARTURE */}
                            <div className="p-3 cursor-pointer border-t lg:border-t-0 lg:border-l relative" onClick={(e) => { e.stopPropagation(); setActivePopup('date'); }}>
                                <p className="text-slate-500 text-sm flex justify-between">Departure <CalendarIcon className="w-4 h-4 text-blue-500" /></p>
                                {segments[0].date ? (
                                    <>
                                        <p>
                                            <span className="text-2xl font-bold">{segments[0].date.split('-')[2]}</span>{' '}
                                            {new Date(segments[0].date + 'T00:00:00').toLocaleString('default', { month: 'short', year: '2-digit' })}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {new Date(segments[0].date + 'T00:00:00').toLocaleString('default', { weekday: 'long' })}
                                        </p>
                                    </>
                                ) : (<p className="text-slate-400 text-lg mt-1">Select Date</p>)}
                            </div>

                            {/* RETURN */}
                            <div className={`p-3 cursor-pointer border-t lg:border-t-0 lg:border-l relative ${tripType === 'oneway' ? 'opacity-50' : ''}`} onClick={(e) => { e.stopPropagation(); tripType === 'roundtrip' && setActivePopup('date'); }}>
                                <p className="text-slate-500 text-sm flex justify-between">Return <CalendarIcon className="w-4 h-4 text-blue-500" /></p>
                                {returnDate ? (
                                    <>
                                        <p>
                                            <span className="text-2xl font-bold">{returnDate.split('-')[2]}</span>{' '}
                                            {new Date(returnDate + 'T00:00:00').toLocaleString('default', { month: 'short', year: '2-digit' })}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {new Date(returnDate + 'T00:00:00').toLocaleString('default', { weekday: 'long' })}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-slate-400 text-sm mt-1">{tripType === 'oneway' ? 'One Way Trip' : 'Tap to add return'}</p>
                                )}
                            </div>

                            {/* TRAVELLERS */}
                            <div className="p-3 cursor-pointer border-t lg:border-t-0 lg:border-l relative" onClick={(e) => { e.stopPropagation(); setActivePopup('passengers'); }}>
                                <p className="text-slate-500 text-sm">Travellers & Class</p>
                                <p><span className="text-2xl font-bold">{totalPassengers}</span> {tripType === 'group' ? 'Travellers' : 'Traveller'}</p>
                                <p className="text-xs text-slate-500">{cabin}</p>
                                {activePopup === 'passengers' && <PassengerPopup passengers={passengers} cabin={cabin} onClose={() => setActivePopup(null)} onDone={(p, c) => { setPassengers(p); setCabin(c); setActivePopup(null); }} />}
                            </div>
                        </div>

                        {activePopup === 'date' && <CalendarPopup tripType={tripType} initialDeparture={segments[0].date} initialReturn={returnDate} onClose={() => setActivePopup(null)} onDatesChange={(dep, ret) => { if (dep) handleSegmentChange(0, 'date', dep); setReturnDate(ret || ''); }} fromCode={segments[0].from?.code} toCode={segments[0].to?.code} />}

                        <div className="absolute top-1/2 left-[calc(40%-2.5rem)] md:left-1/4 lg:left-[20%] -translate-y-1/2 -translate-x-1/2 z-10 hidden lg:block">
                            <button type="button" onClick={handleSwap} className="w-9 h-9 bg-white border-2 border-slate-300 rounded-full flex items-center justify-center text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-all">&#x21C4;</button>
                        </div>
                    </div>
                ) : ( // Multi City
                    <div className="space-y-3">
                        {segments.map((seg, index) => (
                            <div key={index} className="grid grid-cols-[1fr_2rem_1fr_1fr_auto] gap-x-3 items-center">
                                {/* From */}
                                <div className="border rounded-lg p-2 cursor-pointer relative" onClick={(e) => { e.stopPropagation(); setActivePopup(`from-${index}`); }}>
                                    <p className="text-slate-500 text-xs">From</p>
                                    <p className="font-semibold text-slate-800 truncate">{seg.from ? `${seg.from.city} (${seg.from.code})` : 'Select Departure'}</p>
                                    {activePopup === `from-${index}` && <AirportSearchDropdown onClose={() => setActivePopup(null)} onSelect={airport => { handleSegmentChange(index, 'from', airport); setActivePopup(`to-${index}`) }} />}
                                </div>
                                <button type="button" onClick={handleSwap} className="w-8 h-8 bg-white border border-slate-300 rounded-full flex items-center justify-center text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-all">&#x21C4;</button>
                                {/* To */}
                                <div className="border rounded-lg p-2 cursor-pointer relative" onClick={(e) => { e.stopPropagation(); setActivePopup(`to-${index}`); }}>
                                    <p className="text-slate-500 text-xs">To</p>
                                    <p className="font-semibold text-slate-800 truncate">{seg.to ? `${seg.to.city} (${seg.to.code})` : 'Select City'}</p>
                                    {activePopup === `to-${index}` && <AirportSearchDropdown onClose={() => setActivePopup(null)} onSelect={airport => { handleSegmentChange(index, 'to', airport); setActivePopup(`date-${index}`) }} />}
                                </div>
                                {/* Date */}
                                <div className="border rounded-lg p-2 cursor-pointer relative" onClick={(e) => { e.stopPropagation(); setActivePopup(`date-${index}`); }}>
                                    <p className="text-slate-500 text-xs">Date</p>
                                    <p className="font-semibold text-slate-800">{seg.date ? new Date(seg.date).toDateString() : 'Select Date'}</p>
                                    {activePopup === `date-${index}` && <CalendarPopup tripType={tripType} initialDeparture={seg.date} onClose={() => setActivePopup(null)} onDatesChange={(dep) => { if (dep) handleSegmentChange(index, 'date', dep); }} fromCode={seg.from?.code} toCode={seg.to?.code} />}
                                </div>
                                {index > 1 && <button type="button" onClick={() => removeSegment(index)} className="p-1 text-red-500 hover:bg-red-100 rounded-full"><IconX className="w-5 h-5" /></button>}
                            </div>
                        ))}
                        {segments.length < 5 && <button type="button" onClick={addSegment} className="text-sm font-semibold text-blue-600 hover:underline">+ Add another city</button>}
                        <div className="p-3 cursor-pointer border rounded-lg relative mt-3" onClick={(e) => { e.stopPropagation(); setActivePopup('passengers'); }}>
                            <p className="text-slate-500 text-sm">Travellers & Class</p>
                            <p><span className="text-2xl font-bold">{totalPassengers}</span> Traveller</p>
                            <p className="text-xs text-slate-500">{cabin}</p>
                            {activePopup === 'passengers' && <PassengerPopup passengers={passengers} cabin={cabin} onClose={() => setActivePopup(null)} onDone={(p, c) => { setPassengers(p); setCabin(c); setActivePopup(null); }} />}
                        </div>
                    </div>
                )}

                <div className="mt-4 sm:mt-6">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 mb-2">Select a special fare:</p>
                    <div className="flex flex-wrap gap-2">
                        {['Regular', 'Student', 'Armed Forces', 'Senior Citizen', 'Doctor and Nurses'].map(fare => (
                            <button key={fare} type="button" onClick={() => setFareType(fare)} className={`px-3 sm:px-4 py-2 text-xs sm:text-sm border rounded-lg touch-manipulation ${fareType === fare ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
                                {fare}
                                {fare === 'Regular' && <p className="text-[10px] sm:text-xs text-slate-500 -mt-1">Regular fares</p>}
                                {fare === 'Student' && <p className="text-[10px] sm:text-xs text-slate-500 -mt-1">Extra discounts/baggage</p>}
                                {['Armed Forces', 'Senior Citizen', 'Doctor and Nurses'].includes(fare) && <p className="text-[10px] sm:text-xs text-slate-500 -mt-1">Up to ₹ 600 off</p>}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-8">
                    {/* Desktop: single "Search Flights" button in form flow */}
                    <div className="hidden sm:flex justify-end mb-3">
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="px-10 py-3 text-base font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSearching ? 'Searching...' : 'Search Flights'}
                        </button>
                    </div>
                    {/* Mobile only: single sticky "Search" button at bottom */}
                    <div className="sm:hidden fixed left-0 right-0 bottom-4 px-4 pointer-events-none z-20">
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="w-full max-w-md mx-auto px-12 py-3 text-lg font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-full shadow-xl hover:shadow-2xl transition-all pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed block"
                        >
                            {isSearching ? 'Searching...' : 'Search Flights'}
                        </button>
                    </div>
                </div>
            </form>

            {/* Search Results (for itinerary context) */}
            {isItineraryContext && searchResults && (
                <div className="mt-6 space-y-4">
                    <h3 className="text-lg font-semibold">Search Results</h3>
                    {searchResults.offers.length === 0 ? (
                        <div className="text-center p-6 bg-slate-50 rounded-lg">
                            <p className="text-slate-600">No flights found. Try adjusting your search criteria.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {searchResults.offers.map((offer, index) => {
                                const priceTotal = offer.price?.total ?? (offer as any)?.price?.grandTotal;
                                const hasPrice = offer.price && priceTotal;
                                const firstItinerary = offer.itineraries?.[0];
                                const firstSegment = firstItinerary?.segments?.[0];
                                const lastSegment = firstItinerary?.segments?.[firstItinerary.segments.length - 1];

                                return (
                                    <div
                                        key={offer.id || index}
                                        className={`p-4 border rounded-lg ${hasPrice ? 'bg-white hover:shadow-md cursor-pointer' : 'bg-slate-50 opacity-60 cursor-not-allowed'}`}
                                        onClick={() => hasPrice && handleSelectFlight(offer)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                {firstSegment && (
                                                    <>
                                                        <div className="flex items-center gap-4 mb-2">
                                                            <div>
                                                                <p className="font-bold">{firstSegment.departure.iataCode}</p>
                                                                <p className="text-xs text-slate-500">{new Date(firstSegment.departure.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                            </div>
                                                            <div className="flex-1 text-center">
                                                                <p className="text-sm text-slate-600">{firstItinerary.duration}</p>
                                                                <p className="text-xs text-slate-500">{firstItinerary.segments.length - 1} stop(s)</p>
                                                            </div>
                                                            <div>
                                                                <p className="font-bold">{lastSegment.arrival.iataCode}</p>
                                                                <p className="text-xs text-slate-500">{new Date(lastSegment.arrival.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-slate-600">
                                                            {searchResults.dictionaries.carriers[firstSegment.carrierCode] || firstSegment.carrierCode} {firstSegment.number}
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                            <div className="text-right ml-4">
                                                {hasPrice ? (
                                                    <>
                                                        <p className="text-lg font-bold">₹{parseFloat(priceTotal).toLocaleString('en-IN')}</p>
                                                        <p className="text-xs text-slate-500">{offer.price.currency}</p>
                                                    </>
                                                ) : (
                                                    <p className="text-sm text-red-600">No price</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
