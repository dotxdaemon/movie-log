// ABOUTME: Renders the shared diary annotation form used by logging, dossier, and inline diary editing.
// ABOUTME: Reads ratings, reviews, cast notes, tags, formats, locations, and flags into persisted entry details.
import type { FormEvent } from 'react';
import { readEntryDetails, readLocalDateValue, reviewCharacterLimit } from './entry-details.js';
import { RatingInput } from './rating.js';
import type { LogEntryDetails } from '../../shared/types.js';

interface EntryFormProps {
  defaults: LogEntryDetails;
  footer?: boolean;
  onReviewChange?: (value: string) => void;
  onSubmit(details: LogEntryDetails): void;
  review?: string;
  showDate?: boolean;
  submitDisabled?: boolean;
  submitLabel: string;
}

export function EntryForm({
  defaults,
  footer = false,
  onReviewChange,
  onSubmit,
  review,
  showDate = false,
  submitDisabled = false,
  submitLabel
}: EntryFormProps) {
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit(readEntryDetails(event.currentTarget));
  }

  const controlledReview = review !== undefined;
  const submitAction = (
    <button className="command-block command-block-primary" disabled={submitDisabled} type="submit">
      {submitLabel}
    </button>
  );

  return (
    <form className="entry-form" onSubmit={submit}>
      {showDate ? (
        <label className="field-block field-block-date">
          <span>Viewing date</span>
          <input
            defaultValue={readLocalDateValue(defaults.watchedAt ? new Date(defaults.watchedAt) : new Date())}
            name="watchedAt"
            type="date"
          />
        </label>
      ) : null}
      <RatingInput name="rating" value={defaults.rating ?? null} />
      <label className="field-block">
        <span className="field-label-row">
          <span>Review</span>
          {controlledReview ? (
            <span aria-hidden="true" className="field-count">{`${review.length} / ${reviewCharacterLimit}`}</span>
          ) : null}
        </span>
        {controlledReview ? (
          <textarea
            maxLength={reviewCharacterLimit}
            name="review"
            onChange={(event) => onReviewChange?.(event.target.value)}
            rows={5}
            value={review}
          />
        ) : (
          <textarea defaultValue={defaults.review ?? ''} maxLength={reviewCharacterLimit} name="review" rows={5} />
        )}
      </label>
      <label className="field-block">
        <span>Cast notes</span>
        <textarea
          defaultValue={defaults.castNotes ?? ''}
          name="castNotes"
          placeholder="Performances, chemistry, or casting observations"
          rows={3}
        />
      </label>
      <div className="field-pair">
        <label className="field-block">
          <span>Tags</span>
          <input defaultValue={(defaults.tags ?? []).join(', ')} name="tags" placeholder="Drama, Noir" />
        </label>
        <label className="field-block">
          <span>Viewing format</span>
          <input defaultValue={defaults.viewingFormat ?? ''} name="viewingFormat" placeholder="Cinema, Digital, 35mm" />
        </label>
      </div>
      <label className="field-block">
        <span>Location</span>
        <input defaultValue={defaults.location ?? ''} name="location" placeholder="Home, Metrograph, Flight" />
      </label>
      <div className="check-row">
        <label className="check-block">
          <input defaultChecked={defaults.favorite} name="favorite" type="checkbox" /> Favorite
        </label>
        <label className="check-block">
          <input defaultChecked={defaults.rewatch} name="rewatch" type="checkbox" /> Rewatch
        </label>
      </div>
      {footer ? <div className="entry-form-footer">{submitAction}</div> : submitAction}
    </form>
  );
}
