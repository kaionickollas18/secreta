// Edge Function (Deno): filmes e séries em destaque para a tela de login (dados do TMDB).
// É pública (a tela de login não tem sessão), então se protege sozinha:
//   - o token de leitura do TMDB fica no segredo TMDB_READ_TOKEN e nunca sai daqui;
//   - o resultado fica em cache no banco por 6 horas;
//   - só uma requisição por vez consegue renovar o cache.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/** Os destaques da semana mudam devagar: renovar a cada 6 horas basta. */
const TTL_MS = 6 * 60 * 60 * 1000;
/** Se a busca falhar, tenta de novo depois deste tempo. */
const RETRY_MS = 15 * 60 * 1000;
const LIMIT = 10;
const CACHE_ID = "tmdb";
const API = "https://api.themoviedb.org/3";

interface MovieItem {
  id: number;
  kind: "movie" | "tv";
  title: string;
  overview: string;
  /** Caminho da imagem no TMDB (ex.: "/abc.jpg"); o site monta o endereço. */
  backdrop: string | null;
  poster: string | null;
  rating: number;
  votes: number;
  /** YYYY-MM-DD */
  date: string | null;
  genres: string[];
}

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
}

async function tmdb(token: string, path: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`TMDB HTTP ${response.status}`);
  return (await response.json()) as Record<string, unknown>;
}

/** Caminho de imagem do TMDB: uma barra, nome de arquivo simples e extensão de imagem. */
const imagePath = (value: unknown): string | null =>
  typeof value === "string" && /^\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(value) ? value : null;

const isoDay = (value: unknown): string | null =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

function genreMap(body: Record<string, unknown>): Map<number, string> {
  const list = Array.isArray(body.genres) ? body.genres : [];
  return new Map(
    list.flatMap((g) => {
      const genre = g as { id?: unknown; name?: unknown };
      return typeof genre.id === "number" && typeof genre.name === "string" ? [[genre.id, genre.name] as const] : [];
    }),
  );
}

async function fetchMovies(token: string): Promise<MovieItem[]> {
  const [trending, movieGenres, tvGenres] = await Promise.all([
    tmdb(token, "/trending/all/week?language=pt-BR"),
    tmdb(token, "/genre/movie/list?language=pt-BR"),
    tmdb(token, "/genre/tv/list?language=pt-BR"),
  ]);
  const names = { movie: genreMap(movieGenres), tv: genreMap(tvGenres) };
  const results = Array.isArray(trending.results) ? trending.results : [];

  const items: MovieItem[] = [];
  for (const raw of results) {
    const r = raw as Record<string, unknown>;
    const kind = r.media_type === "movie" ? "movie" : r.media_type === "tv" ? "tv" : null;
    const title = typeof r.title === "string" ? r.title : typeof r.name === "string" ? r.name : "";
    // Conteúdo adulto nunca entra: a tela é de uma escola.
    if (!kind || typeof r.id !== "number" || !title.trim() || r.adult === true) continue;
    const backdrop = imagePath(r.backdrop_path);
    const poster = imagePath(r.poster_path);
    if (!backdrop && !poster) continue;
    const genreIds = Array.isArray(r.genre_ids) ? r.genre_ids : [];
    items.push({
      id: r.id,
      kind,
      title: title.trim().slice(0, 200),
      overview: typeof r.overview === "string" ? r.overview.trim().slice(0, 600) : "",
      backdrop,
      poster,
      rating: typeof r.vote_average === "number" ? Math.round(r.vote_average * 10) / 10 : 0,
      votes: typeof r.vote_count === "number" ? r.vote_count : 0,
      date: isoDay(kind === "movie" ? r.release_date : r.first_air_date),
      genres: genreIds.flatMap((id) => names[kind].get(id as number) ?? []).slice(0, 3),
    });
    if (items.length === LIMIT) break;
  }
  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const { data: row } = await admin
      .from("news_cache")
      .select("items, fetched_at")
      .eq("id", CACHE_ID)
      .maybeSingle();
    const cached = (row?.items ?? []) as MovieItem[];
    const age = row ? Date.now() - new Date(row.fetched_at).getTime() : Infinity;
    if (age < TTL_MS) return json({ items: cached });

    const token = Deno.env.get("TMDB_READ_TOKEN");
    if (!token) return json({ items: cached });

    // Reserva a vez: marca o cache como renovado agora. Quem chegar junto vê o cache antigo.
    const now = new Date().toISOString();
    let claimed = false;
    if (!row) {
      const { error } = await admin.from("news_cache").insert({ id: CACHE_ID, items: [], fetched_at: now });
      claimed = !error;
    } else {
      const { data } = await admin
        .from("news_cache")
        .update({ fetched_at: now })
        .eq("id", CACHE_ID)
        .lt("fetched_at", new Date(Date.now() - TTL_MS).toISOString())
        .select("id");
      claimed = (data?.length ?? 0) > 0;
    }
    if (!claimed) return json({ items: cached });

    try {
      const items = await fetchMovies(token);
      if (items.length === 0) throw new Error("sem resultados");
      await admin.from("news_cache").update({ items, fetched_at: now }).eq("id", CACHE_ID);
      return json({ items });
    } catch (e) {
      console.error("login-movies: falha ao buscar", e instanceof Error ? e.message : e);
      // Mantém os destaques antigos e agenda uma nova tentativa em 15 minutos.
      const retryAt = new Date(Date.now() - TTL_MS + RETRY_MS).toISOString();
      await admin.from("news_cache").update({ fetched_at: retryAt }).eq("id", CACHE_ID);
      return json({ items: cached });
    }
  } catch (e) {
    console.error("login-movies: erro", e instanceof Error ? e.message : e);
    return json({ items: [] });
  }
});
