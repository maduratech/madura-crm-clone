import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from '../contexts/RouterProvider';
import { TboFlightResult, TboFlightSegment, Lead, Customer, AmadeusFlightOffer, AmadeusApiDictionary } from '../types';
import { searchFlights, searchFlightsRaw, getFareQuote, bookFlight, ticketFlight } from '../lib/amadeus';
import { useToast } from './ToastProvider';
import { useData } from '../contexts/DataProvider';
import { useAuth } from '../contexts/AuthProvider';

// --- ICONS ---
const IconChevronDown: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);
const IconFilter: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
);
const PlaneIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0x 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
);
const IconX: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// --- HELPER COMPONENTS ---
const AirlineLogo: React.FC<{ iataCode?: string; airlineName: string }> = ({ iataCode, airlineName }) => {
    const [hasError, setHasError] = useState(false);
    if (!iataCode || hasError) {
        return (
            <div className="h-10 w-10 flex items-center justify-center bg-slate-200 rounded-full text-xs font-bold text-slate-600 ring-2 ring-white">
                {iataCode ? iataCode.slice(0, 2) : '?'}
            </div>
        );
    }
    return <img src={`https://daisycon.io/images/airline/${iataCode}.png`} alt={airlineName} title={airlineName} className="h-12 w-12 object-contain bg-white rounded-full p-1 shadow" onError={() => setHasError(true)} />;
};

export const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
};

const formatTime = (dateTime: string) => new Date(dateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
};

// --- MAIN COMPONENTS ---

const FlightSearchLoader: React.FC<{ params: any }> = ({ params }) => {
    return (
        <div className="flex items-center justify-center py-20">
            <div className="relative w-full max-w-lg bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
                <div className="text-center">
                    <p className="text-base font-semibold text-slate-700">Please Wait....</p>
                    <p className="text-xs text-slate-500 mt-1">We are looking for all available flights for</p>
                </div>

                <div className="flex justify-between items-center my-6">
                    <div className="text-center">
                        <p className="font-bold text-[#191974]">{params.segments[0]?.fromName}</p>
                        <p className="text-xs text-slate-600">({params.segments[0]?.from})</p>
                    </div>
                    <div className="relative w-32 h-1 bg-gradient-to-r from-amber-300 to-amber-500 rounded-full">
                        <PlaneIcon className="w-6 h-6 text-amber-500 absolute -top-2.5 left-1/2 -translate-x-1/2 rotate-90 animate-fly" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-[#191974]">{params.segments[0]?.toName}</p>
                        <p className="text-xs text-slate-600">({params.segments[0]?.to})</p>
                    </div>
                </div>

                <div className="text-center text-xs text-slate-600">
                    <p><span className="font-semibold">Departure:</span> {new Date(params.segments[0]?.date).toDateString()}</p>
                    <p><span className="font-semibold">Passenger:</span> {params.passengers.adults} Adult(s), {params.passengers.children} Child(ren), {params.passengers.infants} Infant(s)</p>
                </div>
            </div>
            <style>{`
                @keyframes fly {
                    0% { transform: translateX(-50%) rotate(90deg) scale(0.8); }
                    50% { transform: translateX(-50%) rotate(90deg) scale(1); }
                    100% { transform: translateX(-50%) rotate(90deg) scale(0.8); }
                }
                .animate-fly { animation: fly 2s ease-in-out infinite; }
            `}</style>
        </div>
    );
};

// WhatsApp Icon
const IconWhatsapp: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
);

