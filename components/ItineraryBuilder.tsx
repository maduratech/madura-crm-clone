// import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
// import { Itinerary, Lead, Customer, LoggedInUser, TourType, ItineraryDay, AmadeusSightseeing, AmadeusLocation, CostingOption, HotelPreference } from '../types';
// import { useToast } from './ToastProvider';
// import { IconSearch, IconPlus, IconX, IconChevronDown } from '../constants';
// import { amadeusClient } from '../lib/amadeus';

// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// type Room = { id: number; adults: number; children: number; };

// function debounce<T extends (...args: any[]) => void>(func: T, delay: number): (...args: Parameters<T>) => void {
//   let timeoutId: ReturnType<typeof setTimeout> | null;
//   return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
//     if (timeoutId) {
//       clearTimeout(timeoutId);
//     }
//     timeoutId = setTimeout(() => {
//       func.apply(this, args);
//     }, delay);
//   };
// }

// const Spinner: React.FC = () => (
//     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
// );


// const StepCard: React.FC<{ children: React.ReactNode, title: string, subtitle: string }> = ({ children, title, subtitle }) => (
//     <div className="w-full max-w-4xl mx-auto text-center">
//         <h2 className="text-3xl font-bold text-slate-800">{title}</h2>
//         <p className="text-slate-500 mt-2 mb-10">{subtitle}</p>
//         {children}
//     </div>
// );

// const StepCompanions: React.FC<{ value: TourType; onSelect: (type: TourType) => void }> = ({ value, onSelect }) => {
//     const companions = [
//         { label: 'Couple', type: TourType.HONEYMOON, icon: '💕' },
//         { label: 'Family', type: TourType.FAMILY, icon: '👨‍👩‍👧‍👦' },
//         { label: 'Friends', type: TourType.ADVENTURE, icon: '🎉' },
//         { label: 'Solo', type: TourType.CUSTOMIZED, icon: '👤' },
//     ];
//     return (
//         <StepCard title="Who are you travelling with?" subtitle="This helps us tailor the activities and pacing of your trip.">
//             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
//                 {companions.map(c => (
//                     <button key={c.label} onClick={() => onSelect(c.type)} className={`p-6 border-2 rounded-xl text-center transition-all duration-200 ${value === c.type ? 'border-blue-500 bg-blue-50/50 shadow-md scale-105' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
//                         <div className="text-5xl mb-3">{c.icon}</div>
//                         <p className="text-lg font-semibold text-slate-800">{c.label}</p>
//                     </button>
//                 ))}
//             </div>
//         </StepCard>
//     );
// };

// const StepRooms: React.FC<{ rooms: Room[], onConfirm: (rooms: Room[]) => void }> = ({ rooms, onConfirm }) => {
//     const [localRooms, setLocalRooms] = useState(rooms);

//     const updateRoom = (id: number, field: 'adults' | 'children', delta: number) => {
//         setLocalRooms(localRooms.map(r => {
//             if (r.id === id) {
//                 const newValue = r[field] + delta;
//                 const minValue = field === 'adults' ? 1 : 0;
//                 return { ...r, [field]: Math.max(minValue, newValue) };
//             }
//             return r;
//         }));
//     };
    
//     const addRoom = () => setLocalRooms([...localRooms, { id: Date.now(), adults: 1, children: 0 }]);
//     const deleteRoom = (id: number) => setLocalRooms(localRooms.filter(r => r.id !== id));

