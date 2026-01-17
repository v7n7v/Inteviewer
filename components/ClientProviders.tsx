'use client';

import { ReactNode } from 'react';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import CommandPalette from '@/components/CommandPalette';

interface ClientProvidersProps {
    children: ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
    return (
        <>
            {children}
            <KeyboardShortcuts />
            <CommandPalette />
        </>
    );
}
