/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import * as React from 'react';
import { type ThemeProviderProps } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export function QueryProvider({
  children,

  ...props
}: ThemeProviderProps): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}> {children}</QueryClientProvider>
  );
}
