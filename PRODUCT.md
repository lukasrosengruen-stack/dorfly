# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primärnutzer/Kunde: die Gemeindeverwaltung (Bürgermeister, Gemeinderat, Verwaltungsmitarbeiter) — sie beschafft und betreibt Dorfly für ihre Gemeinde und pflegt Inhalte über das Admin-Dashboard. Endnutzer: Bürgerinnen und Bürger der jeweiligen Gemeinde (bis ~15.000 Einwohner), die die App nutzen um informiert zu bleiben, sich zu beteiligen und Anliegen zu melden.

Job der Verwaltung: Bürgerkommunikation bündeln und Beteiligung ermöglichen, ohne mehrere Einzellösungen (Website, Amtsblatt, Facebook-Gruppe) parallel zu pflegen. Job der Bürger: Gemeinde-Infos, Umfragen, Mängelmeldungen, Vereins-/Gewerbeverzeichnis, Veranstaltungen und Warnmeldungen an einem Ort statt verstreut über mehrere Kanäle.

## Product Purpose

Dorfly ist eine kommunale Bürger-App für deutsche Gemeinden, die Bürgerbeteiligung (Umfragen, Gemeinderats-Forum), Serviceleistungen (Mängelmelder, Abfallkalender) und lokale Vernetzung (Vereins-/Gewerbeverzeichnis, lokale Angebote, Veranstaltungen, Warnmeldungen) in einer Plattform bündelt. Erfolg bedeutet: Gemeinden lösen ihre verstreute Bürgerkommunikation ab, und Bürger nutzen die App aktiv als zentralen Kanal.

## Positioning

Drei Differenzierungsmerkmale. Erstens das Gemeinderat-Feature: individuelle Gemeinderäte und Fraktionen posten mit eigener Stimme, mit direktem, nicht-öffentlichem Bürgerdialog. Kein Wettbewerber (Orts.App, meinOrt, VillageApp, BürgerStimme) bietet das. Zweitens die Bündelung aller bürgernahen Funktionen in einer App statt vieler Einzellösungen, Facebook-Gruppen und Amtsblatt. Drittens die niedrige Einstiegshürde durch ein Subdomain-Mandantenmodell (`<slug>.dorfly.de`), zugeschnitten auf kleine Gemeinden bis rund 15.000 Einwohner. Vertrieben wird Dorfly durch einen amtierenden Bürgermeister, was Vertrauen und Zugang über das persönliche kommunale Netzwerk schafft.

## Operating Context

- Multi-Tenant: Jede Gemeinde erhält eine eigene Subdomain (z.B. `ehningen.dorfly.de`) via Proxy-Routing; eine neue Gemeinde anzulegen ist ein SQL-Insert, keine Code-Änderung.
- Zwei getrennte Bereiche: Bürger-App (`(app)`-Route-Gruppe, Login erforderlich) und Admin-Dashboard (`(admin)`-Route-Gruppe) für Gemeinde-Mitarbeiter zur Inhaltspflege.
- Ein Gast-Zugang existiert ("Ohne Anmeldung ansehen") für Bürger, die die App ohne Registrierung erkunden wollen.
- Native Wrapper via Capacitor (iOS) lädt aktuell die produktive Website (`dorfly.de/start`) nach — kein eigenständiges natives Design, Plattform bleibt web.
- PWA-fähig (`next-pwa`), Push-Benachrichtigungen über OneSignal.
- Rollout-Status: Pilot-/Testphase — erste Gemeinde(n) (z.B. Ehningen) testen die App, noch kein breiter produktiver Rollout über viele Gemeinden.

## Capabilities and Constraints

- Kernfunktionen: Umfragen, Gemeinderats-Forum, Mängelmelder, Abfallkalender, Gewerbe-/Vereinsverzeichnis, Veranstaltungen, lokale Angebote/Marktplatz, Warnmeldungen, Push-Benachrichtigungen.
- Tech-Stack: Next.js 16, React 19, TypeScript, Supabase (DB + Auth), Tailwind v4, Zod, Zustand.
- Datenbank-Konvention: deutsche Feld-/Tabellennamen (`gemeinde_id`, `mängel`, `verein_name`, …); jede neue Migration braucht explizite GRANTs (Supabase vergibt keine automatischen Grants mehr auf `public`-Tabellen).
- Barrierefreiheit ist Pflichtanforderung, kein optionales Ticket (siehe Accessibility-Sektion).
- Marktplatz-Feature ist laut Roadmap noch nicht vollständig implementiert (Tabelle `marktplatz_inserate` offen).
- Eine eigenständige native App (Expo/React Native mit echter Feature-Parität) ist laut Roadmap noch ausstehend (Phase 4); aktuell existiert nur der Capacitor-Wrapper um die Website.

## Brand Commitments

Name: Dorfly. Claim: Dorfly. Lokal vernetzt. Logo typografisch in DM Sans Bold: "Dorf" in #0057A8, "ly" in #0D1B2A, grüner Punkt in #00A878. Diese drei Farben sind das feste Farbsystem der Marke. Pro Gemeinde ist zusätzlich eine Primärfarbe (`gemeinden.primary_color`) für das Branding im App-Bereich konfigurierbar.

Markenstimme für alle Außentexte: professionell, klar, konkret. Sie-Form gegenüber Bürgermeisterinnen und Bürgermeistern und auf der Homepage. Geschlechterneutral ohne Gendern, "Bürgermeisterinnen und Bürgermeister" ausgeschrieben, kein Sternchen, kein Doppelpunkt. Kurze Sätze, klarer Rhythmus, keine Gedankenstriche. Keine Startup-Sprache, keine Marketing-Floskeln. Konservatives kommunales Umfeld, keine politischen Signale.

## Evidence on Hand

Pilot-/Testphase: reale Testgemeinde "Ehningen" sowie Testgemeinde "musterstadt" für lokale Entwicklung. Keine bestätigten Testimonials, Fallstudien, Presseerwähnungen oder Nutzungszahlen vorhanden — zukünftige Arbeit darf diese nicht erfinden.

## Product Principles

1. Eine App statt viele Kanäle — bündelt alles, was Bürger von ihrer Gemeinde brauchen.
2. Multi-Tenant-first — jede Funktion muss pro Gemeinde funktionieren (Subdomain, eigene Farbe, eigene Daten), ohne Code-Änderung pro Gemeinde.
3. Niedrige Einstiegshürde für kleine Gemeinden (bis ~15.000 Einwohner) — einfach aufzusetzen, kein großer Individualisierungsaufwand nötig.
4. Barrierefreiheit ist nicht verhandelbar — jedes Feature muss WCAG 2.2 AA / BITV 2.0 erfüllen, unabhängig vom Ticket-Fokus.
5. Web zuerst, nativ als Wrapper — das Kernprodukt ist die Web-App; die iOS-App lädt aktuell nur die Website nach, keine eigenständige native Experience (bis Phase 4 der Roadmap).

## Accessibility & Inclusion

Pflichtanforderung, kein optionales Ticket: WCAG 2.2 AA, BITV 2.0, EN 301 549, BFSG (deutsche gesetzliche Vorgaben für öffentliche/kommunale Angebote). Vollständiger Audit unter `docs/accessibility/`. Gilt für jedes neue Feature und jede Änderung.
