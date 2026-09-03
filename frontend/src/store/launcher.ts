import { create } from 'zustand'
import * as LauncherService from '../../bindings/scriptlauncher/launcherservice'
import type {
  Entry,
  EntryInput,
  ExecutionEvent,
  ExecutionResult,
  Group,
  GroupInput,
} from '../../bindings/scriptlauncher/models'
import { errorMessage } from '../lib/utils'

export type RunState = ExecutionResult | { entryId: number; status: 'running'; message: string }

export interface LogSession {
  entryId: number
  entryName: string
  status: 'running' | 'success' | 'failed' | 'stopped'
  output: string
  error: string
  exitCode: number
  startedAt: string
  endedAt: string
  durationMs: number
}

interface Notice {
  id: number
  tone: 'success' | 'error'
  message: string
}

interface LauncherStore {
  groups: Group[]
  entries: Entry[]
  loading: boolean
  loadError: string
  runStates: Record<number, RunState>
  logSessions: Record<number, LogSession>
  activeLogEntryID: number | null
  logPanelCollapsed: boolean
  notice: Notice | null
  load: () => Promise<void>
  createGroup: (input: GroupInput) => Promise<Group>
  updateGroup: (id: number, input: GroupInput) => Promise<Group>
  deleteGroup: (id: number) => Promise<void>
  reorderGroups: (orderedIDs: number[]) => Promise<void>
  createEntry: (input: EntryInput) => Promise<Entry>
  updateEntry: (id: number, input: EntryInput) => Promise<Entry>
  deleteEntry: (id: number) => Promise<void>
  moveEntry: (id: number, groupID: number) => Promise<void>
  revealEntry: (id: number) => Promise<void>
  reorderEntries: (groupID: number, orderedIDs: number[]) => Promise<void>
  executeEntry: (id: number) => Promise<void>
  stopEntry: (id: number) => Promise<void>
  handleExecutionEvent: (event: ExecutionEvent) => void
  selectLog: (entryID: number) => void
  clearActiveLog: () => void
  toggleLogPanel: () => void
  clearNotice: () => void
}

const maxRealtimeLogLength = 200 * 1024
const truncatedLogPrefix = '… 较早的日志已截断 …\n'

function sortedByIDs<T extends { id: number }>(items: T[], ids: number[]) {
  const order = new Map(ids.map((id, index) => [id, index]))
  return [...items].sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER))
}

function appendLog(current: string, chunk: string) {
  const combined = current + chunk
  if (combined.length <= maxRealtimeLogLength) return combined
  return truncatedLogPrefix + combined.slice(combined.length - maxRealtimeLogLength)
}

function emptyLogSession(entryID: number, entryName: string): LogSession {
  return {
    entryId: entryID,
    entryName,
    status: 'running',
    output: '',
    error: '',
    exitCode: -1,
    startedAt: new Date().toISOString(),
    endedAt: '',
    durationMs: 0,
  }
}

