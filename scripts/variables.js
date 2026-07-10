const APP_VERSION = "1.3.0";
const STORAGE_KEY = "simple-food-tracker.entries.v1";
const FASTING_STORAGE_KEY = "simple-food-tracker.fasts.v1";
const SETTINGS_STORAGE_KEY = "simple-food-tracker.settings.v1";
const ACHIEVEMENT_STORAGE_KEY = "simple-food-tracker.achievements.v1";
const DEFAULT_SETTINGS = {
    fastingGoalHours: 16,
    calorieGoalCalories: 0,
};
const UNIT_TO_GRAMS = {
    g: 1,
    mg: 0.001,
    oz: 28.349523125,
};

const WEEKLY_REFERENCES = {
    calories: 14000,
    protein: 700,
    sugar: 350,
};

function cacheElements() {
    elements.todayLabel = document.querySelector("#todayLabel");
    elements.todayCalories = document.querySelector("#todayCalories");
    elements.todayProtein = document.querySelector("#todayProtein");
    elements.todaySugar = document.querySelector("#todaySugar");
    elements.todayItemCount = document.querySelector("#todayItemCount");
    elements.footerCalories = document.querySelector("#footerCalories");
    elements.foodList = document.querySelector("#foodList");
    elements.foodListCount = document.querySelector("#foodListCount");
    elements.emptyState = document.querySelector("#emptyState");
    elements.openAddFoodButton = document.querySelector("#openAddFoodButton");
    elements.openAddFastButton = document.querySelector("#openAddFastButton");
    elements.settingsButton = document.querySelector("#settingsButton");
    elements.achievementsButton = document.querySelector("#achievementsButton");
    elements.achievementUnreadBadge = document.querySelector("#achievementUnreadBadge");
    elements.foodForm = document.querySelector("#foodForm");
    elements.foodName = document.querySelector("#foodName");
    elements.foodSuggestionList = document.querySelector("#foodSuggestionList");
    elements.calorieInput = document.querySelector("#calorieInput");
    elements.proteinInput = document.querySelector("#proteinInput");
    elements.proteinUnit = document.querySelector("#proteinUnit");
    elements.sugarInput = document.querySelector("#sugarInput");
    elements.sugarUnit = document.querySelector("#sugarUnit");
    elements.fastingForm = document.querySelector("#fastingForm");
    elements.fastingGoalForm = document.querySelector("#fastingGoalForm");
    elements.fastingGoalInput = document.querySelector("#fastingGoalInput");
    elements.calorieGoalForm = document.querySelector("#calorieGoalForm");
    elements.calorieGoalInput = document.querySelector("#calorieGoalInput");
    elements.clearDataButton = document.querySelector("#clearDataButton");
    elements.versionNumber = document.querySelector("#versionNumber");
    elements.calorieLineChart = document.querySelector("#calorieLineChart");
    elements.categoryBarChart = document.querySelector("#categoryBarChart");
    elements.fastingBarChart = document.querySelector("#fastingBarChart");
    elements.fastingLogCount = document.querySelector("#fastingLogCount");
    elements.weeklyFastingHours = document.querySelector("#weeklyFastingHours");
    elements.fastingGoalDisplay = document.querySelector("#fastingGoalDisplay");
    elements.fastingList = document.querySelector("#fastingList");
    elements.fastingEmptyState = document.querySelector("#fastingEmptyState");
    elements.achievementsList = document.querySelector("#achievementsList");
    elements.achievementsEmptyState = document.querySelector("#achievementsEmptyState");
    elements.achievementToast = document.querySelector("#achievementToast");
    elements.achievementToastIcon = document.querySelector("#achievementToastIcon");
    elements.achievementToastTitle = document.querySelector("#achievementToastTitle");
    elements.achievementToastMessage = document.querySelector("#achievementToastMessage");
}