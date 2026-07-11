/**
 * Single source of truth for the navy + gold palette shared across CSS and WebGL.
 *
 * discover.css :root mirrors these hex values (CSS custom properties). The TSX/WebGL
 * consumers (CandidateUniverse, Traces, StructureViewer) and the Playwright non-blank
 * background check import from HERE so the CSS and the canvases can never drift.
 * If you change a value, update the matching --d-* token in discover.css.
 */
export const PALETTE = {
  navy: "#070c18", // deepest background — 3Dmol viewer bg + WebGL clear
  gold: "#d9b45a", // primary accent + evidence lane
  goldBright: "#eccd82", // selected node / candidate-specific-QM highlight
  violet: "#a78bd0", // frontier lane (cool, distinct from gold; colourblind-safe pairing)
  steel: "#7f9bc0", // cool secondary (links, candidate-spin marker, fill light)
  gray: "#55617a", // excluded candidates
  grayPending: "#6b7a94", // pending (still-searching) candidates
  line: "#1b2a45", // hairline rules / grid
  line2: "#2a3d5c", // stronger rule / axis
  ink: "#ece6d8", // warm off-white text
  structProtein: "#3b5b7a", // muted protein cartoon in the structure viewer
} as const;

/** 3Dmol / three accept `0xRRGGBB` strings; convert a `#rrggbb` palette value. */
export const hex0x = (hex: string): string => "0x" + hex.replace("#", "");

/** Background as {r,g,b} for pixel-diff tests (mirrors PALETTE.navy). */
export const NAVY_RGB = { r: 0x07, g: 0x0c, b: 0x18 } as const;
