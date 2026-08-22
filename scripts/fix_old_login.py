import re

with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

content = "".join(lines)
idx = content.find('placeholder="E.g. Aravind R"')
if idx != -1:
    content = content[:idx] + """placeholder="E.g. Aravind R"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl glass-input text-black text-xs font-medium"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-black font-semibold mb-1">
                      Institution
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-gray-700 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={regInstitution}
                        onChange={(e) => setRegInstitution(e.target.value)}
                        placeholder="E.g. KGISL Institute of Technology"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl glass-input text-black text-xs font-medium"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Department & Year */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-black font-semibold mb-1">
                      Department
                    </label>
                    <select
                      value={regDepartment}
                      onChange={(e) => setRegDepartment(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl glass-input text-black text-xs font-medium appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_1rem_center] bg-no-repeat"
                    >
                      <option value="Electronics & Instrumentation Engineering (EIE)">
                        EIE
                      </option>
                      <option value="Electronics & Communication Engineering (ECE)">
                        ECE
                      </option>
                      <option value="Computer Science Engineering (CSE)">
                        CSE
                      </option>
                      <option value="Information Technology (IT)">IT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-black font-semibold mb-1">
                      Year
                    </label>
                    <select
                      value={regYear}
                      onChange={(e) => setRegYear(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl glass-input text-black text-xs font-medium appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:12px_12px] bg-[right_1rem_center] bg-no-repeat"
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-black font-semibold mb-1 flex items-center justify-between">
                    <span>College Email Address</span>
                    {regEmailError && (
                      <span className="text-[10px] text-red-500">
                        * {regEmailError}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-700 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRegEmail(val);
                        setRegUsername(val);
                        const v = validateEmail(val);
                        if (!v.isValid) {
                          setRegEmailError(v.error);
                        } else {
                          setRegEmailError("");
                        }
                      }}
                      onBlur={() => {
                        const emailValidation = validateEmail(regEmail);
                        if (!emailValidation.isValid) {
                          setRegEmailError(emailValidation.error);
                        } else {
                          setRegEmailError("");
                        }
                      }}
                      onPaste={() => {
                        setTimeout(() => {
                          const emailValidation = validateEmail(regEmail);
                          if (!emailValidation.isValid) {
                            setRegEmailError(emailValidation.error);
                          } else {
                            setRegEmailError("");
                          }
                        }, 0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && isRegFormInvalid) {
                          e.preventDefault();
                        }
                      }}
                      placeholder="E.g. studentname@kgkite.ac.in"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-2xl glass-input text-black text-xs font-medium ${
                        regEmailError ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20" : ""
                      }`}
                      required
                    />
                  </div>
                </div>

                {/* Registration & Roll Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-black font-semibold mb-1">
                      Registration Number
                    </label>
                    <div className="relative">
                      <GraduationCap className="w-4 h-4 text-gray-700 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={15}
                        value={regRegisterNumber}
                        onChange={(e) => setRegRegisterNumber(e.target.value.toUpperCase().slice(0, 15))}
                        placeholder="E.g. 711721106001"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl glass-input text-black text-xs font-medium"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-black font-semibold mb-1">
                      Roll Number
                    </label>
                    <div className="relative">
                      <Hash className="w-4 h-4 text-gray-700 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={10}
                        value={regRollNumber}
                        onChange={(e) => setRegRollNumber(e.target.value.toUpperCase().slice(0, 10))}
                        placeholder="E.g. 21EC005"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl glass-input text-black text-xs font-medium"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Password & Confirm */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-black font-semibold mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-gray-700 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showRegPassword ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="????????"
                        className="w-full pl-10 pr-10 py-2.5 rounded-2xl glass-input text-black text-xs font-medium"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-700 hover:text-black"
                      >
                        {showRegPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-black font-semibold mb-1">
                      Re-enter Password
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-gray-700 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type={showRegPassword ? "text" : "password"}
                        value={regConfirmPassword}
                        onChange={(e) => setRegConfirmPassword(e.target.value)}
                        placeholder="????????"
                        className="w-full pl-10 pr-10 py-2.5 rounded-2xl glass-input text-black text-xs font-medium"
                        required
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isRegFormInvalid}
                  className="w-full py-3 rounded-2xl bg-[#60A5FA] hover:bg-[#60A5FA] text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  <span>Register & Send Verification OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* OTP Email Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-indigo-950/40 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md glass-panel p-8 border border-white/50 shadow-2xl rounded-[2rem] space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#60A5FA] text-black flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Mail className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-black">
                Enter OTP Verification Code
              </h3>
              <p className="text-sm text-gray-800 mt-2 font-medium">
                We sent a 6-digit OTP code to <br />
                <span className="font-bold text-black">{regEmail}</span>
              </p>
            </div>

            <form onSubmit={handleVerifyOtpSubmit} className="space-y-6">
              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={inputOtp}
                  onChange={(e) => setInputOtp(e.target.value)}
                  placeholder="ENTER 6 DIGIT OTP"
                  className="w-full text-center tracking-[0.75em] placeholder:tracking-normal text-2xl font-mono py-4 rounded-2xl glass-input text-black font-extrabold placeholder:text-sm placeholder:text-gray-500 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#60A5FA]/50"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="px-5 py-3 text-gray-700 hover:text-black text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 rounded-2xl bg-[#60A5FA] hover:bg-[#60A5FA] text-black font-bold text-sm shadow-lg shadow-blue-500/20 hover:scale-[1.02] transition-all"
                >
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

export default LoginPage;
"""

with open(r"d:\EI HUB TECH\src\pages\LoginPage.tsx", "w", encoding="utf-8") as f:
    f.write(content)
