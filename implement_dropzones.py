import re

with open("src/app/settings/categories/CategoriesClient.tsx", "r") as f:
    content = f.read()

# Add useDroppable to imports
content = content.replace(
    "import { DndContext, closestCenter, pointerWithin, rectIntersection, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, MeasuringStrategy, DragOverlay, defaultDropAnimationSideEffects, CollisionDetection } from '@dnd-kit/core';",
    "import { DndContext, closestCenter, pointerWithin, rectIntersection, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, MeasuringStrategy, DragOverlay, defaultDropAnimationSideEffects, CollisionDetection, useDroppable } from '@dnd-kit/core';"
)

# Add SubcategoryDropZone
dropzone_code = """
const SubcategoryDropZone = ({ parentId }: { parentId: string }) => {
  const { isOver, setNodeRef } = useDroppable({ id: `dropzone-${parentId}` });
  return (
    <div 
      ref={setNodeRef}
      className={`absolute right-4 top-1/2 -translate-y-1/2 h-10 px-4 rounded-lg border-2 flex items-center justify-center transition-colors z-50 shadow-sm ${isOver ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-dashed border-emerald-300 bg-white/90 text-emerald-600 font-medium'}`}
    >
      <span className="text-xs whitespace-nowrap pointer-events-none">Drop to Nest</span>
    </div>
  );
}

const SortableItem"""
content = content.replace("const SortableItem", dropzone_code)

# Add activeId and activeHasChildren to dndProps
# Wait, SortableItem needs to accept activeId and activeHasChildren
item_def_target = """const SortableItem = ({ cat, renderCategoryRow, childrenNode, disabled }: { cat: any, renderCategoryRow: any, childrenNode?: React.ReactNode, disabled?: boolean }) => {"""
item_def_replacement = """const SortableItem = ({ cat, renderCategoryRow, childrenNode, disabled, activeId, activeHasChildren }: { cat: any, renderCategoryRow: any, childrenNode?: React.ReactNode, disabled?: boolean, activeId?: string | null, activeHasChildren?: boolean }) => {"""
content = content.replace(item_def_target, item_def_replacement)

# Pass them into renderCategoryRow
item_return_target = """  return renderCategoryRow(cat, { attributes, listeners, setNodeRef, style, isDragging }, childrenNode);"""
item_return_replacement = """  return renderCategoryRow(cat, { attributes, listeners, setNodeRef, style, isDragging, activeId, activeHasChildren }, childrenNode);"""
content = content.replace(item_return_target, item_return_replacement)

# Update renderCategoryRow to inject the drop zone
render_def_target = """        className={`transition-colors group ${dndProps?.isOverlay ? 'bg-stone-50 z-50 shadow-2xl rounded-xl cursor-grabbing scale-[1.02]' : dndProps?.isDragging ? 'opacity-30 bg-stone-100 rounded-xl dashed-border' : 'bg-white'}`}"""
render_def_replacement = """        className={`transition-colors group relative ${dndProps?.isOverlay ? 'bg-stone-50 z-50 shadow-2xl rounded-xl cursor-grabbing scale-[1.02]' : dndProps?.isDragging ? 'opacity-30 bg-stone-100 rounded-xl dashed-border' : 'bg-white'}`}"""
content = content.replace(render_def_target, render_def_replacement)

li_close_target = """          </>
        )}
        </div>
        {childrenNode}
      </li>"""
li_close_replacement = """          </>
        )}
        </div>
        {dndProps?.activeId && dndProps.activeId !== cat.id && !cat.parentId && !dndProps.activeHasChildren && !dndProps.isOverlay && (
          <SubcategoryDropZone parentId={cat.id} />
        )}
        {childrenNode}
      </li>"""
content = content.replace(li_close_target, li_close_replacement)

# Update CategoriesClient to compute activeHasChildren and pass it to SortableItems
map_target = """                  const activeCat = activeId ? categories.find(c => c.id === activeId) : null;
                  const isDraggingTopLevel = activeCat ? !activeCat.parentId : false;
                  
                  return (
                    <Fragment key={parent.id}>
                      <SortableItem 
                        cat={parent} 
                        renderCategoryRow={renderCategoryRow} """
