import { InlineMath, BlockMath } from 'react-katex';

interface MathRendererProps {
  text: string;
}

/**
 * Renders text containing LaTeX math expressions.
 * Supports $...$ for inline math and $$...$$ for block math.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ text }) => {
  if (!text) return null;

  // Split text by both $$...$$ and $...$
  // The regex uses capturing groups so the delimiters are included in the results
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g);

  return (
    <span className="math-container">
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2).trim();
          return <BlockMath key={index} math={math} />;
        } else if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1).trim();
          return <InlineMath key={index} math={math} />;
        }
        return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
      })}
    </span>
  );
};

export default MathRenderer;
