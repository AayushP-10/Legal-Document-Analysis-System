
# Legal Document Analysis System

A professional, enterprise-grade Legal AI Assistant platform inspired by Harvey AI, built for a Master's NLP project.

## Layout & Structure

### Sidebar (Fixed Left)
- **"+ Create"** button at top
- **Navigation items**: Assistant (active/highlighted), Vault (expandable with nested folders: "Statements", "Supply Agreements"), Workflows, History, Library, Guidance
- Collapsible with icon-only mini mode using SidebarTrigger

### Main Chat Interface (Home/Assistant Page)
- Large centered title: "Legal Document Analysis System"
- Central textarea: "Ask anything about your legal documents..."
- Below input: action bar with **Files and sources**, **Prompts**, **Customize**, **Improve** buttons
- **"Ask"** button triggers loading/streaming simulation
- **Source Tags** as pill-shaped buttons: iManage, LexisNexis, Web Search, EDGAR, Project Vault
- **Recommended Workflows** cards at bottom: "Draft a client alert", "Extract chronology of key events", "Clause Risk Analysis", "Summarize Obligations"
- Chat messages display with metadata like "Source: Section 4.2 of Agreement.pdf"

## Core Pages

### Legal Vault (`/vault`)
- Document management grid/list view
- Upload PDFs/DOCX to **Supabase Storage** with metadata in a database table
- Each document shows: name, upload date, file type, **Status** badge (Analyzed/Pending)
- Nested folder navigation matching sidebar (Statements, Supply Agreements)

### Workflows (`/workflows`)
- Gallery of workflow cards with icons, titles, descriptions, and step counts
- Cards: Draft a client alert, Extract chronology, Clause Risk Analysis, Summarize Obligations

### Analysis View (`/analysis/:id`)
- **Split-screen layout**: Document viewer on the left, AI insights panel on the right
- Right panel has **tabs**: Summary, Extracted Clauses, Flagged Risks
- Each tab shows mock/simulated AI-generated content with professional formatting
- Risk items highlighted with severity badges (High/Medium/Low)

## Backend & Service Layer

### Supabase Setup (Lovable Cloud)
- **Storage bucket** for legal documents (PDFs, DOCX)
- **Database table** `documents`: id, name, file_path, status (pending/analyzed), folder, uploaded_at, user_id
- RLS policies for document access

### AI Service Layer
- TypeScript service module (`src/services/legalAI.ts`) with a clean interface
- **Mock streaming mode** that simulates token-by-token responses with legal-themed content
- Service interface designed for easy swap to FastAPI/HuggingFace backend (configurable endpoint URL)
- Functions: `analyzeDocument()`, `askQuestion()`, `extractClauses()`, `flagRisks()`, `summarize()`
- Loading states with "Processing legal data..." indicator

## Design
- Minimalist light theme with whites, soft greys, high contrast
- Premium SaaS aesthetic matching Harvey AI's clean typography
- Fully responsive layout
- shadcn/ui components throughout
