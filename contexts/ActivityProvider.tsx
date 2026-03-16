import React, { createContext, useContext, ReactNode, useEffect, useCallback } from 'react';
import { useAuth } from './AuthProvider';
import { useData } from './DataProvider';
import { useToast } from '../components/ToastProvider';
import { supabase } from '../lib/supabase';
import { Staff, StaffStatus } from '../types';
import { useSessionTracker } from '../hooks/useSessionTracker';

interface ActivityContextType {
    updateCurrentUserStatus: (newStatus: StaffStatus) => Promise<void>;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export const useActivity = () => {
    const context = useContext(ActivityContext);
    if (!context) {
        // Return default values instead of throwing to prevent crashes during initialization
        console.warn('[useActivity] ActivityProvider context not available, using default values');
        return {
            updateCurrentUserStatus: async () => {
                console.warn('[useActivity] updateCurrentUserStatus called but ActivityProvider not ready');
            },
        };
    }
    return context;
};

export const ActivityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { session, refreshProfile } = useAuth();
    const { refreshData } = useData();
    const { addToast } = useToast();
    
    // Track user session activity (login, heartbeat, logout)
    useSessionTracker();
    
    const updateCurrentUserStatus = useCallback(async (newStatus: StaffStatus) => {
        if (!session?.user) return;

        // Fetch the LATEST profile from DB to avoid stale state.
        const { data: currentProfile, error: fetchError } = await supabase
            .from('staff')
            .select('id, status')
            .eq('user_id', session.user.id)
            .single();
        
        if (fetchError || !currentProfile) {
            addToast(`Could not update status: ${fetchError?.message || 'User profile not found.'}`, 'error');
            return;
        }
        
        if (currentProfile.status === newStatus) return;

        const updatePayload: Partial<Staff> = { 
            status: newStatus, 
        };
        
        const { error: updateError } = await supabase.from('staff').update(updatePayload).eq('id', currentProfile.id);
        
        if (updateError) {
            addToast(`Failed to update status: ${updateError.message}`, 'error');
            return;
        }

        // Refresh data in providers to update UI everywhere
        await refreshProfile();
        await refreshData();

    }, [session, addToast, refreshData, refreshProfile]);

    // Effect for tracking user activity
    useEffect(() => {
        if (!session?.user?.id) return;

        let activityTimer: ReturnType<typeof setTimeout>;

        const updateUserActivity = () => {
             // Debounce the update to avoid hammering the DB
            clearTimeout(activityTimer);
            activityTimer = setTimeout(async () => {
                if(session?.user?.id) {
                    await supabase.from('staff').update({ last_active_at: new Date().toISOString() }).eq('user_id', session.user.id);
                }
            }, 10000); // Update at most every 10 seconds of continuous activity
        };

        // Listen for user interaction
        window.addEventListener('mousemove', updateUserActivity);
        window.addEventListener('keydown', updateUserActivity);
        window.addEventListener('scroll', updateUserActivity);
        
        // Initial activity update
        updateUserActivity();

        return () => {
            clearTimeout(activityTimer);
            window.removeEventListener('mousemove', updateUserActivity);
            window.removeEventListener('keydown', updateUserActivity);
            window.removeEventListener('scroll', updateUserActivity);
        };
    }, [session?.user?.id]);
    
    const value = { updateCurrentUserStatus };

    return (
        <ActivityContext.Provider value={value}>
            {children}
        </ActivityContext.Provider>
    );
};