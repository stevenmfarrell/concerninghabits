import re

with open("src/app/categories/[id]/SortableLists.tsx", "r") as f:
    content = f.read()

target = """      {/* Header */}
      <div className={`p-3 sm:p-4 flex justify-between items-center group/header transition-colors ${isOpen && sub.habits?.length > 0 ? 'border-b border-stone-100' : ''} bg-stone-50/80 hover:bg-stone-100/80`}>
        <div className="flex items-center gap-2 sm:gap-3 w-full">
          {isReordering && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none shrink-0 p-1 -ml-2">
              <GripVertical className="w-5 h-5" />
            </div>
          )}
          
          <button onClick={() => setIsOpen(!isOpen)} className="flex-1 flex items-center justify-between min-w-0 text-left gap-2 sm:gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <Icon name={sub.icon || 'Folder'} className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-stone-800 truncate">{sub.name}</h3>
                {!isOpen && (
                  <p className="text-xs text-stone-500 truncate">{sub.habits?.length || 0} habits</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {sub.habits?.length > 0 && (
                <div className="opacity-70 pointer-events-none">
                  <ActivityCalendar 
                    dates={subLogs} 
                    weeks={3} 
                    frequency="multiple" 
                    targetCount={subTargetCount} 
                    bedtime={user.bedtime} 
                    weekStartsOn={user.weekStartsOn} 
                  />
                </div>
              )}
              <Link 
                href={`/categories/${sub.id}`} 
                onClick={(e) => e.stopPropagation()}
                className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Open Subcategory Page"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
              <div className="p-1 text-stone-400 hover:text-stone-600 transition-colors">
                {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              </div>
            </div>
          </button>
        </div>
      </div>"""

replacement = """      {/* Header */}
      <div className={`py-4 px-4 sm:px-6 flex justify-between items-center group/header transition-colors ${isOpen && sub.habits?.length > 0 ? 'border-b border-stone-100' : ''} bg-stone-50/80 hover:bg-stone-100/80`}>
        <div className="flex items-center gap-2 sm:gap-4 w-full">
          {isReordering && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none shrink-0 p-1 -ml-2">
              <GripVertical className="w-5 h-5" />
            </div>
          )}
          
          <button onClick={() => setIsOpen(!isOpen)} className="flex-1 flex flex-wrap sm:flex-nowrap items-center justify-between min-w-0 text-left gap-3 sm:gap-6">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <Icon name={sub.icon || 'Folder'} className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-stone-800 truncate">{sub.name}</h3>
                  <Link 
                    href={`/categories/${sub.id}`} 
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors shrink-0"
                    title="Open Subcategory Page"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
                {!isOpen && (
                  <p className="text-xs text-stone-500 truncate mt-0.5">{sub.habits?.length || 0} habits</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-6 shrink-0">
              {sub.habits?.length > 0 && (
                <div className="shrink-0 flex flex-col justify-center opacity-70 pointer-events-none">
                  <ActivityCalendar 
                    dates={subLogs} 
                    weeks={3} 
                    frequency="multiple" 
                    targetCount={subTargetCount} 
                    bedtime={user.bedtime} 
                    weekStartsOn={user.weekStartsOn} 
                  />
                </div>
              )}
              <div className="shrink-0 text-stone-300 hover:text-stone-600 transition-colors w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center">
                {isOpen ? <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" /> : <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />}
              </div>
            </div>
          </button>
        </div>
      </div>"""

content = content.replace(target, replacement)

with open("src/app/categories/[id]/SortableLists.tsx", "w") as f:
    f.write(content)

