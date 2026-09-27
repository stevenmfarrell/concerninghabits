import re

with open("src/app/categories/[id]/page.tsx", "r") as f:
    content = f.read()

target = """            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {category.habits.map(habit => (
                {(() => {
                  let habitTargetCount = 3;
                  try {
                    habitTargetCount = JSON.parse(habit.schema).targetCount || 3;
                  } catch (e) {}
                  
                  return ("""

replacement = """            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {category.habits.map(habit => {
                let habitTargetCount = 3;
                try {
                  habitTargetCount = JSON.parse(habit.schema).targetCount || 3;
                } catch (e) {}
                  
                return ("""

content = content.replace(target, replacement)

target2 = """                  );
                })()}
              ))}
            </div>"""

replacement2 = """                  );
              })}
            </div>"""

content = content.replace(target2, replacement2)

with open("src/app/categories/[id]/page.tsx", "w") as f:
    f.write(content)
