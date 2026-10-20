const letters: Record<string, string[]> = {
  G: [" ### ", "#   #", "#    ", "# ###", "#   #", "#   #", " ### "],
  R: ["#### ", "#   #", "#   #", "#### ", "# #  ", "#  # ", "#   #"],
  E: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#####"],
  A: [" ### ", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  T: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "  #  "],
  P: ["#### ", "#   #", "#   #", "#### ", "#    ", "#    ", "#    "],
  O: [" ### ", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  M: ["#   #", "## ##", "# # #", "# # #", "#   #", "#   #", "#   #"],
  C: [" ### ", "#   #", "#    ", "#    ", "#    ", "#   #", " ### "],
  I: ["#####", "  #  ", "  #  ", "  #  ", "  #  ", "  #  ", "#####"],
  V: ["#   #", "#   #", "#   #", "#   #", "#   #", " # # ", "  #  "],
  D: ["#### ", "#   #", "#   #", "#   #", "#   #", "#   #", "#### "],
  B: ["#### ", "#   #", "#   #", "#### ", "#   #", "#   #", "#### "],
  S: [" ####", "#    ", "#    ", " ### ", "    #", "    #", "#### "],
  L: ["#    ", "#    ", "#    ", "#    ", "#    ", "#    ", "#####"],
  U: ["#   #", "#   #", "#   #", "#   #", "#   #", "#   #", " ### "],
  Y: ["#   #", "#   #", " # # ", "  #  ", "  #  ", "  #  ", "  #  "],
  W: ["#   #", "#   #", "#   #", "# # #", "# # #", "## ##", "#   #"],
  H: ["#   #", "#   #", "#   #", "#####", "#   #", "#   #", "#   #"],
  F: ["#####", "#    ", "#    ", "#### ", "#    ", "#    ", "#    "],
  Q: [" ### ", "#   #", "#   #", "#   #", "# # #", "#  # ", " ## #"],
  N: ["#   #", "##  #", "##  #", "# # #", "#  ##", "#  ##", "#   #"],
  K: ["#   #", "#  # ", "# #  ", "##   ", "# #  ", "#  # ", "#   #"],
  " ": Array(7).fill("     "),
};

export const SLOGAN = "GREAT PROMPT RECEIVED";
export const MARQUEE_START = 2600;
const SPEED = 55;

export function bannerScale(width: number) { return width >= 58 ? 2 : 1; }

export function sloganArt(width: number, message = SLOGAN) {
  const scale = bannerScale(width);
  return Array.from({ length: 7 }, (_, row) => [...message].map((letter) =>
    [...` ${letters[letter][row]} `].map((c) => c.repeat(scale)).join("")
  ).join(" ".repeat(scale)));
}

export function marqueeEnd(width: number, message = SLOGAN, start = MARQUEE_START) {
  return start + (width + sloganArt(width, message)[0].length) / SPEED * 1000 + 300;
}

export function marqueeFrame(elapsed: number, width: number, message = SLOGAN, start = MARQUEE_START) {
  const art = sloganArt(width, message);
  const duration = marqueeEnd(width, message, start) - start - 300;
  const local = Math.max(0, elapsed - start);
  // Replay the banner on long generations without cutting its first pass short.
  const offset = width - Math.floor((local % (duration + 1200)) / 1000 * SPEED);
  return art.map((line) => Array.from({ length: width }, (_, x) => line[x - offset] ?? " ").join(""));
}
