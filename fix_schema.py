import re

with open("prisma/schema.prisma", "r") as f:
    content = f.read()

target = """model Category {
  id        String   @id @default(uuid())
  name      String
  icon      String?
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  habits    Habit[]
  createdAt DateTime @default(now())
}"""

replacement = """model Category {
  id        String   @id @default(uuid())
  name      String
  icon      String?
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  habits    Habit[]
  parentId  String?
  parent    Category?  @relation("Subcategories", fields: [parentId], references: [id])
  children  Category[] @relation("Subcategories")
  createdAt DateTime @default(now())
}"""

content = content.replace(target, replacement)

with open("prisma/schema.prisma", "w") as f:
    f.write(content)

