import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileEdit,
  Clock,
  AlertTriangle,
  ClipboardList,
  Scale,
  FileSearch,
  Brain,
  Swords,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { DocumentPickerDialog } from "@/components/workflows/DocumentPickerDialog";
import { DraftDrawer } from "@/components/workflows/DraftDrawer";
import { TimelineView } from "@/components/workflows/TimelineView";
import { RiskAnalysisPanel } from "@/components/workflows/RiskAnalysisPanel";
import { ObligationsPanel } from "@/components/workflows/ObligationsPanel";
import { ComplianceCheckPanel } from "@/components/workflows/ComplianceCheckPanel";
import { CompareVersionsPanel } from "@/components/workflows/CompareVersionsPanel";
import { ConflictResolverPanel } from "@/components/workflows/ConflictResolverPanel";
import { DevilsAdvocatePanel } from "@/components/workflows/DevilsAdvocatePanel";
import { DiscoveryPlannerPanel } from "@/components/workflows/DiscoveryPlannerPanel";
import { CalendarAgentPanel } from "@/components/workflows/CalendarAgentPanel";
import { EmailAgentPanel } from "@/components/workflows/EmailAgentPanel";
import { getDocumentText, getCachedFile } from "@/stores/localDocumentStore";
import { extractPdfText } from "@/services/huggingFaceService";

// Workflow key identifiers
type WorkflowKey =
  | "draft-client-alert"
  | "extract-chronology"
  | "clause-risk-analysis"
  | "summarize-obligations"
  | "compare-versions"
  | "regulatory-compliance"
  | "conflict-resolver"
  | "devils-advocate"
  | "discovery-planner"
  | "calendar-agent"
  | "email-agent";

interface WorkflowDef {
  key: WorkflowKey;
  title: string;
  description: string;
  type: string;
  steps: number;
  icon: typeof FileEdit;
  needsDocument: boolean;
}

// ─── Recommended Workflows ─────────────────────────────────────────
const recommendedWorkflows: WorkflowDef[] = [
  {
    key: "draft-client-alert",
    title: "Draft a Client Alert",
    description: "Generate a professional client alert summarizing key legal developments from analyzed documents.",
    type: "Draft",
    steps: 5,
    icon: FileEdit,
    needsDocument: true,
  },
  {
    key: "extract-chronology",
    title: "Extract Chronology of Key Events",
    description: "Build a timeline of significant events, dates, and milestones extracted from legal filings.",
    type: "Review",
    steps: 2,
    icon: Clock,
    needsDocument: true,
  },
  {
    key: "clause-risk-analysis",
    title: "Clause Risk Analysis",
    description: "Identify and flag high-risk clauses with severity ratings and actionable recommendations.",
    type: "Analysis",
    steps: 3,
    icon: AlertTriangle,
    needsDocument: true,
  },
  {
    key: "summarize-obligations",
    title: "Summarize Obligations",
    description: "Extract and categorize all contractual obligations by party, deadline, and priority.",
    type: "Output",
    steps: 2,
    icon: ClipboardList,
    needsDocument: true,
  },
  {
    key: "compare-versions",
    title: "Compare Contract Versions",
    description: "Identify differences between contract drafts, highlighting material changes and new provisions.",
    type: "Review",
    steps: 4,
    icon: FileSearch,
    needsDocument: false,
  },
  {
    key: "regulatory-compliance",
    title: "Regulatory Compliance Check",
    description: "Assess document compliance against relevant regulatory frameworks and flag gaps.",
    type: "Analysis",
    steps: 3,
    icon: Scale,
    needsDocument: true,
  },
];

// ─── Agentic Workflows ─────────────────────────────────────────────
const agenticWorkflows: WorkflowDef[] = [
  {
    key: "conflict-resolver",
    title: "Multi-Step Conflict Resolver",
    description: "Chain-of-thought reasoning to identify contradictions, analyze ambiguity risk, and propose unified amendments.",
    type: "Reasoning",
    steps: 3,
    icon: Brain,
    needsDocument: true,
  },
  {
    key: "devils-advocate",
    title: "The Devil's Advocate Agent",
    description: "Opposing counsel persona that finds vulnerabilities, constructs attack vectors, and suggests defensive redlines.",
    type: "Adversarial",
    steps: 4,
    icon: Swords,
    needsDocument: true,
  },
  {
    key: "discovery-planner",
    title: "Automated Discovery Planner",
    description: "Extract claims and generate a full discovery plan with document requests, interrogatories, and deposition targets.",
    type: "Strategy",
    steps: 5,
    icon: ListChecks,
    needsDocument: true,
  },
  {
    key: "calendar-agent",
    title: "Autonomous Scheduler",
    description: "Extracts key dates, termination windows, and deadlines. Generates 1-click Google Calendar events.",
    type: "Action",
    steps: 3,
    icon: Clock,
    needsDocument: true,
  },
  {
    key: "email-agent",
    title: "Legal Outreach Drafter",
    description: "Flags the most egregious risk and autonomously drafts a pushback email, ready to send from your native mail client.",
    type: "Action",
    steps: 3,
    icon: FileEdit,
    needsDocument: true,
  },
];

// All workflows combined for lookup
const allWorkflows = [...recommendedWorkflows, ...agenticWorkflows];

