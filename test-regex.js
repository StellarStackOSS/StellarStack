const testString = 'import { Badge } from "@stellarUI/components/badge";';
const regex = /import\s*\{([^}]+)\}\s*from\s*["']@stellarUI\/components\/badge["']/;

console.log('Test string:', testString);
console.log('Regex:', regex);
console.log('Match result:', testString.match(regex));

// Try simpler
const regex2 = /import.*from.*badge/;
console.log('Simple match:', testString.match(regex2));
