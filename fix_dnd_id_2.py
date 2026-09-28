import re

with open("src/app/categories/[id]/SortableLists.tsx", "r") as f:
    content = f.read()

# The second occurrence needs to be habits-dnd-context
# We can find it by looking for the one inside SortableHabitList
target_block = """export function SortableHabitList({ items: initialItems, user }: { items: any[], user: any }) {
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
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col">
      <DndContext id="subcategories-dnd-context" """

replacement_block = """export function SortableHabitList({ items: initialItems, user }: { items: any[], user: any }) {
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
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col">
      <DndContext id="habits-dnd-context" """

content = content.replace(target_block, replacement_block)

with open("src/app/categories/[id]/SortableLists.tsx", "w") as f:
    f.write(content)
