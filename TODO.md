# TODO: Strict Lowercase-Only Email Validation

## Steps

- [x] 1. Create shared utility `src/utils/emailValidation.ts` (EMAIL_REGEX, LOWERCASE_EMAIL_ERROR, hasUppercase, validateEmail)
- [x] 2. Edit `src/pages/LoginPage.tsx` — use shared util, exact error message, real-time + paste + blur + submit validation
- [x] 3. Edit `src/pages/ForgotPasswordPage.tsx` — use shared util, add paste + blur validation
- [x] 4. Edit `src/pages/ResetPasswordPage.tsx` — reject uppercase email param instead of lowercasing
- [x] 5. Edit `src/pages/admin/UserManagement.tsx` — use shared util, add paste + blur validation
- [x] 6. Edit `src/contexts/AuthContext.tsx` — use shared util, align error messages, no silent conversion
- [x] 7. Update `src/test_email_validation.js` — new regex/error, add pasted + mixed-case tests
- [x] 8. Edit `backend/app.py` — return `{"error": "Email address must contain only lowercase letters."}` (HTTP 400)
- [x] 9. Update `backend/test_email_validation.py` — assert new error format, add pasted + mixed-case tests
- [x] 10. Run `npm test` to verify all validation tests pass

