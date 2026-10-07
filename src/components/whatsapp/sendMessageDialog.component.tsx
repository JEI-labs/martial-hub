'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

import { useResetOnChange } from '@/hooks/useResetOnChange/useResetOnChange.hook';
import type { EMessageEvent } from '@prisma/client';

import {
  MESSAGE_EVENTS,
  MESSAGE_EVENT_LIST,
  MESSAGE_PLACEHOLDERS,
} from '@/common/constants/messageEvents';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/forms/formTextArea/TextArea';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';

interface SendMessageDialogProps {
  studentId: string;
  studentName: string;
  open: boolean;
  onOpenChange: (_open: boolean) => void;
}

export function SendMessageDialog({
  studentId,
  studentName,
  open,
  onOpenChange,
}: SendMessageDialogProps) {
  const { toast } = useToast();

  const [event, setEvent] = useState<EMessageEvent>('PROMOTIONAL');
  const [templateId, setTemplateId] = useState<string>('');
  const [body, setBody] = useState('');

  const { data: config } = api.whatsapp.getConfig.useQuery(undefined, {
    enabled: open,
  });
  const { data: templates } = api.whatsapp.listTemplates.useQuery(undefined, {
    enabled: open,
  });

  const forEvent = (templates ?? []).filter((item) => item.event === event);

  // trocar de evento invalida o modelo escolhido do evento anterior
  useResetOnChange([event], () => setTemplateId(''));

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = forEvent.find((item) => item.id === id);
    if (template) setBody(template.body);
  };

  const send = api.whatsapp.sendToStudent.useMutation({
    onSuccess: () => {
      toast({ title: 'Mensagem enviada' });
      setBody('');
      setTemplateId('');
      onOpenChange(false);
    },
    onError: (error) =>
      toast({
        title: 'Não foi possível enviar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const notConfigured = open && config && !config.isActive;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar mensagem</DialogTitle>
          <DialogDescription>
            Para {studentName}, pelo WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {config === null ? (
          <p className="text-destructive-text text-sm">
            Configure a integração de WhatsApp em Configurações antes de enviar.
          </p>
        ) : (
          <div className="space-y-4">
            {notConfigured && (
              <p className="text-destructive-text text-sm">
                A integração está desativada. Ative-a em Configurações.
              </p>
            )}

            <div className="space-y-2">
              <Label>Tipo de mensagem</Label>
              <Select
                value={event}
                onValueChange={(value) => setEvent(value as EMessageEvent)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESSAGE_EVENT_LIST.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                {MESSAGE_EVENTS[event].description}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Modelo</Label>
              {forEvent.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nenhum modelo para este evento. Escreva a mensagem abaixo.
                </p>
              ) : (
                <Select value={templateId} onValueChange={applyTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Partir de um modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {forEvent.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="message-body">Mensagem</Label>
              <Textarea
                id="message-body"
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Olá {{primeiro_nome}}, tudo bem?"
              />
              <p className="text-muted-foreground text-xs">
                Disponíveis:{' '}
                {MESSAGE_PLACEHOLDERS.map((item) => item.token).join(', ')}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={send.isPending || !body.trim() || !config?.isActive}
            onClick={() =>
              send.mutate({
                studentId,
                event,
                templateId: templateId || undefined,
                body,
              })
            }
          >
            <Send className="mr-2 h-4 w-4" />
            {send.isPending ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
