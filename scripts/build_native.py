"""Use an existing Cargo or the project-local toolchain without changing PATH."""
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    cargo = shutil.which('cargo')
    env = dict(os.environ)
    if not cargo:
        local = ROOT / '.cargo/bin/cargo'
        if not local.is_file():
            print('Install Rust/Cargo from https://rust-lang.org/tools/install/ then run make native.', file=sys.stderr)
            return 2
        cargo = str(local)
        env.update(CARGO_HOME=str(ROOT / '.cargo'), RUSTUP_HOME=str(ROOT / '.rustup'))
    for command in ('test', 'build'):
        args = [cargo, command, '--manifest-path', str(ROOT / 'native/Cargo.toml')]
        if command == 'build':
            args.append('--release')
        result = subprocess.run(args, env=env, cwd=ROOT)
        if result.returncode:
            return result.returncode
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
