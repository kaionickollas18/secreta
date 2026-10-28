# Segurança

Escopo: site estático + Supabase. Quatro perfis (Master, Secretário, Auxiliar, Professor); cada escola só acessa os próprios dados. O sistema guarda nomes de funcionários e de alunos (menores de idade): privacidade é requisito.

## Autenticação
- Supabase Auth com e-mail e senha. O cadastro público deve ficar **desligado** (Authentication → Sign In / Providers → Allow new users to sign up).
- Contas só nascem pela Edge Function `manage-users`: o Master cria secretários; o Secretário cria auxiliares e professores da própria escola. O Secretário também edita o perfil deles (nome, sobrenome, apelido, nascimento, e-mail, papel, foto) pela mesma função.
- Desativar um usuário bloqueia o login (ban) e o perfil (`active = false`).
- A tela de login não revela se o e-mail existe.
- Recomendado: ligar a proteção contra senhas vazadas (Authentication → Password Security).

## Autorização
- **A autoridade é o banco.** Todas as tabelas têm RLS; o cliente nunca é confiável.
- Isolamento por escola: as policies comparam `school_id` com `current_school_id()` (derivado da sessão).
- Regras por papel em policies e no trigger `tasks_guard` (o auxiliar não conclui, não reabre, não cria, não exclui e não altera responsáveis).
- Campos sensíveis são carimbados pelo servidor: autor da tarefa, autor/nome/horário da mensagem, data de conclusão.
- `profiles`: o cliente só altera o próprio `last_name` e `avatar_path`. Papel, escola, situação e o acesso especial (`elevated`) só mudam pela Edge Function (service role).
- **Acesso especial**: um auxiliar com `elevated` vale como secretário nas regras do banco (via `current_role_name()`), exceto na gestão da equipe, que confere o papel real. Só o secretário concede ou retira.
- A Edge Function valida o token, carrega o perfil de quem chama e confere papel e escola antes de cada ação.
- A interface espelha as permissões (`utils/roles.ts`) apenas por usabilidade.

## Segredos
| Valor | Onde pode ficar |
|---|---|
| Project URL e publishable key | `.env`, front-end e repositório (públicas por desenho) |
| Service role key | Só dentro da Edge Function (variável automática do Supabase) |
| Token de leitura do TMDB (destaques do login) | Só no segredo `TMDB_READ_TOKEN` das Edge Functions do Supabase; a função `login-movies` é a única que o usa |
| Senha do banco, tokens pessoais `sbp_…` | Nunca no repositório nem no front-end; variável de ambiente local, se preciso |

Se um segredo for exposto (chat, print, commit), revogue e gere outro.

## Entradas e XSS
- Todo texto do usuário é renderizado pelo React como texto. **Proibido** `dangerouslySetInnerHTML`, `innerHTML`, `eval` e `new Function` com dados do usuário.
- `sanitizeText` remove caracteres de controle; limites de tamanho no cliente e no banco (`check`).
- Dados do banco, de arquivos e de planilhas passam por validação antes do uso (`guards`, `*FromRow`, `isAttendanceData`).
- **CSV exportado** (histórico): células que começam com `=`, `+`, `-` ou `@` recebem um apóstrofo, para o Excel não executá-las como fórmula.
- O link da planilha só é aceito se for `https://docs.google.com/spreadsheets/d/…`.

## Dados pessoais
- A base offline do dashboard fica num bucket **privado**, em uma pasta por escola, com leitura restrita à escola.
- A planilha online exige compartilhamento "qualquer pessoa com o link": quem tiver o link vê os nomes dos alunos. A tela avisa disso; quando for um problema, usar só a base offline.
- **Fotos de perfil** ficam num bucket de leitura pública: quem tiver o endereço exato da imagem consegue abri-la, mesmo sem login. O nome do arquivo é aleatório e o endereço só é entregue a quem está logado na escola. Cada pessoa só grava na própria pasta. Se isso deixar de ser aceitável, o caminho é tornar o bucket privado e usar endereços assinados.
- Não versionar dados reais (alunos, funcionários) no repositório, nem em testes.
- O navegador guarda no `localStorage` a sessão do Supabase, o horário da última visita ao mural e o perfil da última sessão (nome, papel e escola), usado só para desenhar a tela mais cedo. O perfil é validado ao ler, conferido no servidor a cada página e apagado ao sair; alterá-lo à mão não dá acesso a nada, porque as regras valem no banco. Em computador compartilhado, usar **Sair**.

## Dependências e build
- Poucas dependências, versões fixadas pelo lockfile; rodar `npm audit` periodicamente.
- Depois de mudar o schema, rodar os avisos de segurança do Supabase (Advisors).
- Recomendado ao publicar com cabeçalhos próprios: `Content-Security-Policy` restritiva (permitindo o domínio do Supabase, `docs.google.com` e as fontes do Google) e `X-Content-Type-Options: nosniff`. O GitHub Pages não permite configurar cabeçalhos.

## Conversas
- **Diretas**: criptografia de ponta a ponta no navegador. O banco guarda só o texto embaralhado; a chave privada de cada pessoa só existe no aparelho dela (não exportável) e, no banco, embaralhada com a senha. Protege de quem lê o banco; **não** protege de quem altera o código publicado do site, nem esconde quem falou com quem e quando. Sem a senha antiga não há recuperação do histórico.
- **Anexos das diretas** (PDF e imagens, até 10 MB): o arquivo é embaralhado no navegador com a mesma chave da conversa e só então vai para o bucket **privado** `chat-files`, que aceita apenas bytes embaralhados. Nome, tipo e tamanho viajam dentro do texto embaralhado da mensagem; o banco conhece só o caminho do arquivo (`<escola>/<quem enviou>/<id aleatório>`). Só os dois participantes da conversa baixam (policy em `storage.objects`), cada um envia só na própria pasta, e apagar a mensagem apaga o arquivo. O tipo é conferido no navegador (PDF, JPG, PNG, WEBP, GIF); como o servidor não vê o conteúdo, não há antivírus no servidor.
- **Anônimo**: sem nome para a escola, com a autoria guardada à parte para a própria pessoa apagar o que escreveu. Quem administra o banco consegue apurar a autoria; a tela avisa isso.
- A função `my_chat_key()` é `security definer` de propósito: devolve só a linha de quem chama. O aviso do Supabase sobre ela é esperado.
