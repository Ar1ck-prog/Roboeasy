/*
 * RoboEasy: on-screen pad for phones and tablets (not part of the original
 * simulator). The simulator drives the robot from key events on the field's
 * canvas (W/A/S/D, R/F arm C, T/G motor D, Shift slow), so each button sends
 * the same keydown/keyup there while it is held.
 */
;(function () {
  var BUTTONS = {
    drive: [
      { cls: 're-slow', code: 'ShiftLeft', key: 'Shift', label: '🐢', title: 'Медленно', toggle: true },
      { cls: 're-up', code: 'KeyW', key: 'w', label: '▲', title: 'Вперёд' },
      { cls: 're-left', code: 'KeyA', key: 'a', label: '◀', title: 'Налево' },
      { cls: 're-down', code: 'KeyS', key: 's', label: '▼', title: 'Назад' },
      { cls: 're-right', code: 'KeyD', key: 'd', label: '▶', title: 'Направо' },
    ],
    motors: [
      { code: 'KeyR', key: 'r', label: 'C<small>▲</small>', title: 'Рука C вверх' },
      { code: 'KeyT', key: 't', label: 'D<small>▲</small>', title: 'Мотор D вперёд' },
      { code: 'KeyF', key: 'f', label: 'C<small>▼</small>', title: 'Рука C вниз' },
      { code: 'KeyG', key: 'g', label: 'D<small>▼</small>', title: 'Мотор D назад' },
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
})()
