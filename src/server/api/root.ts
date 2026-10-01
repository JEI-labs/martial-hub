import { createCallerFactory, createTRPCRouter } from '@/server/api/trpc';
import { studentRouter } from './routers/students';
import { filesRouter } from './routers/files';
import { financeRouter } from './routers/finance';
import { categoryRouter } from './routers/categories';
import { usersRouter } from './routers/users';
import { plansRouter } from './routers/plans';
import { supplierRouter } from './routers/suppliers';
import { paymentsRouter } from './routers/payments';
import { promotionsRouter } from './routers/promotions';
import { whatsappRouter } from './routers/whatsapp';
import { dashboardRouter } from './routers/dashboard';
import { tenantRouter } from './routers/tenant';
import { masterRouter } from './routers/master';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  student: studentRouter,
  files: filesRouter,
  finance: financeRouter,
  category: categoryRouter,
  users: usersRouter,
  plans: plansRouter,
  supplier: supplierRouter,
  payment: paymentsRouter,
  promotion: promotionsRouter,
  whatsapp: whatsappRouter,
  dashboard: dashboardRouter,
  tenant: tenantRouter,
  master: masterRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
