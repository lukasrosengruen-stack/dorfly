---
target: landing page (src/app/homepage/page.tsx)
total_score: 23
max_score: 32
na_heuristics: 7,10
p0_count: 2
p1_count: 3
timestamp: 2026-07-26T19-52-24Z
slug: src-app-homepage-page-tsx
---
Method: dual-agent (A: ac82fec97fbb64ac0 · B: aa7e0eadfd3aa26ca)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Modal form → success swap has no `aria-live`/`role="status"` — screen reader users get no announcement. |
| 2 | Match Between System and Real World | 4 | Authentic municipal vocabulary throughout (Mängelmelder, Amtsblatt, Gemeinderat), no translation-speak. |
| 3 | User Control and Freedom | 3 | Modals close via Escape/backdrop/X, but no focus trap — Tab escapes into obscured background content. |
| 4 | Consistency and Standards | 2 | Directly violates the project's own CLAUDE.md modal checklist (no `role="dialog"`, `aria-modal`, `useFocusTrap`, focus-restore) despite the hook already existing in the codebase. |
| 5 | Error Prevention | 3 | `required`/`type="email"` present, submit disables during `loading`; no whitespace-trim guard. |
| 6 | Recognition Rather Than Recall | 4 | Plain-language nav, consistent eyebrow+heading pattern aids scanning. |
| 7 | Flexibility and Efficiency | n/a | Landing page has no repeat-user power path to accelerate. |
| 8 | Aesthetic and Minimalist Design | 3 | Coherent single system, but six near-identical "eyebrow + h2 + card grid" sections back to back reads as formulaic by mid-scroll. |
| 9 | Error Recovery | 1 | Error text has no `role="alert"`; message is generic ("Etwas ist schiefgelaufen") with no path forward. |
| 10 | Help and Documentation | n/a | No task flow here needs contextual help; "Demo anfragen" is the help surrogate. |
| **Total** | | **23/32** | **Good (71%)** |

## Design Specificity Verdict

