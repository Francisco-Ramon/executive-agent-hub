import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, Crown, LogOut, Settings as SettingsIcon } from "lucide-react";
import logo from "@/assets/mr-cisco-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { NAV_ITEMS } from "@/config/navigation";

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string>("Francisco Olum");
  const [counts, setCounts] = useState<{ inbox: number; tasks: number }>({
    inbox: 12,
    tasks: 5,
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const [{ data: profile }, { count: openTasks }] = await Promise.all([
          supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .neq("status", "completed"),
        ]);
        if (!active) return;
        const rawName = profile?.display_name || (user.user_metadata?.display_name as string | undefined);
        if (rawName && rawName.trim()) {
          setDisplayName(rawName);
        }
        if (typeof openTasks === "number" && openTasks > 0) {
          setCounts((prev) => ({ ...prev, tasks: openTasks }));
        }
      } catch {
        // Keep reference defaults when tables/queries are unavailable
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const initial = (displayName.trim()[0] || "F").toUpperCase();

  return (
    <aside className="hidden md:flex flex-col w-[240px] shrink-0 bg-[#100E19] border-r border-[#29233C] h-screen sticky top-0 z-20 select-none">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-full p-[1px] bg-gradient-to-br from-[#C13BFF] to-[#743BDA] shadow-[0_0_24px_rgba(160,32,240,0.45)] shrink-0">
          <img src={logo} alt="Mr. Cisco" className="w-full h-full rounded-full object-cover" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[16px] leading-tight tracking-tight text-[#F7F4FC]">
            Mr. Cisco
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#A6A0B7] mt-0.5">
            EXECUTIVE AGENT
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname === item.to || location.pathname.startsWith(item.to);
          const Icon = item.icon;
          const badge = "badgeKey" in item ? counts[item.badgeKey] : undefined;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-[13.5px] font-medium transition-all ${
                active
                  ? "bg-gradient-to-r from-[#A020F0] via-[#743BDA]/90 to-[#743BDA]/30 text-[#F7F4FC] shadow-[0_6px_22px_-4px_rgba(160,32,240,0.5)] border border-[#C13BFF]/30"
                  : "text-[#A6A0B7] hover:text-[#F7F4FC] hover:bg-[#1B172A]/80"
              }`}
            >
              <Icon className={`w-[17px] h-[17px] shrink-0 ${active ? "text-[#F7F4FC]" : "text-[#A6A0B7]"}`} />
              <span className="truncate">{item.label}</span>
              {typeof badge === "number" && (
                <span className="ml-auto px-2 py-0.5 rounded-full text-[11px] font-semibold leading-none bg-[#A020F0] text-[#F7F4FC]">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Premium Experience Promo Card */}
      <div className="px-3 pb-2.5 pt-2 shrink-0">
        <div className="rounded-2xl bg-[#151322] border border-[#29233C] p-3 shadow-[0_8px_24px_-8px_rgba(9,8,18,0.65)]">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold text-[#F7F4FC]">
            <Crown className="w-3.5 h-3.5 text-[#F5B731] fill-[#F5B731]/20 shrink-0" />
            <span>Premium Experience</span>
          </div>
          <p className="text-[11px] leading-snug text-[#A6A0B7] mt-1 mb-2.5">
            Your intelligent workspace for greater productivity.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/settings" })}
            className="w-full py-1.5 rounded-full text-[12px] font-semibold text-[#F7F4FC] bg-gradient-to-r from-[#A020F0] to-[#743BDA] hover:brightness-110 transition shadow-[0_4px_16px_rgba(160,32,240,0.4)] cursor-pointer"
          >
            Upgrade
          </button>
        </div>
      </div>

      {/* Bottom User Profile */}
      <div className="px-3 py-3 border-t border-[#29233C] relative">
        <button
          type="button"
          onClick={() => setProfileMenuOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-[#1B172A] transition cursor-pointer text-left"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#60A5FA] to-[#743BDA] flex items-center justify-center text-sm font-semibold text-white shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-[#F7F4FC] truncate">{displayName}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#16D98A]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16D98A]" />
              <span>Online</span>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-[#A6A0B7] shrink-0" />
        </button>

        {profileMenuOpen && (
          <div className="absolute bottom-16 left-3 right-3 rounded-xl bg-[#151322] border border-[#29233C] p-1.5 shadow-xl z-30">
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                navigate({ to: "/settings" });
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#F7F4FC] hover:bg-[#1B172A] transition cursor-pointer"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-[#A6A0B7]" />
              Account Settings
            </button>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-[#1B172A] transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
