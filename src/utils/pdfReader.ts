import type { TextItem } from "./pdfText";

/** PDFs da rede passam de 20 MB (o boletim do EF II); acima disto, provavelmente é outro arquivo. */
export const MAX_PDF_BYTES = 60 * 1024 * 1024;

/**
 * Lê o texto de um PDF no próprio navegador (nada é enviado a outro serviço). O leitor
 * (pdf.js) só é baixado na primeira leitura. Falha com uma mensagem para o usuário.
 */
export async function readPdfText(file: File, onProgress?: (page: number, pages: number) => void): Promise<TextItem[]> {
  if (file.size > MAX_PDF_BYTES) throw new Error("O arquivo é grande demais para ser um PDF da rede.");
  // Versão "legacy": funciona também em navegadores mais antigos dos computadores da escola.
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
    throw new Error("Não foi possível abrir o arquivo. Confira se é o PDF tirado do sistema da rede.");
  }
  const items: TextItem[] = [];
  try {
    for (let page = 1; page <= doc.numPages; page += 1) {
      const content = await (await doc.getPage(page)).getTextContent();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        items.push({ page, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0, str: item.str });
      }
      onProgress?.(page, doc.numPages);
    }
  } finally {
    void task.destroy();
  }
  if (items.length === 0) {
    throw new Error("O PDF não tem texto (parece ser uma imagem escaneada). Tire o PDF direto do sistema da rede.");
  }
  return items;
}
