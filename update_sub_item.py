import re

with open("src/app/categories/[id]/SortableLists.tsx", "r") as f:
    content = f.read()

target = """  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  const content = (
    <div className={`flex flex-col relative w-full ${isOverlay ? 'shadow-2xl scale-[1.02] z-50 rounded-2xl' : ''}`}>
      {/* Header */}
      <div className={`p-4 sm:p-5 flex justify-between items-center group/header transition-colors ${isOpen && sub.habits?.length > 0 ? 'border-b border-stone-100' : ''} bg-stone-50/80 hover:bg-stone-100/80`}>
        <div className="flex items-center gap-3 w-full">
          {isReordering && (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 touch-none shrink-0 p-1 -ml-2">
              <GripVertical className="w-5 h-5" />
            </div>
          )}
          
          <button onClick={() => setIsOpen(!isOpen)} className="flex-1 flex items-center justify-between min-w-0 text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <Icon name={sub.icon || 'Folder'} className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-stone-800">{sub.name}</h3>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
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

replacement = """  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
  };

  const subLogs = sub.habits?.flatMap((h: any) => h.logs?.map((l: any) => l.createdAt) || []) || [];
  const subTargetCount = sub.habits?.length > 0 ? sub.habits.length : 1;

  const content = (
    <div className={`flex flex-col relative w-full ${isOverlay ? 'shadow-2xl scale-[1.02] z-50 rounded-2xl' : ''}`}>
      {/* Header */}
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
              {!isOpen && sub.habits?.length > 0 && (
                <div className="opacity-70 pointer-events-none hidden sm:block">
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
                className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors hidden sm:flex"
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

content = content.replace(target, replacement)

with open("src/app/categories/[id]/SortableLists.tsx", "w") as f:
    f.write(content)

