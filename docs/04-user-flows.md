# 04 — User Flows

## 1. Membership application to active member
```mermaid
flowchart TD
  A[Visitor on /membership] --> B{Unsure which plan?}
  B -- Yes --> C[AI plan advisor] --> D
  B -- No --> D[Choose Personal or Corporate]
  D --> E[Application form + plan + cycle]
  E --> F[Submitted - pending]
  F --> G{Admin review}
  G -- Reject --> H[Rejected with reason]
  G -- Approve --> I[Membership + first invoice + invite]
  I --> J[Onboarding: welcome, profile, agreement, setup]
  J --> K[/pay invoice/]
  K -- One-off card --> L[Paid]
  K -- Subscription --> L
  K -- Bank transfer --> M[Admin marks paid] --> L
  L --> N[Active member portal]
```

## 2. Sign in
```mermaid
flowchart LR
  A[Member Login] --> B{Personal or Corporate}
  B --> C[/login/]
  C --> D{Method}
  D --> E[Email + password]
  D --> F[Google]
  D --> G[Magic link]
  E & F & G --> H{Onboarded?}
  H -- No --> I[/onboarding/]
  H -- Yes --> J{Type}
  J -- Personal --> K[/home/]
  J -- Corporate --> L[/company/]
  J -- Admin --> M[/admin/]
```

## 3. Agreement e-signing
```mermaid
flowchart TD
  A[Agreement step] --> B[Read current version]
  B --> C[Consent + name + title + signature]
  C --> D[Server stores immutable record + hash]
  D --> E[PDF in private storage]
  E --> F[Visible in Documents]
  G[Admin publishes new final version] --> H[Re-sign gate on next visit]
```

## 4. Engagement NDA
```mermaid
flowchart TD
  A[Admin creates mission NDA] --> B[Add parties]
  B --> C{Party type}
  C -- Member --> D[Signs in portal]
  C -- External --> E[Single-use link, 14 days]
  D & E --> F{All signed?}
  F -- Yes --> G[Executed PDF; mission docs/chat unlocked]
```

## 5. Subscription lifecycle
```mermaid
stateDiagram-v2
  [*] --> Active
  Active --> Active: Upgrade (pro-rated, immediate)
  Active --> PendingDowngrade: Downgrade
  PendingDowngrade --> Active: At renewal
  Active --> Cancelling: Cancel
  Cancelling --> Ended: Period end
  Active --> Grace: Renewal fails
  Grace --> Active: Payment succeeds
  Grace --> Lapsed: 30 days unpaid
```

## 6. Give Network interest
```mermaid
flowchart LR
  A[/programs/give-network/] --> B[Fit guide or workstream card]
  B --> C[Workstream page A-D]
  C --> D[Register interest - workstream preselected]
  D --> E[Confirmation]
  E --> F[Admin Programs view + CSV]
```

## 7. Corporate team management
```mermaid
flowchart TD
  A[Corporate admin /company/team] --> B{Seats available?}
  B -- Yes --> C[Invite by email] --> D[Invitee onboards] --> E[Joins company]
  B -- No --> F[Upgrade plan]
  A --> G[Remove member]
  A --> H[Transfer admin]
```

## 8. Admin review queue
```mermaid
flowchart LR
  A[/admin KPI tile/] --> B[Filtered queue]
  B --> C[Open application]
  C --> D{Decision}
  D --> E[Approve]
  D --> F[Reject]
  D --> G[Under review]
  E & F & G --> H[Audit trail entry]
```
