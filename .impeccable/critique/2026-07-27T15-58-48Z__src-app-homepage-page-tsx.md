---
target: landing page (src/app/homepage/page.tsx)
total_score: 25
max_score: 32
na_heuristics: 7,10
p0_count: 2
p1_count: 0
timestamp: 2026-07-27T15-58-48Z
slug: src-app-homepage-page-tsx
---
Method: dual-agent (A: a3223a5f73fcad33f · B: a4427ab051c4a53f1)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading state is text-only ("Wird gesendet..."), no spinner; not in a distinct `aria-live` region from the eventual success `role="status"`. |
| 2 | Match Between System and Real World | 4 | Precise municipal terminology throughout, matches the buyer's mental model exactly. |
| 3 | User Control and Freedom | 2 | Modals close via X/Escape/backdrop, but focus was not actually restored to the trigger on close (see Priority Issues — now fixed). |
| 4 | Consistency and Standards | 2 | Same "Demo anfragen" CTA rendered in brand blue everywhere except the final CTA, which uses green; two gray tokens applied inconsistently across light/dark backgrounds (now fixed). |
| 5 | Error Prevention | 3 | Native HTML5 validation present; no confirm-before-discard on backdrop click (low stakes given short forms). |
| 6 | Recognition Rather Than Recall | 4 | Sticky nav with clear anchors, consistent iconography. |
| 7 | Flexibility and Efficiency | n/a | Single-visit marketing surface; no repeat-user power path applies. |
| 8 | Aesthetic and Minimalist Design | 3 | Hero and Setup paragraphs run long (~50+ words) right at top-of-funnel decision points. |
| 9 | Error Recovery | 3 | `role="alert"` present, contrast now passes, but message is generic ("Etwas ist schiefgelaufen") with no differentiation by failure type. |
| 10 | Help and Documentation | n/a | Not expected on a landing page; footer `mailto:` is the de facto help channel. |
| **Total** | | **25/32** | **Good (78%)** |

