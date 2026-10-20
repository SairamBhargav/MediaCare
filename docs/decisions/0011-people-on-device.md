# ADR-0011: People, on device (Apple Vision + SFace)

Date: 2026-10-19 · Status: accepted

## Context

Dad's feedback: he wants to tap "Bob" and see every photo with Bob. The PRD listed face identification as a non-goal. Apple gives apps no access to the Photos app's People data, and Vision detects faces but doesn't say who they are. The owner asked to combine Apple Vision with a dedicated face model.

## Decision

The PRD non-goal is narrowed: on-device People for the user's own photos is in scope; anything leaving the device stays out.

- **Where faces come from:** the photo check already records faces per photo. A new "Finding people" step looks only at photos with faces, on a 1,024 px rendition (iCloud rules from ADR-0009 apply).
- **Native (`FaceTools.swift`):** Vision face landmarks and capture quality; each face of at least 40 px is aligned to the 112×112 five-point template OpenCV uses (least-squares similarity transform), then fingerprinted by Apple's image feature print and, when bundled, by **SFace** (OpenCV model zoo, Apache 2.0, 128 numbers, RGB 0–255 input as OpenCV feeds it). Fingerprints are L2-normalized Float32, base64.
- **Combining (`src/domain/people.ts`):** a face joins the person whose average fingerprint it matches best. With SFace: ≥ 0.45 cosine is a match; 0.363–0.45 (OpenCV's own threshold up to our stricter one) only if Apple's fingerprint agrees (≥ 0.8). Apple only: ≥ 0.9. Faces below 0.3 quality aren't grouped. All provisional; the bias is to split rather than mix.
- **Corrections win:** rename, merge, hide, and "Not <name>" on a photo (that face is never grouped with that person again). A re-scanned photo keeps its faces' people by box overlap.
- **Storage:** migration 7 (`face_scans`, `faces`, `people`); cleared with Clear MediaCare data; orphans removed with their photos.
- **Model delivery:** `.github/workflows/face-model.yml` converts SFace on a macOS runner (onnx2torch → coremltools → `coremlcompiler`), checks it against onnxruntime (cosine ≥ 0.999), and uploads `SFace.mlmodelc`. Committed under `modules/media-analysis/ios/models/` it ships in the next build; without it, People runs on Apple's fingerprint alone. Settings → About shows the Apache 2.0 notice when the model is present.
- **UI:** Library shows a People row; People lists everyone seen in 2+ photos (named first); a person shows their photos, newest first.

## Consequences

- Needs a new app build; the face implementation id includes the model, so adding SFace later redoes faces with it.
- Unknown until device testing: grouping quality (both paths), the right thresholds, speed of the first run on ~13,000 photos, memory of face avatars cut from large photos.
- SFace's weights are Apache 2.0; they were trained on a public research face dataset. The owner confirms this is acceptable before the model is committed.
