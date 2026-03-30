import { useState, useRef, useEffect } from "react";

interface Props {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  tag?: "span" | "div" | "h3";
  placeholder?: string;
}

export function EditableText({
  value,
  onSave,
  className,
  tag: Tag = "span",
  placeholder = "Click to edit",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`editable-input ${className ?? ""}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() && draft !== value) onSave(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            if (draft.trim() && draft !== value) onSave(draft.trim());
          }
          if (e.key === "Escape") {
            setEditing(false);
            setDraft(value);
          }
        }}
      />
    );
  }

  return (
    <Tag
      className={`editable-text ${className ?? ""}`}
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {value || <span className="placeholder">{placeholder}</span>}
    </Tag>
  );
}
