'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { sairDaConta } from '@/utils/sair';
import { api } from '@/trpc/react';

/**
 * A saída da parede do 2FA, que até agora não tinha nenhuma.
 *
 * Divide-se em dois porque a parede tem dois fins possíveis: quem acabou de
 * configurar quer entrar, e quem não vai configurar agora precisa de uma porta
 * que não seja fechar o navegador.
 */
export function TwoFactorExit({ destino }: { destino: string }) {
  const router = useRouter();
  /* Mesma query do cartão ao lado: a chave é a mesma, então isto não é uma
     segunda ida ao servidor e o `invalidate` de lá também atualiza aqui. */
  const { data: status } = api.security.status.useQuery();

  if (status?.ativo) {
    return (
      <Button
        onClick={() => {
          /* A parede é desenhada no servidor, que não fica sabendo da ativação
             feita aqui; é o refresh que a derruba. Sem ele, a pessoa
             terminava a configuração e só saía apertando F5. */
          router.push(destino);
          router.refresh();
        }}
      >
        Ir para a página inicial
        <ArrowRight className="ml-2 size-4" />
      </Button>
    );
  }

  /* Enquanto a segunda etapa não existe não há para onde "voltar": a parede
     está no layout de todas as telas de dentro, e qualquer link traria a
     pessoa de volta para cá. A saída honesta é encerrar a sessão. */
  return (
    <Button
      variant="ghost"
      className="text-muted-foreground"
      onClick={() => sairDaConta()}
    >
      <LogOut className="mr-2 size-4" />
      Sair da conta
    </Button>
  );
}
