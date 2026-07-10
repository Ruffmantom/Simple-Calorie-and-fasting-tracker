window.addEventListener("DOMContentLoaded", init);


const ACHIEVEMENTS = [
    {
        id: "first-step",
        title: "First Step",
        message: "You logged your first food. A steady record starts here.",
        icon: "utensils",
        events: ["food"],
        isUnlocked: () => state.entries.length >= 1,
    },
    {
        id: "getting-the-hang-of-it",
        title: "Getting the Hang of It",
        message: "Three foods logged. Your daily picture is getting clearer.",
        icon: "list-check",
        events: ["food"],
        isUnlocked: () => state.entries.length >= 3,
    },
    {
        id: "first-fast",
        title: "First Fast",
        message: "Your first fasting log is saved.",
        icon: "clock",
        events: ["fast"],
        isUnlocked: () => state.fasts.length >= 1,
    },
    {
        id: "goal-setter",
        title: "Goal Setter",
        message: "You saved a goal. Clear targets make repeat choices easier.",
        icon: "target",
        events: ["calorie-goal", "fasting-goal"],
        isUnlocked: (context) =>
            (context.eventName === "calorie-goal" && state.settings.calorieGoalCalories > 0) ||
            context.eventName === "fasting-goal",
    },
    {
        id: "small-win",
        title: "Small Win",
        message: "Today is at or under your calorie goal with food logged.",
        icon: "badge-check",
        events: ["food", "calorie-goal"],
        isUnlocked: hasSmallWin,
    },
    {
        id: "fasting-goal-hit",
        title: "Fasting Goal Hit",
        message: "That fast met your goal. Strong follow-through.",
        icon: "trophy",
        events: ["fast", "fasting-goal"],
        isUnlocked: hasFastingGoalHit,
    },
    {
        id: "three-day-rhythm",
        title: "Three-Day Rhythm",
        message: "Food has been logged on three different days.",
        icon: "calendar-days",
        events: ["food"],
        isUnlocked: () => new Set(state.entries.map((entry) => entry.date).filter(Boolean)).size >= 3,
    },
    {
        id: "back-on-track",
        title: "Back on Track",
        message: "You logged again after a break. Picking back up counts.",
        icon: "refresh-cw",
        events: ["food"],
        isUnlocked: (context) => hasFoodLoggedAfterGap(context.entry),
    },
];

const state = {
    entries: loadEntries(),
    fasts: loadFasts(),
    settings: loadSettings(),
    achievements: loadAchievements(),
};

const elements = {};
let resizeTimer = 0;
let achievementToastTimer = 0;
const achievementToastQueue = [];


function init() {
    cacheElements();
    bindEvents();
    elements.versionNumber.textContent = APP_VERSION;
    elements.todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
    }).format(new Date());
    render();
    registerServiceWorker();
}

function bindEvents() {
    elements.openAddFoodButton.addEventListener("click", () => {
        hideFoodSuggestions();
        openModal("addFoodModal");
    });
    elements.openAddFastButton.addEventListener("click", () => {
        populateFastingDefaults();
        openModal("addFastModal");
    });
    elements.settingsButton.addEventListener("click", () => openModal("settingsModal"));
    elements.achievementsButton.addEventListener("click", openAchievementsModal);
    elements.foodForm.addEventListener("submit", handleFoodSubmit);
    elements.foodName.addEventListener("input", updateFoodSuggestions);
    elements.foodName.addEventListener("focus", updateFoodSuggestions);
    elements.foodSuggestionList.addEventListener("pointerdown", handleFoodSuggestionPointerDown);
    elements.fastingForm.addEventListener("submit", handleFastingSubmit);
    elements.fastingGoalForm.addEventListener("submit", handleFastingGoalSubmit);
    elements.calorieGoalForm.addEventListener("submit", handleCalorieGoalSubmit);
    elements.clearDataButton.addEventListener("click", clearAllData);

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".food-name-field")) {
            hideFoodSuggestions();
        }
        const closeTarget = event.target.closest("[data-close-modal]");
        if (closeTarget) {
            closeModal(closeTarget.dataset.closeModal);
            return;
        }

        const deleteButton = event.target.closest("[data-delete-id]");
        if (deleteButton) {
            deleteEntry(deleteButton.dataset.deleteId);
            return;
        }

        const deleteFastButton = event.target.closest("[data-delete-fast-id]");
        if (deleteFastButton) {
            deleteFast(deleteFastButton.dataset.deleteFastId);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && elements.foodSuggestionList && !elements.foodSuggestionList.hidden) {
            hideFoodSuggestions();
            return;
        }

        if (event.key === "Escape") {
            closeOpenModal();
        }
    });

    window.addEventListener("resize", () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(drawCharts, 120);
    });
}


