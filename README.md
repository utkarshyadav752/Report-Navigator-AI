# Report Navigator AI
**Turn hundreds of pages into simple, cited answers.**

Report Navigator AI is a full-stack Retrieval-Augmented Generation (RAG) document research assistant designed for government statistical reports, economic surveys, and official PDFs.

## Key Capabilities

1. **Zero-Hallucination RAG Pipeline**:
   - Page-aware PDF text & table extraction (`pdfjs-dist` + stream fallback).
   - 64-D hybrid vector embeddings + server-side `gemini-embedding-2-preview`.
   - Strict evidence verification: if a query is not supported by the uploaded report, the assistant explicitly outputs `"Not found in the uploaded report."` with zero fabricated citations.
2. **Multi-Tier Gemini Intelligence**:
   - **Low-Latency Mode**: `gemini-3.1-flash-lite` for fast responses and table explanations.
   - **Balanced Mode**: `gemini-3.8-flash` for general RAG synthesis.
   - **High-Thinking Mode**: `gemini-4-argon` with `ThinkingLevel.HIGH` for complex multi-step statistical reasoning.
   - **Multimodal Image & Scan OCR**: `gemini-4-argon` analyzes uploaded report photos and charts.
3. **Interactive 3D Citation & Knowledge Atlas**:
   - Built with Three.js (`ACESFilmicToneMapping`, `RoomEnvironment` PBR lighting, composite 9-part procedural Archival Monument, and `InstancedMesh` semantic nodes).
4. **Firebase Auth & Hardened Firestore Persistence**:
   - Google Sign-In authentication and zero-trust ABAC security rules (`firestore.rules`).

## Installation & Startup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables (copy .env.example to .env)
cp .env.example .env

# 3. Run unit & security rule tests
npx --yes tsx --test src/utils/ragEngine.test.ts
npx --yes tsx --test firestore.rules.test.ts

# 4. Start full-stack server on http://localhost:3000
npm run dev
```
