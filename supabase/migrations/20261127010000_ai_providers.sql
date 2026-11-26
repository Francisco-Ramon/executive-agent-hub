-- Multi-AI Provider Configurations & Usage Tracking
-- Credentials are stored server-side and accessed ONLY by Edge Functions using service_role.
CREATE TABLE IF NOT EXISTS public.ai_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 10,
  selected_model TEXT,
  api_key TEXT,
  extra_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  auto_failover BOOLEAN NOT NULL DEFAULT true,
  monthly_budget_usd NUMERIC(10, 4),
  requests_count BIGINT NOT NULL DEFAULT 0,
  tokens_used BIGINT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  rate_limit_errors BIGINT NOT NULL DEFAULT 0,
  last_tested_at TIMESTAMPTZ,
  last_test_ok BOOLEAN,
  last_error TEXT,
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.ai_provider_configs ENABLE ROW LEVEL SECURITY;

-- Block all direct frontend access to ai_provider_configs so API keys never leak to the browser.
-- All reads/writes go through the `ai-providers` Edge Function with service_role.
REVOKE ALL ON TABLE public.ai_provider_configs FROM anon, authenticated;
GRANT ALL ON TABLE public.ai_provider_configs TO service_role;

CREATE INDEX IF NOT EXISTS idx_ai_provider_configs_user_priority
  ON public.ai_provider_configs(user_id, enabled, priority);
