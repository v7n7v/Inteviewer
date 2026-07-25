'use client';

import { ReactNode, useEffect } from 'react';
import { ThemeProvider } from './ThemeProvider';
import Toast, { showToast } from './Toast';
import AttributionCapture from './AttributionCapture';
import { analytics } from '@/lib/analytics';
import { clearPendingAuthRedirect, consumePendingAuthRedirect } from '@/lib/auth-redirect';
import { authHelpers } from '@/lib/firebase';
import { useStore } from '@/lib/store';
import { armPendingSonaResumeExpiry } from '@/lib/assistant/pending-resume-handoff';
import { readStoredAttribution } from '@/lib/attribution';

interface ClientProvidersProps {
    children: ReactNode;
}

let googleRedirectCompletion: ReturnType<typeof authHelpers.completeGoogleRedirect> | null = null;
let googleRedirectHandled = false;

function completeGoogleRedirectOnce() {
    googleRedirectCompletion ??= authHelpers.completeGoogleRedirect();
    return googleRedirectCompletion;
}

function AuthRedirectHandler() {
    const setUser = useStore((state) => state.setUser);

    useEffect(() => {
        let cancelled = false;
        armPendingSonaResumeExpiry();

        completeGoogleRedirectOnce().then((result) => {
            if (cancelled || googleRedirectHandled) return;
            googleRedirectHandled = true;

            if (result.status === 'success') {
                setUser(result.user);
                analytics.authLifecycle('google', 'success');
                if (result.isNewUser) {
                    analytics.signUp('google');
                    const attribution = readStoredAttribution();
                    if (attribution?.utmSource) analytics.socialSignup(attribution.utmSource);
                    showToast('Account created with Google!', 'check_circle');
                    void result.user.getIdToken()
                        .then((token) => fetch('/api/email/welcome', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ email: result.user.email, name: result.user.displayName }),
                        }))
                        .catch(() => {});
                } else {
                    analytics.login('google');
                    showToast('Signed in with Google!', 'check_circle');
                }

                const redirectTarget = consumePendingAuthRedirect();
                if (redirectTarget) {
                    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                    if (currentPath !== redirectTarget) window.location.assign(redirectTarget);
                }
            } else if (result.status === 'error') {
                clearPendingAuthRedirect();
                analytics.authLifecycle('google', 'error', result.error.code);
                showToast(result.error.message, 'error');
            }
        }).catch(() => {
            if (cancelled || googleRedirectHandled) return;
            googleRedirectHandled = true;

            clearPendingAuthRedirect();
            analytics.authLifecycle('google', 'error', 'auth/unknown');
            showToast('Google sign-in could not finish. Please try again.', 'error');
        });

        return () => {
            cancelled = true;
        };
    }, [setUser]);

    return null;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
    return (
        <ThemeProvider>
            <AttributionCapture />
            <AuthRedirectHandler />
            {children}
            <Toast />
        </ThemeProvider>
    );
}
