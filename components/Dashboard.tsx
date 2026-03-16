import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataProvider';
import { LeadStatus, LeadSource, LoggedInUser, Invoice, Payment, InvoiceStatus, Service, Lead, Staff, PaymentStatus, LeadType, TourType, TourTypeDisplay, LeadSourceDisplay, TransactionType, TransactionApprovalStatus, TourRegion, ROLE_IDS } from '../types';
import { useAuth } from '../contexts/AuthProvider';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "./ui/card";

const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min for chart aggregates
const RANKING_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min for Top Performing

function getDashboardCache<T>(key: string, ttlMs: number): T | null {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const { data, at } = JSON.parse(raw);
        if (Date.now() - at > ttlMs) return null;
        return data as T;
    } catch {
        return null;
    }
}
function setDashboardCache(key: string, data: unknown) {
    try {
        sessionStorage.setItem(key, JSON.stringify({ data, at: Date.now() }));
    } catch (_) {}
}

const ChartSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`animate-pulse bg-slate-100 rounded-lg ${className}`}>
        <div className="flex flex-col sm:flex-row items-center gap-6 p-6">
            <div className="w-40 h-40 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-3 w-full">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-5 bg-slate-200 rounded w-full max-w-[200px]" />
                ))}
            </div>
        </div>
    </div>
);

const RankingSkeleton: React.FC = () => (
    <div className="animate-pulse space-y-4 p-4">
        {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-100">
                <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
                <div className="w-12 h-12 rounded-full bg-slate-200 shrink-0" />
                <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-32" />
                    <div className="h-3 bg-slate-200 rounded w-24" />
                </div>
                <div className="h-6 w-8 bg-slate-200 rounded" />
            </div>
        ))}
    </div>
);

// Reusable KPI Card
const KpiCard: React.FC<{ title: string; value: string; icon: string }> = ({ title, value, icon }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
            <div className="text-2xl">{icon}</div>
        </CardHeader>
        <CardContent>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
        </CardContent>
    </Card>
);

// Reusable Pie Chart for Animation
const AnimatedPieChart: React.FC<{ data: { value: number; color: string }[] }> = ({ data }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let cumulativePercentage = 0;
    const radius = 45;

    return (
        <svg viewBox="0 0 100 100" className="w-40 h-40 transform -rotate-90">
            {data.map((slice, index) => {
                const slicePercentage = slice.value / total;

                const path = `
                    M 50,50 
                    l ${radius * Math.cos(cumulativePercentage * 2 * Math.PI)},${radius * Math.sin(cumulativePercentage * 2 * Math.PI)}
                    a ${radius},${radius} 0 ${slicePercentage > 0.5 ? 1 : 0} 1 ${radius * Math.cos((cumulativePercentage + slicePercentage) * 2 * Math.PI) - radius * Math.cos(cumulativePercentage * 2 * Math.PI)},${radius * Math.sin((cumulativePercentage + slicePercentage) * 2 * Math.PI) - radius * Math.sin(cumulativePercentage * 2 * Math.PI)}
                    L 50,50
                `;
                cumulativePercentage += slicePercentage;

                return <path
                    key={slice.color + index}
                    d={path}
                    fill={slice.color}
                    style={{ animation: `pie-in 0.5s ${index * 0.05}s ease-out both` }}
                />;
            })}
            <style>{`
                @keyframes pie-in {
                    from { transform: scale(0); transform-origin: 50% 50%; }
                    to { transform: scale(1); transform-origin: 50% 50%; }
                }
            `}</style>
        </svg>
    );
};


const CACHE_KEY_LEAD_SOURCES = 'madura-dashboard-lead-sources';

// Give specific lead sources stable, distinctive colors; others fall back to a default palette.
const LEAD_SOURCE_COLORS: Partial<Record<LeadSource, string>> = {
    [LeadSource.Website]: '#3b82f6',
    [LeadSource.StaffLink]: '#10b981',
    [LeadSource.Phone]: '#f97316',
    [LeadSource.Email]: '#8b5cf6',
    [LeadSource.Instagram]: '#ec4899',
    [LeadSource.FB]: '#64748b',
    [LeadSource.MetaAdsFB]: '#ef4444',
    [LeadSource.MetaAdsIG]: '#f59e0b',
    [LeadSource.GoogleAds]: '#0ea5e9',
    [LeadSource.WhatsApp]: '#22c55e',
    [LeadSource.MDReference]: '#a855f7',
    [LeadSource.Counter]: '#4b5563',
    [LeadSource.AustraliaBranch]: '#14b8a6',
    [LeadSource.Other]: '#6b7280',
};

