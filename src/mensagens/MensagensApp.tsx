import { useEffect, useMemo, useState } from "react";
import { ConversationList, type ConversationItem } from "../components/chat/ConversationList";
import { MessageThread } from "../components/chat/MessageThread";
import { UnlockPanel } from "../components/chat/UnlockPanel";
import { Avatar } from "../components/ui/Avatar";
import { IconButton } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ChevronLeftIcon, MaskIcon, UsersIcon } from "../components/ui/Icons";
import { ToastViewport } from "../components/ui/ToastViewport";
import { useAuthStore } from "../store/authStore";
import { DIRECT_PAGE } from "../store/chatApi";
import { useChatStore } from "../store/chatStore";
import { useDirectoryStore } from "../store/directoryStore";
import { useMessageStore } from "../store/messageStore";
import { useToastStore } from "../store/toastStore";
import type { ChannelId, ThreadMessage } from "../types/chat";
import { activeKeyOf, conversationWith, dmChannel, peerOfChannel, unreadByChannel } from "../utils/chat";
import { schoolTeam } from "../utils/directory";
import { countUnread, MESSAGE_PAGE } from "../utils/messages";
import { whenPageShown } from "../utils/pageLifecycle";
import { canModerateMessages, effectiveRole } from "../utils/roles";

/** Fundo redondo dos ícones dos dois canais de todos, do tamanho das fotos dos colegas. */
const CHANNEL_ICON = "flex h-11 w-11 items-center justify-center rounded-full";

/** No computador a conversa Geral já abre; no celular a pessoa escolhe na lista primeiro. */
function initialChannel(): ChannelId | null {
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

  const userId = profile?.id;
  const schoolId = profile?.schoolId ?? null;
  const peerId = channel ? peerOfChannel(channel) : null;

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const colleagues = useMemo(
    () => (schoolId ? schoolTeam(members, schoolId).filter((m) => m.active && m.id !== userId) : []),
    [members, schoolId, userId],
  );
  const peer = colleagues.find((m) => m.id === peerId);

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
      <ToastViewport />
    </div>
  );
}
