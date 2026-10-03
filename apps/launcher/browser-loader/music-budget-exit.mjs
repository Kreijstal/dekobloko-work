// Experimental companion to incremental music loading. Leave the unlimited
// request path unchanged and retain cached instruments across bounded requests.
export function patchMusicBudgetExit(source, sourcePath) {
  if (sourcePath !== 'games/geoblox/kj.java' || source.includes('deko-music-budget-exit')) return source;
  const anchor = `              } else {
                L4: {
                  var9 = (int)var8.field_a;
                  var10 = (vl) ((Object) this.field_q.a((long)var9, (byte) -91));`;
  if (source.split(anchor).length !== 2) return source;
  return source.replace(anchor, `              } else {
                // deko-music-budget-exit: resume from cached state next update.
                if (var7 != null && ((int[]) var7)[0] <= 0) return false;
                L4: {
                  var9 = (int)var8.field_a;
                  var10 = (vl) ((Object) this.field_q.a((long)var9, (byte) -91));`);
}
