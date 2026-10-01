#!/usr/bin/env python3
"""
Главная точка входа проекта EconMatrix:
Анализ мультиколлинеарности матрицы 34 экономических школ по 50 факторам
и запуск интерактивного визуального веб-дашборда.

Использование:
    python3 main.py               # Запуск веб-дашборда и открытие в браузере (порт 8088)
    python3 main.py --port 8090   # Запуск на другом порту
    python3 main.py --rebuild     # Принудительный пересчет матрицы и аналитики
    python3 main.py --cli-only    # Только консольный вывод анализа мультиколлинеарности
"""

from __future__ import annotations

import argparse
import http.server
import os
import socketserver
import sys
import threading
import time
import webbrowser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def check_or_rebuild_data(force: bool = False) -> None:
    """Проверяет наличие артефактов данных и при необходимости пересобирает их."""
    required_files = [
        BASE_DIR / "schools_matrix.npy",
        BASE_DIR / "schools_matrix_transposed.npy",
        BASE_DIR / "schools_data.json",
        BASE_DIR / "analytics.json",
        BASE_DIR / "data.js"
    ]

    need_rebuild = force or any(not p.is_file() for p in required_files)
    if need_rebuild:
        print("\033[1;36m[EconMatrix]\033[0m Сборка матрицы (34 школы × 50 критериев)...")
        import generate_data
        generate_data.build_and_save()

        print("\033[1;36m[EconMatrix]\033[0m Расчет SVD, PCA, кластеризации и генеалогического древа...")
        import process_analytics
        process_analytics.run_analytics()

        print("\033[1;36m[EconMatrix]\033[0m Экспорт данных для браузера (data.js)...")
        import export_data_js
        # export_data_js выполняет экспорт при импорте / прямом вызове
        print("\033[1;32m✓\033[0m Все файлы данных успешно подготовлены.\n")

def print_cli_summary(target_cond: float | None = None, k: float | None = None) -> None:
    """Выводит в терминал сводку анализа мультиколлинеарности с заданным числом обусловленности."""
    import numpy as np
    from multicollinearity import analyze_multicollinearity
    from build_economic_matrix import FACTORS

    matrix_file = BASE_DIR / "schools_matrix_transposed.npy"
    if not matrix_file.is_file():
        check_or_rebuild_data()

    transposed = np.load(matrix_file)
    print("\033[1;35m" + "=" * 68 + "\033[0m")
    print("\033[1;37m  ЭКОНОМИЧЕСКИЙ АТЛАС: АНАЛИЗ МУЛЬТИКОЛЛИНЕАРНОСТИ МАТРИЦЫ\033[0m")
    print("\033[1;35m" + "=" * 68 + "\033[0m")
    print(f"  Размерность: {transposed.shape[0]} критериев (строк) × {transposed.shape[1]} школ (столбцов)")

    k_val = k if (k is not None or target_cond is not None) else 2.0
    result = analyze_multicollinearity(transposed, k=k_val, target_cond=target_cond)

    print(f"  Исходное число обусловленности : \033[1;33m{result.original_condition_number:.4f}\033[0m")
    if target_cond is not None:
        print(f"  Целевой порог (Target Cond)    : \033[1;36m{result.threshold:.4f}\033[0m")
    else:
        print(f"  Порог (10^k, k={k_val})              : \033[1;37m{result.threshold:.1f}\033[0m")
    print(f"  Итоговое число обусловленности  : \033[1;32m{result.final_condition_number:.4f}\033[0m")
    status_str = "\033[1;32m✓ Порог достигнут\033[0m" if result.is_acceptable else "\033[1;33mОстановлено (достигнут локальный минимум Cond)\033[0m"
    print(f"  Статус                         : {status_str}")
    print(f"  Удалено избыточных критериев   : \033[1;36m{len(result.rows_to_remove)}\033[0m из 50")
    print("-" * 68)
    if result.rows_to_remove:
        print("  Шаг | Индекс | Критерий                              |  Δ Cond")
        print("-" * 68)
        for step, cand in enumerate(result.rows_to_remove, start=1):
            f_name = FACTORS[cand.row_index]["name_ru"][:36]
            print(f"  {step:>3} | {cand.row_index:>6} | {f_name:<36} | +{cand.delta:>6.3f}")
    else:
        print("  Критерии не удалялись (исходное число обусловленности уже <= порога)")
    print("\033[1;35m" + "=" * 68 + "\033[0m\n")

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

def start_server(port: int = 8088, auto_open: bool = True) -> None:
    """Запускает встроенный веб-сервер и открывает интерфейс в браузере."""
    os.chdir(BASE_DIR)
    handler = http.server.SimpleHTTPRequestHandler

    try:
        httpd = ReusableTCPServer(("127.0.0.1", port), handler)
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"\033[1;33m[!] Порт {port} уже занят (возможно, сервер уже запущен).\033[0m")
            print(f"\033[1;32m→ Откройте веб-интерфейс по ссылке:\033[0m \033[1;36mhttp://127.0.0.1:{port}/\033[0m\n")
            if auto_open:
                webbrowser.open(f"http://127.0.0.1:{port}/")
            return
        raise

    url = f"http://127.0.0.1:{port}/"
    print("\033[1;32m" + "─" * 68 + "\033[0m")
    print(f"\033[1;32m  ✓ Веб-сервер запущен!\033[0m")
    print(f"  Ссылка на интерактивный дашборд: \033[1;36;4m{url}\033[0m")
    print("  Нажмите \033[1;31mCtrl+C\033[0m для остановки сервера.")
    print("\033[1;32m" + "─" * 68 + "\033[0m\n")

    if auto_open:
        # Небольшая задержка перед открытием браузера
        threading.Thread(target=lambda: (time.sleep(0.5), webbrowser.open(url)), daemon=True).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\033[1;33m[EconMatrix]\033[0m Сервер остановлен пользователем.")
        httpd.server_close()

def main() -> None:
    parser = argparse.ArgumentParser(
        description="EconMatrix: Точка входа для запуска анализа и веб-интерфейса."
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8088,
        help="Порт локального веб-сервера (по умолчанию 8088)."
    )
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Принудительно пересчитать матрицу и все аналитические данные."
    )
    parser.add_argument(
        "-c",
        "--target-cond",
        type=float,
        default=None,
        help="Точное целевое число обусловленности матрицы (порог Cond, например 180.0 или 175.0)."
    )
    parser.add_argument(
        "-k",
        "--k",
        type=float,
        default=None,
        help="Показатель степени k для порога 10^k (например, 2 => порог 100)."
    )
    parser.add_argument(
        "--cli-only",
        action="store_true",
        help="Вывести результаты анализа мультиколлинеарности в консоль без запуска сервера."
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Не открывать браузер автоматически."
    )

    args = parser.parse_args()

    check_or_rebuild_data(force=args.rebuild)

    if args.cli_only:
        print_cli_summary(target_cond=args.target_cond, k=args.k)
        return

    print_cli_summary(target_cond=args.target_cond, k=args.k)
    start_server(port=args.port, auto_open=not args.no_browser)

if __name__ == "__main__":
    main()
