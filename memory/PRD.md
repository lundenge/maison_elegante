# Maison Élégante — PRD (living doc)

## Original problem statement
Build a responsive business management web app that:
- Creates data & produces receipts (paid in advance)
- Extracts data from a photo of any receipt into the DB
- Business services: rent items for parties, organise parties, catering, birthday gift delivery
- 3 roles: super admin, admin, user
- Users can book & pay online OR pay in cash at the office
- Download & share receipts
- Admin sees business evolution via graphics + reports
- Users register with firstName, lastName, phone, address, city, country, continent
- Users log in once and stay logged in
- Admins log in with phone + password
- Requested MySQL — using MySQL for the current implementation

## User choices (Feb 2026)
- DB: MySQL
- Services: rentals, party organization, catering, gift delivery
- Payments: Stripe (Flow A — claimable sandbox) + cash at office
- OCR: AI via Emergent LLM Key (GPT-5.4 vision)
- Auth: JWT (custom) — user-by-phone, admin phone+password
- Admin owner: lundengel@gmail.com

## User personas
- Client: books services online, pays online or offline, downloads receipts
- Admin: manages bookings/receipts/services, sees analytics, scans physical receipts via AI
- Super admin: everything + can create/remove admins and users

## Architecture
- Backend: PHP + MySQL + JWT + bcrypt + Stripe + emergentintegrations LLM
- Frontend: React 19 + React Router 7 + Tailwind + Shadcn UI + Recharts + jsPDF + html2canvas + sonner
- Theme: dual — warm bone-white client site (Playfair Display + Manrope) / midnight admin dashboard

## Implemented (Feb 2026)
- Auth: register, user login (phone-only), admin login (phone+password), JWT persistent
- Services catalog: 4 seeded default services + admin CRUD
- Bookings: create with cash/Stripe, list, mark-paid (admin)
- Payments: Stripe Checkout (Flow A) with tax_mode = calc_only (physical services + Stripe Tax)
- Receipts: auto-issued on booking, downloadable as PDF, shareable via native share/clipboard
- OCR: `/api/receipts/scan` uses GPT-5.4 vision to parse arbitrary receipt photos
- Admin dashboard: analytics (revenue trend, category breakdown, volume bars), bookings, receipts, services, users, scan
- Super admin: create/delete admins

## Backlog (P0/P1)
- P0: Complete flow with real Stripe test-card end-to-end
- P1: Email delivery of receipts (Resend)
- P1: Multi-currency
- P2: Recurring bookings / packages
- P2: SMS reminders (Twilio)

## Test credentials
See /app/memory/test_credentials.md

## Stripe
- Flow A claimable sandbox provisioned. Tax mode selected: **Stripe calculates only (+0.5% per transaction)**.
- Onboarding: https://dashboard.stripe.com/onboard_sandbox/YWNjdF8xVHlwRzlEQ09iR0RKVmNILDE3ODYxNTA3NTAv100Qj6yuU3N
