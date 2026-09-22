const CELL_SIZE = 14;
const GAP = 4;
const STEP = CELL_SIZE + GAP;

const w = 1, d = 5;
console.log("Top line:");
console.log("left:", d * STEP - (GAP / 2));
console.log("top:", w * STEP - (GAP / 2) - 1);
console.log("width:", STEP + GAP);

const w2 = 0, d2 = 6;
console.log("Left line:");
console.log("left:", d2 * STEP - (GAP / 2) - 1);
console.log("top:", w2 * STEP - (GAP / 2));
console.log("height:", STEP + GAP);
