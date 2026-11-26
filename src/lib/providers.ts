import { supabase } from "@/integrations/supabase/client";

export interface ProviderPopularModel {
  id: string;
  name: string;
  free?: boolean;
  context?: number;
}

export interface ProviderCapability {
  streaming: boolean;
  toolCalling: boolean;
  contextWindow: number;
  multimodal: boolean;
}

export interface ProviderItem {
  id: "gemini" | "xai" | "groq" | "openrouter" | "cloudflare" | "mistral" | "cohere";
  name: string;
  defaultModel: string;
  popularModels: ProviderPopularModel[];
  requiresAccountId?: boolean;
  capabilities: ProviderCapability;
  configured: boolean;
  enabled: boolean;
  priority: number;
  selectedModel: string;
  maskedKey: string | null;
  extraConfig: Record<string, any>;
  monthlyBudgetUsd: number | null;
  stats: {
    requests: number;
    tokens: number;
    estimatedCostUsd: number;
    rateLimitErrors: number;
    lastSuccessAt: string | null;
  };
  lastTest: {
    testedAt: string | null;
    ok: boolean | null;
    error: string | null;
  };
}

export async function listProviders(): Promise<ProviderItem[]> {
  const { data, error } = await supabase.functions.invoke("ai-providers", {
    body: { action: "list" },
  });
  if (error) throw error;
  return data?.providers || [];
}

export async function saveProvider(params: {
  provider: string;
  apiKey?: string;
  selectedModel?: string;
  enabled?: boolean;
  priority?: number;
  extraConfig?: Record<string, any>;
  monthlyBudgetUsd?: number | null;
}) {
  const { data, error } = await supabase.functions.invoke("ai-providers", {
    body: { action: "save", ...params },
  });
  if (error) throw error;
  return data;
}

export async function testProvider(params: {
  provider: string;
  apiKey?: string;
  model?: string;
  extraConfig?: Record<string, any>;
}): Promise<{
  ok: boolean;
  error?: string | null;
  reply?: string | null;
  latencyMs: number;
  testedModel: string;
}> {
  const { data, error } = await supabase.functions.invoke("ai-providers", {
    body: { action: "test", ...params },
  });
  if (error) throw error;
  return data;
}

export async function deleteProvider(provider: string) {
  const { data, error } = await supabase.functions.invoke("ai-providers", {
    body: { action: "delete", provider },
  });
  if (error) throw error;
  return data;
}