map_replacement = """                  const activeCat = activeId ? categories.find(c => c.id === activeId) : null;
                  const isDraggingTopLevel = activeCat ? !activeCat.parentId : false;
                  const activeHasChildren = activeId ? categories.some(c => c.parentId === activeId) : false;
                  
                  return (
                    <Fragment key={parent.id}>
                      <SortableItem 
                        cat={parent} 
                        renderCategoryRow={renderCategoryRow}
                        activeId={activeId}
                        activeHasChildren={activeHasChildren} """
content = content.replace(map_target, map_replacement)

child_item_target = """                                {children.map(child => (
                                  <SortableItem key={child.id} cat={child} renderCategoryRow={renderCategoryRow} disabled={isDraggingTopLevel} />
                                ))}"""
child_item_replacement = """                                {children.map(child => (
                                  <SortableItem key={child.id} cat={child} renderCategoryRow={renderCategoryRow} disabled={isDraggingTopLevel} activeId={activeId} activeHasChildren={activeHasChildren} />
                                ))}"""
content = content.replace(child_item_target, child_item_replacement)

# Update handleDragEnd logic
drag_end_target = """  const handleDragEnd = async (event: any) => {
    setActiveId(null);
    const { active, over, delta } = event;
    if (!over) return;
    
    const sourceId = active.id;
    const targetId = over.id;
    const source = categories.find(c => c.id === sourceId);
    const target = categories.find(c => c.id === targetId);
    if (!source) return;

    let newParentId = source.parentId;
    let isLevelChanged = false;

    if (delta.x > 30) {
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
          isLevelChanged = true;
        }
      }
    } else if (delta.x < -30) {
      if (source.parentId) {
        newParentId = null;
        isLevelChanged = true;
      }
    } else if (sourceId !== targetId && target) {
      if (source.parentId && target.parentId) {
        newParentId = target.parentId;
      }
    }

    if (newParentId === source.id) newParentId = null;
    
    if (sourceId === targetId && !isLevelChanged) return;"""

drag_end_replacement = """  const handleDragEnd = async (event: any) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    
    const sourceId = active.id;
    let targetId = over.id;
    const source = categories.find(c => c.id === sourceId);
    if (!source) return;

    let newParentId = source.parentId;
    let target = categories.find(c => c.id === targetId);
    
    if (String(targetId).startsWith('dropzone-')) {
      newParentId = String(targetId).replace('dropzone-', '');
      target = categories.find(c => c.id === newParentId);
      targetId = newParentId;
    } else if (targetId !== sourceId && target) {
      if (target.parentId) {
        newParentId = target.parentId;
      } else {
        newParentId = null;
      }
    }

    if (newParentId === source.id) newParentId = null;
    
    if (newParentId !== null && !source.parentId) {
      const sourceHasChildren = categories.some(c => c.parentId === sourceId);
      if (sourceHasChildren) newParentId = null;
    }
    
    let isLevelChanged = newParentId !== source.parentId;
    
    if (sourceId === targetId && !isLevelChanged) return;"""
content = content.replace(drag_end_target, drag_end_replacement)

# Fix splicing insertion index for dropzones
splice_target = """      if (targetId !== sourceId && target) {
        if (target.parentId === newParentId) {
          const tIdx = siblings.findIndex(c => c.id === targetId);
          if (tIdx !== -1) {
            // When dropping from another list, we usually insert after the target if we are dragging down
            // But without knowing vertical direction easily, inserting at tIdx or tIdx+1 is a guess.
            // Let's insert at tIdx (before target) as default.
            insertIndex = tIdx; 
          }
        } else if (newParentId === target.id) {
          insertIndex = 0;
        }
      }"""
      
splice_replacement = """      if (String(over.id).startsWith('dropzone-')) {
        insertIndex = siblings.length;
      } else if (targetId !== sourceId && target) {
        if (target.parentId === newParentId) {
          const tIdx = siblings.findIndex(c => c.id === targetId);
          if (tIdx !== -1) {
            insertIndex = tIdx; 
          }
        } else if (newParentId === target.id) {
          insertIndex = 0;
        }
      }"""
content = content.replace(splice_target, splice_replacement)

with open("src/app/settings/categories/CategoriesClient.tsx", "w") as f:
    f.write(content)

