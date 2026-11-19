import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Classroom, GradeRow, GradeStudent, Subject } from "../../types/grade";
import type { SchoolIdentity } from "../../types/school";
import { todayISO } from "../../utils/date";
import { buildReportCard } from "../../utils/reportCard";
import { preloadImages } from "../../utils/students";
import { Button } from "../ui/Button";
import { DownloadIcon } from "../ui/Icons";
import { Modal } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import { ReportCardSheet } from "./ReportCardSheet";

interface ReportCardModalProps {
  student: GradeStudent | null;
  classroom: Classroom | null;
  subjects: Subject[];
  /** Notas do aluno nos quatro bimestres, ou o andamento da carga. */
  grades: GradeRow[] | "loading" | "error" | undefined;
  identity: SchoolIdentity;
  schoolYear: number;
  onClose: () => void;
  onRetry: () => void;
}

/** Largura e altura da folha A4 deitada em pixels de tela (96 por polegada). */
const SHEET_WIDTH = (297 / 25.4) * 96;
const SHEET_HEIGHT = (209.6 / 25.4) * 96;

/** Boletim do aluno: a folha na tela, reduzida para caber, e o botão para baixar em PDF. */
export function ReportCardModal({
  student,
  classroom,
  subjects,
  grades,
  identity,
  schoolYear,
  onClose,
  onRetry,
}: ReportCardModalProps) {
  const [printing, setPrinting] = useState(false);
  const [scale, setScale] = useState(1);
  const frame = useRef<HTMLDivElement>(null);
  const issuedOn = todayISO();
  const report = useMemo(
    () => (Array.isArray(grades) ? buildReportCard(grades, subjects) : null),
    [grades, subjects],
  );

  // A folha tem 210 mm; na tela ela encolhe para a largura da janela.
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) return;
    const update = () => setScale(Math.min(1, element.clientWidth / SHEET_WIDTH) || 1);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [report]);

  // Imprime depois que a folha entrou na página e a logo carregou; o PDF sai pela janela de impressão.
  useEffect(() => {
    if (!printing || !student) return;
    let cancelled = false;
    const title = document.title;
    const done = () => {
      document.title = title;
      setPrinting(false);
    };
    void preloadImages(identity.logoUrl ? [identity.logoUrl] : []).then(() => {
      if (cancelled) return;
      window.addEventListener("afterprint", done, { once: true });
      document.title = `Boletim - ${student.name}`;
      window.print();
    });
    return () => {
      cancelled = true;
      window.removeEventListener("afterprint", done);
    };
  }, [printing, student, identity.logoUrl]);

  if (!student) return null;
  const sheet =
    report &&
    ((key: string) => (
      <ReportCardSheet
        key={key}
        student={student}
        classroom={classroom}
        report={report}
        identity={identity}
        schoolYear={schoolYear}
        issuedOn={issuedOn}
      />
    ));

  return (
    <Modal open size="wide" title={`Boletim · ${student.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {grades === "error" ? (
          <p role="alert" className="text-sm text-prio-urgent">
            Não foi possível carregar o boletim.{" "}
            <button type="button" className="underline" onClick={onRetry}>
              Tentar de novo
            </button>
          </p>
        ) : !report ? (
          <div>
            <p role="status" className="sr-only">
              Carregando o boletim…
            </p>
            <Skeleton className="aspect-[297/210] w-full rounded-xl" />
          </div>
        ) : report.subjects.length === 0 ? (
          <p className="text-sm">Este aluno ainda não tem notas enviadas.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="caption">
                Foto, participação e observações saem em branco, para preencher à mão.
              </p>
              <Button
                variant="primary"
                onClick={() => setPrinting(true)}
                disabled={printing}
              >
                <DownloadIcon />
                Baixar boletim
              </Button>
            </div>
            <div
              ref={frame}
              className="boletim-preview"
              style={{ height: SHEET_HEIGHT * scale }}
            >
              <div
                className="boletim-preview-inner"
                style={{ transform: `scale(${scale})`, width: SHEET_WIDTH }}
              >
                {sheet?.("tela")}
              </div>
            </div>
          </>
        )}
      </div>
      {printing &&
        sheet &&
        createPortal(
          <div className="print-document boletim">{sheet("impressao")}</div>,
          document.body,
        )}
    </Modal>
  );
}
