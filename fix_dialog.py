import re

with open("src/app/settings/categories/CategoriesClient.tsx", "r") as f:
    content = f.read()

target = """message='Are you sure you want to delete this category? Habits using it will be moved to "Other".'"""
replacement = """message='Are you sure you want to delete this category? Habits using it will be moved to "Uncategorized".'"""

content = content.replace(target, replacement)

with open("src/app/settings/categories/CategoriesClient.tsx", "w") as f:
    f.write(content)