function deleteEntry(entryId) {
    const entry = state.entries.find((item) => item.id === entryId);
    if (!entry) {
        return;
    }

    const shouldDelete = window.confirm(`Delete ${entry.name}?`);
    if (!shouldDelete) {
        return;
    }

    state.entries = state.entries.filter((item) => item.id !== entryId);
    saveEntries();
    render();
}

function deleteFast(fastId) {
    const fast = state.fasts.find((item) => item.id === fastId);
    if (!fast) {
        return;
    }

    const shouldDelete = window.confirm(`Delete ${formatHours(getFastDurationHours(fast))} hour fast?`);
    if (!shouldDelete) {
        return;
    }

    state.fasts = state.fasts.filter((item) => item.id !== fastId);
    saveFasts();
    render();
}

function clearAllData() {
    const hasCustomGoal =
        state.settings.fastingGoalHours !== DEFAULT_SETTINGS.fastingGoalHours ||
        state.settings.calorieGoalCalories !== DEFAULT_SETTINGS.calorieGoalCalories;
    const hasAchievements = state.achievements.length > 0;
    if (!state.entries.length && !state.fasts.length && !hasCustomGoal && !hasAchievements) {
        closeModal("settingsModal");
        return;
    }

    const shouldClear = window.confirm("Clear saved foods, fasting logs, achievements, and reset your goals?");
    if (!shouldClear) {
        return;
    }

    state.entries = [];
    state.fasts = [];
    state.settings = { ...DEFAULT_SETTINGS };
    state.achievements = [];
    saveEntries();
    saveFasts();
    saveSettings();
    saveAchievements();
    clearAchievementToasts();
    closeModal("settingsModal");
    render();
}

