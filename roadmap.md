# Programs launch
- [x] Add public Programs pages, both program cards, grouped navigation, Collective breadcrumb, and homepage strip.
- [x] Create secure TGN interest and RSVP storage and submission functions.
- [x] Add interactive TGN page, validated forms, confirmations, calendar download, and deep links.
- [x] Add admin Programs data view, filters, counts, CSV exports, and navigation.
- [x] Verify routes, forms, access control, and mobile display.

# Founders @ BRQ+
- [x] Add third program to index, navigation, footer, and homepage.
- [x] Build Founders page and public validated application with secure storage.
- [x] Add founder submissions to admin Programs with filters, counts, and CSV.
- [x] Verify routes, form validation, signed-out access control, and mobile layout.

# Give Network workstreams
- [x] Confirm BRQ+ text across Programs, preserving the header/footer logos.
- [x] Add four linked workstream pages and grouped navigation.
- [x] Preselect workstream interest while preserving source tracking; update admin labels.
- [x] Verify pages, links, form selection and mobile layout.

# BRQ+ Membership
- [x] Schema: membership applications, companies, company members, admin notes, profile dossier fields, logo storage.
- [x] Public /membership, personal and corporate applications; /join redirect; header/footer/register links.
- [x] Admin inbox (Personal/Corporate/Legacy), approve/reject/review, dossiers, companies, KPIs, CSV exports.
- [x] Member portal: dossier profile, company page with invites/removal/admin transfer, dashboard badge, directory tabs.
- [ ] Set SITE_URL so invite links work from the preview (blocked: user decision).

- [x] BRQ+ Membership Agreement e-signing (versions, signing, PDF, re-sign gating, admin coverage)
- [ ] Signing confirmation email — blocked: no email sender domain configured

# Agreement drafts, Engagement NDAs, dossier documents
- [x] Draft/final status, draft banners, Mark as final, [To confirm] highlighting, signed-on-draft tracking
- [x] Engagement NDA per mission: create, parties, member + link signing, gate on documents/chat, executed PDF
- [x] Documents sections in personal, company and admin dossiers; admin Documents page
- [ ] Email NDA signing links / executed PDFs — blocked: no email sender domain configured

# Member portal redesign
- [x] Portal shell: sidebar / mobile tabs, documents bell, avatar menu; personal vs corporate navigation
- [x] Personal: /home, /engagements, /programs-me, /documents, tabbed /profile (photo, visibility, Collective)
- [x] Corporate: /company home, profile, team, engagements, programs, documents
- [x] /account: email change, password change/set with re-verification, sessions, notifications, data export, deletion request, audit
- [ ] Signed-in end-to-end browser test as personal and corporate members — blocked: no onboarded personal/corporate test users exist

# Member portal accessibility
- [x] Add visible focus states, distinct navigation labels, current-page states and 44px mobile targets.
- [x] Add keyboard-operated profile tabs, accessible form controls, live result announcements and descriptive document/program links.
- [ ] Signed-in screen-reader and keyboard browser test — blocked: no onboarded personal/corporate test users exist.

## Directory: Collective members in Members tab
- [x] Members tab lists personal+corporate+collective, gold badge, type filter, counts; admin users type=personal includes collective

# Paid membership tiers (invoice billing)
- [x] Plans table + /admin/pricing (draft badge, SST rate); public pricing section; plan step on both application forms
- [x] Approval with plan → membership + first invoice; /admin/billing (paid/void/PDF/CSV, plan requests); KPI tiles; renewals/overdue on admin load
- [x] Member Membership & Billing on /account and /company, payment banner, directory lock, seat limit; dossier panels; agreement 2.5 Fees
- [ ] Bank/DuitNow details, company address, SST registration — blocked: user to supply
- [ ] Emailing invoices automatically — blocked: no email sender domain configured
- [ ] Signed-in admin browser check of /admin/pricing and /admin/billing — blocked: available test session is not an admin

# Subscriptions
- [x] Plans as Stripe products; choose one-off or auto-renew on /pay; upgrades pro-rated, downgrades at renewal; cancel keeps access to period end; 30-day grace on failed renewal

# Admin create
- [x] Admins can create companies and member profiles (invite) from admin pages.
- [x] Personal plans set to RM30/50/90 monthly (RM300/500/900 annual).

# Portal legal documents
- [x] Add versioned Terms of Service working draft and public print-friendly page.
- [x] Present the existing Privacy Notice draft as the Privacy Policy and retain the Membership Agreement page.
- [x] Link all three documents from Personal and Corporate portal navigation, document pages, account privacy controls and the site footer.
- [x] Extend the admin Agreements editor for Terms of Service and Privacy Policy versions.
