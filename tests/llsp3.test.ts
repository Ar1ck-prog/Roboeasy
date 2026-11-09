import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { SPIKE_PROJECT_VERSION, createLlsp3 } from '../lib/spike/llsp3'
import { EVERY_FUNCTIONS, EVERY_STEP, expectLinked, validateSb3, valid } from './helpers'

async function unzip(blob: Blob) {
  return JSZip.loadAsync(await blob.arrayBuffer())
}

describe('createLlsp3', () => {
  it('packs word blocks like the SPIKE App: manifest + scratch.sb3 + icon', async () => {
    const program = valid({ title: 'All', description: '', steps: EVERY_STEP, functions: EVERY_FUNCTIONS })
    const zip = await unzip(await createLlsp3('Моя программа', { format: 'blocks', program }))
    expect(Object.keys(zip.files).sort()).toEqual(['icon.svg', 'manifest.json', 'scratch.sb3'])

    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    expect(manifest).toMatchObject({ type: 'word-blocks', version: SPIKE_PROJECT_VERSION, name: 'Моя программа', hardware: {} })
    expect(manifest.id).toHaveLength(12)

    const sb3 = await JSZip.loadAsync(await zip.file('scratch.sb3')!.async('uint8array'))
    expect(Object.keys(sb3.files).sort()).toEqual(['d41d8cd98f00b204e9800998ecf8427e.svg', 'project.json'])
    const project = JSON.parse(await sb3.file('project.json')!.async('string'))
    await validateSb3(project)
    expectLinked(project.targets[1].blocks)
    expect(manifest.extensions).toEqual(project.extensions)
  })

  it('packs Python with projectbody.json', async () => {
    const code = 'import runloop\n\nasync def main():\n    pass\n\nrunloop.run(main())\n'
    const zip = await unzip(await createLlsp3('py', { format: 'python', code }))
    expect(Object.keys(zip.files).sort()).toEqual(['icon.svg', 'manifest.json', 'projectbody.json'])
    expect(JSON.parse(await zip.file('projectbody.json')!.async('string'))).toEqual({ main: code })
    expect(JSON.parse(await zip.file('manifest.json')!.async('string'))).toMatchObject({ type: 'python', hardware: { python: { type: 'flipper' } } })
  })
})
