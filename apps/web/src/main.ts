import {
  weekdayCodeOf,
  weekdayLabel,
  type RoutineItem,
  type RoutineTemplate,
} from "@autiplanner/core";
import { ApiError, isRetryable, HttpApi } from "./api.js";
import { applyLocally, flushPending, type FlushOutcome } from "./offline.js";
import { newId, openLocalStore, type LocalStore, type PendingCommand } from "./store.js";
import { nowSeconds } from "./time.js";
import { ROUTINE_ICONS, routineIconSvg } from "@autiplanner/icons";
import {
  addDays,
  clockOf,
  formatDayHeading,
  primaryAction,
  renderRow,
  sectionsFor,
  summaryOf,
  todayIso,
  type ItemAction,
} from "./ui.js";

const api = new HttpApi();
// Assigned in start() before anything else runs. A definite assignment
// assertion avoids a top-level await, which would need a newer target.
let store!: LocalStore;

const elements = {
  auth: must<HTMLElement>("auth"),
  planner: must<HTMLElement>("planner"),
  authForm: must<HTMLFormElement>("auth-form"),
  authError: must<HTMLElement>("auth-error"),
  signIn: must<HTMLButtonElement>("sign-in"),
  createAccount: must<HTMLButtonElement>("create-account"),
  dayHeading: must<HTMLElement>("day-heading"),
  agenda: must<HTMLElement>("agenda"),
  summary: must<HTMLElement>("summary"),
  connection: must<HTMLElement>("connection"),
  conflict: must<HTMLElement>("conflict"),
  prevDay: must<HTMLButtonElement>("prev-day"),
  nextDay: must<HTMLButtonElement>("next-day"),
  refresh: must<HTMLButtonElement>("refresh"),
  signOut: must<HTMLButtonElement>("sign-out"),
  addForm: must<HTMLFormElement>("add-form"),
  formStatus: must<HTMLElement>("form-status"),
  feedUrl: must<HTMLInputElement>("feed-url"),
  feedCopy: must<HTMLButtonElement>("feed-copy"),
  feedRotate: must<HTMLButtonElement>("feed-rotate"),
  feedStatus: must<HTMLElement>("feed-status"),
};

const state = {
  items: [] as readonly RoutineItem[],
  revision: 0,
  selectedDate: todayIso(),
  online: navigator.onLine,
  queuedUids: new Set<string>(),
  /** The selected outcome persists while the update is in flight. */
  busy: false,
  /** The item currently asking whether to be removed. */
  pendingRemove: null as string | null,
  /** The icon chosen for the next item, or "" for none. */
  newIcon: "",
};

/** The calendar whose subscription URL the subscribe section is showing. */
let feedCalendarId: string | null = null;

function must<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`missing element #${id}`);
  return element as T;
}

// ---------------------------------------------------------------- rendering

function render(): void {
  elements.dayHeading.textContent = formatDayHeading(state.selectedDate, todayIso());

  // The week the repeat would land on is the weekday of the day being looked
  // at, so the option says which day rather than leaving the household to work
  // it out. "Every week" is also what the stored rule does.
  const weekday = weekdayLabel(state.selectedDate);
  const weekly = document.querySelector<HTMLOptionElement>("#new-repeat option[value='weekly']");
  if (weekly !== null && weekday !== undefined) {
    weekly.textContent = `Every ${weekday}`;
  }

  const sections = sectionsFor(state.items, state.selectedDate);
  elements.agenda.replaceChildren(
    ...sections.map((section) => {
      const wrapper = document.createElement("section");
      wrapper.className = "day-part";

      const heading = document.createElement("h2");
      heading.textContent = section.heading;
      wrapper.append(heading);

      const list = document.createElement("ul");
      list.className = "items";
      if (section.items.length === 0) {
        const empty = document.createElement("li");
        empty.className = "item item-quiet";
        empty.textContent = "Nothing planned";
        list.append(empty);
      } else {
        for (const item of section.items) {
          list.append(
            renderRow(item, state.queuedUids.has(item.uid), {
              onAction: handleAction,
              onRemove: handleRemove,
              confirmsRemove: (candidate) => state.pendingRemove === candidate.uid,
              onRemoveAnswer: handleRemoveAnswer,
            }),
          );
        }
      }
      wrapper.append(list);
      return wrapper;
    }),
  );

  const summary = summaryOf(state.items.filter((item) => item.date === state.selectedDate));
  elements.summary.textContent = `${summary.pending} pending · ${summary.completed} completed · ${summary.missed} missed · ${summary.skipped} skipped`;

  renderConnectionBanner();
}

