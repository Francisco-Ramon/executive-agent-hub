import { Outlet, Link, useLocation } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { useState, useEffect } from "react";
import { Menu, X, LogOut } from "lucide-react";
import logo from "@/assets/mr-cisco-logo.png";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { NAV_ITEMS } from "@/config/navigation";

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#090812] text-[#F7F4FC] relative">
      {/* Mobile Header Bar */}
      <header className="flex md:hidden items-center justify-between px-4 py-3 bg-[#100E19] border-b border-[#29233C] sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Mr. Cisco" className="w-8 h-8 rounded-full shadow-[0_0_16px_rgba(160,32,240,0.4)]" />
          <div>
            <div className="font-semibold text-sm tracking-tight text-[#F7F4FC]">Mr. Cisco</div>
            <div className="text-[9px] uppercase tracking-[0.16em] text-[#A6A0B7]">EXECUTIVE AGENT</div>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 rounded-lg border border-[#29233C] bg-[#1B172A] text-[#F7F4FC] hover:bg-[#29233C] transition"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer Navigation Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-72 bg-[#100E19] border-r border-[#29233C] z-50 flex flex-col transform transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 pt-6 pb-4 flex items-center justify-between border-b border-[#29233C]">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Mr. Cisco" className="w-10 h-10 rounded-full shadow-[0_0_20px_rgba(160,32,240,0.45)]" />
            <div>
              <div className="font-semibold tracking-tight text-[#F7F4FC]">Mr. Cisco</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-[#A6A0B7]">EXECUTIVE AGENT</div>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-[#A6A0B7] hover:text-[#F7F4FC] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname === item.to || location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${
                  active
                    ? "bg-gradient-to-r from-[#A020F0] to-[#743BDA]/40 text-[#F7F4FC]"
                    : "text-[#A6A0B7] hover:text-[#F7F4FC] hover:bg-[#1B172A]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#29233C]">
          <div className="px-3 py-2 text-xs text-[#A6A0B7] truncate">{user?.email}</div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#A6A0B7] hover:text-[#F7F4FC] hover:bg-[#1B172A] transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Pane */}
      <main className="flex-1 min-w-0 relative z-[1] px-4 py-4 md:px-7 md:py-5 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
