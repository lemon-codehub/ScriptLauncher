import { CheckCircle2, ChevronDown, ChevronUp, CircleX, LoaderCircle, Square, TerminalSquare, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../lib/utils'
import { useLauncherStore } from '../store/launcher'

const defaultPanelHeight = 230
const minimumPanelHeight = 140
const panelHeightStorageKey = 'script-launcher-log-panel-height'

function initialPanelHeight() {
  const stored = Number(window.localStorage.getItem(panelHeightStorageKey))
  const maximumPanelHeight = Math.max(minimumPanelHeight, window.innerHeight - 180)
  const preferredHeight = Number.isFinite(stored) && stored >= minimumPanelHeight ? stored : defaultPanelHeight
  return Math.min(maximumPanelHeight, preferredHeight)
}

function Status({ status }: { status?: 'running' | 'success' | 'failed' | 'stopped' }) {
  if (status === 'running') return <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400"><LoaderCircle className="size-3.5 animate-spin" />运行中</span>
  if (status === 'success') return <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="size-3.5" />执行成功</span>
  if (status === 'stopped') return <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><Square className="size-3 fill-current" />已终止</span>
  if (status === 'failed') return <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400"><CircleX className="size-3.5" />执行失败</span>
  return <span className="text-slate-500 dark:text-slate-500">等待执行</span>
}

export function ExecutionLogPanel() {
  const sessionsByID = useLauncherStore((state) => state.logSessions)
  const activeID = useLauncherStore((state) => state.activeLogEntryID)
  const collapsed = useLauncherStore((state) => state.logPanelCollapsed)
  const selectLog = useLauncherStore((state) => state.selectLog)
  const clearActiveLog = useLauncherStore((state) => state.clearActiveLog)
  const stopEntry = useLauncherStore((state) => state.stopEntry)
  const toggleLogPanel = useLauncherStore((state) => state.toggleLogPanel)
  const outputRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)
  const heightRef = useRef(defaultPanelHeight)
  const [panelHeight, setPanelHeight] = useState(initialPanelHeight)
  const [resizing, setResizing] = useState(false)
  const [stoppingEntryID, setStoppingEntryID] = useState<number | null>(null)

  useEffect(() => {
    heightRef.current = panelHeight
  }, [panelHeight])

  useEffect(() => {
    const stopResizing = () => {
      if (!dragRef.current) return
      dragRef.current = null
      setResizing(false)
      document.body.style.cursor = ''
      window.localStorage.setItem(panelHeightStorageKey, String(Math.round(heightRef.current)))
    }
    const resize = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const maximumPanelHeight = Math.max(minimumPanelHeight, window.innerHeight - 180)
      const nextHeight = Math.min(
        maximumPanelHeight,
        Math.max(minimumPanelHeight, drag.startHeight + drag.startY - event.clientY),
      )
      heightRef.current = nextHeight
      setPanelHeight(nextHeight)
    }

    window.addEventListener('pointermove', resize)
    window.addEventListener('pointerup', stopResizing)
    window.addEventListener('pointercancel', stopResizing)
    return () => {
      window.removeEventListener('pointermove', resize)
      window.removeEventListener('pointerup', stopResizing)
      window.removeEventListener('pointercancel', stopResizing)
      document.body.style.cursor = ''
    }
  }, [])

  const sessions = useMemo(
    () => Object.values(sessionsByID).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '')),
    [sessionsByID],
  )
  const activeSession = (activeID !== null ? sessionsByID[activeID] : undefined) ?? sessions[0]

  useEffect(() => {
    if (collapsed || !outputRef.current) return
    outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [activeSession?.output, activeSession?.error, activeSession?.status, collapsed])

  return (
    <section
      className={cn(
        'relative flex shrink-0 flex-col border-t border-slate-300 bg-[#e7edf4] text-slate-700 dark:border-slate-800 dark:bg-[#0c1321] dark:text-slate-200',
        !resizing && 'transition-[height] duration-200',
      )}
      style={{ height: collapsed ? 44 : panelHeight }}
    >
      {!collapsed && (
        <div
          className="group absolute -top-1.5 left-0 right-0 z-20 flex h-3 touch-none cursor-row-resize items-center justify-center"
          title="上下拖动调整日志高度"
          onPointerDown={(event) => {
            event.preventDefault()
            dragRef.current = { startY: event.clientY, startHeight: heightRef.current }
            setResizing(true)
            document.body.style.cursor = 'row-resize'
          }}
        >
          <span className="h-1 w-10 rounded-full bg-slate-400/50 opacity-60 transition group-hover:opacity-100 dark:bg-slate-500/70" />
        </div>
      )}
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-slate-300 px-4 dark:border-white/[.07]">
        <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
          <TerminalSquare className="size-4 text-sky-600 dark:text-sky-400" />
          执行日志
        </div>

        {sessions.length > 0 && (
          <select
            aria-label="选择执行日志"
            className="h-7 min-w-0 max-w-60 rounded-lg border border-slate-300 bg-white/60 px-2 text-xs text-slate-700 outline-none focus:border-sky-500 dark:border-white/10 dark:bg-white/[.06] dark:text-slate-200"
            value={activeSession?.entryId}
            onChange={(event) => selectLog(Number(event.target.value))}
          >
            {sessions.map((session) => (
              <option key={session.entryId} value={session.entryId}>{session.entryName}</option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-3 text-[11px]">
          <Status status={activeSession?.status} />
          {activeSession && activeSession.status !== 'running' && (
            <span className="hidden text-slate-500 sm:inline dark:text-slate-500">
              退出码 {activeSession.exitCode} · {activeSession.durationMs} ms
            </span>
          )}
          {activeSession?.status === 'running' && (
            <button
              className="flex h-7 items-center gap-1.5 rounded-md border border-red-300/80 bg-red-50/70 px-2 text-red-600 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-60 dark:border-red-900/80 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
              title="终止当前运行及其子进程"
              disabled={stoppingEntryID === activeSession.entryId}
              onClick={async () => {
                setStoppingEntryID(activeSession.entryId)
                try {
                  await stopEntry(activeSession.entryId)
                } catch {
                  // 错误提示由全局通知展示。
                } finally {
                  setStoppingEntryID(null)
                }
              }}
            >
              {stoppingEntryID === activeSession.entryId ? <LoaderCircle className="size-3 animate-spin" /> : <Square className="size-3 fill-current" />}
              <span className="hidden sm:inline">{stoppingEntryID === activeSession.entryId ? '正在终止' : '终止'}</span>
            </button>
          )}
          <button
            className="grid size-7 place-items-center rounded-md text-slate-500 transition hover:bg-white/60 hover:text-slate-900 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-slate-200"
            title="清空当前日志"
            disabled={!activeSession || (!activeSession.output && !activeSession.error)}
            onClick={clearActiveLog}
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            className="grid size-7 place-items-center rounded-md text-slate-500 transition hover:bg-white/60 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-slate-200"
            title={collapsed ? '展开日志' : '收起日志'}
            onClick={toggleLogPanel}
          >
            {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </div>
      </header>

      {!collapsed && (
        <div ref={outputRef} className="min-h-0 flex-1 overflow-auto px-4 py-3 font-mono text-[12px] leading-5">
          {!activeSession ? (
            <p className="text-slate-500 dark:text-slate-600">点击入口运行后，stdout 和 stderr 会实时显示在这里。</p>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-600">
                <span>{activeSession.entryName}</span>
                {activeSession.startedAt && <span>{new Date(activeSession.startedAt).toLocaleTimeString()}</span>}
              </div>
              {activeSession.output ? (
                <pre className="whitespace-pre-wrap break-words text-slate-700 dark:text-slate-300">{activeSession.output}</pre>
              ) : activeSession.status === 'running' ? (
                <p className="flex items-center gap-2 text-slate-500"><span className="size-1.5 animate-pulse rounded-full bg-sky-500 dark:bg-sky-400" />等待进程输出…</p>
              ) : (
                <p className="text-slate-500 dark:text-slate-600">本次执行没有输出。</p>
              )}
              {activeSession.error && (
                <pre className="mt-2 whitespace-pre-wrap break-words text-red-600 dark:text-red-400">{activeSession.error}</pre>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
