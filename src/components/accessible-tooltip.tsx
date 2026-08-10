// ABOUTME: Shows concise help on hover or keyboard focus and associates it with its trigger.
// ABOUTME: Replaces mouse-only native title attributes on truncated paths and utility controls.
import { cloneElement, type HTMLAttributes, type ReactElement } from 'react';

interface AccessibleTooltipProps {
  children: ReactElement<HTMLAttributes<HTMLElement>>;
  className?: string;
  id: string;
  text: string;
}

export function AccessibleTooltip({ children, className = '', id, text }: AccessibleTooltipProps) {
  const describedBy = [children.props['aria-describedby'], id].filter(Boolean).join(' ');
  const childClassName = [children.props.className, 'accessible-tooltip-target'].filter(Boolean).join(' ');

  return (
    <span className={['accessible-tooltip', className].filter(Boolean).join(' ')}>
      {cloneElement(children, {
        'aria-describedby': describedBy,
        className: childClassName
      })}
      <span className="accessible-tooltip-bubble" id={id} role="tooltip">
        {text}
      </span>
    </span>
  );
}
