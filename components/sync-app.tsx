"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, Grid2x2, MapPin, Plus, Settings2, Trash2 } from "lucide-react";
import { format, isSameMonth, isToday as isTodayDateFns, parseISO, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { COLOR_LIBRARY, getColorPresetById } from "@/lib/colors";
import {
  formatDayLabel,
  formatMonthTitle,
  formatShortDay,
  formatTimeRange,
  getMonthGrid,
  getPlanningDays,
  getWeekDays,
  MINUTE_OPTIONS,
  moveAnchor,
  sortEvents,
  spansOnDay,
  timeStringToMinutes,
  todayIso
} from "@/lib/date";
import { fetchLocationSuggestions } from "@/lib/location";
import {
  addColorPreset,
  deleteEvent,
  getColorPresets,
  getDefaultEventForm,
  getEvents,
  getOnSiteDates,
  getRememberedLocations,
  getSession,
  observeSession,
  removeColorPreset,
  saveEvent,
  signIn,
  signOut,
  signUp,
  toEventFormValues,
  toggleOnSiteDate
} from "@/lib/storage";
import type {
  CalendarEvent,
  CalendarView,
  ColorPreset,
  EventFormValues,
  LocationSuggestion,
  Session
} from "@/lib/types";

type AuthMode = "login" | "signup";

const LONG_PRESS_MS = 420;
const SWIPE_THRESHOLD = 54;
const SHEET_CLOSE_THRESHOLD = 88;
const WEEK_HOURS = Array.from({ length: 17 }, (_, index) => (index === 16 ? "00h" : `${String(index + 8).padStart(2, "0")}h`));
const DAY_START_MINUTES = 8 * 60;
const DAY_END_MINUTES = 24 * 60;
const DAY_RANGE_MINUTES = DAY_END_MINUTES - DAY_START_MINUTES;
const WEEK_HEADER_HEIGHT = 42;

const navItems: Array<{ id: CalendarView; label: string; icon: typeof Clock3 }> = [
  { id: "planning", label: "Planning", icon: Clock3 },
  { id: "week", label: "Semaine", icon: CalendarDays },
  { id: "month", label: "Mois", icon: Grid2x2 }
];

export function SyncApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<CalendarView>("planning");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<EventFormValues | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [onSiteDates, setOnSiteDates] = useState<string[]>([]);
  const [colorPresets, setColorPresets] = useState<ColorPreset[]>([]);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    void getSession().then(setSession);
    const unsubscribe = observeSession(setSession);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    void refreshData(session.userId);
  }, [session]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === editingEventId) ?? null,
    [editingEventId, events]
  );

  const composerDefaults = useMemo(() => {
    if (selectedEvent) {
      return toEventFormValues(selectedEvent);
    }
    if (createDraft) {
      return createDraft;
    }
    return {
      ...getDefaultEventForm(selectedDate),
      colorId: colorPresets[0]?.id ?? getDefaultEventForm(selectedDate).colorId
    };
  }, [selectedDate, selectedEvent, createDraft, colorPresets]);

  async function refreshData(userId = session?.userId) {
    if (!userId) {
      return;
    }
    const [nextEvents, nextOnSiteDates, nextColorPresets] = await Promise.all([
      getEvents(userId),
      getOnSiteDates(userId),
      getColorPresets(userId)
    ]);
    setEvents(sortEvents(nextEvents));
    setOnSiteDates(nextOnSiteDates);
    setColorPresets(nextColorPresets);
  }

  async function handleAuthenticate(mode: AuthMode, username: string, password: string) {
    const nextSession = mode === "signup" ? await signUp(username, password) : await signIn(username, password);
    setSession(nextSession);
  }

  function handleSignOut() {
    void signOut();
    setSession(null);
    setEvents([]);
    setOnSiteDates([]);
    setColorPresets([]);
    setShowComposer(false);
    setShowSettings(false);
  }

  function handleCreate(defaults?: Partial<EventFormValues>) {
    setEditingEventId(null);
    setCreateDraft({
      ...getDefaultEventForm(selectedDate),
      colorId: colorPresets[0]?.id ?? getDefaultEventForm(selectedDate).colorId,
      ...defaults
    });
    setShowComposer(true);
  }

  function handleEdit(event: CalendarEvent) {
    setEditingEventId(event.id);
    setCreateDraft(null);
    setShowComposer(true);
  }

  async function handleSave(values: EventFormValues) {
    if (!session) {
      return;
    }
    await saveEvent(session.userId, values, editingEventId ?? undefined);
    await refreshData();
    setShowComposer(false);
    setEditingEventId(null);
    setCreateDraft(null);
    setSelectedDate(values.startDate);
  }

  async function handleDelete(eventId: string) {
    await deleteEvent(eventId);
    await refreshData();
    setShowComposer(false);
    setEditingEventId(null);
    setCreateDraft(null);
  }

  async function handleToggleOnSite(date: string) {
    if (!session) {
      return;
    }
    const optimisticDates = onSiteDates.includes(date)
      ? onSiteDates.filter((entry) => entry !== date)
      : [...onSiteDates, date].sort((a, b) => a.localeCompare(b));

    setOnSiteDates(optimisticDates);

    try {
      const nextDates = await toggleOnSiteDate(session.userId, date);
      setOnSiteDates(nextDates);
    } catch {
      setOnSiteDates(onSiteDates);
    }
  }

  function shift(direction: -1 | 1) {
    if (view === "planning") {
      return;
    }
    setSelectedDate((current) => moveAnchor(current, view, direction));
  }

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    if (view === "planning") {
      return;
    }
    const touch = event.touches[0];
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLElement>) {
    if (view === "planning" || !swipeStart.current) {
      return;
    }
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeStart.current.x;
    const deltaY = touch.clientY - swipeStart.current.y;
    swipeStart.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    shift(deltaX < 0 ? 1 : -1);
  }

  if (!session) {
    return <AuthScreen onAuthenticate={handleAuthenticate} />;
  }

  return (
    <main className="shell">
      <section className="phone-frame">
        <header className="topbar">
          <div>
            <p className="eyebrow">Sync</p>
            <h1>{getTopbarTitle(view, selectedDate)}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => setShowSettings(true)} aria-label="Paramétrages">
              <Settings2 size={18} />
            </button>
          </div>
        </header>

        <section className="calendar-shell" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {view === "planning" ? (
            <PlanningView
              events={events}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onEditEvent={handleEdit}
              onSiteDates={onSiteDates}
              onToggleOnSite={handleToggleOnSite}
              colorPresets={colorPresets}
            />
          ) : null}
          {view === "week" ? (
            <WeekView
              events={events}
              selectedDate={selectedDate}
              onCreateEvent={handleCreate}
              onEditEvent={handleEdit}
              onSiteDates={onSiteDates}
              onToggleOnSite={handleToggleOnSite}
              colorPresets={colorPresets}
            />
          ) : null}
          {view === "month" ? (
            <MonthView
              events={events}
              selectedDate={selectedDate}
              onCreateEvent={handleCreate}
              onEditEvent={handleEdit}
              onSiteDates={onSiteDates}
              onToggleOnSite={handleToggleOnSite}
              colorPresets={colorPresets}
            />
          ) : null}
        </section>

        <nav className="bottom-nav" aria-label="Vues calendrier">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? "nav-item nav-item-active" : "nav-item"}
                onClick={() => setView(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {view === "planning" ? (
          <button className="fab" onClick={() => handleCreate()} aria-label="Ajouter un événement">
            <Plus size={24} />
          </button>
        ) : null}

        {showComposer ? (
          <EventSheet
            mode={selectedEvent ? "edit" : "create"}
            currentUserId={session.userId}
            colorPresets={colorPresets}
            initialValues={composerDefaults}
            event={selectedEvent}
            onClose={() => {
              setShowComposer(false);
              setEditingEventId(null);
              setCreateDraft(null);
            }}
            onDelete={handleDelete}
            onSave={handleSave}
          />
        ) : null}

        {showSettings ? (
          <SettingsSheet
            colorPresets={colorPresets}
            username={session.username}
            onClose={() => setShowSettings(false)}
            onSignOut={handleSignOut}
            onAddColor={(preset) => {
              if (!session) {
                return;
              }
              void addColorPreset(session.userId, preset).then((nextPresets) => {
                setColorPresets(nextPresets);
              });
            }}
            onRemoveColor={(colorId) => {
              if (!session) {
                return;
              }
              void removeColorPreset(session.userId, colorId).then(async (nextPresets) => {
                setColorPresets(nextPresets);
                await refreshData(session.userId);
              });
            }}
          />
        ) : null}
      </section>
    </main>
  );
}

