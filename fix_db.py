import re

with open("src/app/actions/db.ts", "r") as f:
    content = f.read()

new_functions = """export async function getCategoriesWithHierarchy() {
  const user = await getDefaultUser();
  return prisma.category.findMany({
    where: { userId: user.id, parentId: null },
    orderBy: { name: 'asc' },
    include: {
      children: {
        include: {
          habits: {
            include: { logs: { select: { createdAt: true } } }
          }
        }
      },
      habits: {
        include: { logs: { select: { createdAt: true } } }
      }
    }
  });
}

export async function getCategory(id: string) {
  const user = await getDefaultUser();
  return prisma.category.findUnique({
    where: { id, userId: user.id },
    include: {
      children: {
        include: {
          habits: {
            include: { logs: { select: { createdAt: true, payload: true } } }
          }
        }
      },
      habits: {
        include: { logs: { select: { createdAt: true, payload: true } } }
      },
      parent: true
    }
  });
}
"""

content = content.replace("export async function getCategories() {", new_functions + "\nexport async function getCategories() {")

# Also update createCategory to accept parentId
content = content.replace(
    "export async function createCategory(name: string, icon?: string) {",
    "export async function createCategory(name: string, icon?: string, parentId?: string) {"
)
content = content.replace(
    "data: { name, icon, userId: user.id }",
    "data: { name, icon, userId: user.id, parentId: parentId || null }"
)

with open("src/app/actions/db.ts", "w") as f:
    f.write(content)
