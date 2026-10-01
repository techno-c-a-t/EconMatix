#!/usr/bin/env python3
"""
Скрипт для анализа мультиколлинеарности матрицы из файла .npy.

Использование:
    python run_analysis.py matrix.npy
    python run_analysis.py matrix.npy -k 3
    python run_analysis.py matrix.npy --target-cond 175.0
    python run_analysis.py matrix.npy --target-cond 170.0 --save-cleaned cleaned_matrix.npy
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

from multicollinearity import analyze_multicollinearity


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Поиск мультиколлинеарности матрицы и отбор строк для удаления из .npy файла."
    )
    parser.add_argument(
        "file",
        type=Path,
        help="Путь к файлу .npy с матрицей.",
    )
    parser.add_argument(
        "-k",
        "--k",
        type=float,
        default=None,
        help="Показатель степени k для порога 10^k (например, 2 => порог 100).",
    )
    parser.add_argument(
        "-c",
        "--target-cond",
        type=float,
        default=None,
        help="Точное желаемое число обусловленности (порог Cond, например 175.0 или 170.0).",
    )
    parser.add_argument(
        "--max-removals",
        type=int,
        default=None,
        help="Максимальное количество строк, разрешённых к удалению (по умолчанию: без ограничений, пока m > n).",
    )
    parser.add_argument(
        "-o",
        "--save-cleaned",
        type=Path,
        default=None,
        help="Опциональный путь к .npy файлу для сохранения отфильтрованной матрицы (без удалённых строк).",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not args.file.is_file():
        print(f"Ошибка: Файл '{args.file}' не найден.", file=sys.stderr)
        sys.exit(1)

    try:
        matrix = np.load(args.file)
    except Exception as e:
        print(f"Ошибка при загрузке .npy файла: {e}", file=sys.stderr)
        sys.exit(1)

    if not isinstance(matrix, np.ndarray):
        print(
            f"Ошибка: объект в файле не является массивом NumPy (тип: {type(matrix)}).",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Файл: {args.file}")
    print(f"Размерность матрицы: {matrix.shape[0]} строк × {matrix.shape[1]} столбцов, dtype={matrix.dtype}")
    print()

    # Если не указан ни target_cond, ни k, используем k=2 (порог 100)
    k_val = args.k if (args.k is not None or args.target_cond is not None) else 2.0

    try:
        result = analyze_multicollinearity(
            matrix,
            k=k_val,
            target_cond=args.target_cond,
            max_removals=args.max_removals,
        )
    except Exception as e:
        print(f"Ошибка во время анализа матрицы: {e}", file=sys.stderr)
        sys.exit(1)

    # Вывод результатов
    print(result)

    # Если задан путь для сохранения очищенной матрицы
    if args.save_cleaned is not None:
        removed_indices = {candidate.row_index for candidate in result.rows_to_remove}
        remaining_indices = [i for i in range(matrix.shape[0]) if i not in removed_indices]
        cleaned_matrix = matrix[remaining_indices, :]

        try:
            np.save(args.save_cleaned, cleaned_matrix)
            print(f"\nОчищенная матрица сохранена в: {args.save_cleaned} (размер: {cleaned_matrix.shape})")
        except Exception as e:
            print(f"\nОшибка при сохранении очищенной матрицы: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
