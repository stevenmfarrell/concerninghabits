import re

with open("src/app/settings/categories/CategoriesClient.tsx", "r") as f:
    content = f.read()

# 1. Remove useDroppable from SubcategoryDropZone and make it purely visual based on projected state
dropzone_target = """const SubcategoryDropZone = ({ parentId }: { parentId: string }) => {
  const { isOver, setNodeRef } = useDroppable({ id: `dropzone-${parentId}` });
  return (
    <div 
      ref={setNodeRef}
      className={`absolute right-4 top-1/2 -translate-y-1/2 h-10 px-4 rounded-lg border-2 flex items-center justify-center transition-colors z-50 shadow-sm ${isOver ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-dashed border-emerald-300 bg-white/90 text-emerald-600 font-medium'}`}
    >
      <span className="text-xs whitespace-nowrap pointer-events-none">Drop to Nest</span>
    </div>
  );
}"""

dropzone_replacement = """const SubcategoryDropZone = ({ isProjected }: { isProjected: boolean }) => {
  return (
    <div 
      className={`absolute right-4 top-1/2 -translate-y-1/2 h-10 px-4 rounded-lg border-2 flex items-center justify-center transition-colors z-50 shadow-sm ${isProjected ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold scale-110' : 'border-dashed border-stone-200 bg-white/80 text-stone-400 font-medium'}`}
    >
      <span className="text-xs whitespace-nowrap pointer-events-none">{isProjected ? 'Release to Nest' : 'Drag Right to Nest'}</span>
    </div>
  );
}"""
content = content.replace(dropzone_target, dropzone_replacement)

# 2. Add projectedParentId state
state_target = """  const [activeId, setActiveId] = useState<string | null>(null);"""
state_replacement = """  const [activeId, setActiveId] = useState<string | null>(null);
  const [projectedParentId, setProjectedParentId] = useState<string | null>(null);"""
content = content.replace(state_target, state_replacement)

# 3. Add handleDragMove to track delta.x and calculate projected parent
move_target = """  const handleDragCancel = () => {
    setActiveId(null);
  };"""

move_replacement = """  const handleDragCancel = () => {
    setActiveId(null);
    setProjectedParentId(null);
  };

  const handleDragMove = (event: any) => {
    const { active, over, delta } = event;
    if (!over) {
      setProjectedParentId(null);
      return;
    }
    
    let newParentId = null;
    if (delta.x > 30) {
      const sourceId = active.id;
      const targetId = over.id;
      const source = categories.find(c => c.id === sourceId);
      const target = categories.find(c => c.id === targetId);
      
      if (source && !source.parentId) {
        const sourceHasChildren = categories.some(c => c.parentId === sourceId);
        if (!sourceHasChildren) {
          if (targetId !== sourceId && target) {
            newParentId = target.parentId || target.id;
          } else {
            const topLevels = categories.filter(c => !c.parentId).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
            const idx = topLevels.findIndex(c => c.id === sourceId);
            if (idx > 0) newParentId = topLevels[idx - 1].id;
          }
        }
      }
    } else if (delta.x < -30) {
      // Outdent - no projected parent
    } else if (active.id !== over.id) {
       const target = categories.find(c => c.id === over.id);
       if (target && target.parentId) {
         newParentId = target.parentId;
       }
    }
    setProjectedParentId(newParentId);
  };"""
content = content.replace(move_target, move_replacement)

# 4. Attach handleDragMove to DndContext
dnd_target = """          onDragStart={handleDragStart}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}"""
dnd_replacement = """          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}"""
content = content.replace(dnd_target, dnd_replacement)

# 5. Pass projectedParentId down to renderCategoryRow
item_def_target = """const SortableItem = ({ cat, renderCategoryRow, childrenNode, disabled, activeId, activeHasChildren }: { cat: any, renderCategoryRow: any, childrenNode?: React.ReactNode, disabled?: boolean, activeId?: string | null, activeHasChildren?: boolean }) => {"""
item_def_replacement = """const SortableItem = ({ cat, renderCategoryRow, childrenNode, disabled, activeId, activeHasChildren, projectedParentId }: { cat: any, renderCategoryRow: any, childrenNode?: React.ReactNode, disabled?: boolean, activeId?: string | null, activeHasChildren?: boolean, projectedParentId?: string | null }) => {"""
content = content.replace(item_def_target, item_def_replacement)

