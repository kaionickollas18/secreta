-- Cache do conteúdo externo mostrado na tela de login (hoje: destaques do TMDB).
-- Sem policies: só as Edge Functions (service role) leem e gravam.
create table public.news_cache (
  id text primary key,
  items jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now()
);
alter table public.news_cache enable row level security;
