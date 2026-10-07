import React, { createContext, useContext, useState, useEffect } from "react";
import { Profile, UserRole } from "../types";
import { mockEngine } from "../services/mockEngine";
import { d1, isD1Configured } from "../lib/d1_client";
import {
  auth as firebaseAuth,
  db as firestoreDb,
  isFirebaseConfigured,
} from "../firebase/client";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { apiRequest } from "../utils/api";
import { validateEmail } from "../utils/emailValidation";

interface AuthContextType {
  user: Profile | null;
  setUser: (user: Profile | null) => void;
  role: UserRole;
  isLoading: boolean;
  switchRole: (newRole: UserRole) => void;
  loginWithEmail: (
    email: string,
    password: string,
    role: UserRole,
  ) => Promise<void>;
  loginWithGoogle: (role: UserRole) => Promise<void>;
  logout: () => void;
  demoProfiles: Profile[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isUUID = (str: string): boolean => {
  const uuidPattern =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidPattern.test(str);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const demoProfiles = mockEngine.getProfiles();

  // Load saved user from localStorage if authenticated
  const getSavedUser = (): Profile | null => {
    const savedId = localStorage.getItem("ei_hub_active_user_id");
    if (savedId) {
      const savedProfileStr = localStorage.getItem(
        "ei_hub_active_user_profile",
      );
      if (savedProfileStr) {
        try {
          return JSON.parse(savedProfileStr);
        } catch (e) {
          // ignore
        }
      }
      const found = demoProfiles.find((p) => p.id === savedId);
      if (found) return found;
    }
    return null;
  };

  const [user, setUser] = useState<Profile | null>(getSavedUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isMountedRef = React.useRef<boolean>(true);
  const activeFetchControllerRef = React.useRef<AbortController | null>(null);

  const fetchProfileWithRetry = async (
    signal: AbortSignal,
    maxRetries = 3,
    delayMs = 500
  ): Promise<any> => {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await apiRequest("/api/profiles", { signal, timeout: 5000 });
      } catch (err: any) {
        if (err.name === 'AbortError' || signal.aborted) {
          throw err;
        }
        
        const message = err.message || "";
        const is4xx = 
          message.includes("Unauthorized") || 
          message.includes("Forbidden") || 
          message.includes("Not Found") || 
          message.includes("Conflict") || 
          message.includes("Validation Error");
          
        if (is4xx) {
          throw err;
        }
        
        attempt++;
        if (attempt >= maxRetries) {
          throw err;
        }
        
        const backoffDelay = delayMs * Math.pow(2, attempt) + Math.random() * 200;
        console.warn("[AuthContext] Temporary error fetching profile, retrying attempt", attempt, "/", maxRetries, "in", backoffDelay.toFixed(0), "ms...", err);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    if (isFirebaseConfigured && firebaseAuth) {
      setIsLoading(true);
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
        // Cancel any existing request
        if (activeFetchControllerRef.current) {
          activeFetchControllerRef.current.abort();
        }
        
        // Create new AbortController
        const controller = new AbortController();
        activeFetchControllerRef.current = controller;
        
        try {
          if (fbUser) {
            try {
              const token = await fbUser.getIdToken();
              localStorage.setItem("ei_hub_auth_token", token);
            } catch {
              // Ignore token fetch error
            }

            if (fbUser.email && !validateEmail(fbUser.email).isValid) {
              try {
                await fbUser.delete();
              } catch {
                // Ignore delete error
              }
              await firebaseSignOut(firebaseAuth!);
              if (isMountedRef.current) {
                setUser(null);
                localStorage.removeItem("ei_hub_auth_token");
                localStorage.removeItem("ei_hub_active_user_id");
                localStorage.removeItem("ei_hub_active_user_profile");
                setIsLoading(false);
              }
              return;
            }
            let profile = null;
            try {
              profile = await fetchProfileWithRetry(controller.signal);
            } catch {
              // Ignore profile query error
            }

            // Local fallback if FastAPI query failed
            if (!profile && !controller.signal.aborted) {
              const localProfiles = mockEngine.getProfiles();
              profile =
                localProfiles.find(
                  (p) =>
                    p.id === fbUser.uid ||
                    (p as any).firebase_uid === fbUser.uid ||
                    (fbUser.email && p.email && p.email === fbUser.email),
                ) || null;
            }

            if (profile && !controller.signal.aborted) {
              const fullProfile = {
                ...profile,
                email: profile.email || fbUser.email || "",
              } as Profile;
              
              if (isMountedRef.current) {
                setUser(fullProfile);
                localStorage.setItem("ei_hub_active_user_id", profile.id);
                localStorage.setItem(
                  "ei_hub_active_user_profile",
                  JSON.stringify(fullProfile),
                );
              }

              // Sync D1 profile details to Firebase Auth login details
              const needsUpdate =
                fbUser.displayName !== fullProfile.full_name ||
                fbUser.photoURL !== fullProfile.avatar_url;
              if (needsUpdate) {
                try {
                  await updateProfile(fbUser, {
                    displayName: fullProfile.full_name,
                    photoURL: fullProfile.avatar_url || undefined,
                  });
                } catch {
                  // Safe silent fail
                }
              }
            }
          } else {
            // No fbUser
            if (isMountedRef.current) {
              setUser(null);
              localStorage.removeItem("ei_hub_auth_token");
            }
          }
        } catch {
          // Ignore auth listener error
        } finally {
          if (isMountedRef.current && !controller.signal.aborted) {
            setIsLoading(false);
          }
        }
      });
      
      return () => {
        isMountedRef.current = false;
        if (activeFetchControllerRef.current) {
          activeFetchControllerRef.current.abort();
        }
        unsubscribe();
      };
    } else if (isD1Configured) {
      setIsLoading(true);
      const initAuth = async () => {
        try {
          const {
            data: { session },
          } = await d1.auth.getSession();
          if (session?.user) {
            const { data } = await d1
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .single();
            if (data) {
              setUser(data as Profile);
              localStorage.setItem(
                "ei_hub_active_user_profile",
                JSON.stringify(data),
              );
            }
          }
        } catch {
          // ignore
        } finally {
          setIsLoading(false);
        }
      };

      initAuth();

      const { data: authListener } = d1.auth.onAuthStateChange(
        (event, session) => {
          if (session?.user) {
            d1.from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .single()
              .then(({ data }) => {
                if (data) {
                  setUser(data as Profile);
                  localStorage.setItem(
                    "ei_hub_active_user_profile",
                    JSON.stringify(data),
                  );
                }
              });
          }
        },
      );

      return () => {
        authListener.subscription.unsubscribe();
      };
    } else {
      setIsLoading(false);
    }
  }, []);

