import type { ColorPreset } from "@/lib/types";

export const COLOR_PRESETS: ColorPreset[] = [
  { id: "aurora", label: "Aurore", bg: "#183c34", fg: "#c3ffe9", border: "#39d2a0" },
  { id: "ember", label: "Braise", bg: "#422119", fg: "#ffd3c2", border: "#ff7b4d" },
  { id: "sun", label: "Soleil", bg: "#433415", fg: "#ffeab0", border: "#ffc83d" },
  { id: "ocean", label: "Océan", bg: "#172f48", fg: "#cde6ff", border: "#58a6ff" },
  { id: "orchid", label: "Orchidée", bg: "#332046", fg: "#eed6ff", border: "#c084fc" },
  { id: "rose", label: "Rose", bg: "#461d31", fg: "#ffd6e7", border: "#ff79b0" }
];

export const DEFAULT_COLOR_ID = COLOR_PRESETS[0].id;
