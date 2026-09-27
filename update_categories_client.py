import re

with open("src/app/settings/categories/CategoriesClient.tsx", "r") as f:
    content = f.read()

# Add reorderCategories import
content = content.replace(
    "import { createCategory, updateCategory, deleteCategory } from '../../actions/db';",
    "import { createCategory, updateCategory, deleteCategory, reorderCategories } from '../../actions/db';"
)

# Add ChevronUp, ChevronDown to lucide-react imports
content = content.replace(
    "import { Plus, Trash2, Edit2, Check, X, Loader2, ArrowLeft } from 'lucide-react';",
    "import { Plus, Trash2, Edit2, Check, X, Loader2, ArrowLeft, ChevronUp, ChevronDown } from 'lucide-react';"
)

# Add newParentId state
content = content.replace(
    "const [newIcon, setNewIcon] = useState('List');",
    "const [newIcon, setNewIcon] = useState('List');\n  const [newParentId, setNewParentId] = useState('');"
)

# Update handleCreate to use newParentId
create_target = """  const handleCreate = async (name: string, icon: string) => {
    const cat = await createCategory(name, icon);
    setCategories([...categories, cat].sort((a, b) => a.name.localeCompare(b.name)));
    setIsAdding(false);
  };"""

create_replacement = """  const handleCreateInline = async () => {
    if (!newName.trim()) return;
    setLoading('create');
    const cat = await createCategory(newName.trim(), newIcon, newParentId || undefined);
    setCategories([...categories, cat]);
    setIsAdding(false);
    setNewName('');
    setNewIcon('List');
    setNewParentId('');
    setLoading('');
  };"""

content = content.replace(create_target, create_replacement)

# Update handleUpdate sorting
update_target = """    const updated = await updateCategory(id, editName.trim(), editIcon, editParentId || null);
    setCategories(categories.map(c => c.id === id ? updated : c).sort((a, b) => a.name.localeCompare(b.name)));"""

update_replacement = """    const updated = await updateCategory(id, editName.trim(), editIcon, editParentId || null);
    setCategories(categories.map(c => c.id === id ? updated : c));"""

content = content.replace(update_target, update_replacement)

# Add reordering logic
reorder_logic = """  const move = (catId: string, direction: -1 | 1) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    
    const siblings = cat.parentId ? categories.filter(c => c.parentId === cat.parentId) : categories.filter(c => !c.parentId);
    const index = siblings.findIndex(c => c.id === catId);
    
    if (index + direction < 0 || index + direction >= siblings.length) return;
    
    const swapWith = siblings[index + direction];
    siblings[index] = swapWith;
    siblings[index + direction] = cat;
    
    let orderCounter = 0;
    const updates: {id: string, order: number}[] = [];
    
    const allTopLevel = categories.filter(c => !c.parentId);
    if (!cat.parentId) {
      const tlIndex = allTopLevel.findIndex(c => c.id === catId);
      allTopLevel[tlIndex] = swapWith;
      allTopLevel[tlIndex + direction] = cat;
    }
    
    allTopLevel.forEach(p => {
      updates.push({ id: p.id, order: orderCounter++ });
      const children = categories.filter(c => c.parentId === p.id);
      if (cat.parentId === p.id) {
        const cIndex = children.findIndex(c => c.id === catId);
        children[cIndex] = swapWith;
        children[cIndex + direction] = cat;
      }
      children.forEach(c => {
        updates.push({ id: c.id, order: orderCounter++ });
      });
    });
    
    const updateMap = new Map(updates.map(u => [u.id, u.order]));
    const newCategories = categories.map(c => ({ ...c, order: updateMap.get(c.id) ?? c.order ?? 0 })).sort((a, b) => a.order - b.order);
    setCategories(newCategories);
    reorderCategories(updates);
  };"""

content = content.replace(
    "const startEdit = (cat: any) => {",
    reorder_logic + "\n\n  const startEdit = (cat: any) => {"
)

# Replace the isAdding section
isadding_target = """          {isAdding && (
            <li className="p-4 bg-stone-50 flex items-center gap-4">
              <NewCategoryInline onSave={handleCreate} onCancel={() => setIsAdding(false)} />
            </li>
          )}"""

isadding_replacement = """          {isAdding && (
            <li className="p-4 bg-stone-50 flex items-center gap-4">
              <div className="shrink-0">
                <IconPicker value={newIcon} onChange={setNewIcon} />
              </div>
              <input 
                type="text"
                autoFocus
                placeholder="Category Name"
                className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateInline()}
              />
              <div className="w-40 relative shrink-0">
                <Select 
                  value={newParentId} 
                  onChange={setNewParentId}
                  options={[
                    { id: '', label: 'Top-Level' },
                    ...categories.filter(c => !c.parentId).map(c => ({ id: c.id, label: `Sub of ${c.name}` }))
                  ]}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={handleCreateInline}
                  disabled={loading === 'create' || !newName.trim()}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading === 'create' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => setIsAdding(false)}
                  className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </li>
          )}"""

content = content.replace(isadding_target, isadding_replacement)

# Build hierarchical list for rendering
hierarchical_target = """            categories.map(cat => ("""
hierarchical_replacement = """            categories.filter(c => !c.parentId).flatMap(p => [p, ...categories.filter(c => c.parentId === p.id)]).map(cat => ("""
content = content.replace(hierarchical_target, hierarchical_replacement)

# Add up/down arrows to view mode
view_mode_target = """                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => startEdit(cat)}"""

view_mode_replacement = """                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => move(cat.id, -1)}
                        className="p-1 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Move Up"
                      >
                        <ChevronUp className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => move(cat.id, 1)}
                        className="p-1 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Move Down"
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                      <div className="w-px h-5 bg-stone-200 mx-1" />
                      <button 
                        onClick={() => startEdit(cat)}"""

content = content.replace(view_mode_target, view_mode_replacement)

# Make subcategories indented visually
indent_target = """                  <>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">"""

indent_replacement = """                  <>
                    <div className={`w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 ${cat.parentId ? 'ml-8 scale-90' : ''}`}>"""

content = content.replace(indent_target, indent_replacement)

with open("src/app/settings/categories/CategoriesClient.tsx", "w") as f:
    f.write(content)
