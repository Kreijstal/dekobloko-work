"use strict";
// Port of dekobloko_server/cache.py (reader for classic Jagex
// main_file_cache.dat2 / idxN stores).
//
// Python used blocking open/seek/read per call; this port keeps that shape
// with synchronous fs calls, which is fine for a server whose request paths
// are already serialized per connection. Binary data is Buffer, all multi-
// byte fields big-endian, exactly like int.from_bytes(..., "big").

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const { bzip2_decompress_bzh1 } = require("./bzip2.js");

/** Frozen equivalent of the CacheStats dataclass. */
class CacheStats {
  constructor(archive_id, group_id, length, first_sector, sectors) {
    this.archive_id = archive_id;
    this.group_id = group_id;
    this.length = length;
    this.first_sector = first_sector;
    this.sectors = sectors;
    Object.freeze(this);
  }
}

class CacheStore {
  constructor(cache_dir, max_entry_size = 100_000_000) {
    this.cache_dir = cache_dir;
    this.max_entry_size = max_entry_size;
    this.data_path = path.join(String(cache_dir), "main_file_cache.dat2");
    this._group_versions = new Map(); // archive_id -> Map(group_id -> version)
  }

  available() {
    try {
      return fs.statSync(this.data_path).isFile();
    } catch {
      return false;
    }
  }

  read(archive_id, group_id) {
    const idx_path = path.join(String(this.cache_dir), `main_file_cache.idx${archive_id}`);
    if (!this.available() || !fs.existsSync(idx_path)) {
      return null;
    }

    // index_file.seek(group_id * 6); index_record = index_file.read(6)
    const index_record = _read_at(idx_path, group_id * 6, 6);
    if (index_record === null || index_record.length !== 6) {
      return null;
    }

    const length = index_record.readUIntBE(0, 3);
    let sector = index_record.readUIntBE(3, 3);
    if (length <= 0 || length > this.max_entry_size || sector <= 0) {
      return null;
    }

    const payload = Buffer.allocUnsafe(length);
    let filled = 0;
    let chunk = 0;

    const data_fd = fs.openSync(this.data_path, "r");
    try {
      const sector_count = Math.floor(fs.fstatSync(data_fd).size / 520);

      while (filled < length) {
        if (sector <= 0 || sector > sector_count) {
          return null;
        }

        const base = sector * 520;

        // NOTE: declared at loop scope -- Python's branch-local names stay
        // alive after the if/else and are validated below.
        let current_group;
        let current_chunk;
        let next_sector;
        let current_archive;
        let block_size;

        if (group_id > 0xffff) {
          const header = _read_fd(data_fd, base, 10);
          if (header === null || header.length !== 10) {
            return null;
          }
          current_group = header.readUIntBE(0, 4);
          current_chunk = header.readUIntBE(4, 2);
          next_sector = header.readUIntBE(6, 3);
          current_archive = header[9];
          block_size = Math.min(510, length - filled);
        } else {
          const header = _read_fd(data_fd, base, 8);
          if (header === null || header.length !== 8) {
            return null;
          }
          current_group = header.readUIntBE(0, 2);
          current_chunk = header.readUIntBE(2, 2);
          next_sector = header.readUIntBE(4, 3);
          current_archive = header[7];
          block_size = Math.min(512, length - filled);
        }

        if (current_group !== group_id) {
          return null;
        }
        if (current_chunk !== chunk) {
          return null;
        }
        if (current_archive !== archive_id) {
          return null;
        }

        const block = _read_fd(data_fd, base + (group_id > 0xffff ? 10 : 8), block_size);
        if (block === null || block.length !== block_size) {
          return null;
        }
        block.copy(payload, filled);
        filled += block_size;

        sector = next_sector;
        chunk += 1;
      }
    } finally {
      fs.closeSync(data_fd);
    }

    return payload;
  }

