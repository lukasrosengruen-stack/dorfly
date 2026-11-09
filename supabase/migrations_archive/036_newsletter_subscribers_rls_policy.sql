-- Explizite Deny-All-Policy für newsletter_subscribers.
-- Hintergrund: RLS ist seit 022_newsletter_subscribers.sql aktiviert, aber ohne
-- Policy meldet Supabase Security Advisor eine Warnung ("no policies defined").
-- Zugriff ausschließlich über service_role (bypasses RLS) in API-Routen.
-- Entspricht dem gleichen Muster wie sms_verifications (001_initial_schema.sql).

create policy "newsletter_subscribers_service_only"
  on public.newsletter_subscribers
  for all
  using (false);
