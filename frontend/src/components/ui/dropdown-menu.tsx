import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../../lib/utils'

export const DropdownMenu = DropdownPrimitive.Root
export const DropdownMenuTrigger = DropdownPrimitive.Trigger

export function DropdownMenuContent({
  className,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        sideOffset={6}
        align="end"
        className={cn(
          'z-50 min-w-40 rounded-xl border border-slate-200/80 bg-white p-1.5 text-sm text-slate-800 shadow-xl outline-none data-[state=open]:animate-menu-in dark:border-slate-700 dark:bg-[#182235] dark:text-slate-200',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  className,
  danger,
  children,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Item> & { danger?: boolean; children: ReactNode }) {
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex h-9 cursor-default select-none items-center gap-2 rounded-lg px-2.5 outline-none data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-700/80',
        danger && 'text-red-600 data-[highlighted]:bg-red-50 dark:text-red-400 dark:data-[highlighted]:bg-red-500/10',
        className,
      )}
      {...props}
    >
      {children}
    </DropdownPrimitive.Item>
  )
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <DropdownPrimitive.Label className="px-2.5 py-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">{children}</DropdownPrimitive.Label>
}

export function DropdownMenuSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-slate-100 dark:bg-slate-700" />
}
