import { describe, expect, it } from 'vitest';

import { ContentPipeline } from './ContentPipeline';

const draft = (id: string, text = 'Practice round highlights') => ({
  id,
  authorId: 'ricky-wysocki',
  authorName: 'Ricky Wysocki',
  text,
  submittedAt: '2026-09-03T12:00:00.000Z',
});

describe('Content pipeline', () => {
  it('Submitted posts stay pending until the league approves them', () => {
    const pipeline = new ContentPipeline();
    pipeline.submit(draft('post-1'));

    expect(pipeline.getPending()).toHaveLength(1);
    expect(pipeline.getPublished()).toHaveLength(0);

    pipeline.approve('post-1', 'league-admin', '2026-09-03T13:00:00.000Z');

    expect(pipeline.getPending()).toHaveLength(0);
    expect(pipeline.getPublished()).toHaveLength(1);
  });

  it('Rejected posts never go public and keep the reviewer note', () => {
    const pipeline = new ContentPipeline();
    pipeline.submit(draft('post-2', 'Sponsor claim that needs checking'));
    pipeline.reject('post-2', 'league-admin', '2026-09-03T13:05:00.000Z', 'Confirm the sponsor wording first.');

    expect(pipeline.getPublished()).toHaveLength(0);
    expect(pipeline.getForAuthor('ricky-wysocki')[0].reviewNote).toBe('Confirm the sponsor wording first.');
  });

  it('A submission can only be reviewed once', () => {
    const pipeline = new ContentPipeline();
    pipeline.submit(draft('post-3'));
    pipeline.approve('post-3', 'league-admin', '2026-09-03T13:10:00.000Z');

    expect(() => pipeline.approve('post-3', 'league-admin', '2026-09-03T13:15:00.000Z')).toThrow(
      'Only pending submissions can be reviewed.',
    );
  });

  it('Empty submissions are rejected before they enter the pipeline', () => {
    const pipeline = new ContentPipeline();

    expect(() => pipeline.submit(draft('post-4', '   '))).toThrow('A submission needs text or media.');
  });
});
