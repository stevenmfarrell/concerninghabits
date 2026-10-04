'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight } from 'lucide-react';
import Icon from '../../../components/Icon';
import ActivityCalendar from '../../../components/ActivityCalendar';
import { reorderCategories } from '../../actions/db';
import { reorderHabits } from '../../actions/db';
import { parseCadence } from '@/lib/cadence';
import type { RowStatus as Status } from '@/lib/dueList';
import type { HabitListItem, SessionUser, SubcategoryListItem } from '@/lib/types';
import { isSharedHabit, type Person } from '@/lib/userColors';
import { useReorderableList } from './useReorderableList';
import LogHabitButton from '@/components/logging/LogHabitButton';
import RowStatus from '@/components/RowStatus';

import { ChevronDown, ExternalLink, Users } from 'lucide-react';

interface SortableRowProps {
  user: SessionUser;
  // Everyone's colors as this user sees them, for coloring shared habits' calendars by person
  people: Record<string, Person>;
  isOverlay?: boolean;
  isReordering?: boolean;
}

const SortableSubcategoryItem = ({ sub, user, people, isOverlay, isReordering }: SortableRowProps & { sub: SubcategoryListItem }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id });
  const [isOpen, setIsOpen] = useState(true);
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  const subHabits = sub.habits ?? [];

  const content = (
    <div className={`flex flex-col relative w-full ${isOverlay ? 'shadow-2xl scale-[1.02] z-50 rounded-2xl' : ''}`}>
      {/* Header */}
      <div className={`py-3 pane-inset flex justify-between items-center group/header transition-colors ${isOpen && subHabits.length > 0 ? 'border-b border-line-subtle' : ''} hover:bg-surface-subtle`}>
        <div className="flex items-center gap-2 sm:gap-4 w-full">
          {isReordering && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-ink-faint hover:text-ink-muted touch-none shrink-0 p-1 -ml-2">
              <GripVertical className="w-5 h-5" />
            </div>
          )}

          <button onClick={() => setIsOpen(!isOpen)} className="flex-1 flex flex-wrap sm:flex-nowrap items-center justify-between min-w-0 text-left gap-3 sm:gap-6">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-category-soft-strong flex items-center justify-center text-category-ink-strong shrink-0">
                <Icon name={sub.icon || 'Folder'} className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-ink truncate">{sub.name}</h3>
                  <Link
                    href={`/categories/${sub.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 text-ink-subtle hover:text-category-ink hover:bg-category-soft-strong rounded-lg transition-colors shrink-0"
                    title="Open Subcategory Page"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <p className="text-xs text-ink-muted truncate mt-0.5">{subHabits.length} habits</p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-6 shrink-0">
              <div className="shrink-0 text-ink-faint hover:text-ink-secondary transition-colors w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center">
                {isOpen ? <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" /> : <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />}
              </div>
            </div>
          </button>
        </div>
      </div>
      
      {/* Habits */}
      {isOpen && !isOverlay && subHabits.length > 0 && (
        <SortableHabitList items={subHabits} user={user} people={people} isReordering={isReordering} dndContextId={`habits-dnd-${sub.id}`} bare nested />
      )}
    </div>
  );

  if (isOverlay) return <div className="bg-surface rounded-2xl border border-line overflow-hidden">{content}</div>;
  return <div ref={setNodeRef} style={style} className={`bg-surface ${isDragging ? 'opacity-40' : ''}`}>{content}</div>;
};

type CategoryItem =
  | { type: 'habit', id: string, data: HabitListItem }
  | { type: 'subcategory', id: string, data: SubcategoryListItem };

// A category's direct habits and subcategories, sorted together so either can be placed above the other,
// as one list of rows: each subcategory is a tinted header row with its habits under it.
export function SortableCategoryItemList({ items: initialItems, user, people, isReordering }: { items: CategoryItem[], user: SessionUser, people: Record<string, Person>, isReordering?: boolean }) {
  const { items, activeId, sensors, handleDragStart, handleDragCancel, handleDragEnd } = useReorderableList(initialItems, async (newItems) => {
    // Habits and subcategories share one order sequence within this category
    const withOrder = newItems.map((item, index) => ({ item, order: index }));
    const habitUpdates = withOrder.filter(x => x.item.type === 'habit').map(x => ({ id: x.item.id, order: x.order }));
    const categoryUpdates = withOrder.filter(x => x.item.type === 'subcategory').map(x => ({ id: x.item.id, order: x.order }));
    await Promise.all([
      habitUpdates.length > 0 ? reorderHabits(habitUpdates) : null,
      categoryUpdates.length > 0 ? reorderCategories(categoryUpdates) : null,
    ]);
  });

  const activeItem = items.find(i => i.id === activeId);

  return (
    <div className="flex flex-col divide-y divide-line-subtle">
      <DndContext id="category-items-dnd-context" sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(item => item.type === 'habit'
            ? <SortableHabitItem key={item.id} habit={item.data} user={user} people={people} isReordering={isReordering} />
            : <SortableSubcategoryItem key={item.id} sub={item.data} user={user} people={people} isReordering={isReordering} />
          )}
        </SortableContext>
        <DragOverlay>
          {activeItem?.type === 'habit' && <SortableHabitItem habit={activeItem.data} user={user} people={people} isOverlay isReordering={isReordering} />}
          {activeItem?.type === 'subcategory' && <SortableSubcategoryItem sub={activeItem.data} user={user} people={people} isOverlay isReordering={isReordering} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// `status` is what the Agenda page shows beside its calendar, e.g. a progress ring (see RowStatus)
// `nested` indents the row under its subcategory's header, its name lined up with the subcategory's
const SortableHabitItem = ({ habit, status, user, people, isOverlay, isReordering, nested }: SortableRowProps & { habit: HabitListItem; status?: Status; nested?: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  const logs = habit.logs ?? [];
  const isShared = isSharedHabit(habit.userId, habit.memberCount ?? 1, logs);

  const content = (
    <div className={`flex items-stretch transition-colors group/row relative ${isDragging ? 'opacity-30 bg-surface-muted' : 'bg-surface hover:bg-surface-subtle'} ${isOverlay ? 'shadow-2xl scale-[1.02] z-50 rounded-xl' : ''}`}>
      <div className={`flex-1 flex items-center py-3 ${nested ? 'pane-inset-nested' : 'pane-inset'} gap-2 sm:gap-4 min-w-0`}>
        {isReordering && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-ink-faint hover:text-ink-muted touch-none shrink-0 p-1 -ml-2">
            <GripVertical className="w-5 h-5" />
          </div>
        )}
        <Link href={`/log/${habit.id}`} className="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-6 min-w-0 w-full justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-ink group-hover/row:text-accent-ink transition-colors truncate">
                {habit.name}
              </h3>
              {(habit.memberCount ?? 1) > 1 && (
                <Users className="w-4 h-4 text-ink-subtle shrink-0" aria-label="Shared" />
              )}
            </div>
          </div>
          {/* The ring goes before the calendar, so calendars line up down the list with or without one */}
          <div className="shrink-0 flex items-center gap-3">
            {status && <RowStatus status={status} />}
            <div className="opacity-80 group-hover/row:opacity-100 transition-opacity pointer-events-none">
              <ActivityCalendar
                dates={logs.map(l => l.createdAt)}
                loggedBy={isShared ? logs.map(l => l.userId) : undefined}
                people={isShared ? people : undefined}
                weeks={4}
                size="xs"
                futureColor="bg-transparent"
                cadence={parseCadence(habit.cadence)}
                bedtime={user.bedtime} 
                weekStartsOn={user.weekStartsOn}
                timeZone={user.timeZone}
              />
            </div>
          </div>
        </Link>
        {/* Logs in place, the same as the Log Habit button on the habit's page */}
        {!isReordering && !isOverlay && <LogHabitButton habit={habit} />}
      </div>
    </div>
  );

  if (isOverlay) return content;
  return <div ref={setNodeRef} style={style} className="relative bg-surface">{content}</div>;
};

// `statuses` are what some habits' rows show beside their calendars, by habit id (see SortableHabitItem).
// `bare` leaves out the list's own card, for a list laid straight on a page's pane; `nested` indents
// its rows under a subcategory's header.
export function SortableHabitList({ items: initialItems, statuses, user, people, isReordering, dndContextId = "habits-dnd-context", bare = false, nested = false }: { items: HabitListItem[], statuses?: Record<string, Status>, user: SessionUser, people: Record<string, Person>, isReordering?: boolean, dndContextId?: string, bare?: boolean, nested?: boolean }) {
  const { items, activeId, sensors, handleDragStart, handleDragCancel, handleDragEnd } = useReorderableList(initialItems, async (newItems) => {
    const updates = newItems.map((item, index) => ({ id: item.id, order: index }));
    await reorderHabits(updates);
  });

  const activeItem = items.find(i => i.id === activeId);

  return (
    <div className={bare ? "divide-y divide-line-subtle flex flex-col w-full" : "bg-surface rounded-2xl shadow-sm border border-line-subtle overflow-hidden divide-y divide-line-subtle flex flex-col"}>
      <DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(habit => <SortableHabitItem key={habit.id} habit={habit} status={statuses?.[habit.id]} user={user} people={people} isReordering={isReordering} nested={nested} />)}
        </SortableContext>
        <DragOverlay>
          {activeItem ? <SortableHabitItem habit={activeItem} user={user} people={people} isOverlay isReordering={isReordering} nested={nested} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
