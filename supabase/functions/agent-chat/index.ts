// Mr. Cisco — Executive Agent (tool-calling + RAG + persistent memory + multi-provider streaming + automatic failover)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runAgentLoop } from "../_shared/agent-tools.ts";
import {
  getProviderExecutionChain,
  PROVIDER_REGISTRY,
  type AiProviderName,
  type ResolvedEndpoint,
} from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Mr. Cisco, a professional executive assistant.

CONVERSATION STYLE:
- Short, conversational, one idea at a time. 1–3 sentences by default.
- Only use bullets when the user asks for a summary, plan, or briefing.
- Never preface with "Certainly" or "As an AI". Just answer.

PERSONA:
- Calm, sharp, proactive. CEO-level clarity without verbosity.

TOOL USE (CRITICAL — DO NOT SKIP):
- You have real tools connected to the user's Gmail, Google Calendar, tasks, books, and the LIVE INTERNET. USE THEM.
- If the user asks anything about email, inbox, mail, messages → CALL summarize_inbox or list_unread_emails. Do not say "what can I help with" — go fetch it.
- If the user asks about today / schedule / calendar / meetings → CALL list_today_events or list_upcoming_events.
- If the user asks about tasks / todos → CALL list_tasks.
- If the user asks about books / reading → CALL list_books.
- If the user asks for a daily briefing / morning brief / what's on today → CALL generate_daily_briefing AND list_today_events AND summarize_inbox, then synthesize.
- If a tool returns { error: "not_connected" } for Gmail/Calendar, tell the user to connect Google in Settings — but only after you actually tried.
- Never claim you cannot read email or calendar. You can. Just call the tool.

REAL-TIME INTERNET RESEARCH & WEB BROWSING (CRITICAL):
- You are equipped with autonomous internet tools: web_search and browse_website.
- Whenever the user asks about current events, trending topics (e.g. "What is trending in ChatGPT?", "What's new in tech today?"), recent developments (e.g. "Find the latest developments in artificial intelligence"), or comparisons (e.g. "Compare the latest developments from OpenAI, Google and Anthropic") → YOU MUST CALL web_search.
- Whenever the user provides a URL or asks you to visit, read, inspect, or summarize a website (e.g. "Visit https://openai.com and summarize its services") → YOU MUST CALL browse_website.
- NEVER claim "I don't have access to real-time information", "My knowledge cutoff is...", or "I cannot browse the web". You DO have real-time web access. Always execute web_search or browse_website immediately.
- In your research response:
  1. Synthesize findings clearly and concisely with executive precision.
  2. ALWAYS cite sources using clickable markdown links: [Source Name](url).
  3. Include publication dates where available (e.g. "Nov 26, 2026").
  4. Compare information from multiple sources when relevant.
  5. Distinguish verified facts from speculative claims.
  6. Never fabricate search results or citations.

APPROVAL DISCIPLINE (CRITICAL):
- NEVER send an email. You can only DRAFT email replies. After drafting, show the draft and ask the user to approve/edit before anything is sent. (Sending is not even available to you.)
- NEVER create a calendar event without explicit user approval. The flow is:
    1. Use propose_calendar_event to stage the event.
    2. Show the proposed event back to the user and ask: "Do you want me to add this to your calendar?"
    3. Only call create_calendar_event(approved: true) AFTER the user clearly says yes.
- Browser automation is strictly read-only and analytical. Never attempt form submission, purchasing, or messaging without explicit user approval.
- If a Gmail or Calendar tool returns { error: "not_connected" }, tell the user to connect Google in Settings — do not attempt anything else.

DOCUMENTS:
- If document context is provided in [DOCUMENTS], cite the filename when you use it: e.g. "From contract.pdf: ...".
- If the user asks about something outside the documents, answer normally without forcing them in.

CAPABILITIES (via tools):
- Gmail (read + summarize + draft only — never send).
- Google Calendar (read events, find free time, propose + create events with approval).
- Tasks, Reading (real DB).
- Real-time Internet Web Search & Autonomous Webpage Browsing.

