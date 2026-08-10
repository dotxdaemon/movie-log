// ABOUTME: Renders the shared viewing form used by logging and dossier editing.
// ABOUTME: Reads ratings, reviews, cast notes, tags, formats, locations, and flags into persisted entry details.
import type { FormEvent } from 'react';
import {
  futureViewingDateError,
  readEntryDetails,
  readEntryValidationError,
  readLocalDateValue,
  reviewCharacterLimit
} from './entry-details.js';
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
  validationId: string;
}

export function EntryForm({
  defaults,
  footer = false,
  onReviewChange,
  onSubmit,
  review,
  showDate = false,
  submitDisabled = false,
  submitLabel,
  validationId
}: EntryFormProps) {
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const details = readEntryDetails(event.currentTarget);
    const error = readEntryValidationError(details);
    const dateInput = event.currentTarget.elements.namedItem('watchedAt');
    const validation = event.currentTarget.querySelector('.entry-form-validation');

    if (error) {
      if (dateInput instanceof HTMLInputElement) {
        dateInput.setAttribute('aria-errormessage', validationId);
        dateInput.setAttribute('aria-invalid', 'true');
        dateInput.focus();
      }
      validation?.removeAttribute('hidden');
      return;
    }

    if (dateInput instanceof HTMLInputElement) {
      dateInput.removeAttribute('aria-errormessage');
      dateInput.removeAttribute('aria-invalid');
    }
    validation?.setAttribute('hidden', '');
    onSubmit(details);
  }

  function clearValidation(event: FormEvent<HTMLFormElement>): void {
    const dateInput = event.currentTarget.elements.namedItem('watchedAt');
    if (dateInput instanceof HTMLInputElement) {
      dateInput.removeAttribute('aria-errormessage');
      dateInput.removeAttribute('aria-invalid');
    }
    event.currentTarget.querySelector('.entry-form-validation')?.setAttribute('hidden', '');
  }

  const controlledReview = review !== undefined;
  const submitAction = (
    <button className="command-block command-block-primary" disabled={submitDisabled} type="submit">
      {submitLabel}
    </button>
  );

  return (
    <form className="entry-form" noValidate onChange={clearValidation} onSubmit={submit}>
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
      <div className="entry-form-validation" hidden id={validationId} role="alert">
        <strong>Check the viewing date</strong>
        <span>{futureViewingDateError}</span>
      </div>
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
