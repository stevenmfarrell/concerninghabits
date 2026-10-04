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
import type { HabitListItem, SessionUser, SubcategoryListItem } from '@/lib/types';
import { isSharedHabit, type Person } from '@/lib/userColors';
import { useReorderableList } from './useReorderableList';
import LogHabitButton from '@/components/logging/LogHabitButton';
import ProgressRing from '@/components/ProgressRing';

import { ChevronDown, ExternalLink, Users } from 'lucide-react';

interface SortableRowProps {
  user: SessionUser;
  // Everyone's colors as this user sees them, for coloring shared habits' calendars by person
  people: Record<string, Person>;
  isOverlay?: boolean;
  isReordering?: boolean;
  className?: string;
}

const SortableSubcategoryItem = ({ sub, user, people, isOverlay, isReordering, className = '' }: SortableRowProps & { sub: SubcategoryListItem }) => {
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
      <div className={`py-4 px-4 sm:px-6 flex justify-between items-center group/header transition-colors ${isOpen && subHabits.length > 0 ? 'border-b border-stone-100' : ''} bg-blue-50/50 hover:bg-blue-50`}>
        <div className="flex items-center gap-2 sm:gap-4 w-full">
          {isReordering && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none shrink-0 p-1 -ml-2">
              <GripVertical className="w-5 h-5" />
            </div>
          )}

          <button onClick={() => setIsOpen(!isOpen)} className="flex-1 flex flex-wrap sm:flex-nowrap items-center justify-between min-w-0 text-left gap-3 sm:gap-6">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                <Icon name={sub.icon || 'Folder'} className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-stone-800 truncate">{sub.name}</h3>
                  <Link
                    href={`/categories/${sub.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors shrink-0"
                    title="Open Subcategory Page"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <p className="text-xs text-stone-500 truncate mt-0.5">{subHabits.length} habits</p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-6 shrink-0">
              <div className="shrink-0 text-stone-300 hover:text-stone-600 transition-colors w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center">
                {isOpen ? <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" /> : <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />}
              </div>
            </div>
          </button>
        </div>
      </div>
      
      {/* Habits */}
      {isOpen && !isOverlay && subHabits.length > 0 && (
        <SortableHabitList items={subHabits} user={user} people={people} isReordering={isReordering} dndContextId={`habits-dnd-${sub.id}`} isNested={true} />
      )}
    </div>
  );

  if (isOverlay) return <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">{content}</div>;
  return <div ref={setNodeRef} style={style} className={`bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden ${isDragging ? 'opacity-40' : ''} ${className}`}>{content}</div>;
};

type CategoryItem =
  | { type: 'habit', id: string, data: HabitListItem }
  | { type: 'subcategory', id: string, data: SubcategoryListItem };

// A category's direct habits and subcategories, sorted together so either can be placed above the other.
// Consecutive habits render as one joined card; each subcategory is its own card.
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

  const getHabitClassName = (index: number) => {
    const prevIsHabit = items[index - 1]?.type === 'habit';
    const nextIsHabit = items[index + 1]?.type === 'habit';
    return [
      'border-x border-stone-100 shadow-sm',
      prevIsHabit ? 'border-t' : `border-t rounded-t-2xl overflow-hidden ${index > 0 ? 'mt-6' : ''}`,
      nextIsHabit ? '' : 'border-b rounded-b-2xl overflow-hidden',
    ].join(' ');
  };

  return (
    <div className="flex flex-col">
      <DndContext id="category-items-dnd-context" sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item, index) => item.type === 'habit'
            ? <SortableHabitItem key={item.id} habit={item.data} user={user} people={people} isReordering={isReordering} className={getHabitClassName(index)} />
            : <SortableSubcategoryItem key={item.id} sub={item.data} user={user} people={people} isReordering={isReordering} className={index > 0 ? 'mt-6' : ''} />
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

// `note` is a line under the habit's name, e.g. when it's due on the Agenda page. `progress` is how
// far along it is toward done, for one that takes several entries, shown as a ring by its calendar.
const SortableHabitItem = ({ habit, note, progress, user, people, isOverlay, isReordering, className = '' }: SortableRowProps & { habit: HabitListItem; note?: string; progress?: { done: number; needed: number } }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  const logs = habit.logs ?? [];
  const isShared = isSharedHabit(habit.userId, habit.memberCount ?? 1, logs);

  const content = (
    <div className={`flex items-stretch transition-colors group/row relative ${isDragging ? 'opacity-30 bg-stone-100' : 'bg-white hover:bg-stone-50'} ${isOverlay ? 'shadow-2xl scale-[1.02] z-50 rounded-xl' : ''}`}>
      <div className="flex-1 flex items-center py-4 px-4 sm:px-6 gap-2 sm:gap-4 min-w-0">
        {isReordering && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none shrink-0 p-1 -ml-2">
            <GripVertical className="w-5 h-5" />
          </div>
        )}
        <Link href={`/log/${habit.id}`} className="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-6 min-w-0 w-full justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-semibold text-stone-800 group-hover/row:text-emerald-600 transition-colors truncate">
                {habit.name}
              </h3>
              {(habit.memberCount ?? 1) > 1 && (
                <Users className="w-4 h-4 text-stone-400 shrink-0" aria-label="Shared" />
              )}
            </div>
            {note && <p className="text-sm text-stone-500">{note}</p>}
          </div>
          {/* The ring goes before the calendar, so calendars line up down the list with or without one */}
          <div className="shrink-0 flex items-center gap-3">
            {progress && <ProgressRing done={progress.done} needed={progress.needed} />}
            <div className="opacity-80 group-hover/row:opacity-100 transition-opacity pointer-events-none">
              <ActivityCalendar
                dates={logs.map(l => l.createdAt)}
                loggedBy={isShared ? logs.map(l => l.userId) : undefined}
                people={isShared ? people : undefined}
                weeks={3}
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
  return <div ref={setNodeRef} style={style} className={`relative bg-white ${className}`}>{content}</div>;
};

// `notes` are lines shown under some habits' names, and `progress` some habits' progress toward
// done, by habit id (see SortableHabitItem)
export function SortableHabitList({ items: initialItems, notes, progress, user, people, isReordering, dndContextId = "habits-dnd-context", isNested = false }: { items: HabitListItem[], notes?: Record<string, string>, progress?: Record<string, { done: number; needed: number }>, user: SessionUser, people: Record<string, Person>, isReordering?: boolean, dndContextId?: string, isNested?: boolean }) {
  const { items, activeId, sensors, handleDragStart, handleDragCancel, handleDragEnd } = useReorderableList(initialItems, async (newItems) => {
    const updates = newItems.map((item, index) => ({ id: item.id, order: index }));
    await reorderHabits(updates);
  });

  const activeItem = items.find(i => i.id === activeId);

  return (
    <div className={isNested ? "divide-y divide-stone-100 flex flex-col w-full" : "bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col"}>
      <DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(habit => <SortableHabitItem key={habit.id} habit={habit} note={notes?.[habit.id]} progress={progress?.[habit.id]} user={user} people={people} isReordering={isReordering} />)}
        </SortableContext>
        <DragOverlay>
          {activeItem ? <SortableHabitItem habit={activeItem} user={user} people={people} isOverlay isReordering={isReordering} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
