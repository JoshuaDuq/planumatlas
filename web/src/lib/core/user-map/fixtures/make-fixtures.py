"""Write the NIfTI-1 fixtures for nifti.test.ts and what nibabel reads from them.

Headers are written field by field so they can hold what nibabel's own writer would
not (an invalid sform code, qfac 0, negative pixdims). expected.json is nibabel's
`img.shape`, `img.affine`, `intent_code`, `descrip` and `img.get_fdata()` for each file, x fastest, NaN as null
and infinities as "Infinity" / "-Infinity".

    .venv/bin/python -I web/src/lib/core/user-map/fixtures/make-fixtures.py

then `npx prettier --write` expected.json from web/, as CI checks its format.
"""

import gzip
import io
import json
from pathlib import Path

import nibabel as nib
import numpy as np
from nibabel.eulerangles import euler2mat

HERE = Path(__file__).resolve().parent
rng = np.random.default_rng(20261107)


def affine(rotation, zooms, offset):
    out = np.eye(4)
    out[:3, :3] = rotation @ np.diag(zooms)
    out[:3, 3] = offset
    return out


def header(dtype, shape, endianness="<"):
    hdr = nib.Nifti1Header(endianness=endianness)
    hdr.set_data_dtype(dtype)
    hdr.set_data_shape(shape)
    return hdr


def encode(hdr, values):
    stream = io.BytesIO()
    hdr.write_to(stream)
    assert stream.tell() == hdr["vox_offset"]
    data = np.asarray(values, dtype=hdr.get_data_dtype())
    assert data.shape == hdr.get_data_shape()
    stream.write(data.tobytes(order="F"))
    return stream.getvalue()


def float32_sform():
    shape = (3, 4, 2)
    hdr = header(np.float32, shape)
    hdr.set_qform(affine(np.eye(3), (2, 2, 2), (-3, -4, -5)), code=1)
    oblique = affine(euler2mat(0.3, -0.2, 0.15), (1.5, 2, 2.5), (-60.25, 40.5, -20.75))
    oblique[0, 1] += 0.1  # a shear, which only the sform can hold
    hdr.set_sform(oblique, code=4)
    hdr.set_intent("z score")
    return hdr, rng.normal(0, 3, shape)


def int16_be_qform():
    shape = (4, 3, 2)
    hdr = header(np.int16, shape, ">")
    flip = np.diag([1, 1, -1])
    rotation = euler2mat(0.5, 0.25, -0.4) @ flip
    hdr.set_qform(affine(rotation, (1.25, 1.5, 3), (12.5, -30, 7.25)), code=1)
    hdr.set_sform(np.diag([3, 3, 3, 1]), code=0)
    assert hdr["pixdim"][0] == -1
    hdr["scl_slope"] = 0.25
    hdr["scl_inter"] = -10
    hdr["descrip"] = b"SPM{T_[23.0]} - contrast 1: faces > houses"
    values = rng.integers(-32768, 32768, shape)
    values.flat[:3] = [-32768, 32767, 0]
    return hdr, values


def uint8_mask():
    shape = (4, 3, 2)
    hdr = header(np.uint8, shape)
    mni = affine(np.diag([-1, 1, 1]), (2, 2, 2), (90, -126, -72))
    hdr.set_qform(mni, code=4)
    hdr.set_sform(mni, code=4)
    return hdr, rng.random(shape) > 0.5


def float64_nonfinite():
    shape = (2, 3, 2)
    hdr = header(np.float64, shape)
    hdr.set_sform(affine(np.eye(3), (1, 1, 1), (-1, -2, -3)), code=2)
    hdr["scl_slope"] = np.nan
    hdr["scl_inter"] = np.nan
    # Moves the data past byte 352.
    hdr.extensions.append(nib.nifti1.Nifti1Extension("comment", b"Planum fixture"))
    values = [np.nan, np.inf, -np.inf, 0, -2.5, 1e30]
    values += [-1e-30, np.pi, 123456.789, -7, 0.1, 3e38]
    return hdr, np.reshape(values, shape, order="F")


