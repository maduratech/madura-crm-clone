
export enum Page {
  Dashboard = 'Dashboard',
  Bookings = 'Bookings',
  Leads = 'All Leads',
  Customers = 'Customers',
  Calendar = 'Calendar',
  Employees = 'Employees',
  Itineraries = 'Itineraries',
  Hotels = 'Hotels',
  HotelsResults = 'Hotel Results',
  Invoicing = 'Invoicing',
  Flights = 'Flights',
  FlightResults = 'Flight Results',
  Suppliers = 'Suppliers',
  Payments = 'Payments',
  Reports = 'Reports',
  Settings = 'Settings',
  Branches = 'Branches',
  SqlRunner = 'SQL Runner',
  LeadsOngoing = 'Ongoing',
  LeadsCompleted = 'Completed',
  LeadsRejected = 'Rejected',
  LeadsUnqualified = 'Unqualified',
  JobApplicants = 'Job Applicants',
  Visas = 'Visas',
  Destinations = 'Destinations',
  AllAttractions = 'All Attractions',
  Transfers = 'Transfers',
  SubAgentRegistrations = 'Sub-Agents Registrations',
  Tasks = 'Tasks',
  Leave = 'Leave',
  LeaveRequests = 'Leave Requests',
  LeaveCalendar = 'Leave Calendar',
}

export enum SubAgentRegistrationStatus {
  Enquiry = 'Enquiry',
  PaymentCompleted = 'Payment completed',
  BillingCompleted = 'Billing completed',
  PortalsLoginsSent = 'Portals logins sent',
  TrainingScheduled = 'Training scheduled',
  TrainingCompleted = 'Training completed',
  Live = 'Live',
}

export interface SubAgentRegistration {
  id: number;
  company_name: string;
  pan_number: string | null;
  do_not_have_pan: boolean;
  package: 'Monthly Package' | 'Yearly Package' | 'Lifetime Package';
  first_name_middle: string;
  last_name: string;
  email: string;
  mobile: string;
  sales_in_charge_id: number | null;
  gst_number: string | null;
  gst_name: string | null;
  gst_address: string | null;
  street: string;
  pin_code: string;
  country: string;
  state: string;
  city: string;
  terms_accepted: boolean;
  status: SubAgentRegistrationStatus;
  created_at: string;
  updated_at: string;
}

// Legacy Destination interface (for WordPress integration) - keeping for backward compatibility
export interface LegacyDestination {
  id: number;
  created_at: string;
  name: string;
  wp_id: number;
  wp_taxonomy: string;
}

export enum Priority {
  High = 'High',
  Medium = 'Medium',
  Low = 'Low',
}

export enum LeadStatus {
  Enquiry = 'Enquiry',
  Processing = 'Processing',
  OperationsInitiated = 'Operations initiated',
  Rejected = 'Rejected',
  Invoicing = 'Invoicing',
  PartialPaymentOnCredit = 'Partial / On-Credit',
  Confirmed = 'Confirmed',
  BillingCompletion = 'Billing Completed',
  Voucher = 'Voucher',
  OnTour = 'On Travel',
  Feedback = 'Feedback',
  Completed = 'Completed',
  Unqualified = 'Unqualified Lead',
  NotAttended = 'Not Attended',
}

export enum LeadType {
  Cold = 'Cold Lead',
  Warm = 'Warm Lead',
  Hot = 'Hot Lead',
  Booked = 'Booked',
}
export enum TourType {
  FAMILY = 'family',
  HONEYMOON = 'honeymoon',
  ADVENTURE = 'adventure',
  SPIRITUAL = 'spiritual',
  BUSINESS = 'business',
  CUSTOMIZED = 'customized',
}
export const TourTypeDisplay: Record<TourType, string> = {
  [TourType.FAMILY]: 'Family',
  [TourType.HONEYMOON]: 'Honeymoon',
  [TourType.ADVENTURE]: 'Adventure',
  [TourType.SPIRITUAL]: 'Spiritual',
  [TourType.BUSINESS]: 'Business',
  [TourType.CUSTOMIZED]: 'Customized',
};


export enum HotelPreference {
  OneStar = '1 Star',
  TwoStar = '2 Star',
  ThreeStar = '3 Star',
  FourStar = '4 Star',
  FiveStar = '5 Star',
  NoPreference = 'No Preference'
}

export enum StayPreference {
  Hotel = 'Hotel',
  Homestay = 'Homestay',
  Hostel = 'Hostel',
  Pods = 'Pods',
  NoPreference = 'No Preference'
}

export enum Service {
  Tour = 'Tour Package',
  Visa = 'Visa',
  AirTicketing = 'Air Ticket',
  HotelBooking = 'Hotel',
  Transport = 'Transport',
  ForEx = 'Forex',
  Passport = 'Passport',
  MICE = 'MICE',
  Insurance = 'Insurance',
}

// --- HOTEL SEARCH / RESULT TYPES ---

export interface HotelRoomOption {
  id: string;
  name: string;
  boardBasis?: string;
  refundable?: boolean;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  occupancy: {
    adults: number;
    children: number;
    childAges?: number[];
  };
  cancelPolicies?: Array<{ PolicyText?: string; FromDate?: string; ToDate?: string; [k: string]: unknown }>;
  penalty?: number;
  mealType?: string | null;
  inclusion?: string | null;
}

