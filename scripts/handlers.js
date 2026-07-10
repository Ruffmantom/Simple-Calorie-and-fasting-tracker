function handleFoodSubmit(event) {
    event.preventDefault();

    const formData = new FormData(elements.foodForm);
    const name = String(formData.get("foodName") || "").trim();
    const calories = parsePositiveNumber(formData.get("calories"));
    const proteinAmount = parsePositiveNumber(formData.get("protein"));
    const sugarAmount = parsePositiveNumber(formData.get("sugar"));
    const proteinUnit = sanitizeUnit(formData.get("proteinUnit"));
    const sugarUnit = sanitizeUnit(formData.get("sugarUnit"));

    if (!name) {
        return;
    }

    const entry = {
        id: createId(),
        date: getDateKey(new Date()),
        createdAt: new Date().toISOString(),
        name,
        calories,
        protein: {
            amount: proteinAmount,
            unit: proteinUnit,
            grams: toGrams(proteinAmount, proteinUnit),
        },
        sugar: {
            amount: sugarAmount,
            unit: sugarUnit,
            grams: toGrams(sugarAmount, sugarUnit),
        },
    };

    state.entries.push(entry);
    saveEntries();
    const unlockedAchievements = evaluateAchievements("food", { entry });
    elements.foodForm.reset();
    closeModal("addFoodModal");
    render();
    queueAchievementToasts(unlockedAchievements);
}

function handleFastingSubmit(event) {
    event.preventDefault();

    const formData = new FormData(elements.fastingForm);
    const start = parseDateTimeLocal(formData.get("fastStart"));
    const end = parseDateTimeLocal(formData.get("fastEnd"));

    if (!start || !end || end <= start) {
        window.alert("Choose an end time after the start time.");
        return;
    }

    const durationHours = (end.getTime() - start.getTime()) / 3600000;
    const fast = {
        id: createId(),
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        date: getDateKey(end),
        durationHours,
        createdAt: new Date().toISOString(),
    };

    state.fasts.push(fast);
    saveFasts();
    const unlockedAchievements = evaluateAchievements("fast", { fast });
    elements.fastingForm.reset();
    closeModal("addFastModal");
    render();
    queueAchievementToasts(unlockedAchievements);
}

function handleCalorieGoalSubmit(event) {
    event.preventDefault();

    const formData = new FormData(elements.calorieGoalForm);
    state.settings.calorieGoalCalories = sanitizeCalorieGoal(formData.get("calorieGoalCalories"));
    saveSettings();
    const unlockedAchievements = evaluateAchievements("calorie-goal");
    render();
    queueAchievementToasts(unlockedAchievements);
}

function handleFastingGoalSubmit(event) {
    event.preventDefault();

    const formData = new FormData(elements.fastingGoalForm);
    state.settings.fastingGoalHours = sanitizeFastingGoal(formData.get("fastingGoalHours"));
    saveSettings();
    const unlockedAchievements = evaluateAchievements("fasting-goal");
    render();
    queueAchievementToasts(unlockedAchievements);
}