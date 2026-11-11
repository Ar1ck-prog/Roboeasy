# 3D FLL simulator in RoboEasy

The editable source is in `../../fll-simulator/`. The original simulator is by fll-bioglow-sim and is hosted with the author's permission, as documented in RoboEasy. The local source includes subsequent Studio model viewing and GLB export work. These features have limitations described in `fll-simulator/README.md`.

Run `npm run fll:build` from the RoboEasy root to install locked simulator dependencies, compile it and copy the result here. `npm run build` does that automatically. The 3D simulator remains on `/fll-sim/index.html` and is embedded by the existing localized `/compete/simulator` page; the original RoboEasy 2D tab is unchanged. `/fll-sim/*` and the containing route require the isolation headers in `next.config.mjs` for Python pause/stop.

The RoboEasy theme and mobile touch controls are maintained in `fll-simulator/public/roboeasy/` and `fll-simulator/src/roboeasy/`; scene colours follow the parent theme. The LDraw assets and their attribution files are distributed with the build.
