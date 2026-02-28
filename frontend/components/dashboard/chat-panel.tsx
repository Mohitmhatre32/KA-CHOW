"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Send, Maximize2, X, Bot, User } from "lucide-react"
import { chatMessages, type ChatMessage } from "@/lib/demo-data"

function formatContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const codeContent = part.replace(/```\w*\n?/, "").replace(/```$/, "")
      return (
        <pre key={i} className="my-2 overflow-x-auto rounded-md border border-border bg-background p-3 text-xs font-mono leading-relaxed">
          <code>{codeContent}</code>
        </pre>
      )
    }
    // Parse bold text and inline code
    const formatted = part.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((seg, j) => {
      if (seg.startsWith("**") && seg.endsWith("**")) {
        return <strong key={j} className="font-semibold text-foreground">{seg.slice(2, -2)}</strong>
      }
      if (seg.startsWith("`") && seg.endsWith("`")) {
        return <code key={j} className="rounded bg-secondary px-1 py-0.5 font-mono text-xs text-primary">{seg.slice(1, -1)}</code>
      }
      return seg
    })
    return <span key={i}>{formatted}</span>
  })
}

export function ChatPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>(chatMessages)
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }
    setMessages((prev) => [...prev, newMsg])
    setInput("")

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I'm analyzing that for you. Based on the repository structure, I can see that this follows a well-organized pattern with clear separation of concerns between the data layer, business logic, and presentation components.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ])
    }, 1200)
  }

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">AI Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push("/chat/full")}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Maximize"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-secondary">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                <div className="whitespace-pre-wrap">{formatContent(msg.content)}</div>
                <div className={`mt-1 text-[10px] ${msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {msg.timestamp}
                </div>
              </div>
              {msg.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-accent">
                  <User className="h-3.5 w-3.5 text-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask about the codebase..."
            className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
