import { ChatView } from "@/components/chat/chat-view";

/**
 * Body of the Saathi panel. `ChatPanel` supplies the frame, title, close button and focus handling;
 * the conversation itself lives in `components/chat`.
 */
export function ChatBody() {
  return <ChatView />;
}
