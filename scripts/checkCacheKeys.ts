import fs from "fs";

const cache = JSON.parse(fs.readFileSync("migracion/geocoding_cache.json", "utf-8"));

const testKeys = [
  "Hipolito Yrigoyen, Zarate, Buenos Aires, Argentina",
  "Mitre, Zarate, Buenos Aires, Argentina",
  "Bartolome Mitre, Zarate, Buenos Aires, Argentina",
  "Romulo Noya, Zarate, Buenos Aires, Argentina",
  "Ameghino, Zarate, Buenos Aires, Argentina",
];

for (const k of Object.keys(cache)) {
  if (k.toLowerCase().includes("yrigoyen") || k.toLowerCase().includes("mitre") || k.toLowerCase().includes("noya")) {
    console.log(k, "=>", cache[k]);
    break;
  }
}

for (const tk of testKeys) {
  console.log(tk, "=>", cache[tk]);
}
