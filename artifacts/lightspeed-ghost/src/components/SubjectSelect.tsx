import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ALL_SUBJECTS } from "@/lib/subjects";
import { ChevronDown, X, Search } from "lucide-react";

interface SubjectSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  required?: boolean;
}

export function SubjectSelect({
  value,
  onChange,
  placeholder = "Search or type a subject…",
  className,
  label,
  required,
}: SubjectSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? ALL_SUBJECTS.filter(s => s.toLowerCase().includes(search.toLowerCase()))
    : ALL_SUBJECTS;

  const exactMatch = ALL_SUBJECTS.some(s => s.toLowerCase() === search.toLowerCase());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (search.trim() && !value) {
          onChange(search.trim());
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [search, value, onChange]);

  function handleSelect(subject: string) {
    onChange(subject);
    setSearch("");
    setOpen(false);
  }

  function handleInputChange(val: string) {
    setSearch(val);
    if (!open) setOpen(true);
  }

  function handleClear() {
    onChange("");
    setSearch("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0 && search.trim()) {
        handleSelect(filtered[0]);
      } else if (search.trim()) {
        onChange(search.trim());
        setSearch("");
        setOpen(false);
      }
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {label && (
        <label className="text-sm font-medium mb-1.5 block">
          {label} {required && "*"}
        </label>
      )}
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input bg-background text-sm transition-colors",
          open && "ring-2 ring-ring"
        )}
      >
        <Search size={14} className="text-muted-foreground shrink-0" />
        {value && !open ? (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setSearch(value);
              onChange("");
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="flex-1 text-left truncate"
          >
            {value}
          </button>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={open ? search : value}
            onChange={e => handleInputChange(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none min-w-0"
          />
        )}
        {value ? (
          <button type="button" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
          {filtered.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => handleSelect(s)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors",
                s === value && "bg-primary/10 text-primary font-medium"
              )}
            >
              {s}
            </button>
          ))}
          {search.trim() && !exactMatch && (
            <button
              type="button"
              onClick={() => handleSelect(search.trim())}
              className="w-full text-left px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors border-t border-border"
            >
              Use "{search.trim()}" as custom subject
            </button>
          )}
          {filtered.length === 0 && !search.trim() && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No subjects found</div>
          )}
        </div>
      )}
    </div>
  );
}
