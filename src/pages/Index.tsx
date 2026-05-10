import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Paperclip,
  Sparkles,
  Send,
  Globe,
  FolderOpen,
  FileEdit,
  Clock,
  AlertTriangle,
  ClipboardList,
  Loader2,
} from "lucide-react";
import { askQuestion, runWorkflow, type ChatMessage } from "@/services/legalAI";
import { extractPdfText } from "@/services/huggingFaceService";
import { WORKFLOW_PROMPTS } from "@/config/workflowPrompts";

import { toast } from "@/hooks/use-toast";
import { addLocalDocument, getDocumentText, getCachedFile } from "@/stores/localDocumentStore";
import { saveLocalChatSession } from "@/stores/chatHistoryStore";
import ReactMarkdown from "react-markdown";
import { DraftDrawer } from "@/components/workflows/DraftDrawer";
import { TimelineView } from "@/components/workflows/TimelineView";
import { RiskAnalysisPanel } from "@/components/workflows/RiskAnalysisPanel";
import { DocumentPickerDialog } from "@/components/workflows/DocumentPickerDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate, useLocation } from "react-router-dom";

const sourceTags = [
  { label: "Web Search", icon: Globe, color: "hsl(142, 60%, 40%)" },
  { label: "Project Vault", icon: FolderOpen, color: "hsl(0, 0%, 40%)" },
];

const workflows = [
  { title: "Draft a client alert", type: "Draft", steps: 5, icon: FileEdit, key: "draft-client-alert" as const },
  { title: "Extract chronology of key events", type: "Review", steps: 2, icon: Clock, key: "extract-chronology" as const },
  { title: "Clause Risk Analysis", type: "Analysis", steps: 3, icon: AlertTriangle, key: "clause-risk-analysis" as const },
  { title: "Summarize Obligations", type: "Output", steps: 2, icon: ClipboardList, key: "summarize-obligations" as const },
];

type ActiveWorkflow = "draft-client-alert" | "extract-chronology" | "clause-risk-analysis" | "summarize-obligations" | null;


const PROMPT_ENRICHMENTS = [
  { label: "Summarize in plain English", prompt: "Please summarize the following in plain, non-technical English suitable for a business executive: " },
  { label: "Identify risks & red flags", prompt: "Identify all potential risks, red flags, and unfavorable terms in the following document: " },
  { label: "Extract key dates & deadlines", prompt: "Extract all key dates, deadlines, and time-sensitive obligations from: " },
  { label: "Compare with standard terms", prompt: "Compare the following clauses against market-standard terms and highlight deviations: " },
];

interface AttachedFile {
  name: string;
  id: string;
  file_path: string;
}

