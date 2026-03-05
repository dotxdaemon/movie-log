// ABOUTME: Verifies the published app icon assets and metadata point at the Palutena icon set.
// ABOUTME: Locks the favicon and PWA icon files to the expected stock-logo treatment.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readProjectFile(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

describe('icon assets', () => {
  it('uses the Palutena icon artwork for browser and PWA metadata', () => {
    const html = readProjectFile('../../index.html')
    const manifest = readProjectFile('../../public/manifest.webmanifest')
    const icon = readProjectFile('../../public/icons/pwa-icon.svg')
    const maskableIcon = readProjectFile('../../public/icons/pwa-maskable.svg')

    expect(html).toContain('href="/icons/pwa-icon.svg"')
    expect(manifest).toContain('"src": "/icons/pwa-icon.svg"')
    expect(manifest).toContain('"src": "/icons/pwa-maskable.svg"')
    expect(icon).toContain('aria-label="Palutena stock logo icon"')
    expect(maskableIcon).toContain('aria-label="Palutena stock logo maskable icon"')
  })
})
