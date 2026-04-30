import posthog from 'posthog-js';

export const useAnalytics = () => {
  const track = (eventName: string, properties?: Record<string, any>) => {
    if (!posthog) return;
    posthog.capture(eventName, properties);
  };

  const trackPageView = (pageName: string, properties?: Record<string, any>) => {
    if (!posthog) return;
    posthog.capture('$pageview', {
      page_name: pageName,
      ...properties,
    });
  };

  const identify = (userId: string, properties?: Record<string, any>) => {
    if (!posthog) return;
    posthog.identify(userId, properties);
  };

  const setUserProperties = (properties: Record<string, any>) => {
    if (!posthog) return;
    posthog.people.set(properties);
  };

  const reset = () => {
    if (!posthog) return;
    posthog.reset();
  };

  return { track, trackPageView, identify, setUserProperties, reset };
};
