# Segurança

Escopo: site estático + Supabase. Três perfis (Master, Secretário, Auxiliar); cada escola só acessa os próprios dados. O sistema guarda nomes de funcionários e de alunos (menores de idade): privacidade é requisito.

## Autenticação
- Supabase Auth com e-mail e senha. O cadastro público deve ficar **desligado** (Authentication → Sign In / Providers → Allow new users to sign up).
- Contas só nascem pela Edge Function `manage-users`: o Master cria secretários; o Secretário cria auxiliares da própria escola.
- Desativar um usuário bloqueia o login (ban) e o perfil (`active = false`).
- A tela de login não revela se o e-mail existe.
- Recomendado: ligar a proteção contra senhas vazadas (Authentication → Password Security).

## Autorização
- **A autoridade é o banco.** Todas as tabelas têm RLS; o cliente nunca é confiável.
- Isolamento por escola: as policies comparam `school_id` com `current_school_id()` (derivado da sessão).
- Regras por papel em policies e no trigger `tasks_guard` (o auxiliar não conclui, não reabre, não cria, não exclui e não altera responsáveis).
- Campos sensíveis são carimbados pelo servidor: autor da tarefa, autor/nome/horário da mensagem, data de conclusão.
- `profiles` não aceita escrita direta do cliente; só a Edge Function (service role) escreve.
- A Edge Function valida o token, carrega o perfil de quem chama e confere papel e escola antes de cada ação.
- A interface espelha as permissões (`utils/roles.ts`) apenas por usabilidade.

## Segredos
| Valor | Onde pode ficar |
|---|---|
| Project URL e publishable key | `.env`, front-end e repositório (públicas por desenho) |
| Service role key | Só dentro da Edge Function (variável automática do Supabase) |
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
- Não versionar dados reais (alunos, funcionários) no repositório, nem em testes.
- O navegador guarda a sessão do Supabase e o horário da última visita ao mural no `localStorage`. Em computador compartilhado, usar **Sair**.

## Dependências e build
- Poucas dependências, versões fixadas pelo lockfile; rodar `npm audit` periodicamente.
- Depois de mudar o schema, rodar os avisos de segurança do Supabase (Advisors).
- Recomendado ao publicar com cabeçalhos próprios: `Content-Security-Policy` restritiva (permitindo o domínio do Supabase, `docs.google.com` e as fontes do Google) e `X-Content-Type-Options: nosniff`. O GitHub Pages não permite configurar cabeçalhos.
