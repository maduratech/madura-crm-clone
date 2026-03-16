/**
 * SessionStorage key for pending 2FA: after password sign-in we send OTP and store email here.
 * Session is only accepted after OTP verification (AuthProvider rejects session when this matches).
 */
export const AUTH_2FA_PENDING_KEY = 'auth_2fa_pending';

/** Set when session was lost (e.g. signed in on another device) so login page can show a message. */
export const AUTH_SESSION_LOST_KEY = 'auth_session_lost';

/** Set when login is rejected because the staff account is inactive (so login page can show a message). */
export const AUTH_INACTIVE_KEY = 'auth_inactive';
