#!/bin/sh

export LD_LIBRARY_PATH=.venv/lib64/python3.13/site-packages/nvidia/cufft/lib:$LD_LIBRARY_PATH
export CUDA_MODULE_LOADING=LAZY

PYTHONPATH=src/proto uvicorn main:app --reload