import re

with open("src/app/categories/[id]/SortableLists.tsx", "r") as f:
    content = f.read()

target = """                <div className="opacity-70 pointer-events-none hidden sm:block">
                  <ActivityCalendar """
replacement = """                <div className="opacity-70 pointer-events-none">
                  <ActivityCalendar """
content = content.replace(target, replacement)

target2 = """                className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors hidden sm:flex"
"""
replacement2 = """                className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
"""
content = content.replace(target2, replacement2)

with open("src/app/categories/[id]/SortableLists.tsx", "w") as f:
    f.write(content)

