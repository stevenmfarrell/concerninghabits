import re

with open("src/app/settings/categories/CategoriesClient.tsx", "r") as f:
    content = f.read()

# Remove the old SortableRowWrapper and replace with SortableItem
wrapper_target = """const SortableRowWrapper = ({ cat, renderCategoryRow, isHidden }: { cat: any, renderCategoryRow: (cat: any, dndProps?: any) => React.ReactNode, isHidden?: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return renderCategoryRow(cat, { attributes, listeners, setNodeRef, style, isDragging, isHidden });
};"""
content = content.replace(wrapper_target, "")

# Remove activeId state and hooks (not needed anymore for collapsing)
content = re.sub(r"  const \[activeId, setActiveId\] = useState<string \| null>\(null\);\n", "", content)
content = re.sub(r"  const handleDragStart = \(event: any\) => \{\n    setActiveId\(event.active.id\);\n  \};\n\n  const handleDragCancel = \(\) => \{\n    setActiveId\(null\);\n  \};\n\n", "", content)
content = content.replace("    setActiveId(null);\n", "")
content = content.replace("          onDragStart={handleDragStart}\n", "")
content = content.replace("          onDragCancel={handleDragCancel}\n", "")

# Rewrite renderCategoryRow to take children node
render_def_target = """  const renderCategoryRow = (cat: any, dndProps?: any) => {"""
render_def_replacement = """  const renderCategoryRow = (cat: any, dndProps?: any, childrenNode?: React.ReactNode) => {"""
content = content.replace(render_def_target, render_def_replacement)

# Update the <li> in renderCategoryRow to include childrenNode at the end
li_end_target = """        )}
      </li>"""
li_end_replacement = """        )}
        {childrenNode}
      </li>"""
content = content.replace(li_end_target, li_end_replacement)

# Remove the flex and gap classes from the <li> wrapper itself so it acts as a block container for the nested ul.
# Instead, wrap the row content in a flex div.
li_start_target = """      <li 
        ref={dndProps?.setNodeRef}
        style={dndProps?.style}
        className={`p-3 sm:p-4 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 transition-colors group ${dndProps?.isDragging ? 'opacity-50 bg-stone-100 z-50 shadow-md relative' : 'hover:bg-stone-50/50 bg-white'}`}
      >
        <div 
          {...dndProps?.attributes}"""

li_start_replacement = """      <li 
        ref={dndProps?.setNodeRef}
        style={dndProps?.style}
        className={`transition-colors group ${dndProps?.isDragging ? 'opacity-70 bg-stone-50 z-50 shadow-xl relative rounded-xl' : 'bg-white'}`}
      >
        <div className={`p-3 sm:p-4 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 ${!dndProps?.isDragging && 'hover:bg-stone-50/50'} rounded-xl`}>
        <div 
          {...dndProps?.attributes}"""
content = content.replace(li_start_target, li_start_replacement)

li_close_target = """          </>
        )}
        {childrenNode}
      </li>"""
li_close_replacement = """          </>
        )}
        </div>
        {childrenNode}
      </li>"""
content = content.replace(li_close_target, li_close_replacement)

# Now define SortableItem inside CategoriesClient so it has access to renderCategoryRow
# Or define it outside and pass renderCategoryRow. Let's define it inside, but memoize or just define it correctly.
# Wait, if we define it outside, we can pass renderCategoryRow.
sortable_item_code = """const SortableItem = ({ cat, renderCategoryRow, childrenNode }: { cat: any, renderCategoryRow: any, childrenNode?: React.ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return renderCategoryRow(cat, { attributes, listeners, setNodeRef, style, isDragging }, childrenNode);
};

export default function CategoriesClient"""
content = content.replace("export default function CategoriesClient", sortable_item_code)

# Replace the SortableContext array building block
context_target = r"<SortableContext items=\{[\s\S]*?strategy=\{verticalListSortingStrategy\}>[\s\S]*?</SortableContext>"

def generate_new_list():
    return """<SortableContext items={categories.filter(c => !c.parentId).map(c => c.id)} strategy={verticalListSortingStrategy}>
              {addingParentId === '' && (
                <li className="p-3 sm:p-4 bg-stone-50 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 border-b border-stone-100">
                  <div className="shrink-0">
                    <IconPicker value={newIcon} onChange={setNewIcon} />
                  </div>
                  <input 
                    type="text"
                    autoFocus
                    placeholder="Category Name"
                    className="flex-1 min-w-[120px] px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateInline()}
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      onClick={handleCreateInline}
                      disabled={loading === 'create' || !newName.trim()}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {loading === 'create' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={() => setAddingParentId(null)}
                      className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </li>
              )}

              {categories.length === 0 && addingParentId === null ? (
                <li className="p-8 text-center text-stone-500">No categories found.</li>
              ) : (
                categories.filter(c => !c.parentId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(parent => {
                  const children = categories.filter(c => c.parentId === parent.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                  return (
                    <Fragment key={parent.id}>
                      <SortableItem 
                        cat={parent} 
                        renderCategoryRow={renderCategoryRow} 
                        childrenNode={
                          (children.length > 0 || addingParentId === parent.id) ? (
                            <ul className="pl-4 sm:pl-8 border-l-2 border-stone-100 ml-6 sm:ml-8 mb-2">
                              <SortableContext items={children.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                {children.map(child => (
                                  <SortableItem key={child.id} cat={child} renderCategoryRow={renderCategoryRow} />
                                ))}
                              </SortableContext>
                              {addingParentId === parent.id && (
                                <li className="p-3 sm:p-4 bg-stone-50/50 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 mt-1 rounded-xl">
                                  <div className="shrink-0">
                                    <IconPicker value={newIcon} onChange={setNewIcon} />
                                  </div>
                                  <input 
                                    type="text"
                                    autoFocus
                                    placeholder="Subcategory Name"
                                    className="flex-1 min-w-[120px] px-3 py-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateInline()}
                                  />
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button 
                                      onClick={handleCreateInline}
                                      disabled={loading === 'create' || !newName.trim()}
                                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      {loading === 'create' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                    </button>
                                    <button 
                                      onClick={() => setAddingParentId(null)}
                                      className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                                    >
                                      <X className="w-5 h-5" />
                                    </button>
                                  </div>
                                </li>
                              )}
                            </ul>
                          ) : null
                        }
                      />
                    </Fragment>
                  );
                })
              )}
            </SortableContext>"""

content = re.sub(context_target, generate_new_list(), content, flags=re.DOTALL)

with open("src/app/settings/categories/CategoriesClient.tsx", "w") as f:
    f.write(content)

