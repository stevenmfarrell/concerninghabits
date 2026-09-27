import re

with open("src/app/settings/categories/CategoriesClient.tsx", "r") as f:
    content = f.read()

# Add editParentId state
content = content.replace(
    "const [editIcon, setEditIcon] = useState('List');",
    "const [editIcon, setEditIcon] = useState('List');\n  const [editParentId, setEditParentId] = useState<string>('');"
)

# Update handleUpdate
content = content.replace(
    "const updated = await updateCategory(id, editName.trim(), editIcon);",
    "const updated = await updateCategory(id, editName.trim(), editIcon, editParentId || null);"
)

# Update startEdit
content = content.replace(
    "setEditIcon(cat.icon || 'List');",
    "setEditIcon(cat.icon || 'List');\n    setEditParentId(cat.parentId || '');"
)

# Add Select to UI
# We need to import Select
content = content.replace(
    "import IconPicker from '../../../components/IconPicker';",
    "import IconPicker from '../../../components/IconPicker';\nimport Select from '../../../components/Select';"
)

edit_ui_target = """                    <input 
                      type="text"
                      autoFocus
                      className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdate(cat.id)}
                    />"""

edit_ui_replacement = edit_ui_target + """
                    <div className="w-40 relative shrink-0">
                      <Select 
                        value={editParentId} 
                        onChange={setEditParentId}
                        options={[
                          { id: '', label: 'Top-Level' },
                          ...categories.filter(c => c.id !== cat.id && !c.parentId).map(c => ({ id: c.id, label: `Sub of ${c.name}` }))
                        ]}
                      />
                    </div>"""

content = content.replace(edit_ui_target, edit_ui_replacement)

# Show parent name in view mode
view_ui_target = """                    <div className="flex-1 font-medium text-stone-800">
                      {cat.name}
                    </div>"""

view_ui_replacement = """                    <div className="flex-1 font-medium text-stone-800 flex items-center gap-2">
                      {cat.name}
                      {cat.parentId && (
                        <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-md font-medium border border-stone-200">
                          {categories.find(c => c.id === cat.parentId)?.name || 'Subcategory'}
                        </span>
                      )}
                    </div>"""

content = content.replace(view_ui_target, view_ui_replacement)

with open("src/app/settings/categories/CategoriesClient.tsx", "w") as f:
    f.write(content)
