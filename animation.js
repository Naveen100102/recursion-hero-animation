const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const button = document.querySelector("button");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const colors = { ".": "#fffdfb", i: "#f5fbfe", b: "#e8f5fe", B: "#d1ebfc", r: "#ce0112" };
const motion = { time: 0 };
const horizon = Array.from(weave[0], (_, x) => weave.findIndex(row => "ibB".includes(row[x])));
const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { n = clamp(n); return n * n * (3 - 2 * n); };
const between = (time, start, end) => smooth((time - start) / (end - start));
const redSteps = [];
const flowers = new Map();
weave.forEach((line, row) => Array.from(line).forEach((color, col) => {
  if (color !== "r") return;
  if (row < 23) {
    redSteps.push({ col, row });
    return;
  }
  const band = Math.floor((row - 23) / 4);
  const offset = band % 2 ? 0 : 4;
  const cx = Math.round((col - offset) / 8) * 8 + offset;
  const cy = 24 + band * 4;
  const id = cx + "," + cy;
  if (!flowers.has(id)) flowers.set(id, { cx, cy, petals: [] });
  flowers.get(id).petals.push({ col, row });
}));
redSteps.sort((a, b) => b.col - a.col || a.row - b.row);
// The final step meets the upper-right corner of the first flower's top petal.
const tip = redSteps.at(-1);
const firstFlower = flowers.get((tip.col - 1) + "," + (tip.row + 2));
const settleStart = .40, settleEnd = .95;
const weaveStart = settleEnd + .17;
const redStart = weaveStart + .955, redEnd = redStart + 1.62;
const flowerStart = redEnd;
const finalFrame = redStart + 4.25;
const duration = 4;
for (const flower of flowers.values()) {
  flower.distance = Math.hypot(flower.cx - firstFlower.cx, (flower.cy - firstFlower.cy) * 1.35);
}

let layout;
function square(x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(x + width) - Math.round(x),
    Math.round(y + height) - Math.round(y));
}
function resize() {
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const unit = Math.max(width / 60, Math.min(height / 34, width / 23));
  const x = width - 60 * unit, y = height * .466 - 17 * unit;
  layout = { width, height, unit, x, y, first: Math.max(0, Math.floor(-x / unit)) };
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  cloth(motion.time);
}

function cloth(time) {
  const { width, height, x, y, unit, first } = layout;
  square(0, 0, width, height, colors["."]);
  const drop = between(time, 0, .39);
  const progress = clamp((time - settleStart) / (settleEnd - settleStart));
  const settle = between(progress, 0, .96);
  const stepsInPlace = between(progress, .2, 1);
  for (let col = first; col < 60; col++) {
    const left = x + col * unit;
    // The columns fall together. Their stepped ends emerge as the cloth settles.
    const steppedEnd = (horizon[col] - 17) * unit;
    const top = (y + 17 * unit) * settle + steppedEnd * stepsInPlace;
    const bottom = height * drop;
    if (bottom > top) square(left, top, unit, bottom - top, colors[col % 2 ? "i" : "b"]);
  }

  // Keep each crossing centred in its own bar as the next row opens.
  for (let row = 21; row < weave.length; row++) {
    const start = weaveStart + (row - 21) * .044;
    if (time <= start) break;
    const size = unit * between(time, start, start + .145);
    const inset = (unit - size) / 2;
    for (let col = first; col < 60; col++) {
      const pixel = weave[row][col];
      const under = row % 2 ? (col % 2 ? "i" : "B") : (col % 2 ? "." : "b");
      const color = pixel === "r" ? under : pixel;
      if (color === (col % 2 ? "i" : "b")) continue;
      square(x + col * unit + inset, y + row * unit + inset, size, size, colors[color]);
    }
  }

  // Reveal the artwork's red squares from right to left.
  const reach = clamp((time - redStart) / (redEnd - redStart)) * redSteps.length;
  for (const [i, cell] of redSteps.entries()) {
    const fill = clamp(reach - i);
    if (!fill) break;
    const left = x + (cell.col + 1 - fill) * unit;
    square(left, y + cell.row * unit, fill * unit, unit, colors.r);
  }

  if (time <= flowerStart) return;
  for (const { cx, cy, petals, distance } of flowers.values()) {
    const start = flowerStart + .041 * distance;
    const bloom = between(time, start, start + .56);
    if (!bloom) continue;
    const size = unit * bloom;
    for (const { col, row } of petals) {
      const px = x + (cx + .5 + (col - cx) * bloom) * unit;
      const py = y + (cy + .5 + (row - cy) * bloom) * unit;
      square(px - size / 2, py - size / 2, size, size, colors.r);
    }
  }
}

const timeline = gsap.timeline({ paused: true, onComplete: updateButton });
timeline.to(motion, { time: finalFrame, duration, ease: "none", onUpdate: () => cloth(motion.time) });

function updateButton() {
  const action = timeline.progress() === 1 ? "Replay" : timeline.paused() ? "Play" : "Pause";
  button.textContent = action;
  button.setAttribute("aria-label", action + " animation");
}

button.addEventListener("click", () => {
  if (timeline.progress() === 1) {
    timeline.restart();
    cloth(motion.time);
  } else {
    timeline.paused(!timeline.paused());
  }
  updateButton();
});

function showFinalFrame() {
  timeline.pause(duration);
  cloth(motion.time);
  updateButton();
}
reduced.addEventListener("change", () => {
  if (reduced.matches) showFinalFrame();
});
resize();
new ResizeObserver(resize).observe(canvas);
if (reduced.matches) showFinalFrame();
else timeline.play();
updateButton();
