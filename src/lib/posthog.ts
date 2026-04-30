import posthog from 'posthog-js';

export const initPostHog = () => {
  const apiKey = import.meta.env.VITE_POSTHOG_API_KEY;
  const apiHost = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

  if (!apiKey) {
    console.warn('PostHog API key not configured');
    return;
  }

  posthog.init(apiKey, {
    api_host: apiHost,
    loaded: (ph) => {
      if (import.meta.env.DEV) {
        ph.debug();
      }
    },
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: true,
      maskTextContent: true,
    },
    persistence: 'localStorage',
  });
};

export default posthog;
