"use client";

import type { KeyboardEvent } from "react";

import styles from "./css/filter-chips.module.css";

export type FilterChipOption = { id: string; label: string };

type FilterChipsProps = {
  label: string;
  options: readonly FilterChipOption[];
  selected: string;
  onSelect: (id: string) => void;
};

// Arrow keys wrap around; Home and End jump to the ends.
const CHIP_TARGETS: Record<string, (index: number, count: number) => number> =
  {
    ArrowRight: (index, count) => (index + 1) % count,
    ArrowLeft: (index, count) => (index - 1 + count) % count,
    Home: () => 0,
    End: (_, count) => count - 1,
  };

/** Cut-corner tabs that select as focus moves, so only the active chip is tabbable. */
export function FilterChips({
  label,
  options,
  selected,
  onSelect,
}: FilterChipsProps) {
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = CHIP_TARGETS[event.key];
    if (!target) return;
    const next = target(index, options.length);
    event.preventDefault();
    onSelect(options[next].id);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex shrink-0 gap-1 overflow-x-auto ${styles.list}`}
    >
      {options.map((option, index) => {
        const active = option.id === selected;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-active={active || undefined}
            onClick={() => onSelect(option.id)}
            onKeyDown={(event) => move(event, index)}
            className={`relative isolate min-h-touch flex-none whitespace-nowrap ${styles.chip}`}
          >
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
