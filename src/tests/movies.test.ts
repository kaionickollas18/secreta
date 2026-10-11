import { describe, expect, it } from "vitest";
import {
  kindAndYear,
  MOVIE_LIMIT,
  parseMovieItems,
  ratingLabel,
  tmdbImage,
  tmdbLink,
} from "../utils/movies";

const valid = {
  id: 101,
  kind: "movie",
  title: "  Um Filme de Exemplo ",
  overview: "Uma história de teste.",
  backdrop: "/abcDEF_123-x.jpg",
  poster: "/poster.png",
  rating: 8.4,
  votes: 4964,
  date: "2026-07-29",
  genres: ["Ação", "Aventura", "Comédia", "Drama"],
};

describe("destaques da tela de login (TMDB)", () => {
  it("aceita um item completo, apara o título e limita os gêneros a três", () => {
    expect(parseMovieItems([valid])).toEqual([
      { ...valid, title: "Um Filme de Exemplo", genres: ["Ação", "Aventura", "Comédia"] },
    ]);
  });

  it("descarta caminhos de imagem fora do formato do TMDB", () => {
    const [item] = parseMovieItems([{ ...valid, backdrop: "https://exemplo.com/x.jpg" }]);
    expect(item?.backdrop).toBeUndefined();
    expect(item?.poster).toBe("/poster.png");
    // Sem nenhuma imagem válida, o item não entra.
    expect(parseMovieItems([{ ...valid, backdrop: "/../segredo.jpg", poster: "//exemplo.com/a.png" }])).toEqual([]);
    expect(parseMovieItems([{ ...valid, backdrop: null, poster: "/a.svg" }])).toEqual([]);
  });

  it("exige id e título, e corrige valores fora da faixa", () => {
    expect(parseMovieItems([{ ...valid, id: "101" }])).toEqual([]);
    expect(parseMovieItems([{ ...valid, id: 0 }])).toEqual([]);
    expect(parseMovieItems([{ ...valid, title: "  " }])).toEqual([]);
    const [item] = parseMovieItems([{ ...valid, kind: "pessoa", rating: 42, votes: -3, date: "29/07/2026", genres: "Ação" }]);
    expect(item).toMatchObject({ kind: "movie", rating: 0, votes: 0, date: undefined, genres: [] });
  });

  it("ignora respostas fora do formato e limita a 10", () => {
    expect(parseMovieItems(null)).toEqual([]);
    expect(parseMovieItems({ items: [] })).toEqual([]);
    expect(parseMovieItems([null, 7, "texto", valid])).toHaveLength(1);
    const many = Array.from({ length: 30 }, (_, i) => ({ ...valid, id: i + 1 }));
    expect(parseMovieItems(many)).toHaveLength(MOVIE_LIMIT);
  });

  it("monta os endereços do TMDB", () => {
    expect(tmdbImage("/abc.jpg")).toBe("https://image.tmdb.org/t/p/w780/abc.jpg");
    expect(tmdbImage("/abc.jpg", "w500")).toBe("https://image.tmdb.org/t/p/w500/abc.jpg");
    expect(tmdbLink({ id: 101, kind: "movie" })).toBe("https://www.themoviedb.org/movie/101?language=pt-BR");
    expect(tmdbLink({ id: 7, kind: "tv" })).toBe("https://www.themoviedb.org/tv/7?language=pt-BR");
  });

  it("formata a nota e o tipo com o ano", () => {
    expect(ratingLabel({ rating: 8.4, votes: 10 })).toBe("8,4");
    expect(ratingLabel({ rating: 7, votes: 3 })).toBe("7,0");
    // Estreia sem avaliações não mostra nota zero.
    expect(ratingLabel({ rating: 0, votes: 0 })).toBeNull();
    expect(kindAndYear({ kind: "movie", date: "2026-07-29" })).toBe("Filme · 2026");
    expect(kindAndYear({ kind: "tv", date: undefined })).toBe("Série");
  });
});
