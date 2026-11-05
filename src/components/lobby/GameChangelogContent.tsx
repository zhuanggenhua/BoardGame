import type { ReactNode } from 'react';
import Markdown from 'react-markdown';
import './game-changelog-content.css';

const SectionHeading = ({ children }: { children?: ReactNode }) => <h5>{children}</h5>;
const components = {
    h1: SectionHeading, h2: SectionHeading, h3: SectionHeading,
    h4: SectionHeading, h5: SectionHeading, h6: SectionHeading,
};

/** The collection and game details display the same published content format. */
export function GameChangelogContent({ content, className = '' }: { content: string; className?: string }) {
    return <div className={`game-changelog-content ${className}`}>
        <Markdown skipHtml components={components}>{content}</Markdown>
    </div>;
}
