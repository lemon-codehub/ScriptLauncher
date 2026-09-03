import { Code2, Globe2, icons, Terminal, type LucideIcon } from 'lucide-react'

const lucideIconAliases: Record<string, LucideIcon> = { Code2, Globe2 }

export const lucideIconNames = [...Object.keys(icons), ...Object.keys(lucideIconAliases)].sort((left, right) => left.localeCompare(right))

export const featuredIconNames = [
  'Folder', 'Terminal', 'Code2', 'Server', 'Database', 'Container', 'Smartphone',
  'Wrench', 'Rocket', 'Globe2', 'Zap', 'Play', 'FileCode2', 'Box', 'Activity',
  'Archive', 'Bot', 'Braces', 'Bug', 'Cable', 'Cloud', 'Cog', 'Command', 'Cpu',
  'Download', 'File', 'FileArchive', 'FileJson', 'FileText', 'Flame', 'FolderCode',
  'Github', 'HardDrive', 'Image', 'KeyRound', 'Laptop', 'Link', 'Monitor', 'Network',
  'Package', 'RefreshCw', 'Search', 'Settings', 'Shield', 'Star', 'Upload', 'Workflow',
]

export function isCustomEntryIcon(name: string) {
  return name.startsWith('custom:data:image/')
}

export function isEmojiEntryIcon(name: string) {
  return name.startsWith('emoji:') && name.length > 'emoji:'.length
}

export function emojiFromEntryIcon(name: string) {
  return isEmojiEntryIcon(name) ? name.slice('emoji:'.length) : ''
}

export function iconDisplayName(name: string) {
  if (isCustomEntryIcon(name)) return '自定义图片'
  if (isEmojiEntryIcon(name)) return `Emoji ${emojiFromEntryIcon(name)}`
  return name
}

export function EntryIcon({ name, className }: { name: string; className?: string }) {
  if (isCustomEntryIcon(name)) {
    return <img src={name.slice('custom:'.length)} alt="" className={`object-cover ${className ?? ''}`} />
  }
  if (isEmojiEntryIcon(name)) {
    return <span className={`inline-flex items-center justify-center leading-none ${className ?? ''}`} aria-hidden="true">{emojiFromEntryIcon(name)}</span>
  }
  const Icon = lucideIconAliases[name] ?? (icons[name as keyof typeof icons] as LucideIcon | undefined) ?? Terminal
  return <Icon className={className} />
}
