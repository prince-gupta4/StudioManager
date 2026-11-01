# ReelManager — application guide

> Extended application, data-model, API, and workflow reference. The concise setup overview is in [README.md](./README.md); implementation gaps and validation status are in [PROGRESS.md](./PROGRESS.md).

## 1. What the application does

ReelManager is an internal workspace for a video-production and social-marketing agency. It connects client records, service pricing, quotations, contracts, billing cycles, projects, reels, assigned production work, media files, reviews, publishing records, invoices, payments, expenses, team access, calendar events, and reports.

The current system is a working product foundation, not a fully finished commercial release. For example, staff can record an approval decision and publishing date, but the app does not connect to social networks or provide a client portal. Outstanding requirements are listed in [PROGRESS.md](./PROGRESS.md).

## 2. Technology and repository layout

| Area | Location | Responsibility |
|---|---|---|
| Browser application | `frontend/` | Next.js App Router, React, JSX, client-side forms, navigation, theme |
| HTTP API | `backend/src/app.js` | Express setup, middleware, API route mounting, error handling |
| Database | MongoDB via Mongoose | Persisted records and model relationships |
| API route handlers | `backend/src/routes/` | Validation, permission checks, business rules and database access |
| Mongoose schemas | `backend/src/models/` | Stored document shapes and references |
| Shared backend utilities | `backend/src/utils/` | Financial calculations, HTTP errors and document numbers |
| File storage | `backend/src/storage/` | Local disk and ImageKit provider implementations |
| Styling | `frontend/src/app/globals.css` | Responsive layouts, dialogs, tables and light/dark theme |

The frontend and backend are independent npm projects with independent `node_modules` and lockfiles. There is deliberately no root workspace and no `concurrently` script. JavaScript and JSX are used; application source is not TypeScript.

The API sets `Cross-Origin-Resource-Policy: same-site` so authenticated media can be displayed by the frontend when the two services use the same site (for example, `localhost:3000` and `localhost:4000`). Keep the hostname consistent between `FRONTEND_URL` and `NEXT_PUBLIC_API_URL`; do not mix `localhost` and `127.0.0.1`. The policy is intentionally not set to `cross-origin`.

### Package scripts

Run commands in the relevant package folder:

| Package | Command | Purpose |
|---|---|---|
| `backend` | `npm run dev` | Start Express with nodemon |
| `backend` | `npm start` | Start Express normally |
| `backend` | `npm run build` | Parse/check backend JavaScript syntax |
| `backend` | `npm test` | Run Node's built-in test runner |
| `backend` | `npm run create-admin` | Create the initial Owner account |
| `backend` | `npm run seed-roles` | Insert/update built-in role permissions |
| `frontend` | `npm run dev` | Start Next.js on port 3000 |
| `frontend` | `npm run build` | Create a production Next.js build |
| `frontend` | `npm start` | Serve the Next.js production build |
| `frontend` | `npm test` | Test API response caching and request deduplication |

## 3. Local setup

### Requirements

- Node.js 20.9 or later and npm
- MongoDB (local service or hosted URI)

### Environment

Copy `.env.example` to the project root as `.env`, or place a backend environment file at `backend/.env`. The root `.env` takes precedence. Set at least:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/reelmanager
SESSION_SECRET=replace-this-with-a-private-random-secret-of-at-least-32-characters
API_PORT=4000
FRONTEND_URL=http://localhost:3000
STORAGE_LOCAL=1
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=./storage
UPLOAD_MAX_BYTES=536870912
```

`STORAGE_LOCAL` and `STORAGE_PROVIDER` must agree. For ImageKit, use `STORAGE_LOCAL=0`, `STORAGE_PROVIDER=imagekit`, and configure `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, and `IMAGEKIT_URL_ENDPOINT` in the backend environment. Keep secrets server-side; never add them to frontend environment variables or source control.

