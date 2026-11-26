import {
  Home,
  Sparkles,
  Mail,
  MessageCircle,
  Calendar,
  CheckSquare,
  BookOpen,
  Settings,
} from "lucide-react";

export const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/assistant", label: "AI Assistant", icon: Sparkles },
  { to: "/inbox", label: "Inbox", icon: Mail, badgeKey: "inbox" as const },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, badgeKey: "tasks" as const },
  { to: "/reading", label: "Reading Room", icon: BookOpen },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;
