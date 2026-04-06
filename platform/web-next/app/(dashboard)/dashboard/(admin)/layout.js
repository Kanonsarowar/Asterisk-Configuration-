'use client';

import RequireStaff from '@/components/dashboard/RequireStaff';

export default function AdminSectionLayout({ children }) {
  return <RequireStaff>{children}</RequireStaff>;
}
