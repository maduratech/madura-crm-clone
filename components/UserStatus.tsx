import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthProvider';
import { useActivity } from '../contexts/ActivityProvider';
import { StaffStatus } from '../types';

const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
);
const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
);
const DndIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
);
const OfflineIcon: React.FC<{ className?: string }> = ({ className }) => (
     <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);


const statusConfig = {
    [StaffStatus.Active]: { icon: SunIcon, label: 'Active', color: 'text-yellow-400', dot: 'bg-green-400' },
    [StaffStatus.DND]: { icon: DndIcon, label: 'Do Not Disturb', color: 'text-red-400', dot: 'bg-red-500' },
    [StaffStatus.OnLeave]: { icon: MoonIcon, label: 'On Leave', color: 'text-slate-400', dot: 'bg-slate-400' },
    [StaffStatus.Inactive]: { icon: DndIcon, label: 'Inactive', color: 'text-slate-500', dot: 'bg-slate-500' },
    [StaffStatus.Offline]: { icon: OfflineIcon, label: 'Offline', color: 'text-slate-500', dot: 'bg-slate-500' },
};

export const UserStatus: React.FC = () => {
    const { profile } = useAuth();
    const { updateCurrentUserStatus } = useActivity();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleStatusChange = (newStatus: StaffStatus) => {
        updateCurrentUserStatus(newStatus);
        setIsOpen(false);
    };

    if (!profile) return null;
    
    const currentStatus = profile?.status || StaffStatus.Inactive;
    const config = statusConfig[currentStatus];
    const Icon = config.icon;

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(prev => !prev)} title={`${profile.name} - ${config.label}`} className="flex items-center gap-2 p-1 pr-2 sm:pr-3 rounded-md text-gray-300 hover:bg-gray-700">
                {/* Mobile: profile pic only with status dot at bottom-right */}
                <span className="relative inline-block sm:hidden">
                    <img src={profile.avatar_url} alt={profile.name} className="w-9 h-9 rounded-full object-cover ring-2 ring-[#111827]"/>
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#111827] ${config.dot}`} aria-hidden />
                </span>
                {/* Desktop: profile pic + name + status */}
                <span className="hidden sm:inline-block w-8 h-8 rounded-md overflow-hidden shrink-0">
                    <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover"/>
                </span>
                <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold">{profile.name}</p>
                    <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
                        <p className="text-xs">{config.label}</p>
                    </div>
                </div>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-gray-700 rounded-lg shadow-lg border border-gray-600 z-50 p-2">
                    <div className="p-2 border-b border-gray-600">
                        <p className="text-sm font-semibold text-white">{profile.name}</p>
                        <p className="text-xs text-gray-400">Set your status</p>
                    </div>
                    <ul className="text-sm text-gray-200 py-1">
                        <li onClick={() => handleStatusChange(StaffStatus.Active)} className="flex items-center gap-3 p-2 hover:bg-gray-600 rounded-md cursor-pointer">
                            <SunIcon className="w-5 h-5 text-yellow-400" /> Active
                        </li>
                        <li onClick={() => handleStatusChange(StaffStatus.DND)} className="flex items-center gap-3 p-2 hover:bg-gray-600 rounded-md cursor-pointer">
                           <DndIcon className="w-5 h-5 text-red-400" /> Do Not Disturb
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
};