  stats(archive_id, group_id) {
    const idx_path = path.join(String(this.cache_dir), `main_file_cache.idx${archive_id}`);
    if (!this.available() || !fs.existsSync(idx_path)) {
      return null;
    }
    const index_record = _read_at(idx_path, group_id * 6, 6);
    if (index_record === null || index_record.length !== 6) {
      return null;
    }
    const length = index_record.readUIntBE(0, 3);
    const first_sector = index_record.readUIntBE(3, 3);
    if (length <= 0 || first_sector <= 0) {
      return null;
    }
    const payload_per_sector = group_id > 0xffff ? 510 : 512;
    const sectors = Math.floor((length + payload_per_sector - 1) / payload_per_sector);
    return new CacheStats(archive_id, group_id, length, first_sector, sectors);
  }

  group_version(archive_id, group_id) {
    let versions = this._group_versions.get(archive_id);
    if (versions === undefined) {
      versions = this._read_group_versions(archive_id);
      this._group_versions.set(archive_id, versions);
    }
    const value = versions.get(group_id);
    return value === undefined ? null : value;
  }

  _read_group_versions(archive_id) {
    const raw = this.read(255, archive_id);
    if (raw === null || raw.length < 6) {
      return new Map();
    }
    const compression = raw[0];
    const compressed_length = raw.readUInt32BE(1);
    let data;
    if (compression === 0) {
      data = raw.subarray(5, 5 + compressed_length);
    } else {
      if (raw.length < 9) {
        return new Map();
      }
      const compressed = raw.subarray(9, 9 + compressed_length);
      if (compression === 1) {
        data = bzip2_decompress_bzh1(compressed); // bz2.decompress(b"BZh1" + ...)
      } else if (compression === 2) {
        data = gzip_decompress(compressed);
      } else {
        return new Map();
      }
    }

    let position = 0;
    const protocol = data[position];
    position += 1;
    if (protocol >= 6) {
      position += 4;
    }
    const flags = data[position];
    position += 1;
    if (protocol >= 7) {
      return new Map();
    }
    const group_count = data.readUIntBE(position, 2);
    position += 2;
    const group_ids = [];
    let group_id_value = 0;
    for (let i = 0; i < group_count; i++) {
      group_id_value += data.readUIntBE(position, 2);
      position += 2;
      group_ids.push(group_id_value);
    }
    if (flags & 1) {
      position += group_count * 4;
    }
    position += group_count * 4; // CRCs
    if (flags & 2) {
      position += group_count * 64;
    }
    const versions = new Map();
    for (const current_group_id of group_ids) {
      versions.set(current_group_id, data.readUInt32BE(position));
      position += 4;
    }
    return versions;
  }
}

/** gzip.decompress() for cache containers. Python's gzip.decompress reads
 * every member and rejects trailing garbage; node's gunzipSync stops at the
 * end of the first member, which is what container payloads actually contain.
 * Trailing bytes beyond compressed_length are already excluded by callers. */
function gzip_decompress(buf) {
  return zlib.gunzipSync(buf);
}

/** Read exactly size bytes at absolute offset from a file path; null on EOF. */
function _read_at(file, offset, size) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
  } catch {
    return null;
  }
  try {
    return _read_fd(fd, offset, size);
  } finally {
    fs.closeSync(fd);
  }
}

/** Read exactly size bytes at absolute offset from an open fd; null on EOF.
 * Mirrors Python's file.read(n): may return fewer than n only at EOF. */
function _read_fd(fd, offset, size) {
  const buf = Buffer.allocUnsafe(size);
  let total = 0;
  while (total < size) {
    let got;
    try {
      got = fs.readSync(fd, buf, total, size - total, offset + total);
    } catch (err) {
      if (err.code === "EISDIR" || err.code === "EBADF") throw err;
      return null;
    }
    if (got === 0) return null;
    total += got;
  }
  return buf;
}

module.exports = { CacheStore, CacheStats };
