"""
Record every spoken line with Kokoro (open-source TTS, Apache-2.0 weights),
check each recording with Parakeet speech recognition, and write small MP3s.

Runs at development time only; the game ships the MP3s, never the models.
Usage: python generate.py <jobs.json> <out_dir> <model_dir> <results.json>
  jobs.json: [{"key", "voice", "text", "file"}]  (written by extract.mjs)
Only jobs whose MP3 doesn't exist yet are recorded.
"""
import difflib
import json
import os
import re
import subprocess
import sys
import tempfile
import time

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

# character -> (Kokoro voice, speaking speed). Slightly slow for young listeners.
CASTING = {
    "narrator": ("af_heart", 0.9),
    "pip": ("af_bella", 0.98),
    "fizz": ("am_puck", 0.98),
    "moss": ("am_michael", 0.88),
    "luma": ("bf_emma", 0.92),
    "rowan": ("bm_george", 0.9),
    "avatar": ("af_kore", 0.95),
    "newt": ("bm_fable", 0.95),
}

NAMES = {"pip", "moss", "fizz", "luma", "rowan", "wonderwood"}


def tts_text(text: str) -> str:
    """Typographic text -> what the voice model reads best."""
    t = text.replace("’", "'").replace("‘", "'").replace("“", "").replace("”", "").replace('"', "")
    t = t.replace("—", ", ").replace("–", ", ").replace("…", "...")
    t = re.sub(r"\s+", " ", t).strip()
    return t


# what recognition writes differently from our text without the speech being wrong
SAME = {
    "colour": "color", "favourite": "favorite", "grey": "gray", "theatre": "theater", "metre": "meter",
    "wanna": "want to", "gonna": "going to", "gotta": "got to", "okay": "ok", "o.k.": "ok",
    "tale": "tail", "high": "hi",
}
FILLERS = {"hmm", "hm", "hem", "um", "uh", "mm", "mmm", "oh", "ooh", "ah", "aw", "eep", "ep", "whee", "shh", "sh"}


def words(text: str) -> list:
    t = tts_text(text).lower().replace("-", " ")
    out = []
    for w in re.findall(r"[a-z0-9'.]+", t):
        w = w.strip(".")
        w = SAME.get(w, w)
        out.extend(x for x in w.split() if x not in FILLERS)
    return out


def similarity(expected: str, heard: str) -> float:
    a, b = words(expected), words(heard)
    if not a:
        return 1.0
    # compare word sequences, tolerant of spelling of names and contractions
    a2 = [w.replace("'", "") for w in a]
    b2 = [w.replace("'", "") for w in b]
    return difflib.SequenceMatcher(None, a2, b2).ratio()


def load_asr(model_dir: str):
    import sherpa_onnx

    d = model_dir
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=f"{d}/encoder.int8.onnx",
        decoder=f"{d}/decoder.int8.onnx",
        joiner=f"{d}/joiner.int8.onnx",
        tokens=f"{d}/tokens.txt",
        model_type="nemo_transducer",
        num_threads=2,
    )

    def transcribe(samples: np.ndarray, sr: int) -> str:
        s = rec.create_stream()
        s.accept_waveform(sr, samples.astype(np.float32))
        rec.decode_stream(s)
        return s.result.text.strip()

    return transcribe


def encode(samples: np.ndarray, sr: int, out_path: str) -> float:
    """Trim silence, even out loudness, write mono MP3. Returns length in ms."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        sf.write(tmp.name, samples, sr)
        wav = tmp.name
    filt = (
        "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,"
        "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,"
        "loudnorm=I=-16:TP=-1.5:LRA=11"
    )
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-af", filt, "-ar", "24000", "-ac", "1",
         "-c:a", "libmp3lame", "-b:a", "48k", out_path],
        check=True,
    )
    os.unlink(wav)
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", out_path],
        capture_output=True, text=True, check=True,
    )
    return round(float(probe.stdout.strip()) * 1000)


def main():
    jobs_path, out_dir, model_dir, results_path = sys.argv[1:5]
    jobs = json.load(open(jobs_path))
    os.makedirs(out_dir, exist_ok=True)
    results = json.load(open(results_path)) if os.path.exists(results_path) else {}
    todo = [j for j in jobs if not os.path.exists(os.path.join(out_dir, j["file"]))]
    print(f"{len(jobs)} lines, {len(todo)} to record", flush=True)
    if not todo:
        return
    tts = Kokoro(f"{model_dir}/kokoro-v1.0.onnx", f"{model_dir}/voices-v1.0.bin")
    asr = load_asr(f"{model_dir}/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8")
    t_start = time.time()
    for i, j in enumerate(todo):
        voice, speed = CASTING[j["voice"]]
        text = tts_text(j["text"])
        best = None
        # a few variations if recognition doesn't hear the right words
        for attempt, (sp, tx) in enumerate([(speed, text), (speed * 0.93, text), (speed * 0.93, text.replace("!", ".") + "")]):
            samples, sr = tts.create(tx, voice=voice, speed=sp, lang="en-us")
            heard = asr(samples, sr)
            score = similarity(j["text"], heard)
            if best is None or score > best[0]:
                best = (score, samples, sr, heard, attempt)
            if score >= 0.9:
                break
        score, samples, sr, heard, attempt = best
        ms = encode(samples, sr, os.path.join(out_dir, j["file"]))
        results[j["key"]] = {"file": j["file"], "ms": ms, "heard": heard, "score": round(score, 3), "attempt": attempt}
        flag = "" if score >= 0.9 else "  <-- CHECK"
        print(f"[{i + 1}/{len(todo)}] {j['voice']:8} {score:.2f} {j['text'][:60]!r} -> {heard[:60]!r}{flag}", flush=True)
        if (i + 1) % 20 == 0:
            json.dump(results, open(results_path, "w"), indent=1, ensure_ascii=False)
    json.dump(results, open(results_path, "w"), indent=1, ensure_ascii=False)
    print(f"done in {time.time() - t_start:.0f}s", flush=True)


if __name__ == "__main__":
    main()
