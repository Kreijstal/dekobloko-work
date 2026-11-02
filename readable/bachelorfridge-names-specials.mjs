// Reviewed names: the 50 special moves. rf.field_h lists the move-name table
// (index 88..137 are SPECIAL_*); td.a(op,int) maps each id to one td subclass
// whose a(op,int) builds one bca event whose a(int,gj) builds one ana animation.
import {cls} from './bachelorfridge-name-api.mjs';

const table = 'SPECIAL_%s is index %d in the rf move-name table and td.a(op,int) maps id %d to';
// [id, TableName, CamelName, order, event, animation]
const rows = [
  [88, 'SNOW', 'Snow', 'rd', 'ak', 'pw'], [89, 'SUPERSPEED', 'SuperSpeed', 'tg', 'jl', 'maa'], [90, 'SLEEP', 'Sleep', 'sw', 'mna', 'hha'],
  [91, 'SHIELD', 'Shield', 'fla', 'pba', 'nna'], [92, 'HAIL', 'Hail', 'ql', 'uj', 'jba'], [93, 'RAISE', 'Raise', 'io', 'hla', 'vea'],
  [94, 'DBOMBER', 'DiveBomber', 'ifa', 'ju', 'kla'], [95, 'MARTYR', 'Martyr', 's', 'vk', 'wf'], [96, 'INCOMING', 'Incoming', 'dk', 'av', 'pm'],
  [97, 'SPILTMILK', 'SpiltMilk', 'h', 'cv', 'bk'], [98, 'DREAMS', 'Dreams', 'tha', 'bt', 'gp'], [99, 'SLOWALL', 'SlowAll', 'of', 'sm', 'vq'],
  [100, 'INSANOSAUCE', 'InsanoSauce', 'eha', 'j', 'cma'], [101, 'SUPERSPEEDALL', 'SuperSpeedAll', 'nh', 'lk', 'nt'],
  [102, 'SHUFFLE', 'Shuffle', 'fb', 'fna', 'om'], [103, 'FLOOD', 'Flood', 'ww', 'ku', 'cu'], [104, 'LEVITATE', 'Levitate', 'eg', 'fia', 'jw'],
  [105, 'FULLHEAL', 'FullHeal', 'ui', 'wfa', 'uga'], [106, 'INVINCIBLE', 'Invincible', 'dr', 'wga', 'lb'], [107, 'CLAMS', 'Clams', 'vfa', 'bea', 'lma'],
  [108, 'DISABLE', 'Disable', 'ts', 'lca', 'bna'], [109, 'FISHRAIN', 'FishRain', 'eb', 'tba', 'qr'], [110, 'MASSPOISON', 'MassPoison', 'mp', 'kh', 'uk'],
  [111, 'ZOMBIES', 'Zombies', 'sg', 'ps', 'cka'], [112, 'FLY', 'Fly', 'nw', 'cja', 'mm'], [113, 'TBOMBER', 'TBomber', 'kl', 'la', 'dca'],
  [114, 'STICKY', 'Sticky', 'efa', 'u', 'tp'], [115, 'FLIRT', 'Flirt', 'ab', 'oga', 'er'], [116, 'HMISSILE', 'HomingMissile', 'fq', 'fk', 'aka'],
  [117, 'BANANARANG', 'Bananarang', 'hea', 'rn', 'baa'], [118, 'STAMPEDE', 'Stampede', 'mja', 'oo', 'nm'],
  [120, 'SCAVENGER', 'Scavenger', 'mt', 'nb', 'eja'], [121, 'ATTACKUPALL', 'AttackUpAll', 'gh', 'kk', 'bp'],
  [122, 'SAUCEOFFLAME', 'SauceOfFlame', 'ud', 'ica', 'aw'], [123, 'SPLIT', 'Split', 'hj', 'l', 'tma'], [124, 'CRANBERRY', 'Cranberry', 'ija', 'rb', 'mea'],
  [125, 'BUFFVENDOR', 'BuffVendor', 'rl', 'me', 'od'], [126, 'HAZMAT', 'Hazmat', 'wc', 'jaa', 'cca'], [127, 'BAGPIPE', 'Bagpipe', 'ch', 'ir', 'vh'],
  [128, 'RESET', 'Reset', 'ja', 'vba', 'oi'], [129, 'PETATTACK', 'PetAttack', 'no', 'tl', 'fv'], [130, 'TELEPORT', 'Teleport', 'uba', 'ima', 'ln'],
  [131, 'AIRSTRIKE', 'Airstrike', 'kea', 'tla', 'fd'], [132, 'PIZZAPARTY', 'PizzaParty', 'ci', 'naa', 'jga'], [133, 'OHNO', 'OhNo', 'fc', 'iba', 'ki'],
  [134, 'REFRESHING', 'Refreshing', 'wh', 'vha', 'nma'], [135, 'RAGE', 'Rage', 'bla', 'pg', 'nr'], [136, 'GASCLOUD', 'GasCloud', 'vka', 'lp', 'sma'],
  [137, 'ONE', 'One', 'qga', 'ct', 'gq'],
];
for (const [id, tableName, camel, order, event, animation] of rows) {
  const prefix = table.replace('%s', tableName).replace('%d', id).replace('%d', id);
  cls(order, camel + 'Special', `${prefix} this td subclass.`);
  cls(event, camel + 'Event', `td subclass ${camel}Special builds this bca event in its a(op,int).`);
  cls(animation, camel + 'Animation', `bca subclass ${camel}Event builds this ana animation in a(int,gj).`);
}
