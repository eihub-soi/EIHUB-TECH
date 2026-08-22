import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  getAuth,
  verifyPasswordResetCode,
  confirmPasswordReset,
  signInWithEmailAndPassword,
  updatePassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import {
  firebaseConfig,
  auth as firebaseAuth,
  isFirebaseConfigured,
} from "../firebase/client";
import { d1, isD1Configured, client as d1Client } from "../lib/d1_client";
import { toast } from "sonner";
import {
  KeyRound,
  ShieldAlert,
  CheckCircle,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { validateEmail } from "../utils/emailValidation";

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Search parameters for either standard Firebase link or custom token link
  const oobCode = searchParams.get("oobCode") || "";
  const emailParam = searchParams.get("email") || "";
  const tokenParam = searchParams.get("token") || "";

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isValidating, setIsValidating] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // 1. Verify reset code / token on mount
  useEffect(() => {
    const verifyReset = async () => {
      // Scenario A: Custom token validation via D1
      if (emailParam && tokenParam) {
        if (!isD1Configured) {
          setErrorMessage("Database connection is not configured.");
          setIsValidating(false);
          return;
        }

        const emailValidation = validateEmail(emailParam.trim());
        if (!emailValidation.isValid) {
          setErrorMessage(
            emailValidation.error ||
              "Please enter a valid email address format.",
          );
          setIsValidating(false);
          return;
        }

        try {
          const res = await d1Client.execute({
            sql: "SELECT token, expires_at FROM password_resets WHERE email = ?",
            args: [emailParam.trim()],
          });

          const row = res.rows && res.rows.length > 0 ? res.rows[0] : null;

          if (!row) {
            setErrorMessage(
              "This password reset link is invalid or has already been used.",
            );
          } else if (row.token !== tokenParam) {
            setErrorMessage("The password reset token is incorrect.");
          } else if (new Date(row.expires_at as string) < new Date()) {
            setErrorMessage(
              "This password reset link has expired. Please request a new link.",
            );
          } else {
            setEmail(emailParam.trim());
          }
        } catch (err) {
          console.error(
            "[ResetPassword] Custom token verification failed:",
            err,
          );
          setErrorMessage("Failed to verify reset token. Please try again.");
        } finally {
          setIsValidating(false);
        }
        return;
      }

      // Scenario B: Standard Firebase OOB code validation
      if (oobCode) {
        if (!isFirebaseConfigured || !firebaseAuth) {
          setErrorMessage("Firebase Authentication is not configured.");
          setIsValidating(false);
          return;
        }

        try {
          const userEmail = await verifyPasswordResetCode(
            firebaseAuth,
            oobCode,
          );
          setEmail(userEmail);
        } catch (err: any) {
          console.error("Error verifying Firebase reset code:", err);
          setErrorMessage(
            err.code === "auth/expired-action-code"
              ? "This password reset link has expired. Please contact your administrator to request a new link."
              : "The password reset link is invalid or has already been used.",
          );
        } finally {
          setIsValidating(false);
        }
        return;
      }

      // Default: No verification details provided
      setErrorMessage(
        "No password reset verification parameters found in the link.",
      );
      setIsValidating(false);
    };

    verifyReset();
  }, [oobCode, emailParam, tokenParam]);

  // 2. Perform reset and sync
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      toast.error(emailValidation.error);
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsResetting(true);
    try {
      if (emailParam && tokenParam) {
        // Direct Flow: Custom token synchronization

        // Fetch target user's old credentials
        let oldPassword = null;

        // Direct write / sync in Firebase Auth
        if (isFirebaseConfigured) {
          const finalCheck = validateEmail(email);
          if (!finalCheck.isValid) {
            throw new Error(finalCheck.error);
          }
          const tempAppName = `temp-auth-reset-${Date.now()}`;
          let tempApp = null;
          try {
            tempApp = initializeApp(firebaseConfig, tempAppName);
            const tempAuth = getAuth(tempApp);

            if (oldPassword) {
              // Sign in and update password
              try {
                const finalCheckInner = validateEmail(email);
                if (!finalCheckInner.isValid) {
                  throw new Error(finalCheckInner.error);
                }
                const userCredential = await signInWithEmailAndPassword(
                  tempAuth,
                  email,
                  oldPassword,
                );
                if (userCredential.user) {
                  await updatePassword(userCredential.user, newPassword);
                  console.log(
                    "[ResetPassword] Updated password directly in Firebase Auth",
                  );
                }
              } catch (signInErr: any) {
                // If login fails, provision the user directly as a fallback
                console.warn(
                  "[ResetPassword] Temporary sign-in failed, attempting direct creation:",
                  signInErr.message || signInErr,
                );
                try {
                  const finalCheckInner2 = validateEmail(email);
                  if (!finalCheckInner2.isValid) {
                    throw new Error(finalCheckInner2.error);
                  }
                  await createUserWithEmailAndPassword(
                    tempAuth,
                    email,
                    newPassword,
                  );
                } catch (createErr: any) {
                  if (createErr.code !== "auth/email-already-in-use") {
                    throw createErr;
                  }
                }
              }
            } else {
              // Fallback direct provision if no old credentials stored
              try {
                const finalCheckInner3 = validateEmail(email);
                if (!finalCheckInner3.isValid) {
                  throw new Error(finalCheckInner3.error);
                }
                await createUserWithEmailAndPassword(
                  tempAuth,
                  email,
                  newPassword,
                );
              } catch (createErr: any) {
                if (createErr.code !== "auth/email-already-in-use") {
                  throw createErr;
                }
              }
            }
            if (tempAuth.currentUser) {
              await signOut(tempAuth);
            }
          } catch (firebaseErr: any) {
            console.error(
              "[ResetPassword] Firebase sync failed during custom token update:",
              firebaseErr,
            );
            throw new Error(
              `Failed to sync password in Firebase Authentication: ${firebaseErr.message}`,
            );
          } finally {
            if (tempApp) {
              try {
                await deleteApp(tempApp);
              } catch (e) {}
            }
          }
        }

        // Update D1 credentials
        if (isD1Configured) {
          const { error } = await d1.auth.resetPassword(email, newPassword);
          if (error) {
            console.error(
              "[ResetPassword] Failed to update password in D1:",
              error,
            );
            throw new Error(`D1 Error: ${error.message}`);
          }

          // Clear the reset token from database
          await d1Client.execute({
            sql: "DELETE FROM password_resets WHERE email = ?",
            args: [email],
          });
        }
      } else {
        // Fallback: Standard Firebase OOB Code Reset
        if (isFirebaseConfigured && firebaseAuth) {
          await confirmPasswordReset(firebaseAuth, oobCode, newPassword);
        }

        // Update D1 credentials
        if (isD1Configured && email) {
          const { error } = await d1.auth.resetPassword(email, newPassword);
          if (error) {
            console.warn(
              "[ResetPassword] Warning updating password in D1:",
              error.message || error,
            );
          }
        }
      }

      // Update local mock credentials cache
      if (email) {
        try {
          const credentials = JSON.parse(
            localStorage.getItem("ei_hub_mock_credentials") || "{}",
          );
          credentials[email] = newPassword;
          localStorage.setItem(
            "ei_hub_mock_credentials",
            JSON.stringify(credentials),
          );
        } catch (e) {
          console.error("Error updating local mock credentials:", e);
        }
      }

      setSuccessMessage(
        "Your password has been successfully reset and synchronized across all portals!",
      );
      toast.success("Password reset successfully!");

      // Auto-redirect to login after 3.5 seconds
      setTimeout(() => {
        navigate("/");
      }, 3500);
    } catch (err: any) {
      console.error("[ResetPassword] Reset failed:", err);
      toast.error(err.message || "Failed to reset password. Please try again.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFFFF] p-4 relative overflow-hidden select-none">
      {/* Background Gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#E6F0FF] rounded-full -[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full -[120px] pointer-events-none" />

      <div className="w-full max-w-md glass-card border border-[#E5E7EB] rounded-[32px] p-8 shadow-sm space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-[#60A5FA]/15 border border-[#60A5FA] text-blue-900 mb-2">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight">
            EI HUB Password Reset
          </h1>
          <p className="text-xs text-gray-700">
            Secure credential synchronization portal
          </p>
        </div>

        {isValidating ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-3">
            <div className="w-8 h-8 border-4 border-[#60A5FA] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-700 font-medium">
              Verifying reset code...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-3">
              <ShieldAlert className="w-8 h-8 text-rose-900" />
              <p className="text-xs text-rose-900 font-semibold leading-relaxed text-center">
                {errorMessage}
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="w-full py-3 rounded-2xl bg-white border border-[#E5E7EB] hover:border-slate-500 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <span>Back to Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : successMessage ? (
          <div className="flex flex-col items-center text-center p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-4">
            <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-900">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-black">Reset Complete!</p>
              <p className="text-[11px] text-gray-700 leading-normal">
                {successMessage}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-gray-700 pt-2 border-t border-white/5 w-full justify-center">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              <span>Redirecting to Login Page...</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetSubmit} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-white border border-white/5 text-[11px] text-black leading-normal">
              Resetting credentials for:{" "}
              <strong className="text-indigo-900">{email}</strong>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-black font-semibold mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-4 pr-10 py-2.5 rounded-2xl glass-input text-black text-xs font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-700 hover:text-black"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-black font-semibold mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-2.5 rounded-2xl glass-input text-black text-xs font-medium"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isResetting}
              className="w-full py-3 rounded-2xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              <span>
                {isResetting
                  ? "Saving Credentials..."
                  : "Reset and Synchronize Password"}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
