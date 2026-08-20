"use client";

import { Search } from "lucide-react";
import React, { type ChangeEvent } from "react";

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function SearchField({
  value,
  onChange,
  placeholder = "Найти товар или категорию",
  label = "Поиск"
}: SearchFieldProps) {
  return (
    <div className="ds-search-field">
      <Search aria-hidden="true" className="ds-search-field__icon" size={18} />
      <input
        aria-label={label}
        className="ds-search-field__input"
        placeholder={placeholder}
        type="search"
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </div>
  );
}
