import { Check, ChevronUp, Monitor, Moon, Sun } from 'lucide-react'
import { useThemeStore, type ThemePreference } from '../store/theme'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'

const options: Array<{
  value: ThemePreference
  label: string
  icon: typeof Monitor
}> = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '浅色模式', icon: Sun },
  { value: 'dark', label: '深色模式', icon: Moon },
]

export function ThemeToggle() {
  const preference = useThemeStore((state) => state.preference)
  const setPreference = useThemeStore((state) => state.setPreference)
  const selected = options.find((option) => option.value === preference) ?? options[0]
  const SelectedIcon = selected.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm text-slate-600 transition hover:bg-white/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[.06] dark:hover:text-white"
          aria-label={`外观：${selected.label}`}
        >
          <SelectedIcon className="size-4" />
          <span>外观</span>
          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{selected.label}</span>
          <ChevronUp className="size-3.5 text-slate-400 dark:text-slate-600" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-[218px]">
        {options.map((option) => {
          const Icon = option.icon
          const active = option.value === preference
          return (
            <DropdownMenuItem key={option.value} onSelect={() => setPreference(option.value)}>
              <Icon className="size-4" />
              <span>{option.label}</span>
              {active && <Check className="ml-auto size-4 text-sky-600 dark:text-sky-400" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
