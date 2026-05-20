-- Erlaubt authentifizierten Nutzern, öffentliche Profildaten anderer Nutzer zu lesen.
-- Vorher war nur das eigene Profil lesbar (id = auth.uid()), was dazu geführt hat,
-- dass Server Components auf createServiceClient() ausweichen mussten.
--
-- Sicherheitshinweis: Sensible Spalten (phone, email, adresse, geburtsdatum) werden
-- in Abfragen nie mit select('*') gelesen – immer nur explizit gewählte public-Felder.

CREATE POLICY "profiles_public_lesen"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
