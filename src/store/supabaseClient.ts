import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** `null` quando as variáveis de ambiente não estão configuradas (o app mostra um aviso). */
export const supabase: SupabaseClient | null =
  url && publishableKey ? createClient(url, publishableKey) : null;
