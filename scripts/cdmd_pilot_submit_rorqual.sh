#!/bin/bash
# The CDMD sub_013 pilot's Slurm stages: tracking, then RecoBundles once it succeeds. The fit
# and tissue maps come from the local run; check runs locally on the downloaded bundles.
# Usage: SLURM_ACCOUNT=<account> CDMD_PILOT_WORK=<dir> bash scripts/cdmd_pilot_submit_rorqual.sh
set -euo pipefail
account="${SLURM_ACCOUNT:?set SLURM_ACCOUNT}"
here="${CDMD_PILOT_WORK:?set CDMD_PILOT_WORK to the cluster work directory}"
mkdir -p "$here/logs"
log="--output=$here/logs/%x_%j.out"
track=$(sbatch --parsable --account="$account" --job-name=cdmd_track --time=03:00:00 --mem=48G --cpus-per-task=64 \
    --export=ALL,CDMD_PILOT_WORK="$here" "$log" "$here/code/scripts/cdmd_pilot.sbatch" track)
bundles=$(sbatch --parsable --account="$account" --job-name=cdmd_bundles --time=03:00:00 --mem=32G --cpus-per-task=1 \
    --export=ALL,CDMD_PILOT_WORK="$here" "$log" --dependency=afterok:"$track" "$here/code/scripts/cdmd_pilot.sbatch" bundles)
printf '%s\n' "$(date -Iseconds)" "track $track" "bundles $bundles" | tee -a "$here/jobs.txt"
