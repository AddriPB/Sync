import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek
} from "date-fns";
import { fr } from "date-fns/locale";
import type { CalendarEvent } from "@/lib/types";

export const MINUTE_OPTIONS = ["00", "15", "30", "45"];

export function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

export function formatDayLabel(date: string) {
  return format(parseISO(date), "EEEE d MMMM", { locale: fr });
}

export function formatShortDay(date: Date) {
  return format(date, "EEE", { locale: fr });
}

export function formatMonthTitle(date: Date) {
  return format(date, "MMMM yyyy", { locale: fr });
}

export function getWeekDays(anchorDate: string) {
  const base = startOfWeek(parseISO(anchorDate), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, index) => addDays(base, index));
}

export function getMonthGrid(anchorDate: string) {
  const base = parseISO(anchorDate);
  const monthStart = startOfMonth(base);
  const monthEnd = endOfMonth(base);
  const start = startOfWeek(monthStart, { weekStartsOn: 1 });
  const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function moveAnchor(date: string, view: "planning" | "week" | "month", direction: -1 | 1) {
  const base = parseISO(date);
  if (view === "month") {
    return format(addMonths(base, direction), "yyyy-MM-dd");
  }
  if (view === "week") {
    return format(addWeeks(base, direction), "yyyy-MM-dd");
  }
  return format(addDays(base, direction), "yyyy-MM-dd");
}

export function groupEventsByDate(events: CalendarEvent[]) {
  return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const start = parseISO(event.startDate);
    const end = parseISO(event.endDate);
    eachDayOfInterval({ start, end }).forEach((day) => {
      const key = format(day, "yyyy-MM-dd");
      acc[key] = acc[key] ? [...acc[key], event] : [event];
    });
    return acc;
  }, {});
}

export function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) => {
    if (a.startDate !== b.startDate) {
      return a.startDate.localeCompare(b.startDate);
    }
    if ((a.startTime ?? "") !== (b.startTime ?? "")) {
      return (a.startTime ?? "").localeCompare(b.startTime ?? "");
    }
    return a.title.localeCompare(b.title);
  });
}

export function getPlanningDays(events: CalendarEvent[], anchorDate: string) {
  const grouped = groupEventsByDate(sortEvents(events));
  const dates = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  if (dates.length === 0) {
    return anchorDate ? [anchorDate] : [];
  }
  return dates;
}

export function spansOnDay(event: CalendarEvent, date: Date) {
  const target = format(date, "yyyy-MM-dd");
  return target >= event.startDate && target <= event.endDate;
}

export function isToday(date: Date) {
  return isSameDay(date, new Date());
}

export function formatTimeRange(event: CalendarEvent) {
  if (event.allDay) {
    return "Toute la journée";
  }
  if (event.startTime && event.endTime) {
    return `${event.startTime} - ${event.endTime}`;
  }
  if (event.startTime) {
    return `À partir de ${event.startTime}`;
  }
  return "Heure non précisée";
}

export function timeStringToMinutes(time?: string) {
  if (!time) {
    return null;
  }
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}
