/**
 * Strict lowercase-only email validation utilities.
 *
 * Email addresses must contain ONLY lowercase letters. Uppercase letters (A-Z)
 * are rejected anywhere in the address (local part AND domain).
 *
 * Allowed characters: a-z, 0-9, @, '.', '_' and '-'.
 */

// Only lowercase letters, numbers, @, '.', '_' and '-' are permitted.
export const EMAIL_REGEX = /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export const LOWERCASE_EMAIL_ERROR =
  "Email address must contain only lowercase letters.";
export const INVALID_EMAIL_FORMAT_ERROR =
  "Please enter a valid email address format.";
export const DOMAIN_EMAIL_ERROR =
  "Only official @kgkite.ac.in email addresses are allowed.";

export interface EmailValidationResult {
  isValid: boolean;
  error: string;
}

/** Returns true if the value contains any uppercase letter (A-Z). */
export const hasUppercase = (value: string): boolean => /[A-Z]/.test(value);

/**
 * Validates an email address:
 * 1. Rejects empty email: "Email address cannot be empty."
 * 2. Rejects any uppercase letters (with LOWERCASE_EMAIL_ERROR)
 * 3. Rejects spaces: "Email address cannot contain spaces."
 * 4. Rejects invalid characters: "Email contains invalid characters."
 * 5. Rejects domains other than @kgkite.ac.in: DOMAIN_EMAIL_ERROR
 * 6. Rejects invalid formats: INVALID_EMAIL_FORMAT_ERROR
 */
export const validateEmail = (email: string): EmailValidationResult => {
  if (!email || email.length === 0) {
    return { isValid: false, error: "Email address cannot be empty." };
  }
  if (hasUppercase(email)) {
    return { isValid: false, error: LOWERCASE_EMAIL_ERROR };
  }
  if (/\s/.test(email)) {
    return { isValid: false, error: "Email address cannot contain spaces." };
  }
  if (/[^a-z0-9@._-]/.test(email)) {
    return { isValid: false, error: "Email contains invalid characters." };
  }
  if (!email.endsWith("@kgkite.ac.in")) {
    return { isValid: false, error: DOMAIN_EMAIL_ERROR };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { isValid: false, error: INVALID_EMAIL_FORMAT_ERROR };
  }
  return { isValid: true, error: "" };
};
