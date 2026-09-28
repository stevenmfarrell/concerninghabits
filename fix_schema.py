import re

with open("prisma/schema.prisma", "r") as f:
    content = f.read()

target = """  publishToMqtt Boolean @default(false)
  id          String     @id @default(uuid())"""
replacement = """  publishToMqtt Boolean @default(false)
  id          String     @id @default(uuid())
  order       Int?       @default(0)"""
content = content.replace(target, replacement)

with open("prisma/schema.prisma", "w") as f:
    f.write(content)
