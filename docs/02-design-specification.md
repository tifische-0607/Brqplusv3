# 02 — Design Specification

## 1. Direction
"Executive Innovation": high-contrast dark mode, restrained motion, gold for authority, cyan for technology.

## 2. Colour tokens
Defined as semantic tokens in `src/styles.css`; components never hardcode colours.

| Token | Value | Use |
| --- | --- | --- |
| Charcoal (background) | `#0F0F0F` | Primary page background |
| Midnight Navy | `#0A1128` | Secondary sections |
| Islamic Gold | `#D4AF37` | Primary CTAs, highlights, badges |
| Digital Cyan | `#00E5FF` | Tech accents, hover states, data |
| Foreground | White / `#E2E8F0` | Headings / body text |
| Muted | Soft gray | Secondary text, marquee items |

A CI script (`scripts/check-no-legacy-colors.mjs`) blocks unapproved colours.

## 3. Typography
- Headings: **Montserrat**, bold, title or uppercase.
- Body: **Inter**, high readability.
- Eyebrows: small uppercase, tracked, gold.

## 4. Layout
- Mobile-first; CSS grid/flex bento layouts.
- Sticky frosted-glass header (backdrop blur).
- Footer: 4 columns (Firm, Programs, Join, Connect) stacking on mobile.
- Portal: sidebar on desktop, tabs on mobile.

## 5. Components
| Component | Notes |
| --- | --- |
| Header | Logo left; Advisory, Programs dropdown (Collective, Founders, Give Network + indented workstreams), Membership, Contact; Member Login dropdown (Personal / Corporate) or "My Portal" when signed in |
| Hero | Animated mesh background, subtle parallax, fade-up on load, gold primary + cyan outline CTAs |
| Bento cards | Dark cards, subtle border glow on hover |
| Executive cards | Hover lift with gold shadow |
| Ummah banner | Full width, gold border |
| Marquee | Infinite loop, muted to white on hover |
| Forms | Segmented, labelled, inline validation, full-width gold submit |
| Plan cards | Six plans, monthly/annual toggle, annual savings |
| QR tiles | SVG QR per membership link, PNG download |
| Draft banner | Shown on draft agreement/privacy versions |
| Dropdowns | Radix, click/tap and keyboard operable |
| WhatsApp FAB | Floating contact button |

## 6. Motion
Framer Motion for reveals and route transitions; honours `prefers-reduced-motion`.

## 7. Accessibility
- Visible focus rings; current-page states; distinct nav labels.
- Keyboard-operable tabs and menus; labelled form controls; live regions for results.
- Minimum 44px touch targets on mobile.
- Alt text on QR codes and images.

## 8. Content rules
- Brand text "BRQ+" everywhere except the logo.
- No invented metrics, testimonials, partner logos or photos.
- Legal placeholders shown as highlighted **[To confirm]**.