export interface HotelSearchResult {
  id: string;
  hotelCode?: number | string | null;
  provider: 'TBO' | 'Amadeus' | 'Other';
  name: string;
  city: string;
  country?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  starRating?: number;
  thumbnailUrl?: string;
  /** Up to 5 image URLs for detail gallery (main + grid) */
  imageUrls?: string[];
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  nights: number;
  rooms: number;
  refundable?: boolean;
  amenities?: string[];
  ratingScore?: number; // e.g. 4.5 / 5
  ratingCount?: number;
  roomOptions?: HotelRoomOption[];
  /** TBO: room name, meal type, inclusion, cancellation policies */
  roomName?: string;
  mealType?: string | null;
  inclusion?: string | null;
  cancelPolicies?: Array<{ PolicyText?: string; FromDate?: string; ToDate?: string; [k: string]: unknown }>;
}
export enum TourRegion {
  Domestic = 'Domestic',
  International = 'International',
}

export enum VisaType {
  Tourist = 'Tourist',
  Business = 'Business',
  Work = 'Work',
  Artist = 'Artist',
  Other = 'Other',
}

export enum VisaCategory {
  Tourist = 'Tourist Visa',
  Business = 'Business Visa',
  Work = 'Work Visa',
  Study = 'Study Visa',
  Transit = 'Transit Visa',
  Medical = 'Medical Visa',
  Family = 'Family Visa',
  Other = 'Other',
}

export enum VisaFormat {
  Sticker = 'Sticker',
  E_Visa = 'E-Visa',
  VisaOnArrival = 'Visa on Arrival',
  ElectronicTravelAuthorization = 'Electronic Travel Authorization (ETA)',
  Other = 'Other',
}

export enum PassportServiceType {
  New = 'New',
  Renewal = 'Renewal',
}


export interface UploadedFile {
  name: string;
  type: string;
  size: number;
  content: string; // base64 encoded
}

export interface Document<T> {
  id: number; // For unique key in lists
  file: UploadedFile;
  details: T;
}

export interface PassportDetails {
  number: string;
  nameOnCard: string;
  personName: string;
  customerId?: number;
  issue_date?: string;
  expiry_date?: string;
  date_of_birth?: string;
}

export interface VisaDetails {
  personName: string;
  customerId?: number;
  visaType?: string;
  country?: string;
  number?: string;
  issue_date?: string;
  expiry_date?: string;
}

export interface AadhaarDetails {
  number: string;
  nameOnCard: string;
  personName: string;
  customerId?: number;
  address?: string;
  date_of_birth?: string;
}
export interface PanDetails {
  number: string;
  nameOnCard: string;
  personName: string;
  customerId?: number;
}

export interface BankStatementDetails {
  personName: string;
  customerId?: number;
  notes?: string;
}

export interface OtherDocDetails {
  documentName: string;
  personName: string;
  notes?: string;
  customerId?: number;
}


export interface CustomerDocuments {
  passports: Document<PassportDetails>[];
  visas: Document<VisaDetails>[];
  aadhaarCards: Document<AadhaarDetails>[];
  panCards: Document<PanDetails>[];
  bankStatements: Document<BankStatementDetails>[];
  otherDocuments: Document<OtherDocDetails>[];
}

export interface Note {
  id: number;
  text: string;
  date: string;
  addedBy: Staff;
  mentions?: { id: number; name: string }[];
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Activity {
  id: number;
  type: string;
  description: string;
  details?: string;
  user: string;
  timestamp: string;
}

/** Task status and priority (DB enum-like). */
export type TaskStatus = 'PENDING' | 'COMPLETED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  end_date: string;
  completed_at: string | null;
  created_at: string;
  created_by_staff_id: number | null;
  customer_id: number | null;
  activity?: Activity[];
  task_assignees?: { staff_id: number; staff?: Staff }[];
  task_leads?: { lead_id: number }[];
}

export type NotificationType =
  | 'lead_note_mention'
  | 'task_assigned'
  | 'task_due_today'
  | 'task_due_tomorrow'
  | 'new_enquiry'
  | 'leave_request_submitted'
  | 'leave_approved'
  | 'leave_rejected'
  | 'leave_revoked'
  | 'leave_starting_tomorrow'
  | 'leave_pending_reminder'
  | 'transaction_pending_approval'
  | 'transaction_approved'
  | 'transaction_rejected'
  | 'transaction_auto_rejected';

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Withdrawn' | 'Revoked';

export type LeaveDayType = 'full' | 'half_AM' | 'half_PM' | 'hours';

export interface LeaveApplicationDay {
  id: string;
  leave_application_id: string;
  leave_date: string;
  type: LeaveDayType;
  hours: number | null;
  /** When type is 'hours': optional exact time range e.g. "09:00", "11:00" */
  start_time?: string | null;
  end_time?: string | null;
}

export interface LeaveApplication {
  id: string;
  staff_id: number;
  reason: string;
  status: LeaveStatus;
  rejected_reason: string | null;
  approved_by_staff_id: number | null;
  created_at: string;
  updated_at: string;
  staff?: Staff;
  approved_by_staff?: Staff;
  leave_application_days?: LeaveApplicationDay[];
}

export interface Notification {
  id: string;
  staff_id: number;
  type: NotificationType;
  title: string | null;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  meta?: Record<string, unknown>;
}

export interface BankDetails {
  id: number;
  bank_name: string;
  branch_name: string;
  ifsc_code: string;
  account_number: string;
  is_default: boolean;
  gstin?: string;
  cheque_instructions?: string;
}

export interface TermsAndConditions {
  id: number;
  content: string;
  is_default: boolean;
}

