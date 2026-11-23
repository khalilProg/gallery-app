import { ANIMALS, CLOTHING, FOOD, LANDSCAPES } from "./labels.ts";
import { tagFamily } from "./search-categories.ts";

type LabelScore = { label: string; score: number };
const MIN_VISUAL_SCORE = 0.245;
const VISUAL_MARGIN = 0.055;
const MAX_VISUAL_TAGS = 4;
const MAX_TAGS = 9;

const domains = [
  { label: "animal", members: new Set(ANIMALS) },
  { label: "clothing", members: new Set(CLOTHING) },
  { label: "food", members: new Set(FOOD) },
  { label: "nature", members: new Set([...LANDSCAPES,
    "flower", "rose", "sunflower", "tulip", "orchid", "tree", "palm tree", "pine tree", "oak tree",
  ]) },
];

const subjects = [
  { label: "panda", parent: "bear", members: ["panda", "giant panda"] },
  { label: "tiger", parent: "big cat", members: ["tiger", "white tiger", "Bengal tiger"] },
  { label: "lion", parent: "big cat", members: ["lion", "lioness"] },
  { label: "big cat", members: ["leopard", "cheetah", "jaguar", "puma", "lynx", "cougar"] },
  { label: "bear", members: ["polar bear", "brown bear", "grizzly bear", "black bear"] },
  { label: "dog", parent: "pet", members: ["dog", "puppy", "golden retriever", "German shepherd"] },
  { label: "cat", parent: "pet", members: ["cat", "kitten", "tabby cat"] },
  { label: "pasta", members: ["pasta", "spaghetti", "lasagna", "gnocchi", "ravioli", "penne", "fettuccine"] },
  { label: "rice", members: ["rice", "steamed rice", "fried rice", "risotto", "pilaf", "biryani", "paella", "onigiri"] },
  { label: "cheese", members: ["cheese", "mozzarella", "cheddar", "feta", "parmesan"] },
  { label: "outerwear", members: ["coat", "overcoat", "trench coat", "winter coat", "puffer coat", "wool coat",
    "parka", "fur coat", "raincoat", "jacket", "leather jacket", "denim jacket", "bomber jacket"] },
  { label: "skirt", members: ["skirt", "mini skirt", "pleated skirt", "pencil skirt", "midi skirt",
    "maxi skirt", "denim skirt"] },
  { label: "dress", members: ["dress", "evening gown", "cocktail dress", "sundress", "maxi dress"] },
  { label: "shirt", members: ["shirt", "t-shirt", "blouse", "polo shirt", "button-up shirt"] },
  { label: "sweater", members: ["sweater", "pullover", "cardigan", "hoodie", "sweatshirt"] },
  { label: "footwear", members: ["shoes", "sneakers", "boots", "ankle boots", "heels", "high heels",
    "sandals", "loafers", "oxford shoes", "running shoes", "winter boots"] },
  { label: "forest", members: ["forest", "rainforest", "jungle", "woodland"] },
  { label: "mountain", members: ["mountain", "mountain range", "mountain peak"] },
];

const subjectByLabel = new Map(subjects.flatMap((subject) =>
  subject.members.map((member) => [member, subject] as const)));

const relatedParents = [
  ["bird", ["penguin", "eagle", "hawk", "falcon", "owl", "parrot", "macaw", "flamingo",
    "toucan", "peacock", "swan", "pelican", "seagull", "crow", "pigeon"]],
  ["reptile", ["snake", "python", "cobra", "crocodile", "alligator", "lizard", "iguana",
    "gecko", "turtle", "tortoise"]],
  ["wildlife", ["panda", "giant panda", "red panda", "tiger", "white tiger", "Bengal tiger",
    "lion", "lioness", "giraffe", "elephant", "zebra", "leopard", "cheetah", "jaguar"]],
  ["flower", ["rose", "sunflower", "tulip", "orchid"]],
  ["tree", ["palm tree", "pine tree", "oak tree"]],
  ["vegetable", ["broccoli", "carrot", "corn", "pepper", "potato"]],
  ["baked goods", ["bread", "baguette", "croissant", "bagel", "pita", "pastry"]],
  ["vehicle", ["car", "truck", "motorcycle", "bicycle", "bus", "train", "airplane", "boat"]],
  ["electronics", ["computer", "laptop", "phone", "smartphone", "tablet", "camera", "television",
    "speaker", "headphones"]],
  ["architecture", ["building", "skyscraper", "tower", "house", "villa", "bridge", "mosque",
    "church", "cathedral", "temple", "palace", "castle", "fortress"]],
] as const;

