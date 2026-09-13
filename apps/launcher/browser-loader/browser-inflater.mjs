// Whole-container Inflater adapter for JS5 clients. Older browser JVM bundles
// resolve java.util.zip.Inflater through Node's zlib stub, which cannot inflate.
export function installBrowserInflater(jvm, decoder = globalThis.pako) {
  if (!decoder?.inflate || !decoder?.inflateRaw) throw new Error('Browser inflate decoder unavailable');
  const inflater = jvm.jre['java/util/zip/Inflater'];
  if (!inflater) throw new Error('JVM Inflater natives unavailable');
  const methods = inflater.methods;
  const fresh = nowrap => ({nowrap: Boolean(nowrap), input: null, output: null, cursor: 0, ended: false});
  const stateOf = object => {
    const state = object.browserInflater;
    if (!state || state.ended) throw {type: 'java/lang/IllegalStateException', message: 'Inflater is closed'};
    return state;
  };
  const arrayOf = value => {
    if (value == null) throw {type: 'java/lang/NullPointerException', message: 'Inflater byte array is null'};
    const array = value.array || value;
    if (!Array.isArray(array) && !ArrayBuffer.isView(array)) throw {type: 'java/lang/IllegalArgumentException', message: 'Invalid byte array'};
    return array;
  };
  const bounds = (array, offset, length) => {
    if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0 || offset + length > array.length)
      throw {type: 'java/lang/ArrayIndexOutOfBoundsException', message: 'Invalid Inflater buffer range'};
  };
  methods['<init>()V'] = (_jvm, object) => { object.browserInflater = fresh(false); };
  methods['<init>(Z)V'] = (_jvm, object, args) => { object.browserInflater = fresh(args[0]); };
  const setInput = (_jvm, object, args) => {
    const state = stateOf(object), array = arrayOf(args[0]);
    const offset = args.length > 1 ? args[1] : 0, length = args.length > 2 ? args[2] : array.length;
    bounds(array, offset, length);
    state.input = Uint8Array.from(array.slice(offset, offset + length));
    state.output = null; state.cursor = 0;
  };
  methods['setInput([B)V'] = methods['setInput([BII)V'] = setInput;
  const inflate = async (_jvm, object, args) => {
    const state = stateOf(object), target = arrayOf(args[0]);
    const offset = args.length > 1 ? args[1] : 0, length = args.length > 2 ? args[2] : target.length;
    bounds(target, offset, length);
    if (!length || !state.input?.length) return 0;
    if (!state.output) {
      try {
        state.output = state.nowrap ? decoder.inflateRaw(state.input) : decoder.inflate(state.input);
      } catch (error) {
        throw {type: 'java/util/zip/DataFormatException', message: String(error.message || error)};
      }
    }
    const count = Math.min(length, state.output.length - state.cursor);
    for (let i = 0; i < count; i++) target[offset + i] = (state.output[state.cursor + i] << 24) >> 24;
    state.cursor += count;
    return count;
  };
  inflate.__throws = ['java/util/zip/DataFormatException', 'java/lang/ArrayIndexOutOfBoundsException', 'java/lang/NullPointerException'];
  inflate.__declaredThrows = ['java/util/zip/DataFormatException'];
  methods['inflate([B)I'] = methods['inflate([BII)I'] = inflate;
  methods['finished()Z'] = (_jvm, object) => { const s = stateOf(object); return Boolean(s.output && s.cursor === s.output.length) ? 1 : 0; };
  methods['needsInput()Z'] = (_jvm, object) => { const s = stateOf(object); return !s.input?.length || s.output ? 1 : 0; };
  methods['needsDictionary()Z'] = () => 0;
  methods['getRemaining()I'] = (_jvm, object) => { const s = stateOf(object); return s.output ? 0 : s.input?.length || 0; };
  methods['getTotalIn()I'] = (_jvm, object) => { const s = stateOf(object); return s.output ? s.input.length : 0; };
  methods['getTotalOut()I'] = (_jvm, object) => stateOf(object).cursor;
  methods['getBytesRead()J'] = (vm, object) => BigInt(methods['getTotalIn()I'](vm, object));
  methods['getBytesWritten()J'] = (_jvm, object) => BigInt(stateOf(object).cursor);
  methods['reset()V'] = (_jvm, object) => { object.browserInflater = fresh(stateOf(object).nowrap); };
  methods['end()V'] = (_jvm, object) => { object.browserInflater = {...fresh(false), ended: true}; };
}