export interface Branch {
  id: number;
  name: string;
  address: Address;
  logo_url: string;
  /** Optional branch-level seal with signature image used on invoices */
  seal_signature_url?: string;
  letterhead_image_url?: string;
  front_page_image_url?: string;
  final_page_image_url?: string;
  primary_contact: string;
  primary_email: string;
  admin_id?: number; // Staff ID of the branch admin
  notes: string;
  status: 'Active' | 'Inactive';
  bank_details?: BankDetails[];
  terms_and_conditions?: TermsAndConditions[];
  cancellation_policy?: TermsAndConditions[];
  welcome_email_template?: string;
  itinerary_pdf_template?: string;
  razorpay_link?: string;
}

/** Default roles only (staff.role_id). Lead Manager & Accountant are tags, not role_id. */
export type UserRole = 'Super Admin' | 'Manager' | 'Staff';

export const ROLE_IDS = { SUPER_ADMIN: 1, MANAGER: 2, STAFF: 3 } as const;
export const ROLE_ID_TO_NAME: Record<number, UserRole> = {
  1: 'Super Admin',
  2: 'Manager',
  3: 'Staff',
};
export const ROLE_NAMES: UserRole[] = ['Super Admin', 'Manager', 'Staff'];

export function getRoleName(roleId: number): UserRole {
  return ROLE_ID_TO_NAME[roleId] ?? 'Staff';
}

export interface StaffRole {
  id: number;
  name: UserRole;
}

/** Tag roles (Accountant, Lead Manager, Sales, Operations + custom). Base role stays in staff.role_id. */
export interface RoleTag {
  id: number;
  name: string;
  slug?: string;
  is_system: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

/** Read/Edit permission per resource for a tag role. */
export interface RoleTagPermission {
  id: number;
  role_tag_id: number;
  resource: string;
  can_read: boolean;
  can_edit: boolean;
}

/** Staff–tag assignment (which tags a staff has). */
export interface StaffRoleTag {
  staff_id: number;
  role_tag_id: number;
  created_at?: string;
  role_tags?: RoleTag;
}

/** Resources that can have Read/Edit permissions in Manage Roles. */
export const ROLE_TAG_RESOURCES = [
  'leads', 'invoices', 'payments', 'transactions', 'customers',
  'itineraries', 'visas', 'job_applicants', 'sub_agents',
  'destinations', 'sightseeing', 'transfers',
] as const;
export type RoleTagResource = typeof ROLE_TAG_RESOURCES[number];

export enum StaffStatus {
  Active = 'Active',
  DND = 'DND',
  OnLeave = 'On Leave',
  Inactive = 'Inactive',
  Offline = 'Offline',
}

export interface Staff {
  id: number;
  user_id: string;
  staff_no?: string;
  name: string;
  avatar_url: string;
  email: string;
  phone: string;
  extension_no?: string;
  role_id: number;
  status: StaffStatus;
  branch_id: number;
  leads_attended: number;
  leads_missed: number;
  avg_response_time: string | null; // interval
  last_response_at: string | null;
  last_active_at: string | null;
  work_hours_today: number;
  activity_log: any[]; // JSONB[]
  on_leave_until: string | null;
  destinations?: string;
  services?: Service[];
  excluded_destinations?: string;
  excluded_services?: Service[];

  // New: Lead Management capabilities for Staff role
  is_lead_manager?: boolean;
  manage_lead_branches?: number[]; // Array of branch IDs

  // New: Accountant role for managing accounts/approvals
  is_accountant?: boolean;

  /** Task Manager: see and manage all tasks (reassign etc.), cannot delete; only assignees can mark done. */
  is_task_manager?: boolean;

