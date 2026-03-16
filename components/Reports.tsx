import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../contexts/DataProvider';
import { useAuth } from '../contexts/AuthProvider';
import { useRouter } from '../contexts/RouterProvider';
import { Lead, Staff, Branch, LeadStatus, TransactionType, TransactionApprovalStatus, TourRegion, Customer, LoggedInUser, Invoice, ItineraryMetadata, Supplier, ROLE_IDS, StaffStatus } from '../types';
import { IconX } from '../constants';
import { generateBookingId } from './itinerary/ItineraryUtils';

interface LeadWithProfit {
    lead_id: number;
    lead: Lead;
    profit_made: number;
    customer_name: string;
}

interface StaffPerformanceReport {
    staff_id: number;
    staff_name: string;
    branch_name: string;
    leads_attended: number;
    leads_completed: number;
    leads_rejected: number;
    profit_made: number;
    performance_rate: number;
    score: number;
}

/** All-time staff ranking (same for all users) – from allLeadsForRanking */
interface StaffRankingRow {
    staff_id: number;
    staff_name: string;
    branch_name: string;
    total_leads: number;
    leads_attending: number;
    leads_completed: number;
    leads_rejected: number;
    performance_rate: number;
    score: number;
}

interface BranchPerformanceReport {
    branch_id: number;
    branch_name: string;
    leads_attended: number;
    leads_completed: number;
    leads_rejected: number;
    profit_made: number;
    performance_rate: number;
    staff_count: number;
    score: number;
}

