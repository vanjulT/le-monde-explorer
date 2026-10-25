import { fetchAllCountries } from "./api.js";
import { loadFavorites, saveFavorites } from "./storage.js";

// ---------- Page elements ----------
const grid = document.getElementById("country-grid");
const controls = document.getElementById("controls");
const loadingBox = document.getElementById("loading");
const errorBox = document.getElementById("error");
const errorMessage = document.getElementById("error-message");
const emptyBox = document.getElementById("empty");
const refreshButton = document.getElementById("refresh-button");
const retryButton = document.getElementById("retry-button");
const searchInput = document.getElementById("search");
const regionSelect = document.getElementById("region");
const sortSelect = document.getElementById("sort");
const detailDialog = document.getElementById("detail-dialog");
const detailContent = document.getElementById("detail-content");
const tabAll = document.getElementById("tab-all");
const tabFavorites = document.getElementById("tab-favorites");
const tabCompare = document.getElementById("tab-compare");
const favoritesCount = document.getElementById("favorites-count");
const compareView = document.getElementById("compare-view");
const compareA = document.getElementById("compare-a");
const compareB = document.getElementById("compare-b");
const compareMessage = document.getElementById("compare-message");
const compareResult = document.getElementById("compare-result");

// ---------- Data ----------
let allCountries = []; // everything the API gave us (never changed after loading)
let searchText = ""; // what the user typed, in lower case
let selectedRegion = ""; // "" means all regions
let sortBy = "name"; // "name", "population" or "area"
let favorites = loadFavorites(); // list of country codes, read from LocalStorage
let currentView = "all"; // "all", "favorites" or "compare"
let currentDetailCode = null; // the country shown in the pop-up right now

// ---------- The 3 states: loading, error, empty ----------
const DEFAULT_EMPTY_TEXT = "No countries found. Try another search.";
const NO_FAVORITES_TEXT =
  "You have no favorites yet. Click the star on a country to save it.";

function setState(state, message = "") {
  loadingBox.classList.toggle("hidden", state !== "loading");
  errorBox.classList.toggle("hidden", state !== "error");
  emptyBox.classList.toggle("hidden", state !== "empty");

  if (state === "error") {
    errorMessage.textContent = message;
  }
}

// ---------- Small building blocks ----------
function makeLine(label, value) {
  const line = document.createElement("p");
  line.className = "text-sm text-slate-600";

  const strong = document.createElement("span");
  strong.className = "font-medium text-slate-800";
  strong.textContent = `${label}: `;

  line.append(strong, value);
  return line;
}

// A grey box shown when a country has no flag, or the flag fails to load
function makeNoFlag() {
  const box = document.createElement("div");
  box.className =
    "flex h-36 w-full items-center justify-center bg-slate-300 text-sm text-slate-600";
  box.textContent = "No flag available";
  return box;
}

function makeFlag(country) {
  const url = country.flag?.url_svg;

  if (!url) {
    return makeNoFlag();
  }

  const flag = document.createElement("img");
  flag.src = url;
  flag.alt = `Flag of ${country.names.common}`;
  flag.loading = "lazy";
  flag.className = "h-36 w-full object-cover";

  // If the image cannot be loaded, swap it for the grey box
  flag.addEventListener("error", () => {
    flag.replaceWith(makeNoFlag());
  });

  return flag;
}

// Text helpers, used by the pop-up and by the compare view
function getCapitals(country) {
  return (country.capitals ?? []).map((c) => c.name).join(", ") || "No capital";
}

function getCurrencies(country) {
  return (
    (country.currencies ?? []).map((c) => `${c.name} (${c.symbol})`).join(", ") ||
    "None"
  );
}

function getLanguages(country) {
  return (country.languages ?? []).map((l) => l.name).join(", ") || "None";
}

function getArea(country) {
  return country.area?.kilometers ?? 0;
}

// ---------- Favorites ----------
function isFavorite(code) {
  return favorites.includes(code);
}

function updateFavoritesCount() {
  favoritesCount.textContent = favorites.length;
}

// The star button. Its look depends on whether the country is a favorite.
function makeFavoriteButton(country, extraClasses) {
  const code = country.codes.alpha_3;
  const saved = isFavorite(code);

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = "favorite";
  button.dataset.code = code;
  button.textContent = saved ? "★" : "☆";
  button.setAttribute("aria-pressed", saved);
  button.setAttribute(
    "aria-label",
    saved
      ? `Remove ${country.names.common} from favorites`
      : `Add ${country.names.common} to favorites`
  );
  button.className = `rounded-full bg-white/90 px-2 py-1 text-xl text-orange-600 hover:bg-white ${extraClasses}`;
  return button;
}

