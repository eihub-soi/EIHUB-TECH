const EMAIL_REGEX = /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const LOWERCASE_EMAIL_ERROR = "Email address must contain only lowercase letters.";
const DOMAIN_EMAIL_ERROR = "Only official @kgkite.ac.in email addresses are allowed.";

function validateEmail(email) {
  if (!email || email.length === 0) {
    return { isValid: false, error: "Email address cannot be empty." };
  }
  if (/[A-Z]/.test(email)) {
    return {
      isValid: false,
      error: LOWERCASE_EMAIL_ERROR
    };
  }
  if (/\s/.test(email)) {
    return {
      isValid: false,
      error: "Email address cannot contain spaces."
    };
  }
  if (/[^a-z0-9@._-]/.test(email)) {
    return {
      isValid: false,
      error: "Email contains invalid characters."
    };
  }
  if (!email.endsWith("@kgkite.ac.in")) {
    return {
      isValid: false,
      error: DOMAIN_EMAIL_ERROR
    };
  }
  if (!EMAIL_REGEX.test(email)) {
    return {
      isValid: false,
      error: "Please enter a valid email address format."
    };
  }
  return { isValid: true, error: "" };
}

const testCases = [
  { email: "student@kgkite.ac.in", expected: true, expectedError: "" },
  { email: "faculty@kgkite.ac.in", expected: true, expectedError: "" },
  { email: "admin@kgkite.ac.in", expected: true, expectedError: "" },
  { email: "STUDENT@kgkite.ac.in", expected: false, expectedError: LOWERCASE_EMAIL_ERROR },
  { email: "Student@kgkite.ac.in", expected: false, expectedError: LOWERCASE_EMAIL_ERROR },
  { email: "ADMIN@kgkite.ac.in", expected: false, expectedError: LOWERCASE_EMAIL_ERROR },
  { email: "Faculty@kgkite.ac.in", expected: false, expectedError: LOWERCASE_EMAIL_ERROR },
  { email: "studentname@KGKITE.AC.IN", expected: false, expectedError: LOWERCASE_EMAIL_ERROR },
  { email: "student@gmail.com", expected: false, expectedError: DOMAIN_EMAIL_ERROR },
  { email: "student@yahoo.com", expected: false, expectedError: DOMAIN_EMAIL_ERROR },
  { email: "student@kgkite.com", expected: false, expectedError: DOMAIN_EMAIL_ERROR },
  { email: "", expected: false, expectedError: "Email address cannot be empty." },
  { email: "student name@kgkite.ac.in", expected: false, expectedError: "Email address cannot contain spaces." },
  { email: "student#name@kgkite.ac.in", expected: false, expectedError: "Email contains invalid characters." }
];

let failed = false;
testCases.forEach(({ email, expected, expectedError }) => {
  const result = validateEmail(email);
  const passed = result.isValid === expected;
  console.log(`Test: "${email}" -> ${result.isValid ? "Accepted" : "Rejected"} (${passed ? "PASS" : "FAIL"})`);
  if (!passed) {
    failed = true;
    console.error(`Error details: expected ${expected ? "Accepted" : "Rejected"} but got ${result.isValid ? "Accepted" : "Rejected"}`);
  }
  if (result.error !== expectedError) {
    failed = true;
    console.error(`Error details: expected error message '${expectedError}' but got '${result.error}'`);
  }
});

if (failed) {
  console.error("Some frontend validation tests failed!");
  process.exit(1);
} else {
  console.log("All frontend validation tests passed successfully!");
}
