#!/usr/bin/env bash
set -euo pipefail

mkdir -p icon.iconset

# Generate scaled versions
sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png

# Copy the reference icon
cp icon.png icon.iconset/icon_512x512@2x.png

# Generate the macOS icon. This writes a modern ICNS with PNG payloads and avoids
# iconutil rejecting otherwise valid source files because of local metadata.
node <<'NODE'
const fs = require('node:fs')

const entries = [
  ['icp4', 'icon.iconset/icon_16x16.png'],
  ['icp5', 'icon.iconset/icon_32x32.png'],
  ['icp6', 'icon.iconset/icon_32x32@2x.png'],
  ['ic07', 'icon.iconset/icon_128x128.png'],
  ['ic08', 'icon.iconset/icon_256x256.png'],
  ['ic09', 'icon.iconset/icon_512x512.png'],
  ['ic10', 'icon.iconset/icon_512x512@2x.png'],
]

const chunks = entries.map(([type, file]) => {
  const data = fs.readFileSync(file)
  const chunk = Buffer.alloc(8 + data.length)
  chunk.write(type, 0, 'ascii')
  chunk.writeUInt32BE(chunk.length, 4)
  data.copy(chunk, 8)
  return chunk
})

const size = 8 + chunks.reduce((total, chunk) => total + chunk.length, 0)
const header = Buffer.alloc(8)
header.write('icns', 0, 'ascii')
header.writeUInt32BE(size, 4)
fs.writeFileSync('icon.icns', Buffer.concat([header, ...chunks]))
NODE

# Generate the Windows icon. Modern .ico files can embed PNG payloads.
sips -z 256 256 icon.png --out icon-256.png
node -e "const fs=require('fs');const png=fs.readFileSync('icon-256.png');const header=Buffer.alloc(22);header.writeUInt16LE(0,0);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=0;header[7]=0;header[8]=0;header[9]=0;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(header.length,18);fs.writeFileSync('icon.ico',Buffer.concat([header,png]));"
rm icon-256.png
