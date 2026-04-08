import fs from 'fs';

function yamlEscape(str) {
  if (!str) return "''";
  str = str.replace(/'/g, "''");
  return `'${str}'`;
}

function extractDescription(title, body) {
  const lines = body.split(/\r?\n/);
  const prose = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) { if (prose.length) break; continue; }
    if (t.startsWith('#') || t.startsWith('|') || t.startsWith('---') ||
        t.startsWith(':::') || t.startsWith('```') || t.startsWith('import ') ||
        t.startsWith('<') || t.startsWith('![')) continue;
    if (/^\d+\.\s/.test(t) || /^-\s/.test(t)) {
      if (prose.length) break;
      continue;
    }
    prose.push(t);
  }
  let text = prose.join(' ').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
  if (text.length < 30) {
    const all = lines.map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && !l.startsWith('|') && !l.startsWith('---') &&
                    !l.startsWith(':::') && !l.startsWith('```') && !l.startsWith('import ') && !l.startsWith('<'))
      .join(' ').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
    if (all.length > 30) text = all;
  }
  if (text.length < 20) return `Learn about ${title} in Zebra Aurora Focus.`;
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences) {
    let result = '';
    for (const s of sentences) {
      if ((result + s).length > 160 && result) break;
      result += s;
    }
    return result.trim();
  }
  return text.length > 160 ? text.substring(0, 157) + '...' : text;
}

function isDescriptionBad(desc) {
  if (!desc || desc.length < 10) return true;
  if (/^\d+\.\s/.test(desc)) return true;
  if (/^\|/.test(desc)) return true;
  if (desc.startsWith('Click') && desc.length < 20) return true;
  return false;
}

const report = JSON.parse(fs.readFileSync('static/dita-semantic-loss-report.json', 'utf8'));
const changelog = { timestamp: new Date().toISOString(), fixes: [] };
const targetFiles = new Map();
for (const f of report.files) {
  for (const issue of f.issues) {
    if (!issue.resolved && ['TRUNCATED_DESCRIPTION', 'EMPTY_DESCRIPTION', 'STUB_CONTENT'].includes(issue.type)) {
      if (!targetFiles.has(f.path)) targetFiles.set(f.path, []);
      targetFiles.get(f.path).push(issue.type);
    }
  }
}

let modified = 0, descFixes = 0;
for (const [path, types] of targetFiles) {
  const content = fs.readFileSync(path, 'utf8');
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) { console.log(`  SKIP (no frontmatter): ${path}`); continue; }
  const frontmatter = fmMatch[1];
  const bodyStart = fmMatch[0].length;
  const body = content.substring(bodyStart).trim();
  const titleMatch = frontmatter.match(/title:\s*(.*)/);
  const title = titleMatch ? titleMatch[1].trim() : '';
  // Extract current description - handle quoted and unquoted
  const descLineMatch = frontmatter.match(/^(description:\s*)(.*)$/m);
  if (!descLineMatch) { console.log(`  SKIP (no desc field): ${path}`); continue; }
  let currentDesc = descLineMatch[2];
  // Strip surrounding quotes
  if ((currentDesc.startsWith("'") && currentDesc.endsWith("'")) ||
      (currentDesc.startsWith('"') && currentDesc.endsWith('"'))) {
    currentDesc = currentDesc.slice(1, -1).replace(/''/g, "'");
  }

  const needsDescFix = types.includes('EMPTY_DESCRIPTION') ||
                        types.includes('TRUNCATED_DESCRIPTION') ||
                        isDescriptionBad(currentDesc);
  if (needsDescFix) {
    const newDesc = extractDescription(title, body);
    if (newDesc && newDesc !== currentDesc && newDesc.length > 15) {
      const escapedDesc = yamlEscape(newDesc);
      const newFm = frontmatter.replace(/^description:.*$/m, `description: ${escapedDesc}`);
      const newContent = `---\n${newFm}\n---` + content.substring(bodyStart);
      fs.writeFileSync(path, newContent);
      modified++;
      descFixes++;
      console.log(`  FIXED: ${path.split('/').pop()} | "${newDesc.substring(0, 70)}"`);
      changelog.fixes.push({ file: path, type: 'description-fix', oldDesc: currentDesc.substring(0, 80), newDesc });
    } else {
      console.log(`  OK: ${path.split('/').pop()} | no better text found`);
    }
  } else {
    console.log(`  OK: ${path.split('/').pop()} | desc OK`);
  }
  if (types.includes('STUB_CONTENT')) {
    changelog.fixes.push({ file: path, type: 'STUB_CONTENT', action: 'accepted-parent-topic' });
  }
}

fs.writeFileSync('static/fix-stubs-changelog.json', JSON.stringify(changelog, null, 2));
console.log(`\nDone. Modified: ${modified}, Description fixes: ${descFixes}`);
