import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Clock, Calendar, Check } from "lucide-react";
import { runWorkflow } from "@/services/legalAI";
import { WORKFLOW_PROMPTS } from "@/config/workflowPrompts";

interface CalEvent {
  title: string;
  date: string;
  description: string;
}

interface CalendarPlan {
  events: CalEvent[];
}

const STEPS = ["Analyzing document text...", "Extracting key dates and milestones...", "Generating calendar payloads..."];

interface Props { onBack: () => void; documentName?: string; documentText?: string; }

export function CalendarAgentPanel({ onBack, documentName, documentText }: Props) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<CalendarPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setLoading(true); setPlan(null); setError(null); setStep(0);
    const iv = setInterval(() => setStep(p => Math.min(p + 1, STEPS.length - 1)), 2000);
    const wf = WORKFLOW_PROMPTS["calendar-agent"];
    const txt = documentText || `Document: ${documentName || "Uploaded legal document"}`;
    runWorkflow(wf.systemPrompt, wf.userTemplate(txt), undefined, wf.jsonMode)
      .then(r => {
        try {
          const parsed = JSON.parse(r);
          setPlan({
            events: Array.isArray(parsed.events) ? parsed.events : [],
          });
        } catch { setError("Failed to parse calendar response."); }
        setLoading(false);
      })
      .catch(e => { console.error("Calendar agent failed:", e); setError("Unable to extract dates. Please try again."); setLoading(false); })
      .finally(() => clearInterval(iv));
    return () => clearInterval(iv);
  }, [documentName, documentText]);

  const handleAddToCalendar = (event: CalEvent) => {
    const dateStr = event.date.replace(/-/g, "");
    const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${dateStr}T090000Z/${dateStr}T100000Z&details=${encodeURIComponent(event.description)}`;
    window.open(googleCalUrl, '_blank');
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-500" />Autonomous Scheduler
          </h1>
          {documentName && <p className="text-xs text-muted-foreground">Planning for: {documentName}</p>}
        </div>
      </div>

      {loading ? (
        <div className="border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
            <Loader2 className="h-4 w-4 animate-spin" />Agent is thinking...
          </div>
          <div className="space-y-2">
            {STEPS.map((s, i) => (
              <div key={i} className={`flex items-center gap-2 text-xs transition-all duration-500 ${i <= step ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground opacity-40"}`}>
                <div className={`h-1.5 w-1.5 rounded-full ${i < step ? "bg-emerald-500" : i === step ? "bg-purple-500 animate-pulse" : "bg-muted-foreground"}`} />{s}
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="text-sm text-destructive py-8">{error}</div>
      ) : plan ? (
        <div className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground mb-4 border-b border-border pb-4">
            The agent has extracted the following actionable items and generated scheduling links:
          </p>
          {plan.events.length === 0 && (
            <p className="text-sm italic text-muted-foreground">No significant dates found in the document.</p>
          )}
          {plan.events.map((ev, i) => (
            <div key={i} className="border border-border rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card shadow-sm">
              <div className="space-y-1">
                <h3 className="font-medium text-base">{ev.title}</h3>
                <p className="text-sm font-mono text-purple-600 dark:text-purple-400 font-semibold">{ev.date}</p>
                <p className="text-sm text-muted-foreground">{ev.description}</p>
              </div>
              <Button onClick={() => handleAddToCalendar(ev)} className="shrink-0 gap-2">
                <Calendar className="h-4 w-4" /> Add to Google Calendar
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
