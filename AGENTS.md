# Contexto operacional do MEGA-MD

Este arquivo é a fonte de contexto para agentes que trabalham neste repositório. Leia-o por inteiro antes de alterar código, banco, sessão WhatsApp ou produção.

## Visão geral

O MEGA-MD é um bot multi-device para WhatsApp baseado em Node.js ESM e Baileys. Os comandos são plugins em `plugins/`, carregados dinamicamente por `lib/commandHandler.js`. O processo principal é iniciado por `index.js`, e `lib/messageHandler.js` roteia eventos, mensagens, comandos, políticas de acesso e integrações automáticas.

Repositório mantido: `https://github.com/junglivre/MEGA-MD`.

Produção:

- Host: `root@bixos2`
- Porta SSH: `10147`
- Diretório: `/root/MEGA-MD`
- Branch de produção: `main`
- PM2: processo ID `0`, nome `mega-md`
- Porta HTTP atual: definida por `PORT` no ambiente

## Regra obrigatória para SSH

Nunca execute `ssh` diretamente. Toda atividade remota deve ocorrer dentro de uma sessão `tmux` nomeada, por exemplo `MEGA-MD-bixos2-<atividade>`. Capture o pane antes de encerrar a sessão. Reinicie somente o PM2 ID `0`, salvo instrução explícita em contrário.

Antes de atualizar produção:

1. Verifique `git status --short --branch` no servidor.
2. Preserve arquivos não rastreados e dados de runtime.
3. Faça `fetch` da `main` e atualize apenas o checkout do projeto.
4. Valide sintaxe/testes proporcionais à mudança.
5. Reinicie com `pm2 restart 0 --update-env`.
6. Confirme `pm2 status 0` e examine logs recentes quando houver comportamento anormal.

## Ambiente e segredos

O contexto operacional sanitizado do ambiente fica em `.env.md` na raiz deste checkout local. Esse arquivo:

- documenta servidor, acesso, deploy, configuração efetiva não sensível e estado das integrações;
- nunca contém tokens, chaves, números privados, LIDs/JIDs privados ou URLs com credenciais;
- está obrigatoriamente no `.gitignore`, pois descreve um ambiente específico;
- não é carregado pelo bot e não substitui o `.env` real;
- deve ser consultado localmente quando uma tarefa depender da configuração de produção.

O servidor carrega `/root/MEGA-MD/.env`. `.env.example` é apenas o modelo seguro e versionado. Ao adicionar uma variável, atualize `.env.example`, `config.js`, este documento quando relevante e o ambiente real sem expor o valor.

Variáveis importantes incluem:

- Identidade e acesso: `BOT_NAME`, `BOT_OWNER`, `OWNER`, `OWNER_NUMBER`, `OWNER_LID`, `PAIRING_NUMBER`, `SESSION_ID`, `AUTH_METHOD`, `DEVICE_TYPE`, `WHATSAPP_TYPE`.
- Comandos: `PREFIXES`, `COMMAND_MODE`, `DEFAULT_LANGUAGE`, `TIMEZONE`.
- IA: `GROQ_API_KEY`, `GROQ_CHAT_MODEL`, `GROQ_CHAT_RESPONSE_SIZE`, `GROQ_CHAT_MAX_TOKENS`, `GROQ_CHAT_TEMPERATURE`, `GROQ_CHAT_HISTORY_LIMIT`, `GROQ_CHAT_INSTRUCTIONS`, `GROQ_VISION_MODEL`, `GROQ_VISION_REASONING`, `GROQ_VISION_MAX_TOKENS`, `GROQ_VISION_MAX_CHARS`, `GROQ_TRANSCRIPTION_MODEL`.
- Persistência: `DB_URL`, `MONGO_URL`, `POSTGRES_URL`, `MYSQL_URL`, `MAX_STORE_MESSAGES`, `STORE_WRITE_INTERVAL`.
- Serviços: `LASTFM_API_KEY`, `QUOTE_API_URL`, `REMOVEBG_KEY`, `GIPHY_API_KEY`.
- Operação: `PORT`, `BACKUP_ENABLED`, `BACKUP_INTERVAL`, `BACKUP_RETENTION`, `BACKUP_DIR`, `CLEANUP_INTERVAL`.
- Downloads via yt-dlp: `YOUTUBE_COOKIES_FILE`, `TIKTOK_COOKIES_FILE` (fallback estático; prefira `.dlcookies <site> set` no WhatsApp, que persiste via `lightweight_store`). Instagram e Twitter/X não usam cookies.

