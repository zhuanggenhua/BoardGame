import type { RequirementsState } from '../context';

export function buildRequirementsText(requirements: RequirementsState, input?: string): string {
  const blocks: string[] = [];
  const rawText = requirements.rawText?.trim();
  const entryLines = requirements.entries
    .filter(entry => entry.content && entry.content.trim())
    .map(entry => {
      const location = entry.location?.trim() || '未标注位置';
      const notes = entry.notes?.trim();
      return `- [${location}] ${entry.content.trim()}${notes ? `（备注：${notes}）` : ''}`;
    });

  if (rawText) {
    blocks.push(`总体需求：${rawText}`);
  }

  if (entryLines.length > 0) {
    blocks.push(`结构化需求：\n${entryLines.join('\n')}`);
  }

  if (input?.trim()) {
    blocks.push(`本次需求：${input.trim()}`);
  }

  return blocks.join('\n\n');
}
