-- Entfernt den FK-Constraint posts_org_id_fkey auf organisationen(id).
--
-- Hintergrund: org_id wird sowohl für Organisations-Posts (organisationen.id)
-- als auch für Vereins-Posts (vereine.id) genutzt. Vereine und Organisationen
-- (z.B. Feuerwehr, Kirche) haben dieselben Rechte, sind aber konzeptuell
-- unterschiedliche Entitäten mit getrennten Tabellen.
-- Der channel-Wert ('verein' vs. 'organisation') gibt den jeweiligen Kontext vor.

alter table public.posts drop constraint if exists posts_org_id_fkey;
