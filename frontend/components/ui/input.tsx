import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-border h-10 w-full min-w-0 rounded-none border-2 bg-transparent px-3 py-1 text-base shadow-[var(--shadow-brutal-sm)] transition-[color,box-shadow,transform] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-0 focus-visible:shadow-[var(--shadow-brutal-primary)] focus-visible:-translate-y-[2px] focus-visible:-translate-x-[2px]',
        'aria-invalid:border-destructive aria-invalid:shadow-[var(--shadow-brutal-secondary)]',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