  /** Tag roles (Accountant, Lead Manager, Sales, etc.) – loaded when role_tags tables exist. */
  role_tags?: RoleTag[];
}

/** Aggregated Read/Edit permission per resource from the user's tag roles (any tag grants the permission). */
export type RoleTagPermissionsMap = Partial<Record<RoleTagResource, { can_read: boolean; can_edit: boolean }>>;

export interface LoggedInUser extends Staff {
  role: UserRole;
  staff_roles: { name: UserRole };
  /** Tag roles (capsules) – same as Staff.role_tags when loaded. */
  role_tags?: RoleTag[];
  /** Aggregated permissions from tag roles (invoices, payments, etc.). Super Admin bypasses these. */
  role_tag_permissions_map?: RoleTagPermissionsMap;
}

/** Role helpers. Default role = role_id 1,2,3. Lead Manager / Accountant = tags (is_lead_manager, is_accountant). */
export function isSuperAdmin(user: LoggedInUser): boolean {
  return user.role === 'Super Admin';
}
export function isManager(user: LoggedInUser): boolean {
  return user.role === 'Manager';
}
export function isStaff(user: LoggedInUser): boolean {
  return user.role === 'Staff';
}
export function isLeadManager(user: LoggedInUser): boolean {
  return user.is_lead_manager === true;
}
export function isAccountant(user: LoggedInUser): boolean {
  return user.is_accountant === true;
}
export function isTaskManager(user: LoggedInUser): boolean {
  return user.is_task_manager === true;
}

/** True if the user has a role tag with the given slug (or name match). */
export function hasRoleTag(user: LoggedInUser, slug: string): boolean {
  const s = (slug || '').toLowerCase();
  return (user.role_tags || []).some(
    (t) => (t.slug || '').toLowerCase() === s || (t.name || '').toLowerCase().replace(/\s+/g, '-') === s
  );
}

/** Tasks-only roles: sidebar shows only Dashboard + Tasks + Settings. */
export const TASKS_ONLY_TAG_SLUGS = ['developer', 'design', 'design-intern', 'developer-intern'] as const;

/** True if user has any of the tasks-only tags (Developer, Design, Design Intern, Developer Intern). */
export function isTasksOnlyRole(user: LoggedInUser): boolean {
  if (user.role === 'Super Admin' || user.role === 'Manager') return false;
  return TASKS_ONLY_TAG_SLUGS.some((slug) => hasRoleTag(user, slug));
}

/** True if user has Editor tag (sidebar: only All Destinations, Attractions, Transfers, Visas). */
export function isEditorRole(user: LoggedInUser): boolean {
  return hasRoleTag(user, 'editor');
}

/** True if user has Sales Intern tag (add/view leads, create itinerary without Trip Cost Summary). */
export function isSalesInternRole(user: LoggedInUser): boolean {
  return hasRoleTag(user, 'sales-intern');
}

/** Website Integration in Settings: only Super Admin. */
export function canAccessWebsiteIntegration(user: LoggedInUser): boolean {
  return user.role === 'Super Admin';
}

/** Returns true if the user can edit the given resource. Default role (1,2,3) + Lead Manager/Accountant tags. */
export function canEditResource(user: LoggedInUser, resource: RoleTagResource): boolean {
  if (user.role === 'Super Admin') return true;
  if (user.is_lead_manager === true) {
    const leadManagerResources: RoleTagResource[] = ['leads', 'job_applicants', 'sub_agents', 'destinations', 'sightseeing', 'transfers'];
    if (leadManagerResources.includes(resource)) return true;
  }
  if (user.is_accountant === true) {
    const accountantResources: RoleTagResource[] = ['invoices', 'payments', 'transactions'];
    if (accountantResources.includes(resource)) return true;
  }
  if (user.role === 'Manager') {
    return ['leads', 'customers', 'itineraries', 'visas', 'invoices', 'payments', 'transactions'].includes(resource);
  }
  if (user.role === 'Staff') {
    return ['leads'].includes(resource);
  }
  return false;
}

/** Returns true if the user can read the given resource. */
export function canReadResource(user: LoggedInUser, resource: RoleTagResource): boolean {
  if (user.role === 'Super Admin') return true;
  if (user.is_lead_manager === true) return true;
  if (user.is_accountant === true) return true;
  if (user.role === 'Manager') return true;
  if (user.role === 'Staff') return true;
  return false;
}

export interface Customer {
  id: number;
  salutation: string;
  first_name: string;
  last_name: string;
  username: string;
  avatar_url: string;
  email: string;
  phone: string;
  company: string;
  nationality: string;
  tours_completed: number;
  total_transactions: number;
  balance_due: number;
  address: Address;
  notes: Note[];
  activity: Activity[];
  addedBy: Staff | null;
  date_added: string;
  added_by_branch_id: number;
  gst_number?: string;
  shared_with_branch_ids: number[];
  documents?: CustomerDocuments;
  date_of_birth?: string | null;
  passport_number?: string | null;
  aadhaar_number?: string | null;
  pan_number?: string | null;
  place_of_birth?: string | null;
  passport_issue_date?: string | null;
  passport_expiry_date?: string | null;
}

export interface LeadTransferRequest {
  from_branch_id: number;
  to_branch_id: number;
  requestedBy: number; // staffId
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
  transferCustomer: boolean;
  transferItinerary: boolean;
}

export enum LeadSource {
  Website = 'website',
  StaffLink = 'Staff Link',
  Phone = 'phone',
  Email = 'email',
  Instagram = 'Instagram',
  FB = 'FB',
  MetaAdsFB = 'Meta ads - FB',
  MetaAdsIG = 'Meta ads - IG',
  GoogleAds = 'Google Ads',
  WhatsApp = 'whatsapp',
  MDReference = 'MD Reference',
  Counter = 'Counter',
  AustraliaBranch = 'Australia Branch',
  Other = 'other',
}

export const LeadSourceDisplay: Record<LeadSource, string> = {
  [LeadSource.Website]: 'Website',
  [LeadSource.StaffLink]: 'Staff Link',
  [LeadSource.Phone]: 'Phone',
  [LeadSource.Email]: 'Email',
  [LeadSource.Instagram]: 'Instagram',
  [LeadSource.FB]: 'Facebook',
  [LeadSource.MetaAdsFB]: 'Meta ads - FB',
  [LeadSource.MetaAdsIG]: 'Meta ads - IG',
  [LeadSource.GoogleAds]: 'Google Ads',
  [LeadSource.WhatsApp]: 'WhatsApp',
  [LeadSource.MDReference]: 'MD Reference',
  [LeadSource.Counter]: 'Counter',
  [LeadSource.AustraliaBranch]: 'Australia Branch',
  [LeadSource.Other]: 'Other',
};

export interface HotelStay {
  id: number;
  hotelName: string;
  city: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomType?: string;
  mealPlan?: string;
}

export interface Lead {
  id: number;
  customer_id: number;
  destination: string;
  starting_point?: string;
  travel_date: string;
  duration?: string;
  status: LeadStatus;
  priority?: Priority;
  lead_type?: LeadType;
  tour_type?: TourType;
  tour_region?: TourRegion;
  last_updated: string;
  assigned_to: Staff[];
  assigned_suppliers?: Supplier[];
  requirements: {
    adults: number;
    children: number;
    babies: number;
    child_ages?: number[];
    hotelPreference: HotelPreference;
    stayPreference: StayPreference;
    rooms?: { id: number; adults: number; children: number; child_ages?: number[] }[];
  };
  services: Service[];
  itinerary_id?: number;
  itinerary_ids?: number[];
  summary: string;
  notes: Note[];
  activity: Activity[];
  branch_ids: number[];
  transfer_request?: LeadTransferRequest;
  confirmation_checklist?: { [key: string]: boolean };
  booked_flights?: Flight[];
  source?: LeadSource | string;
  last_staff_response_at?: string | null;
  current_staff_name?: string | null;
  created_at: string;
  supplier_email_sent_at?: string | null;
  slack_thread_ts?: string | null;
  needs_welcome_pdf_generation?: boolean;
  /** Set when status becomes On Travel; used to auto-move to Feedback only after 24h. */
  on_travel_since?: string | null;

