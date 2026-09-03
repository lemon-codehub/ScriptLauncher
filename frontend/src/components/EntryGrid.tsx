import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronRight, CircleX, FolderInput, FolderSearch, GripVertical, LoaderCircle, MoreHorizontal, MousePointerClick, Pencil, Play, Square, Trash2 } from 'lucide-react'
import type { Entry, Group } from '../../bindings/scriptlauncher/models'
import { EntryIcon, isCustomEntryIcon, isEmojiEntryIcon } from '../icons'
import { cn } from '../lib/utils'
import { type RunState, useLauncherStore } from '../store/launcher'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu'

function StatusBadge({ state }: { state?: RunState }) {
  if (!state) return <span className="entry-play"><Play className="size-3.5 fill-current" /></span>
  if (state.status === 'running') return <span className="status-badge bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"><LoaderCircle className="size-3.5 animate-spin" />运行中</span>
  if (state.status === 'success') return <span className="status-badge bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"><Check className="size-3.5" />成功</span>
  if (state.status === 'stopped') return <span className="status-badge bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"><Square className="size-3 fill-current" />已终止</span>
  return <span className="status-badge bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"><CircleX className="size-3.5" />失败</span>
}

function SortableEntryCard({
  entry,
  groups,
  runState,
  sortable,
  showGroupOnHover,
  onEdit,
  onDelete,
}: {
  entry: Entry
  groups: Group[]
  runState?: RunState
  sortable: boolean
  showGroupOnHover: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const execute = useLauncherStore((state) => state.executeEntry)
  const moveEntry = useLauncherStore((state) => state.moveEntry)
  const revealEntry = useLauncherStore((state) => state.revealEntry)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id, disabled: !sortable })
  const failed = runState?.status === 'failed'
  const group = groups.find((item) => item.id === entry.groupId)
  const groupName = group?.name ?? '未分组'
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group/card relative min-h-[148px] cursor-pointer rounded-2xl border bg-[#edf2f7] p-4 shadow-[0_1px_2px_rgba(15,23,42,.05)] transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-[#f3f6f9] hover:shadow-[0_12px_32px_rgba(15,23,42,.10)] dark:bg-[#182235] dark:shadow-[0_1px_2px_rgba(0,0,0,.18)] dark:hover:border-slate-600 dark:hover:bg-[#1b2940] dark:hover:shadow-[0_14px_34px_rgba(0,0,0,.22)]',
        failed ? 'border-red-200 dark:border-red-900/80' : 'border-slate-200/80 dark:border-slate-700/80',
        isDragging && 'z-20 opacity-50 shadow-2xl',
      )}
      onClick={() => runState?.status !== 'running' && execute(entry.id)}
    >
      {showGroupOnHover && (
        <span className="pointer-events-none absolute left-1/2 top-0 z-30 inline-flex max-w-[calc(100%-24px)] -translate-x-1/2 -translate-y-[calc(100%+8px)] items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition duration-150 group-hover/card:opacity-100 dark:bg-slate-100 dark:text-slate-900">
          <EntryIcon name={group?.icon || 'Folder'} className={isEmojiEntryIcon(group?.icon || '') ? 'size-4 shrink-0 text-sm' : 'size-3.5 shrink-0 rounded-sm'} />
          <span className="truncate">所属分组：{groupName}</span>
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-slate-900 dark:border-t-slate-100" />
        </span>
      )}
      <div className="flex items-start justify-between">
        <span className="grid size-11 place-items-center overflow-hidden rounded-[14px] bg-slate-100 text-slate-700 transition group-hover/card:bg-sky-50 group-hover/card:text-sky-600 dark:bg-slate-800 dark:text-slate-300 dark:group-hover/card:bg-sky-500/10 dark:group-hover/card:text-sky-400">
          <EntryIcon name={entry.icon} className={isCustomEntryIcon(entry.icon) ? 'size-full' : isEmojiEntryIcon(entry.icon) ? 'size-7 text-2xl' : 'size-5'} />
        </span>
        <div className="flex items-center">
          {sortable && (
            <button
              {...attributes}
              {...listeners}
              className="grid size-8 cursor-grab touch-none place-items-center rounded-lg text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover/card:opacity-100 dark:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              onClick={(event) => event.stopPropagation()}
            >
              <GripVertical className="size-4" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200" onClick={(event) => event.stopPropagation()}>
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem onSelect={onEdit}><Pencil className="size-4" />编辑入口</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => revealEntry(entry.id)}><FolderSearch className="size-4" />在文件管理器中打开</DropdownMenuItem>
              {groups.length > 1 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>移动到</DropdownMenuLabel>
                  {groups.filter((group) => group.id !== entry.groupId).map((group) => (
                    <DropdownMenuItem key={group.id} onSelect={() => moveEntry(entry.id, group.id)}>
                      <FolderInput className="size-4" />{group.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem danger onSelect={onDelete}><Trash2 className="size-4" />删除入口</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <h3 className="mt-5 truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">{entry.name}</h3>
      <div className="mt-5 flex items-center justify-between">
        <StatusBadge state={runState} />
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] tabular-nums text-slate-400 dark:text-slate-500" title={`累计点击 ${entry.clickCount} 次`}>
            <MousePointerClick className="size-3" />{entry.clickCount}
          </span>
          <ChevronRight className="size-4 text-slate-300 transition group-hover/card:translate-x-0.5 group-hover/card:text-sky-500 dark:text-slate-600 dark:group-hover/card:text-sky-400" />
        </div>
      </div>
    </article>
  )
}

export function EntryGrid({
  entries,
  groups,
  onEdit,
  onDelete,
  sortable = true,
  showGroupOnHover = false,
}: {
  entries: Entry[]
  groups: Group[]
  onEdit: (entry: Entry) => void
  onDelete: (entry: Entry) => void
  sortable?: boolean
  showGroupOnHover?: boolean
}) {
  const runStates = useLauncherStore((state) => state.runStates)
  const reorderEntries = useLauncherStore((state) => state.reorderEntries)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const groupID = entries[0]?.groupId

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!sortable || !groupID || !over || active.id === over.id) return
    const oldIndex = entries.findIndex((entry) => entry.id === active.id)
    const newIndex = entries.findIndex((entry) => entry.id === over.id)
    reorderEntries(groupID, arrayMove(entries, oldIndex, newIndex).map((entry) => entry.id))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={entries.map((entry) => entry.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {entries.map((entry) => (
            <SortableEntryCard key={entry.id} entry={entry} groups={groups} runState={runStates[entry.id]} sortable={sortable} showGroupOnHover={showGroupOnHover} onEdit={() => onEdit(entry)} onDelete={() => onDelete(entry)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
