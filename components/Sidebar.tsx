


import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { LoggedInUser, Page, isTasksOnlyRole, isEditorRole, isSalesInternRole, hasRoleTag } from '../types';
import {
    IconHome, IconLeads, IconCustomers, IconCalendar, IconEmployees,
    IconFlights, IconSuppliers, IconPayments,
    IconLogout, IconReports, IconItinerary, IconInvoice, IconSettings, IconPlus, IconChevronLeft, IconChevronDown,
    IconListBullet, IconClock, IconCheckCircle, IconXCircle,
    IconVisa, IconDestinations, IconLeave,
    IconWhatsapp, IconX
} from '../constants';
import { useAuth } from '../contexts/AuthProvider';
import { useRouter } from '../contexts/RouterProvider';


const MaduraLogo: React.FC = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const BookingsIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-1.5h5.25m-5.25 0h5.25m-5.25 0h5.25m-5.25 0h5.25M3 4.5h15A2.25 2.25 0 0120.25 6.75v10.5A2.25 2.25 0 0118 19.5H3A2.25 2.25 0 01.75 17.25V6.75A2.25 2.25 0 013 4.5z" />
    </svg>
);

const ManageIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.28a4.5 4.5 0 00-1.897 1.13l-2.685 2.686a3 3 0 002.72 4.682A9.094 9.094 0 0018 18.72zM12.75 7.5a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.882 16.03a6 6 0 10-2.824 2.824 6 6 0 002.824-2.824zM16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
    </svg>
);

const BranchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
    </svg>
);

const TransferIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6.75m-9.75 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m9.75 4.5v-4.875m0 4.875h6.75m-6.75 0v-4.875m0 4.875h-6.75m9.75-9.75v-4.875m0 4.875h6.75m-6.75 0h-6.75m9.75 0v-4.875m0 4.875H3.375a1.125 1.125 0 01-1.125-1.125V9.75m15.75 0a1.5 1.5 0 013 0m-3 0a1.5 1.5 0 00-3 0" />
    </svg>
);

const ChevronsUpDownIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
    </svg>
);

const TasksIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
);


interface SidebarProps {
    profile: LoggedInUser;
    isCollapsed: boolean;
    setIsCollapsed: (isCollapsed: boolean) => void;
    /** On mobile: when true, sidebar is open as overlay. */
    isMobileOpen?: boolean;
    /** Callback to close mobile sidebar (e.g. after navigation). */
    onMobileClose?: () => void;
}

interface NavItemProps {
    icon: React.ReactNode;
    label: string;
    path: string;
    isSubItem?: boolean;
    isActiveOverride?: boolean;
    isCollapsed: boolean;
}

interface CollapsibleNavProps {
    icon: React.ReactNode;
    label: string;
    activePaths: string[];
    children: React.ReactNode;
    isCollapsed: boolean;
}

const NavSectionHeading: React.FC<{ title: string; isCollapsed: boolean }> = ({ title, isCollapsed }) => {
    if (isCollapsed) return <div className="h-8"></div>;
    return (
        <h2 className="px-4 mt-4 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {title}
        </h2>
    );
};

const NavItem: React.FC<NavItemProps> = ({ icon, label, path, isSubItem = false, isActiveOverride, isCollapsed }) => {
    const { pathname, navigate } = useRouter();
    const isActive = isActiveOverride !== undefined ? isActiveOverride : pathname.startsWith(path);
    const activeClass = 'bg-slate-800 text-white';
    const inactiveClass = 'text-slate-400 hover:bg-slate-800/50 hover:text-white';

    return (
        <li>
            <button
                onClick={() => navigate(path)}
                title={isCollapsed ? label : undefined}
                className={`w-full flex items-center rounded-lg text-sm font-medium transition-colors duration-150 touch-manipulation ${isActive ? activeClass : inactiveClass} ${isCollapsed ? 'justify-center px-0 py-2.5 min-h-[40px]' : 'gap-3 px-3 py-2'} ${isSubItem && !isCollapsed ? 'pl-10' : ''}`}
            >
                <span className={isCollapsed ? 'flex shrink-0 items-center justify-center' : ''}>
                    {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: isCollapsed ? 'w-5 h-5 shrink-0' : 'w-5 h-5' }) : icon}
                </span>
                <span className={`whitespace-nowrap truncate ${isCollapsed ? 'sr-only' : ''}`}>{label}</span>
            </button>
        </li>
    );
};

