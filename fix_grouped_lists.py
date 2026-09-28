import re

with open("src/app/categories/[id]/SortableLists.tsx", "r") as f:
    content = f.read()

# 1. Update SortableHabitList to accept dndContextId
habit_list_target = """export function SortableHabitList({ items: initialItems, user, isReordering }: { items: any[], user: any, isReordering?: boolean }) {"""
habit_list_replacement = """export function SortableHabitList({ items: initialItems, user, isReordering, dndContextId = "habits-dnd-context" }: { items: any[], user: any, isReordering?: boolean, dndContextId?: string }) {"""
content = content.replace(habit_list_target, habit_list_replacement)

dnd_target = """<DndContext id="habits-dnd-context" """
dnd_replacement = """<DndContext id={dndContextId} """
content = content.replace(dnd_target, dnd_replacement)

# 2. Update SortableSubcategoryItem
sub_item_target = """const SortableSubcategoryItem = ({ sub, isOverlay, isReordering, ...props }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  const content = (
    <div className={`p-4 sm:p-5 transition-colors flex justify-between items-center group relative ${isDragging ? 'opacity-30 bg-stone-100' : 'bg-white hover:bg-stone-50'} ${isOverlay ? 'shadow-2xl scale-[1.02] z-50 rounded-xl' : ''}`}>
      <div className="flex items-center gap-3 w-full">
        {isReordering && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none shrink-0 p-1 -ml-2">
            <GripVertical className="w-5 h-5" />
          </div>
        )}
        <Link href={`/categories/${sub.id}`} className="flex-1 flex items-center justify-between min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors shrink-0">
              <Icon name={sub.icon || 'Folder'} className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-800 group-hover:text-emerald-600 transition-colors">{sub.name}</h3>
              <p className="text-sm text-stone-500">{sub.habits?.length || 0} habits</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-emerald-600 transition-colors shrink-0" />
        </Link>
      </div>
    </div>
  );

  if (isOverlay) return content;
  return <div ref={setNodeRef} style={style} className="relative bg-white">{content}</div>;
};"""

sub_item_replacement = """import { ChevronDown, ExternalLink } from 'lucide-react';

const SortableSubcategoryItem = ({ sub, user, isOverlay, isReordering, ...props }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id });
  const [isOpen, setIsOpen] = useState(true);
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  const content = (
    <div className={`flex flex-col transition-colors relative ${isDragging ? 'opacity-30 bg-stone-100' : 'bg-white hover:bg-stone-50/30'} ${isOverlay ? 'shadow-2xl scale-[1.02] z-50 rounded-xl' : ''}`}>
      {/* Header */}
      <div className="p-4 sm:p-5 flex justify-between items-center group/header border-b border-stone-100">
        <div className="flex items-center gap-3 w-full">
          {isReordering && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none shrink-0 p-1 -ml-2">
              <GripVertical className="w-5 h-5" />
            </div>
          )}
          
          <button onClick={() => setIsOpen(!isOpen)} className="flex-1 flex items-center justify-between min-w-0 text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <Icon name={sub.icon || 'Folder'} className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800">{sub.name}</h3>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              <Link 
                href={`/categories/${sub.id}`} 
                onClick={(e) => e.stopPropagation()}
                className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Open Subcategory Page"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
              <div className="p-1 text-stone-400 hover:text-stone-600 transition-colors">
                {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </div>
            </div>
          </button>
        </div>
      </div>
      
      {/* Habits */}
      {isOpen && !isOverlay && sub.habits && sub.habits.length > 0 && (
        <div className="p-2 sm:p-4 bg-stone-50/50">
          <SortableHabitList items={sub.habits} user={user} isReordering={isReordering} dndContextId={`habits-dnd-${sub.id}`} />
        </div>
      )}
    </div>
  );

  if (isOverlay) return content;
  return <div ref={setNodeRef} style={style} className="relative bg-white overflow-hidden">{content}</div>;
};"""

content = content.replace(sub_item_target, sub_item_replacement)

# 3. Update SortableSubcategoryList to pass user
list_target = """export function SortableSubcategoryList({ items: initialItems, isReordering }: { items: any[], isReordering?: boolean }) {"""
list_replacement = """export function SortableSubcategoryList({ items: initialItems, user, isReordering }: { items: any[], user: any, isReordering?: boolean }) {"""
content = content.replace(list_target, list_replacement)

map_target = """{items.map(sub => <SortableSubcategoryItem key={sub.id} sub={sub} isReordering={isReordering} />)}"""
map_replacement = """{items.map(sub => <SortableSubcategoryItem key={sub.id} sub={sub} user={user} isReordering={isReordering} />)}"""
content = content.replace(map_target, map_replacement)

overlay_target = """{activeItem ? <SortableSubcategoryItem sub={activeItem} isOverlay isReordering={isReordering} /> : null}"""
overlay_replacement = """{activeItem ? <SortableSubcategoryItem sub={activeItem} user={user} isOverlay isReordering={isReordering} /> : null}"""
content = content.replace(overlay_target, overlay_replacement)

with open("src/app/categories/[id]/SortableLists.tsx", "w") as f:
    f.write(content)

