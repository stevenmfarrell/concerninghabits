'use client';

import { useState } from 'react';
import { DragEndEvent, DragStartEvent, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import toast from 'react-hot-toast';

// Drag-to-reorder for a flat list: optimistic local order, rolled back with a toast if the save
// fails, and re-seeded whenever the caller passes a genuinely new `initialItems` array (e.g. a
// fresh server render after something elsewhere added or removed an item) rather than only once
// on mount — otherwise this list would keep showing what it had at mount time indefinitely.
export function useReorderableList<T extends { id: string }>(
  initialItems: T[],
  persist: (newItems: T[]) => Promise<void>,
) {
  const [items, setItems] = useState(initialItems);

  // Adjusting state during render (not in an effect) so this only resets when the prop identity
  // actually changes, never on every render caused by, say, a drag in progress.
  const [prevInitialItems, setPrevInitialItems] = useState(initialItems);
  if (initialItems !== prevInitialItems) {
    setPrevInitialItems(initialItems);
    setItems(initialItems);
  }

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
  );

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));
  const handleDragCancel = () => setActiveId(null);

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const previous = items;
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);

    try {
      await persist(newItems);
    } catch (err) {
      console.error('Failed to save order', err);
      setItems(previous);
      toast.error('Failed to save order');
    }
  };

  return { items, activeId, sensors, handleDragStart, handleDragCancel, handleDragEnd };
}
