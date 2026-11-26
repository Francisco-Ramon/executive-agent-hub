import { createFileRoute } from "@tanstack/react-router";
import { OverviewDashboard } from "@/components/dashboard/OverviewDashboard";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  return <OverviewDashboard />;
}
