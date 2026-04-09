"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock3, Grid2x2, MapPin, Plus, Settings2, Trash2 } from "lucide-react";
import { format, isSameMonth, isToday as isTodayDateFns, parseISO, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { COLOR_PRESETS } from "@/lib/colors";
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
  deleteEvent,
  getDefaultEventForm,
  getEvents,
  getExternalSourceConnections,
  getOnSiteDates,
  getRememberedLocations,
  getSession,
  observeSession,
  saveEvent,
  signIn,
  signOut,
  signUp,
  toEventFormValues,
  toggleOnSiteDate,
  updateExternalSource
} from "@/lib/storage";
import type {
  CalendarEvent,
  CalendarView,
  EventFormValues,
  ExternalSourceConnection,
  LocationSuggestion,
  Session
} from "@/lib/types";

type AuthMode = "login" | "signup";

const LONG_PRESS_MS = 420;
const SWIPE_THRESHOLD = 54;
const WEEK_HOURS = Array.from({ length: 17 }, (_, index) => (index === 16 ? "00:00" : `${String(index + 8).padStart(2, "0")}:00`));
const DAY_START_MINUTES = 8 * 60;
const DAY_END_MINUTES = 24 * 60;
const DAY_RANGE_MINUTES = DAY_END_MINUTES - DAY_START_MINUTES;

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
  const [showSettings, setShowSettings] = useState(false);
  const [sourceConnections, setSourceConnections] = useState<ExternalSourceConnection[]>([]);
  const [onSiteDates, setOnSiteDates] = useState<string[]>([]);
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

  const composerDefaults = selectedEvent ? toEventFormValues(selectedEvent) : getDefaultEventForm(selectedDate);

  async function refreshData(userId = session?.userId) {
    if (!userId) {
      return;
    }
    const [nextEvents, nextSources, nextOnSiteDates] = await Promise.all([
      getEvents(userId),
      getExternalSourceConnections(userId),
      getOnSiteDates(userId)
    ]);
    setEvents(sortEvents(nextEvents));
    setSourceConnections(nextSources);
    setOnSiteDates(nextOnSiteDates);
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
    setShowComposer(false);
    setShowSettings(false);
  }

  function handleCreate() {
    setEditingEventId(null);
    setShowComposer(true);
  }

  function handleEdit(event: CalendarEvent) {
    setEditingEventId(event.id);
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
    setSelectedDate(values.startDate);
  }

  async function handleDelete(eventId: string) {
    await deleteEvent(eventId);
    await refreshData();
    setShowComposer(false);
    setEditingEventId(null);
  }

  async function handleToggleOnSite(date: string) {
    if (!session) {
      return;
    }
    const nextDates = await toggleOnSiteDate(session.userId, date);
    setOnSiteDates(nextDates);
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
            />
          ) : null}
          {view === "week" ? (
            <WeekView
              events={events}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onEditEvent={handleEdit}
              onSiteDates={onSiteDates}
              onToggleOnSite={handleToggleOnSite}
            />
          ) : null}
          {view === "month" ? (
            <MonthView
              events={events}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onEditEvent={handleEdit}
              onSiteDates={onSiteDates}
              onToggleOnSite={handleToggleOnSite}
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

        <button className="fab" onClick={handleCreate} aria-label="Ajouter un événement">
          <Plus size={24} />
        </button>

        {showComposer ? (
          <EventSheet
            mode={selectedEvent ? "edit" : "create"}
            currentUserId={session.userId}
            initialValues={composerDefaults}
            event={selectedEvent}
            onClose={() => {
              setShowComposer(false);
              setEditingEventId(null);
            }}
            onDelete={handleDelete}
            onSave={handleSave}
          />
        ) : null}

        {showSettings ? (
          <SettingsSheet
            connections={sourceConnections}
            username={session.username}
            onClose={() => setShowSettings(false)}
            onSignOut={handleSignOut}
            onToggleSource={(source, enabled) => {
              if (!session) {
                return;
              }
              void updateExternalSource(session.userId, source, enabled).then(() => {
                void refreshData(session.userId);
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

  function clearTimer() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function start() {
    didLongPress.current = false;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      didLongPress.current = true;
      action();
    }, LONG_PRESS_MS);
  }

  function finish() {
    clearTimer();
  }

  return {
    handlers: {
      onTouchStart: start,
      onTouchEnd: finish,
      onTouchCancel: finish,
      onMouseDown: start,
      onMouseUp: finish,
      onMouseLeave: finish
    },
    consumeLongPress() {
      const value = didLongPress.current;
      didLongPress.current = false;
      return value;
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
  onToggleOnSite
}: {
  events: CalendarEvent[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onSiteDates: string[];
  onToggleOnSite: (date: string) => void;
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
  onToggleOnSite
}: {
  date: string;
  events: CalendarEvent[];
  active: boolean;
  onSite: boolean;
  onSelectDate: (date: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onToggleOnSite: (date: string) => void;
}) {
  const longPress = useLongPressAction(() => onToggleOnSite(date));

  return (
    <article
      className={getDaySurfaceClass("planning-day", active, onSite)}
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
          const color = COLOR_PRESETS.find((preset) => preset.id === event.colorId) ?? COLOR_PRESETS[0];
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
  onSelectDate,
  onEditEvent,
  onSiteDates,
  onToggleOnSite
}: {
  events: CalendarEvent[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onSiteDates: string[];
  onToggleOnSite: (date: string) => void;
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
                onSelectDate={onSelectDate}
                onEditEvent={onEditEvent}
                onToggleOnSite={onToggleOnSite}
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
  onSelectDate,
  onEditEvent,
  onToggleOnSite
}: {
  date: Date;
  dateKey: string;
  events: CalendarEvent[];
  active: boolean;
  onSite: boolean;
  onSelectDate: (date: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onToggleOnSite: (date: string) => void;
}) {
  const longPress = useLongPressAction(() => onToggleOnSite(dateKey));

  return (
    <article
      className={getDaySurfaceClass("week-column", active, onSite)}
      onClick={() => {
        if (longPress.consumeLongPress()) {
          return;
        }
        onSelectDate(dateKey);
      }}
      {...longPress.handlers}
    >
      <div className="week-column-head">
        <span>{formatShortDay(date)}</span>
        <strong className={isTodayDateFns(date) ? "today-chip-inline" : ""}>{format(date, "d")}</strong>
      </div>
      <div className="week-grid-lines">
        {WEEK_HOURS.map((hour) => (
          <div key={`${dateKey}-${hour}`} className="week-grid-line" />
        ))}
      </div>
      <div className="week-events-layer">
        {events.map((event) => {
          const color = COLOR_PRESETS.find((preset) => preset.id === event.colorId) ?? COLOR_PRESETS[0];
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
  onSelectDate,
  onEditEvent,
  onSiteDates,
  onToggleOnSite
}: {
  events: CalendarEvent[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onSiteDates: string[];
  onToggleOnSite: (date: string) => void;
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
              onSelectDate={onSelectDate}
              onToggleOnSite={onToggleOnSite}
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
            const color = COLOR_PRESETS.find((preset) => preset.id === event.colorId) ?? COLOR_PRESETS[0];
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
  onSelectDate,
  onToggleOnSite
}: {
  day: Date;
  dateKey: string;
  dayEvents: CalendarEvent[];
  selectedDate: string;
  onSite: boolean;
  onSelectDate: (date: string) => void;
  onToggleOnSite: (date: string) => void;
}) {
  const longPress = useLongPressAction(() => onToggleOnSite(dateKey));
  const active = selectedDate === dateKey;
  const muted = !isSameMonth(day, parseISO(selectedDate));

  return (
    <button
      className={`${getDaySurfaceClass("month-cell", active, onSite)}${muted ? " month-cell-muted" : ""}`}
      onClick={() => {
        if (longPress.consumeLongPress()) {
          return;
        }
        onSelectDate(dateKey);
      }}
      {...longPress.handlers}
    >
      <span className={isTodayDateFns(day) ? "today-chip" : "month-date"}>{format(day, "d")}</span>
      <div className="month-dots">
        {dayEvents.map((event) => {
          const color = COLOR_PRESETS.find((preset) => preset.id === event.colorId) ?? COLOR_PRESETS[0];
          return <span key={event.id} className="month-dot" style={{ background: color.border }} />;
        })}
      </div>
    </button>
  );
}

function EventSheet({
  mode,
  currentUserId,
  initialValues,
  event,
  onClose,
  onDelete,
  onSave
}: {
  mode: "create" | "edit";
  currentUserId: string;
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

  useEffect(() => {
    setValues(initialValues);
    setEndDateTouched(mode === "edit");
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

  return (
    <div className="overlay">
      <section className="sheet">
        <header className="sheet-header">
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
            {COLOR_PRESETS.map((preset) => (
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
        </div>

        <footer className="sheet-footer">
          {mode === "edit" && event?.source === "sync" ? (
            showDeleteConfirm ? (
              <button className="danger-button" onClick={() => onDelete(event.id)}>
                Confirmer la suppression
              </button>
            ) : (
              <button className="ghost-button" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={16} />
                Supprimer
              </button>
            )
          ) : (
            <div />
          )}

          <button className="primary-button" disabled={!canSubmit || readonlyExternal} onClick={() => void onSave(values)}>
            {mode === "create" ? "Créer" : "Enregistrer"}
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
  connections,
  username,
  onClose,
  onSignOut,
  onToggleSource
}: {
  connections: ExternalSourceConnection[];
  username: string;
  onClose: () => void;
  onSignOut: () => void;
  onToggleSource: (source: ExternalSourceConnection["source"], enabled: boolean) => void;
}) {
  return (
    <div className="overlay">
      <section className="sheet">
        <header className="sheet-header">
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
            <h3>Sources externes</h3>
            <p>Lecture seule, prêtes à être reliées à Apple anniversaires et Google invitations.</p>
          </div>
          {connections.map((connection) => (
            <div key={connection.source} className="source-row">
              <div>
                <strong>{connection.label}</strong>
                <span>{connection.status}</span>
              </div>
              <button className={connection.enabled ? "switch switch-active" : "switch"} onClick={() => onToggleSource(connection.source, !connection.enabled)}>
                <span />
              </button>
            </div>
          ))}
        </div>

        <footer className="sheet-footer">
          <div />
          <button className="ghost-button" onClick={onSignOut}>
            Déconnexion
          </button>
        </footer>
      </section>
    </div>
  );
}

function getDaySurfaceClass(base: string, active: boolean, onSite: boolean) {
  return `${base}${active ? ` ${base}-active` : ""}${onSite ? " day-surface-onsite" : ""}`;
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
