import re

with open("src/app/categories/[id]/SortableLists.tsx", "r") as f:
    content = f.read()

target = """                {!isOpen && (
                  <p className="text-xs text-stone-500 truncate mt-0.5">{sub.habits?.length || 0} habits</p>
                )}"""

replacement = """                <p className="text-xs text-stone-500 truncate mt-0.5">{sub.habits?.length || 0} habits</p>"""

content = content.replace(target, replacement)

with open("src/app/categories/[id]/SortableLists.tsx", "w") as f:
    f.write(content)

