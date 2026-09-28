import re

with open("src/app/categories/[id]/page.tsx", "r") as f:
    content = f.read()

target = """<SortableSubcategoryList items={category.children} isReordering={isReordering} />"""
replacement = """<SortableSubcategoryList items={category.children} user={user} isReordering={isReordering} />"""
content = content.replace(target, replacement)

# Swap order so direct habits are shown before subcategories? Actually they are already ordered like that or subcategories first?
# Wait, my snippet showed subcategories first, then habits.
# Let's swap them.

swap_target = """        {isTopLevel && category.children && category.children.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-stone-900 px-2">Subcategories</h2>
            <SortableSubcategoryList items={category.children} user={user} isReordering={isReordering} />
          </div>
        )}

        {category.habits && category.habits.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-stone-900 px-2">Habits in {category.name}</h2>
            <SortableHabitList items={category.habits} user={user} isReordering={isReordering} />
          </div>
        )}"""

swap_replacement = """        {category.habits && category.habits.length > 0 && (
          <div className="space-y-4">
            <SortableHabitList items={category.habits} user={user} isReordering={isReordering} dndContextId="direct-habits-dnd-context" />
          </div>
        )}

        {isTopLevel && category.children && category.children.length > 0 && (
          <div className="space-y-4">
            <SortableSubcategoryList items={category.children} user={user} isReordering={isReordering} />
          </div>
        )}"""
content = content.replace(swap_target, swap_replacement)

with open("src/app/categories/[id]/page.tsx", "w") as f:
    f.write(content)
