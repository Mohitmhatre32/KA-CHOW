export interface FileNode {
  name: string
  type: "file" | "folder"
  children?: FileNode[]
}

export const fileTree: FileNode[] = [
  {
    name: "src",
    type: "folder",
    children: [
      {
        name: "app",
        type: "folder",
        children: [
          {
            name: "api",
            type: "folder",
            children: [
              { name: "auth", type: "folder", children: [{ name: "route.ts", type: "file" }] },
              { name: "users", type: "folder", children: [{ name: "route.ts", type: "file" }] },
              {
                name: "repos",
                type: "folder",
                children: [
                  { name: "route.ts", type: "file" },
                  { name: "[id]", type: "folder", children: [{ name: "route.ts", type: "file" }] },
                ],
              },
            ],
          },
          { name: "layout.tsx", type: "file" },
          { name: "page.tsx", type: "file" },
          {
            name: "dashboard",
            type: "folder",
            children: [
              { name: "page.tsx", type: "file" },
              { name: "loading.tsx", type: "file" },
            ],
          },
          {
            name: "settings",
            type: "folder",
            children: [{ name: "page.tsx", type: "file" }, { name: "layout.tsx", type: "file" }],
          },
        ],
      },
      {
        name: "components",
        type: "folder",
        children: [
          {
            name: "ui",
            type: "folder",
            children: [
              { name: "button.tsx", type: "file" },
              { name: "card.tsx", type: "file" },
              { name: "dialog.tsx", type: "file" },
              { name: "input.tsx", type: "file" },
              { name: "tooltip.tsx", type: "file" },
            ],
          },
          { name: "header.tsx", type: "file" },
          { name: "sidebar.tsx", type: "file" },
          { name: "graph-view.tsx", type: "file" },
          { name: "chat-panel.tsx", type: "file" },
        ],
      },
      {
        name: "lib",
        type: "folder",
        children: [
          { name: "utils.ts", type: "file" },
          { name: "auth.ts", type: "file" },
          { name: "db.ts", type: "file" },
          { name: "graph-engine.ts", type: "file" },
        ],
      },
      {
        name: "hooks",
        type: "folder",
        children: [
          { name: "use-auth.ts", type: "file" },
          { name: "use-graph.ts", type: "file" },
          { name: "use-debounce.ts", type: "file" },
        ],
      },
      {
        name: "types",
        type: "folder",
        children: [{ name: "index.ts", type: "file" }, { name: "api.ts", type: "file" }],
      },
    ],
  },
  { name: "package.json", type: "file" },
  { name: "tsconfig.json", type: "file" },
  { name: "next.config.mjs", type: "file" },
  { name: ".env.local", type: "file" },
  { name: "README.md", type: "file" },
]

export interface GraphNode {
  id: string
  label: string
  x: number
  y: number
  type: "module" | "component" | "utility" | "api" | "hook" | "file" | "folder"
  connections: string[]
  sonar_health?: Record<string, any>
  path?: string
  layer?: string
}

