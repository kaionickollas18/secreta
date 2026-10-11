-- tasks_guard é só trigger: ninguém precisa executá-la via API.
revoke execute on function public.tasks_guard() from public, anon, authenticated;
-- As funções de papel/escola são usadas nas policies (usuário logado); anônimo não precisa.
revoke execute on function public.current_role_name() from public, anon;
revoke execute on function public.current_school_id() from public, anon;
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.current_school_id() to authenticated;