function renderConnectionBanner(): void {
  const queued = state.queuedUids.size;
  if (state.online && queued === 0) {
    elements.connection.hidden = true;
    return;
  }
  elements.connection.hidden = false;
  if (!state.online && queued > 0) {
    elements.connection.textContent = `Offline. ${queued} change${queued === 1 ? "" : "s"} will sync when you are back online.`;
  } else if (!state.online) {
    elements.connection.textContent = "Offline. Showing the routine saved on this device.";
  } else {
    elements.connection.textContent = `${queued} change${queued === 1 ? "" : "s"} waiting to sync.`;
  }
}

function showConflict(message: string): void {
  elements.conflict.hidden = false;
  elements.conflict.textContent = `${message} The version on the server is shown below; please make the change again.`;
}

function hideConflict(): void {
  elements.conflict.hidden = true;
}

// ------------------------------------------------------------------ syncing

async function refreshQueuedUids(): Promise<void> {
  const pending = await store.listPending();
  state.queuedUids = new Set(
    pending
      .map((command) => command.uid ?? command.item?.uid ?? command.series?.uid ?? "")
      .filter((uid) => uid !== ""),
  );
}

async function flush(): Promise<FlushOutcome> {
  const outcome = await flushPending(store, async (command) => {
    const response = await api.command({
      command: command.command,
      ...(command.uid === undefined ? {} : { uid: command.uid }),
      ...(command.completedAt === undefined ? {} : { completedAt: command.completedAt }),
      ...(command.expectedRevision === undefined
        ? {}
        : { expectedRevision: command.expectedRevision }),
      ...(command.item === undefined ? {} : { item: command.item }),
      ...(command.series === undefined ? {} : { series: command.series }),
      ...(command.patch === undefined ? {} : { patch: command.patch }),
      clientCommandId: command.id,
    });
    if (response.changed) {
      state.revision = response.revision;
    }
    return response;
  });

  if (outcome.rejected.length > 0) {
    console.warn("[autiplanner] commands the server refused", outcome.rejected);
  }
  if (outcome.conflict !== null) {
    // The server is authoritative and this change is superseded. The command is
    // dropped so the queue can drain, and the user is told to make the change
    // again against the state that is now shown.
    await store.removePending(outcome.conflict.command.id);
  }
  return outcome;
}

async function sync(): Promise<void> {
  await refreshQueuedUids();
  if (state.online) {
    try {
      // Local changes go first. Reading before writing would briefly revert the
      // interface to the pre-change state, and an offline edit would appear to
      // undo itself the moment the network returned.
      const outcome = await flush();
      const agenda = await api.agenda(state.selectedDate, WINDOW_DAYS);
      state.items = agenda.items;
      state.revision = agenda.revision;
      await store.putState({
        items: agenda.items,
        revision: agenda.revision,
        syncedAt: nowSeconds(),
      });
      if (outcome.conflict !== null) {
        showConflict(outcome.conflict.message);
      } else {
        hideConflict();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        showAuth();
        return;
      }
      // Offline or the server is unreachable: keep showing the local copy.
      console.warn("[autiplanner] sync failed", error);
    }
  }
  await refreshQueuedUids();
  render();
}

// ------------------------------------------------------------------ actions

/**
 * Builds the icon picker from the shared set: those icons, in that order, and
 * nothing else.
 *
 * Buttons rather than a select, because the choice is a picture; each is named
 * by what it means and reports whether it is chosen, so the state is not carried
 * by the highlight alone.
 */
function renderIconPicker(): void {
  const picker = document.getElementById("icon-picker");
  if (picker === null) return;
  picker.replaceChildren();
  const add = (name: string, title: string): void => {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "icon-choice";
    choice.dataset.icon = name;
    choice.setAttribute("role", "radio");
    choice.setAttribute("aria-label", title);
    choice.title = title;
    choice.innerHTML = name === "" ? "\u2205" : routineIconSvg(name, 20);
    choice.addEventListener("click", () => {
      state.newIcon = name;
      renderIconPicker();
    });
    picker.append(choice);
  };
  add("", "No icon");
  for (const icon of ROUTINE_ICONS) add(icon.name, icon.title);
  for (const choice of picker.querySelectorAll<HTMLButtonElement>(".icon-choice")) {
    const chosen = (choice.dataset.icon ?? "") === state.newIcon;
    choice.classList.toggle("chosen", chosen);
    choice.setAttribute("aria-checked", String(chosen));
  }
}

/** Asking to remove a row does not remove it; it asks. */
function handleRemove(item: RoutineItem): void {
  state.pendingRemove = item.uid;
  render();
}

function handleRemoveAnswer(item: RoutineItem, remove: boolean): void {
  state.pendingRemove = null;
  if (!remove) {
    render();
    return;
  }
  void removeItem(item);
}

