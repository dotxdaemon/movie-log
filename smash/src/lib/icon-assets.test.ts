// ABOUTME: Verifies the published app icon assets and metadata point at the Palutena icon set.
// ABOUTME: Locks the favicon and PWA icon files to the expected stock-logo treatment.
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function readProjectFile(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function getFillColors(svg: string): string[] {
  return Array.from(svg.matchAll(/fill="(#[0-9a-f]{6})"/gi), (match) =>
    match[1].toLowerCase(),
  )
}

function isNeutralHaloColor(color: string): boolean {
  const channels = [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ]
  const spread = Math.max(...channels) - Math.min(...channels)
  const average =
    channels.reduce((total, channel) => total + channel, 0) / channels.length

  return spread <= 8 && average >= 32 && average <= 190
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
    expect(icon).toContain('shape-rendering="crispEdges"')
    expect(maskableIcon).toContain('shape-rendering="crispEdges"')
    expect(icon).not.toContain('<rect width="512" height="512" fill=')
    expect(icon).not.toContain('href="data:image/png;base64,')
    expect(maskableIcon).not.toContain('href="data:image/png;base64,')
    expect(icon).not.toContain('stroke=')
    expect(maskableIcon).not.toContain('stroke=')
    expect(icon).not.toContain('fill-opacity=')
    expect(maskableIcon).not.toContain('fill-opacity=')
  })

  it('does not keep the gray halo colors from the tiny stock source', () => {
    const icon = readProjectFile('../../public/icons/pwa-icon.svg')
    const maskableIcon = readProjectFile('../../public/icons/pwa-maskable.svg')

    expect(getFillColors(icon).filter(isNeutralHaloColor)).toEqual([])
    expect(getFillColors(maskableIcon).filter(isNeutralHaloColor)).toEqual([])
  })
})
