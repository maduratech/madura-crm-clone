export const PASSWORD_MIN_LENGTH = 10;
const MIN_LENGTH = PASSWORD_MIN_LENGTH;

/**
 * Password strength rules: min 10 characters, at least one uppercase, one lowercase,
 * one number, and one special character.
 * Returns an error message if invalid, or null if valid.
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters long.`;
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must contain at least one number.";
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character (e.g. !@#$%^&*).";
  }
  return null;
}

/** Human-readable hint for UI (e.g. under password field). */
export const PASSWORD_HINT = "At least 10 characters, one uppercase, one lowercase, one number, and one special character.";
