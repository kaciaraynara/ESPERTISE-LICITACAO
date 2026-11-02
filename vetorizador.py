#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Atalho para executar o robô vetorizador de dentro da pasta EXPERTISE.
"""

import importlib.util
import sys
from pathlib import Path

# Localiza o script em python-extractor (seja na raiz ou relativo)
current_dir = Path(__file__).resolve().parent
candidates = [
    current_dir.parent / "python-extractor" / "vetorizador.py",
    current_dir / "python-extractor" / "vetorizador.py",
]

module_path = next((p for p in candidates if p.is_file()), candidates[0])

spec = importlib.util.spec_from_file_location("vetorizador_impl", module_path)
if not spec or not spec.loader:
    raise FileNotFoundError(f"Não foi possível encontrar vetorizador.py em {module_path}")

vetorizador_impl = importlib.util.module_from_spec(spec)
sys.modules["vetorizador_impl"] = vetorizador_impl
spec.loader.exec_module(vetorizador_impl)

for k, v in vars(vetorizador_impl).items():
    if not k.startswith("__"):
        globals()[k] = v

if __name__ == "__main__":
    sys.exit(vetorizador_impl.main())