  // Service-specific fields
  is_flexible_dates?: boolean;
  is_return_ticket?: boolean;
  air_travel_type?: 'domestic' | 'international' | 'global'; // New field for air ticket travel type
  visa_type?: VisaType | string;
  visa_duration?: string;
  visa_id?: number;
  check_in_date?: string;
  check_out_date?: string;
  return_date?: string;
  budget?: number | string; // Can be numeric value (e.g., 25000) or category string (e.g., "Budget Friendly", "Comfort Collection", "Signature Tours", "Royal Retreat")
  forex_currency_have?: string;
  forex_currency_required?: string;
  passport_service_type?: PassportServiceType | string;
  passport_city_of_residence?: string;
  passport_number?: string;
  passport_expiry_date?: string;
  hotel_stays?: HotelStay[];
  // Transport fields
  vehicle_type?: string;
  pickup_location?: string;
  dropoff_location?: string;
  passengers?: number;
  // MICE fields
  event_type?: string;
  event_date?: string;
  venue_location?: string;
  attendees?: number;
  mice_requirements?: string; // Special requirements for MICE
  // Insurance fields
  insurance_type?: string;
  travelers?: number;
  // Forex additional field
  amount?: number;
}

// ... (Rest of the types remain unchanged)
export interface ItineraryDayHotel { id: number; name: string; city: string; included: boolean; }
export interface ItineraryDayTransfer { id: number; type: 'Flight' | 'Train' | 'Cab' | 'Bus' | 'Ferry' | 'Other'; description: string; included: boolean; }
export interface ItineraryActivity { id: number; time_slot: 'morning' | 'afternoon' | 'evening'; type: 'Sightseeing' | 'Hotel' | 'Transfer' | 'Leisure' | 'Custom'; source: 'api' | 'manual'; api_id?: string; name: string; description: string; image_url?: string; included: boolean; }
export interface ItineraryDay { id: number; day: number; date: string; title: string; activities: ItineraryActivity[]; description: string; meals: { b: boolean; l: boolean; d: boolean; }; hotels: ItineraryDayHotel[]; transfers: ItineraryDayTransfer[]; }
export type Currency = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'SGD' | 'JPY' | 'CHF' | 'CNY' | 'NZD';
export const ALL_CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'JPY', 'CHF', 'CNY', 'NZD'];
export type PricingType = 'Per Adult' | 'Per Adult (TWIN / DOUBLE SHARING)' | 'Per Adult (TRIPLE Sharing)' | 'Per Adult (Single)' | 'Per Child' | 'Per Infant';
export interface CostingItem { id: number; description: string; quantity: number; unitPrice: number; currency: Currency; included: boolean; pricingType?: PricingType; }
export interface HotelCostingItem { id: number; name: string; city: string; nights: number; quantity: number; unitPrice: number; currency: Currency; included: boolean; pricingType?: PricingType; }
export interface CostingOption { id: number; name: string; isDefault: boolean; costing: { flights_outbound: CostingItem[]; flights_intercity: CostingItem[]; flights_return: CostingItem[]; hotels: HotelCostingItem[]; transfers: CostingItem[]; visa: CostingItem[]; insurance: CostingItem[]; sightseeing: CostingItem[]; }; isGstApplied: boolean; isTcsApplied: boolean; gstPercentage?: number; tcsPercentage?: number; pricingVisibility: { showLineItemPrices: boolean; showTotalPrice: boolean; showFlightPrices: boolean; showHotelPrices?: boolean; showTransferPrices?: boolean; showVisaPrices?: boolean; showInsurancePrices?: boolean; }; isManualCosting?: boolean; manualPackageCost?: number; manualPerAdult?: number; manualPerAdultTwin?: number; manualPerAdultTriple?: number; manualPerAdultQuad?: number; manualPerAdultSingle?: number; manualAdultsSingle?: number; manualAdultsDouble?: number; manualAdultsTriple?: number; manualAdultsQuad?: number; manualChildCountSingle?: number; manualChildCountDouble?: number; manualChildCountTriple?: number; manualChildCountQuad?: number; manualChildPricesSingle?: Array<{ age: number; price: number }>; manualChildPricesDouble?: Array<{ age: number; price: number }>; manualChildPricesTriple?: Array<{ age: number; price: number }>; manualChildPricesQuad?: Array<{ age: number; price: number }>; manualPerChild?: number; manualPerInfant?: number; markup?: number; discount?: number; isManualFlightCost?: boolean; manualFlightPerAdult?: number; manualFlightPerChild?: number; manualFlightPerInfant?: number; isFlightGstApplied?: boolean; categoryEnabled?: { flights?: boolean; hotels?: boolean; transfers?: boolean; visa?: boolean; insurance?: boolean; sightseeing?: boolean; }; }
export interface Flight { id: string; airline: string; flight_no: string; from: string; to: string; departure_time: string; arrival_time: string; duration: string; stops: string; price: number; }
export enum ItineraryStatus { Prepared = 'Prepared', Sent = 'Sent', Confirmed = 'Confirmed', Archived = 'Archived', }
export interface EmergencyContact {
  id: number;
  card_title?: string; // e.g., "Fireman Contact", "Police Contact", "Emergency Contact"
  name: string; // e.g., "Mr. Bharath" - staff can include title prefix directly
  contact_number: string;
}
/** Destination-primary: lead_id/customer_id null = template (reusable by destination). Can be cloned for any lead/customer. */
export interface ItineraryMetadata { id: number; lead_id: number | null; customer_id: number | null; creative_title: string; duration: string; created_at: string; created_by_staff_id: number; branch_id: number; is_final: boolean; tour_completion_date: string | null; costing_options: any; modified_at: string; itinerary_versions: Itinerary[]; cover_image_url: string | null; gallery_image_urls: string[]; status: ItineraryStatus; destination: string; travel_date: string; adults: number; children: number; infants: number; starting_point: string; show_payment_button?: boolean; emergency_contacts?: EmergencyContact[]; display_currency?: string; }
export interface DetailedFlightSegment { id?: number; airline: string; airlineCode?: string; flight_number: string; from_airport: string; to_airport: string; departure_time: string; arrival_time: string; duration: string; stop: string; }
export interface DetailedFlight { id?: number; price?: number; currency?: Currency; totalDuration?: string; direction: 'onward' | 'intercity' | 'return'; is_refundable: boolean; class: string; segments: DetailedFlightSegment[]; }
export interface HotelRoom {
  id: number;
  name: string; // e.g., "Room 1", "Ram & Sita Room"
  adults: number;
  children: number;
  childAges: number[]; // Selected ages from Lead's child_ages
  pricePerAdultPerNight: number; // Price per adult per night in INR
  childPrices: { [age: number]: number }; // Price per child per night by age, e.g., { 7: 3000, 8: 3000 }
  confirmation_number?: string; // Room confirmation number (shown when itinerary status is Confirmed)
}