export const graphNodes: GraphNode[] = [
  { id: "app", label: "App Layout", x: 400, y: 80, type: "module", connections: ["dashboard", "settings", "header"] },
  { id: "dashboard", label: "Dashboard", x: 250, y: 200, type: "module", connections: ["graph-view", "chat-panel", "use-graph"] },
  { id: "settings", label: "Settings", x: 550, y: 200, type: "module", connections: ["use-auth", "card"] },
  { id: "header", label: "Header", x: 400, y: 200, type: "component", connections: ["button", "use-auth"] },
  { id: "graph-view", label: "GraphView", x: 100, y: 340, type: "component", connections: ["graph-engine", "tooltip"] },
  { id: "chat-panel", label: "ChatPanel", x: 300, y: 340, type: "component", connections: ["utils", "input"] },
  { id: "sidebar", label: "Sidebar", x: 500, y: 340, type: "component", connections: ["button", "use-auth"] },
  { id: "graph-engine", label: "graph-engine", x: 50, y: 480, type: "utility", connections: ["utils"] },
  { id: "utils", label: "utils", x: 200, y: 480, type: "utility", connections: [] },
  { id: "auth", label: "auth", x: 350, y: 480, type: "utility", connections: ["db"] },
  { id: "db", label: "db", x: 500, y: 480, type: "utility", connections: [] },
  { id: "use-auth", label: "useAuth", x: 650, y: 340, type: "hook", connections: ["auth"] },
  { id: "use-graph", label: "useGraph", x: 150, y: 420, type: "hook", connections: ["graph-engine"] },
  { id: "api-auth", label: "API /auth", x: 700, y: 200, type: "api", connections: ["auth", "db"] },
  { id: "api-repos", label: "API /repos", x: 750, y: 340, type: "api", connections: ["db", "utils"] },
  { id: "button", label: "Button", x: 550, y: 480, type: "component", connections: [] },
  { id: "card", label: "Card", x: 650, y: 480, type: "component", connections: [] },
  { id: "input", label: "Input", x: 300, y: 480, type: "component", connections: [] },
  { id: "tooltip", label: "Tooltip", x: 100, y: 540, type: "component", connections: [] },
]

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export const chatMessages: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    content: "What are the main entry points in this repository?",
    timestamp: "10:32 AM",
  },
  {
    id: "2",
    role: "assistant",
    content: `The repository has several key entry points:\n\n1. **\`src/app/page.tsx\`** - The main landing page component\n2. **\`src/app/layout.tsx\`** - Root layout that wraps all pages\n3. **\`src/app/api/\`** - API routes directory with three endpoints:\n   - \`/api/auth\` - Authentication handlers\n   - \`/api/users\` - User management\n   - \`/api/repos\` - Repository operations\n\nThe app uses Next.js App Router with a clear separation between client and server components.`,
    timestamp: "10:32 AM",
  },
  {
    id: "3",
    role: "user",
    content: "Show me how the useAuth hook works",
    timestamp: "10:34 AM",
  },
  {
    id: "4",
    role: "assistant",
    content: `Here's the \`useAuth\` hook implementation:\n\n\`\`\`typescript\nimport { useState, useEffect } from 'react'\nimport { getSession, signIn, signOut } from '@/lib/auth'\n\nexport function useAuth() {\n  const [user, setUser] = useState(null)\n  const [loading, setLoading] = useState(true)\n\n  useEffect(() => {\n    getSession().then((session) => {\n      setUser(session?.user ?? null)\n      setLoading(false)\n    })\n  }, [])\n\n  return { user, loading, signIn, signOut }\n}\n\`\`\`\n\nThe hook manages authentication state by:\n- Fetching the current session on mount\n- Exposing \`user\` state and \`loading\` status\n- Providing \`signIn\` and \`signOut\` functions from the auth library`,
    timestamp: "10:34 AM",
  },
  {
    id: "5",
    role: "user",
    content: "Are there any circular dependencies?",
    timestamp: "10:36 AM",
  },
  {
    id: "6",
    role: "assistant",
    content: `I analyzed the dependency graph and found **no circular dependencies** in this repository. The dependency flow is clean and unidirectional:\n\n- **Pages** depend on **Components** and **Hooks**\n- **Components** depend on **UI primitives** and **Utilities**\n- **Hooks** depend on **Lib modules**\n- **API routes** depend on **Lib modules**\n\nThe architecture follows a clear layered pattern which prevents circular imports. The \`graph-engine.ts\` utility depends on \`utils.ts\` but not vice versa.`,
    timestamp: "10:36 AM",
  },
]

export interface HealthMetric {
  label: string
  value: string
  status: "healthy" | "warning" | "critical"
  detail: string
}

export const healthMetrics: HealthMetric[] = [
  { label: "CPU Usage", value: "65%", status: "healthy", detail: "Normal load" },
  { label: "Memory", value: "8GB / 16GB", status: "warning", detail: "High allocation" },
  { label: "Dependencies", value: "42 packages", status: "healthy", detail: "All up to date" },
  { label: "Build Status", value: "Passing", status: "healthy", detail: "Last: 2m ago" },
  { label: "Type Errors", value: "0", status: "healthy", detail: "Clean build" },
  { label: "Lint Warnings", value: "3", status: "warning", detail: "Non-critical" },
  { label: "Bundle Size", value: "142 KB", status: "healthy", detail: "Gzipped" },
  { label: "API Latency", value: "45ms", status: "healthy", detail: "p95 response" },
]

export const errorLogs = [
  { time: "2 min ago", message: "Warning: Unused variable 'tempData' in graph-engine.ts:42", level: "warning" as const },
  { time: "15 min ago", message: "ESLint: Prefer const over let in use-debounce.ts:8", level: "warning" as const },
  { time: "1 hr ago", message: "Build completed successfully", level: "info" as const },
  { time: "2 hr ago", message: "Dependency update: next@14.1.0 -> 14.2.0", level: "info" as const },
  { time: "3 hr ago", message: "Warning: Missing alt attribute on <img> in header.tsx", level: "warning" as const },
]

export interface Conversation {
  id: string
  title: string
  lastMessage: string
  timestamp: string
}

