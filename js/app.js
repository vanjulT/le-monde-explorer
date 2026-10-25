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

// ---------- Data ----------
let allCountries = []; // everything the API gave us (never changed after loading)
let searchText = ""; // what the user typed, in lower case

// ---------- The 3 states: loading, error, empty ----------
function setState(state, message = "") {
  loadingBox.classList.toggle("hidden", state !== "loading");
  errorBox.classList.toggle("hidden", state !== "error");
  emptyBox.classList.toggle("hidden", state !== "empty");

  if (state === "error") {
    errorMessage.textContent = message;
  }
}

// ---------- Building one card ----------
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

function createCard(country) {
  const card = document.createElement("article");
  card.className =
    "overflow-hidden rounded-xl bg-slate-200 shadow transition hover:shadow-lg";
  card.dataset.code = country.codes.alpha_3;

  const body = document.createElement("div");
  body.className = "space-y-1 p-4";

  const name = document.createElement("h2");
  name.className = "mb-2 text-lg font-semibold text-orange-800";
  name.textContent = country.names.common;

  const capital = country.capitals?.[0]?.name ?? "No capital";
  const population = country.population.toLocaleString("en-US");

  body.append(
    name,
    makeLine("Population", population),
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

// ---------- Which countries should be visible right now? ----------
function getVisibleCountries() {
  return allCountries.filter((country) =>
    country.names.common.toLowerCase().includes(searchText)
  );
}

function showCountries() {
  renderCountries(getVisibleCountries());
}

// ---------- Loading the data ----------
async function loadCountries() {
  setState("loading");
  grid.replaceChildren();

  try {
    allCountries = await fetchAllCountries();
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

refreshButton.addEventListener("click", loadCountries);
retryButton.addEventListener("click", loadCountries);

// ---------- Start ----------
loadCountries();