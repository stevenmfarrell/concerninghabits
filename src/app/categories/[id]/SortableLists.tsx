'use client';

import React, { useOptimistic, useRef, useState } from 'react';
import Link from 'next/link';
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ChevronRight, ClipboardList } from 'lucide-react';
import Icon from '../../../components/Icon';
import ActivityCalendar from '../../../components/ActivityCalendar';
import { reorderCategories } from '../../actions/db';
import { reorderHabits } from '../../actions/db';
import { NO_CADENCE, parseCadence } from '@/lib/cadence';
import type { RowStatus as Status } from '@/lib/dueList';
import type { HabitListItem, SessionUser, SubcategoryListItem } from '@/lib/types';
import { isSharedHabit, type Person } from '@/lib/userColors';
import { useReorderableList } from './useReorderableList';
import LogHabitButton from '@/components/logging/LogHabitButton';
import HoldToLog from '@/components/logging/HoldToLog';
import LogRing from '@/components/logging/LogRing';
import type { HabitLogger } from '@/components/logging/useHabitLogger';
import { zoomAway } from '@/components/logging/zoomAway';
import RowGesture from '@/components/logging/RowGesture';
import { useSkipSwipe } from '@/components/logging/skipping';
import CategoryLogDialog from '@/components/logging/CategoryLogDialog';
import { POINTER_ONLY } from '@/components/logging/pointerOnly';
import RowStatus from '@/components/RowStatus';
import CadenceLabel from '@/components/CadenceLabel';
import QuillIconWavy from '@/components/QuillIconWavy';

import { Users } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { DEFAULT_CATEGORY_ICON } from '@/lib/constants';

interface SortableRowProps {
  user: SessionUser;
  // Everyone's colors as this user sees them, for coloring shared habits' calendars by person
  people: Record<string, Person>;
  isOverlay?: boolean;
  isReordering?: boolean;
}