item_return_target = """  return renderCategoryRow(cat, { attributes, listeners, setNodeRef, style, isDragging, activeId, activeHasChildren }, childrenNode);"""
item_return_replacement = """  return renderCategoryRow(cat, { attributes, listeners, setNodeRef, style, isDragging, activeId, activeHasChildren, projectedParentId }, childrenNode);"""
content = content.replace(item_return_target, item_return_replacement)

# 6. Pass projectedParentId into SortableItem mappings
map_target = """                        activeHasChildren={activeHasChildren} """
map_replacement = """                        activeHasChildren={activeHasChildren}
                        projectedParentId={projectedParentId} """
content = content.replace(map_target, map_replacement)

child_item_target = """                                  <SortableItem key={child.id} cat={child} renderCategoryRow={renderCategoryRow} disabled={isDraggingTopLevel} activeId={activeId} activeHasChildren={activeHasChildren} />"""
child_item_replacement = """                                  <SortableItem key={child.id} cat={child} renderCategoryRow={renderCategoryRow} disabled={isDraggingTopLevel} activeId={activeId} activeHasChildren={activeHasChildren} projectedParentId={projectedParentId} />"""
content = content.replace(child_item_target, child_item_replacement)

# 7. Update renderCategoryRow to use isProjected
render_row_target = """        {dndProps?.activeId && dndProps.activeId !== cat.id && !cat.parentId && !dndProps.activeHasChildren && !dndProps.isOverlay && (
          <SubcategoryDropZone parentId={cat.id} />
        )}"""
render_row_replacement = """        {dndProps?.activeId && dndProps.activeId !== cat.id && !cat.parentId && !dndProps.activeHasChildren && !dndProps.isOverlay && (
          <SubcategoryDropZone isProjected={dndProps.projectedParentId === cat.id} />
        )}"""
content = content.replace(render_row_target, render_row_replacement)

# 8. Clean up handleDragEnd to restore delta.x logic (since I removed it when I added the dropzones)
end_target = """    if (String(targetId).startsWith('dropzone-')) {
      newParentId = String(targetId).replace('dropzone-', '');
      target = categories.find(c => c.id === newParentId);
      targetId = newParentId;
    } else if (targetId !== sourceId && target) {
      if (target.parentId) {
        newParentId = target.parentId;
      } else {
        newParentId = null;
      }
    }"""
    
end_replacement = """    if (delta.x > 30) {
      if (!source.parentId) {
        const sourceHasChildren = categories.some(c => c.parentId === sourceId);
        if (!sourceHasChildren) {
          if (targetId !== sourceId && target) {
            newParentId = target.parentId || target.id;
          } else {
            const topLevels = categories.filter(c => !c.parentId).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
            const idx = topLevels.findIndex(c => c.id === sourceId);
            if (idx > 0) newParentId = topLevels[idx - 1].id;
          }
        }
      }
    } else if (delta.x < -30) {
      if (source.parentId) {
        newParentId = null;
      }
    } else if (targetId !== sourceId && target) {
      if (source.parentId && target.parentId) {
        newParentId = target.parentId;
      }
    }"""
content = content.replace(end_target, end_replacement)

# Restore splicing logic (since I changed it to accommodate dropzones)
splice_target = """      if (String(over.id).startsWith('dropzone-')) {
        insertIndex = siblings.length;
      } else if (targetId !== sourceId && target) {"""
splice_replacement = """      if (targetId !== sourceId && target) {"""
content = content.replace(splice_target, splice_replacement)

with open("src/app/settings/categories/CategoriesClient.tsx", "w") as f:
    f.write(content)

