/**
 * Spalten der oeffentlichen Post-Abfrage auf /posts/[id].
 *
 * Die Seite fragt als anon ab, weil der Empfaenger eines geteilten Links in der
 * Regel nicht eingeloggt ist. Autorendaten kommen deshalb aus der maskierten
 * View profiles_public und NICHT aus profiles: anon hat auf profiles kein
 * SELECT-Recht (Migration 060 haelt das bewusst so), und PostgREST lehnt bei
 * einer gesperrten Relation die gesamte Query mit 42501 ab — die Seite lieferte
 * dann 404 statt des Beitrags.
 *
 * Das Alias `profiles:` haelt den Feldnamen im Ergebnis stabil.
 */
// Als einzelnes Literal mit `as const`: supabase-js leitet die Ergebnistypen aus
// dem Select-String ab, was bei einer zusammengesetzten Zeichenkette verloren ginge.
export const PUBLIC_POST_SELECT =
  'id, titel, inhalt, bild_url, bilder_urls, tag, channel, veranstaltung_datum, veranstaltung_ort, post_termine(datum), sammlung_datum, sammlung_organisator, published_at, gemeinde_id, profiles:profiles_public!posts_author_id_fkey(display_name, verein_name), gemeinden(name)' as const
