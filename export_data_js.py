#!/usr/bin/env python3
"""
Скрипт объединения schools_data.json и analytics.json в data.js
для автономной работы дашборда без проблем с CORS при локальном открытии.
"""

import json

with open("schools_data.json", "r", encoding="utf-8") as f:
    schools_data = json.load(f)

with open("analytics.json", "r", encoding="utf-8") as f:
    analytics_data = json.load(f)

combined = {
    "schools": schools_data["schools"],
    "factors": schools_data["factors"],
    "metadata": schools_data["metadata"],
    "matrix": schools_data["matrix"],
    "transposed_matrix": schools_data["transposed_matrix"],
    "analytics": analytics_data
}

js_content = f"// Автоматически сгенерированные данные матрицы экономических школ\nwindow.ECONOMIC_DATA = {json.dumps(combined, ensure_ascii=False, indent=2)};\n"

with open("data.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"data.js успешно создан! Размер: {len(js_content)} байт.")
