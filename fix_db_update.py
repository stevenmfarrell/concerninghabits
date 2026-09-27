import re

with open("src/app/actions/db.ts", "r") as f:
    content = f.read()

content = content.replace(
    "export async function updateCategory(id: string, name: string, icon: string) {",
    "export async function updateCategory(id: string, name: string, icon: string, parentId?: string | null) {"
)
content = content.replace(
    "data: { name, icon }",
    "data: { name, icon, parentId: parentId || null }"
)

with open("src/app/actions/db.ts", "w") as f:
    f.write(content)