function render() {
    const todayKey = getDateKey(new Date());
    const todayEntries = getEntriesForDate(todayKey);
    const totals = sumEntries(todayEntries);
    const itemText = formatItemCount(todayEntries.length);
    const weekDateKeys = getLastSevenDateKeys();
    const weeklyFasts = getFastsForDates(weekDateKeys);
    const weeklyFastHours = sumFastHours(weeklyFasts);

    elements.todayCalories.textContent = formatCalories(totals.calories);
    elements.todayProtein.textContent = formatGrams(totals.protein);
    elements.todaySugar.textContent = formatGrams(totals.sugar);
    elements.todayItemCount.textContent = String(todayEntries.length);
    elements.footerCalories.textContent = formatCalories(totals.calories);
    elements.foodListCount.textContent = itemText;
    elements.emptyState.hidden = todayEntries.length > 0;
    elements.fastingLogCount.textContent = formatFastCount(weeklyFasts.length);
    elements.weeklyFastingHours.textContent = formatHours(weeklyFastHours);
    elements.fastingGoalDisplay.textContent = formatHours(state.settings.fastingGoalHours);
    elements.fastingGoalInput.value = formatHours(state.settings.fastingGoalHours);
    elements.calorieGoalInput.value = formatCalorieGoalInput(state.settings.calorieGoalCalories);
    elements.fastingEmptyState.hidden = weeklyFasts.length > 0;

    elements.foodList.innerHTML = todayEntries
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map(renderFoodItem)
        .join("");

    elements.fastingList.innerHTML = weeklyFasts
        .slice()
        .sort((a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime())
        .map(renderFastingItem)
        .join("");

    renderAchievements();
    updateAchievementBadge();
    drawCharts();
    refreshIcons();
}

function renderFoodItem(entry) {
    const safeName = escapeHtml(entry.name);
    const proteinGrams = getMacroGrams(entry, "protein");
    const sugarGrams = getMacroGrams(entry, "sugar");

    return `
        <li class="food-item">
            <div>
                <p class="food-name">${safeName}</p>
                <p class="food-time">${formatTime(entry.createdAt)}</p>
                <div class="food-metrics" aria-label="Nutrition summary">
                    <span class="metric-pill metric-pill--calories">${formatCalories(entry.calories)} kcal</span>
                    <span class="metric-pill metric-pill--protein">${formatGrams(proteinGrams)}g protein</span>
                    <span class="metric-pill metric-pill--sugar">${formatGrams(sugarGrams)}g sugar</span>
                </div>
            </div>
            <button class="icon-button delete-food-button" type="button" data-delete-id="${entry.id}" aria-label="Delete ${safeName}">
                <i data-lucide="trash-2" aria-hidden="true"></i>
            </button>
        </li>
    `;
}

function renderFastingItem(fast) {
    const hours = getFastDurationHours(fast);
    const started = formatShortDateTime(fast.startAt);
    const ended = formatShortDateTime(fast.endAt);

    return `
        <li class="fasting-item">
            <div>
                <p class="food-name">${formatHours(hours)} hour fast</p>
                <p class="food-time">${started} - ${ended}</p>
                <div class="food-metrics" aria-label="Fasting summary">
                    <span class="metric-pill metric-pill--fasting">${formatHours(hours)}h logged</span>
                    <span class="metric-pill">${formatGoalPercent(hours)} of goal</span>
                </div>
            </div>
            <button class="icon-button delete-fast-button" type="button" data-delete-fast-id="${fast.id}" aria-label="Delete fasting log">
                <i data-lucide="trash-2" aria-hidden="true"></i>
            </button>
        </li>
    `;
}

function openAchievementsModal() {
    renderAchievements();
    refreshIcons();
    openModal("achievementsModal");
    markAchievementsSeen();
}

function renderAchievements() {
    if (!elements.achievementsList || !elements.achievementsEmptyState) {
        return;
    }

    const achievements = getEarnedAchievementRecords();
    elements.achievementsEmptyState.hidden = achievements.length > 0;
    elements.achievementsList.hidden = achievements.length === 0;
    elements.achievementsList.innerHTML = achievements.map(renderAchievementItem).join("");
}

function renderAchievementItem(achievement) {
    const safeTitle = escapeHtml(achievement.title);
    const safeMessage = escapeHtml(achievement.message);
    const safeIcon = escapeHtml(achievement.icon);
    const safeEarnedAt = escapeHtml(achievement.earnedAt);
    const earnedLabel = escapeHtml(formatAchievementDateTime(achievement.earnedAt));

    return `
        <li class="achievement-card">
            <div class="achievement-icon" aria-hidden="true">
                <i data-lucide="${safeIcon}"></i>
            </div>
            <div class="achievement-copy">
                <div class="achievement-title-row">
                    <h3>${safeTitle}</h3>
                    <time datetime="${safeEarnedAt}">${earnedLabel}</time>
                </div>
                <p>${safeMessage}</p>
            </div>
        </li>
    `;
}

function evaluateAchievements(eventName, context = {}) {
    const evaluationContext = { ...context, eventName };
    const unlockedAchievements = [];

    ACHIEVEMENTS.forEach((definition) => {
        if (hasAchievement(definition.id) || !definition.events.includes(eventName)) {
            return;
        }

        if (!definition.isUnlocked(evaluationContext)) {
            return;
        }

        const record = {
            id: definition.id,
            earnedAt: new Date().toISOString(),
            seenAt: null,
        };
        state.achievements.push(record);
        unlockedAchievements.push({ ...definition, ...record });
    });

    if (unlockedAchievements.length > 0) {
        saveAchievements();
    }

    return unlockedAchievements;
}

function markAchievementsSeen() {
    const unseenAchievements = state.achievements.filter((achievement) => !achievement.seenAt);
    if (!unseenAchievements.length) {
        return;
    }

    const seenAt = new Date().toISOString();
    unseenAchievements.forEach((achievement) => {
        achievement.seenAt = seenAt;
    });
    saveAchievements();
    updateAchievementBadge();
}

function updateAchievementBadge() {
    if (!elements.achievementUnreadBadge || !elements.achievementsButton) {
        return;
    }

    const unreadCount = getUnreadAchievementCount();
    elements.achievementUnreadBadge.hidden = unreadCount === 0;
    elements.achievementUnreadBadge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
    elements.achievementsButton.setAttribute(
        "aria-label",
        unreadCount > 0 ? `Open achievements, ${unreadCount} unread` : "Open achievements"
    );
}

function queueAchievementToasts(achievements) {
    if (!achievements.length || !elements.achievementToast) {
        return;
    }

    achievementToastQueue.push(...achievements);
    if (!achievementToastTimer && elements.achievementToast.hidden) {
        showNextAchievementToast();
    }
}

function showNextAchievementToast() {
    if (
        !elements.achievementToast ||
        !elements.achievementToastIcon ||
        !elements.achievementToastTitle ||
        !elements.achievementToastMessage
    ) {
        achievementToastTimer = 0;
        return;
    }

    const achievement = achievementToastQueue.shift();
    if (!achievement) {
        achievementToastTimer = 0;
        elements.achievementToast.classList.remove("is-visible");
        elements.achievementToast.hidden = true;
        return;
    }

    elements.achievementToastIcon.innerHTML = `<i data-lucide="${escapeHtml(achievement.icon)}"></i>`;
    elements.achievementToastTitle.textContent = achievement.title;
    elements.achievementToastMessage.textContent = achievement.message;
    elements.achievementToast.hidden = false;
    window.requestAnimationFrame(() => {
        elements.achievementToast.classList.add("is-visible");
    });
    refreshIcons();

    achievementToastTimer = window.setTimeout(() => {
        elements.achievementToast.classList.remove("is-visible");
        achievementToastTimer = window.setTimeout(showNextAchievementToast, 220);
    }, 3600);
}

function clearAchievementToasts() {
    achievementToastQueue.length = 0;
    window.clearTimeout(achievementToastTimer);
    achievementToastTimer = 0;

    if (elements.achievementToast) {
        elements.achievementToast.classList.remove("is-visible");
        elements.achievementToast.hidden = true;
    }
}

function getEarnedAchievementRecords() {
    const recordsById = new Map(state.achievements.map((achievement) => [achievement.id, achievement]));
    return ACHIEVEMENTS.map((definition) => {
        const record = recordsById.get(definition.id);
        return record ? { ...definition, ...record } : null;
    })
        .filter(Boolean)
        .sort((first, second) => new Date(second.earnedAt).getTime() - new Date(first.earnedAt).getTime());
}

function getAchievementDefinition(achievementId) {
    return ACHIEVEMENTS.find((achievement) => achievement.id === achievementId) || null;
}

function hasAchievement(achievementId) {
    return state.achievements.some((achievement) => achievement.id === achievementId);
}

function getUnreadAchievementCount() {
    return state.achievements.filter((achievement) => !achievement.seenAt && getAchievementDefinition(achievement.id)).length;
}

function hasSmallWin() {
    const goal = state.settings.calorieGoalCalories;
    if (goal <= 0) {
        return false;
    }

    const todayEntries = getEntriesForDate(getDateKey(new Date()));
    return todayEntries.length > 0 && sumEntries(todayEntries).calories <= goal;
}

function hasFastingGoalHit() {
    const goal = state.settings.fastingGoalHours;
    return goal > 0 && state.fasts.some((fast) => getFastDurationHours(fast) >= goal);
}

function hasFoodLoggedAfterGap(entry) {
    if (!entry || !entry.date) {
        return false;
    }

    const previousDates = Array.from(
        new Set(
            state.entries
                .filter((item) => item.id !== entry.id && item.date && item.date < entry.date)
                .map((item) => item.date)
        )
    ).sort();
    const previousDate = previousDates[previousDates.length - 1];

    return Boolean(previousDate && getDateDifferenceDays(previousDate, entry.date) >= 3);
}

function getDateDifferenceDays(startDateKey, endDateKey) {
    const start = dateFromKey(startDateKey);
    const end = dateFromKey(endDateKey);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 0;
    }

    return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function updateFoodSuggestions() {
    const suggestions = getRecentFoodSuggestions(elements.foodName.value);
    if (!suggestions.length) {
        hideFoodSuggestions();
        return;
    }

    elements.foodSuggestionList.innerHTML = suggestions.map(renderFoodSuggestion).join("");
    elements.foodSuggestionList.hidden = false;
    elements.foodName.setAttribute("aria-expanded", "true");
}

function handleFoodSuggestionPointerDown(event) {
    const button = event.target.closest("[data-food-suggestion-id]");
    if (!button) {
        return;
    }

    event.preventDefault();
    const entry = state.entries.find((item) => item.id === button.dataset.foodSuggestionId);
    if (!entry) {
        return;
    }

    populateFoodFormFromEntry(entry);
    hideFoodSuggestions();
}

function populateFoodFormFromEntry(entry) {
    const protein = getMacroFormValue(entry, "protein");
    const sugar = getMacroFormValue(entry, "sugar");

    elements.foodName.value = entry.name;
    elements.calorieInput.value = formatInputNumber(entry.calories);
    elements.proteinInput.value = formatInputNumber(protein.amount);
    elements.proteinUnit.value = protein.unit;
    elements.sugarInput.value = formatInputNumber(sugar.amount);
    elements.sugarUnit.value = sugar.unit;
}

function hideFoodSuggestions() {
    if (!elements.foodSuggestionList || !elements.foodName) {
        return;
    }

    elements.foodSuggestionList.hidden = true;
    elements.foodSuggestionList.innerHTML = "";
    elements.foodName.setAttribute("aria-expanded", "false");
}

function getRecentFoodSuggestions(query) {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
        return [];
    }

    const seenNames = new Set();
    return state.entries
        .slice()
        .sort((a, b) => getEntryTimestamp(b) - getEntryTimestamp(a))
        .filter((entry) => {
            const normalizedName = normalizeSearchText(entry.name);
            if (!normalizedName.includes(normalizedQuery) || seenNames.has(normalizedName)) {
                return false;
            }

            seenNames.add(normalizedName);
            return true;
        })
        .slice(0, 5);
}

