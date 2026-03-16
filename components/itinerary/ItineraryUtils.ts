import { Lead, ItineraryMetadata } from '../../types';

// Helper function to generate MTS ID from lead
export const generateBookingId = (lead: Lead | null): string => {
    if (!lead || !lead.id || !lead.created_at) {
        return 'N/A';
    }
    const createdAt = new Date(lead.created_at);
    const day = String(createdAt.getDate()).padStart(2, '0');
    const month = String(createdAt.getMonth() + 1).padStart(2, '0');
    const year = String(createdAt.getFullYear()).slice(-2);
    return `MTS-${lead.id}${day}${month}${year}`;
};

export const getDestinationPlaceholder = (destination?: string) => {
    if (!destination) return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80';
    const d = destination.toLowerCase();
    if (d.includes('singapore')) return 'https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=1200&q=80';
    if (d.includes('dubai') || d.includes('uae')) return 'https://images.unsplash.com/photo-1504274066651-8d31a536b11a?auto=format&fit=crop&w=1200&q=80';
    if (d.includes('paris')) return 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80';
    if (d.includes('london')) return 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80';
    if (d.includes('bali')) return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80';
    if (d.includes('thailand')) return 'https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=1200&q=80';
    return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80';
};

// Helper function to generate SEO-friendly URL slug from text
export const slugify = (text: string): string => {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Segment used for destination/template itineraries (no lead) in URL
export const ITINERARY_URL_DESTINATION_SEGMENT = 'destination';

// Generate itinerary detail URL:
// - Lead-based: /itineraries/{destination}/{duration}/{mtsId}/{itineraryId}
// - Destination/template (no lead): /itineraries/{destination}/{duration}/destination/{itineraryId}
export const generateItineraryUrl = (itinerary: ItineraryMetadata | null, lead: Lead | null): string => {
    if (!itinerary) return '/itineraries';
    
    const destination = slugify(itinerary.destination || 'destination');
    const duration = slugify(itinerary.duration || 'duration');
    const itineraryId = itinerary.id;
    
    if (lead) {
        const mtsId = generateBookingId(lead);
        return `/itineraries/${destination}/${duration}/${mtsId}/${itineraryId}`;
    }
    return `/itineraries/${destination}/${duration}/${ITINERARY_URL_DESTINATION_SEGMENT}/${itineraryId}`;
};

export interface ParsedItineraryUrl {
    destination?: string;
    duration?: string;
    mtsId?: string;
    itineraryId?: string;
    /** true when URL is destination/template style (no lead) */
    isDestinationUrl?: boolean;
}

// Parse itinerary URL: supports lead format and destination/template format
export const parseItineraryUrl = (pathname: string): ParsedItineraryUrl | null => {
    // 4-segment: /itineraries/{destination}/{duration}/{mtsId|destination}/{itineraryId}
    const match4 = pathname.match(/^\/itineraries\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (match4) {
        const third = decodeURIComponent(match4[3]);
        const isDestinationUrl = third === ITINERARY_URL_DESTINATION_SEGMENT;
        return {
            destination: decodeURIComponent(match4[1]),
            duration: decodeURIComponent(match4[2]),
            mtsId: isDestinationUrl ? undefined : third,
            itineraryId: decodeURIComponent(match4[4]),
            isDestinationUrl,
        };
    }
    // Legacy 3-segment: /itineraries/{destination}/{duration}/{mtsId}
    const match3 = pathname.match(/^\/itineraries\/([^/]+)\/([^/]+)\/(.+)$/);
    if (match3) {
        const third = decodeURIComponent(match3[3]);
        const isDestinationUrl = third === ITINERARY_URL_DESTINATION_SEGMENT;
        return {
            destination: decodeURIComponent(match3[1]),
            duration: decodeURIComponent(match3[2]),
            mtsId: isDestinationUrl ? undefined : third,
            isDestinationUrl,
        };
    }
    return null;
};

