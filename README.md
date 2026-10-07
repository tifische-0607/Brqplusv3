# Remix of BRQ+ Business Impact Advisory v3

Role: Act as an expert frontend engineer and UI/UX designer. Build a premium, high-performance, multi-page website for "BRQ+", a specialist high impact business advisory firm. 

Objective: The platform must project "Executive Innovation," serving as the digital storefront for two distinct arms: BRQ+ Advisory (strategic consulting) and The Collective (an elite, invitation-only execution vanguard focused on business transformation, Islamic finance, and ethical tech).

1. Global Design System & Theme (Tailwind CSS)

- Backgrounds: Use a high-contrast dark mode. Primary background is Deep Charcoal (#0F0F0F). Secondary sections use Midnight Navy (#0A1128).

- Accents: Use "Islamic Gold" (#D4AF37) for primary calls to action, highlights, and elite framing. Use "Digital Cyan" (#00E5FF) for tech-focused accents, hover states, and data visualizations.

- Typography: Import 'Montserrat' for all headers (authoritative, uppercase or title case, bold). Import 'Inter' for body text (clean, highly readable). Text colors should be high-contrast white and soft gray (#E2E8F0) for readability.

- Layout: Perfect mobile-first scaling. Use CSS grid and flexbox for responsive bento layouts. 

2. Component Architecture (Top to Bottom)

A. Navigation Bar

- Style: Sticky frosted-glass header (backdrop-blur).

- Elements: Left-aligned BRQ+ logo (text). Right-aligned links: Advisory, The Collective, Case Studies, Insights, Contact.

- Interaction: Links glow Digital Cyan on hover.

B. Hero Section

- Background: A subtle, slow-moving animated background representing global financial nodes or a dark mesh network.

- Headline (Montserrat): "High Impact Advisory. Veteran Leadership. Impact for the Ummah."

- Sub-text (Inter): "BRQ+ combines 35 years of global fintech practitioner experience with a collective of elite operators dedicated to high-impact financial and digital transformation."

- CTA Buttons: Primary solid gold button ("Deploy The Collective"), Secondary outlined cyan button ("Explore Advisory").

- Animation: Fade up and slide in (using Framer Motion) on load.

C. Core Pillar: Specialist Fintech Advisory

- Title: "The Strategic Foundation"

- Layout: A sleek, 3-column bento-style card grid.

- Cards: 

  1. High-Impact Business Transformation (Cyan accents)

  2. AI-Infused FinTech Innovation (Gold accents)

  3. Regulated Market Entry (Navy/Cyan mix)

- Style: Dark cards with subtle border-glow on hover. Data-driven, minimalist aesthetic.

D. Feature Section: "The Collective @ BRQ+"

- Title: "The Execution Vanguard"

- Context Text: "Where standard advisory ends, execution begins. An invitation-only cadre of veteran operators deployed for large-scale digital inclusion, Islamic finance, and technological innovation across Asia and the Middle East."

- UI: Member gallery carousel or grid. Use high-end, dark-themed profile cards for the experts.

- Interaction: Hover-lift effects on expert cards with a slight gold shadow.

E. The Mission / Ummah Impact Banner

- Layout: Full-width banner bridging the sections. Deep Charcoal background with an Islamic Gold border.

- Copy: Highlight "Impact for the Ummah" in large Montserrat text. Explain the dedication to ethical financial growth, digital inclusion, and community-centric fintech solutions.

F. Social Proof & Impact Marquee

- UI: A minimalist, continuous scrolling logo marquee (infinite loop).

- Content (Text placeholders if logos are unavailable): Aviation, Digital Banking, Remittance, Regulatory Bodies. Text should be muted gray, turning white on hover.

G. Contact & Lead Generation

- Title: "Consult the Collective"

- UI: A modern, multi-step or clearly segmented form. 

- Fields: Full Name, Email, Industry, and a dropdown for "Project Mission" (Options: Enterprise Advisory, BFR Transformation, Ummah Impact / Digital Inclusion).

- Button: Full width Islamic Gold submit button.

3. Technical Requirements

- Use React, Tailwind CSS, and Framer Motion.

- Ensure smooth-scroll behavior for all anchor links.

- Add subtle parallax effects to the Hero background as the user scrolls down.

- Meta/SEO tags: Include title and description optimized for "Fintech Advisory Malaysia," "AI Payments Specialist," and "Ethical Fintech Collective."

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/59853812-11b6-49c8-a4f8-c7e5950a97ce).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
