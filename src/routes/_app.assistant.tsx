import { createFileRoute } from "@tanstack/react-router";
import { ChatPanel } from "@/components/chat/ChatPanel";

export const Route = createFileRoute("/_app/assistant")({
  component: AssistantPage,
});

function AssistantPage() {
  return (
    <div className="h-[calc(100dvh-7rem)] md:h-[calc(100vh-2.5rem)]">
      <ChatPanel />
    </div>
  );
}
