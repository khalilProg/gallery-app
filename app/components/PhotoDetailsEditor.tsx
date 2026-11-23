"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/lib/image-response";
import { cleanTag, MAX_DESCRIPTION_LENGTH, MAX_MANUAL_TAGS, MAX_TAG_LENGTH, tagKey } from "@/lib/photo-metadata";

const inputClass = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-2 focus-visible:outline-indigo-400";
const chipClass = "inline-flex min-h-8 items-center gap-2 rounded-lg border px-2.5 py-1 text-sm [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-indigo-400";

export default function PhotoDetailsEditor({
  image,
  onSaved,
  onClose,
}: {
  image: GalleryImage;
  onSaved: (image: GalleryImage) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [description, setDescription] = useState(image.description ?? "");
  const [manualTags, setManualTags] = useState(image.manualTags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [removed, setRemoved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function tagsWithInput() {
    const tag = cleanTag(tagInput);
    if (!tag || manualTags.some((current) => tagKey(current) === tagKey(tag))) return manualTags;
    if (manualTags.length >= MAX_MANUAL_TAGS) {
      setError(`You can add up to ${MAX_MANUAL_TAGS} manual tags.`);
      return null;
    }
    return [...manualTags, tag];
  }

  function addTag() {
    setError(null);
    const tags = tagsWithInput();
    if (!tags) return;
    setManualTags(tags);
    setTagInput("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const tags = tagsWithInput();
    if (!tags) return;

    const changes = {
      description: description.trim() === (image.description ?? "") ? undefined : description,
      manualTags: JSON.stringify(tags) === JSON.stringify(image.manualTags ?? []) ? undefined : tags,
      removeAiTags: removed.length ? removed : undefined,
    };
    if (Object.values(changes).every((value) => value === undefined)) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/images/${image._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result) throw new Error(result?.error ?? "Could not save photo details. Try again.");
      onSaved(result);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save photo details. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="photo-details-title"
      aria-describedby="photo-details-filename"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      className="m-auto max-h-[calc(100dvh_-_2rem)] w-[min(30rem,calc(100dvw_-_2rem))] overflow-auto rounded-2xl border border-white/10 bg-zinc-900 text-zinc-100 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={save} className="space-y-5 p-4 sm:p-6">
        <div>
          <h2 id="photo-details-title" className="text-lg font-semibold">Edit photo details</h2>
          <p id="photo-details-filename" className="mt-1 truncate text-sm text-zinc-400">{image.filename ?? "Untitled photo"}</p>
        </div>

        <fieldset disabled={saving} className="min-w-0 space-y-5">
          <div>
            <label htmlFor="photo-description" className="mb-2 block text-sm font-medium">Description</label>
            <textarea
              id="photo-description"
              rows={3}
              maxLength={MAX_DESCRIPTION_LENGTH}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="manual-photo-tag" className="mb-2 block text-sm font-medium">Manual tags</label>
            <div className="flex gap-2">
              <input
                id="manual-photo-tag"
                value={tagInput}
                maxLength={MAX_TAG_LENGTH}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    addTag();
                  }
                }}
                className={`${inputClass} min-w-0`}
              />
              <button type="button" onClick={addTag} disabled={!cleanTag(tagInput)} className="button-secondary">Add</button>
            </div>
            {manualTags.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {manualTags.map((tag) => (
                  <li key={tag} className="max-w-full">
                    <button
                      type="button"
                      aria-label={`Remove manual tag ${tag}`}
                      onClick={() => setManualTags((tags) => tags.filter((item) => item !== tag))}
                      className={`${chipClass} border-indigo-400/35 bg-indigo-400/10 text-indigo-100 hover:bg-indigo-400/20`}
                    >
                      <span>{tag}</span><span aria-hidden="true">×</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {Boolean(image.aiTags?.length || removed.length) && (
            <div>
              <h3 className="text-sm font-medium">AI tags</h3>
              <p className="mb-2 mt-1 text-xs text-zinc-400">Select an incorrect tag to remove it.</p>
              <ul className="flex flex-wrap gap-2">
                {[...new Set([...(image.aiTags ?? []), ...removed])].map((tag) => {
                  const marked = removed.includes(tag);
                  return (
                    <li key={tag} className="max-w-full">
                      <button
                        type="button"
                        aria-label={`Remove AI tag ${tag}`}
                        aria-pressed={marked}
                        onClick={() => setRemoved((tags) =>
                          marked ? tags.filter((item) => item !== tag) : [...tags, tag])}
                        className={`${chipClass} border-zinc-700 hover:bg-zinc-800 ${marked ? "text-zinc-400" : "text-zinc-200"}`}
                      >
                        <span className={marked ? "line-through" : undefined}>{tag}</span>
                        <span aria-hidden="true">{marked ? "↶" : "×"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </fieldset>

        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
          <button type="button" onClick={onClose} disabled={saving} className="button-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="button-primary">{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </dialog>
  );
}
