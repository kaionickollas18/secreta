import { useEffect, useMemo, useState } from "react";
import { ConversationList, type ConversationItem } from "../components/chat/ConversationList";
import { MessageThread } from "../components/chat/MessageThread";
import type { MentionResolver } from "../components/chat/RichText";
import { TaskPreview } from "../components/chat/TaskPreview";
import { UnlockPanel } from "../components/chat/UnlockPanel";
import { MemberProfile } from "../components/profile/MemberProfile";
import { Avatar } from "../components/ui/Avatar";
import { Button, IconButton } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Modal } from "../components/ui/Modal";
import { ChevronLeftIcon, MaskIcon, UsersIcon } from "../components/ui/Icons";
import { ToastViewport } from "../components/ui/ToastViewport";
import { STATUS_LABELS } from "../constants/board";
import { useAuthStore } from "../store/authStore";
import { DIRECT_PAGE } from "../store/chatApi";
import { useChatStore } from "../store/chatStore";
import { useDirectoryStore } from "../store/directoryStore";
import { useMessageStore } from "../store/messageStore";
import { useTaskStore } from "../store/taskStore";
import { useToastStore } from "../store/toastStore";
import type { ChannelId, ThreadMessage } from "../types/chat";
import { activeKeyOf, conversationWith, dmChannel, peerFromSearch, peerOfChannel, unreadByChannel } from "../utils/chat";
import { displayName, schoolTeam } from "../utils/directory";
import { mentionsUser, type MentionOption } from "../utils/mentions";
import { countUnread, MESSAGE_PAGE } from "../utils/messages";
import { whenPageShown } from "../utils/pageLifecycle";
import { canModerateMessages, effectiveRole } from "../utils/roles";

/** Fundo redondo dos ícones dos dois canais de todos, do tamanho das fotos dos colegas. */
const CHANNEL_ICON = "flex h-11 w-11 items-center justify-center rounded-full";

/**
 * Vindo do perfil de alguém (`?com=<id>`), abre a conversa com essa pessoa. Senão, no
 * computador a conversa Geral já abre; no celular a pessoa escolhe na lista primeiro.
 */
function initialChannel(): ChannelId | null {
  const peer = peerFromSearch(window.location.search);
  if (peer) {
    window.history.replaceState(null, "", window.location.pathname);
    return dmChannel(peer);
  }
  return typeof window.matchMedia === "function" && window.matchMedia("(min-width: 768px)").matches ? "geral" : null;
}

/**
 * Conversas da escola: Geral (o mural de todos), Anônimo e uma conversa protegida com cada
 * colega. O AppShell carrega e acompanha as mensagens; aqui escolhemos, exibimos e enviamos.
 */