// Flight card with fare families (modern style)
const FlightResultCard: React.FC<{
    result: TboFlightResult,
    onSelect: (result: TboFlightResult) => void,
    onShareWhatsApp?: (result: TboFlightResult) => void,
    isItineraryContext?: boolean,
    recommended?: boolean,
    passengerCount?: number,
    isRoundtrip?: boolean,
    showSource?: boolean,
}> = ({ result, onSelect, onShareWhatsApp, isItineraryContext = false, recommended = false, passengerCount = 1, isRoundtrip = false, showSource = false }) => {

    const outboundSegment = result.Segments[0];
    const returnSegment = result.Segments[1]; // For roundtrip flights

    if (!outboundSegment || outboundSegment.length === 0) return null;

    const outboundFirstLeg = outboundSegment[0];
    const outboundLastLeg = outboundSegment[outboundSegment.length - 1];
    const outboundDuration = outboundSegment.reduce((acc, leg) => acc + leg.Duration + leg.GroundTime, 0) - (outboundSegment.length > 1 ? outboundSegment[outboundSegment.length - 1].GroundTime : 0);
    const outboundStops = outboundSegment.length - 1;

    // For roundtrip, calculate return segment details
    let returnFirstLeg = null;
    let returnLastLeg = null;
    let returnDuration = 0;
    let returnStops = 0;
    if (isRoundtrip && returnSegment && returnSegment.length > 0) {
        returnFirstLeg = returnSegment[0];
        returnLastLeg = returnSegment[returnSegment.length - 1];
        returnDuration = returnSegment.reduce((acc, leg) => acc + leg.Duration + leg.GroundTime, 0) - (returnSegment.length > 1 ? returnSegment[returnSegment.length - 1].GroundTime : 0);
        returnStops = returnSegment.length - 1;
    }

    // TBO PublishedFare is total for all passengers - show total fare, not per-person
    const totalFare = result.Fare.PublishedFare || 0;

    const operatedBy = outboundFirstLeg.Airline?.AirlineName || 'Airline';
    const originTerminal = (outboundFirstLeg.Origin.Airport as any)?.Terminal;
    const destTerminal = (outboundLastLeg.Destination.Airport as any)?.Terminal;
    const seatsLeft = (outboundFirstLeg as any)?.NoOfSeatAvailable || (outboundFirstLeg as any)?.Availability || (result as any)?.Availability || null;
    const refundableFlag = (result as any).Fare?.IsRefundable ?? (result as any).Fare?.Refundable;

    // Render single flight (oneway) or two columns (roundtrip)
    if (isRoundtrip && returnFirstLeg) {
        // Roundtrip: Show 2 columns
        return (
            <div className="bg-white rounded-lg border border-slate-200 mb-3 shadow-sm hover:shadow-md transition-shadow">
                <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => onSelect(result)}
                >
                    {/* Header with price */}
                    <div className="p-3 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {recommended && <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Recommended</span>}
                            {showSource && result.Source && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-semibold text-slate-600 uppercase">
                                    {result.Source}
                                </span>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-500">Total Price</p>
                            <p className="text-xl font-bold text-[#191974]">₹ {Math.round(totalFare).toLocaleString('en-IN')}</p>
                        </div>
                        {onShareWhatsApp && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onShareWhatsApp(result);
                                }}
                                className="p-1.5 rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors"
                                title="Share via WhatsApp"
                            >
                                <IconWhatsapp className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Two Column Layout: Outbound | Return */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 divide-x-0 sm:divide-x divide-slate-200">
                        {/* Outbound Column */}
                        <div className="p-3 sm:p-4">
                            <div className="mb-2">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Outbound Flight</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <AirlineLogo iataCode={outboundFirstLeg.Airline.AirlineCode} airlineName={outboundFirstLeg.Airline.AirlineName} />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-center flex-1">
                                            <p className="text-lg font-bold text-slate-900">{formatTime(outboundFirstLeg.Origin.DepTime)}</p>
                                            <p className="text-[10px] text-slate-600">{outboundFirstLeg.Origin.Airport.AirportCode}</p>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center">
                                            <p className="text-xs text-slate-600">{formatDuration(outboundDuration)}</p>
                                            <p className="text-[10px] text-slate-500">{outboundStops === 0 ? 'Non-stop' : `${outboundStops} Stop${outboundStops > 1 ? 's' : ''}`}</p>
                                        </div>
                                        <div className="text-center flex-1">
                                            <p className="text-lg font-bold text-slate-900">{formatTime(outboundLastLeg.Destination.ArrTime)}</p>
                                            <p className="text-[10px] text-slate-600">{outboundLastLeg.Destination.Airport.AirportCode}</p>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-600 flex items-center gap-2">
                                        <span>{outboundFirstLeg.Airline.AirlineCode} {outboundFirstLeg.Airline.FlightNumber}</span>
                                        {originTerminal && <span>Dep T{originTerminal}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Return Column */}
                        <div className="p-3 sm:p-4 border-t sm:border-t-0 border-slate-200">
                            <div className="mb-2">
                                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Return Flight</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <AirlineLogo iataCode={returnFirstLeg.Airline.AirlineCode} airlineName={returnFirstLeg.Airline.AirlineName} />
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-center flex-1">
                                            <p className="text-lg font-bold text-slate-900">{formatTime(returnFirstLeg.Origin.DepTime)}</p>
                                            <p className="text-[10px] text-slate-600">{returnFirstLeg.Origin.Airport.AirportCode}</p>
                                        </div>
                                        <div className="flex-1 flex flex-col items-center">
                                            <p className="text-xs text-slate-600">{formatDuration(returnDuration)}</p>
                                            <p className="text-[10px] text-slate-500">{returnStops === 0 ? 'Non-stop' : `${returnStops} Stop${returnStops > 1 ? 's' : ''}`}</p>
                                        </div>
                                        <div className="text-center flex-1">
                                            <p className="text-lg font-bold text-slate-900">{formatTime(returnLastLeg.Destination.ArrTime)}</p>
                                            <p className="text-[10px] text-slate-600">{returnLastLeg.Destination.Airport.AirportCode}</p>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-600 flex items-center gap-2">
                                        <span>{returnFirstLeg.Airline.AirlineCode} {returnFirstLeg.Airline.FlightNumber}</span>
                                        {(returnFirstLeg.Origin.Airport as any)?.Terminal && <span>Dep T{(returnFirstLeg.Origin.Airport as any).Terminal}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 border-t border-slate-200 text-[11px] text-slate-600 flex flex-wrap gap-3 bg-slate-50">
                        {seatsLeft && <span className="text-red-600 font-semibold">{seatsLeft} seats left</span>}
                        <span>{refundableFlag === undefined ? 'Fare info pending' : refundableFlag ? 'Refundable' : 'Non-refundable'}</span>
                    </div>
                </button>
            </div>
        );
    }

    // Oneway: mobile = row1 airline+price, row2 route; desktop = single row
    return (
        <div className="bg-white rounded-lg border border-slate-200 mb-3 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    {/* 1. Airline + code + recommended — mobile: first; desktop: first */}
                    <div className="order-1 flex items-center gap-2 min-w-0 shrink-0">
                        <AirlineLogo iataCode={outboundFirstLeg.Airline.AirlineCode} airlineName={outboundFirstLeg.Airline.AirlineName} />
                        <span className="text-sm sm:text-xs font-medium text-slate-800 truncate">
                            {outboundFirstLeg.Airline.AirlineCode} {outboundFirstLeg.Airline.FlightNumber}
                        </span>
                        {recommended && <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">Recommended</span>}
                    </div>
                    {/* 2. Price + WhatsApp — mobile: second (same row as airline via order); desktop: last */}
                    <div className="order-2 sm:order-3 flex items-center justify-end gap-2 shrink-0">
                        <div className="text-right">
                            <p className="hidden sm:block text-[10px] text-slate-500">
                                <span className="mr-1">Starts at</span>
                                {showSource && result.Source && (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-semibold text-slate-600 uppercase">{result.Source}</span>
                                )}
                            </p>
                            <p className="text-base sm:text-lg font-bold text-[#191974] leading-tight">₹ {Math.round(totalFare).toLocaleString('en-IN')}</p>
                        </div>
                        {onShareWhatsApp && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onShareWhatsApp(result); }}
                                className="p-2 rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors touch-manipulation shrink-0"
                                aria-label="Share via WhatsApp"
                            >
                                <IconWhatsapp className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                            </button>
                        )}
                    </div>
                    {/* 3. Dep · duration · arr — mobile: third (row 2); desktop: middle */}
                    <button
                        type="button"
                        className="order-3 sm:order-2 flex items-center justify-between gap-2 flex-1 min-w-0 text-left sm:justify-between"
                        onClick={() => onSelect(result)}
                    >
                        <div className="text-center flex-1 min-w-0">
                            <p className="text-base sm:text-lg font-bold text-slate-900">{formatTime(outboundFirstLeg.Origin.DepTime)}</p>
                            <p className="text-[10px] text-slate-600">{outboundFirstLeg.Origin.Airport.AirportCode}</p>
                        </div>
                        <div className="flex flex-col items-center flex-1 sm:min-w-[60px] px-1">
                            <p className="text-xs text-slate-600">{formatDuration(outboundDuration)}</p>
                            <p className="text-[10px] text-slate-500">{outboundStops === 0 ? 'Non-stop' : `${outboundStops} Stop${outboundStops > 1 ? 's' : ''}`}</p>
                        </div>
                        <div className="text-center flex-1 min-w-0">
                            <p className="text-base sm:text-lg font-bold text-slate-900">{formatTime(outboundLastLeg.Destination.ArrTime)}</p>
                            <p className="text-[10px] text-slate-600">{outboundLastLeg.Destination.Airport.AirportCode}</p>
                        </div>
                    </button>
                </div>
            </div>
            {/* Footer meta */}
            <div className="px-3 pb-3 sm:pb-2 text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 bg-slate-50/50 sm:bg-transparent">
                <span className="truncate">Airline: {operatedBy}</span>
                {originTerminal && <span>Dep T{originTerminal}</span>}
                {destTerminal && <span>Arr T{destTerminal}</span>}
                {seatsLeft && <span className="text-red-600 font-semibold">{seatsLeft} seats left</span>}
                <span>{refundableFlag === undefined ? 'Fare info pending' : refundableFlag ? 'Refundable' : 'Non-refundable'}</span>
            </div>
        </div>
    );
};

