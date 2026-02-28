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
import { DocsResponse } from "@/lib/api"

interface DocsModalProps {
    isOpen: boolean
    onClose: () => void
    docs: DocsResponse | null
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
                        Automatically generated README and PRD based on project structure and health metrics.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col bg-background/50">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-20 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <div className="text-center space-y-1">
                                <p className="font-medium text-foreground">Analyzing Codebase Logic...</p>
                                <p className="text-sm text-muted-foreground lowercase">Synthesizing architecture & functional units</p>
                            </div>
                        </div>
                    ) : docs ? (
                        <Tabs defaultValue="readme" className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-card">
                                <TabsList className="bg-muted/50 border border-border">
                                    <TabsTrigger value="readme" className="data-[state=active]:bg-background data-[state=active]:text-primary">README.md</TabsTrigger>
                                    <TabsTrigger value="prd" className="data-[state=active]:bg-background data-[state=active]:text-primary">PRD.md</TabsTrigger>
                                </TabsList>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-2 border-border/50 hover:bg-muted"
                                        onClick={() => {
                                            const activeTab = document.querySelector('[data-state="active"][role="tab"]')?.getAttribute('value')
                                            const content = activeTab === 'readme' ? docs.readme : docs.prd
                                            const name = activeTab === 'readme' ? 'README.md' : 'PRD.md'
                                            handleDownload(content, name)
                                        }}
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Download
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden relative">
                                <TabsContent value="readme" className="m-0 h-full overflow-auto p-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                                    <div className="relative group">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="absolute top-0 right-0 h-8 w-8 bg-muted/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleCopy(docs.readme, "README")}
                                        >
                                            {copiedTab === "README" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                        <pre className="whitespace-pre-wrap font-mono text-sm text-foreground/90 leading-relaxed max-w-none prose prose-invert">
                                            {docs.readme}
                                        </pre>
                                    </div>
                                </TabsContent>

                                <TabsContent value="prd" className="m-0 h-full overflow-auto p-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                                    <div className="relative group">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="absolute top-0 right-0 h-8 w-8 bg-muted/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleCopy(docs.prd, "PRD")}
                                        >
                                            {copiedTab === "PRD" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                        <pre className="whitespace-pre-wrap font-mono text-sm text-foreground/90 leading-relaxed">
                                            {docs.prd}
                                        </pre>
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>
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
