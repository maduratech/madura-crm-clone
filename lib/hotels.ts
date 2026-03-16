import { HotelSearchResult } from '../types';
import { fetchFromApi } from './amadeus';

// Client-side helper to search hotels via our backend.
// Backend route: GET /api/hotels/search
export async function searchHotels(params: {
    city: string;
    searchTerm?: string;
    nationality?: string;
    checkIn: string;
    checkOut: string;
    rooms: Array<{ adults: number; children: number; childAges: number[] }>;
    starRatings: number[];
}): Promise<{ results: HotelSearchResult[] }> {
    const query = new URLSearchParams();
    query.set('city', params.city);
    if (params.searchTerm) query.set('searchTerm', params.searchTerm);
    if (params.nationality) query.set('nationality', params.nationality);
    query.set('checkIn', params.checkIn);
    query.set('checkOut', params.checkOut);
    query.set('rooms', JSON.stringify(params.rooms));
    if (params.starRatings.length > 0) {
        query.set('stars', params.starRatings.join(','));
    }

    const data = await fetchFromApi(`/api/hotels/search?${query.toString()}`);
    return {
        results: (data.results || []) as HotelSearchResult[],
    };
}

/** Fetch hotel details (images, facilities) by TBO hotel code. Used when opening detail drawer. */
export async function fetchHotelDetails(hotelCode: string | number): Promise<{ imageUrls: string[]; facilities?: string[] }> {
    const code = encodeURIComponent(String(hotelCode));
    const data = await fetchFromApi(`/api/hotels/details/${code}`);
    return {
        imageUrls: (data.imageUrls || []) as string[],
        facilities: (data.facilities || []) as string[],
    };
}

