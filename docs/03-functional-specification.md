# 03 — Functional Specification

## 1. Architecture
- **Framework:** TanStack Start (React 19, Vite), file-based routes in `src/routes`.
- **Hosting:** Edge (Cloudflare Workers runtime).
- **Backend:** Lovable Cloud (Postgres, auth, storage) with Row Level Security.
- **Server logic:** `createServerFn` modules in `src/lib/*.functions.ts`; privileged helpers in `*.server.ts`.
- **Public endpoints:** `src/routes/api/public/*` (Stripe webhook) — caller verified inside handler.
- **Payments:** Stripe (MYR; test mode in preview).
- **AI:** Lovable AI Gateway for the plan advisor.

## 2. Authentication and roles
- Email/password, Google OAuth, magic link; forgot/reset password.
- Roles in `user_roles`, checked via `has_role` (security definer). Admin checks run server-side (`assertAdmin`).
- `/_authenticated` routes require a session; `OnboardingGuard` sends incomplete members to onboarding.
- Admins can access both admin dashboard and portal.

## 3. Public features
| Feature | Behaviour |
| --- | --- |
| Contact form | Validated; stored as lead; admin view at /admin/leads |
| Programs | /programs index; Collective, Founders, Give Network |
| TGN workstreams | A Remote Advisory, B Back2Basics, C Missions, D Immersion — shared content definition; stored values A/B/C/D |
| TGN interest / RSVP | Validated public forms, rate-limited, calendar download, deep link `?workstream=` preselects |
| Founders application | Validated, server-only write |
| Membership | Personal and Corporate applications with plan step, `src` tracking (event, qr, booth, breakout, web; else web) |
| Plan advisor | Prospect type + goals → recommended plan + cycle via AI; links to preselected application |
| Legal pages | /privacy and /membership/agreement show current version, draft banner when draft |

## 4. Member portal
| Area | Personal | Corporate |
| --- | --- | --- |
| Home | /home | /company |
| Profile | /profile (tabs: details, photo, visibility, Collective) | /company/profile |
| Team | — | /company/team (invite, remove, transfer admin, seat limit) |
| Engagements | /engagements, /mission/:id | /company/engagements |
| Programs | /programs-me | /company/programs |
| Documents | /documents | /company/documents |
| Directory | /directory (Members, Companies, Collective tabs; whole-card links) | same |
| Chat | /chat (DMs) | same |
| Account | /account: email/password change, sessions, notifications, export, deletion request, audit, billing | same + company billing |

Directory is locked while membership payment is overdue. Visibility is enforced server-side.

## 5. Onboarding
Invite (single path via `sendOnboardingInvite`) → /onboarding/welcome → profile → agreement (e-sign) → setup → portal.

## 6. Agreements and NDAs
- `agreement_versions` with `doc_type` (membership, nda, privacy_notice), draft/final status.
- Signing captures consent, name, title, signature pad; server writes immutable record with hash and metadata; PDF stored in private `legal-agreements` bucket, accessed via expiring signed URLs.
- New final version can require re-sign (/agreement/resign gate).
- Engagement NDA per mission: member signing or external single-use token link (/sign/:token, 14 days); gates mission documents/chat; executed PDF when all parties sign.

## 7. Billing
- Plans (3 Personal, 3 Corporate), monthly/annual MYR, SST rate setting (8%).
- Personal: Associate RM30, Professional RM50, Executive RM90 per month (annual 10×).
- Approval with plan → membership + first invoice.
- Pay at /pay/:invoiceId: one-off card checkout or auto-renewing subscription (lookup key `{plan_code}_{cycle}`).
- Webhook → `applyInvoicePayment` / subscription handler; manual bank payments marked by admin.
- Upgrades immediate and pro-rated; downgrades at renewal; cancellation keeps access to period end; failed renewal → 30-day grace then lapse.
- Housekeeping (renewal invoices, overdue) skips subscribed memberships.

## 8. Admin dashboard
| Page | Function |
| --- | --- |
| /admin | KPI tiles linking to filtered queues |
| /admin/applications | Review, approve/reject/reopen, audit trail |
| /admin/onboarding | Invites and progress |
| /admin/users, /admin/members/:id | Member dossiers, create member |
| /admin/companies, /admin/companies/:id | Company dossiers, create company |
| /admin/pricing | Plans, draft badge, SST |
| /admin/billing | Invoices: paid/void/PDF/CSV, plan requests |
| /admin/agreements | Versions, draft/final, highlighting |
| /admin/documents | All signed documents |
| /admin/programs | TGN interest, RSVPs, founders; filters, counts, CSV |
| /admin/missions | Missions and NDAs |
| /admin/leads, /admin/requests | Enquiries and member requests |
| /admin/insights, /admin/announcements | Content |
| /admin/audit | Account audit log |

## 9. Data model (main tables)
`profiles`, `user_roles`, `membership_applications`, `companies`, `company_members`, `collective_applications`, `fractional_executives`, `onboarding_invites`, `agreement_versions`, `legal_agreements`, NDA parties, `missions`, `membership_plans`, `memberships`, `invoices`, TGN interest / RSVP, founder applications, leads, insights, announcements, `account_audit`, `account_deletion_requests`.

## 10. Security
- RLS on every table; public submissions write only through server functions.
- Role and status fields trigger-guarded.
- Admin-only reads for applicant data; own-row reads for audit and deletion requests.
- Private storage for agreements and logos.

## 11. Pending
- Email sender domain (invoice, NDA, signing confirmation emails).
- Bank/DuitNow ID, company address, SST registration.
- Final legal text for agreement and privacy notice.
