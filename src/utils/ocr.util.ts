import { createWorker } from 'tesseract.js';

export async function recognizeText(buffer: Buffer, lang: string) {
  const worker = await createWorker(lang);
  const result = await worker.recognize(buffer);
  await worker.terminate();
  return result;
}
