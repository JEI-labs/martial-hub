# WhatsApp

O provedor em uso é o **Evolution API**: gratuito, aceita texto livre a
qualquer hora e hospeda várias instâncias num servidor só — o que importa se
o sistema for vendido para mais de uma academia.

O código também fala com a Cloud API oficial da Meta e com a Z-API. O
`buildRequest` em `src/server/whatsapp/client.ts` isola as diferenças; trocar
de provedor é escolher outro na tela de Configurações.

## Onde hospedar

O Evolution mantém um WebSocket aberto com o WhatsApp, então precisa de um
processo **sempre ligado** — por isso **não roda na Vercel**, que é
serverless.

A opção gratuita de verdade é a **Oracle Cloud Always Free**: VM ARM
(4 vCPU / 24 GB) sem prazo de expiração. Render e Railway têm plano gratuito,
mas hibernam por inatividade, e quando o processo dorme a sessão do WhatsApp
cai e é preciso ler o QR de novo. Um VPS simples (Hetzner, Contabo) sai por
~R$25/mês e dá menos trabalho.

## Criando a VM na Oracle

Menu ☰ → **Compute** → **Instances** → **Create instance**.

- **Image**: Ubuntu 22.04 ou 24.04 (o Oracle Linux exige mais ajuste de
  firewall)
- **Shape**: _Change shape_ → **Ampere** → `VM.Standard.A1.Flex`, com
  **1 OCPU e 6 GB** — sobra para o Evolution e deixa margem do Always Free
  para outra VM
- **SSH keys**: salve a chave privada; sem ela não há como entrar
- deixe criar a VCN automaticamente, com IP público

> **A capacidade de ARM em São Paulo vive esgotada.** O erro _"Out of capacity
> for shape VM.Standard.A1.Flex"_ é comum e não indica erro de configuração.
>
> A mensagem sugere tentar outro availability domain, mas **São Paulo só tem
> um (AD-1)** — essa saída não existe. Trocar de região também não ajuda:
> **recursos Always Free só valem na região natal da conta**, então numa
> região nova a VM seria cobrada.
>
> Restam duas saídas de verdade:
>
> 1. **Shape AMD** `VM.Standard.E2.1.Micro` — Always Free, quase sempre
>    disponível, mas 1 GB de RAM. Atende uma instância do Evolution **com
>    swap** (abaixo); sem swap, o contêiner morre por falta de memória.
> 2. **Insistir no ARM** — a capacidade libera em ciclos, costuma abrir de
>    madrugada. Não dá para prever quando.

### Se for de AMD (1 GB), crie swap antes

O Evolution com Baileys usa entre 150 e 400 MB por instância; somado ao Ubuntu
e ao Docker, 1 GB fica no limite. Sem swap, o kernel mata o contêiner no
primeiro pico:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Liberando a porta

Na VM criada → **Virtual cloud network** → **Security Lists** → _Default
Security List_ → **Add Ingress Rule**:

| Campo                  | Valor       |
| ---------------------- | ----------- |
| Source CIDR            | `0.0.0.0/0` |
| IP Protocol            | TCP         |
| Destination Port Range | `8080`      |

Isso libera só no painel. O firewall **dentro** da VM continua fechado — ver
o passo de `iptables` abaixo.

## Subindo o Evolution

A **v2 exige PostgreSQL** (o projeto migrou para Prisma), então um `docker run`
isolado não basta. Na VM, com Docker instalado
(`curl -fsSL https://get.docker.com | sh`), crie `~/evolution/docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: TROQUE_ESTA_SENHA
      POSTGRES_DB: evolution
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U evolution']
      interval: 10s
      retries: 5

  evolution:
    image: evoapicloud/evolution-api:v2.3.7
    restart: always
    ports:
      - '8080:8080'
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      AUTHENTICATION_API_KEY: TROQUE_ESTA_CHAVE
      DATABASE_ENABLED: 'true'
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: 'postgresql://evolution:TROQUE_ESTA_SENHA@postgres:5432/evolution?schema=public'
      DATABASE_CONNECTION_CLIENT_NAME: evolution
      CACHE_LOCAL_ENABLED: 'true'
      CACHE_REDIS_ENABLED: 'false'
      # preserva a sessão entre reinícios; sem isto cada restart pede o QR
      DATABASE_SAVE_DATA_INSTANCE: 'true'
      DATABASE_SAVE_DATA_NEW_MESSAGE: 'false'
      DATABASE_SAVE_MESSAGE_UPDATE: 'false'
      DATABASE_SAVE_DATA_CONTACTS: 'false'
      DATABASE_SAVE_DATA_CHATS: 'false'
    volumes:
      - evolution_instances:/evolution/instances

volumes:
  postgres_data:
  evolution_instances:
```

