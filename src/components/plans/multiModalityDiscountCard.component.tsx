'use client';

import { useState } from 'react';
import { Loader2, Percent } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useResetOnChange } from '@/hooks/useResetOnChange/useResetOnChange.hook';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/trpc/react';

/**
 * O desconto da academia para quem faz mais de uma modalidade. Fica na tela
 * de planos porque é parte do preço: quem configura o valor de cada plano é
 * quem decide quanto a segunda modalidade custa.
 */
export function MultiModalityDiscountCard({
  podeEditar,
}: {
  /** Só o dono muda o desconto; os outros só veem. */
  podeEditar: boolean;
}) {
  const { toast } = useToast();
  const utils = api.useUtils();
  const { data } = api.plans.getPricingSettings.useQuery();
  const atual = data?.multiModalityDiscount ?? 0;

  const [valor, setValor] = useState(String(atual));
  useResetOnChange([atual], () => setValor(String(atual)));

  const salvar = api.plans.updatePricingSettings.useMutation({
    onSuccess: async () => {
      await utils.plans.getPricingSettings.invalidate();
      toast({
        title: 'Desconto salvo',
        description: 'Vale para as matrículas feitas daqui em diante.',
      });
    },
    onError: (error) =>
      toast({
        title: 'Não deu para salvar',
        description: error.message,
        variant: 'destructive',
      }),
  });

  if (!data) return null;

  const numero = Number(valor);
  /* Até 99%: com 100 a modalidade sairia de graça, com parcelas de R$ 0
     que ainda assim venceriam e deixariam o aluno "atrasado". */
  const valido =
    valor !== '' && Number.isInteger(numero) && numero >= 0 && numero <= 99;

  return (
    <div className="bg-card shadow-card flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl p-5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
          <Percent className="size-5" aria-hidden />
        </span>
        <div className="min-w-60">
          <p className="font-medium">Desconto a partir da 2ª modalidade</p>
          <p className="text-muted-foreground text-sm">
            {atual > 0
              ? `Quem faz mais de uma modalidade paga ${atual}% a menos em cada uma além da mais cara (pelo valor mensal).`
              : 'Sem desconto: cada modalidade paga o seu valor cheio.'}{' '}
            Mudar aqui vale para as matrículas novas; as que já existem
            continuam como estão.
          </p>
        </div>
      </div>

      {podeEditar && (
        <div className="flex items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="desconto-modalidades">Desconto (%)</Label>
            <Input
              id="desconto-modalidades"
              inputMode="numeric"
              className="w-24"
              value={valor}
              onChange={(event) =>
                setValor(event.target.value.replace(/\D/g, '').slice(0, 2))
              }
            />
          </div>
          <Button
            variant="outline"
            disabled={!valido || numero === atual || salvar.isPending}
            onClick={() => salvar.mutate({ multiModalityDiscount: numero })}
          >
            {salvar.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Salvar
          </Button>
        </div>
      )}
    </div>
  );
}