function renderFoodSuggestion(entry) {
    const protein = getMacroFormValue(entry, "protein");
    const sugar = getMacroFormValue(entry, "sugar");
    const safeName = escapeHtml(entry.name);

    return `
        <button class="food-suggestion-button" type="button" role="option" data-food-suggestion-id="${escapeHtml(entry.id)}">
            <span class="food-suggestion-name">${safeName}</span>
            <span class="food-suggestion-meta">
                <span>${formatCalories(entry.calories)} kcal</span>
                <span>${formatInputNumber(protein.amount)}${protein.unit} protein</span>
                <span>${formatInputNumber(sugar.amount)}${sugar.unit} sugar</span>
            </span>
            <span class="food-suggestion-time">${escapeHtml(formatEntryLastLogged(entry))}</span>
        </button>
    `;
}

function drawCharts() {
    drawCalorieLineChart();
    drawCategoryBarChart();
    drawFastingBarChart();
}

function drawCalorieLineChart() {
    const canvas = elements.calorieLineChart;
    const chart = prepareCanvas(canvas);
    if (!chart) {
        return;
    }

    const { ctx, width, height, colors } = chart;
    const dates = getLastSevenDateKeys();
    const values = dates.map((dateKey) => sumEntries(getEntriesForDate(dateKey)).calories);
    const goal = state.settings.calorieGoalCalories;
    const maxValue = Math.max(500, goal, ...values);
    const padding = { top: 16, right: 12, bottom: 28, left: 42 };
    const plotWidth = Math.max(1, width - padding.left - padding.right);
    const plotHeight = Math.max(1, height - padding.top - padding.bottom);
    const baseline = padding.top + plotHeight;

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    ctx.font = "600 11px Inter, system-ui, sans-serif";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 3; i += 1) {
        const ratio = i / 3;
        const y = padding.top + plotHeight * ratio;
        const labelValue = Math.round(maxValue * (1 - ratio));

        ctx.strokeStyle = colors.border;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = colors.muted;
        ctx.textAlign = "right";
        ctx.fillText(formatCompactNumber(labelValue), padding.left - 8, y);
    }

    if (goal > 0) {
        const goalY = baseline - (Math.min(goal, maxValue) / maxValue) * plotHeight;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = colors.calories;
        ctx.beginPath();
        ctx.moveTo(padding.left, goalY);
        ctx.lineTo(width - padding.right, goalY);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = colors.calories;
        ctx.textAlign = "right";
        ctx.fillText("Goal", width - padding.right, Math.max(padding.top + 8, goalY - 9));
    }

    const points = values.map((value, index) => {
        const x = padding.left + (plotWidth / Math.max(1, values.length - 1)) * index;
        const y = baseline - (Math.min(value, maxValue) / maxValue) * plotHeight;
        return { x, y, value };
    });

    const fill = ctx.createLinearGradient(0, padding.top, 0, baseline);
    fill.addColorStop(0, "rgba(249, 115, 22, 0.22)");
    fill.addColorStop(1, "rgba(249, 115, 22, 0)");

    ctx.beginPath();
    points.forEach((point, index) => {
        if (index === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });
    ctx.lineTo(points[points.length - 1].x, baseline);
    ctx.lineTo(points[0].x, baseline);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, index) => {
        if (index === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });
    ctx.strokeStyle = colors.calories;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    points.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = colors.panel;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = colors.calories;
        ctx.stroke();
    });

    ctx.fillStyle = colors.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    dates.forEach((dateKey, index) => {
        const x = padding.left + (plotWidth / Math.max(1, dates.length - 1)) * index;
        ctx.fillText(formatWeekday(dateKey), x, height - 6);
    });
}

