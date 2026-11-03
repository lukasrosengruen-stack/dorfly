-- 067: service_role darf Abonnements lesen (zählen).
--
-- Der Bereich „Team“ (src/lib/mitgliedschaft.ts ladeTeam) und die Dashboards
-- zählen Abonnenten mit dem Service-Client, weil die RLS-Policy „Gewerbe sieht
-- Anzahl“ (003) noch auf organisationen.profile_id prüft und hinzugefügte
-- Mitglieder sonst 0 sähen. Ohne SELECT-Grant antwortet PostgREST mit 42501 —
-- der Team-Bereich zeigte deshalb nur „Serverfehler“, die Abonnenten-Statistik
-- der Dashboards stand still auf 0.

grant select on public.verein_abonnements to service_role;
grant select on public.gewerbe_abonnements to service_role;
