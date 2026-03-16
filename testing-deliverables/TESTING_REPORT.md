# Testing Team — Iteration 1 Report

---

## Deliverables overview

| File | What it is |
|---|---|
| `spec/appSpec.js` | **Jasmine unit tests** — drop this into the main project's `spec/` folder |
| `features/*.feature` | **Cucumber Gherkin scenarios** — one file per feature area |
| `features/step_definitions/steps.js` | **Step implementations** backed by Puppeteer |
| `tests/puppeteer/e2e.test.js` | **Standalone Puppeteer script** — record this for the 1-min demo |
| `cucumber.js` | Cucumber config (HTML report output) |
| `package.json` | Dev dependencies and npm scripts |

---

## How to run everything

```bash
# 1.  Start the server (main project folder)
node server.js

# 2.  Install testing dependencies (this folder)
npm install

# 3a. Run Cucumber acceptance tests
npm run test:cucumber
#     HTML report → reports/cucumber-report.html

# 3b. Run Puppeteer E2E tests  ← RECORD THIS for the demo video
npm run test:e2e

# 3c. Run everything
npm run test:all

# 4.  Run Jasmine unit tests  (from the main project folder)
npm test
```

---

## Section 5a — Deriving acceptance tests from use cases

Each user story from the requirements team maps directly to a Gherkin **Feature** file.
The derivation process is:

```
User Story
  │
  ▼
Use Cases / Scenarios (happy path + failure cases)
  │
  ▼
Gherkin Feature File  (.feature)
  │
  ▼
Step Definitions  (steps.js — Puppeteer drives a real browser)
  │
  ▼
Pass / Fail verdict per scenario
```

### Mapping table

| User Story | Feature file | Scenarios |
|---|---|---|
| Visitors see a landing page | `landing.feature` | 2 |
| Users can create accounts | `signup.feature` | 3 |
| Users can log in and log out | `login_logout.feature` | 4 |
| Users can submit prompts | `prompt.feature` | 4 |
| Users can bookmark / delete chats | `bookmarks.feature` | 4 |

**Total: 17 acceptance scenarios across 5 feature files.**

### Example derivation — "Users can log in"

```
User story:
  As a registered user I want to log in so I can access my conversations.

Scenarios derived:
  1. Happy path   — valid email + password → redirect to /app
  2. Wrong creds  — invalid password → error message shown
  3. Logout       — click Log Out → redirect to landing
  4. Auth guard   — visiting /app without session → redirect to landing
```

```gherkin
# features/login_logout.feature

Scenario: Successful login with valid credentials
  Given a registered user exists with email "user@example.com" and password "pass123"
  When I am on the landing page
  And I fill in login email with "user@example.com"
  And I fill in login password with "pass123"
  And I click the Log In button
  Then I should be on the app page

Scenario: Login with wrong password
  Given a registered user exists with email "user2@example.com" and password "correct"
  When I am on the landing page
  And I fill in login email with "user2@example.com"
  And I fill in login password with "wrong"
  And I click the Log In button
  Then I should see the auth error "Invalid email or password."
```

---

## Section 5b — How Jasmine test suites are designed

The unit tests live in `spec/appSpec.js` (Jasmine config points to `spec/` per `jasmine.mjs`).

### Design principles

- **One `describe()` block per exported function** — keeps failures easy to locate.
- **Happy path first, edge cases after** — mirrors the order the dev team builds features.
- **No mocking** — `server.js` uses in-memory arrays, so the real functions are called directly.
- **Each `it()` tests exactly one thing** — label is a complete sentence that reads as a requirement.

### Suite breakdown

| `describe()` block | `it()` tests | What is covered |
|---|---|---|
| `shortenResponse` | 5 | Truncation, no-op when short, exact limit, single word, extra spaces |
| `createConversation` | 12 | Return shape, prompt storage, response, bookmarked default, id, createdAt, incrementing ids, userId, title truncation, shorten flag |
| `bookmarkConversation` | 4 | Sets flag, returns full object, wrong id, wrong userId |
| `deleteConversationById` | 4 | Removes and returns item, wrong id, wrong userId, unfindable after delete |

**Total: 25 unit tests.**

### Key fix vs. the original spec

