import { batchDetails, batchHeadline, creationLabel, summarizeRemovals } from './activity';

const at = 1_700_000_000_000;

describe('activity', () => {
  it('groups removal outcomes by batch, newest first', () => {
    const batches = summarizeRemovals([
      { batchId: 'a', assetId: '1', outcome: 'removed', reason: null, at },
      { batchId: 'a', assetId: '2', outcome: 'removed', reason: null, at },
      { batchId: 'a', assetId: '3', outcome: 'skipped', reason: 'favorite', at },
      { batchId: 'b', assetId: '4', outcome: 'canceled', reason: null, at: at + 10 },
    ]);
    expect(batches.map((batch) => batch.batchId)).toEqual(['b', 'a']);
    expect(batches[1]).toMatchObject({ removed: 2, skipped: 1, canceled: 0 });
    expect(batches[1].reasons).toEqual([{ text: 'Marked as a favorite', count: 1 }]);
  });

  it('says only what really happened', () => {
    const [removed] = summarizeRemovals([
      { batchId: 'a', assetId: '1', outcome: 'removed', reason: null, at },
      { batchId: 'a', assetId: '2', outcome: 'still-there', reason: null, at },
    ]);
    expect(batchHeadline(removed)).toBe('Moved 1 photo to Recently Deleted');
    expect(batchDetails(removed)).toEqual(['1 photo still in Photos afterwards']);

    const [canceled] = summarizeRemovals([
      { batchId: 'c', assetId: '1', outcome: 'canceled', reason: null, at },
    ]);
    expect(batchHeadline(canceled)).toBe('You canceled in the iOS confirmation');

    const [skipped] = summarizeRemovals([
      { batchId: 'd', assetId: '1', outcome: 'skipped', reason: 'gone', at },
    ]);
    expect(batchHeadline(skipped)).toBe('Nothing removed: everything was skipped');
    expect(batchDetails(skipped)).toEqual(['Already gone from Photos: 1 skipped']);
  });

  it('names creations from their recipe', () => {
    expect(creationLabel('{"tool":"collage"}', 'jpeg')).toBe('Collage');
    expect(creationLabel('{"quality":0.8}', 'jpeg')).toBe('Smaller copy');
    expect(creationLabel('not json', 'mp4')).toBe('Video');
  });
});
