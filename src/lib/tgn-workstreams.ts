export const workstreams = [
  {
    code: "A", slug: "remote-advisory", name: "Remote Advisory & Project Contribution", action: "Advise & Scale",
    summary: "Contribute specialist expertise remotely to specific ventures and projects.",
    details: "3–6 months · 10–20 hrs/month · remote", audience: "For specialists, mid-career and senior professionals.", terms: "Honorarium negotiated directly via BRQ+.",
    commitment: "3–6 months · 10–20 hrs/month · remote", suited: "Specialists, mid-career and senior professionals", cost: "Honorarium negotiated directly via BRQ+",
    fit: "I have deep expertise and 10–20 hours a month",
    process: ["Work remotely on specific ventures and projects.", "Contribute to fundraising, scaling, governance or market entry.", "Commit 10–20 hours a month over 3–6 months.", "The professional and organisation negotiate the honorarium directly via BRQ+."],
  },
  {
    code: "B", slug: "back2basics", name: "Back2Basics Accelerator for Founders", action: "Build & Multiply",
    summary: "A focused founder cohort supported by corporate sponsors, mentors and domain experts.",
    details: "10-week intensive cohort · Validation → Building → Market Testing → Demo Day", audience: "From idea to S$3K revenue. For young founders and SG corporates seeking an innovation pipeline.", terms: "Corporate sponsorship S$1,500 per session; 250% tax deduction via AMP. Cohort 1 completed July 2026.",
    commitment: "10 weeks · cohorts of 5–10 young founders", suited: "Young founders and SG corporates seeking an innovation pipeline", cost: "Corporate sponsorship S$1,500 per session",
    fit: "I am a founder with a product idea, or a corporate seeking an innovation pipeline",
    process: ["Cohorts of 5–10 young founders work with an SG corporate sponsor, Give Network mentors and domain experts.", "Over 10 weeks: Validation → Building → Market Testing → Demo Day, aiming to move from idea to S$3K revenue.", "Sponsorship is S$1,500 per session, covering venue, trainers, resources and cohort management.", "Cohort 1 ran 13 May – 15 July 2026 and completed in July 2026; founders built products and launched initial sales by Week 8."],
  },
  {
    code: "C", slug: "missions", name: "Trade/Impact Missions & Exploration", action: "Explore & Connect",
    summary: "Explore regional ventures, build partnerships and identify opportunities first-hand.",
    details: "3–5 days · quarterly", audience: "Malaysia · Indonesia · Thailand · Cambodia · Bangladesh", terms: "Co-funded by participants and host organisations.",
    commitment: "3–5 days · quarterly", suited: "Professionals exploring Malaysia, Indonesia, Thailand, Cambodia and Bangladesh", cost: "Co-funded by participants and host organisations",
    fit: "I want to see opportunities first-hand before committing",
    process: ["Join a 3–5 day quarterly mission.", "Explore ventures, build partnerships and identify opportunities.", "Destinations include Malaysia, Indonesia, Thailand, Cambodia and Bangladesh.", "Participants and host organisations co-fund each mission. A recent mission visited Bandung/Garut."],
  },
  {
    code: "D", slug: "immersion", name: "Employment Immersion", action: "Embed & Learn",
    summary: "Work full-time with an SG-registered organisation expanding into the region.",
    details: "6–12 months · full-time", audience: "With an SG-registered organisation expanding into Malaysia or Indonesia.", terms: "Employer hires and compensates; eligible employers may apply for SBF's OMIP grant.",
    commitment: "6–12 months · full-time", suited: "Professionals ready for a regional role in Malaysia or Indonesia", cost: "Employer hires and compensates directly",
    fit: "I am ready for a 6–12 month move into a regional role",
    process: ["Take a 6–12 month full-time role with an SG-registered organisation.", "Work with an NGO, social enterprise or tech firm expanding into Malaysia or Indonesia.", "The employer hires and compensates the professional directly.", "Eligible employers may apply for SBF's Overseas Markets Immersion Programme (OMIP) grant."],
  },
] as const;

export const workstreamLabels: Record<string, string> = Object.fromEntries(workstreams.map(w => [w.code, `Workstream ${w.code} · ${w.code === "A" ? "Remote Advisory" : w.code === "B" ? "Back2Basics Accelerator" : w.code === "C" ? "Trade/Impact Missions" : "Employment Immersion"}`]));