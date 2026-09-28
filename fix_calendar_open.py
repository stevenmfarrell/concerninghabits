import re

with open("src/app/categories/[id]/SortableLists.tsx", "r") as f:
    content = f.read()

target = """            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {!isOpen && sub.habits?.length > 0 && (
                <div className="opacity-70 pointer-events-none">
                  <ActivityCalendar """

replacement = """            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {sub.habits?.length > 0 && (
                <div className="opacity-70 pointer-events-none">
                  <ActivityCalendar """

content = content.replace(target, replacement)

with open("src/app/categories/[id]/SortableLists.tsx", "w") as f:
    f.write(content)
