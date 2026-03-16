"use client"

import React, { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Copy, Download, FileText, Check, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { DocumentationResponse } from "@/lib/api"

interface DocsModalProps {
    isOpen: boolean
    onClose: () => void
    docs: DocumentationResponse | null
    isLoading: boolean
    projectName: string
}

export function DocsModal({
    isOpen,
    onClose,
    docs,
    isLoading,
    projectName
}: DocsModalProps) {
    const [copiedTab, setCopiedTab] = useState<string | null>(null)

    const handleCopy = (text: string, tab: string) => {
        navigator.clipboard.writeText(text)
        setCopiedTab(tab)
        toast.success(`${tab} copied to clipboard`)
        setTimeout(() => setCopiedTab(null), 2000)
    }

    const handleDownload = (text: string, filename: string) => {
        const blob = new Blob([text], { type: "text/markdown" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success(`${filename} download started`)
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border-border">
                <DialogHeader className="p-6 pb-2 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                        <DialogTitle className="text-xl font-bold tracking-tight">AI Documentation Generator</DialogTitle>
                    </div>
                    <DialogDescription className="text-muted-foreground">
                        Comprehensive, industry-level project guide including architecture, tech stack, and installation instructions.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col bg-background/50">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <div className="text-center space-y-1">
                                <p className="font-medium text-foreground">Generating Industry Guide...</p>
                                <p className="text-sm text-muted-foreground lowercase">Analyzing dependencies and tech stack</p>
                            </div>
                        </div>
                    ) : docs ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-card">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-muted-foreground">PROJECT_GUIDE.md</span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-2 border-border/50 hover:bg-muted"
                                        onClick={() => handleDownload(docs.markdown, "PROJECT_GUIDE.md")}
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Download
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-2 border-border/50 hover:bg-muted"
                                        onClick={() => handleCopy(docs.markdown, "GUIDE")}
                                    >
                                        {copiedTab === "GUIDE" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                                        Copy
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                                <pre className="whitespace-pre-wrap font-mono text-sm text-foreground/90 leading-relaxed max-w-none prose prose-invert">
                                    {docs.markdown}
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-20 gap-4 text-muted-foreground font-medium">
                            No documentation available. Click the generate button to start.
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border bg-muted/10 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        Close
                    </Button>
                    {!docs && !isLoading && (
                        <Button className="bg-primary text-primary-foreground font-semibold">
                            Generate Now
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
