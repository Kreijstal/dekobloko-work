const result = document.getElementById("result");
const files = [
  "00_headers.packvorbis.bin",
  "10_sample.packvorbis.bin",
  "16_sample.packvorbis.bin",
  "48_sample.packvorbis.bin",
];

function checked(response) {
  if (!response.ok) throw new Error(`${response.url}: HTTP ${response.status}`);
  return response.arrayBuffer();
}

function integer(fields, name) {
  const value = fields.get(`${name}:I`);
  return typeof value === "bigint" ? Number(value) : Number(value || 0);
}

try {
  const [gameJar, probeJar, ...samples] = await Promise.all([
    fetch("/jvm-assets/dekobloko.jar").then(checked),
    fetch("/jvm-assets/vorbis-probe.jar").then(checked),
    ...files.map(name => fetch(
      `/audio-data/split/archive09_group000/${name}`).then(checked)),
  ]);
  const debug = new JVMDebug.BrowserJVMDebug();
  await debug.initialize();
  await debug.loadFile(new File([gameJar], "dekobloko.jar"));
  await debug.loadFile(new File([probeJar], "vorbis-probe.jar"));
  files.forEach((name, index) => {
    debug.fileProvider.virtualFS.set(name, new Uint8Array(samples[index]));
  });
  await debug.run("JavaVorbisDecodeProbe", {args: files});
  const fields = debug.debugController.jvm.classes.JavaVorbisDecodeProbe.staticFields;
  const decoded = [];
  for (let index = 0; index < 3; index++) {
    decoded.push({
      file: files[index + 1],
      length: integer(fields, `length${index}`),
      nonZero: integer(fields, `nonZero${index}`),
      peak: integer(fields, `peak${index}`),
      checksum: integer(fields, `checksum${index}`) >>> 0,
    });
  }
  const report = {error: integer(fields, "error"), decoded};
  result.textContent = JSON.stringify(report, null, 2);
  document.title = report.error ? "Vorbis probe failed" : "Vorbis probe complete";
  window.vorbisProbeResult = report;
} catch (error) {
  result.textContent = error.stack || String(error);
  document.title = "Vorbis probe failed";
  window.vorbisProbeError = String(error);
}
