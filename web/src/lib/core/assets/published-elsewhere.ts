import type { PublishedRecord } from './published-files.ts';

/**
 * The published files of every anatomy but the index default. The build (build/published-files.ts)
 * writes them here rather than into the entry's map, and `loadOtherAnatomyFiles` adds them before
 * such a brain is opened. Empty without the build.
 */
const ELSEWHERE: Record<string, PublishedRecord> = {};

export default ELSEWHERE;
