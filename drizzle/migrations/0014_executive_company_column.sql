ALTER TABLE public.fractional_executives ADD COLUMN IF NOT EXISTS company text;
UPDATE public.fractional_executives SET company = 'BRQ Plus Sdn. Bhd.' WHERE name = 'Mo Hafidz' AND company IS NULL;
-- Fix visible typo in the public role label
UPDATE public.fractional_executives SET role = 'Chief Executive & Founder' WHERE name = 'Mo Hafidz' AND role = 'Chief Execitive & Founder';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fractional_executives TO authenticated;
GRANT ALL ON public.fractional_executives TO service_role;