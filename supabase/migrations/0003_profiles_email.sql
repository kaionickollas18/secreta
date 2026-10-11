-- E-mail no perfil, só para exibir quem é quem nas listas de gestão (o login continua no Auth).
alter table public.profiles add column email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;
