import re

with open("src/app/actions/db.ts", "r") as f:
    content = f.read()

# 1. Update saveHabit
save_target = """        categoryId: categoryId || null,
        frequency,
        publishToMqtt,
        userId: user.id,"""
save_replacement = """        categoryId: categoryId || null,
        frequency,
        publishToMqtt,
        userId: user.id,
        order: 9999,"""
content = content.replace(save_target, save_replacement)

# 2. Update updateHabit
update_target = """  try {
    const habit = await prisma.habit.update({
      where: { id },
      data: {
        name,
        description,
        schema: JSON.stringify(schema),
        categoryId: categoryId || null,
        frequency,
        publishToMqtt,
      }
    });"""

update_replacement = """  try {
    let newOrder = existing.order;
    if (existing.categoryId !== (categoryId || null)) {
      newOrder = 9999;
    }

    const habit = await prisma.habit.update({
      where: { id },
      data: {
        name,
        description,
        schema: JSON.stringify(schema),
        categoryId: categoryId || null,
        frequency,
        publishToMqtt,
        order: newOrder,
      }
    });"""
content = content.replace(update_target, update_replacement)

with open("src/app/actions/db.ts", "w") as f:
    f.write(content)
