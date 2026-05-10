import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, Loader2, AlertTriangle, Shield, Scale, List, BookOpen } from "lucide-react";
import { callHuggingFaceChunked } from "@/services/huggingFaceService";
import { extractPdfText } from "@/services/huggingFaceService";

import { getLocalDocuments, getDocumentText, getCachedFile, getFileFromIDB } from "@/stores/localDocumentStore";
import ReactMarkdown from "react-markdown";

// ─── Interfaces ─────────────────────────────────────────────────────

interface ExtractedClause {
  title: string;
  type: string;
  section: string;
  text: string;
}

interface FlaggedRisk {
  title: string;
  severity: "high" | "medium" | "low";
  clause: string;
  description: string;
  recommendation: string;
}

// ─── Helper: Truncate text for context window ───────────────────────

const MAX_CONTEXT = 6000;
function truncate(text: string): string {
  if (text.length <= MAX_CONTEXT) return text;
  return text.slice(0, MAX_CONTEXT) + "\n\n[...Text Truncated]";
}

// ─── Helper: Retry wrapper (up to maxRetries attempts) ──────────────

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        console.warn(`Attempt ${attempt + 1} failed, retrying...`, err);
        // Brief delay before retry (exponential backoff)
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

// ─── Risk severity badge ────────────────────────────────────────────

function RiskBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  const styles: Record<string, string> = {
    high: "bg-destructive text-destructive-foreground",
    medium: "bg-warning text-warning-foreground",
    low: "bg-muted text-muted-foreground",
  };
  return <Badge className={styles[s] || styles.medium}>{severity}</Badge>;
}

// ─── System prompts ─────────────────────────────────────────────────

const SUMMARY_PROMPT =
  "You are an expert legal analyst. Provide a comprehensive, well-structured summary of the following legal document. Include: an overview of the document type and parties, key terms and conditions, important dates and deadlines, financial terms, and any notable or unusual provisions. Format with clear markdown headings.";

const CLAUSES_PROMPT =
  'You are a legal clause extraction specialist. Extract all key legal clauses and obligations from the following document. You MUST respond with a JSON object containing a single key "clauses" whose value is an array. Each object must contain: "title" (clause name), "type" (one of: obligation, right, condition, definition, termination, indemnification, confidentiality, other), "section" (section reference if available), and "text" (the key content of the clause, summarized in 1-2 sentences). Example: {"clauses": [{"title": "Confidentiality", "type": "obligation", "section": "Section 5.1", "text": "Both parties must maintain confidentiality of proprietary information for 3 years."}]}';

const RISKS_PROMPT =
  'You are a legal risk assessment specialist. Identify all high-risk areas in the following document, focusing on: indemnification, limitation of liability, termination clauses, governing law, force majeure, intellectual property, data protection, and any one-sided or unusual terms. You MUST respond with a JSON object containing a single key "risks" whose value is an array. Each object must contain: "title" (risk name), "severity" ("high", "medium", or "low"), "clause" (clause/section reference), "description" (why it is risky), and "recommendation" (suggested mitigation). Example: {"risks": [{"title": "Unlimited Indemnity", "severity": "high", "clause": "Section 8.2", "description": "No cap on indemnification liability", "recommendation": "Negotiate a liability cap"}]}';

// ─── Main Component ─────────────────────────────────────────────────

