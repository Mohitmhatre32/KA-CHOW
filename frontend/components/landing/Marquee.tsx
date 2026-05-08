"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
}

export function Marquee({ children, direction = "left", speed = "normal", className, ...props }: MarqueeProps) {
  return (
    <div
      className={cn("w-full overflow-hidden border-y-4 border-border bg-primary/20 flex whitespace-nowrap", className)}
      {...props}
    >
      <div 
        className={cn(
          "flex items-center space-x-12 px-6 animate-marquee", 
          direction === "right" && "animate-marquee-reverse",
          speed === "fast" && "duration-[10000ms]",
          speed === "normal" && "duration-[20000ms]",
          speed === "slow" && "duration-[40000ms]"
        )}
      >
        {/* Duplicate children to create continuous loop */}
        {children}
        {children}
        {children}
        {children}
      </div>
      <style jsx>{`
        @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-50%); } }
        @keyframes marquee-reverse { 0% { transform: translateX(-50%); } 100% { transform: translateX(0%); } }
        .animate-marquee { animation: marquee 20s linear infinite; }
        .animate-marquee-reverse { animation: marquee-reverse 20s linear infinite; }
      `}</style>
    </div>
  )
}