export default function Index() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeWorkflow, setActiveWorkflow] = useState<ActiveWorkflow>(null);
  const [draftDrawerOpen, setDraftDrawerOpen] = useState(false);
  const [latestDocName, setLatestDocName] = useState<string | undefined>();
  const [latestDocFilePath, setLatestDocFilePath] = useState<string | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingWorkflow, setPendingWorkflow] = useState<ActiveWorkflow>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeDocumentText, setActiveDocumentText] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Recover activeDocumentText from localStorage if component state was lost (e.g. navigation)
  useEffect(() => {
    if (!activeDocumentText) {
      // Check attached files first, then fall back to any locally stored document
      const localDocs = JSON.parse(localStorage.getItem("legal-hub-local-documents") || "[]");
      const docWithText = localDocs.find((d: { extractedText?: string }) => d.extractedText);
      if (docWithText?.extractedText) {
        console.log("Recovered document text from localStorage for:", docWithText.name, "length:", docWithText.extractedText.length);
        setActiveDocumentText(docWithText.extractedText);
      }
    }
  }, []);

  // Handle "New Chat" and "Restore Session" from navigation state
  useEffect(() => {
    const navState = location.state as { newChat?: boolean; restoreSession?: { id: string; title: string; messages: unknown[] } } | null;
    if (!navState) return;

    if (navState.newChat) {
      saveCurrentChatToHistory();
      // Clear navigation state
      window.history.replaceState({}, "");
    }

    if (navState.restoreSession) {
      const session = navState.restoreSession;
      setMessages(session.messages as ChatMessage[]);
      setAttachedFiles([]);
      setActiveWorkflow(null);
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  async function saveCurrentChatToHistory() {
    if (messages.length > 0) {
      // Derive title from first user message
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 80) + (firstUserMsg.content.length > 80 ? "..." : "")
        : "Untitled Chat";

      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();

      // Always save to localStorage (guaranteed to work)
      saveLocalChatSession({
        id: sessionId,
        title,
        messages: JSON.parse(JSON.stringify(messages)),
        created_at: now,
        updated_at: now,
      });


    }

    // Reset state for new chat
    setMessages([]);
    setQuery("");
    setAttachedFiles([]);
    setActiveWorkflow(null);
    setStreamingContent("");
  }

  function handleWorkflowClick(key: ActiveWorkflow) {
    setPendingWorkflow(key);
    setPickerOpen(true);
  }

  async function fetchAndExtractDocument(doc: { id: string; name: string; file_path: string }): Promise<string> {
    // 1. Check local store for already-extracted text
    const localText = getDocumentText(doc.id);
    if (localText) {
      console.log("Using locally cached text for", doc.name, "length:", localText.length);
      return localText;
    }

    // 2. Check in-memory file cache (uploaded this session)
    const cachedFile = getCachedFile(doc.id);
    if (cachedFile) {
      const text = await extractPdfText(cachedFile);
      console.log("Extracted text from cached file:", text.length);
      return text;
    }

    // 3. Throw Error if nowhere found
    throw new Error(`Failed to download document: Not found in local cache.`);
  }

  async function handleDocumentSelected(doc: { id: string; name: string; file_path: string }) {
    setPickerOpen(false);
    setLatestDocName(doc.name);
    setLatestDocFilePath(doc.file_path);

    const selectedWorkflow = pendingWorkflow;
    setPendingWorkflow(null);

    // Show loading message in chat
    const loadingMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `⏳ Fetching and analyzing **${doc.name}**...`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, loadingMsg]);
    setIsLoading(true);

    try {
      // Fetch PDF from Supabase Storage and extract text
      const extractedText = await fetchAndExtractDocument(doc);
      setActiveDocumentText(extractedText);

      // Document analyzed

      // Remove loading message
      setMessages((prev) => prev.filter((m) => m.id !== loadingMsg.id));
      setIsLoading(false);

      // Route to the correct workflow with extracted text
      switch (selectedWorkflow) {
        case "draft-client-alert":
          setDraftDrawerOpen(true);
          break;
        case "extract-chronology":
          setActiveWorkflow("extract-chronology");
          break;
        case "clause-risk-analysis":
          setActiveWorkflow("clause-risk-analysis");
          break;
        case "summarize-obligations":
          triggerObligationsSummary(extractedText);
          break;
      }
    } catch (err) {
      console.error("Document extraction failed:", err);
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== loadingMsg.id);
        return [...filtered, {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: `❌ Failed to extract text from **${doc.name}**. Please try again.`,
          timestamp: new Date(),
        }];
      });
      setIsLoading(false);
    }
  }

  async function triggerObligationsSummary(docText?: string) {
    const textToUse = docText || activeDocumentText;
    const systemMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "⏳ Generating precise answer...",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, systemMsg]);
    setActiveWorkflow(null);

    try {
      const workflow = WORKFLOW_PROMPTS["summarize-obligations"];
      const contextText = textToUse || `Document: ${latestDocName || "Uploaded legal document"}`;
      const result = await runWorkflow(workflow.systemPrompt, workflow.userTemplate(contextText), undefined, workflow.jsonMode);

      const resultMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result,
        timestamp: new Date(),
      };
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== systemMsg.id);
        return [...filtered, resultMsg];
      });
    } catch (err) {
      console.error("Obligations summary failed:", err);
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== systemMsg.id);
        return [...filtered, {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: "Failed to generate obligations summary. Please try again.",
          timestamp: new Date(),
        }];
      });
    }
  }

  function handleBackToHome() {
    setActiveWorkflow(null);
  }

  const handleAsk = async () => {
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setQuery("");
    setIsLoading(true);
    setStreamingContent("");

    // Collect file paths from attached documents
    const filePaths = attachedFiles.map((f) => f.file_path);

    try {
      // Attempt to recover document context if it was lost
      let docContext = activeDocumentText;
      if (!docContext && attachedFiles.length > 0) {
        const localDocs = JSON.parse(localStorage.getItem("legal-hub-local-documents") || "[]");
        for (const af of attachedFiles) {
          const match = localDocs.find((d: { id: string; extractedText?: string }) => d.id === af.id && d.extractedText);
          if (match?.extractedText) {
            docContext = match.extractedText;
            setActiveDocumentText(docContext);
            console.log("Recovered document context from localStorage for:", af.name);
            break;
          }
        }
      }

      console.log("Sending question to AI. Document context length:", docContext?.length || 0);

      const response = await askQuestion(query, (chunk) => {
        setStreamingContent((prev) => prev + chunk);
      }, filePaths.length > 0 ? filePaths : undefined, docContext || undefined);
      setMessages((prev) => [...prev, response]);
    } catch (error) {
      console.error("AI API Error:", error);
      const errorDetail = error instanceof Error ? error.message : String(error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Unable to generate precise answer at this time. Error: ${errorDetail}. Please try again.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const uploadedFiles: AttachedFile[] = [];

    for (const file of Array.from(files)) {
      const localId = crypto.randomUUID();
      const filePath = `uploads/${Date.now()}_${file.name}`;
      const fileType = file.name.split(".").pop()?.toLowerCase() || "unknown";

      // 1. Extract PDF text client-side FIRST (always works, no network needed)
      let extractedText = "";
      if (fileType === "pdf") {
        try {
          extractedText = await extractPdfText(file);
          console.log("Extracted PDF text length:", extractedText.length);
        } catch (extractErr) {
          console.warn("PDF text extraction failed:", extractErr);
        }
      }
      if (extractedText) {
        setActiveDocumentText(extractedText);
      }

      // 2. Store in local document store (always succeeds)
      addLocalDocument(
        {
          id: localId,
          name: file.name,
          file_path: filePath,
          status: extractedText ? "analyzed" : "pending",
          folder: null,
          file_type: fileType,
          uploaded_at: new Date().toISOString(),
          isLocal: true,
          extractedText,
        },
        file
      );

      uploadedFiles.push({ name: file.name, id: localId, file_path: filePath });


    }

    if (uploadedFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...uploadedFiles]);
      setLatestDocName(uploadedFiles[0]?.name);

      const fileNames = uploadedFiles.map((f) => f.name).join(", ");
      const uploadMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `📎 **Document uploaded:** ${fileNames}\n\nThe document is ready for analysis. You can now ask questions about it — for example:\n\n- *"Summarize this document"*\n- *"What are the key risks?"*\n- *"Extract all obligations"*`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, uploadMsg]);
      toast({ title: "Document uploaded", description: `${files.length} file(s) ready for analysis.` });
    }

    setUploading(false);
    e.target.value = "";
  }
  // Workflow full-screen views
  if (activeWorkflow === "extract-chronology") {
    return <TimelineView onBack={handleBackToHome} documentName={latestDocName} filePath={latestDocFilePath} documentText={activeDocumentText} />;
  }

  if (activeWorkflow === "clause-risk-analysis") {
    return <RiskAnalysisPanel onBack={handleBackToHome} documentName={latestDocName} filePath={latestDocFilePath} documentText={activeDocumentText} />;
  }

  return (
    <div className="flex flex-col h-full">
      <DocumentPickerDialog
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setPendingWorkflow(null); }}
        onSelect={handleDocumentSelected}
        workflowTitle={workflows.find(w => w.key === pendingWorkflow)?.title || ""}
      />
        <DraftDrawer
          open={draftDrawerOpen}
          onClose={() => setDraftDrawerOpen(false)}
          documentName={latestDocName}
          filePath={latestDocFilePath}
          documentText={activeDocumentText}
      />

      {messages.length > 0 ? (
        /* Chat mode */
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-auto px-4 md:px-8 lg:px-16 py-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-2xl rounded-lg px-4 py-3 ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
                      {msg.sources.map((src, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          Source: {src.section} of {src.document}
                          {src.page && ` (p. ${src.page})`}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && streamingContent && (
              <div className="flex justify-start">
                <div className="max-w-2xl rounded-lg px-4 py-3 bg-muted">
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{streamingContent}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
            {isLoading && !streamingContent && (
              <div className="flex justify-start">
                <div className="rounded-lg px-4 py-3 bg-muted flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating precise answer...
                </div>
              </div>
            )}
          </div>

          {/* Chat input bar */}
          <div className="border-t border-border p-4 md:px-8 lg:px-16">
            <div className="max-w-3xl mx-auto space-y-2">
              {attachedFiles.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {attachedFiles.map((f) => (
                    <span key={f.id} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-md">
                      <Paperclip className="h-3 w-3" />
                      {f.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="relative flex items-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
                <Textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about your legal documents..."
                  className="min-h-[48px] max-h-32 resize-none pr-12 rounded-xl border-input"
                  rows={1}
                />
                <Button
                  size="icon"
                  onClick={handleAsk}
                  disabled={!query.trim() || isLoading}
                  className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Home / empty state */
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
          <div className="w-full max-w-2xl space-y-8">
            <h1 className="text-4xl md:text-5xl font-serif text-center tracking-tight text-foreground">
              Legal Document Analysis System
            </h1>

            <div className="space-y-3">
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about your legal documents..."
                  className="min-h-[120px] resize-none rounded-xl border-input text-base"
                  rows={4}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground gap-1.5 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                    {uploading ? "Uploading..." : "Files and sources"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.doc"
                    multiple
                    onChange={handleFileUpload}
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5 text-xs">
                        <Sparkles className="h-3.5 w-3.5" />
                        Prompts
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2" align="start">
                      <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">Prompt Enrichment</p>
                      {PROMPT_ENRICHMENTS.map((pe) => (
                        <button
                          key={pe.label}
                          className="w-full text-left text-sm px-2 py-2 rounded-md hover:bg-accent transition-colors"
                          onClick={() => setQuery((prev) => pe.prompt + prev)}
                        >
                          {pe.label}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>
                <Button onClick={handleAsk} disabled={!query.trim() || isLoading} className="rounded-lg gap-2">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Ask
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              {sourceTags.map((tag) => (
                <button
                  key={tag.label}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.label}
                  <span className="text-xs">+</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recommended Workflows */}
          <div className="w-full max-w-4xl mt-16">
            <p className="text-sm text-muted-foreground mb-4">Recommended workflows</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {workflows.map((wf) => (
                <Card
                  key={wf.title}
                  className="cursor-pointer hover:shadow-md transition-shadow border-border"
                  onClick={() => handleWorkflowClick(wf.key)}
                >
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium leading-snug">{wf.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <wf.icon className="h-3 w-3" />
                      <span>{wf.type}</span>
                      <span>·</span>
                      <span>{wf.steps} steps</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
