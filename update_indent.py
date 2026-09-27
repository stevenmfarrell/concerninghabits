import re

with open("src/app/settings/categories/CategoriesClient.tsx", "r") as f:
    content = f.read()

target = r"  const handleDragEnd = \(event: any\) => \{.*?setCategories\(newCategories\);\n    reorderCategories\(updates\);\n  \};"

replacement = """  const handleDragEnd = async (event: any) => {
    setActiveId(null);
    const { active, over, delta } = event;
    if (!over) return;
    
    const sourceId = active.id;
    const targetId = over.id;
    const source = categories.find(c => c.id === sourceId);
    const target = categories.find(c => c.id === targetId);
    if (!source) return;

    let newParentId = source.parentId;
    let isLevelChanged = false;

    if (delta.x > 30) {
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
    } else if (delta.x < -30) {
      if (source.parentId) {
        newParentId = null;
        isLevelChanged = true;
      }
    } else if (sourceId !== targetId && target) {
      newParentId = target.parentId;
    }

    if (newParentId === source.id) newParentId = null;
    
    if (sourceId === targetId && !isLevelChanged) return;

    if (newParentId !== source.parentId) {
      setLoading(source.id);
      await updateCategory(source.id, source.name, source.icon || 'List', newParentId);
      setLoading('');
    }

    const siblings = categories
      .filter(c => c.id !== sourceId && c.parentId === newParentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      
    let insertIndex = siblings.length;
    if (targetId !== sourceId && target) {
      if (target.parentId === newParentId) {
        const tIdx = siblings.findIndex(c => c.id === targetId);
        if (tIdx !== -1) insertIndex = tIdx;
      } else if (newParentId === target.id) {
        insertIndex = 0;
      }
    }
    
    const updatedSource = { ...source, parentId: newParentId };
    siblings.splice(insertIndex, 0, updatedSource);
    
    let orderCounter = 0;
    const updates: {id: string, order: number}[] = [];
    
    const topLevel = categories
      .filter(c => c.id !== sourceId && !c.parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      
    if (!newParentId) {
      topLevel.length = 0;
      topLevel.push(...siblings);
    }
    
    topLevel.forEach(p => {
      updates.push({ id: p.id, order: orderCounter++ });
      const children = categories
        .filter(c => c.id !== sourceId && c.parentId === p.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        
      if (newParentId === p.id) {
        children.length = 0;
        children.push(...siblings);
      }
      
      children.forEach(c => {
        updates.push({ id: c.id, order: orderCounter++ });
      });
    });
    
    const updateMap = new Map(updates.map(u => [u.id, u.order]));
    const newCategories = categories.map(c => c.id === sourceId ? updatedSource : c).map(c => ({ 
      ...c, 
      order: updateMap.get(c.id) ?? c.order ?? 0 
    }));
    
    setCategories(newCategories);
    reorderCategories(updates);
  };"""

content = re.sub(target, replacement, content, flags=re.DOTALL)

with open("src/app/settings/categories/CategoriesClient.tsx", "w") as f:
    f.write(content)
