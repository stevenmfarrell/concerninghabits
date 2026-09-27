import re

with open("src/app/categories/[id]/page.tsx", "r") as f:
    content = f.read()

# Replace the empty spacer div with the new CategoryMenu
target = """        {/* Placeholder to balance the centered title */}
        <div className="w-10 h-10 relative z-10"></div>"""

replacement = """        <CategoryMenu />"""

content = content.replace(target, replacement)

# Add import
content = content.replace(
    "import QuillIconWavy from '../../../components/QuillIconWavy';",
    "import QuillIconWavy from '../../../components/QuillIconWavy';\nimport CategoryMenu from './CategoryMenu';"
)

with open("src/app/categories/[id]/page.tsx", "w") as f:
    f.write(content)