function toggleFavorite(code) {
  if (isFavorite(code)) {
    // keep every code except this one
    favorites = favorites.filter((savedCode) => savedCode !== code);
  } else {
    favorites = [...favorites, code];
  }

  saveFavorites(favorites); // keep LocalStorage in sync
  updateFavoritesCount();
  showCountries();

  // If the pop-up is open, redraw it so its star changes too
  if (detailDialog.open && currentDetailCode) {
    openDetail(currentDetailCode);
  }
}

// ---------- Building one card ----------
function createCard(country) {
  const card = document.createElement("article");
  card.className =
    "relative cursor-pointer overflow-hidden rounded-xl bg-slate-200 shadow transition hover:shadow-lg";
  card.dataset.code = country.codes.alpha_3;
  card.tabIndex = 0; // so the keyboard can reach the card

  const body = document.createElement("div");
  body.className = "space-y-1 p-4";

  const name = document.createElement("h2");
  name.className = "mb-2 text-lg font-semibold text-orange-800";
  name.textContent = country.names.common;

  const capital = country.capitals?.[0]?.name ?? "No capital";
  const population = country.population.toLocaleString("en-US");
  const area = getArea(country).toLocaleString("en-US");

  body.append(
    name,
    makeLine("Population", population),
    makeLine("Area", `${area} km²`),
    makeLine("Capital", capital),
    makeLine("Region", country.region)
  );

  card.append(
    makeFlag(country),
    body,
    makeFavoriteButton(country, "absolute right-2 top-2")
  );
  return card;
}

// ---------- Showing a list of countries ----------
function renderCountries(list) {
  grid.replaceChildren();

  if (list.length === 0) {
    const noFavoritesYet = currentView === "favorites" && favorites.length === 0;
    emptyBox.textContent = noFavoritesYet ? NO_FAVORITES_TEXT : DEFAULT_EMPTY_TEXT;
    setState("empty");
    return;
  }

  // A fragment lets us build many cards off-screen, then add them once
  const fragment = document.createDocumentFragment();
  list.forEach((country) => fragment.append(createCard(country)));
  grid.append(fragment);

  setState("ready");
}

// ---------- Filling the region menu from the real data ----------
function fillRegionMenu() {
  // 1. take the region of every country
  // 2. remove empty ones and duplicates (a Set keeps each value once)
  // 3. sort them A to Z
  const regions = [...new Set(allCountries.map((country) => country.region))]
    .filter((region) => region)
    .sort();

  // keep the first option ("All regions"), remove the rest, then add ours
  regionSelect.length = 1;

  regions.forEach((region) => {
    const option = document.createElement("option");
    option.value = region;
    option.textContent = region;
    regionSelect.append(option);
  });
}

// ---------- Sorting ----------
// A sort function gets two countries (a and b) and returns:
//   a negative number -> a goes first
//   a positive number -> b goes first
function compareCountries(a, b) {
  if (sortBy === "population") {
    return b.population - a.population; // big to small
  }

  if (sortBy === "area") {
    return getArea(b) - getArea(a); // big to small
  }

  return a.names.common.localeCompare(b.names.common); // A to Z
}

// ---------- Which countries should be visible right now? ----------
function getVisibleCountries() {
  // filter() gives us a new list, so sorting it does not touch allCountries
  return allCountries
    .filter((country) => {
      const matchesSearch = country.names.common
        .toLowerCase()
        .includes(searchText);

      const matchesRegion =
        selectedRegion === "" || country.region === selectedRegion;

      const matchesView =
        currentView !== "favorites" || isFavorite(country.codes.alpha_3);

      return matchesSearch && matchesRegion && matchesView;
    })
    .sort(compareCountries);
}

function showCountries() {
  renderCountries(getVisibleCountries());
}

// ---------- The detail pop-up ----------
function findCountryByCode(code) {
  return allCountries.find((country) => country.codes.alpha_3 === code);
}

// A border country is shown as a small button (a "chip")
function makeBorderChip(code) {
  const neighbour = findCountryByCode(code);

  const chip = document.createElement("button");
  chip.type = "button";
  chip.dataset.border = code; // we read this when the chip is clicked
  chip.textContent = neighbour ? neighbour.names.common : code;
  chip.className =
    "rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-800 hover:bg-orange-200";
  return chip;
}

