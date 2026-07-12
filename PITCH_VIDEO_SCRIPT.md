# BroxStudies — 70-Second Investor Pitch Video Script

**Runtime:** 70 seconds
**Tone:** Confident, fast, product-first. Assume sound-off viewing — burn in captions.
**Emphasis:** The Moolre mobile-money integration is the centerpiece (≈40% of runtime) — it's the proof this product is built for how Ghana actually pays, not a Western card-first afterthought.

---

## Full Timestamped Script

| Time | Visual | Voiceover (VO) | On-Screen Text |
|---|---|---|---|
| **0:00–0:07** | Cold open: photocopied past-question booklets, a crowded classroom, a phone screen lighting up. Quick cuts. | "1.5 million SHS and TVET students in Ghana are prepping for WASSCE and NAPTEX — most still study from photocopies, with no idea what to focus on." | "1.5M+ students. Zero personalization." |
| **0:07–0:18** | Cut to app: Landing page → Dashboard. Show a syllabus/PDF being uploaded, then AI-generated practice questions appearing. | "BroxStudies is an AI study platform. It reads real syllabi and past exams with retrieval-augmented AI, then generates unlimited personalized practice questions from them." | "Upload past papers → AI finds the patterns" |
| **0:18–0:30** | Screen-record montage: Practice quiz in progress, topic pattern-analysis chart, live Rankings leaderboard, Study page. | "Students drill topic-ranked practice, sit live quizzes, and see how they rank against classmates — all from one dashboard, on any phone." | "Practice. Quiz. Rank. Repeat." |
| **0:30–0:58** | **MOOLRE SEQUENCE — hero segment.** Screen-record the real `Activate` flow: type MoMo number → tap Pay → OTP prompt → spinner/polling → success screen with access code → SMS notification popping on a phone → payment history list showing "Paid" badges. | "Here's the money engine: a student types their MoMo number. Moolre detects their network — MTN, Telecel, or AT — and charges the wallet directly, no card required. We handle the OTP automatically, poll Moolre in real time, and the moment payment clears, an access code is generated and texted instantly. A webhook double-confirms in the background, so no payment is ever lost." | "Powered by Moolre" → "MTN · Telecel · AT" → "No card. No bank. Just MoMo." → "Paid → SMS'd → Activated" |
| **0:58–1:07** | Quick cut: price card (GH₵20 / 3 months), then a small chart/counter ticking up (transactions, active subscriptions). | "GH₵20 unlocks three months of premium — recurring, mobile-money-native revenue, built for how Ghana actually pays." | "GH₵20 = 3 months premium" |
| **1:07–1:10** | Logo lockup on screen, Moolre wordmark small alongside it. | "BroxStudies. Built on Moolre. Built for Ghana." | "BroxStudies × Moolre" |

**Total VO word count:** ~152 words (comfortable pace for emphatic delivery with visual pauses).

---

## Moolre Segment — Shot-by-Shot Detail (0:30–0:58)

This is the section to storyboard most carefully since it's the differentiator. Screen-record the actual `/activate` flow, in this order:

1. **Type MoMo number** (`Activate.tsx`, Step 1 "Pay") — show the phone-number field and the "Pay GH₵20 with MoMo" button.
2. **Network auto-detection** — cut to a graphic showing the phone prefix mapping to MTN / Telecel / AT (no dropdown, no manual selection — it's automatic).
3. **OTP step** (Step 2 "Confirm") — show the OTP input screen with the copy "Your network sent you an OTP."
4. **Live polling** — show the loading spinner state ("Approve the payment prompt on your phone, then wait here") to sell that this is real-time, not a redirect to a third-party checkout page.
5. **Success → access code** (Step 3 "Activate") — the access code auto-fills, and cut to a phone mockup receiving the SMS with the code.
6. **Payment history** — a quick glimpse of the collapsible history panel with "Paid" / "Pending" / "Failed" badges, to signal transparency and reliability.

**Investor subtext to land visually, even if not spoken:** this flow replaced a card-based processor (Paystack) — call this out only if there's room in a longer cut, since most target users don't have cards but everyone has mobile money. That's the "why this matters" for the business, even though the script above doesn't say it explicitly to keep pacing tight.

---

## Production Notes

- **Captions:** Burn in on-screen text verbatim — most investor-video views happen muted on mobile.
- **Music:** Upbeat, rises in energy exactly at 0:30 when the Moolre sequence starts — this is the "how do you actually make money / is this real" moment, treat it like the demo climax.
- **Screen recordings:** Use the real app, not mockups — the Moolre flow is fast enough (seconds, not a redirect-and-wait) that live footage sells "instant" better than any narration can.
- **Do not slow down for the OTP screen** — investors read "we handle networks students already trust" faster than the copy explains it; let the cuts move quickly.
- **Closing frame:** Hold the "BroxStudies × Moolre" lockup for at least 2 full seconds — this is the logo/branding beat viewers screenshot.
