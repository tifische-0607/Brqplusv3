# 05 — Sitemap

```mermaid
flowchart TD
  Home[/ Home/] --> Advisory[/advisory/]
  Home --> Programs[/programs/]
  Programs --> Collective[/collective/]
  Programs --> Founders[/programs/founders/]
  Programs --> TGN[/programs/give-network/]
  TGN --> A[remote-advisory]
  TGN --> B[back2basics]
  TGN --> C[missions]
  TGN --> D[immersion]
  Home --> Membership[/membership/]
  Membership --> MP[/membership/personal/]
  Membership --> MC[/membership/corporate/]
  Membership --> MA[/membership/agreement/]
  Home --> Contact[/contact/]
  Home --> Privacy[/privacy/]
  Home --> Login[/login/]
  Login --> Portal[Member portal]
  Login --> Admin[Admin dashboard]
```

## Public
| URL | Page |
| --- | --- |
| / | Home |
| /advisory | BRQ+ Advisory |
| /collective | The Collective @ BRQ+ |
| /programs | Programs index |
| /programs/founders | Founders @ BRQ+ |
| /programs/give-network | The Give Network |
| /programs/give-network/remote-advisory | Workstream A |
| /programs/give-network/back2basics | Workstream B |
| /programs/give-network/missions | Workstream C |
| /programs/give-network/immersion | Workstream D |
| /membership | Membership and pricing |
| /membership/personal | Personal application |
| /membership/corporate | Corporate application |
| /membership/agreement | Membership Agreement |
| /join | Redirects to /membership |
| /contact | Contact |
| /privacy | Privacy Notice |
| /login, /auth, /register | Sign in / sign up |
| /forgot-password, /reset-password | Password recovery |
| /sign/:token | External NDA signing |

## Onboarding
/onboarding → welcome → profile → agreement → setup

## Member portal (signed in)
| URL | Page |
| --- | --- |
| /home | Personal home |
| /profile | My profile |
| /engagements | Engagements |
| /mission/:missionId | Mission workspace |
| /nda/:partyId | Sign NDA |
| /programs-me | My programs |
| /documents | My documents |
| /directory | Directory |
| /directory/companies/:companyId | Company profile |
| /members/:memberId | Member profile |
| /members/exec/:executiveId | Executive profile |
| /chat | Messages |
| /insights, /insights/:slug | Insights |
| /account | Account and billing |
| /pay/:invoiceId | Pay invoice |
| /agreement/resign | Re-sign agreement |
| /company | Corporate home |
| /company/profile, /team, /engagements, /programs, /documents | Corporate sections |
| /dashboard | Redirects to correct home |

## Admin
/admin, /admin/applications, /admin/onboarding, /admin/users, /admin/members/:userId, /admin/companies, /admin/companies/:companyId, /admin/pricing, /admin/billing, /admin/agreements, /admin/documents, /admin/programs, /admin/missions, /admin/leads, /admin/requests, /admin/insights, /admin/announcements, /admin/audit

## API
/api/public/payments/webhook — Stripe webhook (signature verified)
