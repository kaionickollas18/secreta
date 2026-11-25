import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { readCandidate } from "../../hooks/useCardReader";
import type { AnswerSheet, Assessment } from "../../types/assessment";
import { captureVideoFrame } from "../../utils/omr/imageSource";
import type { PendingSheet } from "../../utils/sheetReview";
import { Button } from "../ui/Button";
import { CloseIcon } from "../ui/Icons";
import { SheetReview } from "./SheetReview";

interface CameraCaptureProps {
  assessment: Assessment;
  saved: readonly AnswerSheet[];
  /** Salva o cartão conferido. Devolve a mensagem de erro, ou `null`. */
  onSave: (pending: PendingSheet) => Promise<string | null>;
  onClose: () => void;
}

type Phase = { kind: "starting" } | { kind: "live" } | { kind: "error"; message: string } | { kind: "review"; pending: PendingSheet };

/** Intervalo entre tentativas da leitura automática. */
const AUTO_MS = 700;

function cameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") return "O navegador não liberou a câmera. Permita o acesso à câmera para este site e tente de novo.";
  if (name === "NotFoundError") return "Nenhuma câmera encontrada neste aparelho. Use \"Enviar fotos ou PDF\".";
  if (!window.isSecureContext) return "A câmera só funciona em endereço seguro (https).";
  return "Não foi possível abrir a câmera. Feche outros aplicativos que estejam usando a câmera e tente de novo.";
}

/**
 * Correção pela câmera do celular: enquadre o cartão na moldura; a leitura é automática (ou
 * pelo botão). Cada leitura abre a conferência; "Salvar e próximo" volta para a câmera.
 */
export function CameraCapture({ assessment, saved, onSave, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });
  const [auto, setAuto] = useState(true);
  const [hint, setHint] = useState("Enquadre o cartão inteiro na moldura, com os 4 quadrados pretos à vista.");
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);
  /** Depois de salvar, ignora por instantes o mesmo cartão que ainda está na frente da câmera. */
  const lastSaved = useRef<{ slot: number; at: number } | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase({ kind: "error", message: cameraError(null) });
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setPhase({ kind: "live" });
      } catch (error) {
        if (!cancelled) setPhase({ kind: "error", message: cameraError(error) });
      }
    }
    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  // Esc fecha a câmera.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tryRead = useCallback(
    (manual: boolean) => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      let result;
      try {
        result = readCandidate(captureVideoFrame(video), assessment, "camera");
      } catch {
        return;
      }
      if ("pending" in result) {
        const recent = lastSaved.current;
        if (!manual && recent && recent.slot === result.pending.slot && Date.now() - recent.at < 4000) return;
        navigator.vibrate?.(60);
        setPhase({ kind: "review", pending: result.pending });
        return;
      }
      if (manual || result.reading.status !== "no-card") setHint(result.reading.message);
    },
    [assessment],
  );

  useEffect(() => {
    if (phase.kind !== "live" || !auto) return;
    const timer = window.setInterval(() => tryRead(false), AUTO_MS);
    return () => window.clearInterval(timer);
  }, [phase.kind, auto, tryRead]);

  async function save(pending: PendingSheet) {
    setSaving(true);
    const error = await onSave(pending);
    setSaving(false);
    if (error) {
      setHint(error);
      return;
    }
    lastSaved.current = { slot: pending.slot, at: Date.now() };
    setCount((n) => n + 1);
    setHint("Salvo. Próximo cartão.");
    setPhase({ kind: "live" });
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Corrigir pela câmera" className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-sm font-semibold">
          {assessment.title || "Avaliação"} · {count} {count === 1 ? "salvo" : "salvos"} nesta sessão
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar a câmera"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
        >
          <CloseIcon />
        </button>
      </div>

      {/* O vídeo continua montado durante a conferência para a câmera não reiniciar. */}
      <div className={`relative min-h-0 flex-1 ${phase.kind === "review" ? "hidden" : ""}`}>
        <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />
        {phase.kind === "live" && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div className="relative aspect-[210/148] w-full max-w-[92%] rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] [max-height:85%]">
              {["left-1 top-1", "right-1 top-1", "bottom-1 right-1", "bottom-1 left-1"].map((pos) => (
                <span key={pos} className={`absolute h-[6%] w-[4%] min-w-[12px] bg-white/80 ${pos}`} />
              ))}
            </div>
          </div>
        )}
        {phase.kind === "starting" && <p className="absolute inset-0 flex items-center justify-center text-sm">Abrindo a câmera…</p>}
        {phase.kind === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="max-w-sm text-sm">{phase.message}</p>
            <Button variant="secondary" onClick={onClose}>
              Voltar
            </Button>
          </div>
        )}
      </div>

      {phase.kind === "live" && (
        <div className="flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <p role="status" aria-live="polite" className="min-h-[2.5rem] text-center text-sm text-white/90">
            {hint}
          </p>
          <div className="flex items-center justify-between gap-3">
            <label className="flex min-h-[44px] items-center gap-2 text-sm">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-5 w-5" />
              Leitura automática
            </label>
            <Button variant="primary" onClick={() => tryRead(true)} className="min-w-[9rem]">
              Ler cartão
            </Button>
          </div>
        </div>
      )}

      {phase.kind === "review" && (
        <div className="min-h-0 flex-1 overflow-y-auto bg-surface p-4 text-ink">
          <SheetReview
            assessment={assessment}
            pending={phase.pending}
            saved={saved}
            onChange={(pending) => setPhase({ kind: "review", pending })}
            onSave={() => {
              if (!saving) void save(phase.pending);
            }}
            onDiscard={() => {
              setHint("Leitura descartada. Enquadre o cartão de novo.");
              setPhase({ kind: "live" });
            }}
            saveLabel={saving ? "Salvando…" : "Salvar e próximo"}
            discardLabel="Ler de novo"
          />
        </div>
      )}
    </div>,
    document.body,
  );
}
