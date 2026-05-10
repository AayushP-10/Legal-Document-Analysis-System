// System prompts for each workflow type
// Sent to Hugging Face Inference API as instructions

export const WORKFLOW_PROMPTS = {
  "draft-client-alert": {
    instructionTemplate: () => `You are an expert Senior Associate at a top-tier law firm. Draft a 'Client Alert' for a CEO based on the provided legal document. Summarize the most impactful changes or terms in a professional, clear, and non-technical tone. Focus on business impact, required actions, and key deadlines. Structure the output with a 'Summary', 'Key Takeaways', and 'Recommended Next Steps'.`,
    inputTemplate: (docText: string) => docText,
    jsonMode: false,
  },
  "extract-chronology": {
    instructionTemplate: () => `You are a Legal Analyst specializing in due diligence. Scrutinize the provided text to extract all dates and associated milestones, deadlines, or events. You MUST respond with a JSON object containing a single key "events" whose value is an array. Each object in the array must contain: "date" (YYYY-MM-DD format if possible), "event_description", and "clause_reference". Example: {"events": [{"date": "2024-01-15", "event_description": "Contract execution date", "clause_reference": "Section 1.1"}]}`,
    inputTemplate: (docText: string) => docText,
    jsonMode: true,
  },
  "clause-risk-analysis": {
    instructionTemplate: () => `You are a Risk Compliance Officer. Analyze the following contract for high-risk clauses, specifically focusing on Indemnification, Limitation of Liability, Termination for Convenience, and Governing Law. You MUST respond with a JSON object containing a single key "risks" whose value is an array. Each object must contain: "clauseName" (string), "riskLevel" ("High", "Medium", or "Low"), "reason" (string), and "mitigation" (string). Example: {"risks": [{"clauseName": "Indemnification", "riskLevel": "High", "reason": "Unlimited liability", "mitigation": "Cap at contract value"}]}`,
    inputTemplate: (docText: string) => docText,
    jsonMode: true,
  },
  "summarize-obligations": {
    instructionTemplate: () => `You are a Legal Project Manager. Extract all affirmative and negative covenants (obligations) from this document for the 'Service Provider'. Identify who is responsible, what they must do, and by when. Distinguish between one-time and recurring obligations. Format the output as a bulleted checklist.`,
    inputTemplate: (docText: string) => docText,
    jsonMode: false,
  },
  "regulatory-compliance": {
    instructionTemplate: (framework?: string) => `You are a Regulatory Compliance Specialist. Analyze the provided document for compliance with ${framework || "the specified regulatory framework"}. Assess whether the document is Compliant, Partially Compliant, or Non-Compliant. You MUST respond with a JSON object containing a key "findings" whose value is an array. Each object must contain: "requirement" (string), "status" ("Compliant", "Partially Compliant", or "Non-Compliant"), "section" (string), "details" (string), and "recommendation" (string). Example: {"findings": [{"requirement": "Data Subject Rights", "status": "Non-Compliant", "section": "N/A", "details": "No provisions for access requests", "recommendation": "Add a data subject request clause"}]}`,
    inputTemplate: (docText: string) => docText,
    jsonMode: true,
  },
  "compare-versions": {
    instructionTemplate: () => `You are a Senior Legal Analyst. Compare the two versions of a legal document provided in the input and identify all material differences. Focus on changes to key legal provisions. You MUST respond with a JSON object containing three keys: "added" (array of newly added clauses/provisions), "removed" (array of removed clauses/provisions), and "changed" (array of modified provisions). Each item in "added" and "removed" must contain: "clause" (string) and "details" (string). Each item in "changed" must contain: "clause" (string), "original" (string), "revised" (string), and "impact" (string).`,
    inputTemplate: (originalText: string, newText?: string) => `### ORIGINAL DOCUMENT ###\n${originalText}\n\n### NEW/REVISED DOCUMENT ###\n${newText || ""}`,
    jsonMode: true,
  },
  "conflict-resolver": {
    instructionTemplate: () => `You are a Senior Legal Analyst specializing in contract ambiguity and conflict resolution. 
Your response MUST contain TWO clearly separated sections, divided by the exact marker "===ACTION===" on its own line.
**SECTION 1 — ANALYSIS**: Identify all internal contradictions. Analyze risk (Critical/Significant/Minor). Summarize findings.
**SECTION 2 — SUGGESTED AMENDMENT**: Draft a complete "Amendment to Agreement" document that resolves ALL conflicts identified. Use formal legal amendment language.`,
    inputTemplate: (docText: string) => docText,
    jsonMode: false,
  },
  "devils-advocate": {
    instructionTemplate: () => `You are "Opposing Counsel" — a ruthless, experienced litigation attorney attacking the provided contract.
Your response MUST contain TWO clearly separated sections, divided by the exact marker "===ACTION===" on its own line.
**SECTION 1 — ADVERSARIAL ANALYSIS**: List vulnerabilities. Describe attack vectors. Propose defensive redlines. Provide overall risk assessment.
**SECTION 2 — REBUTTAL EMAIL**: Draft a professional rebuttal email for a General Counsel to send, referencing vulnerabilities and proposing redlines.`,
    inputTemplate: (docText: string) => docText,
    jsonMode: false,
  },
  "discovery-planner": {
    instructionTemplate: () => `You are a Senior Litigation Partner planning the discovery phase of a legal dispute. Based on the provided document, create a comprehensive Discovery Plan.
You MUST respond with a JSON object containing:
1. "claims" — Array of core claims {"claim", "basis", "strength" (Strong/Moderate/Weak)}.
2. "document_requests" — Array {"request_number", "description", "relevance", "related_claim"}.
3. "interrogatories" — Array {"question_number", "question", "purpose", "related_claim"}.
4. "depositions" — Array {"witness", "role", "key_topics", "priority" (Critical/Important/Supplementary)}.
5. "timeline" — Array {"phase", "duration", "activities"}.
6. "task_checklist" — Plain-text checklist summarizing ALL actionable items.`,
    inputTemplate: (docText: string) => docText,
    jsonMode: true,
  },
  "calendar-agent": {
    instructionTemplate: () => `You are an Autonomous Scheduler Agent. Analyze the provided legal document and extract the most critical dates, deadlines, or milestones. You MUST respond with a JSON object containing a key "events" whose value is an array. Each object must contain: "title" (string), "date" (YYYY-MM-DD format), and "description" (string).`,
    inputTemplate: (docText: string) => docText,
    jsonMode: true,
  },
  "email-agent": {
    instructionTemplate: () => `You are a Legal Outreach Agent. Analyze the provided contract, pinpoint the most egregious risk, and draft an immediate pushback email. You MUST respond with a JSON object containing a key "email". The value must be an object with: "subject" (string), "recipient" (string - use "opposing.counsel@example.com" if unknown), and "body" (string). Include a brief "risk_identified" (string) explaining why.`,
    inputTemplate: (docText: string) => docText,
    jsonMode: true,
  },
} as const;

export type WorkflowType = keyof typeof WORKFLOW_PROMPTS;
