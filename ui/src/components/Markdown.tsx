import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

// Configure marked: open links in new tab
const renderer = new marked.Renderer();
const originalLink = renderer.link.bind(renderer);
renderer.link = function (args) {
  const html = originalLink(args);
  return html.replace("<a ", '<a target="_blank" rel="noopener noreferrer" ');
};

marked.setOptions({
  renderer,
  gfm: true,
  breaks: true,
});

interface Props {
  text: string;
  className?: string;
}

export function Markdown({ text, className }: Props) {
  const html = useMemo(() => {
    const raw = marked.parse(text) as string;
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ["target", "rel"],
    });
  }, [text]);

  return (
    <div
      className={`markdown-content ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
