/*
 * RoboEasy theme for the copied 3D simulator: sets <html data-theme> to the
 * site's light or dark theme before the simulator starts. In the frame it
 * follows the RoboEasy page (same origin) and its theme switch; opened on its
 * own it uses the saved preference (localStorage "theme", see
 * lib/theme-script.ts) or the system setting. theme.css colours the panels,
 * the --re-scene and --re-builder colours are read once by the field and builder 3D scenes.
 */
;(function () {
  var root = document.documentElement
  var parentRoot = null
  try {
    if (window.parent !== window) parentRoot = window.parent.document.documentElement
  } catch (e) {}

  function resolve() {
    var t = parentRoot && parentRoot.getAttribute('data-theme')
    if (t === 'light' || t === 'dark') return t
    try {
      var p = localStorage.getItem('theme')
      if (p === 'light' || p === 'dark') return p
    } catch (e) {}
    return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  function apply() {
    root.setAttribute('data-theme', resolve())
  }

  apply()
  if (parentRoot) new MutationObserver(apply).observe(parentRoot, { attributes: true, attributeFilter: ['data-theme'] })
  else matchMedia('(prefers-color-scheme: light)').addEventListener('change', apply)
})()
