'use client';

import { useState } from 'react';
import { createCategory, updateCategory, deleteCategory, reorderCategories } from '../../actions/db';
import Icon from '../../../components/Icon';
import IconPicker from '../../../components/IconPicker';
import NewCategoryInline from '../../../components/NewCategoryInline';
import { Plus, Trash2, Edit2, Check, X, Loader2, ArrowLeft, GripVertical } from 'lucide-react';
import { Fragment } from 'react';
import Link from 'next/link';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { DndContext, closestCenter, pointerWithin, rectIntersection, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, MeasuringStrategy, DragOverlay, defaultDropAnimationSideEffects, CollisionDetection, useDroppable } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';




const customCollisionDetection: CollisionDetection = (args) => {
  // First, let's see if the pointer is within any droppable
  const pointerIntersections = pointerWithin(args);
  
  if (pointerIntersections.length > 0) {
    return pointerIntersections;
  }
  
  // If the pointer is completely outside (e.g. in a gap or off screen),
  // fallback to closestCenter so it doesn't return null and reset the position!
  return closestCenter(args);
};


const SubcategoryDropZone = ({ isProjected }: { isProjected: boolean }) => {
  return (
    <div 
      className={`absolute right-4 top-1/2 -translate-y-1/2 h-10 px-4 rounded-lg border-2 flex items-center justify-center transition-colors z-50 shadow-sm ${isProjected ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold scale-110' : 'border-dashed border-stone-200 bg-white/80 text-stone-400 font-medium'}`}
    >
      <span className="text-xs whitespace-nowrap pointer-events-none">{isProjected ? 'Release to Nest' : 'Drag Right to Nest'}</span>
    </div>
  );
}

const SortableItem = ({ cat, renderCategoryRow, childrenNode, disabled, activeId, activeHasChildren, projectedParentId }: { cat: any, renderCategoryRow: any, childrenNode?: React.ReactNode, disabled?: boolean, activeId?: string | null, activeHasChildren?: boolean, projectedParentId?: string | null }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return renderCategoryRow(cat, { attributes, listeners, setNodeRef, style, isDragging, activeId, activeHasChildren, projectedParentId }, childrenNode);
};

