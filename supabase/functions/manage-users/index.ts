// Edge Function (Deno): cria e gerencia usuários. Precisa da service role, que NUNCA vai ao navegador.
// Quem pode o quê:
//   master    → create_school (escola + secretário), delete_school, update_user/delete_user de secretários
//   secretary → create_assistant, update_user/delete_user de auxiliares da própria escola
// "Quem chama" é sempre o papel real (coluna role): um auxiliar com acesso especial age como
// secretário no quadro, mas não gerencia a equipe.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "master" | "secretary" | "assistant";

interface Caller {
  id: string;
  role: Role;
  school_id: string | null;
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function text(value: unknown, field: string, min: number, max: number): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (v.length < min || v.length > max) throw new HttpError(400, `Campo inválido: ${field}.`);
  return v;
}

function email(value: unknown): string {
  const v = text(value, "e-mail", 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new HttpError(400, "E-mail inválido.");
  return v;
}

function password(value: unknown): string {
  if (typeof value !== "string" || value.length < 8 || value.length > 72) {
    throw new HttpError(400, "A senha deve ter de 8 a 72 caracteres.");
  }
  return value;
}

const lastNameOf = (fullName: string) => fullName.split(/\s+/).pop() ?? fullName;

async function getCaller(req: Request): Promise<Caller> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Sessão ausente.");
  const { data: auth, error } = await admin.auth.getUser(token);
  if (error || !auth.user) throw new HttpError(401, "Sessão inválida.");
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, school_id, active")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile || !profile.active) throw new HttpError(403, "Usuário sem acesso.");
  return profile as Caller;
}

/** Cria usuário no Auth + perfil. Desfaz o usuário do Auth se o perfil falhar. */
async function createUser(input: {
  email: string;
  password: string;
  fullName: string;
  role: Role;
  schoolId: string | null;
  createdBy: string;
}): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    const taken = error?.message.toLowerCase().includes("already");
    throw new HttpError(taken ? 409 : 400, taken ? "Já existe um usuário com este e-mail." : "Não foi possível criar o usuário.");
  }
  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    role: input.role,
    school_id: input.schoolId,
    email: input.email,
    full_name: input.fullName,
    last_name: lastNameOf(input.fullName),
    created_by: input.createdBy,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new HttpError(400, "Não foi possível salvar o perfil.");
  }
  return data.user.id;
}

/** Apaga as fotos de perfil de quem está sendo excluído (pasta <id>/ do bucket avatars). */
async function removeAvatars(userId: string): Promise<void> {
  const { data: files } = await admin.storage.from("avatars").list(userId);
  if (files && files.length > 0) {
    await admin.storage.from("avatars").remove(files.map((file) => `${userId}/${file.name}`));
  }
}

/** Verifica se o chamador pode gerenciar o alvo e devolve o perfil dele. */
async function loadManageable(caller: Caller, userId: unknown) {
  const id = text(userId, "usuário", 36, 36);
  const { data: target } = await admin
    .from("profiles")
    .select("id, role, school_id, full_name")
    .eq("id", id)
    .maybeSingle();
  if (!target) throw new HttpError(404, "Usuário não encontrado.");
  const allowed =
    (caller.role === "master" && target.role === "secretary") ||
    (caller.role === "secretary" && target.role === "assistant" && target.school_id === caller.school_id);
  if (!allowed) throw new HttpError(403, "Sem permissão para este usuário.");
  return target as { id: string; role: Role; school_id: string; full_name: string };
}