To use a different backend URL in the browser, set `NEXT_PUBLIC_API_URL` in `frontend/.env.local`; the default is `http://localhost:4000`.

### Install, start, create the first user

Use separate PowerShell terminals from the project directory:

```powershell
Set-Location .\backend
npm install
npm run dev
```

```powershell
Set-Location .\frontend
npm install
npm run dev
```

The browser app is at `http://localhost:3000`; the API is at `http://localhost:4000`. Create the first Owner in the backend terminal:

```powershell
$env:ADMIN_NAME = "Workspace Owner"
$env:ADMIN_EMAIL = "owner@example.com"
$env:ADMIN_PASSWORD = "use-a-unique-password-of-at-least-12-characters"
npm run create-admin
```

The administrator password is hashed using bcrypt before it is stored. The app does not make a default account.

## 4. Data models

MongoDB stores Mongoose documents. IDs are MongoDB ObjectIds unless noted. References listed below are model relationships; not every relation is populated on every API response.

| Model | Main data and relationships |
|---|---|
| `Client` | Client/business profile, type/status, contact entries, email/phone, web/billing information, GSTIN/PAN, source/tags/notes, archival timestamp |
| `Service` | Reusable service catalogue: name/category/unit, default rate in paise, billing type, tax basis points and active flag |
| `Role` | Unique built-in or custom role and permission-name array |
| `User` | Name, unique email, bcrypt password hash, role reference, active state and last-login date |
| `Quotation` | Client, quote number, dates/status, priced line items, totals and creator; an accepted quote can be converted to a draft contract |
| `Contract` | Client, contract number/title/term/status, billing terms, notes and service lines; prices are integer paise and tax is basis points |
| `BillingCycle` | Contract/client period with a snapshot of service rates and quantities; links to the generated invoice |
| `Project` | Client, optional contract, name, description, lifecycle status and dates |
| `Reel` | Unique reel ID, client/project/contract/cycle references, production requirements, assignments, key dates, status and revision count |
| `ProductionTask` | Reel, task kind/title, optional assignee, start/deadline, priority/status and time/instruction fields |
| `MediaAsset` | Client/project/reel references, category, provider, storage key/provider ID, original filename, MIME type and byte size |
| `ReelVersion` | Reel, associated draft/final media asset, version number, notes and uploader |
| `Revision` | Reel/version, internal or client source, reason/status, requester and resolution date |
| `Approval` | Reel/version, approved/rejected decision, feedback, decision date and staff recorder |
| `PublishingRecord` | Reel, optional platform/account, scheduled/published dates, external URL and notes |
| `Invoice` | Client/contract/cycle, number, dates/status, line-item snapshot, totals/paid/due amounts in paise and creator |
| `Payment` | Invoice, amount in paise, date, method/reference/notes and recorder |
| `Expense` | Amount in paise, category/date/payment method, optional client/project, notes and archival timestamp |

Important value conventions:

- Monetary amounts are integer **paise** (`₹1.00 = 100` paise), not floating-point rupees.
- Tax rates use integer **basis points** (`18% = 1800` basis points).
- API date inputs are ISO-8601 strings; query filters use ISO date strings where indicated.
- Production task status: `todo`, `in_progress`, `blocked`, `completed`, `cancelled`.
- Reel lifecycle includes planning, shooting, editing, review, delivery, marketing, publishing, completion, hold, and cancellation states.
- Contract/billing-cycle quantity snapshots preserve historical rates rather than silently changing when the contract is edited.

### Relationships at a glance

```text
Client ──< Quotation
Client ──< Contract ──< BillingCycle ──0..1 Invoice ──< Payment
Client ──< Project ──< Reel ──< ProductionTask
                         ├──< ReelVersion ──> MediaAsset
                         ├──< Revision
                         ├──< Approval
                         └──< PublishingRecord
Client ──< MediaAsset
Client/Project ──< Expense
User ──> Role
```

## 5. HTTP API reference

