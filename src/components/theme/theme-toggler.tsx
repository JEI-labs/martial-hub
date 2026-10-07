'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { MoonStar, SunMedium } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Troca de tema.
 *
 * Os dois ícones ficam sempre montados e a troca é feita por CSS (`dark:`),
 * não por estado: o tema só é conhecido no cliente, e ler `resolvedTheme` no
 * render divergiria da marcação do servidor. O sol gira e encolhe enquanto a
 * lua entra girando — as duas transições acontecem na mesma passada.
 */
export function ThemeToggler(): React.JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Alternar tema"
      title="Alternar tema"
      className="hover:bg-muted relative size-9 overflow-hidden rounded-full"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <SunMedium className="size-5 scale-100 rotate-0 transition-all duration-500 ease-out dark:scale-0 dark:-rotate-90 dark:opacity-0" />
      <MoonStar className="absolute size-5 scale-0 rotate-90 opacity-0 transition-all duration-500 ease-out dark:scale-100 dark:rotate-0 dark:opacity-100" />
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
}
