'use client';

import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from './sidebar';
import { apiRequest, ApiUser } from '../lib/api';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';
  const isPublicPage = pathname === '/' || isLoginPage;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [user, setUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    if (isPublicPage) {
      return;
    }

    let active = true;
    setIsCheckingSession(true);
    apiRequest<ApiUser>('/auth/me')
      .then((response) => {
        if (!active) return;
        setUser(response.data);
        setIsAuthenticated(true);
        if (pathname === '/super-admin' && response.data.role !== 'ADMIN') {
          router.replace('/dashboard');
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setIsAuthenticated(false);
          router.replace('/login?reason=session');
        }
      })
      .finally(() => {
        if (active) setIsCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [isPublicPage, pathname, router]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (isCheckingSession || !isAuthenticated || (pathname === '/super-admin' && user?.role !== 'ADMIN')) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-5 text-sm font-medium text-gray-500">
        Memeriksa sesi...
      </main>
    );
  }

  // Untuk halaman selain login, tampilkan sidebar + konten
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar userRole={user?.role} userName={user?.name} userEmail={user?.email} />
      <main className="min-h-screen min-w-0 flex-1 bg-gray-50">
        {children}
      </main>
    </div>
  );
}
