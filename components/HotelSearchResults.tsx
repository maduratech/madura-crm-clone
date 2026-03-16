import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from '../contexts/RouterProvider';
import { useAuth } from '../contexts/AuthProvider';
import { HotelSearchResult, isSuperAdmin } from '../types';
import { searchHotels } from '../lib/hotels';
import { useToast } from './ToastProvider';
import { HotelSearchPanel, HotelSearchParams } from './HotelSearchPanel';

// --- ICONS ---
const IconFilter: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
);
const IconX: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// Hotel icon for loading animation
const HotelIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89-6.88a2 2 0 012.22 0L21 8M5 10v10a2 2 0 002 2h10a2 2 0 002-2V10M9 22V12h6v10" />
    </svg>
);

// --- LOADING COMPONENT ---
const HotelSearchLoader: React.FC<{ params: HotelSearchParams }> = ({ params }) => {
    return (
        <div className="flex items-center justify-center py-20">
            <div className="relative w-full max-w-lg bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
                <div className="text-center">
                    <p className="text-base font-semibold text-slate-700">Please Wait....</p>
                    <p className="text-xs text-slate-500 mt-1">We are looking for all available hotels for</p>
                </div>

                <div className="flex justify-between items-center my-6">
                    <div className="text-center">
                        <p className="font-bold text-[#191974]">{params.city}</p>
                        <p className="text-xs text-slate-600">Destination</p>
                    </div>
                    <div className="relative w-32 h-1 bg-gradient-to-r from-blue-300 to-blue-500 rounded-full">
                        <HotelIcon className="w-6 h-6 text-blue-500 absolute -top-2.5 left-1/2 -translate-x-1/2 animate-pulse" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-[#191974]">{params.checkIn}</p>
                        <p className="text-xs text-slate-600">Check-In</p>
                    </div>
                </div>

                <div className="text-center text-xs text-slate-600">
                    <p><span className="font-semibold">Check-Out:</span> {params.checkOut}</p>
                    <p><span className="font-semibold">Rooms:</span> {params.rooms.length} · <span className="font-semibold">Guests:</span> {params.rooms.reduce((sum, r) => sum + (r.adults || 0) + (r.children || 0), 0)}</p>
                </div>
            </div>
        </div>
    );
};

// Location pin icon for address
const IconLocation: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
);

