"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CloseIcon } from "@/src/lib/icons/close.icon";
import { SearchIcon } from "@/src/lib/icons/search.icon";

import styles from "./css/search-field.module.css";

type SearchFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
};

/**
 * Rests as a 44px search button and widens to fill its slot when opened. It
 * stays open while it has text; Escape clears and collapses it.
 */
export function SearchField({
  label,
  placeholder,
  value,
  onChange,
  onClear,
}: SearchFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const open = expanded || value.length > 0;

  useEffect(() => {
    if (expanded) input.current?.focus();
  }, [expanded]);

  const close = () => {
    onClear();
    setExpanded(false);
    trigger.current?.focus();
  };

  return (
    <div
      className={`flex flex-none items-center overflow-hidden ${styles.root} ${open ? styles.expanded : ""}`}
      onBlur={(event) => {
        const next = event.relatedTarget;
        const inside = next instanceof Node && event.currentTarget.contains(next);
        if (!inside && !value) setExpanded(false);
      }}
      onKeyDown={(event) => {
        // Handled here first, so the page's own Escape (closing it) doesn't run.
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={`grid size-touch flex-none place-items-center ${styles.trigger}`}
        aria-label={open ? "Close search" : label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setExpanded(true))}
      >
        <SearchIcon size={20} />
      </button>
      <div id={panelId} className="min-w-0 flex-1" hidden={!open}>
        <div className={`flex items-center ${styles.field}`}>
          <input
            ref={input}
            type="search"
            aria-label={label}
            placeholder={placeholder}
            enterKeyHint="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={`h-full min-w-0 flex-1 ${styles.input}`}
          />
          {value ? (
            <button
              type="button"
              className={`grid size-touch flex-none place-items-center ${styles.clear}`}
              aria-label="Clear search"
              onClick={onClear}
            >
              <CloseIcon size={18} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
