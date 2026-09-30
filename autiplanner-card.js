var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// ../../packages/core/src/time.ts
var DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
function isCalendarDate(value) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

// ../../packages/core/src/model.ts
var DAY_PARTS = ["morning", "afternoon", "evening", "night"];

// ../../packages/core/src/recurrence.ts
var WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

// ../../packages/core/src/presentation.ts
var STATUS_SYMBOL = {
  pending: "\u25CB",
  completed: "\u2713",
  missed: "\u2715",
  skipped: "\u2014"
};
var STATUS_ACCESSIBLE_LABEL = {
  pending: "Pending",
  completed: "Completed",
  missed: "Missed",
  skipped: "Skipped"
};
var DAY_PART_HEADING = {
  morning: "MORNING",
  afternoon: "AFTERNOON",
  evening: "EVENING",
  night: "NIGHT"
};
function formatClock(timestamp) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})?$/.exec(
    timestamp
  );
  const clock = match?.[2];
  if (!clock) return void 0;
  const zone = match?.[4];
  if (zone === "Z") return `${clock} UTC`;
  if (zone) return `${clock} ${zone}`;
  return clock;
}

// src/index.ts
var DOMAIN = "autiplanner_saas";
var CARD_TAG = "autiplanner-card";
var STATUSES = ["pending", "completed", "missed", "skipped"];
var MAX_DAYS = 7;
var REPEAT_LABEL = {
  none: "Just once",
  daily: "Every day",
  weekly: "Every week"
};
var _root, _config, _hass, _optimistic, _signature, _busy, _message, _messageIsError, _editorOpen, _draft, _confirmStop, _AutiPlannerCard_instances, entityId_fn, signatureOf_fn, render_fn, renderDay_fn, renderPart_fn, renderItem_fn, renderEditor_fn, onClick_fn, onSubmit_fn, onChange_fn, act_fn, create_fn, stopRepeating_fn, service_fn, refresh_fn, syncOptimistic_fn;
var AutiPlannerCard = class extends HTMLElement {
  constructor() {
    super();
    __privateAdd(this, _AutiPlannerCard_instances);
    __privateAdd(this, _root);
    __privateAdd(this, _config, { entity: "", days: 1, showAdd: true, showSummary: true, title: null });
    __privateAdd(this, _hass, null);
    /** Outcomes applied locally, so a tap feels immediate while the poll catches up. */
    __privateAdd(this, _optimistic, /* @__PURE__ */ new Map());
    __privateAdd(this, _signature, "");
    __privateAdd(this, _busy, false);
    __privateAdd(this, _message, "");
    __privateAdd(this, _messageIsError, false);
    __privateAdd(this, _editorOpen, false);
    __privateAdd(this, _draft, { title: "", date: "", dayPart: "morning", time: "", repeat: "none" });
    /** The series whose removal is waiting to be confirmed, if any. */
    __privateAdd(this, _confirmStop, null);
    __privateSet(this, _root, this.attachShadow({ mode: "open" }));
    __privateGet(this, _root).addEventListener("click", (event) => __privateMethod(this, _AutiPlannerCard_instances, onClick_fn).call(this, event));
    __privateGet(this, _root).addEventListener("submit", (event) => __privateMethod(this, _AutiPlannerCard_instances, onSubmit_fn).call(this, event));
    __privateGet(this, _root).addEventListener("change", (event) => __privateMethod(this, _AutiPlannerCard_instances, onChange_fn).call(this, event));
  }
  static getStubConfig(hass) {
    return {
      type: `custom:${CARD_TAG}`,
      entity: (hass === void 0 ? void 0 : findAgendaEntity(hass)) ?? "sensor.routine_agenda",
      days: 1
    };
  }
  static getConfigElement() {
    const element = document.createElement("div");
    return element;
  }
  getCardSize() {
    return __privateGet(this, _config).showAdd ? 5 : 3;
  }
  setConfig(config) {
    const days = typeof config["days"] === "number" ? Math.round(config["days"]) : 1;
    const title = config["title"];
    __privateSet(this, _config, {
      entity: typeof config["entity"] === "string" ? config["entity"].trim() : "",
      days: Math.min(Math.max(days, 1), MAX_DAYS),
      showAdd: config["show_add"] !== false,
      showSummary: config["show_summary"] !== false,
      title: typeof title === "string" && title.trim() !== "" ? title : null
    });
  }
  set hass(hass) {
    __privateSet(this, _hass, hass);
    const signature = __privateMethod(this, _AutiPlannerCard_instances, signatureOf_fn).call(this, hass);
    if (signature !== __privateGet(this, _signature)) {
      __privateSet(this, _signature, signature);
      __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
    }
  }
};
_root = new WeakMap();
_config = new WeakMap();
_hass = new WeakMap();
_optimistic = new WeakMap();
_signature = new WeakMap();
_busy = new WeakMap();
_message = new WeakMap();
_messageIsError = new WeakMap();
_editorOpen = new WeakMap();
_draft = new WeakMap();
_confirmStop = new WeakMap();
_AutiPlannerCard_instances = new WeakSet();
// ------------------------------------------------------------- rendering
entityId_fn = function() {
  if (__privateGet(this, _config).entity !== "") return __privateGet(this, _config).entity;
  return __privateGet(this, _hass) === null ? "" : findAgendaEntity(__privateGet(this, _hass)) ?? "";
};
signatureOf_fn = function(hass) {
  const entity = __privateGet(this, _config).entity;
  const found = entity === "" ? void 0 : hass.states[entity];
  if (found === void 0) return `${entity}|missing`;
  const items = found.attributes["items"];
  const revision = found.attributes["revision"];
  return `${entity}|${found.state}|${String(revision)}|${Array.isArray(items) ? items.length : -1}`;
};
render_fn = function() {
  const hass = __privateGet(this, _hass);
  const entity = __privateMethod(this, _AutiPlannerCard_instances, entityId_fn).call(this);
  const state = hass === null ? void 0 : hass.states[entity];
  const items = readItems(state);
  __privateMethod(this, _AutiPlannerCard_instances, syncOptimistic_fn).call(this, items);
  const today = localToday(hass?.config.time_zone);
  const days = Array.from({ length: __privateGet(this, _config).days }, (_, offset) => addDays(today, offset));
  const effective = items.map((item) => {
    const override = __privateGet(this, _optimistic).get(item.uid);
    return override === void 0 ? item : { ...item, status: override };
  });
  const body = state === void 0 ? `<div class="notice">No AutiPlanner agenda sensor found. Add the
             <strong>AutiPlanner (hosted)</strong> integration, then point this card at
             its agenda sensor.</div>` : days.map((date, index) => __privateMethod(this, _AutiPlannerCard_instances, renderDay_fn).call(this, date, index, effective)).join("");
  const message = __privateGet(this, _message) ? `<div class="message${__privateGet(this, _messageIsError) ? " error" : ""}" role="status">${escape(__privateGet(this, _message))}</div>` : "";
  const issues = readIssues(state);
  const issuesHtml = issues.length === 0 ? "" : `<div class="notice warn">Calendar issues: ${escape(issues.join(", "))}</div>`;
  __privateGet(this, _root).innerHTML = `
      <style>${STYLES}</style>
      <ha-card>
        <div class="bar">
          <div class="title">${escape(__privateGet(this, _config).title ?? "AutiPlanner")}</div>
          <div class="tools">
            <button type="button" class="tool" data-act="refresh" aria-label="Refresh the agenda">&#10227;</button>
            ${__privateGet(this, _config).showAdd ? `<button type="button" class="tool" data-act="toggle-add" aria-label="Add a routine item" aria-expanded="${__privateGet(this, _editorOpen)}">&#65291;</button>` : ""}
          </div>
        </div>
        ${message}
        ${issuesHtml}
        ${__privateGet(this, _editorOpen) ? __privateMethod(this, _AutiPlannerCard_instances, renderEditor_fn).call(this, today) : ""}
        <div class="body">${body}</div>
      </ha-card>`;
};
renderDay_fn = function(date, index, items) {
  const forDay = items.filter((item) => item.date === date);
  const summary = __privateGet(this, _config).showSummary ? renderSummary(forDay) : "";
  const parts = DAY_PARTS.map(
    (dayPart) => __privateMethod(this, _AutiPlannerCard_instances, renderPart_fn).call(this, dayPart, forDay.filter((item) => item.dayPart === dayPart))
  ).join("");
  const empty = forDay.length === 0 ? `<div class="empty">Nothing planned</div>` : "";
  return `<section class="day">
      <div class="day-bar">
        <span class="day-name">${escape(dayName(date, index))}</span>
        ${summary}
      </div>
      ${parts}
      ${empty}
    </section>`;
};
renderPart_fn = function(dayPart, items) {
  if (items.length === 0) return "";
  const rows = items.map((item) => __privateMethod(this, _AutiPlannerCard_instances, renderItem_fn).call(this, item)).join("");
  return `<div class="part">
      <div class="part-label">${escape(DAY_PART_HEADING[dayPart])}</div>
      <ul class="items">${rows}</ul>
    </div>`;
};
renderItem_fn = function(item) {
  const status = item.status;
  const clock = formatClock(item.start ?? item.due ?? "");
  const meta = [STATUS_ACCESSIBLE_LABEL[status], clock].filter((part) => part !== void 0 && part !== "").join(" \xB7 ");
  const disabled = __privateGet(this, _busy) ? " disabled" : "";
  const buttons = actionsFor(status).map(
    (button) => `<button type="button" class="act" data-act="${button.action}" data-uid="${escape(item.uid)}"${disabled}
             aria-label="Mark ${escape(item.title)} ${escape(button.word)}">${button.glyph}</button>`
  ).join("");
  const repeat = item.routineId === void 0 ? "" : `<button type="button" class="repeat" data-act="stop-repeat" data-series="${escape(item.routineId)}"
             aria-label="Stop repeating ${escape(item.title)}">&#8635;</button>`;
  const acts = item.routineId !== void 0 && __privateGet(this, _confirmStop) === item.routineId ? `<span class="confirm" role="status">
             <span class="confirm-text">Stop repeating?</span>
             <button type="button" class="act" data-act="stop-repeat-yes" data-series="${escape(item.routineId)}" aria-label="Yes, stop repeating ${escape(item.title)}">Yes</button>
             <button type="button" class="act" data-act="stop-repeat-no" aria-label="Keep repeating ${escape(item.title)}">No</button>
           </span>` : `<span class="acts">${buttons}</span>`;
  return `<li class="item" data-status="${status}"${item.routineId === void 0 ? "" : ` data-series="${escape(item.routineId)}"`}>
      <span class="glyph" aria-hidden="true">${STATUS_SYMBOL[status]}</span>
      <span class="main">
        <span class="name">${escape(item.title)}${repeat}</span>
        <span class="meta">${escape(meta)}</span>
      </span>
      ${acts}
    </li>`;
};
renderEditor_fn = function(today) {
  const draft = __privateGet(this, _draft);
  const date = draft.date === "" ? today : draft.date;
  const options = DAY_PARTS.map(
    (dayPart) => `<option value="${dayPart}"${dayPart === draft.dayPart ? " selected" : ""}>${escape(DAY_PART_HEADING[dayPart])}</option>`
  ).join("");
  const repeats = Object.keys(REPEAT_LABEL).map((choice) => {
    const label = choice === "weekly" ? `Every ${weekdayName2(isCalendarDate(date) ? date : today)}` : REPEAT_LABEL[choice];
    return `<option value="${choice}"${choice === draft.repeat ? " selected" : ""}${choice === "weekly" ? ' id="ap-repeat-weekly"' : ""}>${escape(label)}</option>`;
  }).join("");
  const note = draft.repeat === "weekly" ? `Repeats every ${weekdayName2(isCalendarDate(date) ? date : today)}` : draft.repeat === "daily" ? "Repeats every day" : "";
  return `<form class="add" data-form="add">
      <label for="ap-title">New routine item</label>
      <input id="ap-title" name="title" value="${escape(draft.title)}" required maxlength="120" placeholder="Take medication" />
      <div class="grid">
        <div>
          <label for="ap-date">Date <span class="hint">(today if left empty)</span></label>
          <input id="ap-date" name="date" type="date" value="${escape(date)}" />
        </div>
        <div>
          <label for="ap-part">Day part</label>
          <select id="ap-part" name="dayPart">${options}</select>
        </div>
        <div>
          <label for="ap-time">Time (optional)</label>
          <input id="ap-time" name="time" type="time" value="${escape(draft.time)}" />
        </div>
        <div>
          <label for="ap-repeat">Repeats</label>
          <select id="ap-repeat" name="repeat">${repeats}</select>
        </div>
      </div>
      <p class="repeat-note"${note === "" ? " hidden" : ""}>${escape(note)}</p>
      <button type="submit"${__privateGet(this, _busy) ? " disabled" : ""}>Add item</button>
    </form>`;
};
// --------------------------------------------------------------- events
onClick_fn = function(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const trigger = target.closest("[data-act]");
  if (trigger === null) return;
  const action = trigger.dataset["act"];
  const uid = trigger.dataset["uid"];
  const series = trigger.dataset["series"];
  if (action === "toggle-add") {
    __privateSet(this, _editorOpen, !__privateGet(this, _editorOpen));
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
    return;
  }
  if (action === "refresh") {
    void __privateMethod(this, _AutiPlannerCard_instances, refresh_fn).call(this);
    return;
  }
  if (action === "stop-repeat") {
    __privateSet(this, _confirmStop, series ?? null);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
    return;
  }
  if (action === "stop-repeat-no") {
    __privateSet(this, _confirmStop, null);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
    return;
  }
  if (action === "stop-repeat-yes") {
    if (series !== void 0) void __privateMethod(this, _AutiPlannerCard_instances, stopRepeating_fn).call(this, series);
    return;
  }
  if (uid === void 0) return;
  const button = actionsFor(findStatus(trigger.closest("li"), __privateGet(this, _optimistic))).find(
    (candidate) => candidate.action === action
  );
  if (button === void 0) return;
  void __privateMethod(this, _AutiPlannerCard_instances, act_fn).call(this, uid, button);
};
onSubmit_fn = function(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const form = target.closest("form[data-form]");
  if (form === null) return;
  event.preventDefault();
  void __privateMethod(this, _AutiPlannerCard_instances, create_fn).call(this, form);
};
/**
 * Keeps the weekday wording in step with the date, in place.
 *
 * The repeat select and the sentence under the form both name the weekday a
 * weekly routine would land on, and that word comes from the date field. Only
 * that text is rewritten: re-rendering the form here would drop focus.
 */