All API paths are prefixed with `/api`. Except for health and login, endpoints require the HTTP-only `session` cookie. The browser API helper sends credentials. The backend checks permission names on each protected route; hiding a navigation link does not replace server authorization.

### Authentication and health

| Method and path | Permission | Purpose / important input |
|---|---|---|
| `GET /api/health` | Public | Health response `{ "status": "ok" }` |
| `POST /api/auth/login` | Public, rate-limited | JSON `{ "email": "...", "password": "..." }`; sets session cookie |
| `POST /api/auth/logout` | Session endpoint | Clears the session cookie |
| `GET /api/auth/me` | Authenticated | Current user and role permissions |
| `POST /api/auth/change-password` | Authenticated | JSON `{ "currentPassword": "...", "newPassword": "..." }`; new password is at least 12 characters |

Password reset email and invitation email flows are not implemented.

### Clients and services

| Method and path | Permission | Purpose / parameters |
|---|---|---|
| `GET /api/clients` | `clients:read` | `page`, `limit` (maximum 100), `status`, `search` |
| `POST /api/clients` | `clients:write` | Create client; accepts `name`, `type`, `status`, `contacts[]`, email/phone, website, billing address, GSTIN/PAN, source/tags/notes |
| `GET /api/clients/:id` | `clients:read` | Read one non-archived client |
| `PATCH /api/clients/:id` | `clients:write` | Partially update client fields |
| `DELETE /api/clients/:id` | `clients:write` | Archive client (soft delete) |
| `GET /api/services` | `services:read` | List service catalogue |
| `POST /api/services` | `services:write` | Create service; `defaultRatePaise`, `billingType`, `unit`, optional `taxRateBasisPoints` |
| `PATCH /api/services/:id` | `services:write` | Partially update service |

Client list query example: `/api/clients?page=1&limit=20&status=active&search=studio`.

### Quotations, contracts and billing cycles

| Method and path | Permission | Purpose / parameters |
|---|---|---|
| `GET /api/quotations` | `finance:read` | List quotes; supports pagination/status/client filtering |
| `POST /api/quotations` | `finance:write` | Create quote for a client with dates and priced line items |
| `GET /api/quotations/:id/pdf` | `finance:read` | Download a quotation PDF |
| `PATCH /api/quotations/:id/status` | `finance:write` | Change quote status (draft/sent/accepted/rejected/expired) |
| `POST /api/quotations/:id/convert` | `finance:write` | Convert accepted quote to a draft contract |
| `GET /api/contracts` | `contracts:read` | List contracts; `page`, `limit`, `status`, `client` |
| `POST /api/contracts` | `contracts:write` | Create contract with client, title, dates, terms and `items[]` |
| `PATCH /api/contracts/:id/status` | `contracts:write` | Update contract status |
| `POST /api/contracts/:id/billing-cycles` | `contracts:write` | Open dated cycle; JSON `{ "startDate": "...", "endDate": "..." }` |
| `PATCH /api/contracts/billing-cycles/:cycleId/quantities` | `contracts:write` | Update assigned/completed/approved/delivered/billable/additional quantities per `contractItemId` |
| `GET /api/contracts/billing-cycles` | `contracts:read` | List billing-cycle snapshots |

Contract item values include `service`, `quantity`, `includedQuantity`, `unit`, `ratePaise`, `additionalUnitRatePaise`, `billingFrequency`, `taxRateBasisPoints`, `recurring`, and `billOnCompletion`.

### Projects and production

These endpoints are mounted on `/api` by the production router.

