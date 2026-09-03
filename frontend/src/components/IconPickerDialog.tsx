import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react'
import zhEmojiData from 'emoji-picker-react/dist/data/emojis-zh'
import { ImagePlus, Search, Shapes, Smile, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import * as LauncherService from '../../bindings/scriptlauncher/launcherservice'
import { EntryIcon, featuredIconNames, isCustomEntryIcon, isEmojiEntryIcon, lucideIconNames } from '../icons'
import { cn, errorMessage } from '../lib/utils'
import { useThemeStore } from '../store/theme'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'

const maxVisibleIcons = 240

export function IconPickerDialog({
  open,
  onOpenChange,
  value,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onSelect: (value: string) => void
}) {
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'lucide' | 'emoji'>('lucide')
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme)
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const matchingIcons = useMemo(() => {
    if (!normalizedSearch) return featuredIconNames
    return lucideIconNames.filter((name) => name.toLocaleLowerCase().includes(normalizedSearch))
  }, [normalizedSearch])
  const visibleIcons = matchingIcons.slice(0, maxVisibleIcons)

  useEffect(() => {
    if (open) {
      setSearch('')
      setError('')
      setMode(isEmojiEntryIcon(value) ? 'emoji' : 'lucide')
    }
  }, [open, value])

  const choose = (icon: string) => {
    onSelect(icon)
    onOpenChange(false)
  }

  const pickCustomIcon = async () => {
    setError('')
    try {
      const icon = await LauncherService.SelectIconImage()
      if (icon) choose(icon)
    } catch (pickError) {
      setError(errorMessage(pickError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl overflow-hidden"
        title="选择图标"
        description="选择 Lucide 图标、Emoji，或者使用本地图片作为图标。"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              className={cn('flex h-9 items-center gap-2 rounded-lg px-4 text-sm transition', mode === 'lucide' ? 'bg-white font-medium text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200')}
              onClick={() => setMode('lucide')}
            >
              <Shapes className="size-4" />Lucide
            </button>
            <button
              type="button"
              className={cn('flex h-9 items-center gap-2 rounded-lg px-4 text-sm transition', mode === 'emoji' ? 'bg-white font-medium text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200')}
              onClick={() => setMode('emoji')}
            >
              <Smile className="size-4" />Emoji
            </button>
          </div>
          <Button type="button" variant="secondary" onClick={pickCustomIcon}>
            <ImagePlus className="size-4" />自定义图片
          </Button>
        </div>

        {mode === 'lucide' ? (
          <>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                className="field-input field-input-with-icon pr-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索图标名称，例如 Terminal、Folder"
                autoFocus
              />
              {search && (
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" onClick={() => setSearch('')}>
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
              <span>{normalizedSearch ? `找到 ${matchingIcons.length} 个图标` : `常用图标 · 共 ${lucideIconNames.length} 个可搜索`}</span>
              {matchingIcons.length > maxVisibleIcons && <span>当前显示前 {maxVisibleIcons} 个，请继续输入关键词缩小范围</span>}
            </div>
            <div className="mt-2 max-h-[44vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-2 dark:border-slate-700 dark:bg-slate-900/30">
              {visibleIcons.length > 0 ? (
                <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                  {visibleIcons.map((name) => (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      className={cn(
                        'flex h-[66px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg border text-slate-500 transition hover:border-sky-300 hover:bg-white hover:text-sky-600 dark:text-slate-400 dark:hover:border-sky-700 dark:hover:bg-slate-800 dark:hover:text-sky-400',
                        value === name
                          ? 'border-sky-500 bg-sky-50 text-sky-600 ring-1 ring-sky-500 dark:bg-sky-500/10 dark:text-sky-400'
                          : 'border-transparent',
                      )}
                      onClick={() => choose(name)}
                    >
                      <EntryIcon name={name} className="size-5 shrink-0" />
                      <span className="w-full truncate px-1 text-center text-[9px]">{name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid h-40 place-items-center text-sm text-slate-400 dark:text-slate-500">没有匹配的图标</div>
              )}
            </div>
          </>
        ) : (
          <div className="emoji-picker-shell mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <EmojiPicker
              emojiData={zhEmojiData}
              emojiStyle={EmojiStyle.NATIVE}
              theme={resolvedTheme === 'dark' ? Theme.DARK : Theme.LIGHT}
              width="100%"
              height={430}
              lazyLoadEmojis
              autoFocusSearch
              searchPlaceHolder="搜索 Emoji，例如：火箭、工具、动物"
              searchClearButtonLabel="清除搜索"
              previewConfig={{ showPreview: false }}
              onEmojiClick={(emojiData) => choose(`emoji:${emojiData.emoji}`)}
            />
          </div>
        )}

        {isCustomEntryIcon(value) && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <EntryIcon name={value} className="size-7 rounded-lg" />当前正在使用自定义图片
          </div>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
