import re

with open("src/app/categories/[id]/page.tsx", "r") as f:
    content = f.read()

target = """export default async function CategoryLogPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;"""

replacement = """export default async function CategoryLogPage(props: { params: Promise<{ id: string }>, searchParams: Promise<{ reorder?: string }> }) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const isReordering = searchParams.reorder === 'true';"""

content = content.replace(target, replacement)

target2 = """        </h1>
        <CategoryMenu />
      </div>"""

replacement2 = """        </h1>
        {isReordering ? (
          <div className="relative z-10 shrink-0">
            <Link href={`/categories/${category.id}`} className="px-4 py-1.5 bg-stone-900 text-white font-semibold rounded-lg text-sm hover:bg-stone-800 transition-colors">
              Done
            </Link>
          </div>
        ) : (
          <CategoryMenu categoryId={category.id} />
        )}
      </div>"""

content = content.replace(target2, replacement2)

target3 = """<SortableSubcategoryList items={category.children} />"""
replacement3 = """<SortableSubcategoryList items={category.children} isReordering={isReordering} />"""
content = content.replace(target3, replacement3)

target4 = """<SortableHabitList items={category.habits} user={user} />"""
replacement4 = """<SortableHabitList items={category.habits} user={user} isReordering={isReordering} />"""
content = content.replace(target4, replacement4)

with open("src/app/categories/[id]/page.tsx", "w") as f:
    f.write(content)
