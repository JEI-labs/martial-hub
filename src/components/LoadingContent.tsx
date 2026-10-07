import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingContentProps {
  textLoading?: string;
}

export const LoadingContent: React.FC<LoadingContentProps> = ({
  textLoading,
}) => {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <Loader2 className="text-success mb-2 h-6 w-6 animate-spin" />
      <span className="text-muted-foreground">
        {textLoading || 'Carregando...'}
      </span>
    </div>
  );
};
