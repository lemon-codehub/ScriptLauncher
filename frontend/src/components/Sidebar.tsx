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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, LayoutGrid, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Group } from '../../bindings/scriptlauncher/models'
import { EntryIcon } from '../icons'
import { cn } from '../lib/utils'
import { useLauncherStore } from '../store/launcher'
import { Button } from './ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'
import { ThemeToggle } from './ThemeToggle'

function SortableGroup({
  group,
  active,
  count,
  onSelect,
  onEdit,
  onDelete,
}: {
  group: Group
  active: boolean
  count: number
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: group.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('group/nav flex items-center rounded-xl', isDragging && 'z-10 opacity-60')}>
      <button
        className={cn(
          'flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left text-sm transition',
          active
            ? 'bg-white/70 text-slate-900 shadow-sm dark:bg-white/12 dark:text-white dark:shadow-none'
            : 'text-slate-600 hover:bg-white/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[.06] dark:hover:text-slate-200',
        )}
        onClick={onSelect}
      >
        <span {...attributes} {...listeners} className="cursor-grab touch-none text-slate-400 opacity-0 transition group-hover/nav:opacity-100 dark:text-slate-600">
          <GripVertical className="size-3.5" />
        </span>
        <EntryIcon name={group.icon || 'Folder'} className={cn('size-4 shrink-0 rounded-sm', active ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500')} />
        <span className="truncate">{group.name}</span>
        <span className="ml-auto text-[11px] tabular-nums text-slate-500 dark:text-slate-500">{count}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="mr-1 grid size-7 place-items-center rounded-lg text-slate-500 opacity-0 transition hover:bg-white/70 hover:text-slate-900 group-hover/nav:opacity-100 dark:hover:bg-white/10 dark:hover:text-white">
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onEdit}><Pencil className="size-4" />编辑分组</DropdownMenuItem>
          <DropdownMenuItem danger onSelect={onDelete}><Trash2 className="size-4" />删除分组</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function Sidebar({
  selectedGroupID,
  onSelect,
  onAddGroup,
  onEditGroup,
  onDeleteGroup,
}: {
  selectedGroupID: number | null
  onSelect: (id: number | null) => void
  onAddGroup: () => void
  onEditGroup: (group: Group) => void
  onDeleteGroup: (group: Group) => void
}) {
  const groups = useLauncherStore((state) => state.groups)
  const entries = useLauncherStore((state) => state.entries)
  const reorderGroups = useLauncherStore((state) => state.reorderGroups)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIndex = groups.findIndex((group) => group.id === active.id)
    const newIndex = groups.findIndex((group) => group.id === over.id)
    reorderGroups(arrayMove(groups, oldIndex, newIndex).map((group) => group.id))
  }

  return (
    <aside className="flex w-[244px] shrink-0 flex-col border-r border-slate-300 bg-[#e7edf4] px-3 pb-4 pt-[54px] text-slate-900 transition-colors dark:border-white/[.04] dark:bg-[#0c1321] dark:text-white">
      <div className="mb-7 flex min-w-0 items-center gap-2.5 px-3">
        <img src="/script-launcher-logo.png" alt="" className="size-9 shrink-0" />
        <div className="min-w-0 leading-tight">
          <p className="truncate whitespace-nowrap text-[14px] font-semibold tracking-tight">Script Launcher</p>
          <p className="mt-1 truncate whitespace-nowrap text-[11px] text-slate-500">本地脚本工作台</p>
        </div>
      </div>

      <nav className="space-y-1">
        <button
          className={cn(
            'flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition',
            selectedGroupID === null
              ? 'bg-white/70 text-slate-900 shadow-sm dark:bg-white/12 dark:text-white dark:shadow-none'
              : 'text-slate-600 hover:bg-white/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[.06] dark:hover:text-slate-200',
          )}
          onClick={() => onSelect(null)}
        >
          <LayoutGrid className={cn('size-4', selectedGroupID === null && 'text-sky-600 dark:text-sky-400')} />
          <span>全部入口</span>
          <span className="ml-auto text-[11px] tabular-nums text-slate-500">{entries.length}</span>
        </button>
      </nav>

      <div className="mb-2 mt-7 flex items-center justify-between px-3">
        <span className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500 dark:text-slate-600">分组</span>
        <button className="grid size-6 place-items-center rounded-md text-slate-500 transition hover:bg-white/70 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white" onClick={onAddGroup} title="新增分组">
          <Plus className="size-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={groups.map((group) => group.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {groups.map((group) => (
                <SortableGroup
                  key={group.id}
                  group={group}
                  active={selectedGroupID === group.id}
                  count={entries.filter((entry) => entry.groupId === group.id).length}
                  onSelect={() => onSelect(group.id)}
                  onEdit={() => onEditGroup(group)}
                  onDelete={() => onDeleteGroup(group)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="mt-4 border-t border-slate-300 pt-4 dark:border-white/[.06]">
        <ThemeToggle />
        <Button variant="ghost" className="w-full justify-start text-slate-600 hover:bg-white/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[.06] dark:hover:text-white" onClick={onAddGroup}>
          <Plus className="size-4" />新增分组
        </Button>
      </div>
    </aside>
  )
}
