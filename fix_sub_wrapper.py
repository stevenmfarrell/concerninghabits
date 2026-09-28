import re

with open("src/app/categories/[id]/SortableLists.tsx", "r") as f:
    content = f.read()

target = """  return (
    <div className={isNested ? "divide-y divide-stone-100 flex flex-col w-full" : "bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden divide-y divide-stone-100 flex flex-col"}>
      <DndContext id="subcategories-dnd-context" """
replacement = """  return (
    <div className="flex flex-col gap-6">
      <DndContext id="subcategories-dnd-context" """
content = content.replace(target, replacement)

with open("src/app/categories/[id]/SortableLists.tsx", "w") as f:
    f.write(content)
