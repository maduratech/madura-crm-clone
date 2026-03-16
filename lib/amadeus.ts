// This file handles client-side logic for interacting with the Amadeus Flight API.
// Note: Flight search, booking, and ticketing endpoints still need to be implemented with Amadeus.
import { TboAirport, TboFlightResult, TboCalendarFare } from '../types';
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Helpers
const parseIsoDurationToMinutes = (duration?: string) => {
    if (!duration) return 0;
    // Supports patterns like PT2H30M, PT150M, PT1H
    const hoursMatch = duration.match(/(\d+)H/);
    const minsMatch = duration.match(/(\d+)M/);
    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
    const minutes = minsMatch ? parseInt(minsMatch[1], 10) : 0;
    return hours * 60 + minutes;
};

// A generic fetch handler for the client side to make it more robust.
async function fetchFromApi(endpoint: string, options?: RequestInit) {
    // Get the current session token for authentication
    const { data: { session } } = await supabase.auth.getSession();

    // Merge headers, ensuring Authorization is always included if we have a session
    const headers: HeadersInit = new Headers(options?.headers);
    if (session?.access_token) {
        headers.set('Authorization', `Bearer ${session.access_token}`);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        credentials: 'include',
        ...options,
        headers,
    });

    if (!response.ok) {
        let errorMessage = `API request failed with status ${response.status}.`;
        try {
            // Try to parse a JSON error message from the server
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
        } catch (e) {
            // If the response is not JSON, use the raw text
            try {
                const errorText = await response.text();
                if (errorText) errorMessage = errorText;
            } catch (textError) {
                // Ignore if we can't even get text
            }
        }
        throw new Error(errorMessage);
    }

    return response.json();
}

// Re-export for other API clients (e.g. hotels)
export { fetchFromApi };


export async function searchAirports(query: string): Promise<TboAirport[]> {
    const data = await fetchFromApi(`/api/airports?q=${encodeURIComponent(query)}`);
    return data.airports || [];
}

export async function searchHotelCities(query: string): Promise<Array<{ code: string; name: string; country?: string; countryCode?: string }>> {
    const data = await fetchFromApi(`/api/hotels/cities?q=${encodeURIComponent(query)}`);
    return data.cities || [];
}

export async function searchFlightsRaw(params: any): Promise<{ offers: any[], dictionaries: any }> {
    const firstSegment = params?.segments?.[0];
    if (!firstSegment?.from || !firstSegment?.to || !firstSegment?.date) {
        throw new Error('Missing search params (from, to, date).');
    }

    const query = new URLSearchParams();
    query.set('from', firstSegment.from);
    query.set('to', firstSegment.to);
    query.set('date', firstSegment.date);

    if (params.tripType === 'roundtrip' && params.returnDate) {
        query.set('returnDate', params.returnDate);
    }

    query.set('adults', params.passengers?.adults?.toString() || '1');
    query.set('children', params.passengers?.children?.toString() || '0');
    query.set('infants', params.passengers?.infants?.toString() || '0');
    query.set('currency', (params.currency || 'INR').toString());
    query.set('travelClass', (params.cabin || 'ECONOMY').toString());
    if (params.directFlights) query.set('nonStop', 'true');
    if (params.max) query.set('max', params.max.toString());

    const data = await fetchFromApi(`/api/flight-search?${query.toString()}`);

    const offers = data.data || [];
    const dictionaries = data.dictionaries || { carriers: {}, locations: {} };

    return { offers, dictionaries };
}

export async function searchFlights(
    params: any
): Promise<{ results: TboFlightResult[]; traceId: string; providers?: any }> {
    // Use combined backend endpoint (Amadeus + optional TBO)
    const data = await fetchFromApi(`/api/flights/search`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });

    const results: TboFlightResult[] = (data.results || []) as TboFlightResult[];
    const traceId: string = data.traceId || 'combined';
    return { results, traceId, providers: data.providers };
}

// TODO: Implement with Amadeus if needed
export async function getCalendarFares(origin: string, destination: string, journeyDate: string): Promise<TboCalendarFare[]> {
    // Not implemented yet; return empty list to avoid breaking the UI
    return [];
}

// TODO: Implement with Amadeus if needed
export async function getFareQuote(TraceId: string, ResultIndex: string): Promise<any> {
    throw new Error('Fare quote not yet implemented with Amadeus.');
}

// TODO: Implement with Amadeus if needed
export async function bookFlight(TraceId: string, ResultIndex: string, passengers: any[]): Promise<any> {
    throw new Error('Flight booking not yet implemented with Amadeus.');
}

// TODO: Implement with Amadeus if needed
export async function ticketFlight(
    TraceId: string,
    PNR: string,
    BookingId: number,
    lead_id: number | null,
    flightDetails: any
): Promise<any> {
    throw new Error('Flight ticketing not yet implemented with Amadeus.');
}

