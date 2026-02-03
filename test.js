const test = `import {
  Dialog,
  DialogContent,
  DialogTrigger
} from "@stellarUI/components/dialog";`;

console.log('Test string:', test);

// This won't match because [^}] doesn't match newlines
const regex1 = /import\s*\{([^}]+)\}\s*from/;
console.log('Regex1 match:', test.match(regex1));

// This will match
const regex2 = /import\s*\{([\s\S]+?)\}\s*from/;
console.log('Regex2 match:', test.match(regex2));
