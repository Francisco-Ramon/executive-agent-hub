import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/page";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageCircle,
  RefreshCw,
  Phone,
  Clock,
  ChevronRight,
  ArrowLeft,
  User,
  Send,
  Loader2,
  Search,
  Sun,
  Bell,
  Maximize2,
  Zap,
  Link2,
  BookOpen,
  Headphones,
  ArrowRight,
  Paperclip,
  Mic,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import whatsappHero from "@/assets/whatsapp-hero.jpg";

export const Route = createFileRoute("/_app/whatsapp")({
  component: WhatsAppPage,
});

type Conversation = {
  id: string;
  title: string;
  last_message_at: string | null;
  created_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  metadata: any;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function extractPhone(title: string) {
  const match = title.match(/\((\d+)\)/);
  return match ? match[1] : null;
}

function extractName(title: string) {
  return title.replace("WhatsApp: ", "").replace(/\s*\(\d+\)/, "").trim();
}

export default function WhatsAppPage() {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [waConnected, setWaConnected] = useState<boolean | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [autoReply, setAutoReply] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const loadAutoReplyState = useCallback(async (convId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("preferences")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", `wa_auto_reply_disabled:${convId}`)
        .maybeSingle();

      if (error) throw error;

      if (data && (data.value === true || (data.value && typeof data.value === "object" && (data.value as any).disabled === true))) {
        setAutoReply(false);
      } else {
        setAutoReply(true);
      }
    } catch (err: any) {
      console.error("Failed to load auto-reply preference:", err);
    }
  }, []);

  const handleToggleAutoReply = async () => {
    if (!selected) return;
    const newAutoReply = !autoReply;
    setAutoReply(newAutoReply);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const key = `wa_auto_reply_disabled:${selected.id}`;
      if (!newAutoReply) {
        const { error } = await supabase
          .from("preferences")
          .upsert(
            {
              user_id: user.id,
              key,
              value: { disabled: true },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,key" }
          );

        if (error) throw error;
        toast.success("Auto-reply turned OFF for this chat");
      } else {
        const { error } = await supabase
          .from("preferences")
          .delete()
          .eq("user_id", user.id)
          .eq("key", key);

        if (error) throw error;
        toast.success("Auto-reply turned ON for this chat");
      }
    } catch (err: any) {
      toast.error("Failed to update auto-reply: " + err.message);
      setAutoReply(autoReply);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selected) return;

    setSending(true);
    try {
      const res = await fetch("https://executive-agent-hub-production-7f2299bc.up.railway.app/api/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: selected.id,
          message: replyText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");

      setReplyText("");
      toast.success("Message sent!");
      await loadMessages(selected);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, last_message_at, created_at")
        .eq("user_id", user.id)
        .ilike("title", "WhatsApp:%")
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      setConversations(data ?? []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkServerStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const url = user
        ? `https://executive-agent-hub-production-7f2299bc.up.railway.app/api/whatsapp-status?userId=${encodeURIComponent(user.id)}`
        : "https://executive-agent-hub-production-7f2299bc.up.railway.app/api/whatsapp-status";
      const r = await fetch(url);
      const d = await r.json();
      if (d.linked) {
        setWaConnected(true);
        toast.success("WhatsApp server is online");
      } else {
        const { data: dbConn } = await supabase
          .from("whatsapp_connections")
          .select("status")
          .eq("user_id", user?.id)
          .eq("status", "active")
          .maybeSingle();
        setWaConnected(!!dbConn);
      }
    } catch {
      setWaConnected(false);
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadConversations(), checkServerStatus()]);
  }, [loadConversations, checkServerStatus]);

  const loadMessages = useCallback(async (conv: Conversation) => {
    setMsgLoading(true);
    setMessages([]);
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at, metadata")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data ?? []) as Message[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setMsgLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    checkServerStatus();
  }, [loadConversations, checkServerStatus]);

  useEffect(() => {
    if (selected) {
      loadMessages(selected);
      loadAutoReplyState(selected.id);
    }
  }, [selected, loadMessages, loadAutoReplyState]);

  // Auto-refresh messages every 5s when a conversation is open
  useEffect(() => {
    if (!selected) return;
    const t = setInterval(() => loadMessages(selected), 5000);
    return () => clearInterval(t);
  }, [selected, loadMessages]);

  function openAssistantWithPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (trimmed) sessionStorage.setItem("cisco_pending_prompt", trimmed);
    navigate({ to: "/assistant" });
  }

  function handleBottomChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    openAssistantWithPrompt(chatInput);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  if (selected) {
    const phone = extractPhone(selected.title);
    const name = extractName(selected.title);

    return (
      <div className="flex flex-col h-[calc(100dvh-9rem)] md:h-[calc(100vh-3.5rem)] max-w-[1440px] mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setSelected(null)}
            className="p-2 rounded-lg hover:bg-[#151322] border border-transparent hover:border-[#29233C] transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-full bg-[#16D98A]/15 border border-[#16D98A]/30 flex items-center justify-center text-[#16D98A] font-bold text-sm">
            {name[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <div className="font-semibold text-[#F7F4FC]">{name}</div>
            {phone && (
              <div className="text-xs text-[#A6A0B7] flex items-center gap-1">
                <Phone className="w-3 h-3" /> +{phone}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#151322] border border-[#29233C] px-3 py-1.5 rounded-lg">
              <Label htmlFor="auto-reply-toggle" className="text-[11px] font-medium cursor-pointer text-[#A6A0B7] select-none">
                Manual Mode
              </Label>
              <Switch
                id="auto-reply-toggle"
                checked={!autoReply}
                onCheckedChange={() => handleToggleAutoReply()}
              />
            </div>
            <button
              onClick={() => loadMessages(selected)}
              className="p-2 rounded-lg hover:bg-[#151322] border border-transparent hover:border-[#29233C] transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${msgLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {msgLoading && messages.length === 0 && (
            <div className="text-sm text-[#A6A0B7] text-center py-8">Loading messages…</div>
          )}
          {messages.map((msg) => {
            const isAI = msg.role === "assistant";
            return (
              <div key={msg.id} className={`flex ${isAI ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    isAI
                      ? "bg-[#A020F0] text-white rounded-br-sm"
                      : "bg-[#151322] border border-[#29233C] text-[#F7F4FC] rounded-bl-sm"
                  }`}
                >
                  {!isAI && (
                    <div className="text-[10px] font-semibold text-[#16D98A] mb-1 flex items-center gap-1">
                      <User className="w-3 h-3" /> {name}
                    </div>
                  )}
                  {isAI && (
                    <div className="text-[10px] font-semibold text-white/70 mb-1">
                      {msg.metadata?.manual ? "You (Manual)" : "Mr. Cisco (AI)"}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <div className={`text-[10px] mt-1.5 ${isAI ? "text-white/60" : "text-[#A6A0B7]"}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && !msgLoading && (
            <div className="text-sm text-[#A6A0B7] text-center py-8">No messages yet.</div>
          )}
        </div>

        <form onSubmit={handleSendMessage} className="mt-4 pt-3 border-t border-[#29233C] flex gap-2">
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type a message to reply..."
            className="flex-1 bg-[#151322] border border-[#29233C] rounded-full px-5 py-2.5 text-sm focus:outline-none focus:border-[#A020F0]/70 transition text-[#F7F4FC]"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !replyText.trim()}
            className="bg-gradient-to-r from-[#A020F0] to-[#C13BFF] text-white rounded-full px-5 py-2.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
        </form>
      </div>
    );
  }

  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : conversations;

  return (
    <div className="relative max-w-[1440px] mx-auto flex flex-col gap-5 min-h-[calc(100vh-2.5rem)]">
      {/* Subtle purple ambient ribbon glow in top-right */}
      <div
        className="pointer-events-none absolute -top-6 -right-8 w-[620px] h-[240px] opacity-65 select-none"
        style={{
          background: "radial-gradient(ellipse at 75% 20%, rgba(160,32,240,0.22), transparent 65%)",
        }}
      />

      {/* Top Header Bar */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-[460px]">
          <div className="relative flex items-center h-10 rounded-full bg-[#151322]/90 border border-[#29233C] px-4 focus-within:border-[#A020F0]/70 transition">
            <Search className="w-4 h-4 text-[#A6A0B7] shrink-0 mr-3" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search anything... (Ctrl + K)"
              className="w-full bg-transparent text-[13px] text-[#F7F4FC] placeholder-[#A6A0B7] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span
            className={`text-xs flex items-center gap-2 px-3.5 py-1.5 rounded-full border ${
              waConnected
                ? "text-[#16D98A] border-[#16D98A]/30 bg-[#16D98A]/10"
                : "text-[#F7F4FC] border-[#29233C] bg-[#151322]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                waConnected ? "bg-[#16D98A]" : "bg-[#EF4444]"
              }`}
            />
            {waConnected ? "Server online" : "Server offline"}
          </span>

          <button
            type="button"
            onClick={refreshAll}
            disabled={loading || checkingStatus}
            className="text-xs px-3.5 py-1.5 rounded-full text-[#F7F4FC] bg-[#151322] border border-[#29233C] hover:border-[#A020F0]/50 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading || checkingStatus ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => toast.info("Executive Dark Mode is active")}
            title="Theme"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#A6A0B7] hover:text-[#F7F4FC] hover:bg-[#151322] transition cursor-pointer"
          >
            <Sun className="w-[18px] h-[18px]" />
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/inbox" })}
            title="Notifications"
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#A6A0B7] hover:text-[#F7F4FC] hover:bg-[#151322] transition cursor-pointer"
          >
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center leading-none">
              3
            </span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title="Toggle fullscreen"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[#A6A0B7] hover:text-[#F7F4FC] hover:bg-[#151322] transition cursor-pointer"
          >
            <Maximize2 className="w-[17px] h-[17px]" />
          </button>
        </div>
      </header>

      {/* Page Title */}
      <div className="relative z-10">
        <h1 className="text-[28px] font-bold tracking-tight bg-gradient-to-r from-[#A020F0] via-[#C13BFF] to-[#743BDA] bg-clip-text text-transparent">
          WhatsApp
        </h1>
        <p className="text-[13.5px] text-[#A6A0B7] mt-0.5">
          All WhatsApp conversations handled by Mr. Cisco.
        </p>
      </div>

      {/* Server Offline Banner */}
      {waConnected === false && (
        <div className="relative z-10 rounded-2xl bg-[#151322]/95 border border-[#29233C] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#A020F0]/15 border border-[#A020F0]/30 flex items-center justify-center text-[#C13BFF] shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[14.5px] font-semibold text-[#F7F4FC]">Server Offline</div>
              <div className="text-[12.5px] text-[#A6A0B7] mt-0.5">
                WhatsApp service is currently offline. Please check your connection and try again later.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={checkingStatus}
            className="shrink-0 px-4 py-2 rounded-full bg-[#1B172A] border border-[#29233C] hover:border-[#A020F0]/60 text-xs font-medium text-[#F7F4FC] flex items-center gap-2 transition cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? "animate-spin" : ""}`} />
            Try Again
          </button>
        </div>
      )}

      {/* Main Content: Empty State Hero OR Live Conversations */}
      {loading && conversations.length === 0 ? (
        <div className="relative z-10 flex-1 flex items-center justify-center py-12">
          <div className="text-sm text-[#A6A0B7] flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#C13BFF]" /> Loading conversations…
          </div>
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center py-4">
          <div className="relative w-[320px] h-[200px] sm:w-[380px] sm:h-[225px] flex items-center justify-center">
            <div
              className="pointer-events-none absolute inset-4 rounded-full blur-3xl opacity-45"
              style={{
                background:
                  "radial-gradient(circle, rgba(160,32,240,0.45) 0%, rgba(22,217,138,0.18) 55%, transparent 80%)",
              }}
            />
            <img
              src={whatsappHero}
              alt="WhatsApp AI Hub"
              className="w-full h-full object-contain mix-blend-lighten select-none"
              style={{
                maskImage: "radial-gradient(ellipse 75% 78% at 50% 50%, black 55%, transparent 100%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 75% 78% at 50% 50%, black 55%, transparent 100%)",
              }}
            />
          </div>

          <h2 className="text-[24px] font-bold text-[#F7F4FC] mt-1">
            No WhatsApp Conversations Yet
          </h2>
          <p className="text-[13.5px] text-[#A6A0B7] max-w-md mt-2 leading-relaxed">
            Connect your WhatsApp account to start chatting, receive messages and manage conversations here.
          </p>
        </div>
      ) : (
        <div className="relative z-10 flex-1 space-y-2.5">
          {filteredConversations.map((conv) => {
            const name = extractName(conv.title);
            const phone = extractPhone(conv.title);
            return (
              <button
                key={conv.id}
                onClick={() => setSelected(conv)}
                className="w-full text-left cursor-pointer"
              >
                <Card className="bg-[#151322] border-[#29233C] hover:border-[#A020F0]/50 transition group">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-[#16D98A]/15 border border-[#16D98A]/30 flex items-center justify-center text-[#16D98A] font-bold shrink-0">
                      {name[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-[#F7F4FC] truncate">{name}</span>
                        {conv.last_message_at && (
                          <span className="text-[11px] text-[#A6A0B7] flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            {timeAgo(conv.last_message_at)}
                          </span>
                        )}
                      </div>
                      {phone && (
                        <div className="text-xs text-[#A6A0B7] flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> +{phone}
                        </div>
                      )}
                      <div className="text-xs text-[#16D98A] mt-1 flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" /> WhatsApp
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#A6A0B7] group-hover:text-[#F7F4FC] transition shrink-0" />
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {/* Quick Actions Row */}
      <section className="relative z-10">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#F7F4FC] mb-3">
          <Zap className="w-4 h-4 text-[#F5B731] fill-[#F5B731]" />
          <span>Quick Actions</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <button
            type="button"
            onClick={() => navigate({ to: "/settings" })}
            className="text-left rounded-2xl bg-[#151322]/95 border border-[#29233C] hover:border-[#A020F0]/60 px-4 py-3.5 flex items-center justify-between gap-3 transition group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#A020F0] to-[#743BDA] flex items-center justify-center text-white shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-[#F7F4FC] truncate">Connect WhatsApp</div>
                <div className="text-[11.5px] text-[#A6A0B7] truncate">Link your account</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#A6A0B7] group-hover:text-[#F7F4FC] shrink-0 transition" />
          </button>

          <button
            type="button"
            onClick={() => navigate({ to: "/settings" })}
            className="text-left rounded-2xl bg-[#151322]/95 border border-[#29233C] hover:border-[#A020F0]/60 px-4 py-3.5 flex items-center justify-between gap-3 transition group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#1B172A] border border-[#29233C] flex items-center justify-center text-[#C13BFF] shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-[#F7F4FC] truncate">View Setup Guide</div>
                <div className="text-[11.5px] text-[#A6A0B7] truncate">Learn how to connect</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#A6A0B7] group-hover:text-[#F7F4FC] shrink-0 transition" />
          </button>

          <button
            type="button"
            onClick={checkServerStatus}
            className="text-left rounded-2xl bg-[#151322]/95 border border-[#29233C] hover:border-[#A020F0]/60 px-4 py-3.5 flex items-center justify-between gap-3 transition group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#1B172A] border border-[#29233C] flex items-center justify-center text-[#C13BFF] shrink-0">
                <RefreshCw className={`w-4 h-4 ${checkingStatus ? "animate-spin" : ""}`} />
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-[#F7F4FC] truncate">Check Status</div>
                <div className="text-[11.5px] text-[#A6A0B7] truncate">Verify connection</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#A6A0B7] group-hover:text-[#F7F4FC] shrink-0 transition" />
          </button>

          <button
            type="button"
            onClick={() => openAssistantWithPrompt("Help me connect and troubleshoot my WhatsApp integration")}
            className="text-left rounded-2xl bg-[#151322]/95 border border-[#29233C] hover:border-[#A020F0]/60 px-4 py-3.5 flex items-center justify-between gap-3 transition group cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#1B172A] border border-[#29233C] flex items-center justify-center text-[#C13BFF] shrink-0">
                <Headphones className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-[#F7F4FC] truncate">Get Help</div>
                <div className="text-[11.5px] text-[#A6A0B7] truncate">Contact support</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#A6A0B7] group-hover:text-[#F7F4FC] shrink-0 transition" />
          </button>
        </div>
      </section>

      {/* Bottom AI Chat Composer */}
      <section className="relative z-10 rounded-2xl border border-[#46297A]/80 bg-gradient-to-r from-[#1A1330] via-[#151322] to-[#1B1332] p-3.5 shadow-[0_0_32px_rgba(160,32,240,0.12)]">
        <form onSubmit={handleBottomChatSubmit} className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate({ to: "/assistant" })}
            title="Attach file"
            className="w-10 h-10 rounded-full bg-[#1B172A] border border-[#29233C] hover:border-[#A020F0]/60 flex items-center justify-center text-[#A6A0B7] hover:text-[#F7F4FC] transition shrink-0 cursor-pointer"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask Mr. Cisco anything..."
            className="flex-1 h-10 rounded-full bg-[#0E0C18]/90 border border-[#29233C] focus:border-[#A020F0]/70 px-5 text-[13.5px] text-[#F7F4FC] placeholder-[#A6A0B7] focus:outline-none transition"
          />

          <button
            type="button"
            onClick={() => navigate({ to: "/assistant" })}
            title="Voice input"
            className="w-10 h-10 rounded-full bg-[#1B172A] border border-[#29233C] hover:border-[#A020F0]/60 flex items-center justify-center text-[#A6A0B7] hover:text-[#F7F4FC] transition shrink-0 cursor-pointer"
          >
            <Mic className="w-4 h-4" />
          </button>

          <button
            type="submit"
            title="Send message"
            className="w-10 h-10 rounded-full bg-gradient-to-r from-[#A020F0] to-[#C13BFF] hover:brightness-110 flex items-center justify-center text-white shadow-[0_4px_18px_rgba(160,32,240,0.5)] transition shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </section>
    </div>
  );
}
