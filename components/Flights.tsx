import React from 'react';
import { LoggedInUser, Flight, Lead, LeadStatus } from '../types';
import { FlightSearchPanel } from './FlightSearchPanel';
import { useData } from '../contexts/DataProvider';
import { useRouter } from '../contexts/RouterProvider';

interface FlightsPageProps {
    currentUser: LoggedInUser;
}

const RecentBookingCard: React.FC<{ flight: Flight, lead: Lead }> = ({ flight, lead }) => {
    const { customers } = useData();
    const customer = customers.find(c => c.id === lead.customer_id);

    const formatTime = (dateTimeString: string) => new Date(dateTimeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const formatDate = (dateTimeString: string) => new Date(dateTimeString).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm min-w-0">
            <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{flight.airline} {flight.flight_no}</p>
                    <p className="text-xs sm:text-sm text-slate-500">{formatDate(flight.departure_time)}</p>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-base sm:text-lg font-bold text-slate-900">₹{flight.price.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-slate-500">Booked for {customer?.first_name}</p>
                </div>
            </div>
            <div className="mt-3 sm:mt-4 flex items-center justify-between text-center gap-1">
                <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-base sm:text-lg">{formatTime(flight.departure_time)}</p>
                    <p className="text-xs sm:text-sm text-slate-600 font-semibold truncate">{flight.from}</p>
                </div>
                <div className="text-center shrink-0 w-20 sm:w-32">
                    <p className="text-xs text-slate-500">{flight.duration}</p>
                    <div className="w-full h-px bg-slate-300 my-1"></div>
                    <p className="text-xs text-slate-500">{flight.stops} stop(s)</p>
                </div>
                <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-base sm:text-lg">{formatTime(flight.arrival_time)}</p>
                    <p className="text-xs sm:text-sm text-slate-600 font-semibold truncate">{flight.to}</p>
                </div>
            </div>
        </div>
    );
};


const Flights: React.FC<FlightsPageProps> = ({ currentUser }) => {
    const { navigate } = useRouter();
    const { leads } = useData();

    const recentBookings = React.useMemo(() => {
        const confirmedStatuses = [LeadStatus.Voucher, LeadStatus.OnTour, LeadStatus.Completed, LeadStatus.BillingCompletion];
        const bookings: { flight: Flight, lead: Lead }[] = [];
        
        leads.forEach(lead => {
            if (confirmedStatuses.includes(lead.status) && lead.booked_flights && lead.booked_flights.length > 0) {
                lead.booked_flights.forEach(flight => {
                    bookings.push({ flight, lead });
                });
            }
        });
        
        // Sort by departure time, most recent first, and take top 5
        return bookings
            .sort((a, b) => new Date(b.flight.departure_time).getTime() - new Date(a.flight.departure_time).getTime())
            .slice(0, 5);
            
    }, [leads]);

    const handleFlightSearch = (params: any) => {
        const query = new URLSearchParams();
        query.set('tripType', params.tripType);
        
        // Add returnDate for roundtrip flights
        if (params.tripType === 'roundtrip' && params.returnDate) {
            query.set('returnDate', params.returnDate);
        }
        
        params.segments.forEach((seg: any, index: number) => {
            query.append(`s${index}_from`, seg.from);
            query.append(`s${index}_to`, seg.to);
            query.append(`s${index}_date`, seg.date);
            if (seg.fromName) query.append(`s${index}_fromName`, seg.fromName);
            if (seg.toName) query.append(`s${index}_toName`, seg.toName);
        });

        query.set('adults', params.passengers.adults);
        query.set('children', params.passengers.children);
        query.set('infants', params.passengers.infants);
        query.set('cabin', params.cabin);
        query.set('direct', params.directFlights);
        if (params.preferredAirlines) {
            query.set('airlines', params.preferredAirlines);
        }

        navigate(`/flights/results?${query.toString()}`);
    };

    return (
        <div className="space-y-4 sm:space-y-6 min-h-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Flight Search</h1>
            <FlightSearchPanel onSearch={handleFlightSearch} />
            
            {recentBookings.length > 0 && (
                <div className="mt-6 sm:mt-8">
                    <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Recent Bookings</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {recentBookings.map(({ flight, lead }) => (
                            <RecentBookingCard key={`${lead.id}-${flight.id}`} flight={flight} lead={lead} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Flights;