'use client';

import { useEffect, useState } from 'react';
import { authHelpers } from '@/lib/firebase';
import { authFetch } from '@/lib/auth-fetch';
import {
  applyVerifiedProductAnalyticsConsent,
  clearVerifiedProductAnalyticsConsent,
  GA4_MEASUREMENT_ID,
  PRODUCT_ANALYTICS_CONSENT_EVENT,
  PRODUCT_ANALYTICS_REVOCATION_CHANNEL,
  hasProductAnalyticsConsent,
  markProductAnalyticsRevocationPending,
} from '@/lib/analytics/ga4-privacy';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: any[]) => void;
  }
}

const SCRIPT_ID = 'talent-ga4-consented-script';

function setGaDisabled(disabled: boolean) {
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA4_MEASUREMENT_ID}`] = disabled;
}

function clearGaCookies() {
  const cookieNames = document.cookie
    .split(';')
    .map(value => value.trim().split('=')[0])
    .filter(name => name === '_ga' || name.startsWith('_ga_'));
  for (const name of cookieNames) {
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  }
}

export default function ConsentAwareAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let generation = 0;
    let activeUser: { uid: string } | null = null;
    let revocationChannel: BroadcastChannel | null = null;
    const sync = () => setEnabled(hasProductAnalyticsConsent());
    window.addEventListener(PRODUCT_ANALYTICS_CONSENT_EVENT, sync);
    const refreshAuthoritativeConsent = () => {
      generation += 1;
      const currentGeneration = generation;
      clearVerifiedProductAnalyticsConsent();
      const user = activeUser;
      if (!user) return;
      void (async () => {
        try {
          const response = await authFetch('/api/observability/consent', {
            cache: 'no-store',
          });
          const payload = await response.json().catch(() => ({})) as {
            consent?: {
              productAnalytics?: 'granted' | 'denied';
              noticeVersion?: string;
            };
            policy?: {
              collectionEnabled?: boolean;
              noticeVersion?: string;
            };
          };
          if (currentGeneration !== generation || !response.ok) return;
          const currentNotice = payload.policy?.noticeVersion;
          const consentIsCurrent = typeof currentNotice === 'string'
            && payload.consent?.noticeVersion === currentNotice;
          applyVerifiedProductAnalyticsConsent({
            consent: consentIsCurrent && payload.consent?.productAnalytics === 'granted'
              ? 'granted'
              : 'denied',
            uid: user.uid,
            noticeVersion: currentNotice || 'invalid',
            collectionEnabled: payload.policy?.collectionEnabled === true,
          });
        } catch {
          if (currentGeneration === generation) clearVerifiedProductAnalyticsConsent();
        }
      })();
    };
    const unsubscribe = authHelpers.onAuthStateChanged(user => {
      activeUser = user ? { uid: user.uid } : null;
      refreshAuthoritativeConsent();
    });
    const refreshOnFocus = () => refreshAuthoritativeConsent();
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') refreshAuthoritativeConsent();
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisibility);
    const refreshTimer = window.setInterval(refreshAuthoritativeConsent, 5 * 60_000);
    if (typeof BroadcastChannel !== 'undefined') {
      revocationChannel = new BroadcastChannel(PRODUCT_ANALYTICS_REVOCATION_CHANNEL);
      revocationChannel.addEventListener('message', event => {
        if (event.data?.type === 'product_analytics_revoked') {
          markProductAnalyticsRevocationPending();
        }
      });
    }
    sync();
    return () => {
      generation += 1;
      unsubscribe();
      clearVerifiedProductAnalyticsConsent();
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
      revocationChannel?.close();
      window.removeEventListener(PRODUCT_ANALYTICS_CONSENT_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setGaDisabled(true);
      window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
      clearGaCookies();
      return;
    }

    setGaDisabled(false);
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });

    const configure = () => {
      window.gtag?.('js', new Date());
      window.gtag?.('config', GA4_MEASUREMENT_ID, {
        send_page_view: true,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      });
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === 'true') configure();
      else existing.addEventListener('load', configure, { once: true });
      return () => existing.removeEventListener('load', configure);
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA4_MEASUREMENT_ID)}`;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      configure();
    }, { once: true });
    document.head.appendChild(script);
    return undefined;
  }, [enabled]);

  return null;
}
