-- Statement-Timeouts der API-Rollen, Werte wie in Produktion (hzptnylfdfibijkgtfhf).
-- Weder db dump (Schema) noch db pull nehmen diese Rolleneinstellungen mit.
--
-- GRANTs: keine noetig, es werden nur Rolleneinstellungen gesetzt.

alter role anon set statement_timeout to '3s';
alter role authenticated set statement_timeout to '8s';
alter role authenticator set statement_timeout to '8s';