onChange_fn = function(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const form = target.closest("form[data-form='add']");
  if (form === null) return;
  const data = new FormData(form);
  const chosen = String(data.get("date") ?? "").trim();
  const date = chosen === "" ? localToday(__privateGet(this, _hass)?.config.time_zone) : chosen;
  const repeat = String(data.get("repeat") ?? "none");
  const weekday = isCalendarDate(date) ? weekdayName2(date) : "";
  const weekly = form.querySelector("#ap-repeat-weekly");
  if (weekly !== null && weekday !== "") {
    weekly.textContent = `Every ${weekday}`;
  }
  const note = form.querySelector(".repeat-note");
  if (note !== null) {
    const text = repeat === "weekly" && weekday !== "" ? `Repeats every ${weekday}` : repeat === "daily" ? "Repeats every day" : "";
    note.textContent = text;
    if (text === "") note.setAttribute("hidden", "");
    else note.removeAttribute("hidden");
  }
};
act_fn = async function(uid, button) {
  if (__privateGet(this, _busy)) return;
  __privateSet(this, _busy, true);
  __privateSet(this, _message, "");
  __privateSet(this, _messageIsError, false);
  try {
    await __privateMethod(this, _AutiPlannerCard_instances, service_fn).call(this, button.action, { uid });
    __privateGet(this, _optimistic).set(uid, button.next);
    await __privateMethod(this, _AutiPlannerCard_instances, refresh_fn).call(this);
  } catch (error) {
    __privateSet(this, _message, errorText(error));
    __privateSet(this, _messageIsError, true);
  } finally {
    __privateSet(this, _busy, false);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
  }
};
create_fn = async function(form) {
  const data = new FormData(form);
  const title = String(data.get("title") ?? "").trim();
  const chosen = String(data.get("date") ?? "").trim();
  const dayPart = String(data.get("dayPart") ?? "morning");
  const time = String(data.get("time") ?? "").trim();
  const repeat = String(data.get("repeat") ?? "none");
  if (title === "" || !isDayPart(dayPart)) {
    __privateSet(this, _message, "A title and a day part are required.");
    __privateSet(this, _messageIsError, true);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
    return;
  }
  const date = chosen === "" ? localToday(__privateGet(this, _hass)?.config.time_zone) : chosen;
  if (!isCalendarDate(date)) {
    __privateSet(this, _message, "That date is not a real day.");
    __privateSet(this, _messageIsError, true);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
    return;
  }
  const uid = `ha-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const start = time === "" ? void 0 : `${date}T${time}:00`;
  __privateSet(this, _busy, true);
  __privateSet(this, _message, "");
  __privateSet(this, _messageIsError, false);
  try {
    if (repeat === "none") {
      const payload = {
        uid,
        title,
        date,
        day_part: dayPart,
        status: "pending"
      };
      if (start !== void 0) payload["start"] = start;
      await __privateMethod(this, _AutiPlannerCard_instances, service_fn).call(this, "create", payload);
    } else {
      const payload = {
        uid,
        title,
        date,
        day_part: dayPart,
        recurrence: repeat === "weekly" ? (
          // The weekday comes from the date the household chose, which is
          // what "the same day every week" means on the form.
          { freq: "weekly", byDay: [weekdayCode(date)] }
        ) : { freq: "daily" }
      };
      if (start !== void 0) payload["start"] = start;
      await __privateMethod(this, _AutiPlannerCard_instances, service_fn).call(this, "add_series", payload);
    }
    __privateSet(this, _draft, { title: "", date, dayPart, time, repeat: "none" });
    __privateSet(this, _editorOpen, false);
    await __privateMethod(this, _AutiPlannerCard_instances, refresh_fn).call(this);
  } catch (error) {
    __privateSet(this, _message, errorText(error));
    __privateSet(this, _messageIsError, true);
  } finally {
    __privateSet(this, _busy, false);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
  }
};
stopRepeating_fn = async function(series) {
  if (__privateGet(this, _busy)) return;
  __privateSet(this, _busy, true);
  __privateSet(this, _message, "");
  __privateSet(this, _messageIsError, false);
  try {
    await __privateMethod(this, _AutiPlannerCard_instances, service_fn).call(this, "delete", { uid: series });
    __privateSet(this, _confirmStop, null);
    await __privateMethod(this, _AutiPlannerCard_instances, refresh_fn).call(this);
  } catch (error) {
    __privateSet(this, _message, errorText(error));
    __privateSet(this, _messageIsError, true);
  } finally {
    __privateSet(this, _busy, false);
    __privateMethod(this, _AutiPlannerCard_instances, render_fn).call(this);
  }
};
service_fn = async function(action, data) {
  const hass = __privateGet(this, _hass);
  const entity = __privateMethod(this, _AutiPlannerCard_instances, entityId_fn).call(this);
  if (hass === null) return;
  await hass.callService(DOMAIN, action, { entity_id: entity, ...data });
};
refresh_fn = async function() {
  const hass = __privateGet(this, _hass);
  const entity = __privateMethod(this, _AutiPlannerCard_instances, entityId_fn).call(this);
  if (hass === null || entity === "") return;
  try {
    await hass.callService("homeassistant", "update_entity", { entity_id: entity });
  } catch {
  }
};
/** Drops local overrides the server has caught up with. */
syncOptimistic_fn = function(items) {
  for (const item of items) {
    const override = __privateGet(this, _optimistic).get(item.uid);
    if (override !== void 0 && override === item.status) {
      __privateGet(this, _optimistic).delete(item.uid);
    }
  }
};
function actionsFor(status) {
  if (status === "pending") {
    return [
      { action: "complete", next: "completed", glyph: "\u2713", word: "completed" },
      { action: "mark_missed", next: "missed", glyph: "\u2715", word: "missed" },
      { action: "skip", next: "skipped", glyph: "\u2014", word: "skipped" }
    ];
  }
  return [{ action: "reset", next: "pending", glyph: "\u21BA", word: "pending again" }];
}
function renderSummary(items) {
  const counts = /* @__PURE__ */ new Map();
  for (const item of items) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  const parts = [];
  for (const status of ["pending", "completed", "missed", "skipped"]) {
    const count = counts.get(status);
    if (count === void 0 || count === 0) continue;
    parts.push(
      `<span class="chip" data-status="${status}"><span aria-hidden="true">${STATUS_SYMBOL[status]}</span> ${escape(STATUS_ACCESSIBLE_LABEL[status])} ${count}</span>`
    );
  }
  return `<span class="chips">${parts.join("")}</span>`;
}
function findAgendaEntity(hass) {
  for (const [entityId, state] of Object.entries(hass.states)) {
    if (!entityId.startsWith("sensor.") || !entityId.endsWith("_agenda")) continue;
    if (Array.isArray(state.attributes["items"])) return entityId;
  }
  return null;
}
function readItems(state) {
  const raw = state?.attributes["items"];
  if (!Array.isArray(raw)) return [];
  const items = [];
  for (const entry of raw) {
    if (isRoutineItem(entry)) items.push(entry);
  }
  return items;
}
function readIssues(state) {
  const raw = state?.attributes["autiplanner_issues"];
  if (!Array.isArray(raw)) return [];
  return raw.filter((issue) => typeof issue === "string");
}
function isDayPart(value) {
  return DAY_PARTS.includes(value);
}
function isRoutineItem(value) {
  if (typeof value !== "object" || value === null) return false;
  const item = value;
  return typeof item["uid"] === "string" && typeof item["title"] === "string" && typeof item["date"] === "string" && typeof item["dayPart"] === "string" && isDayPart(item["dayPart"]) && typeof item["status"] === "string" && STATUSES.includes(item["status"]);
}
function findStatus(row, optimistic) {
  const element = row instanceof HTMLElement ? row : null;
  const status = element?.dataset["status"];
  return status !== void 0 && STATUSES.includes(status) ? status : "pending";
}
function addDays(date, delta) {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}
function localToday(timeZone) {
  const now = /* @__PURE__ */ new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const values = {};
    for (const part of parts) {
      if (part.type !== "literal") values[part.type] = part.value;
    }
    const year = values["year"];
    const month = values["month"];
    const day = values["day"];
    if (year !== void 0 && month !== void 0 && day !== void 0) {
      return `${year}-${month}-${day}`;
    }
  } catch {
  }
  return now.toISOString().slice(0, 10);
}
function dayName(date, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
function weekdayCode(date) {
  const [year, month, day] = date.split("-").map(Number);
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return WEEKDAY_CODES[(sundayFirst + 6) % 7] ?? "MO";
}
function weekdayName2(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
function escape(value) {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}
function errorText(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
var STYLES = `
  ha-card { padding: 12px 16px 16px; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .title { font-size: 1.15rem; font-weight: 600; color: var(--primary-text-color, #212121); }
  .tools { display: flex; gap: 4px; }
  .tool { background: none; border: none; color: var(--primary-text-color, #212121);
          font-size: 1.1rem; cursor: pointer; min-width: 40px; min-height: 40px; border-radius: 8px; }
  .tool:hover { background: var(--secondary-background-color, #e0e0e0); }
  .day { margin-top: 14px; }
  .day-bar { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .day-name { font-weight: 600; color: var(--primary-text-color, #212121); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 0.78rem; color: var(--primary-text-color, #212121); opacity: 0.85; }
  .part { margin-top: 8px; }
  .part-label { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase;
                color: var(--secondary-text-color, #727272); }
  .items { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px;
          background: var(--card-background-color, #fff); }
  .item[data-status="completed"] { opacity: 0.65; }
  .glyph { font-size: 1rem; width: 1.2em; text-align: center; }
  .main { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
  .name { color: var(--primary-text-color, #212121); overflow-wrap: anywhere; }
  .meta { font-size: 0.76rem; color: var(--secondary-text-color, #727272); }
  .acts { display: flex; gap: 2px; }
  .act { min-width: 40px; min-height: 40px; border-radius: 10px; cursor: pointer;
         font-size: 1rem; color: var(--primary-text-color, #212121);
         background: var(--secondary-background-color, #ececec); border: none; }
  .act:hover { background: var(--primary-color, #03a9f4); color: #fff; }
  .act:disabled { opacity: 0.5; cursor: default; }
  .repeat { background: none; border: none; cursor: pointer; padding: 0 4px; font-size: 0.9rem;
            color: var(--secondary-text-color, #727272); min-width: 32px; min-height: 32px; }
  .repeat:hover { color: var(--primary-color, #03a9f4); }
  .confirm { display: flex; align-items: center; gap: 4px; }
  .confirm-text { font-size: 0.78rem; color: var(--secondary-text-color, #727272); white-space: nowrap; }
  .add .repeat-note { margin: 0; font-size: 0.78rem; color: var(--secondary-text-color, #727272); }
  .empty { font-size: 0.85rem; color: var(--secondary-text-color, #727272); padding: 4px 8px; }
  .message, .notice { margin-top: 10px; font-size: 0.85rem; padding: 8px 10px; border-radius: 8px;
                      background: var(--secondary-background-color, #ececec);
                      color: var(--primary-text-color, #212121); }
  .message.error, .notice.warn { background: var(--error-color, #db4437); color: #fff; }
  .add { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .add label { font-size: 0.78rem; color: var(--secondary-text-color, #727272); }
  .add .hint { font-weight: 400; opacity: 0.75; }
  .add input, .add select { width: 100%; box-sizing: border-box; padding: 8px;
      border-radius: 8px; border: 1px solid var(--divider-color, #e0e0e0);
      background: var(--card-background-color, #fff); color: var(--primary-text-color, #212121);
      font-size: 0.95rem; min-height: 40px; }
  .add .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
  .add button { align-self: flex-start; min-height: 40px; padding: 0 16px; border-radius: 8px;
      border: none; cursor: pointer; font-size: 0.95rem;
      background: var(--primary-color, #03a9f4); color: #fff; }
`;
if (typeof customElements !== "undefined" && customElements.get(CARD_TAG) === void 0) {
  customElements.define(CARD_TAG, AutiPlannerCard);
}
if (typeof window !== "undefined") {
  const registry = window;
  registry.customCards = [
    ...registry.customCards ?? [],
    {
      type: CARD_TAG,
      name: "AutiPlanner card",
      description: "View and change routine items, and add new ones.",
      preview: false
    }
  ];
}
var index_default = AutiPlannerCard;
export {
  AutiPlannerCard,
  actionsFor,
  addDays,
  dayName,
  index_default as default,
  findAgendaEntity,
  isDayPart,
  localToday,
  readIssues,
  readItems,
  renderSummary,
  weekdayCode,
  weekdayName2 as weekdayName
};