function drawCategoryBarChart() {
    const canvas = elements.categoryBarChart;
    const chart = prepareCanvas(canvas);
    if (!chart) {
        return;
    }

    const { ctx, width, height, colors } = chart;
    const weekEntries = getEntriesForDates(getLastSevenDateKeys());
    const totals = sumEntries(weekEntries);
    const bars = [
        {
            label: "Calories",
            value: totals.calories,
            reference: WEEKLY_REFERENCES.calories,
            display: `${formatCalories(totals.calories)} kcal`,
            color: colors.calories,
        },
        {
            label: "Protein",
            value: totals.protein,
            reference: WEEKLY_REFERENCES.protein,
            display: `${formatGrams(totals.protein)}g`,
            color: colors.protein,
        },
        {
            label: "Sugar",
            value: totals.sugar,
            reference: WEEKLY_REFERENCES.sugar,
            display: `${formatGrams(totals.sugar)}g`,
            color: colors.sugar,
        },
    ];

    const padding = { top: 8, right: 12, bottom: 12, left: 12 };
    const rowHeight = 45;
    const labelHeight = 18;
    const barHeight = 12;
    const plotWidth = Math.max(1, width - padding.left - padding.right);

    ctx.clearRect(0, 0, width, height);
    ctx.font = "700 12px Inter, system-ui, sans-serif";
    ctx.textBaseline = "middle";

    bars.forEach((bar, index) => {
        const y = padding.top + index * rowHeight;
        const percent = bar.reference > 0 ? Math.min(bar.value / bar.reference, 1) : 0;
        const overTarget = bar.reference > 0 && bar.value > bar.reference;

        ctx.fillStyle = colors.foreground;
        ctx.textAlign = "left";
        ctx.fillText(bar.label, padding.left, y + labelHeight / 2);

        ctx.fillStyle = colors.muted;
        ctx.textAlign = "right";
        ctx.fillText(bar.display, width - padding.right, y + labelHeight / 2);

        const trackY = y + labelHeight + 9;
        roundRect(ctx, padding.left, trackY, plotWidth, barHeight, 6);
        ctx.fillStyle = colors.border;
        ctx.fill();

        const fillWidth = Math.max(bar.value > 0 ? 5 : 0, plotWidth * percent);
        roundRect(ctx, padding.left, trackY, fillWidth, barHeight, 6);
        ctx.fillStyle = bar.color;
        ctx.fill();

        if (overTarget) {
            ctx.fillStyle = colors.foreground;
            ctx.textAlign = "right";
            ctx.font = "700 10px Inter, system-ui, sans-serif";
            ctx.fillText("100%+", width - padding.right, trackY + barHeight + 11);
            ctx.font = "700 12px Inter, system-ui, sans-serif";
        }
    });
}