Nunca imprima o conteúdo do `.env` real, sessão Baileys, banco ou tokens. Para auditoria, liste somente nomes de variáveis ou o estado `configurada/não configurada`. O `.env.md` pode ser lido como documentação, mas deve permanecer sanitizado.

## Arquitetura relevante

- `index.js`: bootstrap, conexão Baileys, store e registro de handlers.
- `config.js`: normaliza variáveis de ambiente e defaults.
- `lib/messageHandler.js`: pipeline principal de mensagens, permissões, comandos e chatbot.
- `lib/commandHandler.js`: descoberta, aliases, cooldown, hot reload e métricas dos plugins.
- `lib/lightweight_store.js`: abstração de persistência para SQLite/JSON e outros backends configuráveis.
- `lib/jid.js`: normalização de PN/LID/JID e mapeamento de identidades alternativas.
- `lib/isOwner.js`: autorização owner/sudo considerando representações WhatsApp.
- `lib/groq.js`: chat, visão e transcrição via Groq.
- `lib/ytdlp.js`: download local de áudio/vídeo do YouTube via `yt-dlp` (`.play`/`.song`/`.video`), cookies opcionais e alerta ao owner quando o cookie expira.
- `lib/i18n.js` e `lib/i18n-plugins.js`: traduções pt-BR/en/es e normalização dinâmica do prefixo.
- `plugins/chatbot.js`: ativação, memória curta, prompt, piadas internas e imagens.
- `plugins/insidejokes.js` e `lib/insideJokes.js`: administração, persistência e matching do banco de piadas.
- `plugins/vision.js`: `.vision` para imagens e figurinhas estáticas.
- `plugins/sticker.js` e `plugins/simage.js`: criação/edição e conversão de figurinhas.
- `test/unit` e `test/integration`: Vitest.

## Pipeline de mensagens

O fluxo principal é, em termos gerais:

1. Receber e registrar a mensagem.
2. Normalizar remetente e alternativas PN/LID/JID.
3. Processar eventos especiais, políticas e proteções.
4. Detectar prefixo a partir de `config.prefixes`.
5. Resolver comando/alias e aplicar owner/admin/group/cooldown.
6. Se não for comando, avaliar menções, respostas ao bot, chatbot e piadas internas.

Não presuma que `participant`, `participantAlt`, `remoteJid` e `remoteJidAlt` terão sempre o mesmo formato. Em grupos, mantenha compatibilidade com PN, LID, JID com device suffix e IDs retornados pelo metadata.

## Prefixos e textos de ajuda

`PREFIXES` pode conter vários prefixos, mas textos de uso devem mostrar apenas o primeiro prefixo válido. Não fixe `.` em respostas, tooltips ou menus.

- Traduções passam por `replaceCommandPrefix()` em `lib/i18n.js`.
- Metadados `usage` podem continuar declarativos, mas qualquer renderização deve normalizar o prefixo.
- Handlers que montam ajuda diretamente devem usar `context.config.prefix`.
- Toda string de tradução recebe `{botName}` automaticamente (injetado em `translate()`, `lib/i18n.js`, igual a `{prefix}`) — nunca escreva "MEGA-MD" literal em texto de usuário; use `{botName}`. Em código JS fora de i18n (bio automática, metadata de figurinha), use `config.botName`/`config.packname`/`config.author` em vez de literal.

## Chatbot e tom

O chatbot usa Groq quando `GROQ_API_KEY` está disponível e possui fallbacks externos para texto. O tom esperado é casual e humano, sem respostas robóticas ou perguntas forçadas.

Regras atuais:

- não iniciar flerte; acompanhar apenas flerte explícito, leve e não sexual;
- evitar deboche, sarcasmo e provocação por padrão;
- risadas, reações e comentários curtos devem receber resposta curta;
- evitar emojis excessivos, frases prontas e perguntas retóricas;
- imagens não acionam o chatbot sozinhas;
- imagens são processadas apenas por menção/resposta ao bot, piada interna compatível ou `.vision`.

