import re

with open("src/components/BottomNav.tsx", "r") as f:
    content = f.read()

content = content.replace(
    "import { Home, PlusCircle, Settings } from 'lucide-react';",
    "import { Home, PlusCircle, Settings, FolderTree } from 'lucide-react';"
)

content = content.replace(
    "const navItems = [\n    { name: 'Dashboard', href: '/', icon: Home },\n    { name: 'Settings', href: '/settings', icon: Settings, matchPrefix: '/settings' },\n  ];",
    "const navItems = [\n    { name: 'Dashboard', href: '/', icon: Home },\n    { name: 'Categories', href: '/categories', icon: FolderTree, matchPrefix: '/categories' },\n    { name: 'Settings', href: '/settings', icon: Settings, matchPrefix: '/settings' },\n  ];"
)

with open("src/components/BottomNav.tsx", "w") as f:
    f.write(content)
