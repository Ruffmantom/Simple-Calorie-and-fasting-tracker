function normalizeSearchText(value) {
    return String(value || "").trim().toLowerCase();
}

function sanitizeUnit(unit) {
    return Object.prototype.hasOwnProperty.call(UNIT_TO_GRAMS, unit) ? unit : "g";
}

function sanitizeCalorieGoal(value) {
    const parsed = Number.parseFloat(String(value));
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_SETTINGS.calorieGoalCalories;
    }

    return Math.min(20000, Math.max(1, Math.round(parsed)));
}

function sanitizeFastingGoal(value) {
    const parsed = Number.parseFloat(String(value));
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_SETTINGS.fastingGoalHours;
    }

    return Math.min(72, Math.max(1, Math.round(parsed * 10) / 10));
}

function toGrams(amount, unit) {
    return amount * UNIT_TO_GRAMS[sanitizeUnit(unit)];
}

function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons({ attrs: { "stroke-width": 2 } });
    }
}

function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
        return;
    }

    navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Service worker registration failed.", error);
    });
}
function formatWeekday(dateKey) {
    return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(dateFromKey(dateKey));
}

function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Logged today";
    }

    return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function formatShortDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Unknown time";
    }

    return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function formatAchievementDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Unknown time";
    }

    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function formatEntryLastLogged(entry) {
    const timestamp = getEntryTimestamp(entry);
    return timestamp ? `Last logged ${formatShortDateTime(timestamp)}` : "Recent log";
}

function formatDateTimeInput(date) {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
}

function formatCalories(value) {
    return String(Math.round(Number(value) || 0));
}

function formatGrams(value) {
    const number = Number(value) || 0;
    if (number >= 100) {
        return String(Math.round(number));
    }

    if (number >= 10) {
        return String(Math.round(number * 10) / 10).replace(/\.0$/, "");
    }

    return String(Math.round(number * 10) / 10).replace(/\.0$/, "");
}

function formatHours(value) {
    const number = Number(value) || 0;
    return String(Math.round(number * 10) / 10).replace(/\.0$/, "");
}

function formatInputNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return "";
    }

    return String(Math.round(number * 1000) / 1000)
        .replace(/\.0+$/, "")
        .replace(/(\.\d*?)0+$/, "$1");
}

function formatCalorieGoalInput(value) {
    const number = Number(value) || 0;
    return number > 0 ? formatCalories(number) : "";
}

function formatCompactNumber(value) {
    if (value >= 1000) {
        return `${Math.round(value / 100) / 10}k`;
    }

    return String(value);
}

function formatItemCount(count) {
    return `${count} ${count === 1 ? "item" : "items"}`;
}

function formatFastCount(count) {
    return `${count} ${count === 1 ? "log" : "logs"}`;
}

function formatGoalPercent(hours) {
    const goal = state.settings.fastingGoalHours;
    if (!goal) {
        return "0%";
    }

    return `${Math.round((hours / goal) * 100)}%`;
}

function parsePositiveNumber(value) {
    const parsed = Number.parseFloat(String(value));
    if (!Number.isFinite(parsed) || parsed < 0) {
        return 0;
    }

    return parsed;
}

function parseDateTimeLocal(value) {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeAchievementRecord(record) {
    if (!record || typeof record !== "object" || !isKnownAchievementId(record.id)) {
        return null;
    }

    const earnedAt = new Date(record.earnedAt);
    if (typeof record.earnedAt !== "string" || Number.isNaN(earnedAt.getTime())) {
        return null;
    }

    const seenAtDate = new Date(record.seenAt);
    const seenAt = typeof record.seenAt === "string" && !Number.isNaN(seenAtDate.getTime()) ? record.seenAt : null;

    return {
        id: record.id,
        earnedAt: record.earnedAt,
        seenAt,
    };
}

function isKnownAchievementId(achievementId) {
    return ACHIEVEMENTS.some((achievement) => achievement.id === achievementId);
}

function isValidEntry(entry) {
    return Boolean(
        entry &&
        typeof entry === "object" &&
        typeof entry.id === "string" &&
        typeof entry.date === "string" &&
        typeof entry.name === "string"
    );
}

function getEntryTimestamp(entry) {
    const createdAt = new Date(entry.createdAt);
    if (!Number.isNaN(createdAt.getTime())) {
        return createdAt.getTime();
    }

    const loggedDate = dateFromKey(entry.date);
    return Number.isNaN(loggedDate.getTime()) ? 0 : loggedDate.getTime();
}

function isValidFast(fast) {
    const start = new Date(fast && fast.startAt);
    const end = new Date(fast && fast.endAt);
    return Boolean(
        fast &&
        typeof fast === "object" &&
        typeof fast.id === "string" &&
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()) &&
        end > start
    );
}

function getLastSevenDateKeys() {
    const today = new Date();
    const dates = [];

    for (let index = 6; index >= 0; index -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - index);
        dates.push(getDateKey(date));
    }

    return dates;
}

function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
}