*(Score reflects the state assessed by the two sub-agents, immediately before this session's follow-up fixes below.)*

## Design Specificity Verdict

**Grounded content, generic-but-competent chrome.** The page could not be reused unchanged by an unrelated product: copy is saturated with municipal-specific vocabulary, real demo screenshots from a named test municipality, and a first-person founder narrative pinned to a real place and date. That passes decisively. The visual skeleton (radial-gradient hero blobs, `01/02/03` numbered steps, gradient-initials founder card) is a fairly conventional modern SaaS shape — swap the copy and it reads like other startup pages. **Content is specific and well-earned; chrome is generic-but-competent.**

**Deterministic scan**: clean again (exit 0, zero findings) on the target file. A scan of `src/components/ui` for broader context turned up one finding (`Card.tsx:6`, `broken-image` rule) that both the detector-runner and I confirm is a false positive — it matched a JSDoc `@example` comment, not live JSX, and is unrelated to this target file.

**Visual overlays**: still unavailable — no browser automation tool exposed this session; source-only review again.

## Overall Impression

Three of the four items from the last pass verified as genuinely fixed: the skip-link target, all form label/id pairing, and the modal `role`/`aria-modal` wiring are correctly in place with no loose ends. The fourth — focus restoring to the trigger element on modal close — looked fixed but wasn't: `useFocusTrap(true)` was called with a hardcoded literal, and since the modals fully unmount on close (rather than staying mounted and hiding), the hook's restore-on-close branch never actually fires. That's now fixed directly in this session (see below), along with two new contrast regressions the fix pass introduced or left behind on navy backgrounds, and a small mobile input sizing issue.

## What's Working

1. **No fabricated proof** — still honest given the pilot-stage ground truth; demo screenshots clearly labeled.
2. **Objection-preemption is well-targeted** — the navy "Datenschutz und Barrierefreiheit" card names the exact stakeholders and legal bases a municipal buyer's internal reviewers will ask about.
3. **Prior accessibility fixes hold up under closer inspection** — real `<label htmlFor>` pairing on every field, correctly-scoped `aria-labelledby`, no dangling references, mobile toggle state pairing all confirmed correct by an independent mechanical check.

## Priority Issues (from this critique pass — all four now addressed this session)

**[P0] Focus was never actually restored after closing either modal — fixed.** `useFocusTrap(true)` only restores focus on an active:true→false transition, but `DemoModal`/`UpdatesModal` are unmounted entirely on close (`{demoOpen && <DemoModal .../>}`), so that branch never ran; a keyboard/screen-reader user closing "Demo anfragen" lost their place and had to re-tab from the top of the page. *Applied fix*: `HomepagePage` now captures `document.activeElement` into a ref before opening each modal and explicitly restores focus to it in the close handler, independent of the hook's unmount-incompatible branch.

**[P0] Two new contrast failures on navy backgrounds — fixed.** The founder-card byline/bullets and the final CTA's subhead, "Erstmal nur informiert bleiben" link, and reassurance line all reused `#64748B`/`#475569` (tokens that pass AA on light backgrounds but drop to ~2.3–3.6:1 on navy). *Applied fix*: swapped all of these to `#94A3B8`, the token already used correctly elsewhere on navy (e.g. the Datenschutz card), which passes ~6.8:1. Also swapped the GDPR-consent paragraphs in both modals from `#94A3B8` (fails at ~2.56:1 on their white background) to `C.muted`, which passes on white.

**[P2] Mobile inputs trigger iOS Safari's auto-zoom — fixed.** Both modals' shared `inputStyle` used `fontSize: 14`, below the 16px threshold that prevents unwanted viewport zoom on focus. *Applied fix*: bumped to 16px.

**[P2] Same CTA action, two different brand colors — not fixed, flagged for a decision.** "Demo anfragen" renders in brand blue in the nav, hero, and mobile menu, but in green on the final, highest-intent CTA. This predates this session's fixes (present in the original file) and reads as either an intentional visual distinction for the closing CTA or an inconsistency — a brand/design call, not a defect I should resolve unilaterally.

## Persona Red Flags

**Riley (keyboard-only stress tester)**: the focus-restore bug above is exactly what this persona would catch first; now closed by the fix. Separately noted: on modal open, initial focus lands on the "Schließen" (X) button rather than the first field, because it's first in DOM order — not wrong per the focus-trap spec, but an unusual default worth a look if it comes up again.

**Casey (distracted mobile user)**: the 14px input auto-zoom is exactly this persona's failure mode (an unexpected viewport jump while already distracted); now fixed.

**Skeptical Bürgermeister/Verwaltungsmitarbeiter**: the founder-trust card is the strongest asset for this persona but uses a generic two-letter gradient monogram instead of a photo — undercuts the "a real, specific mayor is behind this" angle the surrounding copy leans on. Also: the page states it's "auf WCAG 2.2 AA ausgerichtet" — this pass's own findings (before the fixes above) are exactly the kind of gap this persona's IT/accessibility reviewer would independently catch. Both are content/asset decisions, not addressed here.

## Voice/Copy Audit

No violations against the stated rules: no em-dashes in visible copy, correct spelled-out gender-neutral forms throughout, consistent Sie-form, no fabricated stats or testimonials. The known Du-form page-title item remains intentionally deferred per your earlier decision — not re-flagged as an issue.

## Minor Observations

- Cognitive-load chunking still exceeds the ≤4-item guideline: Zielgruppen (6 cards) and Features (8 cards + 1 full-width card) are flat, undifferentiated grids — unchanged from the last critique, not addressed this session.
- No pricing signal anywhere on the page for a budget-gated municipal buyer — may be an intentional sales-led choice.
- `aria-controls="mobile-nav-menu"` references an element that only exists in the DOM once the menu is open, rather than existing-but-hidden — acceptable common practice, not maximal AT compatibility.
- Dead CSS in `globals.css` (`.mp-float`, `.mp-float-delay`, `.mp-d1`–`.mp-d5`) is defined but never referenced by this page (delays are done inline instead) — leftover from an earlier version.
- `DemoModal` and `UpdatesModal` both use plain field ids like `"email"`/`"gemeinde"`; nothing in the source structurally prevents both modals from being mounted simultaneously, which would duplicate those ids in the DOM. No code path in the current UI actually triggers this (the first modal's backdrop and focus trap block reaching the other's opener), so this is a theoretical landmine rather than an active bug — left as-is rather than renaming fields defensively.

## Questions to Consider

1. Now that the CTA color question has been raised twice, is the final CTA's green deliberately meant to read as a distinct "softer ask" versus the blue used everywhere else, or should it match?
2. Given the accessibility claim on this exact page, would it be worth a one-time automated axe/Lighthouse pass now that the manual findings are closed out, as a belt-and-suspenders check?
3. Is the flat 6-card/8-card grid structure (Zielgruppen/Features) considered final, or worth revisiting for sub-grouping in a future pass?