// WhatsApp Share Modal
const WhatsAppShareModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    flight: TboFlightResult | null;
    leads: Lead[];
    customers: Customer[];
    onShare: (phone: string, message: string) => void;
}> = ({ isOpen, onClose, flight, leads, customers, onShare }) => {
    const [selectedType, setSelectedType] = useState<'lead' | 'customer'>('lead');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen || !flight) return null;

    const segment = flight.Segments[0]?.[0];
    if (!segment) return null;

    const filteredLeads = leads.filter(l =>
        `${l.id} ${l.destination || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);

    const filteredCustomers = customers.filter(c =>
        `${c.first_name} ${c.last_name} ${c.phone || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);

    const formatFlightMessage = () => {
        const from = segment.Origin.Airport.AirportCode;
        const to = segment.Destination.Airport.AirportCode;
        const depTime = formatTime(segment.Origin.DepTime);
        const arrTime = formatTime(segment.Destination.ArrTime);
        const price = flight.Fare.PublishedFare;
        const airline = segment.Airline.AirlineName;

        return `✈️ *Flight Details*\n\n*${airline}*\n${from} → ${to}\n\nDeparture: ${depTime}\nArrival: ${arrTime}\nPrice: ₹${price.toLocaleString('en-IN')}\n\nPlease let me know if you'd like to proceed with this flight.\n\nWith Madura Travel Service..`;
    };

    const handleShare = () => {
        if (!selectedId) {
            return;
        }

        let phone = '';
        if (selectedType === 'lead') {
            const lead = leads.find(l => l.id === selectedId);
            const customer = customers.find(c => c.id === lead?.customer_id);
            phone = customer?.phone || '';
        } else {
            const customer = customers.find(c => c.id === selectedId);
            phone = customer?.phone || '';
        }

        if (!phone) {
            return;
        }

        const message = formatFlightMessage();
        onShare(phone, message);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Share Flight via WhatsApp</h3>

                <div className="mb-4">
                    <div className="flex gap-2 mb-3">
                        <button
                            onClick={() => { setSelectedType('lead'); setSelectedId(null); }}
                            className={`px-4 py-2 rounded-md text-sm font-medium ${selectedType === 'lead' ? 'bg-[#191974] text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                            Lead
                        </button>
                        <button
                            onClick={() => { setSelectedType('customer'); setSelectedId(null); }}
                            className={`px-4 py-2 rounded-md text-sm font-medium ${selectedType === 'customer' ? 'bg-[#191974] text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                            Customer
                        </button>
                    </div>

                    <input
                        type="text"
                        placeholder={`Search ${selectedType}...`}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />

                    <div className="mt-2 max-h-60 overflow-y-auto border border-slate-200 rounded-md">
                        {(selectedType === 'lead' ? filteredLeads : filteredCustomers).map(item => (
                            <button
                                key={selectedType === 'lead' ? (item as Lead).id : (item as Customer).id}
                                onClick={() => setSelectedId(selectedType === 'lead' ? (item as Lead).id : (item as Customer).id)}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${selectedId === (selectedType === 'lead' ? (item as Lead).id : (item as Customer).id) ? 'bg-[#191974] text-white' : ''
                                    }`}
                            >
                                {selectedType === 'lead'
                                    ? `Lead #${(item as Lead).id} - ${(item as Lead).destination || 'N/A'}`
                                    : `${(item as Customer).first_name} ${(item as Customer).last_name} - ${(item as Customer).phone || 'N/A'}`
                                }
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50">
                        Cancel
                    </button>
                    <button
                        onClick={handleShare}
                        disabled={!selectedId}
                        className="px-4 py-2 text-sm rounded-md bg-[#191974] text-white hover:bg-[#13135c] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Share
                    </button>
                </div>
            </div>
        </div>
    );
};

const FlightSearchResults: React.FC = () => {
    const [rawResults, setRawResults] = useState<TboFlightResult[]>([]);
    const [amadeusOffers, setAmadeusOffers] = useState<AmadeusFlightOffer[]>([]);
    const [amadeusDictionaries, setAmadeusDictionaries] = useState<AmadeusApiDictionary>({ carriers: {}, locations: {} });
    const [traceId, setTraceId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { addToast } = useToast();
    const { search, navigate } = useRouter();
    const [searchParams, setSearchParams] = useState<any>(null);
    const { leads, customers } = useData();
    const { profile: currentUser } = useAuth();
    const showSource = currentUser?.role === 'Super Admin';

    const [filters, setFilters] = useState<any>({ flightNumber: '', refundable: 'any' });
    const [sortBy, setSortBy] = useState('price');
    const [whatsappShareModal, setWhatsappShareModal] = useState<{ isOpen: boolean; flight: TboFlightResult | null }>({ isOpen: false, flight: null });
    const [selectedFlightDrawer, setSelectedFlightDrawer] = useState<TboFlightResult | null>(null);
    const [selectedFareId, setSelectedFareId] = useState<string>('saver');
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

    // Check if from itinerary context and get itinerary metadata
    const isItineraryContext = useMemo(() => {
        const query = new URLSearchParams(search);
        const fromItinerary = query.get('fromItinerary') === 'true';
        if (fromItinerary) {
            // Try to get itinerary metadata from URL params or sessionStorage
            const itineraryId = query.get('itineraryId') || sessionStorage.getItem('currentItineraryId');
            const direction = query.get('direction') as 'onward' | 'intercity' | 'return' | null;

            if (itineraryId) {
                sessionStorage.setItem('pendingFlightItineraryMeta', JSON.stringify({
                    itineraryId: parseInt(itineraryId, 10),
                    direction: direction || 'onward'
                }));
            }
        }
        return fromItinerary;
    }, [search]);

    // Parse search params from URL
    useEffect(() => {
        const query = new URLSearchParams(search);
        const params: any = {
            tripType: query.get('tripType'),
            returnDate: query.get('returnDate') || null,
            passengers: {
                adults: parseInt(query.get('adults') || '1'),
                children: parseInt(query.get('children') || '0'),
                infants: parseInt(query.get('infants') || '0'),
            },
            cabin: query.get('cabin'),
            directFlights: query.get('direct') === 'true',
            preferredAirlines: query.get('airlines'),
            segments: []
        };
        for (let i = 0; i < 5; i++) {
            if (query.has(`s${i}_from`)) {
                params.segments.push({
                    from: query.get(`s${i}_from`),
                    to: query.get(`s${i}_to`),
                    date: query.get(`s${i}_date`),
                    fromName: query.get(`s${i}_fromName`),
                    toName: query.get(`s${i}_toName`),
                });
            } else {
                break;
            }
        }
        setSearchParams(params);
    }, [search]);

    // Fetch flights when params are ready
    useEffect(() => {
        if (!searchParams) return;

        const performSearch = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // Get both TboFlightResult (for display) and original Amadeus offers (for itinerary)
                const { results, traceId } = await searchFlights(searchParams);
                const { offers, dictionaries } = await searchFlightsRaw(searchParams);

                setRawResults(results);
                setAmadeusOffers(offers);
                setAmadeusDictionaries(dictionaries);
                setTraceId(traceId);
                if (results.length === 0) {
                    addToast('No flights found for your criteria.', 'success');
                }
            } catch (err: any) {
                setError(err.message);
                addToast(`Flight search failed: ${err.message}`, 'error');
            } finally {
                setIsLoading(false);
            }
        };

        performSearch();
    }, [searchParams, addToast]);

    const filteredAndSortedResults = useMemo(() => {
        let results = [...rawResults];

        // Apply filters
        if (filters.flightNumber?.trim()) {
            const q = filters.flightNumber.trim().toLowerCase();
            results = results.filter(r => {
                const fn = r.Segments?.[0]?.[0]?.Airline?.FlightNumber || '';
                return fn.toLowerCase().includes(q);
            });
        }
        if (filters.maxPrice) {
            results = results.filter(r => r.Fare.PublishedFare <= filters.maxPrice);
        }
        if (filters.airlines?.length > 0) {
            results = results.filter(r => filters.airlines.includes(r.Segments[0]?.[0]?.Airline.AirlineCode));
        }
        if (filters.refundable && filters.refundable !== 'any') {
            results = results.filter(r => {
                const refundableFlag = (r as any).Fare?.IsRefundable ?? (r as any).Fare?.Refundable;
                if (refundableFlag === undefined || refundableFlag === null) return true;
                return filters.refundable === 'ref' ? Boolean(refundableFlag) : !Boolean(refundableFlag);
            });
        }
        if (filters.stops?.length > 0) {
            const stopCounts = filters.stops;
            results = results.filter(r => {
                const stops = (r.Segments[0]?.length || 1) - 1;
                return stopCounts.includes(stops);
            });
        }
        if (filters.times?.length > 0) {
            results = results.filter(r => {
                const hour = new Date(r.Segments[0][0].Origin.DepTime).getHours();
                return filters.times.some((t: string) => {
                    if (t === 'morning') return hour >= 4 && hour < 11;
                    if (t === 'afternoon') return hour >= 11 && hour < 16;
                    if (t === 'evening') return hour >= 16 && hour < 21;
                    if (t === 'night') return hour >= 21 || hour < 4;
                    return false;
                });
            });
        }

        // Apply sorting
        if (sortBy === 'price') {
            results.sort((a, b) => a.Fare.PublishedFare - b.Fare.PublishedFare);
        } else if (sortBy === 'duration') {
            const getDuration = (res: TboFlightResult) => res.Segments[0]?.reduce((acc, leg) => acc + leg.Duration, 0) || 0;
            results.sort((a, b) => getDuration(a) - getDuration(b));
        } else if (sortBy === 'departure') {
            results.sort((a, b) => new Date(a.Segments[0][0].Origin.DepTime).getTime() - new Date(b.Segments[0][0].Origin.DepTime).getTime());
        }

        return results;
    }, [rawResults, filters, sortBy]);

    // Generate date options (today + next 6 days)
    const dateOptions = useMemo(() => {
        const dates = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            dates.push({
                date: date.toISOString().split('T')[0],
                label: i === 0 ? 'Today' : formatDate(date.toISOString().split('T')[0]).split(',')[1].trim(),
                fullLabel: formatDate(date.toISOString().split('T')[0])
            });
        }
        return dates;
    }, []);

    // Get unique airlines for filter
    const airlines = useMemo(() => {
        const airlineMap = new Map<string, { name: string; count: number }>();
        rawResults.forEach(res => {
            const code = res.Segments[0]?.[0]?.Airline.AirlineCode;
            const name = res.Segments[0]?.[0]?.Airline.AirlineName;
            if (code && name) {
                if (airlineMap.has(code)) {
                    airlineMap.get(code)!.count++;
                } else {
                    airlineMap.set(code, { name, count: 1 });
                }
            }
        });
        return Array.from(airlineMap.entries()).map(([code, data]) => ({ code, ...data }));
    }, [rawResults]);

    const handleSelect = (result: TboFlightResult) => {
        setSelectedFlightDrawer(result);
        setSelectedFareId('saver'); // Reset to default fare when opening drawer
    };

    const handleShareWhatsApp = (result: TboFlightResult) => {
        setWhatsappShareModal({ isOpen: true, flight: result });
    };

    const handleWhatsAppShare = async (phone: string, message: string) => {
        try {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
            // Format phone number (ensure it starts with +)
            const cleanPhone = phone.replace(/[^0-9+]/g, '');
            const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

            // Use the CRM WhatsApp API
            const response = await fetch(`${API_BASE_URL}/api/whatsapp/send-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: formattedPhone, text: message })
            });

            const data = await response.json();

            if (response.ok) {
                addToast('Flight details shared via WhatsApp!', 'success');
            } else {
                throw new Error(data.message || 'Failed to send WhatsApp message');
            }
        } catch (err: any) {
            addToast(`Failed to share: ${err.message}`, 'error');
        }
    };

    if (isLoading || !searchParams) {
        return <FlightSearchLoader params={searchParams || { segments: [{}], passengers: {} }} />;
    }

    if (error) {
        return (
            <div className="p-3 sm:p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-[calc(100vw-2rem)]">
                    <h3 className="text-base sm:text-lg font-semibold text-red-800 mb-2">Search Error</h3>
                    <p className="text-sm text-red-700 break-words">{error}</p>
                    <button
                        onClick={() => navigate('/flights')}
                        className="mt-4 px-4 py-2 bg-[#191974] text-white rounded-md hover:bg-[#13135c] min-h-[44px] sm:min-h-0 touch-manipulation"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const firstSegment = searchParams.segments[0];
    const fromCity = firstSegment?.fromName || firstSegment?.from || 'Origin';
    const toCity = firstSegment?.toName || firstSegment?.to || 'Destination';
    const departureDate = firstSegment?.date;
    const returnDate = searchParams.returnDate || null;
    const isRoundtrip = searchParams.tripType === 'roundtrip';
    const passengerCount =
        (searchParams.passengers?.adults || 0) +
        (searchParams.passengers?.children || 0) +
        (searchParams.passengers?.infants || 0);

    return (
        <div className="space-y-3 sm:space-y-4 p-3 sm:p-0">
            {/* Compact search summary + modify bar */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 sm:gap-4 shadow-sm">
                <div className="flex flex-wrap gap-3 sm:gap-6 items-center text-sm min-w-0">
                    <div className="min-w-0">
                        <p className="text-xs text-slate-500">From</p>
                        <p className="font-semibold text-slate-900 truncate">{fromCity}</p>
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-slate-500">To</p>
                        <p className="font-semibold text-slate-900 truncate">{toCity}</p>
                    </div>
                    <div>
                        <p className="text-xs text-slate-500">Departure</p>
                        <p className="font-semibold text-slate-900 text-xs sm:text-base">
                            {departureDate ? formatDate(departureDate) : 'Select date'}
                        </p>
                    </div>
                    {isRoundtrip && returnDate && (
                        <div>
                            <p className="text-xs text-slate-500">Return</p>
                            <p className="font-semibold text-slate-900 text-xs sm:text-base">
                                {formatDate(returnDate)}
                            </p>
                        </div>
                    )}
                    <div>
                        <p className="text-xs text-slate-500">Travellers</p>
                        <p className="font-semibold text-slate-900">{passengerCount} Passenger(s)</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => navigate('/flights')}
                        className="px-3 sm:px-4 py-2 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 min-h-[44px] sm:min-h-0 touch-manipulation"
                    >
                        ← Back
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/flights')}
                        className="px-4 sm:px-5 py-2 text-sm font-semibold rounded-md bg-[#191974] text-white hover:bg-[#13135c] min-h-[44px] sm:min-h-0 touch-manipulation"
                    >
                        Modify Search
                    </button>
                </div>
            </div>

            {/* Header */}
            <div className="bg-[#191974] text-white p-3 rounded-lg shadow-sm">
                <h1 className="text-sm sm:text-base font-bold truncate">
                    {isRoundtrip ? (
                        <>Roundtrip: {fromCity} ↔ {toCity}</>
                    ) : (
                        <>Flights from {fromCity} to {toCity}</>
                    )}
                </h1>
            </div>

            {/* Date Selection Bar */}
            <div className="bg-white border border-slate-200 rounded-lg p-2 sm:p-3 overflow-x-auto -mx-3 sm:mx-0">
                <div className="flex gap-2 min-w-max">
                    {dateOptions.map((opt, idx) => (
                        <button
                            key={opt.date}
                            onClick={() => {
                                // Update search with new date
                                const newParams = { ...searchParams };
                                newParams.segments[0].date = opt.date;
                                const query = new URLSearchParams();
                                query.set('tripType', newParams.tripType);
                                query.set(`s0_from`, newParams.segments[0].from);
                                query.set(`s0_to`, newParams.segments[0].to);
                                query.set(`s0_date`, opt.date);
                                query.set(`s0_fromName`, newParams.segments[0].fromName);
                                query.set(`s0_toName`, newParams.segments[0].toName);
                                query.set('adults', newParams.passengers.adults.toString());
                                query.set('children', newParams.passengers.children.toString());
                                query.set('infants', newParams.passengers.infants.toString());
                                query.set('cabin', newParams.cabin);
                                navigate(`/flights/results?${query.toString()}`);
                            }}
                            className={`px-4 py-2 rounded-md whitespace-nowrap text-xs ${opt.date === firstSegment?.date
                                ? 'bg-[#191974] text-white font-semibold'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content with Filters on Left (desktop) / Filter icon + drawer (mobile) */}
            <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
                {/* Left Sidebar - Filters (desktop only) */}
                <div className="hidden lg:block w-64 bg-white border border-slate-200 rounded-lg p-4 h-fit sticky top-4 shrink-0">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4">Filters</h3>

                    {/* Flight Number */}
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-slate-700 mb-2">Flight Number</label>
                        <input
                            type="text"
                            value={filters.flightNumber}
                            onChange={e => setFilters({ ...filters, flightNumber: e.target.value })}
                            placeholder="e.g. AI-123"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                        />
                    </div>

                    {/* Sort */}
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-slate-700 mb-2">Sort By</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs"
                        >
                            <option value="price">Price (Low to High)</option>
                            <option value="duration">Duration (Shortest)</option>
                            <option value="departure">Departure (Early)</option>
                        </select>
                    </div>

                    {/* Fare Type */}
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-slate-700 mb-2">Fare Type</label>
                        <div className="space-y-1.5 text-xs">
                            {[
                                { key: 'any', label: 'Any' },
                                { key: 'ref', label: 'Refundable' },
                                { key: 'nonref', label: 'Non-refundable' },
                            ].map(opt => (
                                <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="refundableFilter"
                                        checked={filters.refundable === opt.key}
                                        onChange={() => setFilters({ ...filters, refundable: opt.key })}
                                        className="h-3.5 w-3.5"
                                    />
                                    <span>{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Stops */}
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-slate-700 mb-2">Stops</label>
                        <div className="space-y-1.5">
                            {[0, 1, 2].map(stop => (
                                <label key={stop} className="flex items-center gap-2 cursor-pointer text-xs">
                                    <input
                                        type="checkbox"
                                        checked={filters.stops?.includes(stop) || false}
                                        onChange={() => {
                                            const currentStops = filters.stops || [];
                                            const newStops = currentStops.includes(stop)
                                                ? currentStops.filter((s: number) => s !== stop)
                                                : [...currentStops, stop];
                                            setFilters({ ...filters, stops: newStops.length > 0 ? newStops : undefined });
                                        }}
                                        className="h-3.5 w-3.5 rounded"
                                    />
                                    <span>{stop === 0 ? 'Non Stop' : `${stop} Stop${stop > 1 ? 's' : ''}`}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Airlines */}
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-slate-700 mb-2">Airlines</label>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {airlines.map(airline => (
                                <label key={airline.code} className="flex items-center gap-2 cursor-pointer text-xs">
                                    <input
                                        type="checkbox"
                                        checked={filters.airlines?.includes(airline.code) || false}
                                        onChange={() => {
                                            const current = filters.airlines || [];
                                            const newAirlines = current.includes(airline.code)
                                                ? current.filter((c: string) => c !== airline.code)
                                                : [...current, airline.code];
                                            setFilters({ ...filters, airlines: newAirlines.length > 0 ? newAirlines : undefined });
                                        }}
                                        className="h-3.5 w-3.5 rounded"
                                    />
                                    <span className="flex-1">{airline.name}</span>
                                    <span className="text-[10px] text-slate-500">({airline.count})</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Departure Time */}
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-slate-700 mb-2">Departure Time</label>
                        <div className="space-y-1.5">
                            {[
                                { label: 'Early Morning', value: 'morning', range: '12 AM - 6 AM' },
                                { label: 'Morning', value: 'morning', range: '6 AM - 12 PM' },
                                { label: 'Afternoon', value: 'afternoon', range: '12 PM - 6 PM' },
                                { label: 'Evening', value: 'evening', range: '6 PM - 12 AM' },
                            ].map(time => (
                                <label key={time.value} className="flex items-center gap-2 cursor-pointer text-xs">
                                    <input
                                        type="checkbox"
                                        checked={filters.times?.includes(time.value) || false}
                                        onChange={() => {
                                            const current = filters.times || [];
                                            const newTimes = current.includes(time.value)
                                                ? current.filter((t: string) => t !== time.value)
                                                : [...current, time.value];
                                            setFilters({ ...filters, times: newTimes.length > 0 ? newTimes : undefined });
                                        }}
                                        className="h-3.5 w-3.5 rounded"
                                    />
                                    <span>{time.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Price Range */}
                    {rawResults.length > 0 && (
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-slate-700 mb-2">Price Range</label>
                            <input
                                type="range"
                                min={Math.min(...rawResults.map(r => r.Fare.PublishedFare))}
                                max={Math.max(...rawResults.map(r => r.Fare.PublishedFare))}
                                value={filters.maxPrice || Math.max(...rawResults.map(r => r.Fare.PublishedFare))}
                                onChange={(e) => setFilters({ ...filters, maxPrice: parseInt(e.target.value) })}
                                className="w-full"
                            />
                            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                <span>₹ {Math.min(...rawResults.map(r => r.Fare.PublishedFare)).toLocaleString()}</span>
                                <span>₹ {(filters.maxPrice || Math.max(...rawResults.map(r => r.Fare.PublishedFare))).toLocaleString()}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side - Flight Results */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-sm font-semibold text-slate-700">
                            {filteredAndSortedResults.length} Flights Found
                        </span>
                        {/* Mobile: filter icon opens right drawer */}
                        <button
                            type="button"
                            onClick={() => setFilterDrawerOpen(true)}
                            className="lg:hidden flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 touch-manipulation min-h-[44px]"
                            aria-label="Open filters"
                        >
                            <IconFilter className="w-5 h-5" />
                            <span className="text-sm font-medium">Filters</span>
                        </button>
                    </div>

                    {filteredAndSortedResults.length === 0 ? (
                        <div className="text-center p-10 bg-white rounded-lg border border-slate-200">
                            <h3 className="text-base font-semibold mb-2">No Flights Found</h3>
                            <p className="text-xs text-slate-500">Try adjusting your filters or search criteria.</p>
                        </div>
                    ) : (
                        filteredAndSortedResults.map((result, idx) => {
                            const totalPassengers =
                                (searchParams.passengers?.adults || 0) +
                                (searchParams.passengers?.children || 0) +
                                (searchParams.passengers?.infants || 0);
                            const isRoundtrip = searchParams.tripType === 'roundtrip';
                            return (
                                <FlightResultCard
                                    key={result.ResultIndex}
                                    result={result}
                                    onSelect={handleSelect}
                                    onShareWhatsApp={handleShareWhatsApp}
                                    isItineraryContext={isItineraryContext}
                                    recommended={idx === 0}
                                    passengerCount={totalPassengers || 1}
                                    isRoundtrip={isRoundtrip}
                                    showSource={showSource}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            {/* Mobile: Filter drawer (opens from right) */}
            {filterDrawerOpen && (
                <>
                    <div
                        className="lg:hidden fixed inset-0 bg-black/40 z-[60]"
                        onClick={() => setFilterDrawerOpen(false)}
                        aria-hidden
                    />
                    <div
                        className="lg:hidden fixed top-0 right-0 bottom-0 w-full max-w-[320px] bg-white shadow-2xl z-[61] flex flex-col overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
                            <h3 className="text-lg font-semibold text-slate-800">Filters</h3>
                            <button
                                type="button"
                                onClick={() => setFilterDrawerOpen(false)}
                                className="p-2 rounded-full hover:bg-slate-100 touch-manipulation"
                                aria-label="Close filters"
                            >
                                <IconX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            {/* Flight Number */}
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-700 mb-2">Flight Number</label>
                                <input
                                    type="text"
                                    value={filters.flightNumber}
                                    onChange={e => setFilters({ ...filters, flightNumber: e.target.value })}
                                    placeholder="e.g. AI-123"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-700 mb-2">Sort By</label>
                                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs">
                                    <option value="price">Price (Low to High)</option>
                                    <option value="duration">Duration (Shortest)</option>
                                    <option value="departure">Departure (Early)</option>
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-700 mb-2">Fare Type</label>
                                <div className="space-y-1.5 text-xs">
                                    {[{ key: 'any', label: 'Any' }, { key: 'ref', label: 'Refundable' }, { key: 'nonref', label: 'Non-refundable' }].map(opt => (
                                        <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="refundableFilterDrawer" checked={filters.refundable === opt.key} onChange={() => setFilters({ ...filters, refundable: opt.key })} className="h-3.5 w-3.5" />
                                            <span>{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-700 mb-2">Stops</label>
                                <div className="space-y-1.5">
                                    {[0, 1, 2].map(stop => (
                                        <label key={stop} className="flex items-center gap-2 cursor-pointer text-xs">
                                            <input
                                                type="checkbox"
                                                checked={filters.stops?.includes(stop) || false}
                                                onChange={() => {
                                                    const currentStops = filters.stops || [];
                                                    const newStops = currentStops.includes(stop) ? currentStops.filter((s: number) => s !== stop) : [...currentStops, stop];
                                                    setFilters({ ...filters, stops: newStops.length > 0 ? newStops : undefined });
                                                }}
                                                className="h-3.5 w-3.5 rounded"
                                            />
                                            <span>{stop === 0 ? 'Non Stop' : `${stop} Stop${stop > 1 ? 's' : ''}`}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-700 mb-2">Airlines</label>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {airlines.map(airline => (
                                        <label key={airline.code} className="flex items-center gap-2 cursor-pointer text-xs">
                                            <input
                                                type="checkbox"
                                                checked={filters.airlines?.includes(airline.code) || false}
                                                onChange={() => {
                                                    const current = filters.airlines || [];
                                                    const newAirlines = current.includes(airline.code) ? current.filter((c: string) => c !== airline.code) : [...current, airline.code];
                                                    setFilters({ ...filters, airlines: newAirlines.length > 0 ? newAirlines : undefined });
                                                }}
                                                className="h-3.5 w-3.5 rounded"
                                            />
                                            <span className="flex-1">{airline.name}</span>
                                            <span className="text-[10px] text-slate-500">({airline.count})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-700 mb-2">Departure Time</label>
                                <div className="space-y-1.5">
                                    {[{ label: 'Early Morning', value: 'morning' }, { label: 'Morning', value: 'morning' }, { label: 'Afternoon', value: 'afternoon' }, { label: 'Evening', value: 'evening' }].map((time, i) => (
                                        <label key={`${time.value}-${i}`} className="flex items-center gap-2 cursor-pointer text-xs">
                                            <input
                                                type="checkbox"
                                                checked={filters.times?.includes(time.value) || false}
                                                onChange={() => {
                                                    const current = filters.times || [];
                                                    const newTimes = current.includes(time.value) ? current.filter((t: string) => t !== time.value) : [...current, time.value];
                                                    setFilters({ ...filters, times: newTimes.length > 0 ? newTimes : undefined });
                                                }}
                                                className="h-3.5 w-3.5 rounded"
                                            />
                                            <span>{time.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            {rawResults.length > 0 && (
                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-slate-700 mb-2">Price Range</label>
                                    <input
                                        type="range"
                                        min={Math.min(...rawResults.map(r => r.Fare.PublishedFare))}
                                        max={Math.max(...rawResults.map(r => r.Fare.PublishedFare))}
                                        value={filters.maxPrice || Math.max(...rawResults.map(r => r.Fare.PublishedFare))}
                                        onChange={(e) => setFilters({ ...filters, maxPrice: parseInt(e.target.value) })}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                                        <span>₹ {Math.min(...rawResults.map(r => r.Fare.PublishedFare)).toLocaleString()}</span>
                                        <span>₹ {(filters.maxPrice || Math.max(...rawResults.map(r => r.Fare.PublishedFare))).toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => setFilterDrawerOpen(false)}
                                className="w-full py-3 mt-4 text-sm font-semibold text-white bg-[#191974] rounded-lg hover:bg-[#13135c] touch-manipulation"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* WhatsApp Share Modal */}
            <WhatsAppShareModal
                isOpen={whatsappShareModal.isOpen}
                onClose={() => setWhatsappShareModal({ isOpen: false, flight: null })}
                flight={whatsappShareModal.flight}
                leads={leads}
                customers={customers}
                onShare={handleWhatsAppShare}
            />

            {/* Right Drawer for flight details */}
            {selectedFlightDrawer && (() => {
                const seg = selectedFlightDrawer.Segments?.[0];
                if (!seg || seg.length === 0) return null;
                const first = seg[0];
                const last = seg[seg.length - 1];
                const totalDuration = seg.reduce((acc, leg) => acc + leg.Duration + leg.GroundTime, 0) - (seg.length > 1 ? seg[seg.length - 1].GroundTime : 0);
                const stops = seg.length - 1;
                // TBO PublishedFare is total for all passengers - use total fare for all calculations
                const totalFare = selectedFlightDrawer.Fare.PublishedFare || 0;
                const operatedBy = first.Airline?.AirlineName || 'Airline';
                const originTerminal = (first.Origin.Airport as any)?.Terminal;
                const destTerminal = (last.Destination.Airport as any)?.Terminal;
                const seatsLeft = (first as any)?.NoOfSeatAvailable || (first as any)?.Availability || (selectedFlightDrawer as any)?.Availability || null;
                const refundableFlag = (selectedFlightDrawer as any).Fare?.IsRefundable ?? (selectedFlightDrawer as any).Fare?.Refundable;

                // Fare options with details - all prices are total for all passengers
                const fareOptions = [
                    {
                        id: 'saver',
                        name: 'Saver',
                        price: totalFare,
                        baggage: { cabin: '7 kg', checkin: '15 kg' },
                        meals: 'Not included',
                        seat: 'Standard',
                        change: 'Change up to ₹2999',
                        cancel: 'Cancel up to ₹4999'
                    },
                    {
                        id: 'flexi',
                        name: 'Flexi Plus',
                        price: Math.round(totalFare * 1.07),
                        baggage: { cabin: '7 kg', checkin: '15 kg' },
                        meals: 'Available on purchase',
                        seat: 'Standard',
                        change: 'Change up to ₹999',
                        cancel: 'Cancel up to ₹3499'
                    },
                    {
                        id: 'premium',
                        name: 'Premium',
                        price: Math.round(totalFare * 1.12),
                        baggage: { cabin: '7 kg', checkin: '20 kg' },
                        meals: 'Complimentary',
                        seat: 'XL seat',
                        change: 'Change up to ₹249',
                        cancel: 'Cancel up to ₹1499'
                    },
                ];

                const selectedFareDetails = fareOptions.find(f => f.id === selectedFareId) || fareOptions[0];

                return (
                    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={() => setSelectedFlightDrawer(null)}>
                        <div
                            className="w-full max-w-md h-full bg-white shadow-2xl border-l border-slate-200 overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-4 border-b flex items-center justify-between">
                                <div className="text-sm font-semibold text-slate-800">Flight details</div>
                                <button onClick={() => setSelectedFlightDrawer(null)} className="p-1 rounded-md hover:bg-slate-100">
                                    <IconX className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Flight Basic Info */}
                                <div className="border rounded-lg p-4 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <AirlineLogo iataCode={first.Airline.AirlineCode} airlineName={operatedBy} />
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">{operatedBy}</p>
                                                <p className="text-xs text-slate-500">{first.Airline.AirlineCode} {first.Airline.FlightNumber}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-xs text-slate-700">
                                        <div className="flex flex-wrap gap-3">
                                            <span className="font-semibold text-[#191974]">Flight info</span>
                                            <span>{first.Origin.Airport.AirportCode} → {last.Destination.Airport.AirportCode}</span>
                                            <span>Dep: {formatTime(first.Origin.DepTime)}</span>
                                            <span>Arr: {formatTime(last.Destination.ArrTime)}</span>
                                            <span>Duration: {formatDuration(totalDuration)}</span>
                                            <span>Stops: {stops === 0 ? 'Non-stop' : `${stops} stop(s)`}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-slate-600">
                                            {originTerminal && <span>Dep T{originTerminal}</span>}
                                            {destTerminal && <span>Arr T{destTerminal}</span>}
                                            {seatsLeft && <span className="text-red-600 font-semibold">{seatsLeft} seats left</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Fare Options - Radio Buttons */}
                                <div className="border rounded-lg p-4 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-800 mb-3">Select Fare</h3>
                                    <div className="space-y-3">
                                        {fareOptions.map((fare) => (
                                            <label
                                                key={fare.id}
                                                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedFareId === fare.id
                                                    ? 'border-[#191974] bg-[#191974]/5'
                                                    : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="fareOption"
                                                    value={fare.id}
                                                    checked={selectedFareId === fare.id}
                                                    onChange={(e) => setSelectedFareId(e.target.value)}
                                                    className="h-4 w-4 text-[#191974] focus:ring-[#191974]"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-semibold text-slate-800">{fare.name} fare</span>
                                                        <span className="text-base font-bold text-[#191974]">₹ {fare.price.toLocaleString('en-IN')}</span>
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Selected Fare Details */}
                                <div className="border rounded-lg p-4 shadow-sm space-y-3">
                                    <h3 className="text-sm font-semibold text-slate-800 mb-2">{selectedFareDetails.name} Fare Details</h3>
                                    <div className="space-y-2 text-xs text-slate-700">
                                        <div className="flex flex-wrap gap-3">
                                            <span className="font-semibold text-[#191974]">Baggage</span>
                                            <span>Cabin: {selectedFareDetails.baggage.cabin}</span>
                                            <span>Check-in: {selectedFareDetails.baggage.checkin}</span>
                                            <span>Meals: {selectedFareDetails.meals}</span>
                                            <span>Seat: {selectedFareDetails.seat}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200">
                                            <span className="font-semibold text-[#191974]">Policy</span>
                                            <span>• {selectedFareDetails.change}</span>
                                            <span>• {selectedFareDetails.cancel}</span>
                                            <span>{refundableFlag === undefined ? 'Refund / cancel: check fare rules' : refundableFlag ? 'Refundable (fees may apply)' : 'Non-refundable; change/cancel may not be allowed'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleShareWhatsApp(selectedFlightDrawer)}
                                        className="flex-1 px-3 py-2 rounded-md bg-green-500 text-white text-xs hover:bg-green-600 transition-colors"
                                    >
                                        Share via WhatsApp
                                    </button>
                                    {isItineraryContext && (
                                        <button
                                            onClick={() => {
                                                // Get itinerary metadata from sessionStorage
                                                const itineraryMeta = sessionStorage.getItem('pendingFlightItineraryMeta');
                                                if (!itineraryMeta) {
                                                    addToast('Unable to find itinerary. Please try again.', 'error');
                                                    return;
                                                }

                                                // Find the corresponding Amadeus offer for the selected flight
                                                const selectedResultIndex = selectedFlightDrawer?.ResultIndex;
                                                const amadeusOffer = amadeusOffers.find((offer, idx) =>
                                                    offer.id === selectedResultIndex ||
                                                    offer.id === `offer-${idx}` ||
                                                    idx === rawResults.findIndex(r => r.ResultIndex === selectedResultIndex)
                                                );

                                                if (!amadeusOffer) {
                                                    addToast('Unable to find flight data. Please try again.', 'error');
                                                    return;
                                                }

                                                const meta = JSON.parse(itineraryMeta);
                                                const selectedFareDetails = fareOptions.find(f => f.id === selectedFareId) || fareOptions[0];

                                                // Store Amadeus flight data with selected fare for processing
                                                const flightData = {
                                                    amadeusOffer: amadeusOffer,
                                                    dictionaries: amadeusDictionaries,
                                                    selectedFare: {
                                                        id: selectedFareId,
                                                        name: selectedFareDetails.name,
                                                        price: selectedFareDetails.price
                                                    },
                                                    itineraryId: meta.itineraryId,
                                                    direction: meta.direction || 'onward',
                                                    searchParams: searchParams
                                                };

                                                sessionStorage.setItem('pendingFlightToAdd', JSON.stringify(flightData));

                                                // Navigate back to itinerary
                                                if (meta.itineraryId) {
                                                    sessionStorage.setItem('viewItineraryId', String(meta.itineraryId));
                                                    navigate('/itineraries');
                                                } else {
                                                    // Fallback: try to go back
                                                    window.history.back();
                                                }

                                                addToast('Flight will be added to itinerary...', 'success');
                                                setSelectedFlightDrawer(null);
                                            }}
                                            className="flex-1 px-3 py-2 rounded-md bg-[#191974] text-white text-xs hover:bg-[#13135c] transition-colors"
                                        >
                                            Add to Itinerary
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default FlightSearchResults;
