import { type CSSProperties, type ElementType, type ReactNode, useState } from 'react';

// React inline styles can't express `:hover`, and the design's hover states are
// dynamic (they depend on the runtime pick color). This wrapper merges a hover
// style object over the base style while the pointer is over the element.
interface HoverProps {
  style?: CSSProperties;
  hoverStyle?: CSSProperties;
  as?: ElementType;
  children?: ReactNode;
  onClick?: (() => void) | null;
}

export function Hover({ style, hoverStyle, as, children, onClick }: HoverProps) {
  const [hovered, setHovered] = useState(false);
  const Tag = (as || 'div') as ElementType;
  return (
    <Tag
      style={{ ...style, ...(hovered && hoverStyle ? hoverStyle : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick || undefined}
    >
      {children}
    </Tag>
  );
}