//     return (
//          <StepCard title="Configure Your Rooms" subtitle="Specify the number of adults and children for each room.">
//             <div className="w-full max-w-lg mx-auto text-left">
//                 <div className="space-y-4 mb-6">
//                     {localRooms.map((room, index) => (
//                         <div key={room.id} className="p-4 bg-white border border-slate-200 rounded-lg">
//                             <div className="flex justify-between items-center mb-4">
//                                 <h3 className="font-bold text-slate-800">Room {index + 1}</h3>
//                                 {localRooms.length > 1 && <button onClick={() => deleteRoom(room.id)} className="text-sm font-semibold text-red-500 hover:underline">Delete</button>}
//                             </div>
//                             <div className="space-y-3">
//                                 <div className="flex justify-between items-center">
//                                     <p className="text-md text-slate-700">Adults (12+)</p>
//                                     <div className="flex items-center gap-2">
//                                         <button onClick={() => updateRoom(room.id, 'adults', -1)} className="w-8 h-8 rounded-md border text-xl bg-slate-100 hover:bg-slate-200">-</button>
//                                         <span className="text-lg font-bold w-8 text-center">{room.adults}</span>
//                                         <button onClick={() => updateRoom(room.id, 'adults', 1)} className="w-8 h-8 rounded-md border text-xl bg-slate-100 hover:bg-slate-200">+</button>
//                                     </div>
//                                 </div>
//                                 <div className="flex justify-between items-center">
//                                     <p className="text-md text-slate-700">Children <span className="text-xs text-slate-500">(0-11 yrs)</span></p>
//                                     <div className="flex items-center gap-2">
//                                         <button onClick={() => updateRoom(room.id, 'children', -1)} className="w-8 h-8 rounded-md border text-xl bg-slate-100 hover:bg-slate-200">-</button>
//                                         <span className="text-lg font-bold w-8 text-center">{room.children}</span>
//                                         <button onClick={() => updateRoom(room.id, 'children', 1)} className="w-8 h-8 rounded-md border text-xl bg-slate-100 hover:bg-slate-200">+</button>
//                                     </div>
//                                 </div>
//                             </div>
//                         </div>
//                     ))}
//                 </div>
//                 <div className="flex gap-4">
//                     <button onClick={addRoom} className="flex-1 py-3 border-2 border-blue-500 text-blue-600 font-semibold rounded-lg hover:bg-blue-50">Add New Room</button>
//                     <button onClick={() => onConfirm(localRooms)} className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Confirm Rooms</button>
//                 </div>
//             </div>
//         </StepCard>
//     );
// };

// const StepDuration: React.FC<{ value: string; onSelect: (duration: string) => void }> = ({ value, onSelect }) => {
//     const durations = ['3-4 Nights', '5-6 Nights', '7-8 Nights', '9+ Nights'];
//     return (
//         <StepCard title="How long is your ideal holiday?" subtitle="This helps us determine the breadth of activities to suggest.">
//             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
//                 {durations.map(d => (
//                     <button key={d} onClick={() => onSelect(d)} className={`p-6 border-2 rounded-xl text-center transition-all duration-200 ${value === d ? 'border-blue-500 bg-blue-50/50 shadow-md scale-105' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
//                         <p className="text-5xl mb-3">🌙</p>
//                         <p className="text-lg font-semibold text-slate-800">{d}</p>
//                     </button>
//                 ))}
//             </div>
//         </StepCard>
//     );
// };

// const StepDeparture: React.FC<{ onSelect: (loc: AmadeusLocation) => void, initialValue?: string }> = ({ onSelect, initialValue }) => {
//     const [keyword, setKeyword] = useState('');
//     const [results, setResults] = useState<AmadeusLocation[]>([]);
//     const [loading, setLoading] = useState(false);
//     const { addToast } = useToast();

//     const debouncedSearch = useCallback(
//         debounce(async (searchKeyword: string) => {
//             if (searchKeyword.length < 3) {
//                 setResults([]);
//                 return;
//             }
//             setLoading(true);
//             try {
//                 const data = await amadeusClient.searchLocations({ keyword: searchKeyword, subType: 'CITY,AIRPORT' });
//                 setResults(data.data || []);
//             } catch (error: any) {
//                 addToast(`Failed to fetch locations: ${error.message}`, 'error');
//             } finally {
//                 setLoading(false);
//             }
//         }, 300),
//         [addToast]
//     );

