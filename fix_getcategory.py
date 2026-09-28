import re

with open("src/app/actions/db.ts", "r") as f:
    content = f.read()

target = """      habits: {
        include: { logs: { select: { createdAt: true, payload: true } } }
      },"""
replacement = """      habits: {
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        include: { logs: { select: { createdAt: true, payload: true } } }
      },"""

content = content.replace(target, replacement)

target2 = """        include: {
          habits: {
            include: { logs: { select: { createdAt: true, payload: true } } }
          }
        }"""
replacement2 = """        include: {
          habits: {
            orderBy: [{ order: 'asc' }, { name: 'asc' }],
            include: { logs: { select: { createdAt: true, payload: true } } }
          }
        }"""
content = content.replace(target2, replacement2)

with open("src/app/actions/db.ts", "w") as f:
    f.write(content)

