import React, { useState, useEffect } from "react";
import { mockEngine } from "../../services/mockEngine";
import { getAvatarUrl } from "../../utils/avatar";
import { Avatar } from "../../components/common/Avatar";
import { Profile, UserRole } from "../../types";
import { toast } from "sonner";
import { formatDateOnly, formatTimestamp } from "../../utils/timestamp";
import { d1, isD1Configured, client as d1Client } from "../../lib/d1_client";
import { sendBrevoPasswordResetLink } from "../../utils/brevoService";
import { useAuth } from "../../contexts/AuthContext";
import { apiRequest } from "../../utils/api";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import {
  firebaseConfig,
  isFirebaseConfigured,
  db as firestoreDb,
} from "../../firebase/client";
import { doc, deleteDoc } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { validateEmail } from "../../utils/emailValidation";
import {
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  Shield,
  GraduationCap,
  Briefcase,
  X,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";

export const UserManagement: React.FC = () => {
  const { user: currentUser, setUser: setCurrentUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>(mockEngine.getProfiles());
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);

  // User Details Modal State
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDetailsUser, setSelectedDetailsUser] =
    useState<Profile | null>(null);

  // Password Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<Profile | null>(null);

  useEscapeKey(() => setShowAddModal(false), showAddModal);
  useEscapeKey(() => {
    setShowDetailsModal(false);
    setSelectedDetailsUser(null);
  }, showDetailsModal);
  useEscapeKey(() => {
    setShowResetModal(false);
    setResetTargetUser(null);
  }, showResetModal);

  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    role: "" as any,
    register_number: "",
    faculty_id: "",
    department: "",
    phone: "",
    password: "",
    roll_number: "",
    institution: "KGISL Institute of Technology",
    is_active: true,
    year_of_study: "",
    username: "",
  });
  const [emailError, setEmailError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!showAddModal) {
      setShowPassword(false);
    }
  }, [showAddModal]);

  useEffect(() => {
    // 1. Initial Load of profiles from D1 database
    const loadProfiles = async () => {
      if (isD1Configured) {
        try {
          const { data, error } = await d1.from("profiles").select("*");
          if (!error && data) {
            setProfiles(data as Profile[]);
            localStorage.setItem("ei_hub_profiles_v2", JSON.stringify(data));
          }
        } catch (e) {
          console.error("Error loading profiles from D1:", e);
        }
      }
    };
    loadProfiles();

    // 2. Subscribe to mockEngine updates (which triggers on live D1 Realtime Channel events)
    const unsubscribe = mockEngine.subscribe(() => {
      console.log("[UserManagement] Realtime update notified by mockEngine!");
      setProfiles(mockEngine.getProfiles());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const filteredUsers = profiles.filter((p) => {
    const matchesRole = roleFilter === "All" || p.role === roleFilter;
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Active" ? p.is_active : !p.is_active);
    const matchesSearch =
      (p.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.register_number && p.register_number.includes(searchQuery));
    return matchesRole && matchesStatus && matchesSearch;
  });

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      email: "",
      full_name: "",
      role: "" as any,
      register_number: "",
      faculty_id: "",
      department: "",
      phone: "",
      password: "",
      roll_number: "",
      institution: "KGISL Institute of Technology",
      is_active: true,
      year_of_study: "",
      username: "",
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (user: Profile) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      register_number: user.register_number || "",
      faculty_id: user.faculty_id || "",
      department: user.department,
      phone: user.phone || "",
      password: "",
      roll_number: user.roll_number || "",
      institution: user.institution || "KGISL Institute of Technology",
      is_active: user.is_active,
      year_of_study: user.year_of_study || "3rd Year",
      username: user.username || "",
    });
    setShowAddModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      toast.error(emailValidation.error);
      return;
    }
    const targetUsername = formData.email.trim();
    if (!editingUser && (!formData.password || formData.password.length < 6)) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (!formData.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!formData.phone.trim()) {
      toast.error("Mobile number is required");
      return;
    }
    if (formData.role === "student") {
      if (!formData.roll_number.trim()) {
        toast.error("Student roll number is required");
        return;
      }
      if (!formData.register_number.trim()) {
        toast.error("Student register number is required");
        return;
      }
    }
    if (formData.role === "faculty" && !formData.faculty_id.trim()) {
      toast.error("Faculty ID is required");
      return;
    }

    try {
      setIsSaving(true);
      if (editingUser) {
        // Send PUT update request directly to FastAPI backend
        const payload = {
          user_id: editingUser.id,
          email: formData.email.trim(),
          full_name: formData.full_name.trim(),
          role: formData.role,
          department: formData.department,
          phone: formData.phone.trim(),
          mobile_number: formData.phone.trim(),
          register_number: formData.register_number || null,
          roll_number: formData.roll_number || null,
          institution: formData.institution,
          year_of_study: formData.year_of_study || null,
          faculty_id: formData.faculty_id || null,
          is_active: formData.is_active,
          username: targetUsername,
        };

        const result = await apiRequest(`/api/profiles/${editingUser.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        if (result && result.success && result.user) {
          const updatedUser: Profile = {
            id: result.user.user_id || result.user.id,
            email: result.user.email,
            full_name: result.user.full_name,
            role: result.user.role,
            department: result.user.department,
            phone: result.user.phone || result.user.mobile_number || "",
            register_number: result.user.register_number || "",
            roll_number: result.user.roll_number || "",
            institution: result.user.institution || "",
            year_of_study: result.user.year_of_study || "3rd Year",
            faculty_id: result.user.faculty_id || "",
            is_active: result.user.is_active,
            username: result.user.username || "",
            avatar_url: editingUser.avatar_url,
            created_at: editingUser.created_at,
            updated_at: new Date().toISOString()
          };

          // 1. Update localStorage profiles list
          const currentProfiles = mockEngine.getProfiles();
          const idx = currentProfiles.findIndex((p) => p.id === updatedUser.id);
          if (idx !== -1) {
            currentProfiles[idx] = updatedUser;
          } else {
            currentProfiles.push(updatedUser);
          }
          localStorage.setItem("ei_hub_profiles_v2", JSON.stringify(currentProfiles));

          // 2. If the edited user is the currently logged-in user, update AuthContext
          if (currentUser && currentUser.id === updatedUser.id) {
            setCurrentUser(updatedUser);
            localStorage.setItem("ei_hub_active_user_profile", JSON.stringify(updatedUser));
          }

          // 3. Notify mockEngine subscribers (reloads users table and other active components)
          mockEngine.notify();

          toast.success(`Updated profile for ${updatedUser.full_name}`);
          setShowAddModal(false);
        } else {
          throw new Error(result?.message || "Failed to update profile record");
        }
      } else {
        let profileId: string = crypto.randomUUID();
        let firebaseUid = undefined;

        // 1. Provision user in Firebase Authentication using secondary isolated app connection
        if (isFirebaseConfigured) {
          const tempAppName = `temp-auth-create-${Date.now()}`;
          let tempApp = null;
          try {
            tempApp = initializeApp(firebaseConfig, tempAppName);
            const tempAuth = getAuth(tempApp);

            const finalCheck = validateEmail(formData.email);
            if (!finalCheck.isValid) {
              throw new Error(finalCheck.error);
            }
            const userCredential = await createUserWithEmailAndPassword(
              tempAuth,
              formData.email,
              formData.password,
            );
            if (userCredential.user) {
              firebaseUid = userCredential.user.uid;
              profileId = firebaseUid; // Keep IDs consistent across Firebase & D1 database
              console.log(
                "[UserManagement] Created permanent user in Firebase Auth:",
                firebaseUid,
              );

              // Sign out from the secondary connection to leave active Admin session untouched
              await signOut(tempAuth);
            }
          } catch (firebaseErr: any) {
            console.error(
              "[UserManagement] Firebase user creation failed:",
              firebaseErr,
            );
            throw new Error(`Firebase Auth Error: ${firebaseErr.message}`);
          } finally {
            if (tempApp) {
              try {
                await deleteApp(tempApp);
              } catch (e) { }
            }
          }
        }

        // 2. If D1 Database is configured, insert credentials into the local credentials store
        if (isD1Configured) {
          try {
            const { error: signUpError } = await d1.auth.signUp({
              email: formData.email,
              password: formData.password,
            });
            if (
              signUpError &&
              signUpError.message !== "User already exists" &&
              !signUpError.message.includes("Please use Firebase Authentication")
            ) {
              console.error(
                "[UserManagement] D1 auth creation warning:",
                signUpError.message,
              );
            }
          } catch (err) {
            console.warn("[UserManagement] D1 auth signUp failed:", err);
          }
        }

        // 2.5. Save details directly in D1 if configured
        if (isD1Configured) {
          try {
            const { error: profileError } = await d1.from("profiles").insert({
              id: profileId,
              firebase_uid: firebaseUid || null,
              email: formData.email,
              full_name: formData.full_name,
              role: formData.role,
              department: formData.department,
              phone: formData.phone,
              register_number: formData.register_number || null,
              roll_number: formData.roll_number || null,
              institution: formData.institution,
              year_of_study: formData.year_of_study || null,
              is_active: formData.is_active ? 1 : 0,
              password: formData.password,
              username: targetUsername,
            });
            if (profileError) {
              console.error(
                "[UserManagement] Error inserting profile directly in D1:",
                profileError,
              );
            }
          } catch (err) {
            console.error("[UserManagement] D1 insert error:", err);
          }
        }

        // 3. Create the user profile row
        await mockEngine.addProfile(
          {
            ...formData,
            id: profileId,
            firebase_uid: firebaseUid,
            avatar_url: getAvatarUrl({ role: formData.role }),
            username: targetUsername,
          },
          formData.password,
        );
        toast.success(
          `Created new ${formData.role} user: ${formData.full_name}`,
        );
      }

      // Reload profiles from D1 database to reflect changes instantly on the UI
      if (isD1Configured) {
        const { data } = await d1.from("profiles").select("*");
        if (data) {
          setProfiles(data as Profile[]);
          localStorage.setItem("ei_hub_profiles_v2", JSON.stringify(data));
        }
      } else {
        setProfiles(mockEngine.getProfiles());
      }
      setShowAddModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save user");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDetails = (user: Profile) => {
    setSelectedDetailsUser(user);
    setShowDetailsModal(true);
  };

  const handleOpenReset = (user: Profile) => {
    setResetTargetUser(user);
    setShowResetModal(true);
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    if (!resetTargetUser.email) {
      toast.error("This user does not have a registered email address.");
      return;
    }
    try {
      const normalizedEmail = resetTargetUser.email.toLowerCase().trim();
      const token =
        Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      if (isD1Configured) {
        await d1Client.execute({
          sql: "INSERT OR REPLACE INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)",
          args: [normalizedEmail, token, expiresAt],
        });
      }

      const resetLink = `${window.location.origin}/reset-password?email=${encodeURIComponent(normalizedEmail)}&token=${token}`;

      await sendBrevoPasswordResetLink(
        normalizedEmail,
        resetTargetUser.full_name || "User",
        resetLink,
      );

      toast.success(
        `A secure password reset link has been successfully sent to ${resetTargetUser.email}.`,
      );
      setShowResetModal(false);
      setResetTargetUser(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to send reset link");
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete user ${name}?`)) {
      // 1. Delete from Firebase Firestore if configured
      if (isFirebaseConfigured && firestoreDb) {
        try {
          await deleteDoc(doc(firestoreDb, "profiles", id));
          console.log(
            "[UserManagement] Deleted user profile from Firestore:",
            id,
          );
        } catch (firestoreErr) {
          console.error(
            "[UserManagement] Error deleting user profile from Firestore:",
            firestoreErr,
          );
        }
      }

      // 2. Delete from D1 Database directly if configured on frontend
      if (isD1Configured) {
        try {
          const targetUser = profiles.find((p) => p.id === id);
          await d1.from("profiles").delete().eq("id", id);
          console.log("[UserManagement] Deleted user profile from D1:", id);
        } catch (err) {
          console.error("[UserManagement] Error deleting user from D1:", err);
        }
      }

      // 3. Delete from local mockEngine / FastAPI backend (which deletes from D1 and Firebase Auth)
      await mockEngine.deleteProfile(id);
      toast.success(`Deleted user ${name}`);

      // Reload profiles from D1 database to reflect changes instantly on the UI
      if (isD1Configured) {
        const { data } = await d1.from("profiles").select("*");
        if (data) {
          setProfiles(data as Profile[]);
          localStorage.setItem("ei_hub_profiles_v2", JSON.stringify(data));
        }
      } else {
        setProfiles(mockEngine.getProfiles());
      }
    }
  };

  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case "student":
        return (
          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-[#E6F0FF] text-indigo-900 border border-[#60A5FA]">
            Student
          </span>
        );
      case "faculty":
        return (
          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/20 text-emerald-900 border border-emerald-500/30">
            Faculty
          </span>
        );
      case "admin":
        return (
          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-500/20 text-amber-900 border border-gold-500/30">
            Admin
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-black tracking-tight">
            User Management
          </h1>
          <p className="text-xs text-gray-700 mt-0.5">
            Provision student credentials, assign faculty roles, and control
            access permissions
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-bold text-xs transition-all hover:scale-105"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Filter Toolbar matching preview UI */}
      <div className="p-4 rounded-3xl glass-card border border-[#E5E7EB] flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name, email, register no..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl glass-input text-xs"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-2xl glass-input text-xs text-black"
        >
          <option value="All">All Roles</option>
          <option value="student">Student</option>
          <option value="faculty">Faculty</option>
          <option value="admin">Admin</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-2xl glass-input text-xs text-black"
        >
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>

      {/* Users Data Table matching preview UI */}
      <div className="glass-card rounded-3xl border border-[#E5E7EB] overflow-hidden ">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-white text-[10px] font-bold uppercase tracking-wider text-gray-700">
                <th className="py-3.5 px-6">User</th>
                <th className="py-3.5 px-6">Email</th>
                <th className="py-3.5 px-6">Role</th>
                <th className="py-3.5 px-6">Department</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-white transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <Avatar user={u} size="sm" alt={u.full_name} />
                      <div>
                        <p className="font-bold text-black">{u.full_name}</p>
                        <p className="text-[10px] text-gray-700">
                          {u.register_number || u.faculty_id || "Admin ID"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-black">{u.email}</td>
                  <td className="py-4 px-6">{renderRoleBadge(u.role)}</td>
                  <td className="py-4 px-6 text-gray-700 font-medium">
                    {u.department}
                  </td>
                  <td className="py-4 px-6">
                    {u.is_active ? (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/20 text-emerald-900 border border-emerald-500/30 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-rose-500/20 text-rose-900 border border-rose-500/30">
                        Suspended
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenDetails(u)}
                        className="p-1.5 rounded-xl bg-[#E6F0FF] hover:bg-[#60A5FA] text-blue-900 hover:text-white transition-all"
                        title="View Full Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenReset(u)}
                        className="p-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-600 text-amber-900 hover:text-black transition-all"
                        title="Reset Password"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 rounded-xl bg-white hover:bg-[#E6F0FF] text-black hover:text-black transition-all"
                        title="Edit User"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.full_name)}
                        className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-900 hover:text-black transition-all"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white animate-in fade-in">
          <div className="w-full max-w-md glass-card p-6 border border-[#E5E7EB] shadow-sm rounded-3xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h3 className="text-sm font-bold text-black flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-900" />{" "}
                {editingUser ? "Edit User Credentials" : "Provision New User"}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-xl text-gray-700 hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-black font-semibold mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  placeholder="E.g. Dr. Sarah Johnson"
                  className="w-full px-3 py-2 rounded-xl glass-input text-black"
                  required
                />
              </div>

              <div>
                <label className="block text-black font-semibold mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData({ ...formData, email: val });
                    const emailValidation = validateEmail(val);
                    if (!emailValidation.isValid) {
                      setEmailError(
                        emailValidation.error ||
                        "Please enter a valid email address format.",
                      );
                    } else {
                      setEmailError("");
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value;
                    const emailValidation = validateEmail(val);
                    if (!emailValidation.isValid) {
                      setEmailError(emailValidation.error);
                    } else {
                      setEmailError("");
                    }
                  }}
                  onPaste={(e) => {
                    const val = e.clipboardData.getData('text');
                    setFormData({ ...formData, email: val });
                    const emailValidation = validateEmail(val);
                    if (!emailValidation.isValid) {
                      setEmailError(emailValidation.error);
                    } else {
                      setEmailError("");
                    }
                  }}
                  placeholder="user@kgkite.ac.in"
                  className="w-full px-3 py-2 rounded-xl glass-input text-black"
                  required
                />
                {emailError && (
                  <p className="text-rose-900 text-[10px] mt-1 font-bold">
                    {emailError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-black font-semibold mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.email || ""}
                  className="w-full px-3 py-2 rounded-xl glass-input text-gray-700 bg-white select-none cursor-not-allowed"
                  placeholder="user@kgkite.ac.in"
                  readOnly
                />
              </div>

              <div>
                <label className="block text-black font-semibold mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={formData.phone || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 rounded-xl glass-input text-black"
                  required
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-black font-semibold mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      placeholder="Minimum 6 characters"
                      className="w-full px-3 py-2 pr-10 rounded-xl glass-input text-black"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black focus:outline-none transition-colors"
                      title={showPassword ? "Hide password" : "Show password"}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-black font-semibold mb-1">
                    Role Privilege
                  </label>
                  <select
                    value={formData.role || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as UserRole,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl glass-input text-black"
                    required
                  >
                    <option value="" disabled hidden>Select Role</option>
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-black font-semibold mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    placeholder="Department"
                    className="w-full px-3 py-2 rounded-xl glass-input text-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-black font-semibold mb-1">
                    Institution / College
                  </label>
                  <input
                    type="text"
                    value={formData.institution || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, institution: e.target.value })
                    }
                    placeholder="KGISL Institute of Technology"
                    className="w-full px-3 py-2 rounded-xl glass-input text-black"
                  />
                </div>
                {formData.role === "student" && (
                  <div>
                    <label className="block text-black font-semibold mb-1">
                      Student Roll Number
                    </label>
                    <input
                      type="text"
                      value={formData.roll_number || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          roll_number: e.target.value,
                        })
                      }
                      placeholder="21EC005"
                      className="w-full px-3 py-2 rounded-xl glass-input text-black font-mono"
                    />
                  </div>
                )}
              </div>

              {formData.role === "student" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-black font-semibold mb-1">
                      Student Register Number
                    </label>
                    <input
                      type="text"
                      value={formData.register_number || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          register_number: e.target.value,
                        })
                      }
                      placeholder="711721UEC01"
                      className="w-full px-3 py-2 rounded-xl glass-input text-black font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-black font-semibold mb-1">
                      Year of Study
                    </label>
                    <select
                      value={formData.year_of_study || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          year_of_study: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl glass-input text-black"
                      required
                    >
                      <option value="" disabled hidden>Select Year</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                </div>
              )}

              {formData.role === "faculty" && (
                <div>
                  <label className="block text-black font-semibold mb-1">
                    Faculty ID
                  </label>
                  <input
                    type="text"
                    value={formData.faculty_id || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, faculty_id: e.target.value })
                    }
                    placeholder="FAC-ECE-105"
                    className="w-full px-3 py-2 rounded-xl glass-input text-black font-mono"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 hover:text-black"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? "Updating..." : (editingUser ? "Update User" : "Create User")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View User Details Modal */}
      {showDetailsModal && selectedDetailsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white animate-in fade-in">
          <div className="w-full max-w-md glass-card p-6 border border-[#E5E7EB] shadow-sm rounded-3xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h3 className="text-sm font-bold text-black flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-900" /> User Profile Details
              </h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedDetailsUser(null);
                }}
                className="p-1 rounded-xl text-gray-700 hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-white border border-white/5 space-y-2">
                <Avatar
                  user={selectedDetailsUser}
                  size="w-16 h-16"
                  alt={selectedDetailsUser.full_name}
                />
                <div>
                  <h4 className="text-sm font-bold text-black">
                    {selectedDetailsUser.full_name}
                  </h4>
                  <p className="text-[10px] text-gray-700 capitalize">
                    {selectedDetailsUser.role} Profile
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-white border border-white/5">
                  <div>
                    <span className="text-[10px] text-black0 block">
                      Username
                    </span>
                    <span className="font-semibold text-black">
                      @{selectedDetailsUser.username || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-black0 block">
                      Email Address
                    </span>
                    <span className="font-semibold text-black break-all">
                      {selectedDetailsUser.email}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-white border border-white/5">
                  <div>
                    <span className="text-[10px] text-black0 block">
                      Mobile Number
                    </span>
                    <span className="font-semibold text-black">
                      {selectedDetailsUser.phone || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-black0 block">
                      Role Privilege
                    </span>
                    <span className="font-semibold text-black capitalize">
                      {selectedDetailsUser.role}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-white border border-white/5">
                  <div>
                    <span className="text-[10px] text-black0 block">
                      Department
                    </span>
                    <span className="font-semibold text-black">
                      {selectedDetailsUser.department}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-black0 block">
                      Institution / College
                    </span>
                    <span className="font-semibold text-black">
                      {selectedDetailsUser.institution ||
                        "KGISL Institute of Technology"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-white border border-white/5">
                  <div>
                    <span className="text-[10px] text-black0 block">
                      Status
                    </span>
                    <span
                      className={`font-semibold ${selectedDetailsUser.is_active ? "text-emerald-900" : "text-rose-900"}`}
                    >
                      {selectedDetailsUser.is_active ? "Active" : "Suspended"}
                    </span>
                  </div>
                </div>

                {(selectedDetailsUser.role === "student" ||
                  selectedDetailsUser.role === "faculty") && (
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-white border border-white/5">
                      {selectedDetailsUser.role === "student" && (
                        <>
                          <div>
                            <span className="text-[10px] text-black0 block">
                              Register Number / Roll No
                            </span>
                            <span className="font-semibold text-black font-mono">
                              {selectedDetailsUser.register_number || "N/A"} /{" "}
                              {selectedDetailsUser.roll_number || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-black0 block">
                              Year of Study
                            </span>
                            <span className="font-semibold text-black font-mono">
                              {selectedDetailsUser.year_of_study || "N/A"}
                            </span>
                          </div>
                        </>
                      )}
                      {selectedDetailsUser.role === "faculty" && (
                        <div>
                          <span className="text-[10px] text-black0 block">
                            Faculty ID
                          </span>
                          <span className="font-semibold text-black font-mono">
                            {selectedDetailsUser.faculty_id || "N/A"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-white border border-white/5 text-[10px]">
                  <div>
                    <span className="text-black0 block">Joined Date</span>
                    <span className="text-black font-medium">
                      {selectedDetailsUser.created_at
                        ? formatDateOnly(selectedDetailsUser.created_at)
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-black0 block">Last Updated</span>
                    <span className="text-black font-medium">
                      {selectedDetailsUser.updated_at
                        ? formatTimestamp(selectedDetailsUser.updated_at)
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedDetailsUser(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#60A5FA] hover:bg-[#60A5FA] text-white font-bold "
                >
                  Close Detail Card
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white animate-in fade-in">
          <div className="w-full max-w-sm glass-card p-6 border border-[#E5E7EB] shadow-sm rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h3 className="text-sm font-bold text-black flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-900" /> Reset User
                Password
              </h3>
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetTargetUser(null);
                }}
                className="p-1 rounded-xl text-gray-700 hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-gray-700 leading-relaxed">
              Are you sure you want to trigger a secure reset link email for{" "}
              <strong className="text-black">
                {resetTargetUser.full_name}
              </strong>
              ?
            </p>

            <div className="p-3.5 rounded-2xl bg-white border border-white/5 space-y-1.5 text-xs">
              <span className="text-[10px] text-black0 block">
                User Gmail / Email ID
              </span>
              <span className="font-mono font-bold text-blue-900 select-all block break-all">
                {resetTargetUser.email}
              </span>
            </div>

            <p className="text-[11px] text-gray-700 leading-normal">
              This will send a custom reset token link directly to the user's
              inbox using **Brevo**, allowing them to securely set a new
              password.
            </p>

            <form
              onSubmit={handleConfirmResetPassword}
              className="space-y-4 text-xs pt-2"
            >
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetTargetUser(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-gray-700 hover:text-black hover:bg-[#E6F0FF] transition-all text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-bold transition-all"
                >
                  Reset Password Gmail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
