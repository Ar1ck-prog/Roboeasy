# Privacy and child safety

Status: **draft for legal review.** Items marked `TODO(legal)` must be checked by a lawyer before launch in each country. This document describes what the code does today; the public pages `/[lang]/privacy` and `/[lang]/parents` are written from it (`lib/i18n/legal.ts`).

## Principles

1. **Collect as little as possible.** A learner is a nickname, an age range, a time zone and a daily goal. No real names, email, phone, photos, voice, location or contacts.
2. **Local first.** Until accounts exist, all progress lives in the browser's `localStorage` (`roboeasy.learn.v1`). Nothing about the learner is sent to our server except what a feature needs at that moment (see below).
3. **No public social features.** No chat between learners, no public profiles, no comments, no leaderboards. RoboEasy is for learning on your own; there are no classes or teacher accounts.
4. **Children's AI is constrained.** The mentor gives hints, never full solutions, stays on the lesson's topic and refuses personal questions (`lib/learn/mentor.ts`). Its answers are filtered on the server (`sanitizeHint`).
5. **The learner and their parents control the data.** Export, import and delete are one click in the profile.

## What is stored and where

| Data | Where | Why | How long |
| --- | --- | --- | --- |
| Nickname, age range, time zone, daily goal, robot looks, reminder settings | Browser (`localStorage`) | Personal path, streak in the right time zone | Until deleted in the profile or the browser data is cleared |
| Learning events (lessons, steps, mistakes, time spent, achievements) | Browser (`localStorage`) | XP, streak, review schedule, achievements | Same as above |
| Anonymous id (`anonId`, random) | Browser | A/B test buckets, later: linking to an account | Same as above |
| Program and question sent to the AI mentor | Our server → Google Gemini API, not stored by us | Generating a hint | Request only. `TODO(legal)`: confirm Gemini API data-use terms for the paid tier (no training on API data) and list Google as a processor |
| Mentor moderation log | Server logs | Abuse and quality monitoring | Lesson id, step id, hint level, question length, off-topic flag, ok/rejected. **No question text, no program, no IP** |
| Certificate data (nickname, track, date, lesson count) | Inside the certificate code (signed), not stored on the server | Verifying a certificate | As long as the learner keeps the link |
| Rate-limit counters | Server memory, keyed by IP | Abuse protection | Up to 24 h, never written to disk |
| Page analytics | Vercel Web Analytics (production only) | Page views, no cookies | `TODO(legal)`: confirm it counts as anonymous in KZ/EU |

## Children and parental consent

- Learners pick an age range at onboarding: under 10, 10–12, 13–15, 16+.
- **Under 16**: onboarding requires a grown-up (a parent or guardian) to tick a consent box after reading a short explanation, with a link to `/parents`. The flag is stored as `parentConsent` in the profile.
- Reminders are **off by default** for everyone and, for under-16s, the settings say that a grown-up turns them on. Reminders are a calendar file (`.ics`) the family adds to its own calendar; we never send notifications or messages.

### Legal bases to check — `TODO(legal)`

- **Kazakhstan**: Law of the Republic of Kazakhstan No. 94-V "On personal data and their protection" (2013). Processing data of minors requires consent of a legal representative; data must be stored in Kazakhstan when it is collected there (localisation requirement, art. 12). Today no personal data leaves the browser except the mentor request — check whether a nickname-free program text sent to Gemini counts as personal data. For the database phase: choose a hosting region that satisfies localisation, or keep KZ learners' records in KZ.
- **EU / GDPR (GDPR-K, art. 8)**: consent of the holder of parental responsibility below the national age (13–16, varies by member state). We use 16 as the single threshold, which covers every member state.
- **USA / COPPA**: verifiable parental consent for children under 13 before collecting personal information. Our local-only design collects none today; with accounts (email and password, no confirmation email) we must use a COPPA-compliant consent method (e.g. email-plus confirmation from the parent) — `TODO(legal)`.
- **UK Age Appropriate Design Code**: high privacy by default, no nudge techniques, no profiling by default. Streak copy is written without guilt ("missing a day is fine"), there are no purchases or loot boxes, and cosmetics are earned only by learning.

## Learner rights (implemented)

- **Export**: Profile → My data → Download my data (full JSON of the local state).
- **Import**: Profile → My data → Load from a file (validated against the schema).
- **Delete**: Profile → My data → Delete all data (confirmation, then the local key is removed).
- With the database: the same three actions will call server endpoints; deletion will remove the account and all rows (`ON DELETE CASCADE`) within 30 days, including backups — `TODO(db)`.

## AI mentor safety

- System prompt (`mentorSystemPrompt`): kind, short, age-appropriate, in the interface language; never write the full program; stay on the task; do not ask for or accept personal information; refuse anything off-topic gently.
- Server filter: hints longer than 400 characters, containing code-like text, or containing all numbers of the reference solution are discarded and replaced with the lesson's own hint.
- Limits: 6 requests per minute and 30 per day per client; after that, lesson hints still work.
- The learner can always use the lesson's own staged hints without the AI.

## Coins, the garage and games

- Coins and XP are virtual and earned only by learning (lessons, daily quests, practice games, streak days, achievements). They cannot be bought, sold, transferred or exchanged for anything outside the app; there are no in-app purchases and no ads.
- Upgrades bought with coins only change in-app rewards (more coins or XP, extra streak freezes, game hints). Nothing is random: there are no loot boxes.
- Daily quests and streaks have no pressure mechanics: missing a day costs nothing but the streak, and freezes cover missed days.
- The robot buddy (model, colour, accessories, name) is stored in the profile like the other settings. Its name is free text up to 16 characters and is never shown to other users. `TODO(legal)`: check whether a free-text robot name needs moderation once anything becomes visible to others.

## RoboEasy 2.0 additions

- **Classes.** A learner joins with a class code, a made-up nickname and a PIN, as an anonymous account with no email or phone. The PIN is stored only as a hash. Only the class's teacher sees results, under nicknames. A learner can leave and delete their results; a teacher can remove a learner. The consent text at `/[lang]/parents/consent` is a draft. `TODO(legal)`
- **Camera in lessons.** Gesture training runs on the device. Frames are not sent or stored.
- **Video debugging.** The video stays on the device. A few small stills go to the server, are held in memory for that request and are sent to Google Gemini; they are not stored by RoboEasy. The page asks learners to film only the robot. `TODO(legal)`: on Gemini's free tier Google may use submitted content to improve its products, so a paid tier is needed before children's stills are sent in real use.
- **Voice questions.** Chrome sends the recording to a Google service for recognition. It starts only on a click.
- **Telemetry.** Recordings stay in the browser.
- **AI usage counters** hold no request text. **The failure log** keeps a trimmed request with contact details removed, is readable only by admins and is deleted after 90 days.
- **Rate limits** use a random id for the browser and hashed addresses.

## Contact

`TODO(legal)`: data controller name, address and contact email for privacy requests.