const LeadSourcePieChart: React.FC = () => {
    const { leads, loading } = useData();
    const [cached, setCached] = useState<{ chartData: { label: string; value: number; percentage: string; color: string }[]; total: number } | null>(() =>
        getDashboardCache(CACHE_KEY_LEAD_SOURCES, DASHBOARD_CACHE_TTL_MS)
    );

    const sourceData = React.useMemo(() => {
        const counts: { [key: string]: number } = {};
        leads.forEach(lead => {
            const rawSource = (lead.source || '').toString();
            const normalizedSource = rawSource.toLowerCase() === 'whatsapp' ? LeadSource.WhatsApp : (rawSource as LeadSource);
            const source = normalizedSource && Object.values(LeadSource).includes(normalizedSource) ? normalizedSource : LeadSource.Other;
            counts[source] = (counts[source] || 0) + 1;
        });
        const totalLeadsWithSource = Object.values(counts).reduce((sum, count) => sum + count, 0);
        if (totalLeadsWithSource === 0) return { chartData: [], total: 0 };
        const fallbackColors = ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#64748b', '#ef4444', '#f59e0b'];
        const chartData = Object.entries(counts)
            .map(([label, value], index) => {
                const sourceKey = label as LeadSource;
                const color = LEAD_SOURCE_COLORS[sourceKey] || fallbackColors[index % fallbackColors.length];
                return {
                    label: LeadSourceDisplay[sourceKey] || label,
                    value,
                    percentage: ((value / totalLeadsWithSource) * 100).toFixed(1),
                    color,
                };
            })
            .sort((a, b) => b.value - a.value);
        return { chartData, total: totalLeadsWithSource };
    }, [leads]);

    useEffect(() => {
        if (sourceData.total > 0) setDashboardCache(CACHE_KEY_LEAD_SOURCES, sourceData);
    }, [sourceData]);

    const display = sourceData.total > 0 ? sourceData : cached;
    const showSkeleton = loading && leads.length === 0 && !cached;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm h-full">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Lead Sources</h3>
            {showSkeleton ? (
                <ChartSkeleton />
            ) : display && display.total > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="shrink-0">
                        <AnimatedPieChart data={display.chartData} />
                    </div>
                    <ul className="space-y-2 text-sm w-full max-h-48 overflow-y-auto">
                        {display.chartData.map(item => (
                            <li key={item.label} className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                                    <span className="text-slate-700">{item.label}</span>
                                </div>
                                <span className="font-semibold text-slate-800">{item.percentage}% ({item.value})</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="text-slate-500 text-center py-8">No lead data to display.</p>
            )}
        </div>
    );
};


const CACHE_KEY_LEAD_STATUS = 'madura-dashboard-lead-status';

const LeadStatusPieChart: React.FC = () => {
    const { leads, loading } = useData();
    const [cached] = useState<{ chartData: { label: string; value: number; percentage: string; color: string }[]; total: number } | null>(() =>
        getDashboardCache(CACHE_KEY_LEAD_STATUS, DASHBOARD_CACHE_TTL_MS)
    );

    const statusData = React.useMemo(() => {
        const counts: { [key: string]: number } = {};
        Object.values(LeadStatus).forEach(s => counts[s] = 0);
        leads.forEach(lead => { counts[lead.status] = (counts[lead.status] || 0) + 1; });
        const totalLeads = leads.length;
        if (totalLeads === 0) return { chartData: [], total: 0 };
        const colors: Record<string, string> = {
            [LeadStatus.Enquiry]: '#3b82f6', [LeadStatus.Processing]: '#60a5fa',
            [LeadStatus.OperationsInitiated]: '#4f9cf0', [LeadStatus.Invoicing]: '#a78bfa', [LeadStatus.Confirmed]: '#818cf8',
            [LeadStatus.BillingCompletion]: '#eab308', [LeadStatus.Voucher]: '#a855f7', [LeadStatus.OnTour]: '#9333ea',
            [LeadStatus.Completed]: '#10b981', [LeadStatus.Feedback]: '#059669',
            [LeadStatus.Rejected]: '#ef4444', [LeadStatus.NotAttended]: '#b91c1c',
            [LeadStatus.Unqualified]: '#f87171',
        };
        const chartData = Object.entries(counts)
            .filter(([, value]) => value > 0)
            .map(([label, value]) => ({ label, value, percentage: ((value / totalLeads) * 100).toFixed(1), color: colors[label] || '#64748b' }))
            .sort((a, b) => b.value - a.value);
        return { chartData, total: totalLeads };
    }, [leads]);

    useEffect(() => { if (statusData.total > 0) setDashboardCache(CACHE_KEY_LEAD_STATUS, statusData); }, [statusData]);

    const display = statusData.total > 0 ? statusData : cached;
    const showSkeleton = loading && leads.length === 0 && !cached;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm h-full">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Lead Status Distribution</h3>
            {showSkeleton ? (
                <ChartSkeleton />
            ) : display && display.total > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="shrink-0"><AnimatedPieChart data={display.chartData} /></div>
                    <ul className="space-y-2 text-sm w-full max-h-48 overflow-y-auto">
                        {display.chartData.map(item => (
                            <li key={item.label} className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                                    <span className="text-slate-700">{item.label}</span>
                                </div>
                                <span className="font-semibold text-slate-800">{item.percentage}% ({item.value})</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="text-slate-500 text-center py-8">No lead data to display.</p>
            )}
        </div>
    );
};

const CACHE_KEY_LEAD_TEMP = 'madura-dashboard-lead-temp';

const LeadTypeChart: React.FC = () => {
    const { leads, loading } = useData();
    const [cached] = useState<{ chartData: { label: string; value: number; percentage: string; color: string }[]; total: number } | null>(() =>
        getDashboardCache(CACHE_KEY_LEAD_TEMP, DASHBOARD_CACHE_TTL_MS)
    );

    const leadTypeData = React.useMemo(() => {
        const counts: { [key in LeadType]?: number } = {};
        leads.forEach(lead => { if (lead.lead_type) counts[lead.lead_type] = (counts[lead.lead_type] || 0) + 1; });
        const totalLeads = leads.length;
        if (totalLeads === 0) return { chartData: [], total: 0 };
        const colors: Record<string, string> = { [LeadType.Hot]: '#ef4444', [LeadType.Warm]: '#f97316', [LeadType.Cold]: '#3b82f6', [LeadType.Booked]: '#10b981' };
        const chartData = Object.entries(counts)
            .filter(([, value]) => value > 0)
            .map(([label, value]) => ({ label, value, percentage: ((value / totalLeads) * 100).toFixed(1), color: colors[label] || '#64748b' }))
            .sort((a, b) => b.value - a.value);
        return { chartData, total: totalLeads };
    }, [leads]);

    useEffect(() => { if (leadTypeData.total > 0) setDashboardCache(CACHE_KEY_LEAD_TEMP, leadTypeData); }, [leadTypeData]);

    const display = leadTypeData.total > 0 ? leadTypeData : cached;
    const showSkeleton = loading && leads.length === 0 && !cached;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm h-full">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Lead Temperature</h3>
            {showSkeleton ? (
                <ChartSkeleton />
            ) : display && display.total > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="shrink-0"><AnimatedPieChart data={display.chartData} /></div>
                    <ul className="space-y-2 text-sm w-full max-h-48 overflow-y-auto">
                        {display.chartData.map(item => (
                            <li key={item.label} className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                                    <span className="text-slate-700">{item.label}</span>
                                </div>
                                <span className="font-semibold text-slate-800">{item.percentage}% ({item.value})</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="text-slate-500 text-center py-8">No lead data to display.</p>
            )}
        </div>
    );
};

const CACHE_KEY_SERVICES = 'madura-dashboard-services';

const ServiceDistributionChart: React.FC = () => {
    const { leads, loading } = useData();
    const [cached] = useState<{ chartData: { label: string; value: number; percentage: string; color: string }[]; total: number } | null>(() =>
        getDashboardCache(CACHE_KEY_SERVICES, DASHBOARD_CACHE_TTL_MS)
    );

    const serviceData = React.useMemo(() => {
        const counts: { [key in Service]?: number } = {};
        let totalServices = 0;
        leads.forEach(lead => {
            (lead.services || []).forEach(service => {
                counts[service] = (counts[service] || 0) + 1;
                totalServices++;
            });
        });
        if (totalServices === 0) return { chartData: [], total: 0 };
        const colors: Record<string, string> = {
            [Service.Tour]: '#3b82f6', [Service.AirTicketing]: '#10b981', [Service.HotelBooking]: '#f97316',
            [Service.Visa]: '#8b5cf6', [Service.Transport]: '#ec4899', [Service.Passport]: '#64748b',
            [Service.Insurance]: '#facc15', [Service.MICE]: '#14b8a6', [Service.ForEx]: '#d946ef',
        };
        const chartData = Object.entries(counts)
            .filter(([, value]) => value > 0)
            .map(([label, value]) => ({ label, value, percentage: ((value / totalServices) * 100).toFixed(1), color: colors[label] || '#9ca3af' }))
            .sort((a, b) => b.value - a.value);
        return { chartData, total: totalServices };
    }, [leads]);

    useEffect(() => { if (serviceData.total > 0) setDashboardCache(CACHE_KEY_SERVICES, serviceData); }, [serviceData]);

    const display = serviceData.total > 0 ? serviceData : cached;
    const showSkeleton = loading && leads.length === 0 && !cached;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm h-full">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Service Popularity</h3>
            {showSkeleton ? (
                <ChartSkeleton />
            ) : display && display.total > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="shrink-0"><AnimatedPieChart data={display.chartData} /></div>
                    <ul className="space-y-2 text-sm w-full max-h-48 overflow-y-auto">
                        {display.chartData.map(item => (
                            <li key={item.label} className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                                    <span className="text-slate-700">{item.label}</span>
                                </div>
                                <span className="font-semibold text-slate-800">{item.percentage}% ({item.value})</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="text-slate-500 text-center py-8">No service data to display.</p>
            )}
        </div>
    );
};

const CACHE_KEY_TOUR_TYPES = 'madura-dashboard-tour-types';

const TourTypeChart: React.FC = () => {
    const { leads, loading } = useData();
    const [cached] = useState<{ chartData: { label: string; value: number; percentage: string; color: string }[]; total: number } | null>(() =>
        getDashboardCache(CACHE_KEY_TOUR_TYPES, DASHBOARD_CACHE_TTL_MS)
    );

    const tourTypeData = React.useMemo(() => {
        const counts: { [key in TourType]?: number } = {};
        let totalTours = 0;
        leads.forEach(lead => {
            if (lead.tour_type) {
                counts[lead.tour_type] = (counts[lead.tour_type] || 0) + 1;
                totalTours++;
            }
        });
        if (totalTours === 0) return { chartData: [], total: 0 };
        const colors: Record<string, string> = {
            [TourType.FAMILY]: '#38bdf8', [TourType.HONEYMOON]: '#f472b6', [TourType.ADVENTURE]: '#fb923c',
            [TourType.SPIRITUAL]: '#a78bfa', [TourType.BUSINESS]: '#475569', [TourType.CUSTOMIZED]: '#2dd4bf',
        };
        const chartData = Object.entries(counts)
            .filter(([, value]) => value > 0)
            .map(([label, value]) => ({ label: TourTypeDisplay[label as TourType] || label, value, percentage: ((value / totalTours) * 100).toFixed(1), color: colors[label] || '#9ca3af' }))
            .sort((a, b) => b.value - a.value);
        return { chartData, total: totalTours };
    }, [leads]);

    useEffect(() => { if (tourTypeData.total > 0) setDashboardCache(CACHE_KEY_TOUR_TYPES, tourTypeData); }, [tourTypeData]);

    const display = tourTypeData.total > 0 ? tourTypeData : cached;
    const showSkeleton = loading && leads.length === 0 && !cached;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm h-full">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Tour Types</h3>
            {showSkeleton ? (
                <ChartSkeleton />
            ) : display && display.total > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="shrink-0"><AnimatedPieChart data={display.chartData} /></div>
                    <ul className="space-y-2 text-sm w-full max-h-48 overflow-y-auto">
                        {display.chartData.map(item => (
                            <li key={item.label} className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                                    <span className="text-slate-700">{item.label}</span>
                                </div>
                                <span className="font-semibold text-slate-800">{item.percentage}% ({item.value})</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <p className="text-slate-500 text-center py-8">No tour type data to display.</p>
            )}
        </div>
    );
};

const MonthlyPerformanceChart: React.FC = () => {
    const { invoices, leads, transactions, leadCostings } = useData();
    const leadMap = React.useMemo(() => new Map(leads.map(l => [l.id, l])), [leads]);

    const chartData = React.useMemo(() => {
        const now = new Date();
        const months = Array.from({ length: 6 }).map((_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = d.getMonth();
            const currentYear = now.getFullYear();
            const label = year !== currentYear
                ? `${d.toLocaleString('default', { month: 'short' })} '${String(year).slice(-2)}`
                : d.toLocaleString('default', { month: 'short' });
            return {
                key: `${year}-${month}-${i}`,
                label,
                year,
                month,
                revenue: 0,
                profit: 0
            };
        }).reverse();

        // Revenue by month: use invoices (same as Dashboard KPI "Total Revenue") so the chart shows real data
        const monthLeadMap = new Map<string, Set<number>>();
        const costAllocatedLeads = new Map<number, string>();

        invoices.forEach(inv => {
            if (inv.status === InvoiceStatus.Draft || inv.status === InvoiceStatus.Void) return;
            const issueDate = new Date(inv.issue_date || inv.created_at || 0);
            if (Number.isNaN(issueDate.getTime())) return;
            const y = issueDate.getFullYear();
            const m = issueDate.getMonth();
            const monthKey = `${y}-${m}`;
            const monthData = months.find(mo => mo.year === y && mo.month === m);
            if (monthData) {
                monthData.revenue += inv.total_amount || 0;
                if (!monthLeadMap.has(monthKey)) monthLeadMap.set(monthKey, new Set());
                monthLeadMap.get(monthKey)!.add(inv.lead_id);
            }
        });

        // Track leads from Income transactions too (for cost allocation), but don't add to revenue to avoid double-counting with invoices
        transactions.forEach(transaction => {
            if (transaction.status === TransactionApprovalStatus.Approved && transaction.lead_id && transaction.type === TransactionType.Income) {
                const transDate = new Date(transaction.recorded_at || transaction.created_at);
                const transYear = transDate.getFullYear();
                const transMonth = transDate.getMonth();
                const monthKey = `${transYear}-${transMonth}`;
                const monthData = months.find(mo => mo.year === transYear && mo.month === transMonth);
                if (monthData) {
                    if (!monthLeadMap.has(monthKey)) monthLeadMap.set(monthKey, new Set());
                    monthLeadMap.get(monthKey)!.add(transaction.lead_id);
                }
            }
        });

        // Calculate actual profit for each month using Reports logic
        months.forEach(monthData => {
            const monthKey = `${monthData.year}-${monthData.month}`;
            const leadIds = monthLeadMap.get(monthKey) || new Set<number>();

            let monthExpenses = 0;
            let monthCosts = 0;

            // Calculate expenses for this month
            transactions.forEach(transaction => {
                if (transaction.status === TransactionApprovalStatus.Approved && transaction.type === TransactionType.Expense) {
                    const transDate = new Date(transaction.recorded_at || transaction.created_at);
                    if (transDate.getFullYear() === monthData.year && transDate.getMonth() === monthData.month) {
                        monthExpenses += transaction.amount;
                    }
                }
            });

            // Calculate lead costs for leads that had activity in this month
            // Allocate cost to the first month we see the lead (chronologically)
            leadIds.forEach(leadId => {
                if (!costAllocatedLeads.has(leadId)) {
                    const lead = leadMap.get(leadId);
                    if (!lead) return;

                    const leadCosting = leadCostings.find(lc => lc.lead_id === leadId);
                    if (leadCosting) {
                        const costItems = leadCosting.items || [];
                        const subtotal = costItems.reduce((sum, item) => {
                            return sum + (item.amount * (item.quantity || 1));
                        }, 0);

                        let gst = 0;
                        let tcs = 0;
                        if (lead.tour_region === TourRegion.Domestic) {
                            gst = subtotal * 0.05;
                        } else if (lead.tour_region === TourRegion.International) {
                            tcs = subtotal * 0.05;
                        }

                        monthCosts += subtotal + gst + tcs;
                        costAllocatedLeads.set(leadId, monthKey);
                    }
                }
            });

            // Profit = Revenue - Lead Costs - Expenses
            monthData.profit = monthData.revenue - monthCosts - monthExpenses;
        });

        // Scale must include both revenue and absolute profit so negative-profit bars don't overflow
        const maxValue = Math.max(...months.map(m => Math.max(m.revenue, Math.abs(m.profit))), 1);
        return { months, maxValue };
    }, [invoices, leads, transactions, leadCostings, leadMap]);

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-900">Monthly Revenue & Profit (Last 6 Months)</h3>
                <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gradient-to-r from-blue-500 to-blue-600 rounded shadow-sm"></div>
                        <span className="text-slate-600 font-medium">Revenue</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded shadow-sm"></div>
                        <span className="text-slate-600 font-medium">Profit</span>
                    </div>
                </div>
            </div>
            <div className="relative">
                {chartData.months.every(m => m.revenue === 0 && m.profit === 0) ? (
                    <div className="flex items-center justify-center h-72 border border-slate-200 rounded-lg bg-slate-50/50">
                        <p className="text-slate-500 text-center px-4">No revenue or profit data for the last 6 months. Revenue comes from issued invoices and approved income transactions.</p>
                    </div>
                ) : (
                <div className="flex flex-col">
                    <div className="flex gap-2">
                        {/* Y-axis: scale in ₹ */}
                        <div className="flex flex-col h-72 border-l-2 border-b-2 border-slate-300 pl-0 pr-2">
                            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Amount (₹)</div>
                            <div className="flex-1 flex flex-col justify-between items-end py-4 text-xs text-slate-500 font-medium">
                                {[1, 0.75, 0.5, 0.25, 0].map((pct) => (
                                    <span key={pct} className="tabular-nums">
                                        ₹{Math.round(chartData.maxValue * pct).toLocaleString('en-IN')}
                                    </span>
                                ))}
                            </div>
                        </div>
                        {/* Chart area */}
                        <div className="flex-1 flex items-end justify-between gap-3 h-72 border-b-2 border-slate-300 p-4 pb-0 bg-gradient-to-t from-slate-50 to-white rounded-r-lg">
                        {chartData.months.map((month) => {
                        const rawRev = (month.revenue / chartData.maxValue) * 100;
                        const rawProfit = (Math.abs(month.profit) / chartData.maxValue) * 100;
                        const revenueHeight = month.revenue > 0 ? Math.max(rawRev, 8) : 0;
                        const profitHeight = month.profit !== 0 ? Math.max(rawProfit, 8) : 0;
                        const isProfit = month.profit >= 0;

                        return (
                            <div key={month.key} className="flex-1 flex flex-col items-center gap-2 group relative">
                                <div className="relative w-full h-full flex items-end justify-center gap-1.5">
                                    {/* Revenue Bar */}
                                    <div
                                        className="w-1/2 bg-gradient-to-t from-blue-500 to-blue-600 rounded-t-lg transition-all duration-700 ease-out shadow-md hover:shadow-xl hover:scale-105 cursor-pointer relative group/bar"
                                        style={{ height: `${revenueHeight}%`, minHeight: revenueHeight > 0 ? '12px' : '0' }}
                                        title={`Revenue: ₹${month.revenue.toLocaleString('en-IN')}`}
                                    >
                                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                            ₹{month.revenue.toLocaleString('en-IN')}
                                        </div>
                                    </div>

                                    {/* Profit Bar */}
                                    <div
                                        className={`w-1/2 rounded-t-lg transition-all duration-700 ease-out shadow-md hover:shadow-xl hover:scale-105 cursor-pointer relative group/bar ${isProfit
                                            ? 'bg-gradient-to-t from-green-500 to-emerald-600'
                                            : 'bg-gradient-to-t from-red-500 to-red-600'
                                            }`}
                                        style={{ height: `${profitHeight}%`, minHeight: profitHeight > 0 ? '12px' : '0' }}
                                        title={`Profit: ${isProfit ? '+' : ''}₹${Math.abs(month.profit).toLocaleString('en-IN')}`}
                                    >
                                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                            {isProfit ? '+' : ''}₹{Math.abs(month.profit).toLocaleString('en-IN')}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">{month.label}</span>
                            </div>
                        );
                        })}
                        </div>
                    </div>
                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mt-1 pl-12">Month</div>
                </div>
                )}
            </div>
        </div>
    );
};

const CACHE_KEY_RANKING = 'madura-dashboard-ranking';

type CachedRankingItem = {
    staffId: number;
    staffName: string;
    avatarUrl: string | null;
    branchId: number;
    totalLeads: number;
    leadsCompleted: number;
    leadsRejected: number;
};

const TopEmployees: React.FC = () => {
    const { allLeadsForRanking, staff, branches, fetchAllLeadsForRanking, loadingAllLeadsForRanking } = useData();
    const [cachedList, setCachedList] = useState<CachedRankingItem[] | null>(() =>
        getDashboardCache<CachedRankingItem[]>(CACHE_KEY_RANKING, RANKING_CACHE_TTL_MS)
    );

    React.useEffect(() => {
        if (allLeadsForRanking.length === 0 && fetchAllLeadsForRanking) fetchAllLeadsForRanking();
    }, [allLeadsForRanking.length, fetchAllLeadsForRanking]);

    const topStaff = React.useMemo(() => {
        const staffOnly = staff.filter(s => s.role_id === ROLE_IDS.STAFF && !/^(AI|Bot)/i.test((s.name || '').trim()));
        const staffPerformanceMap = new Map<number, {
            staff: Staff;
            totalLeads: number;
            leadsAttending: number;
            leadsCompleted: number;
            leadsRejected: number;
        }>();
        staffOnly.forEach(staffMember => {
            staffPerformanceMap.set(staffMember.id, {
                staff: staffMember,
                totalLeads: 0,
                leadsAttending: 0,
                leadsCompleted: 0,
                leadsRejected: 0
            });
        });
        const rangeEnd = new Date();
        rangeEnd.setHours(23, 59, 59, 999);
        const rangeStart = new Date();
        rangeStart.setDate(rangeStart.getDate() - 30);

        allLeadsForRanking.forEach(lead => {
            const createdAt = new Date(lead.created_at);
            if (Number.isNaN(createdAt.getTime())) return;
            if (createdAt < rangeStart || createdAt > rangeEnd) return;
            const assignedStaff = lead.assigned_to || [];
            if (assignedStaff.length === 0) return;
            const isCompleted = lead.status === LeadStatus.Completed || lead.status === LeadStatus.Feedback;
            const isRejected = lead.status === LeadStatus.Rejected || lead.status === LeadStatus.Unqualified;
            assignedStaff.forEach(staffMember => {
                const performance = staffPerformanceMap.get(staffMember.id);
                if (!performance) return;
                performance.totalLeads++;
                if (isCompleted) performance.leadsCompleted++;
                else if (isRejected) performance.leadsRejected++;
                else performance.leadsAttending++;
            });
        });

        const scoreOf = (p: { leadsCompleted: number; leadsRejected: number }) => p.leadsCompleted - p.leadsRejected;
        const staffWithPerformance = Array.from(staffPerformanceMap.values())
            .filter(p => p.totalLeads > 0)
            .sort((a, b) => {
                const scoreA = scoreOf(a);
                const scoreB = scoreOf(b);
                if (scoreB !== scoreA) return scoreB - scoreA;
                if (b.totalLeads !== a.totalLeads) return b.totalLeads - a.totalLeads;
                return 0;
            })
            .slice(0, 3);

        return staffWithPerformance;
    }, [allLeadsForRanking, staff]);

    useEffect(() => {
        if (topStaff.length > 0) {
            const payload: CachedRankingItem[] = topStaff.map(s => ({
                staffId: s.staff.id,
                staffName: s.staff.name || '',
                avatarUrl: s.staff.avatar_url || null,
                branchId: s.staff.branch_id,
                totalLeads: s.totalLeads,
                leadsCompleted: s.leadsCompleted,
                leadsRejected: s.leadsRejected,
            }));
            setDashboardCache(CACHE_KEY_RANKING, payload);
        }
    }, [topStaff]);

    const displayFromCache = loadingAllLeadsForRanking && cachedList && cachedList.length > 0 ? cachedList : null;
    const showSkeleton = loadingAllLeadsForRanking && !cachedList;
    const listToRender = topStaff.length > 0 ? topStaff : null;

    const renderItem = (s: { staff: Staff; totalLeads: number; leadsCompleted: number; leadsRejected: number }, index: number) => {
        const branch = branches.find(b => b.id === s.staff.branch_id);
        const score = s.leadsCompleted - s.leadsRejected;
        const tooltipText = `Score: ${score}\nLeads attended: ${s.totalLeads}\nLeads completed: ${s.leadsCompleted}\nLeads rejected: ${s.leadsRejected}`;
        return (
            <li key={s.staff.id} className="relative flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group" title={tooltipText}>
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' : index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' : index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {index + 1}
                </div>
                {s.staff.avatar_url ? (
                    <img src={s.staff.avatar_url} alt={s.staff.name} className="w-12 h-12 rounded-full border-2 border-slate-200 object-cover" />
                ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold border-2 border-slate-200">
                        {s.staff.name.charAt(0).toUpperCase()}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{s.staff.name}</p>
                    <p className="text-xs text-slate-500 truncate">{branch?.name || 'N/A'}</p>
                </div>
                <div className="text-right">
                    <p className="font-semibold text-lg text-slate-800">{s.leadsCompleted - s.leadsRejected}</p>
                </div>
                <div className="absolute left-0 right-0 top-full mt-1 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10 whitespace-pre-line">
                    Score: {score}
                    {'\n'}Leads attended: {s.totalLeads}
                    {'\n'}Leads completed: {s.leadsCompleted}
                    {'\n'}Leads rejected: {s.leadsRejected}
                </div>
            </li>
        );
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm h-full">
            <h3 className="text-lg font-semibold text-slate-900">Top Performing Employees</h3>
            <p className="text-xs text-slate-500 mb-4">Based on last 30 days.</p>
            {showSkeleton ? (
                <RankingSkeleton />
            ) : listToRender && listToRender.length > 0 ? (
                <ul className="space-y-4">
                    {listToRender.map((s, index) => renderItem(s, index))}
                </ul>
            ) : displayFromCache && displayFromCache.length > 0 ? (
                <ul className="space-y-4">
                    {displayFromCache.map((c, index) => {
                        const branch = branches.find(b => b.id === c.branchId);
                        const score = c.leadsCompleted - c.leadsRejected;
                        return (
                            <li key={c.staffId} className="relative flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group">
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' : index === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' : 'bg-gradient-to-br from-amber-600 to-amber-700 text-white'}`}>
                                    {index + 1}
                                </div>
                                {c.avatarUrl ? (
                                    <img src={c.avatarUrl} alt={c.staffName} className="w-12 h-12 rounded-full border-2 border-slate-200 object-cover" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold border-2 border-slate-200">
                                        {c.staffName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-800 truncate">{c.staffName}</p>
                                    <p className="text-xs text-slate-500 truncate">{branch?.name || 'N/A'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-lg text-slate-800">{score}</p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="text-slate-500 text-center py-8">No performance data available.</p>
            )}
        </div>
    );
};


const Dashboard: React.FC = () => {
    const { leads, invoices, payments, transactions, leadCostings, fetchInvoices, fetchPayments, fetchTransactions, fetchLeadCostings } = useData();
    const { profile } = useAuth();
    const leadMap = React.useMemo(() => new Map(leads.map(l => [l.id, l])), [leads]);

    // Load invoices, payments, transactions, and lead costings so KPIs show real data (they are lazy-loaded)
    React.useEffect(() => {
        if (invoices.length === 0 && fetchInvoices) fetchInvoices();
        if (payments.length === 0 && fetchPayments) fetchPayments();
        if (transactions.length === 0 && fetchTransactions) fetchTransactions();
        if (leadCostings.length === 0 && fetchLeadCostings) fetchLeadCostings();
    }, [invoices.length, payments.length, transactions.length, leadCostings.length, fetchInvoices, fetchPayments, fetchTransactions, fetchLeadCostings]);

    const getGreeting = (name: string) => {
        const hour = new Date().getHours();
        const firstName = name.split(' ')[0];
        if (hour < 12) {
            return `Good Morning, ${firstName}!`;
        }
        if (hour < 18) {
            return `Good Afternoon, ${firstName}!`;
        }
        return `Good Evening, ${firstName}!`;
    };

    const kpiData = React.useMemo(() => {
        // Total Revenue = full cost of all invoices (both paid & due), i.e. sum of total_amount for all issued invoices (exclude Draft, Void)
        const totalRevenue = invoices
            .filter(i => i.status !== InvoiceStatus.Draft && i.status !== InvoiceStatus.Void)
            .reduce((s, i) => s + i.total_amount, 0);

        const totalPaymentsMade = payments.filter(p => (p.status as string)?.toLowerCase() === 'paid').reduce((s, p) => s + p.amount, 0);

        // Total Due = what customers still owe (Revenue − Payments Made). Keeps the three cards consistent.
        const totalDue = totalRevenue - totalPaymentsMade;
        // Total Invoices: only non-Draft (Draft = still in progress, not shown in payment metrics)
        const totalInvoices = invoices.filter(i => i.status !== InvoiceStatus.Draft).length;

        // Total Expense: approved expense transactions (from Lead Costing)
        const totalExpense = (transactions || [])
            .filter(t => t.type === TransactionType.Expense && (t.status as string)?.toLowerCase() === 'approved')
            .reduce((s, t) => s + t.amount, 0);

        return [
            { title: 'Total Due', value: `₹${totalDue.toLocaleString('en-IN')}`, icon: '💳' },
            { title: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: '💰' },
            { title: 'Total Payments Made', value: `₹${totalPaymentsMade.toLocaleString('en-IN')}`, icon: '✅' },
            { title: 'Total Expense', value: `₹${totalExpense.toLocaleString('en-IN')}`, icon: '📤' },
            { title: 'Total Invoices', value: totalInvoices.toLocaleString(), icon: '🧾' },
        ];
    }, [invoices, payments, transactions]);


    return (
        <div className="space-y-6">
            <div className="bg-blue-600/10 p-6 rounded-lg">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{profile ? getGreeting(profile.name) : 'Welcome Back!'}</h2>
                    <p className="text-slate-600 mt-1">Here's a summary of your CRM activity.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {kpiData.map(card => <KpiCard key={card.title} {...card} />)}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <LeadSourcePieChart />
                <LeadStatusPieChart />
                <LeadTypeChart />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ServiceDistributionChart />
                <TourTypeChart />
                <TopEmployees />
            </div>

            <div className="grid grid-cols-1">
                <MonthlyPerformanceChart />
            </div>
        </div>
    );
};

export default Dashboard;