const Reports: React.FC = () => {
    const { staff, branches, leads, allLeadsForRanking, fetchAllLeadsForRanking, transactions, leadCostings, customers, invoices, itineraries, suppliers, refreshData } = useData();
    const { profile: currentUser, session } = useAuth();
    const { navigate } = useRouter();
    const [loading, setLoading] = useState(false);
    const defaultDateRange = useMemo(() => {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
        return { start, end };
    }, []);
    const [startDate, setStartDate] = useState(defaultDateRange.start);
    const [endDate, setEndDate] = useState(defaultDateRange.end);
    const [draftStartDate, setDraftStartDate] = useState(defaultDateRange.start);
    const [draftEndDate, setDraftEndDate] = useState(defaultDateRange.end);
    const [activeTab, setActiveTab] = useState<'staff' | 'branch'>('staff');
    const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isDrawerClosing, setIsDrawerClosing] = useState(false);
    const [isDrawerOpenState, setIsDrawerOpenState] = useState(false);

    // Store leads with profit data per staff/branch
    const [leadsWithProfitByStaff, setLeadsWithProfitByStaff] = useState<Map<number, LeadWithProfit[]>>(new Map());
    const [leadsWithProfitByBranch, setLeadsWithProfitByBranch] = useState<Map<number, LeadWithProfit[]>>(new Map());
    // Store summary data in state from the main useEffect
    const [staffSummaryData, setStaffSummaryData] = useState<StaffPerformanceReport[]>([]);
    const [branchSummaryData, setBranchSummaryData] = useState<BranchPerformanceReport[]>([]);
    
    // Online status tracking
    const [sessionData, setSessionData] = useState<any[]>([]);
    const [sessionLoading, setSessionLoading] = useState(false);
    const [activeSessionTab, setActiveSessionTab] = useState<number>(0);
    
    // Drawer tabs
    const [drawerTab, setDrawerTab] = useState<'overview' | 'daily-tracking'>('overview');
    
    // Daily Tracking table filters and pagination
    const [dailyTrackingFilterStartDate, setDailyTrackingFilterStartDate] = useState<string>('');
    const [dailyTrackingFilterEndDate, setDailyTrackingFilterEndDate] = useState<string>('');
    const [dailyTrackingSortBy, setDailyTrackingSortBy] = useState<'date' | 'first_login' | 'last_login' | 'active_time'>('date');
    const [dailyTrackingSortOrder, setDailyTrackingSortOrder] = useState<'asc' | 'desc'>('desc');
    const [dailyTrackingPage, setDailyTrackingPage] = useState<number>(1);
    const dailyTrackingPageSize = 10;

    // Drawer animation effect
    useEffect(() => {
        if (isDrawerOpen) {
            setTimeout(() => setIsDrawerOpenState(true), 10);
        }
    }, [isDrawerOpen]);

    // Load all leads for ranking (same for all users) when Reports mounts
    useEffect(() => {
        if (allLeadsForRanking.length === 0 && fetchAllLeadsForRanking) fetchAllLeadsForRanking();
    }, [allLeadsForRanking.length, fetchAllLeadsForRanking]);

    // All-time staff ranking from full DB – same for all users, same logic as Dashboard (active staff only)
    const staffRankingData = useMemo((): StaffRankingRow[] => {
        const staffOnly = staff.filter(s => s.status === StaffStatus.Active && s.role_id === ROLE_IDS.STAFF && !/^(AI|Bot)/i.test((s.name || '').trim()));
        const branchMap = new Map<number, Branch>(branches.map(b => [b.id, b]));
        const map = new Map<number, { total_leads: number; leads_attending: number; leads_completed: number; leads_rejected: number }>();
        staffOnly.forEach(s => {
            map.set(s.id, { total_leads: 0, leads_attending: 0, leads_completed: 0, leads_rejected: 0 });
        });
        allLeadsForRanking.forEach(lead => {
            const assigned = lead.assigned_to || [];
            if (assigned.length === 0) return;
            const isCompleted = lead.status === LeadStatus.Completed || lead.status === LeadStatus.Feedback;
            const isRejected = lead.status === LeadStatus.Rejected || lead.status === LeadStatus.Unqualified;
            assigned.forEach(staffMember => {
                const p = map.get(staffMember.id);
                if (!p) return;
                p.total_leads++;
                if (isCompleted) p.leads_completed++;
                else if (isRejected) p.leads_rejected++;
                else p.leads_attending++;
            });
        });
        return staffOnly
            .map(s => {
                const p = map.get(s.id)!;
                const total = p.total_leads;
                const score = p.leads_completed - p.leads_rejected;
                const performance_rate = total > 0 ? ((p.leads_completed - p.leads_rejected) / total) * 100 : 0;
                return {
                    staff_id: s.id,
                    staff_name: s.name,
                    branch_name: branchMap.get(s.branch_id)?.name || 'N/A',
                    total_leads: total,
                    leads_attending: p.leads_attending,
                    leads_completed: p.leads_completed,
                    leads_rejected: p.leads_rejected,
                    performance_rate,
                    score
                };
            })
            .filter(r => r.total_leads > 0)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return b.total_leads - a.total_leads;
            });
    }, [allLeadsForRanking, staff, branches]);

    useEffect(() => {
        const generateReport = () => {
            if (!startDate || !endDate || staff.length === 0) return;
            setLoading(true);

            const branchMap = new Map<number, Branch>(branches.map(b => [b.id, b]));
            const customerMap = new Map<number, Customer>(customers.map(c => [c.id, c]));
            const dateRangeStart = new Date(startDate + 'T00:00:00');
            const dateRangeEnd = new Date(endDate + 'T23:59:59');

            // Maps to store performance data
            const staffPerformanceMap = new Map<number, StaffPerformanceReport>();
            const branchPerformanceMap = new Map<number, BranchPerformanceReport>();
            const staffLeadsMap = new Map<number, LeadWithProfit[]>();
            const branchLeadsMap = new Map<number, LeadWithProfit[]>();

            // Initialize staff performance – only active staff (exclude Inactive, etc.)
            staff.filter(s => s.status === StaffStatus.Active).forEach(staffMember => {
                staffPerformanceMap.set(staffMember.id, {
                    staff_id: staffMember.id,
                    staff_name: staffMember.name,
                    branch_name: branchMap.get(staffMember.branch_id)?.name || 'N/A',
                    leads_attended: 0,
                    leads_completed: 0,
                    leads_rejected: 0,
                    profit_made: 0,
                    performance_rate: 0,
                    score: 0
                });
            });

            // Initialize branch performance
            branches.forEach(branch => {
                branchPerformanceMap.set(branch.id, {
                    branch_id: branch.id,
                    branch_name: branch.name,
                    leads_attended: 0,
                    leads_completed: 0,
                    leads_rejected: 0,
                    profit_made: 0,
                    performance_rate: 0,
                    staff_count: 0
                    ,score: 0
                });
            });

            // Process leads to track performance and calculate profit
            leads.forEach(lead => {
                const assignedStaff = lead.assigned_to || [];
                if (assignedStaff.length === 0) return;

                // Check if lead has activity within date range
                const leadCreatedDate = new Date(lead.created_at);
                const leadUpdatedDate = new Date(lead.last_updated);
                const hasActivityInRange = lead.activity?.some(act => {
                    const actDate = new Date(act.timestamp);
                    return actDate >= dateRangeStart && actDate <= dateRangeEnd;
                }) || false;

                const isInRange = (leadCreatedDate >= dateRangeStart && leadCreatedDate <= dateRangeEnd) ||
                    (leadUpdatedDate >= dateRangeStart && leadUpdatedDate <= dateRangeEnd) ||
                    hasActivityInRange;

                if (!isInRange) return;

                // Calculate profit for this lead
                const leadCosting = leadCostings.find(lc => lc.lead_id === lead.id);
                const leadTransactions = (transactions || []).filter(t => t.lead_id === lead.id);

                const totalIncome = leadTransactions
                    .filter(t => t.type === TransactionType.Income && t.status === TransactionApprovalStatus.Approved)
                    .reduce((sum, t) => sum + t.amount, 0);

                let totalLeadCost = 0;
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

                    totalLeadCost = subtotal + gst + tcs;
                }

                const totalExpenses = leadTransactions
                    .filter(t => t.type === TransactionType.Expense && t.status === TransactionApprovalStatus.Approved)
                    .reduce((sum, t) => sum + t.amount, 0);

                const netProfit = totalIncome - totalLeadCost - totalExpenses;
                const profitPerStaff = assignedStaff.length > 0 ? netProfit / assignedStaff.length : 0;

                const customer = customerMap.get(lead.customer_id);
                const customerName = customer ? `${customer.first_name} ${customer.last_name}` : 'N/A';

                // Update performance for each assigned staff member
                assignedStaff.forEach(staffMember => {
                    const performance = staffPerformanceMap.get(staffMember.id);
                    if (!performance) return;

                    performance.leads_attended++;

                    if (lead.status === LeadStatus.Completed || lead.status === LeadStatus.Feedback) {
                        performance.leads_completed++;
                    }

                    if (lead.status === LeadStatus.Rejected || lead.status === LeadStatus.Unqualified) {
                        performance.leads_rejected++;
                    }

                    performance.profit_made += profitPerStaff;

                        // compute interim score (attended + completed - rejected)
                        performance.score = (performance.leads_attended || 0) + (performance.leads_completed || 0) - (performance.leads_rejected || 0);

                    // Store lead with profit (only if profit is not zero)
                    if (Math.abs(profitPerStaff) > 0.01) {
                        if (!staffLeadsMap.has(staffMember.id)) {
                            staffLeadsMap.set(staffMember.id, []);
                        }
                        staffLeadsMap.get(staffMember.id)!.push({
                            lead_id: lead.id,
                            lead,
                            profit_made: profitPerStaff,
                            customer_name: customerName
                        });
                    }

                    // Update branch performance
                    const branchPerformance = branchPerformanceMap.get(staffMember.branch_id);
                    if (branchPerformance) {
                        branchPerformance.leads_attended++;

                        if (lead.status === LeadStatus.Completed || lead.status === LeadStatus.Feedback) {
                            branchPerformance.leads_completed++;
                        }

                        if (lead.status === LeadStatus.Rejected || lead.status === LeadStatus.Unqualified) {
                            branchPerformance.leads_rejected++;
                        }

                        branchPerformance.profit_made += profitPerStaff;

                            // compute branch score
                            branchPerformance.score = (branchPerformance.leads_attended || 0) + (branchPerformance.leads_completed || 0) - (branchPerformance.leads_rejected || 0);

                        // Store lead with profit for branch (only if profit is not zero)
                        if (Math.abs(profitPerStaff) > 0.01) {
                            if (!branchLeadsMap.has(staffMember.branch_id)) {
                                branchLeadsMap.set(staffMember.branch_id, []);
                            }
                            branchLeadsMap.get(staffMember.branch_id)!.push({
                                lead_id: lead.id,
                                lead,
                                profit_made: profitPerStaff,
                                customer_name: customerName
                            });
                        }
                    }
                });
            });

            // Calculate performance rates
            staffPerformanceMap.forEach(performance => {
                if (performance.leads_attended > 0) {
                    // Performance rate = (completed - rejected) / attended * 100
                    performance.performance_rate = ((performance.leads_completed - performance.leads_rejected) / performance.leads_attended) * 100;
                }
            });

            branchPerformanceMap.forEach(performance => {
                if (performance.leads_attended > 0) {
                    // Performance rate = (completed - rejected) / attended * 100
                    performance.performance_rate = ((performance.leads_completed - performance.leads_rejected) / performance.leads_attended) * 100;
                }
                // Count unique staff per branch
                const staffIds = new Set(
                    Array.from(staffPerformanceMap.values())
                        .filter(p => {
                            const staffMember = staff.find(st => st.id === p.staff_id);
                            return staffMember && staffMember.branch_id === (branches.find(b => b.name === performance.branch_name)?.id);
                        })
                        .map(p => p.staff_id)
                );
                performance.staff_count = staffIds.size;
            });

            // Store summary data as state - sorted by Performance Rate (descending)
            // Store unsorted summary data; sort at render time based on user-selected ranking mode
            setStaffSummaryData(Array.from(staffPerformanceMap.values())
                .filter(p => p.leads_attended > 0 || Math.abs(p.profit_made) > 0.01));

            setBranchSummaryData(Array.from(branchPerformanceMap.values())
                .filter(p => p.leads_attended > 0 || Math.abs(p.profit_made) > 0.01));

            setLeadsWithProfitByStaff(staffLeadsMap);
            setLeadsWithProfitByBranch(branchLeadsMap);
            setLoading(false);
        };

        generateReport();
    }, [startDate, endDate, staff, branches, leads, transactions, leadCostings, customers]);

    // Get leads for selected staff (filter out zero profit)
    const staffLeads = useMemo(() => {
        if (!selectedStaffId) return [];
        return leadsWithProfitByStaff.get(selectedStaffId) || [];
    }, [selectedStaffId, leadsWithProfitByStaff]);

    // Get leads for selected branch (filter out zero profit)
    const branchLeads = useMemo(() => {
        if (!selectedBranchId) return [];
        return leadsWithProfitByBranch.get(selectedBranchId) || [];
    }, [selectedBranchId, leadsWithProfitByBranch]);

    // Fetch session data for selected staff
    useEffect(() => {
        const fetchSessionData = async () => {
            if (!selectedStaffId) {
                setSessionData([]);
                setActiveSessionTab(0);
                return;
            }

            setSessionLoading(true);
            try {
                const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
                const params = new URLSearchParams({
                    staffId: selectedStaffId.toString(),
                    startDate: startDate,
                    endDate: endDate,
                    period: 'daily'
                });

                const response = await fetch(`${API_BASE}/api/sessions/report?${params}`, {
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch session data');
                }

                const responseData = await response.json();
                // API returns { data: [...], period: 'daily' }
                const sessionArray = Array.isArray(responseData?.data) ? responseData.data : (Array.isArray(responseData) ? responseData : []);
                setSessionData(sessionArray);
                setActiveSessionTab(0); // Reset to first tab when data changes
            } catch (error) {
                setSessionData([]);
                setActiveSessionTab(0);
            } finally {
                setSessionLoading(false);
            }
        };

        fetchSessionData();
    }, [selectedStaffId, startDate, endDate, session]);

    const handleStaffClick = (staffId: number) => {
        setSelectedStaffId(staffId);
        setSelectedBranchId(null);
        setIsDrawerOpen(true);
        setIsDrawerOpenState(true);
        setDrawerTab('overview'); // Reset to overview tab
        setDailyTrackingPage(1); // Reset pagination
        setDailyTrackingFilterStartDate(''); // Reset filters
        setDailyTrackingFilterEndDate('');
        document.body.style.overflow = 'hidden';
    };

    const handleBranchClick = (branchId: number) => {
        setSelectedBranchId(branchId);
        setSelectedStaffId(null);
        setIsDrawerOpen(true);
        setIsDrawerOpenState(true);
        document.body.style.overflow = 'hidden';
    };

    const handleCloseDrawer = () => {
        setIsDrawerClosing(true);
        setIsDrawerOpenState(false);
        setTimeout(() => {
            setIsDrawerOpen(false);
            setIsDrawerClosing(false);
            setSelectedStaffId(null);
            setSelectedBranchId(null);
            document.body.style.overflow = '';
        }, 300);
    };

    const handleSaveLead = async (lead: Lead): Promise<boolean> => {
        // This is a read-only view from Reports, so we don't allow saving
        return false;
    };

    const handleSaveCustomer = async (customer: Customer, avatarFile: File | null): Promise<Customer | void> => {
        // Read-only view
        return customer;
    };

    const handleUpdateCustomer = async (customer: Customer, avatarFile: File | null): Promise<boolean> => {
        // Read-only view
        return false;
    };

    const renderStaffSummary = () => {
        // Use date-range data sorted by performance rate descending (highest % first)
        const sortedStaff = staffSummaryData.slice().sort((a, b) => {
            if (Math.abs(b.performance_rate - a.performance_rate) > 0.01) return b.performance_rate - a.performance_rate;
            if (b.leads_attended !== a.leads_attended) return b.leads_attended - a.leads_attended;
            return a.staff_name.localeCompare(b.staff_name);
        });
        const attending = (row: StaffPerformanceReport) => row.leads_attended - row.leads_completed - row.leads_rejected;

        return (
            <div className="overflow-hidden">
                <div className="overflow-x-auto">
                <table className="min-w-[640px] w-full text-sm">
                    <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Staff Member</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider hidden md:table-cell">Branch</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Total Leads</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider hidden md:table-cell">Attending</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider hidden md:table-cell">Completed</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider hidden md:table-cell">Rejected</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Performance Rate</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {sortedStaff.map((row, index) => {
                            const performanceRateDisplay = row.leads_attended > 0
                                ? `${row.performance_rate.toFixed(1)}%`
                                : '--';

                            return (
                                <tr
                                    key={row.staff_id}
                                    className={`group transition-all duration-200 cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                                        } hover:bg-slate-50 hover:shadow-sm`}
                                    onClick={() => handleStaffClick(row.staff_id)}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            {(() => {
                                                const staffMember = staff.find(s => s.id === row.staff_id);
                                                const hasAvatar = staffMember?.avatar_url;
                                                return (
                                                    <React.Fragment>
                                                        {hasAvatar ? (
                                                            <img
                                                                src={staffMember.avatar_url}
                                                                alt={row.staff_name}
                                                                className="flex-shrink-0 h-10 w-10 rounded-full border-2 border-slate-200 mr-3 object-cover"
                                                                onError={(e) => {
                                                                    const target = e.target as HTMLImageElement;
                                                                    target.style.display = 'none';
                                                                    const parent = target.parentElement;
                                                                    const fallback = parent?.querySelector('.avatar-fallback') as HTMLDivElement;
                                                                    if (fallback) fallback.style.display = 'flex';
                                                                }}
                                                            />
                                                        ) : null}
                                                        <div
                                                            className={`flex-shrink-0 h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-semibold text-sm mr-3 avatar-fallback ${hasAvatar ? 'hidden' : ''}`}
                                                        >
                                                            {row.staff_name.charAt(0).toUpperCase()}
                                                        </div>
                                                    </React.Fragment>
                                                );
                                            })()}
                                            <div className="font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">
                                                {row.staff_name}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                            {row.branch_name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-700 font-medium">{row.leads_attended}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-700 font-medium hidden md:table-cell">{attending(row)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-700 font-medium hidden md:table-cell">{row.leads_completed}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-700 font-medium hidden md:table-cell">{row.leads_rejected}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 bg-slate-200 rounded-full h-2">
                                                <div
                                                    className="h-2 rounded-full transition-all duration-300 bg-slate-500"
                                                    style={{ width: `${Math.min(Math.max(row.performance_rate, 0), 100)}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-slate-700 font-semibold min-w-[3rem] text-right">{performanceRateDisplay}</span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            </div>
        );
    };


    const renderBranchSummary = () => {
        return (
            <div className="overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Branch</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Staff Count</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Leads Attended</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Leads Completed</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Leads Rejected</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Profit Made</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Performance Rate</th>
                            <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {(() => {
                            const displayBranches = branchSummaryData.slice().sort((a, b) => {
                                // Rank by performance rate (descending)
                                if (Math.abs(b.performance_rate - a.performance_rate) > 0.01) return b.performance_rate - a.performance_rate;
                                if (Math.abs(b.profit_made - a.profit_made) > 0.01) return b.profit_made - a.profit_made;
                                return a.branch_name.localeCompare(b.branch_name);
                            });

                            return displayBranches.map((row, index) => {
                                const isProfit = row.profit_made >= 0;
                                const performanceRateDisplay = row.leads_attended > 0
                                    ? `${row.performance_rate.toFixed(1)}%`
                                    : '--';

                                return (
                                    <tr
                                        key={row.branch_id}
                                        className={`group transition-all duration-200 cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                                            } hover:bg-blue-50 hover:shadow-sm`}
                                        onClick={() => handleBranchClick(row.branch_id)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm mr-3">
                                                    {row.branch_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                                                    {row.branch_name}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                                                {row.staff_count} Staff
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-slate-700 font-medium">{row.leads_attended}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-slate-700 font-medium">{row.leads_completed}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-slate-700 font-medium">{row.leads_rejected}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-right font-bold text-lg ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                            <span className="flex items-center justify-end gap-1">
                                                <span className={isProfit ? 'text-green-500' : 'text-red-500'}>{isProfit ? '↑' : '↓'}</span>
                                                <span>{isProfit ? '+' : ''}₹{row.profit_made.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-16 bg-slate-200 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full transition-all duration-300 ${row.performance_rate >= 70 ? 'bg-green-500' : row.performance_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                        style={{ width: `${Math.min(row.performance_rate, 100)}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-slate-700 font-semibold min-w-[3rem] text-right">{performanceRateDisplay}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${isProfit
                                                ? 'bg-green-100 text-green-800 border border-green-200'
                                                : 'bg-red-100 text-red-800 border border-red-200'
                                                }`}>
                                                {isProfit ? '✓ Profit' : '✗ Loss'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            });
                        })()}
                    </tbody>
                </table>
            </div>
        );
    };

    // Get selected staff data for drawer (ranking stats = all-time from staffRankingData; profit/leads = date range from staffSummaryData)
    const selectedStaffData = useMemo(() => {
        if (!selectedStaffId) return null;
        const staffMember = staff.find(s => s.id === selectedStaffId);
        const rankingRow = staffRankingData.find(r => r.staff_id === selectedStaffId);
        const performance = staffSummaryData.find(p => p.staff_id === selectedStaffId);
        const staffLeadsList = staffLeads || [];

        // Calculate profit breakdown
        const totalProfit = performance?.profit_made || 0;
        const totalIncome = staffLeadsList.reduce((sum, lwp) => {
            const leadTransactions = (transactions || []).filter(t => t.lead_id === lwp.lead_id);
            const income = leadTransactions
                .filter(t => t.type === TransactionType.Income && t.status === TransactionApprovalStatus.Approved)
                .reduce((s, t) => s + t.amount, 0);
            return sum + (income / (lwp.lead.assigned_to?.length || 1));
        }, 0);

        const totalCosts = staffLeadsList.reduce((sum, lwp) => {
            const leadCosting = leadCostings.find(lc => lc.lead_id === lwp.lead_id);
            if (!leadCosting) return sum;
            const costItems = leadCosting.items || [];
            const subtotal = costItems.reduce((s, item) => s + (item.amount * (item.quantity || 1)), 0);
            let gst = 0, tcs = 0;
            if (lwp.lead.tour_region === TourRegion.Domestic) {
                gst = subtotal * 0.05;
            } else if (lwp.lead.tour_region === TourRegion.International) {
                tcs = subtotal * 0.05;
            }
            const totalCost = subtotal + gst + tcs;
            return sum + (totalCost / (lwp.lead.assigned_to?.length || 1));
        }, 0);

        const totalExpenses = staffLeadsList.reduce((sum, lwp) => {
            const leadTransactions = (transactions || []).filter(t => t.lead_id === lwp.lead_id);
            const expenses = leadTransactions
                .filter(t => t.type === TransactionType.Expense && t.status === TransactionApprovalStatus.Approved)
                .reduce((s, t) => s + t.amount, 0);
            return sum + (expenses / (lwp.lead.assigned_to?.length || 1));
        }, 0);

        return {
            staff: staffMember,
            performance,
            rankingRow,
            leads: staffLeadsList,
            profitBreakdown: {
                totalIncome,
                totalCosts,
                totalExpenses,
                netProfit: totalProfit
            }
        };
    }, [selectedStaffId, staff, staffSummaryData, staffRankingData, staffLeads, transactions, leadCostings, leads]);

    return (
        <React.Fragment>
            <div className="bg-white p-6 rounded-lg shadow-sm space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <h1 className="text-2xl font-bold text-slate-800">Performance Reports</h1>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 flex-wrap">
                        <input
                            type="date"
                            value={draftStartDate}
                            onChange={e => setDraftStartDate(e.target.value)}
                            className="p-2 border border-slate-300 rounded-md text-sm"
                        />
                        <span className="text-slate-500">to</span>
                        <input
                            type="date"
                            value={draftEndDate}
                            onChange={e => setDraftEndDate(e.target.value)}
                            className="p-2 border border-slate-300 rounded-md text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => { setStartDate(draftStartDate); setEndDate(draftEndDate); }}
                            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        >
                            Save
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const end = new Date().toISOString().split('T')[0];
                                const start = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
                                setDraftStartDate(start);
                                setDraftEndDate(end);
                                setStartDate(start);
                                setEndDate(end);
                            }}
                            className="px-4 py-2 text-sm font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                        >
                            Reset
                        </button>
                        <div className="text-sm text-slate-600">Range: {startDate} — {endDate}</div>
                    </div>
                </div>
                <div className="border-b border-slate-200">
                    <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                        <button
                            onClick={() => setActiveTab('staff')}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'staff'
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Staff Report
                        </button>
                        <button
                            onClick={() => setActiveTab('branch')}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'branch'
                                ? 'border-blue-600 text-blue-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Branch Report
                        </button>
                    </nav>
                </div>
                {activeTab === 'staff' ? (
                    <div className="overflow-x-auto border rounded-lg">
                        {loading ? (
                            <div className="text-center p-16">Loading report data...</div>
                        ) : staffSummaryData.length === 0 ? (
                            <div className="text-center p-16 text-slate-500">
                                No performance data available for the selected date range.
                            </div>
                        ) : (
                            renderStaffSummary()
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto border rounded-lg">
                        {loading ? (
                            <div className="text-center p-16">Loading report data...</div>
                        ) : branchSummaryData.length === 0 ? (
                            <div className="text-center p-16 text-slate-500">
                                No performance data available for the selected date range.
                            </div>
                        ) : (
                            renderBranchSummary()
                        )}
                    </div>
                )}
            </div>

            {/* Detailed Staff Report Drawer */}
            {isDrawerOpen && selectedStaffId && selectedStaffData && (
                <div className="fixed inset-0 z-50" style={{ pointerEvents: 'auto' }}>
                    <div
                        className={`absolute inset-0 bg-black transition-opacity duration-300 ${isDrawerClosing ? 'opacity-0' : 'opacity-40'}`}
                        onClick={handleCloseDrawer}
                        style={{ pointerEvents: 'auto' }}
                    ></div>
                    <div
                        className={`absolute inset-y-0 right-0 w-full max-w-4xl bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-out ${isDrawerOpenState && !isDrawerClosing ? 'translate-x-0' : 'translate-x-full'}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{ pointerEvents: 'auto' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                            <div className="flex items-center gap-4">
                                {selectedStaffData.staff?.avatar_url ? (
                                    <img
                                        src={selectedStaffData.staff.avatar_url}
                                        alt={selectedStaffData.staff.name}
                                        className="h-12 w-12 rounded-full border-2 border-white/30 object-cover"
                                    />
                                ) : (
                                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg border-2 border-white/30">
                                        {selectedStaffData.staff?.name?.charAt(0).toUpperCase() || 'S'}
                                    </div>
                                )}
                                <div>
                                    <h2 className="text-xl font-bold">{selectedStaffData.staff?.name || 'Staff Member'}</h2>
                                    <p className="text-sm text-blue-100">
                                        {branches.find(b => b.id === selectedStaffData.staff?.branch_id)?.name || 'Unknown Branch'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={handleCloseDrawer} className="p-2 rounded-full hover:bg-white/20 transition-colors">
                                <IconX className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="border-b border-slate-200 bg-white">
                            <nav className="flex space-x-6 px-6" aria-label="Tabs">
                                <button
                                    onClick={() => setDrawerTab('overview')}
                                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                        drawerTab === 'overview'
                                            ? 'border-blue-600 text-blue-700'
                                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    Overview
                                </button>
                                <button
                                    onClick={() => setDrawerTab('daily-tracking')}
                                    className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                                        drawerTab === 'daily-tracking'
                                            ? 'border-blue-600 text-blue-700'
                                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                    }`}
                                >
                                    Daily Tracking
                                </button>
                            </nav>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                            {drawerTab === 'overview' ? (
                                <div className="space-y-6">
                                    {/* Performance Summary Cards (all-time, same as ranking) */}
                                    {selectedStaffData.rankingRow && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                    <div className="bg-white p-5 rounded-lg border border-slate-50">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-normal text-slate-400">Total Leads</span>
                                        </div>
                                        <p className="text-3xl font-semibold text-slate-500">{selectedStaffData.rankingRow.total_leads}</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-lg border border-slate-50">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-normal text-slate-400">Attending</span>
                                        </div>
                                        <p className="text-3xl font-semibold text-slate-500">{selectedStaffData.rankingRow.leads_attending}</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-lg border border-slate-50">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-normal text-slate-400">Completed</span>
                                        </div>
                                        <p className="text-3xl font-semibold text-slate-500">{selectedStaffData.rankingRow.leads_completed}</p>
                                    </div>
                                    <div className="bg-white p-5 rounded-lg border border-slate-50">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-normal text-slate-400">Rejected</span>
                                        </div>
                                        <p className="text-3xl font-semibold text-slate-500">{selectedStaffData.rankingRow.leads_rejected}</p>
                                    </div>
                                    <div className="p-5 bg-blue-50/30 rounded-lg border border-blue-100/50">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-normal text-slate-400">Performance Rate</span>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <p className="text-3xl font-semibold text-blue-600/80">
                                                {selectedStaffData.rankingRow.total_leads > 0 ? `${selectedStaffData.rankingRow.performance_rate.toFixed(1)}%` : '--'}
                                            </p>
                                            <div className="w-20 bg-blue-100/50 rounded-full h-1 mb-2">
                                                <div
                                                    className="h-1 rounded-full transition-all bg-blue-400/70"
                                                    style={{ width: `${Math.min(Math.max(selectedStaffData.rankingRow.performance_rate, 0), 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Profit & Loss Breakdown */}
                            {selectedStaffData.profitBreakdown && (
                                <div className="bg-white p-6 rounded-lg border border-slate-50">
                                    <h3 className="text-lg font-normal text-slate-400 mb-4">Profit & Loss Breakdown</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="p-5 bg-green-50/30 rounded-lg border border-green-100/50">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="h-10 w-10 rounded-full bg-green-100/50 flex items-center justify-center shrink-0">
                                                    <svg className="w-4 h-4 text-green-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-normal text-slate-400">Total Income</p>
                                                </div>
                                            </div>
                                            <p className="text-2xl font-semibold text-green-600/80">
                                                ₹{selectedStaffData.profitBreakdown.totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>

                                        <div className="p-5 bg-red-50/30 rounded-lg border border-red-100/50">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="h-10 w-10 rounded-full bg-red-100/50 flex items-center justify-center shrink-0">
                                                    <svg className="w-4 h-4 text-red-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                                    </svg>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-normal text-slate-400">Total Costs</p>
                                                </div>
                                            </div>
                                            <p className="text-2xl font-semibold text-red-600/80">
                                                ₹{selectedStaffData.profitBreakdown.totalCosts.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>

                                        <div className="p-5 bg-orange-50/30 rounded-lg border border-orange-100/50">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="h-10 w-10 rounded-full bg-orange-100/50 flex items-center justify-center shrink-0">
                                                    <svg className="w-4 h-4 text-orange-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                    </svg>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-normal text-slate-400">Total Expenses</p>
                                                </div>
                                            </div>
                                            <p className="text-2xl font-semibold text-orange-600/80">
                                                ₹{selectedStaffData.profitBreakdown.totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>

                                        <div className={`p-5 rounded-lg border ${selectedStaffData.profitBreakdown.netProfit >= 0 ? 'bg-green-50/30 border-green-100/50' : 'bg-red-50/30 border-red-100/50'}`}>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${selectedStaffData.profitBreakdown.netProfit >= 0 ? 'bg-green-100/50' : 'bg-red-100/50'}`}>
                                                    {selectedStaffData.profitBreakdown.netProfit >= 0 ? (
                                                        <svg className={`w-4 h-4 ${selectedStaffData.profitBreakdown.netProfit >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4 text-red-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-normal text-slate-400">Net Profit/Loss</p>
                                                </div>
                                            </div>
                                            <p className={`text-2xl font-semibold ${selectedStaffData.profitBreakdown.netProfit >= 0 ? 'text-green-600/80' : 'text-red-600/80'}`}>
                                                {selectedStaffData.profitBreakdown.netProfit >= 0 ? '+' : ''}₹{selectedStaffData.profitBreakdown.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                                    {/* Detailed Leads Breakdown */}
                                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Leads Breakdown</h3>
                                        {selectedStaffData.leads.length === 0 ? (
                                            <div className="text-center p-12 text-slate-500">
                                                No leads with profit/loss found for the selected date range.
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left text-slate-500">
                                                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
                                                        <tr>
                                                            <th className="px-4 py-3">MTS ID</th>
                                                            <th className="px-4 py-3">Customer Name</th>
                                                            <th className="px-4 py-3">Destination</th>
                                                            <th className="px-4 py-3">Status</th>
                                                            <th className="px-4 py-3 text-right">Profit/Loss</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedStaffData.leads.map((leadWithProfit) => {
                                                            const isProfit = leadWithProfit.profit_made >= 0;
                                                            return (
                                                                <tr
                                                                    key={leadWithProfit.lead_id}
                                                                    className="border-b hover:bg-slate-50"
                                                                >
                                                                    <td className="px-4 py-3 font-semibold text-slate-800 font-mono text-xs">
                                                                        {generateBookingId(leadWithProfit.lead)}
                                                                    </td>
                                                                    <td className="px-4 py-3">{leadWithProfit.customer_name}</td>
                                                                    <td className="px-4 py-3">{leadWithProfit.lead.destination}</td>
                                                                    <td className="px-4 py-3">
                                                                        <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                                                            {leadWithProfit.lead.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                                                        {isProfit ? '+' : ''}₹{leadWithProfit.profit_made.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                                    {/* Daily Tracking Table */}
                                    <div className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-slate-800">Daily Tracking</h3>
                                            
                                            {/* Filters */}
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="date"
                                                    value={dailyTrackingFilterStartDate}
                                                    onChange={(e) => {
                                                        setDailyTrackingFilterStartDate(e.target.value);
                                                        setDailyTrackingPage(1);
                                                    }}
                                                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                                                    placeholder="Start Date"
                                                />
                                                <span className="text-slate-500">to</span>
                                                <input
                                                    type="date"
                                                    value={dailyTrackingFilterEndDate}
                                                    onChange={(e) => {
                                                        setDailyTrackingFilterEndDate(e.target.value);
                                                        setDailyTrackingPage(1);
                                                    }}
                                                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                                                    placeholder="End Date"
                                                />
                                                <select
                                                    value={dailyTrackingSortBy}
                                                    onChange={(e) => {
                                                        setDailyTrackingSortBy(e.target.value as any);
                                                        setDailyTrackingPage(1);
                                                    }}
                                                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-md"
                                                >
                                                    <option value="date">Sort by Date</option>
                                                    <option value="first_login">Sort by First Login</option>
                                                    <option value="last_login">Sort by Last Active</option>
                                                    <option value="active_time">Sort by Active Time</option>
                                                </select>
                                                <button
                                                    onClick={() => setDailyTrackingSortOrder(dailyTrackingSortOrder === 'asc' ? 'desc' : 'asc')}
                                                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50"
                                                >
                                                    {dailyTrackingSortOrder === 'asc' ? '↑' : '↓'}
                                                </button>
                                            </div>
                                        </div>

                                        {sessionLoading ? (
                                            <div className="text-center p-8 text-slate-500">Loading session data...</div>
                                        ) : !Array.isArray(sessionData) || sessionData.length === 0 ? (
                                            <div className="text-center p-8 text-slate-500">
                                                No session data available for the selected date range.
                                            </div>
                                        ) : (() => {
                                            // Filter and sort data
                                            let filteredData = [...sessionData];
                                            
                                            // Apply date filters
                                            if (dailyTrackingFilterStartDate) {
                                                filteredData = filteredData.filter(s => s.date >= dailyTrackingFilterStartDate);
                                            }
                                            if (dailyTrackingFilterEndDate) {
                                                filteredData = filteredData.filter(s => s.date <= dailyTrackingFilterEndDate);
                                            }
                                            
                                            // Sort data
                                            filteredData.sort((a, b) => {
                                                let aVal: any, bVal: any;
                                                
                                                switch (dailyTrackingSortBy) {
                                                    case 'date':
                                                        aVal = new Date(a.date).getTime();
                                                        bVal = new Date(b.date).getTime();
                                                        break;
                                                    case 'first_login':
                                                        aVal = a.first_login_time ? new Date(a.first_login_time).getTime() : 0;
                                                        bVal = b.first_login_time ? new Date(b.first_login_time).getTime() : 0;
                                                        break;
                                                    case 'last_login':
                                                        // Sort by last_activity_time (Last Active)
                                                        aVal = a.last_activity_time ? new Date(a.last_activity_time).getTime() : 0;
                                                        bVal = b.last_activity_time ? new Date(b.last_activity_time).getTime() : 0;
                                                        break;
                                                    case 'active_time':
                                                        aVal = a.total_active_seconds || 0;
                                                        bVal = b.total_active_seconds || 0;
                                                        break;
                                                    default:
                                                        aVal = 0;
                                                        bVal = 0;
                                                }
                                                
                                                if (dailyTrackingSortOrder === 'asc') {
                                                    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                                                } else {
                                                    return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
                                                }
                                            });
                                            
                                            // Pagination
                                            const totalPages = Math.ceil(filteredData.length / dailyTrackingPageSize);
                                            const startIndex = (dailyTrackingPage - 1) * dailyTrackingPageSize;
                                            const paginatedData = filteredData.slice(startIndex, startIndex + dailyTrackingPageSize);
                                            
                                            return (
                                                <div>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-slate-50 border-b-2 border-slate-200">
                                                                <tr>
                                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Date</th>
                                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">First Login</th>
                                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Last Active</th>
                                                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Total Active Time</th>
                                                                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">Current Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="bg-white divide-y divide-slate-100">
                                                                {paginatedData.map((session: any, index: number) => {
                                                                    const totalHours = Math.floor((session.total_active_seconds || 0) / 3600);
                                                                    const totalMinutes = Math.floor(((session.total_active_seconds || 0) % 3600) / 60);
                                                                    const formattedTime = totalHours > 0 || totalMinutes > 0 ? `${totalHours}h ${totalMinutes}m` : '--';
                                                                    
                                                                    const firstLogin = session.first_login_time 
                                                                        ? new Date(session.first_login_time).toLocaleString('en-IN', { 
                                                                            day: 'numeric', 
                                                                            month: 'short', 
                                                                            year: 'numeric',
                                                                            hour: '2-digit', 
                                                                            minute: '2-digit',
                                                                            hour12: true
                                                                        })
                                                                        : '--';
                                                                    
                                                                    const lastActive = session.last_activity_time 
                                                                        ? new Date(session.last_activity_time).toLocaleString('en-IN', { 
                                                                            day: 'numeric', 
                                                                            month: 'short', 
                                                                            year: 'numeric',
                                                                            hour: '2-digit', 
                                                                            minute: '2-digit',
                                                                            hour12: true
                                                                        })
                                                                        : '--';
                                                                    
                                                                    const isToday = session.date === new Date().toISOString().split('T')[0];
                                                                    const statusColor = session.session_status === 'active' ? 'bg-green-100 text-green-800' : 
                                                                                       session.session_status === 'idle' ? 'bg-yellow-100 text-yellow-800' : 
                                                                                       'bg-slate-100 text-slate-800';
                                                                    
                                                                    // Display status (active/idle only, no duration)
                                                                    const displayStatus = session.session_status === 'active' ? 'active' : 
                                                                                         session.session_status === 'idle' ? 'idle' : 
                                                                                         'N/A';

                                                                    return (
                                                                        <tr key={index} className={`hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-slate-700 font-medium">
                                                                                        {new Date(session.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                                    </span>
                                                                                    {isToday && (
                                                                                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Today</span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-3 whitespace-nowrap text-slate-700">{firstLogin}</td>
                                                                            <td className="px-4 py-3 whitespace-nowrap text-slate-700">{lastActive}</td>
                                                                            <td className="px-4 py-3 whitespace-nowrap text-right text-slate-700 font-medium">{formattedTime}</td>
                                                                            <td className="px-4 py-3 whitespace-nowrap text-center">
                                                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                                                                    {displayStatus}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    
                                                    {/* Pagination */}
                                                    {totalPages > 1 && (
                                                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                                                            <div className="text-sm text-slate-600">
                                                                Showing {startIndex + 1} to {Math.min(startIndex + dailyTrackingPageSize, filteredData.length)} of {filteredData.length} entries
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => setDailyTrackingPage(Math.max(1, dailyTrackingPage - 1))}
                                                                    disabled={dailyTrackingPage === 1}
                                                                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    Previous
                                                                </button>
                                                                <span className="px-3 py-1.5 text-sm text-slate-700">
                                                                    Page {dailyTrackingPage} of {totalPages}
                                                                </span>
                                                                <button
                                                                    onClick={() => setDailyTrackingPage(Math.min(totalPages, dailyTrackingPage + 1))}
                                                                    disabled={dailyTrackingPage === totalPages}
                                                                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    Next
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </React.Fragment>
    );
};

export default Reports;