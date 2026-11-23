export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_MANUAL_TAGS = 30;
export const MAX_TAG_LENGTH = 64;

export function cleanTag(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function tagKey(value: string) {
  return cleanTag(value).toLowerCase();
}

export function uniqueTags(tags: string[]) {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = tagKey(tag);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function visibleAiTags(tags: string[] = [], removed: string[] = []) {
  const hidden = new Set(removed);
  return tags.filter((tag) => !hidden.has(tagKey(tag)));
}
