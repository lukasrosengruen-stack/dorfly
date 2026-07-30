# App Store Badge auf der Landingpage

## Kontext

Dorfly ist jetzt im Apple App Store verfügbar. Die Landingpage (`src/app/homepage/page.tsx`) ist primär eine B2B-Verkaufsseite für Bürgermeister/Gemeinden, soll aber auch als Vertrauenssignal zeigen, dass die App real und live ist (kein Prototyp).

## Design

**Neue Sektion** direkt nach der Hero-Section, vor `Problem`:

- Eyebrow "Jetzt verfügbar" + Headline
- Ein Satz Subtext
- Zwei Badges nebeneinander, im bestehenden Design-Stil der Seite (dunkle Pille, Icon + zweizeilige Beschriftung):
  - **App Store**: echter Link zu `https://apps.apple.com/de/app/dorfly/id6791239032`, `target="_blank" rel="noopener noreferrer"`, `aria-label` mit Hinweis auf neuen Tab. Icon: `Apple` aus `lucide-react`.
  - **Google Play**: nicht klickbar, als "Bald verfügbar" gekennzeichnet. Kein `<a>`/`<button>`, sondern ein reines `<div aria-disabled="true">` (kein interaktives Element ohne Aktion).

**Footer**: zusätzlicher Link "App Store" in der bestehenden Link-Liste (Impressum, Datenschutz, Nutzungsbedingungen, Kontakt), zeigt auf denselben Link, `target="_blank" rel="noopener noreferrer"`.

## Nicht enthalten

- Kein Google-Play-Link (existiert noch nicht)
- Keine Nav-Änderung (Nav bleibt fokussiert auf "Demo anfragen")
- Keine externen Bild-Assets (offizielle Store-Badge-Grafiken) — Badge wird im bestehenden Stil der Seite nachgebaut, um keine externe Abhängigkeit/Lizenzfrage einzugehen.

## Umsetzung

Einzelne, in sich abgeschlossene Änderung an einer bestehenden Datei (neue Komponente + Einbindung + Footer-Link). Kein separater Implementierungsplan nötig.
