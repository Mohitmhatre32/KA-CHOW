import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-border placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:shadow-[var(--shadow-brutal-secondary)] dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-none border-2 bg-transparent px-3 py-2 text-base shadow-[var(--shadow-brutal-sm)] transition-[color,box-shadow,transform] outline-none focus-visible:border-ring focus-visible:ring-0 focus-visible:shadow-[var(--shadow-brutal-primary)] focus-visible:-translate-y-[2px] focus-visible:-translate-x-[2px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
