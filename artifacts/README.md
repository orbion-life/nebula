# Artifact index

This directory separates public provenance from local generated output.

| Directory | Versioned? | Contents |
| --- | --- | --- |
| [`claude/`](./claude/) | Yes | Dated build, review, and scientific-red-team records for the hackathon transparency trail. |
| [`first-use/`](./first-use/) | Yes | A bounded internal first-use record; it is a software-use scenario, not experimental validation. |
| `demo/` | No | Locally rendered submission video and captions. Ignored because the binary is delivered through the submission platform. |
| `demo-capture/` | No | Temporary recording frames. Curated repository screenshots live in [`docs/media/readme/`](../docs/media/readme/). |
| `runs/` | No | Local runtime output. Reproducible public proof intended for the repository belongs in [`docs/provenance/`](../docs/provenance/). |

Do not place secrets, private provider responses, raw voice samples, or unreviewed scientific claims here.
