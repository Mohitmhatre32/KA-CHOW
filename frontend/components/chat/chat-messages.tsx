"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User } from "lucide-react"
import type { ChatMessage } from "@/lib/demo-data"

function formatContent(content: string) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return parts.map((part, i) => {
    if (part.startsWith("```")) {
      const codeContent = part.replace(/```\w*\n?/, "").replace(/```$/, "")
      return (
        <pre key={i} className="my-3 overflow-x-auto rounded-lg border border-border bg-background p-4 text-xs font-mono leading-relaxed">
          <code>{codeContent}</code>
        </pre>
      )
    }
    // Parse markdown-like formatting
    const lines = part.split("\n")
    return (
      <span key={i}>
        {lines.map((line, li) => {
          // Headers
          if (line.startsWith("## ")) {
            return (
              <h3 key={li} className="mb-2 mt-3 text-base font-semibold text-foreground">
                {line.slice(3)}
              </h3>
            )
          }
          if (line.startsWith("### ")) {
            return (
              <h4 key={li} className="mb-1 mt-2 text-sm font-semibold text-foreground">
                {line.slice(4)}
              </h4>
            )
          }
          // List items
          if (line.match(/^\d+\.\s/)) {
            const text = line.replace(/^\d+\.\s/, "")
            return (
              <div key={li} className="ml-4 flex gap-2">
                <span className="text-muted-foreground">{line.match(/^\d+/)?.[0]}.</span>
                <span>{renderInline(text)}</span>
              </div>
            )
          }
          if (line.startsWith("- ")) {
            return (
              <div key={li} className="ml-4 flex gap-2">
                <span className="text-muted-foreground">-</span>
                <span>{renderInline(line.slice(2))}</span>
              </div>
            )
          }
          if (line === "") return <br key={li} />
          return <p key={li}>{renderInline(line)}</p>
        })}
      </span>
    )
  })
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((seg, j) => {
    if (seg.startsWith("**") && seg.endsWith("**")) {
      return <strong key={j} className="font-semibold text-foreground">{seg.slice(2, -2)}</strong>
    }
    if (seg.startsWith("`") && seg.endsWith("`")) {
      return <code key={j} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-primary">{seg.slice(1, -1)}</code>
    }
    return seg
  })
}

export function ChatMessages({ messages: initialMessages }: { messages: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, isTyping])

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
    setIsTyping(true)

    // Simulate AI response
    setTimeout(() => {
      setIsTyping(false)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "That's a great question. Based on my analysis of the repository structure, I can provide you with a detailed breakdown.\n\nThe codebase follows a **modular architecture** with clear separation between the data access layer, business logic, and presentation components. This pattern enables better testability and maintainability.\n\nWould you like me to dive deeper into any specific area?",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ])
    }, 1500)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <div className="flex flex-col gap-6">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-4">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border ${
                  msg.role === "assistant" ? "bg-secondary" : "bg-accent"
                }`}>
                  {msg.role === "assistant" ? (
                    <Bot className="h-4 w-4 text-primary" />
                  ) : (
                    <User className="h-4 w-4 text-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {msg.role === "assistant" ? "DevInsight AI" : "You"}
                    </span>
                    <span className="text-xs text-muted-foreground">{msg.timestamp}</span>
                  </div>
                  <div className="text-sm leading-relaxed text-secondary-foreground">
                    {formatContent(msg.content)}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-1 pt-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card p-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask about the codebase..."
            className="flex-1 rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
