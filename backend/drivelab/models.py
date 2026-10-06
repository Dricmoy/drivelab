from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class PlannerConfig(StrictModel):
    target_speed: float = Field(default=8.0, ge=1.0, le=20.0)
    safety_margin: float = Field(default=1.0, ge=0.0, le=3.0)
    horizon: float = Field(default=3.0, ge=1.0, le=5.0)
    prediction: Literal["constant_velocity", "learned"] = "constant_velocity"
    scoring: Literal["auto", "numpy", "rust"] = "auto"


class TrainingRequest(StrictModel):
    seed: int = Field(default=42, ge=0, le=100000, strict=True)
    epochs: int = Field(default=80, ge=10, le=200, strict=True)


class RunRequest(StrictModel):
    scenario_id: str = Field(min_length=1, max_length=160)
    planner: Literal["baseline", "lattice"] = "lattice"
    config: PlannerConfig = Field(default_factory=PlannerConfig)


class EvaluationRequest(StrictModel):
    scenario_ids: list[str] = Field(min_length=1, max_length=100)
    config: PlannerConfig = Field(default_factory=PlannerConfig)


class ImportRequest(StrictModel):
    path: str = Field(min_length=1, max_length=4096)
    limit: int = Field(default=3, ge=1, le=20, strict=True)
