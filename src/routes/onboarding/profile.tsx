import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { updateExecutiveProfile } from "@/lib/onboarding.functions";
import { ProgressSteps, StepBackLink } from "@/components/onboarding/ProgressSteps";

export const Route = createFileRoute("/onboarding/profile")({
  head: () => ({ meta: [{ title: "Executive details — BRQ+" }] }),
  component: ProfilePage,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name.").max(200),
  job_title: z.string().trim().min(2, "Please enter your current role.").max(200),
  industry: z.string().trim().min(2, "Please enter your primary industry.").max(200),
  areas_of_expertise: z
    .array(z.string().trim().min(1).max(80))
    .min(1, "Add at least one area of expertise.")
    .max(30, "Maximum 30 areas of expertise."),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  linkedin_url: z
    .string()
    .trim()
    .url("LinkedIn must be a valid URL starting with https://")
    .max(500)
    .optional()
    .or(z.literal("")),
  bio: z.string().trim().max(4000, "Bio must be 4000 characters or fewer.").optional().or(z.literal("")),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof profileSchema>, string>>;

function ProfilePage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [industry, setIndustry] = useState("");
  const [expertise, setExpertise] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [bio, setBio] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setErrors({});

    const areas = expertise
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const parsed = profileSchema.safeParse({
      full_name: fullName,
      job_title: jobTitle,
      industry,
      areas_of_expertise: areas,
      phone,
      linkedin_url: linkedin,
      bio,
    });

    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FieldErrors;
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }

    setLoading(true);
    try {
      await updateExecutiveProfile({
        data: {
          full_name: parsed.data.full_name,
          job_title: parsed.data.job_title,
          industry: parsed.data.industry,
          areas_of_expertise: parsed.data.areas_of_expertise,
          phone: parsed.data.phone || null,
          linkedin_url: parsed.data.linkedin_url || "",
          bio: parsed.data.bio || null,
        },
      });
      navigate({
        to: "/onboarding/agreement",
        replace: true,
        search: (prev: Record<string, unknown>) => prev,
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8">
      <ProgressSteps current="profile" />
      <h2 className="font-display text-xl font-bold text-foreground">Executive profile</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Tell us a little about you. This appears in the member directory.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <Field label="Full name" required value={fullName} onChange={setFullName} error={errors.full_name} maxLength={200} />
        <Field label="Current role / job title" required value={jobTitle} onChange={setJobTitle} error={errors.job_title} maxLength={200} />
        <Field label="Industry" required value={industry} onChange={setIndustry} error={errors.industry} maxLength={200} />
        <Field
          label="Areas of expertise (comma-separated)"
          required
          value={expertise}
          onChange={setExpertise}
          placeholder="Islamic finance, AI payments, RegTech"
          error={errors.areas_of_expertise}
        />
        <Field label="Phone (optional)" value={phone} onChange={setPhone} error={errors.phone} maxLength={40} />
        <Field
          label="LinkedIn URL (optional)"
          value={linkedin}
          onChange={setLinkedin}
          placeholder="https://linkedin.com/in/…"
          error={errors.linkedin_url}
          maxLength={500}
        />
        <div>
          <label htmlFor="ob-bio" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Short bio (optional)
          </label>
          <textarea
            id="ob-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={4000}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{errors.bio ?? ""}</span>
            <span>{bio.length}/4000</span>
          </div>
        </div>

        {serverError ? <p role="alert" className="text-sm text-destructive">{serverError}</p> : null}

        <div className="flex items-center justify-between gap-3">
          <StepBackLink to="/onboarding/setup" label="Back" />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
  error,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
  maxLength?: number;
}) {
  const id = `ob-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="text"
        required={required}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground ${
          error ? "border-destructive" : "border-border"
        }`}
      />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
