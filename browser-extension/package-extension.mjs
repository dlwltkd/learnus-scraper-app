import { copyFile, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const extensionRoot = dirname(fileURLToPath(import.meta.url));
const targets = new Set(['development', 'production']);
const runtimeFiles = [
  'background.js',
  'bridge.js',
  'cookieHeader.js',
  'errors.js',
  'exchange.js',
  'popup.css',
  'popup.html',
  'popup.js',
];
const fixedTimestamp = new Date('2026-01-01T00:00:00Z');
const dosTime = 0;
const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function localHeader(name, contents, compressed) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt16LE(dosTime, 10);
  header.writeUInt16LE(dosDate, 12);
  header.writeUInt32LE(crc32(contents), 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(contents.length, 22);
  header.writeUInt16LE(name.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function centralHeader(name, contents, compressed, offset) {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x0314, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(8, 10);
  header.writeUInt16LE(dosTime, 12);
  header.writeUInt16LE(dosDate, 14);
  header.writeUInt32LE(crc32(contents), 16);
  header.writeUInt32LE(compressed.length, 20);
  header.writeUInt32LE(contents.length, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  header.writeUInt32LE(offset, 42);
  return header;
}

async function copyRuntimeFile(sourceName, outputName, outputDirectory) {
  const source = join(extensionRoot, 'src', sourceName);
  const destination = join(outputDirectory, outputName);
  await copyFile(source, destination);
  await utimes(destination, fixedTimestamp, fixedTimestamp);
}

async function createZip(outputDirectory, archivePath) {
  const files = (await readdir(outputDirectory)).sort();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const file of files) {
    const name = Buffer.from(file, 'utf8');
    const contents = await readFile(join(outputDirectory, file));
    const compressed = deflateRawSync(contents, { level: 9 });
    const local = localHeader(name, contents, compressed);
    localParts.push(local, name, compressed);
    centralParts.push(centralHeader(name, contents, compressed, localOffset), name);
    localOffset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  await writeFile(archivePath, Buffer.concat([...localParts, centralDirectory, end]));
}

export async function buildExtension(
  target,
  { outputRoot = join(extensionRoot, 'dist'), createArchive = true } = {},
) {
  if (!targets.has(target)) {
    throw new Error(`Unknown target: ${target}`);
  }

  const resolvedOutputRoot = resolve(outputRoot);
  const outputDirectory = join(resolvedOutputRoot, target);
  const archivePath = join(resolvedOutputRoot, `learnus-connect-${target}.zip`);

  await rm(outputDirectory, { recursive: true, force: true });
  await rm(archivePath, { force: true });
  await mkdir(outputDirectory, { recursive: true });

  await copyFile(
    join(extensionRoot, 'manifests', `${target}.json`),
    join(outputDirectory, 'manifest.json'),
  );
  await utimes(join(outputDirectory, 'manifest.json'), fixedTimestamp, fixedTimestamp);

  await copyRuntimeFile(`config.${target}.js`, 'config.js', outputDirectory);
  for (const file of runtimeFiles) {
    await copyRuntimeFile(file, file, outputDirectory);
  }

  const manifest = JSON.parse(await readFile(join(outputDirectory, 'manifest.json'), 'utf8'));
  if (manifest.manifest_version !== 3) throw new Error('Packaged manifest must use MV3');

  if (createArchive) await createZip(outputDirectory, archivePath);

  return {
    outputDirectory,
    archivePath: createArchive ? archivePath : null,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const target = process.argv[2];
  const createArchive = !process.argv.includes('--no-zip');
  const result = await buildExtension(target, { createArchive });
  const builtPath = result.archivePath ?? result.outputDirectory;
  const builtStats = await stat(builtPath);
  if (!builtStats) process.exitCode = 1;
  process.stdout.write(`${builtPath}\n`);
}
