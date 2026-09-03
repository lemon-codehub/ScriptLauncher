import { ChevronRight, FolderOpen, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import * as LauncherService from '../../bindings/scriptlauncher/launcherservice'
import type { Entry, EntryInput } from '../../bindings/scriptlauncher/models'
import { EntryIcon, iconDisplayName, isCustomEntryIcon, isEmojiEntryIcon } from '../icons'
import { errorMessage } from '../lib/utils'
import { useLauncherStore } from '../store/launcher'
import { IconPickerDialog } from './IconPickerDialog'
import { Button } from './ui/button'
import { Dialog, DialogContent } from './ui/dialog'
import { Switch } from './ui/switch'

const emptyForm: EntryInput = {
  groupId: 0,
  name: '',
  icon: 'Terminal',
  scriptPath: '',
  workingDirectory: '',
  arguments: '',
  showTerminal: false,
}

export function EntryDialog({
  open,
  onOpenChange,
  entry,
  defaultGroupID,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry?: Entry | null
  defaultGroupID?: number
}) {
  const groups = useLauncherStore((state) => state.groups)
  const createEntry = useLauncherStore((state) => state.createEntry)
  const updateEntry = useLauncherStore((state) => state.updateEntry)
  const [form, setForm] = useState<EntryInput>(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    if (entry) {
      setForm({
        groupId: entry.groupId,
        name: entry.name,
        icon: entry.icon,
        scriptPath: entry.scriptPath,
        workingDirectory: entry.workingDirectory,
        arguments: entry.arguments,
        showTerminal: entry.showTerminal,
      })
    } else {
      setForm({ ...emptyForm, groupId: defaultGroupID || groups[0]?.id || 0 })
    }
    setError('')
  }, [open, entry, defaultGroupID, groups])

  const update = <K extends keyof EntryInput>(key: K, value: EntryInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const pickScript = async () => {
    try {
      const path = await LauncherService.SelectScript()
      if (path) update('scriptPath', path)
    } catch (pickError) {
      setError(errorMessage(pickError))
    }
  }

  const pickDirectory = async () => {
    try {
      const path = await LauncherService.SelectDirectory()
      if (path) update('workingDirectory', path)
    } catch (pickError) {
      setError(errorMessage(pickError))
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) return setError('请输入入口名称')
    if (!form.scriptPath.trim()) return setError('请选择脚本或填写命令')
    if (!form.groupId) return setError('请选择所属分组')
    setSaving(true)
    setError('')
    try {
      if (entry) await updateEntry(entry.id, form)
      else await createEntry(form)
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
      <DialogContent
        className="max-w-2xl"
        title={entry ? '编辑入口' : '新增入口'}
        description="选择脚本、程序或填写 PATH 中可用的命令。"
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-[1fr_180px] gap-4">
            <div>
              <label className="field-label" htmlFor="entry-name">名称</label>
              <input id="entry-name" className="field-input" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="例如：启动后端" autoFocus />
            </div>
            <div>
              <label className="field-label" htmlFor="entry-group">所属分组</label>
              <select id="entry-group" className="field-input" value={form.groupId} onChange={(event) => update('groupId', Number(event.target.value))}>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <span className="field-label">图标</span>
            <button
              type="button"
              className="flex h-14 w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-left transition hover:border-sky-300 hover:bg-sky-50/50 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-sky-700 dark:hover:bg-sky-500/[.06]"
              onClick={() => setIconPickerOpen(true)}
            >
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-white text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                <EntryIcon name={form.icon} className={isCustomEntryIcon(form.icon) ? 'size-full' : isEmojiEntryIcon(form.icon) ? 'size-7 text-2xl' : 'size-5'} />
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">{iconDisplayName(form.icon)}</span>
                <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">点击搜索和选择图标</span>
              </span>
              <ChevronRight className="ml-auto size-4 text-slate-400" />
            </button>
          </div>

          <div>
            <label className="field-label" htmlFor="script-path">脚本路径或命令</label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input id="script-path" className="field-input field-input-with-icon font-mono text-xs" value={form.scriptPath} onChange={(event) => update('scriptPath', event.target.value)} placeholder="/path/to/script.sh 或 docker" />
              </div>
              <Button type="button" variant="secondary" onClick={pickScript}><FolderOpen className="size-4" />选择</Button>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="working-directory">工作目录 <span className="font-normal text-slate-400 dark:text-slate-500">（可选）</span></label>
            <div className="flex gap-2">
              <input id="working-directory" className="field-input min-w-0 flex-1 font-mono text-xs" value={form.workingDirectory} onChange={(event) => update('workingDirectory', event.target.value)} placeholder="默认使用脚本所在目录" />
              <Button type="button" variant="secondary" onClick={pickDirectory}><FolderOpen className="size-4" />选择</Button>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="arguments">启动参数 <span className="font-normal text-slate-400 dark:text-slate-500">（可选）</span></label>
            <input id="arguments" className="field-input font-mono text-xs" value={form.arguments} onChange={(event) => update('arguments', event.target.value)} placeholder='例如：--port 3000 --name "本地服务"' />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">在终端中显示</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">开启后会调用系统终端并保留脚本输出。</p>
            </div>
            <Switch checked={form.showTerminal} onCheckedChange={(checked) => update('showTerminal', checked)} />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
            <Button type="submit" disabled={saving}>{saving ? '保存中…' : '保存入口'}</Button>
          </div>
        </form>
        </DialogContent>
      </Dialog>
      <IconPickerDialog open={iconPickerOpen} onOpenChange={setIconPickerOpen} value={form.icon} onSelect={(icon) => update('icon', icon)} />
    </>
  )
}
