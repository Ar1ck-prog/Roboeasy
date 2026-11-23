import { describe, expect, it } from 'vitest'

import { parseProgram } from '../lib/dsl/schema'
import { parseVoice } from '../lib/voice/parse'

const steps = (text: string) => parseVoice(text).steps

describe('voice commands', () => {
  it('drives forward a distance and turns', () => {
    expect(steps('Проедь вперёд на 30 сантиметров и поверни направо')).toEqual([
      { op: 'move', direction: 'forward', value: 30, unit: 'cm' },
      { op: 'turn', direction: 'right', degrees: 90 },
    ])
  })

  it('reads numbers spoken as words', () => {
    expect(steps('вперед тридцать пять сантиметров')).toEqual([{ op: 'move', direction: 'forward', value: 35, unit: 'cm' }])
    expect(steps('поверни налево на сорок пять градусов')).toEqual([{ op: 'turn', direction: 'left', degrees: 45 }])
    expect(steps('назад полтора метра')).toEqual([{ op: 'move', direction: 'back', value: 150, unit: 'cm' }])
    expect(steps('go forward one hundred twenty centimeters')).toEqual([{ op: 'move', direction: 'forward', value: 120, unit: 'cm' }])
  })

  it('splits a sequence on commas and joining words', () => {
    expect(steps('вперёд 20 см, потом налево, затем назад 2 секунды после этого пискни')).toEqual([
      { op: 'move', direction: 'forward', value: 20, unit: 'cm' },
      { op: 'turn', direction: 'left', degrees: 90 },
      { op: 'move', direction: 'back', value: 2, unit: 'seconds' },
      { op: 'beep', note: 72, seconds: 0.3 },
    ])
  })

  it('understands short forms: 30см, 1,5 м, 90°', () => {
    expect(steps('вперед 30см')).toEqual([{ op: 'move', direction: 'forward', value: 30, unit: 'cm' }])
    expect(steps('вперед 1,5 м')).toEqual([{ op: 'move', direction: 'forward', value: 150, unit: 'cm' }])
    expect(steps('направо 90°')).toEqual([{ op: 'turn', direction: 'right', degrees: 90 }])
  })

  it('uses sensible defaults without numbers', () => {
    expect(steps('проедь вперёд')).toEqual([{ op: 'move', direction: 'forward', value: 20, unit: 'cm' }])
    expect(steps('направо')).toEqual([{ op: 'turn', direction: 'right', degrees: 90 }])
    expect(steps('развернись')).toEqual([{ op: 'turn', direction: 'right', degrees: 180 }])
  })

  it('works in Kazakh and English', () => {
    expect(steps('алға отыз сантиметр сосын оңға бұрыл')).toEqual([
      { op: 'move', direction: 'forward', value: 30, unit: 'cm' },
      { op: 'turn', direction: 'right', degrees: 90 },
    ])
    expect(steps('move back 10 cm then turn left 45 degrees')).toEqual([
      { op: 'move', direction: 'back', value: 10, unit: 'cm' },
      { op: 'turn', direction: 'left', degrees: 45 },
    ])
  })

  it('knows speed, the display, sound, waiting and shapes', () => {
    expect(steps('быстро вперед 50 см')).toEqual([
      { op: 'set_speed', speed: 90 },
      { op: 'move', direction: 'forward', value: 50, unit: 'cm' },
    ])
    expect(steps('скорость 40')).toEqual([{ op: 'set_speed', speed: 40 }])
    expect(steps('улыбнись')).toEqual([{ op: 'show_image', image: 'smile', seconds: 1 }])
    expect(steps('подожди 2 секунды')).toEqual([{ op: 'wait', seconds: 2 }])
    expect(steps('нарисуй квадрат')[0]).toMatchObject({ op: 'repeat', times: 4 })
    expect(steps('проедь по кругу')[0]).toMatchObject({ op: 'circle', direction: 'right' })
  })

  it('keeps distances and angles within what a robot on a desk can do', () => {
    expect(steps('вперед 50 метров')).toEqual([{ op: 'move', direction: 'forward', value: 300, unit: 'cm' }])
    expect(steps('направо 5000 градусов')).toEqual([{ op: 'turn', direction: 'right', degrees: 720 }])
  })

  it('stops on "стоп" and reports what it did not understand', () => {
    expect(parseVoice('стоп').stop).toBe(true)
    const r = parseVoice('вперед и спой песню')
    expect(r.steps).toEqual([{ op: 'move', direction: 'forward', value: 20, unit: 'cm' }])
    expect(r.unknown).toEqual(['спой песню'])
  })

  it('always gives a valid program', () => {
    for (const phrase of ['Проедь вперёд на 30 сантиметров и поверни направо', 'нарисуй квадрат 40', 'танцуй', 'по кругу налево', 'назад 3 оборота']) {
      const program = { title: 'Голос', description: '', steps: steps(phrase) }
      expect(parseProgram(program).ok, phrase).toBe(true)
    }
  })
})
