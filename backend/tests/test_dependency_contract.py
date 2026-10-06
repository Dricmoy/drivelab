from pathlib import Path
import tomllib


def test_waymax_extra_matches_compatible_root_requirements():
    backend = Path(__file__).resolve().parents[1]
    with (backend / "pyproject.toml").open("rb") as stream:
        metadata = tomllib.load(stream)
    requirements = {line.strip() for line in (backend.parent / "requirements-waymax.txt").read_text().splitlines()
                    if line.strip() and not line.lstrip().startswith("#")}
    assert set(metadata["project"]["optional-dependencies"]["waymax"]) == requirements
