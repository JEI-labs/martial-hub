'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { EMessageEvent } from '@prisma/client';
import {
  Cake,
  CalendarCheck,
  CalendarClock,
  Loader2,
  Play,
  TriangleAlert,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/emptyState/emptyState.component';
import { Skeleton } from '@/components/ui/skeleton';
import { MESSAGE_EVENTS } from '@/common/constants/messageEvents';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/react';

type Automation = RouterOutputs['whatsapp']['listAutomations'][number];

const ICONS: Partial<Record<EMessageEvent, typeof Cake>> = {
  PAYMENT_DUE_SOON: CalendarClock,
  PAYMENT_DUE_TODAY: CalendarCheck,
  PAYMENT_OVERDUE: TriangleAlert,
  BIRTHDAY: Cake,
};

/** Só dois eventos usam a quantidade de dias; no resto o campo não faz sentido. */
const OFFSET_LABEL: Partial<Record<EMessageEvent, string>> = {
  PAYMENT_DUE_SOON: 'Quantos dias antes',
  PAYMENT_OVERDUE: 'Até quantos dias de atraso',
};

export function AutomationsCard() {
  const { toast } = useToast();
  const utils = api.useUtils();
  const {
    data: automations,
    isLoading,
    error,
    refetch,
  } = api.whatsapp.listAutomations.useQuery();
  const [savingEvent, setSavingEvent] = useState<EMessageEvent | null>(null);

  const save = api.whatsapp.saveAutomation.useMutation({
    onSuccess: () => {
      utils.whatsapp.listAutomations.invalidate();
      setSavingEvent(null);
    },
    onError: (error) => {
      setSavingEvent(null);
      utils.whatsapp.listAutomations.invalidate();
      toast({
        title: 'Não deu para salvar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const run = api.whatsapp.runAutomationsNow.useMutation({
    onSuccess: (report) => {
      const parts = [
        `${report.sent} enviada(s)`,
        report.failed > 0 ? `${report.failed} com falha` : null,
        report.skipped.length > 0 ? report.skipped.join('; ') : null,
      ].filter(Boolean);

      toast({ title: 'Rotina executada', description: parts.join(' · ') });
      utils.whatsapp.listLogs.invalidate();
    },
    onError: (error) =>
      toast({
        title: 'Erro ao executar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  /* Esqueleto com o formato do conteúdo final: um spinner solto no meio da
     página fazia o layout saltar quando os dados chegavam. */
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-36 rounded-full" />
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="bg-muted/60 flex items-start gap-3 rounded-xl p-4"
            >
              <Skeleton className="size-10 shrink-0" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !automations) {
    /* A mensagem do servidor é para quem desenvolve ("Cannot read properties
       of undefined"), não para o dono da academia: ela vai para o console e a
       tela mostra o que dá para fazer. */
    if (error) console.error('Falha ao carregar automações:', error);

    return (
      <EmptyState
        title="Não foi possível carregar agora"
        description="Pode ter sido uma instabilidade momentânea. Tente de novo em alguns instantes."
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        }
      />
    );
  }

  const update = (automation: Automation, changes: Partial<Automation>) => {
    setSavingEvent(automation.event);
    save.mutate({
      event: automation.event,
      isActive: changes.isActive ?? automation.isActive,
      offsetDays: changes.offsetDays ?? automation.offsetDays,
      sendHour: changes.sendHour ?? automation.sendHour,
      templateId:
        changes.templateId !== undefined
          ? changes.templateId
          : automation.templateId,
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Mensagens automáticas</CardTitle>
          <CardDescription>
            O sistema manda sozinho, uma vez por dia no máximo para cada aluno.
            Precisa de um modelo escrito para o evento e do número conectado.
          </CardDescription>
        </div>

        <Button
          variant="outline"
          disabled={run.isPending}
          onClick={() => run.mutate()}
        >
          {run.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Play className="mr-2 size-4" />
          )}
          Executar agora
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {automations.map((automation) => {
          const info = MESSAGE_EVENTS[automation.event];
          const Icon = ICONS[automation.event] ?? Cake;
          const offsetLabel = OFFSET_LABEL[automation.event];
          const hasTemplate = automation.templates.length > 0;
          const isSaving = savingEvent === automation.event;

          return (
            <div
              key={automation.event}
              className="bg-muted/60 flex flex-col gap-4 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-medium">{info.label}</p>
                  <p className="text-muted-foreground text-sm">
                    {info.description}
                  </p>
                </div>

                {isSaving ? (
                  <Loader2 className="text-muted-foreground mt-1 size-4 animate-spin" />
                ) : (
                  <Switch
                    checked={automation.isActive}
                    disabled={!hasTemplate}
                    onCheckedChange={(checked) =>
                      update(automation, { isActive: checked })
                    }
                  />
                )}
              </div>

              {!hasTemplate ? (
                <p className="text-muted-foreground text-xs">
                  Nenhum modelo escrito para esta situação.{' '}
                  <Link
                    href="/whatsapp/modelos"
                    className="text-primary hover:underline"
                  >
                    Criar modelo
                  </Link>
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-3">
                    <Label className="text-xs">Modelo usado</Label>
                    <Select
                      value={automation.templateId ?? undefined}
                      onValueChange={(value) =>
                        update(automation, { templateId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha o texto" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {automation.templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {offsetLabel && (
                    <div className="space-y-2">
                      <Label
                        className="text-xs"
                        htmlFor={`days-${automation.event}`}
                      >
                        {offsetLabel}
                      </Label>
                      <Input
                        id={`days-${automation.event}`}
                        type="number"
                        min={1}
                        max={30}
                        defaultValue={automation.offsetDays}
                        onBlur={(event) => {
                          const value = Number(event.target.value);
                          if (value && value !== automation.offsetDays) {
                            update(automation, { offsetDays: value });
                          }
                        }}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label
                      className="text-xs"
                      htmlFor={`hour-${automation.event}`}
                    >
                      A partir das
                    </Label>
                    <Input
                      id={`hour-${automation.event}`}
                      type="number"
                      min={0}
                      max={23}
                      defaultValue={automation.sendHour}
                      onBlur={(event) => {
                        const value = Number(event.target.value);
                        if (value !== automation.sendHour) {
                          update(automation, { sendHour: value });
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
