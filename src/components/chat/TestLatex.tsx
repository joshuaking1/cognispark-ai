// src/components/chat/TestLatex.tsx
"use client";

import MarkdownContent from "./MarkdownContent";

export default function TestLatex() {
  const testContent = `# Markdown and LaTeX Rendering Test

## Text Formatting

This text includes **bold formatting**, *italic text*, and even ***bold italic text***.

## Lists

### Unordered List
- Item 1
- Item 2
  - Nested item A
  - Nested item B

### Ordered List
1. First item
2. Second item
   1. Nested item 1
   2. Nested item 2

## Code Examples

Inline code: \`const x = 5;\`

\`\`\`javascript
// Function example
function calculateSum(a, b) {
  return a + b;
}
\`\`\`

## LaTeX Examples

Here's Einstein's famous equation as a block formula:

$$E = mc^2$$

And here's an inline formula: $E = mc^2$ in the middle of text.

Here's a more complex formula:

$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$

And a matrix example:

$$\begin{pmatrix} a & b \\ c & d \end{pmatrix}$$

## Blockquotes

> This is a blockquote
> It can span multiple lines

## Tables

| Name | Value | Description |
|------|-------|--------------|
| One  | 1     | First item  |
| Two  | 2     | Second item |
| Three| 3     | Third item  |
`;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Markdown and LaTeX Test</h1>
      <div className="p-6 border rounded-lg bg-card">
        <MarkdownContent content={testContent} />
      </div>
    </div>
  );
}
