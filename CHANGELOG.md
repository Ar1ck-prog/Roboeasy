# Changelog

## 2.1.0

### LEGO WeDo 2.0 for ages 6–9
- A learning path at the start: WeDo 2.0 or SPIKE Prime (onboarding, `/learn`, `/path`); WeDo is suggested under 10. Stored in the profile (`learningPath`, synced in `settings`), changeable in the profile with a grown-up dialog.
- WeDo path: every SPIKE track stays locked until all 35 WeDo lessons are done, then Start opens with “You are ready for SPIKE Prime!”. SPIKE path: everything as before, WeDo optional. Learners with SPIKE progress get the SPIKE path automatically and see no locks.
- `/learn` tabs: WeDo 2.0 | SPIKE Prime | General, each numbered on its own, with a lock plaque and WeDo progress on the SPIKE tab. WeDo tracks have their own accent colour (`--wedo-accent`), icons and badge.
- 4 tracks, 10 units, 35 lessons in ru/kk/en with an original story (Zip the rover).
- A separate WeDo language, simulator and checks (`lib/wedo`): icon blocks left to right, rover, spinner, crane, barrier, Smarthub light, tablet screen, sound, motion and tilt sensors (scripted for the autocheck, live buttons for free runs).
- New lesson steps `wedo_code` and `wedo_predict`; optional quiz illustrations. No AI mentor in WeDo steps (also refused by the mentor API); read aloud and a bigger kid mode.
- Glossary terms, three achievements (First WeDo robot, WeDo complete, Ready for SPIKE), new skills `wedo-hub`, `sensor-motion`, `sensor-tilt`, `wedo-mechanics`.
- Tests: WeDo schema and simulator, references and predictions of every WeDo lesson, learning-path unlock rules, profile round trip, an e2e journey for a learner under 10.
## 2.0.0

### AI layer
- One server module for every Gemini call. Outside production the demo key `GEMINI_API_KEY_DEV` is used when it exists.
- Model names come only from the environment. Short requests go to the light model, complex ones and video to the main model.
- Cache of generated programs (30 days), rate limits shared through Supabase, usage counters and an admin page at `/[lang]/admin/ai`.
- When the AI is out of quota or unavailable, the learner gets a clear message and ready programs that work without it.

### Program generator
- New DSL commands: `arc`, `circle`, `tank`, `while`, variables and arithmetic, the program's own blocks, conditions on the gyro and on variables.
- Wheel speeds, angles and distances are always computed by our code.
- Up to three attempts with the error sent back to the model, a test drive in the simulator, and an honest refusal for impossible tasks.
- `eval/generator-tasks.json` (89 tasks) and `npm run eval:generator`.

### New features
- Teacher's room and built-in pilot: classes with a join code, entry and final tests, practice without AI, a before-and-after report, Excel and CSV export, a draft parental consent page.
- Draw a route: a drawn line becomes straight pieces and arcs, is driven in the simulator and then on the robot.
- Live telemetry: charts of the robot's sensors over Bluetooth, recordings kept in the browser, CSV export. Off by default until checked on a real hub.
- Video debugging: a short video becomes stills in the browser; the mentor answers with a question, then a hint.
- "AI from zero": 18 lessons in 6 modules, vibe coding in a closed frame, and models that learn gestures and colours in the browser.
- Voice questions for the mentor, answers read aloud, an installable site with an offline page.

### Not done
- Duels in the simulator with a school ranking.
