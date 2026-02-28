"use client"

import { MessageSquare, Plus } from "lucide-react"
import { conversations, type Conversation } from "@/lib/demo-data"

export function ChatSidebar({
  activeConversationId,
  onSelectConversation,
  onNewChat,
}: {
  activeConversationId: string
  onSelectConversation: (id: string) => void
  onNewChat: () => void
}) {
  // Group conversations by timestamp
  const groups: Record<string, Conversation[]> = {}
  conversations.forEach((conv) => {
    if (!groups[conv.timestamp]) groups[conv.timestamp] = []
    groups[conv.timestamp].push(conv)
  })

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">Conversations</span>
        <button
          onClick={onNewChat}
          className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-3 w-3" />
          New Chat
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(groups).map(([timestamp, convs]) => (
          <div key={timestamp} className="mb-3">
            <div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {timestamp}
            </div>
            {convs.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors ${
                  activeConversationId === conv.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate text-sm font-medium">{conv.title}</span>
                </div>
                <span className="truncate pl-5 text-xs text-muted-foreground">{conv.lastMessage}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