async function handle(action: unknown, body: Record<string, unknown>, caller: Caller) {
  switch (action) {
    case "create_school": {
      if (caller.role !== "master") throw new HttpError(403, "Somente o Master cadastra escolas.");
      const name = text(body.school_name, "nome da escola", 2, 120);
      const fullName = text(body.full_name, "nome do secretário", 2, 120);
      const mail = email(body.email);
      const pass = password(body.password);
      const { data: school, error } = await admin.from("schools").insert({ name }).select("id").single();
      if (error || !school) throw new HttpError(400, "Não foi possível criar a escola.");
      try {
        const userId = await createUser({
          email: mail,
          password: pass,
          fullName,
          role: "secretary",
          schoolId: school.id,
          createdBy: caller.id,
        });
        return { school_id: school.id, secretary_id: userId };
      } catch (e) {
        await admin.from("schools").delete().eq("id", school.id);
        throw e;
      }
    }

    case "create_assistant": {
      if (caller.role !== "secretary" || !caller.school_id) {
        throw new HttpError(403, "Somente o Secretário cadastra auxiliares.");
      }
      const userId = await createUser({
        email: email(body.email),
        password: password(body.password),
        fullName: text(body.full_name, "nome", 2, 120),
        role: "assistant",
        schoolId: caller.school_id,
        createdBy: caller.id,
      });
      return { user_id: userId };
    }

    case "update_user": {
      const target = await loadManageable(caller, body.user_id);
      const profilePatch: Record<string, unknown> = {};
      const authPatch: Record<string, unknown> = {};
      if (body.full_name !== undefined) {
        const fullName = text(body.full_name, "nome", 2, 120);
        // Só mexe no sobrenome quando o nome de fato mudou: a pessoa pode ter escolhido
        // outro sobrenome no próprio perfil, e uma edição qualquer não deve desfazer isso.
        if (fullName !== target.full_name) {
          profilePatch.full_name = fullName;
          profilePatch.last_name = lastNameOf(fullName);
        }
      }
      if (body.password !== undefined) authPatch.password = password(body.password);
      if (body.active !== undefined) {
        const active = body.active === true;
        profilePatch.active = active;
        authPatch.ban_duration = active ? "none" : "876000h";
      }
      // Acesso especial: só o secretário concede, e só a auxiliares da própria escola
      // (loadManageable já garantiu as duas coisas quando quem chama é secretário).
      if (body.elevated !== undefined) {
        if (caller.role !== "secretary" || target.role !== "assistant") {
          throw new HttpError(403, "Somente o Secretário define o acesso especial de um auxiliar.");
        }
        profilePatch.elevated = body.elevated === true;
      }
      if (Object.keys(profilePatch).length > 0) {
        const { error } = await admin.from("profiles").update(profilePatch).eq("id", target.id);
        if (error) throw new HttpError(400, "Não foi possível atualizar o perfil.");
      }
      if (Object.keys(authPatch).length > 0) {
        const { error } = await admin.auth.admin.updateUserById(target.id, authPatch);
        if (error) throw new HttpError(400, "Não foi possível atualizar o acesso.");
      }
      return { ok: true };
    }

    case "delete_user": {
      const target = await loadManageable(caller, body.user_id);
      // Tira o usuário dos responsáveis das tarefas antes de remover.
      const { data: tasks } = await admin.from("tasks").select("id, assignee_ids").contains("assignee_ids", [target.id]);
      for (const task of tasks ?? []) {
        await admin
          .from("tasks")
          .update({ assignee_ids: (task.assignee_ids as string[]).filter((a) => a !== target.id) })
          .eq("id", task.id);
      }
      await removeAvatars(target.id);
      const { error } = await admin.auth.admin.deleteUser(target.id);
      if (error) throw new HttpError(400, "Não foi possível excluir o usuário.");
      return { ok: true };
    }

    case "delete_school": {
      if (caller.role !== "master") throw new HttpError(403, "Somente o Master exclui escolas.");
      const schoolId = text(body.school_id, "escola", 36, 36);
      const { data: members } = await admin.from("profiles").select("id").eq("school_id", schoolId);
      for (const member of members ?? []) {
        await removeAvatars(member.id);
        await admin.auth.admin.deleteUser(member.id);
      }
      const { error } = await admin.from("schools").delete().eq("id", schoolId);
      if (error) throw new HttpError(400, "Não foi possível excluir a escola.");
      return { ok: true };
    }

    default:
      throw new HttpError(400, "Ação desconhecida.");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const caller = await getCaller(req);
    const body = (await req.json()) as Record<string, unknown>;
    return json(await handle(body.action, body, caller));
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "Erro interno." }, 500);
  }
});
