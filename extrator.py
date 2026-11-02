#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Atalho para executar o robô extrator de dentro da pasta EXPERTISE.
"""

import importlib.util
import sys
from pathlib import Path

current_dir = Path(__file__).resolve().parent
candidates = [
    current_dir.parent / "python-extractor" / "extrator.py",
    current_dir / "python-extractor" / "extrator.py",
]

module_path = next((p for p in candidates if p.is_file()), candidates[0])

spec = importlib.util.spec_from_file_location("extrator_impl", module_path)
if not spec or not spec.loader:
    raise FileNotFoundError(f"Não foi possível encontrar extrator.py em {module_path}")

extrator_impl = importlib.util.module_from_spec(spec)
sys.modules["extrator_impl"] = extrator_impl
spec.loader.exec_module(extrator_impl)

for k, v in vars(extrator_impl).items():
    if not k.startswith("__"):
        globals()[k] = v

if __name__ == "__main__":
    sys.exit(extrator_impl.main())