function drawFastingBarChart() {
    const canvas = elements.fastingBarChart;
    const chart = prepareCanvas(canvas);
    if (!chart) {
        return;
    }

    const { ctx, width, height, colors } = chart;
    const dates = getLastSevenDateKeys();
    const values = dates.map((dateKey) => sumFastHours(getFastsForDate(dateKey)));
    const goal = state.settings.fastingGoalHours;
    const maxValue = Math.max(1, goal, ...values);
    const displayMax = Math.ceil(maxValue * 1.2);
    const padding = { top: 16, right: 12, bottom: 28, left: 34 };
    const plotWidth = Math.max(1, width - padding.left - padding.right);
    const plotHeight = Math.max(1, height - padding.top - padding.bottom);
    const baseline = padding.top + plotHeight;
    const slotWidth = plotWidth / dates.length;
    const barWidth = Math.min(24, slotWidth * 0.48);

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    ctx.font = "600 11px Inter, system-ui, sans-serif";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 2; i += 1) {
        const ratio = i / 2;
        const y = padding.top + plotHeight * ratio;
        const labelValue = Math.round(displayMax * (1 - ratio));

        ctx.strokeStyle = colors.border;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = colors.muted;
        ctx.textAlign = "right";
        ctx.fillText(String(labelValue), padding.left - 8, y);
    }

    if (goal > 0) {
        const goalY = baseline - (Math.min(goal, displayMax) / displayMax) * plotHeight;
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = colors.fasting;
        ctx.beginPath();
        ctx.moveTo(padding.left, goalY);
        ctx.lineTo(width - padding.right, goalY);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = colors.fasting;
        ctx.textAlign = "right";
        ctx.fillText("Goal", width - padding.right, Math.max(padding.top + 8, goalY - 9));
    }

    values.forEach((value, index) => {
        const slotX = padding.left + slotWidth * index;
        const x = slotX + (slotWidth - barWidth) / 2;
        const barHeight = (Math.min(value, displayMax) / displayMax) * plotHeight;
        const y = baseline - barHeight;

        roundRect(ctx, x, y, barWidth, Math.max(value > 0 ? 5 : 0, barHeight), 6);
        ctx.fillStyle = value >= goal && value > 0 ? colors.fasting : "rgba(250, 204, 21, 0.42)";
        ctx.fill();
    });

    ctx.fillStyle = colors.muted;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    dates.forEach((dateKey, index) => {
        const x = padding.left + slotWidth * index + slotWidth / 2;
        ctx.fillText(formatWeekday(dateKey), x, height - 6);
    });
}

