import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompareFacesCommand } from '@aws-sdk/client-rekognition';
import { rekognitionFaceVerifier, rekognitionStatus, unavailableFaceVerifier } from './faceVerification';

/** The face-verification adapter, against a fake Rekognition client (no network). */
const id = { buffer: Buffer.from('id-card'), mime: 'image/jpeg' };
const selfie = { buffer: Buffer.from('selfie'), mime: 'image/jpeg' };

function fakeClient(reply: (cmd: CompareFacesCommand) => unknown) {
  const sent: CompareFacesCommand[] = [];
  return {
    sent,
    client: {
      async send(cmd: CompareFacesCommand) {
        sent.push(cmd);
        const r = reply(cmd);
        if (r instanceof Error) throw r;
        return r as { FaceMatches?: { Similarity?: number }[] };
      },
    },
  };
}

function awsError(name: string) {
  const e = new Error(name);
  e.name = name;
  return e;
}

describe('face verification', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('sends the selfie as the face to find and the ID as where to find it', async () => {
    const { sent, client } = fakeClient(() => ({ FaceMatches: [{ Similarity: 99.4 }] }));
    const r = await rekognitionFaceVerifier({ client }).compare(id, selfie);
    expect(r).toMatchObject({ status: 'MATCH', provider: 'aws-rekognition', confidence: 99.4 });
    expect(sent[0].input.SourceImage?.Bytes).toEqual(selfie.buffer);
    expect(sent[0].input.TargetImage?.Bytes).toEqual(id.buffer);
    expect(sent[0].input.SimilarityThreshold).toBe(0);
  });

  it('uses the best of several faces on the ID (cards with a ghost portrait)', async () => {
    const { client } = fakeClient(() => ({ FaceMatches: [{ Similarity: 62 }, { Similarity: 96.2 }] }));
    expect((await rekognitionFaceVerifier({ client }).compare(id, selfie)).confidence).toBe(96.2);
  });

  it('reports what the service says: uncertain and no match are flagged for the reviewer', async () => {
    expect(rekognitionStatus(95, 95)).toBe('MATCH');
    expect(rekognitionStatus(94.9, 95)).toBe('LOW_CONFIDENCE');
    expect(rekognitionStatus(80, 95)).toBe('LOW_CONFIDENCE');
    expect(rekognitionStatus(79.9, 95)).toBe('NO_MATCH');
    const { client } = fakeClient(() => ({ FaceMatches: [{ Similarity: 41 }] }));
    expect((await rekognitionFaceVerifier({ client, minSimilarity: 95 }).compare(id, selfie)).status).toBe('NO_MATCH');
  });

  it('never reports a match when no face is found or the service fails', async () => {
    const none = fakeClient(() => ({ FaceMatches: [], UnmatchedFaces: [] }));
    expect(await rekognitionFaceVerifier({ client: none.client }).compare(id, selfie)).toMatchObject({ status: 'FAILED', confidence: null });
    const noFace = fakeClient(() => awsError('InvalidParameterException'));
    expect((await rekognitionFaceVerifier({ client: noFace.client }).compare(id, selfie)).details).toMatch(/Retake it/);
    const down = fakeClient(() => awsError('ThrottlingException'));
    expect(await rekognitionFaceVerifier({ client: down.client }).compare(id, selfie)).toMatchObject({ status: 'FAILED', provider: 'aws-rekognition' });
  });

  it('without a configured service, says so and leaves the comparison to staff', async () => {
    expect(await unavailableFaceVerifier.compare(id, selfie)).toMatchObject({ status: 'UNAVAILABLE', provider: null, confidence: null });
    vi.resetModules();
    vi.stubEnv('FACE_VERIFICATION_PROVIDER', 'aws-rekognition');
    vi.stubEnv('AWS_REGION', '');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { defaultFaceVerifier } = await import('./faceVerification');
    expect(defaultFaceVerifier().provider).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
