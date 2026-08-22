import re

with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add missing lucide-react imports if necessary
imports = ["Package", "ClipboardList", "BarChart3"]
for imp in imports:
    if imp not in content:
        content = content.replace("import {\n", f"import {{\n  {imp},\n")

# Find the return statement
return_index = content.find("  return (\n")

if return_index == -1:
    print("Could not find return statement")
    exit(1)

new_return = """  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F5F9FF] text-[#0D1B2A] font-['Inter',sans-serif]">
      {/* LEFT PANEL - PROMOTIONAL */}
      <div className="w-full md:w-[45%] relative hidden md:flex flex-col p-8 lg:p-12 justify-between bg-white overflow-hidden border-r border-[#D9E6F5]">
        {/* Background elements */}
        <div className="absolute inset-0 bg-[url('/kgisl-building.jpg')] opacity-5 bg-cover bg-center mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-[#0A84FF]/5"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-[#E6F0FF] rounded-full blur-3xl opacity-80 pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-80 h-80 bg-[#E6F0FF] rounded-full blur-3xl opacity-80 pointer-events-none"></div>

        {/* Content */}
        <div className="relative z-10">
          <img src="/soi-logo.png" alt="School of Innovation" className="h-12 object-contain" />
          
          <div className="mt-16 space-y-2">
            <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0D1B2A] leading-[1.1]">
              Manage.<br />Track.<br /><span className="text-[#0A84FF]">Innovate.</span>
            </h1>
            <p className="text-[#687280] font-medium mt-4 max-w-sm text-sm lg:text-base leading-relaxed">
              A smart inventory management solution for the <span className="text-[#0A84FF] font-semibold">School of Innovation</span>.
            </p>
          </div>

          <div className="mt-12 space-y-6">
            {/* Feature 1 */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#E6F0FF] flex items-center justify-center shrink-0 border border-[#D9E6F5]">
                <Package className="w-6 h-6 text-[#0A84FF]" />
              </div>
              <div>
                <h3 className="font-bold text-[#0D1B2A]">Smart Inventory</h3>
                <p className="text-sm text-[#687280] leading-snug mt-0.5">Track components, stock levels and availability in real-time.</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#E6F0FF] flex items-center justify-center shrink-0 border border-[#D9E6F5]">
                <ClipboardList className="w-6 h-6 text-[#0A84FF]" />
              </div>
              <div>
                <h3 className="font-bold text-[#0D1B2A]">Request & Approvals</h3>
                <p className="text-sm text-[#687280] leading-snug mt-0.5">Seamless request, approval and return management.</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#E6F0FF] flex items-center justify-center shrink-0 border border-[#D9E6F5]">
                <BarChart3 className="w-6 h-6 text-[#0A84FF]" />
              </div>
              <div>
                <h3 className="font-bold text-[#0D1B2A]">Reports & Analytics</h3>
                <p className="text-sm text-[#687280] leading-snug mt-0.5">Insightful reports and analytics for better decision making.</p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#E6F0FF] flex items-center justify-center shrink-0 border border-[#D9E6F5]">
                <ShieldCheck className="w-6 h-6 text-[#0A84FF]" />
              </div>
              <div>
                <h3 className="font-bold text-[#0D1B2A]">Secure & Reliable</h3>
                <p className="text-sm text-[#687280] leading-snug mt-0.5">Role-based access with enterprise-grade security.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - LOGIN */}
      <div className="w-full md:w-[55%] flex flex-col items-center justify-center p-4 sm:p-8 relative z-10 min-h-[100dvh]">
        
        {/* Mobile Promo Header (Visible only on small screens) */}
        <div className="md:hidden w-full max-w-md mb-6 text-center space-y-2">
           <img src="/soi-logo.png" alt="School of Innovation" className="h-10 mx-auto object-contain" />
           <h1 className="text-2xl font-extrabold text-[#0D1B2A]">
             Manage. Track. <span className="text-[#0A84FF]">Innovate.</span>
           </h1>
        </div>

        <div className="w-full max-w-md bg-white rounded-[24px] shadow-[0_10px_30px_rgba(10,132,255,0.08)] border border-[#D9E6F5] p-6 sm:p-10 relative">
          
          {/* Top Branding */}
          <div className="text-center mb-8">
            <img src="/logo.png" alt="EI HUB" className="h-14 mx-auto object-contain mb-3 drop-shadow-sm" />
            <h2 className="text-2xl font-extrabold text-[#0D1B2A] tracking-tight">EI HUB</h2>
            <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-[0.2em] text-[#0A84FF] mt-1.5">
              Innovate • Invent • Inspire
            </p>
          </div>

          {/* Login Heading */}
          <div className="text-center mb-8">
            <h3 className="text-xl sm:text-2xl font-bold text-[#0D1B2A]">Welcome Back!</h3>
            <p className="text-sm text-[#687280] mt-1.5">Sign in to continue to EI HUB Innoventry</p>
          </div>

          {/* Auth Mode Toggle */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F5F9FF] border border-[#D9E6F5] mb-6">
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                authMode === "login"
                  ? "bg-white text-[#0A84FF] shadow-sm border border-[#D9E6F5]"
                  : "text-[#687280] hover:text-[#0D1B2A]"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthMode("register")}
              className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                authMode === "register"
                  ? "bg-white text-[#0A84FF] shadow-sm border border-[#D9E6F5]"
                  : "text-[#687280] hover:text-[#0D1B2A]"
              }`}
            >
              Student Register
            </button>
          </div>

          {loginError && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[12px] font-medium text-center animate-in fade-in slide-in-from-top-2">
              {loginError}
            </div>
          )}

          {/* MODE 1: LOGIN */}
          {authMode === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#687280] mb-2 uppercase tracking-wider">Select Your Role</label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {/* Student */}
                  <button
                    type="button"
                    onClick={() => handleTabChange("student")}
                    className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all duration-200 ${
                      activeTab === "student"
                        ? "border-[#0A84FF] bg-[#E6F0FF] shadow-[0_4px_12px_rgba(10,132,255,0.12)] text-[#0A84FF]"
                        : "border-[#D9E6F5] bg-white text-[#687280] hover:border-[#0A84FF]/30 hover:bg-[#F5F9FF]"
                    }`}
                  >
                    <GraduationCap className="w-6 h-6 mb-2" />
                    <span className="text-xs font-bold">Student</span>
                  </button>
                  
                  {/* Faculty */}
                  <button
                    type="button"
                    onClick={() => handleTabChange("faculty")}
                    className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all duration-200 ${
                      activeTab === "faculty"
                        ? "border-[#0A84FF] bg-[#E6F0FF] shadow-[0_4px_12px_rgba(10,132,255,0.12)] text-[#0A84FF]"
                        : "border-[#D9E6F5] bg-white text-[#687280] hover:border-[#0A84FF]/30 hover:bg-[#F5F9FF]"
                    }`}
                  >
                    <Briefcase className="w-6 h-6 mb-2" />
                    <span className="text-xs font-bold">Faculty</span>
                  </button>

                  {/* Admin */}
                  <button
                    type="button"
                    onClick={() => handleTabChange("admin")}
                    className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border transition-all duration-200 ${
                      activeTab === "admin"
                        ? "border-[#0A84FF] bg-[#E6F0FF] shadow-[0_4px_12px_rgba(10,132,255,0.12)] text-[#0A84FF]"
                        : "border-[#D9E6F5] bg-white text-[#687280] hover:border-[#0A84FF]/30 hover:bg-[#F5F9FF]"
                    }`}
                  >
                    <Shield className="w-6 h-6 mb-2" />
                    <span className="text-xs font-bold">Admin</span>
                  </button>
                </div>
              </div>

              {/* Email Input */}
              <div>
                <div className="relative">
                  <Mail className="w-5 h-5 text-[#687280] absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmail(val);
                      setGoogleError("");
                      const emailValidation = validateEmail(val);
                      if (!emailValidation.isValid) setLoginError(emailValidation.error);
                      else setLoginError("");
                    }}
                    onBlur={() => {
                      const emailValidation = validateEmail(email);
                      if (!emailValidation.isValid) setLoginError(emailValidation.error);
                      else setLoginError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (isLoginEmailInvalid || !password)) e.preventDefault();
                    }}
                    placeholder={
                      activeTab === "student" ? "Enter your @kgkite.ac.in email"
                      : activeTab === "faculty" ? "Enter your @kgkite.ac.in email"
                      : "Enter your @kgkite.ac.in email"
                    }
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-[#D9E6F5] bg-white text-[#0D1B2A] text-sm font-medium focus:outline-none focus:border-[#0A84FF] focus:ring-4 focus:ring-[#0A84FF]/10 transition-all placeholder:text-[#687280]/60"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="relative">
                  <KeyRound className="w-5 h-5 text-[#687280] absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (isLoginEmailInvalid || !password)) e.preventDefault();
                    }}
                    placeholder="Enter your password"
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-[#D9E6F5] bg-white text-[#0D1B2A] text-sm font-medium focus:outline-none focus:border-[#0A84FF] focus:ring-4 focus:ring-[#0A84FF]/10 transition-all placeholder:text-[#687280]/60"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#687280] hover:text-[#0A84FF] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Actions Row */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="w-4 h-4 rounded border border-[#D9E6F5] bg-[#F5F9FF] group-hover:border-[#0A84FF] flex items-center justify-center transition-colors">
                    <input type="checkbox" className="hidden" />
                    <CheckCircle2 className="w-3 h-3 text-[#0A84FF] opacity-0 group-hover:opacity-100" />
                  </div>
                  <span className="text-xs font-medium text-[#687280]">Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-bold text-[#0A84FF] hover:text-[#0D1B2A] transition-colors"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={isLoading || isLoginEmailInvalid || !password}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-[#0A84FF] to-[#0066FF] hover:from-[#0066FF] hover:to-[#0052CC] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_16px_rgba(10,132,255,0.2)] hover:shadow-[0_12px_20px_rgba(10,132,255,0.3)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
              >
                <span>{isLoading ? "Signing In..." : "Sign In"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* MODE 2: STUDENT REGISTRATION */}
          {authMode === "register" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#E6F0FF] border border-[#0A84FF]/20 text-[#0D1B2A] text-xs">
                <p className="font-bold flex items-center gap-1.5 text-[#0A84FF]">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  Student Self-Registration
                </p>
                <p className="text-[#687280] mt-1 leading-snug">
                  Faculty and Admin accounts are provisioned exclusively by Institutional System Administrators.
                </p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[#0D1B2A] font-semibold mb-1.5 text-xs">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#687280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input type="text" value={regFullName} onChange={(e) => setRegFullName(e.target.value)} placeholder="E.g. Aravind R" className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#D9E6F5] bg-white text-[#0D1B2A] text-sm focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/10 outline-none" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#0D1B2A] font-semibold mb-1.5 text-xs">Institution</label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-[#687280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input type="text" value={regInstitution} onChange={(e) => setRegInstitution(e.target.value)} className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#D9E6F5] bg-white text-[#0D1B2A] text-sm focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/10 outline-none" required />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[#0D1B2A] font-semibold mb-1.5 text-xs">Username</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#687280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input type="text" value={regEmail} className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#D9E6F5] bg-[#F5F9FF] text-[#687280] text-sm cursor-not-allowed outline-none" placeholder="auto-filled from email" readOnly />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[#0D1B2A] font-semibold mb-1.5 text-xs">Department</label>
                    <select value={regDepartment} onChange={(e) => setRegDepartment(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-[#D9E6F5] bg-white text-[#0D1B2A] text-sm focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/10 outline-none">
                      <option value="Electronics & Instrumentation Engineering (EIE)">Electronics & Instrumentation (EIE)</option>
                      <option value="Electronics & Communication Engineering (ECE)">Electronics & Communication (ECE)</option>
                      <option value="Computer Science Engineering (CSE)">Computer Science (CSE)</option>
                      <option value="Information Technology (IT)">Information Technology (IT)</option>
                      <option value="Electrical & Electronics Engineering (EEE)">Electrical & Electronics (EEE)</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Artificial Intelligence & Data Science (AIMDS)">AI & Data Science (AIMDS)</option>
                      <option value="Artificial Intelligence & Machine Learning (AIML)">AI & Machine Learning (AIML)</option>
                      <option value="Computer Science & Business Systems (CSBS)">CS & Business Systems (CSBS)</option>
                      <option value="Robotics & Automation (R&A)">Robotics & Automation (R&A)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#0D1B2A] font-semibold mb-1.5 text-xs">Year of Study</label>
                    <select value={regYear} onChange={(e) => setRegYear(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-[#D9E6F5] bg-white text-[#0D1B2A] text-sm focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/10 outline-none">
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[#0D1B2A] font-semibold mb-1.5 text-xs">Student Email ID</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#687280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input type="email" value={regEmail} onChange={(e) => {
                        const val = e.target.value; setRegEmail(val); setRegUsername(val);
                        const v = validateEmail(val); setRegEmailError(v.isValid ? "" : v.error);
                      }} placeholder="studentname@kgkite.ac.in" className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#D9E6F5] bg-white text-[#0D1B2A] text-sm focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/10 outline-none" required />
                      {regEmailError && <p className="text-red-500 text-[10px] mt-1 font-semibold">{regEmailError}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#0D1B2A] font-semibold mb-1.5 text-xs">Mobile Number</label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#687280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="9876543210" className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#D9E6F5] bg-white text-[#0D1B2A] text-sm focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/10 outline-none" required />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[#0D1B2A] font-semibold mb-1.5 text-xs">Registration Number</label>
                    <div className="relative">
                      <GraduationCap className="w-4 h-4 text-[#687280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input type="text" maxLength={15} value={regRegisterNumber} onChange={(e) => setRegRegisterNumber(e.target.value.toUpperCase().slice(0, 15))} placeholder="E.g. 711721106001" className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#D9E6F5] bg-white text-[#0D1B2A] text-sm focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/10 outline-none" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#0D1B2A] font-semibold mb-1.5 text-xs">Roll Number</label>
                    <div className="relative">
                      <Hash className="w-4 h-4 text-[#687280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input type="text" maxLength={10} value={regRollNumber} onChange={(e) => setRegRollNumber(e.target.value.toUpperCase().slice(0, 10))} placeholder="E.g. 21EC005" className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#D9E6F5] bg-white text-[#0D1B2A] text-sm focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/10 outline-none" required />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[#0D1B2A] font-semibold mb-1.5 text-xs">Password</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#687280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input type={showRegPassword ? "text" : "password"} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-[#D9E6F5] bg-white text-[#0D1B2A] text-sm focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/10 outline-none" required />
                      <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#687280] hover:text-[#0A84FF]">
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#0D1B2A] font-semibold mb-1.5 text-xs">Re-enter Password</label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#687280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input type={showRegPassword ? "text" : "password"} value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#D9E6F5] bg-white text-[#0D1B2A] text-sm focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/10 outline-none" required />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isLoading || isRegFormInvalid} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#0A84FF] to-[#0066FF] hover:from-[#0066FF] hover:to-[#0052CC] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_4px_10px_rgba(10,132,255,0.2)] hover:shadow-[0_6px_15px_rgba(10,132,255,0.3)] transition-all disabled:opacity-60 disabled:pointer-events-none mt-4">
                  <span>Register & Send Verification OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-8 p-4 rounded-xl bg-[#E6F0FF] border border-[#0A84FF]/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#0A84FF] shrink-0 mt-0.5" />
            <p className="text-xs text-[#0D1B2A] leading-relaxed">
              Use your official <span className="font-bold text-[#0A84FF]">@kgkite.ac.in</span> email ID to access the system. All emails are case sensitive and must be in <span className="font-bold">lowercase</span>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center hidden md:block">
          <p className="text-[11px] text-[#687280] font-medium">
            © 2026 KGISL Institute of Technology • Innovation SOI Laboratory Systems
          </p>
        </div>
      </div>

      {/* OTP Email Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D1B2A]/40 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white p-8 border border-[#D9E6F5] shadow-[0_20px_60px_rgba(10,132,255,0.15)] rounded-[24px] space-y-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#E6F0FF] text-[#0A84FF] flex items-center justify-center border border-[#0A84FF]/20 shadow-inner">
              <Mail className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-[#0D1B2A]">Enter OTP Verification Code</h3>
              <p className="text-sm text-[#687280] mt-2 leading-relaxed">
                We sent a 6-digit OTP code to <br/>
                <span className="font-bold text-[#0A84FF]">{regEmail}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyOtpSubmit} className="space-y-6">
              <div>
                <input type="text" maxLength={6} value={inputOtp} onChange={(e) => setInputOtp(e.target.value)} placeholder="ENTER 6 DIGIT OTP" className="w-full text-center tracking-[0.75em] placeholder:tracking-normal text-2xl font-mono py-4 rounded-xl border border-[#D9E6F5] bg-[#F5F9FF] text-[#0A84FF] font-extrabold placeholder:text-sm placeholder:text-[#687280] placeholder:font-sans focus:outline-none focus:border-[#0A84FF] focus:ring-4 focus:ring-[#0A84FF]/10 transition-all" autoFocus required />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button type="button" onClick={() => setShowOtpModal(false)} className="px-5 py-3 text-[#687280] hover:text-[#0D1B2A] text-sm font-semibold transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isLoading} className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#0A84FF] to-[#0066FF] hover:from-[#0066FF] hover:to-[#0052CC] text-white font-bold text-sm shadow-[0_4px_10px_rgba(10,132,255,0.2)] hover:shadow-[0_6px_15px_rgba(10,132,255,0.3)] transition-all">
                  {isLoading ? "Verifying..." : "Verify & Complete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
"""

content = content[:return_index] + new_return

with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated LoginPage.tsx")
