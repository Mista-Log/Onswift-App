import { Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { AskHome } from "@/components/agent/AskHome";
import { Composer } from "@/components/agent/Composer";
import { HistoryMenu } from "@/components/agent/HistoryMenu";
import { NewChatButton } from "@/components/agent/NewChatButton";
import { ThreadView } from "@/components/agent/ThreadView";
import { useAuth } from "@/contexts/AuthContext";
import { useAgent } from "@/contexts/AgentContext";

/** Full-page Agent: the Ask AI home until the first message, then the conversation. */
export default function Chat() {
  const { user } = useAuth();
  const agent = useAgent();

  // Creators only. The server enforces this too; this just keeps other roles off a dead page.
  if (!agent.enabled) return <Navigate to="/dashboard" replace />;

  const started = agent.messages.length > 0;
  const firstName = user?.full_name?.trim().split(/\s+/)[0];

  return (
    <MainLayout>
      <div className="relative -m-4 min-h-[calc(100dvh-4rem)] bg-gradient-to-b from-primary/10 via-background to-background p-4">
        {/* Outside the message column, so the button's hover label never sits over a bubble. */}
        <div data-testid="chat-corner" className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <HistoryMenu />
          {started && <NewChatButton onClick={agent.reset} />}
        </div>
        {started ? (
          <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-2xl flex-col pt-10 md:pt-0">
            <ThreadView
              messages={agent.messages}
              streaming={agent.streaming}
              onResolveAction={agent.resolveAction}
              onRetry={agent.retry}
              onEdit={agent.editLast}
              onRate={agent.rate}
              className="flex-1 pb-6"
            />
            <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pb-2 pt-4">
              <Composer onSend={agent.send} onStop={agent.stop} streaming={agent.streaming} />
            </div>
          </div>
        ) : (
          <AskHome firstName={firstName} onSend={agent.send} onStop={agent.stop} streaming={agent.streaming} />
        )}
      </div>
    </MainLayout>
  );
}
