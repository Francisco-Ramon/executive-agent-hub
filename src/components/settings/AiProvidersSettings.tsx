import { useState, useEffect } from "react";
import {
  listProviders,
  saveProvider,
  testProvider,
  deleteProvider,
  type ProviderItem,
} from "@/lib/providers";
import { toast } from "sonner";
import {
  Cpu,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Save,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Zap,
  Activity,
  Layers,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

export function AiProvidersSettings() {
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const [extraInputs, setExtraInputs] = useState<Record<string, Record<string, string>>>({});
  const [priorityInputs, setPriorityInputs] = useState<Record<string, number>>({});

  async function load() {
    try {
      const list = await listProviders();
      setProviders(list);
      const modMap: Record<string, string> = {};
      const prioMap: Record<string, number> = {};
      const extMap: Record<string, Record<string, string>> = {};
      list.forEach((p) => {
        modMap[p.id] = p.selectedModel || p.defaultModel;
        prioMap[p.id] = p.priority ?? 10;
        extMap[p.id] = p.extraConfig || {};
      });
      setSelectedModels(modMap);
      setPriorityInputs(prioMap);
      setExtraInputs(extMap);
    } catch (e: any) {
      toast.error(e.message || "Failed to load AI providers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(provider: ProviderItem) {
    setSavingId(provider.id);
    try {
      const apiKey = editingKeys[provider.id]?.trim();
      const selectedModel = selectedModels[provider.id] || provider.defaultModel;
      const priority = priorityInputs[provider.id] ?? 10;
      const extraConfig = extraInputs[provider.id] || {};

      await saveProvider({
        provider: provider.id,
        apiKey: apiKey || undefined,
        selectedModel,
        priority,
        extraConfig,
        enabled: provider.enabled,
      });

      toast.success(`${provider.name} saved securely!`);
      // Clear raw key from form state
      setEditingKeys((prev) => ({ ...prev, [provider.id]: "" }));
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save configuration");
    } finally {
      setSavingId(null);
    }
  }

  async function handleTest(provider: ProviderItem) {
    setTestingId(provider.id);
    try {
      const apiKey = editingKeys[provider.id]?.trim() || undefined;
      const model = selectedModels[provider.id] || provider.defaultModel;
      const extraConfig = extraInputs[provider.id] || {};

      const res = await testProvider({
        provider: provider.id,
        apiKey,
        model,
        extraConfig,
      });

      if (res.ok) {
        toast.success(`${provider.name} connected successfully! (${res.latencyMs}ms)`, {
          description: `Model: ${res.testedModel} · Reply: "${res.reply?.slice(0, 60)}"`,
        });
      } else {
        toast.error(`${provider.name} test failed`, {
          description: res.error || "Unknown error",
        });
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || "Test request failed");
    } finally {
      setTestingId(null);
    }
  }

  async function handleToggleEnabled(provider: ProviderItem, enabled: boolean) {
    try {
      await saveProvider({
        provider: provider.id,
        enabled,
      });
      setProviders((prev) =>
        prev.map((p) => (p.id === provider.id ? { ...p, enabled } : p))
      );
      toast.success(`${provider.name} ${enabled ? "enabled" : "disabled"}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to update state");
    }
  }

  async function handleDelete(provider: ProviderItem) {
    if (!confirm(`Remove stored credentials for ${provider.name}?`)) return;
    try {
      await deleteProvider(provider.id);
      toast.success(`${provider.name} credentials cleared`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to clear credentials");
    }
  }

  const configuredCount = providers.filter((p) => p.configured && p.enabled).length;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 transition-all duration-300"
      style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)" }}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/[0.08]">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-400" /> Multi-AI Provider Architecture
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Configure, benchmark, and set failover priorities across your AI providers. Credentials are encrypted and stored only on your secure backend.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs flex items-center gap-2 text-white/80">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              <strong className="text-emerald-400">{configuredCount}</strong> of 7 Active
            </span>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition"
            title="Refresh providers"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Failover Policy Info */}
      <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200/90 mb-6 flex items-start gap-3">
        <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-purple-300 font-semibold">Automatic Zero-Downtime Failover:</strong> Mr. Cisco requests the highest priority enabled provider (1 is highest). If a provider triggers a rate-limit (429) or temporary server downtime (503), Mr. Cisco automatically routes the query to the next configured fallback provider without losing conversation context or repeating tool executions.
        </div>
      </div>

      {/* Provider Cards */}
      <div className="space-y-4">
        {providers.map((p) => {
          const isTesting = testingId === p.id;
          const isSaving = savingId === p.id;
          const showKey = showKeys[p.id] || false;
          const currentKeyInput = editingKeys[p.id] ?? "";
          const hasStoredKey = Boolean(p.maskedKey);

          return (
            <div
              key={p.id}
              className={`p-4 rounded-xl border transition-all ${
                p.enabled && p.configured
                  ? "bg-black/40 border-purple-500/30 shadow-[0_4px_20px_rgba(168,85,247,0.06)]"
                  : "bg-black/20 border-white/[0.06] opacity-80"
              }`}
            >
              {/* Top Row: Provider Name + Status + Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Cpu className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">{p.name}</span>
                      {p.lastTest.ok === true && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                        </span>
                      )}
                      {p.lastTest.ok === false && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
                          <XCircle className="w-2.5 h-2.5" /> Error
                        </span>
                      )}
                      {!p.configured && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-white/40 border border-white/10">
                          Not Configured
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-white/40 mt-0.5">
                      Context: {p.capabilities.contextWindow.toLocaleString()} tokens · Tools:{" "}
                      {p.capabilities.toolCalling ? "Supported" : "Text Only"} · Streaming:{" "}
                      {p.capabilities.streaming ? "Yes" : "No"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-white/50">
                    <span>Priority:</span>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={priorityInputs[p.id] ?? 10}
                      onChange={(e) =>
                        setPriorityInputs((prev) => ({
                          ...prev,
                          [p.id]: parseInt(e.target.value) || 10,
                        }))
                      }
                      className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white text-center"
                    />
                  </div>
                  <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                    <span className="text-xs text-white/50">{p.enabled ? "Enabled" : "Disabled"}</span>
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={(checked) => handleToggleEnabled(p, checked)}
                    />
                  </div>
                </div>
              </div>

              {/* Middle Row: API Key & Model Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-white/[0.06]">
                {/* API Key */}
                <div className="md:col-span-5 space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    API Key / Token
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      placeholder={hasStoredKey ? p.maskedKey! : `Enter ${p.name} API Key`}
                      value={currentKeyInput}
                      onChange={(e) =>
                        setEditingKeys((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 pr-8 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeys((prev) => ({ ...prev, [p.id]: !showKey }))}
                      className="absolute right-2.5 top-2 text-white/40 hover:text-white transition"
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Additional config if required (e.g. Cloudflare Account ID) */}
                {p.requiresAccountId && (
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Cloudflare Account ID
                    </label>
                    <input
                      type="text"
                      placeholder="Account ID (hex)"
                      value={extraInputs[p.id]?.account_id || ""}
                      onChange={(e) =>
                        setExtraInputs((prev) => ({
                          ...prev,
                          [p.id]: { ...(prev[p.id] || {}), account_id: e.target.value },
                        }))
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                )}

                {/* Model Selector */}
                <div className={`${p.requiresAccountId ? "md:col-span-4" : "md:col-span-4"} space-y-1`}>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Selected Model
                  </label>
                  <select
                    value={selectedModels[p.id] || p.defaultModel}
                    onChange={(e) =>
                      setSelectedModels((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500/50"
                  >
                    {p.popularModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.free ? "(Free)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions */}
                <div className="md:col-span-3 flex items-end gap-2">
                  <button
                    onClick={() => handleTest(p)}
                    disabled={isTesting || (!hasStoredKey && !currentKeyInput)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 transition disabled:opacity-40"
                  >
                    <Play className={`w-3 h-3 text-emerald-400 ${isTesting ? "animate-spin" : ""}`} />
                    {isTesting ? "Testing..." : "Test"}
                  </button>

                  <button
                    onClick={() => handleSave(p)}
                    disabled={isSaving}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 shadow-glow transition disabled:opacity-40"
                  >
                    <Save className="w-3 h-3" />
                    {isSaving ? "Saving..." : "Save"}
                  </button>

                  {hasStoredKey && (
                    <button
                      onClick={() => handleDelete(p)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition"
                      title="Clear credentials"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Bottom Usage & Test Feedback */}
              {(p.lastTest.testedAt || p.stats.requests > 0) && (
                <div className="mt-3 pt-2.5 border-t border-white/[0.04] flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/40">
                  <div className="flex items-center gap-4">
                    <span>
                      Requests: <strong className="text-white/70">{p.stats.requests}</strong>
                    </span>
                    <span>
                      Tokens: <strong className="text-white/70">{p.stats.tokens.toLocaleString()}</strong>
                    </span>
                    {p.stats.rateLimitErrors > 0 && (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {p.stats.rateLimitErrors} rate-limits
                      </span>
                    )}
                  </div>
                  {p.lastTest.testedAt && (
                    <div>
                      Last tested:{" "}
                      <span className={p.lastTest.ok ? "text-emerald-400" : "text-red-400"}>
                        {new Date(p.lastTest.testedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        ({p.lastTest.ok ? "Passed" : p.lastTest.error || "Failed"})
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
