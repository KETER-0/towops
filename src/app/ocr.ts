// On-device text recognition with Tesseract.js. The engine (~10 MB with the
// English model) is downloaded only the first time someone presses "Read",
// then reused. The photo itself never leaves the browser.
import type { Worker } from 'tesseract.js';

let worker: Promise<Worker> | null = null;
let report: (status: string, progress: number) => void = () => {};

export async function readText(image: string | File, onProgress: (status: string, progress: number) => void): Promise<string> {
  report = onProgress;
  if (!worker) {
    worker = import('tesseract.js').then(({ createWorker }) =>
      createWorker('eng', 1, { logger: (m: { status: string; progress: number }) => report(m.status, m.progress) }));
  }
  const w = await worker;
  const { data } = await w.recognize(image);
  return data.text;
}
