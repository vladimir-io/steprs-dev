import { posthog } from 'posthog-js'

export const initTelemetry = () => {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: 'https://us.i.posthog.com',
      capture_pageview: true, // Captures high-level pathing for VCs
      persistence: 'localStorage' // Aligns tracking securely with your existing persistence layer
    })
  }
}

export const trackInteraction = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture(eventName, properties)
  }
}
