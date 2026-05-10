// AI Service — Hugging Face Inference API integration layer
// Model: ParthModi01/llama3-8b-legal-summarizer-ft
// Prompt format: Instruction / ### Input: / ###Response:
// Max sequence length: 768 tokens (~2,000 chars for input after instruction overhead)

const HF_MODEL = "ParthModi01/llama3-8b-legal-summarizer-ft";
const API_URL = `/api/hf/models/${HF_MODEL}`;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Maximum characters of document text per chunk.
 * The model has a max_seq_length of 768 tokens (~3,072 chars total).
 * We reserve ~1,000 chars for the instruction + response generation overhead,
 * leaving ~2,000 chars for the document input per chunk.
 */
const MAX_CHUNK_CHARS = 2000;

function getApiToken(): string {
  const token = import.meta.env.VITE_HF_API_TOKEN;
  if (!token) {
    throw new Error(
      'VITE_HF_API_TOKEN is not set in your .env file. Add: VITE_HF_API_TOKEN="hf_..."'
    );
  }
  return token;
}

/**
 * Build the prompt string in the model's required training format.
 *
 *   Instruction: [task description]
 *
 *   ### Input:
 *   {documentText}
 *
 *   ###Response:
 */
export function buildHFPrompt(instruction: string, input: string): string {
  return `Instruction: ${instruction}\n\n### Input:\n${input}\n\n###Response:\n`;
}

/**
 * Split text into chunks of approximately `maxChars` characters,
 * breaking at sentence boundaries when possible.
 */
export function chunkText(text: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  if (!text || text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }

    // Try to break at the last sentence boundary within maxChars
    let breakPoint = maxChars;
    const slice = remaining.slice(0, maxChars);

    // Look for sentence-ending punctuation followed by space (. ! ?)
    const sentenceEnd = slice.lastIndexOf(". ");
    const exclEnd = slice.lastIndexOf("! ");
    const questEnd = slice.lastIndexOf("? ");
    const bestEnd = Math.max(sentenceEnd, exclEnd, questEnd);

    if (bestEnd > maxChars * 0.3) {
      // Found a reasonable sentence boundary (at least 30% into the chunk)
      breakPoint = bestEnd + 2; // include the punctuation and space
    } else {
      // Fall back to breaking at last space
      const lastSpace = slice.lastIndexOf(" ");
      if (lastSpace > maxChars * 0.3) {
        breakPoint = lastSpace + 1;
      }
      // Otherwise just break at maxChars
    }

    chunks.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Retry helper with exponential backoff.
 * Handles 429 (rate limit) and 503 (model loading) from Hugging Face.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, init);

    if ((res.status === 429 || res.status === 503) && attempt < retries) {
      // For 503, HF returns estimated_time in the response body
      let delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);

      if (res.status === 503) {
        try {
          const body = await res.clone().json();
          if (body.estimated_time) {
            delayMs = Math.ceil(body.estimated_time * 1000);
          }
        } catch {
          // Use default backoff
        }
        console.warn(
          `Model loading (503). Retry ${attempt + 1}/${retries} after ${delayMs}ms...`
        );
      } else {
        const retryAfter = res.headers.get("retry-after");
        if (retryAfter) {
          delayMs = parseInt(retryAfter, 10) * 1000;
        }
        console.warn(
          `Rate limited (429). Retry ${attempt + 1}/${retries} after ${delayMs}ms...`
        );
      }

      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    return res;
  }
  throw new Error("Max retries exceeded for Hugging Face API request");
}

interface CallHFOptions {
  maxTokens?: number;
  temperature?: number;
}

/**
 * Single-call to Hugging Face Inference API (text generation).
 * Sends the full prompt and returns the generated text.
 */
export async function callHuggingFace(
  instruction: string,
  input: string,
  options: CallHFOptions = {}
): Promise<string> {
  const { maxTokens = 512, temperature = 0.2 } = options;

  const prompt = buildHFPrompt(instruction, input);

  const res = await fetchWithRetry(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: maxTokens,
        temperature,
        return_full_text: false,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("HF API error:", res.status, errText);
    throw new Error(`AI service error: ${res.status}`);
  }

  const data = await res.json();

  // HF Inference API returns an array: [{ generated_text: "..." }]
  if (Array.isArray(data) && data.length > 0 && data[0].generated_text) {
    return data[0].generated_text.trim();
  }

  // Fallback: some endpoints return { generated_text: "..." } directly
  if (data.generated_text) {
    return data.generated_text.trim();
  }

  console.warn("Unexpected HF API response shape:", data);
  return typeof data === "string" ? data : JSON.stringify(data);
}

/**
 * Non-streaming shim that mimics the old streaming interface.
 * Calls HF API, then delivers the full response through onChunk.
 * This preserves backward compatibility with the chat UI.
 */
export async function callHuggingFaceStream(
  instruction: string,
  input: string,
  onChunk: (chunk: string) => void,
  options: CallHFOptions = {}
): Promise<string> {
  const fullContent = await callHuggingFace(instruction, input, options);
  onChunk(fullContent);
  return fullContent;
}

/**
 * Chunk-aware HF API call.
 * Splits the input text into chunks that fit the 768-token context window,
 * processes each chunk independently, and merges the results.
 */
export async function callHuggingFaceChunked(
  instruction: string,
  inputText: string,
  options: CallHFOptions = {}
): Promise<string> {
  const chunks = chunkText(inputText, MAX_CHUNK_CHARS);

  if (chunks.length === 1) {
    return callHuggingFace(instruction, chunks[0], options);
  }

  const results: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkInstruction = `${instruction}\n\n(Processing chunk ${i + 1} of ${chunks.length})`;
    const result = await callHuggingFace(chunkInstruction, chunks[i], options);
    results.push(result);
  }

  return results.join("\n\n");
}

/**
 * Extract text from a PDF File object using pdfjs-dist.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  // Use the bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: unknown) => {
        const textItem = item as { str?: string };
        return textItem.str || "";
      })
      .join(" ");
    pages.push(pageText);
  }

  return pages.join("\n\n");
}
