import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAnalytics } from '@/hooks/useAnalytics';

export function PageTracker() {
  const location = useLocation();
  const { trackPageView } = useAnalytics();

  useEffect(() => {
    trackPageView(location.pathname, {
      path: location.pathname,
      search: location.search,
    });
  }, [location.pathname, location.search, trackPageView]);

  return null;
}
