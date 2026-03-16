import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AUTH_2FA_PENDING_KEY, AUTH_SESSION_LOST_KEY, AUTH_INACTIVE_KEY } from "../lib/authConstants";
import { LoggedInUser, Staff, StaffStatus, UserRole, Activity, getRoleName, RoleTag } from "../types";
import { useToast } from "../components/ToastProvider";

/* -------------------------------------------------------------------------- */
/*                                Auth Context                                */
/* -------------------------------------------------------------------------- */

interface AuthContextType {
  session: Session | null;
  profile: LoggedInUser | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  shouldRedirectToSettings: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  onPasswordRecoveryComplete: () => void;
  clearRedirectFlag: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* -------------------------------------------------------------------------- */
/*                              Auth Provider                                 */
/* -------------------------------------------------------------------------- */

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<LoggedInUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [shouldRedirectToSettings, setShouldRedirectToSettings] = useState(false);
  const profileIdRef = useRef<string | null>(null);

  const { addToast } = useToast();

  /* -------------------------------------------------------------------------- */
  /*                               Load Profile                                 */
  /* -------------------------------------------------------------------------- */
  const getProfile = useCallback(
    async (user: User, retryCount = 0): Promise<LoggedInUser | null> => {
      if (!user?.id) {
        return null;
      }

      try {
        if (retryCount === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Add timeout to prevent hanging requests
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 10000); // 10 second timeout
        });

        const queryPromise = supabase
          .from("staff")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

        if (error) {
          // Check for CORS or network errors
          const isNetworkError =
            error.message?.includes("fetch") ||
            error.message?.includes("network") ||
            error.message?.includes("CORS") ||
            error.message?.includes("Content-Length") ||
            error.code === "PGRST116" || // Network error code
            !error.code; // No error code often means network issue

          if (retryCount < 3 && isNetworkError) {
            // Only log in development mode to reduce console noise
            if (import.meta.env.DEV) {
              console.debug(`[AuthProvider] Network error fetching profile (attempt ${retryCount + 1}/3, retrying...):`, error.message);
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
            return getProfile(user, retryCount + 1);
          }

          console.error("[AuthProvider] Error fetching profile:", error);
          return null;
        }

        if (!data) {
          return null;
        }

        // Default role from staff.role_id (1=Super Admin, 2=Manager, 3=Staff only)
        const role = getRoleName(data.role_id as number);

        // Lead Manager, Accountant & Task Manager are tags: load staff_role_tags + role_tags
        let is_lead_manager = false;
        let is_accountant = false;
        let is_task_manager = false;
        let manage_lead_branches: number[] = [];
        let roleTags: RoleTag[] = [];
        try {
          const { data: srtData } = await supabase
            .from("staff_role_tags")
            .select("role_tag_id, role_tags(id, name, slug, is_system, display_order)")
            .eq("staff_id", data.id);
          const list = (srtData || []) as { role_tags: RoleTag | RoleTag[] | null }[];
          roleTags = list.flatMap((r) => {
            const t = r.role_tags;
            return t == null ? [] : Array.isArray(t) ? t : [t];
          }).filter((t): t is RoleTag => t != null && typeof t.id !== "undefined");
          for (const t of roleTags) {
            const slug = (t.slug || "").toLowerCase();
            const name = (t.name || "").trim();
            if (slug === "lead-manager" || name === "Lead Manager") is_lead_manager = true;
            if (slug === "accountant" || name === "Accountant") is_accountant = true;
            if (slug === "task-manager" || name === "Task Manager") is_task_manager = true;
          }
          if (is_lead_manager) {
            const { data: branches } = await supabase.from("branches").select("id");
            manage_lead_branches = (branches || []).map((b) => b.id);
          }
        } catch {
          // role_tags / staff_role_tags tables may not exist yet
        }

        // Fallback: if tag query returned empty (e.g. RLS blocks staff_role_tags), use staff row flags
        // Employees syncs is_lead_manager / is_accountant / is_task_manager to staff when saving tags
        const staffRow = data as Staff & { is_lead_manager?: boolean; is_accountant?: boolean; is_task_manager?: boolean; manage_lead_branches?: number[] };
        if (!is_lead_manager && staffRow.is_lead_manager === true) {
          is_lead_manager = true;
          if (manage_lead_branches.length === 0 && staffRow.manage_lead_branches?.length) {
            manage_lead_branches = staffRow.manage_lead_branches;
          } else if (manage_lead_branches.length === 0) {
            const { data: branches } = await supabase.from("branches").select("id");
            manage_lead_branches = (branches || []).map((b) => b.id);
          }
        }
        if (!is_accountant && staffRow.is_accountant === true) is_accountant = true;
        if (!is_task_manager && staffRow.is_task_manager === true) is_task_manager = true;

        return {
          ...(data as Staff),
          role,
          staff_roles: { name: role },
          is_lead_manager,
          is_accountant,
          is_task_manager,
          manage_lead_branches,
          role_tags: roleTags,
        };
      } catch (err: any) {
        const isNetworkError =
          err?.message?.includes("timeout") ||
          err?.message?.includes("fetch") ||
          err?.message?.includes("network") ||
          err?.message?.includes("CORS") ||
          err?.message?.includes("Content-Length");

        if (retryCount < 3 && isNetworkError) {
          // Only log in development mode to reduce console noise
          if (import.meta.env.DEV) {
            console.debug(`[AuthProvider] Network error in getProfile (attempt ${retryCount + 1}/3, retrying...):`, err?.message);
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return getProfile(user, retryCount + 1);
        }

        console.error("[AuthProvider] Exception in getProfile:", err);
        return null;
      }
    },
    []
  );