const CollapsibleNav: React.FC<CollapsibleNavProps> = ({ icon, label, activePaths, children, isCollapsed }) => {
    const { pathname } = useRouter();
    const isSectionActive = activePaths.some(path => pathname.startsWith(path));
    const [isOpen, setIsOpen] = useState<boolean>(isSectionActive);
    const [isHovering, setIsHovering] = useState(false);
    const [flyoutPosition, setFlyoutPosition] = useState<{ top: number; left: number } | null>(null);
    const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isSectionActive) {
            setIsOpen(false);
        }
    }, [pathname, isSectionActive]);

    const effectiveIsOpen = isCollapsed ? false : isOpen;
    const showFlyout = isCollapsed && isHovering;

    useLayoutEffect(() => {
        if (showFlyout && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setFlyoutPosition({ top: rect.top, left: rect.right + 8 });
        } else {
            setFlyoutPosition(null);
        }
    }, [showFlyout]);

    const handleMouseEnter = () => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setIsHovering(true);
    };
    const handleMouseLeave = () => {
        hoverTimeoutRef.current = setTimeout(() => setIsHovering(false), 150);
    };

    useEffect(() => () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    }, []);

    const flyoutContent = flyoutPosition && (
        <div
            className="hidden md:block fixed py-1 min-w-[180px] bg-[#111827] border border-slate-700 rounded-lg shadow-xl z-[200]"
            style={{ top: flyoutPosition.top, left: flyoutPosition.left }}
            onMouseEnter={() => { if (hoverTimeoutRef.current) { clearTimeout(hoverTimeoutRef.current); hoverTimeoutRef.current = null; } setIsHovering(true); }}
            onMouseLeave={handleMouseLeave}
        >
            <ul className="py-1">
                {React.Children.map(children, child =>
                    React.isValidElement(child)
                        ? React.cloneElement(child as React.ReactElement<NavItemProps>, { isCollapsed: false, isSubItem: false })
                        : child
                )}
            </ul>
        </div>
    );

    return (
        <li
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                ref={buttonRef}
                onClick={() => !isCollapsed && setIsOpen(!isOpen)}
                title={isCollapsed ? label : undefined}
                className={`w-full flex items-center rounded-lg text-sm font-medium transition-colors duration-150 touch-manipulation ${isSectionActive ? 'text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'} ${isCollapsed ? 'justify-center px-0 py-2.5 min-h-[40px]' : 'gap-3 px-3 py-2'}`}
            >
                <span className={isCollapsed ? 'flex shrink-0 items-center justify-center' : ''}>
                    {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: isCollapsed ? 'w-5 h-5 shrink-0' : 'w-5 h-5' }) : icon}
                </span>
                <span className={`flex-1 text-left whitespace-nowrap truncate ${isCollapsed ? 'sr-only' : ''}`}>{label}</span>
                <IconChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'} ${isCollapsed ? 'hidden' : ''}`} />
            </button>
            {/* Inline sub-nav when expanded */}
            <ul className={`pl-5 overflow-hidden transition-all duration-300 ${effectiveIsOpen ? 'max-h-96' : 'max-h-0'}`}>
                {children}
            </ul>
            {/* Dropdown flyout when collapsed: render over page via portal */}
            {flyoutContent && createPortal(flyoutContent, document.body)}
        </li>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({ profile, isCollapsed, setIsCollapsed, isMobileOpen = false, onMobileClose }) => {
    const { signOut } = useAuth();
    const { pathname } = useRouter();
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [profileMenuPosition, setProfileMenuPosition] = useState<{ top: number; left: number } | null>(null);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const profileButtonRef = useRef<HTMLButtonElement>(null);
    const profileMenuPortalRef = useRef<HTMLDivElement>(null);

    // Restricted role sidebars: only use when user has exactly that one role type (no other role tags that need different items).
    // Tasks-only: only when they have Developer/Design/Intern and no Editor, Sales, Sales Intern, Lead Manager.
    const isTasksOnlyUser = isTasksOnlyRole(profile) && !profile.is_lead_manager && !isEditorRole(profile) && !isSalesInternRole(profile) && !hasRoleTag(profile, 'sales');
    // Editor only: only when they have Editor and no Sales, Sales Intern, tasks-only, Lead Manager → show only Editor items. Else: full nav + Editor block.
    const isEditorOnlyUser = isEditorRole(profile) && profile.role !== 'Super Admin' && profile.role !== 'Manager' && !profile.is_lead_manager && !hasRoleTag(profile, 'sales') && !isSalesInternRole(profile) && !isTasksOnlyRole(profile);
    // Sales Intern only: only when they have Sales Intern and no Editor → show Sales Intern sidebar. Sales Intern + Editor → default nav + Editor block.
    const isSalesInternOnlyUser = isSalesInternRole(profile) && profile.role !== 'Super Admin' && profile.role !== 'Manager' && !isEditorRole(profile);

    // Show Management section for Super Admin, Manager, or Lead Manager tag
    const isPrivilegedUser = profile.role === 'Super Admin' || profile.role === 'Manager' || profile.is_lead_manager === true;

    // Lead Manager tag but not Super Admin: show Manage section with Destinations, Job Applicants, etc.
    const isLeadManagerOnly = profile.is_lead_manager === true && profile.role !== 'Super Admin';

    // Show Destinations section only for Super Admin or Lead Manager tag
    const canAccessDestinations = profile.role === 'Super Admin' || profile.is_lead_manager === true;

    // Plain Staff (role Staff, no privileged tags): only Dashboard, Customers, Leads, Tasks, Settings — no Calendar, no Booking System
    const isPlainStaff = profile.role === 'Staff' && !profile.is_lead_manager && !profile.is_accountant && !profile.is_task_manager
        && !hasRoleTag(profile, 'sales') && !isEditorRole(profile) && !isSalesInternRole(profile) && !isTasksOnlyRole(profile);

    useLayoutEffect(() => {
        if (isProfileMenuOpen && isCollapsed && profileButtonRef.current) {
            const rect = profileButtonRef.current.getBoundingClientRect();
            setProfileMenuPosition({ top: rect.top, left: rect.right + 8 });
        } else if (!isProfileMenuOpen) {
            setProfileMenuPosition(null);
        }
    }, [isProfileMenuOpen, isCollapsed]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const inSidebar = profileMenuRef.current?.contains(target);
            const inPortaledMenu = profileMenuPortalRef.current?.contains(target);
            if (!inSidebar && !inPortaledMenu) {
                setIsProfileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <>
            {/* Mobile overlay */}
            {onMobileClose && (
                <div
                    className={`md:hidden fixed inset-0 bg-black/50 z-30 transition-opacity duration-200 ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    onClick={onMobileClose}
                    aria-hidden
                />
            )}
            <aside
                className={`
                    bg-[#111827] text-white flex flex-col
                    md:transition-[width] md:duration-300
                    ${isCollapsed ? 'md:w-20' : 'md:w-64'}
                    fixed md:relative inset-y-0 left-0 z-40 w-64
                    transform transition-transform duration-200 ease-out md:transform-none
                    ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                `}
            >
                {/* Header */}
                <div className={`flex items-center h-14 sm:h-16 shrink-0 border-b border-slate-800 ${isCollapsed ? 'md:justify-center md:px-0' : 'justify-between px-4'}`}>
                    <div className={`flex items-center gap-2 overflow-hidden ${isCollapsed ? 'md:w-0 md:overflow-hidden' : 'w-full'} px-2 md:px-0`}>
                        <MaduraLogo />
                        <span className={`font-bold text-lg whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'md:opacity-0' : 'opacity-100'}`}>Madura CRM</span>
                    </div>
                    {onMobileClose ? (
                        <button onClick={onMobileClose} className="md:hidden p-2 rounded-lg text-slate-400 hover:bg-slate-700 min-h-[44px] min-w-[44px]" aria-label="Close menu">
                            <IconX className="w-6 h-6" />
                        </button>
                    ) : null}
                    <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden md:flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                        <IconChevronLeft className={`w-6 h-6 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
                    </button>
                </div>

            {/* Nav */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {/* Tasks-only roles (Developer, Design, Design Intern, Developer Intern): only Dashboard + Tasks */}
                {isTasksOnlyUser ? (
                    <>
                        <NavSectionHeading title="Platform" isCollapsed={isCollapsed} />
                        <ul>
                            <NavItem icon={<IconHome className="w-5 h-5" />} label="Dashboard" path="/dashboard" isCollapsed={isCollapsed} />
                        </ul>
                        <NavSectionHeading title="Workspace" isCollapsed={isCollapsed} />
                        <ul>
                            <NavItem icon={<TasksIcon className="w-5 h-5" />} label="Tasks" path="/tasks" isCollapsed={isCollapsed} />
                        </ul>
                    </>
                ) : isEditorOnlyUser ? (
                    <>
                        <NavSectionHeading title="Platform" isCollapsed={isCollapsed} />
                        <ul>
                            <NavItem icon={<IconHome className="w-5 h-5" />} label="Dashboard" path="/dashboard" isCollapsed={isCollapsed} />
                        </ul>
                        <NavSectionHeading title="Manage" isCollapsed={isCollapsed} />
                        <ul>
                            <NavItem icon={<IconDestinations className="w-5 h-5" />} label="All Destinations" path="/destinations" isCollapsed={isCollapsed} />
                            <NavItem icon={<IconListBullet className="w-5 h-5" />} label="All Attractions" path="/attractions" isCollapsed={isCollapsed} />
                            <NavItem icon={<TransferIcon className="w-5 h-5" />} label="All Transfers" path="/transfers" isCollapsed={isCollapsed} />
                            <NavItem icon={<IconVisa className="w-5 h-5" />} label="Visas" path="/visas" isCollapsed={isCollapsed} />
                        </ul>
                    </>
                ) : isSalesInternOnlyUser ? (
                    <>
                        <NavSectionHeading title="Platform" isCollapsed={isCollapsed} />
                        <ul>
                            <NavItem icon={<IconHome className="w-5 h-5" />} label="Dashboard" path="/dashboard" isCollapsed={isCollapsed} />
                            <NavItem icon={<IconCustomers className="w-5 h-5" />} label="Customers" path="/customers" isCollapsed={isCollapsed} />
                        </ul>
                        <NavSectionHeading title="Workspace" isCollapsed={isCollapsed} />
                        <ul>
                            <CollapsibleNav icon={<IconLeads className="w-5 h-5" />} label="Leads" activePaths={['/leads']} isCollapsed={isCollapsed}>
                                <NavItem icon={<IconListBullet className="w-5 h-5" />} label="All Leads" path="/leads" isSubItem isCollapsed={isCollapsed} isActiveOverride={pathname === '/leads' || pathname === '/leads/all'} />
                                <NavItem icon={<IconCheckCircle className="w-5 h-5" />} label="Completed" path="/leads/completed" isSubItem isCollapsed={isCollapsed} />
                                <NavItem icon={<IconXCircle className="w-5 h-5" />} label="Rejected" path="/leads/rejected" isSubItem isCollapsed={isCollapsed} />
                            </CollapsibleNav>
                            <NavItem icon={<IconItinerary className="w-5 h-5" />} label="Itineraries" path="/itineraries" isCollapsed={isCollapsed} />
                        </ul>
                    </>
                ) : (
                    <>
                <NavSectionHeading title="Platform" isCollapsed={isCollapsed} />
                <ul>
                    <NavItem icon={<IconHome className="w-5 h-5" />} label="Dashboard" path="/dashboard" isCollapsed={isCollapsed} />
                    <NavItem icon={<IconCustomers className="w-5 h-5" />} label="Customers" path="/customers" isCollapsed={isCollapsed} />
                    {!isPlainStaff && <NavItem icon={<IconCalendar className="w-5 h-5" />} label="Calendar" path="/calendar" isCollapsed={isCollapsed} />}
                </ul>

                <NavSectionHeading title="Workspace" isCollapsed={isCollapsed} />
                <ul>
                    <CollapsibleNav icon={<IconLeads className="w-5 h-5" />} label="Leads" activePaths={['/leads']} isCollapsed={isCollapsed}>
                        <NavItem icon={<IconListBullet className="w-5 h-5" />} label="All Leads" path="/leads" isSubItem isCollapsed={isCollapsed} isActiveOverride={pathname === '/leads' || pathname === '/leads/all'} />
                        <NavItem icon={<IconCheckCircle className="w-5 h-5" />} label="Completed" path="/leads/completed" isSubItem isCollapsed={isCollapsed} />
                        <NavItem icon={<IconXCircle className="w-5 h-5" />} label="Rejected" path="/leads/rejected" isSubItem isCollapsed={isCollapsed} />
                    </CollapsibleNav>
                    <NavItem icon={<TasksIcon className="w-5 h-5" />} label="Tasks" path="/tasks" isCollapsed={isCollapsed} />
                    {!isPlainStaff && (
                    <CollapsibleNav
                        icon={<BookingsIcon className="w-5 h-5" />}
                        label="Booking System"
                        activePaths={['/flights', '/hotels', '/visas', '/transfers', '/attractions', '/destinations', '/itineraries', '/invoicing', '/payments']}
                        isCollapsed={isCollapsed}
                    >
                        {/* Order requested: Flights, Hotels, Visas, Transfers, Attractions, Destinations */}
                        <NavItem icon={<IconFlights className="w-5 h-5" />} label="Flights" path="/flights" isSubItem isCollapsed={isCollapsed} />
                        <NavItem icon={<IconDestinations className="w-5 h-5" />} label="Hotels" path="/hotels" isSubItem isCollapsed={isCollapsed} />
                        <NavItem icon={<IconVisa className="w-5 h-5" />} label="Visas" path="/visas" isSubItem isCollapsed={isCollapsed} />
                        <NavItem icon={<TransferIcon className="w-5 h-5" />} label="Transfers" path="/transfers" isSubItem isCollapsed={isCollapsed} />
                        <NavItem icon={<IconListBullet className="w-5 h-5" />} label="Attractions" path="/attractions" isSubItem isCollapsed={isCollapsed} />
                        <NavItem icon={<IconDestinations className="w-5 h-5" />} label="Destinations" path="/destinations" isSubItem isCollapsed={isCollapsed} />
                        {/* Keep existing items after the requested ones */}
                        <NavItem icon={<IconItinerary className="w-5 h-5" />} label="Itineraries" path="/itineraries" isSubItem isCollapsed={isCollapsed} />
                        <NavItem icon={<IconInvoice className="w-5 h-5" />} label="Invoicing" path="/invoicing" isSubItem isCollapsed={isCollapsed} />
                        <NavItem icon={<IconPayments className="w-5 h-5" />} label="Payments" path="/payments" isSubItem isCollapsed={isCollapsed} />
                    </CollapsibleNav>
                    )}
                </ul>

                {/* Editor tag: show Visas (for users who have Editor + other roles e.g. Sales) */}
                {isEditorRole(profile) && !isEditorOnlyUser && (
                    <>
                        <NavSectionHeading title="Manage" isCollapsed={isCollapsed} />
                        <ul>
                            <NavItem icon={<IconVisa className="w-5 h-5" />} label="Visas" path="/visas" isCollapsed={isCollapsed} />
                        </ul>
                    </>
                )}

                {isPrivilegedUser && (
                    <>
                        <NavSectionHeading title="Management" isCollapsed={isCollapsed} />
                        <ul>
                            {/* For Lead Manager tag but not Super Admin: Show Manage section with Destinations */}
                            {isLeadManagerOnly ? (
                                <CollapsibleNav icon={<ManageIcon className="w-5 h-5" />} label="Manage" activePaths={['/job-applicants', '/sub-agent-registrations']} isCollapsed={isCollapsed}>
                                    {/* Job Applicants: Lead Manager can access */}
                                    <NavItem icon={<IconListBullet className="w-5 h-5" />} label="Job Applicants" path="/job-applicants" isSubItem isCollapsed={isCollapsed} />
                                    {/* Sub-Agents Registrations: Super Admin & Lead Manager */}
                                    {(profile.role === 'Super Admin' || profile.is_lead_manager === true) && (
                                        <NavItem icon={<IconListBullet className="w-5 h-5" />} label="Sub-Agents Registrations" path="/sub-agent-registrations" isSubItem isCollapsed={isCollapsed} />
                                    )}
                                </CollapsibleNav>
                            ) : (
                                <>
                                    <CollapsibleNav icon={<ManageIcon className="w-5 h-5" />} label="Manage" activePaths={['/employees', '/suppliers', '/branches', '/job-applicants', '/sub-agent-registrations']} isCollapsed={isCollapsed}>
                                        {/* For Super Admin and regular Managers: Show all items */}
                                        <NavItem icon={<IconEmployees className="w-5 h-5" />} label="Employees" path="/employees" isSubItem isCollapsed={isCollapsed} />
                                        {/* Suppliers: Super Admin only */}
                                        {profile.role === 'Super Admin' && (
                                            <NavItem icon={<IconSuppliers className="w-5 h-5" />} label="Suppliers" path="/suppliers" isSubItem isCollapsed={isCollapsed} />
                                        )}
                                        {/* Job Applicants: Super Admin, Manager, or Lead Manager tag */}
                                        {(profile.role === 'Super Admin' || profile.role === 'Manager' || profile.is_lead_manager === true) && (
                                            <NavItem icon={<IconListBullet className="w-5 h-5" />} label="Job Applicants" path="/job-applicants" isSubItem isCollapsed={isCollapsed} />
                                        )}
                                        {/* Sub-Agents Registrations: Super Admin & Lead Manager */}
                                        {(profile.role === 'Super Admin' || profile.is_lead_manager === true) && (
                                            <NavItem icon={<IconListBullet className="w-5 h-5" />} label="Sub-Agents Registrations" path="/sub-agent-registrations" isSubItem isCollapsed={isCollapsed} />
                                        )}
                                        {/* Branches: Super Admin only */}
                                        {profile.role === 'Super Admin' && (
                                            <NavItem icon={<BranchIcon className="w-5 h-5" />} label="Branches" path="/branches" isSubItem isCollapsed={isCollapsed} />
                                        )}
                                    </CollapsibleNav>
                                    {profile.role === 'Super Admin' && (
                                        <>
                                            <CollapsibleNav icon={<IconLeave className="w-5 h-5" />} label="Leave" activePaths={['/leave']} isCollapsed={isCollapsed}>
                                                <NavItem icon={<IconListBullet className="w-5 h-5" />} label="Leave Requests" path="/leave/requests" isSubItem isCollapsed={isCollapsed} />
                                                <NavItem icon={<IconCalendar className="w-5 h-5" />} label="Leave Calendar" path="/leave/calendar" isSubItem isCollapsed={isCollapsed} />
                                            </CollapsibleNav>
                                        </>
                                    )}
                                    <NavItem icon={<IconReports className="w-5 h-5" />} label="Reports" path="/reports" isCollapsed={isCollapsed} />
                                </>
                            )}
                        </ul>
                    </>
                )}
                    </>
                )}
            </nav>

            {/* Footer */}
            <div className={`p-2 border-t border-slate-800 shrink-0 ${isCollapsed ? 'md:px-0 md:flex md:flex-col md:items-center' : ''}`}>
                <ul className={isCollapsed ? 'w-full' : ''}>
                    <NavItem icon={<IconSettings className="w-5 h-5" />} label="Settings" path="/settings" isCollapsed={isCollapsed} />
                </ul>
                <div ref={profileMenuRef} className={`relative mt-2 ${isCollapsed ? 'md:w-full md:flex md:justify-center' : ''}`}>
                    {/* Profile menu: when expanded, render inline; when collapsed, render via portal over page */}
                    {isProfileMenuOpen && !isCollapsed && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-900 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                            <div className="py-1">
                                <button onClick={signOut} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white min-h-[44px]">
                                    <IconLogout className="w-5 h-5" />
                                    Logout
                                </button>
                            </div>
                        </div>
                    )}
                    {isProfileMenuOpen && isCollapsed && profileMenuPosition && createPortal(
                        <div
                            ref={profileMenuPortalRef}
                            className="fixed z-[200] bg-slate-900 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 min-w-[160px]"
                            style={{ top: profileMenuPosition.top, left: profileMenuPosition.left }}
                        >
                            <div className="py-1">
                                <button onClick={signOut} className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white min-h-[44px]">
                                    <IconLogout className="w-5 h-5" />
                                    Logout
                                </button>
                            </div>
                        </div>,
                        document.body
                    )}
                    <button ref={profileButtonRef} onClick={() => setIsProfileMenuOpen(p => !p)} className={`w-full flex items-center rounded-lg hover:bg-slate-800 transition-colors touch-manipulation ${isCollapsed ? 'md:justify-center md:p-1.5' : 'gap-3 text-left p-2'}`} title={isCollapsed ? profile.name : ''}>
                        <img src={profile.avatar_url} alt={profile.name} className="w-9 h-9 rounded-full shrink-0" />
                        <div className={`flex-1 min-w-0 overflow-hidden ${isCollapsed ? 'md:hidden' : ''}`}>
                            <p className="text-sm font-semibold text-white truncate">{profile.name}</p>
                            <p className="text-xs text-slate-400 truncate">{profile.email}</p>
                        </div>
                        <ChevronsUpDownIcon className={`w-5 h-5 text-slate-400 shrink-0 ${isCollapsed ? 'md:hidden' : ''}`} />
                    </button>
                </div>
            </div>
            </aside>
        </>
    );
};