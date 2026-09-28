import re

with open("src/components/ActivityCalendar.tsx", "r") as f:
    content = f.read()

target_props = """interface ActivityCalendarProps {
  dates: Date[];
  weeks?: number;
  frequency?: string;
  size?: 'sm' | 'md';
  monthsPerColumn?: number;"""
replacement_props = """interface ActivityCalendarProps {
  dates: Date[];
  weeks?: number;
  frequency?: string;
  size?: 'sm' | 'md';
  monthsPerColumn?: number;
  emptyColor?: string;"""
content = content.replace(target_props, replacement_props)

target_destruct = """export default function ActivityCalendar({ 
  dates, 
  weeks = 12, 
  frequency = 'daily',
  size = 'md',
  monthsPerColumn = 3,
  targetCount = 1,
  bedtime = "00:00",
  weekStartsOn = 0
}: ActivityCalendarProps) {"""

replacement_destruct = """export default function ActivityCalendar({ 
  dates, 
  weeks = 12, 
  frequency = 'daily',
  size = 'md',
  monthsPerColumn = 3,
  targetCount = 1,
  bedtime = "00:00",
  weekStartsOn = 0,
  emptyColor = "bg-stone-100"
}: ActivityCalendarProps) {"""
content = content.replace(target_destruct, replacement_destruct)

target_bg = """    if (isPeriodCompleted) return 'bg-emerald-200';
    return 'bg-stone-100';"""
replacement_bg = """    if (isPeriodCompleted) return 'bg-emerald-200';
    return emptyColor;"""
content = content.replace(target_bg, replacement_bg)

with open("src/components/ActivityCalendar.tsx", "w") as f:
    f.write(content)

