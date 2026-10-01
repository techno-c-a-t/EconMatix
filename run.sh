#!/usr/bin/env bash
# Точка входа для запуска проекта EconMatrix
set -e
cd "$(dirname "$0")"
python3 main.py "$@"
