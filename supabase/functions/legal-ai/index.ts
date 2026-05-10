import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const HF_ENDPOINT = "https://router.huggingface.co/v1/chat/completions";
const HF_MODEL = "meta-llama/Llama-3.1-70B-Instruct";

// Simple PDF text extraction - reads raw bytes and extracts readable text
function extractTextFromPdfBytes(bytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(bytes);
  const textParts: string[] = [];

  // Extract text between BT (begin text) and ET (end text) operators
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const block = match[1];
    // Extract strings in parentheses (literal strings)
    const strRegex = /\(([^)]*)\)/g;
    let strMatch;
    while ((strMatch = strRegex.exec(block)) !== null) {
      const text = strMatch[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (text.trim()) textParts.push(text);
    }
    // Extract hex strings in angle brackets
    const hexRegex = /<([0-9A-Fa-f]+)>/g;
    let hexMatch;
    while ((hexMatch = hexRegex.exec(block)) !== null) {
      const hex = hexMatch[1];
      let decoded = "";
      for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.substring(i, i + 2), 16);
        if (code >= 32 && code < 127) decoded += String.fromCharCode(code);
      }
      if (decoded.trim()) textParts.push(decoded);
    }
  }

  // If BT/ET extraction found content, return it
  if (textParts.length > 0) {
    return textParts.join(" ").replace(/\s+/g, " ").trim();
  }

  // Fallback: extract any readable ASCII sequences
  const asciiParts: string[] = [];
  const asciiRegex = /[\x20-\x7E]{4,}/g;
  let asciiMatch;
  while ((asciiMatch = asciiRegex.exec(raw)) !== null) {
    const text = asciiMatch[0];
    // Skip PDF operators and binary noise
    if (!text.match(/^[\d\s.]+$/) && !text.match(/^\/\w+$/) && !text.includes("obj") && !text.includes("stream")) {
      asciiParts.push(text);
    }
  }
  return asciiParts.join(" ").replace(/\s+/g, " ").trim();
}

async function fetchDocumentText(filePaths: string[]): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const texts: string[] = [];

  for (const filePath of filePaths) {
    try {
      const { data, error } = await supabase.storage
        .from("legal-documents")
        .download(filePath);

      if (error || !data) {
        console.error(`Failed to download ${filePath}:`, error);
        texts.push(`[Could not read file: ${filePath}]`);
        continue;
      }

      const bytes = new Uint8Array(await data.arrayBuffer());
      const fileName = filePath.split("/").pop() || filePath;

      if (fileName.toLowerCase().endsWith(".pdf")) {
        const extracted = extractTextFromPdfBytes(bytes);
        if (extracted.length > 50) {
          // Truncate to ~12000 chars to fit in context
          texts.push(`--- Document: ${fileName} ---\n${extracted.slice(0, 12000)}`);
        } else {
          texts.push(`--- Document: ${fileName} ---\n[PDF text extraction yielded minimal content. The document may be image-based/scanned.]`);
        }
      } else {
        // Text-based files (docx treated as text for simplicity)
        const textContent = new TextDecoder().decode(bytes);
        texts.push(`--- Document: ${fileName} ---\n${textContent.slice(0, 12000)}`);
      }
    } catch (err) {
      console.error(`Error processing ${filePath}:`, err);
      texts.push(`[Error reading file: ${filePath}]`);
    }
  }

  return texts.join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HF_API_KEY = Deno.env.get("HF_API_KEY");
    if (!HF_API_KEY) {
      return new Response(
        JSON.stringify({ error: "HF_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { systemPrompt, userPrompt, stream, filePaths } = await req.json();

    // If file paths provided, download and extract text
    let documentContext = "";
    if (filePaths && filePaths.length > 0) {
      documentContext = await fetchDocumentText(filePaths);
    }

    const fullUserPrompt = documentContext
      ? `${documentContext}\n\n---\n\nUser Question: ${userPrompt}`
      : userPrompt;

    const messages = [
      { role: "system", content: systemPrompt || "You are a helpful legal AI assistant." },
      { role: "user", content: fullUserPrompt },
    ];

    if (stream) {
      const response = await fetch(HF_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: HF_MODEL,
          messages,
          max_tokens: 2048,
          temperature: 0.7,
          top_p: 0.9,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("HF API error:", response.status, errText);
        return new Response(
          JSON.stringify({ error: `Model error: ${response.status}`, details: errText }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    } else {
      const response = await fetch(HF_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: HF_MODEL,
          messages,
          max_tokens: 2048,
          temperature: 0.7,
          top_p: 0.9,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("HF API error:", response.status, errText);
        return new Response(
          JSON.stringify({ error: `Model error: ${response.status}`, details: errText }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const generatedText = data.choices?.[0]?.message?.content || "";

      return new Response(
        JSON.stringify({ content: generatedText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("legal-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
