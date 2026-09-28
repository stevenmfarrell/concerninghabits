import re

with open("src/app/categories/[id]/SortableLists.tsx", "r") as f:
    content = f.read()

# 1. SortableHabitList: Add isNested prop and conditional wrapper class
habit_list_target = """export function SortableHabitList({ items: initialItems, user, isReordering, dndContextId = "habits-dnd-context" }: { items: any[], user: any, isReordering?: boolean, dndContextId?: string }) {"""
habit_list_replacement = """export function SortableHabitList({ items: initialItems, user, isReordering, dndContextId = "habits-dnd-context", isNested = false }: { items: any[], user: any, isReordering?: boolean, dndContextId?: string, isNested?: boolean }) {"""
content = content.replace(habit_list_target, habit_list_replacement)

habit_wrapper_target = """    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col">"""
habit_wrapper_replacement = """    <div className={isNested ? "divide-y divide-stone-100 flex flex-col w-full" : "bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col"}>"""
content = content.replace(habit_wrapper_target, habit_wrapper_replacement)

# 2. SortableSubcategoryItem: Remove bg-white from internal flex-col, add to wrapper, style header
sub_content_target = """  const content = (
    <div className={`flex flex-col transition-colors relative ${isDragging ? 'opacity-30 bg-stone-100' : 'bg-white hover:bg-stone-50/30'} ${isOverlay ? 'shadow-2xl scale-[1.02] z-50 rounded-xl' : ''}`}>
      {/* Header */}
      <div className="p-4 sm:p-5 flex justify-between items-center group/header border-b border-stone-100">"""
sub_content_replacement = """  const content = (
    <div className={`flex flex-col relative w-full ${isOverlay ? 'shadow-2xl scale-[1.02] z-50 rounded-2xl' : ''}`}>
      {/* Header */}
      <div className={`p-4 sm:p-5 flex justify-between items-center group/header transition-colors ${isOpen && sub.habits?.length > 0 ? 'border-b border-stone-100' : ''} bg-stone-50/80 hover:bg-stone-100/80`}>"""
content = content.replace(sub_content_target, sub_content_replacement)

sub_habits_target = """      {/* Habits */}
      {isOpen && !isOverlay && sub.habits && sub.habits.length > 0 && (
        <div className="p-2 sm:p-4 bg-stone-50/50">
          <SortableHabitList items={sub.habits} user={user} isReordering={isReordering} dndContextId={`habits-dnd-${sub.id}`} />
        </div>
      )}"""
sub_habits_replacement = """      {/* Habits */}
      {isOpen && !isOverlay && sub.habits && sub.habits.length > 0 && (
        <SortableHabitList items={sub.habits} user={user} isReordering={isReordering} dndContextId={`habits-dnd-${sub.id}`} isNested={true} />
      )}"""
content = content.replace(sub_habits_target, sub_habits_replacement)

sub_wrapper_target = """  if (isOverlay) return content;
  return <div ref={setNodeRef} style={style} className="relative bg-white overflow-hidden">{content}</div>;"""
sub_wrapper_replacement = """  if (isOverlay) return <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">{content}</div>;
  return <div ref={setNodeRef} style={style} className={`bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden ${isDragging ? 'opacity-40' : ''}`}>{content}</div>;"""
content = content.replace(sub_wrapper_target, sub_wrapper_replacement)

# 3. SortableSubcategoryList: Change outer wrapper to gap-6 instead of a solid card
sub_list_target = """  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col">
      <DndContext id="subcategories-dnd-context" """
sub_list_replacement = """  return (
    <div className="flex flex-col gap-6">
      <DndContext id="subcategories-dnd-context" """
content = content.replace(sub_list_target, sub_list_replacement)


with open("src/app/categories/[id]/SortableLists.tsx", "w") as f:
    f.write(content)
