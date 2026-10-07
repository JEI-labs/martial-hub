import * as React from "react";

import { Skeleton } from "./skeleton";

interface UseSkeletonProps {
  waitFor: boolean;
  children: React.JSX.Element;
  className: string;
}

export function UseSkeleton({
  waitFor,
  children,
  className,
}: UseSkeletonProps): React.JSX.Element {
  return !!waitFor ? children : <Skeleton className={className} />;
}