//     useEffect(() => {
//         debouncedSearch(keyword);
//     }, [keyword, debouncedSearch]);

//     return (
//         <StepCard title="Where are you travelling from?" subtitle="Select your departure city or airport.">
//             <div className="w-full max-w-lg mx-auto">
//                 <div className="relative">
//                     <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
//                     <input 
//                         type="text" 
//                         placeholder="Search by city or airport code (e.g., 'London' or 'LHR')" 
//                         defaultValue={initialValue}
//                         onChange={e => setKeyword(e.target.value)}
//                         className="w-full text-lg pl-12 pr-4 py-4 border-2 border-slate-300 rounded-full focus:border-blue-500 focus:ring-blue-500" />
//                 </div>
//                 <div className="mt-4 max-h-72 overflow-y-auto space-y-2">
//                     {loading && <p className="text-slate-500 p-4">Searching...</p>}
//                     {results.map(loc => (
//                          <button key={`${loc.iataCode}-${loc.name}`} onClick={() => onSelect(loc)} className="w-full p-4 border-b text-left text-lg font-medium text-slate-700 cursor-pointer hover:bg-slate-100 rounded-lg">
//                             {loc.name}, {loc.address.countryName} ({loc.iataCode})
//                          </button>
//                     ))}
//                     {!loading && keyword.length >= 3 && results.length === 0 && <p className="text-slate-500 p-4">No results found.</p>}
//                 </div>
//             </div>
//         </StepCard>
//     );
// };

// const StepDate: React.FC<{ value: string; onSelect: (date: string) => void }> = ({ value, onSelect }) => {
//     const [viewDate, setViewDate] = useState(new Date(value || Date.now()));
    
//     const handleMonthChange = (offset: number) => {
//         setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
//     };

//     const renderMonth = (date: Date) => {
//         const year = date.getFullYear();
//         const month = date.getMonth();
//         const firstDay = new Date(year, month, 1).getDay();
//         const daysInMonth = new Date(year, month + 1, 0).getDate();
//         const today = new Date();
//         today.setHours(0,0,0,0);

//         const days = [];
//         for (let i = 0; i < firstDay; i++) {
//             days.push(<div key={`empty-${i}`}></div>);
//         }
//         for (let i = 1; i <= daysInMonth; i++) {
//             const dayDate = new Date(year, month, i);
//             const dateString = dayDate.toISOString().split('T')[0];
//             const isSelected = value === dateString;

//             days.push(
//                 <button key={i} onClick={() => onSelect(dateString)} className={`text-center p-2 rounded-lg h-12 flex flex-col items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 text-white font-bold' : 'text-slate-800 hover:bg-blue-100'}`}>
//                     {i}
//                 </button>
//             );
//         }
//         return days;
//     };
    
//     const secondMonthDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
//     const ChevronLeft = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>;
//     const ChevronRight = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>;

//     return (
//         <StepCard title="When is your departure date?" subtitle="Select an approximate date for your trip.">
//             <div className="w-full max-w-3xl mx-auto bg-white p-4 rounded-lg border">
//                 <div className="flex justify-between items-center mb-4">
//                     <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-slate-100"><ChevronLeft /></button>
//                     <div className="flex gap-8 w-full justify-around">
//                         <p className="font-semibold text-center">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
//                         <p className="font-semibold text-center">{secondMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
//                     </div>
//                     <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-slate-100"><ChevronRight /></button>
//                 </div>
//                 <div className="grid grid-cols-2 gap-8">
//                     <div>
//                         <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500 mb-2">
//                             {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <div key={day}>{day}</div>)}
//                         </div>
//                         <div className="grid grid-cols-7 gap-1">{renderMonth(viewDate)}</div>
//                     </div>
//                     <div>
//                         <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500 mb-2">
//                             {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <div key={day}>{day}</div>)}
//                         </div>
//                         <div className="grid grid-cols-7 gap-1">{renderMonth(secondMonthDate)}</div>
//                     </div>
//                 </div>
//             </div>
//         </StepCard>
//     );
// };


