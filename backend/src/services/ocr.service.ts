import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { pdf } from "pdf-to-img";
import Tesseract from "tesseract.js";

export interface OcrInput {
  buffer: Buffer;
  mimetype: string;
}

export interface OcrResult {
  text: string;
  confidence: number;
  pages: number;
}

const MIN_IMAGE_WIDTH = 1600;
const MAX_IMAGE_WIDTH = 2600;
const CONTRAST_FACTOR = 1.25;
const PDF_SCALE = 4;
const MAX_PDF_PAGES = 3;
const cachePath = path.join(os.tmpdir(), "udyam-digital-tesseract");

let workerPromise: Promise<Tesseract.Worker> | null = null;
let recognitionQueue: Promise<void> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = recognitionQueue.then(task, task);
  recognitionQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function getWorker(): Promise<Tesseract.Worker> {
  if (workerPromise) {
    return workerPromise;
  }

  workerPromise = (async () => {
    await mkdir(cachePath, { recursive: true });
    const worker = await Tesseract.createWorker(
      "eng",
      Tesseract.OEM.LSTM_ONLY,
      { cachePath },
    );

    await worker.setParameters({
      preserve_interword_spaces: "1",
      user_defined_dpi: "300",
    });

    return worker;
  })().catch((error) => {
    workerPromise = null;
    throw error;
  });

  return workerPromise;
}

async function normalizeImage(buffer: Buffer): Promise<Buffer> {
  const image = await loadImage(buffer);
  const targetWidth = Math.min(
    MAX_IMAGE_WIDTH,
    Math.max(MIN_IMAGE_WIDTH, image.width),
  );
  const scale = targetWidth / image.width;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height);
  const data = pixels.data;

  for (let index = 0; index < data.length; index += 4) {
    const gray =
      data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const adjusted = Math.max(
      0,
      Math.min(255, (gray - 128) * CONTRAST_FACTOR + 128),
    );

    data[index] = adjusted;
    data[index + 1] = adjusted;
    data[index + 2] = adjusted;
    data[index + 3] = 255;
  }

  context.putImageData(pixels, 0, 0);

  return canvas.toBuffer("image/png");
}

async function recognizeImage(buffer: Buffer): Promise<OcrResult> {
  return enqueue(async () => {
    const worker = await getWorker();
    const normalized = await normalizeImage(buffer);
    const result = await worker.recognize(normalized);

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      pages: 1,
    };
  });
}

async function recognizePdf(buffer: Buffer): Promise<OcrResult> {
  const document = await pdf(buffer, { scale: PDF_SCALE, format: "png" });
  const pages: OcrResult[] = [];

  try {
    for await (const page of document) {
      pages.push(await recognizeImage(page));

      if (pages.length >= MAX_PDF_PAGES) {
        break;
      }
    }
  } finally {
    await document.destroy();
  }

  if (pages.length === 0) {
    throw new Error("The PDF does not contain any pages");
  }

  return {
    text: pages.map((page) => page.text).join("\n"),
    confidence:
      pages.reduce((total, page) => total + page.confidence, 0) / pages.length,
    pages: pages.length,
  };
}

export async function extractText(input: OcrInput): Promise<OcrResult> {
  if (input.mimetype === "application/pdf") {
    return recognizePdf(input.buffer);
  }

  return recognizeImage(input.buffer);
}

export async function stopOcrWorker(): Promise<void> {
  if (!workerPromise) {
    return;
  }

  const worker = await workerPromise.catch(() => null);
  workerPromise = null;

  if (worker) {
    await worker.terminate();
  }
}