export interface DetailedHotel {
  id: number;
  name: string;
  check_in_date: string;
  check_out_date: string;
  check_in_time?: string;
  check_out_time?: string;
  nights: number;
  room_type: string;
  city?: string;
  meals?: { breakfast?: boolean; lunch?: boolean; dinner?: boolean };
  rooms?: HotelRoom[];
}
export interface DetailedTransfer {
  id: number;
  title: string;
  date: string;
  vehicle: string;
  passengers: string;
  pickup: string;
  dropoff: string;
  is_private: boolean;
  transfer_type_id?: number | null; // Reference to transfer_types table
  linked_activity_id?: number | null; // If linked to an activity
  linked_hotel_id?: number | null; // If linked to a hotel
  position?: 'before' | 'after'; // Position relative to linked item
  cost?: number; // Override cost
  currency?: Currency; // Override currency
}
export type ActivityTag = 'Full-day' | 'Half-day' | 'Night-only' | 'Quick stop';
export type BestTime = 'Morning' | 'Afternoon' | 'Sunset' | 'Night';
export interface DetailedActivity {
  id: number;
  name: string;
  date: string;
  day_number?: number; // Day number in the itinerary (1, 2, 3, etc.)
  start_time?: string; // Start time in HH:MM format (e.g., "08:30")
  end_time?: string; // End time in HH:MM format (e.g., "12:30")
  duration: string;
  is_shared: boolean;
  inclusions: string;
  exclusions: string;
  image_url: string;
  tag?: ActivityTag;
  opening_hours?: string;
  average_duration_hours?: number;
  latitude?: number;
  longitude?: number;
  category?: string;
  best_time?: BestTime;
  sightseeing_id?: number; // Reference to sightseeing table ID
  transfer_id?: number; // Reference to transfers table ID - transfer associated with this activity
  transfer_name?: string; // Itinerary-specific transfer name override (does not update transfer record)
  transfer_cost?: number; // Itinerary-specific transfer cost override (does not update transfer record)
  transfer_currency?: Currency; // Itinerary-specific transfer currency override (does not update transfer record)
  linked_activity_id?: number | null; // If this activity is a transfer linked to another activity
  linked_hotel_id?: number | null; // If this activity is a transfer linked to a hotel
  position?: 'before' | 'after'; // Position relative to linked item
  warnings?: string[]; // Array of warning messages (e.g., ["Exceeds daily limit", "Too far from other attractions"])
}
export interface DetailedVisa {
  id: number;
  title: string;
  note: string;
  includes: string;
  type: string;
  duration?: string;
  validity_period?: string;
  length_of_stay?: string;
  documents_required?: string;
  visa_requirements?: string;
}
export interface DetailedInsurance { id: number; title: string; plan: string; for_x_people: number; note: string; }
export interface Itinerary { id: number; itinerary_id: number; version_number: number; modified_at?: string | null; modified_by_staff_id?: number | null; overview?: string; day_wise_plan: ItineraryDay[]; detailed_flights: DetailedFlight[]; detailed_hotels: DetailedHotel[]; detailed_transfers: DetailedTransfer[]; detailed_activities: DetailedActivity[]; detailed_visa: DetailedVisa; detailed_insurance: DetailedInsurance; costing_options: CostingOption[]; inclusions: string; exclusions: string; terms_and_conditions: string; cancellation_policy?: string; important_notes: string; bookmarked_flights?: Flight[]; images?: string[]; cover_image_url: string | null; gallery_image_urls: string[]; }
export interface Supplier {
  id: number;
  company_name: string;
  phone: string;
  email: string;
  destinations?: string;
  contact_person_name: string;
  contact_person_phone: string;
  contact_person_avatar_url: string;
  status: 'Active' | 'Inactive';
  branch_id: number;
  created_at: string;
  created_by_staff_id: number;
  is_verified?: boolean;
  // New supplier fields
  category?: string; // Supplier Category (Airlines, Cruises, etc.)
  location?: string; // Location / City / Country
  website?: string; // Website / Portal Link
  b2b_login_credentials?: string; // B2B Login Credentials (if applicable)
  contract_link?: string; // Contract / Tariff Link
  notes?: string; // Notes / Remarks
  visiting_card_url?: string; // Uploaded visiting card file URL
}
export interface Visa { id: number; visa_name: string; maximum_processing_time?: string; duration_of_stay: string; type_of_visa: string; visa_category?: (VisaCategory | string)[]; visa_format?: (VisaFormat | string)[]; validity_period: string; cost: number; documents_required: string; visa_requirements: string; travel_checklist: string; created_at: string; updated_at?: string; created_by_staff_id: number; updated_by_staff_id?: number; }
export interface InvoiceItem { id: number; itemName?: string; description: string; qty: number; rate: number; professionalFee?: number; amount: number; taxableValue?: number; gstPercentage?: number; gstAmount?: number; sac?: string; serviceType?: string; isPassThrough?: boolean; tcsAmount?: number; }
export enum InvoiceStatus { Draft = 'DRAFT', Invoiced = 'INVOICED', Sent = 'SENT', PartiallyPaid = 'PARTIALLY PAID', Paid = 'PAID', Overdue = 'OVERDUE', Void = 'VOID', }
export interface Invoice { id: number; invoice_number: string; lead_id: number; customer_id: number; issue_date: string; due_date: string; status: InvoiceStatus; total_amount: number; balance_due: number; items: InvoiceItem[]; notes?: string; terms?: string; razorpay_payment_link_id?: string; razorpay_payment_link_url?: string; created_at: string; updated_at?: string; created_by_staff_id?: number | null; cgst_amount?: number; sgst_amount?: number; tcs_amount?: number; discount_amount?: number; gst_percentage?: number; is_tcs_applied?: boolean; tcs_percentage?: number; service_type?: string; sac_code?: string; display_name?: string; billing_name?: string; billing_address?: string; billing_company?: string; billing_gst_number?: string; billing_pan_number?: string; round_off?: number; /** True when invoice has been digitally signed/approved in CRM */ is_signed?: boolean; /** Staff ID of signer (who signed most recently) */ signed_by_staff_id?: number | null; /** ISO timestamp when invoice was last signed */ signed_at?: string | null; /** Timeline of important invoice events (signing, sending, downloads, edits, etc.) */ activity?: Activity[]; }
export enum PaymentMethod { Razorpay = 'Razorpay', BankTransfer = 'Bank Transfer', UPI = 'UPI', Cash = 'Cash', Other = 'Other', }
export enum PaymentStatus { Paid = 'Paid', Unlinked = 'Unlinked', Refunded = 'Refunded', Void = 'Void', }
export type PaymentSource = 'Manual' | 'RazorpayLink' | 'RazorpayWebhook';
export interface Payment { id: number; invoice_id?: number; lead_id?: number; customer_id: number; payment_date: string; amount: number; method: PaymentMethod; reference_id?: string; status: PaymentStatus; notes?: string; created_at: string; source?: PaymentSource; razorpay_payment_id?: string; created_by_staff_id?: number; }