function buildDetail(country) {
  const wrapper = document.createElement("div");

  const body = document.createElement("div");
  body.className = "space-y-3 p-5";

  // Title + star + close button
  const titleRow = document.createElement("div");
  titleRow.className = "flex items-start justify-between gap-3";

  const title = document.createElement("h2");
  title.className = "text-2xl font-bold text-orange-800";
  title.textContent = country.names.common;

  const buttons = document.createElement("div");
  buttons.className = "flex items-center gap-2";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.dataset.action = "close";
  closeButton.textContent = "Close";
  closeButton.className =
    "rounded-lg bg-slate-300 px-3 py-1 text-sm hover:bg-slate-400";

  buttons.append(makeFavoriteButton(country, "border border-slate-300"), closeButton);
  titleRow.append(title, buttons);

  // The facts
  body.append(
    titleRow,
    makeLine("Population", country.population.toLocaleString("en-US")),
    makeLine("Area", `${getArea(country).toLocaleString("en-US")} km²`),
    makeLine("Capital", getCapitals(country)),
    makeLine("Region", country.region),
    makeLine("Subregion", country.subregion || "None"),
    makeLine("Currencies", getCurrencies(country)),
    makeLine("Languages", getLanguages(country))
  );

  // Border countries as clickable chips
  const bordersTitle = document.createElement("p");
  bordersTitle.className = "text-sm font-medium text-slate-800";
  bordersTitle.textContent = "Borders:";
  body.append(bordersTitle);

  const borders = country.borders ?? [];

  if (borders.length === 0) {
    const none = document.createElement("p");
    none.className = "text-sm text-slate-600";
    none.textContent = "No land borders";
    body.append(none);
  } else {
    const chips = document.createElement("div");
    chips.className = "flex flex-wrap gap-2";
    borders.forEach((code) => chips.append(makeBorderChip(code)));
    body.append(chips);
  }

  // Link to a map
  const mapUrl =
    country.links?.google_maps || country.links?.open_street_maps;

  if (mapUrl) {
    const mapLink = document.createElement("a");
    mapLink.href = mapUrl;
    mapLink.target = "_blank";
    mapLink.rel = "noopener noreferrer";
    mapLink.textContent = "View on a map";
    mapLink.className =
      "inline-block text-sm font-medium text-orange-700 underline hover:text-orange-900";
    body.append(mapLink);
  }

  wrapper.append(makeFlag(country), body);
  return wrapper;
}

function openDetail(code) {
  const country = findCountryByCode(code);

  if (!country) {
    return;
  }

  currentDetailCode = code;
  detailContent.replaceChildren(buildDetail(country));

  // If the pop-up is already open (we clicked a border chip), just change its content
  if (!detailDialog.open) {
    detailDialog.showModal();
  }

  detailDialog.scrollTop = 0;
}

// ---------- The compare view ----------
// One row of the comparison. The bigger number gets a highlight.
function makeCompareRow(label, value, isBigger = false) {
  const row = document.createElement("p");
  row.className = isBigger
    ? "rounded bg-orange-200 px-2 py-1 text-sm font-semibold text-orange-900"
    : "px-2 py-1 text-sm text-slate-700";

  const strong = document.createElement("span");
  strong.className = "font-medium";
  strong.textContent = `${label}: `;

  row.append(strong, isBigger ? `${value} (larger)` : value);
  return row;
}

// One column: a country, compared with the other one
function createCompareCard(country, other) {
  const card = document.createElement("article");
  card.className = "overflow-hidden rounded-xl bg-slate-200 shadow";

  const body = document.createElement("div");
  body.className = "space-y-1 p-4";

  const name = document.createElement("h2");
  name.className = "mb-2 text-xl font-bold text-orange-800";
  name.textContent = country.names.common;

  const biggerPopulation = country.population > other.population;
  const biggerArea = getArea(country) > getArea(other);

  body.append(
    name,
    makeCompareRow(
      "Population",
      country.population.toLocaleString("en-US"),
      biggerPopulation
    ),
    makeCompareRow(
      "Area",
      `${getArea(country).toLocaleString("en-US")} km²`,
      biggerArea
    ),
    makeCompareRow("Capital", getCapitals(country)),
    makeCompareRow("Region", country.region),
    makeCompareRow("Currencies", getCurrencies(country)),
    makeCompareRow("Languages", getLanguages(country)),
    makeCompareRow("Border countries", (country.borders ?? []).length)
  );

  card.append(makeFlag(country), body);
  return card;
}

// Fill one menu with the favorites and select the wanted one
function fillCompareMenu(select, countries, wantedCode) {
  select.replaceChildren();

  countries.forEach((country) => {
    const option = document.createElement("option");
    option.value = country.codes.alpha_3;
    option.textContent = country.names.common;
    select.append(option);
  });

  select.value = wantedCode;
}