// --- HOTEL RESULT CARD (grid style: big image on top, then name, address, price) ---
const HotelResultCard: React.FC<{
    hotel: HotelSearchResult;
    onSelect: (hotel: HotelSearchResult) => void;
}> = ({ hotel, onSelect }) => {
    return (
        <button
            type="button"
            className="w-full text-left bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden"
            onClick={() => onSelect(hotel)}
        >
            {/* Image on top - large, like reference */}
            <div className="aspect-[4/3] w-full bg-slate-100 relative overflow-hidden">
                {hotel.thumbnailUrl ? (
                    <img
                        src={hotel.thumbnailUrl}
                        alt={hotel.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-200">
                        <HotelIcon className="w-14 h-14 text-slate-400" />
                    </div>
                )}
                {hotel.provider && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-white/90 text-[10px] font-semibold text-slate-600 uppercase shadow-sm">
                        {hotel.provider}
                    </span>
                )}
            </div>

            {/* Content below image */}
            <div className="p-3">
                {/* Star rating below image */}
                {typeof hotel.starRating === 'number' && hotel.starRating > 0 && (
                    <p className="text-amber-500 text-sm mb-1" aria-label={`${hotel.starRating} star`}>
                        {'★'.repeat(hotel.starRating)}
                    </p>
                )}

                {/* Hotel name - full name, up to 2 lines */}
                <h3 className="text-base font-bold text-slate-900 line-clamp-2 min-h-[2.5rem] leading-tight mb-1">
                    {hotel.name}
                </h3>

                {/* Address with pin */}
                <p className="text-xs text-slate-500 flex items-start gap-1.5 mb-2 line-clamp-2">
                    <IconLocation className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                    <span>{hotel.address || `${hotel.city}${hotel.country ? `, ${hotel.country}` : ''}` || '—'}</span>
                </p>

                {/* Refundable badge */}
                <p className="text-[11px] mb-2">
                    {hotel.refundable === true
                        ? <span className="text-emerald-600">🟢 Refundable</span>
                        : hotel.refundable === false
                            ? <span className="text-red-600">🔴 Non-refundable</span>
                            : <span className="text-slate-500">ℹ️ Refundability as per provider</span>}
                </p>

                {/* Nights + Price */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-600">
                        {hotel.nights} Night{hotel.nights > 1 ? 's' : ''} Stay
                    </span>
                    <div className="text-right">
                        <p className="text-sm font-bold text-[#191974] leading-tight">
                            {hotel.currency} {Math.round(hotel.totalPrice).toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-slate-500">
                            {hotel.currency} {Math.round(hotel.pricePerNight).toLocaleString('en-IN')}/night
                        </p>
                    </div>
                </div>
            </div>
        </button>
    );
};

// --- MAIN COMPONENT ---
const HotelSearchResults: React.FC = () => {
    const { search, navigate } = useRouter();
    const { profile: currentUser } = useAuth();
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<HotelSearchResult[]>([]);
    const [selectedHotel, setSelectedHotel] = useState<HotelSearchResult | null>(null);
    const [selectedHotelDetails, setSelectedHotelDetails] = useState<{ imageUrls: string[]; facilities?: string[] } | null>(null);
    const [priceFilter, setPriceFilter] = useState<[number, number]>([0, 100000]);
    const [sourceFilter, setSourceFilter] = useState<'All' | 'TBO' | 'Amadeus'>('All');
    const [refundableFilter, setRefundableFilter] = useState<'All' | 'Refundable' | 'Non-Refundable'>('All');
    const [sortBy, setSortBy] = useState<'price' | 'rating' | 'name'>('price');

    const isSuperAdminUser = currentUser ? isSuperAdmin(currentUser) : false;

    const parsedParams: HotelSearchParams | null = useMemo(() => {
        if (!search || !search.startsWith('?')) return null;
        const qs = new URLSearchParams(search);
        const city = qs.get('city') || '';
        const checkIn = qs.get('checkIn') || '';
        const checkOut = qs.get('checkOut') || '';
        if (!city || !checkIn || !checkOut) return null;

        const searchTerm = qs.get('searchTerm') || undefined;
        const nationality = qs.get('nationality') || undefined;
        let rooms: HotelSearchParams['rooms'] = [{ adults: 2, children: 0, childAges: [] }];
        try {
            const roomsRaw = qs.get('rooms');
            if (roomsRaw) {
                rooms = JSON.parse(roomsRaw);
            }
        } catch {
            // ignore parse errors
        }
        const starsStr = qs.get('stars') || '';
        const starRatings = starsStr
            ? starsStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
            : [5, 4, 3];

        return {
            city,
            searchTerm,
            nationality,
            checkIn,
            checkOut,
            rooms,
            starRatings,
        };
    }, [search]);

    useEffect(() => {
        const runSearch = async () => {
            if (!parsedParams) {
                setResults([]);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                const { results: hotelResults } = await searchHotels(parsedParams);
                setResults(hotelResults);
                if (hotelResults.length === 0) {
                    addToast('No hotels found for your criteria.', 'error');
                }
            } catch (e: any) {
                setError(e.message || 'Failed to search hotels.');
                addToast(`Hotel search failed: ${e.message}`, 'error');
            } finally {
                setIsLoading(false);
            }
        };
        runSearch();
    }, [parsedParams, addToast]);

    const filteredAndSortedResults = useMemo(() => {
        let filtered = [...results];

        // Source filter
        if (sourceFilter !== 'All') {
            filtered = filtered.filter(h => h.provider === sourceFilter);
        }

        // Refundable filter
        if (refundableFilter === 'Refundable') {
            filtered = filtered.filter(h => h.refundable === true);
        } else if (refundableFilter === 'Non-Refundable') {
            filtered = filtered.filter(h => h.refundable === false);
        }

        // Price filter (guard against missing/NaN totalPrice)
        const minP = priceFilter[0];
        const maxP = priceFilter[1];
        filtered = filtered.filter(h => {
            const p = typeof h.totalPrice === 'number' && Number.isFinite(h.totalPrice) ? h.totalPrice : 0;
            return p >= minP && p <= maxP;
        });

        // Sort
        filtered.sort((a, b) => {
            if (sortBy === 'price') {
                const ap = typeof a.totalPrice === 'number' && Number.isFinite(a.totalPrice) ? a.totalPrice : 0;
                const bp = typeof b.totalPrice === 'number' && Number.isFinite(b.totalPrice) ? b.totalPrice : 0;
                return ap - bp;
            } else if (sortBy === 'rating') {
                const aRating = typeof a.starRating === 'number' ? a.starRating : 0;
                const bRating = typeof b.starRating === 'number' ? b.starRating : 0;
                return bRating - aRating;
            } else {
                return (a.name || '').localeCompare(b.name || '');
            }
        });

        return filtered;
    }, [results, sourceFilter, refundableFilter, priceFilter, sortBy]);

    const handleSearchFromResults = (params: HotelSearchParams) => {
        const qs = new URLSearchParams();
        qs.set('city', params.city);
        if (params.searchTerm) qs.set('searchTerm', params.searchTerm);
        if (params.nationality) qs.set('nationality', params.nationality);
        qs.set('checkIn', params.checkIn);
        qs.set('checkOut', params.checkOut);
        qs.set('rooms', JSON.stringify(params.rooms));
        if (params.starRatings.length) qs.set('stars', params.starRatings.join(','));
        navigate(`/hotels/results?${qs.toString()}`);
    };

    const handleModifySearch = () => {
        navigate('/hotels');
    };

    const handleSelectHotel = (hotel: HotelSearchResult) => {
        setSelectedHotel(hotel);
        setSelectedHotelDetails(null);
    };

    // TBO affiliate does not expose Hotel Details API (404); no details fetch – use search result data only (e.g. amenities)

    // When drawer is open, prevent body scroll
    useEffect(() => {
        if (!selectedHotel) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [selectedHotel]);

    if (!parsedParams) {
        return (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg border">
                    <p className="text-slate-600">Invalid search parameters. Please start a new search.</p>
                    <button
                        onClick={() => navigate('/hotels')}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        New Search
                    </button>
                </div>
            </div>
        );
    }

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
    };
    const formatDateLong = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr + 'T00:00:00');
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
        return `${day} ${month} ${year}, ${weekday}`;
    };

    return (
        <div className="space-y-4">
            {/* Same search bar as main hotels page – pre-filled, edit and search again without leaving */}
            <div className="space-y-3">
                <HotelSearchPanel
                    initialParams={parsedParams}
                    onSearch={handleSearchFromResults}
                />
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={handleModifySearch}
                        className="text-sm text-slate-600 hover:text-slate-900 underline"
                    >
                        ← Back to search
                    </button>
                </div>
            </div>

            {/* Header */}
            <div className="bg-[#191974] text-white p-3 rounded-lg shadow-sm">
                <h1 className="text-base font-bold">Hotels in {parsedParams.city}</h1>
            </div>

            {/* Loading State */}
            {isLoading && <HotelSearchLoader params={parsedParams} />}

            {/* Error State */}
            {!isLoading && error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                    {error}
                </div>
            )}

            {/* Results */}
            {!isLoading && !error && (
                <div className="flex gap-4">
                    {/* Filters Sidebar */}
                    <div className="w-64 bg-white border border-slate-200 rounded-lg p-4 h-fit sticky top-4">
                        <h3 className="text-sm font-semibold text-slate-800 mb-4">Filters</h3>

                        {/* Source Filter - visible only to Super Admin */}
                        {isSuperAdminUser && (
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-700 mb-2">Source</label>
                                <div className="space-y-1.5 text-xs">
                                    {['All', 'TBO', 'Amadeus'].map(source => (
                                        <label key={source} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="sourceFilter"
                                                checked={sourceFilter === source}
                                                onChange={() => setSourceFilter(source as 'All' | 'TBO' | 'Amadeus')}
                                                className="h-3.5 w-3.5"
                                            />
                                            <span>{source}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Refundable Filter */}
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-slate-700 mb-2">Refundable</label>
                            <div className="space-y-1.5 text-xs">
                                {['All', 'Refundable', 'Non-Refundable'].map(opt => (
                                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="refundableFilter"
                                            checked={refundableFilter === opt}
                                            onChange={() => setRefundableFilter(opt as 'All' | 'Refundable' | 'Non-Refundable')}
                                            className="h-3.5 w-3.5"
                                        />
                                        <span>{opt}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Price Range */}
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-slate-700 mb-2">
                                Price Range (Total)
                            </label>
                            <div className="space-y-2">
                                <input
                                    type="range"
                                    min="0"
                                    max="100000"
                                    step="1000"
                                    value={priceFilter[1]}
                                    onChange={(e) => setPriceFilter([priceFilter[0], parseInt(e.target.value)])}
                                    className="w-full"
                                />
                                <div className="flex justify-between text-xs text-slate-600">
                                    <span>₹{priceFilter[0].toLocaleString('en-IN')}</span>
                                    <span>₹{priceFilter[1].toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Sort */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-2">Sort By</label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'price' | 'rating' | 'name')}
                                className="w-full text-xs p-2 border rounded-md bg-white"
                            >
                                <option value="price">Price (Low to High)</option>
                                <option value="rating">Rating (High to Low)</option>
                                <option value="name">Name (A-Z)</option>
                            </select>
                        </div>
                    </div>

                    {/* Results List */}
                    <div className="flex-1">
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-sm text-slate-600">
                                <span className="font-semibold">{filteredAndSortedResults.length}</span> Hotel{filteredAndSortedResults.length !== 1 ? 's' : ''} Found
                            </p>
                        </div>

                        {filteredAndSortedResults.length === 0 ? (
                            <div className="bg-slate-50 border border-dashed border-slate-300 px-4 py-6 rounded-md text-sm text-slate-600 text-center">
                                No hotels found matching your filters.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {filteredAndSortedResults.map(hotel => (
                                    <HotelResultCard
                                        key={hotel.id}
                                        hotel={hotel}
                                        onSelect={handleSelectHotel}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Right-side drawer: hotel detail (75vw) - layout per screenshot */}
            {selectedHotel && parsedParams && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-40"
                        aria-hidden="true"
                        onClick={() => setSelectedHotel(null)}
                    />
                    <div
                        className="fixed top-0 right-0 bottom-0 w-[75vw] max-w-4xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
                        role="dialog"
                        aria-label="Hotel details"
                    >
                        <div className="flex items-start justify-between shrink-0 px-4 py-4 border-b border-slate-200 bg-white">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">{selectedHotel.name}</h2>
                                {typeof selectedHotel.starRating === 'number' && selectedHotel.starRating > 0 && (
                                    <span className="text-amber-500 text-sm">{'★'.repeat(selectedHotel.starRating)}</span>
                                )}
                                <p className="text-sm text-slate-600 flex items-start gap-2 mt-1">
                                    <IconLocation className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                                    {selectedHotel.address || `${selectedHotel.city}${selectedHotel.country ? `, ${selectedHotel.country}` : ''}` || '—'}
                                </p>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-700 shrink-0">
                                <div className="text-right">
                                    <p className="text-slate-500 text-xs">Check-In</p>
                                    <p className="font-medium">{parsedParams.checkIn ? formatDateLong(parsedParams.checkIn) : '—'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-500 text-xs">Check-Out</p>
                                    <p className="font-medium">{parsedParams.checkOut ? formatDateLong(parsedParams.checkOut) : '—'}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedHotel(null)}
                                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                                    aria-label="Close"
                                >
                                    <IconX className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-5">
                            {/* No image gallery in detail panel – TBO affiliate does not expose Hotel Details; images only on cards when available */}

                            {/* Facilities (from Hotel Details API when available, else search result amenities) */}
                            {((selectedHotelDetails?.facilities && selectedHotelDetails.facilities.length > 0)
                                ? selectedHotelDetails.facilities
                                : (selectedHotel.amenities || []).map((a) => typeof a === 'string' ? a : (a as { name?: string })?.name || String(a))
                            ).length > 0 && (
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 mb-2">Facilities</h3>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
                                        {((selectedHotelDetails?.facilities && selectedHotelDetails.facilities.length > 0)
                                            ? selectedHotelDetails.facilities
                                            : (selectedHotel.amenities || []).map((a) => typeof a === 'string' ? a : (a as { name?: string })?.name || String(a))
                                        ).map((name, idx) => (
                                            <span key={idx} className="flex items-center gap-1.5">
                                                <span className="text-emerald-500">✓</span>
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Rooms & Rates */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 mb-3">Rooms & Rates</h3>
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="text-left p-2 font-semibold text-slate-700">Room type</th>
                                                <th className="text-left p-2 font-semibold text-slate-700">Guests</th>
                                                <th className="text-left p-2 font-semibold text-slate-700">Price for {selectedHotel.nights} nights</th>
                                                <th className="text-left p-2 font-semibold text-slate-700">Your choices</th>
                                                <th className="text-left p-2 font-semibold text-slate-700">Rooms</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(selectedHotel.roomOptions && selectedHotel.roomOptions.length > 0
                                                ? selectedHotel.roomOptions
                                                : [{
                                                    id: 'single',
                                                    name: selectedHotel.roomName || 'Standard Room',
                                                    boardBasis: selectedHotel.mealType || 'Room Only',
                                                    refundable: selectedHotel.refundable,
                                                    pricePerNight: selectedHotel.pricePerNight,
                                                    totalPrice: selectedHotel.totalPrice,
                                                    currency: selectedHotel.currency,
                                                    occupancy: { adults: 2, children: 0 },
                                                    penalty: selectedHotel.totalPrice,
                                                }]
                                            ).map((room) => (
                                                <tr key={room.id} className="border-b border-slate-100 last:border-0">
                                                    <td className="p-2 text-slate-700">
                                                        {room.name} Board Basis:{room.boardBasis || 'Room Only'} Facilities:{room.boardBasis || 'Room Only'},
                                                    </td>
                                                    <td className="p-2">
                                                        <span className="inline-flex items-center gap-1">👤 {(room.occupancy?.adults ?? 1)}</span>
                                                    </td>
                                                    <td className="p-2 font-semibold text-[#191974]">
                                                        {room.currency} {Math.round(room.totalPrice).toLocaleString('en-IN')}
                                                    </td>
                                                    <td className="p-2 text-slate-600 text-xs">
                                                        {parsedParams.checkIn} 00:00:00 - {parsedParams.checkOut} 00:00:00
                                                        <br /> Penalty: {Math.round(room.penalty ?? room.totalPrice).toLocaleString('en-IN')}
                                                        <br />
                                                        <span className={room.refundable ? 'text-emerald-600' : 'text-red-600'}>
                                                            {room.refundable ? 'Refundable' : 'Non-refundable'}
                                                        </span>
                                                    </td>
                                                    <td className="p-2">
                                                        <span className="block">1</span>
                                                        <span className="block text-xs text-slate-600">{selectedHotel.nights} nights for {room.currency} {Math.round(room.totalPrice).toLocaleString('en-IN')}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default HotelSearchResults;
