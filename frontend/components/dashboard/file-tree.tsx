"use client"

import { useState } from "react"
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react"
import type { FileNode } from "@/lib/demo-data"

function FileTreeItem({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [isOpen, setIsOpen] = useState(depth < 2)

  if (node.type === "file") {
    return (
      <button
        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        <span className="truncate font-mono text-xs">{node.name}</span>
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm text-foreground transition-colors hover:bg-secondary"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <ChevronRight
          className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        />
        {isOpen ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-primary" />
        )}
        <span className="truncate font-mono text-xs font-medium">{node.name}</span>
      </button>
      {isOpen && node.children && (
        <div className="animate-in slide-in-from-top-1 duration-200">
          {node.children.map((child) => (
            <FileTreeItem key={child.name} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({ files }: { files: FileNode[] }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      {files.map((node) => (
        <FileTreeItem key={node.name} node={node} />
      ))}
    </div>
  )
}