WHEN YOU USE A TOOL:
- For simple actions, state the result in 1–2 short sentences, then offer one next step.
- For research and comparisons, provide an executive synthesis with clickable source citations.`;

// Tool definitions and executor live in _shared/agent-tools.ts (shared with telegram-webhook).

// ---------- RAG helpers ----------
async function embedQuery(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const resp = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.data[0].embedding;
  } catch { return null; }
}

async function summarizeOldMessages(messages: any[], ep: ResolvedEndpoint): Promise<string> {
  const text = messages.map((m: any) => `${m.role}: ${m.content}`).join("\n");
  const resp = await fetch(ep.url, {
    method: "POST",
    headers: ep.headers,
    body: JSON.stringify({
      model: ep.model,
      messages: [
        { role: "system", content: "Summarize the following conversation in 4-6 bullet points capturing key facts, decisions, and unresolved threads. Be terse." },
        { role: "user", content: text },
      ],
    }),
  });
  if (!resp.ok) return "";
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function generateTitle(firstUserMessage: string, ep: ResolvedEndpoint): Promise<string> {
  const resp = await fetch(ep.url, {
    method: "POST",
    headers: ep.headers,
    body: JSON.stringify({
      model: ep.model,
      messages: [
        { role: "system", content: "Generate a 3-6 word title for this chat. Plain text, no quotes, no punctuation at end." },
        { role: "user", content: firstUserMessage.slice(0, 500) },
      ],
    }),
  });
  if (!resp.ok) return "New conversation";
  const data = await resp.json();
  const t = (data.choices?.[0]?.message?.content ?? "New conversation").trim().replace(/^["']|["']$/g, "").slice(0, 80);
  return t || "New conversation";
}

// Detect whether the latest user message likely needs document RAG
function needsDocumentContext(text: string): boolean {
  const lower = text.toLowerCase();
  const triggers = ["document", "file", "pdf", "uploaded", "attached", "what does", "summarize this", "summarize the", "according to", "in the", "from the"];
  return triggers.some((t) => lower.includes(t));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method === "GET") {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const authHeader = req.headers.get("Authorization");
    let userId = "";
    if (authHeader) {
      const { data } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = data?.user?.id || "";
    }
    const chain = await getProviderExecutionChain(admin, userId);
    return new Response(JSON.stringify({
      configured: chain.length > 0,
      activeProvider: chain[0]?.provider || null,
      model: chain[0]?.model || null,
      availableProviders: chain.map(c => c.provider),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { messages: clientMessages, conversation_id, stream = false, provider } = body;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    if (body?.action === "status") {
      const chain = await getProviderExecutionChain(admin, userId);
      return new Response(JSON.stringify({
        configured: chain.length > 0,
        activeProvider: chain[0]?.provider || null,
        model: chain[0]?.model || null,
        availableProviders: chain.map(c => c.provider),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endpoints = await getProviderExecutionChain(admin, userId, provider);
    if (endpoints.length === 0) {
      return new Response(JSON.stringify({ error: "No AI provider configured. Please configure an AI provider in Settings." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const primaryEp = endpoints[0];

    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "conversation_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure conversation exists & is owned by user
    const { data: convo } = await supabase.from("conversations").select("*").eq("id", conversation_id).maybeSingle();
    let conversation = convo;
    if (!conversation) {
      const { data: created, error: createErr } = await supabase.from("conversations").insert({
        id: conversation_id, user_id: userId, title: "New conversation",
      }).select().single();
      if (createErr) throw new Error(createErr.message);
      conversation = created;
    } else if (conversation.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMsg = clientMessages[clientMessages.length - 1];
    if (userMsg?.role !== "user") {
      return new Response(JSON.stringify({ error: "Last message must be user" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist user message
    await supabase.from("chat_messages").insert({
      user_id: userId, conversation_id, role: "user", content: userMsg.content,
    });

    // Load full history from DB (source of truth)
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true });

    const allMsgs = (history ?? []).map((m: any) => ({ role: m.role, content: m.content }));

    // Sliding window: last 20, summarize older into rolling summary
    const KEEP = 20;
    let summary = conversation.summary ?? "";
    if (allMsgs.length > KEEP + 5) {
      const older = allMsgs.slice(0, allMsgs.length - KEEP);
      const newSummary = await summarizeOldMessages(older, primaryEp);
      if (newSummary) {
        summary = newSummary;
        await supabase.from("conversations").update({ summary }).eq("id", conversation_id);
      }
    }
    const recent = allMsgs.slice(-KEEP);

    // Document context: pull all chunks for documents attached to this conversation
    // (keyword-triggered to keep prompts small for unrelated questions).
    let docContext = "";
    if (needsDocumentContext(userMsg.content)) {
      const { data: docs } = await supabase
        .from("documents")
        .select("id, filename")
        .eq("user_id", userId)
        .eq("conversation_id", conversation_id)
        .eq("status", "ready");

      if (docs && docs.length > 0) {
        const docIds = docs.map((d: any) => d.id);
        const { data: chunks } = await supabase
          .from("document_chunks")
          .select("document_id, chunk_index, content")
          .in("document_id", docIds)
          .order("document_id", { ascending: true })
          .order("chunk_index", { ascending: true })
          .limit(40); // ~60K chars max

        if (chunks && chunks.length > 0) {
          const byDoc = new Map<string, string>();
          for (const d of docs) byDoc.set(d.id, d.filename);
          const grouped = new Map<string, string[]>();
          for (const c of chunks as any[]) {
            const arr = grouped.get(c.document_id) ?? [];
            arr.push(c.content);
            grouped.set(c.document_id, arr);
          }
          const parts: string[] = [];
          for (const [docId, contents] of grouped) {
            parts.push(`--- ${byDoc.get(docId) ?? "document"} ---\n${contents.join("\n")}`);
          }
          docContext = "[DOCUMENTS — verbatim contents below. Quote the filename when answering.]\n" + parts.join("\n\n");
        }
      }
    }

    // Assemble system prompt
    const sysParts = [SYSTEM_PROMPT];
    if (summary) sysParts.push(`\n[CONVERSATION SUMMARY SO FAR]\n${summary}`);
    if (docContext) sysParts.push(`\n${docContext}`);

    const sysPrompt = sysParts.join("\n");

    const finalizeConversation = async (content: string, tools: any[], prov: string, mod: string) => {
      if (content) {
        await supabase.from("chat_messages").insert({
          user_id: userId, conversation_id, role: "assistant", content, metadata: { tools, provider: prov, model: mod },
        });
      }
      const updates: any = { last_message_at: new Date().toISOString() };
      if (!conversation.title_generated) {
        try {
          updates.title = await generateTitle(userMsg.content, primaryEp);
          updates.title_generated = true;
        } catch (e) {
          console.error("title gen failed:", e);
        }
      }
      await supabase.from("conversations").update(updates).eq("id", conversation_id);

      // Increment usage stats in background
      try {
        const approxTokens = Math.ceil((userMsg.content.length + content.length) / 4);
        await admin.rpc("increment_ai_usage", {
          p_user_id: userId,
          p_provider: prov,
          p_tokens: approxTokens,
        }).catch(async () => {
          // Direct fallback update if RPC not present
          const { data: cfg } = await admin
            .from("ai_provider_configs")
            .select("requests_count, tokens_used")
            .eq("user_id", userId)
            .eq("provider", prov)
            .maybeSingle();
          if (cfg) {
            await admin
              .from("ai_provider_configs")
              .update({
                requests_count: (cfg.requests_count || 0) + 1,
                tokens_used: (cfg.tokens_used || 0) + approxTokens,
                last_success_at: new Date().toISOString(),
              })
              .eq("user_id", userId)
              .eq("provider", prov);
          }
        });
      } catch (_) {}
    };

    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const emit = (obj: Record<string, any>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          };
          try {
            emit({ type: "status", provider: primaryEp.provider, model: primaryEp.model });
            const result = await runAgentLoop({
              endpoints,
              systemPrompt: sysPrompt,
              messages: recent,
              supabase,
              userId,
              maxIterations: 6,
              stream: true,
              onToken: (token) => emit({ type: "token", content: token }),
              onToolCall: (name) => emit({ type: "tool", name }),
              onProviderChange: (p, m) => emit({ type: "status", provider: p, model: m, failover: true }),
            });
            await finalizeConversation(result.content, result.tools, result.provider, result.model);
            emit({
              type: "done",
              content: result.content,
              tools: result.tools,
              provider: result.provider,
              model: result.model,
            });
          } catch (e: any) {
            emit({ type: "error", error: e?.message || "AI provider error", status: e?.status || 500 });
          } finally {
            controller.close();
          }
        },
      });
      return new Response(readable, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    let finalContent = "";
    let toolEvents: any[] = [];
    let usedProvider = primaryEp.provider;
    let usedModel = primaryEp.model;

    try {
      const result = await runAgentLoop({
        endpoints,
        systemPrompt: sysPrompt,
        messages: recent,
        supabase,
        userId,
        maxIterations: 6,
      });
      finalContent = result.content;
      toolEvents = result.tools;
      usedProvider = result.provider;
      usedModel = result.model;
    } catch (e: any) {
      const status = e?.status || 500;
      return new Response(JSON.stringify({ error: e?.message || "AI provider error" }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await finalizeConversation(finalContent, toolEvents, usedProvider, usedModel);

    return new Response(JSON.stringify({
      content: finalContent,
      tools: toolEvents,
      provider: usedProvider,
      model: usedModel,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("agent-chat error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
