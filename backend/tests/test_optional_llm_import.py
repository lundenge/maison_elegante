import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_server_imports_without_emergentintegrations():
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT) + os.pathsep + env.get("PYTHONPATH", "")

    result = subprocess.run(
        [sys.executable, "-c", "import server; print('OK')"],
        cwd=str(ROOT),
        env=env,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
