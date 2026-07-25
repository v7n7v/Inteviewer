import { notFound } from 'next/navigation';
import { AdminCommandGridVisualReview } from '@/components/admin/visual-review/AdminCommandGridVisualReview';
import '@/components/admin/admin-command-grid.css';

export default function AdminCommandGridPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <AdminCommandGridVisualReview />;
}