/**
 * Removes one routine item.
 *
 * A day of a repeating routine is a day, not the routine: the server leaves that
 * date out of the rule and the rest carries on. Ending the repeat is a separate
 * action for a separate intent.
 */
async function removeItem(item: RoutineItem): Promise<void> {
  if (state.busy) return;
  state.busy = true;
  try {
    const command: PendingCommand = {
      id: newId(),
      command: "delete",
      uid: item.uid,
      queuedAt: nowSeconds(),
      expectedRevision: state.revision,
    };
    await queue(command);
    render();
    if (state.online) await sync();
  } finally {
    state.busy = false;
  }
}

async function handleAction(item: RoutineItem, action: ItemAction): Promise<void> {
  if (state.busy) return;
  state.busy = true;
  try {
    const command: PendingCommand = {
      id: newId(),
      command: action,
      uid: item.uid,
      queuedAt: nowSeconds(),
      // The revision this client last saw, so the server can detect a clash.
      expectedRevision: state.revision,
      ...(action === "complete" ? { completedAt: nowSeconds() } : {}),
    };

    const local = applyLocally(state.items, command);
    state.items = local.items;
    if (local.item !== null) {
      // Keep the local revision in step with the optimistic change.
      state.revision += 1;
    }
    await store.putPending(command);
    await store.putState({
      items: state.items,
      revision: state.revision,
      syncedAt: null,
    });
    await refreshQueuedUids();
    render();

    if (state.online) {
      await sync();
    }
  } finally {
    state.busy = false;
  }
}

/** How many days the app loads and previews a repeating routine over. */
const WINDOW_DAYS = 14;

/** The last day of the loaded window, exclusive. */
function windowEnd(from: string): string {
  return addDays(from, WINDOW_DAYS) ?? from;
}

async function handleAdd(form: HTMLFormElement): Promise<void> {
  const data = new FormData(form);
  const title = String(data.get("title") ?? "").trim();
  const dayPart = String(data.get("dayPart") ?? "morning");
  const time = String(data.get("time") ?? "");
  const repeat = String(data.get("repeat") ?? "none");
  if (title === "") return;
  elements.formStatus.textContent = "";

  // The item goes on the day being looked at, which is the day the window was
  // loaded from. A weekly repeat anchors on that date's weekday, so "the same
  // day every week" needs no second question.
  const date = state.selectedDate;
  const uid = `${newId()}@pwa`;
  const start = time === "" ? undefined : `${date}T${time}:00`;
  const on = weekdayLabel(date) ?? "";

  if (repeat === "none") {
    const item: RoutineItem = {
      uid,
      title,
      date,
      dayPart: dayPart as RoutineItem["dayPart"],
      status: "pending",
      ...(state.newIcon === "" ? {} : { icon: state.newIcon }),
      ...(start === undefined ? {} : { start }),
    };
    const command: PendingCommand = {
      id: newId(),
      command: "create",
      item,
      queuedAt: nowSeconds(),
      expectedRevision: state.revision,
    };
    await queue(command);
  } else {
    // A repeating routine is stored as a rule. The server expands it for the
    // window it is asked for, so no future calendar is written down here.
    const series: RoutineTemplate = {
      uid,
      title,
      date,
      dayPart: dayPart as RoutineItem["dayPart"],
      recurrence:
        repeat === "weekly" ? { freq: "weekly", byDay: [weekdayCodeOf(date) ?? "MO"] } : { freq: "daily" },
      ...(state.newIcon === "" ? {} : { icon: state.newIcon }),
      ...(start === undefined ? {} : { start }),
    };
    const command: PendingCommand = {
      id: newId(),
      command: "add_series",
      series,
      queuedAt: nowSeconds(),
      expectedRevision: state.revision,
    };
    await queue(command);
    elements.formStatus.textContent =
      repeat === "weekly" ? `Repeats every ${on}.` : "Repeats every day.";
  }

  form.reset();
  state.newIcon = "";
  renderIconPicker();
  render();
  if (state.online) await sync();
}

/** Applies a command locally, stores it for the server, and redraws. */
async function queue(command: PendingCommand): Promise<void> {
  const local = applyLocally(state.items, command, {
    from: state.selectedDate,
    to: windowEnd(state.selectedDate),
  });
  state.items = local.items;
  state.revision += 1;
  await store.putPending(command);
  await store.putState({ items: state.items, revision: state.revision, syncedAt: null });
  await refreshQueuedUids();
}

// --------------------------------------------------------- subscription feed

/**
 * Shows the read-only URL a household can add to Google Calendar or Apple
 * Calendar. The server mints the token on first request, so the URL is stable
 * until it is rotated.
 */