export const conversations: Conversation[] = [
  { id: "conv-1", title: "Repository Architecture Overview", lastMessage: "The architecture follows a clear layered pattern...", timestamp: "Today" },
  { id: "conv-2", title: "Authentication Flow Analysis", lastMessage: "The useAuth hook manages session state...", timestamp: "Today" },
  { id: "conv-3", title: "Performance Optimization Tips", lastMessage: "Consider implementing dynamic imports for...", timestamp: "Yesterday" },
  { id: "conv-4", title: "API Routes Best Practices", lastMessage: "Your route handlers should validate input...", timestamp: "Yesterday" },
  { id: "conv-5", title: "Component Refactoring Ideas", lastMessage: "The sidebar component could benefit from...", timestamp: "2 days ago" },
  { id: "conv-6", title: "Database Schema Review", lastMessage: "The current schema is well-normalized but...", timestamp: "3 days ago" },
  { id: "conv-7", title: "Testing Strategy Discussion", lastMessage: "I recommend adding integration tests for...", timestamp: "Last week" },
]

export const fullChatMessages: ChatMessage[] = [
  {
    id: "f1",
    role: "user",
    content: "Give me a comprehensive overview of this repository's architecture",
    timestamp: "9:15 AM",
  },
  {
    id: "f2",
    role: "assistant",
    content: `## Repository Architecture Overview\n\nThis is a **Next.js 14** application using the App Router pattern. Here's a breakdown:\n\n### Directory Structure\n- \`src/app/\` - Pages and API routes using file-based routing\n- \`src/components/\` - Reusable React components (UI primitives + feature components)\n- \`src/lib/\` - Core utilities, auth, database, and business logic\n- \`src/hooks/\` - Custom React hooks for state management\n- \`src/types/\` - TypeScript type definitions\n\n### Key Architectural Decisions\n1. **Server/Client Component Split** - Pages are Server Components by default, interactive widgets are Client Components\n2. **Layered Dependencies** - Clean dependency flow prevents circular imports\n3. **API Route Handlers** - RESTful patterns with proper error handling\n\n### Tech Stack\n- **Framework:** Next.js 14 (App Router)\n- **Language:** TypeScript\n- **Styling:** Tailwind CSS\n- **Database:** PostgreSQL via Prisma\n- **Auth:** Custom JWT-based authentication`,
    timestamp: "9:15 AM",
  },
  {
    id: "f3",
    role: "user",
    content: "How is error handling implemented across the API routes?",
    timestamp: "9:18 AM",
  },
  {
    id: "f4",
    role: "assistant",
    content: `The API routes follow a consistent error handling pattern:\n\n\`\`\`typescript\n// src/app/api/repos/route.ts\nimport { NextResponse } from 'next/server'\nimport { z } from 'zod'\n\nconst repoSchema = z.object({\n  url: z.string().url(),\n  name: z.string().min(1),\n})\n\nexport async function POST(request: Request) {\n  try {\n    const body = await request.json()\n    const validated = repoSchema.parse(body)\n    \n    const repo = await db.repo.create({\n      data: validated\n    })\n    \n    return NextResponse.json(repo, { status: 201 })\n  } catch (error) {\n    if (error instanceof z.ZodError) {\n      return NextResponse.json(\n        { error: 'Validation failed', details: error.errors },\n        { status: 400 }\n      )\n    }\n    return NextResponse.json(\n      { error: 'Internal server error' },\n      { status: 500 }\n    )\n  }\n}\n\`\`\`\n\n### Pattern Summary\n- **Input Validation:** Zod schemas for request body validation\n- **Typed Errors:** Different responses for validation vs. server errors\n- **Consistent Format:** All errors return \`{ error: string, details?: any }\`\n- **Status Codes:** Proper HTTP status codes (400, 401, 404, 500)`,
    timestamp: "9:18 AM",
  },
  {
    id: "f5",
    role: "user",
    content: "What improvements would you suggest for the current codebase?",
    timestamp: "9:22 AM",
  },
  {
    id: "f6",
    role: "assistant",
    content: `Here are my top recommendations for improving this codebase:\n\n### 1. Add Middleware for Auth\nCurrently, auth checks are duplicated in each API route. Extract into middleware:\n\n\`\`\`typescript\n// middleware.ts\nexport function middleware(request: NextRequest) {\n  const token = request.headers.get('authorization')\n  if (!token && request.nextUrl.pathname.startsWith('/api/')) {\n    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })\n  }\n}\n\`\`\`\n\n### 2. Implement Error Boundary\nAdd a global error boundary for better UX during failures.\n\n### 3. Add Rate Limiting\nThe API routes currently have no rate limiting. Consider using \`@upstash/ratelimit\`.\n\n### 4. Optimize Bundle\n- Use \`next/dynamic\` for the graph visualization component\n- Implement route-based code splitting\n- Lazy load heavy dependencies\n\n### 5. Testing Coverage\n- Add unit tests for utility functions\n- Integration tests for API routes\n- E2E tests for critical user flows\n\nPriority: **Middleware > Error Boundary > Rate Limiting > Bundle > Tests**`,
    timestamp: "9:22 AM",
  },
]