  const switchRole = (newRole: UserRole) => {
    const target = demoProfiles.find((p) => p.role === newRole);
    if (target) {
      const oldRole = user?.role;
      setUser(target);
      localStorage.setItem("ei_hub_active_user_id", target.id);
      localStorage.setItem(
        "ei_hub_active_user_profile",
        JSON.stringify(target),
      );
      mockEngine.logActivity("ROLE_SWITCH", "USER", target.id, {
        from: oldRole,
        to: newRole,
      });
    }
  };

  const loginWithEmail = async (
    email: string,
    password: string,
    role: UserRole,
  ) => {
    const t0 = performance.now();
    setIsLoading(true);
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setIsLoading(false);
      throw new Error(emailValidation.error);
    }
    if (!password) {
      setIsLoading(false);
      throw new Error("Password cannot be empty.");
    }
    try {
      if (isFirebaseConfigured && firebaseAuth) {
        let userCredential;
        try {
          userCredential = await signInWithEmailAndPassword(
            firebaseAuth,
            email,
            password,
          );
        } catch {
          throw new Error("Invalid ID/password");
        }

        if (userCredential?.user) {
          const t1 = performance.now();
          try {
            const token = await userCredential.user.getIdToken();
            localStorage.setItem("ei_hub_auth_token", token);
          } catch {
            // Ignore token error
          }

          let profile = null;
          try {
            profile = await apiRequest("/api/profiles", { timeout: 3000 });
          } catch {
            // Fallback lookup
          }

          if (!profile) {
            const localProfiles = mockEngine.getProfiles();
            profile =
              localProfiles.find(
                (p) =>
                  p.id === userCredential.user.uid ||
                  (p as any).firebase_uid === userCredential.user.uid ||
                  (userCredential.user.email &&
                    p.email &&
                    p.email === userCredential.user.email),
              ) || null;
          }

          if (!profile) {
            const emailLower = email.toLowerCase();
            let newRole: UserRole = "student";
            let fullName = "User";
            let dept = "Electronics & Communication Engineering";

            if (emailLower === "faculty-01@kgkite.ac.in") {
              newRole = "faculty";
              fullName = "Faculty Coordinator";
            } else if (emailLower === "admin-02@kgkite.ac.in") {
              newRole = "admin";
              fullName = "System Administrator";
              dept = "System Administration";
            }

            const newId = crypto.randomUUID();

            try {
              profile = await apiRequest("/api/profiles/sync", {
                timeout: 3000,
                method: "POST",
                body: JSON.stringify({
                  id: newId,
                  firebase_uid: userCredential.user.uid,
                  email: userCredential.user.email || email,
                  full_name: fullName,
                  role: newRole,
                  department: dept,
                  phone: "+91 98765 43210",
                  register_number:
                    newRole === "student"
                      ? `7117${Math.floor(21100000 + Math.random() * 900000)}`
                      : null,
                  username: userCredential.user.email || email,
                }),
              });
            } catch {
              // Ignore profile sync failure
            }

            if (!profile && mockEngine.isMockEnabled()) {
              const localProfiles = mockEngine.getProfiles();
              const newLocalProfile = {
                id: newId,
                firebase_uid: userCredential.user.uid,
                email: userCredential.user.email || email,
                full_name: fullName,
                role: newRole,
                department: dept,
                phone: "+91 98765 43210",
                register_number:
                  newRole === "student"
                    ? `7117${Math.floor(21100000 + Math.random() * 900000)}`
                    : null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                username: userCredential.user.email || email,
              } as Profile;
              localProfiles.push(newLocalProfile);
              profile = newLocalProfile;
            }
          }

          const t2 = performance.now();
          if (profile) {
            if (profile.role !== role) {
              try {
                await firebaseSignOut(firebaseAuth);
              } catch {
                // Ignore signout error
              }
              localStorage.removeItem("ei_hub_auth_token");
              localStorage.removeItem("ei_hub_active_user_id");
              localStorage.removeItem("ei_hub_active_user_profile");
              setUser(null);
              throw new Error("Invalid ID/password");
            }
            const fullProfile = {
              ...profile,
              email: profile.email || userCredential.user.email || email,
            } as Profile;
            setUser(fullProfile);
            localStorage.setItem("ei_hub_active_user_id", profile.id);
            localStorage.setItem(
              "ei_hub_active_user_profile",
              JSON.stringify(fullProfile),
            );
            const t3 = performance.now();
            (window as any).__lastLoginMetrics = {
              t0,
              t1,
              t2,
              t3,
              totalMs: t3 - t0,
            };
            return;
          } else {
            throw new Error("Invalid ID/password");
          }
        }
      } else if (isD1Configured) {
        const { data: authData, error: authError } =
          await d1.auth.signInWithPassword({
            email,
            password,
          });

        if (authError || !authData?.user) {
          throw new Error("Invalid ID/password");
        }

        const { data: profile } = await d1
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .single();

        if (profile) {
          if (profile.role !== role) {
            d1.auth.signOut();
            localStorage.removeItem("ei_hub_auth_token");
            localStorage.removeItem("ei_hub_active_user_id");
            localStorage.removeItem("ei_hub_active_user_profile");
            setUser(null);
            throw new Error("Invalid ID/password");
          }
          setUser(profile as Profile);
          localStorage.setItem("ei_hub_active_user_id", profile.id);
          localStorage.setItem(
            "ei_hub_active_user_profile",
            JSON.stringify(profile),
          );
          return;
        } else {
          throw new Error("Invalid ID/password");
        }
      } else {
        const credentials = JSON.parse(
          localStorage.getItem("ei_hub_mock_credentials") || "{}",
        );
        if (!credentials["faculty-01@kgkite.ac.in"])
          credentials["faculty-01@kgkite.ac.in"] = "24faculty@71";
        if (!credentials["admin-02@kgkite.ac.in"])
          credentials["admin-02@kgkite.ac.in"] = "24admin@71";

        const correctPassword = credentials[email];
        if (!correctPassword || correctPassword !== password) {
          throw new Error("Invalid ID/password");
        }

        const currentProfiles = mockEngine.getProfiles();
        const found = currentProfiles.find(
          (p) => p.email && typeof p.email === "string" && p.email === email,
        );
        if (!found || found.role !== role) {
          throw new Error("Invalid ID/password");
        }

        setUser(found);
        localStorage.setItem("ei_hub_active_user_id", found.id);
        localStorage.setItem(
          "ei_hub_active_user_profile",
          JSON.stringify(found),
        );
      }
    } catch (err: any) {
      if (
        err.message === "ID/email cannot be empty." ||
        err.message === "Password cannot be empty." ||
        err.message?.includes("must be") ||
        err.message?.includes("lowercase")
      ) {
        throw err;
      }
      throw new Error("Invalid ID/password");
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (role: UserRole) => {
    if (role !== "student") {
      throw new Error("Google Sign-In is restricted to Students only.");
    }
    setIsLoading(true);
    try {
      if (!isFirebaseConfigured || !firebaseAuth) {
        throw new Error("Firebase Authentication is not configured.");
      }

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      const userCredential = await signInWithPopup(firebaseAuth, provider);
      const user = userCredential.user;

      if (user.email) {
        const googleEmailCheck = validateEmail(user.email);
        if (!googleEmailCheck.isValid) {
          try {
            await user.delete();
          } catch (e) {
            console.error("Error deleting unauthorized Google user:", e);
          }
          await firebaseSignOut(firebaseAuth);
          throw new Error(googleEmailCheck.error);
        }
      }

      // Retrieve the profile from FastAPI / Fallback
      let profile = null;
      try {
        profile = await apiRequest("/api/profiles", { timeout: 5000 });
      } catch (err) {
        console.warn(
          "[AuthContext] Failed to query profile from FastAPI backend during Google sign-in:",
          err,
        );
      }

      if (!profile) {
        const localProfiles = mockEngine.getProfiles();
        profile =
          localProfiles.find(
            (p) =>
              p.id === user.uid ||
              (p as any).firebase_uid === user.uid ||
              (user.email && p.email && p.email === user.email),
          ) || null;
      }

      if (profile && profile.role !== "student") {
        await firebaseSignOut(firebaseAuth);
        throw new Error(
          "Google Sign-In is restricted to Students only. Faculty and Admin accounts must sign in using Email & Password.",
        );
      }

      if (!profile) {
        // Create new profile record for first-time Google sign-up
        const newProfileId = crypto.randomUUID();

        // 1. Insert into Firebase Firestore if configured
        if (isFirebaseConfigured && firestoreDb) {
          try {
            await setDoc(doc(firestoreDb, "profiles", newProfileId), {
              id: newProfileId,
              firebase_uid: user.uid,
              email: user.email || undefined,
              full_name: user.displayName || "Google User",
              role: "student",
              department: "Electronics & Communication Engineering",
              phone: user.phoneNumber || "",
              register_number: `7117${Math.floor(21100000 + Math.random() * 900000)}`,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            console.log(
              "[AuthContext] Auto-saved new Google user profile to Firebase Firestore",
            );
          } catch (firestoreErr) {
            console.error(
              "[AuthContext] Error auto-saving new Google user profile to Firestore:",
              firestoreErr,
            );
          }
        }

        // 2. Sync Google profile with FastAPI backend
        try {
          profile = await apiRequest("/api/profiles/sync", {
            timeout: 5000,
            method: "POST",
            body: JSON.stringify({
              id: newProfileId,
              firebase_uid: user.uid,
              email: user.email,
              full_name: user.displayName || "Google User",
              role: "student",
              department: "Electronics & Communication Engineering",
              phone: user.phoneNumber || "",
              register_number: `7117${Math.floor(21100000 + Math.random() * 900000)}`,
              username: user.email?.toLowerCase(),
            }),
          });
        } catch (err) {
          console.error(
            "[AuthContext] Error syncing Google profile with FastAPI backend:",
            err,
          );
        }

        if (!profile) {
          const localProfiles = mockEngine.getProfiles();
          const newLocalProfile = {
            id: newProfileId,
            firebase_uid: user.uid,
            email: user.email || "",
            full_name: user.displayName || "Google User",
            role: "student",
            department: "Electronics & Communication Engineering",
            phone: user.phoneNumber || "",
            register_number: `7117${Math.floor(21100000 + Math.random() * 900000)}`,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            username: user.email?.toLowerCase() || "",
          } as Profile;
          localProfiles.push(newLocalProfile);
          localStorage.setItem(
            "ei_hub_profiles_v2",
            JSON.stringify(localProfiles),
          );
          profile = newLocalProfile;
        }
      }

      if (profile) {
        const fullProfile = {
          ...profile,
          email: profile.email || user.email || "",
        } as Profile;
        setUser(fullProfile);
        localStorage.setItem("ei_hub_active_user_id", profile.id);
        localStorage.setItem(
          "ei_hub_active_user_profile",
          JSON.stringify(fullProfile),
        );
        mockEngine.logActivity("LOGIN", "USER", profile.id, {
          email: fullProfile.email,
          role: fullProfile.role,
          provider: "google",
        });
      }
    } catch (err: any) {
      console.error("Google sign-in error:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    if (user) {
      mockEngine.logActivity("LOGOUT", "USER", user.id, {
        email: user.email,
        role: user.role,
      });
    }
    if (isFirebaseConfigured && firebaseAuth) {
      firebaseSignOut(firebaseAuth);
    } else if (isD1Configured) {
      d1.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem("ei_hub_auth_token");
    localStorage.removeItem("ei_hub_active_user_id");
    localStorage.removeItem("ei_hub_active_user_profile");
  };

  useEffect(() => {
    if (user && isD1Configured) {
      mockEngine
        .syncWithD1()
        .catch((err) => console.error("D1 sync on user change failed:", err));
    }
  }, [user]);

  useEffect(() => {
    const handleProfilesChange = () => {
      if (user) {
        const latestProfiles = mockEngine.getProfiles();
        const updatedProfile = latestProfiles.find((p) => p.id === user.id);
        if (updatedProfile) {
          const hasChanged =
            JSON.stringify(updatedProfile) !== JSON.stringify(user);
          if (hasChanged) {
            console.log(
              "[AuthContext] Active profile change detected. Syncing session details.",
            );
            setUser(updatedProfile);
            localStorage.setItem(
              "ei_hub_active_user_profile",
              JSON.stringify(updatedProfile),
            );
          }
        }
      }
    };

    const unsubscribe = mockEngine.subscribe(handleProfilesChange);
    return () => {
      unsubscribe();
    };
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        role: user ? user.role : "student",
        isLoading,
        switchRole,
        loginWithEmail,
        loginWithGoogle,
        logout,
        demoProfiles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