export default function Workflows() {
  // State for the document picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingWorkflow, setPendingWorkflow] = useState<WorkflowKey | null>(null);

  // State for the active workflow and its document
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowKey | null>(null);
  const [activeDocName, setActiveDocName] = useState("");
  const [activeDocText, setActiveDocText] = useState("");
  const [activeFilePath, setActiveFilePath] = useState("");

  // Draft drawer uses a separate open/close state
  const [draftOpen, setDraftOpen] = useState(false);

  // Handle clicking a workflow card
  function handleWorkflowClick(wf: WorkflowDef) {
    if (wf.key === "compare-versions") {
      setActiveWorkflow("compare-versions");
      return;
    }

    setPendingWorkflow(wf.key);
    setPickerOpen(true);
  }

  // Handle document selection from the picker
  async function handleDocumentSelect(doc: { id: string; name: string; file_path: string }) {
    setPickerOpen(false);

    const workflow = pendingWorkflow;
    if (!workflow) return;

    // Get document text from local store
    let docText = getDocumentText(doc.id) || "";

    // If no text cached, try to extract from the cached file
    if (!docText) {
      const cachedFile = getCachedFile(doc.id);
      if (cachedFile) {
        try {
          docText = await extractPdfText(cachedFile);
        } catch (err) {
          console.error("Failed to extract text from cached file:", err);
        }
      }
    }

    // Also check localStorage directly
    if (!docText) {
      try {
        const storedDocs = JSON.parse(localStorage.getItem("legal-hub-local-documents") || "[]");
        const stored = storedDocs.find((d: { id: string }) => d.id === doc.id);
        if (stored?.extractedText) {
          docText = stored.extractedText;
        }
      } catch {
        // ignore
      }
    }

    // Set the active state
    setActiveDocName(doc.name);
    setActiveDocText(docText);
    setActiveFilePath(doc.file_path);

    if (workflow === "draft-client-alert") {
      setDraftOpen(true);
    } else {
      setActiveWorkflow(workflow);
    }

    setPendingWorkflow(null);
  }

  // Back to workflow list
  function handleBack() {
    setActiveWorkflow(null);
    setActiveDocName("");
    setActiveDocText("");
    setActiveFilePath("");
  }

  // ─── Active workflow views ────────────────────────────────────────

  if (activeWorkflow === "extract-chronology") {
    return (
      <TimelineView
        onBack={handleBack}
        documentName={activeDocName}
        filePath={activeFilePath}
        documentText={activeDocText}
      />
    );
  }

  if (activeWorkflow === "clause-risk-analysis") {
    return (
      <RiskAnalysisPanel
        onBack={handleBack}
        documentName={activeDocName}
        filePath={activeFilePath}
        documentText={activeDocText}
      />
    );
  }

  if (activeWorkflow === "summarize-obligations") {
    return (
      <ObligationsPanel
        onBack={handleBack}
        documentName={activeDocName}
        documentText={activeDocText}
      />
    );
  }

  if (activeWorkflow === "regulatory-compliance") {
    return (
      <ComplianceCheckPanel
        onBack={handleBack}
        documentName={activeDocName}
        documentText={activeDocText}
      />
    );
  }

  if (activeWorkflow === "compare-versions") {
    return <CompareVersionsPanel onBack={handleBack} />;
  }

  if (activeWorkflow === "conflict-resolver") {
    return (
      <ConflictResolverPanel
        onBack={handleBack}
        documentName={activeDocName}
        documentText={activeDocText}
      />
    );
  }

  if (activeWorkflow === "devils-advocate") {
    return (
      <DevilsAdvocatePanel
        onBack={handleBack}
        documentName={activeDocName}
        documentText={activeDocText}
      />
    );
  }

  if (activeWorkflow === "discovery-planner") {
    return (
      <DiscoveryPlannerPanel
        onBack={handleBack}
        documentName={activeDocName}
        documentText={activeDocText}
      />
    );
  }

  if (activeWorkflow === "calendar-agent") {
    return (
      <CalendarAgentPanel
        onBack={handleBack}
        documentName={activeDocName}
        documentText={activeDocText}
      />
    );
  }

  if (activeWorkflow === "email-agent") {
    return (
      <EmailAgentPanel
        onBack={handleBack}
        documentName={activeDocName}
        documentText={activeDocText}
      />
    );
  }

  // ─── Workflow list (default view) ─────────────────────────────────

  // Reusable card renderer
  function renderWorkflowCard(wf: WorkflowDef) {
    return (
      <Card
        key={wf.key}
        className="cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 border-border"
        onClick={() => handleWorkflowClick(wf)}
      >
        <CardContent className="p-5 space-y-3">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
            <wf.icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">{wf.title}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {wf.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {wf.type}
            </Badge>
            <span className="text-xs text-muted-foreground">{wf.steps} steps</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pre-built analysis workflows powered by advanced legal intelligence
        </p>
      </div>

      {/* ── Recommended Workflows ────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Recommended Workflows
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendedWorkflows.map(renderWorkflowCard)}
        </div>
      </div>

      {/* ── Agentic Workflows ────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Agentic Workflows
          </h2>
          <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200 text-[10px] px-1.5">
            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
            AI Agent
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Advanced multi-step reasoning agents that think through complex legal problems
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agenticWorkflows.map(renderWorkflowCard)}
        </div>
      </div>

      {/* Document Picker Dialog (shared by all document-based workflows) */}
      <DocumentPickerDialog
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setPendingWorkflow(null); }}
        onSelect={handleDocumentSelect}
        workflowTitle={
          allWorkflows.find((w) => w.key === pendingWorkflow)?.title || "Workflow"
        }
      />

      {/* Draft Drawer (slide-over panel) */}
      <DraftDrawer
        open={draftOpen}
        onClose={() => setDraftOpen(false)}
        documentName={activeDocName}
        filePath={activeFilePath}
        documentText={activeDocText}
      />
    </div>
  );
}