export default function Analysis() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Document metadata
  const [docName, setDocName] = useState("");
  const [filePath, setFilePath] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");

  // Loading states
  const [extracting, setExtracting] = useState(true);

  // Tab results
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryDone, setSummaryDone] = useState(false);

  const [clauses, setClauses] = useState<ExtractedClause[]>([]);
  const [clausesLoading, setClausesLoading] = useState(false);
  const [clausesDone, setClausesDone] = useState(false);

  const [risks, setRisks] = useState<FlaggedRisk[]>([]);
  const [risksLoading, setRisksLoading] = useState(false);
  const [risksDone, setRisksDone] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Ref to track if analysis has been triggered (prevents double-fire)
  const analysisTriggered = useRef(false);

  // Cleanup object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (pdfUrl && pdfUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // ─── Step 1: Load document — local store → IndexedDB → Supabase ──

  useEffect(() => {
    if (!id) return;

    async function loadAndExtract() {
      try {
        // ── 1. Check the local document store (in-memory + localStorage) ──
        const localDocs = getLocalDocuments();
        const localDoc = localDocs.find((d) => d.id === id);

        let resolvedText = "";
        let resolvedPdfUrl = "";
        let resolved = false;

        if (localDoc) {
          console.log("Found document in local store:", localDoc.name);
          setDocName(localDoc.name);
          setFilePath(localDoc.file_path);

          // Get the extracted text (persisted in localStorage)
          const localText = getDocumentText(id);
          if (localText) {
            console.log("Using locally stored extracted text, length:", localText.length);
            resolvedText = localText;
            setDocumentText(localText);
          }

          // Get the cached File object for PDF preview
          let cachedFile = getCachedFile(id);

          // ── 2. If no in-memory file, try IndexedDB (survives refresh) ──
          if (!cachedFile) {
            console.log("In-memory cache miss — checking IndexedDB...");
            cachedFile = await getFileFromIDB(id);
          }

          if (cachedFile) {
            const objectUrl = URL.createObjectURL(cachedFile);
            resolvedPdfUrl = objectUrl;
            setPdfUrl(objectUrl);
            console.log("Created PDF preview URL from file");

            // If we don't have extracted text yet, extract from the file
            if (!resolvedText) {
              const text = await extractPdfText(cachedFile);
              console.log("Extracted PDF text from file, length:", text.length);
              resolvedText = text;
              setDocumentText(text);
            }
          }

          if (resolvedText || cachedFile) {
            resolved = true;
          }
        }

        // ── 2b. Also check localStorage directly as a fallback ──
        if (!resolved && !localDoc) {
          const storedDocs = JSON.parse(localStorage.getItem("legal-hub-local-documents") || "[]");
          const storedDoc = storedDocs.find((d: { id: string }) => d.id === id);
          if (storedDoc) {
            console.log("Found document in localStorage fallback:", storedDoc.name);
            setDocName(storedDoc.name);
            setFilePath(storedDoc.file_path);

            if (storedDoc.extractedText) {
              resolvedText = storedDoc.extractedText;
              setDocumentText(storedDoc.extractedText);
            }

            // Try IndexedDB for the blob
            const idbFile = await getFileFromIDB(id);
            if (idbFile) {
              const objectUrl = URL.createObjectURL(idbFile);
              setPdfUrl(objectUrl);

              if (!resolvedText) {
                const text = await extractPdfText(idbFile);
                resolvedText = text;
                setDocumentText(text);
              }
            }

            if (resolvedText) {
              resolved = true;
            }
          }
        }

        if (resolved) {
          setExtracting(false);
          return;
        }

        // ── 3. If local cache fails, we cannot proceed without backend ──
        if (docName || documentText) {
          setExtracting(false);
          return;
        }
        setError("Document not found in local browser storage. Please re-upload it.");
        setExtracting(false);
      } catch (err) {
        console.error("Document load/extract failed:", err);
        if (documentText) {
          setExtracting(false);
          return;
        }
        setError(String(err));
        setExtracting(false);
      }
    }

    loadAndExtract();
  }, [id]);

  // ─── Step 2: Auto-trigger ALL analyses once text is ready ─────────

  useEffect(() => {
    if (!documentText || analysisTriggered.current) return;
    analysisTriggered.current = true;

    console.log("Document text ready — auto-triggering all analyses");

    // Fire all three in parallel
    runSummary();
    runClauses();
    runRisks();
  }, [documentText]);

  // ─── Tab runners (with auto-retry) ────────────────────────────────

  const runSummary = useCallback(async () => {
    if (!documentText || summaryDone) return;
    setSummaryLoading(true);
    try {
      const result = await withRetry(() =>
        callHuggingFaceChunked(
          SUMMARY_PROMPT,
          `### DOCUMENT TEXT ###\n${truncate(documentText)}\n\nProvide a comprehensive legal summary.`
        )
      );
      setSummary(result);
      setSummaryDone(true);
    } catch (err) {
      console.error("Summary failed after retries:", err);
      setSummary("Failed to generate summary after multiple attempts. Please refresh to try again.");
    } finally {
      setSummaryLoading(false);
    }
  }, [documentText, summaryDone]);

  const runClauses = useCallback(async () => {
    if (!documentText || clausesDone) return;
    setClausesLoading(true);
    try {
      const result = await withRetry(() =>
        callHuggingFaceChunked(
          CLAUSES_PROMPT,
          `### DOCUMENT TEXT ###\n${truncate(documentText)}\n\nExtract all key clauses. Respond ONLY with JSON.`
        )
      );
      const parsed = JSON.parse(result);
      const arr = parsed.clauses || parsed;
      setClauses(Array.isArray(arr) ? arr : []);
      setClausesDone(true);
    } catch (err) {
      console.error("Clauses extraction failed after retries:", err);
      setClauses([]);
      setClausesDone(true);
    } finally {
      setClausesLoading(false);
    }
  }, [documentText, clausesDone]);

  const runRisks = useCallback(async () => {
    if (!documentText || risksDone) return;
    setRisksLoading(true);
    try {
      const result = await withRetry(() =>
        callHuggingFaceChunked(
          RISKS_PROMPT,
          `### DOCUMENT TEXT ###\n${truncate(documentText)}\n\nIdentify all risks. Respond ONLY with JSON.`
        )
      );
      const parsed = JSON.parse(result);
      const arr = parsed.risks || parsed;
      setRisks(Array.isArray(arr) ? arr : []);
      setRisksDone(true);
    } catch (err) {
      console.error("Risk analysis failed after retries:", err);
      setRisks([]);
      setRisksDone(true);
    } finally {
      setRisksLoading(false);
    }
  }, [documentText, risksDone]);

  // ─── Loading skeleton ─────────────────────────────────────────────

  function LoadingSkeleton({ label }: { label: string }) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {label}
        </div>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-6 w-1/2 mt-4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  // ─── Initial loading state ────────────────────────────────────────

  if (extracting) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium">Loading document...</p>
            <p className="text-sm text-muted-foreground">Fetching and extracting text from PDF</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => navigate("/vault")}>Back to Vault</Button>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-3 flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/vault")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate">{docName || "Document"}</span>
        <Badge variant="default" className="ml-auto text-xs">Analyzed</Badge>
      </div>

      {/* Split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: PDF preview */}
        <div className="flex-1 border-r border-border bg-muted/30">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-center text-muted-foreground space-y-2 p-8">
              <div>
                <FileText className="h-16 w-16 mx-auto opacity-20" />
                <p className="text-sm font-medium mt-2">PDF Preview unavailable</p>
                <p className="text-xs">Could not generate a preview URL</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: AI insights tabs */}
        <div className="w-full max-w-lg overflow-auto">
          <Tabs defaultValue="summary" className="h-full flex flex-col">
            <TabsList className="mx-4 mt-4 w-fit">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="clauses">Extracted Clauses</TabsTrigger>
              <TabsTrigger value="risks">Flagged Risks</TabsTrigger>
            </TabsList>

            {/* ─── Summary Tab ─── */}
            <TabsContent value="summary" className="flex-1 overflow-auto p-4">
              {summaryLoading ? (
                <LoadingSkeleton label="Generating precise answer..." />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Scale className="h-4 w-4" />
                      Document Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{summary || "No summary available."}</ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ─── Extracted Clauses Tab ─── */}
            <TabsContent value="clauses" className="flex-1 overflow-auto p-4 space-y-3">
              {clausesLoading ? (
                <LoadingSkeleton label="Generating precise answer..." />
              ) : clauses.length === 0 && clausesDone ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <BookOpen className="h-8 w-8 mx-auto opacity-30 mb-2" />
                  <p>No clauses were extracted from this document.</p>
                </div>
              ) : (
                clauses.map((clause, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{clause.title}</p>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {clause.type}
                        </Badge>
                      </div>
                      {clause.section && (
                        <p className="text-xs text-muted-foreground">{clause.section}</p>
                      )}
                      <p className="text-sm leading-relaxed text-muted-foreground">{clause.text}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* ─── Flagged Risks Tab ─── */}
            <TabsContent value="risks" className="flex-1 overflow-auto p-4 space-y-3">
              {risksLoading ? (
                <LoadingSkeleton label="Generating precise answer..." />
              ) : risks.length === 0 && risksDone ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <Shield className="h-8 w-8 mx-auto opacity-30 mb-2" />
                  <p>No significant risks were identified.</p>
                </div>
              ) : (
                risks.map((risk, i) => (
                  <Card key={i} className="border-l-4" style={{
                    borderLeftColor:
                      risk.severity?.toLowerCase() === "high" ? "hsl(0, 72%, 51%)" :
                      risk.severity?.toLowerCase() === "medium" ? "hsl(38, 92%, 50%)" :
                      "hsl(0, 0%, 60%)",
                  }}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <p className="text-sm font-medium">{risk.title}</p>
                        </div>
                        <RiskBadge severity={risk.severity} />
                      </div>
                      <p className="text-xs text-muted-foreground">{risk.clause}</p>
                      <p className="text-sm text-muted-foreground">{risk.description}</p>
                      <div className="bg-muted rounded-md p-3 mt-2">
                        <p className="text-xs font-medium flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Recommendation
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{risk.recommendation}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