| Method and path | Permission | Purpose / parameters |
|---|---|---|
| `GET /api/contract-options` | `projects:read` | Compact active/draft contract list for project/reel forms |
| `GET /api/projects` | `projects:read` | List; `page`, `limit`, optional `client`, `status` |
| `POST /api/projects` | `projects:write` | Create client project; optional matching client contract and dates |
| `PATCH /api/projects/:id` | `projects:write` | Partially update project |
| `GET /api/reels` | `production:read` | List reels; `page`, `limit`, optional `client`, `project`, `status` |
| `POST /api/reels` | `production:write` | Create reel with client, optional project/contract, footage source, required work, assignments and dates |
| `PATCH /api/reels/:id` | `production:write` | Partially update reel/status; related client/project/contract must match |
| `GET /api/team/assignees` | `production:read` | List active team accounts for production assignment |
| `GET /api/reels/:id/tasks` | `production:read` | List reel tasks |
| `POST /api/reels/:id/tasks` | `production:write` | Create task (`kind`, `title`, optional `assignedTo`, deadline/priority/instructions) |
| `PATCH /api/tasks/:id` | `production:write` | Update task/status/assignee |
| `GET /api/reels/:id/versions` | `production:read` | List uploaded reel versions |
| `POST /api/reels/:id/versions` | `production:write` | Register a draft/final `mediaAsset` ID and notes |
| `GET /api/reels/:id/revisions` | `production:read` | List internal/client revision records |
| `POST /api/reels/:id/revisions` | `production:write` | Create revision `{ "version": "...", "source": "internal|client", "reason": "..." }` |
| `GET /api/reels/:id/approvals` | `production:read` | List decisions |
| `POST /api/reels/:id/approvals` | `production:write` | Record `{ "version": "...", "decision": "approved|rejected", "feedback": "..." }` |
| `GET /api/reels/:id/publishing` | `production:read` | List publishing records |
| `POST /api/reels/:id/publishing` | `production:write` | Record platform/account, scheduled/published date, URL and notes; does not publish to a network |

Pagination responses generally have `{ items, page, limit, total, pages }`. Validation errors are returned as 400 with a generic message and field details.

### Invoices, payments and expenses

| Method and path | Permission | Purpose / parameters |
|---|---|---|
| `GET /api/invoices` | `finance:read` | List; `page`, `limit`, optional `status`, `client` |
| `GET /api/invoices/:id/pdf` | `finance:read` | Download an invoice PDF |
| `POST /api/invoices` | `finance:write` | Create draft invoice: `client`, `issueDate`, `dueDate`, `items[]` |
| `POST /api/invoices/from-cycle` | `finance:write` | Create a draft from an eligible billing-cycle snapshot |
| `PATCH /api/invoices/:id/issue` | `finance:write` | Issue draft invoice |
| `POST /api/invoices/:id/payments` | `finance:write` | Record payment: `amountPaise`, `date`, `method`, optional reference/notes |
| `GET /api/invoices/:id/payments` | `finance:read` | List invoice payments |
| `GET /api/expenses/options` | `expenses:read` | Return active clients/projects for expense form |
| `GET /api/expenses` | `expenses:read` | List expenses; `page`, `limit`, optional `client` |
| `POST /api/expenses` | `expenses:write` | Create expense with `amountPaise`, category/date, optional client/project |
| `GET /api/summary` | `finance:read` | Current-month invoiced, collected, outstanding, overdue and expense totals |

Invoice line items accept optional `service`, description, quantity, unit, `ratePaise`, discount and `taxRateBasisPoints`. The API calculates totals in integer paise; submitted client-side totals are not trusted.

### Media

| Method and path | Permission | Purpose / parameters |
|---|---|---|
| `GET /api/media` | `media:read` | List; `page`, `limit`, optional `client`, `reel`, `category` |
| `POST /api/media` | `media:write` | Multipart form: `file` plus `client`, `category`, optional matching `reel`/`project` IDs |
| `GET /api/media/:id/content` | `media:read` | Authenticated file access |
| `GET /api/media/:id/metadata` | `media:read` | Read safe metadata |
| `DELETE /api/media/:id` | `media:write` | Delete media asset and stored object |

Uploads are size-limited by `UPLOAD_MAX_BYTES`, validated by allowed MIME type and detected file content, and stored by the selected backend provider. Storage keys and provider credentials are not exposed in list metadata.

