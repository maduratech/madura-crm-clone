import React from 'react';
import { useRouter } from '../contexts/RouterProvider';
import { HotelSearchPanel, HotelSearchParams } from './HotelSearchPanel';

const Hotels: React.FC = () => {
  const { navigate } = useRouter();

  const handleSearch = (params: HotelSearchParams) => {
    const qs = new URLSearchParams();
    qs.set('city', params.city);
    if (params.searchTerm) qs.set('searchTerm', params.searchTerm);
    if (params.nationality) qs.set('nationality', params.nationality);
    qs.set('checkIn', params.checkIn);
    qs.set('checkOut', params.checkOut);
    qs.set('rooms', JSON.stringify(params.rooms));
    if (params.starRatings.length) {
      qs.set('stars', params.starRatings.join(','));
    }
    navigate(`/hotels/results?${qs.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Hotel Search</h1>
        <p className="mt-1 text-sm text-slate-600">
          Search and compare hotel
        </p>
      </div>

      <HotelSearchPanel onSearch={handleSearch} />
    </div>
  );
};

export default Hotels;