The original `appSpec.js` called `bookmarkConversation(id)` and `deleteConversationById(id)` without a `userId`. The `server.js` implementations require a `userId` parameter (they check `c.userId === userId`). Without it the functions always return `null`. The updated spec passes `TEST_USER_ID = 1` consistently.

---

## Section 5c — Use case → unit tests → acceptance tests

### Use Case: Submit a Prompt

```
Unit tests (spec/appSpec.js)
  ✅ createConversation() returns a defined object
  ✅ stores the correct prompt
  ✅ generates a non-empty response
  ✅ sets bookmarked: false
  ✅ assigns a numeric id
  ✅ when shorten=true, response word count ≤ 200

          ↓ unit tests pass ↓

Acceptance test (features/prompt.feature)
  Scenario: Submit a valid prompt
    Given I am logged in and on the app page
    When  I type "How do I study for an exam?" into the prompt box
    And   I click the Send button
    Then  a response card should appear on the page
    And   the response card should contain study-related content
```

### Use Case: Delete a Conversation

```
Unit tests
  ✅ deleteConversationById() removes item and returns it
  ✅ returns null for nonexistent id
  ✅ returns null when userId does not match
  ✅ item is unfindable after deletion

          ↓ unit tests pass ↓

Acceptance test (features/bookmarks.feature)
  Scenario: Delete a conversation and confirm
    Given I am logged in with an existing conversation
    When  I click the Delete button for that conversation
    And   I confirm the confirmation dialog
    Then  the conversation should no longer appear in the Chats sidebar
```

### Use Case: Bookmark a Conversation

```
Unit tests
  ✅ bookmarkConversation() sets bookmarked: true
  ✅ returns the full conversation object
  ✅ returns null for wrong id
  ✅ returns null when userId does not match

          ↓ unit tests pass ↓

Acceptance test (features/bookmarks.feature)
  Scenario: Bookmark a conversation
    Given I am logged in with an existing conversation
    When  I click the Bookmark button on the response card
    Then  the conversation should appear in the Bookmarked Chats sidebar
```

---

## Puppeteer E2E — Suites (for the 1-min demo)

`tests/puppeteer/e2e.test.js` contains **14 suites, 20 individual checks**:

| Suite | Checks |
|---|---|
| 1. Landing Page | h1 text, signup button, login button |
| 2. Successful Sign Up | Redirect to index.html, username shown |
| 3. Login | Error message if incorrect credentials or redirect if correct |


**Recording tip:** open two terminal windows side by side — one running `node server.js`, one running `node tests/puppeteer/e2e.test.js`. OBS Studio (free) can capture both. The run takes under 60 seconds.

---

## GitHub Issues — workflow for the testing team

### Labels to create in the repo

| Label | Colour | Purpose |
|---|---|---|
| `bug` | `#d73a4a` (red) | Defect found during testing |
| `test-failing` | `#e4780c` (orange) | Existing test that now fails |
| `acceptance-test` | `#0075ca` (blue) | New Cucumber scenario needed |
| `blocked` | `#cfd3d7` (grey) | Waiting on another team |
| `fixed-needs-verify` | `#0e8a16` (green) | Dev says fixed; testing must confirm |

### Bug report template

```
Title: [BUG] <short description>

**Feature:** (e.g. Login, Bookmark)
**Failing test:** (Cucumber scenario title OR Puppeteer suite name)
**Steps to reproduce:**
  1. …
  2. …
**Expected:** …
**Actual:** …
**Environment:** Node vX.X, Chrome headless
**Logs / screenshot:** (attach)
```

### Acceptance-test request template

```
Title: [TEST] Add scenario for <feature/case>

**User story:** As a [role] I want [goal] so that [reason]
**Gherkin scenario:**
  Given …
  When  …
  Then  …
**Priority:** High / Medium / Low
```

### Workflow

```
Testing finds issue
       │
       ▼
Open GitHub Issue (bug or test-failing label)
       │
       ▼
Assign to responsible developer
       │
       ▼
Developer fixes code + unit tests, references issue in commit
       │
       ▼
Testing re-runs Puppeteer + Cucumber → adds comment with result
       │
       ▼
Issue closed (or re-opened if still failing)
```
