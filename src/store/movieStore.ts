import { create } from "zustand";
import type { MovieItem } from "../utils/movies";
import { fetchLoginMovies } from "./movieApi";

interface MovieState {
  items: MovieItem[];
  /** `unavailable`: não deu para carregar; a tela de login segue sem os destaques. */
  status: "idle" | "loading" | "ready" | "unavailable";
  load: () => Promise<void>;
}

export const useMovieStore = create<MovieState>((set, get) => ({
  items: [],
  status: "idle",

  load: async () => {
    if (get().status !== "idle") return;
    set({ status: "loading" });
    const items = await fetchLoginMovies();
    set(items && items.length > 0 ? { status: "ready", items } : { status: "unavailable", items: [] });
  },
}));
