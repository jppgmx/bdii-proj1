#!/usr/bin/env bash
# Compatibilidade com as instruções publicadas na etapa 1.
exec bash "$(dirname -- "${BASH_SOURCE[0]}")/validate-backend.sh" "$@"
