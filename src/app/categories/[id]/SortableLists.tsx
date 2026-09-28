'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight } from 'lucide-react';
import Icon from '../../../components/Icon';
import ActivityCalendar from '../../../components/ActivityCalendar';
import QuillIconWavy from '../../../components/QuillIconWavy';
import { reorderCategories } from '../../actions/db';
import { reorderHabits } from '../../actions/db';

import { ChevronDown, ExternalLink } from 'lucide-react';

const SortableSubcategoryItem = ({ sub, user, isOverlay, isReordering, ...props }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id });
  const [isOpen, setIsOpen] = useState(true);
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  const subLogs = sub.habits?.flatMap((h: any) => h.logs?.map((l: any) => l.createdAt) || []) || [];
  const subTargetCount = sub.habits?.length > 0 ? sub.habits.length : 1;

  const content = (
    <div className={`flex flex-col relative w-full ${isOverlay ? 'shadow-2xl scale-[1.02] z-50 rounded-2xl' : ''}`}>
      {/* Header */}
      <div className={`py-4 px-4 sm:px-6 flex justify-between items-center group/header transition-colors ${isOpen && sub.habits?.length > 0 ? 'border-b border-stone-100' : ''} bg-stone-50/80 hover:bg-stone-100/80`}>
        <div className="flex items-center gap-2 sm:gap-4 w-full">
          {isReordering && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none shrink-0 p-1 -ml-2">
              <GripVertical className="w-5 h-5" />
            </div>
          )}
          
          <button onClick={() => setIsOpen(!isOpen)} className="flex-1 flex flex-wrap sm:flex-nowrap items-center justify-between min-w-0 text-left gap-3 sm:gap-6">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <Icon name={sub.icon || 'Folder'} className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-stone-800 truncate">{sub.name}</h3>
                  <Link 
                    href={`/categories/${sub.id}`} 
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors shrink-0"
                    title="Open Subcategory Page"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <p className="text-xs text-stone-500 truncate mt-0.5">{sub.habits?.length || 0} habits</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-6 shrink-0">
              {sub.habits?.length > 0 && (
                <div className="shrink-0 flex flex-col justify-center opacity-70 pointer-events-none">
                  <ActivityCalendar 
                    dates={subLogs} 
                    weeks={3} 
                    frequency="multiple" 
                    targetCount={subTargetCount} 
                    bedtime={user.bedtime} 
                    weekStartsOn={user.weekStartsOn}
                    emptyColor="bg-stone-200"
                    futureColor="bg-transparent border border-stone-200"
                  />
                </div>
              )}
              <div className="shrink-0 text-stone-300 hover:text-stone-600 transition-colors w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center">
                {isOpen ? <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" /> : <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />}
              </div>
            </div>
          </button>
        </div>
      </div>
      
      {/* Habits */}
      {isOpen && !isOverlay && sub.habits && sub.habits.length > 0 && (
        <SortableHabitList items={sub.habits} user={user} isReordering={isReordering} dndContextId={`habits-dnd-${sub.id}`} isNested={true} />
      )}
    </div>
  );

  if (isOverlay) return <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">{content}</div>;
  return <div ref={setNodeRef} style={style} className={`bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden ${isDragging ? 'opacity-40' : ''}`}>{content}</div>;
};

export function SortableSubcategoryList({ items: initialItems, user, isReordering }: { items: any[], user: any, isReordering?: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  const handleDragStart = (event: any) => setActiveId(event.active.id);
  const handleDragCancel = () => setActiveId(null);
  
  const handleDragEnd = async (event: any) => {
    setActiveId(null);
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      
      const updates = newItems.map((item, index) => ({ id: item.id, order: index, parentId: item.parentId }));
      await reorderCategories(updates);
    }
  };

  const activeItem = items.find(i => i.id === activeId);

  return (
    <div className="flex flex-col gap-6">
      <DndContext id="subcategories-dnd-context" sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(sub => <SortableSubcategoryItem key={sub.id} sub={sub} user={user} isReordering={isReordering} />)}
        </SortableContext>
        <DragOverlay>
          {activeItem ? <SortableSubcategoryItem sub={activeItem} user={user} isOverlay isReordering={isReordering} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

const SortableHabitItem = ({ habit, user, isOverlay, isReordering }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  let habitTargetCount = 3;
  try {
    habitTargetCount = JSON.parse(habit.schema).targetCount || 3;
  } catch (e) {}

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
            <h3 className="text-base sm:text-lg font-semibold text-stone-800 group-hover/row:text-emerald-600 transition-colors truncate">
              {habit.name}
            </h3>
          </div>
          <div className="shrink-0 flex flex-col justify-center">
            <div className="opacity-80 group-hover/row:opacity-100 transition-opacity pointer-events-none">
              <ActivityCalendar 
                dates={habit.logs?.map((l: any) => l.createdAt) || []} 
                weeks={3} 
                frequency={habit.frequency} 
                targetCount={habitTargetCount} 
                bedtime={user.bedtime} 
                weekStartsOn={user.weekStartsOn} 
              />
            </div>
          </div>
          <div className="shrink-0 text-stone-300 group-hover/row:text-emerald-600 transition-colors pointer-events-none">
            <QuillIconWavy className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
          </div>
        </Link>
      </div>
    </div>
  );

  if (isOverlay) return content;
  return <div ref={setNodeRef} style={style} className="relative bg-white">{content}</div>;
};

export function SortableHabitList({ items: initialItems, user, isReordering, dndContextId = "habits-dnd-context", isNested = false }: { items: any[], user: any, isReordering?: boolean, dndContextId?: string, isNested?: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  const handleDragStart = (event: any) => setActiveId(event.active.id);
  const handleDragCancel = () => setActiveId(null);
  
  const handleDragEnd = async (event: any) => {
    setActiveId(null);
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      
      const updates = newItems.map((item, index) => ({ id: item.id, order: index }));
      await reorderHabits(updates);
    }
  };

  const activeItem = items.find(i => i.id === activeId);

  return (
    <div className={isNested ? "divide-y divide-stone-100 flex flex-col w-full" : "bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col"}>
      <DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(habit => <SortableHabitItem key={habit.id} habit={habit} user={user} isReordering={isReordering} />)}
        </SortableContext>
        <DragOverlay>
          {activeItem ? <SortableHabitItem habit={activeItem} user={user} isOverlay isReordering={isReordering} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
