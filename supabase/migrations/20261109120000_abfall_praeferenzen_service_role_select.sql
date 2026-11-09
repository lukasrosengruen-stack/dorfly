-- Der Abfall-Cron (src/app/api/cron/abfall-benachrichtigungen/route.ts) liest die
-- Praeferenzen mit dem Service-Client. Ohne dieses Recht bricht er mit 42501 ab,
-- und es werden keine Abfall-Erinnerungen versendet.
--
-- Die Route schreibt nicht in diese Tabelle, SELECT genuegt daher.

grant select on public.abfallkalender_praeferenzen to service_role;
