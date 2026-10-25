import { API_KEY, BASE_URL } from "./config.js";

const PAGE_SIZE = 100; // the free plan allows 100 countries per request

// Only ask for the data we need, so the answer stays small
const FIELDS = [
  "names.common",
  "codes.alpha_3",
  "flag.url_svg",
  "population",
  "capitals",
  "region",
  "subregion",
  "area.kilometers",
  "borders",
  "currencies",
  "languages",
  "links.google_maps",
  "links.open_street_maps",
].join(",");

// Gets all the countries, 100 at a time, until the API says there are no more
export async function fetchAllCountries() {
  const countries = [];
  let offset = 0;
  let more = true;

  while (more) {
    const url =
      `${BASE_URL}?limit=${PAGE_SIZE}&offset=${offset}` +
      `&response_fields=${FIELDS}&api-key=${API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`The server answered with status ${response.status}.`);
    }

    const json = await response.json();
    countries.push(...json.data.objects);

    more = json.data.meta.more;
    offset += PAGE_SIZE;
  }

  return countries;
}