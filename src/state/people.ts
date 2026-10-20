import { create } from 'zustand';

import {
  loadFaces,
  loadPeople,
  mergePeople,
  rejectFromPerson,
  renamePerson,
  setPersonHidden,
} from '@/db/people-repo';
import { peopleSummaries, type PersonSummary } from '@/domain/people';

/**
 * People found on this iPhone (ADR-0011), for the People screens. Loaded
 * from the database without fingerprints; every change is written first,
 * then reloaded, so the screens never show something that wasn't saved.
 */
type PeopleState = {
  loaded: boolean;
  people: readonly PersonSummary[];
  load: () => Promise<void>;
  rename: (personId: number, name: string) => Promise<void>;
  hide: (personId: number) => Promise<void>;
  merge: (fromId: number, intoId: number) => Promise<void>;
  /** "Not this person" for these photos. */
  reject: (personId: number, assetIds: readonly string[]) => Promise<void>;
  reset: () => void;
};

export const usePeople = create<PeopleState>()((set, get) => ({
  loaded: false,
  people: [],
  load: async () => {
    const [people, faces] = await Promise.all([loadPeople(), loadFaces()]);
    set({ loaded: true, people: peopleSummaries(people, faces) });
  },
  rename: async (personId, name) => {
    await renamePerson(personId, name);
    await get().load();
  },
  hide: async (personId) => {
    await setPersonHidden(personId, true);
    await get().load();
  },
  merge: async (fromId, intoId) => {
    await mergePeople(fromId, intoId);
    await get().load();
  },
  reject: async (personId, assetIds) => {
    await rejectFromPerson(personId, assetIds);
    await get().load();
  },
  reset: () => set({ loaded: false, people: [] }),
}));
