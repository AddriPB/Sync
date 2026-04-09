import type { LocationSuggestion } from "@/lib/types";

const NOMINATIM_LIMIT = 5;

export async function fetchLocationSuggestions(query: string): Promise<LocationSuggestion[]> {
  if (query.trim().length < 3) {
    return [];
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${NOMINATIM_LIMIT}&q=${encodeURIComponent(
      query
    )}`,
    {
      headers: {
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as Array<{ place_id: number; display_name: string }>;
  return data.map((item) => ({
    id: `nominatim-${item.place_id}`,
    label: item.display_name,
    source: "nominatim"
  }));
}
