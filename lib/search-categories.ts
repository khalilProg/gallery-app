import { ANIMALS, CLOTHING, FOOD, LABELS, LANDSCAPES } from "./labels.ts";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function labelSet(labels: string[]) {
  return new Set(labels.map(normalize));
}

const dairy = ["milk", "cheese", "yogurt", "butter", "cream", "kefir", "mozzarella", "cheddar", "feta", "parmesan"];
const grains = ["rice", "steamed rice", "fried rice", "rice grain", "oats", "wheat", "corn", "quinoa", "barley",
  "risotto", "pilaf", "biryani", "paella", "onigiri", "couscous"];
const fruit = ["fruit", "apple", "banana", "orange", "strawberry", "grapes", "watermelon", "mango",
  "pineapple", "avocado", "pear", "peach", "blueberry", "raspberry"];
const desserts = ["dessert", "cake", "cupcake", "cheesecake", "pie", "tart", "ice cream", "gelato",
  "sorbet", "cookie", "brownie", "macaron", "donut", "chocolate", "candy"];
const coats = ["coat", "overcoat", "trench coat", "winter coat", "puffer coat", "wool coat",
  "parka", "fur coat", "raincoat", "jacket", "leather jacket", "denim jacket", "bomber jacket"];
const skirts = ["skirt", "mini skirt", "pleated skirt", "pencil skirt", "midi skirt", "maxi skirt", "denim skirt"];
const footwear = ["shoes", "sneakers", "boots", "ankle boots", "heels", "high heels", "sandals",
  "loafers", "oxford shoes", "running shoes", "winter boots"];
const winterwear = [...coats, "sweater", "scarf", "beanie", "mittens", "gloves", "winter boots"];
const winterScenes = ["winter", "snow", "ice", "frost", "snowy landscape", "skiing", "glacier"];
const nature = [...ANIMALS, ...LANDSCAPES, ...winterScenes, "rice", "flower", "rose", "sunflower", "tulip",
  "orchid", "tree", "palm tree", "pine tree", "oak tree"];

const foodLabels = [...FOOD, ...dairy, ...grains, ...fruit];
const clothingLabels = [...CLOTHING, ...footwear];
const foodAnchor = "a photo of a meal or edible ingredients";
const clothingAnchor = "a photo of garments or footwear";
const animalAnchor = "a photo of wildlife or a pet animal";
const landscapeAnchor = "a photo of a natural landscape";
const neutralAnchors = ["a photo of an unrelated object", "a photo with an indistinct subject"];

function family(
  aliases: string[], labels: string[], prompts: string[], rivalLabels: string[], rivals: string[], broad = false,
) {
  const accepted = labelSet(labels);
  return {
    aliases, labels: accepted, prompts,
    rivalLabels: labelSet(rivalLabels.filter((label) => !accepted.has(normalize(label)))),
    rivals, broad,
  };
}

const families = [
  family(["food", "something to eat", "things to eat", "edible", "meal"], foodLabels,
    [foodAnchor, "a close-up photo of prepared food"], [...ANIMALS, ...clothingLabels, ...LANDSCAPES],
    [animalAnchor, clothingAnchor, landscapeAnchor], true),
  family(["clothes", "clothing", "garment", "apparel", "fashion", "outfit"], clothingLabels,
    [clothingAnchor, "a photo of clothes worn by a person", "a product photo of a garment laid flat"],
    [...ANIMALS, ...foodLabels, ...LANDSCAPES], [animalAnchor, foodAnchor, landscapeAnchor], true),
  family(["nature", "natural world", "the natural world"], nature,
    [animalAnchor, landscapeAnchor, "a close-up photo of plants or rice grains"],
    [...clothingLabels, ...foodLabels], [clothingAnchor, foodAnchor], true),
  family(["animal", "wildlife"], ANIMALS, [animalAnchor, "a close-up photo of an animal"],
    [...clothingLabels, ...foodLabels], [clothingAnchor, foodAnchor], true),
  family(["dairy", "dairy product", "milk", "cheese", "yogurt"], dairy,
    ["a photo of dairy products such as milk, cheese, or yogurt", "a close-up photo of a piece of cheese",
      "a photo of a glass of milk or a bowl of yogurt"],
    [...foodLabels, ...ANIMALS, ...clothingLabels],
    ["a photo of a bowl of rice or grains", "a photo of pasta, bread, or a cooked meal", animalAnchor, clothingAnchor]),
  family(["grain", "cereal"], grains, ["a photo of edible grains", "a close-up photo of rice or oats"],
    foodLabels, ["a photo of fruit or vegetables", "a photo of cheese or milk"]),
  family(["fruit"], fruit, ["a photo of fresh fruit", "a close-up photo of fruit"],
    foodLabels, ["a photo of vegetables", "a photo of a prepared meal"]),
  family(["dessert", "sweets"], desserts, ["a photo of a sweet dessert", "a close-up photo of cake or ice cream"],
    foodLabels, ["a photo of a savory dish", "a photo of meat or vegetables"]),
  family(["outerwear", "coat", "winter coat", "jacket"], coats,
    ["a photo of a coat or jacket", "a product photo of a long wool coat or parka"],
    [...clothingLabels, ...ANIMALS, ...foodLabels], ["a photo of a skirt or dress", animalAnchor, foodAnchor]),
  family(["skirt"], skirts, ["a photo of a skirt", "a product photo of a pleated or denim skirt"],
    [...clothingLabels, ...ANIMALS], ["a photo of a coat or jacket", "a photo of trousers or shorts", animalAnchor]),
  family(["footwear", "shoe"], footwear, ["a photo of shoes or boots", "a product photo of footwear"],
    [...clothingLabels, ...ANIMALS], ["a photo of a shirt or coat", animalAnchor]),
  family(["winter", "cold weather"], [...winterwear, ...winterScenes],
    ["a photo of a winter coat or cold-weather clothing", "a photo of a snowy winter scene"],
    [...clothingLabels, ...foodLabels, ...ANIMALS], ["a photo of summer clothes", foodAnchor, animalAnchor]),
  family(["winter clothes", "winter clothing", "winter wear"], winterwear,
    ["a photo of warm winter clothing such as a coat, scarf, or gloves", "a product photo of a winter coat"],
    [...clothingLabels, ...foodLabels, ...ANIMALS], ["a photo of summer clothes", foodAnchor, animalAnchor]),
];

