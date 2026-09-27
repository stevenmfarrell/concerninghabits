import re

with open("src/app/settings/categories/CategoriesClient.tsx", "r") as f:
    content = f.read()

# Fix import string: I messed up replacing rectIntersection in my last script
target = "import { DndContext, closestCenter, pointerWithin, rectIntersection, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, MeasuringStrategy, DragOverlay, defaultDropAnimationSideEffects, CollisionDetection } from '@dnd-kit/core';"

# It turns out my regex didn't match the old import string perfectly because I had already replaced closestCenter in a previous step!
# Let's just find the entire import line and replace it.
content = re.sub(r"import \{ DndContext.*?\} from '@dnd-kit/core';", "import { DndContext, closestCenter, pointerWithin, rectIntersection, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, MeasuringStrategy, DragOverlay, defaultDropAnimationSideEffects, CollisionDetection } from '@dnd-kit/core';", content, flags=re.DOTALL)

with open("src/app/settings/categories/CategoriesClient.tsx", "w") as f:
    f.write(content)
