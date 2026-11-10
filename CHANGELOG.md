# Changelog

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