function getTopbarTitle(view: CalendarView, selectedDate: string) {
  const parsed = parseISO(selectedDate);
  if (view === "planning") {
    return "Agenda";
  }
  if (view === "week") {
    const weekStart = startOfWeek(parsed, { weekStartsOn: 1 });
    return `Semaine du ${format(weekStart, "d MMM", { locale: fr })}`;
  }
  return formatMonthTitle(parsed);
}

function useLongPressAction(action: () => void) {
  const timerRef = useRef<number | null>(null);
  const didLongPress = useRef(false);
  const pressStartedAt = useRef<number | null>(null);
  const suppressClickUntil = useRef(0);
  const [isPressing, setIsPressing] = useState(false);

  function clearTimer() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function start() {
    didLongPress.current = false;
    pressStartedAt.current = Date.now();
    setIsPressing(true);
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      didLongPress.current = true;
      suppressClickUntil.current = Date.now() + 400;
      setIsPressing(false);
      action();
    }, LONG_PRESS_MS);
  }

  function finish() {
    if (
      pressStartedAt.current !== null &&
      !didLongPress.current &&
      Date.now() - pressStartedAt.current >= LONG_PRESS_MS
    ) {
      didLongPress.current = true;
      suppressClickUntil.current = Date.now() + 400;
      action();
    }
    pressStartedAt.current = null;
    setIsPressing(false);
    clearTimer();
  }

  function cancel() {
    didLongPress.current = false;
    pressStartedAt.current = null;
    finish();
  }

  return {
    isPressing,
    handlers: {
      onPointerDown: start,
      onPointerUp: finish,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onTouchStart: start,
      onTouchEnd: finish,
      onTouchCancel: cancel,
      onContextMenu: (event: React.MouseEvent) => event.preventDefault()
    },
    consumeLongPress() {
      const value = didLongPress.current || Date.now() < suppressClickUntil.current;
      didLongPress.current = false;
      return value;
    }
  };
}

