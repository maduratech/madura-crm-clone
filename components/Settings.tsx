import React from 'react';
import { LoggedInUser, canAccessWebsiteIntegration } from '../types';
import { useRouter } from '../contexts/RouterProvider';
import Profile from './Profile';
import WebsiteForm from './WebsiteForm';
import ManageRoles from './ManageRoles';
import MyLeaveTab from './MyLeaveTab';
import BrandingSettings from './BrandingSettings';

const Settings: React.FC<{ currentUser: LoggedInUser }> = ({ currentUser }) => {
    const { pathname, navigate } = useRouter();

    const activeTab = pathname.startsWith('/settings/my-leave') ? 'my-leave'
                    : pathname.startsWith('/settings/manage-roles') ? 'manage-roles'
                    : pathname.startsWith('/settings/website-form') ? 'website-form'
                    : pathname.startsWith('/settings/branding') ? 'branding'
                    : 'profile';

    const TabButton: React.FC<{ label: string; path: string; isActive: boolean }> = ({ label, path, isActive }) => (
        <button
            onClick={() => navigate(path)}
            className={`whitespace-nowrap py-3 px-2 sm:px-4 border-b-2 font-medium text-xs sm:text-sm ${
                isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm h-full flex flex-col min-h-0">
            <div className="sticky top-0 z-10 bg-white -m-3 sm:-m-6 px-3 sm:px-6 pt-3 sm:pt-6 pb-0 shrink-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-3 sm:mb-4">Settings</h1>
                <div className="border-b border-gray-200 overflow-x-auto scrollbar-hide -mx-3 sm:-mx-6 px-3 sm:px-6">
                    <nav className="-mb-px flex space-x-4 sm:space-x-6 min-w-max" aria-label="Tabs">
                        <TabButton label="Profile" path="/settings/profile" isActive={activeTab === 'profile'} />
                        <TabButton label="My Leave" path="/settings/my-leave" isActive={activeTab === 'my-leave'} />
                        {currentUser.role === 'Super Admin' && (
                            <>
                                <TabButton label="Manage Roles" path="/settings/manage-roles" isActive={activeTab === 'manage-roles'} />
                                {canAccessWebsiteIntegration(currentUser) && (
                                    <TabButton label="Website Integration" path="/settings/website-form" isActive={activeTab === 'website-form'} />
                                )}
                                <TabButton label="Branding" path="/settings/branding" isActive={activeTab === 'branding'} />
                            </>
                        )}
                    </nav>
                </div>
            </div>
            <div className="flex-grow pt-6 overflow-y-auto min-h-0">
                {activeTab === 'profile' && <Profile currentUser={currentUser} />}
                {activeTab === 'my-leave' && <MyLeaveTab currentUser={currentUser} />}
                {activeTab === 'manage-roles' && currentUser.role === 'Super Admin' && <ManageRoles />}
                {activeTab === 'website-form' && canAccessWebsiteIntegration(currentUser) && <WebsiteForm />}
                {activeTab === 'branding' && currentUser.role === 'Super Admin' && <BrandingSettings />}
            </div>
        </div>
    );
};

export default Settings;