async function loadFeed(): Promise<void> {
  try {
    const me = await api.me();
    const calendar = me.calendars.find((entry) => entry.feedPath !== undefined);
    if (calendar?.feedPath === undefined) {
      elements.feedStatus.textContent = "This server does not offer a calendar feed.";
      return;
    }
    feedCalendarId = calendar.id;
    elements.feedUrl.value = absolute(calendar.feedPath);
    elements.feedStatus.textContent = "";
  } catch {
    elements.feedStatus.textContent = "Could not load the calendar address.";
  }
}

async function copyFeedUrl(): Promise<void> {
  if (elements.feedUrl.value === "") return;
  try {
    await navigator.clipboard.writeText(elements.feedUrl.value);
    elements.feedStatus.textContent = "Copied. Paste it into your calendar app.";
  } catch {
    // Clipboard access can be denied; selecting the field is a usable fallback.
    elements.feedUrl.select();
    elements.feedStatus.textContent = "Select the address and copy it.";
  }
}

async function rotateFeedUrl(): Promise<void> {
  if (feedCalendarId === null) return;
  elements.feedRotate.disabled = true;
  try {
    const feed = await api.rotateFeed(feedCalendarId);
    elements.feedUrl.value = absolute(feed.path);
    // The previous URL stops working, so say so plainly.
    elements.feedStatus.textContent =
      "New address created. Add it again in your calendar app; the old one stopped working.";
  } catch {
    elements.feedStatus.textContent = "Could not create a new address.";
  } finally {
    elements.feedRotate.disabled = false;
  }
}

/** Makes the server-relative feed path absolute for the household to copy. */
function absolute(path: string): string {
  return new URL(path, document.baseURI).toString();
}

// ------------------------------------------------------------------- auth

function showAuth(): void {
  elements.auth.hidden = false;
  elements.planner.hidden = true;
}

function showPlanner(): void {
  elements.auth.hidden = true;
  elements.planner.hidden = false;
}

async function attemptAuth(create: boolean): Promise<void> {
  const data = new FormData(elements.authForm);
  const email = String(data.get("email") ?? "").trim();
  const password = String(data.get("password") ?? "");
  elements.authError.hidden = true;
  elements.signIn.disabled = true;
  elements.createAccount.disabled = true;
  try {
    if (create) {
      await api.register(email, password);
    } else {
      await api.login(email, password);
    }
    showPlanner();
    await sync();
    await loadFeed();
  } catch (error) {
    elements.authError.hidden = false;
    elements.authError.textContent =
      error instanceof Error ? error.message : "Could not sign in";
  } finally {
    elements.signIn.disabled = false;
    elements.createAccount.disabled = false;
  }
}

// ------------------------------------------------------------------ startup

function wireEvents(): void {
  elements.prevDay.addEventListener("click", () => {
    const previous = addDays(state.selectedDate, -1);
    if (previous === undefined) return;
    state.selectedDate = previous;
    void sync();
  });
  elements.nextDay.addEventListener("click", () => {
    const next = addDays(state.selectedDate, 1);
    if (next === undefined) return;
    state.selectedDate = next;
    void sync();
  });
  elements.refresh.addEventListener("click", () => void sync());
  elements.signOut.addEventListener("click", () => {
    void (async () => {
      try {
        await api.logout();
      } catch {
        // Signing out locally is enough when the network is gone.
      }
      await store.clear();
      state.items = [];
      showAuth();
    })();
  });
  elements.authForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void attemptAuth(false);
  });
  elements.createAccount.addEventListener("click", () => void attemptAuth(true));
  elements.addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void handleAdd(elements.addForm);
  });
  elements.feedCopy.addEventListener("click", () => void copyFeedUrl());
  elements.feedRotate.addEventListener("click", () => void rotateFeedUrl());

  globalThis.addEventListener("online", () => {
    state.online = true;
    void sync();
  });
  globalThis.addEventListener("offline", () => {
    state.online = false;
    render();
  });
}

async function start(): Promise<void> {
  store = await openLocalStore();
  wireEvents();
  // Built once from the shared set, so the picker cannot drift from the icons
  // the card offers.
  renderIconPicker();

  // Render the cached routine first, so the app opens instantly and works with
  // no network at all.
  const cached = await store.getState();
  if (cached !== null) {
    state.items = cached.items;
    state.revision = cached.revision;
  }
  await refreshQueuedUids();
  showPlanner();
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.warn("[autiplanner] service worker registration failed", error);
    });
  }

  try {
    await api.agenda(state.selectedDate, WINDOW_DAYS);
    showPlanner();
    await sync();
    await loadFeed();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      showAuth();
      return;
    }
    if (isRetryable(error) && cached !== null) {
      // Offline with a cached copy: keep working.
      render();
      return;
    }
    showAuth();
  }
}

void start();