> A imagem **mudou de namespace**: `atendai/evolution-api` foi removida do
> Docker Hub (404) e o projeto está em **`evoapicloud/evolution-api`**. Ambas
> as arquiteturas (amd64 e arm64) têm build, então a VM ARM da Oracle serve.

```bash
cd ~/evolution && sudo docker compose up -d
```

`AUTHENTICATION_API_KEY` é o que vai no campo **Token** da tela de
Configurações. Gere algo aleatório (`openssl rand -hex 24`), não use uma
palavra escolhida a mão.

### Liberando a porta (são dois firewalls)

**1. Dentro da VM.** A regra precisa entrar **antes** do `REJECT` que a Oracle
deixa no fim da cadeia — com `-A` ela iria depois e não teria efeito nenhum:

```bash
sudo iptables -L INPUT --line-numbers -n        # veja em que linha está o REJECT
sudo iptables -I INPUT 5 -p tcp --dport 8080 -m state --state NEW -j ACCEPT
sudo apt-get install -y iptables-persistent && sudo netfilter-persistent save
```

**2. No painel.** VM → **Virtual cloud network** → **Security Lists** →
_Default_ → **Add Ingress Rule**: origem `0.0.0.0/0`, TCP, porta `8080`.

Liberar só um dos dois não adianta: a conexão externa fica pendurada até dar
timeout, sem mensagem de erro que ajude.

## Criando a instância

```bash
curl -X POST https://seu-dominio/instance/create \
  -H 'apikey: troque-esta-chave' \
  -H 'Content-Type: application/json' \
  -d '{"instanceName":"thaiboxe","integration":"WHATSAPP-BAILEYS"}'
```

Pegue o QR em `GET /instance/connect/thaiboxe` e leia pelo WhatsApp do celular
em _Aparelhos conectados_.

Para mais de uma academia, repita com outro `instanceName` — o mesmo servidor
atende todas, e cada uma pareia com o número do seu dono.

## Preenchendo em Configurações

| Campo             | Valor                                    |
| ----------------- | ---------------------------------------- |
| Provedor          | Evolution API                            |
| URL da instância  | `https://seu-dominio` (sem barra no fim) |
| Nome da instância | `thaiboxe`                               |
| Token             | o `AUTHENTICATION_API_KEY`               |
| Número remetente  | o número pareado                         |
| Integração ativa  | ligado                                   |

O token não é exibido depois de salvo; deixe o campo em branco para mantê-lo.

## Mensagens automáticas (o agendador)

As regras ficam em **WhatsApp › Automáticas**: lembrete antes do vencimento,
aviso no dia, cobrança de atrasado e aniversário. Cada uma tem um modelo, uma
quantidade de dias e um horário a partir do qual pode disparar.

O sistema **não tem relógio próprio**: quem dá o start é uma chamada externa a

```
GET /api/cron/whatsapp
Authorization: Bearer $CRON_SECRET
```

### Por que o cron fica na VM, e não na Vercel

O Vercel Cron funcionaria — ele inclusive manda o `CRON_SECRET` como Bearer
sozinho —, mas no plano Hobby **roda uma vez por dia** e a função tem timeout
curto. Com disparo diário, o "a partir das 9h" perde o sentido e a fila (15
envios por execução) levaria dias para drenar. A VM do Evolution já está de pé
24h e não tem esse limite.

### Configurando

1. Gere um segredo e coloque **o mesmo valor** em dois lugares: na Vercel
   (Settings › Environment Variables › `CRON_SECRET`) e no `.env` local.

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

