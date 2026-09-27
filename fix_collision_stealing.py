import re

with open("src/app/settings/categories/CategoriesClient.tsx", "r") as f:
    content = f.read()

# 1. Update SortableItem to support disabled
item_def_target = """const SortableItem = ({ cat, renderCategoryRow, childrenNode }: { cat: any, renderCategoryRow: any, childrenNode?: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });"""

item_def_replacement = """const SortableItem = ({ cat, renderCategoryRow, childrenNode, disabled }: { cat: any, renderCategoryRow: any, childrenNode?: React.ReactNode, disabled?: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id, disabled });"""
content = content.replace(item_def_target, item_def_replacement)

# 2. Extract isDraggingTopLevel and pass disabled to children
map_target = """              ) : (
                categories.filter(c => !c.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(parent => {
                  const children = categories.filter(c => c.parentId === parent.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                  return (
                    <Fragment key={parent.id}>
                      <SortableItem 
                        cat={parent} 
                        renderCategoryRow={renderCategoryRow} """

map_replacement = """              ) : (
                categories.filter(c => !c.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(parent => {
                  const children = categories.filter(c => c.parentId === parent.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                  const activeCat = activeId ? categories.find(c => c.id === activeId) : null;
                  const isDraggingTopLevel = activeCat ? !activeCat.parentId : false;
                  
                  return (
                    <Fragment key={parent.id}>
                      <SortableItem 
                        cat={parent} 
                        renderCategoryRow={renderCategoryRow} """
content = content.replace(map_target, map_replacement)

child_item_target = """                                {children.map(child => (
                                  <SortableItem key={child.id} cat={child} renderCategoryRow={renderCategoryRow} />
                                ))}"""
child_item_replacement = """                                {children.map(child => (
                                  <SortableItem key={child.id} cat={child} renderCategoryRow={renderCategoryRow} disabled={isDraggingTopLevel} />
                                ))}"""
content = content.replace(child_item_target, child_item_replacement)

# 3. Fix the aggressive adoption logic in handleDragEnd
end_logic_target = """    } else if (delta.x < -30) {
      if (source.parentId) {
        newParentId = null;
        isLevelChanged = true;
      }
    } else if (sourceId !== targetId && target) {
      newParentId = target.parentId;
    }"""

end_logic_replacement = """    } else if (delta.x < -30) {
      if (source.parentId) {
        newParentId = null;
        isLevelChanged = true;
      }
    } else if (sourceId !== targetId && target) {
      if (source.parentId && target.parentId) {
        newParentId = target.parentId;
      }
    }"""
content = content.replace(end_logic_target, end_logic_replacement)

# 4. We also need to fix targetId resolution in handleDragEnd if target is disabled (wait, if it's disabled, dnd-kit won't ever set over.id to a child!)
# So over.id will ALWAYS be the parent!
# If over.id is the parent, targetId is the parent. We don't need any complex target resolution!

with open("src/app/settings/categories/CategoriesClient.tsx", "w") as f:
    f.write(content)

