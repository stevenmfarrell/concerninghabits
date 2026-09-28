import re

with open("src/app/categories/[id]/SortableLists.tsx", "r") as f:
    content = f.read()

# Subcategories
sub_item_target = """const SortableSubcategoryItem = ({ sub, isOverlay, ...props }: any) => {"""
sub_item_replacement = """const SortableSubcategoryItem = ({ sub, isOverlay, isReordering, ...props }: any) => {"""
content = content.replace(sub_item_target, sub_item_replacement)

sub_handle_target = """        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none shrink-0 p-1 -ml-2">
          <GripVertical className="w-5 h-5" />
        </div>"""
sub_handle_replacement = """        {isReordering && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none shrink-0 p-1 -ml-2">
            <GripVertical className="w-5 h-5" />
          </div>
        )}"""
content = content.replace(sub_handle_target, sub_handle_replacement)

sub_list_target = """export function SortableSubcategoryList({ items: initialItems }: { items: any[] }) {"""
sub_list_replacement = """export function SortableSubcategoryList({ items: initialItems, isReordering }: { items: any[], isReordering?: boolean }) {"""
content = content.replace(sub_list_target, sub_list_replacement)

sub_map_target = """          {items.map(sub => <SortableSubcategoryItem key={sub.id} sub={sub} />)}"""
sub_map_replacement = """          {items.map(sub => <SortableSubcategoryItem key={sub.id} sub={sub} isReordering={isReordering} />)}"""
content = content.replace(sub_map_target, sub_map_replacement)

sub_overlay_target = """{activeItem ? <SortableSubcategoryItem sub={activeItem} isOverlay /> : null}"""
sub_overlay_replacement = """{activeItem ? <SortableSubcategoryItem sub={activeItem} isOverlay isReordering={isReordering} /> : null}"""
content = content.replace(sub_overlay_target, sub_overlay_replacement)

# Habits
habit_item_target = """const SortableHabitItem = ({ habit, user, isOverlay }: any) => {"""
habit_item_replacement = """const SortableHabitItem = ({ habit, user, isOverlay, isReordering }: any) => {"""
content = content.replace(habit_item_target, habit_item_replacement)

habit_handle_target = """        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none shrink-0 p-1 -ml-2">
          <GripVertical className="w-5 h-5" />
        </div>"""
habit_handle_replacement = """        {isReordering && (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none shrink-0 p-1 -ml-2">
            <GripVertical className="w-5 h-5" />
          </div>
        )}"""
content = content.replace(habit_handle_target, habit_handle_replacement)

habit_list_target = """export function SortableHabitList({ items: initialItems, user }: { items: any[], user: any }) {"""
habit_list_replacement = """export function SortableHabitList({ items: initialItems, user, isReordering }: { items: any[], user: any, isReordering?: boolean }) {"""
content = content.replace(habit_list_target, habit_list_replacement)

habit_map_target = """          {items.map(habit => <SortableHabitItem key={habit.id} habit={habit} user={user} />)}"""
habit_map_replacement = """          {items.map(habit => <SortableHabitItem key={habit.id} habit={habit} user={user} isReordering={isReordering} />)}"""
content = content.replace(habit_map_target, habit_map_replacement)

habit_overlay_target = """{activeItem ? <SortableHabitItem habit={activeItem} user={user} isOverlay /> : null}"""
habit_overlay_replacement = """{activeItem ? <SortableHabitItem habit={activeItem} user={user} isOverlay isReordering={isReordering} /> : null}"""
content = content.replace(habit_overlay_target, habit_overlay_replacement)

with open("src/app/categories/[id]/SortableLists.tsx", "w") as f:
    f.write(content)