**Grounded, not category-interchangeable.** This page could not be dropped into an unrelated SaaS with a find-replace. Copy is saturated with Gemeinde-specific substance: Mängelmelder, Abfallkalender, Gemeinderat, "Frag den Bürgermeister", DSGVO/BITV/BFSG/WCAG references, the Ehningen origin story, and a founder card naming a real sitting mayor. The "Gemeinderat" differentiator (own-voice council posts) gets its own "Einzigartig in Dorfly" badge tied directly to the right card — correct positioning per PRODUCT.md. Brand tokens (#0057A8 / #0D1B2A / #00A878) match the committed palette exactly, including the shared `Logo` component.

One specificity gap: the subdomain multi-tenant model (`<slug>.dorfly.de`), one of the three named differentiators, is never actually surfaced in the copy — a missed chance to substantiate a stated claim.

**Deterministic scan**: `detect.mjs --json` ran clean against `src/app/homepage/page.tsx` (1085 lines) — exit code 0, zero findings across all rule categories. This is the notable disagreement in this critique: the mechanical detector found nothing, while the manual review below found a broken skip-link target, unlabeled form fields feeding two conversion modals, sub-AA contrast on the primary CTA, and a Sie/Du voice contradiction in the rendered page title. None of these tripped the detector's rules — treat a clean detector run on this project as "no known-pattern issues," not as "accessible" or "on-brief." No false positives to report since nothing fired.

**Visual overlays**: not available. No browser automation tool was exposed this session, so live-server injection was skipped entirely (fallback signal, not a failed attempt) — this critique is source-only for visual matters; nothing here has been eyeballed as actually rendered.

## Overall Impression

The page nails what's hardest to fake — genuine product specificity, disciplined municipal voice, and honest restraint around social proof during a pilot phase with no real testimonials to show. What undermines it is that the page explicitly sells accessibility and data-protection compliance as a purchase argument to a "Datenschutzbeauftragte/IT" audience (line ~792), and the implementation doesn't back up that claim on this exact page: a skip link that points nowhere, conversion-form fields with no programmatic label, and a primary CTA button whose text fails contrast. For a B2G sale to a risk-averse public official, that gap between claim and reality is the single biggest opportunity here.

## What's Working

1. **No fabricated social proof.** Given real pilot-phase status (Ehningen plus a clearly-labeled synthetic demo municipality), the page avoids fake logos, quotes, or usage numbers — a genuine discipline win against landing-page norms.
2. **Voice discipline.** Consistent Sie-form, full gender-neutral spellouts ("Bürgermeisterinnen und Bürgermeister", "Gemeinderätinnen und Gemeinderäte"), zero em-dashes, zero startup-speak on a full-file scan of the page copy itself.
3. **Platform-level accessibility defaults are correct.** `prefers-reduced-motion` disables reveal transitions; viewport correctly allows zoom (`maximumScale: 5`, `userScalable: true`) — the CLAUDE.md rule against locking zoom is respected where it's easy to get wrong.

## Priority Issues

**[P0] Skip link points at an element that doesn't exist on this page**
- **Why it matters**: The root layout's "Zum Hauptinhalt springen" skip link targets `#main-content`, which exists on the logged-in app's layout but not on this marketing page — `homepage/page.tsx` renders a bare `<main>` with no id. Keyboard and screen-reader visitors invoking the skip link on the flagship marketing page land nowhere.
- **Fix**: Add `id="main-content" tabIndex={-1}` to the `<main>` in `src/app/homepage/page.tsx`.
- **Suggested command**: `/impeccable harden`

**[P0] Conversion-modal form fields have no programmatic label**
- **Why it matters**: In both `DemoModal` and `UpdatesModal`, every `<label>` lacks `htmlFor` and every `<input>`/`<textarea>` lacks a matching `id`. Visually there's a label; a screen reader has no association. These are exactly the forms that drive the "Demo anfragen" and newsletter conversions, on a page that explicitly claims WCAG 2.2 AA alignment as a sales argument.
- **Fix**: Add `id={id}` to each input/textarea and `htmlFor={id}` to its label; add `role="alert"` to the error message elements so failures are announced.
- **Suggested command**: `/impeccable harden`

**[P1] Rendered page title contradicts the page's own Sie-form voice commitment**
- **Why it matters**: Root `layout.tsx` sets `metadata.title = 'Dorfly – Deine Gemeinde. Dein Smartphone.'` in informal Du-form. Because `homepage/page.tsx` is a client component with no scoped metadata override, this Du-form title is what actually renders in the browser tab, search results, and social-share previews for the one surface PRODUCT.md explicitly commits to Sie-form.
- **Fix**: Add a server-rendered metadata export (or nested `layout.tsx`/`generateMetadata`) scoped to `src/app/homepage/` with a Sie-consistent title and description.
- **Suggested command**: `/impeccable clarify`

**[P1] Primary CTA button and the differentiator badge fail text contrast**
- **Why it matters**: Brand green `#00A878` with white text computes to roughly 3.05:1 — below the 4.5:1 AA floor for normal-weight text at these sizes. This lands on the "Demo anfragen" button (16px bold, doesn't clear the large-text threshold) and the "Einzigartig in Dorfly" badge on the #1 stated differentiator card. It's the money button and the differentiator proof point, both under-contrast.
- **Fix**: Darken the green for any text-bearing surface, or increase weight/size past the large-text (18.66px bold) threshold, then re-verify computed contrast.
- **Suggested command**: `/impeccable polish`

**[P1] Modals don't implement the project's own mandated accessible-modal pattern**
- **Why it matters**: CLAUDE.md requires `role="dialog"`, `aria-modal="true"`, `useFocusTrap` (already implemented in this codebase at `src/hooks/useFocusTrap.ts`), and focus-restore on close for new modals. Neither `DemoModal` nor `UpdatesModal` implement any of the four; close buttons are icon-only with no `aria-label`; the mobile menu toggle also lacks `aria-expanded`/`aria-label`.
- **Fix**: Wire both modals through the existing `useFocusTrap` hook, add `role="dialog"`/`aria-modal="true"`, restore focus to the trigger on close, label icon-only buttons, and add `aria-expanded` to the mobile menu toggle.
- **Suggested command**: `/impeccable harden`

## Persona Red Flags

**Skeptical Bürgermeister/Verwaltungsmitarbeiter (risk-averse B2G buyer)**: The page's own "Datenschutz und Barrierefreiheit" card is exactly the claim this persona stress-tests first, and the audit above shows it doesn't hold up on this page (broken skip link, unlabeled forms, sub-AA CTA contrast). For a legally exposed public-sector buyer, a compliance claim that doesn't survive a quick check from their own IT/Datenschutzbeauftragte is a credibility break, not a cosmetic one. Separately, the honest absence of testimonials reads as vague rather than reassuring — nothing frames the pilot status positively (e.g. "werden Sie eine der ersten Pilotgemeinden").

**Riley (deliberate stress tester)**: Tabs through "Demo anfragen" — modal opens but Tab isn't trapped, so focus walks into obscured background content. Closes via Escape — focus doesn't return to the triggering button (no focus-restore logic in either modal). Submits with an induced failure — sees red error text, but a screen reader announces nothing (`role="alert"` absent).

**Casey (distracted mobile user)**: Opens the hamburger menu with a screen reader running — the button announces as an unlabeled "button" with no expanded/collapsed state. Mitigating factor: the fixed nav keeps "Demo anfragen" one tap away regardless of scroll depth, offsetting the long ~21-card scroll journey.

## Minor Observations

- Muted-gray text tokens (`#64748B`, `#94A3B8`) pass AA on light backgrounds but drop below 4.5:1 when reused on the navy About/CTA sections — including the GDPR consent microcopy near both forms, which is a specifically bad look for a product selling itself partly on data-protection credibility.
- `Zielgruppen` (6 cards) and `Features` (8 cards) are both flat grids exceeding the ≤4-item chunking guideline; sub-grouping `Features` into 2-3 categories would reduce perceived complexity without cutting content.
- The final CTA offers a primary "Demo anfragen" button and a secondary "Erstmal nur informiert bleiben" link directly beneath it — a fork exactly where the page should be narrowing to one action.
- `Zielgruppen` uses raw emoji icons with no `aria-hidden`, while the structurally identical `Features` section uses proper `lucide-react` icons — inconsistent icon language between two adjacent sections.
- The demo municipality is labeled "Musterbach" in screenshot alt text, while PRODUCT.md's ground truth names the synthetic test municipality "musterstadt" — worth confirming these are meant to be the same entity.
- The footer has no link to Dorfly's own accessibility statement, even though the Features section promises "Die Erklärung zur Barrierefreiheit ist für jede Gemeinde inklusive."
- Hover-only affordances (`onMouseEnter`/`onMouseLeave`) on feature/audience cards have no `:focus-visible` equivalent, though severity is low since the cards aren't interactive targets.

## Questions to Consider

1. If the "Datenschutz und Barrierefreiheit" card explicitly claims WCAG 2.2 AA alignment as a sales argument to a prospect's own IT/Datenschutzbeauftragte, has this exact page been run through an automated accessibility audit (axe/Lighthouse) — because a technically literate buyer's IT department will, and the gap found here is the kind of thing that costs trust in a single procurement meeting?
2. Given the mayor-sells-to-mayor distribution model, why isn't pilot/early-adopter status framed as a positive ("werden Sie eine der ersten Pilotgemeinden") instead of leaving a risk-averse buyer to infer it from the absence of testimonials?
3. Is the flat 8-card `Features` grid the intended final structure, or a placeholder — a 3-category grouping (Kommunikation / Bürgerservice / Lokales) would cut perceived complexity for a busy administrator skimming, without cutting content?
