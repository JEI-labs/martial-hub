'use client';

import React from 'react';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useBreadcrumb } from '@/contexts/breadcrumb';

export type BreadcrumbItem = {
  label: string;
  href: string;
};

type Props = {
  className?: string;
};

export function BreadcrumbContainer({ className }: Props): React.JSX.Element {
  const { breadcrumbItems } = useBreadcrumb();

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {breadcrumbItems.map((item, idx) => (
          <React.Fragment key={`${item.href}_${idx}`}>
            {idx !== 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {idx === breadcrumbItems.length - 1 ? (
                <BreadcrumbPage>{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
