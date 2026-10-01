'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImageUp, Loader2, Trash2 } from 'lucide-react';

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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { api } from '@/trpc/react';
import { blobUrlToBase64 } from '@/common/utils/files';
import { hexToHslTriple, hslTripleToHex } from '@/utils/colorUtils';

/** Cores prontas, para quem não quer abrir o seletor. */
const SUGESTOES = [
  { nome: 'Terracota', hsl: '9 60% 50%' },
  { nome: 'Vermelho', hsl: '0 72% 48%' },
  { nome: 'Laranja', hsl: '25 85% 50%' },
  { nome: 'Âmbar', hsl: '38 92% 50%' },
  { nome: 'Verde', hsl: '142 70% 38%' },
  { nome: 'Azul', hsl: '221 83% 53%' },
  { nome: 'Roxo', hsl: '262 70% 55%' },
  { nome: 'Grafite', hsl: '240 6% 30%' },
];

type CampoImagem = 'logoUrl' | 'loginImageUrl';

export function BrandingForm() {
  const { toast } = useToast();
  const utils = api.useUtils();

  const { data: tenant, isLoading } = api.tenant.getCurrent.useQuery();

  const [name, setName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null | undefined>(undefined);
  const [loginImageUrl, setLoginImageUrl] = useState<string | null | undefined>(
    undefined,
  );
  const [primaryColor, setPrimaryColor] = useState<string | null | undefined>(
    undefined,
  );
  const [enviando, setEnviando] = useState<CampoImagem | null>(null);

  const upload = api.files.upload.useMutation();
  const salvar = api.tenant.saveBranding.useMutation({
    onSuccess: () => {
      toast({
        title: 'Marca atualizada',
        description: 'A tela de login e o sistema já estão com o visual novo.',
      });
      utils.tenant.getCurrent.invalidate();
    },
    onError: (error) =>
      toast({
        title: 'Não deu para salvar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  /* Os valores vivem no estado só depois que alguém mexe; antes disso, quem
     manda é o que veio do banco. Assim a tela não precisa esperar o load para
     montar nem perde o que foi digitado quando a query revalida. */
  const valorNome = name ?? tenant?.name ?? '';
  const valorLogo =
    logoUrl === undefined ? (tenant?.branding?.logoUrl ?? null) : logoUrl;
  const valorLogin =
    loginImageUrl === undefined
      ? (tenant?.branding?.loginImageUrl ?? null)
      : loginImageUrl;
  const valorCor =
    primaryColor === undefined
      ? (tenant?.branding?.primaryColor ?? null)
      : primaryColor;

  const enviarImagem = async (campo: CampoImagem, arquivo: File) => {
    setEnviando(campo);
    try {
      const objectUrl = URL.createObjectURL(arquivo);
      const base64 = await blobUrlToBase64(objectUrl);
      URL.revokeObjectURL(objectUrl);

      const blob = await upload.mutateAsync({
        filename: `${campo}-${Date.now()}-${arquivo.name}`,
        file: base64,
      });

      if (campo === 'logoUrl') setLogoUrl(blob.url);
      else setLoginImageUrl(blob.url);
    } catch (error) {
      toast({
        title: 'Não deu para enviar a imagem',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setEnviando(null);
    }
  };

  /* A prévia troca só a variável do bloco, então o botão de dentro usa a cor
     escolhida enquanto o resto da tela segue na cor salva. */
  const previewStyle:
    (React.CSSProperties & Record<'--primary', string>) | undefined = valorCor
    ? { '--primary': valorCor }
    : undefined;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Identidade</CardTitle>
          <CardDescription>
            O nome aparece na tela de login e nas mensagens do sistema.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="nome-academia">Nome da academia</Label>
            <Input
              id="nome-academia"
              value={valorNome}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          {tenant?.domains.length ? (
            <div className="space-y-2">
              <Label>Endereços</Label>
              <div className="flex flex-wrap gap-2">
                {tenant.domains.map((dominio) => (
                  <span
                    key={dominio.hostname}
                    className="bg-muted/60 text-muted-foreground rounded-full px-3 py-1 text-xs"
                  >
                    {dominio.hostname}
                    {dominio.isPrimary && ' · principal'}
                    {!dominio.verifiedAt && ' · aguardando DNS'}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imagens</CardTitle>
          <CardDescription>
            PNG ou JPG, até 4,5 MB. Sem imagem, o sistema usa a sua própria.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-2">
          <CampoDeImagem
            titulo="Logo"
            ajuda="Aparece no topo da barra lateral e acima do formulário de login. Fundo transparente fica melhor."
            url={valorLogo}
            enviando={enviando === 'logoUrl'}
            onPick={(arquivo) => enviarImagem('logoUrl', arquivo)}
            onClear={() => setLogoUrl(null)}
            className="bg-sidebar h-28"
            contain
          />

          <CampoDeImagem
            titulo="Imagem do login"
            ajuda="Ocupa a metade esquerda da tela de entrada. Horizontal, de preferência a partir de 1600px."
            url={valorLogin}
            enviando={enviando === 'loginImageUrl'}
            onPick={(arquivo) => enviarImagem('loginImageUrl', arquivo)}
            onClear={() => setLoginImageUrl(null)}
            className="h-28"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cor principal</CardTitle>
          <CardDescription>
            Vale para botões, destaques e gráficos, nos dois temas.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {SUGESTOES.map((sugestao) => (
              <button
                key={sugestao.hsl}
                type="button"
                title={sugestao.nome}
                onClick={() => setPrimaryColor(sugestao.hsl)}
                style={{ backgroundColor: `hsl(${sugestao.hsl})` }}
                className={cn(
                  'size-9 rounded-full transition-transform',
                  valorCor === sugestao.hsl
                    ? 'ring-foreground scale-110 ring-2 ring-offset-2'
                    : 'hover:scale-105',
                )}
              >
                <span className="sr-only">{sugestao.nome}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="cor">Outra cor</Label>
              <input
                id="cor"
                type="color"
                value={hslTripleToHex(valorCor)}
                onChange={(event) =>
                  setPrimaryColor(hexToHslTriple(event.target.value))
                }
                className="border-border h-10 w-16 cursor-pointer rounded-xl border bg-transparent p-1"
              />
            </div>

            {valorCor && (
              <Button
                variant="ghost"
                onClick={() => setPrimaryColor(null)}
                className="text-muted-foreground"
              >
                Voltar ao padrão
              </Button>
            )}
          </div>

          {/* Prévia com a cor escolhida de verdade, não com a do tema: é o
              único jeito de saber como fica antes de salvar. */}
          <div
            className="bg-muted/60 flex flex-wrap items-center gap-3 rounded-xl p-4"
            style={previewStyle}
          >
            <Button type="button">Botão principal</Button>
            <span className="bg-primary/15 text-primary rounded-full px-3 py-1 text-xs font-medium">
              Destaque
            </span>
            <span className="text-muted-foreground text-xs">
              prévia · não salva nada
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          disabled={salvar.isPending || valorNome.trim().length < 2}
          onClick={() =>
            salvar.mutate({
              name: valorNome.trim(),
              logoUrl: valorLogo,
              loginImageUrl: valorLogin,
              primaryColor: valorCor,
            })
          }
        >
          {salvar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}

function CampoDeImagem({
  titulo,
  ajuda,
  url,
  enviando,
  onPick,
  onClear,
  className,
  contain,
}: {
  titulo: string;
  ajuda: string;
  url: string | null;
  enviando: boolean;
  onPick: (_arquivo: File) => void;
  onClear: () => void;
  className?: string;
  contain?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <Label>{titulo}</Label>

      <div
        className={cn(
          'bg-muted/60 flex items-center justify-center overflow-hidden rounded-xl',
          className,
        )}
      >
        {enviando ? (
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        ) : url ? (
          <Image
            src={url}
            alt={titulo}
            width={640}
            height={240}
            unoptimized
            className={cn(
              'h-full w-full',
              contain ? 'object-contain p-2' : 'object-cover',
            )}
          />
        ) : (
          <span className="text-muted-foreground text-xs">sem imagem</span>
        )}
      </div>

      <p className="text-muted-foreground text-xs">{ajuda}</p>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={enviando}
          onClick={() => input.current?.click()}
        >
          <ImageUp className="mr-2 size-4" />
          {url ? 'Trocar' : 'Enviar'}
        </Button>

        {url && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive-text"
            onClick={onClear}
          >
            <Trash2 className="mr-2 size-4" />
            Remover
          </Button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(event) => {
          const arquivo = event.target.files?.[0];
          if (arquivo) onPick(arquivo);
          event.target.value = '';
        }}
      />
    </div>
  );
}
