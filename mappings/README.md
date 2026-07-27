# Reproducible bytecode name mappings

These checked-in maps rename obfuscated JVM symbols before the owned
java-tools decompiler emits Java. Keys always describe the original bytecode
namespace.

```json
{
  "formatVersion": 1,
  "classes": {
    "lk": "GameBucket"
  },
  "fields": {
    "lk.P:[I": "settledCells"
  },
  "methods": {
    "lk.d(II)V": "tickActivePiece"
  }
}
```

Class keys and values are JVM internal names. Field keys are
`owner.name:descriptor`. Method keys are `owner.name(descriptor)return`.
Descriptors are mandatory so overloads are never selected by name alone.

Apply a map to the transformed class directory, then run the owned decompiler:

```bash
node /home/kreijstal/git/java-tools/scripts/apply-rename-map.js \
  /path/to/transformed/classes \
  mappings/dekobloko.json \
  /path/to/named/classes

node /home/kreijstal/git/java-tools/scripts/runCfr.js \
  --preserve-field-names /path/to/semantic-field-names.txt \
  --classpath /path/to/named/classes \
  --outputdir /path/to/readable/java \
  /path/to/named/classes
```

The command refuses an existing output directory unless `--force` is supplied.
It validates missing sources, Java identifiers, duplicate class targets, field
collisions, and Java method-overload collisions before writing output. Map
entries are sorted before application and repeated runs over identical classes
produce identical output.

The mapping and the decision to preserve mapped field names are DekoBloko
policy. `java-tools` remains game-independent: it provides the generic mapping
engine and the explicit `--preserve-field-names` rendering option.

Run the complete DekoBloko validation pipeline with:

```bash
./scripts/validate-dekobloko-rename-map.sh
```

Pass `--cpu-profile` to retain a V8 CPU profile in the validation work
directory.
