export type CalendarView = "planning" | "week" | "month";

export type EventSource = "sync" | "google" | "apple_birthdays";

export type ColorPreset = {
  id: string;
  label: string;
  bg: string;
  fg: string;
  border: string;
};

export type CalendarEvent = {
  id: string;
  userId: string;
  title: string;
  allDay: boolean;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  location?: string;
  colorId: string;
  source: EventSource;
  sourceMeta?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type EventFormValues = {
  title: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  colorId: string;
};

export type StoredUser = {
  id: string;
  username: string;
  authEmail: string;
  createdAt: string;
};

export type Session = {
  userId: string;
  username: string;
};

export type ExternalSourceConnection = {
  source: EventSource;
  enabled: boolean;
  label: string;
  status: string;
};

export type LocationSuggestion = {
  id: string;
  label: string;
  source: "history" | "nominatim";
};

export type UserMeta = {
  locations: string[];
  sources: ExternalSourceConnection[];
  onSiteDates: string[];
  colorPresets: ColorPreset[];
};
