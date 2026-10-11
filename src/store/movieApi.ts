import { parseMovieItems, type MovieItem } from "../utils/movies";
import { supabase } from "./supabaseClient";

/**
 * Destaques da tela de login, pela Edge Function `login-movies`. O token do TMDB fica só no
 * servidor, que também guarda o resultado em cache. Qualquer falha devolve `null`: a seção é
 * um extra e nunca pode atrapalhar o login.
 */
export async function fetchLoginMovies(): Promise<MovieItem[] | null> {
  try {
    if (!supabase) return null;
    const { data, error } = await supabase.functions.invoke("login-movies", { method: "GET" });
    if (error) return null;
    return parseMovieItems((data as { items?: unknown } | null)?.items);
  } catch {
    return null;
  }
}
