import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import {
  Search,
  Sun,
  Bell,
  Maximize2,
  Minimize2,
  Mail,
  Check,
  Calendar,
  Sparkles,
  Zap,
  BarChart3,
  Clock,
  Lightbulb,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import aiRobot from "@/assets/ai-robot.jpg";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type DashboardStats = {
  unreadEmails: number;
  pendingTasks: number;
  upcomingEvents: number;
  newMessages: number;
};

type EventEntry = {
  id: string;
  title: string;
  timeText: string;
  badge: string;
  badgeVariant: "purple" | "blue" | "neutral";
  dotColor: string;
};

type ActivityEntry = {
  id: string;
  title: string;
  timeAgo: string;
  kind: "email" | "whatsapp" | "task" | "calendar";
};

const REFERENCE_EVENTS: EventEntry[] = [
  {
    id: "ev-1",
    title: "Project Review Meeting",
    timeText: "Today · 6:00 PM – 7:00 PM",
    badge: "Today",
    badgeVariant: "purple",
    dotColor: "#A020F0",
  },
  {
    id: "ev-2",
    title: "Team Sync",
    timeText: "Fri, Nov 28 · 10:00 AM",
    badge: "Tomorrow",
    badgeVariant: "blue",
    dotColor: "#258CFF",
  },
  {
    id: "ev-3",
    title: "Client Presentation",
    timeText: "Sat, Nov 29 · 2:00 PM",
    badge: "In 3 days",
    badgeVariant: "neutral",
    dotColor: "#16D98A",
  },
];

const REFERENCE_ACTIVITIES: ActivityEntry[] = [
  { id: "act-1", title: "New email from Aveniq Solutions", timeAgo: "2m ago", kind: "email" },
  { id: "act-2", title: "New WhatsApp message", timeAgo: "5m ago", kind: "whatsapp" },
  { id: "act-3", title: "Task completed: Update website", timeAgo: "12m ago", kind: "task" },
  { id: "act-4", title: "Meeting added: Client Demo", timeAgo: "1h ago", kind: "calendar" },
];

function Sparkline({ color, variant }: { color: string; variant: 1 | 2 | 3 | 4 }) {
  const paths: Record<1 | 2 | 3 | 4, string> = {
    1: "M 0 30 Q 22 24, 38 14 T 74 20 T 110 4",
    2: "M 0 28 Q 20 18, 42 22 T 78 12 T 110 6",
    3: "M 0 26 Q 26 24, 50 18 T 82 22 T 110 10",
    4: "M 0 29 Q 18 22, 40 16 T 76 18 T 110 3",
  };
  const gradId = `spark-grad-${variant}`;
  return (
    <svg
      viewBox="0 0 110 34"
      className="w-28 h-9 pointer-events-none select-none opacity-85"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${paths[variant]} L 110 34 L 0 34 Z`} fill={`url(#${gradId})`} />
      <path d={paths[variant]} stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.77 14.08c-.24.68-1.42 1.3-1.97 1.38-.52.08-1.18.11-1.9-.12-.44-.14-1-.33-1.72-.64-3.02-1.31-4.99-4.35-5.14-4.55-.15-.2-1.23-1.64-1.23-3.13 0-1.49.78-2.22 1.06-2.52.28-.3.61-.38.81-.38.2 0 .4.01.58.01.19 0 .44-.07.69.53.25.6.86 2.09.93 2.24.08.15.13.33.03.53-.1.2-.15.33-.3.5-.15.18-.31.39-.45.53-.15.15-.31.31-.13.61.18.3.78 1.29 1.68 2.09 1.15 1.03 2.13 1.35 2.43 1.5.3.15.48.13.65-.08.18-.2.75-.88.95-1.18.2-.3.4-.25.68-.15.28.1 1.76.83 2.06.98.3.15.5.23.58.35.08.13.08.73-.17 1.41z" />
    </svg>
  );
}

function ActivityIcon({ kind }: { kind: ActivityEntry["kind"] }) {
  if (kind === "email") {
    return (
      <div className="w-8 h-8 rounded-lg bg-[#221933] border border-[#29233C] flex items-center justify-center shrink-0">
        <Mail className="w-4 h-4 text-[#EF4444]" />
      </div>
    );
  }
  if (kind === "whatsapp") {
    return (
      <div className="w-8 h-8 rounded-lg bg-[#16D98A]/15 border border-[#16D98A]/30 flex items-center justify-center shrink-0 text-[#16D98A]">
        <WhatsAppIcon className="w-4 h-4" />
      </div>
    );
  }
  if (kind === "task") {
    return (
      <div className="w-8 h-8 rounded-lg bg-[#16D98A] flex items-center justify-center shrink-0 text-[#090812]">
        <Check className="w-4 h-4 stroke-[3]" />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-[#743BDA]/25 border border-[#743BDA]/40 flex items-center justify-center shrink-0 text-[#C13BFF]">
      <Calendar className="w-4 h-4" />
    </div>
  );
}

export function OverviewDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [briefingRange, setBriefingRange] = useState<"Today" | "This Week">("Today");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [stats, setStats] = useState<DashboardStats>({
    unreadEmails: 12,
    pendingTasks: 5,
    upcomingEvents: 3,
    newMessages: 8,
  });
  const [events, setEvents] = useState<EventEntry[]>(REFERENCE_EVENTS);
  const [activities, setActivities] = useState<ActivityEntry[]>(REFERENCE_ACTIVITIES);

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

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const [{ data: tasksData }, { data: convosData }] = await Promise.all([
          supabase
            .from("tasks")
            .select("id, title, status, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("conversations")
            .select("id, title, last_message_at, created_at")
            .eq("user_id", user.id)
            .order("last_message_at", { ascending: false })
            .limit(15),
        ]);

        if (!active) return;

        const openTaskCount = (tasksData ?? []).filter((t) => t.status !== "completed").length;
        const waConvoCount = (convosData ?? []).filter((c) => c.title?.startsWith("WhatsApp:")).length;

        setStats((prev) => ({
          ...prev,
          pendingTasks: openTaskCount > 0 ? openTaskCount : prev.pendingTasks,
          newMessages: waConvoCount > 0 ? waConvoCount : prev.newMessages,
        }));

        // Optional live calendar/gmail counts if user already linked Google
        const [calRes, mailRes] = await Promise.allSettled([
          supabase.functions.invoke("calendar-api", { body: { action: "list_today" } }),
          supabase.functions.invoke("gmail-api", { body: { action: "list_unread" } }),
        ]);

        if (!active) return;

        if (calRes.status === "fulfilled" && Array.isArray(calRes.value.data?.events) && calRes.value.data.events.length > 0) {
          const liveEvents: EventEntry[] = calRes.value.data.events.slice(0, 3).map((ev: any, idx: number) => ({
            id: ev.id || `live-ev-${idx}`,
            title: ev.title || "Untitled Event",
            timeText: ev.start
              ? `Today · ${new Date(ev.start).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : "Today",
            badge: idx === 0 ? "Today" : "Upcoming",
            badgeVariant: idx === 0 ? "purple" : idx === 1 ? "blue" : "neutral",
            dotColor: idx === 0 ? "#A020F0" : idx === 1 ? "#258CFF" : "#16D98A",
          }));
          setEvents(liveEvents);
          setStats((prev) => ({ ...prev, upcomingEvents: calRes.value.data.events.length }));
        }

        if (mailRes.status === "fulfilled" && Array.isArray(mailRes.value.data?.messages) && mailRes.value.data.messages.length > 0) {
          setStats((prev) => ({ ...prev, unreadEmails: mailRes.value.data.messages.length }));
        }

        // Merge any real completed tasks into Recent Activity if available
        const completedTask = (tasksData ?? []).find((t) => t.status === "completed");
        if (completedTask) {
          setActivities((prev) =>
            prev.map((a) =>
              a.kind === "task" ? { ...a, title: `Task completed: ${completedTask.title}` } : a
            )
          );
        }
      } catch {
        // Keep reference values silently if optional tables/functions aren't active
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  function openAssistantWithPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (trimmed) {
      sessionStorage.setItem("cisco_pending_prompt", trimmed);
    }
    navigate({ to: "/assistant" });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    if (q.includes("inbox") || q.includes("mail")) return navigate({ to: "/inbox" });
    if (q.includes("whats")) return navigate({ to: "/whatsapp" });
    if (q.includes("cal") || q.includes("event")) return navigate({ to: "/calendar" });
    if (q.includes("task")) return navigate({ to: "/tasks" });
    if (q.includes("read")) return navigate({ to: "/reading" });
    if (q.includes("insight")) return navigate({ to: "/insights" });
    if (q.includes("set")) return navigate({ to: "/settings" });
    openAssistantWithPrompt(searchQuery);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }

  return (
    <div className="relative max-w-[1440px] mx-auto flex flex-col gap-4 pb-2">
      {/* Ambient decorative background ribbons behind hero */}
      <div className="pointer-events-none absolute -top-6 -right-8 w-[760px] h-[340px] overflow-hidden opacity-75 select-none">
        <svg viewBox="0 0 800 340" className="w-full h-full" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="wave-purple" x1="0" y1="0" x2="1" y2="0.5">
              <stop offset="0%" stopColor="#A020F0" stopOpacity="0" />
              <stop offset="50%" stopColor="#A020F0" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#258CFF" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="wave-blue" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#743BDA" stopOpacity="0" />
              <stop offset="60%" stopColor="#258CFF" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#C13BFF" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <path
            d="M 40 160 C 210 260, 410 270, 800 70"
            stroke="url(#wave-purple)"
            strokeWidth="2.5"
          />
          <path
            d="M 10 215 C 240 285, 480 250, 800 130"
            stroke="url(#wave-blue)"
            strokeWidth="1.75"
          />
          <ellipse cx="590" cy="140" rx="220" ry="120" fill="rgba(160, 32, 240, 0.12)" />
        </svg>
      </div>

      {/* Top Navigation Bar */}
      <header className="relative z-10 flex items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="w-full max-w-[460px]">
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
        </form>

        <div className="flex items-center gap-2 shrink-0">
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
            {isFullscreen ? <Minimize2 className="w-[17px] h-[17px]" /> : <Maximize2 className="w-[17px] h-[17px]" />}
          </button>
        </div>
      </header>

      {/* Welcome Hero + Futuristic AI Robot */}
      <section className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-3 pb-1 min-h-[175px]">
        <div className="max-w-xl">
          <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight text-[#F7F4FC] leading-[1.15]">
            Good evening, Cisco. <span className="inline-block">👋</span>
          </h1>
          <p className="text-[15px] text-[#E2DCF0] mt-2 font-normal">
            Thursday, November 26, 2026 &middot; 9:12 PM
          </p>
          <p className="text-[14px] text-[#A6A0B7] mt-3">
            Your executive workspace. Here&apos;s what needs your attention.
          </p>
        </div>

        {/* Robot + Speech Bubble */}
        <div className="relative flex items-center justify-end lg:pr-4 self-end lg:self-auto">
          <div className="relative flex items-center">
            {/* Soft neon glow behind robot */}
            <div
              className="pointer-events-none absolute -inset-4 rounded-full blur-2xl opacity-55"
              style={{
                background:
                  "radial-gradient(circle, rgba(160,32,240,0.45) 0%, rgba(37,140,255,0.25) 45%, transparent 75%)",
              }}
            />
            <div className="relative w-[170px] h-[170px] sm:w-[190px] sm:h-[190px] -mb-6 overflow-hidden flex items-end justify-center">
              <img
                src={aiRobot}
                alt="Mr. Cisco AI Robot"
                className="w-full h-full object-cover object-top mix-blend-lighten select-none"
                style={{
                  maskImage: "radial-gradient(ellipse 72% 76% at 50% 45%, black 55%, transparent 100%)",
                  WebkitMaskImage:
                    "radial-gradient(ellipse 72% 76% at 50% 45%, black 55%, transparent 100%)",
                }}
              />
            </div>

            {/* Speech Bubble */}
            <div className="relative -ml-3 mb-8 max-w-[215px] rounded-2xl bg-[#151322]/90 border border-[#29233C] px-4 py-3 text-[13px] leading-snug text-[#F7F4FC] shadow-[0_8px_24px_rgba(9,8,18,0.65)] backdrop-blur-md">
              <span
                className="absolute -left-2 bottom-4 w-3 h-3 bg-[#151322] border-l border-b border-[#29233C] rotate-45"
                aria-hidden="true"
              />
              I&apos;m here to help you achieve more, Cisco.
            </div>
          </div>
        </div>
      </section>

      {/* Four Productivity Metric Cards */}
      <section className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Unread Emails */}
        <button
          type="button"
          onClick={() => navigate({ to: "/inbox" })}
          className="text-left rounded-2xl bg-[#151322]/95 border border-[#29233C] hover:border-[#A020F0]/50 p-5 relative overflow-hidden transition group cursor-pointer shadow-[0_8px_24px_-8px_rgba(9,8,18,0.55)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#A020F0] to-[#743BDA] flex items-center justify-center text-white shadow-[0_4px_18px_rgba(160,32,240,0.4)] shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[28px] font-bold leading-none text-[#F7F4FC]">
                  {stats.unreadEmails}
                </div>
                <div className="text-[13px] text-[#A6A0B7] mt-1.5">Unread Emails</div>
              </div>
            </div>
            <span className="text-[12px] font-semibold text-[#16D98A] flex items-center gap-0.5">
              ↑ +2
            </span>
          </div>
          <div className="absolute right-3 bottom-1">
            <Sparkline color="#A020F0" variant={1} />
          </div>
        </button>

        {/* Card 2: Pending Tasks */}
        <button
          type="button"
          onClick={() => navigate({ to: "/tasks" })}
          className="text-left rounded-2xl bg-[#151322]/95 border border-[#29233C] hover:border-[#16D98A]/50 p-5 relative overflow-hidden transition group cursor-pointer shadow-[0_8px_24px_-8px_rgba(9,8,18,0.55)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#16D98A] flex items-center justify-center text-[#090812] shadow-[0_4px_18px_rgba(22,217,138,0.35)] shrink-0">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <div>
                <div className="text-[28px] font-bold leading-none text-[#F7F4FC]">
                  {stats.pendingTasks}
                </div>
                <div className="text-[13px] text-[#A6A0B7] mt-1.5">Pending Tasks</div>
              </div>
            </div>
            <span className="text-[12px] font-semibold text-[#16D98A] flex items-center gap-0.5">
              ↑ +1
            </span>
          </div>
          <div className="absolute right-3 bottom-1">
            <Sparkline color="#16D98A" variant={2} />
          </div>
        </button>

        {/* Card 3: Upcoming Events */}
        <button
          type="button"
          onClick={() => navigate({ to: "/calendar" })}
          className="text-left rounded-2xl bg-[#151322]/95 border border-[#29233C] hover:border-[#258CFF]/50 p-5 relative overflow-hidden transition group cursor-pointer shadow-[0_8px_24px_-8px_rgba(9,8,18,0.55)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#258CFF] to-[#1D6FE0] flex items-center justify-center text-white shadow-[0_4px_18px_rgba(37,140,255,0.35)] shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[28px] font-bold leading-none text-[#F7F4FC]">
                  {stats.upcomingEvents}
                </div>
                <div className="text-[13px] text-[#A6A0B7] mt-1.5">Upcoming Events</div>
              </div>
            </div>
            <span className="text-[12px] font-semibold text-[#A6A0B7] flex items-center gap-0.5">
              → 0
            </span>
          </div>
          <div className="absolute right-3 bottom-1">
            <Sparkline color="#258CFF" variant={3} />
          </div>
        </button>

        {/* Card 4: New Messages */}
        <button
          type="button"
          onClick={() => navigate({ to: "/whatsapp" })}
          className="text-left rounded-2xl bg-[#151322]/95 border border-[#29233C] hover:border-[#16D98A]/50 p-5 relative overflow-hidden transition group cursor-pointer shadow-[0_8px_24px_-8px_rgba(9,8,18,0.55)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#16D98A] flex items-center justify-center text-white shadow-[0_4px_18px_rgba(22,217,138,0.35)] shrink-0">
                <WhatsAppIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="text-[28px] font-bold leading-none text-[#F7F4FC]">
                  {stats.newMessages}
                </div>
                <div className="text-[13px] text-[#A6A0B7] mt-1.5">New Messages</div>
              </div>
            </div>
            <span className="text-[12px] font-semibold text-[#16D98A] flex items-center gap-0.5">
              ↑ +3
            </span>
          </div>
          <div className="absolute right-3 bottom-1">
            <Sparkline color="#16D98A" variant={4} />
          </div>
        </button>
      </section>

      {/* Middle Row: AI Briefing, Upcoming Events, Recent Activity */}
      <section className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* AI Briefing Panel */}
        <div className="lg:col-span-5 rounded-2xl border border-[#3E276E] bg-gradient-to-br from-[#231442] via-[#151322] to-[#12101D] p-5 relative overflow-hidden flex flex-col justify-between shadow-[0_10px_30px_-10px_rgba(160,32,240,0.2)]">
          {/* Subtle internal glow */}
          <div
            className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full blur-3xl opacity-30"
            style={{ background: "radial-gradient(circle, #C13BFF 0%, transparent 70%)" }}
          />

          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-[#C13BFF]" />
                <h2 className="text-[15px] font-semibold text-[#F7F4FC]">Your AI Briefing</h2>
              </div>
              <button
                type="button"
                onClick={() => setBriefingRange((r) => (r === "Today" ? "This Week" : "Today"))}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1B172A] border border-[#29233C] text-[12px] text-[#F7F4FC] hover:border-[#743BDA] transition cursor-pointer"
              >
                <span>{briefingRange}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#A6A0B7]" />
              </button>
            </div>

            <div className="flex items-start gap-4 mt-5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#C13BFF] to-[#743BDA] flex items-center justify-center text-white shrink-0 shadow-[0_0_24px_rgba(160,32,240,0.5)]">
                <Zap className="w-5 h-5 fill-white" />
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-[#F7F4FC] leading-snug">
                  You&apos;re all set for today!
                </h3>
                <p className="text-[13px] text-[#A6A0B7] leading-relaxed mt-1.5">
                  You have {stats.upcomingEvents} upcoming events, {stats.pendingTasks} pending tasks and{" "}
                  {stats.unreadEmails} unread emails. Let me know how I can help.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-[12px] font-semibold text-[#F7F4FC] mb-2.5">Quick Actions:</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openAssistantWithPrompt("Plan my day")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1B172A]/90 border border-[#29233C] hover:border-[#A020F0]/60 text-[12px] text-[#F7F4FC] transition cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-[#C13BFF]" />
                <span>Plan my day</span>
              </button>
              <button
                type="button"
                onClick={() => openAssistantWithPrompt("Summarize my emails")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1B172A]/90 border border-[#29233C] hover:border-[#A020F0]/60 text-[12px] text-[#F7F4FC] transition cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-[#A020F0]" />
                <span>Summarize my emails</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/tasks" })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1B172A]/90 border border-[#29233C] hover:border-[#16D98A]/60 text-[12px] text-[#F7F4FC] transition cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-[#16D98A]" />
                <span>Review my tasks</span>
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/insights" })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1B172A]/90 border border-[#29233C] hover:border-[#743BDA]/60 text-[12px] text-[#F7F4FC] transition cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5 text-[#C13BFF]" />
                <span>Show insights</span>
              </button>
            </div>
          </div>
        </div>

        {/* Upcoming Events Panel */}
        <div className="lg:col-span-4 rounded-2xl bg-[#151322]/95 border border-[#29233C] p-5 flex flex-col justify-between shadow-[0_8px_24px_-8px_rgba(9,8,18,0.55)]">
          <div>
            <div className="flex items-center justify-between gap-2 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#743BDA]/25 flex items-center justify-center text-[#C13BFF]">
                  <Calendar className="w-4 h-4" />
                </div>
                <h2 className="text-[15px] font-semibold text-[#F7F4FC]">Upcoming Events</h2>
              </div>
              <Link
                to="/calendar"
                className="flex items-center gap-1 text-[12px] text-[#A6A0B7] hover:text-[#F7F4FC] transition"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="relative pl-5 space-y-5">
              {/* Vertical timeline line */}
              <div
                className="absolute left-[4px] top-2 bottom-2 w-[2px] bg-[#29233C]"
                aria-hidden="true"
              />
              {events.map((ev) => {
                const badgeClass =
                  ev.badgeVariant === "purple"
                    ? "bg-[#A020F0]/25 text-[#D8B4FE] border-[#A020F0]/40"
                    : ev.badgeVariant === "blue"
                      ? "bg-[#258CFF]/20 text-[#7CC0FF] border-[#258CFF]/40"
                      : "bg-[#1B172A] text-[#A6A0B7] border-[#29233C]";
                return (
                  <div key={ev.id} className="relative flex items-start justify-between gap-3">
                    <span
                      className="absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-[#151322]"
                      style={{ backgroundColor: ev.dotColor }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-[#F7F4FC] truncate">
                        {ev.title}
                      </div>
                      <div className="text-[12px] text-[#A6A0B7] mt-0.5">{ev.timeText}</div>
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${badgeClass}`}
                    >
                      {ev.badge}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Activity Panel */}
        <div className="lg:col-span-3 rounded-2xl bg-[#151322]/95 border border-[#29233C] p-5 shadow-[0_8px_24px_-8px_rgba(9,8,18,0.55)]">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-[#743BDA]/20 flex items-center justify-center text-[#C13BFF]">
              <Clock className="w-4 h-4" />
            </div>
            <h2 className="text-[15px] font-semibold text-[#F7F4FC]">Recent Activity</h2>
          </div>

          <div className="space-y-3.5">
            {activities.map((act) => (
              <div key={act.id} className="flex items-start gap-3">
                <ActivityIcon kind={act.kind} />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-[#F7F4FC] leading-snug">
                    {act.title}
                  </div>
                  <div className="text-[11.5px] text-[#A6A0B7] mt-0.5">{act.timeAgo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom AI Chat Section */}
      <section className="relative z-10 rounded-2xl border border-[#46297A]/80 bg-gradient-to-r from-[#1A1330] via-[#151322] to-[#1B1332] p-4 shadow-[0_0_32px_rgba(160,32,240,0.12)]">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#A020F0]/20 border border-[#A020F0]/40 flex items-center justify-center text-[#C13BFF] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[#F7F4FC] leading-tight">
                Chat with Mr. Cisco
              </h2>
              <p className="text-[12px] text-[#A6A0B7]">Ask anything, get things done.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openAssistantWithPrompt("Analyze my business opportunities")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1B172A]/90 border border-[#29233C] hover:border-[#A020F0]/60 text-[12px] text-[#F7F4FC] transition cursor-pointer"
            >
              <Lightbulb className="w-3.5 h-3.5 text-[#F5B731]" />
              <span>Analyze my business opportunities</span>
            </button>
            <button
              type="button"
              onClick={() => openAssistantWithPrompt("Draft a professional email")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1B172A]/90 border border-[#29233C] hover:border-[#A020F0]/60 text-[12px] text-[#F7F4FC] transition cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-[#EF4444]" />
              <span>Draft a professional email</span>
            </button>
            <button
              type="button"
              onClick={() => openAssistantWithPrompt("Show me my productivity")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1B172A]/90 border border-[#29233C] hover:border-[#A020F0]/60 text-[12px] text-[#F7F4FC] transition cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#C13BFF]" />
              <span>Show me my productivity</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
