import re

with open("src/components/ActivityCalendar.tsx", "r") as f:
    content = f.read()

target_props = """  emptyColor?: string;
}"""
replacement_props = """  emptyColor?: string;
  futureColor?: string;
}"""
content = content.replace(target_props, replacement_props)

target_destruct = """  weekStartsOn = 0,
  emptyColor = "bg-stone-100"
}: ActivityCalendarProps) {"""
replacement_destruct = """  weekStartsOn = 0,
  emptyColor = "bg-stone-100",
  futureColor = "bg-transparent border border-stone-100"
}: ActivityCalendarProps) {"""
content = content.replace(target_destruct, replacement_destruct)

target_bg = """    if (isFuture) return 'bg-transparent border border-stone-100';"""
replacement_bg = """    if (isFuture) return futureColor;"""
content = content.replace(target_bg, replacement_bg)

with open("src/components/ActivityCalendar.tsx", "w") as f:
    f.write(content)

