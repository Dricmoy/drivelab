PYTHON ?= python3.12

.PHONY: setup waymax ml native benchmark build serve dev test verify-waymax
setup:
	$(PYTHON) -m venv .venv
	.venv/bin/python -m pip --isolated install --index-url https://pypi.org/simple -e './backend[test]'
	npm ci --prefix web

waymax:
	.venv/bin/python -m pip --isolated install --index-url https://pypi.org/simple -r requirements-waymax.txt

ml:
	.venv/bin/python -m pip --isolated install --index-url https://pypi.org/simple -e './backend[ml]'

native:
	.venv/bin/python scripts/build_native.py

benchmark: native
	.venv/bin/python scripts/benchmark_scoring.py

build:
	npm run build --prefix web

serve: build
	.venv/bin/python -m uvicorn drivelab.api:app --host 127.0.0.1 --port 8765

dev:
	.venv/bin/python scripts/dev.py

test: build native
	DRIVELAB_REQUIRE_NATIVE=1 .venv/bin/python -m pytest backend/tests -q
	npm run test:e2e --prefix web

verify-waymax:
	.venv/bin/python scripts/verify_waymax.py