export default function MensagensApp() {
  const profile = useAuthStore((s) => s.profile);
  const mural = useMessageStore();
  const chat = useChatStore();
  const members = useDirectoryStore((s) => s.members);
  const loadDirectory = useDirectoryStore((s) => s.load);
  const pushToast = useToastStore((s) => s.push);
  const [channel, setChannel] = useState<ChannelId | null>(initialChannel);
  const [toDelete, setToDelete] = useState<ThreadMessage | null>(null);
  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.load);
  /** Perfil ou tarefa aberta a partir de uma marcação ou do nome de quem escreveu. */
  const [profileId, setProfileId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const userId = profile?.id;
  const schoolId = profile?.schoolId ?? null;
  const peerId = channel ? peerOfChannel(channel) : null;

  useEffect(() => {
    void loadDirectory();
    // As tarefas servem às marcações `#` e ao perfil (tarefas em aberto de cada pessoa).
    void loadTasks();
  }, [loadDirectory, loadTasks]);

  const team = useMemo(() => (schoolId ? schoolTeam(members, schoolId) : []), [members, schoolId]);
  const colleagues = useMemo(() => team.filter((m) => m.active && m.id !== userId), [team, userId]);
  const peer = colleagues.find((m) => m.id === peerId);
  const profileMember = team.find((m) => m.id === profileId);
  const previewTask = tasks.find((t) => t.id === taskId);

  const mentionOptions = useMemo<MentionOption[]>(
    () => [
      ...colleagues.map((m) => ({ kind: "user" as const, id: m.id, label: m.lastName, hint: displayName(m) })),
      // Tarefas em andamento primeiro; as concluídas também podem ser citadas.
      ...[...tasks]
        .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.title.localeCompare(b.title, "pt-BR"))
        .map((t) => ({ kind: "task" as const, id: t.id, label: t.title, hint: STATUS_LABELS[t.status] })),
    ],
    [colleagues, tasks],
  );

  const resolver = useMemo<MentionResolver>(
    () => ({
      userName: (id) => team.find((m) => m.id === id)?.lastName,
      taskTitle: (id) => tasks.find((t) => t.id === id)?.title,
      onOpenUser: setProfileId,
      onOpenTask: setTaskId,
    }),
    [team, tasks],
  );

  const muralCount = mural.messages.length;
  const anonymousCount = chat.anonymous.length;
  const peerCount = useMemo(
    () => (userId && peerId ? conversationWith(chat.directs, userId, peerId).length : 0),
    [chat.directs, userId, peerId],
  );
  const { markSeen: markMuralSeen } = mural;
  const { markSeen: markChatSeen } = chat;

  // Ao abrir uma conversa e a cada mensagem nova nela: registra como lida.
  useEffect(() => {
    if (!userId || !channel) return;
    return whenPageShown(() => {
      if (channel === "geral") markMuralSeen(userId);
      else markChatSeen(userId, channel);
    });
  }, [userId, channel, muralCount, anonymousCount, peerCount, markMuralSeen, markChatSeen]);

  const unread = useMemo(
    () => (userId ? unreadByChannel(chat.directs, chat.anonymous, chat.seen, userId) : {}),
    [chat.directs, chat.anonymous, chat.seen, userId],
  );

  if (!profile || !userId || !schoolId) return null;
  const moderator = canModerateMessages(effectiveRole(profile));

  const items: ConversationItem[] = [
    {
      id: "geral",
      label: "Geral",
      hint: "Mural: todos da escola veem",
      picture: (
        <span className={`${CHANNEL_ICON} bg-accent-soft text-accent-light`}>
          <UsersIcon />
        </span>
      ),
      unread: channel === "geral" ? 0 : countUnread(mural.messages, mural.lastSeen, userId),
      mentioned:
        channel !== "geral" &&
        mural.messages.some(
          (m) => m.senderId !== userId && (!mural.lastSeen || m.createdAt > mural.lastSeen) && mentionsUser(m.body, userId),
        ),
    },
    {
      id: "anonimo",
      label: "Anônimo",
      hint: "Sem nome para os colegas",
      picture: (
        <span className={`${CHANNEL_ICON} bg-raised text-ink`}>
          <MaskIcon />
        </span>
      ),
      unread: channel === "anonimo" ? 0 : (unread.anonimo ?? 0),
      mentioned:
        channel !== "anonimo" &&
        chat.anonymous.some(
          (m) => !m.mine && (!chat.seen.anonimo || m.createdAt > chat.seen.anonimo) && mentionsUser(m.body, userId),
        ),
    },
    ...colleagues.map((member) => {
      const id = dmChannel(member.id);
      return {
        id,
        label: member.lastName,
        hint: member.nickname ?? member.fullName,
        picture: <Avatar id={member.id} name={member.lastName} url={member.avatarUrl} className="h-11 w-11 text-base" />,
        unread: channel === id ? 0 : (unread[id] ?? 0),
      };
    }),
  ];
  const current = items.find((item) => item.id === channel);

  let messages: ThreadMessage[] = [];
  if (channel === "geral") {
    messages = mural.messages.map((m) => {
      const mine = m.senderId === userId;
      return {
        id: m.id,
        mine,
        author: mine ? "Você" : m.senderName,
        authorId: m.senderId,
        body: m.body,
        createdAt: m.createdAt,
        canDelete: mine || moderator,
        colorSeed: m.senderId ?? m.senderName,
      };
    });
  } else if (channel === "anonimo") {
    messages = chat.anonymous.map((m) => ({
      id: m.id,
      mine: m.mine,
      author: m.mine ? "Você (anônimo)" : "Anônimo",
      body: m.body,
      createdAt: m.createdAt,
      canDelete: m.mine || moderator,
      colorSeed: "anonimo",
    }));
  } else if (peerId) {
    messages = conversationWith(chat.directs, userId, peerId).map((m) => {
      const mine = m.senderId === userId;
      return {
        id: m.id,
        mine,
        author: mine ? "Você" : (peer?.lastName ?? "Colega"),
        authorId: m.senderId,
        body: chat.plain[m.id] ?? null,
        createdAt: m.createdAt,
        canDelete: mine,
        colorSeed: m.senderId,
      };
    });
  }

  async function handleDelete() {
    if (!toDelete || !channel) return;
    const failure =
      channel === "geral"
        ? await mural.remove(toDelete.id)
        : channel === "anonimo"
          ? await chat.removeAnonymous(toDelete.id)
          : await chat.removeDirect(toDelete.id);
    setToDelete(null);
    pushToast(failure ? { tone: "error", message: failure } : { tone: "success", message: "Mensagem apagada." });
  }

  const thread =
    channel === "geral" ? (
      <MessageThread
        key="geral"
        label="Mensagens do mural"
        messages={messages}
        status={mural.status}
        onRetry={() => void mural.load(userId)}
        emptyTitle="Nenhuma mensagem ainda"
        emptyDescription="Escreva a primeira mensagem para a equipe."
        truncated={mural.messages.length >= MESSAGE_PAGE}
        placeholder="Escreva uma mensagem para a equipe"
        onSend={(text) => mural.send(schoolId, text)}
        onDelete={setToDelete}
        currentUserId={userId}
        mentionOptions={mentionOptions}
        resolver={resolver}
      />
    ) : channel === "anonimo" ? (
      <MessageThread
        key="anonimo"
        label="Mensagens anônimas"
        messages={messages}
        status={chat.status}
        onRetry={() => void chat.load(userId)}
        emptyTitle="Nenhuma mensagem anônima"
        emptyDescription="O que for escrito aqui aparece para a escola sem o nome de quem escreveu."
        truncated={chat.anonymous.length >= MESSAGE_PAGE}
        notice={
          <p className="rounded-xl border border-line bg-canvas/40 px-3 py-2 caption">
            Seus colegas não veem quem escreveu. Em caso de abuso, a autoria pode ser apurada por quem administra o
            sistema, e o secretário pode apagar mensagens.
          </p>
        }
        placeholder="Escreva sem se identificar"
        onSend={(text) => chat.sendAnonymous(schoolId, text)}
        onDelete={setToDelete}
        currentUserId={userId}
        mentionOptions={mentionOptions}
        resolver={resolver}
      />
    ) : peer && chat.lock === "locked" && chat.status === "ready" ? (
      <UnlockPanel
        hasKey={chat.hasKey}
        onUnlock={(password) => chat.unlock(userId, password)}
        onReset={(password) => chat.reset(userId, password)}
      />
    ) : peer ? (
      <MessageThread
        key={peer.id}
        label={`Conversa com ${peer.fullName}`}
        messages={messages}
        status={chat.status}
        onRetry={() => void chat.load(userId)}
        emptyTitle="Nenhuma mensagem ainda"
        emptyDescription={`Escreva a primeira mensagem para ${peer.lastName}.`}
        truncated={chat.directs.length >= DIRECT_PAGE}
        placeholder={`Mensagem para ${peer.lastName}`}
        blocked={
          chat.status === "ready" && !activeKeyOf(chat.keys, peer.id)
            ? `${peer.lastName} ainda não ativou as conversas protegidas. Isso acontece sozinho no próximo login, ou ao abrir esta aba.`
            : undefined
        }
        onSend={(text) => chat.sendDirect(userId, peer.id, text)}
        onDelete={setToDelete}
        currentUserId={userId}
        mentionOptions={mentionOptions}
        resolver={resolver}
      />
    ) : (
      <p className="m-auto p-6 text-center text-sm text-muted">Escolha uma conversa na lista.</p>
    );

  return (
    <div className="mx-auto flex h-[calc(100dvh-5rem)] max-w-[1200px] flex-col gap-4 px-4 py-5 sm:px-6 md:h-dvh">
      <header className={channel ? "hidden md:block" : ""}>
        <h1 className="page-title">Conversas</h1>
        <p className="page-lede">Fale com todos no Geral, sem se identificar no Anônimo, ou só com um colega.</p>
      </header>

      <main className="grid min-h-0 flex-1 gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <ConversationList
          items={items}
          active={channel}
          onSelect={setChannel}
          className={`glass min-h-0 overflow-y-auto rounded-3xl p-2 ${channel ? "hidden md:block" : ""}`}
        />

        <section
          aria-label={current ? `Conversa: ${current.label}` : "Conversa"}
          className={`glass min-h-0 flex-col rounded-3xl ${channel ? "flex" : "hidden md:flex"}`}
        >
          {current && (
            <div className="flex items-center gap-2 border-b border-line p-2.5">
              <IconButton aria-label="Voltar para a lista de conversas" className="md:hidden" onClick={() => setChannel(null)}>
                <ChevronLeftIcon />
              </IconButton>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center">{current.picture}</span>
              <div className="min-w-0">
                <h2 className="truncate section-title">{peer ? peer.fullName : current.label}</h2>
                <p className="truncate caption">
                  {peer ? "Protegida: só vocês dois conseguem ler" : current.hint}
                </p>
              </div>
              {peer && (
                <Button variant="ghost" className="ml-auto shrink-0" onClick={() => setProfileId(peer.id)}>
                  Ver perfil
                </Button>
              )}
            </div>
          )}
          {thread}
        </section>
      </main>

      <ConfirmDialog
        open={toDelete !== null}
        title="Apagar mensagem?"
        message={
          peerId
            ? "A mensagem some para você e para o colega e não pode ser recuperada."
            : "A mensagem some para toda a escola e não pode ser recuperada."
        }
        confirmLabel="Apagar"
        onConfirm={() => void handleDelete()}
        onCancel={() => setToDelete(null)}
      />
      <Modal
        open={profileMember !== undefined}
        title={profileMember ? `Perfil de ${displayName(profileMember)}` : ""}
        onClose={() => setProfileId(null)}
      >
        {profileMember && (
          <MemberProfile
            member={profileMember}
            tasks={tasks}
            onStartChat={
              colleagues.some((m) => m.id === profileMember.id) && peerId !== profileMember.id
                ? () => {
                    setChannel(dmChannel(profileMember.id));
                    setProfileId(null);
                  }
                : undefined
            }
          />
        )}
      </Modal>
      <Modal open={previewTask !== undefined} title={previewTask?.title ?? ""} onClose={() => setTaskId(null)}>
        {previewTask && (
          <TaskPreview task={previewTask} nameOf={(id) => team.find((m) => m.id === id)?.lastName ?? "Alguém"} />
        )}
      </Modal>
      <ToastViewport />
    </div>
  );
}