function prepareCanvas(canvas) {
    if (!canvas) {
        return null;
    }

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height || Number(canvas.getAttribute("height")) || 180);
    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return null;
    }

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    return {
        ctx,
        width,
        height,
        colors: getChartColors(),
    };
}

function getChartColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
        foreground: styles.getPropertyValue("--zinc-100").trim() || "#f4f4f5",
        muted: styles.getPropertyValue("--zinc-400").trim() || "#a1a1aa",
        border: styles.getPropertyValue("--zinc-800").trim() || "#27272a",
        panel: styles.getPropertyValue("--zinc-950").trim() || "#09090b",
        calories: styles.getPropertyValue("--calories").trim() || "#f97316",
        protein: styles.getPropertyValue("--protein").trim() || "#22c55e",
        sugar: styles.getPropertyValue("--sugar").trim() || "#38bdf8",
        fasting: styles.getPropertyValue("--fasting").trim() || "#facc15",
    };
}

function roundRect(ctx, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
}

function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) {
        return;
    }

    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    window.setTimeout(() => {
        const firstInput = modal.querySelector("input:not([type='hidden']), select, textarea") || modal.querySelector("button");
        if (firstInput) {
            firstInput.focus();
        }
    }, 0);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) {
        return;
    }

    modal.setAttribute("aria-hidden", "true");
    if (id === "addFoodModal") {
        hideFoodSuggestions();
    }
    if (!document.querySelector('.modal[aria-hidden="false"]')) {
        document.body.classList.remove("modal-open");
    }
}

function closeOpenModal() {
    const openModalElement = document.querySelector('.modal[aria-hidden="false"]');
    if (openModalElement) {
        closeModal(openModalElement.id);
    }
}

function populateFastingDefaults() {
    const end = new Date();
    const start = new Date(end.getTime() - state.settings.fastingGoalHours * 3600000);
    const startInput = document.querySelector("#fastStart");
    const endInput = document.querySelector("#fastEnd");

    if (startInput && endInput) {
        startInput.value = formatDateTimeInput(start);
        endInput.value = formatDateTimeInput(end);
    }
}

function getEntriesForDate(dateKey) {
    return state.entries.filter((entry) => entry.date === dateKey);
}

function getEntriesForDates(dateKeys) {
    const keySet = new Set(dateKeys);
    return state.entries.filter((entry) => keySet.has(entry.date));
}

function getFastsForDate(dateKey) {
    return state.fasts.filter((fast) => getFastDateKey(fast) === dateKey);
}

function getFastsForDates(dateKeys) {
    const keySet = new Set(dateKeys);
    return state.fasts.filter((fast) => keySet.has(getFastDateKey(fast)));
}