export const useLauncherStore = create<LauncherStore>((set, get) => ({
  groups: [],
  entries: [],
  loading: true,
  loadError: '',
  runStates: {},
  logSessions: {},
  activeLogEntryID: null,
  logPanelCollapsed: false,
  notice: null,

  load: async () => {
    set({ loading: true, loadError: '' })
    try {
      const state = await LauncherService.GetState()
      set({ groups: state.groups ?? [], entries: state.entries ?? [], loading: false })
    } catch (error) {
      set({ loading: false, loadError: errorMessage(error) })
    }
  },

  createGroup: async (input) => {
    const group = await LauncherService.CreateGroup(input)
    set((state) => ({ groups: [...state.groups, group], notice: { id: Date.now(), tone: 'success', message: '分组已创建' } }))
    return group
  },

  updateGroup: async (id, input) => {
    const group = await LauncherService.UpdateGroup(id, input)
    set((state) => ({
      groups: state.groups.map((item) => (item.id === id ? group : item)),
      notice: { id: Date.now(), tone: 'success', message: '分组已保存' },
    }))
    return group
  },

  deleteGroup: async (id) => {
    await LauncherService.DeleteGroup(id)
    set((state) => ({
      groups: state.groups.filter((group) => group.id !== id),
      entries: state.entries.filter((entry) => entry.groupId !== id),
      notice: { id: Date.now(), tone: 'success', message: '分组已删除' },
    }))
  },

  reorderGroups: async (orderedIDs) => {
    const previous = get().groups
    set({ groups: sortedByIDs(previous, orderedIDs) })
    try {
      await LauncherService.ReorderGroups(orderedIDs)
    } catch (error) {
      set({ groups: previous, notice: { id: Date.now(), tone: 'error', message: errorMessage(error) } })
    }
  },

  createEntry: async (input) => {
    const entry = await LauncherService.CreateEntry(input)
    set((state) => ({ entries: [...state.entries, entry], notice: { id: Date.now(), tone: 'success', message: '入口已创建' } }))
    return entry
  },

  updateEntry: async (id, input) => {
    const entry = await LauncherService.UpdateEntry(id, input)
    set((state) => ({
      entries: state.entries.map((item) => (item.id === id ? entry : item)),
      notice: { id: Date.now(), tone: 'success', message: '入口已保存' },
    }))
    return entry
  },

  deleteEntry: async (id) => {
    await LauncherService.DeleteEntry(id)
    set((state) => ({
      entries: state.entries.filter((entry) => entry.id !== id),
      notice: { id: Date.now(), tone: 'success', message: '入口已删除' },
    }))
  },

  moveEntry: async (id, groupID) => {
    const entry = await LauncherService.MoveEntry(id, groupID)
    set((state) => ({
      entries: state.entries.map((item) => (item.id === id ? entry : item)),
      notice: { id: Date.now(), tone: 'success', message: '入口已移动' },
    }))
  },

  revealEntry: async (id) => {
    try {
      await LauncherService.RevealEntry(id)
    } catch (error) {
      set({ notice: { id: Date.now(), tone: 'error', message: errorMessage(error) } })
    }
  },

  reorderEntries: async (groupID, orderedIDs) => {
    const previous = get().entries
    const selected = previous.filter((entry) => entry.groupId === groupID)
    const ordered = sortedByIDs(selected, orderedIDs)
    let index = 0
    set({ entries: previous.map((entry) => (entry.groupId === groupID ? ordered[index++] : entry)) })
    try {
      await LauncherService.ReorderEntries(groupID, orderedIDs)
    } catch (error) {
      set({ entries: previous, notice: { id: Date.now(), tone: 'error', message: errorMessage(error) } })
    }
  },

  executeEntry: async (id) => {
    const entry = get().entries.find((item) => item.id === id)
    const session = emptyLogSession(id, entry?.name ?? `入口 ${id}`)
    set((state) => ({
      runStates: { ...state.runStates, [id]: { entryId: id, status: 'running', message: '运行中' } },
      entries: state.entries.map((item) => item.id === id ? {
        ...item,
        clickCount: item.clickCount + 1,
        lastClickedAt: session.startedAt,
      } : item),
      logSessions: { ...state.logSessions, [id]: session },
      activeLogEntryID: id,
      logPanelCollapsed: false,
    }))
    try {
      const result = await LauncherService.ExecuteEntry(id)
      set((state) => {
        const currentLog = state.logSessions[id] ?? session
        return {
          runStates: { ...state.runStates, [id]: result },
          logSessions: {
            ...state.logSessions,
            [id]: {
              ...currentLog,
              status: result.status === 'success' ? 'success' : result.status === 'stopped' ? 'stopped' : 'failed',
              output: currentLog.output || result.output,
              error: result.error,
              exitCode: result.exitCode,
              startedAt: result.startedAt || currentLog.startedAt,
              endedAt: result.endedAt,
              durationMs: result.durationMs,
            },
          },
          notice: {
            id: Date.now(),
            tone: result.status === 'failed' ? 'error' : 'success',
            message: result.status === 'failed' ? result.error || result.message : result.message,
          },
        }
      })
    } catch (error) {
      const failed: ExecutionResult = {
        entryId: id,
        status: 'failed',
        message: '执行失败',
        output: '',
        error: errorMessage(error),
        exitCode: -1,
        startedAt: session.startedAt,
        endedAt: new Date().toISOString(),
        durationMs: 0,
      }
      set((state) => ({
        runStates: { ...state.runStates, [id]: failed },
        logSessions: {
          ...state.logSessions,
          [id]: { ...session, status: 'failed', error: failed.error, endedAt: failed.endedAt },
        },
        notice: { id: Date.now(), tone: 'error', message: failed.error },
      }))
    }
  },

  stopEntry: async (id) => {
    try {
      await LauncherService.StopEntry(id)
    } catch (error) {
      set({ notice: { id: Date.now(), tone: 'error', message: errorMessage(error) } })
      throw error
    }
  },

  handleExecutionEvent: (event) => {
    set((state) => {
      const current = state.logSessions[event.entryId] ?? emptyLogSession(event.entryId, event.entryName || `入口 ${event.entryId}`)
      if (event.kind === 'started') {
        return {
          logSessions: {
            ...state.logSessions,
            [event.entryId]: {
              ...emptyLogSession(event.entryId, event.entryName || current.entryName),
              startedAt: event.timestamp || current.startedAt,
            },
          },
          activeLogEntryID: event.entryId,
          logPanelCollapsed: false,
        }
      }
      if (event.kind === 'output') {
        return {
          logSessions: {
            ...state.logSessions,
            [event.entryId]: {
              ...current,
              entryName: event.entryName || current.entryName,
              output: appendLog(current.output, event.text),
            },
          },
        }
      }
      if (event.kind === 'finished') {
        return {
          logSessions: {
            ...state.logSessions,
            [event.entryId]: {
              ...current,
              entryName: event.entryName || current.entryName,
              status: event.status === 'success' ? 'success' : event.status === 'stopped' ? 'stopped' : 'failed',
              error: event.error,
              exitCode: event.exitCode,
              endedAt: event.timestamp,
              durationMs: event.durationMs,
            },
          },
        }
      }
      return state
    })
  },

  selectLog: (entryID) => set({ activeLogEntryID: entryID, logPanelCollapsed: false }),

  clearActiveLog: () => {
    const activeID = get().activeLogEntryID
    if (activeID === null) return
    set((state) => {
      const current = state.logSessions[activeID]
      if (!current) return state
      return {
        logSessions: {
          ...state.logSessions,
          [activeID]: { ...current, output: '', error: '' },
        },
      }
    })
  },

  toggleLogPanel: () => set((state) => ({ logPanelCollapsed: !state.logPanelCollapsed })),
  clearNotice: () => set({ notice: null }),
}))
