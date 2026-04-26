import { InlineMath, BlockMath } from 'react-katex';

interface MathRendererProps {
  text: string;
}

/**
 * Auto-wrap common math patterns from PDF-extracted questions in $...$ so
 * KaTeX picks them up. Runs only on spans outside existing $...$ delimiters.
 */
const autoWrapMath = (raw: string): string => {
  if (!raw) return raw;

  // Split by existing delimiters so we don't double-wrap pre-existing LaTeX
  const segments = raw.split(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g);

  return segments
    .map((seg) => {
      if (seg.startsWith('$')) return seg;

      let s = seg;
      // sqrt(...) -> \sqrt{...}
      s = s.replace(/\bsqrt\s*\(([^()]+)\)/gi, '$\\sqrt{$1}$');
      // x^n or x^{...} (already-LaTeX-ish)
      s = s.replace(/([A-Za-z0-9\)\]])\s*\^\s*\{([^{}]+)\}/g, '$$$1^{$2}$$');
      s = s.replace(/([A-Za-z0-9\)\]])\s*\^\s*(-?\d+(?:\.\d+)?|[A-Za-z])/g, '$$$1^{$2}$$');
      // x_n subscripts
      s = s.replace(/([A-Za-z])\s*_\s*\{([^{}]+)\}/g, '$$$1_{$2}$$');
      s = s.replace(/([A-Za-z])\s*_\s*(\d+|[A-Za-z])/g, '$$$1_{$2}$$');
      // pi / theta / alpha / beta / etc when standalone word
      s = s.replace(/\b(pi|theta|alpha|beta|gamma|delta|mu|sigma|omega|lambda|phi)\b/g, '$\\$1$');
      // Integer fraction like "1/2", "3/4" (not inside URLs or dates)
      s = s.replace(/(^|[^A-Za-z0-9/])(\d+)\/(\d+)(?![A-Za-z0-9/])/g, '$1$$\\frac{$2}{$3}$$');
      // Degree symbol 30deg -> $30^{\circ}$
      s = s.replace(/(\d+)\s*(deg|°)\b/g, '$$$1^{\\circ}$$');
      // Collapse accidental $$...$$ into $...$ (we never produce display math here)
      s = s.replace(/\$\$+/g, '$');
      return s;
    })
    .join('');
};

/**
 * Renders text containing LaTeX math expressions.
 * Supports $...$ for inline math and $$...$$ for block math.
 * Auto-wraps common math patterns that arrive without LaTeX delimiters.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ text }) => {
  if (!text) return null;

  const preprocessed = autoWrapMath(text);
  const parts = preprocessed.split(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g);

  return (
    <span className="math-container">
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          const math = part.slice(2, -2).trim();
          return <BlockMath key={index} math={math} />;
        } else if (part.startsWith('$') && part.endsWith('$')) {
          const math = part.slice(1, -1).trim();
          if (!math) return null;
          try {
            return <InlineMath key={index} math={math} />;
          } catch {
            return <span key={index}>${math}$</span>;
          }
        }
        return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
      })}
    </span>
  );
};

export default MathRenderer;
