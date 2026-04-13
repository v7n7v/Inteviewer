'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from './ThemeProvider';

interface ClientProvidersProps {
    children: ReactNode;
}

export default function ClientProviders({ children }: ClientProvidersProps) {
    return (
        <ThemeProvider>
            {children}
        </ThemeProvider>
    );
}
