'use client';

import { use } from 'react';

import { TenantDetail } from '@/components/master/tenantDetail.component';

export default function MasterCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <TenantDetail tenantId={id} />;
}
