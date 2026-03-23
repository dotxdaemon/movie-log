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

function getPathBounds(svg: string): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  const transformMatch = svg.match(
    /<g transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)">/i,
  )

  if (!transformMatch) {
    throw new Error('Missing icon transform')
  }

  const [, translateXText, translateYText, scaleText] = transformMatch
  const translateX = Number.parseFloat(translateXText)
  const translateY = Number.parseFloat(translateYText)
  const scale = Number.parseFloat(scaleText)
  const coordinates = Array.from(
    svg.matchAll(/ d="([^"]+)"/g),
    (match) => match[1],
  ).flatMap((path) =>
    Array.from(path.matchAll(/-?\d+(?:\.\d+)?/g), (match) =>
      Number.parseFloat(match[0]),
    ),
  )

  if (coordinates.length === 0) {
    throw new Error('Missing icon path coordinates')
  }

  const xs: number[] = []
  const ys: number[] = []

  for (let index = 0; index < coordinates.length; index += 2) {
    xs.push(coordinates[index] * scale + translateX)
    ys.push(coordinates[index + 1] * scale + translateY)
  }

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
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

    expect(html).toContain('href="%BASE_URL%icons/pwa-icon.svg"')
    expect(html).toContain('href="%BASE_URL%manifest.webmanifest"')
    expect(manifest).toContain('"src": "./icons/pwa-icon.svg"')
    expect(manifest).toContain('"src": "./icons/pwa-maskable.svg"')
    expect(icon).toContain('aria-label="Palutena stock logo icon"')
    expect(maskableIcon).toContain('aria-label="Palutena stock logo maskable icon"')
    expect(icon).not.toContain('<rect width="512" height="512" fill=')
    expect(icon).not.toContain('href="data:image/png;base64,')
    expect(maskableIcon).not.toContain('href="data:image/png;base64,')
    expect(icon).not.toContain('fill-opacity=')
    expect(maskableIcon).not.toContain('fill-opacity=')
  })

  it('does not keep the gray halo colors from the tiny stock source', () => {
    const icon = readProjectFile('../../public/icons/pwa-icon.svg')
    const maskableIcon = readProjectFile('../../public/icons/pwa-maskable.svg')

    expect(getFillColors(icon).filter(isNeutralHaloColor)).toEqual([])
    expect(getFillColors(maskableIcon).filter(isNeutralHaloColor)).toEqual([])
  })

  it('does not ship the icon as a pixel-sprite trace', () => {
    const icon = readProjectFile('../../public/icons/pwa-icon.svg')
    const maskableIcon = readProjectFile('../../public/icons/pwa-maskable.svg')
    const iconPathCount = (icon.match(/<path\b/g) ?? []).length
    const maskablePathCount = (maskableIcon.match(/<path\b/g) ?? []).length

    expect(iconPathCount).toBeGreaterThanOrEqual(5)
    expect(iconPathCount).toBeLessThanOrEqual(8)
    expect(maskablePathCount).toBeGreaterThanOrEqual(5)
    expect(maskablePathCount).toBeLessThanOrEqual(8)
    expect(icon).not.toContain('shape-rendering="crispEdges"')
    expect(maskableIcon).not.toContain('shape-rendering="crispEdges"')
  })

  it('keeps the drawn icon inset from the canvas edges', () => {
    const icon = readProjectFile('../../public/icons/pwa-icon.svg')
    const maskableIcon = readProjectFile('../../public/icons/pwa-maskable.svg')
    const iconBounds = getPathBounds(icon)
    const maskableBounds = getPathBounds(maskableIcon)

    expect(iconBounds.minX).toBeGreaterThanOrEqual(40)
    expect(iconBounds.minY).toBeGreaterThanOrEqual(40)
    expect(iconBounds.maxX).toBeLessThanOrEqual(472)
    expect(iconBounds.maxY).toBeLessThanOrEqual(456)
    expect(maskableBounds.minX).toBeGreaterThanOrEqual(72)
    expect(maskableBounds.minY).toBeGreaterThanOrEqual(72)
    expect(maskableBounds.maxX).toBeLessThanOrEqual(440)
    expect(maskableBounds.maxY).toBeLessThanOrEqual(440)
  })
})
