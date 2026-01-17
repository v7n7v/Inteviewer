'use client';

import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

// Hook to trigger confetti celebration
export function useConfetti() {
    const fire = (options?: confetti.Options) => {
        const defaults: confetti.Options = {
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#00f5ff', '#0099ff', '#a855f7', '#22c55e', '#f59e0b'],
        };

        confetti({
            ...defaults,
            ...options,
        });
    };

    const fireMultiple = () => {
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;

        const interval = setInterval(() => {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                clearInterval(interval);
                return;
            }

            const particleCount = 50 * (timeLeft / duration);

            confetti({
                particleCount,
                startVelocity: 30,
                spread: 360,
                origin: {
                    x: Math.random(),
                    y: Math.random() - 0.2,
                },
                colors: ['#00f5ff', '#0099ff', '#a855f7', '#22c55e'],
            });
        }, 250);
    };

    const fireSides = () => {
        confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#00f5ff', '#0099ff', '#a855f7'],
        });
        confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#00f5ff', '#0099ff', '#a855f7'],
        });
    };

    return { fire, fireMultiple, fireSides };
}

// Standalone function for importing
export const celebrateSuccess = () => {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00f5ff', '#0099ff', '#a855f7', '#22c55e', '#f59e0b'],
    });
};
