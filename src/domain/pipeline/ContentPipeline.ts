export type ContentStatus = 'pending' | 'approved' | 'rejected';

export interface ContentMedia {
  kind: 'image' | 'video';
  url: string;
  name: string;
}

export interface ContentSubmission {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  media?: ContentMedia;
  submittedAt: string;
  status: ContentStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface ContentDraft {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  media?: ContentMedia;
  submittedAt: string;
}

export class ContentPipeline {
  private readonly submissions: ContentSubmission[];

  constructor(submissions: ContentSubmission[] = []) {
    this.submissions = [...submissions];
  }

  submit(draft: ContentDraft): ContentSubmission {
    if (!draft.text.trim() && !draft.media) {
      throw new Error('A submission needs text or media.');
    }

    const submission: ContentSubmission = { ...draft, text: draft.text.trim(), status: 'pending' };
    this.submissions.unshift(submission);
    return submission;
  }

  approve(submissionId: string, reviewerId: string, reviewedAt: string): ContentSubmission {
    return this.review(submissionId, 'approved', reviewerId, reviewedAt);
  }

  reject(submissionId: string, reviewerId: string, reviewedAt: string, note?: string): ContentSubmission {
    return this.review(submissionId, 'rejected', reviewerId, reviewedAt, note);
  }

  getPending(): readonly ContentSubmission[] {
    return this.submissions.filter((submission) => submission.status === 'pending');
  }

  getPublished(authorId?: string): readonly ContentSubmission[] {
    return this.submissions.filter(
      (submission) => submission.status === 'approved' && (!authorId || submission.authorId === authorId),
    );
  }

  getForAuthor(authorId: string): readonly ContentSubmission[] {
    return this.submissions.filter((submission) => submission.authorId === authorId);
  }

  getAll(): readonly ContentSubmission[] {
    return [...this.submissions];
  }

  private review(
    submissionId: string,
    status: Exclude<ContentStatus, 'pending'>,
    reviewerId: string,
    reviewedAt: string,
    note?: string,
  ): ContentSubmission {
    const submission = this.submissions.find((entry) => entry.id === submissionId);

    if (!submission) {
      throw new Error(`Submission ${submissionId} was not found.`);
    }

    if (submission.status !== 'pending') {
      throw new Error('Only pending submissions can be reviewed.');
    }

    submission.status = status;
    submission.reviewedBy = reviewerId;
    submission.reviewedAt = reviewedAt;
    submission.reviewNote = note;
    return submission;
  }
}
