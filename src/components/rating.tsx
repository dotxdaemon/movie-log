// ABOUTME: Renders the geometric segmented rating meter and the tactile half-step rating input.
// ABOUTME: Keeps ratings readable without color alone by pairing marks with monospaced numerals.
import type { ReactNode } from 'react';

const ratingSteps = Array.from({ length: 10 }, (_item, index) => (index + 1) / 2);

export function RatingMeter({ rating, compact = false }: { compact?: boolean; rating: number }) {
  return (
    <span aria-label={`Rated ${rating.toFixed(1)} out of 5`} className={compact ? 'rating-meter rating-meter-compact' : 'rating-meter'} role="img">
      <span aria-hidden="true" className="rating-meter-cells">
        {Array.from({ length: 5 }, (_item, index) => {
          const fill = Math.max(0, Math.min(1, rating - index));
          return <i className={fill === 1 ? 'rating-cell rating-cell-full' : fill > 0 ? 'rating-cell rating-cell-half' : 'rating-cell'} key={index} />;
        })}
      </span>
      <span aria-hidden="true" className="rating-meter-value">{rating.toFixed(1)}</span>
    </span>
  );
}

interface RatingInputProps {
  legend?: ReactNode;
  name: string;
  value: number | null;
}

export function RatingInput({ legend = 'Rating', name, value }: RatingInputProps) {
  return (
    <fieldset className="rating-control">
      <legend>{legend}</legend>
      <div className="rating-input">
        <div className="rating-segments">
          {ratingSteps.map((step) => (
            <label className="rating-segment" key={step}>
              <input defaultChecked={value === step} name={name} type="radio" value={step} />
              <span className="rating-segment-mark" />
              <span className="rating-segment-readout">{step.toFixed(1)}</span>
              <span className="visually-hidden">{`${step} out of 5`}</span>
            </label>
          ))}
        </div>
        <label className="rating-none">
          <input defaultChecked={value === null} name={name} type="radio" value="" />
          <span>None</span>
        </label>
        <output aria-live="polite" className="rating-current-value">
          <span className="rating-current-none">Current —</span>
          {ratingSteps.map((step) => (
            <span className="rating-current-option" data-rating={step.toFixed(1)} key={step}>
              {`Current ${step.toFixed(1)}`}
            </span>
          ))}
        </output>
      </div>
    </fieldset>
  );
}
