import re

with open("src/app/history/[id]/HorizonToggle.tsx", "r") as f:
    content = f.read()

content = content.replace(
    "export default function HorizonToggle({ habitId, currentWeeks }: { habitId: string, currentWeeks: number }) {",
    "export default function HorizonToggle({ habitId, currentWeeks, basePath = '/history' }: { habitId: string, currentWeeks: number, basePath?: string }) {"
)

content = content.replace(
    "router.replace(`/history/${habitId}?horizon=${weeks}`);",
    "router.replace(`${basePath}/${habitId}?horizon=${weeks}`);"
)

with open("src/app/history/[id]/HorizonToggle.tsx", "w") as f:
    f.write(content)

