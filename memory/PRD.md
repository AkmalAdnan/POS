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
