import re

with open("src/app/actions/db.ts", "r") as f:
    content = f.read()

target = """export async function getCategory(id: string) {
  const user = await getDefaultUser();
  return prisma.category.findUnique({
    where: { id, userId: user.id },
    include: {"""

replacement = """export async function getCategory(id: string) {
  const user = await getDefaultUser();
  const category = await prisma.category.findUnique({
    where: { id },
    include: {"""

content = content.replace(target, replacement)

# Add the security check before returning
end_target = """      parent: true
    }
  });
}"""

end_replacement = """      parent: true
    }
  });
  if (!category || category.userId !== user.id) return null;
  return category;
}"""

content = content.replace(end_target, end_replacement)

with open("src/app/actions/db.ts", "w") as f:
    f.write(content)
