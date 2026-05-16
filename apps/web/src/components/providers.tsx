'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: (failureCount, error: unknown) => {
              const status = (error as { response?: { status?: number } })?.response
                ?.status;
              if (status === 401 || status === 403) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  useEffect(() => {
    // Rehydrate zustand store from sessionStorage after client mount
    useAuthStore.persist.rehydrate();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
