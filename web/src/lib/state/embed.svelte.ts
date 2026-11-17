/** A published anatomy as the index names it, before its manifest is loaded. */
export interface IndexedAnatomy {
  id: string;
  display_name?: string;
}

/**
 * A page opened with `embed=1`, in a frame of someone else's page: it shows the stage alone, and
 * its anatomy downloads only once the reader asks for it (`invite`). The subject is named from the
 * anatomy index before then.
 */
export function createEmbed() {
  let invited = $state(false);
  let subject = $state.raw<IndexedAnatomy | null>(null);
  let resolve!: () => void;
  const promise = new Promise<void>((invited) => (resolve = invited));
  return {
    get invited() {
      return invited;
    },
    /** Resolves once the reader has asked for the anatomy. */
    invitation: promise,
    invite() {
      invited = true;
      resolve();
    },
    get subject() {
      return subject;
    },
    set subject(entry: IndexedAnatomy | null) {
      subject = entry;
    },
  };
}

export type Embed = ReturnType<typeof createEmbed>;