Alterações de prompt são comportamentais: valide com exemplos reais do grupo e faça mudanças pequenas. O modelo é probabilístico; uma única resposta não prova regressão ou correção completa.

## Banco de piadas internas

Aliases: `bancopiadas`, `bpiadas`, `insidejokes`.

O fluxo guiado foi removido. O cadastro é somente direto:

```text
<prefixo>bancopiadas adicionar <banco> <tag1>, <tag2> | <contexto>
```

Comandos disponíveis:

- `criar <nome>`
- `adicionar <banco> <tags> | <contexto>`
- `listar [banco]`
- `vincular <banco>`
- `desvincular <banco>`
- `remover <banco> <id>`
- `apagar <banco>`

O comando é owner/sudo conforme as regras do handler. O banco precisa estar vinculado ao grupo para acionar a IA.

Matching:

- normaliza caixa e acentos;
- procura todas as tags compatíveis nos bancos vinculados;
- quando uma piada casa, inclui outras piadas do mesmo banco como exemplos relacionados de estilo;
- contextos relacionados não viram novos gatilhos;
- envia no máximo 20 contextos, priorizando matches mais específicos.

O prompt deve usar a piada como padrão de humor, sem mencionar banco, tag ou instruções privadas. Evite piadas genéricas, tarefas banais e invenção de fatos privados. Para editar uma piada, atualmente remova pelo ID e cadastre novamente.

## Visão e figurinhas

- `.vision <instrução>` aceita imagem enviada junto, imagem respondida ou figurinha estática respondida/enviada.
- Figurinhas estáticas são convertidas de WebP para PNG com Sharp antes do Groq.
- Figurinhas animadas não são suportadas pelo `.vision`.
- `.s2img` converte figurinha em imagem; aliases: `simage`, `stoimg`, `toimg`.
- `.s2vid` converte figurinha animada em vídeo; aliases: `svideo`, `stovid`, `tovid`.
- `tagall` também possui aliases `everyone`, `all`, `everson`, `everton`.
- `.sticker` (aliases `s`, `f`, `st`, `fig`, `figurinha`, `stik`, `stiker`): sem flag mantém a proporção original (estática só reduz até caber em 512; animada ganha borda transparente até 512×512, porque algumas GIFs falhavam como figurinha animada não quadrada). `-s`/`-stretch`/`-esticado`/`-full` estica para 512×512 sem cortar, inclusive vídeo/GIF. `-rounded`/`-circle` recorta em círculo. Não existe mais `-crop`. `-custom pacote` troca só o pacote e remove o autor; `-custom autor|pacote` define os dois. Emojis viram as categorias da figurinha. Respondendo a uma figurinha sem flag de formato, só reescreve os metadados.

## Tipo de dispositivo e visualização única

`DEVICE_TYPE` define como o bot se registra ao ser vinculado (`lib/deviceProfile.js`, aplicado no início do `index.js`):

- `desktop` (padrão): companion WhatsApp Web (`Browsers.macOS('Chrome')`). O WhatsApp não entrega mídia de visualização única a ele: chega stub ("Message absent from node") ou cópia sem `mediaKey`/`directPath`. `.vo` fica oculto do menu e responde que só funciona como celular; `.sticker` em mídia de visualização única explica o mesmo.
- `mobile`: companion Android (`Browsers.android('Android')`, `DeviceProps.platformType = ANDROID_PHONE`). Recebe a mídia de visualização única completa, com chave. Confirmado em produção em 2026-11-23: foto de 2160×3840 baixada com tamanho idêntico ao declarado.
- `WHATSAPP_TYPE` precisa casar com o app do celular principal. Conta Business recusa companion Android comum ("You can only link to another WhatsApp Business app"). O Baileys só anuncia `UserAgent.Platform.ANDROID`; para `business`, `applyDeviceProfile()` aponta essa entrada do enum para `SMB_ANDROID` antes de conectar e confere o payload real de `generateLoginNode()`. Se um upgrade do Baileys mudar esse caminho, o bot falha na inicialização em vez de parear com o app errado. Não substitua isso por patch em `node_modules` (some no próximo `npm install`).
- Trocar `DEVICE_TYPE` ou `WHATSAPP_TYPE` exige parear de novo: pare o bot, mova `session/` para backup e escaneie o QR. Pareamento como `mobile` foi testado só por QR (`AUTH_METHOD=qr`); por código de pareamento o Baileys envia `companion_platform_id` de Chrome, não testado.
- Produção (`bixos2`): `DEVICE_TYPE=mobile`, `WHATSAPP_TYPE=business` desde 2026-11-23.

