export type MovieKind = "movie" | "tv";

export const MOVIE_KIND_LABELS: Record<MovieKind, string> = {
  movie: "Filme",
  tv: "Série",
};

/** Filme ou série em destaque na tela de login (dados do TMDB). */
export interface MovieItem {
  id: number;
  kind: MovieKind;
  title: string;
  overview: string;
  /** Caminhos de imagem no TMDB (ex.: "/abc.jpg"). */
  backdrop?: string;
  poster?: string;
  /** Nota de 0 a 10. */
  rating: number;
  votes: number;
  /** YYYY-MM-DD */
  date?: string;
  genres: string[];
}

export const MOVIE_LIMIT = 10;

const IMAGE_PATH = /^\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;
const imagePath = (value: unknown): string | undefined =>
  typeof value === "string" && IMAGE_PATH.test(value) ? value : undefined;

/**
 * Valida o que veio do servidor (dado externo). Só entram itens com id, título e ao menos
 * uma imagem; caminhos de imagem fora do formato do TMDB são descartados, para o endereço
 * montado depois nunca apontar para outro lugar.
 */
export function parseMovieItems(value: unknown): MovieItem[] {
  if (!Array.isArray(value)) return [];
  const items: MovieItem[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const v = raw as Record<string, unknown>;
    const title = typeof v.title === "string" ? v.title.trim() : "";
    const backdrop = imagePath(v.backdrop);
    const poster = imagePath(v.poster);
    if (!Number.isInteger(v.id) || (v.id as number) <= 0 || !title || (!backdrop && !poster)) continue;
    items.push({
      id: v.id as number,
      kind: v.kind === "tv" ? "tv" : "movie",
      title,
      overview: typeof v.overview === "string" ? v.overview.trim() : "",
      backdrop,
      poster,
      rating: typeof v.rating === "number" && v.rating >= 0 && v.rating <= 10 ? v.rating : 0,
      votes: typeof v.votes === "number" && v.votes >= 0 ? Math.floor(v.votes) : 0,
      date: typeof v.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? v.date : undefined,
      genres: Array.isArray(v.genres)
        ? v.genres.filter((g): g is string => typeof g === "string" && g.length > 0).slice(0, 3)
        : [],
    });
    if (items.length === MOVIE_LIMIT) break;
  }
  return items;
}

/** Endereço da imagem no TMDB. `w780` para a capa larga, `w500` para o pôster. */
export function tmdbImage(path: string, size: "w500" | "w780" = "w780"): string {
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** Página do título no TMDB, em português. */
export function tmdbLink(item: Pick<MovieItem, "id" | "kind">): string {
  return `https://www.themoviedb.org/${item.kind}/${item.id}?language=pt-BR`;
}

/** "8,4", ou `null` quando ainda não há avaliações. */
export function ratingLabel(item: Pick<MovieItem, "rating" | "votes">): string | null {
  if (item.votes === 0 || item.rating === 0) return null;
  return item.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** "Filme · 2026" (sem o ano, quando a data não veio). */
export function kindAndYear(item: Pick<MovieItem, "kind" | "date">): string {
  const label = MOVIE_KIND_LABELS[item.kind];
  return item.date ? `${label} · ${item.date.slice(0, 4)}` : label;
}
