import re

with open("src/app/categories/[id]/CategoryMenu.tsx", "r") as f:
    content = f.read()

target = """export default function CategoryMenu() {"""
replacement = """import { ArrowUpDown } from 'lucide-react';\n\nexport default function CategoryMenu({ categoryId }: { categoryId?: string }) {"""
content = content.replace(target, replacement)

link_target = """            <Link 
              href={`/settings/categories`}
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-600 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Manage Categories
            </Link>"""

link_replacement = """            {categoryId && (
              <Link 
                href={`/categories/${categoryId}?reorder=true`}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-600 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                <ArrowUpDown className="w-4 h-4" />
                Reorder
              </Link>
            )}
            <Link 
              href={`/settings/categories`}
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 hover:text-emerald-600 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Manage Categories
            </Link>"""
content = content.replace(link_target, link_replacement)

with open("src/app/categories/[id]/CategoryMenu.tsx", "w") as f:
    f.write(content)
