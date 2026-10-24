import { pcmToWav } from './tts.service';

describe('pcmToWav', () => {
  it('writes a valid 44-byte RIFF/WAVE header before the samples', () => {
    const pcm = Buffer.alloc(480, 1);
    const wav = pcmToWav(pcm);
    expect(wav.length).toBe(44 + 480);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.readUInt32LE(24)).toBe(24000); // sample rate
    expect(wav.readUInt32LE(40)).toBe(480); // data size
  });
});