2. Na VM, adicione a linha no crontab do usuário `ubuntu` (`crontab -e`):

   ```cron
   0 * * * * curl -fsS -H "Authorization: Bearer SEU_SEGREDO" https://SEU-APP.vercel.app/api/cron/whatsapp >> $HOME/whatsapp-cron.log 2>&1
   ```

   O log vai para a home porque `/var/log` é de root: num crontab de usuário a
   linha falharia calada, sem deixar nem o registro do erro.

   De hora em hora. Executar demais não duplica nada: cada aluno recebe no
   máximo uma mensagem por dia de cada tipo, e a trava é o próprio
   `MessageLog`.

3. Confira o retorno na mão antes de confiar no agendamento:

   ```bash
   curl -H "Authorization: Bearer SEU_SEGREDO" https://SEU-APP.vercel.app/api/cron/whatsapp
   ```

   Responde `{"ranAt": "...", "reports": [...]}` com quantas foram enviadas,
   quantas falharam e o que foi pulado (sem conexão ativa, sem modelo, fora do
   horário). Sem o segredo configurado no servidor: **503**. Com segredo
   errado: **401**.

### Fuso

O horário das regras é sempre **America/Sao_Paulo**, calculado dentro da
aplicação. Não importa em que fuso a VM ou a Vercel estão — o crontab só
precisa disparar de hora em hora.

### Limites de propósito

- **15 envios por execução**, com 500ms entre um e outro. Rajada é o que faz o
  WhatsApp bloquear número; o resto sai na execução seguinte.
- **Uma mensagem por aluno por dia por tipo**, mesmo que o cron rode 24 vezes.
- **Sem conexão ativa, não dispara nada** — nem tenta.

## Riscos

Evolution usa Baileys, que é WhatsApp Web por baixo — **não é via oficial**.
O número pode ser banido, e disparo em massa é exatamente o padrão detectado.

- use um número que não seja o principal da academia;
- espace os disparos em vez de mandar tudo de uma vez;
- mantenha os textos pessoais: mensagem idêntica para dezenas de contatos é o
  que chama atenção.

## Alternativa: Cloud API da Meta

Oficial, sem risco de banimento e sem servidor (roda da Vercel). Em troca,
exige verificação de empresa, número dedicado e **templates aprovados**: a
Meta só entrega texto livre nas 24h seguintes a uma mensagem do aluno, e
cobrança, aniversário e avisos partem da academia — ou seja, na prática todo
evento automático precisa de template aprovado.

Na tela, escolha _Meta Cloud API_, use `https://graph.facebook.com/v21.0` como
URL e o **Phone Number ID** (não o telefone) no campo de instância. No modelo
de mensagem, preencha o nome do template aprovado; os placeholders viram
parâmetros posicionais, na ordem em que aparecem no texto.

No console da Meta, o caminho é **Casos de uso** → _Conectar-se com clientes
pelo WhatsApp_, que faz surgir o item WhatsApp na lateral.

## A régua de cobrança das academias

Duas rotas, um segredo só. A das mensagens roda de hora em hora; a da
cobrança, uma vez por dia basta:

```cron
0 * * * * curl -fsS -H "Authorization: Bearer SEU_SEGREDO" https://SEU-APP.vercel.app/api/cron/whatsapp >> $HOME/whatsapp-cron.log 2>&1
30 8 * * * curl -fsS -H "Authorization: Bearer SEU_SEGREDO" https://SEU-APP.vercel.app/api/cron/cobranca >> $HOME/cobranca-cron.log 2>&1
```

A régua está em `src/server/billing/invoices.ts`, e é lá que os prazos mudam:

| dia      | o que acontece                                              |
| -------- | ----------------------------------------------------------- |
| −7 até 0 | tarja amarela avisando o vencimento                         |
| +1 a +6  | tarja vermelha: mensalidade atrasada                        |
| +7       | o aviso passa a anunciar a data do bloqueio, com contagem   |
| +14      | academia suspensa — ninguém da equipe entra, nada é apagado |

A mesma rotina roda quando alguém abre uma tela do master ou da academia. O
cron existe porque academia inadimplente costuma ser justamente a que parou
de abrir o sistema.

Marcar a fatura como paga no master devolve o acesso na hora, sem passo
manual.
