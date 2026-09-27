import re

with open("src/app/categories/[id]/history/page.tsx", "r") as f:
    content = f.read()

# Fix imports by adding one '../'
content = content.replace("from '../../actions/db'", "from '../../../actions/db'")
content = content.replace("from '../../../components/Icon'", "from '../../../../components/Icon'")
content = content.replace("from '../../../components/ActivityCalendar'", "from '../../../../components/ActivityCalendar'")
content = content.replace("from '../../history/[id]/BackButton'", "from '../../../history/[id]/BackButton'")
content = content.replace("from '../../../components/QuillIconWavy'", "from '../../../../components/QuillIconWavy'")
content = content.replace("from '../../history/[id]/HorizonToggle'", "from '../../../history/[id]/HorizonToggle'")

# Remove Component Lists since they will be on the main page
list_target = """        {/* Component Lists */}"""
content = content[:content.find(list_target)] + """      </div>\n    </main>\n  );\n}"""

# Fix header
content = content.replace("<span className=\"truncate\">{category.name} Overview</span>", "<span className=\"truncate\">{category.name} History</span>")
# Also add back button, and a link to the "Category Hub" instead of the Icon
header_target = """        <div className="w-10 h-10 relative z-10 flex items-center justify-center rounded-full bg-stone-100 text-stone-500 shrink-0">
          <Icon name={category.icon || 'Folder'} className="w-5 h-5" />
        </div>"""
header_replacement = """        <Link 
          href={`/categories/${category.id}`}
          className="p-2 -mr-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full transition-colors shrink-0 relative z-10"
          title="Category Overview"
        >
          <QuillIconWavy className="w-6 h-6" strokeWidth={2.5} />
        </Link>"""
content = content.replace(header_target, header_replacement)

with open("src/app/categories/[id]/history/page.tsx", "w") as f:
    f.write(content)