Mesmo como celular, a cópia citada numa resposta traz só `viewOnce: true`, sem chave. Por isso `lib/viewOnce.js` guarda a chave de toda mídia de visualização única recebida (`rememberViewOnce`, ligado em `messages.upsert` no `index.js`) num cofre por tempo, não por quantidade: setting global `viewOnceVault` do `lightweight_store`, chaveado pelo id da mensagem, só com os campos necessários para baixar e reenviar (sem thumbnail). Após 7 dias (`RETENTION_MS`) a chave é apagada e fica uma lápide; o comando responde "expirou". Lápides somem após 30 dias. `resolveQuotedViewOnce` consulta o cofre pelo `stanzaId` da citação e, para mídias anteriores ao cofre, cai no store geral (70 mensagens por chat). Se o CDN responder 404/410, `downloadViewOnce` pede re-upload ao celular uma vez; se falhar, também responde "expirou".

Mídia de visualização única de antes do vínculo não é recuperável. Em 2026-11-23: o histórico sincronizado no pareamento trouxe 75 mensagens de visualização única, todas sem chave; e `requestPlaceholderResend` para as 3 mais recentes (do mesmo dia) foi enviado ao celular, que não respondeu em 30 s.

- `.viewonce` / `.vo` / `.obtainvo` / `.visunica` / `.visuunica` (e os antigos `.viewmedia`, `.vv`): reenvia foto, vídeo ou áudio de visualização única como mídia normal, com os bytes originais (sem recompressão); áudio mantém o `ptt` de nota de voz.
- `.sticker` respondendo mídia de visualização única usa o mesmo original. Áudio não vira figurinha.
- `.sticker` passa `ctx.logger` ao `downloadMediaMessage`; sem logger, o Baileys quebrava ao pedir re-upload de mídia expirada e a figurinha falhava.

## Downloads (play/song/video, spotify, tiktok via yt-dlp; instagram e twitter via resolvedores públicos)

`.play`, `.song`, `.video`, `.spotify` e `.tiktok` chamavam APIs HTTP de terceiros (`api.qasimdev.dpdns.org`, `discardapi.*`) que foram quebrando (redirect pra anúncios, ou simplesmente instáveis). Migrados pra `yt-dlp` local: motor compartilhado em `lib/ytdlpCore.js`, especializado por site em `lib/ytdlp.js` (YouTube) e `lib/tiktokDownload.js`. Grava em `temp/`, envia o buffer direto pelo Baileys, apaga o arquivo depois.

