import { supabase } from "@/integrations/supabase/client";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-chat`;

export type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

export type AiStatus = {
  configured: boolean;
  activeProvider: "gemini" | "xai" | "openai" | "groq" | "lovable" | null;
  model: string | null;
  availableProviders: string[];
};

export async function getAiStatus(): Promise<AiStatus> {
  try {
    const resp = await fetch(FN_URL, {
      method: "GET",
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    });
    if (!resp.ok) {
      return { configured: false, activeProvider: null, model: null, availableProviders: [] };
    }
    return (await resp.json()) as AiStatus;
  } catch {
    return { configured: false, activeProvider: null, model: null, availableProviders: [] };
  }
}

export async function sendToAgent(messages: ChatMsg[], conversationId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const resp = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ messages, conversation_id: conversationId }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return (await resp.json()) as {
    content: string;
    tools: Array<{ name: string; args: any; result: any }>;
    provider?: string;
    model?: string;
  };
}

export async function streamFromAgent(
  messages: ChatMsg[],
  conversationId: string,
  callbacks: {
    onToken?: (token: string, accumulated: string) => void;
    onToolCall?: (toolName: string) => void;
    onStatus?: (info: { provider: string; model: string }) => void;
  } = {}
): Promise<{
  content: string;
  tools: Array<{ name: string; args: any; result: any }>;
  provider?: string;
  model?: string;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");

  const resp = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ messages, conversation_id: conversationId, stream: true }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }

  const contentType = resp.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !resp.body) {
    return (await resp.json()) as {
      content: string;
      tools: Array<{ name: string; args: any; result: any }>;
      provider?: string;
      model?: string;
    };
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let finalPayload: {
    content: string;
    tools: Array<{ name: string; args: any; result: any }>;
    provider?: string;
    model?: string;
  } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      const evt = JSON.parse(raw);
      if (evt.type === "status") {
        callbacks.onStatus?.({ provider: evt.provider, model: evt.model });
      } else if (evt.type === "tool") {
        callbacks.onToolCall?.(evt.name);
      } else if (evt.type === "token" && typeof evt.content === "string") {
        accumulated += evt.content;
        callbacks.onToken?.(evt.content, accumulated);
      } else if (evt.type === "done") {
        finalPayload = {
          content: evt.content || accumulated,
          tools: evt.tools || [],
          provider: evt.provider,
          model: evt.model,
        };
      } else if (evt.type === "error") {
        throw new Error(evt.error || "AI streaming error");
      }
    }
  }

  return finalPayload || { content: accumulated, tools: [] };
}

export async function embedDocument(documentId: string, text: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/embed-document`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ document_id: documentId, text }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  return (await resp.json()) as { success: boolean; chunks: number };
}
