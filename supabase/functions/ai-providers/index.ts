import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  PROVIDER_REGISTRY,
  maskSecret,
  buildEndpointForProvider,
  type AiProviderName,
} from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  // Admin client with service_role to access ai_provider_configs securely
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "list";

  try {
    if (req.method === "GET" || action === "list") {
      const { data: rows, error } = await admin
        .from("ai_provider_configs")
        .select("*")
        .eq("user_id", user.id)
        .order("priority", { ascending: true });

      if (error) throw error;

      const userMap = new Map((rows || []).map((r) => [r.provider, r]));

      const providers = Object.values(PROVIDER_REGISTRY).map((meta) => {
        const saved = userMap.get(meta.id);
        const hasEnvKey = Boolean(Deno.env.get(meta.envKey)?.trim());
        const hasDbKey = Boolean(saved?.api_key);
        const configured = hasDbKey || hasEnvKey;

        return {
          id: meta.id,
          name: meta.name,
          defaultModel: meta.defaultModel,
          popularModels: meta.popularModels,
          requiresAccountId: meta.requiresAccountId,
          capabilities: meta.capabilities,
          configured,
          enabled: saved ? saved.enabled : hasEnvKey,
          priority: saved?.priority ?? 10,
          selectedModel: saved?.selected_model || meta.defaultModel,
          maskedKey: hasDbKey ? maskSecret(saved.api_key) : hasEnvKey ? "•••• (Env Secret)" : null,
          extraConfig: saved?.extra_config || {},
          monthlyBudgetUsd: saved?.monthly_budget_usd ?? null,
          stats: {
            requests: saved?.requests_count ?? 0,
            tokens: saved?.tokens_used ?? 0,
            estimatedCostUsd: saved?.estimated_cost_usd ?? 0,
            rateLimitErrors: saved?.rate_limit_errors ?? 0,
            lastSuccessAt: saved?.last_success_at ?? null,
          },
          lastTest: {
            testedAt: saved?.last_tested_at ?? null,
            ok: saved?.last_test_ok ?? null,
            error: saved?.last_error ?? null,
          },
        };
      });

      return json({ providers });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const postAction = body.action || action;

      if (postAction === "save") {
        const { provider, apiKey, selectedModel, enabled, priority, extraConfig, monthlyBudgetUsd } = body;
        if (!provider || !PROVIDER_REGISTRY[provider as AiProviderName]) {
          return json({ error: "Invalid provider" }, 400);
        }

        const { data: existing } = await admin
          .from("ai_provider_configs")
          .select("api_key")
          .eq("user_id", user.id)
          .eq("provider", provider)
          .maybeSingle();

        // If apiKey not sent or masked (starts with •), keep existing key
        let keyToStore = existing?.api_key || null;
        if (apiKey && !apiKey.includes("••••")) {
          keyToStore = apiKey.trim();
        }

        const payload: Record<string, any> = {
          user_id: user.id,
          provider,
          api_key: keyToStore,
          selected_model: selectedModel || PROVIDER_REGISTRY[provider as AiProviderName].defaultModel,
          enabled: typeof enabled === "boolean" ? enabled : true,
          priority: typeof priority === "number" ? priority : 10,
          extra_config: extraConfig || {},
          monthly_budget_usd: monthlyBudgetUsd ?? null,
          updated_at: new Date().toISOString(),
        };

        const { data: saved, error } = await admin
          .from("ai_provider_configs")
          .upsert(payload, { onConflict: "user_id,provider" })
          .select()
          .single();

        if (error) throw error;
        return json({ ok: true, provider: saved.provider });
      }

      if (postAction === "test") {
        const { provider, apiKey, model, extraConfig } = body;
        if (!provider || !PROVIDER_REGISTRY[provider as AiProviderName]) {
          return json({ error: "Invalid provider" }, 400);
        }

        const { data: existing } = await admin
          .from("ai_provider_configs")
          .select("*")
          .eq("user_id", user.id)
          .eq("provider", provider)
          .maybeSingle();

        let keyToUse = apiKey && !apiKey.includes("••••") ? apiKey.trim() : existing?.api_key;
        if (!keyToUse) {
          keyToUse = Deno.env.get(PROVIDER_REGISTRY[provider as AiProviderName].envKey);
        }

        if (!keyToUse) {
          return json({ ok: false, error: "No API key configured for this provider." });
        }

        const startTime = Date.now();
        const testModel = model || existing?.selected_model || PROVIDER_REGISTRY[provider as AiProviderName].defaultModel;
        const testConfig = extraConfig || existing?.extra_config || {};

        let testOk = false;
        let testError: string | null = null;
        let testReply: string | null = null;

        try {
          if (provider === "gemini") {
            const resp = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${keyToUse}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: "Ping. Reply with: Pong" }] }] }),
              }
            );
            const data = await resp.json();
            if (!resp.ok) {
              testError = data.error?.message || `Gemini error ${resp.status}`;
            } else {
              testReply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "OK";
              testOk = true;
            }
          } else {
            const ep = buildEndpointForProvider(provider as AiProviderName, keyToUse, testModel, testConfig);
            const resp = await fetch(ep.url, {
              method: "POST",
              headers: ep.headers,
              body: JSON.stringify({
                model: ep.model,
                messages: [{ role: "user", content: "Ping. Reply with: Pong" }],
                max_tokens: 10,
              }),
            });
            const data = await resp.json();
            if (!resp.ok) {
              testError = data.error?.message || (Array.isArray(data.errors) ? data.errors[0]?.message : null) || `Provider returned status ${resp.status}`;
            } else {
              testReply = data.choices?.[0]?.message?.content?.trim() || "OK";
              testOk = true;
            }
          }
        } catch (e: any) {
          testError = e?.message || "Connection failed";
        }

        const latencyMs = Date.now() - startTime;

        // Persist test outcome
        await admin.from("ai_provider_configs").upsert(
          {
            user_id: user.id,
            provider,
            last_tested_at: new Date().toISOString(),
            last_test_ok: testOk,
            last_error: testError,
            ...(testOk ? { last_success_at: new Date().toISOString() } : {}),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" }
        );

        return json({
          ok: testOk,
          error: testError,
          reply: testReply,
          latencyMs,
          testedModel: testModel,
        });
      }

      if (postAction === "delete") {
        const { provider } = body;
        if (!provider) return json({ error: "Missing provider" }, 400);

        await admin
          .from("ai_provider_configs")
          .delete()
          .eq("user_id", user.id)
          .eq("provider", provider);

        return json({ ok: true });
      }
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e: any) {
    console.error("ai-providers function error:", e);
    return json({ error: e?.message || "Server error" }, 500);
  }
});