function getFastDateKey(fast) {
    if (typeof fast.date === "string") {
        return fast.date;
    }

    const end = new Date(fast.endAt);
    return Number.isNaN(end.getTime()) ? "" : getDateKey(end);
}

function sumEntries(entries) {
    return entries.reduce(
        (totals, entry) => {
            totals.calories += Number(entry.calories) || 0;
            totals.protein += getMacroGrams(entry, "protein");
            totals.sugar += getMacroGrams(entry, "sugar");
            return totals;
        },
        { calories: 0, protein: 0, sugar: 0 }
    );
}

function sumFastHours(fasts) {
    return fasts.reduce((total, fast) => total + getFastDurationHours(fast), 0);
}

function getFastDurationHours(fast) {
    if (Number.isFinite(Number(fast.durationHours))) {
        return Number(fast.durationHours);
    }

    const start = new Date(fast.startAt);
    const end = new Date(fast.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        return 0;
    }

    return (end.getTime() - start.getTime()) / 3600000;
}

function getMacroFormValue(entry, key) {
    const macro = entry[key];
    if (!macro || typeof macro !== "object") {
        return { amount: 0, unit: "g" };
    }

    const unit = sanitizeUnit(macro.unit);
    if (Number.isFinite(Number(macro.amount))) {
        return { amount: Number(macro.amount), unit };
    }

    return { amount: getMacroGrams(entry, key), unit: "g" };
}

function getMacroGrams(entry, key) {
    const macro = entry[key];
    if (!macro || typeof macro !== "object") {
        return 0;
    }

    if (Number.isFinite(Number(macro.grams))) {
        return Number(macro.grams);
    }

    return toGrams(Number(macro.amount) || 0, sanitizeUnit(macro.unit));
}

function loadEntries() {
    try {
        const rawEntries = window.localStorage.getItem(STORAGE_KEY);
        if (!rawEntries) {
            return [];
        }

        const parsed = JSON.parse(rawEntries);
        return Array.isArray(parsed) ? parsed.filter(isValidEntry) : [];
    } catch (error) {
        console.warn("Unable to load saved food entries.", error);
        return [];
    }
}

function saveEntries() {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
    } catch (error) {
        console.warn("Unable to save food entries.", error);
    }
}

function loadFasts() {
    try {
        const rawFasts = window.localStorage.getItem(FASTING_STORAGE_KEY);
        if (!rawFasts) {
            return [];
        }

        const parsed = JSON.parse(rawFasts);
        return Array.isArray(parsed) ? parsed.filter(isValidFast) : [];
    } catch (error) {
        console.warn("Unable to load saved fasting logs.", error);
        return [];
    }
}

function saveFasts() {
    try {
        window.localStorage.setItem(FASTING_STORAGE_KEY, JSON.stringify(state.fasts));
    } catch (error) {
        console.warn("Unable to save fasting logs.", error);
    }
}

function loadSettings() {
    try {
        const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!rawSettings) {
            return { ...DEFAULT_SETTINGS };
        }

        const parsed = JSON.parse(rawSettings);
        return {
            ...DEFAULT_SETTINGS,
            fastingGoalHours: sanitizeFastingGoal(parsed && parsed.fastingGoalHours),
            calorieGoalCalories: sanitizeCalorieGoal(parsed && parsed.calorieGoalCalories),
        };
    } catch (error) {
        console.warn("Unable to load settings.", error);
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(state.settings));
    } catch (error) {
        console.warn("Unable to save settings.", error);
    }
}

function loadAchievements() {
    try {
        const rawAchievements = window.localStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
        if (!rawAchievements) {
            return [];
        }

        const parsed = JSON.parse(rawAchievements);
        if (!Array.isArray(parsed)) {
            return [];
        }

        const seenIds = new Set();
        return parsed
            .map(normalizeAchievementRecord)
            .filter(Boolean)
            .filter((achievement) => {
                if (seenIds.has(achievement.id)) {
                    return false;
                }

                seenIds.add(achievement.id);
                return true;
            });
    } catch (error) {
        console.warn("Unable to load achievements.", error);
        return [];
    }
}

function saveAchievements() {
    try {
        window.localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(state.achievements));
    } catch (error) {
        console.warn("Unable to save achievements.", error);
    }
}