// const StepActivities: React.FC<{ options: AmadeusSightseeing[], selected: AmadeusSightseeing[], onConfirm: (selected: AmadeusSightseeing[]) => void, isLoading: boolean }> = ({ options, selected, onConfirm, isLoading }) => {
//     const [localSelected, setLocalSelected] = useState(selected);
//     const toggleActivity = (act: AmadeusSightseeing) => {
//         setLocalSelected(prev => prev.some(a => a.name === act.name) ? prev.filter(a => a.name !== act.name) : [...prev, act]);
//     };

//     return (
//         <StepCard title="What would you like to do?" subtitle="Choose some activities to help us build your perfect itinerary.">
//             {isLoading ? (
//                 <div className="flex flex-col items-center justify-center p-8">
//                     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mb-4"></div>
//                     <p className="text-slate-600">Finding the best activities for you...</p>
//                 </div>
//             ) : (
//                 options.length > 0 ? (
//                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[50vh] overflow-y-auto p-2">
//                         {options.slice(0, 16).map(opt => {
//                             const isSelected = localSelected.some(a => a.name === opt.name);
//                             return (
//                                 <button key={opt.name} onClick={() => toggleActivity(opt)} className={`relative rounded-xl overflow-hidden border-4 h-48 ${isSelected ? 'border-blue-500' : 'border-transparent'}`}>
//                                     <img src={`https://source.unsplash.com/random/400x300/?${opt.name.split(' ').slice(0, 2).join(',')}`} alt={opt.name} className="w-full h-full object-cover"/>
//                                     <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
//                                     <p className="absolute bottom-4 left-4 text-white font-bold text-lg text-left">{opt.name}</p>
//                                     {isSelected && <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center border-2 border-white">✓</div>}
//                                 </button>
//                             )
//                         })}
//                     </div>
//                 ) : (
//                     <div className="p-8 bg-slate-100 rounded-lg">
//                         <p className="text-slate-600">No specific activities found. You can still build the itinerary.</p>
//                     </div>
//                 )
//             )}
//             <div className="mt-8">
//                  <button onClick={() => onConfirm(localSelected)} className="px-8 py-4 bg-blue-600 text-white font-bold rounded-full shadow-lg hover:bg-blue-700">
//                     Build My Itinerary ✨
//                  </button>
//             </div>
//         </StepCard>
//     );
// };

// const StepBuildingItinerary: React.FC = () => (
//     <StepCard title="Building your dream itinerary..." subtitle="Our AI is crafting the perfect trip for you. This might take a moment.">
//         <div className="flex flex-col items-center justify-center p-8">
//             <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-slate-900 mb-4"></div>
//             <p className="text-slate-600">Analyzing your preferences...</p>
//         </div>
//     </StepCard>
// );

// interface ItineraryBuilderProps {
//     onClose: () => void;
//     onSave: (itinerary: Itinerary, name: string, duration: string) => void;
//     lead: Lead;
//     customer: Customer;
//     currentUser: LoggedInUser;
// }

// const ItineraryBuilder: React.FC<ItineraryBuilderProps> = ({ onClose, onSave, lead, customer, currentUser }) => {
//     const [step, setStep] = useState(-1);
//     const [formData, setFormData] = useState({
//         tourType: lead.tour_type || TourType.FAMILY,
//         rooms: (lead.requirements?.rooms?.length ? lead.requirements.rooms : [{ id: Date.now(), adults: lead.requirements.adults || 2, children: lead.requirements.children || 0 }]) as Room[],
//         duration: lead.duration || '5-6 Nights',
//         departureLocation: null as AmadeusLocation | null,
//         departureDate: lead.travel_date,
//         activities: [] as AmadeusSightseeing[]
//     });
//     const [sightseeingOptions, setSightseeingOptions] = useState<AmadeusSightseeing[]>([]);
//     const [isSightseeingLoading, setIsSightseeingLoading] = useState(false);
//     const { addToast } = useToast();

