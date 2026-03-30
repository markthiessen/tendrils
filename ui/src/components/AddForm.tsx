import { useState } from "react";

interface Props {
  placeholder: string;
  onAdd: (title: string) => void;
}

export function AddForm({ placeholder, onAdd }: Props) {
  const [title, setTitle] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="add-button" onClick={() => setOpen(true)}>
        + {placeholder}
      </button>
    );
  }

  return (
    <form
      className="add-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) {
          onAdd(title.trim());
          setTitle("");
          setOpen(false);
        }
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setTitle("");
          }
        }}
        onBlur={() => {
          if (!title.trim()) setOpen(false);
        }}
      />
      <button type="submit">Add</button>
    </form>
  );
}
