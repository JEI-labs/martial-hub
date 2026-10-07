import { ETenantStatus } from '@prisma/client';

/** Situação da academia como cliente, com a cor que ela merece na lista. */
export const TENANT_STATUS: Record<
  ETenantStatus,
  { label: string; variant: 'success' | 'secondary' | 'destructive' | 'alert' }
> = {
  [ETenantStatus.TRIAL]: { label: 'Em teste', variant: 'alert' },
  [ETenantStatus.ACTIVE]: { label: 'Ativa', variant: 'success' },
  [ETenantStatus.SUSPENDED]: { label: 'Suspensa', variant: 'destructive' },
  [ETenantStatus.CANCELED]: { label: 'Cancelada', variant: 'secondary' },
};

export const TENANT_STATUS_LIST = Object.entries(TENANT_STATUS).map(
  ([value, info]) => ({ value: value as ETenantStatus, ...info }),
);