- `.spotify` não baixa o áudio do Spotify (DRM) — pega metadata da página de embed pública do Spotify (`open.spotify.com/embed/track/<id>`, sem API key) e baixa o equivalente do YouTube pelo mesmo pipeline do `.song`.
- `.twitter` usa a API pública do FxTwitter (`api.fxtwitter.com/2/status/<id>`, projeto FxEmbed) em `lib/twitterDownload.js`: fotos (`?name=orig`), vídeos (MP4 H.264 de maior bitrate cujo tamanho estimado cabe em 100 MB) e GIFs, na ordem do post. Aceita links de `x.com`, `twitter.com`, `mobile.`, `fixupx.com`, `fxtwitter.com`, `vxtwitter.com`/`fixvx.com`. Sem cookies e sem yt-dlp; limite de 1000 req/min por IP.
- `.instagram`/`igs`/`igsc` usam o serviço público OGInstagram (`oginstagram.com`) em `lib/instagramDownload.js`. O IP do `bixos2` cai no login do Instagram (gallery-dl/yt-dlp, confirmado em 2026-11-07); o OGInstagram busca pelo próprio pool de saída. Fluxo: `GET oginstagram.com/{p|reel}/<código>/50` com `Accept: application/activity+json` devolve o último item, e o índice no `id` (o serviço limita ao tamanho do post) revela o total; os demais itens vêm de `/<código>/<n>`. Cada anexo aponta pra `oginstagram.com/offload/...`, que redireciona pro CDN público do Instagram, de onde o bot baixa. Não use o ActivityPub sem índice: ele devolve só o 1º vídeo ou até 4 fotos de um carrossel. Fotos vêm no tamanho de visitante (ex.: 584×584). Posts privados/restritos não são suportados.
- `lib/remoteMedia.js` baixa as URLs resolvidas de Instagram/Twitter: exige host final no CDN (`cdninstagram.com`/`fbcdn.net`/`oginstagram.com` ou `twimg.com`), limite de 150 MiB por lote, confere os bytes reais (JPEG/PNG/WebP/MP4) e rejeita imagem em slot de vídeo (thumbnail). Arquivos só existem dentro do callback `consume` e são apagados depois.
- `.terabox` **descontinuado**: sem extractor no yt-dlp; todo resolver da comunidade exige cookie `ndus` separado de uma conta Terabox + scraping frágil (ou depende de um Cloudflare Worker de terceiros). Virou stub com `hidden: true` (fora do `.menu`), responde "descontinuado" se chamado direto.

Requisitos no host de produção (já aplicados em `bixos2`, 2026-10-01):

- `yt-dlp` e `ffmpeg` instalados e atualizáveis via `pip install --break-system-packages -U "yt-dlp[default]"` (o extrator do YouTube quebra com frequência; `[default]` traz o `yt-dlp-ejs` necessário pra resolver assinatura). Atualizados em 2026-11-07: yt-dlp 2026.10.26, yt-dlp-ejs 0.8.0.
- `deno` no PATH do processo (symlink em `/usr/local/bin/deno`) — sem runtime JS o yt-dlp cai pro cliente `visionos`/`web` sem resolver assinatura e YouTube retorna `LOGIN_REQUIRED` em qualquer cliente.
- `bgutil-ytdlp-pot-provider`: container Docker em `127.0.0.1:4416` (`docker run --name bgutil-provider -d --init --restart unless-stopped -p 127.0.0.1:4416:4416 brainicism/bgutil-ytdlp-pot-provider`) + plugin pip (`bgutil-ytdlp-pot-provider`).

**IP do bixos2 (Oracle Cloud) é bloqueado pelo YouTube.** Testado em 2026-10-01: com `yt-dlp` + `ffmpeg` + `deno` + PO Token provider funcionando, TODOS os clientes (`web`, `android`, `ios`, `tv`, `tv_simply`, `android_vr`, `web_embedded`, `mweb`, `web_safari`, `visionos`) retornam `LOGIN_REQUIRED`/"Sign in to confirm you're not a bot" sem cookies — é bloqueio por reputação de IP datacenter, não falta de PO Token. Isso é um padrão conhecido pra IPs de VPS/cloud (Oracle, Hetzner, AWS etc.), não um bug do bot. **Cookies não são opcionais nesse host pro YouTube.**

