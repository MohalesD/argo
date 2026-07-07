// Default behavioral anchors for a newly added question (PRD 5.5.3).
// Generic on purpose: they structure judgment until the QStack owner
// writes question-specific anchors.
export const DEFAULT_ANCHORS: Record<string, string> = {
  '1': 'Did not address the question, or answered in generalities only',
  '2': 'Partial: touched the area but without specifics or personal ownership',
  '3': 'Solid: a specific, concrete example with clear personal contribution',
  '4': 'Exceptional: specific example plus measurable outcome and reflection',
};
