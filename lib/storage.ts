import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where
} from "firebase/firestore";
import { DEFAULT_COLOR_ID, DEFAULT_USER_COLOR_PRESETS, getColorPresetById } from "@/lib/colors";
import { todayIso } from "@/lib/date";
import { auth, db } from "@/lib/firebase";
import type {
  CalendarEvent,
  ColorPreset,
  EventFormValues,
  ExternalSourceConnection,
  Session,
  StoredUser,
  UserMeta
} from "@/lib/types";

const USER_META_COLLECTION = "userMeta";
const USERS_COLLECTION = "users";
const EVENTS_COLLECTION = "events";
const USERNAMES_COLLECTION = "usernames";

const seedSources: ExternalSourceConnection[] = [
  {
    source: "google",
    enabled: false,
    label: "Google invitations",
    status: "Lecture seule, accepté uniquement"
  },
  {
    source: "apple_birthdays",
    enabled: false,
    label: "Apple anniversaires",
    status: "Lecture seule via calendrier Apple"
  }
];

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function usernameToAuthEmail(username: string) {
  return `${normalizeUsername(username)}@sync.local`;
}

async function getUserMeta(userId: string): Promise<UserMeta> {
  const snapshot = await getDoc(doc(db, USER_META_COLLECTION, userId));
  if (!snapshot.exists()) {
    return {
      locations: [],
      sources: seedSources,
      onSiteDates: [],
      colorPresets: DEFAULT_USER_COLOR_PRESETS
    };
  }
  const data = snapshot.data() as Partial<UserMeta>;
  return {
    locations: data.locations ?? [],
    sources: data.sources ?? seedSources,
    onSiteDates: data.onSiteDates ?? [],
    colorPresets: data.colorPresets?.length ? data.colorPresets : DEFAULT_USER_COLOR_PRESETS
  };
}

async function setUserMeta(userId: string, partial: Partial<UserMeta>) {
  const current = await getUserMeta(userId);
  await setDoc(
    doc(db, USER_META_COLLECTION, userId),
    {
      ...current,
      ...partial
    },
    { merge: true }
  );
}

async function getStoredUser(userId: string) {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, userId));
  return snapshot.exists() ? (snapshot.data() as StoredUser) : null;
}

async function ensureSeedData(userId: string) {
  const currentEvents = await getEvents(userId);
  if (currentEvents.length > 0) {
    return;
  }

  const today = todayIso();
  const now = new Date().toISOString();
  const seeds: CalendarEvent[] = [
    {
      id: crypto.randomUUID(),
      userId,
      title: "Sprint design",
      allDay: false,
      startDate: today,
      startTime: "09:00",
      endDate: today,
      endTime: "10:00",
      location: "Studio Sync, Paris",
      colorId: "ocean",
      source: "sync",
      createdAt: now,
      updatedAt: now
    },
    {
      id: crypto.randomUUID(),
      userId,
      title: "Diner anniversaire Lea",
      allDay: false,
      startDate: today,
      startTime: "20:00",
      endDate: today,
      endTime: "22:00",
      location: "Maison",
      colorId: "rose",
      source: "apple_birthdays",
      sourceMeta: { provider: "apple" },
      createdAt: now,
      updatedAt: now
    }
  ];

  await Promise.all(seeds.map((event) => setDoc(doc(db, EVENTS_COLLECTION, event.id), event)));
  await setUserMeta(userId, { sources: seedSources });
}

async function ensureAuthPersistence() {
  await setPersistence(auth, browserLocalPersistence);
}

async function buildSessionFromUser(user: User): Promise<Session | null> {
  const storedUser = await getStoredUser(user.uid);
  if (!storedUser) {
    return null;
  }
  return {
    userId: storedUser.id,
    username: storedUser.username
  };
}

export async function signUp(username: string, password: string): Promise<Session> {
  const normalized = normalizeUsername(username);
  const authEmail = usernameToAuthEmail(normalized);
  await ensureAuthPersistence();

  const credential = await createUserWithEmailAndPassword(auth, authEmail, password);
  const userId = credential.user.uid;
  const userDoc: StoredUser = {
    id: userId,
    username: normalized,
    authEmail,
    createdAt: new Date().toISOString()
  };

  try {
    await runTransaction(db, async (transaction) => {
      const usernameRef = doc(db, USERNAMES_COLLECTION, normalized);
      const usernameSnap = await transaction.get(usernameRef);
      if (usernameSnap.exists()) {
        throw new Error("Cet identifiant existe deja.");
      }

      transaction.set(doc(db, USERS_COLLECTION, userId), userDoc);
      transaction.set(doc(db, USER_META_COLLECTION, userId), {
        locations: [],
        sources: seedSources,
        onSiteDates: [],
        colorPresets: DEFAULT_USER_COLOR_PRESETS
      });
      transaction.set(usernameRef, {
        uid: userId,
        username: normalized,
        createdAt: userDoc.createdAt
      });
    });
  } catch (error) {
    await deleteUser(credential.user);
    throw error;
  }

  await ensureSeedData(userId);
  return {
    userId,
    username: normalized
  };
}