//     useEffect(() => {
//         const initializeBuilder = async () => {
//             if (lead.starting_point) {
//                 try {
//                     const data = await amadeusClient.searchLocations({ keyword: lead.starting_point, subType: 'CITY,AIRPORT' });
//                     if (data.data && data.data.length > 0) {
//                         setFormData(p => ({ ...p, departureLocation: data.data[0] }));
//                         setStep(4);
//                         return;
//                     }
//                 } catch (e) {
//                     console.warn(`Could not pre-resolve departure location for "${lead.starting_point}".`);
//                 }
//             }
//             setStep(0);
//         };

//         initializeBuilder();
//     }, [lead.starting_point]);

//     useEffect(() => {
//         if (step === 5) { // StepActivities
//             const fetchActivities = async () => {
//                 setIsSightseeingLoading(true);
//                 try {
//                     const cityIata = await amadeusClient.getCityIataCode(lead.destination);
//                     if (!cityIata) {
//                         console.warn(`Could not find IATA code for ${lead.destination}. Proceeding without activity suggestions.`);
//                         setSightseeingOptions([]);
//                         return;
//                     }
//                     const response = await amadeusClient.searchSightseeing({ cityCode: cityIata });
//                     setSightseeingOptions(response.data || []);
//                 } catch (error: any) {
//                     addToast(`Failed to fetch sightseeing: ${error.message}`, 'error');
//                 } finally {
//                     setIsSightseeingLoading(false);
//                 }
//             };
//             fetchActivities();
//         }
//     }, [step, lead.destination, addToast]);
    
//     const cleanAiResponse = (text: string) => {
//         return text.trim().replace(/^```(html|json)?\s*/, '').replace(/```$/, '').replace(/^.*Here is .*?:\s*\n/i, '').trim();
//     };


//     const handleGenerateItinerary = async (selectedActivities: AmadeusSightseeing[]) => {
//         setFormData(prev => ({ ...prev, activities: selectedActivities }));
//         setStep(step + 1);

//         try {
//             const schema = {
//                 type: 'OBJECT',
//                 properties: {
//                     creativeName: { type: 'STRING' },
//                     dayWisePlan: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, description: { type: 'STRING' } } } },
//                     inclusions: { type: 'STRING' },
//                     exclusions: { type: 'STRING' }
//                 }
//             };
            
//             const totalAdults = formData.rooms.reduce((sum, room) => sum + room.adults, 0);
//             const totalChildren = formData.rooms.reduce((sum, room) => sum + room.children, 0);

//             const prompt = `Create a travel itinerary for a ${formData.tourType} trip to ${lead.destination} for ${formData.duration}. There are ${totalAdults} adults and ${totalChildren} children in ${formData.rooms.length} rooms. They are departing from ${formData.departureLocation?.name || lead.starting_point || 'unknown city'} on ${formData.departureDate}. They are interested in activities like: ${selectedActivities.map(a => a.name).join(', ')}. Format the response as a JSON object. The 'description' for each day, 'inclusions', and 'exclusions' must be formatted as simple HTML strings (using <p>, <ul>, <li>). Return only the JSON object.`;
            
//             const systemInstruction = "You are an API that returns only raw HTML or JSON content for a travel itinerary. Do not include any surrounding text, explanations, or markdown code blocks like ```html.";

//             const requestBody = {
//                 contents: prompt,
//                 config: { 
//                     responseMimeType: 'application/json', 
//                     responseSchema: schema,
//                     systemInstruction: systemInstruction 
//                 }
//             };

