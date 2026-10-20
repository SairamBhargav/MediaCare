# SFace face-recognition model

`SFace.mlmodelc` is OpenCV's SFace model (`face_recognition_sface_2021dec.onnx` from https://github.com/opencv/opencv_zoo), converted to Core ML by `.github/workflows/face-model.yml`. The model is licensed under the Apache License 2.0 (http://www.apache.org/licenses/LICENSE-2.0); the conversion changes its format only.

Paper: Zhong et al., "SFace: Sigmoid-Constrained Hypersphere Loss for Robust Face Recognition", IEEE TIP 2021.

MediaCare uses it on device only, to tell faces apart for People (docs/decisions/0011-people-on-device.md). No face data leaves the iPhone.