const aliases = new Map(families.flatMap((entry) => entry.aliases.map((alias) => [alias, entry] as const)));
const vocabulary = labelSet([...LABELS, ...families.flatMap(({ labels }) => [...labels])]);

// Only accept a singular form when it exists in the vocabulary or alias table.
function knownTerm(text: string) {
  const candidates = [text];
  if (text.endsWith("ies")) candidates.push(text.slice(0, -3) + "y");
  if (text.endsWith("es")) candidates.push(text.slice(0, -2));
  if (text.endsWith("s")) candidates.push(text.slice(0, -1));
  return candidates.find((candidate) => aliases.has(candidate)) ??
    candidates.find((candidate) => vocabulary.has(candidate));
}

function closestFamily(term: string) {
  return families.reduce<(typeof families)[number] | undefined>((closest, entry) =>
    entry.labels.has(term) && (!closest || entry.labels.size < closest.labels.size) ? entry : closest, undefined);
}

export function planSearch(query: string) {
  const phrase = normalize(query).replace(/^(?:show me |find |search for )?(?:photos? of |images? of |pictures? of )?(?:an? |the )?/, "");
  const exact = knownTerm(phrase);
  if (exact) {
    const group = aliases.get(exact);
    const domain = group ?? closestFamily(exact);
    return {
      direct: labelSet([exact]),
      related: group?.labels ?? labelSet([]),
      rivals: domain?.rivalLabels ?? labelSet([]),
      positivePrompts: group?.prompts ?? [`a photo of ${exact}`, `a close-up photo showing ${exact}`],
      negativePrompts: domain ? [...domain.rivals, ...(!group ? domain.prompts : [])] : neutralAnchors,
      known: true,
      contextual: false,
      broad: group?.broad ?? false,
    };
  }

  const words = phrase.split(" ");
  let context: ReturnType<typeof knownTerm>;
  for (let size = Math.min(4, words.length - 1); size >= 1 && !context; size--) {
    for (let start = words.length - size; start >= 0 && !context; start--) {
      context = knownTerm(words.slice(start, start + size).join(" "));
    }
  }
  const group = context ? aliases.get(context) : undefined;
  const domain = group ?? (context ? closestFamily(context) : undefined);
  return {
    direct: labelSet([phrase]),
    related: group?.labels ?? labelSet(context ? [context] : []),
    rivals: domain?.rivalLabels ?? labelSet([]),
    positivePrompts: [`a photo of ${query}`, `a photograph showing ${query}`],
    negativePrompts: domain?.rivals ?? neutralAnchors,
    known: false,
    contextual: Boolean(context),
    broad: false,
  };
}

export type SearchPlan = ReturnType<typeof planSearch>;

export function searchTagEvidence(plan: SearchPlan, tags: unknown) {
  const ordered = Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
  const normalized = ordered.map((tag) => {
    const text = normalize(tag);
    return { text, canonical: knownTerm(text) ?? text };
  });
  const rank = (terms: Set<string>) => normalized.findIndex(({ text, canonical }) =>
    terms.has(text) || terms.has(canonical));
  const direct = rank(plan.direct);
  const related = rank(plan.related);
  const rival = rank(plan.rivals);
  const first = Math.min(direct < 0 ? Infinity : direct, related < 0 ? Infinity : related);

  if (rival >= 0 && rival < first) return "rival";
  if (direct >= 0) return "direct";
  if (related >= 0) return "related";
  return "none";
}

const tagFamilies = new Set(["dairy", "grain", "fruit", "dessert", "outerwear", "skirt", "footwear"]);

export function tagFamily(label: string) {
  const term = normalize(label);
  return families.find(({ aliases, labels }) => tagFamilies.has(aliases[0]) && labels.has(term))?.aliases[0];
}
