export interface TextSelection {
  start: number;
  end: number;
}

export const clampComposerInputHeight = (
  contentHeight: number,
  minimumHeight: number,
  maximumHeight: number
): number => Math.max(
  minimumHeight,
  Math.min(maximumHeight, Math.ceil(contentHeight)),
);

export const insertTextAtSelection = (
  value: string,
  selection: TextSelection,
  insertedText: string,
  maxLength: number
): { value: string; selection: TextSelection } | undefined => {
  const start = Math.max(0, Math.min(selection.start, value.length));
  const end = Math.max(start, Math.min(selection.end, value.length));
  const nextLength = value.length - (end - start) + insertedText.length;
  if (nextLength > maxLength) return undefined;

  const nextValue = `${value.slice(0, start)}${insertedText}${value.slice(end)}`;
  const cursor = start + insertedText.length;
  return {
    value: nextValue,
    selection: { start: cursor, end: cursor },
  };
};
