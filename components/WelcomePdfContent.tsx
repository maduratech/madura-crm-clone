import React from 'react';
import { Lead, Customer, Staff } from '../types';

interface WelcomePdfContentProps {
    lead: Lead;
    customer: Customer;
    staff: Staff;
}

const WelcomePdfContent: React.FC<WelcomePdfContentProps> = ({ lead, customer, staff }) => {

    const getEndDate = (startDateStr: string, durationStr: string | undefined): string => {
        if (!durationStr) return "Not specified";
        
        const nightsMatch = durationStr.match(/(\d+)\s*N/i);
        if (!nightsMatch) return "Not specified";

        const nights = parseInt(nightsMatch[1], 10);
        const startDate = new Date(startDateStr);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + nights);
        
        return endDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    };

    const startDate = new Date(lead.travel_date);
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const mtsId = `${lead.id}${mm}${yy}`;
    
    const summaryData = [
        { label: 'Agent', value: `${staff.name}, ${staff.phone}` },
        { label: 'MTS ID', value: mtsId },
        { label: 'Name', value: `${customer.first_name} ${customer.last_name}` },
        { label: 'Trip To', value: lead.destination },
        { label: 'No. of Nights', value: lead.duration || 'N/A' },
        { label: 'Start Date', value: startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) },
        { label: 'End Date', value: getEndDate(lead.travel_date, lead.duration) },
        { label: 'Total Adults', value: lead.requirements.adults },
        { label: 'Total Kids', value: lead.requirements.children },
        { label: 'Kid’s Age', value: lead.requirements.child_ages?.join(', ') || 'N/A' },
    ];

    return (
        <div style={{ width: '794px', height: '1123px', fontFamily: 'Arial, sans-serif', backgroundColor: '#e2e8f0', padding: '40px', boxSizing: 'border-box' }}>
            <div style={{ backgroundColor: '#1f2937', color: 'white', padding: '30px', borderRadius: '12px 12px 0 0' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>GT HOLIDAYS</h1>
                <p style={{ fontSize: '14px', margin: '4px 0 0', color: '#cbd5e1' }}>Travel World Class</p>
            </div>
            <div style={{ backgroundColor: '#ffffff', padding: '30px', borderRadius: '0 0 12px 12px' }}>
                <p style={{ fontSize: '20px', margin: 0 }}>Vanakkam {customer.first_name}!</p>
                <p style={{ fontSize: '16px', color: '#4b5563', marginTop: '4px' }}>Get ready for your dream vacay.</p>
                
                <div style={{ marginTop: '24px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Summary</h2>
                    </div>
                    <div style={{ padding: '16px', fontSize: '14px' }}>
                        {summaryData.map(item => (
                            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <span style={{ color: '#6b7280' }}>{item.label}:</span>
                                <span style={{ fontWeight: '600', color: '#111827', textAlign: 'right' }}>{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: '24px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Itinerary Summary</h2>
                    <div style={{ fontSize: '14px', color: '#4b5563', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'hidden' }}>
                        {lead.summary || 'Your detailed itinerary will be shared by your consultant shortly.'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomePdfContent;