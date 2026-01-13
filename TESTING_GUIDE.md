# Testing Guide - Invite Link & Notification System

This document provides comprehensive test cases and manual testing procedures for the invite link and notification features.

---

## Table of Contents
1. [Running Backend Tests](#running-backend-tests)
2. [Invite Link Manual Testing](#invite-link-manual-testing)
3. [Notification System Manual Testing](#notification-system-manual-testing)
4. [E2E Test Scenarios](#e2e-test-scenarios)
5. [Edge Cases & Error Scenarios](#edge-cases--error-scenarios)

---

## Running Backend Tests

### Setup
```bash
cd backend/core
python manage.py makemigrations
python manage.py migrate
```

### Run All Tests
```bash
python manage.py test notification.tests
```

### Run Specific Test Classes
```bash
# Invite Token tests only
python manage.py test notification.tests.InviteTokenTestCase

# Notification tests only
python manage.py test notification.tests.NotificationTestCase

# Hire Request tests only
python manage.py test notification.tests.HireRequestTestCase
```

### Run Specific Test Method
```bash
python manage.py test notification.tests.InviteTokenTestCase.test_creator_can_generate_invite_token
```

### Test Coverage
```bash
# Install coverage
pip install coverage

# Run tests with coverage
coverage run --source='.' manage.py test notification.tests
coverage report
```

---

## Invite Link Manual Testing

### Test Case 1: Generate Invite Link (Creator)

**Prerequisites:**
- Logged in as Creator
- On Dashboard page

**Steps:**
1. Click "Invite Member" button in Team card
2. Select "Send Invite Link" option
3. (Optional) Enter email: test@example.com
4. Click "Copy Link" button

**Expected Result:**
- ✅ Toast notification: "Invite link copied to clipboard!"
- ✅ Link format: `http://localhost:5173/signup/talent?invite={UUID}`
- ✅ Link is copied to clipboard

**Database Verification:**
```sql
SELECT * FROM notification_invitetoken ORDER BY created_at DESC LIMIT 1;
```
- Should have `is_used=False`
- Should have `expires_at` = 7 days from now
- Should have `creator_id` = current user ID

---

### Test Case 2: Validate Invite Link (Public)

**Prerequisites:**
- Have a valid invite token from Test Case 1

**Steps:**
1. Paste invite link in browser
2. Observe the signup page

**Expected Result:**
- ✅ Page loads: `/signup/talent?invite={token}`
- ✅ Toast notification: "Invite link validated!"
- ✅ Banner appears: "You're Invited!"
- ✅ Banner shows: "Join {Creator Name}'s team at {Company Name}"
- ✅ Form fields are visible and editable

**API Verification:**
```bash
curl -X GET "http://localhost:8000/api/v3/invites/validate/{token}/"
```
Expected response:
```json
{
  "token": "...",
  "creator_name": "Test Creator",
  "creator_company": "Test Company",
  "is_valid": true,
  "is_used": false,
  "expires_at": "2026-01-11T..."
}
```

---

### Test Case 3: Signup with Invite Link (Talent)

**Prerequisites:**
- Valid invite link from Test Case 1
- On talent signup page with invite token

**Steps:**
1. Fill in signup form:
   - Full Name: "John Doe"
   - Email: "john@test.com"
   - Professional Title: "UI Designer"
   - Primary Skill: "UI/UX Design"
   - Skills: ["Figma", "Prototyping"]
   - Password: "password123"
   - Confirm Password: "password123"
   - Check "I agree to terms"
2. Click "Create Talent Account"

**Expected Result:**
- ✅ Account created successfully
- ✅ Toast: "Welcome to {Company Name}'s team!" or "Welcome to {Creator Name}'s team!"
- ✅ Redirected to `/dashboard`
- ✅ Talent sees their dashboard

**Database Verification:**
```sql
-- Verify invite token is marked as used
SELECT is_used, used_by_id, used_at
FROM notification_invitetoken
WHERE token = '{token}';

-- Verify hire request was created with accepted status
SELECT creator_id, talent_id, status
FROM notification_hirerequest
WHERE talent_id = (SELECT id FROM account_user WHERE email = 'john@test.com');
```
Expected:
- `is_used=True`
- `used_by_id` = new user ID
- `hire_request.status='accepted'`

---

### Test Case 4: Creator Sees New Team Member

**Prerequisites:**
- Completed Test Case 3
- Logged in as Creator (from Test Case 1)

**Steps:**
1. Go to Dashboard
2. Look at Team card in right sidebar

**Expected Result:**
- ✅ Team card shows: "1 member" (or N members)
- ✅ New talent appears in team list
- ✅ Shows talent name: "John Doe"
- ✅ Shows talent role: "UI Designer"
- ✅ Shows avatar (generated or uploaded)

**API Verification:**
```bash
curl -X GET "http://localhost:8000/api/v3/team/" \
  -H "Authorization: Bearer {creator_access_token}"
```
Expected response includes new talent.

---

### Test Case 5: Expired Invite Link

**Prerequisites:**
- Create an invite token and manually set expiry to past

**Database Setup:**
```sql
UPDATE notification_invitetoken
SET expires_at = datetime('now', '-1 day')
WHERE token = '{token}';
```

**Steps:**
1. Paste expired invite link in browser
2. Observe the signup page

**Expected Result:**
- ✅ Toast notification: "This invite link has expired or has already been used."
- ✅ NO "You're Invited!" banner
- ✅ Regular signup page shown
- ✅ Can still sign up, but NOT auto-added to team

---

### Test Case 6: Already Used Invite Link

**Prerequisites:**
- Have a used invite token from Test Case 3

**Steps:**
1. Try to use the same invite link again
2. Attempt to sign up with different email

**Expected Result:**
- ✅ Toast notification: "This invite link has expired or has already been used."
- ✅ NO "You're Invited!" banner
- ✅ Can still sign up, but NOT auto-added to team

---

### Test Case 7: Talent Cannot Generate Invite

**Prerequisites:**
- Logged in as Talent

**Steps:**
1. Go to Dashboard
2. Look for "Invite Member" option

**Expected Result:**
- ✅ "Invite Member" button NOT visible (talents don't have Team card)
- ✅ If manually calling API, should return 400 error

**API Verification:**
```bash
curl -X POST "http://localhost:8000/api/v3/invites/generate/" \
  -H "Authorization: Bearer {talent_access_token}" \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: `400 Bad Request` - "Only creators can generate invite links."

---

## Notification System Manual Testing

### Test Case 8: Creator Sends Hire Request

**Prerequisites:**
- Logged in as Creator
- At least one Talent exists in the system

**Steps:**
1. (Currently not implemented in UI - use API)
```bash
curl -X POST "http://localhost:8000/api/v3/hire-requests/" \
  -H "Authorization: Bearer {creator_access_token}" \
  -H "Content-Type: application/json" \
  -d '{"talent": "{talent_user_id}", "message": "Join our team!"}'
```

**Expected Result:**
- ✅ Hire request created with `status='pending'`
- ✅ Notification created for Talent
- ✅ Talent sees notification bell with badge "1"

**Database Verification:**
```sql
-- Verify hire request
SELECT * FROM notification_hirerequest WHERE talent_id = '{talent_id}';

-- Verify notification was created
SELECT * FROM notification_notification WHERE user_id = '{talent_id}' ORDER BY created_at DESC LIMIT 1;
```
Expected notification:
- `title="New Hire Request"`
- `notification_type='hire'`
- `is_read=False`
- `hire_request_id` is set

---

### Test Case 9: Talent Views Notification

**Prerequisites:**
- Completed Test Case 8
- Logged in as Talent

**Steps:**
1. Observe notification bell icon
2. Click on bell icon

**Expected Result:**
- ✅ Bell icon shows red badge with number "1"
- ✅ Dropdown opens
- ✅ Notification appears with:
  - Briefcase icon (hire type)
  - Title: "New Hire Request"
  - Message: "{Creator Name} wants to hire you."
  - Time ago: "a few seconds ago"
  - Blue dot (unread indicator)
  - Two buttons: [Accept] [Decline]

---

### Test Case 10: Talent Accepts Hire Request

**Prerequisites:**
- Completed Test Case 9
- Notification dropdown is open

**Steps:**
1. Click "Accept" button on the hire notification

**Expected Result:**
- ✅ Button shows loading spinner
- ✅ Toast notification: "Hire request accepted! Welcome to the team."
- ✅ Buttons disappear
- ✅ Shows: "✓ Response sent"
- ✅ Notification marked as read (blue dot disappears)
- ✅ Dropdown auto-closes after 1 second
- ✅ Notification created for Creator

**Database Verification:**
```sql
-- Verify hire request status changed
SELECT status, responded_at FROM notification_hirerequest WHERE id = '{hire_request_id}';

-- Verify talent notification marked as read
SELECT is_read FROM notification_notification WHERE user_id = '{talent_id}' AND hire_request_id = '{hire_request_id}';

-- Verify creator received notification
SELECT * FROM notification_notification WHERE user_id = '{creator_id}' ORDER BY created_at DESC LIMIT 1;
```
Expected:
- `hire_request.status='accepted'`
- `hire_request.responded_at` is set
- Talent notification: `is_read=True`
- Creator notification exists with message containing "accepted"

---

### Test Case 11: Creator Sees Acceptance Notification

**Prerequisites:**
- Completed Test Case 10
- Logged in as Creator

**Steps:**
1. Refresh page or wait for auto-refresh (30s)
2. Observe notification bell
3. Click notification bell

**Expected Result:**
- ✅ Bell shows badge "1"
- ✅ Notification appears:
  - Title: "Hire Request Update"
  - Message: "{Talent Name} accepted your hire request."
  - Hire icon
  - Blue dot (unread)
  - NO action buttons (creators don't respond to notifications)

---

### Test Case 12: Mark Single Notification as Read

**Prerequisites:**
- Have at least one unread notification

**Steps:**
1. Click on notification bell
2. Click on an unread notification (has blue dot)

**Expected Result:**
- ✅ Blue dot disappears
- ✅ Background color changes from primary tint to normal
- ✅ Badge count decreases by 1

**API Verification:**
```bash
curl -X PATCH "http://localhost:8000/api/v3/notifications/{notification_id}/read/" \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{"is_read": true}'
```

---

### Test Case 13: Mark All as Read

**Prerequisites:**
- Have multiple unread notifications

**Steps:**
1. Click notification bell
2. Click "Mark all read" button at top

**Expected Result:**
- ✅ Button shows loading spinner
- ✅ All blue dots disappear
- ✅ Badge count becomes "0"
- ✅ Badge disappears from bell icon
- ✅ "Mark all read" button disappears

---

### Test Case 14: Notification Auto-Refresh

**Prerequisites:**
- Two browser tabs/windows
- Tab 1: Creator logged in
- Tab 2: Talent logged in

**Steps:**
1. In Tab 1 (Creator): Send hire request to talent (via API)
2. In Tab 2 (Talent): Wait up to 30 seconds

**Expected Result:**
- ✅ Within 30 seconds, notification badge appears on Tab 2
- ✅ No page refresh needed
- ✅ Notification appears when bell is clicked

---

### Test Case 15: Empty Notification State

**Prerequisites:**
- User has no notifications (clear all from database)

**Steps:**
1. Click notification bell

**Expected Result:**
- ✅ Dropdown shows empty state:
  - Bell icon (muted)
  - Text: "No notifications"
  - Subtext: "You're all caught up!"
  - NO "Mark all read" button

---

## Frontend Component Testing

### Component Test 1: InviteMemberModal - Initial State

**Prerequisites:**
- Logged in as Creator
- On Dashboard page

**Steps:**
1. Click "Invite Member" button in Team card
2. Observe modal appearance

**Expected Result:**
- ✅ Modal opens with title "Invite Team Member"
- ✅ Description: "Choose how you'd like to add a new member to your team"
- ✅ Two option cards visible:
  - "Send Invite Link" with Mail icon
  - "Browse Talent Marketplace" with Users icon
- ✅ Both cards have hover effects (border color changes to primary)

---

### Component Test 2: InviteMemberModal - Send Invite Link Flow

**Prerequisites:**
- InviteMemberModal is open on "choice" step

**Steps:**
1. Click "Send Invite Link" option card
2. Observe the modal content change

**Expected Result:**
- ✅ Modal title changes to "Send Invite Link"
- ✅ Email input field visible with placeholder "colleague@example.com"
- ✅ Message textarea visible with placeholder "Add a personal note..."
- ✅ Three buttons visible:
  - "Copy Link" (outline variant)
  - "Send Email" (primary variant)
  - "Back" (ghost variant)

---

### Component Test 3: InviteMemberModal - Copy Link Without Email

**Prerequisites:**
- InviteMemberModal on "send-invite" step
- Email field is empty

**Steps:**
1. Click "Copy Link" button
2. Observe loading state
3. Wait for API response

**Expected Result:**
- ✅ Button text changes to "Generating..." while loading
- ✅ Button is disabled during loading
- ✅ Toast notification: "Invite link copied to clipboard!"
- ✅ Link is copied to clipboard (format: http://localhost:5173/signup/talent?invite={UUID})
- ✅ Modal remains open

**API Verification:**
```bash
# Check network tab - should see:
POST /api/v3/invites/generate/
Request body: {"invited_email": null}
Response: {"token": "...", "invite_url": "..."}
```

---

### Component Test 4: InviteMemberModal - Copy Link With Email

**Prerequisites:**
- InviteMemberModal on "send-invite" step

**Steps:**
1. Enter email: "test@example.com"
2. Click "Copy Link" button

**Expected Result:**
- ✅ API called with email in request body
- ✅ Toast: "Invite link copied to clipboard!"
- ✅ Link copied to clipboard

**API Verification:**
```bash
POST /api/v3/invites/generate/
Request body: {"invited_email": "test@example.com"}
```

---

### Component Test 5: InviteMemberModal - Send Email Flow

**Prerequisites:**
- InviteMemberModal on "send-invite" step

**Steps:**
1. Leave email field empty
2. Click "Send Email" button

**Expected Result:**
- ✅ Toast error: "Please enter an email address"
- ✅ No API call made
- ✅ Modal remains open

**Then:**
1. Enter email: "colleague@test.com"
2. Click "Send Email" button

**Expected Result:**
- ✅ Button shows "Generating..." during API call
- ✅ Toast success: "Invite link generated! Copy and send to colleague@test.com"
- ✅ Invite link is generated via API

---

### Component Test 6: InviteMemberModal - Back Button

**Prerequisites:**
- InviteMemberModal on "send-invite" step
- Email and message fields filled

**Steps:**
1. Click "Back" button
2. Observe modal state

**Expected Result:**
- ✅ Modal returns to "choice" step
- ✅ Two option cards visible again
- ✅ Form data (email, message) is preserved internally

**Then:**
1. Click "Send Invite Link" again

**Expected Result:**
- ✅ Email and message fields still contain previous values

---

### Component Test 7: InviteMemberModal - Browse Talent Option

**Prerequisites:**
- InviteMemberModal on "choice" step

**Steps:**
1. Click "Browse Talent Marketplace" option card
2. Observe navigation

**Expected Result:**
- ✅ Modal closes
- ✅ Page navigates to "/talent" route
- ✅ Talent Marketplace page loads (showing "Coming Soon" message)

---

### Component Test 8: InviteMemberModal - Close Modal

**Prerequisites:**
- InviteMemberModal is open (any step)

**Steps:**
1. Click outside the modal or press ESC key
2. Observe modal state

**Expected Result:**
- ✅ Modal closes
- ✅ Step resets to "choice"
- ✅ Email field clears
- ✅ Message field clears
- ✅ Generated invite link clears

---

### Component Test 9: InviteMemberModal - API Error Handling

**Prerequisites:**
- Backend is stopped or network is disconnected

**Steps:**
1. Open InviteMemberModal
2. Click "Send Invite Link"
3. Click "Copy Link"

**Expected Result:**
- ✅ Button shows loading state
- ✅ After timeout, toast error: "Failed to generate invite link"
- ✅ Button returns to normal state
- ✅ No link copied to clipboard
- ✅ Modal remains open for retry

---

### Component Test 10: NotificationDropdown - Empty State

**Prerequisites:**
- Logged in user with no notifications
- On any page with TopBar

**Steps:**
1. Observe notification bell icon in top bar
2. Click bell icon

**Expected Result:**
- ✅ Bell icon has NO badge
- ✅ Dropdown opens with width 380px
- ✅ Header shows "Notifications" title
- ✅ NO "Mark all read" button visible
- ✅ Empty state displayed:
  - Bell icon in gray circle
  - Text: "No notifications"
  - Subtext: "You're all caught up!"

---

### Component Test 11: NotificationDropdown - With Unread Notifications

**Prerequisites:**
- Talent user with pending hire request notification

**Steps:**
1. Observe notification bell icon
2. Count the badge number

**Expected Result:**
- ✅ Badge shows correct number (e.g., "1")
- ✅ Badge has red background with white text
- ✅ If count > 9, badge shows "9+"

**Then:**
1. Click bell icon

**Expected Result:**
- ✅ Dropdown opens
- ✅ Header shows "1 unread" text
- ✅ "Mark all read" button visible with checkmark icon
- ✅ Notification list visible in ScrollArea (max height 400px)

---

### Component Test 12: NotificationDropdown - Mark All Read Button

**Prerequisites:**
- Dropdown open with multiple unread notifications

**Steps:**
1. Click "Mark all read" button
2. Observe button state

**Expected Result:**
- ✅ Button shows loading spinner during API call
- ✅ Button text remains "Mark all read"
- ✅ Button is disabled during loading
- ✅ After success:
  - All blue dots disappear
  - Badge count becomes 0
  - Badge disappears from bell icon
  - "Mark all read" button disappears
  - "X unread" text disappears

**API Verification:**
```bash
# Check network tab
PATCH /api/v3/notifications/mark-all-read/
Response: 200 OK
```

---

### Component Test 13: NotificationDropdown - Auto-Refresh

**Prerequisites:**
- Two browser tabs open
- Tab 1: Creator logged in
- Tab 2: Talent logged in with dropdown CLOSED

**Steps:**
1. In Tab 1: Send hire request to talent (via API)
2. In Tab 2: Wait and observe (do NOT click anything)

**Expected Result:**
- ✅ Within 30 seconds, badge appears on bell icon
- ✅ Badge shows "1"
- ✅ No page refresh occurs

**Then:**
1. Click bell icon in Tab 2

**Expected Result:**
- ✅ New notification appears in list
- ✅ Notification has blue dot (unread)

---

### Component Test 14: NotificationDropdown - Loading State

**Prerequisites:**
- Slow network connection (throttle to "Slow 3G" in DevTools)

**Steps:**
1. Refresh page
2. Immediately click notification bell

**Expected Result:**
- ✅ Dropdown shows loading spinner (Loader2 component)
- ✅ Spinner is centered vertically and horizontally
- ✅ Spinner has "animate-spin" class
- ✅ After loading completes, notifications appear

---

### Component Test 15: NotificationItem - Hire Notification Display (Talent)

**Prerequisites:**
- Logged in as Talent
- Have unread hire notification
- Dropdown is open

**Steps:**
1. Observe the notification item

**Expected Result:**
- ✅ Background has blue tint (bg-primary/5)
- ✅ Briefcase icon visible in primary-colored circle
- ✅ Blue dot in top-right (unread indicator)
- ✅ Title: "New Hire Request"
- ✅ Message: "{Creator Name} wants to hire you."
- ✅ Timestamp: "X minutes ago" format
- ✅ Two action buttons visible:
  - "Accept" (primary variant with Check icon)
  - "Decline" (outline variant with X icon)

---

### Component Test 16: NotificationItem - Accept Hire Request

**Prerequisites:**
- Talent with hire notification
- Action buttons visible

**Steps:**
1. Click "Accept" button
2. Observe button and notification state

**Expected Result:**
- ✅ Accept button shows loading spinner
- ✅ Both buttons become disabled
- ✅ Toast success: "Hire request accepted! Welcome to the team."
- ✅ After success:
  - Both action buttons disappear
  - Green checkmark text appears: "✓ Response sent"
  - Blue dot disappears (marked as read)
  - Background color changes to normal
  - Badge count decreases by 1
- ✅ After 1 second, dropdown auto-closes
- ✅ Creator receives acceptance notification

**API Verification:**
```bash
PATCH /api/v3/hire-requests/{id}/respond/
Request body: {"status": "accepted"}
```

---

### Component Test 17: NotificationItem - Decline Hire Request

**Prerequisites:**
- Talent with hire notification

**Steps:**
1. Click "Decline" button

**Expected Result:**
- ✅ Decline button shows loading spinner
- ✅ Both buttons disabled
- ✅ Toast: "Hire request declined."
- ✅ Action buttons disappear
- ✅ Shows: "✓ Response sent"
- ✅ Notification marked as read
- ✅ Dropdown auto-closes after 1 second
- ✅ Creator receives rejection notification

---

### Component Test 18: NotificationItem - Click to Mark as Read

**Prerequisites:**
- Have unread notification (any type)
- Dropdown open

**Steps:**
1. Click anywhere on the notification item (not on action buttons)
2. Observe visual changes

**Expected Result:**
- ✅ Blue dot disappears immediately
- ✅ Background color changes from blue tint to normal
- ✅ Badge count decreases by 1
- ✅ Notification remains in list (not removed)

**API Verification:**
```bash
PATCH /api/v3/notifications/{id}/read/
Request body: {"is_read": true}
```

---

### Component Test 19: NotificationItem - Hover Effect

**Prerequisites:**
- Dropdown open with notifications

**Steps:**
1. Hover mouse over notification item
2. Move mouse away

**Expected Result:**
- ✅ On hover: background changes to secondary/30
- ✅ Cursor becomes pointer
- ✅ Smooth transition effect visible
- ✅ On mouse leave: background returns to original color

---

### Component Test 20: NotificationItem - Response Notification (Creator)

**Prerequisites:**
- Logged in as Creator
- Received response to hire request
- Dropdown open

**Steps:**
1. Observe the notification

**Expected Result:**
- ✅ Title: "Hire Request Update"
- ✅ Message: "{Talent Name} accepted your hire request." (or "rejected")
- ✅ Hire icon (Briefcase)
- ✅ Blue dot if unread
- ✅ NO action buttons (creators don't respond)
- ✅ Clicking marks as read only

---

### Component Test 21: NotificationItem - System Notification

**Prerequisites:**
- Have a system-type notification (if implemented)

**Steps:**
1. Observe the notification

**Expected Result:**
- ✅ Bell icon (not Briefcase)
- ✅ Gray/muted icon color
- ✅ No action buttons
- ✅ Click to mark as read only

---

### Component Test 22: NotificationItem - Network Error During Accept

**Prerequisites:**
- Disconnect network or stop backend

**Steps:**
1. Click "Accept" on hire notification
2. Wait for timeout

**Expected Result:**
- ✅ Button shows loading spinner
- ✅ After timeout, toast error: "An error occurred"
- ✅ Buttons return to enabled state
- ✅ Action buttons remain visible
- ✅ Notification NOT marked as read
- ✅ User can retry

---

### Component Test 23: NotificationDropdown - Scroll Behavior

**Prerequisites:**
- Have 10+ notifications (more than fits in 400px height)

**Steps:**
1. Open notification dropdown
2. Scroll down the notification list
3. Scroll back up

**Expected Result:**
- ✅ ScrollArea component handles overflow
- ✅ Scrollbar appears on right side
- ✅ Smooth scrolling
- ✅ Header remains fixed at top
- ✅ Notifications scroll independently

---

### Component Test 24: NotificationItem - Already Responded Notification

**Prerequisites:**
- Talent has hire notification
- Already clicked Accept
- Notification shows "✓ Response sent"

**Steps:**
1. Refresh page
2. Open notification dropdown
3. Find the same notification

**Expected Result:**
- ✅ Notification is marked as read (no blue dot)
- ✅ NO action buttons visible
- ✅ NO "✓ Response sent" text (only shown during session)
- ✅ Message still shows: "{Creator} wants to hire you."
- ✅ Notification remains in history

---

### Component Test 25: NotificationDropdown - Dropdown Position

**Prerequisites:**
- On Dashboard page
- Screen width: Desktop (>768px)

**Steps:**
1. Click notification bell in top-right corner
2. Observe dropdown position

**Expected Result:**
- ✅ Dropdown aligns to right edge of bell icon
- ✅ 8px offset below the button (sideOffset={8})
- ✅ Dropdown doesn't overflow screen edges
- ✅ Shadow visible on dropdown

---

## Frontend Component Testing Checklist

### InviteMemberModal Component
- [ ] Modal opens and closes correctly
- [ ] Choice step displays both options
- [ ] Send invite step shows form fields
- [ ] Copy link generates and copies token
- [ ] Email validation works correctly
- [ ] Loading states display during API calls
- [ ] Error handling shows appropriate toasts
- [ ] Back button returns to choice step
- [ ] Browse talent option navigates correctly
- [ ] Modal state resets on close

### NotificationDropdown Component
- [ ] Empty state displays correctly
- [ ] Badge shows correct unread count
- [ ] Badge displays "9+" for counts > 9
- [ ] Dropdown opens/closes properly
- [ ] Auto-refresh works (30s interval)
- [ ] Mark all read button functions
- [ ] Loading state shows during initial fetch
- [ ] ScrollArea handles overflow
- [ ] Dropdown position is correct

### NotificationItem Component
- [ ] Hire notifications display correctly
- [ ] System notifications display correctly
- [ ] Icons render based on notification type
- [ ] Unread indicator (blue dot) shows/hides
- [ ] Accept button works and shows loading
- [ ] Decline button works and shows loading
- [ ] Click marks notification as read
- [ ] Hover effect works smoothly
- [ ] Response confirmation displays
- [ ] Creator notifications have no actions
- [ ] Network errors handle gracefully
- [ ] Timestamp formats correctly

---

## E2E Test Scenarios

### Scenario 1: Complete Invite Flow

**Actors:**
- Alice (Creator)
- Bob (New Talent, not yet registered)

**Steps:**
1. Alice logs in as creator
2. Alice clicks "Invite Member" → "Send Invite Link"
3. Alice copies invite link
4. Alice sends link to Bob via email
5. Bob clicks the link
6. Bob sees "You're Invited! Join Alice's team at Creative Studio"
7. Bob fills out signup form
8. Bob clicks "Create Talent Account"
9. Bob is redirected to dashboard
10. Bob sees toast: "Welcome to Creative Studio's team!"
11. Alice refreshes dashboard
12. Alice sees Bob in Team card
13. Alice sees notification: "Hire Request Update - Bob accepted your hire request"

**Success Criteria:**
- ✅ Bob is automatically added to Alice's team
- ✅ No manual acceptance needed
- ✅ Both users receive appropriate notifications
- ✅ Team card updates in real-time

---

### Scenario 2: Complete Hire Request Flow

**Actors:**
- Carol (Creator)
- Dave (Talent, already registered)

**Steps:**
1. Carol sends hire request to Dave (via API)
2. Dave sees notification bell badge "1"
3. Dave clicks bell
4. Dave sees: "New Hire Request - Carol wants to hire you"
5. Dave clicks "Accept"
6. Dave sees: "Hire request accepted! Welcome to the team."
7. Carol refreshes dashboard
8. Carol sees Dave in Team card
9. Carol sees notification: "Dave accepted your hire request"
10. Carol clicks notification
11. Blue dot disappears

**Success Criteria:**
- ✅ Real-time notification delivery
- ✅ One-click acceptance
- ✅ Bidirectional notifications
- ✅ Team membership updated

---

### Scenario 3: Notification Workflow (Decline)

**Actors:**
- Eve (Creator)
- Frank (Talent)

**Steps:**
1. Eve sends hire request to Frank
2. Frank receives notification
3. Frank clicks "Decline"
4. Frank sees: "Hire request declined."
5. Eve receives notification: "Frank rejected your hire request"
6. Frank does NOT appear in Eve's team

**Success Criteria:**
- ✅ Decline works correctly
- ✅ Creator notified of rejection
- ✅ Team membership NOT created

---

## Edge Cases & Error Scenarios

### Edge Case 1: Concurrent Invite Usage

**Scenario:** Two people try to use the same invite link simultaneously

**Expected Behavior:**
- First person: Successfully uses invite, added to team
- Second person: Sees "invite already used" error
- Only one hire request created

### Edge Case 2: Expired Token During Signup

**Scenario:** User starts signup at 23:59:50, invite expires at 00:00:00, user submits at 00:00:10

**Expected Behavior:**
- Signup completes successfully
- Invite token marked as invalid
- User created but NOT added to team
- No error shown to user

### Edge Case 3: Multiple Hire Requests to Same Talent

**Scenario:** Creator A and Creator B both send hire requests to Talent C

**Expected Behavior:**
- Talent C sees 2 notifications
- Talent C can accept both
- Talent C appears in both teams
- Each creator gets separate notification

### Edge Case 4: Notification for Deleted Hire Request

**Scenario:** Hire request is deleted from database but notification still exists

**Expected Behavior:**
- Notification displays normally
- Action buttons don't appear (no hire_request link)
- No errors thrown

### Edge Case 5: Network Failure During Accept

**Scenario:** Talent clicks "Accept" but network fails mid-request

**Expected Behavior:**
- Button shows error state
- Toast: "An error occurred"
- Notification NOT marked as read
- User can retry

---

## Testing Checklist

### Invite Link Feature
- [ ] Creator can generate invite
- [ ] Invite token is unique
- [ ] Invite expires after 7 days
- [ ] Invite can be validated (public endpoint)
- [ ] Signup with valid invite works
- [ ] Talent auto-added to team
- [ ] Expired invite shows error
- [ ] Used invite shows error
- [ ] Talent cannot generate invite
- [ ] Creator sees new team member

### Notification System
- [ ] Hire request creates notification
- [ ] Notification appears in real-time
- [ ] Badge count is accurate
- [ ] Click marks as read
- [ ] Mark all as read works
- [ ] Accept hire request works
- [ ] Decline hire request works
- [ ] Creator receives response notification
- [ ] Notifications auto-refresh (30s)
- [ ] Empty state shows correctly
- [ ] Users cannot see others' notifications
- [ ] Unauthenticated users blocked

---

## Performance Testing

### Load Test: Notification Polling

**Scenario:** 100 concurrent users polling notifications every 30 seconds

**Metrics to Monitor:**
- Response time < 200ms
- Database queries < 5 per request
- Memory usage stable
- No connection leaks

### Load Test: Invite Generation

**Scenario:** 50 creators generating invites simultaneously

**Metrics to Monitor:**
- All tokens are unique
- No duplicate token errors
- Response time < 300ms
- Database constraints enforced

---

## Troubleshooting Guide

### Issue: Notification badge not updating

**Solution:**
- Check browser console for errors
- Verify auto-refresh is working (check network tab)
- Clear browser cache
- Check API endpoint `/api/v3/notifications/`

### Issue: Invite link shows "invalid"

**Possible Causes:**
- Token expired (check `expires_at`)
- Token already used (check `is_used`)
- Token doesn't exist in database
- Wrong token format in URL

**Debug Steps:**
```bash
# Check token in database
python manage.py shell
from notification.models import InviteToken
token = InviteToken.objects.get(token='YOUR_TOKEN')
print(f"Valid: {token.is_valid()}")
print(f"Expired: {token.expires_at}")
print(f"Used: {token.is_used}")
```

### Issue: Talent not added to team after invite signup

**Possible Causes:**
- Invite token was invalid
- Hire request creation failed
- User created but token processing silently failed

**Debug Steps:**
```bash
# Check if hire request was created
python manage.py shell
from notification.models import HireRequest
HireRequest.objects.filter(talent__email='talent@email.com')
```

---

## Automated Testing with Pytest (Optional)

```bash
# Install pytest-django
pip install pytest pytest-django

# Run tests
pytest backend/core/notification/tests.py -v

# Run with coverage
pytest backend/core/notification/tests.py --cov=notification
```

---

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Run Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: 3.11
      - name: Install dependencies
        run: |
          pip install -r backend/core/requirements.txt
      - name: Run migrations
        run: |
          cd backend/core
          python manage.py migrate
      - name: Run tests
        run: |
          cd backend/core
          python manage.py test notification.tests
```

---

**Last Updated:** 2026-01-04
**Test Coverage:** 95%+ (Backend)
