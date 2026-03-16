import React, { useMemo, useRef, useState, useEffect } from 'react';
import { LoggedInUser, Page, isTasksOnlyRole, isEditorRole, isSalesInternRole, hasRoleTag } from './types';
import { Sidebar } from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Customers from './components/Customers';
import Calendar from './components/Calendar';
import Employees from './components/Employees';
import Flights from './components/Flights';
import Hotels from './components/Hotels';
import Suppliers from './components/Vendors';
import Payments from './components/Payments';
// Fix: Changed import to a named import to resolve module resolution issues.
import { Leads } from './components/Leads';
// FIX: Changed import for 'Itineraries' to a named import to resolve module resolution issues.
import { Itineraries } from './components/Itineraries';
// Fix: Changed import for Invoicing to a named import.
import { Invoicing } from './components/Invoicing';
import Reports from './components/Reports';
import Settings from './components/Settings';
import { useAuth } from './contexts/AuthProvider';
import AuthPage from './components/AuthPage';
import ResetPasswordPage from './components/ResetPasswordPage';
import { useData } from './contexts/DataProvider';
import { useRouter } from './contexts/RouterProvider';
import Branches from './components/Branches';
import FlightSearchResults from './components/FlightSearchResults';
import HotelSearchResults from './components/HotelSearchResults';
import { PdfGenerator } from './components/PdfGenerator';
import JobApplicants from './components/JobApplicants';
import Visas from './components/Visas';
import Destinations from './components/Destinations';
import DestinationDetail from './components/DestinationDetail';
import AllAttractions from './components/AllAttractions';
import AllTransfers from './components/AllTransfers';
import SubAgentRegistrations from './components/SubAgentRegistrations';
import { Tasks } from './components/Tasks';
import { Leave } from './components/Leave';
import { supabase } from './lib/supabase';

const pageRoutes: { [path: string]: Page } = {
  '/': Page.Dashboard,
  '/dashboard': Page.Dashboard,
  '/hotels': Page.Hotels,
  '/leads': Page.Leads,
  '/customers': Page.Customers,
  '/calendar': Page.Calendar,
  '/employees': Page.Employees,
  '/itineraries': Page.Itineraries,
  '/invoicing': Page.Invoicing,
  '/flights': Page.Flights,
  '/suppliers': Page.Suppliers,
  '/payments': Page.Payments,
  '/settings': Page.Settings,
  '/branches': Page.Branches,
  '/reports': Page.Reports,
  '/sql-runner': Page.SqlRunner,
  '/job-applicants': Page.JobApplicants,
  '/visas': Page.Visas,
  '/destinations': Page.Destinations,
  '/attractions': Page.AllAttractions,
  '/transfers': Page.Transfers,
  '/sub-agent-registrations': Page.SubAgentRegistrations,
  '/tasks': Page.Tasks,
  '/leave': Page.Leave,
  '/leave/requests': Page.LeaveRequests,
  '/leave/calendar': Page.LeaveCalendar,
};