const parentByLabel = new Map<string, string>(relatedParents.flatMap(([parent, members]) =>
  members.map((member) => [member, parent] as const)));

function domainOf(label: string) {
  return domains.find(({ members }) => members.has(label))?.label;
}

const generic = new Set(["animal", "wildlife", "food", "dish", "meal", "clothing", "fashion", "outfit",
  "nature", "landscape", "scenery", "environment", "person", "group", "traditional", "cultural"]);

export function selectVisualTags(scores: LabelScore[]) {
  const ranked = scores.filter(({ score }) => Number.isFinite(score) && score >= MIN_VISUAL_SCORE)
    .sort((a, b) => b.score - a.score);
  const first = ranked[0];
  if (!first) return [];

  const anchor = domainOf(first.label);
  const primary = generic.has(first.label)
    ? ranked.find(({ label, score }) => !generic.has(label) && first.score - score <= VISUAL_MARGIN &&
        (!anchor || domainOf(label) === anchor)) ?? first
    : first;
  const primaryDomain = domainOf(primary.label);
  const selected = [primary.label];
  const occupied = new Set([subjectByLabel.get(primary.label)?.label ?? primary.label]);
  for (const { label, score } of ranked) {
    if (selected.length >= MAX_VISUAL_TAGS || score < first.score - VISUAL_MARGIN) break;
    if (generic.has(label)) continue;

    const domain = domainOf(label);
    const subject = subjectByLabel.get(label)?.label ?? label;
    if (occupied.has(subject) || selected.some((tag) =>
      tag.endsWith(` ${label}`) || label.endsWith(` ${tag}`))) continue;

    if (primaryDomain && domain && primaryDomain !== domain) {
      const wildlifeScene = (primaryDomain === "animal" && domain === "nature") ||
        (primaryDomain === "nature" && domain === "animal");
      if (!wildlifeScene || first.score - score > 0.035) continue;
    }
    // Weak, unclassified tags should not crowd out the main subject.
    if (domain !== primaryDomain && first.score - score > 0.035) continue;
    occupied.add(subject);
    selected.push(label);
  }
  return selected;
}

export function colorSubject(label: string) {
  if (domainOf(label) !== "clothing") return;
  const subject = subjectByLabel.get(label)?.label;
  if (subject === "outerwear") return label.endsWith("jacket") ? "jacket" : "coat";
  if (subject === "footwear") return label.endsWith("boots") ? "boot" : "shoe";
  return subject;
}

export function selectColor(scores: LabelScore[], neutralScore: number) {
  const [best, runnerUp] = [...scores].sort((a, b) => b.score - a.score);
  if (best && runnerUp && best.score >= 0.27 &&
      best.score - runnerUp.score >= 0.022 && best.score - neutralScore >= 0.012) {
    return best.label;
  }
}

export function enrichTags(visual: string[], descriptor?: string) {
  const primary = visual[0];
  if (!primary) return [];

  const subject = subjectByLabel.get(primary);
  const family = tagFamily(primary);
  const domain = domainOf(primary);
  const tags = [primary, descriptor, ...visual.slice(1), subject?.label, subject?.parent, family, parentByLabel.get(primary), domain];
  if (domain === "animal") tags.push("nature");
  return [...new Set(tags.filter((tag): tag is string => Boolean(tag)))].slice(0, MAX_TAGS);
}