### Team, calendar, dashboard and analytics

| Method and path | Permission | Purpose / parameters |
|---|---|---|
| `GET /api/team` | `team:read` | List users; `page`, `limit`, optional `active=true|false` |
| `POST /api/team` | `team:write` | Create account with name/email/password/role ID |
| `PATCH /api/team/:id/status` | `team:write` | Activate/deactivate; last active Owner is protected |
| `GET /api/team/roles` | `team:read` | List role catalogue and permission names |
| `POST /api/team/roles` | `team:write` | Create custom role `{ "name": "...", "permissions": [...] }` |
| `PATCH /api/team/roles/:id` | `team:write` | Edit custom role (built-in roles cannot be edited here) |
| `GET /api/dashboard/summary` | `dashboard:read` | Workspace KPI summary |
| `GET /api/calendar` | `dashboard:read` | Agenda; `from`, `to` ISO dates, max one-year range |
| `GET /api/analytics` | `dashboard:read` | `from`, `to` (max five years), optional MongoDB `client` ID |
| `GET /api/analytics/export.csv` | `dashboard:read` plus data permission | `type=invoices|payments|expenses|production`, optional `from`/`to`; finance exports require `finance:read`, production export also requires `production:read`, max 10,000 rows |
| `GET /api/analytics/export.pdf` | `dashboard:read` plus data permission | Same `type` and date parameters as CSV; limited to 2,500 rows |

Analytics returns production statuses, team task workload and (for finance-authorized users) monthly invoiced/collected/expense totals and outstanding receivables. The financial page includes a monthly grouped chart and table. Date-only `to` values include the entire date. Invoice, quotation and analytics CSV/PDF downloads use the authenticated session; the PDF exports are formatted reports rather than editable originals.

### API conventions and errors

- `Content-Type: application/json` for JSON request bodies; media upload is `multipart/form-data`.
- Session authentication uses an HTTP-only `session` cookie; browser calls include credentials.
- Frontend GET API calls share a per-tab in-memory cache for 60 seconds and deduplicate requests while they are in flight. Successful writes and 401 responses clear the cache; failed GET requests are never cached. Call `api(path, { skipCache: true })` for an explicit refresh. This keeps shared data such as `/api/auth/me` from being fetched again on every page transition without storing private responses in browser storage.
- Most successful create operations return HTTP 201 and `{ item }`; list operations return `{ items, ...pagination }`; password/logout actions may return 204.
- 400: input validation/business-rule error; 401: missing/invalid session; 403: missing permission; 404: no matching record; 409: conflict/duplicate; 413: upload/export limit; 500: unexpected server error.
- Never put session secrets, ImageKit private credentials, passwords, or storage provider keys in client-side requests except when a user enters credentials for login/account creation.

## 6. Frontend routes and behavior

Frontend routes are Next.js App Router pages in `frontend/src/app`. Signed-in workspace screens use the shared `AppShell`; the shell calls `/api/auth/me`, filters navigation by the permissions returned by the API, and redirects unauthenticated users to login. API authorization remains on the backend.

| Browser path | Screen and behavior |
|---|---|
| `/login` | Email/password sign-in |
| `/` | Workspace overview and dashboard summary |
| `/clients` | Client directory, search, filters, create/edit/archive |
| `/services` | Service catalogue |
| `/contracts` | Create contracts, change status, open cycles, record quantities |
| `/quotations` | Create/manage quotes, download quote PDFs and convert accepted quotes |
| `/projects` | Client projects and contract association |
| `/production` | Reel list/status and task, version, revision, review, approval and publishing workflows |
| `/media` | Filter, upload, preview/download and delete authorized media |
| `/invoices` | Draft/custom or billing-cycle invoices, issue, download invoice PDFs and record payments |
| `/expenses` | Record and list operating costs |
| `/team` | Create/deactivate accounts and create/edit custom roles |
| `/calendar` | Month navigation over a dated event agenda |
| `/analytics` | Date-filtered operational/financial reports, a monthly chart, and CSV/PDF downloads |
| `/settings` | Change current user's password |

