# Legal Document Analysis System

An advanced, privacy-first web application designed to automate complex legal document analysis. By bridging the gap between passive reading and active execution, Legal Insight Hub utilizes a **fine-tuned Llama 3.1 8B model** to evaluate legal risks, strategize due diligence, and execute real-world agentic tasks like scheduling and email drafting.

**🔗 [Live Demo: Legal Document Analysis System](https://legal-insight-hub-eosin.vercel.app/)**

## 🧠 Model Architecture

This project moves away from generic, off-the-shelf APIs to utilize a custom-tailored intelligence layer:

- **The Intelligence**: Powered by an open-source **Llama 3.1 (8B parameter)** model, extensively fine-tuned on a proprietary corpus of legal contracts, risk assessments, and compliance frameworks. This allows the model to understand dense legal jargon and pinpoint severe liabilities that generalist models miss.
- **The Deployment**: The fine-tuned weights are hosted securely as an Inference API Endpoint on **Hugging Face Spaces**. 
- **Privacy-First Parsing**: To protect sensitive legal data, the React frontend extracts raw text from PDFs entirely client-side. The browser strips the text and securely transmits only the necessary strings to the Hugging Face endpoint.

---

## ✨ Key Features & Workflows

Our application escalates AI complexity through three distinct phases:

### Phase 1: Analytical Workflows (The "Readers")
The app acts as a high-speed legal analyst, converting raw text into structured insights.
* **Document Summarizer**: Generates a clear, conversational overview of the contract's core terms.
* **Clause Extractor & Risk Identifier**: Utilizing strict JSON-mode prompting, the Llama model isolates critical clauses and flags liabilities. The frontend parses this JSON to paint an interactive UI with High/Medium/Low risk badges.

### Phase 2: Generative Workflows (The "Thinkers")
The app acts as a Senior Consulting Partner, moving beyond basic extraction to synthesize strategy.
* **Discovery Planner**: Analyzes the contract and generates a multi-stage litigation or discovery plan.
* **M&A Due Diligence**: Scans the document against standard M&A health checks, dynamically streaming a comprehensive due-diligence checklist to the user.

### Phase 3: Agentic Workflows (The "Doers")
Traditional AI requires users to copy and paste responses. Our **Action Agents** bridge the gap to the real world by executing tasks autonomously using native web protocols.
* **Autonomous Scheduler**: The Llama model is mandated to hunt for critical contractual deadlines and return them as pure JSON data. The frontend mathematically formats these dates and injects them into a Google Calendar Template URL. With one click, users can save perfectly pre-filled events to their personal calendar.
* **Legal Outreach Drafter**: The model identifies the most dangerous liability in a contract and drafts an aggressive, formal pushback email safely in JSON. The app injects this data into a native `mailto:` link. Clicking the button immediately pulls open the user's native email client (Outlook, Gmail, Apple Mail) with the "Subject" and "Body" entirely typed out, ready to send.

---

## 🛠️ Tech Stack

* **Frontend Framework**: React 18 / Vite
* **Styling**: Tailwind CSS / shadcn-ui
* **State Management**: Zustand / LocalStorage (User-scoped Mock Authentication)
* **Document Parsing**: `pdfjs-dist` (Client-side extraction)
* **AI Engine**: Fine-Tuned Llama 3.1 8B (Hosted on Hugging Face Spaces)

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18 or higher)
* A deployed Hugging Face Inference Endpoint for your fine-tuned model.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/legal-insight-hub.git
   cd legal-insight-hub
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root of the project and add your Hugging Face endpoint details:
   ```env
   VITE_HUGGINGFACE_ENDPOINT_URL=https://your-space-url.hf.space/v1/chat/completions
   VITE_HUGGINGFACE_API_KEY=your_hf_token
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to the respective port.

---

## 🔒 Security & Data Isolation
The app features a lightweight, simulated authentication system perfect for demonstrations. By leveraging user-scoped `localStorage` keys, documents and chat histories are completely isolated between users on the same device without the need for a heavy SQL database backend.

---
