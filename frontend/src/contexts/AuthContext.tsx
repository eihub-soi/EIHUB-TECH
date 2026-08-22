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
        return await apiRequest("/api/profiles", { signal });
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
            if (fbUser.email && !validateEmail(fbUser.email).isValid) {
              try {
                await fbUser.delete();
              } catch (e) {
                console.error(
                  "Error deleting unauthorized Google user in auth listener:",
                  e,
                );
              }
              await firebaseSignOut(firebaseAuth!);
              if (isMountedRef.current) {
                setUser(null);
                setIsLoading(false);
              }
              return;
            }
            let profile = null;
            try {
              profile = await fetchProfileWithRetry(controller.signal);
            } catch (err: any) {
              if (err.name !== 'AbortError') {
                console.warn(
                  "[AuthContext] Failed to query profile from FastAPI backend:",
                  err,
                );
              }
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
                  console.log(
                    "[AuthContext] Successfully synced D1 profile details to Firebase Auth login credentials.",
                  );
                } catch (updateErr) {
                  console.warn(
                    "[AuthContext] Failed to sync profile details to Firebase Auth:",
                    updateErr,
                  );
                }
              }
            }
          } else {
            // No fbUser
            if (isMountedRef.current) {
              setUser(null);
            }
          }
        } catch (err) {
          console.error(
            "Error fetching D1 profile on Firebase auth change:",
            err,
          );
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
      // 1. Try Firebase Authentication (Primary & Exclusive when active)
      if (isFirebaseConfigured && firebaseAuth) {
        console.log(
          "[AuthContext] Attempting login via Firebase Auth (Exclusive Provider)...",
        );
        const finalEmailCheck = validateEmail(email);
        if (!finalEmailCheck.isValid) {
          throw new Error(finalEmailCheck.error);
        }
        const userCredential = await signInWithEmailAndPassword(
          firebaseAuth,
          email,
          password,
        );
        if (userCredential.user) {
          let profile = null;
          try {
            profile = await apiRequest("/api/profiles");
          } catch (err) {
            console.warn(
              "[AuthContext] Failed to query profile from FastAPI backend during login:",
              err,
            );
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
            const emailLower = email;
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
                  password: password,
                  username: userCredential.user.email || email,
                }),
              });
            } catch (err) {
              console.error(
                "[AuthContext] Error syncing profile with FastAPI backend during email login:",
                err,
              );
            }

            if (!profile) {
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
              localStorage.setItem(
                "ei_hub_profiles_v2",
                JSON.stringify(localProfiles),
              );
              profile = newLocalProfile;
            }
          }

          if (profile) {
            if (profile.role !== role) {
              throw new Error(
                `This account is registered as a ${profile.role.toUpperCase()}, not ${role.toUpperCase()}.`,
              );
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
            mockEngine.logActivity("LOGIN", "USER", profile.id, {
              email: fullProfile.email,
              role: fullProfile.role,
            });
            return;
          } else {
            throw new Error("User profile record could not be found.");
          }
        }
      } else if (isD1Configured) {
        // Fallback check sequence if Firebase is not configured
        console.log(
          "[AuthContext] Firebase Auth not active. Attempting login via D1 Auth...",
        );
        const { data: authData, error: authError } =
          await d1.auth.signInWithPassword({
            email,
            password,
          });

        if (authError) {
          throw new Error(authError.message);
        }

        if (authData?.user) {
          const { data: profile } = await d1
            .from("profiles")
            .select("*")
            .eq("id", authData.user.id)
            .single();

          if (profile) {
            if (profile.role !== role) {
              throw new Error(
                `This account is registered as a ${profile.role.toUpperCase()}, not ${role.toUpperCase()}.`,
              );
            }
            setUser(profile as Profile);
            localStorage.setItem("ei_hub_active_user_id", profile.id);
            localStorage.setItem(
              "ei_hub_active_user_profile",
              JSON.stringify(profile),
            );
            mockEngine.logActivity("LOGIN", "USER", profile.id, {
              email: (profile as Profile).email,
              role: (profile as Profile).role,
            });
            return;
          } else {
            throw new Error("User profile record could not be found.");
          }
        }
      } else {
        // Fallback for mock mode if both Firebase and D1 are completely disabled
        const credentials = JSON.parse(
          localStorage.getItem("ei_hub_mock_credentials") || "{}",
        );
        if (!credentials["faculty-01@kgkite.ac.in"])
          credentials["faculty-01@kgkite.ac.in"] = "24faculty@71";
        if (!credentials["admin-02@kgkite.ac.in"])
          credentials["admin-02@kgkite.ac.in"] = "24admin@71";

        const correctPassword = credentials[email];
        if (!correctPassword) {
          throw new Error("Invalid email address. Account not registered.");
        }

        if (correctPassword !== password) {
          throw new Error("Incorrect password. Please try again.");
        }

        const currentProfiles = mockEngine.getProfiles();
        const found = currentProfiles.find(
          (p) => p.email && typeof p.email === "string" && p.email === email,
        );
        if (!found) {
          throw new Error("Profile details not found in registry.");
        }

        if (found.role !== role) {
          throw new Error(
            `This account is registered as a ${found.role.toUpperCase()}, not ${role.toUpperCase()}.`,
          );
        }

        setUser(found);
        localStorage.setItem("ei_hub_active_user_id", found.id);
        localStorage.setItem(
          "ei_hub_active_user_profile",
          JSON.stringify(found),
        );
        mockEngine.logActivity("LOGIN", "USER", found.id, {
          email: found.email,
          role: found.role,
        });
      }
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
        profile = await apiRequest("/api/profiles");
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
