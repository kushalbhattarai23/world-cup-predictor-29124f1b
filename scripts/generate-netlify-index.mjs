import { promises as fs } from 'node:fs';
import path from 'node:path';

const clientDir = path.resolve('dist/client');
const assetsDir = path.join(clientDir, 'assets');

const files = await fs.readdir(assetsDir);
const entryJs = files.find((file) => file.startsWith('index-') && file.endsWith('.js'));
const stylesCss = files.find((file) => file.startsWith('styles-') && file.endsWith('.css'));

if (!entryJs) {
  throw new Error('Could not find client entry bundle (index-*.js) in dist/client/assets');
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>World Cup Predictor</title>
    ${stylesCss ? `<link rel="stylesheet" href="/assets/${stylesCss}" />` : ''}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${entryJs}"></script>
  </body>
</html>
`;

await fs.writeFile(path.join(clientDir, 'index.html'), html, 'utf8');
console.log(`Generated dist/client/index.html using ${entryJs}`);