function showCompare() {
  compareResult.replaceChildren();

  // the saved codes -> the real countries (skipping any we cannot find)
  const saved = favorites.map(findCountryByCode).filter((country) => country);

  if (saved.length < 2) {
    compareA.replaceChildren();
    compareB.replaceChildren();
    compareMessage.textContent =
      allCountries.length === 0
        ? "The countries are not loaded yet."
        : "Save at least 2 favorites to compare them. Click the star on a country.";
    compareMessage.classList.remove("hidden");
    return;
  }

  compareMessage.classList.add("hidden");

  // keep what the user picked if it is still possible, otherwise use the first two
  const codes = saved.map((country) => country.codes.alpha_3);
  const firstCode = codes.includes(compareA.value) ? compareA.value : codes[0];
  const secondCode = codes.includes(compareB.value)
    ? compareB.value
    : codes.find((code) => code !== firstCode);

  fillCompareMenu(compareA, saved, firstCode);
  fillCompareMenu(compareB, saved, secondCode);

  const first = findCountryByCode(firstCode);
  const second = findCountryByCode(secondCode);

  compareResult.append(
    createCompareCard(first, second),
    createCompareCard(second, first)
  );
}

// ---------- Tabs: all countries / favorites / compare ----------
function styleTab(button, isActive) {
  button.className = isActive
    ? "rounded-lg bg-orange-700 px-4 py-2 text-white hover:bg-orange-800"
    : "rounded-lg bg-slate-200 px-4 py-2 hover:bg-slate-300";
}

function showCurrentView() {
  if (currentView === "compare") {
    showCompare();
  } else {
    showCountries();
  }
}

function setView(view) {
  currentView = view;
  const isCompare = view === "compare";

  styleTab(tabAll, view === "all");
  styleTab(tabFavorites, view === "favorites");
  styleTab(tabCompare, isCompare);

  // The compare view has its own page area, so hide the search and the grid
  controls.classList.toggle("hidden", isCompare);
  grid.classList.toggle("hidden", isCompare);
  compareView.classList.toggle("hidden", !isCompare);

  if (isCompare) {
    setState("ready"); // hide the loading, error and empty messages
  }

  showCurrentView();
}

// ---------- Loading the data ----------
async function loadCountries() {
  setState("loading");
  grid.replaceChildren();

  try {
    allCountries = await fetchAllCountries();
    fillRegionMenu();
    showCurrentView();
  } catch (error) {
    console.error(error);
    setState("error", `Could not load the countries. ${error.message}`);
  }
}

// ---------- Events ----------
searchInput.addEventListener("input", () => {
  searchText = searchInput.value.trim().toLowerCase();
  showCountries();
});

regionSelect.addEventListener("change", () => {
  selectedRegion = regionSelect.value;
  showCountries();
});

sortSelect.addEventListener("change", () => {
  sortBy = sortSelect.value;
  showCountries();
});

tabAll.addEventListener("click", () => setView("all"));
tabFavorites.addEventListener("click", () => setView("favorites"));
tabCompare.addEventListener("click", () => setView("compare"));

compareA.addEventListener("change", showCompare);
compareB.addEventListener("change", showCompare);

// EVENT DELEGATION: one listener on the grid instead of one on every card.
// A click on anything inside a card "bubbles up" to the grid,
// and closest() tells us what exactly was clicked.
grid.addEventListener("click", (event) => {
  const starButton = event.target.closest("[data-action='favorite']");

  if (starButton) {
    toggleFavorite(starButton.dataset.code);
    return; // do not also open the pop-up
  }

  const card = event.target.closest("article");

  if (card) {
    openDetail(card.dataset.code);
  }
});

// Same idea for the keyboard: Enter on a focused card opens it
grid.addEventListener("keydown", (event) => {
  // only when the card itself is focused (not the star inside it)
  if (event.target.matches("article") && event.key === "Enter") {
    openDetail(event.target.dataset.code);
  }
});

// One listener on the pop-up handles the star, the Close button, the border chips,
// and a click on the dark area around the pop-up
detailDialog.addEventListener("click", (event) => {
  const starButton = event.target.closest("[data-action='favorite']");
  const chip = event.target.closest("[data-border]");
  const closeButton = event.target.closest("[data-action='close']");

  if (starButton) {
    toggleFavorite(starButton.dataset.code);
  } else if (chip) {
    openDetail(chip.dataset.border);
  } else if (closeButton || event.target === detailDialog) {
    detailDialog.close();
  }
});

refreshButton.addEventListener("click", loadCountries);
retryButton.addEventListener("click", loadCountries);

// ---------- Start ----------
updateFavoritesCount();
loadCountries();