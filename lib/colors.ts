import type { ColorPreset } from "@/lib/types";

export const COLOR_LIBRARY: ColorPreset[] = [
  { id: "aurora", label: "Aurore", bg: "#183c34", fg: "#c3ffe9", border: "#39d2a0" },
  { id: "ember", label: "Braise", bg: "#422119", fg: "#ffd3c2", border: "#ff7b4d" },
  { id: "sun", label: "Soleil", bg: "#433415", fg: "#ffeab0", border: "#ffc83d" },
  { id: "ocean", label: "Océan", bg: "#172f48", fg: "#cde6ff", border: "#58a6ff" },
  { id: "orchid", label: "Orchidée", bg: "#332046", fg: "#eed6ff", border: "#c084fc" },
  { id: "rose", label: "Rose", bg: "#461d31", fg: "#ffd6e7", border: "#ff79b0" },
  { id: "mint", label: "Menthe", bg: "#173a31", fg: "#d6fff0", border: "#4adeb5" },
  { id: "lime", label: "Citron vert", bg: "#31411b", fg: "#ebffc9", border: "#a3e635" },
  { id: "sand", label: "Sable", bg: "#413721", fg: "#ffedd1", border: "#fbbf24" },
  { id: "peach", label: "Pêche", bg: "#49261e", fg: "#ffe0d4", border: "#fb8b73" },
  { id: "coral", label: "Corail", bg: "#492028", fg: "#ffd6db", border: "#ff6b81" },
  { id: "berry", label: "Baie", bg: "#391b38", fg: "#f6d5ff", border: "#d946ef" },
  { id: "violet", label: "Violet", bg: "#251f4b", fg: "#ddd9ff", border: "#8b5cf6" },
  { id: "indigo", label: "Indigo", bg: "#1c2750", fg: "#d8e3ff", border: "#6366f1" },
  { id: "sky", label: "Ciel", bg: "#16374b", fg: "#d4f0ff", border: "#38bdf8" },
  { id: "ice", label: "Glace", bg: "#1c3b42", fg: "#d9fdff", border: "#67e8f9" },
  { id: "teal", label: "Lagune", bg: "#15383d", fg: "#cdfbf6", border: "#2dd4bf" },
  { id: "forest", label: "Forêt", bg: "#1a321c", fg: "#daf8dd", border: "#4ade80" },
  { id: "olive", label: "Olive", bg: "#30361a", fg: "#f3facd", border: "#84cc16" },
  { id: "amber", label: "Ambre", bg: "#493516", fg: "#ffefcb", border: "#f59e0b" },
  { id: "copper", label: "Cuivre", bg: "#4b291c", fg: "#ffe0d5", border: "#f97316" },
  { id: "ruby", label: "Rubis", bg: "#4a171f", fg: "#ffd8de", border: "#ef4444" },
  { id: "blush", label: "Blush", bg: "#4a2433", fg: "#ffdbe8", border: "#f472b6" },
  { id: "plum", label: "Prune", bg: "#372040", fg: "#f0dcff", border: "#c084fc" },
  { id: "slate", label: "Ardoise", bg: "#202a3a", fg: "#dde7f5", border: "#94a3b8" }
];

export const DEFAULT_USER_COLOR_PRESETS = COLOR_LIBRARY.filter((preset) =>
  ["ocean", "rose", "aurora"].includes(preset.id)
);

export const DEFAULT_COLOR_ID = DEFAULT_USER_COLOR_PRESETS[0].id;

export function getColorPresetById(colorId: string, colorPresets?: ColorPreset[]) {
  return colorPresets?.find((preset) => preset.id === colorId) ?? COLOR_LIBRARY.find((preset) => preset.id === colorId) ?? DEFAULT_USER_COLOR_PRESETS[0];
}