**Bug conhecido do yt-dlp (issue [#17389](https://github.com/yt-dlp/yt-dlp/issues/17389), aberto, alta prioridade):** com cookie anexado, o client padrão `tv_downgraded` retorna `UNPLAYABLE` em todos os formatos (assinatura JS do player TVHTML5 que o `yt-dlp-ejs` ainda não resolve), surge como `ERROR: The page needs to be reloaded.`. Workaround aplicado em `lib/ytdlp.js`: força `--extractor-args youtube:player_client=default,web_embedded` (confirmado por mantenedor do yt-dlp no issue). Remover quando o upstream corrigir.

`.video` e `.song` mostram título/canal/data de publicação antes e depois do download, via `getVideoMetadata()` (`lib/ytdlp.js`, `yt-dlp --skip-download`); `.song` não tem como mostrar isso na mensagem final porque **mensagem de áudio no WhatsApp/Baileys não tem campo de legenda** (`AudioMessage` não tem `caption` no proto), só a mensagem de "baixando" prévia. Por padrão yt-dlp manda `hl=en` pro YouTube quando nenhum `lang` é definido (`yt_dlp/extractor/youtube/_base.py`), o que faz canais com metadata traduzida servirem o título em inglês; forçado `lang=pt` em `PLAYER_CLIENT_ARGS` (`lib/ytdlp.js`) pra manter o idioma original/pt-BR.

`.video` força `[vcodec^=avc1]`/`[acodec^=mp4a]` (H.264 + AAC) no seletor de formato do yt-dlp em vez de deixar ele escolher "o melhor" — na YouTube atual isso costuma vir como AV1/Opus, que toca liso no VLC/PC mas não no player mobile do WhatsApp (arquivo "funciona no PC, não no celular"). Teto de 1080p e 150MB por padrão; se o H.264/AAC na altura pedida passar de 150MB, `downloadVideo()` (`lib/ytdlp.js`) desce por `VIDEO_QUALITY_TIERS` (1080→720→480→360→240→144) e baixa de novo até caber, checando o tamanho real do arquivo a cada tentativa (não é estimativa). Usuário pode pedir uma qualidade específica direto: `.video <link|busca> 720`.

`.video -custom <link>` (ou `-custom` em qualquer posição dos args) pergunta a qualidade antes de baixar, listando as alturas `avc1` realmente disponíveis pra aquele vídeo específico (`getAvailableQualities()` em `lib/ytdlp.js`, via `yt-dlp -j --skip-download`, não um tier estático). Estado fica em `pendingCustom` (Map em `plugins/video.js`, chave `chatId:senderId`), TTL de 3 minutos. A resposta (número da opção ou a própria altura, ex. "2" ou "720") é interceptada em `lib/messageHandler.js` por `handleVideoQualityReply()` — chamado pra TODA mensagem de texto, ANTES do check de tictactoe (`/^[1-9]$/`) e antes do lookup de comando por prefixo, mas é um no-op barato (`Map.get`) quando ninguém tem pedido pendente. Se a listagem de qualidades falhar (vídeo indisponível, etc.), cai pro download padrão sem perguntar.

Mensagens de erro de download são sanitizadas: `sanitizeYtDlpError()`/`formatYtDlpError()` (`lib/ytdlpCore.js`) classificam o texto cru do yt-dlp (cheio de link de wiki e flag de CLI) em chaves curtas (`p.ytdlpErrors.*`: `loginRequired`, `cookieExpired`, `private`, `unavailable`, `geoBlocked`, `rateLimited`, `noVideo`, `invalidUrl`, `generic`), preservando só o prefixo `[site] id:` quando presente. Usado em `play`/`song`/`video`/`spotify`/`tiktok`/`twitter`. Nunca mostrar `err.message` cru pro usuário.

**Erro transiente "Sign in to confirm you're not a bot" com cookie válido:** confirmado em produção (2026-10-05) que isso acontece esporadicamente mesmo com cookie não expirado e não marcado como inválido — o MESMO vídeo que falhava passava a funcionar segundos depois com o retry manual idêntico. É bloqueio anti-bot transiente do lado do YouTube, não cookie ruim nem bug de código; ~0,6% das tentativas no período observado (7 erros em 1087 downloads bem-sucedidos). `runYtDlpWithRetry()` (`lib/ytdlpCore.js`, usado por `createDownloader`/`createMetadataFetcher`/`createFormatLister`) tenta de novo uma vez (2,5s de espera) quando o `stderr` bate com `TRANSIENT_ERROR_RE` (variantes en/pt/es de "not a bot" + "page needs to be reloaded"), antes de desistir e reportar falha.

**Validade do cookie do YouTube:** só marque um perfil como inválido quando o yt-dlp informar explicitamente `YouTube account cookies are no longer valid`. Uma resposta anti-bot ou `LOGIN_REQUIRED`, mesmo repetida com cookies anexados, não prova expiração: o IP ou a sessão podem sofrer bloqueio. Esses erros continuam elegíveis ao retry existente, mas não alteram `invalid`, `invalidAt` ou `lastAlertAt` nem disparam alerta ao owner. Não revalide automaticamente perfis antigos; o owner pode substituir um cookie expirado com `.dlcookies youtube set`.

Cookies (comando unificado `.dlcookies <site> <ação>`, não um comando por site):

- `.dlcookies youtube|tiktok set [rótulo]` (`strictOwnerOnly: true` — só o owner principal, nem sudo pode; checado via `isOwnerOnlyInContext`) — responda a um `.txt` ou cole o conteúdo. Perfis rotulados, revezados (round-robin) a cada download pra espalhar carga entre contas. Configuração é **global** (`SETTINGS_SCOPE = 'global'` em `lib/ytdlpCore.js`, nunca por `chatId`) — o cookie vale pra `.play`/`.song`/`.video`/`.spotify`/`.tiktok` em qualquer grupo ou PV, não só no chat onde foi configurado.
- `.dlcookies <site> status` / `list` — mostra perfis e estado (válido/inválido desde quando).
- `.dlcookies <site> remove <rótulo>` / `clear` (todos).
- Fallback estático por env var: `YOUTUBE_COOKIES_FILE`, `TIKTOK_COOKIES_FILE` (usado só se não houver perfil salvo via WhatsApp).
- YouTube reconhece cookie inválido apenas pela mensagem explícita do yt-dlp (`YouTube account cookies are no longer valid`); anti-bot, login requerido, reload e HTTP 403 não invalidam perfis. TikTok mantém sua heurística genérica de login/auth; `.dlcookies <site> set <rótulo>` de novo limpa a flag.
- Alerta automático ao owner (`OWNER_NUMBER`) no WhatsApp quando um perfil fica inválido, mencionando o site e o rótulo, cooldown de 6h por perfil.

## Persistência e arquivos de runtime

Não versione nem remova sem autorização:

- `.env`, `.env.md` e credenciais;
- `session/`;
- arquivos SQLite e WAL/SHM;
- JSONs em `data/`;
- `temp/`, logs e backups;
- arquivos não rastreados existentes no servidor.

O banco de piadas usa o setting global `insideJokes` através de `lightweight_store`. Alterações de schema devem ser retrocompatíveis com bancos existentes.

## Desenvolvimento e validação

O projeto usa Node.js ESM. Comandos esperados:

```text
npm test
npm run test:unit
npm run test:integration
npm run lint
node --check <arquivo.js>
```

No ambiente Codex local, `npm` pode não estar no PATH. O runtime Node/FNM disponível nesta estação está atualmente em `/run/user/1000/fnm_multishells/1009536_1787504297746/bin/`; prefixe esse diretório ao `PATH` para executar `node`, `npm` e `npx`. Como o identificador do multishell pode mudar após uma nova sessão, localize o diretório ativo em `/run/user/1000/fnm_multishells/` se esse caminho deixar de existir. `node_modules` local pode ter sido instalado por pnpm apenas para validação; não versione lockfiles gerados incidentalmente.

Antes de entregar uma mudança:

1. Rode lint nos arquivos alterados.
2. Rode os testes unitários diretamente relacionados.
3. Use `git diff --check`.
4. Verifique `git status` para não incluir dados locais.
5. Faça commit objetivo na `main`, salvo solicitação explícita de branch.
6. Atualize `CHANGELOG.md` para mudanças funcionais ou operacionais relevantes.

Falhas históricas da suíte completa podem existir por mocks incompletos ou dependências opcionais de plugins. Não esconda falhas: diferencie regressões da mudança de problemas preexistentes e documente a evidência.

## Convenções de alteração

- Preserve o estilo ESM e a estrutura de plugins existente.
- Evite duplicar helpers de JID, prefixo, tradução, download ou Groq.
- Não exponha raciocínio interno do modelo nas respostas.
- Não habilite respostas automáticas para toda mídia.
- Não reintroduza o wizard de piadas sem redesenhar e testar o fluxo ponta a ponta em PN/LID/JID.
- Não altere dados do usuário ou feche/remova integrações sem autorização explícita.
- Faça ajustes finos de prompt de maneira incremental e registre o motivo no changelog.

## Estado atual

Em 2026-08-23, produção e repositório estão na branch `main`, commit funcional de referência `2a02d56`, com PM2 ID `0`. Consulte `git log` e `CHANGELOG.md` porque esse hash ficará desatualizado após novas mudanças.
