"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { GitBranch, Minimize2, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { conversations, fullChatMessages } from "@/lib/demo-data"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { ChatMessages } from "@/components/chat/chat-messages"

export default function FullChatPage() {
  const router = useRouter()
  const [activeConversation, setActiveConversation] = useState(conversations[0].id)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className={`flex h-screen flex-col bg-background transition-opacity duration-700 ${mounted ? "opacity-100" : "opacity-0"}`}>
      {/* Top Bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card">
            <GitBranch className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-mono text-sm font-medium text-foreground">DevInsight AI</span>
          <span className="hidden rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
            Chat
          </span>

          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Minimize2 className="h-4 w-4" />
          <span className="hidden sm:inline">Back to Dashboard</span>
        </button>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Sidebar */}
        {sidebarOpen && (
          <div className="w-72 shrink-0 border-r border-border animate-in slide-in-from-left-4 duration-300">
            <ChatSidebar
              activeConversationId={activeConversation}
              onSelectConversation={setActiveConversation}
              onNewChat={() => setActiveConversation("new")}
            />
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1">
          <ChatMessages messages={fullChatMessages} />
        </div>
      </div>
    </div>
  )
}
