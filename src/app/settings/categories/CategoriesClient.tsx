'use client';

import { useState } from 'react';
import { createCategory, updateCategory, deleteCategory, reorderCategories } from '../../actions/db';
import Icon from '../../../components/Icon';
import IconPicker from '../../../components/IconPicker';
import { Plus, Trash2, Edit2, Check, X, Loader2, GripVertical } from 'lucide-react';
import { Fragment } from 'react';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { Button } from '../../../components/ui/Button';
import { UNCATEGORIZED_ICON } from '@/lib/constants';
import toast from 'react-hot-toast';
import { DropResult, computeDrop, applyDrop, getDropPosition, sameDropResult } from './categoryDrop';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, MeasuringStrategy, DragOverlay, defaultDropAnimationSideEffects, CollisionDetection, DragStartEvent, DragMoveEvent, DragEndEvent, DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, SortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CategoryOption } from '@/lib/types';




// Pick the row at the pointer's height, ignoring horizontal position, so drifting sideways off the
// list mid-drag doesn't change the target. Rows are nested (a parent's row contains its subcategory
// rows), so the shortest matching row is the most specific one.
const customCollisionDetection: CollisionDetection = (args) => {
  const { pointerCoordinates, droppableRects, droppableContainers } = args;

  if (pointerCoordinates) {
    const { y } = pointerCoordinates;
    const rows = droppableContainers
      .map(container => ({ container, rect: droppableRects.get(container.id) }))
      .filter((row): row is { container: typeof row.container, rect: NonNullable<typeof row.rect> } => !!row.rect);

    const hits = rows
      .filter(({ rect }) => y >= rect.top && y < rect.bottom)
      .sort((a, b) => a.rect.height - b.rect.height)
      .map(({ container, rect }) => ({ id: container.id, data: { droppableContainer: container, value: rect.height } }));

    if (hits.length > 0) return hits;
  }

  // Above or below the whole list: fall back to the nearest row
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

interface DndRowProps {
  attributes?: DraggableAttributes;
  listeners?: DraggableSyntheticListeners;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  isDragging?: boolean;
  isOverlay?: boolean;
}

type RenderCategoryRow = (cat: CategoryOption, dndProps?: DndRowProps, childrenNode?: React.ReactNode) => React.ReactElement;

const SortableItem = ({ cat, renderCategoryRow, childrenNode, disabled }: { cat: CategoryOption, renderCategoryRow: RenderCategoryRow, childrenNode?: React.ReactNode, disabled?: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return renderCategoryRow(cat, { attributes, listeners, setNodeRef, style, isDragging }, childrenNode);
};

// Rows only slide out of the way for a plain reorder; other moves are previewed with indicators
const noDisplacement: SortingStrategy = () => null;

export default function CategoriesClient({ initialCategories }: { initialCategories: CategoryOption[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [loading, setLoading] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<DropResult | null>(null);
  
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setDropPreview(null);
  };

  const computeDropForEvent = (event: DragMoveEvent | DragEndEvent) =>
    computeDrop(
      categories,
      String(event.active.id),
      event.over ? String(event.over.id) : null,
      event.delta.x,
      getDropPosition(event.active.rect.current.translated, event.over?.rect),
    );

  const handleDragMove = (event: DragMoveEvent) => {
    const next = computeDropForEvent(event);
    setDropPreview(prev => sameDropResult(prev, next) ? prev : next);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const drop = computeDropForEvent(event);
    setActiveId(null);
    setDropPreview(null);
    if (!drop) return;

    const source = categories.find(c => c.id === event.active.id);
    if (!source) return;

    // Update state synchronously so the drop animation lands where the category actually ends up
    const previous = categories;
    const next = applyDrop(categories, source.id, drop);
    setCategories(next);

    try {
      if ((source.parentId ?? null) !== drop.parentId) {
        await updateCategory(source.id, source.name, source.icon || 'List', drop.parentId);
      }
      await reorderCategories(next.map(c => ({ id: c.id, order: c.order })));
    } catch (err) {
      console.error('Failed to save category order', err);
      setCategories(previous);
      toast.error('Failed to save category order');
    }
  };

  const startEdit = (cat: CategoryOption) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon || 'List');
    setEditParentId(cat.parentId || '');
  };

  // "Drag right to nest" targets: top-level rows other than the dragged category and its current parent
  const showNestZone = (cat: CategoryOption) => {
    const activeCat = activeId ? categories.find(c => c.id === activeId) : null;
    if (!activeCat || cat.parentId || cat.id === activeCat.id || cat.id === activeCat.parentId) return false;
    return !categories.some(c => c.parentId === activeCat.id);
  };
  const sortingStrategy = dropPreview && dropPreview.mode !== 'reorder' ? noDisplacement : verticalListSortingStrategy;

  const renderCategoryRow: RenderCategoryRow = (cat, dndProps, childrenNode) => {
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
          {showNestZone(cat) && !dndProps?.isOverlay && (
            <SubcategoryDropZone isProjected={dropPreview?.mode === 'nest' && dropPreview.parentId === cat.id} />
          )}
        </div>
        {childrenNode}
        {dropPreview && dropPreview.mode !== 'reorder' && dropPreview.anchorId === cat.id && !dndProps?.isOverlay && (
          <div className={`absolute left-2 right-2 h-0.5 bg-emerald-500 rounded-full z-50 pointer-events-none ${dropPreview.position === 'after' ? '-bottom-px' : '-top-px'}`} />
        )}
      </li>
    );
  };



  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-end">
          <Button
            onClick={() => { setAddingParentId(''); setNewName(''); setNewIcon('List'); }}
            disabled={addingParentId !== null}
          >
            <Plus className="w-4 h-4" /> New Category
          </Button>
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
            <SortableContext items={categories.filter(c => !c.parentId).sort((a,b) => (a.order??0) - (b.order??0)).map(c => c.id)} strategy={sortingStrategy}>
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
                  
                  return (
                    <Fragment key={parent.id}>
                      <SortableItem 
                        cat={parent} 
                        renderCategoryRow={renderCategoryRow}
                        childrenNode={
                          (children.length > 0 || addingParentId === parent.id) ? (
                            <ul className="ml-6 sm:ml-8 border-l-2 border-stone-200">
                              <SortableContext items={children.map(c => c.id)} strategy={sortingStrategy}>
                                {children.map(child => (
                                  <SortableItem key={child.id} cat={child} renderCategoryRow={renderCategoryRow} disabled={isDraggingTopLevel} />
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
          
          <div className="group relative border-t border-stone-100">
            <div className="py-3 sm:py-4 pr-3 sm:pr-4 pl-3 sm:pl-4 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 hover:bg-stone-50/50 transition-colors rounded-b-2xl">
              <div className="w-5 h-5 shrink-0 ml-0" />
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                <Icon name={UNCATEGORIZED_ICON} className="w-5 h-5 text-stone-400" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <span className="font-medium text-stone-500 italic">Uncategorized</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 md:group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-stone-400 font-medium px-2 py-1 bg-stone-100 rounded-md">Default system category</span>
              </div>
            </div>
          </div>
          
        </DndContext>

      </div>

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        title="Delete Category"
        message='Are you sure you want to delete this category? Habits using it will be moved to "Uncategorized".'
        confirmText="Delete Category"
        isProcessing={!!(deleteConfirmId && loading === deleteConfirmId)}
        onConfirm={executeDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
