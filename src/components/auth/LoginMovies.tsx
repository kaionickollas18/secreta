import { useEffect, useState } from "react";
import { useMovieStore } from "../../store/movieStore";
import { formatDueDate } from "../../utils/date";
import { kindAndYear, ratingLabel, tmdbImage, tmdbLink, type MovieItem } from "../../utils/movies";
import { ExternalIcon, FilmIcon, StarIcon, TvIcon } from "../ui/Icons";
import { Skeleton } from "../ui/Skeleton";

const GRID = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";

/** Linha de informação: rótulo à esquerda, valor à direita. */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-raised/40 px-2 py-1.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xs font-medium tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function MovieCard({ item, index }: { item: MovieItem; index: number }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = item.backdrop ? tmdbImage(item.backdrop, "w780") : item.poster ? tmdbImage(item.poster, "w500") : null;
  const rating = ratingLabel(item);

  return (
    <li
      className="animate-enter"
      // Sequência curta: os cartões entram em fila, com no máximo 360 ms de espera.
      style={{ animationDelay: `${Math.min(index * 40, 360)}ms`, animationFillMode: "backwards" }}
    >
      <a
        href={tmdbLink(item)}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface/85 backdrop-blur-md transition-[border-color,box-shadow] duration-300 hover:border-accent/60 hover:shadow-card"
      >
        {/* Cabeçalho: tipo, título e nota. */}
        <div className="flex items-center gap-3 border-b border-line p-3">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-light"
          >
            {item.kind === "movie" ? <FilmIcon /> : <TvIcon />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate card-title" title={item.title}>
              {item.title}
            </h3>
            <p className="truncate text-xs text-muted">{kindAndYear(item)}</p>
          </div>
          {rating ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-prio-medium-tint px-2 py-1 text-xs font-semibold tabular-nums text-prio-medium">
              <span aria-hidden="true" className="[&>svg]:h-3 [&>svg]:w-3">
                <StarIcon />
              </span>
              <span className="sr-only">Nota </span>
              {rating}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-raised/70 px-2 py-1 text-xs font-semibold text-muted">
              Estreia
            </span>
          )}
        </div>

        {/* Imagem, com o convite para abrir a página ao passar o mouse ou focar. */}
        <div className="relative aspect-video overflow-hidden bg-raised/60">
          {image && !imageFailed ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04] motion-reduce:transform-none"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div aria-hidden="true" className="h-full w-full bg-gradient-to-br from-accent/30 via-raised to-magenta/20" />
          )}
          <div className="absolute inset-0 flex items-end justify-end bg-canvas/40 p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-xs font-semibold text-ink shadow-card backdrop-blur-sm">
              Abrir no TMDB
              <span aria-hidden="true" className="[&>svg]:h-3.5 [&>svg]:w-3.5">
                <ExternalIcon />
              </span>
            </span>
          </div>
        </div>

        {/* Sinopse. */}
        <div className="border-t border-line p-3">
          <p className={`line-clamp-3 text-sm ${item.overview ? "text-muted" : "italic text-muted"}`}>
            {item.overview || "Sinopse ainda não disponível em português."}
          </p>
        </div>

        {/* Gêneros e números. */}
        <div className="mt-auto space-y-2 border-t border-line p-3">
          {item.genres.length > 0 && (
            <ul aria-label="Gêneros" className="flex flex-wrap gap-1.5">
              {item.genres.map((genre) => (
                <li key={genre} className="rounded-lg bg-raised/70 px-2 py-1 text-xs text-ink">
                  {genre}
                </li>
              ))}
            </ul>
          )}
          <dl className="space-y-1.5">
            {item.date && <InfoRow label="Estreia" value={formatDueDate(item.date)} />}
            {item.votes > 0 && <InfoRow label="Avaliações" value={item.votes.toLocaleString("pt-BR")} />}
          </dl>
          <span className="sr-only">(abre a página do TMDB em nova aba)</span>
        </div>
      </a>
    </li>
  );
}

/**
 * Filmes e séries em destaque na semana, abaixo do login. São um extra: se não carregarem,
 * a seção simplesmente não aparece.
 */
export function LoginMovies() {
  const { items, status, load } = useMovieStore();

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "unavailable") return null;
  const loading = status === "idle" || status === "loading";

  return (
    <section aria-labelledby="h-movies" className="mx-auto w-full max-w-[1500px] px-4 pb-12 sm:px-6">
      <div className="mb-4">
        <h2 id="h-movies" className="panel-title">
          Em destaque nesta semana
        </h2>
        <p className="caption mt-0.5">Filmes e séries mais procurados, para ver antes de entrar.</p>
      </div>

      {loading ? (
        <>
          <p role="status" className="sr-only">
            Carregando destaques…
          </p>
          <div className={GRID}>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-96 rounded-2xl" />
            ))}
          </div>
        </>
      ) : (
        <ul className={GRID}>
          {items.map((item, index) => (
            <MovieCard key={`${item.kind}-${item.id}`} item={item} index={index} />
          ))}
        </ul>
      )}

      {/* Atribuição exigida pelos termos de uso do TMDB. */}
      <p className="mt-4 text-xs text-muted">
        Dados e imagens fornecidos pelo{" "}
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ink"
        >
          TMDB
        </a>
        . Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.
      </p>
    </section>
  );
}
