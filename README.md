# WebLLM Translate

Browser-based English ↔ Japanese translator powered by WebLLM. Runs entirely in your browser.

## Features

- **Browser-based** - No server required. All inference runs locally in your browser using WebGPU
- **Offline-capable** - Works offline after initial model download (PWA)
- **Privacy-first** - Your data never leaves your device
- **Android Share** - Receive shared text from other apps via Share Target API

## Usage

### Quick Start

```bash
cd webllm-translate
python -m http.server 8000
```

Open http://localhost:8000 in your browser.

### Install as PWA

On mobile (Android):
1. Open the app in Chrome
2. Tap "Add to Home Screen" from the browser menu
3. The app can now receive shared text from other apps

## Requirements

- A browser with WebGPU support (Chrome 113+, Edge 113+)
- Sufficient memory for model loading (~4GB)

## Model

This app uses [gemma-2-2b-jpn-it](https://huggingface.co/google/gemma-2-2b-jpn-it) via [WebLLM](https://webllm.mlc.ai/).

## Acknowledgments

This project is based on [TinySwallow-ChatUI](https://github.com/SakanaAI/TinySwallow-ChatUI) by [Sakana AI](https://sakana.ai/). Thank you for the excellent foundation.

## License

Apache-2.0
