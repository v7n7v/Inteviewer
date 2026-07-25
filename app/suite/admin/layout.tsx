import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/shell/AdminShell';
import '@/components/admin/admin-command-grid.css';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
