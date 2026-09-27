import re

with open("src/app/settings/categories/CategoriesClient.tsx", "r") as f:
    content = f.read()

target = """    if (delta.x > 30) {
      if (!source.parentId) {
        if (targetId !== sourceId && target) {
          newParentId = target.parentId || target.id;
        } else {
          const topLevels = categories.filter(c => !c.parentId).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
          const idx = topLevels.findIndex(c => c.id === sourceId);
          if (idx > 0) newParentId = topLevels[idx - 1].id;
        }
        isLevelChanged = true;
      }
    }"""

replacement = """    if (delta.x > 30) {
      if (!source.parentId) {
        const sourceHasChildren = categories.some(c => c.parentId === sourceId);
        if (!sourceHasChildren) {
          if (targetId !== sourceId && target) {
            newParentId = target.parentId || target.id;
          } else {
            const topLevels = categories.filter(c => !c.parentId).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
            const idx = topLevels.findIndex(c => c.id === sourceId);
            if (idx > 0) newParentId = topLevels[idx - 1].id;
          }
          isLevelChanged = true;
        }
      }
    }"""

content = content.replace(target, replacement)

with open("src/app/settings/categories/CategoriesClient.tsx", "w") as f:
    f.write(content)
