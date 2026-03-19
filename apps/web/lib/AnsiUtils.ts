// Strip ANSI escape codes from text
// Matches: color codes, control codes, extended codes, etc.
export const StripAnsi = (text: string): string => {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]|\x1b\].*?\x07|\x1b\(B|\x1b\[\?.*?[hl]|\r/g, "");
};
