import { AlertCircle, ArrowDownWideNarrow, CheckCircle2, Command, LoaderCircle, Plus, Search, TerminalSquare, X } from 'lucide-react'
import { Events } from '@wailsio/runtime'
import { useEffect, useMemo, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import type { Entry, ExecutionEvent, Group } from '../bindings/scriptlauncher/models'
import { ConfirmDialog } from './components/ConfirmDialog'
import { EntryDialog } from './components/EntryDialog'
import { EntryGrid } from './components/EntryGrid'
import { ExecutionLogPanel } from './components/ExecutionLogPanel'
import { GroupDialog } from './components/GroupDialog'
import { Sidebar } from './components/Sidebar'
import { Button } from './components/ui/button'
import { cn } from './lib/utils'
import { useLauncherStore } from './store/launcher'
import { watchSystemTheme } from './store/theme'

function LauncherPage() {
  const groups = useLauncherStore((state) => state.groups)
  const entries = useLauncherStore((state) => state.entries)
  const loading = useLauncherStore((state) => state.loading)
  const loadError = useLauncherStore((state) => state.loadError)
  const load = useLauncherStore((state) => state.load)
  const deleteGroup = useLauncherStore((state) => state.deleteGroup)
  const deleteEntry = useLauncherStore((state) => state.deleteEntry)
  const handleExecutionEvent = useLauncherStore((state) => state.handleExecutionEvent)
  const notice = useLauncherStore((state) => state.notice)
  const clearNotice = useLauncherStore((state) => state.clearNotice)

  const [selectedGroupID, setSelectedGroupID] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [allEntrySort, setAllEntrySort] = useState<'default' | 'frequency'>(() => {
    return window.localStorage.getItem('script-launcher-all-entry-sort') === 'frequency' ? 'frequency' : 'default'
  })
  const [groupDialog, setGroupDialog] = useState<{ open: boolean; group?: Group | null }>({ open: false })
  const [entryDialog, setEntryDialog] = useState<{ open: boolean; entry?: Entry | null }>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'group'; value: Group } | { type: 'entry'; value: Entry } | null>(null)

  useEffect(() => { load() }, [load])
  useEffect(() => watchSystemTheme(), [])
  useEffect(
    () => Events.On('execution:log', (event) => handleExecutionEvent(event.data as ExecutionEvent)),
    [handleExecutionEvent],
  )
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(clearNotice, notice.tone === 'error' ? 5000 : 2800)
    return () => window.clearTimeout(timer)
  }, [notice, clearNotice])
  useEffect(() => {
    if (selectedGroupID !== null && !groups.some((group) => group.id === selectedGroupID)) setSelectedGroupID(null)
  }, [groups, selectedGroupID])

  const normalizedSearch = search.trim().toLocaleLowerCase()
  const filteredEntries = useMemo(
    () => entries.filter((entry) => {
      const inGroup = selectedGroupID === null || entry.groupId === selectedGroupID
      const matches = !normalizedSearch || `${entry.name} ${entry.scriptPath} ${entry.arguments}`.toLocaleLowerCase().includes(normalizedSearch)
      return inGroup && matches
    }),
    [entries, normalizedSearch, selectedGroupID],
  )
  const frequencySortedEntries = useMemo(
    () => [...filteredEntries].sort((a, b) => {
      if (a.clickCount !== b.clickCount) return b.clickCount - a.clickCount
      const recent = (b.lastClickedAt || '').localeCompare(a.lastClickedAt || '')
      if (recent !== 0) return recent
      return a.id - b.id
    }),
    [filteredEntries],
  )
  const selectedGroup = groups.find((group) => group.id === selectedGroupID)
  const pageTitle = selectedGroup?.name ?? '全部入口'
  const canCreateEntry = groups.length > 0

  return (
    <div className="flex h-screen min-h-[560px] overflow-hidden bg-[#dce4ee] text-slate-900 transition-colors duration-200 dark:bg-[#111827] dark:text-slate-100">
      <Sidebar
        selectedGroupID={selectedGroupID}
        onSelect={setSelectedGroupID}
        onAddGroup={() => setGroupDialog({ open: true })}
        onEditGroup={(group) => setGroupDialog({ open: true, group })}
        onDeleteGroup={(group) => setDeleteTarget({ type: 'group', value: group })}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[78px] shrink-0 items-end border-b border-slate-300/80 bg-[#e7edf4]/95 px-8 pb-4 pt-3 backdrop-blur transition-colors dark:border-slate-700/70 dark:bg-[#151e2e]/95">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{pageTitle}</h1>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{filteredEntries.length} 个入口</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {selectedGroupID === null && (
              <div className="relative">
                <ArrowDownWideNarrow className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <select
                  aria-label="全部入口排序"
                  className="h-10 w-36 appearance-none rounded-xl border border-slate-300 bg-[#f2f5f8]/80 pl-9 pr-7 text-sm text-slate-600 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300"
                  value={allEntrySort}
                  onChange={(event) => {
                    const value = event.target.value === 'frequency' ? 'frequency' : 'default'
                    setAllEntrySort(value)
                    window.localStorage.setItem('script-launcher-all-entry-sort', value)
                  }}
                >
                  <option value="default">默认排序</option>
                  <option value="frequency">使用频率</option>
                </select>
              </div>
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                className="h-10 w-[clamp(160px,22vw,256px)] rounded-xl border border-slate-300 bg-[#f2f5f8]/80 pl-9 pr-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-[#f6f8fa] focus:ring-2 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:bg-slate-800"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索名称、路径或参数"
              />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"><X className="size-4" /></button>}
            </div>
            <Button disabled={!canCreateEntry} onClick={() => setEntryDialog({ open: true })}><Plus className="size-4" />新增入口</Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
          {loading ? (
            <div className="grid h-full place-items-center text-sm text-slate-400 dark:text-slate-500"><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />正在加载本地数据…</span></div>
          ) : loadError ? (
            <div className="grid h-full place-items-center">
              <div className="text-center"><AlertCircle className="mx-auto size-8 text-red-400" /><p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{loadError}</p><Button className="mt-4" variant="secondary" onClick={load}>重新加载</Button></div>
            </div>
          ) : groups.length === 0 ? (
            <EmptyState icon="folder" title="先创建一个分组" description="分组用于整理脚本、程序和常用命令。" action="新增分组" onAction={() => setGroupDialog({ open: true })} />
          ) : filteredEntries.length === 0 ? (
            <EmptyState
              icon="entry"
              title={search ? '没有匹配的入口' : '这里还没有入口'}
              description={search ? '试试搜索其它关键词。' : '添加你的第一个脚本、程序或常用命令。'}
              action={search ? '清除搜索' : '新增入口'}
              onAction={() => search ? setSearch('') : setEntryDialog({ open: true })}
            />
          ) : selectedGroupID === null && allEntrySort === 'frequency' ? (
            <section>
              <div className="mb-3 flex items-center">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">按使用频率</h2>
                <span className="ml-2 rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{frequencySortedEntries.length}</span>
              </div>
              <EntryGrid entries={frequencySortedEntries} groups={groups} sortable={false} showGroupOnHover onEdit={(entry) => setEntryDialog({ open: true, entry })} onDelete={(entry) => setDeleteTarget({ type: 'entry', value: entry })} />
            </section>
          ) : selectedGroupID !== null ? (
            <EntryGrid entries={filteredEntries} groups={groups} onEdit={(entry) => setEntryDialog({ open: true, entry })} onDelete={(entry) => setDeleteTarget({ type: 'entry', value: entry })} />
          ) : (
            <div className="space-y-9">
              {groups.map((group) => {
                const groupEntries = filteredEntries.filter((entry) => entry.groupId === group.id)
                if (!groupEntries.length) return null
                return (
                  <section key={group.id}>
                    <div className="mb-3 flex items-center">
                      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{group.name}</h2>
                      <span className="ml-2 rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">{groupEntries.length}</span>
                      <button className="ml-auto text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300" onClick={() => setSelectedGroupID(group.id)}>查看分组</button>
                    </div>
                    <EntryGrid entries={groupEntries} groups={groups} onEdit={(entry) => setEntryDialog({ open: true, entry })} onDelete={(entry) => setDeleteTarget({ type: 'entry', value: entry })} />
                  </section>
                )
              })}
            </div>
          )}
        </div>
        <ExecutionLogPanel />
      </main>

      <GroupDialog open={groupDialog.open} onOpenChange={(open) => setGroupDialog((state) => ({ ...state, open }))} group={groupDialog.group} />
      <EntryDialog open={entryDialog.open} onOpenChange={(open) => setEntryDialog((state) => ({ ...state, open }))} entry={entryDialog.entry} defaultGroupID={selectedGroupID ?? undefined} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteTarget?.type === 'group' ? `删除分组“${deleteTarget.value.name}”？` : `删除入口“${deleteTarget?.value.name}”？`}
        description={deleteTarget?.type === 'group' ? '该分组下的所有入口也会一并删除，此操作无法撤销。' : '入口配置会从本地数据库中删除，此操作无法撤销。'}
        onConfirm={async () => {
          if (!deleteTarget) return
          if (deleteTarget.type === 'group') await deleteGroup(deleteTarget.value.id)
          else await deleteEntry(deleteTarget.value.id)
          setDeleteTarget(null)
        }}
      />

      {notice && (
        <div className={cn('fixed right-6 top-5 z-[70] flex max-w-sm items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm shadow-xl animate-toast-in dark:bg-slate-800', notice.tone === 'success' ? 'border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300' : 'border-red-200 text-red-700 dark:border-red-800 dark:text-red-300')}>
          {notice.tone === 'success' ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          <span className="line-clamp-2">{notice.message}</span>
        </div>
      )}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: 'folder' | 'entry'
  title: string
  description: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="grid h-full min-h-80 place-items-center">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#edf2f7] text-slate-400 shadow-sm ring-1 ring-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:ring-slate-700">
          {icon === 'folder' ? <Command className="size-7" /> : <TerminalSquare className="size-7" />}
        </span>
        <h2 className="mt-5 text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        <Button className="mt-5" variant="secondary" onClick={onAction}><Plus className="size-4" />{action}</Button>
      </div>
    </div>
  )
}

function App() {
  return <Routes><Route path="*" element={<LauncherPage />} /></Routes>
}

export default App
