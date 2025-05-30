"use client";

import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkMath from 'remark-math';      // Parses $...$ and $$...$$
import rehypeKatex from 'rehype-katex';    // Renders math using KaTeX
import remarkGfm from 'remark-gfm';        // GitHub Flavored Markdown (tables, strikethrough, etc.)
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Or your preferred style
import { toast } from 'sonner';
import { Button } from '@/components/ui/button'; // For copy button

// Register common languages for syntax highlighting
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import java_src from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';

SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js', javascript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('py', python);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('java', java_src);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('shell', bash);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('csharp', csharp);
SyntaxHighlighter.registerLanguage('cs', csharp);

interface ChatMessageContentRendererProps {
  content: string;
}

const ChatMessageContentRenderer: React.FC<ChatMessageContentRendererProps> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code({ inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const codeString = String(children).replace(/\n$/, ''); // Remove trailing newline

          if (inline) {
            // Render inline code (e.g., `variableName`)
            return <code className="px-1 py-0.5 bg-muted rounded-sm text-sm font-mono" {...props}>{children}</code>;
          }

          if (match) {
            // Fenced code block with language
            return (
              <div className="my-3 rounded-md bg-gray-800 text-sm overflow-hidden shadow-md"> {/* Darker bg for code block */}
                <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-700 flex justify-between items-center">
                  <span>{match[1]}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-auto p-1 text-gray-400 hover:text-gray-200"
                    onClick={() => {
                      navigator.clipboard.writeText(codeString);
                      toast.success("Code copied!");
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <SyntaxHighlighter
                  style={dracula} // Your chosen style
                  language={match[1]}
                  PreTag="div" // Use div instead of pre to avoid double <pre>
                  customStyle={{ margin: 0, padding: '1rem', fontSize: '0.875rem', lineHeight: '1.5' }}
                  wrapLines={true}
                  showLineNumbers={codeString.split('\n').length > 1}
                  {...props}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          } else {
            // Code block without a specified language (fallback)
            return (
              <pre className="my-3 p-4 rounded-md bg-muted overflow-x-auto text-sm" {...props}>
                <code>{children}</code>
              </pre>
            );
          }
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default memo(ChatMessageContentRenderer);
