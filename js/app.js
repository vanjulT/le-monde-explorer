import { fetchAllCountries } from "./api.js";

// ---------- Page elements ----------
const grid = document.getElementById("country-grid");
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

// ---------- Data ----------
let allCountries = []; // everything the API gave us (never changed after loading)
let searchText = ""; // what the user typed, in lower case
let selectedRegion = ""; // "" means all regions
let sortBy = "name"; // "name", "population" or "area"

// ---------- The 3 states: loading, error, empty ----------
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

// ---------- Building one card ----------
function createCard(country) {
  const card = document.createElement("article");
  card.className =
    "cursor-pointer overflow-hidden rounded-xl bg-slate-200 shadow transition hover:shadow-lg";
  card.dataset.code = country.codes.alpha_3;
  card.tabIndex = 0; // so the keyboard can reach the card

  const body = document.createElement("div");
  body.className = "space-y-1 p-4";

  const name = document.createElement("h2");
  name.className = "mb-2 text-lg font-semibold text-orange-800";
  name.textContent = country.names.common;

  const capital = country.capitals?.[0]?.name ?? "No capital";
  const population = country.population.toLocaleString("en-US");
  const area = (country.area?.kilometers ?? 0).toLocaleString("en-US");

  body.append(
    name,
    makeLine("Population", population),
    makeLine("Area", `${area} km²`),
    makeLine("Capital", capital),
    makeLine("Region", country.region)
  );

  card.append(makeFlag(country), body);
  return card;
}

// ---------- Showing a list of countries ----------
function renderCountries(list) {
  grid.replaceChildren();

  if (list.length === 0) {
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
    const areaA = a.area?.kilometers ?? 0;
    const areaB = b.area?.kilometers ?? 0;
    return areaB - areaA; // big to small
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

      return matchesSearch && matchesRegion;
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

  // Title + close button
  const titleRow = document.createElement("div");
  titleRow.className = "flex items-start justify-between gap-3";

  const title = document.createElement("h2");
  title.className = "text-2xl font-bold text-orange-800";
  title.textContent = country.names.common;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.dataset.action = "close";
  closeButton.textContent = "Close";
  closeButton.className =
    "rounded-lg bg-slate-300 px-3 py-1 text-sm hover:bg-slate-400";

  titleRow.append(title, closeButton);

  // The facts
  const capitals = (country.capitals ?? []).map((c) => c.name).join(", ");
  const currencies = (country.currencies ?? [])
    .map((c) => `${c.name} (${c.symbol})`)
    .join(", ");
  const languages = (country.languages ?? []).map((l) => l.name).join(", ");

  body.append(
    titleRow,
    makeLine("Population", country.population.toLocaleString("en-US")),
    makeLine("Area", `${(country.area?.kilometers ?? 0).toLocaleString("en-US")} km²`),
    makeLine("Capital", capitals || "No capital"),
    makeLine("Region", country.region),
    makeLine("Subregion", country.subregion || "None"),
    makeLine("Currencies", currencies || "None"),
    makeLine("Languages", languages || "None")
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

  detailContent.replaceChildren(buildDetail(country));

  // If the pop-up is already open (we clicked a border chip), just change its content
  if (!detailDialog.open) {
    detailDialog.showModal();
  }

  detailDialog.scrollTop = 0;
}

// ---------- Loading the data ----------
async function loadCountries() {
  setState("loading");
  grid.replaceChildren();

  try {
    allCountries = await fetchAllCountries();
    fillRegionMenu();
    showCountries();
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

// EVENT DELEGATION: one listener on the grid instead of one on every card.
// A click on anything inside a card "bubbles up" to the grid,
// and closest("article") tells us which card it came from.
grid.addEventListener("click", (event) => {
  const card = event.target.closest("article");

  if (card) {
    openDetail(card.dataset.code);
  }
});

// Same idea for the keyboard: Enter on a focused card opens it
grid.addEventListener("keydown", (event) => {
  const card = event.target.closest("article");

  if (card && event.key === "Enter") {
    openDetail(card.dataset.code);
  }
});

// One listener on the pop-up handles the Close button, the border chips,
// and a click on the dark area around the pop-up
detailDialog.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-border]");
  const closeButton = event.target.closest("[data-action='close']");

  if (chip) {
    openDetail(chip.dataset.border);
  } else if (closeButton || event.target === detailDialog) {
    detailDialog.close();
  }
});

refreshButton.addEventListener("click", loadCountries);
retryButton.addEventListener("click", loadCountries);

// ---------- Start ----------
loadCountries();