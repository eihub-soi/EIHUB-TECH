import re

with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "r", encoding="utf-8") as f:
    content = f.read()

return_index = content.find("  return (\n")
if return_index == -1:
    print("Could not find return statement")
    exit(1)

new_return = """  return (
    <div className="h-[100dvh] w-full flex flex-col md:flex-row bg-[#F8FAFC] text-[#0D1B2A] font-['Inter',sans-serif] overflow-hidden">
      
      {/* LEFT PANEL */}
      <div className="w-full md:w-[45%] relative hidden md:flex flex-col justify-between bg-white overflow-hidden shadow-[10px_0_30px_rgba(0,0,0,0.03)] z-10 h-full">
        
        {/* Background Vectors & Image */}
        <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(ellipse_at_top_left,rgba(10,132,255,0.05)_0%,transparent_50%)] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[100%] bg-[radial-gradient(circle_at_bottom_right,rgba(10,132,255,0.08)_0%,transparent_50%)] pointer-events-none"></div>
        
        {/* Building Image at Bottom Right */}
        <div className="absolute bottom-0 right-0 w-[90%] h-[55%] opacity-80 pointer-events-none">
            <img src="/kgisl-building.png" alt="Building" className="w-full h-full object-cover object-left-top [mask-image:linear-gradient(to_bottom,transparent,black_20%)]" />
        </div>

        {/* Content Wrapper */}
        <div className="relative z-10 p-6 lg:p-10 h-full flex flex-col">
          <img src="/soi-logo.png" alt="School of Innovation" className="h-10 lg:h-12 object-contain self-start" />
          
          <div className="mt-8 2xl:mt-12 space-y-2">
            <h1 className="text-3xl lg:text-[2.75rem] font-extrabold tracking-tight text-[#0D1B2A] leading-[1.1]">
              Manage.<br />Track.<br /><span className="text-[#0066FF]">Innovate.</span>
            </h1>
            <p className="text-[#687280] font-medium mt-3 max-w-sm text-[13px] lg:text-sm leading-relaxed">
              A smart inventory management solution for the <span className="text-[#0066FF] font-bold">School of Innovation</span>.
            </p>
          </div>

          <div className="mt-6 2xl:mt-10 space-y-4 lg:space-y-5 flex-1 overflow-y-auto no-scrollbar pb-4">
            {/* Feature 1 */}
            <div className="flex items-start gap-3 lg:gap-4">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg border border-[#E5E7EB] bg-white flex items-center justify-center shrink-0 shadow-sm">
                <Package className="w-4 h-4 lg:w-5 lg:h-5 text-[#0066FF]" />
              </div>
              <div>
                <h3 className="font-bold text-[#0D1B2A] text-[13px] lg:text-sm">Smart Inventory</h3>
                <p className="text-[12px] lg:text-[13px] text-[#687280] leading-snug mt-0.5 lg:mt-1">Track components, stock levels and availability in real-time.</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="flex items-start gap-3 lg:gap-4">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg border border-[#E5E7EB] bg-white flex items-center justify-center shrink-0 shadow-sm">
                <ClipboardList className="w-4 h-4 lg:w-5 lg:h-5 text-[#0066FF]" />
              </div>
              <div>
                <h3 className="font-bold text-[#0D1B2A] text-[13px] lg:text-sm">Request & Approvals</h3>
                <p className="text-[12px] lg:text-[13px] text-[#687280] leading-snug mt-0.5 lg:mt-1">Seamless request, approval and return management.</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="flex items-start gap-3 lg:gap-4">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg border border-[#E5E7EB] bg-white flex items-center justify-center shrink-0 shadow-sm">
                <BarChart3 className="w-4 h-4 lg:w-5 lg:h-5 text-[#0066FF]" />
              </div>
              <div>
                <h3 className="font-bold text-[#0D1B2A] text-[13px] lg:text-sm">Reports & Analytics</h3>
                <p className="text-[12px] lg:text-[13px] text-[#687280] leading-snug mt-0.5 lg:mt-1">Insightful reports and analytics for better decision making.</p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="flex items-start gap-3 lg:gap-4">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-lg border border-[#E5E7EB] bg-white flex items-center justify-center shrink-0 shadow-sm">
                <ShieldCheck className="w-4 h-4 lg:w-5 lg:h-5 text-[#0066FF]" />
              </div>
              <div>
                <h3 className="font-bold text-[#0D1B2A] text-[13px] lg:text-sm">Secure & Reliable</h3>
                <p className="text-[12px] lg:text-[13px] text-[#687280] leading-snug mt-0.5 lg:mt-1">Role-based access with enterprise grade security.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - LOGIN */}
      <div className="w-full md:w-[55%] flex flex-col items-center justify-between p-4 sm:p-6 relative h-full bg-[#F8FAFC] overflow-y-auto no-scrollbar">
        
        {/* Faint Background Patterns for Right Panel */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(10,132,255,0.03)_0%,transparent_50%)] pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(10,132,255,0.03)_0%,transparent_50%)] pointer-events-none"></div>

        {/* Spacer for vertical centering */}
        <div className="hidden md:block flex-1"></div>

        {/* Mobile Promo Header */}
        <div className="md:hidden w-full max-w-sm mt-2 mb-4 text-center space-y-1 z-10 shrink-0">
           <img src="/soi-logo.png" alt="School of Innovation" className="h-8 mx-auto object-contain" />
           <h1 className="text-xl font-extrabold text-[#0D1B2A]">
             Manage. Track. <span className="text-[#0066FF]">Innovate.</span>
           </h1>
        </div>

        <div className="w-full max-w-[420px] lg:max-w-[460px] bg-white rounded-3xl shadow-[0_15px_35px_rgba(0,0,0,0.04)] border border-[#F1F5F9] p-6 lg:p-8 relative z-10 shrink-0">
          
          {/* Top Branding */}
          <div className="text-center mb-6 lg:mb-8">
            <div className="flex items-center justify-center gap-3 mb-1.5">
                <img src="/logo.png" alt="EI HUB Logo" className="h-10 lg:h-12 object-contain" />
                <h2 className="text-2xl lg:text-3xl font-extrabold text-[#0D1B2A] tracking-tight">EI HUB</h2>
            </div>
            <p className="text-[9px] lg:text-[10px] uppercase font-bold tracking-[0.2em] text-[#0066FF]">
              Innovate • Invent • Inspire
            </p>
          </div>

          {/* Login Heading */}
          <div className="text-center mb-5 lg:mb-6">
            <h3 className="text-xl lg:text-2xl font-bold text-[#0D1B2A]">Welcome Back!</h3>
            <p className="text-xs lg:text-[13px] text-[#687280] mt-1 font-medium">Sign in to continue to EI HUB Innoventry</p>
          </div>

          {/* MODE: STUDENT REGISTRATION */}
          {authMode === "register" && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-[#0D1B2A] text-sm">Student Registration</h4>
                  <button type="button" onClick={() => setAuthMode("login")} className="text-xs font-bold text-[#0066FF] hover:underline">Back to Sign In</button>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3 lg:space-y-4 text-xs lg:text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                  <div>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#9CA3AF] absolute left-3 lg:left-4 top-1/2 -translate-y-1/2" />
                      <input type="text" value={regFullName} onChange={(e) => setRegFullName(e.target.value)} placeholder="Full Name" className="w-full pl-9 lg:pl-11 pr-3 lg:pr-4 py-2.5 lg:py-3 rounded-xl border border-[#E5E7EB] focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] outline-none transition-all placeholder:text-[#9CA3AF] text-xs lg:text-sm" required />
                    </div>
                  </div>
                  <div>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-[#9CA3AF] absolute left-3 lg:left-4 top-1/2 -translate-y-1/2" />
                      <input type="text" value={regInstitution} onChange={(e) => setRegInstitution(e.target.value)} placeholder="Institution" className="w-full pl-9 lg:pl-11 pr-3 lg:pr-4 py-2.5 lg:py-3 rounded-xl border border-[#E5E7EB] focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] outline-none transition-all placeholder:text-[#9CA3AF] text-xs lg:text-sm" required />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                  <select value={regDepartment} onChange={(e) => setRegDepartment(e.target.value)} className="w-full px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl border border-[#E5E7EB] focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] outline-none text-[#0D1B2A] text-xs lg:text-sm">
                    <option value="Electronics & Instrumentation Engineering (EIE)">EIE</option>
                    <option value="Electronics & Communication Engineering (ECE)">ECE</option>
                    <option value="Computer Science Engineering (CSE)">CSE</option>
                    <option value="Information Technology (IT)">IT</option>
                  </select>
                  <select value={regYear} onChange={(e) => setRegYear(e.target.value)} className="w-full px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl border border-[#E5E7EB] focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] outline-none text-[#0D1B2A] text-xs lg:text-sm">
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>

                <div className="relative">
                  <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3 lg:left-4 top-1/2 -translate-y-1/2" />
                  <input type="email" value={regEmail} onChange={(e) => {
                    const val = e.target.value; setRegEmail(val); setRegUsername(val);
                    const v = validateEmail(val); setRegEmailError(v.isValid ? "" : v.error);
                  }} placeholder="studentname@kgkite.ac.in" className="w-full pl-9 lg:pl-11 pr-3 lg:pr-4 py-2.5 lg:py-3 rounded-xl border border-[#E5E7EB] focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] outline-none transition-all placeholder:text-[#9CA3AF] text-xs lg:text-sm" required />
                  {regEmailError && <p className="text-red-500 text-[10px] mt-1 font-semibold">{regEmailError}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                  <div className="relative">
                    <GraduationCap className="w-4 h-4 text-[#9CA3AF] absolute left-3 lg:left-4 top-1/2 -translate-y-1/2" />
                    <input type="text" maxLength={15} value={regRegisterNumber} onChange={(e) => setRegRegisterNumber(e.target.value.toUpperCase().slice(0, 15))} placeholder="Reg No." className="w-full pl-9 lg:pl-11 pr-3 lg:pr-4 py-2.5 lg:py-3 rounded-xl border border-[#E5E7EB] focus:border-[#0066FF] outline-none placeholder:text-[#9CA3AF] text-xs lg:text-sm" required />
                  </div>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-[#9CA3AF] absolute left-3 lg:left-4 top-1/2 -translate-y-1/2" />
                    <input type="text" maxLength={10} value={regRollNumber} onChange={(e) => setRegRollNumber(e.target.value.toUpperCase().slice(0, 10))} placeholder="Roll No." className="w-full pl-9 lg:pl-11 pr-3 lg:pr-4 py-2.5 lg:py-3 rounded-xl border border-[#E5E7EB] focus:border-[#0066FF] outline-none placeholder:text-[#9CA3AF] text-xs lg:text-sm" required />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#9CA3AF] absolute left-3 lg:left-4 top-1/2 -translate-y-1/2" />
                    <input type={showRegPassword ? "text" : "password"} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Password" className="w-full pl-9 lg:pl-11 pr-10 py-2.5 lg:py-3 rounded-xl border border-[#E5E7EB] focus:border-[#0066FF] outline-none placeholder:text-[#9CA3AF] text-xs lg:text-sm" required />
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#9CA3AF] absolute left-3 lg:left-4 top-1/2 -translate-y-1/2" />
                    <input type={showRegPassword ? "text" : "password"} value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} placeholder="Confirm Pass" className="w-full pl-9 lg:pl-11 pr-10 py-2.5 lg:py-3 rounded-xl border border-[#E5E7EB] focus:border-[#0066FF] outline-none placeholder:text-[#9CA3AF] text-xs lg:text-sm" required />
                  </div>
                </div>

                <button type="submit" disabled={isLoading || isRegFormInvalid} className="w-full py-3 lg:py-3.5 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:pointer-events-none mt-2 lg:mt-4">
                  <span>Register & Send OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* MODE: LOGIN */}
          {authMode === "login" && (
            <div className="animate-in fade-in">
              {loginError && (
                <div className="mb-4 p-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[11px] lg:text-[12px] font-medium text-center">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                
                {/* Role Selection */}
                <div className="mb-4 lg:mb-5">
                  <div className="flex items-center justify-center gap-2 lg:gap-3 mb-4 lg:mb-5">
                    <div className="h-[1px] bg-[#E5E7EB] flex-1"></div>
                    <span className="text-[10px] lg:text-[11px] font-medium text-[#9CA3AF] uppercase tracking-wider">Select Your Role</span>
                    <div className="h-[1px] bg-[#E5E7EB] flex-1"></div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 lg:gap-3">
                    {/* Student */}
                    <button type="button" onClick={() => handleTabChange("student")} className={`flex flex-col items-center justify-center p-3 lg:p-4 rounded-[12px] lg:rounded-[14px] border-[1px] transition-all duration-200 ${activeTab === "student" ? "border-[#0066FF] bg-[#F5F9FF] text-[#0066FF]" : "border-[#E5E7EB] bg-white text-[#0D1B2A] hover:border-[#CBD5E1]"}`}>
                      <img src="/avatars/student.png?v=3" alt="Student" className="w-6 h-6 lg:w-7 lg:h-7 mb-1.5 lg:mb-2 object-contain" />
                      <span className="text-xs lg:text-[13px] font-bold">Student</span>
                    </button>
                    
                    {/* Faculty */}
                    <button type="button" onClick={() => handleTabChange("faculty")} className={`flex flex-col items-center justify-center p-3 lg:p-4 rounded-[12px] lg:rounded-[14px] border-[1px] transition-all duration-200 ${activeTab === "faculty" ? "border-[#0066FF] bg-[#F5F9FF] text-[#0066FF]" : "border-[#E5E7EB] bg-white text-[#0D1B2A] hover:border-[#CBD5E1]"}`}>
                      <img src="/avatars/faculty.png?v=3" alt="Faculty" className="w-6 h-6 lg:w-7 lg:h-7 mb-1.5 lg:mb-2 object-contain" />
                      <span className="text-xs lg:text-[13px] font-bold">Faculty</span>
                    </button>

                    {/* Admin */}
                    <button type="button" onClick={() => handleTabChange("admin")} className={`flex flex-col items-center justify-center p-3 lg:p-4 rounded-[12px] lg:rounded-[14px] border-[1px] transition-all duration-200 ${activeTab === "admin" ? "border-[#0066FF] bg-[#F5F9FF] text-[#0066FF]" : "border-[#E5E7EB] bg-white text-[#0D1B2A] hover:border-[#CBD5E1]"}`}>
                      <img src="/avatars/admin.png?v=3" alt="Admin" className="w-6 h-6 lg:w-7 lg:h-7 mb-1.5 lg:mb-2 object-contain" />
                      <span className="text-xs lg:text-[13px] font-bold">Admin</span>
                    </button>
                  </div>
                </div>

                {/* Email Input */}
                <div className="relative">
                  <Mail className="w-[16px] h-[16px] lg:w-[18px] lg:h-[18px] text-[#9CA3AF] absolute left-3.5 lg:left-4 top-1/2 -translate-y-1/2" />
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
                    placeholder="Enter your @kgkite.ac.in email"
                    className="w-full pl-10 pr-10 lg:pl-12 lg:pr-12 py-3 lg:py-[13px] rounded-xl border border-[#E5E7EB] bg-white text-[#0D1B2A] text-xs lg:text-[13px] font-medium focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] transition-all placeholder:text-[#9CA3AF]"
                    required
                  />
                  <User className="w-[16px] h-[16px] lg:w-[18px] lg:h-[18px] text-[#9CA3AF] absolute right-3.5 lg:right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Password Input */}
                <div className="relative">
                  <KeyRound className="w-[16px] h-[16px] lg:w-[18px] lg:h-[18px] text-[#9CA3AF] absolute left-3.5 lg:left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (isLoginEmailInvalid || !password)) e.preventDefault();
                    }}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 lg:pl-12 lg:pr-12 py-3 lg:py-[13px] rounded-xl border border-[#E5E7EB] bg-white text-[#0D1B2A] text-xs lg:text-[13px] font-medium focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] transition-all placeholder:text-[#9CA3AF]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 lg:right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#687280] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-[16px] h-[16px] lg:w-[18px] lg:h-[18px]" /> : <Eye className="w-[16px] h-[16px] lg:w-[18px] lg:h-[18px]" />}
                  </button>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-between pt-1 lg:pt-1.5">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="w-3.5 h-3.5 lg:w-[14px] lg:h-[14px] rounded-[3px] border border-[#CBD5E1] bg-white group-hover:border-[#0066FF] flex items-center justify-center transition-colors">
                      <input type="checkbox" className="hidden" />
                      <CheckCircle2 className="w-2.5 h-2.5 text-[#0066FF] opacity-0 group-hover:opacity-100" />
                    </div>
                    <span className="text-[11px] lg:text-[12px] font-medium text-[#687280]">Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[11px] lg:text-[12px] font-bold text-[#0066FF] hover:text-[#0052CC] transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={isLoading || isLoginEmailInvalid || !password}
                  className="w-full py-3 lg:py-3.5 mt-2 lg:mt-3 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
                >
                  <span>{isLoading ? "Signing In..." : "Sign In"}</span>
                  <ArrowRight className="w-4 h-4 lg:w-[18px] lg:h-[18px]" />
                </button>

                {/* Security Notice */}
                <div className="mt-4 lg:mt-5 p-3.5 lg:p-4 rounded-xl lg:rounded-[14px] bg-[#F0F7FF] flex items-start gap-2.5 lg:gap-3">
                  <ShieldCheck className="w-4 h-4 lg:w-[18px] lg:h-[18px] text-[#0066FF] shrink-0 mt-0.5" />
                  <p className="text-[11px] lg:text-[12px] text-[#0D1B2A] leading-relaxed">
                    Use your official <span className="font-bold text-[#0066FF]">@kgkite.ac.in</span> email ID to access the system. All emails are case sensitive and must be in <span className="font-bold text-[#0066FF]">lowercase</span>.
                  </p>
                </div>
                
                {/* Registration Link */}
                <div className="text-center mt-4 lg:mt-5">
                    <p className="text-[11px] lg:text-xs text-[#687280]">
                        New Student? <button type="button" onClick={() => setAuthMode("register")} className="font-bold text-[#0066FF] hover:underline">Register Here</button>
                    </p>
                </div>

              </form>
            </div>
          )}
        </div>

        {/* Spacer for vertical centering */}
        <div className="hidden md:block flex-1"></div>

        {/* Footer */}
        <div className="mt-6 mb-2 text-center shrink-0">
          <p className="text-[10px] lg:text-[11px] text-[#687280] font-medium">
            © 2026 KGISL Institute of Technology • Innovation SOI Laboratory Systems
          </p>
        </div>
      </div>

      {/* OTP Email Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D1B2A]/40 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white p-6 lg:p-8 border border-[#D9E6F5] shadow-[0_20px_60px_rgba(10,132,255,0.15)] rounded-[20px] lg:rounded-[24px] space-y-5 lg:space-y-6 text-center">
            <div className="w-12 h-12 lg:w-14 lg:h-14 mx-auto rounded-2xl bg-[#F0F7FF] text-[#0066FF] flex items-center justify-center">
              <Mail className="w-6 h-6 lg:w-7 lg:h-7" />
            </div>

            <div>
              <h3 className="text-lg lg:text-xl font-extrabold text-[#0D1B2A]">Enter OTP Verification Code</h3>
              <p className="text-xs lg:text-sm text-[#687280] mt-1.5 lg:mt-2 leading-relaxed">
                We sent a 6-digit OTP code to <br/>
                <span className="font-bold text-[#0066FF]">{regEmail}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyOtpSubmit} className="space-y-5 lg:space-y-6">
              <div>
                <input type="text" maxLength={6} value={inputOtp} onChange={(e) => setInputOtp(e.target.value)} placeholder="ENTER 6 DIGIT OTP" className="w-full text-center tracking-[0.5em] lg:tracking-[0.75em] placeholder:tracking-normal text-xl lg:text-2xl font-mono py-3 lg:py-4 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] text-[#0066FF] font-extrabold placeholder:text-xs lg:placeholder:text-sm placeholder:text-[#9CA3AF] placeholder:font-sans focus:outline-none focus:border-[#0066FF] focus:ring-1 focus:ring-[#0066FF] transition-all" autoFocus required />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1 lg:pt-2">
                <button type="button" onClick={() => setShowOtpModal(false)} className="px-4 lg:px-5 py-2.5 lg:py-3 text-[#687280] hover:text-[#0D1B2A] text-xs lg:text-sm font-semibold transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isLoading} className="px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs lg:text-sm transition-all">
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

print("Rewrite successful.")
