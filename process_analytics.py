#!/usr/bin/env python3
"""
Скрипт глубокого аналитического анализа матрицы:
- SVD / PCA для школ и для факторов (2D и 3D координаты, нагрузки)
- Корреляционная матрица факторов
- Матрица близости (косинусное сходство) между экономическими школами
- Полный лог работы алгоритма мультиколлинеарности
- Иерархическая кластеризация школ (dendrogram tree)
"""

from __future__ import annotations
import json
from pathlib import Path
import numpy as np
from scipy.spatial.distance import pdist, squareform
from scipy.cluster.hierarchy import linkage, to_tree

from build_economic_matrix import SCHOOLS, FACTORS
from multicollinearity import analyze_multicollinearity
from genealogy_tree import GENEALOGY_TREE

def run_analytics():
    # Загружаем матрицу
    matrix = np.load("schools_matrix.npy") # (34, 50)
    transposed = np.load("schools_matrix_transposed.npy") # (50, 34)

    m_schools, n_factors = matrix.shape

    # 1. Запуск анализа мультиколлинеарности на транспонированной матрице
    res_k2 = analyze_multicollinearity(transposed, k=2)

    # Сингулярные числа транспонированной матрицы до и после
    svd_orig = np.linalg.svd(transposed, compute_uv=False)
    
    removed_idx_set = {cand.row_index for cand in res_k2.rows_to_remove}
    remaining_idx = [i for i in range(n_factors) if i not in removed_idx_set]
    transposed_cleaned = transposed[remaining_idx, :]
    svd_cleaned = np.linalg.svd(transposed_cleaned, compute_uv=False)

    removal_history = []
    for step, cand in enumerate(res_k2.rows_to_remove, start=1):
        factor_info = FACTORS[cand.row_index]
        removal_history.append({
            "step": step,
            "factor_index": cand.row_index,
            "factor_id": factor_info["id"],
            "factor_name": factor_info["name_ru"],
            "category": factor_info["category"],
            "condition_before": float(cand.condition_before),
            "condition_after": float(cand.condition_after),
            "delta": float(cand.delta)
        })

    # Пошаговые матрицы и SVD для всех уровней обусловленности от 0 до 10 удалений
    steps_data = []
    steps_data.append({
        "step": 0,
        "condition_number": float(svd_orig[0] / svd_orig[-1]),
        "delta": 0.0,
        "factor_index": None,
        "factor_id": None,
        "factor_name": "Исходная матрица (без фильтрации)",
        "category": "Все",
        "removed_indices": [],
        "remaining_indices": list(range(n_factors)),
        "singular_values": [float(v) for v in svd_orig]
    })

    curr_rem_indices = []
    for step_num, cand in enumerate(res_k2.rows_to_remove, start=1):
        curr_rem_indices.append(cand.row_index)
        rem = [i for i in range(n_factors) if i not in curr_rem_indices]
        sub_mat = transposed[rem, :]
        sv_step = np.linalg.svd(sub_mat, compute_uv=False)
        cond_step = float(sv_step[0] / sv_step[-1])
        f_info = FACTORS[cand.row_index]
        steps_data.append({
            "step": step_num,
            "condition_number": cond_step,
            "condition_before": float(cand.condition_before),
            "condition_after": float(cand.condition_after),
            "delta": float(cand.delta),
            "factor_index": cand.row_index,
            "factor_id": f_info["id"],
            "factor_name": f_info["name_ru"],
            "category": f_info["category"],
            "removed_indices": list(curr_rem_indices),
            "remaining_indices": rem,
            "singular_values": [float(v) for v in sv_step]
        })

    # 2. PCA для школ (34 объекта, 50 признаков)
    # Центрируем матрицу
    X_centered = matrix - np.mean(matrix, axis=0)
    U, S, Vt = np.linalg.svd(X_centered, full_matrices=False)
    variance_explained = (S ** 2) / np.sum(S ** 2)
    
    # 2D и 3D координаты школ
    pca_schools_2d = U[:, :2] * S[:2]
    pca_schools_3d = U[:, :3] * S[:3]

    # Нагрузки факторов на первые 2 главные компоненты
    factor_loadings_2d = Vt[:2, :].T * S[:2] / np.sqrt(m_schools - 1)

    schools_pca = []
    for i, s in enumerate(SCHOOLS):
        schools_pca.append({
            "id": s["id"],
            "name_ru": s["name_ru"],
            "name_en": s["name_en"],
            "x": float(pca_schools_2d[i, 0]),
            "y": float(pca_schools_2d[i, 1]),
            "z": float(pca_schools_3d[i, 2])
        })

    factors_pca = []
    for j, f in enumerate(FACTORS):
        factors_pca.append({
            "id": f["id"],
            "name_ru": f["name_ru"],
            "category": f["category"],
            "x": float(factor_loadings_2d[j, 0]),
            "y": float(factor_loadings_2d[j, 1]),
            "is_removed_in_cleaned": j in removed_idx_set
        })

    # 3. Косинусное сходство между школами
    # Нормализуем векторы школ
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    matrix_normalized = matrix / np.where(norms == 0, 1, norms)
    school_similarity = np.dot(matrix_normalized, matrix_normalized.T)

    # 4. Кластеризация школ (Иерархическая кластеризация Ward)
    # Расстояние: 1 - cosine_similarity (или евклидово)
    dist_matrix = pdist(matrix_normalized, metric='cosine')
    linkage_matrix = linkage(dist_matrix, method='average')
    
    # Преобразуем дерево для визуализации
    def tree_to_dict(node):
        if node.is_leaf():
            return {
                "name": SCHOOLS[node.id]["name_ru"],
                "id": SCHOOLS[node.id]["id"],
                "is_leaf": True
            }
        return {
            "dist": float(node.dist),
            "is_leaf": False,
            "children": [tree_to_dict(node.left), tree_to_dict(node.right)]
        }
    
    root_node = to_tree(linkage_matrix)
    dendrogram_tree = tree_to_dict(root_node)

    # 5. Корреляция между факторами (50 x 50)
    factor_corr = np.corrcoef(matrix.T)

    # Топ коррелирующих пар факторов (по модулю r)
    top_correlated_pairs = []
    for i in range(n_factors):
        for j in range(i + 1, n_factors):
            r = float(factor_corr[i, j])
            if abs(r) >= 0.70:
                top_correlated_pairs.append({
                    "factor1_id": FACTORS[i]["id"],
                    "factor1_name": FACTORS[i]["name_ru"],
                    "factor2_id": FACTORS[j]["id"],
                    "factor2_name": FACTORS[j]["name_ru"],
                    "correlation": r,
                    "abs_correlation": abs(r),
                    "factor1_removed": i in removed_idx_set,
                    "factor2_removed": j in removed_idx_set
                })
    top_correlated_pairs.sort(key=lambda x: x["abs_correlation"], reverse=True)

    # 6. Сборка итогового JSON
    analytics = {
        "multicollinearity": {
            "matrix_shape": list(transposed.shape),
            "cleaned_matrix_shape": list(transposed_cleaned.shape),
            "k": 2,
            "threshold": float(res_k2.threshold),
            "original_condition_number": float(res_k2.original_condition_number),
            "final_condition_number": float(res_k2.final_condition_number),
            "min_condition_number": float(steps_data[-1]["condition_number"]),
            "max_condition_number": float(steps_data[0]["condition_number"]),
            "is_acceptable": bool(res_k2.is_acceptable),
            "singular_values_original": [float(v) for v in svd_orig],
            "singular_values_cleaned": [float(v) for v in svd_cleaned],
            "removal_history": removal_history,
            "steps": steps_data,
            "removed_indices": sorted(list(removed_idx_set)),
            "remaining_indices": remaining_idx
        },
        "pca": {
            "variance_explained": [float(v) for v in variance_explained[:5]],
            "schools": schools_pca,
            "factors": factors_pca
        },
        "similarity": {
            "school_similarity_matrix": school_similarity.tolist(),
            "dendrogram_tree": dendrogram_tree
        },
        "genealogy_tree": GENEALOGY_TREE,
        "top_factor_correlations": top_correlated_pairs[:30]
    }

    with open("analytics.json", "w", encoding="utf-8") as f:
        json.dump(analytics, f, ensure_ascii=False, indent=2)

    print("Аналитика успешно рассчитана и сохранена в analytics.json")
    print(f"Исходное число обусловленности: {res_k2.original_condition_number:.2f}")
    print(f"Число обусловленности после фильтрации: {res_k2.final_condition_number:.2f}")
    print(f"Удалено факторов (строк транспонированной матрицы): {len(res_k2.rows_to_remove)}")
    print(f"Высококоррелирующих пар (|r| >= 0.7): {len(top_correlated_pairs)}")

if __name__ == "__main__":
    run_analytics()
