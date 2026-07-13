// ABOUTME: Reads diary entry details out of a submitted annotation form.
// ABOUTME: Keeps rating, review, tag, format, location, and date parsing shared across every form.
import type { LogEntryDetails } from '../../shared/types.js';

export const reviewCharacterLimit = 2000;

export function readEntryDetails(form: HTMLFormElement): LogEntryDetails {
  const values = new FormData(form);
  const ratingValue = values.get('rating');
  const tags = String(values.get('tags') ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const date = String(values.get('watchedAt') ?? '');

  return {
    favorite: values.get('favorite') === 'on',
    location: String(values.get('location') ?? '').trim(),
    rating: ratingValue ? Number(ratingValue) : null,
    review: String(values.get('review') ?? '').trim(),
    rewatch: values.get('rewatch') === 'on',
    tags,
    viewingFormat: String(values.get('viewingFormat') ?? '').trim(),
    watchedAt: date ? new Date(`${date}T12:00:00`).toISOString() : undefined
  };
}
