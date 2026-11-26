// Multi-AI Provider Registry & Engine for Mr. Cisco
// Supports: Gemini, xAI Grok, Groq, OpenRouter, Cloudflare Workers AI, Mistral AI, Cohere

export type AiProviderName =
  | "gemini"
  | "xai"
  | "groq"
  | "openrouter"
  | "cloudflare"
  | "mistral"
  | "cohere";

export interface ProviderCapability {
  streaming: boolean;
  toolCalling: boolean;
  contextWindow: number;
  multimodal: boolean;
}

export interface ProviderMeta {
  id: AiProviderName;
  name: string;
  defaultModel: string;
  popularModels: { id: string; name: string; free?: boolean; context?: number }[];
  requiresAccountId?: boolean;
  envKey: string;
  capabilities: ProviderCapability;
}

export const PROVIDER_REGISTRY: Record<AiProviderName, ProviderMeta> = {
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    popularModels: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Fast & Capable)", context: 1048576 },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (Deep Reasoning)", context: 2097152 },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", context: 1048576 },
    ],
    envKey: "GEMINI_API_KEY",
    capabilities: { streaming: true, toolCalling: true, contextWindow: 1048576, multimodal: true },
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "liquid/lfm-3-1.7b:free",
    popularModels: [
      { id: "liquid/lfm-3-1.7b:free", name: "Liquid LFM 3 1.7B (Verified Free)", free: true, context: 32768 },
      { id: "google/gemma-4-26b-a4b-it:free", name: "Gemma 4 26B (Free)", free: true, context: 8192 },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct", context: 131072 },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash via OR", context: 1000000 },
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", context: 200000 },
    ],
    envKey: "OPENROUTER_API_KEY",
    capabilities: { streaming: true, toolCalling: true, contextWindow: 131072, multimodal: true },
  },
  groq: {
    id: "groq",
    name: "Groq LPU",
    defaultModel: "qwen/qwen3.8-27b",
    popularModels: [
      { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B (Verified Live)", context: 32768 },
      { id: "openai/gpt-oss-120b", name: "GPT OSS 120B", context: 131072 },
      { id: "openai/gpt-oss-20b", name: "GPT OSS 20B", context: 65536 },
      { id: "canopylabs/orpheus-v1-english", name: "Orpheus v1 English", context: 16384 },
    ],
    envKey: "GROQ_API_KEY",
    capabilities: { streaming: true, toolCalling: true, contextWindow: 131072, multimodal: false },
  },
  xai: {
    id: "xai",
    name: "xAI Grok",
    defaultModel: "grok-3-mini",
    popularModels: [
      { id: "grok-3-mini", name: "Grok 3 Mini", context: 131072 },
      { id: "grok-2-latest", name: "Grok 2 Latest", context: 131072 },
    ],
    envKey: "XAI_API_KEY",
    capabilities: { streaming: true, toolCalling: true, contextWindow: 131072, multimodal: false },
  },
  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    defaultModel: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    popularModels: [
      { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B Fast", context: 131072 },
      { id: "@cf/meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B Instruct", context: 131072 },
      { id: "@cf/mistral/mistral-7b-instruct-v0.2", name: "Mistral 7B Instruct", context: 32768 },
    ],
    requiresAccountId: true,
    envKey: "CLOUDFLARE_API_TOKEN",
    capabilities: { streaming: true, toolCalling: true, contextWindow: 131072, multimodal: false },
  },
  mistral: {
    id: "mistral",
    name: "Mistral AI",
    defaultModel: "mistral-small-latest",
    popularModels: [
      { id: "mistral-small-latest", name: "Mistral Small (Fast)", context: 32768 },
      { id: "mistral-large-latest", name: "Mistral Large (High Intelligence)", context: 128000 },
      { id: "codestral-latest", name: "Codestral", context: 32768 },
    ],
    envKey: "MISTRAL_API_KEY",
    capabilities: { streaming: true, toolCalling: true, contextWindow: 128000, multimodal: false },
  },
  cohere: {
    id: "cohere",
    name: "Cohere",
    defaultModel: "command-r-plus-08-2024",
    popularModels: [
      { id: "command-r-plus-08-2024", name: "Command R+ (Enterprise)", context: 128000 },
      { id: "command-r-08-2024", name: "Command R (Balanced)", context: 128000 },
    ],
    envKey: "COHERE_API_KEY",
    capabilities: { streaming: true, toolCalling: true, contextWindow: 128000, multimodal: false },
  },
};

