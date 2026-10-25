// Favorites are saved in LocalStorage as a list of country codes, like ["FRA", "ESP"].
// We save only the codes, not whole countries. The data comes from the API anyway.

const STORAGE_KEY = "le-monde-explorer-favorites";

export function loadFavorites() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const list = saved ? JSON.parse(saved) : [];

    // Make sure we really got a list, in case the saved text was changed by hand
    return Array.isArray(list) ? list : [];
  } catch (error) {
    console.error("Could not read the favorites.", error);
    return [];
  }
}

export function saveFavorites(codes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
  } catch (error) {
    console.error("Could not save the favorites.", error);
  }
}