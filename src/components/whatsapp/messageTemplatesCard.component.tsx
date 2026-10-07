'use client';

import { useRef, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { EMessageEvent, MessageTemplate } from '@prisma/client';

import {
  MESSAGE_EVENTS,
  MESSAGE_EVENT_LIST,
} from '@/common/constants/messageEvents';
import { MessagePreview } from '@/components/whatsapp/messagePreview.component';
import { VariableChips } from '@/components/whatsapp/variableChips.component';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/emptyState/emptyState.component';
import { Input } from '@/components/ui/input';
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

const EMPTY = {
  id: '',
  event: 'PROMOTIONAL' as EMessageEvent,
  name: '',
  body: '',
  providerTemplateName: '',
  providerLanguage: 'pt_BR',
};

export function MessageTemplatesCard() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = api.whatsapp.listTemplates.useQuery();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  /** Insere onde o cursor está, não no fim: no meio da frase é o normal. */
  const insertVariable = (token: string) => {
    const field = bodyRef.current;
    const value = draft.body;
    const start = field?.selectionStart ?? value.length;
    const end = field?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;

    setDraft((prev) => ({ ...prev, body: next }));

    // devolve o cursor para depois da variável recém-inserida
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const { data: config } = api.whatsapp.getConfig.useQuery();
  /* O nome do template só existe na Meta: nos outros provedores o texto sai
     livre, e o campo só confundiria. */
  const isMeta = config?.provider === 'META';

  const save = api.whatsapp.saveTemplate.useMutation({
    onSuccess: () => {
      toast({ title: 'Modelo salvo' });
      setOpen(false);
      refetch();
    },
    onError: (error) =>
      toast({
        title: 'Erro ao salvar modelo',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const remove = api.whatsapp.deleteTemplate.useMutation({
    onSuccess: () => {
      toast({ title: 'Modelo excluído' });
      refetch();
    },
  });

  const openNew = () => {
    setDraft(EMPTY);
    setOpen(true);
  };

  const openEdit = (template: MessageTemplate) => {
    setDraft({
      id: template.id,
      event: template.event,
      name: template.name,
      body: template.body,
      providerTemplateName: template.providerTemplateName ?? '',
      providerLanguage: template.providerLanguage ?? 'pt_BR',
    });
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Modelos de mensagem</CardTitle>
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo modelo
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm">Carregando modelos…</p>
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="Nenhum modelo cadastrado"
            description="Crie um modelo por tipo de evento para reutilizar o texto nos envios."
          />
        ) : (
          data.map((template) => (
            <div
              key={template.id}
              className="flex items-start justify-between gap-4 rounded-md border p-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{template.name}</p>
                  <Badge variant="secondary">
                    {MESSAGE_EVENTS[template.event].label}
                  </Badge>
                  {MESSAGE_EVENTS[template.event].automatic && (
                    <Badge variant="outline">Automático</Badge>
                  )}
                  {isMeta &&
                    (template.providerTemplateName ? (
                      <Badge variant="outline">
                        {template.providerTemplateName}
                      </Badge>
                    ) : (
                      <Badge variant="alert">Só dentro de 24h</Badge>
                    ))}
                </div>
                <p className="text-muted-foreground line-clamp-2 text-sm whitespace-pre-wrap">
                  {template.body}
                </p>
              </div>

              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => openEdit(template)}
                >
                  <Pencil className="h-4 w-4" />
                  <span className="sr-only">Editar modelo</span>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive-text hover:text-destructive-text h-8 w-8"
                  onClick={() => remove.mutate({ id: template.id })}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Excluir modelo</span>
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {draft.id ? 'Editar modelo' : 'Novo modelo'}
            </DialogTitle>
            <DialogDescription>
              {MESSAGE_EVENTS[draft.event].description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Evento</Label>
              <Select
                value={draft.event}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    event: value as EMessageEvent,
                  }))
                }
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-name">Nome</Label>
              <Input
                id="template-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Ex: Cobrança amigável"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-body">Mensagem</Label>
              <Textarea
                ref={bodyRef}
                id="template-body"
                rows={5}
                value={draft.body}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, body: event.target.value }))
                }
                placeholder="Olá {{primeiro_nome}}, tudo bem?"
              />
              <VariableChips onInsert={insertVariable} />

              <p className="text-muted-foreground text-xs">
                Clique para inserir onde o cursor está, ou arraste para dentro
                do texto. Na hora do envio elas viram os dados do aluno.
              </p>

              <MessagePreview body={draft.body} />
            </div>

            {isMeta && (
              <div className="bg-muted/40 space-y-2 rounded-xl p-3">
                <Label htmlFor="template-provider">
                  Nome do template na Meta
                </Label>
                <Input
                  id="template-provider"
                  value={draft.providerTemplateName}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      providerTemplateName: event.target.value,
                    }))
                  }
                  placeholder="cobranca_amigavel"
                />
                <p className="text-muted-foreground text-xs">
                  Obrigatório para mensagens que partem de você: a Meta só
                  entrega texto livre dentro da janela de 24h. O texto acima
                  precisa bater com o template aprovado — os placeholders viram
                  parâmetros na ordem em que aparecem.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={save.isPending || !draft.name || !draft.body}
              onClick={() =>
                save.mutate({
                  id: draft.id || undefined,
                  event: draft.event,
                  name: draft.name,
                  body: draft.body,
                  providerTemplateName: draft.providerTemplateName || null,
                  providerLanguage: draft.providerLanguage || 'pt_BR',
                  isActive: true,
                })
              }
            >
              {save.isPending ? 'Salvando...' : 'Salvar modelo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
