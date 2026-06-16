"""
Image decoding helpers.

Accepts either raw bytes (a JPEG/PNG upload) or a browser `data:` URL and returns
a BGR uint8 numpy array (the format InsightFace / OpenCV expect). Uses OpenCV when
available, otherwise falls back to Pillow so the rest of the pipeline still works.
"""
from __future__ import annotations

import base64
import binascii
from io import BytesIO

import numpy as np


class ImageDecodeError(ValueError):
    pass


def _strip_data_url(data: str) -> bytes:
    # Format: "data:image/jpeg;base64,/9j/4AAQ..."
    if "," in data:
        data = data.split(",", 1)[1]
    try:
        return base64.b64decode(data, validate=False)
    except (binascii.Error, ValueError) as e:
        raise ImageDecodeError(f"invalid base64 image data: {e}") from e


def decode_image(source) -> np.ndarray:
    """
    Decode an image to a BGR uint8 ndarray.

    `source` may be: bytes, a base64 `data:` URL string, or a raw base64 string.
    """
    if isinstance(source, str):
        raw = _strip_data_url(source)
    elif isinstance(source, (bytes, bytearray)):
        raw = bytes(source)
    else:
        raise ImageDecodeError(f"unsupported image source type: {type(source)}")

    if not raw:
        raise ImageDecodeError("empty image data")

    # Prefer OpenCV (matches InsightFace's expected BGR ordering exactly).
    try:
        import cv2  # type: ignore

        arr = np.frombuffer(raw, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ImageDecodeError("OpenCV could not decode the image")
        return img
    except ImportError:
        pass

    # Fallback: Pillow -> RGB -> BGR
    try:
        from PIL import Image  # type: ignore

        img = Image.open(BytesIO(raw)).convert("RGB")
        rgb = np.array(img)
        return rgb[:, :, ::-1].copy()  # RGB -> BGR
    except ImportError as e:  # pragma: no cover - one of cv2/PIL is always present
        raise ImageDecodeError(
            "Neither OpenCV nor Pillow is installed; cannot decode images."
        ) from e
