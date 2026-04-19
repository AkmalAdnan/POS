# Spice Route POS — PRD (living document)

## Original problem statement
Restaurant POS web app that takes orders, prints KOT + bills (CGST/SGST), sends order to kitchen, exports daily CSV, shows profit/spent/loss pie chart, and supports multi-role sign-in.

## Personas
- Owner — dashboard, reports, CSV export, staff & table management, menu, inventory, settings, geofence/IP config
- Captain / Steward — tables grid, take orders at tables, preview KOT, send/resend KOTs, edit/swap items
- Chef — Kitchen Display, mark items ready/served/cancelled; Orders tab (running/closed/cancelled)
- Cashier — Collect Cash/UPI/Card payments (In Progress → Completed); Today's Totals + Close Day
- Customer — browse menu + place pickup order

## Implemented
### Iteration 1 (Feb 2026)
- JWT auth, owner/staff/customer roles, Dashboard, Menu, Orders, Expenses, Settings, KOT/Bill print.

### Iteration 2 (Feb 2026)
- Roles redesigned → owner/captain/chef/cashier/customer.
- Bills replaces orders (items with kot_batch, sent_to_kitchen, chef_status, department, notes, payment).
- Tables (12 seeded), Inventory (manual), per-department KOT (Main Kitchen / Chinese Counter / Sweets / Beverage).
- Geofence + IP whitelist (owner configures in Settings; captures from AccessGuard on frontend).
- Cashier RED/GREEN payment cards with method.

### Iteration 3 (Feb 2026)
- Owner: Staff & Permissions (RBAC CRUD) replacing Expenses; 16 tables with sort_order.
- Captain: customer dialog (name+mobile+notes) on new bill; "All" tab preselected + cross-category search; Running Orders / All Orders / Orders Closed tabs; Inventory removed from captain nav.
- Chef: "served" status with ready_at/served_at timestamps; new Orders tab.
- Cashier: In Progress / Completed / Cancelled / Today's Totals tabs; Close Day button exports CSV.

### Iteration 4 (Feb 2026)
- Dine-In vs Takeaway order flows: BillCreate accepts `order_type`, takeaway bills have `table_name="TAKEAWAY"` and no table_id; shared NewOrderDialog used by captain/cashier; GET /api/bills supports `order_type` filter; Owner nav exposes /orders/takeaway.
- PWA: manifest.json, pwa-icon.svg + PNGs, service-worker.js (cache-first app shell, network-first API GETs, IndexedDB queue for offline POST/PUT/DELETE to /api/ with Background Sync tag `spice-flush` + `online` event flush).
- Offline UX: new `useOnlineStatus` hook + sticky amber offline banner in AppShell; axios response interceptor converts SW's 202 `{queued:true}` into a typed rejection (`err.offlineQueued`) so NewOrderDialog shows a "queued" toast instead of crashing.
- Testing: iteration_3.json passed 10/10 backend + frontend smoke (Dine-In/Takeaway + PWA verified).

### Iteration 5 — Backend refactor (Feb 2026)
- `server.py` (1009 lines) → 43-line entrypoint. Modular layout:
  - `core/` — `config.py` (env + constants), `db.py` (Motor client), `security.py` (auth deps, JWT, hashing), `utils.py` (iso/ip/haversine).
  - `models/schemas.py` — all Pydantic request models.
  - `routes/` — `auth`, `settings`, `menu`, `tables`, `inventory`, `staff`, `cashier`, `bills`, `guard`, `expenses`, `analytics` (each ≤ 270 lines).
  - `seed.py` — startup seeding (users, menu, tables, inventory).
- All `/api/*` paths unchanged; 10/10 regression tests (`test_takeaway_dinein.py`) pass post-refactor.

### Iteration 6 — Role workflow upgrades (Feb 2026)
- **Captain/Cashier nav**: new `NewOrderButton` (shadcn `DropdownMenu`) — prominent "New Order ▾" in the top nav with Dine-In / Take-Away picks that open `NewOrderDialog` with `defaultType` pre-filled (skips the type-picker step). Menu screen in the subsequent bill page already supports All-preselected + cross-category search + preview/confirm; KOT print already labels Dine-In/Take-away.
- **Cashier permissions**: granted on `POST /bills/{id}/items`, `PUT /bills/{id}/items/{item_id}`, `DELETE /bills/{id}/items/{item_id}`, `POST /bills/{id}/send-kot`, `POST /bills/{id}/cancel`. Cashier can now place/manage orders end-to-end (verified: no more 403 Insufficient permissions).
- **Chef KDS**: new top-level **"🥡 Take-away"** tab alongside Live KDS and Orders. Reusable `KDSCardGrid` component renders all takeaway KOT batches with the same ready/cancel/serve controls as Live KDS.
- **Captain Bill dialog labels**: preview + payment dialogs show "🥡 Take-away" instead of "Table TAKEAWAY" when the bill is a parcel.

## Backend endpoints (`/api`)
- Auth: /auth/login, /register, /me, /logout
- Menu: /menu CRUD (owner)
- Tables: /tables CRUD (owner)
- Staff: /staff CRUD (owner, manages captain/chef/cashier only)
- Bills: /bills CRUD, /items, /send-kot, /chef status, /payment, /cancel
- Inventory: /inventory CRUD
- Guard: /guard/check (GPS + IP)
- Analytics: /analytics/summary, /analytics/export (CSV)
- Cashier: /cashier/totals, /cashier/close-day
- Settings: /settings (tax, geofence, IP whitelist)

## P1 backlog
- Auto-deplete inventory from menu BOM
- SMS/WhatsApp payment receipt (Twilio/Meta)
- Customer mobile-OTP login for loyalty
- Reservation / table booking
- Multi-branch support

## Test credentials
See `/app/memory/test_credentials.md`.
