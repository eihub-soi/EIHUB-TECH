const { test, expect } = require('@playwright/test');

test('Verify Overdue Request status calculations, badges, filters and details modal', async ({ page }) => {
  // Mock client.ts to disable Firebase authentication and enable pure local/mock storage mode
  await page.route('**/src/firebase/client.ts', route => {
    route.fulfill({
      contentType: 'application/javascript',
      body: `
        export const firebaseConfig = {};
        export const isFirebaseConfigured = false;
        export const auth = null;
        export const db = null;
      `
    });
  });

  // 1. Go to homepage
  await page.goto('http://localhost:3000/');

  // 2. Inject localStorage variables to bypass login and load test requests
  await page.evaluate(() => {
    localStorage.setItem('ei_hub_active_user_id', 'usr-faculty-01');
    localStorage.setItem('ei_hub_active_user_profile', JSON.stringify({
      id: "usr-faculty-01",
      email: "faculty-01@kgkite.ac.in",
      full_name: "Faculty User 01",
      role: "faculty",
      faculty_id: "FAC-KITE-01",
      department: "ECE",
      phone: "+91 98765 00001",
      avatar_url: "/avatars/faculty.png",
      is_active: true
    }));
    localStorage.setItem('ei_hub_requests_v2', JSON.stringify([
      {
        id: "test-req-1",
        request_code: "REQ-TEST-1",
        student_id: "usr-student-1",
        student_name: "Test Student Not Overdue",
        student_register_no: "711721106001",
        student_email: "student1@kgisl.edu.in",
        component_id: "comp-1",
        component_name: "Arduino Uno R3",
        component_category: "Microcontrollers",
        quantity: 1,
        purpose: "Project Purpose: Not Overdue Project\nFrom Date: 2026-08-02\nTo Date: 2026-08-21\nProject Guide: Prof. Robert Chen\nDescription: Testing",
        status: "approved",
        requested_at: "2026-08-02T10:00:00Z",
        approved_at: "2026-08-02T11:00:00Z",
        expected_return_at: "2026-08-21T17:00:00+05:30",
        created_at: "2026-08-02T10:00:00Z"
      },
      {
        id: "test-req-2",
        request_code: "REQ-TEST-2",
        student_id: "usr-student-1",
        student_name: "Test Student Overdue Next Day",
        student_register_no: "711721106001",
        student_email: "student1@kgisl.edu.in",
        component_id: "comp-1",
        component_name: "Arduino Uno R3",
        component_category: "Microcontrollers",
        quantity: 1,
        purpose: "Project Purpose: Overdue Next Day Project\nFrom Date: 2026-08-02\nTo Date: 2026-08-20\nProject Guide: Prof. Robert Chen\nDescription: Testing",
        status: "approved",
        requested_at: "2026-08-02T10:00:00Z",
        approved_at: "2026-08-02T11:00:00Z",
        expected_return_at: "2026-08-20T17:00:00+05:30",
        created_at: "2026-08-02T10:00:00Z"
      },
      {
        id: "test-req-3",
        request_code: "REQ-TEST-3",
        student_id: "usr-student-1",
        student_name: "Test Student Remains Overdue",
        student_register_no: "711721106001",
        student_email: "student1@kgisl.edu.in",
        component_id: "comp-1",
        component_name: "Arduino Uno R3",
        component_category: "Microcontrollers",
        quantity: 1,
        purpose: "Project Purpose: Remains Overdue Project\nFrom Date: 2026-08-02\nTo Date: 2026-08-15\nProject Guide: Prof. Robert Chen\nDescription: Testing",
        status: "approved",
        requested_at: "2026-08-02T10:00:00Z",
        approved_at: "2026-08-02T11:00:00Z",
        expected_return_at: "2026-08-15T17:00:00+05:30",
        created_at: "2026-08-02T10:00:00Z"
      },
      {
        id: "test-req-4",
        request_code: "REQ-TEST-4",
        student_id: "usr-student-1",
        student_name: "Test Student Returned",
        student_register_no: "711721106001",
        student_email: "student1@kgisl.edu.in",
        component_id: "comp-1",
        component_name: "Arduino Uno R3",
        component_category: "Microcontrollers",
        quantity: 1,
        purpose: "Project Purpose: Returned Project\nFrom Date: 2026-08-02\nTo Date: 2026-08-20\nProject Guide: Prof. Robert Chen\nDescription: Testing",
        status: "returned",
        requested_at: "2026-08-02T10:00:00Z",
        approved_at: "2026-08-02T11:00:00Z",
        expected_return_at: "2026-08-20T17:00:00+05:30",
        returned_at: "2026-08-19T10:00:00Z",
        created_at: "2026-08-02T10:00:00Z"
      },
      {
        id: "test-req-5",
        request_code: "REQ-TEST-5",
        student_id: "usr-student-1",
        student_name: "Test Student Rejected",
        student_register_no: "711721106001",
        student_email: "student1@kgisl.edu.in",
        component_id: "comp-1",
        component_name: "Arduino Uno R3",
        component_category: "Microcontrollers",
        quantity: 1,
        purpose: "Project Purpose: Rejected Project\nFrom Date: 2026-08-02\nTo Date: 2026-08-20\nProject Guide: Prof. Robert Chen\nDescription: Testing",
        status: "rejected",
        requested_at: "2026-08-02T10:00:00Z",
        expected_return_at: "2026-08-20T17:00:00+05:30",
        created_at: "2026-08-02T10:00:00Z"
      }
    ]));
  });

  // 3. Navigate directly to Approval History Page (React will now load the user cleanly)
  await page.goto('http://localhost:3000/faculty/approval-history');

  // 4. Verify table headers exist
  await expect(page.locator('table')).toBeVisible();

  // 5. Verify the 5 requests exist with correct statuses
  // REQ-TEST-1 -> Approved
  const row1 = page.locator('tr', { hasText: 'REQ-TEST-1' });
  await expect(row1.locator('span').filter({ hasText: /^Approved$/ })).toBeVisible();

  // REQ-TEST-2 -> Overdue
  const row2 = page.locator('tr', { hasText: 'REQ-TEST-2' });
  await expect(row2.locator('span').filter({ hasText: /^Overdue$/ })).toBeVisible();

  // REQ-TEST-3 -> Overdue
  const row3 = page.locator('tr', { hasText: 'REQ-TEST-3' });
  await expect(row3.locator('span').filter({ hasText: /^Overdue$/ })).toBeVisible();

  // REQ-TEST-4 -> Returned
  const row4 = page.locator('tr', { hasText: 'REQ-TEST-4' });
  await expect(row4.locator('span').filter({ hasText: /^Returned$/ })).toBeVisible();

  // REQ-TEST-5 -> Rejected
  const row5 = page.locator('tr', { hasText: 'REQ-TEST-5' });
  await expect(row5.locator('span').filter({ hasText: /^Rejected$/ })).toBeVisible();

  // 6. Test dropdown status filter for 'Overdue'
  const filterSelect = page.locator('select').first();
  await filterSelect.selectOption('overdue');

  // Verify only overdue records are shown (2 rows in tbody)
  const rowsVisible = page.locator('tbody tr');
  await expect(rowsVisible).toHaveCount(2);
  await expect(rowsVisible.first()).toContainText('REQ-TEST-2');
  await expect(rowsVisible.nth(1)).toContainText('REQ-TEST-3');

  // 7. Reset dropdown filter to 'All Statuses'
  await filterSelect.selectOption('all');
  await expect(page.locator('tbody tr')).toHaveCount(5);

  // 8. Open details modal for REQ-TEST-2
  await row2.locator('button[title="View workflow history"]').click();

  // Verify modal elements
  const modal = page.locator('div.fixed.inset-0.z-50');
  await expect(modal).toBeVisible();
  await expect(modal.locator('text=Request Details (REQ-TEST-2)')).toBeVisible();
  
  // Verify status field in modal shows Overdue badge
  const statusLabel = modal.locator('p:text("Status")');
  await expect(statusLabel).toBeVisible();
  const modalStatusBadge = modal.locator('span:text("Overdue")');
  await expect(modalStatusBadge).toBeVisible();

  // 9. Close modal
  await modal.locator('button:has-text("Close")').click();
  await expect(modal).not.toBeVisible();
});
