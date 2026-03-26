import fs from 'node:fs';
import path from 'node:path';

export function slugifyTitle(title) {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCitationKey({ creators = [], date = '', title = '' }) {
  const yearMatch = String(date).match(/\d{4}/);
  const year = yearMatch ? yearMatch[0] : 'n.d.';
  const firstCreator = creators[0] || {};
  const lastName = slugifyTitle(firstCreator.lastName || firstCreator.name || 'Unknown')
    .split(' ')
    .filter(Boolean)[0] || 'Unknown';

  const stopwords = new Set(['a', 'an', 'the', 'of', 'and', 'for', 'with', 'on', 'to', 'in', 'after']);
  const words = slugifyTitle(title)
    .split(' ')
    .map(w => w.trim())
    .filter(Boolean)
    .filter(w => !stopwords.has(w.toLowerCase()))
    .slice(0, 3)
    .map(w => w[0].toUpperCase() + w.slice(1));

  return `${lastName}${year}${words.join('') || 'Untitled'}`;
}

export function buildChildNoteTemplate(item) {
  const citationKey = item.citationKey || buildCitationKey(item);
  const authors = (item.creators || [])
    .map(c => c.name || [c.firstName, c.lastName].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(', ');

  return [
    '# Intake Note',
    '',
    `- Canonical Title: ${item.title || ''}`,
    `- Citation Key: ${citationKey}`,
    `- Authors: ${authors}`,
    `- Date: ${item.date || ''}`,
    `- URL: ${item.url || ''}`,
    `- DOI: ${item.DOI || ''}`,
    `- Archive: ${item.archive || ''}`,
    `- Archive Location: ${item.archiveLocation || ''}`,
    '',
    '## Why selected',
    '- TODO',
    '',
    '## Relation to my research',
    '- visual token efficiency / instruction tuning / data curation',
    '',
    '## Next actions',
    '- skim',
    '- extract key table',
    '- compare with related work',
    ''
  ].join('\n');
}

export function ensurePdfPath(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File does not exist: ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${resolved}`);
  }
  if (path.extname(resolved).toLowerCase() !== '.pdf') {
    throw new Error(`Attachment must be a PDF: ${resolved}`);
  }
  return resolved;
}
