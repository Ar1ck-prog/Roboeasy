/*
 * RoboEasy: on-screen pad for phones and tablets (not part of the original
 * simulator). The simulator drives the robot from key events on the field's
 * canvas (W/A/S/D, R/F arm C, T/G motor D, Shift slow), so each button sends
 * the same keydown/keyup there while it is held.
 */
;(function () {
  var BUTTONS = {
    drive: [
      { cls: 're-slow', code: 'ShiftLeft', key: 'Shift', label: '<svg class="re-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 13a6 6 0 1 0 12 0 4 4 0 1 0-8 0 2 2 0 0 0 4 0"/><circle cx="10" cy="13" r="8"/><path d="M2 21h12c4.4 0 8-3.6 8-8V7a2 2 0 1 0-4 0v6"/><path d="M18 3 19.1 5.2"/><path d="M22 3 20.9 5.2"/></svg>', title: 'Медленно', toggle: true },
      { cls: 're-up', code: 'KeyW', key: 'w', label: '<svg class="re-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 15 7-7 7 7"/></svg>', title: 'Вперёд' },
      { cls: 're-left', code: 'KeyA', key: 'a', label: '<svg class="re-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>', title: 'Налево' },
      { cls: 're-down', code: 'KeyS', key: 's', label: '<svg class="re-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7"/></svg>', title: 'Назад' },
      { cls: 're-right', code: 'KeyD', key: 'd', label: '<svg class="re-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>', title: 'Направо' },
    ],
    motors: [
      { code: 'KeyR', key: 'r', label: 'C<svg class="re-ico re-mini" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>', title: 'Рука C вверх' },
      { code: 'KeyT', key: 't', label: 'D<svg class="re-ico re-mini" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>', title: 'Мотор D вперёд' },
      { code: 'KeyF', key: 'f', label: 'C<svg class="re-ico re-mini" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>', title: 'Рука C вниз' },
      { code: 'KeyG', key: 'g', label: 'D<svg class="re-ico re-mini" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>', title: 'Мотор D назад' },
    ],
  }

  function target() {
    return document.querySelector('#field canvas')
  }

  function send(type, b) {
    var el = target()
    if (!el) return
    el.dispatchEvent(new KeyboardEvent(type, { code: b.code, key: b.key, bubbles: true, cancelable: true }))
  }

  function makeButton(b) {
    var btn = document.createElement('button')
    btn.type = 'button'
    if (b.cls) btn.className = b.cls
    btn.innerHTML = b.label
    btn.title = b.title
    btn.setAttribute('aria-label', b.title)
    var held = false
    var press = function (e) {
      e.preventDefault()
      if (b.toggle) {
        held = !held
        btn.classList.toggle('on', held)
        send(held ? 'keydown' : 'keyup', b)
        return
      }
      if (btn.setPointerCapture && e.pointerId !== undefined) btn.setPointerCapture(e.pointerId)
      held = true
      btn.classList.add('on')
      send('keydown', b)
    }
    var release = function () {
      if (b.toggle || !held) return
      held = false
      btn.classList.remove('on')
      send('keyup', b)
    }
    btn.addEventListener('pointerdown', press)
    btn.addEventListener('pointerup', release)
    btn.addEventListener('pointercancel', release)
    btn.addEventListener('lostpointercapture', release)
    btn.addEventListener('contextmenu', function (e) {
      e.preventDefault()
    })
    return btn
  }

  function mount() {
    var field = document.getElementById('field')
    if (!field || field.querySelector('.re-pad')) return
    var pad = document.createElement('div')
    pad.className = 're-pad'
    var drive = document.createElement('div')
    drive.className = 're-cluster re-drive'
    BUTTONS.drive.forEach(function (b) {
      drive.appendChild(makeButton(b))
    })
    var motors = document.createElement('div')
    motors.className = 're-cluster re-motors'
    BUTTONS.motors.forEach(function (b) {
      motors.appendChild(makeButton(b))
    })
    pad.appendChild(drive)
    pad.appendChild(motors)
    field.appendChild(pad)
  }

  // Rows that scroll sideways on a phone fade at the edge while there is more to see.
  function watchScroll(el) {
    var update = function () {
      el.classList.toggle('re-more', el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    update()
  }

  function start() {
    mount()
    document.querySelectorAll('.field-toolbar').forEach(watchScroll)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
