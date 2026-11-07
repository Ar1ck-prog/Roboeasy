# FLL BIOGLOW 3D simulator (copy)

The built site of the BIOGLOW 3D field simulator by **fll-bioglow-sim**
(original: https://fll-bioglow-sim.onrender.com/), hosted on RoboEasy with the
author's permission. The files are the site as its server delivers them
(Vite build: three.js, Rapier physics in a worker, Pyodide for the robot's
Python code, LDraw parts); there are no sources and no backend.

RoboEasy changes only the look:

- `index.html`: `roboeasy/theme.js` (picks the site's light or dark theme) and
  `roboeasy/theme.css` (Rubik, our palette, outlined buttons), loaded before
  the simulator's bundle;
- `assets/index-*.js` and `assets/builder-*.js`: the 3D scene background (and
  fog) colours read the `--re-scene` / `--re-builder` CSS variables instead of
  fixed dark colours;
- `roboeasy/`: the theme files and the Rubik font.
- `roboeasy/mobile.css` and `roboeasy/mobile.js` (also linked in `index.html`):
  below 900 px the panels stack (field, code, score sheet) and a touch pad on
  the field sends the simulator's own W/A/S/D, R/F, T/G and Shift key events.

The page `/[lang]/compete/simulator` shows it in a frame
(`components/fll/field-simulator.tsx`). Cross-origin isolation headers for
`/fll-sim/*` are in `next.config.mjs`. To update the copy, download the new
build over these files and redo the changes above.
