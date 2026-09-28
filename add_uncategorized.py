import re

with open("src/app/settings/categories/CategoriesClient.tsx", "r") as f:
    content = f.read()

target = """            })() : null}
          </DragOverlay>
        </DndContext>

      </div>"""

replacement = """            })() : null}
          </DragOverlay>
          
          <li className="group relative">
            <div className="py-3 sm:py-4 pr-3 sm:pr-4 pl-3 sm:pl-4 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 hover:bg-stone-50/50 transition-colors rounded-b-2xl">
              <div className="w-5 h-5 shrink-0 ml-0" />
              <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                <Icon name="FolderGit2" className="w-5 h-5 text-stone-400" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <span className="font-medium text-stone-500 italic">Uncategorized</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 md:group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-stone-400 font-medium px-2 py-1 bg-stone-100 rounded-md">Default system category</span>
              </div>
            </div>
          </li>
          
        </DndContext>

      </div>"""

content = content.replace(target, replacement)

with open("src/app/settings/categories/CategoriesClient.tsx", "w") as f:
    f.write(content)