  /* -------------------------------------------------------------------------- */
  /*                                   Sign Out                                 */
  /* -------------------------------------------------------------------------- */
  const signOut = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: staffData } = await supabase
          .from("staff")
          .select("id, name, activity_log")
          .eq("user_id", user.id)
          .single();

        if (staffData) {
          const baseUpdate = {
            status: StaffStatus.Offline,
            last_active_at: new Date().toISOString(),
          };
          const logoutActivity: Activity = {
            id: Date.now(),
            type: "Logout",
            description: "User signed out.",
            user: staffData.name,
            timestamp: new Date().toISOString(),
          };
          const { error: updateError } = await supabase
            .from("staff")
            .update({
              ...baseUpdate,
              activity_log: [
                ...(Array.isArray(staffData.activity_log) ? staffData.activity_log : []),
                logoutActivity,
              ],
            })
            .eq("id", staffData.id);

          // If update with activity_log fails (e.g. 400 - column missing or type mismatch), fallback to status + last_active_at only
          if (updateError) {
            if (import.meta.env.DEV) {
              console.warn("[Auth] Staff logout update failed (activity_log may be missing or invalid):", updateError.message, updateError.details);
            }
            const { error: fallbackError } = await supabase
              .from("staff")
              .update(baseUpdate)
              .eq("id", staffData.id);
            if (fallbackError && import.meta.env.DEV) {
              console.warn("[Auth] Staff logout fallback update failed:", fallbackError.message);
            }
          }
        }
      }

      // Track logout for session reporting
      try {
        const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.access_token) {
          await fetch(`${API_BASE}/api/sessions/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${currentSession.access_token}`,
            },
          });
        }
      } catch (err) {
        // Silently fail - session tracking is not critical
        console.warn('[Auth] Failed to track logout:', err);
      }

      // scope: 'local' = sign out only this browser; other devices stay logged in
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;

      console.log("Logout successful");
    } catch (err: any) {
      // Errors are suppressed as requested
    }
  }, []);

  /* -------------------------------------------------------------------------- */
  /*                              Initialize Auth                               */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    let mounted = true;
    let isInitialized = false;

    const initializeAuth = async () => {
      try {
        // Check for recovery/magic link tokens in URL hash
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        let isRecoveryLink = false;

        // If we have recovery tokens in the URL, exchange them for a session
        if (accessToken && refreshToken && type === 'recovery') {
          isRecoveryLink = true;
          console.log('[Auth] Recovery link detected, exchanging tokens for session...');
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('[Auth] Error setting recovery session:', error);
              // Clear the hash to prevent retry loops
              window.history.replaceState(null, '', window.location.pathname);
            } else if (data.session) {
              console.log('[Auth] Recovery session set successfully - user will be logged in and redirected to settings');
              // Clear the hash after processing
              window.history.replaceState(null, '', window.location.pathname);
            }
          } catch (err: any) {
            console.error('[Auth] Error processing recovery link:', err);
            window.history.replaceState(null, '', window.location.pathname);
          }
        }

        // Also check for magic link (type=magiclink)
        if (accessToken && refreshToken && type === 'magiclink') {
          console.log('[Auth] Magic link detected, exchanging tokens for session...');
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error('[Auth] Error setting magic link session:', error);
              window.history.replaceState(null, '', window.location.pathname);
            } else if (data.session) {
              console.log('[Auth] Magic link session set successfully');
              window.history.replaceState(null, '', window.location.pathname);
            }
          } catch (err: any) {
            console.error('[Auth] Error processing magic link:', err);
            window.history.replaceState(null, '', window.location.pathname);
          }
        }

        const { data: { session: initialSession } } = await supabase.auth.getSession();

        if (!mounted) return;

        // 2FA: if session exists but this email is in "pending 2FA" (OTP sent, not yet verified), do not accept the session.
        const pending2FaEmail = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(AUTH_2FA_PENDING_KEY) : null;
        if (initialSession?.user?.email && pending2FaEmail === initialSession.user.email) {
          await supabase.auth.signOut();
          setProfile(null);
          setSession(null);
          setLoading(false);
          return;
        }

        if (initialSession) {
          const userProfile = await getProfile(initialSession.user);

          if (!mounted) return;

          if (userProfile?.status === StaffStatus.Inactive) {
            await supabase.auth.signOut();
            setProfile(null);
            setSession(null);
            if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(AUTH_INACTIVE_KEY, '1');
          } else if (userProfile) {
            profileIdRef.current = userProfile.user_id;
            setProfile(userProfile);
            setSession(initialSession);
            console.log("Login successful");

            // Track login for session reporting (non-blocking, fails silently)
            try {
              const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.maduratravel.com';
              // Add timeout and better error handling
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

              await fetch(`${API_BASE}/api/sessions/login`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${initialSession.access_token}`,
                },
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
            } catch (err: any) {
              // Silently fail - session tracking is not critical
              // CORS errors and network errors are expected if API is down
              if (import.meta.env.DEV) {
                console.debug('[Auth] Session tracking failed (non-critical):', err?.message || err);
              }
            }

            // If this was a recovery link, user must set a new password before accessing CRM
            if (isRecoveryLink) {
              console.log('[Auth] Recovery link login successful - user must reset password');
              setIsPasswordRecovery(true);
            }
          } else {
            await supabase.auth.signOut();
            setProfile(null);
            setSession(null);
          }
        } else {
          setProfile(null);
          setSession(null);
        }

        setLoading(false);
        isInitialized = true;
      } catch (error: any) {
        if (mounted) {
          setLoading(false);
          setProfile(null);
          setSession(null);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted || !isInitialized) {
          return;
        }

        try {
          // Handle PASSWORD_RECOVERY event - log user in but require password reset before CRM access
          if (event === "PASSWORD_RECOVERY" && session) {
            console.log('[Auth] Password recovery event detected - user must reset password');
            const userProfile = await getProfile(session.user);

            if (!userProfile || userProfile.status === StaffStatus.Inactive) {
              await supabase.auth.signOut();
              profileIdRef.current = null;
              setProfile(null);
              setSession(null);
              setLoading(false);
              if (userProfile?.status === StaffStatus.Inactive && typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(AUTH_INACTIVE_KEY, '1');
              }
              return;
            }

            profileIdRef.current = userProfile.user_id;
            setProfile(userProfile);
            setSession(session);
            setLoading(false);
            setIsPasswordRecovery(true);

            setTimeout(() => {
              if (window.location.pathname !== '/reset-password') {
                window.history.pushState({}, '', '/reset-password');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }, 100);
            return;
          }

          if (!session) {
            // So login page can show "You were signed out (e.g. signed in elsewhere)"
            if (profileIdRef.current && typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem(AUTH_SESSION_LOST_KEY, '1');
            }
            profileIdRef.current = null;
            setSession(null);
            setProfile(null);
            setLoading(false);
            return;
          }

          // 2FA: reject session if this email is still pending OTP verification (flag is cleared only after successful verifyOtp in AuthPage).
          const pending2FaEmail = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(AUTH_2FA_PENDING_KEY) : null;
          if (session.user?.email && pending2FaEmail === session.user.email) {
            await supabase.auth.signOut();
            profileIdRef.current = null;
            setSession(null);
            setProfile(null);
            setLoading(false);
            return;
          }

          if (session.user.id === profileIdRef.current) {
            setSession(session);
            setLoading(false);
            return;
          }

          const userProfile = await getProfile(session.user);

          if (!userProfile || userProfile.status === StaffStatus.Inactive) {
            await supabase.auth.signOut();
            profileIdRef.current = null;
            setProfile(null);
            setSession(null);
            setLoading(false);
            if (userProfile?.status === StaffStatus.Inactive && typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem(AUTH_INACTIVE_KEY, '1');
            }
          } else {
            profileIdRef.current = userProfile.user_id;
            setProfile(userProfile);
            setSession(session);
            setLoading(false);
            if (event === 'SIGNED_IN') {
              console.log("Login successful");
              // Track login for session reporting (non-blocking, fails silently)
              try {
                const API_BASE = import.meta.env.VITE_API_BASE_URL;
                // Add timeout and better error handling
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

                await fetch(`${API_BASE}/api/sessions/login`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                  signal: controller.signal,
                });
                clearTimeout(timeoutId);
              } catch (err: any) {
                // Silently fail - session tracking is not critical
                // CORS errors and network errors are expected if API is down
                if (import.meta.env.DEV) {
                  console.debug('[Auth] Session tracking failed (non-critical):', err?.message || err);
                }
              }
            }
          }
        } catch (error: any) {
          setLoading(false);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
      mounted = false;
    };
  }, [getProfile]);


  /* -------------------------------------------------------------------------- */
  /*                             Refresh User Profile                           */
  /* -------------------------------------------------------------------------- */
  const refreshProfile = useCallback(async () => {
    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (currentSession?.user) {
        const updatedProfile = await getProfile(currentSession.user);
        if (updatedProfile?.status === StaffStatus.Inactive) {
          await supabase.auth.signOut();
          profileIdRef.current = null;
          setProfile(null);
          setSession(null);
          if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(AUTH_INACTIVE_KEY, '1');
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        } else if (updatedProfile) {
          profileIdRef.current = updatedProfile.user_id;
          setProfile(updatedProfile);
        }
      }
    } catch (err: any) {
      // Errors are suppressed as requested
    }
  }, [getProfile]);

  /* -------------------------------------------------------------------------- */
  /*                           Password Recovery Flow                           */
  /* -------------------------------------------------------------------------- */
  const onPasswordRecoveryComplete = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const clearRedirectFlag = useCallback(() => {
    setShouldRedirectToSettings(false);
  }, []);

  /* -------------------------------------------------------------------------- */
  /*                               Context Value                                */
  /* -------------------------------------------------------------------------- */
  const value: AuthContextType = {
    session,
    profile,
    loading,
    isPasswordRecovery,
    shouldRedirectToSettings,
    signOut,
    refreshProfile,
    onPasswordRecoveryComplete,
    clearRedirectFlag,
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-gray-800 mb-3"></div>
        <p className="text-gray-800 font-medium">Loading...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/* -------------------------------------------------------------------------- */
/*                                   useAuth                                  */
/* -------------------------------------------------------------------------- */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
