import { MAX_PDF_BYTES } from "../pdfReader";
import { toGray, type GrayImage } from "./omrReader";

/*
 * De onde vêm as imagens dos cartões: foto (arquivo), quadro da câmera ou página de PDF.
 * Tudo acontece no navegador: nenhuma imagem sai do aparelho.
 */

/** Lado maior da imagem lida: o bastante para as bolhas, leve para o celular. */
const READ_SIDE = 1600;
/** Lado maior da miniatura guardada para a revisão. */
const PREVIEW_SIDE = 1000;

export interface CardImage {
  gray: GrayImage;
  /** Imagem (JPEG) para mostrar na revisão, na mesma proporção de `gray`. */
  preview: string;
  /** De onde veio (ex.: "página 3, cartão de cima"). */
  label: string;
}

function canvasOf(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Este navegador não consegue processar imagens.");
  return ctx;
}

/** Desenha um recorte da fonte reduzido e devolve a imagem em cinza + a miniatura. */
function capture(
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  label: string,
): CardImage {
  const scale = Math.min(1, READ_SIDE / Math.max(sw, sh));
  const canvas = canvasOf(sw * scale, sh * scale);
  const ctx = context(canvas);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const gray = toGray(ctx.getImageData(0, 0, canvas.width, canvas.height));

  const previewScale = Math.min(1, PREVIEW_SIDE / Math.max(canvas.width, canvas.height));
  const small = canvasOf(canvas.width * previewScale, canvas.height * previewScale);
  context(small).drawImage(canvas, 0, 0, small.width, small.height);
  return { gray, preview: small.toDataURL("image/jpeg", 0.75), label };
}

/** Quadro atual da câmera. */
export function captureVideoFrame(video: HTMLVideoElement): CardImage {
  if (!video.videoWidth) throw new Error("A câmera ainda não começou a mostrar a imagem.");
  return capture(video, 0, 0, video.videoWidth, video.videoHeight, "Câmera");
}

/** Foto enviada como arquivo (JPEG, PNG, HEIC convertido pelo celular etc.). */
export async function imageFileToCards(file: File): Promise<CardImage[]> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`Não consegui abrir "${file.name}" como imagem.`);
  }
  try {
    return [capture(bitmap, 0, 0, bitmap.width, bitmap.height, file.name), ...halves(bitmap, bitmap.width, bitmap.height, file.name)];
  } finally {
    bitmap.close();
  }
}

/**
 * Folha em pé = dois cartões (um em cima, outro embaixo). Devolve as duas metades; quem lê
 * tenta a imagem inteira e, se não achar cartão, as metades.
 */
function halves(source: CanvasImageSource, width: number, height: number, label: string): CardImage[] {
  if (height / width < 1.15) return [];
  const half = height / 2;
  return [
    capture(source, 0, 0, width, half, `${label}, cartão de cima`),
    capture(source, 0, half, width, half, `${label}, cartão de baixo`),
  ];
}

export interface PdfPage {
  page: number;
  /** Cartões candidatos da página: a página inteira e, se ela for em pé, as duas metades. */
  candidates: CardImage[];
}

/**
 * Desenha cada página do PDF (cartões escaneados) e entrega uma por vez, para a tela mostrar
 * o andamento e o celular não guardar todas as páginas na memória.
 */
export async function* pdfPages(file: File): AsyncGenerator<PdfPage & { pages: number }> {
  if (file.size > MAX_PDF_BYTES) throw new Error("O arquivo é grande demais.");
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: 0 });
  let doc;
  try {
    doc = await task.promise;
  } catch {
    void task.destroy();
    throw new Error(`Não consegui abrir "${file.name}". Confira se é um PDF.`);
  }
  try {
    for (let page = 1; page <= doc.numPages; page += 1) {
      const pdfPage = await doc.getPage(page);
      const base = pdfPage.getViewport({ scale: 1 });
      // Página A4 desenhada com ~1700 px de largura (≈ 200 dpi): bolhas com folga.
      const viewport = pdfPage.getViewport({ scale: 1700 / base.width });
      const canvas = canvasOf(viewport.width, viewport.height);
      const ctx = context(canvas);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise;
      const label = `Página ${page}`;
      const candidates = [...halves(canvas, canvas.width, canvas.height, label)];
      if (candidates.length === 0) candidates.push(capture(canvas, 0, 0, canvas.width, canvas.height, label));
      pdfPage.cleanup();
      yield { page, pages: doc.numPages, candidates };
    }
  } finally {
    void task.destroy();
  }
}

export const isPdf = (file: File): boolean => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
