[![GitHub repo](https://img.shields.io/badge/github-fapoli%2Fshady-blue?logo=github)](https://github.com/fapoli/shady)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

# Shady

A minimal desktop shader editor for writing and running WebGL2 fragment shaders.

Shady is built around a quiet Monaco editor, a fullscreen preview, and Shadertoy-style uniforms/channels. It supports shader buffers, image and audio inputs, and live microphone audio-reactive textures.

![App Screenshot](assets/screenshot.png)

## Features

- Frameless Electron app with a minimal dark interface
- Monaco editor with GLSL syntax highlighting
- GLSL autocomplete for Shady uniforms and built-in functions
- WebGL2 fragment shader preview
- Multi-pass shader buffers
- Image, audio file, and microphone input channels
- Project save/load support
- Tokyo Night-inspired editor theme with a violet accent
- Global channels/buffers (main difference with shadertoy)

## Requirements

- Node.js
- npm

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

To create a packaged app:

```bash
npm run package
```

Platform-specific packages:

```bash
npm run package:mac
npm run package:win
npm run package:linux
```

Release artifacts are written to `dist/`.

- macOS: DMG
- Windows: ZIP, x64
- Linux: tar.gz, x64

## Controls

- `Cmd+Enter` / `Ctrl+Enter`: run the shader preview
- `Space`: pause/resume the shader preview
- `Esc`: return to the editor
- `Cmd+Shift+F` / `Ctrl+Shift+F`: toggle stats
- `Cmd+0` / `Ctrl+0`: project
- `Cmd+1-5` / `Ctrl+1-5`: switch shader tabs

## Shader Notes

Shaders are WebGL2 fragment shaders and should start with:

```glsl
#version 300 es
```

Common uniforms include:

```glsl
uniform vec2 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iDate;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform float iChannelTime[4];
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
```

Audio and microphone inputs use a `512 x 2` texture:

- row `0`: frequency data
- row `1`: waveform data

## Testing Shadertoy Shaders

Most Shadertoy shaders (GLSL ES 3.0) run in Shady with a small wrapper.

| Shadertoy | Shady |
|---|---|
| `void mainImage(out vec4 fragColor, in vec2 fragCoord)` | `void main()` writing to `out vec4 fragColor`. `fragCoord` is provided for you (`gl_FragCoord.xy`), do not declare it. |
| Uniforms are predeclared | Declare them yourself (the starter shader already has the block). `iResolution` is a `vec2`, not a `vec3`. |
| Image tab | `main` tab |
| Buffer A-D tabs | `buffer a` - `buffer d` tabs |
| Per-pass channel inputs | Global channels: `iChannel0-3` always read buffers A-D, and any slot can be replaced by an image, audio file, or microphone |

To port a shader:

1. Paste the Shadertoy code into the `main` tab, below the header and uniform block.
2. Add a `main()` that calls `mainImage`:

```glsl
#version 300 es
precision highp float;

uniform vec2      iResolution;
uniform float     iTime;
uniform float     iTimeDelta;
uniform int       iFrame;
uniform vec4      iMouse;
uniform vec4      iDate;
uniform float     iSampleRate;
uniform vec3      iChannelResolution[4];
uniform float     iChannelTime[4];
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;

out vec4 fragColor;

// --- Shadertoy code, unchanged ---
void mainImage(out vec4 O, in vec2 fragCoord) {
  // ...
}
// ---------------------------------

void main() {
  mainImage(fragColor, fragCoord);
}
```

3. Buffers: paste each into its matching tab (same wrapper). Channels are global, so `iChannel0-3` always read buffers A-D.
4. Press `Cmd+Enter` / `Ctrl+Enter` to run it.

## Validation

```bash
npm run typecheck
npm run build
```

## License

MIT
