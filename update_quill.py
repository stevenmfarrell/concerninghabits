with open('src/components/QuillIcon.tsx', 'r') as f:
    c = f.read()

old_comment = """  // This SVG's native bounding box is 210x297. 
  // The native stroke thickness is ~13.23, which visually maps to a standard "2px" stroke on a 24x24 canvas.
  const scaledStrokeWidth = strokeWidth ? (Number(strokeWidth) * (13.23 / 2)) : 13.23;"""

new_comment = """  // This SVG's viewport is cropped to 180x180 to perfectly frame the paths.
  // A standard 2px stroke on a 24x24 canvas translates to 15px on a 180x180 canvas (180 / 24 = 7.5 ratio).
  const scaledStrokeWidth = strokeWidth ? (Number(strokeWidth) * 7.5) : 15;"""

c = c.replace(old_comment, new_comment)

with open('src/components/QuillIcon.tsx', 'w') as f:
    f.write(c)
