import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Group } from '../../bindings/scriptlauncher/models'
import { EntryIcon, iconDisplayName, isCustomEntryIcon, isEmojiEntryIcon } from '../icons'
import { errorMessage } from '../lib/utils'
import { useLauncherStore } from '../store/launcher'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { IconPickerDialog } from './IconPickerDialog'

export function GroupDialog({
  open,
  onOpenChange,
  group,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  group?: Group | null
}) {
  const createGroup = useLauncherStore((state) => state.createGroup)
  const updateGroup = useLauncherStore((state) => state.updateGroup)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Folder')
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(group?.name ?? '')
      setIcon(group?.icon || 'Folder')
      setError('')
    }
  }, [open, group])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('请输入分组名称')
      return
    }
    setSaving(true)
    setError('')
    try {
      if (group) await updateGroup(group.id, { name, icon })
      else await createGroup({ name, icon })
      onOpenChange(false)
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title={group ? '编辑分组' : '新增分组'} description="使用分组整理同一类脚本和程序。">
          <form onSubmit={submit}>
            <label className="field-label" htmlFor="group-name">分组名称</label>
            <input
              id="group-name"
              className="field-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：开发"
              autoFocus
            />

            <span className="field-label mt-5">分组图标</span>
            <button
              type="button"
              className="flex h-14 w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-left transition hover:border-sky-300 hover:bg-sky-50/50 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-sky-700 dark:hover:bg-sky-500/[.06]"
              onClick={() => setIconPickerOpen(true)}
            >
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                <EntryIcon name={icon} className={isCustomEntryIcon(icon) ? 'size-full' : isEmojiEntryIcon(icon) ? 'size-7 text-2xl' : 'size-5'} />
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{iconDisplayName(icon)}</span>
                <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">点击搜索和选择图标</span>
              </span>
              <ChevronRight className="ml-auto size-4 text-slate-400" />
            </button>

            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
              <Button type="submit" disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <IconPickerDialog open={iconPickerOpen} onOpenChange={setIconPickerOpen} value={icon} onSelect={setIcon} />
    </>
  )
}
