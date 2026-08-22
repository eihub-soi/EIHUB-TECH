import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { mockEngine } from '../services/mockEngine';
import { UserRole } from '../types';
import { toast } from 'sonner';
import { useEscapeKey } from '../hooks/useEscapeKey';

import { auth as firebaseAuth, db as firestoreDb, isFirebaseConfigured, firebaseConfig } from '../firebase/client';
import { initializeApp, deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { sendBrevoOtp } from '../utils/brevoService';
import { EMAIL_REGEX, LOWERCASE_EMAIL_ERROR, hasUppercase, validateEmail } from '../utils/emailValidation';
import {
  Sparkles,
  GraduationCap,
  Briefcase,
  Shield,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  User,
  Building2,
  BookOpen,
  Calendar,
  ShieldCheck,
  X,
  CheckCircle2,
  Phone,
  Hash,
  Package,
  ClipboardList,
  BarChart3
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { switchRole, loginWithEmail, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Mode: 'login' or 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login Form State
  const [activeTab, setActiveTab] = useState<UserRole>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isLoginEmailInvalid = !validateEmail(email).isValid;
  const [isLoading, setIsLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [loginError, setLoginError] = useState('');

  // Student Registration Form State
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regInstitution, setRegInstitution] = useState('KGISL Institute of Technology');
  const [regDepartment, setRegDepartment] = useState('');
  const [regYear, setRegYear] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const isRegEmailInvalid = !validateEmail(regEmail).isValid;
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regPhone, setRegPhone] = useState('');
  const [regRegisterNumber, setRegRegisterNumber] = useState('');
  const [regRollNumber, setRegRollNumber] = useState('');
  const [regEmailError, setRegEmailError] = useState('');
  const isRegFormInvalid =
    !regFullName.trim() ||
    !regDepartment ||
    !regYear ||
    isRegEmailInvalid ||
    !regPassword ||
    regPassword.length < 6 ||
    regPassword !== regConfirmPassword ||
    regPhone.length !== 10 ||
    regRegisterNumber.trim().length < 4 ||
    /[A-Z]/.test(regUsername);

  const showPasswordMismatch = regConfirmPassword.length > 0 && regPassword !== regConfirmPassword;

  // OTP Verification Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [inputOtp, setInputOtp] = useState('');
  const [otpTimer, setOtpTimer] = useState(60);

  useEscapeKey(() => setShowOtpModal(false), showOtpModal);

  // Clear credentials when switching login tabs
  const handleTabChange = (role: UserRole) => {
    setActiveTab(role);
    setGoogleError('');
    setLoginError('');
    setEmail('');
    setPassword('');
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setLoginError(emailValidation.error);
      return;
    }
    if (!password) {
      toast.error('Password cannot be empty.');
      return;
    }
    if (isLoginEmailInvalid || isLoading) {
      return;
    }

    setIsLoading(true);
    setLoginError('');
    try {
      await loginWithEmail(email, password, activeTab);
      toast.success(`Successfully logged in as ${activeTab.toUpperCase()}!`);

      // Redirect to respective dashboard
      if (activeTab === 'student') navigate('/student/dashboard');
      else if (activeTab === 'faculty') navigate('/faculty/dashboard');
      else navigate('/admin/dashboard');
    } catch (err: any) {
      // Suppress logging login failures to the console to comply with user's console hygiene requirement
      setLoginError('Invalid Email ID/Password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setGoogleError('');
    try {
      const targetRole = authMode === 'login' ? activeTab : 'student';
      await loginWithGoogle(targetRole);
      toast.success(`Successfully authenticated via Google as ${targetRole.toUpperCase()}!`);
      if (targetRole === 'student') navigate('/student/dashboard');
      else if (targetRole === 'faculty') navigate('/faculty/dashboard');
      else navigate('/admin/dashboard');
    } catch (err: any) {
      if (err.message?.includes('use only @kgkite.ac.in') || err.message?.includes('uppercase') || err.message?.includes('Email ID must contain only lowercase letters')) {
        toast.error(err.message);
        setGoogleError(err.message);
      } else {
        toast.error('Google Sign-In failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const regEmailValidation = validateEmail(regEmail);
    if (!regEmailValidation.isValid) {
      toast.error(regEmailValidation.error);
      return;
    }
    if (/[A-Z]/.test(regUsername)) {
      toast.error('Username can contain only lowercase letters, numbers, and symbols.');
      return;
    }
    if (isRegFormInvalid || isLoading) {
      return;
    }
    if (regRegisterNumber.trim().length < 4) {
      toast.error('Please enter a valid registration number (at least 4 characters)');
      return;
    }
    if (regPhone.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (regPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    // Generate random 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setInputOtp('');
    setShowOtpModal(true);

    const sendOtpEmail = async () => {
      try {
        await sendBrevoOtp(regEmail, code);
        toast.success(`🔑 Verification OTP successfully sent to ${regEmail}!`);
      } catch (err: any) {
        console.warn('[Brevo API Error] Failed sending via Brevo API. Error details:', err);
        console.log('[Brevo Fallback Dev Mode] Generated OTP is:', code);
        toast.error(`❌ Brevo failed to send email: ${err.message || err}. (Dev: check console log for OTP)`);
      }
    };

    sendOtpEmail();
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputOtp.trim() !== generatedOtp) {
      toast.error('Invalid OTP verification code. Please check and try again.');
      return;
    }

    // Perform validation check again!
    const emailValidation = validateEmail(regEmail);
    if (!emailValidation.isValid) {
      toast.error(emailValidation.error);
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      if (isFirebaseConfigured && firebaseAuth) {
        const finalEmailCheck = validateEmail(regEmail);
        if (!finalEmailCheck.isValid) {
          toast.error(finalEmailCheck.error);
          setIsLoading(false);
          return;
        }
        // Sign up with Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, regEmail, regPassword);
        if (userCredential.user) {
          const profileId = crypto.randomUUID();

          // 1. Insert profile record in Firebase Firestore if configured
          if (firestoreDb) {
            try {
              await setDoc(doc(firestoreDb, 'profiles', profileId), {
                id: profileId,
                firebase_uid: userCredential.user.uid,
                email: regEmail,
                full_name: regFullName,
                role: 'student',
                department: regDepartment,
                phone: regPhone,
                register_number: regRegisterNumber,
                roll_number: regRollNumber,
                institution: regInstitution,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                username: regUsername
              });
              console.log('[LoginPage] Successfully saved profile to Firebase Firestore');
            } catch (firestoreErr) {
              console.error('[LoginPage] Error writing profile to Firebase Firestore:', firestoreErr);
            }
          }
        }
      } else {
        // Create new student profile in mockEngine
        const newStudent = mockEngine.addProfile({
          email: regEmail,
          full_name: regFullName,
          role: 'student',
          department: regDepartment,
          year_of_study: regYear,
          institution: regInstitution,
          register_number: regRegisterNumber,
          roll_number: regRollNumber,
          phone: regPhone,
          is_active: true,
          username: regUsername,
        });

        // Store registration password in localStorage credentials registry
        const credentials = JSON.parse(localStorage.getItem('ei_hub_mock_credentials') || '{}');
        credentials[regEmail] = regPassword;
        localStorage.setItem('ei_hub_mock_credentials', JSON.stringify(credentials));
      }

      await loginWithEmail(regEmail, regPassword, 'student');
      toast.success('Email Verified & Account Registered Successfully!');
      setShowOtpModal(false);
      navigate('/student/dashboard');
    } catch (err: any) {
      console.error('Registration error:', err);
      toast.error('Registration failed. Please check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="h-screen w-screen bg-[#F8FAFC] text-[#102044] flex flex-col justify-between login-page-container relative overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">

      {/* Background Abstract Circles */}
      <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-[600px] h-[600px] border-[3px] border-[#475569]/10 rounded-full pointer-events-none z-0" />
      <div className="absolute top-0 left-0 -translate-x-1/3 -translate-y-1/3 w-[800px] h-[800px] border border-[#475569]/5 rounded-full pointer-events-none z-0" />

      {/* Ambient Glows */}
      <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] bg-[#F1F5F9]/80 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute -top-48 -left-48 w-[600px] h-[600px] bg-[#F1F5F9]/60 rounded-full blur-3xl pointer-events-none z-0" />

      {/* Dot Patterns */}
      <div className="absolute bottom-12 left-12 w-24 h-24 slate-dot-pattern opacity-40 hidden md:block pointer-events-none z-0" />
      <div className="absolute top-12 left-12 w-16 h-16 slate-dot-pattern opacity-40 hidden md:block pointer-events-none z-0" />

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center w-full max-w-7xl mx-auto px-4 overflow-hidden relative z-10">

        {/* Two-Column Container */}
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center max-h-full overflow-hidden">

          {/* LEFT COLUMN: MARKETING CONTENT */}
          <div className="md:col-span-5 flex flex-col justify-center text-left login-left-space pr-0 md:pr-6 hidden md:flex shrink-0">
            <div className="space-y-3">
              <h1 className="text-4xl md:text-6xl font-black text-[#102044] tracking-tight leading-tight select-none">
                Manage.
                <br />
                Track.
                <br />
                <span className="text-[#475569]">Innovate.</span>
              </h1>
              <p className="text-sm md:text-base text-[#24324A] font-medium max-w-sm">
                A smart inventory management solution for the <span className="font-bold text-[#475569]">School of Innovation</span>.
              </p>
            </div>

            <div className="login-feature-space">
              {/* Feature 1 */}
              <div className="login-feature-item">
                <div className="login-feature-icon-wrapper bg-[#F1F5F9] flex items-center justify-center shrink-0 border border-[#CBD5E1]">
                  <Package className="w-6 h-6 text-[#475569]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#102044]">Smart Inventory</h3>
                  <p className="text-xs md:text-sm text-[#475569] font-medium mt-0.5 leading-relaxed">
                    Track components, stock levels and availability in real-time.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="login-feature-item">
                <div className="login-feature-icon-wrapper bg-[#F1F5F9] flex items-center justify-center shrink-0 border border-[#CBD5E1]">
                  <ClipboardList className="w-6 h-6 text-[#475569]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#102044]">Request & Approvals</h3>
                  <p className="text-xs md:text-sm text-[#475569] font-medium mt-0.5 leading-relaxed">
                    Seamless request, approval and return management.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="login-feature-item">
                <div className="login-feature-icon-wrapper bg-[#F1F5F9] flex items-center justify-center shrink-0 border border-[#CBD5E1]">
                  <BarChart3 className="w-6 h-6 text-[#475569]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#102044]">Reports & Analytics</h3>
                  <p className="text-xs md:text-sm text-[#475569] font-medium mt-0.5 leading-relaxed">
                    Insightful reports and analytics for better decision making.
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="login-feature-item">
                <div className="login-feature-icon-wrapper bg-[#F1F5F9] flex items-center justify-center shrink-0 border border-[#CBD5E1]">
                  <ShieldCheck className="w-6 h-6 text-[#475569]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#102044]">Secure & Reliable</h3>
                  <p className="text-xs md:text-sm text-[#475569] font-medium mt-0.5 leading-relaxed">
                    Role-based access with enterprise grade security.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: LOGIN CARD */}
          <div className="col-span-1 md:col-span-7 flex flex-col items-center justify-center w-full max-h-full overflow-hidden">

            <div className="w-full max-w-xl bg-white border border-[#D8E4E8] rounded-[32px] shadow-xl login-card-wrapper login-card-space relative flex flex-col h-[82vh] max-h-[82vh] overflow-hidden">

              {/* Brand Logo & Header */}
              <div className="text-center login-card-space shrink-0">
                <div className="login-brand-logo mx-auto rounded-full bg-white p-1 border border-[#D8E4E8] shadow-md flex items-center justify-center">
                  <img src="/logo.png" alt="EI HUB Logo" className="w-full h-full object-contain rounded-full" />
                </div>

                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#102044] tracking-wide">EI HUB</h2>
                  <p className="text-[10px] sm:text-xs font-black text-[#475569] uppercase tracking-widest mt-0.5">
                    INNOVATE • INVENT • INSPIRE
                  </p>
                  <p className="text-xs sm:text-sm text-[#334155] mt-1 font-semibold">
                    KGISL Institute of Technology • <span className="text-[#475569] font-black">School of Innovation</span>
                  </p>
                </div>
              </div>

              {/* Sign In vs Student Register Navigation Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#F8FAFC] border border-[#D8E4E8] shrink-0 login-card-tabs-space">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`login-tabs-btn rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${authMode === 'login'
                      ? 'bg-[#475569] text-white shadow-md shadow-[#475569]/20'
                      : 'bg-[#F8FAFC] text-[#102044] hover:text-[#102044]/80'
                    }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`login-tabs-btn rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${authMode === 'register'
                      ? 'bg-[#475569] text-white shadow-md shadow-[#475569]/20'
                      : 'bg-[#F8FAFC] text-[#102044] hover:text-[#102044]/80'
                    }`}
                >
                  Student Register
                </button>
              </div>

              {/* MODE 1: LOGIN FORM */}
              {authMode === 'login' && (
                <div className="login-form-container pr-1 flex-grow flex flex-col justify-between">

                  {/* Role Cards Grid */}
                  <div className="grid grid-cols-3 gap-3 sm:gap-4 py-0.5 shrink-0">
                    {/* Student Card */}
                    <button
                      type="button"
                      onClick={() => handleTabChange('student')}
                      className={`flex flex-col items-center login-role-card rounded-2xl border transition-all duration-300 ${activeTab === 'student'
                          ? 'border-[#2563EB] bg-[#E6F0FF] scale-105 shadow-md shadow-[#2563EB]/10 ring-1 ring-[#2563EB]/20'
                          : 'border-[#E2E8F0] bg-white hover:scale-102 hover:border-[#2563EB]/50'
                        }`}
                    >
                      <div className="login-role-icon-wrapper rounded-full flex items-center justify-center transition-all duration-300 bg-white text-[#2563EB] shadow-sm">
                        <GraduationCap className="w-full h-full p-2.5 sm:p-3" />
                      </div>
                      <span className={`text-xs sm:text-sm font-black mt-2 transition-colors ${activeTab === 'student' ? 'text-black' : 'text-[#102044]'
                        }`}>
                        Student
                      </span>
                      <div className={`login-role-badge mt-1.5 flex items-center gap-1 px-2 py-0.5 rounded-full font-extrabold tracking-wider uppercase border transition-all ${activeTab === 'student'
                          ? 'bg-[#E6F0FF] text-[#2563EB] border-[#2563EB]/20'
                          : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]'
                        }`}>
                        <GraduationCap className="w-2.5 h-2.5 shrink-0" />
                        <span>Student</span>
                      </div>
                    </button>

                    {/* Faculty Card */}
                    <button
                      type="button"
                      onClick={() => handleTabChange('faculty')}
                      className={`flex flex-col items-center login-role-card rounded-2xl border transition-all duration-300 ${activeTab === 'faculty'
                          ? 'border-[#10B981] bg-[#E8F8F3] scale-105 shadow-md shadow-[#10B981]/10 ring-1 ring-[#10B981]/20'
                          : 'border-[#E2E8F0] bg-white hover:scale-102 hover:border-[#10B981]/50'
                        }`}
                    >
                      <div className="login-role-icon-wrapper rounded-full flex items-center justify-center transition-all duration-300 bg-[#F8FAFC] text-[#475569]">
                        <User className="w-full h-full p-2.5 sm:p-3" />
                      </div>
                      <span className={`text-xs sm:text-sm font-black mt-2 transition-colors ${activeTab === 'faculty' ? 'text-black' : 'text-[#102044]'
                        }`}>
                        Faculty
                      </span>
                      <div className={`login-role-badge mt-1.5 flex items-center gap-1 px-2 py-0.5 rounded-full font-extrabold tracking-wider uppercase border transition-all ${activeTab === 'faculty'
                          ? 'bg-[#E8F8F3] text-[#10B981] border-[#10B981]/20'
                          : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]'
                        }`}>
                        <Briefcase className="w-2.5 h-2.5 shrink-0" />
                        <span>Faculty</span>
                      </div>
                    </button>

                    {/* Admin Card */}
                    <button
                      type="button"
                      onClick={() => handleTabChange('admin')}
                      className={`flex flex-col items-center login-role-card rounded-2xl border transition-all duration-300 ${activeTab === 'admin'
                          ? 'border-[#7C3AED] bg-[#F1EEFF] scale-105 shadow-md shadow-[#7C3AED]/10 ring-1 ring-[#7C3AED]/20'
                          : 'border-[#E2E8F0] bg-white hover:scale-102 hover:border-[#7C3AED]/50'
                        }`}
                    >
                      <div className="login-role-icon-wrapper rounded-full flex items-center justify-center transition-all duration-300 bg-[#F8FAFC] text-[#475569]">
                        <Shield className="w-full h-full p-2.5 sm:p-3" />
                      </div>
                      <span className={`text-xs sm:text-sm font-black mt-2 transition-colors ${activeTab === 'admin' ? 'text-black' : 'text-[#102044]'
                        }`}>
                        Admin
                      </span>
                      <div className={`login-role-badge mt-1.5 flex items-center gap-1 px-2 py-0.5 rounded-full font-extrabold tracking-wider uppercase border transition-all ${activeTab === 'admin'
                          ? 'bg-[#F1EEFF] text-[#7C3AED] border-[#7C3AED]/20'
                          : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]'
                        }`}>
                        <Shield className="w-2.5 h-2.5 shrink-0" />
                        <span>Admin</span>
                      </div>
                    </button>
                  </div>

                  {loginError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold text-center leading-normal animate-in fade-in slide-in-from-top-2 duration-200 shrink-0">
                      {loginError}
                    </div>
                  )}

                  {/* Login Form */}
                  <form onSubmit={handleLoginSubmit} className="login-form-fields flex-grow flex flex-col justify-between mt-2">
                    <div>
                      <label className="block text-[#102044] font-semibold text-xs mb-1 uppercase tracking-wide">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#475569] absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={email}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEmail(val);
                            setGoogleError('');
                            const emailValidation = validateEmail(val);
                            if (!emailValidation.isValid) {
                              setLoginError(emailValidation.error);
                            } else {
                              setLoginError('');
                            }
                          }}
                          onBlur={() => {
                            const emailValidation = validateEmail(email);
                            if (!emailValidation.isValid) {
                              setLoginError(emailValidation.error);
                            } else {
                              setLoginError('');
                            }
                          }}
                          onPaste={() => {
                            setTimeout(() => {
                              const emailValidation = validateEmail(email);
                              if (!emailValidation.isValid) {
                                setLoginError(emailValidation.error);
                              } else {
                                setLoginError('');
                              }
                            }, 0);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (isLoginEmailInvalid || !password)) {
                              e.preventDefault();
                            }
                          }}
                          placeholder={activeTab === 'student' ? 'studentname@kgkite.ac.in' : activeTab === 'faculty' ? 'facultyname@kgkite.ac.in' : 'adminname@kgkite.ac.in'}
                          className="w-full pl-10 pr-4 login-input rounded-xl bg-[#F8FAFC] border border-[#D8E4E8] text-[#102044] text-sm font-semibold focus:border-[#475569] focus:ring-1 focus:ring-[#475569] outline-none transition-all placeholder:text-[#475569]/40"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#102044] font-semibold text-xs mb-1 uppercase tracking-wide">
                        Password
                      </label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-[#475569] absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setLoginError('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (isLoginEmailInvalid || !password)) {
                              e.preventDefault();
                            }
                          }}
                          placeholder="••••••••••••"
                          className="w-full pl-10 pr-10 login-input rounded-xl bg-[#F8FAFC] border border-[#D8E4E8] text-[#102044] text-sm font-semibold focus:border-[#475569] focus:ring-1 focus:ring-[#475569] outline-none transition-all placeholder:text-[#475569]/40"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#102044]"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end -mt-1 pb-1">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-xs text-[#475569] hover:text-[#334155] font-bold transition-all hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || isLoginEmailInvalid || !password}
                      className="w-full login-btn rounded-xl bg-[#475569] hover:bg-[#334155] text-white font-black text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#475569]/10"
                    >
                      <span>{isLoading ? 'Signing In...' : `Sign In to ${activeTab.toUpperCase()} Portal  →`}</span>
                    </button>
                  </form>

                </div>
              )}

              {/* MODE 2: STUDENT REGISTRATION FORM */}
              {authMode === 'register' && (
                <div className="space-y-4 overflow-y-auto pr-1 flex-1">

                  <div className="login-notice-banner rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] text-[#475569] text-xs shrink-0">
                    <p className="font-extrabold flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#475569] shrink-0" /> Student Self-Registration
                    </p>
                    <p className="text-[#475569] mt-0.5 font-medium">
                      Faculty and Admin accounts are provisioned exclusively by Institutional System Administrators.
                    </p>
                  </div>

                  <form onSubmit={handleRegisterSubmit} className="login-reg-form-space">

                    {/* Full Name & Institution */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 login-reg-grid">
                      <div>
                        <label className="block text-[#102044] font-semibold text-xs mb-1 uppercase tracking-wide">Full Name</label>
                        <div className="relative">
                          <User className="w-3.5 h-3.5 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={regFullName}
                            onChange={(e) => setRegFullName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && isRegFormInvalid) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="E.g. Aravind R"
                            className="w-full pl-9 pr-3.5 login-reg-input rounded-xl bg-[#F8FAFC] border border-[#D8E4E8] text-[#102044] text-xs font-semibold focus:border-[#475569] focus:ring-1 focus:ring-[#475569] outline-none transition-all placeholder:text-[#475569]/40"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[#102044] font-semibold text-xs mb-1 uppercase tracking-wide">Institution</label>
                        <div className="relative">
                          <Building2 className="w-3.5 h-3.5 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={regInstitution}
                            onChange={(e) => setRegInstitution(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && isRegFormInvalid) {
                                e.preventDefault();
                              }
                            }}
                            className="w-full pl-9 pr-3.5 login-reg-input rounded-xl bg-[#F8FAFC] border border-[#D8E4E8] text-[#102044] text-xs font-semibold focus:border-[#475569] focus:ring-1 focus:ring-[#475569] outline-none transition-all placeholder:text-[#475569]/40"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Student Email ID */}
                    <div>
                      <label className="block text-[#102044] font-semibold text-xs mb-1 uppercase tracking-wide">Student Email ID</label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-[#475569] absolute left-3.5 top-[16px] -translate-y-1/2" />
                        <input
                          type="email"
                          value={regEmail}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRegEmail(val);
                            setRegUsername(val);
                            const regEmailValidation = validateEmail(val);
                            if (!regEmailValidation.isValid) {
                              setRegEmailError(regEmailValidation.error);
                            } else {
                              setRegEmailError('');
                            }
                            setGoogleError('');
                          }}
                          onBlur={() => {
                            const regEmailValidation = validateEmail(regEmail);
                            if (!regEmailValidation.isValid) {
                              setRegEmailError(regEmailValidation.error);
                            } else {
                              setRegEmailError('');
                            }
                          }}
                          onPaste={() => {
                            setTimeout(() => {
                              const regEmailValidation = validateEmail(regEmail);
                              if (!regEmailValidation.isValid) {
                                setRegEmailError(regEmailValidation.error);
                              } else {
                                setRegEmailError('');
                              }
                            }, 0);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && isRegFormInvalid) {
                              e.preventDefault();
                            }
                          }}
                          placeholder="studentname@kgkite.ac.in"
                          className="w-full pl-9 pr-3.5 login-reg-input rounded-xl bg-[#F8FAFC] border border-[#D8E4E8] text-[#102044] text-xs font-semibold focus:border-[#475569] focus:ring-1 focus:ring-[#475569] outline-none transition-all placeholder:text-[#475569]/40"
                          required
                        />
                        {regEmailError && (
                          <p className="text-rose-500 text-[10px] mt-0.5 font-bold">{regEmailError}</p>
                        )}
                      </div>
                    </div>

                    {/* Department & Year of Study */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 login-reg-grid">
                      <div>
                        <label className="block text-[#102044] font-semibold text-xs mb-1 uppercase tracking-wide">Department</label>
                        <select
                          value={regDepartment}
                          onChange={(e) => setRegDepartment(e.target.value)}
                          className="w-full px-3 login-reg-input rounded-xl bg-[#F8FAFC] border border-[#D8E4E8] text-[#102044] text-xs font-semibold focus:border-[#475569] focus:ring-1 focus:ring-[#475569] outline-none transition-all"
                        >
                          <option value="">-- Select Department --</option>
                          <option value="Electronics & Communication Engineering (ECE)">Electronics & Communication (ECE)</option>
                          <option value="Computer Science Engineering (CSE)">Computer Science (CSE)</option>
                          <option value="Information Technology (IT)">Information Technology (IT)</option>
                          <option value="Electrical & Electronics Engineering (EEE)">Electrical & Electronics (EEE)</option>
                          <option value="Mechanical Engineering">Mechanical Engineering</option>
                          <option value="Artificial Intelligence & Data Science (AIMDS)">Artificial Intelligence & Data Science (AIMDS)</option>
                          <option value="Artificial Intelligence & Machine Learning (AIML)">Artificial Intelligence & Machine Learning (AIML)</option>
                          <option value="Computer Science & Business Systems (CSBS)">Computer Science & Business Systems (CSBS)</option>
                          <option value="Robotics & Automation (R&A)">Robotics & Automation (R&A)</option>
                          <option value="Cyber Security (CYS)">Cyber Security (CYS)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[#102044] font-semibold text-xs mb-1 uppercase tracking-wide">Year of Study</label>
                        <select
                          value={regYear}
                          onChange={(e) => setRegYear(e.target.value)}
                          className="w-full px-3 login-reg-input rounded-xl bg-[#F8FAFC] border border-[#D8E4E8] text-[#102044] text-xs font-semibold focus:border-[#475569] focus:ring-1 focus:ring-[#475569] outline-none transition-all"
                        >
                          <option value="">-- Select Year --</option>
                          <option value="1st Year">1st Year</option>
                          <option value="2nd Year">2nd Year</option>
                          <option value="3rd Year">3rd Year</option>
                          <option value="4th Year">4th Year</option>
                        </select>
                      </div>
                    </div>

                    {/* Username (Readonly) & Mobile Number */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 login-reg-grid">
                      <div>
                        <label className="block text-[#102044] font-semibold text-xs mb-1 uppercase tracking-wide">Username</label>
                        <div className="relative">
                          <User className="w-3.5 h-3.5 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={regEmail}
                            className="w-full pl-9 pr-3.5 login-reg-input rounded-xl bg-[#F8FAFC] border border-[#D8E4E8] text-[#475569] text-xs font-semibold select-none cursor-not-allowed"
                            placeholder="user@kgkite.ac.in"
                            readOnly
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[#102044] font-semibold text-xs mb-1 uppercase tracking-wide">Mobile Number</label>
                        <div className="relative">
                          <Phone className="w-3.5 h-3.5 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && isRegFormInvalid) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="9876543210"
                            className="w-full pl-9 pr-3.5 login-reg-input rounded-xl bg-[#F8FAFC] border border-[#D8E4E8] text-[#102044] text-xs font-semibold focus:border-[#475569] focus:ring-1 focus:ring-[#475569] outline-none transition-all placeholder:text-[#475569]/40"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Registration Number & Roll Number */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 login-reg-grid">
                      <div>
                        <label className="block text-[#102044] font-semibold text-xs mb-1 uppercase tracking-wide">Registration Number</label>
                        <div className="relative">
                          <GraduationCap className="w-3.5 h-3.5 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            maxLength={15}
                            value={regRegisterNumber}
                            onChange={(e) => setRegRegisterNumber(e.target.value.toUpperCase().slice(0, 15))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && isRegFormInvalid) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="711721106001"
                            className="w-full pl-9 pr-3.5 login-reg-input rounded-xl bg-[#F8FAFC] border border-[#D8E4E8] text-[#102044] text-xs font-semibold focus:border-[#475569] focus:ring-1 focus:ring-[#475569] outline-none transition-all placeholder:text-[#475569]/40"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[#102044] font-semibold text-xs mb-1 uppercase tracking-wide">Roll Number</label>
                        <div className="relative">
                          <Hash className="w-3.5 h-3.5 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            maxLength={10}
                            value={regRollNumber}
                            onChange={(e) => setRegRollNumber(e.target.value.toUpperCase().slice(0, 10))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && isRegFormInvalid) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="21EC005"
                            className="w-full pl-9 pr-3.5 login-reg-input rounded-xl bg-[#F8FAFC] border border-[#D8E4E8] text-[#102044] text-xs font-semibold focus:border-[#475569] focus:ring-1 focus:ring-[#475569] outline-none transition-all placeholder:text-[#475569]/40"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Password & Confirm Password */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 login-reg-grid">
                      <div>
                        <label className="block text-[#102044] font-semibold text-xs mb-1 uppercase tracking-wide">Password</label>
                        <div className="relative">
                          <KeyRound className="w-3.5 h-3.5 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && isRegFormInvalid) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="••••••••"
                            className={`w-full pl-9 pr-8 py-2.5 login-reg-input rounded-xl bg-[#F8FAFC] border text-[#102044] text-xs font-semibold focus:ring-1 outline-none transition-all placeholder:text-[#475569]/40 ${showPasswordMismatch
                                ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                                : 'border-[#D8E4E8] focus:border-[#475569] focus:ring-[#475569]'
                              }`}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#102044]"
                          >
                            {showRegPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[#102044] font-semibold text-xs mb-1 uppercase tracking-wide">Re-enter Password</label>
                        <div className="relative">
                          <KeyRound className="w-3.5 h-3.5 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            value={regConfirmPassword}
                            onChange={(e) => setRegConfirmPassword(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && isRegFormInvalid) {
                                e.preventDefault();
                              }
                            }}
                            placeholder="••••••••"
                            className={`w-full pl-9 pr-3.5 py-2.5 login-reg-input rounded-xl bg-[#F8FAFC] border text-[#102044] text-xs font-semibold focus:ring-1 outline-none transition-all placeholder:text-[#475569]/40 ${showPasswordMismatch
                                ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                                : 'border-[#D8E4E8] focus:border-[#475569] focus:ring-[#475569]'
                              }`}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {showPasswordMismatch && (
                      <p className="text-[#DC2626] text-xs font-semibold mt-0.5">
                        Passwords do not match.
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading || isRegFormInvalid}
                      className="w-full login-btn rounded-xl bg-[#475569] hover:bg-[#334155] text-white font-black text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#475569]/10 mt-1"
                    >
                      <span>Register & Send Verification OTP</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>

                </div>
              )}

            </div>

          </div>

        </div>

        {/* Main Content Area Close */}
      </div>

      {/* Footer Credits */}
      <div className="w-full text-center login-footer py-4 relative z-10 shrink-0">
        <p className="text-xs text-[#334155] font-semibold select-none">
          © 2026 KGISL Institute of Technology • School of Innovation. All rights reserved.
        </p>
      </div>

      {/* OTP Email Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102044]/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white p-6 sm:p-8 border border-[#D8E4E8] shadow-2xl rounded-3xl space-y-5 text-center max-h-[90vh] overflow-y-auto">

            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#F1F5F9] text-[#475569] flex items-center justify-center border border-[#CBD5E1] shadow-sm">
              <Mail className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-[#102044]">Enter OTP Verification Code</h3>
              <p className="text-xs text-[#475569] mt-1 font-semibold">
                We sent a 6-digit OTP code to <span className="font-black text-[#475569]">{regEmail}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={inputOtp}
                  onChange={(e) => setInputOtp(e.target.value)}
                  placeholder="ENTER 6 DIGIT OTP"
                  className="w-full text-center tracking-[1em] placeholder:tracking-normal text-xl font-mono py-3 rounded-2xl bg-white border border-[#D8E4E8] text-[#475569] font-black placeholder:text-xs placeholder:text-[#475569] placeholder:font-sans focus:border-[#475569] focus:ring-1 focus:ring-[#475569] outline-none"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="px-4 py-2 text-[#475569] hover:text-[#102044] text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 rounded-xl bg-[#475569] hover:bg-[#334155] text-white font-black text-xs shadow-md shadow-[#475569]/10 transition-all"
                >
                  {isLoading ? 'Verifying...' : 'Verify OTP & Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
