#!/bin/bash
# Every Neurosynth term's consistency map on a Slurm cluster, then the merged table once all tasks succeed.
# A task that times out leaves its finished terms; resubmitting fits only the rest.
# Usage: SLURM_ACCOUNT=<account> NEUROSYNTH_TERMS_WORK=<dir> bash scripts/derive_term_scores_submit_rorqual.sh <tasks> <cpus> <gb-per-cpu> <out>
set -euo pipefail
account="${SLURM_ACCOUNT:?set SLURM_ACCOUNT}"
here="${NEUROSYNTH_TERMS_WORK:?set NEUROSYNTH_TERMS_WORK to the cluster work directory}"
tasks=${1:?number of array tasks}
cpus=${2:?CPUs per task}
out=${4:?output folder, fresh for a changed method}
mkdir -p "$out" "$here/logs"
log="--output=$here/logs/%x_%A_%a.out"
fit=$(sbatch --parsable --account="$account" --job-name=ns_terms --array=0-$((tasks - 1)) --time=03:00:00 \
    --export=ALL,NEUROSYNTH_TERMS_WORK="$here",OUT="$out" \
    --cpus-per-task="$cpus" --mem-per-cpu="${3:?GB per CPU}G" "$log" "$here/code/scripts/derive_term_scores.sbatch")
merge=$(sbatch --parsable --account="$account" --job-name=ns_merge --time=00:30:00 --mem=8G \
    --cpus-per-task=1 --output="$here/logs/%x_%j.out" --dependency=afterok:"$fit" \
    --wrap "module load StdEnv/2023 python/3.12 && source $here/venv/bin/activate && python $here/code/scripts/derive_term_scores.py merge $out")
printf '%s\n' "$(date -Iseconds)" "fit $fit ($tasks x $cpus CPUs) -> $out" "merge $merge" | tee -a "$here/jobs.txt"
