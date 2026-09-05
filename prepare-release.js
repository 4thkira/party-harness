/*
Party Harness - Copyright (C) 2026 Party Harness contributors
SPDX-License-Identifier: GPL-3.0-only
This program is free software: you can redistribute it and/or modify it under
the GNU General Public License version 3 as published by the Free Software Foundation.
This program is distributed without any warranty; see LICENSE for details.
You should have received a copy of the GNU General Public License along with
this program. If not, see https://www.gnu.org/licenses/.
*/
// Build a clean public source folder without copying private workspace files.
const fs = require('node:fs');
const path = require('node:path');
const files = [
  'README.md', 'CHANGELOG.md', 'DEVELOPING.md', '.gitignore', '.env.example',
  'rp-party-harness-prototype.html', 'server.js', 'harness-storage.js', 'text-providers.js',
  'Start Party Harness.cmd', 'start-party-harness.ps1',
  'checks.js', 'regression-checks.js', 'provider-checks.js', 'image-providers.js', 'browser-test-server.js',
  'prepare-release.js', 'characters/example.md'
];
if (fs.existsSync(path.join(__dirname, 'LICENSE'))) files.push('LICENSE');
const output = path.join(__dirname, 'dist', 'party-harness-' + new Date().toISOString().replace(/[:.]/g, '-'));
// Read and validate everything before creating the destination; do not follow symlinks.
const contents = files.map(file => {
  const source = path.join(__dirname, file);
  if (!fs.lstatSync(source).isFile() || !fs.realpathSync(source).startsWith(fs.realpathSync(__dirname) + path.sep)) {
    throw new Error('Release source must be a regular workspace file: ' + file);
  }
  const data = fs.readFileSync(source, 'utf8');
  return [file, data];
});
fs.mkdirSync(output, { recursive: true });
for (const [file, data] of contents) {
  const target = path.join(output, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data, { flag: 'wx' });
}
console.log('Public source folder: ' + output);
console.log('Included ' + contents.length + ' allowlisted files. Personal profiles, saves, keys, and audio excluded.');
if (!files.includes('LICENSE')) console.log('Licensing is pending. Add a LICENSE before publishing.');
