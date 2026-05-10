import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, ListChecks, FileText, MessageSquare, Users, Clock, ClipboardList, Copy, Check } from "lucide-react";
import { runWorkflow } from "@/services/legalAI";
import { WORKFLOW_PROMPTS } from "@/config/workflowPrompts";

interface Claim { claim: string; basis: string; strength: "Strong" | "Moderate" | "Weak"; }
interface DocRequest { request_number: number; description: string; relevance: string; related_claim: string; }
interface Interrogatory { question_number: number; question: string; purpose: string; related_claim: string; }
interface Deposition { witness: string; role: string; key_topics: string[]; priority: "Critical" | "Important" | "Supplementary"; }
interface TimelinePhase { phase: string; duration: string; activities: string[]; }
interface DiscoveryPlan {
  claims: Claim[]; document_requests: DocRequest[]; interrogatories: Interrogatory[];
  depositions: Deposition[]; timeline: TimelinePhase[]; task_checklist: string;
}

const STEPS = ["Extracting core claims...", "Generating document requests...", "Drafting interrogatories...", "Identifying key witnesses...", "Building task checklist..."];
const strengthColors: Record<string, string> = {
  Strong: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  Moderate: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  Weak: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
const priorityColors: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  Important: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  Supplementary: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

type TabKey = "analysis" | "checklist";

interface Props { onBack: () => void; documentName?: string; documentText?: string; }

export function DiscoveryPlannerPanel({ onBack, documentName, documentText }: Props) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<DiscoveryPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [mainTab, setMainTab] = useState<TabKey>("analysis");
  const [subTab, setSubTab] = useState<"claims"|"documents"|"interrogatories"|"depositions"|"timeline">("claims");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true); setPlan(null); setError(null); setStep(0);
    const iv = setInterval(() => setStep(p => Math.min(p + 1, STEPS.length - 1)), 3000);
    const wf = WORKFLOW_PROMPTS["discovery-planner"];
    const txt = documentText || `Document: ${documentName || "Uploaded legal document"}`;
    runWorkflow(wf.systemPrompt, wf.userTemplate(txt), undefined, wf.jsonMode)
      .then(r => {
        try {
          const parsed = JSON.parse(r);
          setPlan({
            claims: Array.isArray(parsed.claims) ? parsed.claims : [],
            document_requests: Array.isArray(parsed.document_requests) ? parsed.document_requests : [],
            interrogatories: Array.isArray(parsed.interrogatories) ? parsed.interrogatories : [],
            depositions: Array.isArray(parsed.depositions) ? parsed.depositions : [],
            timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
            task_checklist: typeof parsed.task_checklist === "string" ? parsed.task_checklist : "No checklist generated.",
          });
        } catch { setError("Failed to parse discovery plan response."); }
        setLoading(false);
      })
      .catch(e => { console.error("Discovery planning failed:", e); setError("Unable to generate precise answer. Please try again."); setLoading(false); })
      .finally(() => clearInterval(iv));
    return () => clearInterval(iv);
  }, [documentName]);

  const analysisSubTabs = [
    { key: "claims" as const, label: "Claims", icon: FileText, count: plan?.claims.length || 0 },
    { key: "documents" as const, label: "Doc Requests", icon: FileText, count: plan?.document_requests.length || 0 },
    { key: "interrogatories" as const, label: "Interrogatories", icon: MessageSquare, count: plan?.interrogatories.length || 0 },
    { key: "depositions" as const, label: "Depositions", icon: Users, count: plan?.depositions.length || 0 },
    { key: "timeline" as const, label: "Timeline", icon: Clock, count: plan?.timeline.length || 0 },
  ];

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-blue-500" />Automated Discovery Planner
          </h1>
          {documentName && <p className="text-xs text-muted-foreground">Planning for: {documentName}</p>}
        </div>
      </div>

      {loading ? (
        <div className="border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
            <Loader2 className="h-4 w-4 animate-spin" />Thinking...
          </div>
          <div className="space-y-2">
            {STEPS.map((s, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs transition-all duration-500 ${i <= step ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground opacity-40"}`}>
                <div className={`h-1.5 w-1.5 rounded-full ${i < step ? "bg-emerald-500" : i === step ? "bg-blue-500 animate-pulse" : "bg-muted-foreground"}`} />{s}
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="text-sm text-destructive py-8">{error}</div>
      ) : plan ? (
        <>
          {/* Main tabs: Analysis vs Task Checklist */}
          <div className="flex border-b border-border">
            <button onClick={() => setMainTab("analysis")} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${mainTab === "analysis" ? "border-blue-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <FileText className="h-3.5 w-3.5" />Analysis
            </button>
            <button onClick={() => setMainTab("checklist")} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${mainTab === "checklist" ? "border-blue-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <ClipboardList className="h-3.5 w-3.5" />Task Checklist
            </button>
          </div>

          {mainTab === "checklist" ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(plan.task_checklist); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                  {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}{copied ? "Copied" : "Copy Checklist"}
                </Button>
              </div>
              <pre className="whitespace-pre-wrap text-sm font-mono border border-border rounded-lg p-5 bg-muted/30 leading-relaxed">
                {plan.task_checklist}
              </pre>
            </div>
          ) : (
            <>
              {/* Sub-tabs for analysis detail */}
              <div className="flex flex-wrap gap-1 border-b border-border pb-1">
                {analysisSubTabs.map(t => (
                  <button key={t.key} onClick={() => setSubTab(t.key)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-colors ${subTab === t.key ? "bg-background border border-border border-b-background text-foreground -mb-px" : "text-muted-foreground hover:text-foreground"}`}>
                    <t.icon className="h-3.5 w-3.5" />{t.label}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t.count}</Badge>
                  </button>
                ))}
              </div>

              {subTab === "claims" && (
                <div className="space-y-3">
                  {plan.claims.map((c, i) => (
                    <div key={i} className="border border-border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{c.claim}</p>
                        <Badge className={strengthColors[c.strength] || strengthColors.Moderate}>{c.strength}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{c.basis}</p>
                    </div>
                  ))}
                </div>
              )}

              {subTab === "documents" && (
                <div className="space-y-3">
                  {plan.document_requests.map((r, i) => (
                    <div key={i} className="border border-border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">#{r.request_number}</Badge>
                        <p className="text-sm font-medium">{r.description}</p>
                      </div>
                      <p className="text-xs text-muted-foreground"><strong>Relevance:</strong> {r.relevance}</p>
                      <p className="text-xs text-muted-foreground"><strong>Related claim:</strong> {r.related_claim}</p>
                    </div>
                  ))}
                </div>
              )}

              {subTab === "interrogatories" && (
                <div className="space-y-3">
                  {plan.interrogatories.map((q, i) => (
                    <div key={i} className="border border-border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">Q{q.question_number}</Badge>
                        <p className="text-sm font-medium">{q.question}</p>
                      </div>
                      <p className="text-xs text-muted-foreground"><strong>Purpose:</strong> {q.purpose}</p>
                    </div>
                  ))}
                </div>
              )}

              {subTab === "depositions" && (
                <div className="space-y-3">
                  {plan.depositions.map((d, i) => (
                    <div key={i} className="border border-border rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div><p className="text-sm font-medium">{d.witness}</p><p className="text-xs text-muted-foreground">{d.role}</p></div>
                        <Badge className={priorityColors[d.priority] || priorityColors.Supplementary}>{d.priority}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {d.key_topics.map((t, j) => <Badge key={j} variant="outline" className="text-[10px]">{t}</Badge>)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {subTab === "timeline" && (
                <div className="relative ml-4 space-y-4">
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
                  {plan.timeline.map((p, i) => (
                    <div key={i} className="relative pl-10">
                      <div className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full bg-blue-500 border-2 border-background" />
                      <div className="border border-border rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{p.phase}</p>
                          <Badge variant="secondary" className="text-xs">{p.duration}</Badge>
                        </div>
                        <ul className="space-y-1">
                          {p.activities.map((a, j) => <li key={j} className="text-sm text-muted-foreground flex items-start gap-2"><span className="mt-1">•</span>{a}</li>)}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