export async function signIn(username: string, password: string): Promise<Session> {
  await ensureAuthPersistence();
  const credential = await signInWithEmailAndPassword(auth, usernameToAuthEmail(username), password);
  const session = await buildSessionFromUser(credential.user);
  if (!session) {
    throw new Error("Compte introuvable dans Firestore.");
  }
  await ensureSeedData(session.userId);
  return session;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export async function getSession() {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }
  return buildSessionFromUser(currentUser);
}

export function observeSession(callback: (session: Session | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      callback(null);
      return;
    }
    void buildSessionFromUser(user).then(callback);
  });
}

export async function getEvents(userId: string) {
  const eventsRef = collection(db, EVENTS_COLLECTION);
  const snapshot = await getDocs(query(eventsRef, where("userId", "==", userId)));
  return snapshot.docs.map((entry) => entry.data() as CalendarEvent);
}

export async function saveEvent(userId: string, values: EventFormValues, existingId?: string) {
  const now = new Date().toISOString();
  const existingCreatedAt = existingId
    ? (await getDoc(doc(db, EVENTS_COLLECTION, existingId))).data()?.createdAt
    : undefined;

  const event: CalendarEvent = {
    id: existingId ?? crypto.randomUUID(),
    userId,
    title: values.title.trim(),
    allDay: values.allDay,
    startDate: values.startDate,
    startTime: values.allDay ? undefined : values.startTime || undefined,
    endDate: values.endDate,
    endTime: values.allDay ? undefined : values.endTime || undefined,
    location: values.location.trim() || undefined,
    colorId: values.colorId || DEFAULT_COLOR_ID,
    source: "sync",
    createdAt: typeof existingCreatedAt === "string" ? existingCreatedAt : now,
    updatedAt: now
  };

  await setDoc(doc(db, EVENTS_COLLECTION, event.id), event);
  await rememberLocation(userId, values.location);
  return event;
}

export async function deleteEvent(id: string) {
  await deleteDoc(doc(db, EVENTS_COLLECTION, id));
}

export async function getRememberedLocations(userId: string) {
  const meta = await getUserMeta(userId);
  return meta.locations;
}

export async function rememberLocation(userId: string, location: string) {
  const trimmed = location.trim();
  if (!trimmed) {
    return;
  }
  const meta = await getUserMeta(userId);
  const nextLocations = [trimmed, ...meta.locations.filter((entry) => entry !== trimmed)].slice(0, 8);
  await setUserMeta(userId, { locations: nextLocations });
}

export async function getExternalSourceConnections(userId: string) {
  const meta = await getUserMeta(userId);
  return meta.sources;
}

export async function getColorPresets(userId: string) {
  const meta = await getUserMeta(userId);
  return meta.colorPresets;
}

export async function addColorPreset(userId: string, preset: ColorPreset) {
  const meta = await getUserMeta(userId);
  if (meta.colorPresets.some((entry) => entry.id === preset.id)) {
    return meta.colorPresets;
  }
  const nextPresets = [...meta.colorPresets, preset];
  await setUserMeta(userId, { colorPresets: nextPresets });
  return nextPresets;
}

export async function removeColorPreset(userId: string, colorId: string) {
  const meta = await getUserMeta(userId);
  if (meta.colorPresets.length <= 1) {
    return meta.colorPresets;
  }

  const nextPresets = meta.colorPresets.filter((preset) => preset.id !== colorId);
  const fallbackColorId = nextPresets[0]?.id ?? DEFAULT_COLOR_ID;
  const userEvents = await getEvents(userId);
  const impactedEvents = userEvents.filter((event) => event.colorId === colorId);

  await Promise.all(
    impactedEvents.map((event) =>
      setDoc(doc(db, EVENTS_COLLECTION, event.id), {
        ...event,
        colorId: getColorPresetById(fallbackColorId, nextPresets).id,
        updatedAt: new Date().toISOString()
      })
    )
  );

  await setUserMeta(userId, { colorPresets: nextPresets });
  return nextPresets;
}

export async function getOnSiteDates(userId: string) {
  const meta = await getUserMeta(userId);
  return meta.onSiteDates;
}

export async function toggleOnSiteDate(userId: string, date: string) {
  const meta = await getUserMeta(userId);
  const exists = meta.onSiteDates.includes(date);
  const nextDates = exists
    ? meta.onSiteDates.filter((entry) => entry !== date)
    : [...meta.onSiteDates, date].sort((a, b) => a.localeCompare(b));
  await setUserMeta(userId, { onSiteDates: nextDates });
  return nextDates;
}

export async function updateExternalSource(
  userId: string,
  source: ExternalSourceConnection["source"],
  enabled: boolean
) {
  const meta = await getUserMeta(userId);
  await setUserMeta(userId, {
    sources: meta.sources.map((entry) => (entry.source === source ? { ...entry, enabled } : entry))
  });
}

export function getDefaultEventForm(anchorDate = todayIso()): EventFormValues {
  return {
    title: "",
    allDay: false,
    startDate: anchorDate,
    startTime: "",
    endDate: anchorDate,
    endTime: "",
    location: "",
    colorId: DEFAULT_COLOR_ID
  };
}

export function toEventFormValues(event: CalendarEvent): EventFormValues {
  return {
    title: event.title,
    allDay: event.allDay,
    startDate: event.startDate,
    startTime: event.startTime ?? "",
    endDate: event.endDate,
    endTime: event.endTime ?? "",
    location: event.location ?? "",
    colorId: event.colorId
  };
}
