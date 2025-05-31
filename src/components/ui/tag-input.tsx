import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Tag {
  id: string;
  text: string;
}

interface TagInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  tags: Tag[];
  setTags: (tags: Tag[]) => void;
  maxTags?: number;
  placeholder?: string;
  className?: string;
}

export function TagInput({
  tags,
  setTags,
  maxTags,
  placeholder = "Add tags...",
  className,
  disabled,
  ...props
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      if (maxTags && tags.length >= maxTags) {
        return;
      }
      const newTag: Tag = {
        id: Math.random().toString(36).substr(2, 9),
        text: inputValue.trim(),
      };
      setTags([...tags, newTag]);
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (tagId: string) => {
    setTags(tags.filter((tag) => tag.id !== tagId));
  };

  return (
    <div className={cn("flex flex-wrap gap-2 p-2 border rounded-md bg-white dark:bg-gray-950", className)}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground rounded-md"
        >
          {tag.text}
          <button
            type="button"
            onClick={() => removeTag(tag.id)}
            className="text-primary/50 hover:text-primary dark:text-primary-foreground/50 dark:hover:text-primary-foreground"
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        disabled={disabled || (maxTags !== undefined && tags.length >= maxTags)}
        {...props}
      />
    </div>
  );
} 