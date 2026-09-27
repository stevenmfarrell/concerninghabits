import re

with open("src/app/settings/categories/CategoriesClient.tsx", "r") as f:
    content = f.read()

# Replace rectIntersection with custom collision
content = content.replace(
    "import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, MeasuringStrategy, DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';",
    "import { DndContext, closestCenter, pointerWithin, rectIntersection, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, MeasuringStrategy, DragOverlay, defaultDropAnimationSideEffects, CollisionDetection } from '@dnd-kit/core';"
)

custom_algo = """
const customCollisionDetection: CollisionDetection = (args) => {
  // First, let's see if the pointer is within any droppable
  const pointerIntersections = pointerWithin(args);
  
  if (pointerIntersections.length > 0) {
    return pointerIntersections;
  }
  
  // If the pointer is completely outside (e.g. in a gap or off screen),
  // fallback to closestCenter so it doesn't return null and reset the position!
  return closestCenter(args);
};

const SortableItem"""

content = content.replace("const SortableItem", custom_algo)

content = content.replace("collisionDetection={rectIntersection}", "collisionDetection={customCollisionDetection}")

with open("src/app/settings/categories/CategoriesClient.tsx", "w") as f:
    f.write(content)
