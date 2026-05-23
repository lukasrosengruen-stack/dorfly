-- Umbenennung des Feature-Flag-Keys für Abfallkalender.
-- wasteCalendarEnabled wird zu abfallkalender für einheitliche Benennung.
UPDATE gemeinden
SET features = (features - 'wasteCalendarEnabled')
  || jsonb_build_object('abfallkalender', (features->>'wasteCalendarEnabled')::boolean)
WHERE features ? 'wasteCalendarEnabled';
