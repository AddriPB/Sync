import type { CalendarEvent, EventSource } from "@/lib/types";

export type CalendarProvider = {
  source: EventSource;
  listExternalEvents: (userId: string, range?: { start: string; end: string }) => Promise<CalendarEvent[]>;
  syncExternalSource: (userId: string, payload?: unknown) => Promise<void>;
  mapExternalEventToCalendarEvent: (raw: unknown, userId: string) => CalendarEvent | null;
};

function createReadonlyProvider(source: EventSource): CalendarProvider {
  return {
    source,
    async listExternalEvents() {
      return [];
    },
    async syncExternalSource() {
      return;
    },
    mapExternalEventToCalendarEvent() {
      return null;
    }
  };
}

export const calendarProviders: Record<EventSource, CalendarProvider> = {
  sync: createReadonlyProvider("sync"),
  google: createReadonlyProvider("google"),
  apple_birthdays: createReadonlyProvider("apple_birthdays")
};
