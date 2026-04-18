import Markdown from 'react-markdown'

export const mdComponents: React.ComponentProps<typeof Markdown>['components'] = {
  h1: 'span', h2: 'span', h3: 'span', h4: 'span', h5: 'span', h6: 'span',
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 text-sm">{children}</code>,
  pre: ({ children }) => <pre className="mb-2 overflow-x-auto bg-gray-100 p-3 text-sm last:mb-0">{children}</pre>,
  a: ({ href, children }) => <a href={href} className="underline" target="_blank" rel="noopener noreferrer">{children}</a>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
}