function useSheetDismiss(onClose: () => void) {
  const startY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  function onStart(event: React.TouchEvent<HTMLDivElement>) {
    startY.current = event.touches[0].clientY;
    setDragOffset(0);
  }

  function onMove(event: React.TouchEvent<HTMLDivElement>) {
    if (startY.current === null) {
      return;
    }
    const deltaY = event.touches[0].clientY - startY.current;
    setDragOffset(deltaY > 0 ? deltaY : 0);
  }

  function onEnd() {
    if (dragOffset >= SHEET_CLOSE_THRESHOLD) {
      onClose();
    }
    startY.current = null;
    setDragOffset(0);
  }

  return {
    dragOffset,
    gestureHandlers: {
      onTouchStart: onStart,
      onTouchMove: onMove,
      onTouchEnd: onEnd,
      onTouchCancel: onEnd
    }
  };
}

function AuthScreen({
  onAuthenticate
}: {
  onAuthenticate: (mode: AuthMode, username: string, password: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (mode === "signup" && password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAuthenticate(mode, username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="auth-card">
        <div className="auth-copy">
          <p className="eyebrow">Sync</p>
          <h1>Ton agenda personnel</h1>
          <p>Mobile, sombre et rapide. Crée ton identifiant puis organise tes événements sans e-mail.</p>
        </div>

        <div className="segmented">
          <button
            className={mode === "signup" ? "segment segment-active" : "segment"}
            onClick={() => setMode("signup")}
          >
            Créer
          </button>
          <button
            className={mode === "login" ? "segment segment-active" : "segment"}
            onClick={() => setMode("login")}
          >
            Connexion
          </button>
        </div>

        <label className="field">
          <span>Identifiant</span>
          <input placeholder="adri" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>

        <label className="field">
          <span>Mot de passe</span>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </label>

        {mode === "signup" ? (
          <label className="field">
            <span>Confirmer le mot de passe</span>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}

        <button
          className="primary-button"
          disabled={busy || !username || !password || (mode === "signup" && !confirmPassword)}
          onClick={submit}
        >
          {busy ? "Chargement..." : mode === "signup" ? "Créer le compte" : "Se connecter"}
        </button>
      </section>
    </main>
  );
}

function PlanningView({
  events,
  selectedDate,
  onSelectDate,
  onEditEvent,
  onSiteDates,
  onToggleOnSite,
  colorPresets
}: {
  events: CalendarEvent[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onSiteDates: string[];
  onToggleOnSite: (date: string) => void;
  colorPresets: ColorPreset[];
}) {
  const dayKeys = getPlanningDays(events, selectedDate);
  const grouped = dayKeys.map((date) => ({
    date,
    events: events.filter((event) => date >= event.startDate && date <= event.endDate)
  }));

  if (grouped.length === 0) {
    return <section className="planning-view"><p className="empty-state">Aucun événement pour le moment.</p></section>;
  }

  return (
    <section className="planning-view">
      {grouped.map((group) => (
        <PlanningDayCard
          key={group.date}
          date={group.date}
          events={group.events}
          active={selectedDate === group.date}
          onSite={onSiteDates.includes(group.date)}
          onSelectDate={onSelectDate}
          onEditEvent={onEditEvent}
          onToggleOnSite={onToggleOnSite}
          colorPresets={colorPresets}
        />
      ))}
    </section>
  );
}

function PlanningDayCard({
  date,
  events,
  active,
  onSite,
  onSelectDate,
  onEditEvent,
  onToggleOnSite,
  colorPresets
}: {
  date: string;
  events: CalendarEvent[];
  active: boolean;
  onSite: boolean;
  onSelectDate: (date: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onToggleOnSite: (date: string) => void;
  colorPresets: ColorPreset[];
}) {
  const longPress = useLongPressAction(() => onToggleOnSite(date));

  return (
    <article
      className={getDaySurfaceClass("planning-day", active, onSite, longPress.isPressing)}
      onClick={() => {
        if (longPress.consumeLongPress()) {
          return;
        }
        onSelectDate(date);
      }}
      {...longPress.handlers}
    >
      <header className="planning-day-header">
        <div>
          <p>{formatDayLabel(date)}</p>
          <span>{events.length} événement{events.length > 1 ? "s" : ""}</span>
        </div>
      </header>
      <div className="planning-list">
        {events.map((event) => {
          const color = getColorPresetById(event.colorId, colorPresets);
          return (
            <button
              key={`${date}-${event.id}`}
              className="event-card"
              style={{ background: color.bg, borderColor: color.border, color: color.fg }}
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onEditEvent(event);
              }}
            >
              <div className="event-card-main">
                <strong>{event.title}</strong>
                <span>{formatTimeRange(event)}</span>
              </div>
              {event.location ? (
                <div className="event-card-meta">
                  <MapPin size={14} />
                  <span>{event.location}</span>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function WeekView({
  events,
  selectedDate,
  onCreateEvent,
  onEditEvent,
  onSiteDates,
  onToggleOnSite,
  colorPresets
}: {
  events: CalendarEvent[];
  selectedDate: string;
  onCreateEvent: (defaults?: Partial<EventFormValues>) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onSiteDates: string[];
  onToggleOnSite: (date: string) => void;
  colorPresets: ColorPreset[];
}) {
  const days = getWeekDays(selectedDate);

  return (
    <section className="week-view">
      <div className="week-timeline">
        <div className="week-hours">
          {WEEK_HOURS.map((hour) => (
            <div key={hour} className="week-hour">
              {hour}
            </div>
          ))}
        </div>
        <div className="week-columns">
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayEvents = events.filter((event) => spansOnDay(event, day));
            return (
              <WeekDayColumn
                key={dateKey}
                date={day}
                dateKey={dateKey}
                events={dayEvents}
                active={selectedDate === dateKey}
                onSite={onSiteDates.includes(dateKey)}
                onCreateEvent={onCreateEvent}
                onEditEvent={onEditEvent}
                onToggleOnSite={onToggleOnSite}
                colorPresets={colorPresets}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WeekDayColumn({
  date,
  dateKey,
  events,
  active,
  onSite,
  onCreateEvent,
  onEditEvent,
  onToggleOnSite,
  colorPresets
}: {
  date: Date;
  dateKey: string;
  events: CalendarEvent[];
  active: boolean;
  onSite: boolean;
  onCreateEvent: (defaults?: Partial<EventFormValues>) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onToggleOnSite: (date: string) => void;
  colorPresets: ColorPreset[];
}) {
  const longPress = useLongPressAction(() => onToggleOnSite(dateKey));

  return (
    <article
      className={getDaySurfaceClass("week-column", active, onSite, longPress.isPressing)}
      onClick={(clickEvent) => {
        if (longPress.consumeLongPress()) {
          return;
        }
        const defaults = getWeekCreateDefaults(dateKey, clickEvent.currentTarget.getBoundingClientRect(), clickEvent.clientY);
        onCreateEvent(defaults);
      }}
      {...longPress.handlers}
    >
      <div className="week-column-head">
        <span>{formatShortDay(date)}</span>
        <strong className={isTodayDateFns(date) ? "today-chip" : ""}>{format(date, "d")}</strong>
      </div>
      <div className="week-grid-lines">
        {WEEK_HOURS.map((hour) => (
          <div key={`${dateKey}-${hour}`} className="week-grid-line" />
        ))}
      </div>
      <div className="week-events-layer">
        {events.map((event) => {
          const color = getColorPresetById(event.colorId, colorPresets);
          const style = getWeekEventStyle(event, dateKey);
          return (
            <button
              key={`${dateKey}-${event.id}`}
              className="week-event-block"
              style={{
                ...style,
                background: color.bg,
                borderColor: color.border,
                color: color.fg
              }}
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onEditEvent(event);
              }}
            >
              <strong>{event.title}</strong>
              <span>{event.allDay ? "Journee" : event.startTime || "--:--"}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function MonthView({
  events,
  selectedDate,
  onCreateEvent,
  onEditEvent,
  onSiteDates,
  onToggleOnSite,
  colorPresets
}: {
  events: CalendarEvent[];
  selectedDate: string;
  onCreateEvent: (defaults?: Partial<EventFormValues>) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onSiteDates: string[];
  onToggleOnSite: (date: string) => void;
  colorPresets: ColorPreset[];
}) {
  const days = getMonthGrid(selectedDate);
  const selectedEvents = events.filter((event) => selectedDate >= event.startDate && selectedDate <= event.endDate);

  return (
    <section className="month-view">
      <div className="month-grid">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayEvents = events.filter((event) => spansOnDay(event, day)).slice(0, 3);
          return (
            <MonthCell
              key={dateKey}
              day={day}
              dateKey={dateKey}
              dayEvents={dayEvents}
              selectedDate={selectedDate}
              onSite={onSiteDates.includes(dateKey)}
              onCreateEvent={onCreateEvent}
              onToggleOnSite={onToggleOnSite}
              colorPresets={colorPresets}
            />
          );
        })}
      </div>

      <div className="month-detail">
        <header>
          <p>{formatDayLabel(selectedDate)}</p>
          <span>{selectedEvents.length} événement{selectedEvents.length > 1 ? "s" : ""}</span>
        </header>
        <div className="month-detail-list month-detail-scroll">
          {selectedEvents.map((event) => {
            const color = getColorPresetById(event.colorId, colorPresets);
            return (
              <button
                key={event.id}
                className="detail-event"
                style={{ background: color.bg, color: color.fg, borderColor: color.border }}
                onClick={() => onEditEvent(event)}
              >
                <strong>{event.title}</strong>
                <span>{formatTimeRange(event)}</span>
              </button>
            );
          })}
          {selectedEvents.length === 0 ? <p className="empty-state">Aucun événement sur cette date.</p> : null}
        </div>
      </div>
    </section>
  );
}

function MonthCell({
  day,
  dateKey,
  dayEvents,
  selectedDate,
  onSite,
  onCreateEvent,
  onToggleOnSite,
  colorPresets
}: {
  day: Date;
  dateKey: string;
  dayEvents: CalendarEvent[];
  selectedDate: string;
  onSite: boolean;
  onCreateEvent: (defaults?: Partial<EventFormValues>) => void;
  onToggleOnSite: (date: string) => void;
  colorPresets: ColorPreset[];
}) {
  const longPress = useLongPressAction(() => onToggleOnSite(dateKey));
  const active = selectedDate === dateKey;
  const muted = !isSameMonth(day, parseISO(selectedDate));

  return (
    <button
      className={`${getDaySurfaceClass("month-cell", active, onSite, longPress.isPressing)}${muted ? " month-cell-muted" : ""}`}
      onClick={() => {
        if (longPress.consumeLongPress()) {
          return;
        }
        onCreateEvent({
          startDate: dateKey,
          endDate: dateKey
        });
      }}
      {...longPress.handlers}
    >
      <span className={isTodayDateFns(day) ? "today-chip" : "month-date"}>{format(day, "d")}</span>
      <div className="month-dots">
        {dayEvents.map((event) => {
          const color = getColorPresetById(event.colorId, colorPresets);
          return <span key={event.id} className="month-dot" style={{ background: color.border }} />;
        })}
      </div>
    </button>
  );
}

function EventSheet({
  mode,
  currentUserId,
  colorPresets,
  initialValues,
  event,
  onClose,
  onDelete,
  onSave
}: {
  mode: "create" | "edit";
  currentUserId: string;
  colorPresets: ColorPreset[];
  initialValues: EventFormValues;
  event: CalendarEvent | null;
  onClose: () => void;
  onDelete: (eventId: string) => Promise<void>;
  onSave: (values: EventFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<EventFormValues>(initialValues);
  const [endDateTouched, setEndDateTouched] = useState(mode === "edit");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [historySuggestions, setHistorySuggestions] = useState<LocationSuggestion[]>([]);
  const [remoteSuggestions, setRemoteSuggestions] = useState<LocationSuggestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setValues(initialValues);
    setEndDateTouched(mode === "edit");
    setSubmitError("");
  }, [initialValues, mode]);

  useEffect(() => {
    void getRememberedLocations(currentUserId).then((locations) => {
      const history = locations
        .filter((entry) => entry.toLowerCase().includes(values.location.toLowerCase()))
        .map((entry) => ({
          id: `history-${entry}`,
          label: entry,
          source: "history" as const
        }));
      setHistorySuggestions(history);
    });
  }, [currentUserId, values.location]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      const suggestions = await fetchLocationSuggestions(values.location);
      setRemoteSuggestions(suggestions);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [values.location]);

  function patch(next: Partial<EventFormValues>) {
    setValues((current) => {
      const merged = { ...current, ...next };
      if (Object.hasOwn(next, "startDate") && !endDateTouched) {
        merged.endDate = merged.startDate;
      }
      return merged;
    });
  }

  const errors = {
    title: values.title.trim().length === 0,
    startDate: !values.startDate,
    endDate: !values.endDate
  };

  const canSubmit = !errors.title && !errors.startDate && !errors.endDate;
  const suggestions = [...historySuggestions, ...remoteSuggestions].slice(0, 6);
  const readonlyExternal = event ? event.source !== "sync" : false;
  const sheetDismiss = useSheetDismiss(onClose);

  async function handleSubmit() {
    if (!canSubmit || readonlyExternal || saving) {
      return;
    }
    setSaving(true);
    setSubmitError("");
    try {
      await onSave(values);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Impossible d'enregistrer l'événement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay">
      <section className="sheet" style={{ transform: `translateY(${sheetDismiss.dragOffset}px)` }}>
        <header className="sheet-header">
          <div className="sheet-grabber-zone" {...sheetDismiss.gestureHandlers}>
            <div className="sheet-grabber" />
          </div>
          <div>
            <p className="eyebrow">{mode === "create" ? "Nouvel événement" : "Modifier l'événement"}</p>
            <h2>{readonlyExternal ? "Lecture seule" : mode === "create" ? "Créer" : "Modifier"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">
            <Settings2 size={18} />
          </button>
        </header>

        <div className="sheet-fields">
          <label className="field">
            <span>Titre</span>
            <input value={values.title} onChange={(inputEvent) => patch({ title: inputEvent.target.value })} placeholder="Ajouter un titre" disabled={readonlyExternal} />
          </label>

          <label className="switch-row">
            <span>Toute la journée</span>
            <button className={values.allDay ? "switch switch-active" : "switch"} onClick={() => patch({ allDay: !values.allDay })} disabled={readonlyExternal}>
              <span />
            </button>
          </label>

          <div className="date-grid">
            <label className="field">
              <span>Date de début</span>
              <input type="date" value={values.startDate} onChange={(inputEvent) => patch({ startDate: inputEvent.target.value })} disabled={readonlyExternal} />
            </label>
            {!values.allDay ? (
              <label className="field">
                <span>Heure de début</span>
                <TimeSelect value={values.startTime} onChange={(time) => patch({ startTime: time })} disabled={readonlyExternal} />
              </label>
            ) : null}
          </div>

          <div className="date-grid">
            <label className="field">
              <span>Date de fin</span>
              <input
                type="date"
                value={values.endDate}
                onChange={(inputEvent) => {
                  setEndDateTouched(true);
                  patch({ endDate: inputEvent.target.value });
                }}
                disabled={readonlyExternal}
              />
            </label>
            {!values.allDay ? (
              <label className="field">
                <span>Heure de fin</span>
                <TimeSelect value={values.endTime} onChange={(time) => patch({ endTime: time })} disabled={readonlyExternal} />
              </label>
            ) : null}
          </div>

          <label className="field">
            <span>Lieu</span>
            <input value={values.location} onChange={(inputEvent) => patch({ location: inputEvent.target.value })} placeholder="Ajouter un lieu" disabled={readonlyExternal} />
          </label>

          {suggestions.length > 0 && !readonlyExternal ? (
            <div className="suggestions-row">
              {suggestions.map((suggestion) => (
                <button key={suggestion.id} className="suggestion-pill" onClick={() => patch({ location: suggestion.label })}>
                  {suggestion.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="color-row">
            {colorPresets.map((preset) => (
              <button
                key={preset.id}
                className={values.colorId === preset.id ? "color-swatch color-swatch-active" : "color-swatch"}
                style={{ background: preset.border }}
                onClick={() => patch({ colorId: preset.id })}
                aria-label={preset.label}
                disabled={readonlyExternal}
              />
            ))}
          </div>

          {readonlyExternal ? <p className="hint-text">Cet événement provient d'une source externe en lecture seule.</p> : null}
          {submitError ? <p className="error-text">{submitError}</p> : null}
        </div>

        <footer className="sheet-footer">
          {mode === "edit" && event?.source === "sync" ? (
            showDeleteConfirm ? (
              <button type="button" className="danger-button" onClick={() => onDelete(event.id)}>
                Confirmer la suppression
              </button>
            ) : (
              <button type="button" className="ghost-button" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={16} />
                Supprimer
              </button>
            )
          ) : (
            <div />
          )}

          <button type="button" className="primary-button" disabled={!canSubmit || readonlyExternal || saving} onClick={() => void handleSubmit()}>
            {saving ? "Enregistrement..." : mode === "create" ? "Créer" : "Enregistrer"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function TimeSelect({
  value,
  onChange,
  disabled
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const options = [""].concat(
    Array.from({ length: 24 }, (_, hour) => MINUTE_OPTIONS.map((minute) => `${String(hour).padStart(2, "0")}:${minute}`)).flat()
  );

  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      {options.map((option) => (
        <option key={option || "empty"} value={option}>
          {option || "Non définie"}
        </option>
      ))}
    </select>
  );
}

function SettingsSheet({
  colorPresets,
  username,
  onClose,
  onSignOut,
  onAddColor,
  onRemoveColor
}: {
  colorPresets: ColorPreset[];
  username: string;
  onClose: () => void;
  onSignOut: () => void;
  onAddColor: (preset: ColorPreset) => void;
  onRemoveColor: (colorId: string) => void;
}) {
  const [showColorLibrary, setShowColorLibrary] = useState(false);
  const [pendingDeleteColorId, setPendingDeleteColorId] = useState<string | null>(null);
  const sheetDismiss = useSheetDismiss(onClose);

  return (
    <div className="overlay">
      <section className="sheet" style={{ transform: `translateY(${sheetDismiss.dragOffset}px)` }}>
        <header className="sheet-header">
          <div className="sheet-grabber-zone" {...sheetDismiss.gestureHandlers}>
            <div className="sheet-grabber" />
          </div>
          <div>
            <p className="eyebrow">Paramétrages</p>
            <h2>@{username}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">
            <Settings2 size={18} />
          </button>
        </header>

        <div className="sheet-fields">
          <div className="settings-card">
            <div className="settings-card-head">
              <div>
                <h3>Couleurs</h3>
                <p>Référentiel personnel utilisé dans les événements.</p>
              </div>
              <button className="icon-button" onClick={() => setShowColorLibrary(true)} aria-label="Ajouter une couleur">
                <Plus size={18} />
              </button>
            </div>
            <div className="settings-colors">
              {colorPresets.map((preset) => (
                <ColorPresetChip
                  key={preset.id}
                  preset={preset}
                  pendingDelete={pendingDeleteColorId === preset.id}
                  onLongPress={() => setPendingDeleteColorId(preset.id)}
                  onConfirmDelete={() => {
                    onRemoveColor(preset.id);
                    setPendingDeleteColorId(null);
                  }}
                  onCancelDelete={() => setPendingDeleteColorId(null)}
                />
              ))}
            </div>
          </div>
        </div>

        <footer className="sheet-footer">
          <div />
          <button className="ghost-button" onClick={onSignOut}>
            Déconnexion
          </button>
        </footer>

        {showColorLibrary ? (
          <ColorLibrarySheet
            selectedIds={colorPresets.map((preset) => preset.id)}
            onClose={() => setShowColorLibrary(false)}
            onSelectColor={(preset) => {
              onAddColor(preset);
              setShowColorLibrary(false);
            }}
          />
        ) : null}
      </section>
    </div>
  );
}

function ColorPresetChip({
  preset,
  pendingDelete,
  onLongPress,
  onConfirmDelete,
  onCancelDelete
}: {
  preset: ColorPreset;
  pendingDelete: boolean;
  onLongPress: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const longPress = useLongPressAction(onLongPress);

  return (
    <div className="settings-color-item">
      <button
        className="settings-color-chip"
        style={{ background: preset.bg, borderColor: preset.border, color: preset.fg }}
        onClick={() => {
          if (longPress.consumeLongPress()) {
            return;
          }
        }}
        {...longPress.handlers}
      >
        <span className="settings-color-sample" style={{ background: preset.border }} />
        <strong>{preset.label}</strong>
      </button>
      {pendingDelete ? (
        <div className="settings-color-confirm">
          <button className="danger-mini" onClick={onConfirmDelete}>
            Confirmer
          </button>
          <button className="ghost-mini" onClick={onCancelDelete}>
            Annuler
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ColorLibrarySheet({
  selectedIds,
  onClose,
  onSelectColor
}: {
  selectedIds: string[];
  onClose: () => void;
  onSelectColor: (preset: ColorPreset) => void;
}) {
  const sheetDismiss = useSheetDismiss(onClose);

  return (
    <div className="overlay overlay-nested">
      <section className="sheet sheet-large" style={{ transform: `translateY(${sheetDismiss.dragOffset}px)` }}>
        <header className="sheet-header">
          <div className="sheet-grabber-zone" {...sheetDismiss.gestureHandlers}>
            <div className="sheet-grabber" />
          </div>
          <div>
            <p className="eyebrow">Palette</p>
            <h2>Ajouter une couleur</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">
            <Settings2 size={18} />
          </button>
        </header>
        <div className="color-library">
          {COLOR_LIBRARY.map((preset) => {
            const selected = selectedIds.includes(preset.id);
            return (
              <button
                key={preset.id}
                className={selected ? "color-library-card color-library-card-disabled" : "color-library-card"}
                style={{ background: preset.bg, borderColor: preset.border, color: preset.fg }}
                onClick={() => onSelectColor(preset)}
                disabled={selected}
              >
                <span className="color-library-dot" style={{ background: preset.border }} />
                <strong>{preset.label}</strong>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function getDaySurfaceClass(base: string, active: boolean, onSite: boolean, isPressing = false) {
  return `${base}${active ? ` ${base}-active` : ""}${onSite ? " day-surface-onsite" : ""}${isPressing ? " day-surface-pressing" : ""}`;
}

function getWeekEventStyle(event: CalendarEvent, dateKey: string) {
  if (event.allDay || event.startDate !== dateKey || event.endDate !== dateKey) {
    return {
      top: "4%",
      height: "11%"
    };
  }

  const startMinutes = timeStringToMinutes(event.startTime) ?? DAY_START_MINUTES;
  const endMinutes = timeStringToMinutes(event.endTime) ?? Math.min(startMinutes + 60, DAY_END_MINUTES);
  const clampedStart = Math.min(Math.max(startMinutes, DAY_START_MINUTES), DAY_END_MINUTES - 15);
  const clampedEnd = Math.min(Math.max(endMinutes, clampedStart + 30), DAY_END_MINUTES);
  const top = ((clampedStart - DAY_START_MINUTES) / DAY_RANGE_MINUTES) * 100;
  const height = Math.max(((clampedEnd - clampedStart) / DAY_RANGE_MINUTES) * 100, 6);

  return {
    top: `${top}%`,
    height: `${height}%`
  };
}

function getWeekCreateDefaults(dateKey: string, rect: DOMRect, clientY: number): Partial<EventFormValues> {
  const usableHeight = Math.max(rect.height - WEEK_HEADER_HEIGHT, 1);
  const relativeY = Math.min(Math.max(clientY - rect.top - WEEK_HEADER_HEIGHT, 0), usableHeight);
  const ratio = relativeY / usableHeight;
  const totalMinutes = DAY_START_MINUTES + ratio * DAY_RANGE_MINUTES;
  const roundedQuarter = Math.round(totalMinutes / 15) * 15;
  const startMinutes = Math.min(Math.max(roundedQuarter, DAY_START_MINUTES), DAY_END_MINUTES - 15);
  const endMinutes = Math.min(startMinutes + 60, DAY_END_MINUTES);

  return {
    startDate: dateKey,
    endDate: dateKey,
    startTime: minutesToTimeString(startMinutes),
    endTime: minutesToTimeString(endMinutes)
  };
}

function minutesToTimeString(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