// A subcategory as a header row, linking to its page, with its habits under it. Pressing and holding
// the header picks one of its habits to log, as a category row does (see CategoryLogDialog), with a
// button for it at the row's end with a mouse. With `statuses` (its own and its habits', by id), it
// has a ring in place of its icon's tile instead, as big as its habits', that opens the picker on a
// tap (see LogRing), with its cadence under its name, and its habits have rings too.
const SortableSubcategoryItem = ({ sub, statuses, user, people, isOverlay, isReordering }: SortableRowProps & { sub: SubcategoryListItem; statuses?: Record<string, Status> }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id });
  const [pickerOpen, setPickerOpen] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  const subHabits = sub.habits ?? [];
  // Not while reordering, where a press on the row is the start of a drag
  const holdable = subHabits.length > 0 && !isReordering && !isOverlay;
  const label = `Log a habit in ${sub.name}`;
  const status = statuses?.[sub.id];
  const cadence = parseCadence(sub.cadence, NO_CADENCE);
  // Entries being logged from the picker that the page doesn't show yet (see useHabitLogger)
  const [pending, addPending] = useOptimistic(0, (count, added: number) => count + added);

  const header = (
    // The link is stretched over the whole row (its ::after), so the padding is tappable too, with the
    // grip and the button above it
    <div className={`relative py-3 pane-inset flex items-center ${status ? 'gap-4 sm:gap-5' : 'gap-2 sm:gap-4'} group/header transition-colors ${subHabits.length > 0 ? 'border-b border-line-subtle' : ''} hover:bg-surface-subtle`}>
      {isReordering && (
        <div {...attributes} {...listeners} className="relative z-10 cursor-grab active:cursor-grabbing text-ink-faint hover:text-ink-muted touch-none shrink-0 p-1 -ml-2">
          <GripVertical className="w-5 h-5" />
        </div>
      )}
      {status && (
        <LogRing
          status={status}
          pending={pending}
          label={subHabits.length > 0 ? label : 'No habits to log'}
          onClick={() => setPickerOpen(true)}
          disabled={!holdable}
          color="blue"
        />
      )}
      <Link href={`/categories/${sub.id}`} className="flex-1 flex items-center gap-3 min-w-0 after:absolute after:inset-0">
        {!status && (
          <div className="w-8 h-8 rounded-lg bg-category-soft-strong flex items-center justify-center text-category-ink-strong shrink-0">
            <Icon name={sub.icon || DEFAULT_CATEGORY_ICON} className="w-4 h-4" />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="font-semibold text-ink group-hover/header:text-category-ink-strong transition-colors flex items-center gap-1.5 min-w-0">
            {status && <Icon name={sub.icon || DEFAULT_CATEGORY_ICON} className="w-4 h-4 shrink-0 text-category-ink" />}
            <span className="truncate">{sub.name}</span>
          </h3>
          {status
            ? cadence.type !== 'none' && <CadenceLabel cadence={cadence} weekStartsOn={user.weekStartsOn} />
            : <p className="text-xs text-ink-muted truncate mt-0.5">{subHabits.length} habits</p>}
        </div>
        {/* With a mouse, the picker's button takes its place */}
        <ChevronRight className={`w-5 h-5 shrink-0 text-ink-faint group-hover/header:text-category-ink transition-colors ${holdable && !status ? 'pointer-fine:hidden' : ''}`} />
      </Link>
      {holdable && !status && (
        <span className={`${POINTER_ONLY} relative z-10`}>
          <IconButton variant="category-soft" onClick={() => setPickerOpen(true)} title={label} aria-label={label} className="w-16 h-10">
            <QuillIconWavy className="w-5 h-5" strokeWidth={2.5} />
          </IconButton>
        </span>
      )}
    </div>
  );

  const content = (
    <div className={`flex flex-col relative w-full ${isOverlay ? 'shadow-2xl scale-[1.02] z-50 rounded-2xl' : ''}`}>
      {holdable ? (
        <RowGesture onCommit={() => setPickerOpen(true)} label={label} tone="category" hiddenButton={!status}>
          {header}
        </RowGesture>
      ) : header}

      {/* Habits */}
      {!isOverlay && subHabits.length > 0 && (
        <SortableHabitList items={subHabits} statuses={statuses} user={user} people={people} isReordering={isReordering} dndContextId={`habits-dnd-${sub.id}`} bare nested holdToLog showCadence={!!statuses} />
      )}
      {pickerOpen && (
        <CategoryLogDialog
          category={{ name: sub.name, icon: sub.icon, sections: [{ subcategory: null, habits: subHabits }] }}
          onClose={() => setPickerOpen(false)}
          leave={status ? () => void addPending(1) : undefined}
        />
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
// as one list of rows: each subcategory is a tinted header row with its habits under it. Habits are
// logged by pressing and holding their rows (see HoldToLog), and a subcategory's header by holding
// it. With `statuses` (the habits' and subcategories', by id), each row has a ring at its start too,
// that logs it on a tap and checks once it's done (see LogRing), and its cadence under its name.
export function SortableCategoryItemList({ items: initialItems, statuses, user, people, isReordering }: { items: CategoryItem[], statuses?: Record<string, Status>, user: SessionUser, people: Record<string, Person>, isReordering?: boolean }) {
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
            ? <SortableHabitItem key={item.id} habit={item.data} status={statuses?.[item.id]} user={user} people={people} isReordering={isReordering} holdToLog showCadence={!!statuses} />
            : <SortableSubcategoryItem key={item.id} sub={item.data} statuses={statuses} user={user} people={people} isReordering={isReordering} />
          )}
        </SortableContext>
        <DragOverlay>
          {activeItem?.type === 'habit' && <SortableHabitItem habit={activeItem.data} status={statuses?.[activeItem.id]} user={user} people={people} isOverlay isReordering={isReordering} holdToLog showCadence={!!statuses} />}
          {activeItem?.type === 'subcategory' && <SortableSubcategoryItem sub={activeItem.data} statuses={statuses} user={user} people={people} isOverlay isReordering={isReordering} />}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// `status` is what the Agenda and Habits pages show: a ring at the row's start that logs it on a tap
// (see LogRing), in place of its Log button, and beside its calendar how far off it's due (see
// RowStatus). With `leavesWhenDone` (the Agenda), an entry that makes it done sends the row away, and
// one that can be skipped (its status's `skip`) is skipped (or postponed) by swiping it to the left,
// going the same way.
// `nested` indents the row under its subcategory's header, its name lined up with the subcategory's
// `holdToLog` logs the row by pressing and holding it (see HoldToLog), keeping its Log button only
// with a mouse, and gives it more room (as tall as a category row, with or without a ring).
// `showCadence` puts the habit's cadence under its name (e.g.
// "EVERY 3 DAYS"), as the Agenda page does
const SortableHabitItem = ({ habit, status, user, people, isOverlay, isReordering, nested, holdToLog, showCadence, leavesWhenDone }: SortableRowProps & { habit: HabitListItem; status?: Status; nested?: boolean; holdToLog?: boolean; showCadence?: boolean; leavesWhenDone?: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id });
  const rowRef = useRef<HTMLDivElement | null>(null);
  // An entry that makes it done sends the row away, on to the Agenda's Done chips
  const leave = () => (leavesWhenDone && status && status.done + 1 >= status.needed ? zoomAway(rowRef.current) : undefined);

  // On the Agenda, swiped to the left to skip it, while it can be (its status's `skip`)
  const skipLabels = leavesWhenDone ? status?.skip : undefined;
  const swipe = useSkipSwipe({ kind: 'habit', id: habit.id, name: habit.name }, skipLabels, rowRef);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  const logs = habit.logs ?? [];
  const isShared = isSharedHabit(habit.userId, habit.memberCount ?? 1, logs);
  const cadence = parseCadence(habit.cadence);

  // An Agenda row (with a ring) is roomier side to side and less so top to bottom, with a larger name.
  // A row held to log elsewhere is as tall as a category row.
  const spacing = status ? 'py-3 gap-4 sm:gap-5' : `${holdToLog ? 'py-4 min-h-18' : 'py-3'} gap-2 sm:gap-4`;

  // `logButton` is the Log button for the row's end, and `logger` the row's logger for its ring,
  // given by HoldToLog when the row is held to log
  const renderContent = (logButton?: React.ReactNode, logger?: HabitLogger) => (
    <div className={`flex items-stretch transition-colors group/row relative ${isDragging ? 'opacity-30 bg-surface-muted' : 'bg-surface hover:bg-surface-subtle'} ${isOverlay ? 'shadow-2xl scale-[1.02] z-50 rounded-xl' : ''}`}>
      <div className={`flex-1 flex items-center ${spacing} ${nested ? (status ? 'pane-inset-nested-ring' : 'pane-inset-nested') : 'pane-inset'} min-w-0`}>
        {isReordering && (
          <div {...attributes} {...listeners} className="relative z-10 cursor-grab active:cursor-grabbing text-ink-faint hover:text-ink-muted touch-none shrink-0 p-1 -ml-2">
            <GripVertical className="w-5 h-5" />
          </div>
        )}
        {/* Without a logger (while reordering), just for show, so the row doesn't shift */}
        {status && (
          <LogRing
            status={status}
            pending={logger?.pending}
            label={logger?.hasForm ? `Log ${habit.name} (opens a form)` : `Log ${habit.name}`}
            onClick={logger?.start}
            disabled={!logger || logger.busy}
          />
        )}
        {/* Stretched over the whole row (its ::after), so the row's padding is tappable too */}
        <Link href={`/log/${habit.id}`} className="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-6 min-w-0 w-full justify-between after:absolute after:inset-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`${status ? 'text-lg' : 'text-base sm:text-lg'} font-semibold text-ink group-hover/row:text-accent-ink transition-colors truncate`}>
                {habit.name}
              </h3>
              {/* The ring has no room for the Log button's form icon, so it's here: a tap on the ring
                  opens a form rather than logging (its label says so for screen readers) */}
              {status && logger?.hasForm && (
                <ClipboardList className="w-4 h-4 text-ink-subtle shrink-0" aria-hidden="true" />
              )}
              {(habit.memberCount ?? 1) > 1 && (
                <Users className="w-4 h-4 text-ink-subtle shrink-0" aria-label="Shared" />
              )}
            </div>
            {/* None for a habit with no cadence */}
            {showCadence && cadence.type !== 'none' && <CadenceLabel cadence={cadence} weekStartsOn={user.weekStartsOn} />}
          </div>
          <div className={`shrink-0 flex items-center ${holdToLog ? 'gap-4' : 'gap-3'}`}>
            {status && <RowStatus days={status.dueInDays} />}
            <div className="opacity-80 group-hover/row:opacity-100 transition-opacity pointer-events-none">
              <ActivityCalendar
                dates={logs.map(l => l.createdAt)}
                loggedBy={isShared ? logs.map(l => l.userId) : undefined}
                people={isShared ? people : undefined}
                weeks={4}
                size="xs"
                emptyColor="bg-surface-strong/70"
                futureColor="bg-transparent"
                cadence={cadence}
                skippedDays={habit.skips?.map(skip => skip.day)}
                bedtime={user.bedtime} 
                weekStartsOn={user.weekStartsOn}
                timeZone={user.timeZone}
              />
            </div>
          </div>
        </Link>
        {/* Logs in place, the same as the Log Habit button on the habit's page. Left out when there's
            none, so it leaves no gap at the row's end and the calendar lines up with category rows' */}
        {(logButton || (!isReordering && !isOverlay && !holdToLog)) && (
          <span className="relative z-10 shrink-0 flex">
            {logButton ?? <LogHabitButton habit={habit} />}
          </span>
        )}
      </div>
    </div>
  );

  if (isOverlay) return renderContent();
  return (
    <div
      ref={node => {
        setNodeRef(node);
        rowRef.current = node;
      }}
      style={style}
      className="relative bg-surface"
    >
      {holdToLog && !isReordering ? <HoldToLog habit={habit} ownButton={!!status} leave={leave} swipe={swipe}>{renderContent}</HoldToLog> : renderContent()}
    </div>
  );
};

// `statuses` are what some habits' rows show beside their calendars, by habit id (see SortableHabitItem).
// `bare` leaves out the list's own card, for a list laid straight on a page's pane; `nested` indents
// its rows under a subcategory's header. `holdToLog` logs a row by pressing and holding it rather than with a Log
// button. `showCadence` puts each habit's cadence under its name, and `leavesWhenDone` sends a row
// away once an entry makes it done (see SortableHabitItem).
export function SortableHabitList({ items: initialItems, statuses, user, people, isReordering, dndContextId = "habits-dnd-context", bare = false, nested = false, holdToLog = false, showCadence = false, leavesWhenDone = false }: { items: HabitListItem[], statuses?: Record<string, Status>, user: SessionUser, people: Record<string, Person>, isReordering?: boolean, dndContextId?: string, bare?: boolean, nested?: boolean, holdToLog?: boolean, showCadence?: boolean, leavesWhenDone?: boolean }) {
  const { items, activeId, sensors, handleDragStart, handleDragCancel, handleDragEnd } = useReorderableList(initialItems, async (newItems) => {
    const updates = newItems.map((item, index) => ({ id: item.id, order: index }));
    await reorderHabits(updates);
  });

  const activeItem = items.find(i => i.id === activeId);

  return (
    <div className={bare ? "divide-y divide-line-subtle flex flex-col w-full" : "bg-surface rounded-2xl shadow-sm border border-line-subtle overflow-hidden divide-y divide-line-subtle flex flex-col"}>
      <DndContext id={dndContextId} sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(habit => <SortableHabitItem key={habit.id} habit={habit} status={statuses?.[habit.id]} user={user} people={people} isReordering={isReordering} nested={nested} holdToLog={holdToLog} showCadence={showCadence} leavesWhenDone={leavesWhenDone} />)}
        </SortableContext>
        <DragOverlay>
          {activeItem ? <SortableHabitItem habit={activeItem} user={user} people={people} status={statuses?.[activeItem.id]} isOverlay isReordering={isReordering} nested={nested} showCadence={showCadence} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
