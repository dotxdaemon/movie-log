// ABOUTME: Verifies service worker registration rules for production PWA behavior.
// ABOUTME: Ensures registration is deterministic and safe when APIs are unavailable.
import { describe, expect, it } from 'vitest'
import { registerAppServiceWorker } from './pwa'

describe('registerAppServiceWorker', () => {
  it('registers /sw.js in production when service worker API is available', async () => {
    const calls: string[] = []

    await registerAppServiceWorker({
      isProduction: true,
      navigatorLike: {
        serviceWorker: {
          register: async (scriptUrl: string) => {
            calls.push(scriptUrl)
          },
        },
      },
    })

    expect(calls).toEqual(['/sw.js'])
  })

  it('registers a base-aware service worker path in production', async () => {
    const calls: string[] = []

    await registerAppServiceWorker({
      baseUrl: '/smash/',
      isProduction: true,
      navigatorLike: {
        serviceWorker: {
          register: async (scriptUrl: string) => {
            calls.push(scriptUrl)
          },
        },
      },
    })

    expect(calls).toEqual(['/smash/sw.js'])
  })

  it('does not register when not in production', async () => {
    const calls: string[] = []

    await registerAppServiceWorker({
      isProduction: false,
      navigatorLike: {
        serviceWorker: {
          register: async (scriptUrl: string) => {
            calls.push(scriptUrl)
          },
        },
      },
    })

    expect(calls).toEqual([])
  })

  it('does nothing when service worker API is unavailable', async () => {
    await expect(
      registerAppServiceWorker({
        isProduction: true,
        navigatorLike: {},
      }),
    ).resolves.toBeUndefined()
  })
})
