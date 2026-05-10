// Legal AI Service Layer — Hugging Face Inference API Integration
// Handles chat, workflows, and document analysis

import { callHuggingFace, callHuggingFaceStream, callHuggingFaceChunked, buildHFPrompt } from "./huggingFaceService";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp: Date;
  isStreaming?: boolean;
}

export interface Source {
  document: string;
  section: string;
  page?: number;
}

export interface AnalysisResult {
  summary: string;
  clauses: ExtractedClause[];
  risks: FlaggedRisk[];
}

export interface ExtractedClause {
  id: string;
  title: string;
  text: string;
  section: string;
  type: "obligation" | "right" | "condition" | "definition" | "termination";
}

export interface FlaggedRisk {
  id: string;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  clause: string;
  recommendation: string;
}

const DEFAULT_INSTRUCTION =
  "You are an expert legal AI assistant. Analyze legal documents, identify risks, extract clauses, and provide actionable legal insights. Format your responses with clear markdown headings and bullet points.";

const DOC_CONTEXT_INSTRUCTION =
  "You are an expert legal AI assistant. You have been provided with the full text of a legal document. Use this document context to answer the user's question accurately and thoroughly. Always reference specific sections or clauses from the document when possible. Format your responses with clear markdown headings and bullet points.";

// Model context window is 768 tokens, so limit characters aggressively
const MAX_CONTEXT_LENGTH = 2000;

function buildChatInput(question: string, documentContext?: string): string {
  if (!documentContext) return question;

  let context = documentContext;
  if (context.length > MAX_CONTEXT_LENGTH) {
    context = context.slice(0, MAX_CONTEXT_LENGTH) + "\n\n[...Text Truncated]";
  }

  return `### DOCUMENT CONTEXT ###\n${context}\n\n### USER QUESTION ###\n${question}`;
}

export async function askQuestion(
  question: string,
  onChunk?: (chunk: string) => void,
  _filePaths?: string[],
  documentContext?: string
): Promise<ChatMessage> {
  const instruction = documentContext ? DOC_CONTEXT_INSTRUCTION : DEFAULT_INSTRUCTION;
  const input = buildChatInput(question, documentContext);

  let content: string;

  if (onChunk) {
    content = await callHuggingFaceStream(instruction, input, onChunk);
  } else {
    content = await callHuggingFace(instruction, input);
  }

  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    sources: [],
    timestamp: new Date(),
  };
}

export async function runWorkflow(
  instruction: string,
  input: string,
  _filePaths?: string[],
  _jsonMode?: boolean
): Promise<string> {
  // Use chunked call to safely handle documents larger than 768 tokens
  return callHuggingFaceChunked(instruction, input);
}

export async function analyzeDocument(documentId: string): Promise<AnalysisResult> {
  const content = await callHuggingFace(
    "You are a legal document analyst. Provide a comprehensive analysis.",
    `Analyze document ${documentId}.`
  );
  return { summary: content, clauses: [], risks: [] };
}

export async function summarize(documentId: string): Promise<string> {
  return callHuggingFace(
    "You are a legal document summarizer.",
    `Summarize document ${documentId}.`
  );
}