export default function CategoriesClient({ initialCategories }: { initialCategories: any[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [loading, setLoading] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [projectedParentId, setProjectedParentId] = useState<string | null>(null);
  
  // New Category State
  const [addingParentId, setAddingParentId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('List');

  // Drag State
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    
  );

  // Edit Category State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('List');
  const [editParentId, setEditParentId] = useState<string>('');

  const handleCreateInline = async () => {
    if (!newName.trim()) return;
    setLoading('create');
    const cat = await createCategory(newName.trim(), newIcon, addingParentId || undefined);
    setCategories([...categories, cat]);
    setAddingParentId(null);
    setNewName('');
    setNewIcon('List');
    setLoading('');
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setLoading(id);
    const updated = await updateCategory(id, editName.trim(), editIcon, editParentId || null);
    setCategories(categories.map(c => c.id === id ? updated : c));
    setEditingId(null);
    setLoading('');
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    setLoading(deleteConfirmId);
    await deleteCategory(deleteConfirmId);
    setCategories(categories.filter(c => c.id !== deleteConfirmId));
    setLoading('');
    setDeleteConfirmId(null);
  };

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragCancel = () => {
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
  };

  const handleDragEnd = async (event: any) => {
    setActiveId(null);
    const { active, over, delta } = event;
    if (!over) return;
    
    const sourceId = active.id;
    let targetId = over.id;
    const source = categories.find(c => c.id === sourceId);
    if (!source) return;

    let newParentId = source.parentId;
    let target = categories.find(c => c.id === targetId);
    
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
    }

    if (newParentId === source.id) newParentId = null;
    
    if (newParentId !== null && !source.parentId) {
      const sourceHasChildren = categories.some(c => c.parentId === sourceId);
      if (sourceHasChildren) newParentId = null;
    }
    
    let isLevelChanged = newParentId !== source.parentId;
    
    if (sourceId === targetId && !isLevelChanged) return;

    if (newParentId !== source.parentId) {
      setLoading(source.id);
      await updateCategory(source.id, source.name, source.icon || 'List', newParentId);
      setLoading('');
    }

    let siblings = categories
      .filter(c => c.parentId === newParentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      
    const updatedSource = { ...source, parentId: newParentId };

    if (newParentId === source.parentId) {
      // Intra-list move (same parent)
      const oldIndex = siblings.findIndex(c => c.id === sourceId);
      const newIndex = siblings.findIndex(c => c.id === targetId);
      if (oldIndex !== -1 && newIndex !== -1) {
        siblings.splice(oldIndex, 1);
        siblings.splice(newIndex, 0, updatedSource);
      }
    } else {
      // Cross-list move (indent/outdent)
      siblings = siblings.filter(c => c.id !== sourceId);
      let insertIndex = siblings.length;
      
      if (targetId !== sourceId && target) {
        if (target.parentId === newParentId) {
          const tIdx = siblings.findIndex(c => c.id === targetId);
          if (tIdx !== -1) {
            insertIndex = tIdx; 
          }
        } else if (newParentId === target.id) {
          insertIndex = 0;
        }
      }
      siblings.splice(insertIndex, 0, updatedSource);
    }
    
    let orderCounter = 0;
    const updates: {id: string, order: number}[] = [];
    
    const topLevel = categories
      .filter(c => c.id !== sourceId && !c.parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      
    if (!newParentId) {
      topLevel.length = 0;
      topLevel.push(...siblings);
    }
    
    topLevel.forEach(p => {
      updates.push({ id: p.id, order: orderCounter++ });
      const children = categories
        .filter(c => c.id !== sourceId && c.parentId === p.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        
      if (newParentId === p.id) {
        children.length = 0;
        children.push(...siblings);
      }
      
      children.forEach(c => {
        updates.push({ id: c.id, order: orderCounter++ });
      });
    });
    
    const updateMap = new Map(updates.map(u => [u.id, u.order]));
    const newCategories = categories.map(c => c.id === sourceId ? updatedSource : c).map(c => ({ 
      ...c, 
      order: updateMap.get(c.id) ?? c.order ?? 0 
    }));
    
    setCategories(newCategories);
    reorderCategories(updates);
  };

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || 'List');
    setEditParentId(cat.parentId || '');
  };

  const renderCategoryRow = (cat: any, dndProps?: any, childrenNode?: React.ReactNode) => {
    return (
      <li 
        ref={dndProps?.setNodeRef}
        style={dndProps?.style}
        className={`transition-colors group relative ${dndProps?.isOverlay ? 'bg-stone-50 z-50 shadow-2xl rounded-xl cursor-grabbing scale-[1.02]' : dndProps?.isDragging ? 'opacity-30 bg-stone-100 rounded-xl dashed-border' : ''}`}
      >
        <div className={`py-3 sm:py-4 pr-3 sm:pr-4 ${cat.parentId ? 'pl-1 sm:pl-2' : 'pl-3 sm:pl-4'} flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 ${!dndProps?.isDragging && 'hover:bg-stone-50/50'} rounded-xl relative`}>
        <div 
          {...dndProps?.attributes}
          {...dndProps?.listeners}
          className={`cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-600 transition-colors shrink-0 touch-none`}
        >
          <GripVertical className="w-5 h-5" />
        </div>
        
        {editingId === cat.id ? (
          <>
            <div className="shrink-0">
              <IconPicker value={editIcon} onChange={setEditIcon} />
            </div>
            <input 
              type="text"
              autoFocus
              className="flex-1 min-w-[120px] px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdate(cat.id)}
            />

            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleUpdate(cat.id)}
                disabled={loading === cat.id || !editName.trim()}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading === cat.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              </button>
              <button 
                onClick={() => setEditingId(null)}
                className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={`w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 ${cat.parentId ? 'scale-90' : ''}`}>
              <Icon name={cat.icon || 'List'} className="w-5 h-5" />
            </div>
            <div className="flex-1 font-medium text-stone-800 flex items-center gap-2">
              {cat.name}
            </div>
            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">

              <button 
                onClick={() => startEdit(cat)}
                className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setDeleteConfirmId(cat.id)}
                disabled={loading === cat.id}
                className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title="Delete"
              >
                {loading === cat.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          </>
        )}
          {dndProps?.activeId && dndProps.activeId !== cat.id && !cat.parentId && !dndProps.activeHasChildren && !dndProps.isOverlay && (
            <SubcategoryDropZone isProjected={dndProps.projectedParentId === cat.id} />
          )}
        </div>
        {childrenNode}
      </li>
    );
  };



  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-end">
          <button 
            onClick={() => { setAddingParentId(''); setNewName(''); setNewIcon('List'); }}
            disabled={addingParentId !== null}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> New Category
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-100">

        <DndContext
          id="categories-dnd-context"
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragCancel={handleDragCancel}
          onDragEnd={handleDragEnd}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
          <ul className="divide-y divide-stone-100">
            <SortableContext items={categories.filter(c => !c.parentId).sort((a,b) => (a.order??0) - (b.order??0)).map(c => c.id)} strategy={verticalListSortingStrategy}>
              {addingParentId === '' && (
                <li className="p-3 sm:p-4 bg-stone-50 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 border-b border-stone-100">
                  <div className="shrink-0">
                    <IconPicker value={newIcon} onChange={setNewIcon} />
                  </div>
                  <input 
                    type="text"
                    autoFocus
                    placeholder="Category Name"
                    className="flex-1 min-w-[120px] px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateInline()}
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={handleCreateInline}
                      disabled={loading === 'create' || !newName.trim()}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {loading === 'create' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={() => setAddingParentId(null)}
                      className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </li>
              )}

              {categories.length === 0 && addingParentId === null ? (
                <li className="p-8 text-center text-stone-500">No categories found.</li>
              ) : (
                categories.filter(c => !c.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(parent => {
                  const children = categories.filter(c => c.parentId === parent.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                  const activeCat = activeId ? categories.find(c => c.id === activeId) : null;
                  const isDraggingTopLevel = activeCat ? !activeCat.parentId : false;
                  const activeHasChildren = activeId ? categories.some(c => c.parentId === activeId) : false;
                  
                  return (
                    <Fragment key={parent.id}>
                      <SortableItem 
                        cat={parent} 
                        renderCategoryRow={renderCategoryRow}
                        activeId={activeId}
                        activeHasChildren={activeHasChildren}
                        projectedParentId={projectedParentId} 
                        childrenNode={
                          (children.length > 0 || addingParentId === parent.id) ? (
                            <ul className="ml-6 sm:ml-8 border-l-2 border-stone-200">
                              <SortableContext items={children.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                {children.map(child => (
                                  <SortableItem key={child.id} cat={child} renderCategoryRow={renderCategoryRow} disabled={isDraggingTopLevel} activeId={activeId} activeHasChildren={activeHasChildren} projectedParentId={projectedParentId} />
                                ))}
                              </SortableContext>
                              {addingParentId === parent.id && (
                                <li className="p-3 sm:p-4 bg-stone-50/50 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 mt-1 rounded-xl">
                                  <div className="shrink-0">
                                    <IconPicker value={newIcon} onChange={setNewIcon} />
                                  </div>
                                  <input 
                                    type="text"
                                    autoFocus
                                    placeholder="Subcategory Name"
                                    className="flex-1 min-w-[120px] px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateInline()}
                                  />
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button 
                                      onClick={handleCreateInline}
                                      disabled={loading === 'create' || !newName.trim()}
                                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      {loading === 'create' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                    </button>
                                    <button 
                                      onClick={() => setAddingParentId(null)}
                                      className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                                    >
                                      <X className="w-5 h-5" />
                                    </button>
                                  </div>
                                </li>
                              )}
                            </ul>
                          ) : null
                        }
                      />
                    </Fragment>
                  );
                })
              )}
            </SortableContext>
          </ul>

          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }) }}>
            {activeId ? (() => {
              const activeCat = categories.find(c => c.id === activeId);
              if (!activeCat) return null;
              
              const children = categories.filter(c => c.parentId === activeCat.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
              const childrenNode = children.length > 0 ? (
                <ul className="ml-6 sm:ml-8 border-l-2 border-stone-200">
                  {children.map(child => <Fragment key={child.id}>{renderCategoryRow(child, { isOverlay: true })}</Fragment>)}
                </ul>
              ) : null;
              
              return (
                <ul className="list-none m-0 p-0">
                  {renderCategoryRow(activeCat, { isOverlay: true }, childrenNode)}
                </ul>
              );
            })() : null}
          </DragOverlay>
        </DndContext>

      </div>

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        title="Delete Category"
        message='Are you sure you want to delete this category? Habits using it will be moved to "Other".'
        confirmText="Delete Category"
        isProcessing={!!(deleteConfirmId && loading === deleteConfirmId)}
        onConfirm={executeDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