// New: Transaction Approval System
export enum TransactionType {
  Income = 'Income', // Payment received from customer
  Expense = 'Expense', // Payment made (petrol, suppliers, etc.)
}

export enum TransactionApprovalStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export interface Transaction {
  id: number;
  lead_id: number;
  customer_id: number;
  invoice_id?: number; // Link to invoice if this payment is for a specific invoice
  type: TransactionType;
  amount: number;
  payment_method: PaymentMethod;
  reference_id?: string; // Excel Bill No. stored with RC- prefix
  receipt_no?: string; // Receipt number (no prefix)
  receipt_url?: string; // For Bank Transfer and UPI receipts
  description: string;
  status: TransactionApprovalStatus;
  rejection_notes?: string;
  recorded_by_staff_id: number;
  approved_by_staff_id?: number;
  rejected_by_staff_id?: number;
  recorded_at: string;
  approved_at?: string;
  rejected_at?: string;
  created_at: string;
}

// New: Lead Costing System
export interface LeadCostItem {
  id: number;
  service: Service;
  description: string;
  amount: number;
  quantity?: number;
}

export interface LeadCosting {
  id: number;
  lead_id: number;
  items: LeadCostItem[]; // Itemized costs per service
  total_amount: number;
  status: TransactionApprovalStatus; // Approval for tour package cost
  rejection_notes?: string;
  approved_by_staff_id?: number;
  rejected_by_staff_id?: number;
  created_by_staff_id: number;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
}
export interface AmadeusFlightOffer { id: string; price: { total: string; currency: string; }; itineraries: { duration: string; segments: { carrierCode: string; number: string; departure: { iataCode: string; at: string; }; arrival: { iataCode: string; at: string; }; duration: string; numberOfStops: number; }[]; }[]; travelerPricings: { travelerId: string; fareOption: string; travelerType: string; price: { currency: string; total: string; }; fareDetailsBySegment?: { segmentId: string; cabin?: string; fareBasis?: string; brandedFare?: string; class?: string; includedCheckedBags?: { quantity: number; }; }[]; }[]; nonHomogeneous?: boolean; }
export interface AmadeusApiDictionary { carriers: { [key: string]: string }; locations: { [key: string]: { cityCode: string, countryCode: string } }; }
export interface AmadeusFlightOffersResponse { data: AmadeusFlightOffer[]; dictionaries: AmadeusApiDictionary; }
export interface AmadeusLocation { name: string; subType: 'CITY' | 'AIRPORT'; iataCode: string; address: { cityName: string; countryName: string; }; relation: string; }
export interface AmadeusLocationsResponse { data: AmadeusLocation[]; }
export interface AmadeusSightseeing { name: string; category: string; rank: number; tags: string[]; }
export interface AmadeusSightseeingResponse { data: AmadeusSightseeing[]; }
export interface TboAirport { code: string; name: string; city: string; country: string; }
export interface TboFlightSegment { Airline: { AirlineCode: string; AirlineName: string; FlightNumber: string; }; Origin: { Airport: { AirportCode: string; AirportName: string; Terminal: string | null; CityCode: string; CityName: string; CountryCode: string; CountryName: string; }; DepTime: string; }; Destination: { Airport: { AirportCode: string; AirportName: string; Terminal: string | null; CityCode: string; CityName: string; CountryCode: string; CountryName: string; }; ArrTime: string; }; Duration: number; GroundTime: number; Remark?: string; }
export interface TboFlightResult {
  ResultIndex: string;
  Fare: { PublishedFare: number };
  Segments: TboFlightSegment[][];
  /** Flight source/provider, e.g., 'Amadeus' or 'TBO' */
  Source?: "Amadeus" | "TBO";
}
export interface TboCalendarFare { Date: string; Price: number; }

