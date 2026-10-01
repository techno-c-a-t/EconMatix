"""
Модуль анализа мультиколлинеарности матрицы.

Определяет число обусловленности матрицы и находит набор строк,
удаление которых снижает число обусловленности до приемлемого уровня (< target_cond или < 10^k).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

import numpy as np
from numpy.typing import NDArray


@dataclass
class RowRemovalCandidate:
    """Кандидат на удаление — строка, при исключении которой
    число обусловленности снижается максимально."""

    row_index: int          # Исходный индекс строки в матрице
    condition_before: float  # Число обусловленности *до* удаления этой строки
    condition_after: float   # Число обусловленности *после* удаления этой строки
    delta: float             # condition_before − condition_after (чем больше, тем лучше)


@dataclass
class MulticollinearityResult:
    """Результат анализа мультиколлинеарности."""

    original_condition_number: float                         # Исходное число обусловленности
    final_condition_number: float                            # Число обусловленности после удаления строк
    threshold: float                                         # Заданный порог обусловленности (target_cond или 10^k)
    rows_to_remove: List[RowRemovalCandidate] = field(default_factory=list)
    is_acceptable: bool = False                              # True, если удалось снизить до порога

    def __str__(self) -> str:
        lines = [
            "=" * 60,
            "  Анализ мультиколлинеарности матрицы",
            "=" * 60,
            f"  Исходное число обусловленности : {self.original_condition_number:.6e}",
            f"  Целевой порог Cond             : {self.threshold:.6e}",
            f"  Итоговое число обусловленности  : {self.final_condition_number:.6e}",
            f"  Результат                       : {'✓ Приемлемо' if self.is_acceptable else '✗ Не удалось снизить до порога'}",
            "-" * 60,
        ]

        if not self.rows_to_remove:
            lines.append("  Удалять строки не требуется — матрица уже приемлема.")
        else:
            lines.append(
                f"  Строки для удаления (отсортированы по Δ, убывание):"
            )
            lines.append(
                f"  {'Шаг':>4}  {'Индекс':>7}  {'Cond до':>14}  {'Cond после':>14}  {'Δ':>14}"
            )
            lines.append("  " + "-" * 57)
            for step, candidate in enumerate(self.rows_to_remove, start=1):
                lines.append(
                    f"  {step:>4}  {candidate.row_index:>7}  "
                    f"{candidate.condition_before:>14.6e}  "
                    f"{candidate.condition_after:>14.6e}  "
                    f"{candidate.delta:>14.6e}"
                )

        lines.append("=" * 60)
        return "\n".join(lines)


def _condition_number(matrix: NDArray[np.floating]) -> float:
    """Вычисляет число обусловленности матрицы через SVD.

    Для неквадратных матриц используется отношение
    максимального сингулярного числа к минимальному.
    Если матрица вырождена (мин. σ ≈ 0), возвращает np.inf.
    """
    singular_values = np.linalg.svd(matrix, compute_uv=False)
    sigma_max = singular_values[0]
    sigma_min = singular_values[-1]

    if sigma_min < np.finfo(float).eps * sigma_max:
        return np.inf

    return float(sigma_max / sigma_min)


def analyze_multicollinearity(
    matrix: NDArray[np.floating],
    k: int | float | None = None,
    *,
    target_cond: float | None = None,
    max_removals: int | None = None,
) -> MulticollinearityResult:
    """Анализирует мультиколлинеарность матрицы и определяет строки для удаления.

    Алгоритм: жадный (greedy). На каждой итерации пробуем удалить каждую
    оставшуюся строку, выбираем ту, при исключении которой число
    обусловленности снижается сильнее всего. Повторяем, пока число
    обусловленности не станет <= threshold или пока удалять строки не выгодно.

    Параметры
    ----------
    matrix : NDArray[np.floating]
        Входная матрица размера (m × n), m ≥ n.
    k : int | float | None, optional
        Показатель степени k для порога 10^k (например, k=2 => порог 100).
        Игнорируется, если явно задан target_cond. По умолчанию k=2.
    target_cond : float | None, optional
        Точное желаемое число обусловленности (порог). Если задан,
        имеет приоритет над k.
    max_removals : int | None, optional
        Максимальное число строк, которые разрешено удалить.

    Возвращает
    ----------
    MulticollinearityResult
        Исходное число обусловленности, итоговое, порог и
        список строк-кандидатов на удаление с дельтами.
    """
    matrix = np.asarray(matrix, dtype=float)

    if matrix.ndim != 2:
        raise ValueError(
            f"Ожидается двумерная матрица, получена размерность {matrix.ndim}."
        )

    m, n = matrix.shape

    if m < n:
        raise ValueError(
            f"Число строк ({m}) должно быть ≥ числу столбцов ({n}). "
            "Транспонируйте матрицу, если это необходимо."
        )

    if target_cond is not None:
        if target_cond <= 0:
            raise ValueError(f"target_cond должен быть > 0, получено {target_cond}.")
        threshold = float(target_cond)
    elif k is not None:
        if k < 0:
            raise ValueError(f"Параметр k должен быть ≥ 0, получено {k}.")
        threshold = 10.0 ** k
    else:
        threshold = 100.0  # k=2 по умолчанию

    original_cond = _condition_number(matrix)

    # Матрица уже приемлема
    if original_cond <= threshold:
        return MulticollinearityResult(
            original_condition_number=original_cond,
            final_condition_number=original_cond,
            threshold=threshold,
            rows_to_remove=[],
            is_acceptable=True,
        )

    # Жадный алгоритм удаления строк
    remaining_indices: list[int] = list(range(m))
    current_cond = original_cond
    removal_limit = max_removals if max_removals is not None else m - n
    removed: list[RowRemovalCandidate] = []

    for _ in range(removal_limit):
        if len(remaining_indices) <= n:
            break

        best_candidate: RowRemovalCandidate | None = None

        for i, orig_idx in enumerate(remaining_indices):
            trial_indices = remaining_indices[:i] + remaining_indices[i + 1:]
            sub_matrix = matrix[trial_indices, :]
            trial_cond = _condition_number(sub_matrix)
            delta = current_cond - trial_cond

            if best_candidate is None or delta > best_candidate.delta:
                best_candidate = RowRemovalCandidate(
                    row_index=orig_idx,
                    condition_before=current_cond,
                    condition_after=trial_cond,
                    delta=delta,
                )

        if best_candidate is None or best_candidate.delta <= 0:
            break

        removed.append(best_candidate)
        remaining_indices.remove(best_candidate.row_index)
        current_cond = best_candidate.condition_after

        # Достигли порога — останавливаемся
        if current_cond <= threshold:
            break

    # Сортируем по убыванию дельты
    removed.sort(key=lambda c: c.delta, reverse=True)

    return MulticollinearityResult(
        original_condition_number=original_cond,
        final_condition_number=current_cond,
        threshold=threshold,
        rows_to_remove=removed,
        is_acceptable=current_cond <= threshold,
    )


if __name__ == "__main__":
    np.random.seed(42)
    base = np.random.randn(8, 3)
    base[2] = base[0] * 2.0 + base[1] * 0.5 + np.random.randn(3) * 1e-4
    base[5] = base[0] * 1.5 - base[1] * 0.3 + np.random.randn(3) * 1e-4

    print("Входная матрица:")
    print(base)
    print()

    result = analyze_multicollinearity(base, target_cond=50.0)
    print(result)
