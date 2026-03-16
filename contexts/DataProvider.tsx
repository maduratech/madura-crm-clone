import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Lead, Customer, Staff, Branch, Itinerary, ItineraryMetadata, Supplier, Invoice, Payment, Transaction, LeadCosting, Destination, Sightseeing, SubAgentRegistration, Visa, JobApplicant, Transfer, TransferType, RoleTag, LeadStatus, LeadType, Task, Notification, LeaveApplication, LoggedInUser, isSuperAdmin, isTaskManager } from '../types';
import { useToast } from '../components/ToastProvider';
import { useAuth } from './AuthProvider';
import { AuthApiError } from '@supabase/supabase-js';

/** Rows per page in Leads table UI. */
const INITIAL_LEADS_PAGE = 50;
/** First chunk of minimal leads (fast first paint in 1–2s); then more chunks load in background. */
const INITIAL_LEADS_CHUNK = 100;
/** Each background chunk of minimal leads. */
const LOAD_MORE_LEADS_CHUNK = 100;

interface DataContextType {
  leads: Lead[];
  /** Total visible lead count (known after minimal fetch). Used for "Showing 1 to 50 of 776". */
  totalLeadCount: number;
  /** True while more leads are being loaded in the background after initial page. */
  leadsLoadingMore: boolean;
  customers: Customer[];
  staff: Staff[];
  branches: Branch[];
  itineraries: ItineraryMetadata[];
  suppliers: Supplier[];
  invoices: Invoice[];
  // FIX: Added 'payments' to the context type to make it available to consumers.
  payments: Payment[];
  transactions: Transaction[];
  leadCostings: LeadCosting[];
  destinations: Destination[];
  sightseeing: Sightseeing[];
  subAgentRegistrations: SubAgentRegistration[];
  visas: Visa[];
  jobApplicants: JobApplicant[];
  transfers: Transfer[];
  transferTypes: TransferType[];
  roleTags: RoleTag[];
  tasks: Task[];
  notifications: Notification[];
  leaveApplications: LeaveApplication[];
  loading: boolean;
  error: string | null;
  loadingTasks: boolean;
  loadingNotifications: boolean;
  loadingLeaveApplications: boolean;
  // Loading states for lazy-loaded data
  loadingDestinations: boolean;
  loadingSightseeing: boolean;
  loadingInvoices: boolean;
  loadingPayments: boolean;
  loadingTransactions: boolean;
  loadingSubAgentRegistrations: boolean;
  loadingVisas: boolean;
  loadingJobApplicants: boolean;
  loadingTransfers: boolean;
  loadingTransferTypes: boolean;
  fetchData: (forceRefresh?: boolean) => Promise<void>;
  refreshData: () => Promise<void>;
  refreshDestinations: () => Promise<void>;
  refreshSightseeing: () => Promise<void>;
  fetchInvoices: (forceRefresh?: boolean) => Promise<void>;
  fetchPayments: (forceRefresh?: boolean) => Promise<void>;
  fetchTransactions: (forceRefresh?: boolean) => Promise<void>;
  fetchItineraryVersions: (itineraryId: number) => Promise<any[]>;
  fetchLeadCostings: (forceRefresh?: boolean) => Promise<void>;
  fetchBranchDetails: (branchId: number) => Promise<{ bankDetails: any[]; terms: any[]; cancellationPolicy: any[] }>;
  fetchSubAgentRegistrations: (forceRefresh?: boolean) => Promise<void>;
  fetchVisas: (forceRefresh?: boolean) => Promise<void>;
  fetchJobApplicants: (forceRefresh?: boolean) => Promise<void>;
  fetchTransfers: (forceRefresh?: boolean) => Promise<void>;
  fetchTransferTypes: (forceRefresh?: boolean) => Promise<void>;
  fetchRoleTags: (forceRefresh?: boolean) => Promise<void>;
  fetchTasks: (forceRefresh?: boolean) => Promise<void>;
  fetchNotifications: (forceRefresh?: boolean) => Promise<void>;
  removeNotifications: (ids: string[]) => void;
  fetchLeaveApplications: (forceRefresh?: boolean) => Promise<void>;
  updateLeaveApplication: (id: string, patch: Partial<LeaveApplication>) => void;
  /** All leads in DB (no visibility filter) for Top Performing / ranking – same for all users */
  allLeadsForRanking: Lead[];
  loadingAllLeadsForRanking: boolean;
  fetchAllLeadsForRanking: (forceRefresh?: boolean) => Promise<void>;
  /** Update a single lead in the list (e.g. after save) so the UI updates without full refresh */
  updateLeadInPlace: (lead: Lead) => void;
  /** Add a new lead to the list (e.g. after create) so it appears without full refresh */
  addLeadInPlace: (lead: Lead) => void;
  /** Fetch one customer with activity and documents (for detail panel; initial list omits these to avoid 500/timeout). */
  fetchCustomerById: (customerId: number) => Promise<Customer | null>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

/** Today's date as YYYY-MM-DD (local). */
function getTodayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeDate(s: string | undefined): string | null {
  if (!s) return null;
  const part = s.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(part)) return part;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDurationNights(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = String(duration).match(/(\d+)/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isNaN(n) ? null : n;
}

function addDaysToDateString(dateString: string, days: number): string | null {
  const base = new Date(dateString);
  if (Number.isNaN(base.getTime())) return null;
  const updated = new Date(base);
  updated.setDate(updated.getDate() + days);
  return updated.toISOString().split('T')[0];
}

/** End service date: return_date if set, else travel_date + duration (nights). */
function getEndServiceDate(lead: { return_date?: string; travel_date?: string; duration?: string }): string | null {
  const ret = normalizeDate(lead.return_date);
  if (ret) return ret;
  if (!lead.travel_date) return null;
  const nights = parseDurationNights(lead.duration);
  if (nights === null) return null;
  return addDaysToDateString(lead.travel_date, nights);
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Auto-update lead status by date: Voucher → On Travel when date of travel is today;
 * On Travel → Feedback only when return/end service date is reached AND lead has been On Travel for at least 24h (manual change can be anytime).
 * Only updates leads in Voucher or On Travel status. Patches the passed array and returns it.
 */
async function syncLeadStatusByDate(leads: any[]): Promise<any[]> {
  const today = getTodayDateString();
  const now = Date.now();
  const result = leads.map(l => ({ ...l }));

  for (let i = 0; i < result.length; i++) {
    const lead = result[i];

    if (lead.status === LeadStatus.Voucher && lead.travel_date) {
      const travelDateNorm = normalizeDate(lead.travel_date);
      if (travelDateNorm === today) {
        const onTravelSince = new Date().toISOString();
        const { error } = await supabase.from('leads').update({ status: LeadStatus.OnTour, lead_type: LeadType.Warm, on_travel_since: onTravelSince }).eq('id', lead.id);
        if (!error) {
          result[i] = { ...result[i], status: LeadStatus.OnTour, lead_type: LeadType.Warm, on_travel_since: onTravelSince };
        }
      }
    }

    if (lead.status === LeadStatus.OnTour) {
      const endDate = getEndServiceDate(lead);
      if (!endDate || endDate > today) continue;
      // Automated Feedback: only after 24h in On Travel (manual change is not restricted)
      const onTravelSince = lead.on_travel_since ? new Date(lead.on_travel_since).getTime() : 0;
      if (onTravelSince && now - onTravelSince < TWENTY_FOUR_HOURS_MS) continue;

      const updates: Record<string, unknown> = { status: LeadStatus.Feedback, lead_type: LeadType.Warm };
      if (!lead.return_date && endDate) updates.return_date = endDate;
      const { error } = await supabase.from('leads').update(updates).eq('id', lead.id);
      if (!error) {
        result[i] = { ...result[i], ...updates };
      }
    }
  }

  return result;
}

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Data provider for managing CRM data state
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeadCount, setTotalLeadCount] = useState(0);
  const [leadsLoadingMore, setLeadsLoadingMore] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [itineraries, setItineraries] = useState<ItineraryMetadata[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  // FIX: Added state for payments data.
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [leadCostings, setLeadCostings] = useState<LeadCosting[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [sightseeing, setSightseeing] = useState<Sightseeing[]>([]);
  const [subAgentRegistrations, setSubAgentRegistrations] = useState<SubAgentRegistration[]>([]);
  const [visas, setVisas] = useState<Visa[]>([]);
  const [jobApplicants, setJobApplicants] = useState<JobApplicant[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transferTypes, setTransferTypes] = useState<TransferType[]>([]);
  const [roleTags, setRoleTags] = useState<RoleTag[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [leaveApplications, setLeaveApplications] = useState<LeaveApplication[]>([]);
  const [allLeadsForRanking, setAllLeadsForRanking] = useState<Lead[]>([]);
  const [loadingAllLeadsForRanking, setLoadingAllLeadsForRanking] = useState(false);

  // Loading states for lazy-loaded data
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [loadingLeaveApplications, setLoadingLeaveApplications] = useState(false);
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [loadingSightseeing, setLoadingSightseeing] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [loadingSubAgentRegistrations, setLoadingSubAgentRegistrations] = useState(false);
  const [loadingVisas, setLoadingVisas] = useState(false);
  const [loadingJobApplicants, setLoadingJobApplicants] = useState(false);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [loadingTransferTypes, setLoadingTransferTypes] = useState(false);

  const { addToast } = useToast();
  const { session, signOut, profile } = useAuth();

  /** Whether the current user can see this task (Super Admin / Task Manager see all; others only created by or assigned to). */
  const isTaskInScope = useCallback((task: Task, user: LoggedInUser | null) => {
    if (!user) return false;
    if (isSuperAdmin(user) || isTaskManager(user)) return true;
    if (task.created_by_staff_id === user.id) return true;
    const assignees = task.task_assignees || [];
    if (assignees.some((a: any) => a.staff_id === user.id)) return true;
    return false;
  }, []);

  const isMounted = useRef(true);
  const isFetching = useRef(false);
  const fetchAbortController = useRef<AbortController | null>(null);
  const dataCache = useRef<any>(null);
  const cacheTimestamp = useRef<number>(0);
  const destinationsCache = useRef<Destination[] | null>(null);
  const sightseeingCache = useRef<Sightseeing[] | null>(null);
  const invoicesCache = useRef<Invoice[] | null>(null);
  const paymentsCache = useRef<Payment[] | null>(null);
  const transactionsCache = useRef<Transaction[] | null>(null);
  const destinationsCacheTimestamp = useRef<number>(0);
  const sightseeingCacheTimestamp = useRef<number>(0);
  const invoicesCacheTimestamp = useRef<number>(0);
  const paymentsCacheTimestamp = useRef<number>(0);
  const transactionsCacheTimestamp = useRef<number>(0);
  const isFetchingDestinations = useRef(false);
  const isFetchingSightseeing = useRef(false);
  const isFetchingInvoices = useRef(false);
  const isFetchingPayments = useRef(false);
  const isFetchingTransactions = useRef(false);
  const visasCache = useRef<Visa[] | null>(null);
  const jobApplicantsCache = useRef<JobApplicant[] | null>(null);
  const visasCacheTimestamp = useRef<number>(0);
  const jobApplicantsCacheTimestamp = useRef<number>(0);
  const isFetchingVisas = useRef(false);
  const isFetchingJobApplicants = useRef(false);
  const transfersCache = useRef<Transfer[] | null>(null);
  const transferTypesCache = useRef<TransferType[] | null>(null);
  const transfersCacheTimestamp = useRef<number>(0);
  const transferTypesCacheTimestamp = useRef<number>(0);
  const isFetchingTransfers = useRef(false);
  const isFetchingTransferTypes = useRef(false);
  const allLeadsForRankingCache = useRef<Lead[] | null>(null);
  const allLeadsForRankingTimestamp = useRef<number>(0);
  const isFetchingAllLeadsForRanking = useRef(false);
  /** Full itineraries list for non–Super Admin; used to re-filter when background leads load. */
  const rawItinerariesForStaffRef = useRef<ItineraryMetadata[] | null>(null);

  // Gmail-like: no refetch on tab/focus; only on Realtime changes or manual refresh (longer cache = less Disk I/O)
  const CACHE_DURATION_ACTIVE = 45 * 60 * 1000; // 45 min for main data – reduces Supabase Disk I/O
  const CACHE_DURATION_LIST = 45 * 60 * 1000; // 45 min for list data (invoices, payments, transactions)
  const CACHE_DURATION_STATIC = 15 * 60 * 1000; // 15 min for static data (staff, branches, destinations, sightseeing)
  const CACHE_DURATION_SEMI_STATIC = 5 * 60 * 1000; // 5 min for semi-static data (customers, suppliers, itineraries)

  // Main cache duration (used for overall cache check - shortest duration ensures fresh data)
  const CACHE_DURATION = CACHE_DURATION_ACTIVE;

  const fetchData = useCallback(async (forceRefresh: boolean = false, retryCount = 0) => {
    if (isFetching.current && retryCount === 0) return;
    if (!session?.access_token || !isMounted.current) {
      if (isMounted.current) setIsInitialLoading(false);
      // Wait a bit and retry if session is not ready yet
      if (profile && !session?.access_token) {
        setTimeout(() => fetchData(forceRefresh, 0), 200);
      }
      return;
    }

    if (!forceRefresh && dataCache.current && (Date.now() - cacheTimestamp.current) < CACHE_DURATION && retryCount === 0) {
      const cached = dataCache.current;
      const cachedLeads = cached.leads || [];
      setLeads(cachedLeads);
      setTotalLeadCount((cached as any).totalLeadCount ?? cachedLeads.length);
      setLeadsLoadingMore(false);
      setCustomers(cached.customers || []);
      setStaff(cached.staff || []);
      setBranches(cached.branches || []);
      setItineraries(cached.itineraries || []);
      setSuppliers(cached.suppliers || []);
      // Do not overwrite lazy-loaded data: invoices, payments, transactions are not in main cache; keep current state
      if (cached.invoices !== undefined) setInvoices(cached.invoices);
      if (cached.payments !== undefined) setPayments(cached.payments);
      if (cached.transactions !== undefined) setTransactions(cached.transactions);
      setLeadCostings(cached.leadCostings || []);
      setIsInitialLoading(false);
      setError(null);
      return;
    }

    // Load cached destinations and sightseeing if available (static data - 10min cache)
    if (destinationsCache.current && (Date.now() - destinationsCacheTimestamp.current) < CACHE_DURATION_STATIC) {
      setDestinations(destinationsCache.current);
    }
    if (sightseeingCache.current && (Date.now() - sightseeingCacheTimestamp.current) < CACHE_DURATION_STATIC) {
      setSightseeing(sightseeingCache.current);
    }

    isFetching.current = true;
    setError(null);

    // Add delay for retries
    if (retryCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
    }

    fetchAbortController.current = new AbortController();
    const { signal } = fetchAbortController.current;
    rawItinerariesForStaffRef.current = null;

    try {
      // Progressive load: first 100 minimal for fast first paint (1–2s); rest in background
      const minimalLeadsQuery = supabase
        .from('leads')
        .select('id, created_at, branch_ids, customer_id')
        .order('created_at', { ascending: false })
        .range(0, INITIAL_LEADS_CHUNK - 1)
        .abortSignal(signal);

      // Customers: lighter initial load (no activity/documents) + limit to avoid 500/timeout for non–super-admin RLS
      const customersQuery = supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone, avatar_url, company, nationality, tours_completed, total_transactions, balance_due, address, notes, added_by_id, date_added, created_at, date_of_birth, passport_number, passport_expiry_date, passport_issue_date, aadhaar_number, pan_number, place_of_birth, gst_number, shared_with_branch_ids, added_by_branch_id')
        .order('created_at', { ascending: false })
        .limit(5000)
        .abortSignal(signal);
      const otherQueries = [
        customersQuery,
        supabase.from('staff').select('id, user_id, staff_no, name, avatar_url, email, phone, extension_no, role_id, status, branch_id, leads_attended, leads_missed, avg_response_time, last_response_at, last_active_at, work_hours_today, on_leave_until, destinations, services, excluded_destinations, excluded_services, is_lead_manager, manage_lead_branches, is_task_manager').abortSignal(signal),
        supabase.from('branches').select('id, name, address, logo_url, seal_signature_url, letterhead_image_url, front_page_image_url, final_page_image_url, primary_contact, primary_email, admin_id, notes, status, welcome_email_template, itinerary_pdf_template, razorpay_link').abortSignal(signal),
        supabase.from('itineraries').select('id, lead_id, customer_id, creative_title, duration, created_at, created_by_staff_id, branch_id, is_final, tour_completion_date, costing_options, modified_at, cover_image_url, gallery_image_urls, status, destination, travel_date, adults, children, infants, starting_point, show_payment_button, display_currency, itinerary_versions(version_number, grand_total)').abortSignal(signal),
        supabase.from('suppliers').select('id, company_name, phone, email, destinations, contact_person_name, contact_person_phone, contact_person_avatar_url, status, branch_id, created_at, created_by_staff_id, is_verified, category, location, website, b2b_login_credentials, contract_link, notes, visiting_card_url').abortSignal(signal),
        supabase.from('bank_details').select('id, branch_id, bank_name, branch_name, account_number, ifsc_code, is_default, gstin, cheque_instructions').abortSignal(signal),
        supabase.from('terms_and_conditions').select('*').abortSignal(signal),
        supabase.from('cancellation_policy').select('*').abortSignal(signal),
        supabase.from('lead_costings').select('*').limit(3000).abortSignal(signal),
      ];

      const [leadsRes, ...otherResults] = await Promise.allSettled([
        minimalLeadsQuery,
        ...otherQueries
      ]);

      // Minimal leads query errors are intentionally not logged to avoid noisy console output

      const minimalLeads: any[] = (leadsRes.status === 'fulfilled' && leadsRes.value?.data && !leadsRes.value?.error) ? leadsRes.value.data : [];
      const leadIds = minimalLeads.map((l: any) => l.id);

      // Build lead_id -> staff_id[] for visibility (no full staff objects needed)
      const assigneesStaffIdsMap = new Map<number, number[]>();
      if (leadIds.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < leadIds.length; i += chunkSize) {
          const chunk = leadIds.slice(i, i + chunkSize);
          const { data: rows } = await supabase.from('lead_assignees').select('lead_id, staff_id').in('lead_id', chunk).abortSignal(signal);
          (rows || []).forEach((r: any) => {
            if (!assigneesStaffIdsMap.has(r.lead_id)) assigneesStaffIdsMap.set(r.lead_id, []);
            assigneesStaffIdsMap.get(r.lead_id)!.push(r.staff_id);
          });
        }
      }

      // Apply same visibility logic as below (using minimal lead + assigneesStaffIdsMap)
      const isLeadVisible = (lead: { id: number; branch_ids?: number[] }, staffMap: Map<number, any>) => {
        if (!profile || profile.role === 'Super Admin') return true;
        const isLeadManager = profile.is_lead_manager === true;
        const isBranch1 = Number(profile.branch_id) === 1;
        const staffIds = assigneesStaffIdsMap.get(lead.id) || [];
        const isAssignedToMe = staffIds.includes(profile.id);
        const isUnassigned = staffIds.length === 0;
        const leadBranchIds = lead.branch_ids || [];
        const isLeadFromMyBranch = leadBranchIds.includes(profile.branch_id);
        const isLeadFromBranch1 = leadBranchIds.includes(1);
        if (isLeadManager) return true;
        if (isBranch1 && !isLeadManager) {
          if (isAssignedToMe) return true;
          if (isUnassigned && isLeadFromBranch1) return true;
          return false;
        }
        if (!isBranch1) {
          const isManager = profile.role === 'Manager';
          if (isManager && isLeadFromMyBranch) return true;
          if (isAssignedToMe && isLeadFromMyBranch) return true;
          if (isUnassigned && isLeadFromMyBranch) return true;
          return false;
        }
        return false;
      };

      // Staff map not yet available; we only need profile.id for visibility. So we can run visibility without staffMap.
      const visibleMinimalLeads = minimalLeads.filter((l: any) => isLeadVisible(l, new Map()));
      const visibleLeadIds = visibleMinimalLeads.map((l: any) => l.id);
      const totalLeadCount = visibleLeadIds.length;

      // Fetch full lead data for all visible from first chunk (up to 100) so first paint shows them
      const firstPageIds = visibleLeadIds.slice();
      let leadsData: any[] = [];
      let assigneesRes: any = { data: [], error: null };
      let leadSuppliersRes: any = { data: [], error: null };

      if (firstPageIds.length > 0) {
        const { data: fullPage, error: fullErr } = await supabase
          .from('leads')
          .select('*')
          .in('id', firstPageIds)
          .abortSignal(signal);
        if (fullErr) {
          assigneesRes = { data: [], error: fullErr };
        } else {
          const orderMap = new Map(firstPageIds.map((id, i) => [id, i]));
          leadsData = (fullPage || []).slice().sort((a: any, b: any) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
        }

        const pageSize = 1000;
        const allAssignees: any[] = [];
        const allSuppliers: any[] = [];
        for (let aFrom = 0; ; aFrom += pageSize) {
          const aTo = aFrom + pageSize - 1;
          const { data: aData, error: aErr } = await supabase
            .from('lead_assignees')
            .select('lead_id, staff:staff_id(*)')
            .in('lead_id', firstPageIds)
            .range(aFrom, aTo)
            .abortSignal(signal);
          if (aErr) { assigneesRes = { data: allAssignees, error: aErr }; break; }
          const rows = aData || [];
          allAssignees.push(...rows);
          if (rows.length < pageSize) break;
        }
        if (!assigneesRes.error) assigneesRes = { data: allAssignees, error: null };
        for (let sFrom = 0; ; sFrom += pageSize) {
          const sTo = sFrom + pageSize - 1;
          const { data: sData, error: sErr } = await supabase
            .from('lead_suppliers')
            .select('*, suppliers(*)')
            .in('lead_id', firstPageIds)
            .range(sFrom, sTo)
            .abortSignal(signal);
          if (sErr) { leadSuppliersRes = { data: allSuppliers, error: sErr }; break; }
          const rows = sData || [];
          allSuppliers.push(...rows);
          if (rows.length < pageSize) break;
        }
        if (!leadSuppliersRes.error) leadSuppliersRes = { data: allSuppliers, error: null };
      }

      const results = [
        { status: 'fulfilled' as const, value: { data: leadsData, error: null } },
        ...otherResults
      ];

      if (!isMounted.current) return;

      // Handle errors: Required tables (first 10) must succeed, optional tables (last 2) can fail gracefully
      const requiredResults = results.slice(0, 10);
      const optionalResults = results.slice(10);

      // Check errors: leads, staff, branches, itineraries, suppliers must succeed; customers (index 1) can fail for non–super-admin (500/timeout)
      const requiredIndicesToThrow = [0, 2, 3, 4, 5];
      const requiredErrors = requiredResults.filter((r, index) => {
        if (!requiredIndicesToThrow.includes(index)) return false;
        if (r.status === 'rejected') return true;
        if (r.status === 'fulfilled' && r.value.error) {
          const isQuicError = r.value.error?.message?.includes("QUIC") ||
            r.value.error?.message?.includes("ERR_QUIC") ||
            r.value.error?.name === "QuicProtocolError";
          if (isQuicError && r.value.data && Array.isArray(r.value.data) && r.value.data.length > 0) {
            if (import.meta.env.DEV) console.warn('[DataProvider] QUIC protocol warning but data received:', r.value.error?.message);
            return false;
          }
          return true;
        }
        return false;
      });

      if (requiredErrors.length > 0) {
        const firstError = requiredErrors[0];
        if (firstError.status === 'rejected') throw firstError.reason;
        else if (firstError.status === 'fulfilled') throw firstError.value.error;
      }
      if (requiredResults[1]?.status === 'fulfilled' && (requiredResults[1].value as any).error && import.meta.env.DEV) {
        console.warn('[DataProvider] Customers query failed (app continues with empty list):', (requiredResults[1].value as any).error?.message || (requiredResults[1].value as any).error);
      }

      // Process all results, handling optional tables gracefully
      // Note: invoices, payments, transactions are now lazy-loaded separately
      const [leadsResProcessed, customersRes, staffRes, branchesRes, itinerariesRes, suppliersRes, bankDetailsRes, termsRes, cancellationPolicyRes, leadCostingsRes] = results.map((r, index) => {
        if (r.status === 'fulfilled') {
          // Check for QUIC errors - if we have data despite the error, use the data
          const isQuicError = r.value.error && (
            r.value.error?.message?.includes("QUIC") ||
            r.value.error?.message?.includes("ERR_QUIC") ||
            r.value.error?.name === "QuicProtocolError"
          );

          if (isQuicError && r.value.data && Array.isArray(r.value.data) && r.value.data.length > 0) {
            // QUIC error but we have data - use the data and ignore the error
            if (import.meta.env.DEV) {
              console.warn(`[DataProvider] QUIC protocol warning for table ${index} but data received, using data`);
            }
            return { data: r.value.data, error: null };
          }

          // Customers (index 1): non-fatal so non–super-admin can load (500/timeout on RLS)
          if (index === 1 && r.value.error) {
            return { data: [], error: null };
          }
          // For optional tables (index 7+), handle errors gracefully
          if (index >= 7 && r.value.error) {
            return { data: [], error: null };
          }
          // If table doesn't exist, Supabase will return an error - handle gracefully
          if (r.value.error && (r.value.error.message?.includes('relation') || r.value.error.message?.includes('does not exist'))) {
            return { data: [], error: null };
          }
          // IMPORTANT: For leads (index 0), if there's an error, still return the data if available
          // This ensures we don't lose leads data even if there's a minor error
          if (index === 0 && r.value.error && !r.value.data) {
            console.error('[DataProvider] Leads query failed with no data:', r.value.error);
            return { data: [], error: r.value.error };
          }
          return r.value;
        }
        // For rejected promises in optional tables, return empty data
        if (index >= 7) {
          return { data: [], error: null };
        }
        // For rejected promises in required tables (especially leads), log and return empty
        if (index === 0) {
          console.error('[DataProvider] Leads query promise rejected:', r);
        }
        return { data: [], error: null };
      });

      // Combine leads with their relationships (leadsData from first-page fetch above)
      // Build a quick lookup map for staff by id (used for assignees and elsewhere)
      const staffMap = new Map((staffRes.data || []).map((s: any) => [s.id, s]));

      const assigneesMap = new Map<number, any[]>();
      const suppliersMap = new Map<number, any[]>();

      // Build maps for quick lookup
      (assigneesRes.data || []).forEach((item: any) => {
        const leadId = item.lead_id;
        if (!assigneesMap.has(leadId)) {
          assigneesMap.set(leadId, []);
        }
        // Prefer joined staff(*) when available; otherwise fall back to staff_id lookup
        const staffMember = item.staff || (item.staff_id != null ? staffMap.get(item.staff_id) : null);
        if (staffMember) {
          assigneesMap.get(leadId)!.push(staffMember);
        }
      });

      (leadSuppliersRes.data || []).forEach((item: any) => {
        const leadId = item.lead_id;
        if (!suppliersMap.has(leadId)) {
          suppliersMap.set(leadId, []);
        }
        if (item.suppliers) {
          suppliersMap.get(leadId)!.push(item.suppliers);
        }
      });

      // Format leads with relationships (use first-page leadsData)
      let formattedLeads = (leadsResProcessed?.data || leadsData).map((l: any) => ({
        ...l,
        assigned_to: assigneesMap.get(l.id) || [],
        assigned_suppliers: suppliersMap.get(l.id) || []
      }));

      // Auto-update lead status by date: Voucher → On Travel when date of travel is today;
      // On Travel → Feedback when return date or (travel_date + duration) end date is today or in the past.
      formattedLeads = await syncLeadStatusByDate(formattedLeads);

      // Customers data processed

      const hydratedCustomers = (customersRes.data || []).map((c: any) => ({
        ...c,
        addedBy: staffMap.get(c.added_by_id) || null,
        date_added: c.date_added || c.created_at || new Date().toISOString(), // Use date_added if available, fallback to created_at
      }));

      const allBankDetails = bankDetailsRes.data || [];
      const allTerms = termsRes.data || [];
      const allCancellationPolicies = cancellationPolicyRes?.data || [];

      const hydratedBranches = (branchesRes.data || []).map((branch: Branch) => ({
        ...branch,
        bank_details: allBankDetails.filter(d => d.branch_id === branch.id),
        terms_and_conditions: allTerms.filter(t => t.branch_id === branch.id),
        cancellation_policy: allCancellationPolicies.filter(cp => cp.branch_id === branch.id),
      }));

      // 1. Filter Leads first
      let visibleLeads = formattedLeads;


      if (profile && profile.role !== 'Super Admin') {
        const isLeadManager = profile.is_lead_manager === true;
        const isBranch1 = Number(profile.branch_id) === 1;
        const managedBranchIds = profile.manage_lead_branches || [];

        visibleLeads = formattedLeads.filter((lead: Lead) => {
          const isUnassigned = !lead.assigned_to || lead.assigned_to.length === 0;
          const isAssignedToMe = lead.assigned_to && lead.assigned_to.some((assignee: Staff) => assignee.id === profile.id);
          const leadBranchIds = lead.branch_ids || [];
          const isLeadFromMyBranch = leadBranchIds.includes(profile.branch_id);
          const isLeadFromBranch1 = leadBranchIds.includes(1);

          // Lead Manager: see all leads (dashboard/revenue/payments show everything)
          if (isLeadManager) return true;

          // Branch 1 staff without lead manager: See assigned leads + unassigned from branch 1
          if (isBranch1 && !isLeadManager) {
            if (isAssignedToMe) {
              return true; // Assigned to me (regardless of branch)
            }
            if (isUnassigned && isLeadFromBranch1) {
              return true; // Unassigned from branch 1
            }
            return false;
          }

          // Staff from other branches: See assigned leads shared with their branch + unassigned from their branch
          // Managers from shared branches: See all leads from their branch
          if (!isBranch1) {
            const isManager = profile.role === 'Manager';

            // Managers from shared branches can see all leads from their branch
            if (isManager && isLeadFromMyBranch) {
              return true; // Manager can see all leads from their branch
            }

            // Regular staff: See assigned leads shared with their branch + unassigned from their branch
            if (isAssignedToMe && isLeadFromMyBranch) {
              return true; // Assigned to me and shared with my branch
            }
            if (isUnassigned && isLeadFromMyBranch) {
              return true; // Unassigned from my branch
            }
            return false;
          }

          return false;
        });
      }


      // 2. Filter Itineraries: show templates (no lead) to all; show lead-linked only if user can see that lead
      let visibleItineraries = itinerariesRes.data || [];
      if (profile && profile.role !== 'Super Admin') {
        const visibleLeadIds = new Set(visibleLeads.map((l: Lead) => l.id));
        visibleItineraries = visibleItineraries.filter((it: ItineraryMetadata) =>
          it.lead_id == null || visibleLeadIds.has(it.lead_id)
        );
        // Keep full list so we can re-filter when background leads load (initial visibleLeads is first chunk only)
        rawItinerariesForStaffRef.current = itinerariesRes.data || [];
      }

      // Note: Invoices, Payments, and Transactions are now lazy-loaded separately

      // 3. Filter Lead Costings based on Visible Leads
      let visibleLeadCostings = leadCostingsRes.data || [];
      if (profile && profile.role !== 'Super Admin') {
        const visibleLeadIds = new Set(visibleLeads.map((l: Lead) => l.id));
        visibleLeadCostings = visibleLeadCostings.filter((c: LeadCosting) =>
          (c.lead_id && visibleLeadIds.has(c.lead_id))
        );
      }

      // 4. Set core state first so dashboard/charts get leads and staff quickly; role_tags merged after
      const staffDataWithoutTags: any[] = staffRes.data || [];
      if (isMounted.current) {
        const newData = {
          leads: visibleLeads,
          totalLeadCount,
          customers: hydratedCustomers,
          staff: staffDataWithoutTags,
          branches: hydratedBranches,
          itineraries: visibleItineraries,
          suppliers: suppliersRes.data || [],
          leadCostings: visibleLeadCostings
        };
        setLeads(newData.leads);
        setTotalLeadCount(totalLeadCount);
        setCustomers(newData.customers);
        setStaff(newData.staff);
        setBranches(newData.branches);
        setItineraries(newData.itineraries);
        setSuppliers(newData.suppliers);
        setLeadCostings(newData.leadCostings);
        dataCache.current = newData;
      }

      // 5. Merge role_tags into staff (non-blocking for first paint)
      let staffData: any[] = staffDataWithoutTags;
      try {
        const [rtRes, srtRes] = await Promise.all([
          supabase.from('role_tags').select('id, name, slug, is_system, display_order').order('display_order'),
          supabase.from('staff_role_tags').select('staff_id, role_tag_id, role_tags(id, name, slug, is_system, display_order)')
        ]);
        const roleTagsList = (rtRes.data || []) as RoleTag[];
        const srtList = srtRes.data || [];
        if (isMounted.current) setRoleTags(roleTagsList);
        const staffIdToTags = new Map<number, RoleTag[]>();
        (srtList as any[]).forEach((srt: any) => {
          if (!staffIdToTags.has(srt.staff_id)) staffIdToTags.set(srt.staff_id, []);
          if (srt.role_tags) staffIdToTags.get(srt.staff_id)!.push(srt.role_tags);
        });
        staffData = staffDataWithoutTags.map((s: any) => ({ ...s, role_tags: staffIdToTags.get(s.id) || [] }));
        if (isMounted.current) {
          setStaff(staffData);
          if (dataCache.current) dataCache.current = { ...dataCache.current, staff: staffData };
        }
      } catch (_) {
        // role_tags / staff_role_tags tables may not exist yet
      }

      if (isMounted.current) {
        cacheTimestamp.current = Date.now();
        invoicesCache.current = null;
        paymentsCache.current = null;
        transactionsCache.current = null;
        allLeadsForRankingCache.current = null;
        setError(null);

        // Progressive load: fetch next chunks of 100 minimal in background, then full data; append silently
        if (isMounted.current) {
          setLeadsLoadingMore(true);
          (async () => {
            const staffMapForMerge = new Map((staffData || []).map((s: any) => [s.id, s]));
            const customerMapForMerge = new Map((hydratedCustomers || []).map((c: any) => [c.id, c]));
            let offset = INITIAL_LEADS_CHUNK;
            while (isMounted.current) {
              let minimalChunk: any[] = [];
              let minimalErr: any = null;
              try {
                const res = await supabase
                  .from('leads')
                  .select('id, created_at, branch_ids, customer_id')
                  .order('created_at', { ascending: false })
                  .range(offset, offset + LOAD_MORE_LEADS_CHUNK - 1)
                  .abortSignal(signal);
                minimalChunk = res.data || [];
                minimalErr = res.error;
              } catch (e) {
                if (import.meta.env.DEV) console.warn('[DataProvider] Background leads chunk error:', e);
                offset += LOAD_MORE_LEADS_CHUNK;
                continue;
              }
              if (minimalErr || !minimalChunk?.length) break;
              try {
                const chunkIds = minimalChunk.map((l: any) => l.id);
                const { data: assigneesRows } = await supabase.from('lead_assignees').select('lead_id, staff_id').in('lead_id', chunkIds).abortSignal(signal);
                const chunkAssigneesMap = new Map<number, number[]>();
                (assigneesRows || []).forEach((r: any) => {
                  if (!chunkAssigneesMap.has(r.lead_id)) chunkAssigneesMap.set(r.lead_id, []);
                  chunkAssigneesMap.get(r.lead_id)!.push(r.staff_id);
                });
                chunkAssigneesMap.forEach((ids, lid) => assigneesStaffIdsMap.set(lid, ids));
                const visibleChunk = minimalChunk.filter((l: any) => isLeadVisible(l, new Map()));
                const newVisibleIds = visibleChunk.map((l: any) => l.id);
                if (newVisibleIds.length === 0) {
                  offset += LOAD_MORE_LEADS_CHUNK;
                  if (minimalChunk.length < LOAD_MORE_LEADS_CHUNK) break;
                  continue;
                }
                const { data: chunkRows, error: fullErr } = await supabase.from('leads').select('*').in('id', newVisibleIds).abortSignal(signal);
                if (fullErr || !chunkRows?.length) {
                  offset += LOAD_MORE_LEADS_CHUNK;
                  if (minimalChunk.length < LOAD_MORE_LEADS_CHUNK) break;
                  continue;
                }
                const orderMap = new Map(newVisibleIds.map((id, i) => [id, i]));
                const sortedChunk = (chunkRows || []).slice().sort((a: any, b: any) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
                let aChunk: any[] = [];
                let sChunk: any[] = [];
                for (let aFrom = 0; ; aFrom += 1000) {
                  const { data: ad } = await supabase.from('lead_assignees').select('lead_id, staff:staff_id(*)').in('lead_id', newVisibleIds).range(aFrom, aFrom + 999).abortSignal(signal);
                  const rows = ad || [];
                  aChunk = aChunk.concat(rows);
                  if (rows.length < 1000) break;
                }
                for (let sFrom = 0; ; sFrom += 1000) {
                  const { data: sd } = await supabase.from('lead_suppliers').select('*, suppliers(*)').in('lead_id', newVisibleIds).range(sFrom, sFrom + 999).abortSignal(signal);
                  const rows = sd || [];
                  sChunk = sChunk.concat(rows);
                  if (rows.length < 1000) break;
                }
                const aMap = new Map<number, any[]>();
                (aChunk || []).forEach((item: any) => {
                  const leadId = item.lead_id;
                  if (!aMap.has(leadId)) aMap.set(leadId, []);
                  const staffMember = item.staff || (item.staff_id != null ? staffMapForMerge.get(item.staff_id) : null);
                  if (staffMember) aMap.get(leadId)!.push(staffMember);
                });
                const sMap = new Map<number, any[]>();
                (sChunk || []).forEach((item: any) => {
                  const leadId = item.lead_id;
                  if (!sMap.has(leadId)) sMap.set(leadId, []);
                  if (item.suppliers) sMap.get(leadId)!.push(item.suppliers);
                });
                let formatted = sortedChunk.map((l: any) => ({
                  ...l,
                  assigned_to: aMap.get(l.id) || [],
                  assigned_suppliers: sMap.get(l.id) || [],
                  customer: l.customer_id != null ? customerMapForMerge.get(l.customer_id) ?? null : null
                }));
                formatted = await syncLeadStatusByDate(formatted);
                if (!isMounted.current) break;
                setLeads(prev => {
                  const next = [...prev, ...formatted];
                  if (dataCache.current) dataCache.current = { ...dataCache.current, leads: next, totalLeadCount: next.length };
                  // Re-filter itineraries for staff: more visible leads now, so show itineraries for those leads too
                  const raw = rawItinerariesForStaffRef.current;
                  if (raw && raw.length > 0) {
                    const visibleIds = new Set(next.map((l: any) => l.id));
                    const visibleIt = raw.filter((it: any) => it.lead_id == null || visibleIds.has(it.lead_id));
                    setItineraries(visibleIt);
                    if (dataCache.current) dataCache.current = { ...dataCache.current, itineraries: visibleIt };
                  }
                  return next;
                });
                setTotalLeadCount(c => c + formatted.length);
              } catch (chunkErr) {
                if (import.meta.env.DEV) console.warn('[DataProvider] Background leads chunk process error:', chunkErr);
              }
              if (minimalChunk.length < LOAD_MORE_LEADS_CHUNK) break;
              offset += LOAD_MORE_LEADS_CHUNK;
            }
            if (isMounted.current) setLeadsLoadingMore(false);
          })();
        }
      }

    } catch (error: any) {
      if (!isMounted.current) return;
      if (error.name === 'AbortError') {
        // console.log("[DataProvider] Fetch aborted.");
        return;
      }

      // Check for timeout errors (PostgreSQL error code 57014)
      const isTimeoutError =
        error?.code === "57014" ||
        error?.code === "PGRST301" ||
        error?.message?.toLowerCase().includes("timeout") ||
        error?.message?.toLowerCase().includes("canceling statement due to statement timeout");

      // Check for CORS or network errors (including QUIC protocol errors)
      const isNetworkError =
        error?.message?.includes("CORS") ||
        error?.message?.includes("Content-Length") ||
        error?.message?.includes("fetch") ||
        error?.message?.includes("network") ||
        error?.message?.includes("QUIC") ||
        error?.message?.includes("ERR_QUIC") ||
        error?.name === "QuicProtocolError" ||
        error?.code === "PGRST116" ||
        (!error.code && error.message);

      if (isTimeoutError) {
        // Log timeout but don't show error immediately - query may still complete
        // The timeout might be a warning while the query is still processing
        console.warn("[DataProvider] Database timeout warning in fetchData (query may still complete):", {
          message: error.message,
          code: error.code,
        });

        // Only show error if this is a retry (meaning previous attempts failed)
        if (retryCount >= 2) {
          setError('Database query timeout. The request is taking longer than expected. Data may still load - please wait.');
          // Don't show toast for timeout - error state is enough, and data may still load
        } else {
          // Silently retry on first timeout - the query might complete despite the timeout
          if (import.meta.env.DEV) {
            console.debug(`[DataProvider] Timeout detected, retrying (attempt ${retryCount + 1}/3)...`);
          }
          isFetching.current = false;
          setTimeout(() => {
            if (isMounted.current) {
              fetchData(forceRefresh, retryCount + 1);
            }
          }, 2000 * (retryCount + 1));
          return;
        }
      } else if (isNetworkError) {
        // Retry logic for network errors
        if (retryCount < 3 && isMounted.current) {
          // Only log in development mode to reduce console noise
          if (import.meta.env.DEV) {
            console.debug(`[DataProvider] Network/CORS error in fetchData (attempt ${retryCount + 1}/3, retrying...):`, {
              message: error.message,
              code: error.code
            });
          }
          // Retry with exponential backoff
          isFetching.current = false;
          setTimeout(() => {
            if (isMounted.current) {
              fetchData(forceRefresh, retryCount + 1);
            }
          }, 1000 * (retryCount + 1));
          return;
        }

        // Only show error after all retries are exhausted
        console.error("[DataProvider] Network/CORS error in fetchData (max retries reached):", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });

        // Provide more specific error message for CORS issues
        const isCorsError = error?.message?.includes("CORS") ||
          error?.message?.includes("Cross-Origin") ||
          error?.message?.includes("Content-Length");

        if (isCorsError) {
          setError('CORS configuration error. Please configure Supabase CORS settings: Dashboard → Settings → API → Add your domain to allowed origins (e.g., http://localhost:5173 for development).');
          addToast('CORS Error: Please configure Supabase CORS settings in the dashboard to allow requests from this domain.', 'error');
        } else {
          setError('Network connection error. Please check your internet connection and try again.');
          addToast('Network error: Unable to connect to server. Please check your connection.', 'error');
        }
      } else {
        console.error("[DataProvider] Error in fetchData:", error);
        setError(error.message || 'Failed to fetch data');
        addToast(`Error fetching data: ${error.message}`, 'error');
      }
    } finally {
      if (isMounted.current) {
        isFetching.current = false;
        setIsInitialLoading(false);
      }
    }
  }, [addToast, signOut, session, profile]);

  const fetchDataRef = useRef(fetchData);
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  const refreshData = useCallback(() => {
    return fetchDataRef.current(true);
  }, []);

  /** Update one lead in state so list and panel reflect changes immediately after save (no full refresh). */
  const updateLeadInPlace = useCallback((lead: Lead) => {
    setLeads(current => {
      const next = current.map(l => l.id === lead.id ? lead : l);
      if (dataCache.current) dataCache.current = { ...dataCache.current, leads: next };
      return next;
    });
  }, []);

  /** Add a new lead to the top of the list so it appears immediately after create (no full refresh). */
  const addLeadInPlace = useCallback((lead: Lead) => {
    setLeads(current => {
      const filtered = current.filter(l => l.id !== lead.id);
      const next = [lead, ...filtered];
      if (dataCache.current) dataCache.current = { ...dataCache.current, leads: next };
      return next;
    });
    setTotalLeadCount(c => c + 1);
  }, []);

  // Fetch destinations from Supabase (direct – no server/egress)
  const fetchDestinations = useCallback(async (forceRefresh: boolean = false) => {
    if (isFetchingDestinations.current && !forceRefresh) return;
    if (!session?.access_token) {
      if (profile) setTimeout(() => fetchDestinations(forceRefresh), 200);
      return;
    }

    if (!forceRefresh && destinationsCache.current && (Date.now() - destinationsCacheTimestamp.current) < CACHE_DURATION_STATIC) {
      setDestinations(destinationsCache.current);
      return;
    }

    isFetchingDestinations.current = true;
    try {
      const { data, error } = await supabase.from('destinations').select('*').order('display_order', { ascending: true }).order('name', { ascending: true });
      if (error) throw error;
      if (isMounted.current) {
        const list = (data || []).map((r: any) => ({ ...r, gallery_urls: Array.isArray(r.gallery_urls) ? r.gallery_urls : (r.gallery_urls ? [r.gallery_urls] : []) }));
        setDestinations(list);
        destinationsCache.current = list;
        destinationsCacheTimestamp.current = Date.now();
      } 
    } catch (error: any) {
      if (!isMounted.current) return;
      console.error('Error fetching destinations:', error);
      addToast(`Error fetching destinations: ${error.message}`, 'error');
    } finally {
      if (isMounted.current) isFetchingDestinations.current = false;
    }
  }, [session?.access_token, profile, addToast]);

  // Fetch sightseeing from Supabase (direct – no server/egress)
  const fetchSightseeing = useCallback(async (forceRefresh: boolean = false) => {
    if (isFetchingSightseeing.current && !forceRefresh) return;
    if (!session?.access_token) {
      if (profile) setTimeout(() => fetchSightseeing(forceRefresh), 200);
      return;
    }

    if (!forceRefresh && sightseeingCache.current && (Date.now() - sightseeingCacheTimestamp.current) < CACHE_DURATION_STATIC) {
      setSightseeing(sightseeingCache.current);
      return;
    }

    isFetchingSightseeing.current = true;
    try {
      const { data, error } = await supabase.from('sightseeing').select('*').order('display_order', { ascending: true }).order('attraction_name', { ascending: true });
      if (error) throw error;
      if (isMounted.current) {
        const list = data || [];
        setSightseeing(list);
        sightseeingCache.current = list;
        sightseeingCacheTimestamp.current = Date.now();
      }
    } catch (error: any) {
      if (!isMounted.current) return;
      console.error('[DataProvider] Error fetching sightseeing:', error);
      addToast(`Error fetching sightseeing: ${error.message}`, 'error');
    } finally {
      if (isMounted.current) isFetchingSightseeing.current = false;
    }
  }, [session?.access_token, profile, addToast]);

  const refreshDestinations = useCallback(() => {
    return fetchDestinations(true);
  }, [fetchDestinations]);

  const refreshSightseeing = useCallback(() => {
    return fetchSightseeing(true);
  }, [fetchSightseeing]);

  // Lazy-load function for invoices (direct Supabase – not via backend API)
  const fetchInvoices = useCallback(async (forceRefresh: boolean = false) => {
    if (isFetchingInvoices.current && !forceRefresh) return;
    if (!session?.access_token) {
      if (profile) {
        setTimeout(() => fetchInvoices(forceRefresh), 200);
      }
      return;
    }

    // Use cache if available – no refetch on tab switch; Realtime pushes new/updated rows
    if (!forceRefresh && invoicesCache.current && (Date.now() - invoicesCacheTimestamp.current) < CACHE_DURATION_LIST) {
      setInvoices(invoicesCache.current);
      return;
    }

    isFetchingInvoices.current = true;
    setLoadingInvoices(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3000);

      if (error) throw error;

      if (isMounted.current) {
        // Filter invoices based on visible leads if not Super Admin and not Accountant (Accountant sees all).
        // Use state `leads` so Dashboard and Payments always use the same scope; fallback to cache when leads not yet loaded.
        let visibleInvoices = data || [];
        if (profile && profile.role !== 'Super Admin' && !profile.is_accountant) {
          const leadList = leads.length > 0 ? leads : (dataCache.current?.leads || []);
          const visibleLeadIds = new Set(leadList.map((l: Lead) => l.id));
          visibleInvoices = visibleInvoices.filter((inv: Invoice) =>
            // Show invoices for leads the user can see
            (inv.lead_id && visibleLeadIds.has(inv.lead_id)) ||
            // Always show invoices the current staff created themselves
            (inv.created_by_staff_id === profile.id)
          );
        }
        setInvoices(visibleInvoices);
        invoicesCache.current = visibleInvoices;
        invoicesCacheTimestamp.current = Date.now();
      }
    } catch (error: any) {
      if (!isMounted.current) return;
      console.error('Error fetching invoices:', error);
      addToast(`Error fetching invoices: ${error.message}`, 'error');
    } finally {
      if (isMounted.current) {
        isFetchingInvoices.current = false;
        setLoadingInvoices(false);
      }
    }
  }, [session?.access_token, profile, leads, addToast]);

  // Lazy-load function for payments
  const fetchPayments = useCallback(async (forceRefresh: boolean = false) => {
    if (isFetchingPayments.current && !forceRefresh) return;
    if (!session?.access_token) {
      if (profile) {
        setTimeout(() => fetchPayments(forceRefresh), 200);
      }
      return;
    }

    // Use cache if available – no refetch on tab switch; Realtime pushes new/updated rows
    if (!forceRefresh && paymentsCache.current && (Date.now() - paymentsCacheTimestamp.current) < CACHE_DURATION_LIST) {
      setPayments(paymentsCache.current);
      return;
    }

    isFetchingPayments.current = true;
    setLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3000);

      if (error) throw error;

      if (isMounted.current) {
        // Filter payments by visible leads when not Super Admin and not Accountant (same as invoices/transactions).
        // Use state `leads` so scope matches invoices; fallback to cache when leads not yet loaded.
        let visiblePayments = data || [];
        if (profile && profile.role !== 'Super Admin' && !profile.is_accountant) {
          const leadList = leads.length > 0 ? leads : (dataCache.current?.leads || []);
          const visibleLeadIds = new Set(leadList.map((l: Lead) => l.id));
          visiblePayments = visiblePayments.filter((p: Payment) =>
            p.lead_id ? visibleLeadIds.has(p.lead_id) : false
          );
        }
        setPayments(visiblePayments);
        paymentsCache.current = visiblePayments;
        paymentsCacheTimestamp.current = Date.now();
      }
    } catch (error: any) {
      if (!isMounted.current) return;
      console.error('Error fetching payments:', error);
      addToast(`Error fetching payments: ${error.message}`, 'error');
    } finally {
      if (isMounted.current) {
        isFetchingPayments.current = false;
        setLoadingPayments(false);
      }
    }
  }, [session?.access_token, profile, leads, addToast]);

  // Lazy-load function for transactions
  const fetchTransactions = useCallback(async (forceRefresh: boolean = false) => {
    if (isFetchingTransactions.current && !forceRefresh) return;
    if (!session?.access_token) {
      if (profile) {
        setTimeout(() => fetchTransactions(forceRefresh), 200);
      }
      return;
    }

    // Use cache if available – no refetch on tab switch; Realtime pushes new/updated rows
    if (!forceRefresh && transactionsCache.current && (Date.now() - transactionsCacheTimestamp.current) < CACHE_DURATION_LIST) {
      setTransactions(transactionsCache.current);
      return;
    }

    isFetchingTransactions.current = true;
    setLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) throw error;

      if (isMounted.current) {
        // Filter transactions based on visible leads if not Super Admin and not Accountant (Accountant sees all).
        // Use state `leads` so scope matches invoices/payments; fallback to cache when leads not yet loaded.
        let visibleTransactions = data || [];
        if (profile && profile.role !== 'Super Admin' && !profile.is_accountant) {
          const leadList = leads.length > 0 ? leads : (dataCache.current?.leads || []);
          const visibleLeadIds = new Set(leadList.map((l: Lead) => l.id));
          visibleTransactions = visibleTransactions.filter((t: Transaction) =>
            (t.lead_id && visibleLeadIds.has(t.lead_id))
          );
        }
        setTransactions(visibleTransactions);
        transactionsCache.current = visibleTransactions;
        transactionsCacheTimestamp.current = Date.now();
      }
    } catch (error: any) {
      if (!isMounted.current) return;
      console.error('Error fetching transactions:', error);
      addToast(`Error fetching transactions: ${error.message}`, 'error');
    } finally {
      if (isMounted.current) {
        isFetchingTransactions.current = false;
        setLoadingTransactions(false);
      }
    }
  }, [session?.access_token, profile, leads, addToast]);

  // All leads (no visibility filter) for Top Performing / ranking – same for all users
  const fetchAllLeadsForRanking = useCallback(async (forceRefresh: boolean = false) => {
    if (isFetchingAllLeadsForRanking.current && !forceRefresh) return;
    if (!session?.access_token) {
      if (profile) setTimeout(() => fetchAllLeadsForRanking(forceRefresh), 200);
      return;
    }
    if (!forceRefresh && allLeadsForRankingCache.current && (Date.now() - allLeadsForRankingTimestamp.current) < CACHE_DURATION_LIST) {
      setAllLeadsForRanking(allLeadsForRankingCache.current);
      return;
    }
    isFetchingAllLeadsForRanking.current = true;
    setLoadingAllLeadsForRanking(true);
    try {
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (leadsError) throw leadsError;
      const leadsList = leadsData || [];
      const leadIds = leadsList.map((l: any) => l.id);
      const assigneesMap = new Map<number, any[]>();
      if (leadIds.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < leadIds.length; i += chunkSize) {
          const chunk = leadIds.slice(i, i + chunkSize);
          const { data: assigneesData } = await supabase
            .from('lead_assignees')
            .select('lead_id, staff(*)')
            .in('lead_id', chunk);
          (assigneesData || []).forEach((item: any) => {
            const leadId = item.lead_id;
            if (!assigneesMap.has(leadId)) assigneesMap.set(leadId, []);
            if (item.staff) assigneesMap.get(leadId)!.push(item.staff);
          });
        }
      }
      const formatted: Lead[] = leadsList.map((l: any) => ({
        ...l,
        assigned_to: assigneesMap.get(l.id) || []
      }));
      if (isMounted.current) {
        setAllLeadsForRanking(formatted);
        allLeadsForRankingCache.current = formatted;
        allLeadsForRankingTimestamp.current = Date.now();
      }
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error fetching all leads for ranking:', error);
        addToast(`Error loading ranking data: ${error.message}`, 'error');
      }
    } finally {
      if (isMounted.current) {
        isFetchingAllLeadsForRanking.current = false;
        setLoadingAllLeadsForRanking(false);
      }
    }
  }, [session?.access_token, profile, addToast]);

  // Fetch itinerary versions for a specific itinerary
  const fetchItineraryVersions = useCallback(async (itineraryId: number): Promise<any[]> => {
    if (!session?.access_token) return [];
    try {
      const { data, error } = await supabase
        .from('itinerary_versions')
        .select('*')
        .eq('itinerary_id', itineraryId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching itinerary versions:', error);
      return [];
    }
  }, [session?.access_token]);

  // Fetch lead costings (direct Supabase – not via backend API; also loaded in fetchData)
  const fetchLeadCostings = useCallback(async (forceRefresh: boolean = false) => {
    if (!session?.access_token) return;
    try {
      const { data, error } = await supabase
        .from('lead_costings')
        .select('*')
        .limit(3000);

      if (error) throw error;

      if (isMounted.current) {
        // Filter based on visible leads if not Super Admin
        let visibleCostings = data || [];
        if (profile && profile.role !== 'Super Admin') {
          const { leads } = dataCache.current || { leads: [] };
          const visibleLeadIds = new Set(leads.map((l: Lead) => l.id));
          visibleCostings = visibleCostings.filter((c: LeadCosting) =>
            (c.lead_id && visibleLeadIds.has(c.lead_id))
          );
        }
        setLeadCostings(visibleCostings);
      }
    } catch (error: any) {
      if (!isMounted.current) return;
      console.error('Error fetching lead costings:', error);
      addToast(`Error fetching lead costings: ${error.message}`, 'error');
    }
  }, [session?.access_token, profile, addToast]);

  // Fetch branch details (bank details, terms, cancellation policy)
  const fetchBranchDetails = useCallback(async (branchId: number): Promise<{ bankDetails: any[]; terms: any[]; cancellationPolicy: any[] }> => {
    if (!session?.access_token) {
      return { bankDetails: [], terms: [], cancellationPolicy: [] };
    }
    try {
      const [bankRes, termsRes, policyRes] = await Promise.all([
        supabase.from('bank_details').select('*').eq('branch_id', branchId),
        supabase.from('terms_and_conditions').select('*').eq('branch_id', branchId),
        supabase.from('cancellation_policy').select('*').eq('branch_id', branchId),
      ]);

      return {
        bankDetails: bankRes.data || [],
        terms: termsRes.data || [],
        cancellationPolicy: policyRes.data || [],
      };
    } catch (error: any) {
      console.error('Error fetching branch details:', error);
      return { bankDetails: [], terms: [], cancellationPolicy: [] };
    }
  }, [session?.access_token]);

  // Fetch one customer with activity and documents (for detail panel)
  const fetchCustomerById = useCallback(async (customerId: number): Promise<Customer | null> => {
    if (!session?.access_token) return null;
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone, avatar_url, company, nationality, tours_completed, total_transactions, balance_due, address, notes, added_by_id, date_added, created_at, date_of_birth, passport_number, passport_expiry_date, passport_issue_date, aadhaar_number, pan_number, place_of_birth, gst_number, shared_with_branch_ids, added_by_branch_id, activity, documents')
        .eq('id', customerId)
        .single();
      if (error || !data) return null;
      const staffMap = new Map((staff as any[]).map((s: any) => [s.id, s]));
      const hydrated: Customer = {
        ...data,
        salutation: (data as any).salutation ?? 'Mr.',
        username: (data as any).username ?? '',
        addedBy: staffMap.get(data.added_by_id) || null,
        date_added: data.date_added || data.created_at || new Date().toISOString(),
      } as Customer;
      return hydrated;
    } catch {
      return null;
    }
  }, [session?.access_token, staff]);

  // Fetch sub_agent_registrations from Supabase (direct – no server/egress). RLS restricts access.
  const fetchSubAgentRegistrations = useCallback(async (forceRefresh: boolean = false) => {
    const hasAccess = profile?.role_id === 1 || profile?.role_id === 2 || profile?.is_lead_manager === true;
    if (!session?.access_token || !hasAccess) return;
    if (!forceRefresh && subAgentRegistrations.length > 0) return;

    setLoadingSubAgentRegistrations(true);
    try {
      const { data, error } = await supabase.from('sub_agent_registrations').select('*');
      if (error) throw error;
      if (isMounted.current) setSubAgentRegistrations(Array.isArray(data) ? data : []);
    } catch (error: any) {
      if (isMounted.current) setSubAgentRegistrations([]);
      if (import.meta.env.DEV) console.error('[DataProvider] fetchSubAgentRegistrations:', error?.message);
    } finally {
      if (isMounted.current) setLoadingSubAgentRegistrations(false);
    }
  }, [session?.access_token, profile?.role_id, profile?.is_lead_manager, subAgentRegistrations.length]);

  // Fetch visas from Supabase (direct – no server/egress).
  const fetchVisas = useCallback(async (forceRefresh: boolean = false) => {
    if (!session?.access_token) return;
    if (!forceRefresh && visasCache.current !== null && (Date.now() - visasCacheTimestamp.current) < CACHE_DURATION_STATIC) {
      setVisas(visasCache.current);
      return;
    }
    if (isFetchingVisas.current && !forceRefresh) return;
    isFetchingVisas.current = true;
    setLoadingVisas(true);
    try {
      const { data, error } = await supabase.from('visas').select('*');
      if (error) throw error;
      const list = Array.isArray(data) ? data : [];
      if (isMounted.current) {
        setVisas(list);
        visasCache.current = list;
        visasCacheTimestamp.current = Date.now();
      }
    } catch (error: any) {
      if (isMounted.current) setVisas([]);
      if (import.meta.env.DEV) console.error('[DataProvider] fetchVisas:', error?.message);
    } finally {
      isFetchingVisas.current = false;
      if (isMounted.current) setLoadingVisas(false);
    }
  }, [session?.access_token]);

  // Fetch job_applicants from Supabase (direct). RLS / hasAccess restricts who can see.
  const fetchJobApplicants = useCallback(async (forceRefresh: boolean = false) => {
    const hasAccess = profile?.role_id === 1 || profile?.role_id === 2 || profile?.is_lead_manager === true;
    if (!session?.access_token || !hasAccess) return;
    if (!forceRefresh && jobApplicantsCache.current !== null && (Date.now() - jobApplicantsCacheTimestamp.current) < CACHE_DURATION_STATIC) {
      setJobApplicants(jobApplicantsCache.current);
      return;
    }
    if (isFetchingJobApplicants.current && !forceRefresh) return;
    isFetchingJobApplicants.current = true;
    setLoadingJobApplicants(true);
    try {
      const { data, error } = await supabase.from('job_applicants').select('*');
      if (error) throw error;
      const list = Array.isArray(data) ? data : [];
      if (isMounted.current) {
        setJobApplicants(list);
        jobApplicantsCache.current = list;
        jobApplicantsCacheTimestamp.current = Date.now();
      }
    } catch (error: any) {
      if (isMounted.current) setJobApplicants([]);
      if (import.meta.env.DEV) console.error('[DataProvider] fetchJobApplicants:', error?.message);
    } finally {
      isFetchingJobApplicants.current = false;
      if (isMounted.current) setLoadingJobApplicants(false);
    }
  }, [session?.access_token, profile?.role_id, profile?.is_lead_manager]);

  // Fetch transfers from Supabase (direct – no server/egress).
  const fetchTransfers = useCallback(async (forceRefresh: boolean = false) => {
    if (!session?.access_token) return;
    if (!forceRefresh && transfersCache.current !== null && (Date.now() - transfersCacheTimestamp.current) < CACHE_DURATION_STATIC) {
      setTransfers(transfersCache.current);
      return;
    }
    if (isFetchingTransfers.current && !forceRefresh) return;
    isFetchingTransfers.current = true;
    setLoadingTransfers(true);
    try {
      const { data, error } = await supabase.from('transfers').select('*');
      if (error) throw error;
      const list = Array.isArray(data) ? data : [];
      if (isMounted.current) {
        setTransfers(list);
        transfersCache.current = list;
        transfersCacheTimestamp.current = Date.now();
      }
    } catch (error: any) {
      if (isMounted.current) setTransfers([]);
      if (import.meta.env.DEV) console.error('[DataProvider] fetchTransfers:', error?.message);
    } finally {
      isFetchingTransfers.current = false;
      if (isMounted.current) setLoadingTransfers(false);
    }
  }, [session?.access_token]);

  // Fetch transfer_types from Supabase (direct – no server/egress).
  const fetchTransferTypes = useCallback(async (forceRefresh: boolean = false) => {
    if (!session?.access_token) return;
    if (!forceRefresh && transferTypesCache.current !== null && (Date.now() - transferTypesCacheTimestamp.current) < CACHE_DURATION_STATIC) {
      setTransferTypes(transferTypesCache.current);
      return;
    }
    if (isFetchingTransferTypes.current && !forceRefresh) return;
    isFetchingTransferTypes.current = true;
    setLoadingTransferTypes(true);
    try {
      const { data, error } = await supabase.from('transfer_types').select('*');
      if (error) throw error;
      const list = Array.isArray(data) ? data : [];
      if (isMounted.current) {
        setTransferTypes(list);
        transferTypesCache.current = list;
        transferTypesCacheTimestamp.current = Date.now();
      }
    } catch (error: any) {
      if (isMounted.current) setTransferTypes([]);
      if (import.meta.env.DEV) console.error('[DataProvider] fetchTransferTypes:', error?.message);
    } finally {
      isFetchingTransferTypes.current = false;
      if (isMounted.current) setLoadingTransferTypes(false);
    }
  }, [session?.access_token]);

  const fetchRoleTags = useCallback(async (forceRefresh: boolean = false) => {
    if (!session?.access_token) return;
    try {
      const { data, error } = await supabase
        .from('role_tags')
        .select('id, name, slug, is_system, display_order')
        .order('display_order');
      if (error) throw error;
      if (isMounted.current) setRoleTags((data || []) as RoleTag[]);
    } catch (_) {
      // Tables may not exist yet
    }
  }, [session?.access_token]);

  const fetchTasks = useCallback(async (forceRefresh: boolean = false) => {
    if (!session?.access_token || !profile) return;
    setLoadingTasks(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_assignees(*, staff(*)), task_leads(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const raw = (data || []) as Task[];
      const scoped = raw.filter(t => isTaskInScope(t, profile));
      if (isMounted.current) setTasks(scoped);
    } catch (e) {
      if (isMounted.current) setTasks([]);
    } finally {
      if (isMounted.current) setLoadingTasks(false);
    }
  }, [session?.access_token, profile, isTaskInScope]);

  const fetchNotifications = useCallback(async (forceRefresh: boolean = false) => {
    if (!session?.access_token || !profile) return;
    setLoadingNotifications(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('staff_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const normalized = (data || []).map((row: any) => ({
        ...row,
        body: row.body ?? row.message ?? null,
        created_at: row.created_at ?? row.timestamp ?? row.created_at,
      }));
      if (isMounted.current) setNotifications(normalized as Notification[]);
    } catch (e) {
      if (isMounted.current) setNotifications([]);
    } finally {
      if (isMounted.current) setLoadingNotifications(false);
    }
  }, [session?.access_token, profile]);

  const removeNotifications = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
  }, []);

  const fetchLeaveApplications = useCallback(async (forceRefresh: boolean = false) => {
    if (!session?.access_token || !profile) return;
    setLoadingLeaveApplications(true);
    try {
      const isSA = profile.role === 'Super Admin';
      let query = supabase
        .from('leave_applications')
        .select('*, staff:staff_id(id,name,avatar_url,email), approved_by_staff:approved_by_staff_id(id,name,avatar_url), leave_application_days(*)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!isSA) query = query.eq('staff_id', profile.id);
      const { data, error } = await query;
      if (error) throw error;
      const normalized = (data || []).map((row: any) => {
        const days = (row.leave_application_days || []).sort((a: { leave_date: string }, b: { leave_date: string }) => a.leave_date.localeCompare(b.leave_date));
        return {
          ...row,
          leave_application_days: days,
          staff: row.staff ? (Array.isArray(row.staff) ? row.staff[0] : row.staff) : undefined,
          approved_by_staff: row.approved_by_staff ? (Array.isArray(row.approved_by_staff) ? row.approved_by_staff[0] : row.approved_by_staff) : undefined,
        };
      });
      if (isMounted.current) setLeaveApplications(normalized as LeaveApplication[]);
    } catch (e) {
      if (isMounted.current) setLeaveApplications([]);
    } finally {
      if (isMounted.current) setLoadingLeaveApplications(false);
    }
  }, [session?.access_token, profile]);

  const updateLeaveApplication = useCallback((id: string, patch: Partial<LeaveApplication>) => {
    setLeaveApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, ...patch } : app))
    );
  }, []);

  // Gmail/HubSpot-style: fetch once when session is ready; do NOT refetch on tab/window focus or route change
  useEffect(() => {
    if (profile && session?.access_token) {
      // Use ref so effect only runs when token/profile change, not when fetchData identity changes
      fetchDataRef.current(false);
      const staggerTimer = setTimeout(() => {
        fetchTasks(false);
        fetchNotifications(false);
        fetchLeaveApplications(false);
        fetchDestinations(false);
        fetchTransfers(false);
        fetchTransferTypes(false);
      }, 400);
      return () => clearTimeout(staggerTimer);
      // Invoices, payments, transactions are lazy-loaded when visiting their pages
    } else {
      setLeads([]);
      setCustomers([]);
      setStaff([]);
      setRoleTags([]);
      setTasks([]);
      setNotifications([]);
      setLeaveApplications([]);
      setBranches([]);
      setItineraries([]);
      setSuppliers([]);
      setInvoices([]);
      setPayments([]);
      setDestinations([]);
      setSightseeing([]);
      setIsInitialLoading(false);
      setError(null);
      dataCache.current = null;
      cacheTimestamp.current = 0;
      destinationsCache.current = null;
      sightseeingCache.current = null;
      destinationsCacheTimestamp.current = 0;
      sightseeingCacheTimestamp.current = 0;
    }
  }, [profile, session?.access_token, fetchTasks, fetchNotifications, fetchLeaveApplications, fetchDestinations, fetchTransfers, fetchTransferTypes]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (fetchAbortController.current) {
        fetchAbortController.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    const handleLeadChange = async (payload: any) => {
      if (!isMounted.current) return;
      const { eventType, new: newRecord, old: oldRecord, table } = payload;

      const fetchFullLead = async (leadId: number) => {
        const { data, error } = await supabase
          .from('leads')
          .select('*, assigned_to:lead_assignees(staff(*)), assigned_suppliers:lead_suppliers(suppliers(*))')
          .eq('id', leadId)
          .single();
        if (error) {
          console.error(`Realtime: Error fetching full lead data for ID ${leadId}:`, error);
          return null;
        }
        return {
          ...data,
          assigned_to: (data.assigned_to || []).map((a: any) => a.staff).filter(Boolean),
          assigned_suppliers: (data.assigned_suppliers || []).map((s: any) => s.suppliers).filter(Boolean)
        };
      };

      if (table === 'leads') {
        if (eventType === 'INSERT') {
          const fullNewLead = await fetchFullLead(newRecord.id);
          if (fullNewLead) setLeads(current => [fullNewLead, ...current.filter(l => l.id !== fullNewLead.id)]);
        } else if (eventType === 'UPDATE') {
          const fullUpdatedLead = await fetchFullLead(newRecord.id);
          if (fullUpdatedLead) setLeads(current => current.map(l => l.id === fullUpdatedLead.id ? fullUpdatedLead : l));
        } else if (eventType === 'DELETE') {
          setLeads(current => current.filter(l => l.id !== oldRecord.id));
        }
      } else if (table === 'lead_assignees' || table === 'lead_suppliers') {
        const leadId = newRecord?.lead_id || oldRecord?.lead_id;
        if (leadId) {
          const fullUpdatedLead = await fetchFullLead(leadId);
          if (fullUpdatedLead) setLeads(current => current.map(l => l.id === fullUpdatedLead.id ? fullUpdatedLead : l));
        }
      }
    };

    const handleDirectUpdate = (setter: React.Dispatch<React.SetStateAction<any[]>>, payload: any) => {
      if (!isMounted.current) return;
      const eventType = payload?.eventType ?? payload?.event_type;
      const newRecord = payload?.new ?? payload?.new_record;
      const oldRecord = payload?.old ?? payload?.old_record;
      if (!eventType || !newRecord) return;

      setter(currentData => {
        const exists = currentData.some((item: any) => item.id === newRecord.id);
        if (eventType === 'INSERT' && !exists) return [newRecord, ...currentData];
        if (eventType === 'UPDATE') return currentData.map((item: any) => item.id === newRecord.id ? newRecord : item);
        if (eventType === 'DELETE' && oldRecord) return currentData.filter((item: any) => item.id !== oldRecord.id);
        return currentData;
      });
    }

    // OPTIMIZED: Handle itinerary_versions changes by updating only the affected itinerary
    const handleItineraryVersionChange = async (payload: any) => {
      if (!isMounted.current) return;
      const { eventType, new: newRecord, old: oldRecord } = payload;

      // Get itinerary_id from the version record
      const itineraryId = newRecord?.itinerary_id || oldRecord?.itinerary_id;
      if (!itineraryId) return;

      try {
        // Fetch only the affected itinerary with its versions (much faster than full refresh)
        const { data: updatedItinerary, error } = await supabase
          .from('itineraries')
          .select('*, itinerary_versions(*)')
          .eq('id', itineraryId)
          .single();

        if (error) {
          console.error('[DataProvider] Error fetching updated itinerary:', error);
          return;
        }

        if (updatedItinerary) {
          // Update only this itinerary in the state (fast, no full refresh)
          setItineraries(current =>
            current.map(it => it.id === itineraryId ? updatedItinerary : it)
          );
        }
      } catch (err) {
        console.error('[DataProvider] Error handling itinerary version change:', err);
      }
    }

    const leadChannel = supabase.channel('realtime:leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, handleLeadChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_assignees' }, handleLeadChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_suppliers' }, handleLeadChange)
      .subscribe();

    const customerChannel = supabase.channel('realtime:customers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (p) => handleDirectUpdate(setCustomers, p))
      .subscribe();

    const staffChannel = supabase.channel('realtime:staff')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, (p) => handleDirectUpdate(setStaff, p))
      .subscribe();

    const otherChannel = supabase.channel('realtime:other-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'branches' }, (p) => handleDirectUpdate(setBranches, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itineraries' }, (p: any) => {
        // Preserve itinerary_versions when payload doesn't include them (realtime only sends row, no nested relations)
        if (!isMounted.current) return;
        const eventType = p?.eventType;
        const newRecord = p?.new;
        const oldRecord = p?.old;
        if (!eventType || !newRecord) return;
        setItineraries(current => {
          const exists = current.some((it: any) => it.id === newRecord.id);
          if (eventType === 'INSERT' && !exists) return [{ ...newRecord, itinerary_versions: newRecord.itinerary_versions ?? [] }, ...current];
          if (eventType === 'UPDATE') {
            return current.map((it: any) =>
              it.id === newRecord.id
                ? { ...newRecord, itinerary_versions: Array.isArray(newRecord.itinerary_versions) && newRecord.itinerary_versions.length > 0 ? newRecord.itinerary_versions : (it.itinerary_versions ?? []) }
                : it
            );
          }
          if (eventType === 'DELETE' && oldRecord) return current.filter((it: any) => it.id !== oldRecord.id);
          return current;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itinerary_versions' }, handleItineraryVersionChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, (p) => handleDirectUpdate(setSuppliers, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, (p) => handleDirectUpdate(setInvoices, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, (p) => handleDirectUpdate(setPayments, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (p) => handleDirectUpdate(setTransactions, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_costings' }, (p) => handleDirectUpdate(setLeadCostings, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sub_agent_registrations' }, (p) => handleDirectUpdate(setSubAgentRegistrations, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'destinations' }, (p) => handleDirectUpdate(setDestinations, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sightseeing' }, (p) => handleDirectUpdate(setSightseeing, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visas' }, (p) => handleDirectUpdate(setVisas, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applicants' }, (p) => handleDirectUpdate(setJobApplicants, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transfers' }, (p) => handleDirectUpdate(setTransfers, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transfer_types' }, (p) => handleDirectUpdate(setTransferTypes, p))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_details' }, refreshData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'terms_and_conditions' }, refreshData)
      .subscribe();

    const handleTaskChange = async (payload: any) => {
      if (!isMounted.current || !profile) return;
      const { eventType, new: newRecord, old: oldRecord, table } = payload;
      if (table === 'tasks') {
        if (eventType === 'DELETE' && oldRecord) {
          setTasks(current => current.filter(t => t.id !== oldRecord.id));
          return;
        }
        if (eventType === 'INSERT' || eventType === 'UPDATE') {
          const taskId = newRecord?.id ?? oldRecord?.id;
          if (!taskId) return;
          const { data, error } = await supabase.from('tasks').select('*, task_assignees(*, staff(*)), task_leads(*)').eq('id', taskId).single();
          if (error || !data) return;
          const task = data as Task;
          if (!isTaskInScope(task, profile)) {
            setTasks(current => current.filter(t => t.id !== task.id));
            return;
          }
          setTasks(current => {
            const exists = current.some(t => t.id === task.id);
            if (eventType === 'INSERT' && !exists) return [task, ...current];
            return current.map(t => t.id === task.id ? task : t);
          });
        }
      } else if (table === 'task_assignees' || table === 'task_leads') {
        const taskId = newRecord?.task_id ?? oldRecord?.task_id;
        if (!taskId) return;
        const { data, error } = await supabase.from('tasks').select('*, task_assignees(*, staff(*)), task_leads(*)').eq('id', taskId).single();
        if (error || !data) return;
        const task = data as Task;
        setTasks(current => {
          const inScope = isTaskInScope(task, profile);
          const idx = current.findIndex(t => t.id === taskId);
          if (inScope && idx >= 0) return current.map(t => t.id === taskId ? task : t);
          if (inScope && idx < 0) return [task, ...current];
          if (!inScope) return current.filter(t => t.id !== taskId);
          return current;
        });
      }
    };

    const tasksChannel = supabase.channel('realtime:tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, handleTaskChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, handleTaskChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_leads' }, handleTaskChange)
      .subscribe();

    const notificationsChannel = supabase.channel('realtime:notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, (p: any) => {
        if (!isMounted.current || !profile) return;
        const eventType = p?.eventType ?? p?.event_type;
        const newRecord = p?.new ?? p?.new_record;
        const oldRecord = p?.old ?? p?.old_record;
        if (newRecord?.staff_id !== profile.id && oldRecord?.staff_id !== profile.id) return;
        const normalize = (row: any): Notification => ({
          ...row,
          body: row?.body ?? row?.message ?? null,
          created_at: row?.created_at ?? row?.timestamp ?? row?.created_at,
        });
        setNotifications(current => {
          if (eventType === 'INSERT' && newRecord?.staff_id === profile.id) return [normalize(newRecord), ...current];
          if (eventType === 'UPDATE' && newRecord?.staff_id === profile.id) return current.map(n => n.id === newRecord.id ? normalize(newRecord) : n);
          if (eventType === 'DELETE' && oldRecord) return current.filter(n => n.id !== oldRecord.id);
          return current;
        });
      })
      .subscribe();

    const updatesChannel = supabase.channel('crm-updates');

    updatesChannel.on('broadcast', { event: 'new-lead' }, (payload) => {
      // console.log('New lead notification received via broadcast.', payload);
      addToast('New lead has arrived! Refreshing data...', 'success');
      refreshData();
    }).on('broadcast', { event: 'new-sub-agent-registration' }, () => {
      if (profile?.role_id === 1 || profile?.role_id === 2 || profile?.is_lead_manager === true) {
        addToast('New sub-agent registration received! Refreshing...', 'success');
        fetchSubAgentRegistrations(true);
      }
    }).subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        // console.log('[DataProvider] Subscribed to broadcast channel for updates.');
      } else if (err) {
        // Only log when there's an actual error; status can be CLOSED/undefined during cleanup (removeChannel)
        console.error('[DataProvider] Failed to subscribe to broadcast channel.', err);
      }
    });

    return () => {
      supabase.removeChannel(leadChannel);
      supabase.removeChannel(customerChannel);
      supabase.removeChannel(staffChannel);
      supabase.removeChannel(otherChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(updatesChannel);
    };

  }, [session?.user?.id, refreshData, addToast, profile, isTaskInScope, fetchSubAgentRegistrations]);


  const value = {
    leads,
    totalLeadCount,
    leadsLoadingMore,
    customers,
    staff,
    branches,
    itineraries,
    suppliers,
    invoices,
    payments,
    transactions,
    leadCostings,
    destinations,
    sightseeing,
    subAgentRegistrations,
    visas,
    jobApplicants,
    transfers,
    transferTypes,
    roleTags,
    tasks,
    notifications,
    leaveApplications,
    loading: isInitialLoading,
    error,
    loadingTasks,
    loadingNotifications,
    loadingLeaveApplications,
    loadingDestinations,
    loadingSightseeing,
    loadingInvoices,
    loadingPayments,
    loadingTransactions,
    loadingSubAgentRegistrations: loadingSubAgentRegistrations,
    loadingVisas,
    loadingJobApplicants,
    loadingTransfers,
    loadingTransferTypes,
    fetchData,
    refreshData,
    refreshDestinations,
    refreshSightseeing,
    fetchInvoices,
    fetchPayments,
    fetchTransactions,
    fetchItineraryVersions,
    fetchLeadCostings,
    fetchBranchDetails,
    fetchSubAgentRegistrations,
    fetchVisas,
    fetchJobApplicants,
    fetchTransfers,
    fetchTransferTypes,
    fetchRoleTags,
    fetchTasks,
    fetchNotifications,
    removeNotifications,
    fetchLeaveApplications,
    updateLeaveApplication,
    allLeadsForRanking,
    loadingAllLeadsForRanking,
    fetchAllLeadsForRanking,
    updateLeadInPlace,
    addLeadInPlace,
    fetchCustomerById,
  };

  // Always provide context value, even during initialization
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (context === undefined) {
    // Return default values instead of throwing to prevent crashes during initialization
    console.warn('[useData] DataProvider context not available, using default values');
    return {
      leads: [],
      totalLeadCount: 0,
      leadsLoadingMore: false,
      customers: [],
      staff: [],
      branches: [],
      itineraries: [],
      suppliers: [],
      invoices: [],
      payments: [],
      transactions: [],
      leadCostings: [],
      destinations: [],
      sightseeing: [],
      subAgentRegistrations: [],
      visas: [],
      jobApplicants: [],
      transfers: [],
      transferTypes: [],
      roleTags: [],
      tasks: [],
      notifications: [],
      leaveApplications: [],
      loading: true,
      error: null,
      loadingTasks: false,
      loadingNotifications: false,
      loadingLeaveApplications: false,
      loadingDestinations: false,
      loadingSightseeing: false,
      loadingInvoices: false,
      loadingPayments: false,
      loadingTransactions: false,
      loadingSubAgentRegistrations: false,
      loadingVisas: false,
      loadingJobApplicants: false,
      loadingTransfers: false,
      loadingTransferTypes: false,
      fetchData: async () => { },
      refreshData: async () => { },
      refreshDestinations: async () => { },
      refreshSightseeing: async () => { },
      fetchInvoices: async () => { },
      fetchPayments: async () => { },
      fetchTransactions: async () => { },
      fetchItineraryVersions: async () => [],
      fetchLeadCostings: async () => { },
      fetchBranchDetails: async () => ({ bankDetails: [], terms: [], cancellationPolicy: [] }),
      fetchSubAgentRegistrations: async () => { },
      fetchVisas: async () => { },
      fetchJobApplicants: async () => { },
      fetchTransfers: async () => { },
      fetchTransferTypes: async () => { },
      fetchRoleTags: async () => { },
      fetchTasks: async () => { },
      fetchNotifications: async () => { },
      removeNotifications: () => { },
      fetchLeaveApplications: async () => { },
      updateLeaveApplication: () => { },
      allLeadsForRanking: [],
      loadingAllLeadsForRanking: false,
      fetchAllLeadsForRanking: async () => { },
      updateLeadInPlace: () => { },
      addLeadInPlace: () => { },
      fetchCustomerById: async () => null,
    };
  }
  return context;
};