def int8_qform_over_sform():
    shape = (3, 2, 4)
    hdr = header(np.int8, shape)
    qform = affine(euler2mat(-0.1, 0.2, 0.05), (2, 2, 2), (-80, -110, -60))
    hdr.set_qform(qform, code=4)
    hdr.set_sform(affine(euler2mat(0.35, 0, 0), (1, 1.5, 2), (10, 20, 30)), code=1)
    return hdr, np.linspace(-128, 127, 24).round().reshape(shape)


def uint16_slope():
    shape = (2, 2, 3)
    hdr = header(np.uint16, shape)
    hdr.set_sform(affine(np.eye(3), (2, 2, 2), (-90, -126, -72)), code=4)
    hdr["scl_slope"] = -0.5
    hdr["scl_inter"] = 1000
    values = rng.integers(0, 65536, shape)
    values.flat[:3] = [0, 65535, 32768]
    return hdr, values


def int32_slope_zero():
    shape = (3, 2, 2)
    hdr = header(np.int32, shape)
    hdr.set_sform(affine(np.eye(3), (3, 3, 3), (-90, -126, -72)), code=4)
    hdr["scl_slope"] = 0
    hdr["scl_inter"] = 7
    values = rng.integers(-(2**31), 2**31, shape)
    values.flat[:2] = [-(2**31), 2**31 - 1]
    return hdr, values


def uint32_be_slope_nan():
    shape = (2, 2, 2)
    hdr = header(np.uint32, shape, ">")
    hdr.set_sform(affine(np.eye(3), (1, 1, 1), (0, 0, 0)), code=3)
    hdr["scl_slope"] = np.nan
    hdr["scl_inter"] = 5
    values = rng.integers(0, 2**32, shape)
    values.flat[:2] = [2**32 - 1, 2**31]
    return hdr, values


def qform_fixups():
    shape = (2, 3, 2)
    hdr = header(np.float32, shape)
    hdr["qform_code"] = 2
    hdr["sform_code"] = 7  # not a NIfTI code: nibabel resets it to 0 on load
    hdr["srow_x"], hdr["srow_y"], hdr["srow_z"] = np.eye(4)[:3] * 5
    hdr["pixdim"][:4] = [0, 2, 0, -3]  # qfac 0 reads as 1, pixdim 0 as 1, -3 as 3
    # A quaternion whose w² is positive but under nibabel's threshold, so w is 0.
    b = np.float32(0.6)
    c = np.float32(np.sqrt(1 - np.float64(b) ** 2 - 1.8e-7))
    w2 = 1 - (np.float64(b) ** 2 + np.float64(c) ** 2)
    assert 0 < w2 < hdr.quaternion_threshold, w2
    hdr["quatern_b"], hdr["quatern_c"], hdr["quatern_d"] = b, c, 0
    hdr["qoffset_x"], hdr["qoffset_y"], hdr["qoffset_z"] = 10.5, -20, 30.25
    return hdr, rng.normal(0, 1, shape)


FIXTURES = {
    "float32-sform.nii": float32_sform,
    "int16-be-qform.nii": int16_be_qform,
    "uint8-mask.nii.gz": uint8_mask,
    "float64-nonfinite.nii": float64_nonfinite,
    "int8-qform-over-sform.nii": int8_qform_over_sform,
    "uint16-slope.nii": uint16_slope,
    "int32-slope-zero.nii": int32_slope_zero,
    "uint32-be-slope-nan.nii": uint32_be_slope_nan,
    "qform-fixups.nii": qform_fixups,
}


def value(v):
    if np.isnan(v):
        return None
    if np.isinf(v):
        return "Infinity" if v > 0 else "-Infinity"
    return float(v)


def main():
    expected = {"nibabel": nib.__version__}
    for name, build in FIXTURES.items():
        content = encode(*build())
        if name.endswith(".gz"):
            content = gzip.compress(content, mtime=0)
        path = HERE / name
        path.write_bytes(content)
        img = nib.load(path)
        expected[name] = {
            "shape": list(img.shape),
            "affine": img.affine.tolist(),
            "intent": int(img.header["intent_code"]),
            "description": img.header["descrip"].tobytes().split(b"\0")[0].decode("latin1"),
            "data": [value(v) for v in img.get_fdata().ravel(order="F")],
        }
    (HERE / "expected.json").write_text(json.dumps(expected, indent=2) + "\n")


if __name__ == "__main__":
    main()