//             const response = await fetch(`${API_BASE_URL}/api/ai/generate-content`, {
//                 method: 'POST',
//                 headers: { 'Content-Type': 'application/json' },
//                 body: JSON.stringify(requestBody)
//             });

//             if (!response.ok) {
//                 const errorData = await response.json();
//                 throw new Error(errorData.message || 'AI generation failed on the server.');
//             }

//             const { text } = await response.json();
//             const result = JSON.parse(cleanAiResponse(text));

//             const startDate = new Date(formData.departureDate);
//             const newDayWisePlan = result.dayWisePlan.map((d: any, i: number) => {
//                 const currentDate = new Date(startDate);
//                 currentDate.setDate(startDate.getDate() + i);
//                 const descriptionLower = (d.description || '').toLowerCase();
//                 const meals = {
//                     b: /\bbreakfast\b/.test(descriptionLower),
//                     l: /\blunch\b/.test(descriptionLower),
//                     d: /\bdinner\b/.test(descriptionLower),
//                 };
//                 return { ...d, id: Date.now() + i, day: i + 1, date: currentDate.toISOString().split('T')[0], meals, hotels: [], transfers: [], activities: [] };
//             });

//             const defaultCosting: CostingOption = { id: Date.now(), name: 'Option 1', isDefault: true, hotelDetails: [], costing: { flights: [], sightseeing: [], visa: [], passport: [], other: [] }, isGstApplied: true, isTcsApplied: false };
//             const finalItinerary: Itinerary = {
//                 id: 0,
//                 itinerary_id: 0,
//                 version_number: 1,
//                 day_wise_plan: newDayWisePlan,
//                 inclusions: result.inclusions,
//                 exclusions: result.exclusions,
//                 costing_options: [defaultCosting],
//                 terms_and_conditions: '',
//                 important_notes: '',
//                 bookmarked_flights: [],
//                 images: [],
//                 cover_image_url: null,
//                 gallery_image_urls: [],
//             };

//             onSave(finalItinerary, result.creativeName, formData.duration);

//         } catch (error: any) {
//             addToast(`Itinerary generation failed: ${error.message}`, 'error');
//             onClose();
//         }
//     };

//     const renderStep = () => {
//         switch (step) {
//             case -1: return <StepCard title="Initializing..." subtitle="Getting things ready for you."><Spinner /></StepCard>;
//             case 0: return <StepCompanions value={formData.tourType} onSelect={type => { setFormData(p => ({...p, tourType: type})); setStep(1); }} />;
//             case 1: return <StepRooms rooms={formData.rooms} onConfirm={rooms => { setFormData(p => ({...p, rooms})); setStep(2); }} />;
//             case 2: return <StepDuration value={formData.duration} onSelect={duration => { setFormData(p => ({...p, duration})); setStep(3); }} />;
//             case 3: return <StepDeparture onSelect={loc => { setFormData(p => ({...p, departureLocation: loc})); setStep(4); }} initialValue={lead.starting_point}/>;
//             case 4: return <StepDate value={formData.departureDate} onSelect={date => { setFormData(p => ({...p, departureDate: date})); setStep(5); }} />;
//             case 5: return <StepActivities options={sightseeingOptions} selected={formData.activities} onConfirm={handleGenerateItinerary} isLoading={isSightseeingLoading} />;
//             case 6: return <StepBuildingItinerary />;
//             default: return null;
//         }
//     };

//     const progress = Math.round(((step + 1) / 7) * 100);

//     return (
//         <div className="relative py-12">
//             <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-200">
//                 <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${progress}%` }}></div>
//             </div>
//             <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100"><IconX className="w-6 h-6"/></button>
//             {step > 0 && step < 6 && (
//                 <button onClick={() => setStep(step - 1)} className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-full">
//                     <IconChevronDown className="w-5 h-5 rotate-90" /> Back
//                 </button>
//             )}
//             {renderStep()}
//         </div>
//     );
// };

// export default ItineraryBuilder;