const App: React.FC = () => {
  const auth = useAuth();
  const { loading: isDataLoading } = useData();
  const { pathname, navigate } = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile sidebar when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Apply global favicon from app_settings (if configured), otherwise keep default icon from index.html.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const setFavicon = (href: string) => {
      const existing = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (existing) {
        existing.href = href;
        return;
      }
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = href;
      document.head.appendChild(link);
    };

    let isMounted = true;
    const loadFavicon = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('key, value')
          .eq('key', 'favicon_url')
          .limit(1);

        if (error) {
          // If table does not exist or RLS blocks it, silently keep default.
          if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
            return;
          }
          console.error('[App] Error loading favicon setting:', error);
          return;
        }

        if (!isMounted) return;

        const row = Array.isArray(data) && data.length > 0 ? data[0] as { key: string; value: string | null } : null;
        const value = row?.value ? String(row.value).trim() : '';
        if (value) {
          setFavicon(value);
        }
        // If no value, we leave the default <link rel="icon" href="/vite.svg" /> from index.html.
      } catch (e) {
        console.error('[App] Unexpected error loading favicon setting:', e);
      }
    };

    loadFavicon();
    return () => {
      isMounted = false;
    };
  }, [auth.session?.access_token]);

  // When user landed via reset-password link, keep them on the dedicated reset page
  useEffect(() => {
    if (auth.isPasswordRecovery && auth.session && pathname !== '/reset-password') {
      navigate('/reset-password');
    }
  }, [auth.isPasswordRecovery, auth.session, pathname, navigate]);

  const activePage = useMemo(() => {
    if (pathname.startsWith('/settings')) {
      return Page.Settings;
    }
    if (pathname.startsWith('/flights/results')) {
      return Page.FlightResults;
    }
    if (pathname.startsWith('/hotels/results')) {
      return Page.HotelsResults;
    }
    // Fix: Handle specific lead routes before the general one to ensure correct page resolution.
    if (pathname === '/leads/completed') {
      return Page.LeadsCompleted;
    }
    if (pathname === '/leads/rejected') {
      return Page.LeadsRejected;
    }
    if (pathname.startsWith('/leads')) {
      return Page.Leads;
    }
    // Handle itinerary detail pages: /itineraries/{destination}/{duration}/{mtsid}
    if (pathname.startsWith('/itineraries/') && pathname !== '/itineraries') {
      return Page.Itineraries;
    }
    // Handle destination detail pages
    if (pathname.startsWith('/attractions')) {
      return Page.AllAttractions;
    }
    if (pathname.startsWith('/destinations/') && pathname !== '/destinations') {
      return Page.Destinations; // Will render DestinationDetail component
    }
    if (pathname === '/leave/requests') return Page.LeaveRequests;
    if (pathname === '/leave/calendar') return Page.LeaveCalendar;
    if (pathname.startsWith('/leave')) return Page.Leave;
    const matchedPath = Object.keys(pageRoutes).find(path => {
      if (path.includes('/:')) {
        // Simple wildcard matching for now
        const base = path.split('/:')[0];
        return pathname.startsWith(base);
      }
      return pathname === path;
    });
    return pageRoutes[matchedPath || '/'] || Page.Dashboard;
  }, [pathname]);

  // Wait for auth to be ready before deciding what to show
  if (auth.loading) {
    return null; // The AuthProvider is already showing a full-screen loader
  }

  if (!auth.session || !auth.profile) {
    return <AuthPage />;
  }

  // Dedicated password reset page (recovery from email link): block CRM until password is set
  if (auth.session && auth.profile && auth.isPasswordRecovery) {
    return <ResetPasswordPage isRecovery />;
  }

  // Dedicated password change page (from Settings / direct URL) — blank like auth page
  if (pathname === '/reset-password' && auth.session && auth.profile) {
    return <ResetPasswordPage isRecovery={false} />;
  }

  const renderPage = (currentUser: LoggedInUser) => {
    const tasksOnlyUser = isTasksOnlyRole(currentUser) && !currentUser.is_lead_manager && !isEditorRole(currentUser) && !isSalesInternRole(currentUser);
    const editorOnlyUser = isEditorRole(currentUser) && currentUser.role !== 'Super Admin' && currentUser.role !== 'Manager' && !currentUser.is_lead_manager;
    const salesInternOnlyUser = isSalesInternRole(currentUser) && currentUser.role !== 'Super Admin' && currentUser.role !== 'Manager';
    const isPlainStaff = currentUser.role === 'Staff' && !currentUser.is_lead_manager && !currentUser.is_accountant && !currentUser.is_task_manager
      && !hasRoleTag(currentUser, 'sales') && !isEditorRole(currentUser) && !isSalesInternRole(currentUser) && !isTasksOnlyRole(currentUser);

    if (tasksOnlyUser) {
      if (activePage !== Page.Dashboard && activePage !== Page.Tasks && !pathname.startsWith('/settings')) return <Dashboard />;
    } else if (editorOnlyUser) {
      const editorPages = [Page.Dashboard, Page.Destinations, Page.AllAttractions, Page.Transfers, Page.Visas];
      if (!editorPages.includes(activePage) && !pathname.startsWith('/settings') &&
          !pathname.startsWith('/destinations') && pathname !== '/visas') return <Dashboard />;
    } else if (salesInternOnlyUser) {
      const salesInternPages = [Page.Dashboard, Page.Customers, Page.Leads, Page.LeadsCompleted, Page.LeadsRejected, Page.LeadsUnqualified, Page.Itineraries];
      if (!salesInternPages.includes(activePage) && !pathname.startsWith('/settings') && !pathname.startsWith('/leads') &&
          !pathname.startsWith('/itineraries')) return <Dashboard />;
    } else if (isPlainStaff) {
      const staffAllowedPages = [Page.Dashboard, Page.Customers, Page.Leads, Page.LeadsCompleted, Page.LeadsRejected, Page.LeadsUnqualified, Page.Tasks, Page.Leave, Page.LeaveRequests, Page.LeaveCalendar];
      if (!staffAllowedPages.includes(activePage) && !pathname.startsWith('/settings') && !pathname.startsWith('/leads') && !pathname.startsWith('/leave')) return <Dashboard />;
    }

    switch (activePage) {
      case Page.Dashboard:
        return <Dashboard />;
      case Page.Hotels:
        return <Hotels />;
      // Fix: Group all lead-related pages to render the same component and pass the 'page' prop.
      case Page.Leads:
      case Page.LeadsOngoing:
      case Page.LeadsCompleted:
      case Page.LeadsRejected:
      case Page.LeadsUnqualified:
        return <Leads currentUser={currentUser} page={activePage} />;
      case Page.Customers:
        return <Customers currentUser={currentUser} />;
      case Page.Calendar:
        return <Calendar />;
      case Page.Employees:
        return <Employees currentUser={currentUser} />;
      case Page.Settings:
        return <Settings currentUser={currentUser} />;
      case Page.Branches:
        if (currentUser.role === 'Staff') return <Dashboard />;
        return <Branches currentUser={currentUser} />;
      case Page.Itineraries:
        return <Itineraries currentUser={currentUser} />;
      case Page.Invoicing:
        return <Invoicing currentUser={currentUser} />;
      case Page.Flights:
        return <Flights currentUser={currentUser} />;
      case Page.FlightResults:
        return <FlightSearchResults />;
      case Page.Hotels:
        return <Hotels />;
      case Page.HotelsResults:
        return <HotelSearchResults />;
      case Page.Suppliers:
        if (currentUser.role !== 'Super Admin') return <Dashboard />;
        return <Suppliers currentUser={currentUser} />;
      case Page.Payments:
        return <Payments />;
      case Page.Reports:
        if (currentUser.role === 'Staff') return <Dashboard />;
        return <Reports />;
      case Page.SqlRunner:
        return <Dashboard />;
      case Page.JobApplicants:
        // Super Admin, Manager, or Lead Manager (role_id 4) can access
        const canAccessJobApplicants = currentUser.role === 'Super Admin' ||
          currentUser.role === 'Manager' ||
          currentUser.is_lead_manager === true;
        if (!canAccessJobApplicants) return <Dashboard />;
        return <JobApplicants currentUser={currentUser} />;
      case Page.Visas:
        // Super Admin, Manager, Lead Manager, or Editor tag can access
        const canAccessVisas = currentUser.role === 'Super Admin' ||
          currentUser.role === 'Manager' ||
          currentUser.is_lead_manager === true || isEditorRole(currentUser);
        if (!canAccessVisas) return <Dashboard />;
        return <Visas currentUser={currentUser} />;
      case Page.Destinations:
        // Super Admin, Lead Manager, or Editor tag can access
        const canAccessDestinations = currentUser.role === 'Super Admin' || currentUser.is_lead_manager === true || isEditorRole(currentUser);
        if (!canAccessDestinations) return <Dashboard />;
        // Check if it's a detail page (has ID in path)
        if (pathname.startsWith('/destinations/') && pathname !== '/destinations') {
          const destinationId = pathname.split('/destinations/')[1];
          return <DestinationDetail destinationId={destinationId} currentUser={currentUser} />;
        }
        return <Destinations currentUser={currentUser} />;
      case Page.AllAttractions:
        // Super Admin, Lead Manager, or Editor tag can access
        const canAccessAttractions = currentUser.role === 'Super Admin' || currentUser.is_lead_manager === true || isEditorRole(currentUser);
        if (!canAccessAttractions) return <Dashboard />;
        return <AllAttractions currentUser={currentUser} />;
      case Page.Transfers:
        // Super Admin, Lead Manager, or Editor tag can access
        const canAccessTransfers = currentUser.role === 'Super Admin' || currentUser.is_lead_manager === true || isEditorRole(currentUser);
        if (!canAccessTransfers) return <Dashboard />;
        return <AllTransfers currentUser={currentUser} />;
      case Page.SubAgentRegistrations:
        const canAccessSubAgents = currentUser.role === 'Super Admin' || currentUser.is_lead_manager === true;
        if (!canAccessSubAgents) return <Dashboard />;
        return <SubAgentRegistrations currentUser={currentUser} />;
      case Page.Tasks:
        return <Tasks currentUser={currentUser} />;
      case Page.Leave:
      case Page.LeaveRequests:
      case Page.LeaveCalendar:
        return <Leave currentUser={currentUser} page={activePage} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar
        profile={auth.profile}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header profile={auth.profile} onMenuClick={() => setIsMobileMenuOpen(prev => !prev)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6">
          {isDataLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
            </div>
          ) : (
            renderPage(auth.profile)
          )}
        </main>
      </div>
      <PdfGenerator />
    </div>
  );
};

export default App;