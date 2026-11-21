#!/bin/bash
# One stage of cdmd_pilot.py in the pilot's venv on a Slurm cluster; further arguments reach the stage.
# cdmd_pilot_submit_rorqual.sh submits it with SLURM_ACCOUNT and CDMD_PILOT_WORK set.
set -euo pipefail
here="${CDMD_PILOT_WORK:?set CDMD_PILOT_WORK to the cluster work directory}"
module load StdEnv/2023 python/3.12
source "$here/venv/bin/activate"
export CDMD_PILOT_WORK="$here"
# Tracking forks one worker per CPU, so each keeps a single BLAS thread.
export OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 FLEXIBLAS_NUM_THREADS=1
python "$here/code/scripts/cdmd_pilot.py" "$@"