export enum ApplicantStatus {
  Applied = 'Applied',
  InvitedForInterview = 'Invited for Interview',
  InterviewAttended = 'Interview Attended',
  InReview = 'In Review',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export interface JobApplicant {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  educational_qualification?: string;
  experience_level: 'Fresher' | 'Experienced';
  brief_about_yourself?: string;
  resume_url?: string;
  resume_file_name?: string;
  resume_file_type?: string;
  role_applied_for?: string;
  status: ApplicantStatus;
  activity: Activity[];
  created_at: string;
  updated_at: string;
  created_by_staff_id?: number;
  approved_by_staff_id?: number;
  rejected_by_staff_id?: number;
  approval_reason?: string;
  rejection_reason?: string;
}

export type DestinationStatus = 'Active' | 'Draft' | 'Archived';

export interface Destination {
  id: number;
  name: string;
  slug: string;
  country_region?: string | null;
  short_description?: string | null;
  itinerary_snippet?: string | null;
  cover_image_url?: string | null;
  gallery_urls?: string[] | null;
  display_order?: number;
  status?: DestinationStatus;
  created_at: string;
  updated_at?: string;
  created_by_staff_id?: number;
  updated_by_staff_id?: number;
  /** Populated when computed for list/cards (attractions count for this destination) */
  attractions_count?: number;
  /** Populated when computed for list/cards (transfers count for this destination) */
  transfers_count?: number;
}

export interface AttractionPricing {
  adult: number;
  child: number;
}

export type AttractionActivityType = 'Sightseeing' | 'Hotel' | 'Transfer' | 'Leisure' | 'Custom';
export type AttractionStatus = 'Active' | 'Draft';

export interface Sightseeing {
  id: number;
  destination_id: number;
  attraction_name: string;
  slug?: string | null;
  activity_type?: AttractionActivityType | string | null;
  short_description?: string | null;
  long_description?: string | null;
  suggested_duration?: string | null; // e.g. "2 hours", "Half day"
  display_order?: number;
  status?: AttractionStatus;
  per_adult_cost: number; // Legacy field - kept for backward compatibility
  per_child_cost: number; // Legacy field - kept for backward compatibility
  currency?: Currency; // Legacy field - Currency for the prices (defaults to USD)
  pricing?: Record<Currency, AttractionPricing>; // New field - supports multiple currencies
  remarks?: string; // WYSIWYG HTML content
  tag?: ActivityTag; // Full-day/Half-day/Night-only/Quick stop
  opening_hours?: string; // e.g., "10:00-19:00"
  average_duration_hours?: number; // e.g., 6
  latitude?: number;
  longitude?: number;
  category?: string;
  best_time?: BestTime; // Morning/Afternoon/Sunset/Night
  images?: string[]; // Array of image URLs
  created_at: string;
  updated_at?: string;
  created_by_staff_id?: number;
  updated_by_staff_id?: number;
  destinations?: Destination; // Joined destination data
}

export interface TransferType {
  id: number;
  name: string;
  category: 'Main Segment' | 'Attraction Transfer';
  default_cost: number | null;
  default_currency: Currency;
  description?: string | null;
  destination_id?: number | null;
  vehicle_type?: string | null;
  capacity?: number | null;
  duration?: string | null;
  image_url?: string | null;
  created_at: string;
  updated_at?: string | null;
  destinations?: Destination; // Joined destination data
}

export type TransferCostingType = 'per_person' | 'total';

export interface Transfer {
  id: number;
  destination_id: number | null;
  name: string;
  cost: number; // Legacy / per-person when costing_type is per_person
  currency: Currency;
  /** per_person = use per_adult_cost & per_child_cost (or cost); total = use total_cost, divide by pax in itinerary */
  costing_type?: TransferCostingType;
  total_cost?: number | null; // When costing_type = 'total': vehicle total (divided by pax)
  per_adult_cost?: number | null;
  per_child_cost?: number | null;
  image_url?: string | null;
  vehicle_type?: string | null; // e.g., "Sedan", "SUV", "Van", "Bus"
  capacity?: number | null; // Maximum passenger capacity
  duration?: string | null; // e.g., "30 minutes", "1 hour"
  remarks?: string | null; // WYSIWYG HTML content
  transfer_type_id?: number | null; // Reference to transfer_types table
  type?: 'Main Segment' | 'Attraction Transfer' | null; // Transfer category/type
  from?: string | null;
  to?: string | null;
  created_at: string;
  updated_at?: string | null;
  created_by_staff_id?: number;
  updated_by_staff_id?: number | null;
  destinations?: { id: number; name: string; slug: string } | null;
  transfer_type?: TransferType | null;
}
