import re

with open("src/app/categories/[id]/SortableLists.tsx", "r") as f:
    content = f.read()

# Add id to first DndContext (Subcategories)
sub_target = "<DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>"
sub_replacement = '<DndContext id="subcategories-dnd-context" sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>'
content = content.replace(sub_target, sub_replacement)

# Add id to second DndContext (Habits)
habit_target = "<DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>"
habit_replacement = '<DndContext id="habits-dnd-context" sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>'
content = content.replace(habit_target, habit_replacement) # This will replace the remaining one, or both if they were identical

with open("src/app/categories/[id]/SortableLists.tsx", "w") as f:
    f.write(content)

