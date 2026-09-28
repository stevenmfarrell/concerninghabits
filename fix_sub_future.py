import re

with open("src/app/categories/[id]/SortableLists.tsx", "r") as f:
    content = f.read()

target = """                    weekStartsOn={user.weekStartsOn}
                    emptyColor="bg-stone-200"
                  />"""

replacement = """                    weekStartsOn={user.weekStartsOn}
                    emptyColor="bg-stone-200"
                    futureColor="bg-transparent border border-stone-200"
                  />"""

content = content.replace(target, replacement)

with open("src/app/categories/[id]/SortableLists.tsx", "w") as f:
    f.write(content)

