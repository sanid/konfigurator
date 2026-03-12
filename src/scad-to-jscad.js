const fs = require('fs');
const scad = fs.readFileSync('moduli.scad', 'utf8');

let js = scad;

// Remove imports and global configs at top
js = js.replace(/include\s*<.*?>;/g, '');
js = js.replace(/\*\[.*?\]\*/g, '');

// Module to JS function
// Handles capturing the whole block properly
// We actually need a custom AST/Regex, but let's try a heuristic string replacement:
js = js.replace(/module\s+([a-zA-Z0-9_]+)\s*\((.*?)\)\s*\{/g, 'export function $1($2) {\n  let __out = [];');

// echo statements -> console.log
js = js.replace(/echo\((.*?)\);/g, 'console.log($1);');

// For loops: for(i=[start:step:end]) or for(i=[start:end])
js = js.replace(/for\s*\(\s*([a-zA-Z0-9_]+)\s*=\s*\[(.*?)(?:[:](.*?))?\]\s*\)/g, (match, v, start, end) => {
    if (!end) {
        // syntax: for(i=[0]) or for(i=[0,1])
        return `for (let ${v} of [${start}])`;
    }
    return `for (let ${v} = ${start}; ${v} <= ${end}; ${v}++)`;
});

// `color(c) {...}` -> `color(c, ...)`
// This requires AST, but let's just strip 'color' blocks or convert them simply?
// Actually, `jscadModeling.colors.colorize` is how JSCAD does it.
// The easiest is just return an array of geometries from each builder.

// Let's output to a file and see what we get
fs.writeFileSync('src/moduli.jscad.js', js);
console.log('Done basic text replacements!');
