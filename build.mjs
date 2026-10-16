import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { renderClassic, hash, safeJSON } from './render-portfolio.mjs';
const data = JSON.parse(readFileSync('data/portfolio.json', 'utf8'));
const slugs = new Set();
for (const project of data.projects) {
  if (!/^[a-z0-9-]+$/.test(project.slug) || slugs.has(project.slug)) throw new Error(`Invalid or repeated project slug: ${project.slug}`);
  slugs.add(project.slug);
  for (const field of ['title', 'statusLabel', 'role', 'summary', 'challenge', 'outcome']) if (!project[field]) throw new Error(`${project.slug}: missing ${field}`);
  for (const path of [project.media, project.poster].filter(Boolean)) if (!existsSync(path)) throw new Error(`${project.slug}: missing local media ${path}`);
}
if (data.projects.filter(p => p.status === 'released').length !== 2) throw new Error('Release count must match the two confirmed public releases.');
const selected = data.projects.findIndex(p => p.slug === 'the-amazing-saniboy');
const classic = renderClassic(data, selected);
writeFileSync('index.html', classic); writeFileSync('classic.html', classic);
for (const [index, project] of data.projects.entries()) {
  const directory = `projects/${project.slug}`; mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/index.html`, renderClassic(data, index, true));
}
const arcadeData = { ...data, profile: { ...data.profile, resume: `${data.profile.resume}?v=${hash(data.profile.resume)}` } };
const arcade = readFileSync('templates/arcade.html', 'utf8')
  .replace('%%CSS%%', hash('css/machine.css')).replace('%%UI%%', hash('js/machine-ui.js'))
  .replace('%%SCENE%%', hash('js/machine-scene.js')).replace('%%DATA%%', safeJSON(arcadeData));
if (/%%[A-Z]+%%/.test(arcade)) throw new Error('Unfilled arcade template marker');
writeFileSync('arcade.html', arcade); writeFileSync('preview.html', arcade);
const urls = ['/', '/arcade.html', ...data.projects.map(p => `/projects/${p.slug}/`)];
writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(path => `  <url><loc>https://saifxss.github.io${path}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`Built normal homepage, 7 shareable case-study pages, and 3D arcade from one structured content source.`);
console.log(`Homepage: ${(Buffer.byteLength(classic) / 1024).toFixed(1)} KB. No frontend framework or 3D dependency on the homepage.`);