Dialogs and forms are responsive: on narrow viewports paired fields collapse to a vertical layout; line-item controls are stacked rather than widening the dialog. Theme selection is a light/dark toggle in the top bar and is saved to this browser's `localStorage` key `reelmanager-theme`.

The client detail experience, invitations/reset flows, audit/activity feed, notifications and client portal are not represented as finished screens.

## 7. Example end-to-end agency workflow

Example: a studio sells a monthly short-video package to a new business.

1. **Start the server and create the Owner.** The owner signs in at `/login`.
2. **Add a client.** On `/clients`, create “Northstar Cafe” and enter contact/business details. API: `POST /api/clients`.
3. **Set catalogue pricing.** Add a “Short-form edit” service with a default rate in paise. API: `POST /api/services`.
4. **Agree terms.** On `/contracts`, create a client contract with a service line, included quantity, additional rate and term. API: `POST /api/contracts`.
5. **Start the month.** Open a billing cycle for an active contract. API: `POST /api/contracts/:id/billing-cycles`. This stores the rate snapshot for the period.
6. **Create production work.** Add a project, then add reels and set their footage source, planned dates and deadlines. Assign active team accounts to tasks. APIs: `/api/projects`, `/api/reels`, `/api/reels/:id/tasks`.
7. **Upload and review.** Upload a draft/final video in the reel workflow; the media API stores the file and the version API links it to the reel. Record revision requests and approval decisions. The app records workflow history but does not send files to a client portal.
8. **Record period usage.** Enter assigned/completed/approved/delivered and billable quantities on the cycle. The backend checks quantity relationships.
9. **Create and issue the invoice.** Generate a draft from the cycle; review it, then issue it. API: `POST /api/invoices/from-cycle`, then `PATCH /api/invoices/:id/issue`.
10. **Track receipt and costs.** Record partial payments and project expenses. APIs: `POST /api/invoices/:id/payments` and `POST /api/expenses`.
11. **Review operations.** Use `/calendar` for due dates and `/analytics` to review date-filtered totals and download CSV/PDF reports. Download invoice and quotation PDFs from their respective lists when sending them to clients.

Amounts in API examples are paise. For example, ₹12,500.00 is `1250000`.

## 8. Screenshots

Screenshots are intentionally left for future addition. Suggested files:

```text
screenshots/
  dashboard.png
  clients.png
  contracts-create.png
  production-workflow.png
  analytics.png
```

When captured, add images here using relative Markdown links, for example `![Contracts dialog](./screenshots/contracts-create.png)`. Do not place credentials or client personal data in screenshots.

## 9. Development and quality checks

From the project directory:

```powershell
npm --prefix .\backend run build
npm --prefix .\backend test
npm --prefix .\backend audit --omit=dev
npm --prefix .\frontend run build
npm --prefix .\frontend audit --omit=dev
```

The backend's current automated tests cover permission middleware, integer-paise financial calculations and PDF generation. Production builds and syntax checks do not prove workflows against a live MongoDB instance. Full MongoDB integration, browser E2E, concurrency and real storage-provider testing remain necessary before a production deployment.

## 10. Known scope gaps

- Password reset, email invitations, first-login password changes and richer user profiles.
- Complete client contacts/details, brand asset management and client activity history.
- Full requested dashboard KPI/chart/date/client-filter experience.
- Full Indian GST CGST/SGST/IGST and business tax configuration.
- Receipt PDF generation.
- Client review portal, gallery and share-link lifecycle.
- Notifications/reminders, audit log and in-app activity feed.
- Broader client/team profitability analytics and saved reports.
- Phase 3 social CRM models and extension interfaces; no social API integrations or automation are implemented.
- Live database integration tests, complete role-by-role browser testing, production deployment/backup runbooks.

