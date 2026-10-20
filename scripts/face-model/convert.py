"""Convert OpenCV's SFace face-recognition model (Apache 2.0) to Core ML (ADR-0011).

Run by .github/workflows/face-model.yml on a macOS runner. Produces
SFace.mlpackage with one image input (112x112, RGB, values 0-255, as OpenCV's
FaceRecognizerSF feeds it: blobFromImage(img, 1, (112, 112), 0, swapRB=True))
and one 128-number output, then checks Core ML against onnxruntime on the
same input. Fails if they disagree.
"""

import sys

import coremltools as ct
import numpy as np
import onnx
import onnxruntime
import torch
from onnx2torch import convert
from PIL import Image

ONNX_PATH = sys.argv[1]
OUT_PATH = sys.argv[2]

onnx_model = onnx.load(ONNX_PATH)
torch_model = convert(onnx_model).eval()
example = torch.rand(1, 3, 112, 112) * 255
traced = torch.jit.trace(torch_model, example)

mlmodel = ct.convert(
    traced,
    inputs=[
        ct.ImageType(
            name="face",
            shape=(1, 3, 112, 112),
            color_layout=ct.colorlayout.RGB,
            scale=1.0,
            bias=[0.0, 0.0, 0.0],
        )
    ],
    outputs=[ct.TensorType(name="embedding")],
    convert_to="mlprogram",
    minimum_deployment_target=ct.target.iOS16,
    compute_precision=ct.precision.FLOAT32,
)
mlmodel.author = "OpenCV model zoo (face_recognition_sface_2021dec), converted for MediaCare"
mlmodel.license = "Apache License 2.0"
mlmodel.short_description = "SFace face recognition: 112x112 aligned RGB face to a 128-number fingerprint"
mlmodel.version = "2021dec"
mlmodel.save(OUT_PATH)

# Same random face through both runtimes; fingerprints must point the same way.
rng = np.random.default_rng(7)
pixels = rng.integers(0, 256, size=(112, 112, 3), dtype=np.uint8)
session = onnxruntime.InferenceSession(ONNX_PATH)
blob = pixels.astype(np.float32).transpose(2, 0, 1)[None]
reference = session.run(None, {session.get_inputs()[0].name: blob})[0].ravel()
converted = np.asarray(
    ct.models.MLModel(OUT_PATH).predict({"face": Image.fromarray(pixels, "RGB")})["embedding"]
).ravel()
cosine = float(
    np.dot(reference, converted) / (np.linalg.norm(reference) * np.linalg.norm(converted))
)
print(f"Core ML vs onnxruntime cosine: {cosine:.6f}")
if cosine < 0.999:
    sys.exit("Converted model disagrees with the original")
