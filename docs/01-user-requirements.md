# 01 — User Requirements

## 1. Product overview
BRQ+ is a premium, invitation-only fractional advisory collective focused on Islamic finance, AI payments, digital inclusion and enterprise transformation across Asia and the Middle East. The platform has three layers:

1. **Public website** — brand storefront for BRQ+ Advisory, The Collective @ BRQ+, Programs and Membership.
2. **Member portal** — private area for Personal and Corporate members.
3. **Admin dashboard** — operations console for BRQ+ staff.

## 2. Audiences
| Persona | Description | Primary goals |
| --- | --- | --- |
| Prospective client | Enterprise, regulator, fintech leader | Understand advisory offer, make contact |
| Prospective member (Personal) | Professional / executive | Pick a plan, apply, pay, join directory |
| Prospective member (Corporate) | Company joining with a team | Apply, invite team, manage seats and billing |
| Founder | Early-stage founder | Apply to Founders @ BRQ+ |
| Give Network participant / sponsor | Volunteer, mentor, sponsor | Register interest in a TGN workstream, RSVP to events |
| Collective executive | Veteran operator | Apply to The Collective, work on missions |
| Personal member | Approved individual | Profile, documents, engagements, billing |
| Corporate admin | Company owner in portal | Company profile, team, seats, billing |
| BRQ+ admin | Staff | Review applications, manage members, billing, content |

## 3. User stories (key)
### Public
- As a visitor I can read about Advisory, The Collective, Programs and Membership without signing in.
- As a visitor I can submit a contact enquiry with name, email, industry and project mission.
- As a prospect I can describe my goals and receive an AI plan recommendation (guidance only).
- As a prospect I can compare six membership plans (monthly/annual, MYR) and apply with a plan preselected.
- As an event attendee I can scan a QR code and the application records the source (event, qr, booth, breakout, web).
- As a founder I can apply to Founders @ BRQ+.
- As a TGN participant I can explore four workstreams and register interest with the workstream preselected.
- As a visitor I can read the Privacy Notice and the Membership Agreement.

### Members
- As a member I can sign in with email/password, Google, or magic link, and reset my password.
- As a new member I complete onboarding: welcome, profile, sign Membership Agreement, setup.
- As a member I can edit my dossier, photo and visibility, and view the directory of other members.
- As a member I can view and download signed documents and sign Engagement NDAs.
- As a member I can view invoices and pay by card (one-off) or start an auto-renewing subscription.
- As a member I can change email/password, review sessions, export data and request account deletion.
- As a corporate admin I can invite and remove team members within the seat limit and transfer admin.

### Admins
- As an admin I see clickable KPI tiles leading to filtered work queues.
- As an admin I approve, reject, review or reopen applications with an audit trail.
- As an admin I create companies and member profiles directly.
- As an admin I manage plans, pricing, SST rate, invoices and plan requests.
- As an admin I manage agreement versions (draft/final), NDAs, documents, insights, announcements, missions, programs data and leads, with CSV exports.

## 4. Non-functional requirements
- Dark, minimal, authoritative design; consistent gold/cyan accents.
- All user-facing text says "BRQ+" (header/footer logo keeps its own mark).
- No invented statistics, testimonials, client logos or photos.
- Mobile-first responsive; WCAG-minded keyboard and screen-reader support; 44px touch targets.
- Applicant and member data readable only by admins or the owner; writes go through validated server functions.
- Signed agreements are immutable and tamper-evident (hash + server metadata).
- SEO metadata per page.

## 5. Constraints and open items
- Bank/DuitNow ID, company address, SST registration **[To confirm]**.
- Email sender domain not yet configured — invoice and NDA emails pending.
- Membership Agreement and Privacy Notice are working drafts with legal placeholders.
