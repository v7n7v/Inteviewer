'use client';

import { useEffect, useState } from 'react';

interface ToastMessage {
  message: string;
  icon: string;
  id: number;
}

let toastId = 0;
const toastListeners = new Set<(toast: ToastMessage) => void>();

export function showToast(message: string, icon: string = '✓') {
  const toast: ToastMessage = { message, icon, id: toastId++ };
  toastListeners.forEach((listener) => listener(toast));
}

export default function Toast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (toast: ToastMessage) => {
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 3000);
    };

    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="glass rounded-xl px-6 py-4 flex items-center gap-3 neon-border animate-in slide-in-from-right duration-300"
        >
          <span className="text-xl">{toast.icon}</span>
          <span className="text-sm">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
