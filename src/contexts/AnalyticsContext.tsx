import { createContext, useContext, ReactNode } from 'react';
import posthog from 'posthog-js';

interface AnalyticsContextType {
  track: (event: string, properties?: Record<string, any>) => void;
  identify: (userId: string, properties?: Record<string, any>) => void;
  reset: () => void;
  setUserProperties: (properties: Record<string, any>) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export const AnalyticsProvider = ({ children }: { children: ReactNode }) => {
  const value: AnalyticsContextType = {
    track: (event, properties) => {
      if (posthog) {
        posthog.capture(event, properties);
      }
    },
    identify: (userId, properties) => {
      if (posthog) {
        posthog.identify(userId, properties);
      }
    },
    reset: () => {
      if (posthog) {
        posthog.reset();
      }
    },
    setUserProperties: (properties) => {
      if (posthog) {
        posthog.people.set(properties);
      }
    },
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
};

export const useAnalyticsContext = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalyticsContext must be used within AnalyticsProvider');
  }
  return context;
};