export interface ResolvedEndpoint {
  provider: AiProviderName;
  url: string;
  headers: Record<string, string>;
  model: string;
  source: "database" | "environment";
  priority: number;
}

export function maskSecret(key?: string | null): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 5)}••••${trimmed.slice(-4)}`;
}

export function buildEndpointForProvider(
  provider: AiProviderName,
  apiKey: string,
  model?: string,
  extraConfig: Record<string, any> = {}
): { url: string; headers: Record<string, string>; model: string } {
  const meta = PROVIDER_REGISTRY[provider];
  const chosenModel = model || meta.defaultModel;

  switch (provider) {
    case "gemini":
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        model: chosenModel,
      };

    case "groq":
      return {
        url: "https://api.groq.com/openai/v1/chat/completions",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        model: chosenModel,
      };

    case "openrouter":
      return {
        url: "https://openrouter.ai/api/v1/chat/completions",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://mr-cisco-executive-ai.cisco1bridge.workers.dev",
          "X-Title": "Mr. Cisco Executive Agent",
        },
        model: chosenModel,
      };

    case "xai":
      return {
        url: "https://api.x.ai/v1/chat/completions",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        model: chosenModel,
      };

    case "cloudflare": {
      const accountId = extraConfig.account_id || Deno.env.get("CLOUDFLARE_ACCOUNT_ID") || "";
      if (!accountId) throw new Error("Cloudflare Workers AI requires an Account ID.");
      return {
        url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        model: chosenModel,
      };
    }

    case "mistral":
      return {
        url: "https://api.mistral.ai/v1/chat/completions",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        model: chosenModel,
      };

    case "cohere":
      return {
        url: "https://api.cohere.com/v2/chat",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        model: chosenModel,
      };

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Fetch all configured providers for a user with fallback chain
export async function getProviderExecutionChain(
  adminSupabase: any,
  userId: string,
  preferredProvider?: AiProviderName
): Promise<ResolvedEndpoint[]> {
  const chain: ResolvedEndpoint[] = [];

  // 1. Query database configs
  try {
    const { data: dbRows } = await adminSupabase
      .from("ai_provider_configs")
      .select("*")
      .eq("user_id", userId)
      .eq("enabled", true)
      .order("priority", { ascending: true });

    if (dbRows && dbRows.length > 0) {
      for (const row of dbRows) {
        if (!row.api_key) continue;
        try {
          const ep = buildEndpointForProvider(
            row.provider as AiProviderName,
            row.api_key,
            row.selected_model,
            row.extra_config || {}
          );
          chain.push({
            provider: row.provider as AiProviderName,
            url: ep.url,
            headers: ep.headers,
            model: ep.model,
            source: "database",
            priority: row.priority ?? 10,
          });
        } catch {
          // skip invalid provider config
        }
      }
    }
  } catch (e) {
    console.warn("Could not query ai_provider_configs from DB:", e);
  }

  // 2. Add environment secrets if not already in chain
  const providersInChain = new Set(chain.map((c) => c.provider));
  const envProviders: AiProviderName[] = ["openrouter", "groq", "gemini", "xai", "mistral", "cohere", "cloudflare"];

  for (const p of envProviders) {
    if (providersInChain.has(p)) continue;
    const meta = PROVIDER_REGISTRY[p];
    const key = Deno.env.get(meta.envKey)?.trim();
    if (!key) continue;

    try {
      const ep = buildEndpointForProvider(p, key);
      chain.push({
        provider: p,
        url: ep.url,
        headers: ep.headers,
        model: ep.model,
        source: "environment",
        priority: 100, // lower priority than user DB configs
      });
    } catch {
      // skip
    }
  }

  // If a specific provider was requested by the user, move it to front
  if (preferredProvider) {
    const idx = chain.findIndex((c) => c.provider === preferredProvider);
    if (idx > 0) {
      const [fav] = chain.splice(idx, 1);
      chain.unshift(fav);
    }
  }

  return chain;
}
